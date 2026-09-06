/**
 * Freeze one dimensional tear at several points of its life and crop it large.
 *
 * The effect is five seconds long, mostly small, and randomly placed, so it
 * cannot be judged from a live screenshot — this is the tool that made the
 * difference every time the silhouette was retuned. It has been rebuilt from
 * scratch in a session scratchpad four times; it lives here now so that stops.
 *
 *   node qa/tear-shots.mjs http://localhost:3488 [outdir]
 *
 * Two traps, both of which cost real time before they were written down:
 *
 * - **Pausing a transient is not enough — it has to be seeked.** An element
 *   whose animation has run to its `opacity: 0` end state is present in the DOM
 *   and invisible. Every capture here sets `currentTime` and only then pauses.
 * - **`getComputedTiming().iterationDuration` is `null` in this Chrome.** Use
 *   `.duration`. A probe using the former scrubbed the first 1000ms of a 5000ms
 *   animation and reported the growth curve topping out at 0.22.
 *
 * Each frame gets its *own* tear rather than seeking one tear repeatedly: the
 * component's removal timers keep running while its animations are paused, so a
 * single tear is gone in five seconds however frozen it looks.
 */
import { mkdirSync } from "node:fs";
import { launch } from "./cdp.mjs";

const BASE = process.argv[2] ?? "http://localhost:3488";
const OUT = process.argv[3] ?? "/tmp/tear-shots";
const FRACTIONS = [0.04, 0.14, 0.28, 0.44, 0.6, 0.72, 0.82, 0.92, 0.98];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Everything both tear layers are animating, seeked to `frac` and held. */
const freeze = (frac) => `(() => {
  const layers = [...document.querySelectorAll('[data-sv-spots],[data-sv-tear]')];
  let held = 0;
  for (const layer of layers) {
    for (const a of layer.getAnimations({ subtree: true })) {
      const d = a.effect && a.effect.getComputedTiming().duration;
      if (!d) continue;
      a.currentTime = d * ${frac};
      a.pause();
      held++;
    }
  }
  return held;
})()`;

/** The union of the tear's own boxes, padded, in page coordinates. */
const rect = `(() => {
  const spot = document.querySelector('[data-sv-tear] > div');
  if (!spot) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const piece of spot.children) {
    const b = piece.getBoundingClientRect();
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom);
  }
  if (!isFinite(x0)) return null;
  const pad = 24;
  return {
    x: Math.max(0, x0 - pad), y: Math.max(0, y0 - pad),
    width: Math.min(innerWidth, x1 + pad) - Math.max(0, x0 - pad),
    height: Math.min(innerHeight, y1 + pad) - Math.max(0, y0 - pad),
    kind: document.querySelector('[data-sv-spots] > div')?.getAttribute('data-void') ?? '?',
  };
})()`;

const b = await launch();
const page = await b.page(1280, 900);
mkdirSync(OUT, { recursive: true });

await page.goto(`${BASE}/`);
if ((await page.eval("location.pathname")) !== "/") throw new Error("did not land on /");

for (const frac of FRACTIONS) {
  let shot = null;
  for (let attempt = 0; attempt < 6 && !shot; attempt++) {
    // A fresh tear per frame — see the note above about removal timers.
    await page.eval(`document.querySelectorAll('[data-sv-tear] > div').length || window.dispatchEvent(new Event('sv:spot'))`);
    await page.until(`!!document.querySelector('[data-sv-tear] > div')`, { timeout: 3000 }).catch(() => {});
    const held = await page.eval(freeze(frac));
    const r = await page.eval(rect);
    if (!held || !r || r.width < 8 || r.height < 8) {
      await sleep(400);
      continue;
    }
    const name = `${OUT}/tear-${String(Math.round(frac * 100)).padStart(2, "0")}-${r.kind}.png`;
    await page.shot(name, { x: r.x, y: r.y, width: r.width, height: r.height }, { scale: 2 });
    console.log(`${name}  ${r.kind}  ${Math.round(r.width)}x${Math.round(r.height)}`);
    shot = name;
  }
  if (!shot) console.log(`(no tear captured at ${frac})`);
  // Let the frozen one finish its life and clear before the next frame.
  await page.eval(`(() => { for (const l of document.querySelectorAll('[data-sv-spots],[data-sv-tear]'))
    for (const a of l.getAnimations({ subtree: true })) a.play(); })()`);
  await sleep(1200);
}

await b.close();
