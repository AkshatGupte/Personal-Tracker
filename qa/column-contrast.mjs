/**
 * The reading column never sits on a bright ground, at any scroll offset.
 *
 * The defect this exists to prevent is not "some text is low contrast" — it is
 * that the *same* text passed or failed depending on where the page happened to
 * be scrolled to. The atmosphere layers are `position: fixed`, so they are
 * locked to the viewport while the page scrolls past them; a lit thread that
 * sits in the margin at one offset lies across a control band at another.
 * Measured on one topic row before the fix: 3.50:1 at scrollY 0, 5.71:1 at 260,
 * 7.05:1 at 520.
 *
 * So this samples the real composited ground *behind the content column* at
 * several offsets on every page, and asserts two things:
 *
 *  1. No text region in the column sits on a ground brighter than L = 0.02.
 *  2. Every sampled text region clears 4.5:1 against that ground.
 *
 * Method, and why it is pixels rather than computed styles: the ground under a
 * string is a composite of the page background, three rift glows, the speed
 * lines, the halftone and the neon threads. No computed style anywhere reports
 * that. Text is hidden — leaving every background layer exactly as it was — the
 * frame is captured, and the worst (lightest) pixel under each text rect is
 * measured against the text's own colour.
 *
 * Unlike `qa/contrast-check.mjs`, which measures a handful of named strings
 * against the ink halo, this sweeps whole rows and is about the *ground*: the
 * halo can rescue a glyph, and it cannot rescue an interface whose ground
 * changes brightness as you scroll.
 *
 *   node qa/column-contrast.mjs [baseUrl] [trackPath]
 */
import { inflateSync } from "node:zlib";
import { launch } from "./cdp.mjs";

const BASE = process.argv[2] ?? "http://localhost:3488";
const TRACK = process.argv[3] ?? null;
const MIN_RATIO = 4.5;
/** The ceiling the column's ground is held under. */
const MAX_GROUND_L = 0.02;
const OFFSETS = [0, 260, 520, 900];
const WIDTHS = [1280, 1440];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VERBOSE = process.env.VERBOSE === "1";

/* --------------------------------------------------------------- png ----- */
/** Decodes a non-interlaced 8-bit RGB/RGBA PNG. Same decoder as
 *  `contrast-check.mjs`; this directory stays dependency-free. */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png");
  let pos = 8, width = 0, height = 0, channels = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error(`bit depth ${data[8]} unsupported`);
      if (data[12] !== 0) throw new Error("interlaced png unsupported");
      channels = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0;
      if (!channels) throw new Error(`colour type ${data[9]} unsupported`);
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
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
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

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const luminance = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const parseColour = (s) => {
  const n = (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  return n.length === 3 ? n : null;
};

/* ------------------------------------------------------------- checks ---- */
const b = await launch();
const p = await b.page(1280, 900);
let bad = 0;
let worstGround = 0;
let worstRatio = Infinity;

const routes = ["/", "/progress", ...(TRACK ? [TRACK] : [])];

for (const w of WIDTHS) {
  await p.resize(w, 900);
  for (const route of routes) {
    await p.goto(`${BASE}${route}`);
    await sleep(600);

    for (const offset of OFFSETS) {
      await p.eval(`window.scrollTo(0, ${offset})`);
      await sleep(450);
      const at = await p.eval("Math.round(scrollY)");

      /*
        Text inside the reading column that is actually sitting on the ground.

        Three exclusions, and each one is about measuring the right thing rather
        than about getting a pass:

        - **`aria-hidden` subtrees.** `GlitchText` paints two offset duplicates
          of every heading in the split plates. They are decoration, they are
          hidden from the accessibility tree, and one of them is magenta text on
          the magenta caption bar — which scores 1.00:1 and means nothing. They
          are not text regions.
        - **Text on an opaque surface.** A comic panel, a yellow button and a
          filled activity cell all paint their own background, so the atmosphere
          is not behind them at all. The invariant here is about the *ground*
          showing through; a designed plate is not the ground, and the contrast
          of ink on that plate is a different question with a different answer.
        - **Elements that only wrap other elements.** Leaf text owners only, so
          a container's rect does not stand in for the strings inside it.
      */
      const targets = await p.eval(`(() => {
        const col = document.querySelector('.mx-auto.max-w-5xl');
        if (!col) return [];
        /* NOTE: this runs inside a template literal, so every backslash meant
           for the page must be doubled here. An un-doubled \\d silently became
           a literal "d" and this predicate returned false for everything —
           the check then measured ink-on-yellow buttons against the ground
           behind them and reported 1.03:1. */
        const opaque = (el) => {
          for (let n = el; n && n !== document.body; n = n.parentElement) {
            if (n.getAttribute && n.getAttribute('data-col-target') !== null) continue;
            const bg = getComputedStyle(n).backgroundColor;
            const m = bg.match(/[\\d.]+/g);
            if (!m) continue;
            const alpha = m.length > 3 ? Number(m[3]) : 1;
            if (alpha >= 0.9 && bg !== 'rgba(0, 0, 0, 0)') return true;
          }
          return false;
        };
        const out = [];
        for (const el of col.querySelectorAll('*')) {
          const owns = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!owns) continue;
          if (el.closest('[aria-hidden="true"]')) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
          /*
            checkVisibility as well, because the cheap checks miss the case that
            actually bit: the heatmap's day-by-day list lives in a closed
            details element, which Chrome hides with content-visibility rather
            than display:none. Its rows still report a laid-out rect, so an
            unpainted row was measured as a text region — and its stale rect
            landed on the History table two panels away, reporting that table's
            own content as a ground of L 0.19.

            (No backticks in here on purpose: this whole block is a template
            literal, and one would end the string.)
          */
          if (el.checkVisibility && !el.checkVisibility({
            contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true,
          })) continue;
          if (opaque(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 8 || r.height < 6) continue;
          if (r.bottom < 0 || r.top > innerHeight) continue;
          el.setAttribute('data-col-target', '');
          out.push({
            text: el.textContent.trim().slice(0, 22), colour: cs.color,
            tag: el.tagName + '.' + String(el.className).slice(0, 34),
            x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)),
            w: Math.round(Math.min(r.width, innerWidth - r.x)),
            h: Math.round(Math.min(r.height, innerHeight - r.y)),
          });
        }
        return out;
      })()`);
      if (targets.length === 0) continue;

      /*
        Hide the glyphs — all of them. Every background layer stays as it was.

        `.sv-glitch-layer` goes too, and it has to: `GlitchText` paints two
        offset duplicates of each heading in the split plates, and hiding only
        the base string leaves a cyan copy of the same word lying exactly where
        the word was. Measured against that, a cyan section label scored 1.00:1
        on a "ground" of L 0.86 — which is the label reading itself, not the
        atmosphere. They are part of the text's rendering, so they are hidden
        with the text.
      */
      await p.eval(`(() => {
        document.querySelectorAll('[data-col-target], .sv-glitch-layer')
          .forEach((el) => { el.style.visibility = 'hidden'; });
        return 1;
      })()`);
      await sleep(250);
      const shot = await p.send("Page.captureScreenshot", { format: "png" });
      const img = decodePng(Buffer.from(shot.data, "base64"));

      // One row per target, so the two facts below are never attributed to the
      // wrong element — the brightest ground and the worst ratio are usually
      // different strings, and reporting them as one line hides both.
      const scored = [];
      for (const t of targets) {
        const fg = parseColour(t.colour);
        if (!fg || t.w <= 0 || t.h <= 0) continue;
        const lFg = luminance(fg[0], fg[1], fg[2]);
        let groundL = 0;
        let worst = Infinity;
        for (let y = t.y; y < Math.min(t.y + t.h, img.height); y++) {
          for (let x = t.x; x < Math.min(t.x + t.w, img.width); x++) {
            const o = (y * img.width + x) * 3;
            const lBg = luminance(img.rgb[o], img.rgb[o + 1], img.rgb[o + 2]);
            if (lBg > groundL) groundL = lBg;
            const r = ratio(lFg, lBg);
            if (r < worst) worst = r;
          }
        }
        scored.push({ ...t, groundL, worst });
      }
      if (scored.length === 0) continue;

      const brightest = scored.reduce((a, c) => (c.groundL > a.groundL ? c : a));
      const dimmest = scored.reduce((a, c) => (c.worst < a.worst ? c : a));
      worstGround = Math.max(worstGround, brightest.groundL);
      worstRatio = Math.min(worstRatio, dimmest.worst);

      const groundOk = brightest.groundL <= MAX_GROUND_L;
      const ratioOk = dimmest.worst >= MIN_RATIO;
      if (!groundOk || !ratioOk) bad++;
      console.log(
        `  ${groundOk && ratioOk ? "ok  " : "FAIL"} @${w} ${route} y=${at} · ${scored.length} regions`,
      );
      if (!groundOk || VERBOSE)
        console.log(
          `        brightest ground L=${brightest.groundL.toFixed(4)} under "${brightest.text}" (${brightest.tag})`,
        );
      if (!ratioOk || VERBOSE)
        console.log(
          `        worst contrast ${dimmest.worst.toFixed(2)}:1 on "${dimmest.text}" (${dimmest.tag}) ${dimmest.colour}`,
        );
    }
  }
}

await b.close();
console.log(
  `\nworst ground L ${worstGround.toFixed(4)} · worst contrast ${worstRatio.toFixed(2)}:1`,
);
console.log(bad === 0 ? "ALL CLEAR" : `${bad} sample(s) failed`);
process.exit(bad === 0 ? 0 : 1);
