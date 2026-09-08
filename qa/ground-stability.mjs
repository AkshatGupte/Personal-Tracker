/**
 * The ground behind the reading column does not change as you scroll.
 *
 * **This replaced `qa/column-contrast.mjs`, which asserted a rule the project
 * deliberately dropped.** That check held the composited ground under every text
 * region below L = 0.02, a ceiling that only existed because the atmosphere was
 * masked out of the 1024px reading column. The mask — the "column veil" — was
 * reverted the day after it shipped, on the grounds that it turned a wide screen
 * into a flat black rectangle with the design surviving only in the margins. The
 * ceiling went with it, and the check spent several sessions failing by design
 * with a warning block in this README telling everyone to ignore it. A check
 * that always fails teaches people to stop reading failures.
 *
 * **What is worth keeping is the defect it was written for, not its threshold.**
 * The original complaint was never "some text is low contrast" — it was that the
 * *same* text passed or failed depending on where the page happened to be
 * scrolled to. The atmosphere was `position: fixed`, so it was pinned to the
 * viewport while the page slid past it, and a lit thread sitting in the margin
 * at one offset lay across a control band at another. Measured on one topic row
 * at the time: 3.50:1 at scrollY 0, 5.71:1 at 260, 7.05:1 at 520.
 *
 * That cannot happen now, and this asserts it stays that way. The atmosphere
 * spans the document and scrolls with the content (see `useDocumentBands`), so
 * a row and the ground behind it move together and the composite under a given
 * string is the same wherever you have scrolled to. This samples one element's
 * ground at several offsets and asserts the variation stays negligible.
 *
 * **The failure it catches is a real and easy one:** making any atmosphere layer
 * `position: fixed` again. That is a one-word change, it looks harmless, it
 * costs nothing at scroll 0 — and it brings back scroll-dependent legibility
 * across the whole app. The speed lines *are* still fixed, deliberately, for a
 * measured repaint reason; they are a uniform 4%-opacity hairline field with no
 * located feature, and the tolerance below is set from what they actually
 * contribute.
 *
 * Not a contrast check. `qa/contrast-check.mjs` measures glyph contrast against
 * the ink halo and is the thing that says text is readable; this says the answer
 * does not depend on scroll position. Keep the two apart when reading a result.
 *
 *   node qa/ground-stability.mjs [baseUrl]
 */
import { inflateSync } from "node:zlib";
import { launch } from "./cdp.mjs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const WIDTHS = [1440, 1280];
const OFFSETS = [0, 120, 260, 420];

/**
 * How much the ground under one element may vary across scroll offsets, as mean
 * absolute difference in linear luminance per sampled pixel.
 *
 * Calibrated, not guessed: with everything scrolling together the measured
 * variation is ~0 and the only contributor is the pinned speed-line layer. The
 * threshold sits between the two, measured in both states rather than guessed:
 * clean it reads 0.0009-0.0012 across every page and width; with the atmosphere
 * re-pinned it reads 0.0028 on the short home page and 0.006-0.020 on the pages
 * long enough to scroll properly. 0.0025 is above the first band and below the
 * second, so the regression is caught even on the page with least room to move.
 */
const MAX_DRIFT = 0.0025;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* --------------------------------------------------------------- png ----- */

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


/* ------------------------------------------------------------ measure ----- */

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

let failures = 0;
const fail = (m) => { failures++; console.log(`  FAIL ${m}`); };

const browser = await launch();
const page = await browser.page(1440, 900);
/*
  Reduced motion, and it is load-bearing rather than tidy: the tears, the
  lightning and the ambient glitch arrive on their own timers and would show up
  as ground that "changed between offsets" when nothing structural did. It also
  freezes the drift glows at their neutral pose, so the only thing that can
  differ between two captures is what this is actually testing.
*/
await page.send("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "reduce" }],
});

await page.goto(`${BASE}/`, { settle: 2500 });
const track = await page.eval(
  `(() => { const a = document.querySelector('a[href^="/tracks/"]'); return a && a.getAttribute("href"); })()`,
);
const pages = [{ name: "home", path: "/" }, { name: "progress", path: "/progress" }];
if (track) pages.push({ name: "track", path: track });
else console.log("note: no track link on the home page — track page not measured");

/*
  Stamp every candidate with an id, once, before any scrolling.

  **Identity has to come from the element, not from its text**, and getting that
  wrong produced a convincing false failure: `/progress` renders "activities this
  week" three times, once per period card, so keying by the string compared one
  card's ground against another card's and reported a 0.0109 drift that was
  really just two different places on the page. Three other strings on that page
  are duplicated too.
*/
const STAMP = `(() => {
  const els = [...document.querySelectorAll("main p, main h2, main h3, main li, main td, main th")];
  let n = 0;
  for (const el of els) {
    if (el.closest('[aria-hidden="true"]')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (!el.textContent.trim()) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 8) continue;
    el.dataset.gs = String(n++);
  }
  return n;
})()`;

/** Rects of the stamped elements, keyed by the id they were given. */
const PROBE = `(() => {
  return [...document.querySelectorAll("[data-gs]")].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      id: el.dataset.gs,
      x: r.left, y: r.top, w: r.width, h: r.height,
      text: el.textContent.trim().slice(0, 24),
    };
  });
})()`;

const shot = async () => {
  const s = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  return decodePng(Buffer.from(s.data, "base64"));
};

/** Every sampled pixel under a rect, as linear luminance. */
function sample(img, rect, height) {
  const values = [];
  const x0 = Math.max(0, Math.round(rect.x));
  const x1 = Math.min(img.width - 1, Math.round(rect.x + rect.w));
  const y0 = Math.max(0, Math.round(rect.y));
  const y1 = Math.min(height - 1, Math.round(rect.y + rect.h));
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * img.width + x) * 3;
      values.push(lum(img.rgb[i], img.rgb[i + 1], img.rgb[i + 2]));
    }
  }
  return values;
}

for (const target of pages) {
  console.log(`\n${target.name}`);
  for (const width of WIDTHS) {
    await page.resize(width, 900);
    await page.goto(BASE + target.path, { settle: 2200 });
    const stamped = await page.eval(STAMP);
    if (!stamped) {
      console.log(`  ..   @${width} no text elements matched — not measured`);
      continue;
    }

    /*
      Track one element across the offsets by identity, not by position. Its
      viewport rect moves as the page scrolls — that is the whole point — so the
      rect is re-read at every offset and the *ground under it* compared.
    */
    const baseline = new Map();
    let worst = { drift: 0, text: null };
    let compared = 0;

    for (const offset of OFFSETS) {
      await page.eval(`scrollTo(0, ${offset}); 1`);
      await sleep(400);
      const rects = await page.eval(PROBE);
      if (!rects.length) continue;
      const img = await shot();

      for (const rect of rects) {
        // Only while it is fully on screen; a half-clipped rect is not the same
        // sample and would report a difference that is pure geometry.
        if (rect.y < 4 || rect.y + rect.h > 896) continue;
        const values = sample(img, rect, 900);
        if (!values.length) continue;

        const prev = baseline.get(rect.id);
        if (!prev) {
          baseline.set(rect.id, values);
          continue;
        }
        if (prev.length !== values.length) continue; // different clip, not comparable
        let total = 0;
        for (let i = 0; i < values.length; i++) total += Math.abs(values[i] - prev[i]);
        const drift = total / values.length;
        compared++;
        if (drift > worst.drift) worst = { drift, text: rect.text, offset };
      }
    }

    if (compared === 0) {
      console.log(`  ..   @${width} nothing stayed on screen across two offsets — not measured`);
      continue;
    }
    if (worst.drift > MAX_DRIFT) {
      fail(
        `${target.name}@${width}: ground under "${worst.text}" changed by ${worst.drift.toFixed(4)} ` +
          `between scroll offsets (max ${MAX_DRIFT}) — an atmosphere layer is pinned to the viewport`,
      );
    } else {
      console.log(
        `  ok   @${width} ${compared} element-comparisons, worst drift ${worst.drift.toFixed(5)} (max ${MAX_DRIFT})`,
      );
    }
  }
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL CLEAN");
await browser.close();
process.exit(failures ? 1 : 0);
