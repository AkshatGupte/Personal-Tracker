/**
 * Measures text contrast against the **composited** background.
 *
 * `CLAUDE.md` requires every text/background pair to clear 4.5:1 against the
 * ground as actually rendered, and says to measure rather than assume, because
 * the atmosphere layers lighten the background unevenly. Eyeballing a
 * screenshot cannot answer that: a glow is a gradient, and the worst pixel is
 * rarely the one you happen to look at.
 *
 * Method:
 *  1. Freeze every animation, so two frames of the same page differ only where
 *     the text is.
 *  2. Collect the target elements, their rects and their computed colours.
 *  3. Screenshot with the glyph fill set to `transparent` — which keeps the ink
 *     halo, since a `text-shadow` is painted from glyph geometry and ignores
 *     the fill colour — and again with the text hidden outright. Every
 *     background layer is untouched in both.
 *  4. The pixels those two frames differ on are where the text is actually
 *     painted. Take the worst (lightest, since this theme is light-on-dark) of
 *     them from the halo frame and compute the WCAG ratio against the text
 *     colour.
 *
 * **Step 4 replaced "the worst pixel anywhere in the element's rect".** That was
 * a proxy written before the halo existed, and it measures the wrong pair: a
 * glow passing through the gap between two words never touches a letterform,
 * and a halo — which is *part of* the text's own rendering — disappears along
 * with the text when the ground is sampled by hiding it. Both numbers are still
 * printed; the glyph one is what passes or fails. `NO_HALO=1` strips the halo
 * and measures the same way, so the fix and the method change can be told
 * apart.
 *
 * PNG is decoded here rather than pulled in as a dependency: `node:zlib` is
 * built in and the rest is a scanline unfilter. The project keeps its QA
 * dependency-free and this is not a good reason to break that.
 *
 *   node qa/contrast-check.mjs [baseUrl]
 *   NO_HALO=1 node qa/contrast-check.mjs [baseUrl]   # same method, halo removed
 */
import { inflateSync } from "node:zlib";
import { launch } from "./cdp.mjs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const MIN_RATIO = 4.5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------ png decode -- */

/** Decodes a non-interlaced 8-bit RGB/RGBA PNG to { width, height, rgb }. */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png");
  let pos = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      const colour = data[9];
      if (depth !== 8) throw new Error(`bit depth ${depth} unsupported`);
      if (data[12] !== 0) throw new Error("interlaced png unsupported");
      channels = colour === 6 ? 4 : colour === 2 ? 3 : 0;
      if (!channels) throw new Error(`colour type ${colour} unsupported`);
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 3);
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      if (filter === 1) line[i] = (line[i] + a) & 0xff;
      else if (filter === 2) line[i] = (line[i] + b) & 0xff;
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
    }
    for (let x = 0; x < width; x++) {
      out[(y * width + x) * 3] = line[x * channels];
      out[(y * width + x) * 3 + 1] = line[x * channels + 1];
      out[(y * width + x) * 3 + 2] = line[x * channels + 2];
    }
    prev = line;
  }
  return { width, height, rgb: out };
}

/* ------------------------------------------------------------- contrast -- */

const srgb = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

function parseColour(css) {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b] = m[1].split(",").map((n) => parseFloat(n));
  return [r, g, b];
}

/* ------------------------------------------------------------------ run -- */

/**
 * Whether to strip the ink halo before measuring.
 *
 * The halo and this method arrived together, so "it passes now" would be
 * unfalsifiable without a way to take one away and keep the other. `NO_HALO=1`
 * measures the same page, the same way, with `body`'s text-shadow removed —
 * which is what makes the two numbers in the write-up comparable.
 */
const NO_HALO = process.env.NO_HALO === "1";

const b = await launch();
const p = await b.page(1280, 900);
let bad = 0;

for (const w of [1560, 1280, 390]) {
  await p.resize(w, 900);
  await p.goto(`${BASE}/`);
  if ((await p.eval("location.pathname")) !== "/") {
    console.log(`  !! not on / at ${w}`);
    bad++;
    continue;
  }
  await sleep(700);

  /*
    Freeze the atmosphere before anything is captured.

    Two screenshots are compared pixel for pixel below to find where the halo
    sits. The rift glows drift on 29-43s periods and a tear can open at any
    moment, so a few hundred milliseconds between the captures is more than
    enough to put motion into the difference and scatter the mask over the whole
    rect. Pausing every animation makes the two frames differ only in the text.
  */
  await p.eval(`(() => { for (const a of document.getAnimations()) a.pause(); return 1; })()`);
  if (NO_HALO) await p.eval(`(() => { document.body.style.textShadow = "none"; return 1; })()`);

  // Text sitting on open background, where the atmosphere actually shows —
  // not text inside a panel, which has its own opaque ground.
  const targets = await p.eval(`(() => {
    const sel = ['#elevation-heading', 'p.max-w-\\\\[34ch\\\\]', 'figure span', 'span.text-streak'];
    const seen = new Set(); const out = [];
    for (const s of sel) {
      for (const el of document.querySelectorAll(s)) {
        if (seen.has(el)) continue; seen.add(el);
        const r = el.getBoundingClientRect();
        if (r.width < 6 || r.height < 6) continue;
        if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
        if (el.closest('.sv-panel')) continue;
        el.setAttribute('data-contrast-target', String(out.length));
        out.push({ i: out.length, text: el.textContent.trim().slice(0, 26),
          colour: getComputedStyle(el).color,
          x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)),
          w: Math.round(Math.min(r.width, innerWidth - r.x)),
          h: Math.round(Math.min(r.height, innerHeight - r.y)) });
      }
    }
    return out;
  })()`);

  const capture = async () => {
    await sleep(220);
    const shot = await p.send("Page.captureScreenshot", { format: "png" });
    return decodePng(Buffer.from(shot.data, "base64"));
  };

  /*
    Two frames, and the difference between them is the whole method.

    **Halo frame** — the glyph fill set to `transparent`, on the target and
    every descendant, because `GlitchText` colours its own layers inline. A
    `text-shadow` is painted from the glyph *geometry* and does not care what
    colour the fill is, so what survives is exactly the ink the glyph will sit
    on. Descendants matter: without them a heading's chromatic split layers stay
    lit and are counted as background.

    **Ground frame** — the text hidden outright, halo and all. Every background
    layer is untouched in both.
  */
  await p.eval(`(() => {
    for (const el of document.querySelectorAll('[data-contrast-target]')) {
      el.style.setProperty('color', 'transparent', 'important');
      for (const kid of el.querySelectorAll('*')) kid.style.setProperty('color', 'transparent', 'important');
    }
    return 1;
  })()`);
  const halo = await capture();

  await p.eval(`(() => {
    document.querySelectorAll('[data-contrast-target]').forEach(el => { el.style.visibility = 'hidden'; });
    return 1;
  })()`);
  const ground = await capture();

  for (const t of targets) {
    const fg = parseColour(t.colour);
    if (!fg || t.w <= 0 || t.h <= 0) continue;
    const lFg = luminance(fg[0], fg[1], fg[2]);

    const x1 = Math.min(t.x + t.w, ground.width);
    const y1 = Math.min(t.y + t.h, ground.height);
    const rw = x1 - t.x;
    const rh = y1 - t.y;
    if (rw <= 0 || rh <= 0) continue;

    /*
      `box` — the worst pixel anywhere in the element's rect.

      What this file measured before the halo existed. It is a *proxy*: it will
      flag a glow passing through the gap between two words without ever
      touching a letterform. Kept and always printed, because it is the honest
      picture of how bright the region behind the type gets, and because it is
      the number the pre-halo runs were reported in.
    */
    let box = Infinity;
    let boxPx = null;

    // Where the text is painted: every pixel the two frames differ on. For a
    // one-pixel ring in eight directions that is the glyph dilated by a pixel.
    const mask = new Uint8Array(rw * rh);
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        const o = ((y + t.y) * ground.width + (x + t.x)) * 3;
        const gr = ground.rgb[o];
        const gg = ground.rgb[o + 1];
        const gb = ground.rgb[o + 2];
        const r = ratio(lFg, luminance(gr, gg, gb));
        if (r < box) {
          box = r;
          boxPx = [gr, gg, gb];
        }
        // 8 per channel: comfortably above capture noise, far below the step
        // from a lit thread to `--bg`.
        if (
          Math.abs(halo.rgb[o] - gr) > 8 ||
          Math.abs(halo.rgb[o + 1] - gg) > 8 ||
          Math.abs(halo.rgb[o + 2] - gb) > 8
        ) {
          mask[y * rw + x] = 1;
        }
      }
    }

    /*
      Eroded by one pixel, and this is the part that has to be got right.

      The raw mask includes the halo's own outer fringe — pixels where the ring
      only partly covers, which are therefore still nearly as bright as whatever
      is behind them. Measured against those, a working halo reports 1.01:1 and
      the check can never pass; the first run after the halo shipped did exactly
      that. Those pixels are outside the letterform: what sits on them is the
      glyph's antialiased edge, and antialiased edges always land between the
      two colours, which is why no contrast rule is evaluated on them.

      Dropping every masked pixel that touches an unmasked one leaves the glyph
      body — pixels at least a pixel inside the ring, which is where the solid
      part of the letter is drawn. **This is not a way of only measuring pixels
      that already pass.** A pixel survives erosion on geometry alone, and what
      is read there is whatever the halo actually composited to: a halo that did
      not apply leaves an empty mask and falls back to `box`, one that is too
      thin for a heavy glyph leaves the lit background showing inside the
      letterform, and either fails here.
    */
    const body = new Uint8Array(rw * rh);
    for (let y = 1; y < rh - 1; y++) {
      for (let x = 1; x < rw - 1; x++) {
        const i = y * rw + x;
        if (
          mask[i] &&
          mask[i - 1] &&
          mask[i + 1] &&
          mask[i - rw] &&
          mask[i + rw]
        ) {
          body[i] = 1;
        }
      }
    }

    let glyph = Infinity;
    let glyphPx = null;
    let seen = 0;
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        if (!body[y * rw + x]) continue;
        seen++;
        const o = ((y + t.y) * ground.width + (x + t.x)) * 3;
        const r = ratio(lFg, luminance(halo.rgb[o], halo.rgb[o + 1], halo.rgb[o + 2]));
        if (r < glyph) {
          glyph = r;
          glyphPx = [halo.rgb[o], halo.rgb[o + 1], halo.rgb[o + 2]];
        }
      }
    }

    // No body pixels means no halo was painted here — an opted-out element, or
    // `NO_HALO=1`. Fall back to the proxy and say so, so a stripped run cannot
    // quietly measure something easier than a normal one.
    const haloed = seen > 0;
    const worst = haloed ? glyph : box;
    const worstPx = haloed ? glyphPx : boxPx;
    const ok = worst >= MIN_RATIO;
    if (!ok) bad++;
    console.log(
      `  ${ok ? "ok  " : "FAIL"} @${w} ${worst.toFixed(2)}:1  "${t.text}" ` +
        `${t.colour} on rgb(${worstPx.join(",")})` +
        (haloed ? `  [box ${box.toFixed(2)}:1, ${seen}px]` : `  [no halo — box measure]`),
    );
  }
}

await b.close();
console.log(
  bad === 0
    ? `\nALL CLEAR (>= ${MIN_RATIO}:1)${NO_HALO ? " — with the halo stripped" : ""}`
    : `\n${bad} below ${MIN_RATIO}:1${NO_HALO ? " — with the halo stripped" : ""}`,
);
process.exit(bad === 0 ? 0 : 1);
