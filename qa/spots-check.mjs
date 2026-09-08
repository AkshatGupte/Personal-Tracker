/**
 * Checks the dimensional voids (`components/spiderverse/DimensionalSpots.tsx`).
 *
 * Lives in the repo rather than a session scratchpad for the reason the README
 * gives: a scratchpad script is lost the moment the session restarts, and this
 * one has already had to be written twice.
 *
 * What it asserts, in the order the effect could plausibly break:
 *
 *  1. **No horizontal overflow** at any width, before and after voids exist.
 *     They are deliberately allowed to hang off the frame, so this is the most
 *     likely fault.
 *  2. **No interaction interference.** A grid of points is hit-tested against
 *     the void layer, and a real link is clicked *while corruption is on
 *     screen* — the corruption layer is the one part of this that draws above
 *     the UI, so "it is only `pointer-events: none`" is worth proving.
 *  3. **Layer order.** Voids paint after the threads (so they occlude the
 *     atmosphere) and the corruption paints above the content (so it can
 *     corrupt it).
 *  4. **Archetype variety.** Several distinct behaviours appear, and no two
 *     live voids share an animation — the whole point of the rewrite.
 *  5. **Corruption is transient and leaves nothing behind.** The DOM and the
 *     computed styles of real UI are compared before, during and after.
 *  6. **Reduced motion** renders nothing at all.
 *  7. **Frame cost** during a burst, since `backdrop-filter` with a
 *     displacement map is the one genuinely expensive thing in the file.
 *
 * Every page is asserted before being measured. A slipped argv once made a
 * script measure a 404 and report a clean result; the fix is the assertion.
 *
 *   SHOT_DIR=/tmp/shots node qa/spots-check.mjs http://localhost:3000
 */
import { launch } from "./cdp.mjs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.env.SHOT_DIR ?? "/tmp";
const WIDTHS = [1560, 1280, 768, 390, 320];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let bad = 0;
const fail = (m) => {
  console.log(`  !! ${m}`);
  bad++;
};

/**
 * Opens voids and waits until they actually exist.
 *
 * Dispatching once and sleeping is not enough. In dev, Next compiles a route on
 * first request, so the first visit to `/tracks/...` can still be hydrating
 * when the events fire — they go nowhere, and the check reports "the effect did
 * not run" for a page where it works on the very next load.
 */
async function openVoids(page, { tries = 12, every = 400, burst = 8 } = {}) {
  for (let i = 0; i < tries; i++) {
    await page.eval(
      `(()=>{for(let n=0;n<${burst};n++) window.dispatchEvent(new Event("sv:spot"));return 1})()`,
    );
    await sleep(every);
    const n = await page.eval(
      `(() => { const l = document.querySelector('[data-sv-spots]'); return l ? l.children.length : 0; })()`,
    );
    if (n > 0) {
      await sleep(900);
      return n;
    }
  }
  return 0;
}

/**
 * Holds the next corruption burst open so it can be photographed and measured.
 *
 * A burst removes itself on a JS timer 340-660ms after it starts, which
 * `getAnimations().pause()` does nothing about — the README records the same
 * trap for the ambient glitch. So the removal timer is dropped by delay range
 * before spawning. Nothing else in the component schedules inside that window:
 * every other timer is a void's life or a respawn, all measured in seconds.
 *
 * The timeout is deliberately generous. Bursts are rare by design and cannot be
 * forced: spawning is capped at two live tears (one under 640px), each holds its
 * slot for about five seconds, and a global 2.6s gate drops any burst that lands
 * too close to the last. At a 14s timeout this check failed intermittently on a
 * perfectly working effect, and the cap has been lowered since — dispatching
 * `sv:spot` harder does not raise the rate, it only refills a slot sooner.
 */
async function holdBurst(page, { timeout = 50000 } = {}) {
  await page.eval(`(() => {
    if (window.__svHeld) return 1;
    window.__svHeld = true;
    const real = window.setTimeout;
    window.setTimeout = (fn, ms, ...rest) =>
      (ms >= 330 && ms <= 680) ? 0 : real(fn, ms, ...rest);
    return 1;
  })()`);

  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    await page.eval(`(()=>{for(let n=0;n<4;n++) window.dispatchEvent(new Event("sv:spot"));return 1})()`);
    await sleep(320);
    /*
      Keeping the element alive is not enough, and the first version of this
      check was fooled by exactly that: the burst's own animation still ran to
      completion and ended at `opacity: 0`, so the layer was present, reported
      ten backdrop-filtered children, and photographed as a completely clean
      page. Pause and seek every animation in the layer to a little past its
      onset — the phase where the corruption is actually at full strength.
    */
    const frozen = await page.eval(`(() => {
      const layer = document.querySelector('[data-sv-corrupt]');
      if (!layer) return 0;
      let n = 0;
      for (const a of layer.getAnimations({ subtree: true })) {
        const t = a.effect.getComputedTiming();
        a.pause();
        a.currentTime = (t.delay || 0) + (t.iterationDuration || t.duration || 300) * 0.3;
        n++;
      }
      return n;
    })()`);
    if (frozen > 0) return true;
  }
  return false;
}

const b = await launch();
const p = await b.page(1280, 900);

await p.goto(`${BASE}/`);
if ((await p.eval("location.pathname")) !== "/") throw new Error("did not land on /");
const trackHref = await p.eval(
  `(document.querySelector('a[href^="/tracks/"]')||{}).getAttribute?.('href') ?? null`,
);
if (!trackHref) throw new Error("no track link on home — seed the database first");

const pages = [
  { name: "home", url: `${BASE}/`, path: "/" },
  { name: "track", url: `${BASE}${trackHref}`, path: trackHref },
];

/* ------------------ 1-3: overflow, hit-testing, layer order ------------------ */

const archetypesSeen = new Set();

for (const page of pages) {
  for (const w of WIDTHS) {
    await p.resize(w, 900);
    await p.goto(page.url);

    if ((await p.eval("location.pathname")) !== page.path) {
      fail(`${page.name}@${w}: landed elsewhere — not measuring`);
      continue;
    }
    if (await p.eval(`/This page could not be found/.test(document.body.innerText)`)) {
      fail(`${page.name}@${w}: 404 — not measuring`);
      continue;
    }

    const before = await p.eval(
      `document.documentElement.scrollWidth - document.documentElement.clientWidth`,
    );

    await openVoids(p);

    const m = await p.eval(`(() => {
      const de = document.documentElement;
      const layer = document.querySelector('[data-sv-spots]');
      const cs = layer ? getComputedStyle(layer) : null;

      /*
        Hit-test both halves of the void.

        The tear layer draws at z-30, *over* the interface — that is what makes
        the void read as a hole rather than as something behind a panel, and it
        is exactly why it has to be proven unclickable. Checking only the
        behind-the-UI layer would pass trivially and prove nothing about the
        half that is actually in front of the controls.
      */
      const tear = document.querySelector('[data-sv-tear]');
      const overlays = [layer, tear].filter(Boolean);
      let hits = 0, sampled = 0;
      for (let gx = 2; gx < 100; gx += 7) {
        for (let gy = 2; gy < 100; gy += 9) {
          const el = document.elementFromPoint(
            Math.round(innerWidth * gx / 100), Math.round(innerHeight * gy / 100));
          sampled++;
          if (el && overlays.some(o => o.contains(el))) hits++;
        }
      }

      const kinds = layer ? [...layer.children].map(c => c.getAttribute('data-void')) : [];
      /*
        Each void must run its own generated track rather than a shared one.

        Read animationName, never the animation shorthand's first token: Chrome
        serialises the shorthand with the name LAST, so splitting on the first
        space compares durations instead. The first version of this check did
        exactly that and reported "3 unique tracks" when it was really counting
        three distinct lifetimes.
      */
      const anims = layer
        ? [...layer.querySelectorAll('*')]
            .map(e => e.style && e.style.animationName).filter(Boolean)
        : [];

      return {
        scrollW: de.scrollWidth, clientW: de.clientWidth,
        overflow: de.scrollWidth - de.clientWidth,
        voids: layer ? layer.children.length : 0,
        hits, sampled,
        pe: cs && cs.pointerEvents, z: cs && cs.zIndex,
        pos: cs && cs.position, ov: cs && cs.overflow,
        aria: layer && layer.getAttribute('aria-hidden'),
        tearPe: tear && getComputedStyle(tear).pointerEvents,
        tearZ: tear && getComputedStyle(tear).zIndex,
        tearAria: tear && tear.getAttribute('aria-hidden'),
        tearOv: tear && getComputedStyle(tear).overflow,
        kinds,
        uniqueAnims: new Set(anims).size, totalAnims: anims.length,
      };
    })()`);

    for (const k of m.kinds) if (k) archetypesSeen.add(k);

    if (m.voids === 0) fail(`${page.name}@${w}: no voids opened — the effect did not run`);
    if (m.overflow > 0)
      fail(`${page.name}@${w}: OVERFLOW ${m.scrollW}/${m.clientW} (was ${before} before voids)`);
    if (m.hits > 0) fail(`${page.name}@${w}: void layer took ${m.hits}/${m.sampled} hits`);
    if (m.pe !== "none") fail(`${page.name}@${w}: pointer-events is ${m.pe}`);
    if (m.aria !== "true") fail(`${page.name}@${w}: aria-hidden is ${m.aria}`);
    if (m.tearPe && m.tearPe !== "none")
      fail(`${page.name}@${w}: tear layer pointer-events is ${m.tearPe} — it is over the UI`);
    if (m.tearAria && m.tearAria !== "true")
      fail(`${page.name}@${w}: tear layer aria-hidden is ${m.tearAria}`);
    if (m.tearOv && m.tearOv !== "hidden")
      fail(`${page.name}@${w}: tear layer overflow is ${m.tearOv} — it must not scroll`);
    if (m.totalAnims > 1 && m.uniqueAnims < 2)
      fail(`${page.name}@${w}: ${m.totalAnims} animated elements share ${m.uniqueAnims} track(s)`);

    console.log(
      `${page.name} @${w}: ${m.overflow > 0 ? "OVERFLOW" : "ok"} ` +
        `scroll ${m.scrollW}/${m.clientW} · voids=${m.voids} [${m.kinds.join(",")}] ` +
        `hits=${m.hits}/${m.sampled} · tracks ${m.uniqueAnims}/${m.totalAnims} unique · ` +
        `tear z${m.tearZ}/pe:${m.tearPe}`,
    );

    await p.shot(`${OUT}/spots-${page.name}-${w}.png`);
  }
}

/* ---------------------- 4: archetype variety over time ---------------------- */

await p.resize(1280, 900);
await p.goto(`${BASE}/`);
for (let round = 0; round < 12; round++) {
  await openVoids(p, { tries: 2, every: 250, burst: 4 });
  const kinds = await p.eval(`(() => {
    const l = document.querySelector('[data-sv-spots]');
    return l ? [...l.children].map(c => c.getAttribute('data-void')) : [];
  })()`);
  for (const k of kinds) if (k) archetypesSeen.add(k);
  await sleep(500);
}
console.log(`\narchetypes observed: ${[...archetypesSeen].sort().join(", ") || "none"}`);
if (archetypesSeen.size < 3)
  fail(`only ${archetypesSeen.size} archetype(s) seen — expected several distinct behaviours`);

/* ------------- 5: corruption is transient and restores the UI ------------- */

await p.goto(`${BASE}/`);
const snapshot = `(() => {
  const el = document.querySelector('h1, .font-label');
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    text: document.body.innerText.length,
    nodes: document.querySelectorAll('*').length,
    rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    color: cs.color, filter: cs.filter, opacity: cs.opacity, transform: cs.transform,
    bodyFilter: getComputedStyle(document.body).filter,
  };
})()`;

const pre = await p.eval(snapshot);
const held = await holdBurst(p);
if (!held) {
  fail("no corruption burst appeared within the timeout");
} else {
  const during = await p.eval(`(() => {
    const layer = document.querySelector('[data-sv-corrupt]');
    const cs = getComputedStyle(layer);
    const kids = [...layer.querySelectorAll('div')];
    const filtered = kids.filter(k => {
      const s = getComputedStyle(k);
      return (s.backdropFilter && s.backdropFilter !== 'none');
    });
    const box = layer.querySelector('div') ? layer.querySelector('div').getBoundingClientRect() : null;
    // Corruption must stay local: its region cannot cover the viewport.
    const area = box ? (box.width * box.height) / (innerWidth * innerHeight) : 0;
    let hits = 0, sampled = 0;
    for (let gx = 2; gx < 100; gx += 7) {
      for (let gy = 2; gy < 100; gy += 9) {
        const el = document.elementFromPoint(
          Math.round(innerWidth * gx / 100), Math.round(innerHeight * gy / 100));
        sampled++;
        if (el && layer.contains(el)) hits++;
      }
    }
    return {
      pe: cs.pointerEvents, z: cs.zIndex, pos: cs.position,
      aria: layer.getAttribute('aria-hidden'),
      backdropCount: filtered.length,
      sampleFilter: filtered.length ? getComputedStyle(filtered[0]).backdropFilter : null,
      areaShare: Math.round(area * 1000) / 10,
      hits, sampled,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);

  console.log(
    `\nburst: ${during.backdropCount} backdrop-filtered layers · ${during.pos}/z${during.z}/pe:${during.pe} · ` +
      `covers ${during.areaShare}% of viewport · hits ${during.hits}/${during.sampled} · overflow ${during.overflow}`,
  );
  console.log(`   sample filter: ${during.sampleFilter}`);

  if (during.pe !== "none") fail(`corruption layer pointer-events is ${during.pe}`);
  if (during.aria !== "true") fail(`corruption layer aria-hidden is ${during.aria}`);
  if (during.backdropCount === 0)
    fail("corruption drew no backdrop-filtered layers — it is not corrupting anything");
  if (during.areaShare > 45)
    fail(`corruption covers ${during.areaShare}% of the viewport — not localised`);
  if (during.hits > 0) fail(`corruption layer took ${during.hits}/${during.sampled} hits`);
  if (during.overflow > 0) fail(`corruption caused ${during.overflow}px of overflow`);

  await p.shot(`${OUT}/spots-burst-held.png`);

  // A real link must still work while corruption is on screen.
  const clicked = await p.eval(`(() => {
    const a = document.querySelector('a[href^="/tracks/"]');
    if (!a) return 'no link';
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (a === top || a.contains(top)) return 'reachable';
    const tear = document.querySelector('[data-sv-tear]');
    if (tear && tear.contains(top)) return 'blocked by the TEAR layer';
    return 'blocked by ' + (top && top.tagName);
  })()`);
  console.log(`   link under corruption: ${clicked}`);
  if (clicked !== "reachable") fail(`interactive element ${clicked} during corruption`);

  // Release the hold and confirm the page comes back exactly as it was.
  await p.goto(`${BASE}/`);
  await sleep(1200);
  const post = await p.eval(snapshot);
  const same =
    pre.rect.join() === post.rect.join() &&
    pre.color === post.color &&
    pre.filter === post.filter &&
    pre.opacity === post.opacity &&
    pre.transform === post.transform &&
    pre.bodyFilter === post.bodyFilter;
  console.log(
    `restoration: rect ${post.rect.join()} colour ${post.color} filter ${post.filter} — ${same ? "unchanged" : "CHANGED"}`,
  );
  if (!same) fail("UI did not return to its pre-corruption state");
  if (post.bodyFilter !== "none") fail(`body carries a filter after corruption: ${post.bodyFilter}`);
}

/* --------------------------- 6: layer ordering --------------------------- */

await p.goto(`${BASE}/`);
await openVoids(p);
const order = await p.eval(`(() => {
  const kids = [...document.body.children];
  const spots = kids.findIndex(e => e.hasAttribute && e.hasAttribute('data-sv-spots'));
  const threads = kids.findIndex(e => e.className && String(e.className).includes('text-sv-cyan'));
  const layer = document.querySelector('[data-sv-spots]');
  return { spots, threads, z: layer ? getComputedStyle(layer).zIndex : null };
})()`);
console.log(`\nbody order — threads ${order.threads}, voids ${order.spots} at z${order.z}`);
if (order.spots < 0) fail("void layer not found for the ordering check");
else if (!(order.spots > order.threads)) fail("void layer does not paint after the threads");

/* ------------- 6b: a tear is anchored to the page, not to the screen ------------- */

/*
  A spot is a *hole in the background*, and the background scrolls with the
  document. So the hole has to scroll with it.

  It did not, and nothing here noticed: the three spot layers were `fixed
  inset-0`, left that way deliberately when the atmosphere was made scrollable
  on the reasoning that a tear is "a transient event where you are looking".
  That reasoning was wrong. Pinned to the viewport, the hole slides across the
  structures it was supposedly torn out of — reported as the spot moving down
  the page as you scroll — and the occlusion that is the whole effect stops
  landing on anything in particular.

  This opens one tear, records where it and a neighbouring wireframe structure
  sit in *document* coordinates, then scrolls a long way in both directions and
  requires both numbers to be unchanged. The second number is the one that
  matters: an absolute position could in principle be right while the tear still
  drifted relative to its surroundings, and it is the relationship that the
  effect is made of.

  Measured against the bug: re-pinning the layers moves the tear by +500, +795
  and -200 document px across the same three offsets.
*/

/*
  On the track page rather than home, and the difference is the size of the
  signal: home is barely a screen and a half, so a pinned tear only has room to
  drift ~59px before it scrolls away, while the track page gives it hundreds.
  Both catch the bug; this one catches it with room to spare.
*/
await p.goto(pages[1].url);
const anchorProbe = `(() => {
  const spot = document.querySelector('[data-sv-spots] [data-void]');
  const threads = [...document.body.children].find((e) =>
    String(e.className || "").includes("text-sv-cyan"),
  );
  const struct = threads && threads.querySelector("svg:not([preserveAspectRatio])");
  if (!spot || !struct) return null;
  const docTop = (el) => Math.round(el.getBoundingClientRect().top + scrollY);
  return { spot: docTop(spot), gap: docTop(spot) - docTop(struct) };
})()`;

await p.eval(`scrollTo(0, 200); 1`);
await sleep(250);
await openVoids(p);
const anchor0 = await p.eval(anchorProbe);

if (!anchor0) {
  fail("anchoring: no void opened to measure");
} else {
  let worstDrift = 0;
  let worstGap = 0;
  let measured = 0;
  for (const y of [640, 1100, 0]) {
    await p.eval(`scrollTo(0, ${y}); 1`);
    await sleep(320);
    const now = await p.eval(anchorProbe);
    // A tear is short-lived; if it closed mid-sweep there is nothing to compare.
    if (!now) continue;
    measured++;
    worstDrift = Math.max(worstDrift, Math.abs(now.spot - anchor0.spot));
    worstGap = Math.max(worstGap, Math.abs(now.gap - anchor0.gap));
  }
  /*
    A pixel of tolerance, and no more. Sub-pixel layout rounding can move a
    rounded rect by one; five hundred is the bug.
  */
  if (measured === 0) console.log("\nanchoring — void closed before the sweep, not measured");
  else if (worstDrift > 1 || worstGap > 1)
    fail(
      `void drifts with the page: ${worstDrift}px of document movement, ` +
        `${worstGap}px against the structures around it (max 1)`,
    );
  else
    console.log(
      `\nanchoring — void held its document position across ${measured} scroll offsets ` +
        `(drift ${worstDrift}px, gap ${worstGap}px)`,
    );
}
await p.eval(`scrollTo(0, 0); 1`);

/* ------------------------------ 7: frame cost ------------------------------ */

/*
  Measured against a baseline, because an absolute number here means very
  little: `qa/cdp.mjs` launches headless with `--disable-gpu`, so every pixel
  including `backdrop-filter` is composited on the CPU. The question worth
  asking is not "is this 60fps in a software rasteriser" but "how much of the
  frame does the effect add over the same page with no voids on it".
*/
const FRAME_PROBE = `(async () => {
  const frames = [];
  let last = performance.now();
  await new Promise((done) => {
    let n = 0;
    const tick = (t) => {
      frames.push(t - last); last = t;
      if (++n < 150) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
  const sorted = [...frames].sort((a, b) => a - b);
  return {
    median: Math.round(sorted[Math.floor(sorted.length / 2)] * 10) / 10,
    p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10,
  };
})()`;

// Baseline: the same page, before any void has opened.
await p.goto(`${BASE}/`);
const base = await p.eval(FRAME_PROBE);
await openVoids(p);
const withVoids = await p.eval(FRAME_PROBE);
await holdBurst(p, { timeout: 9000 });
const withBurst = await p.eval(FRAME_PROBE);

console.log(
  `frames (headless, --disable-gpu) — baseline ${base.median}ms/p95 ${base.p95} · ` +
    `voids ${withVoids.median}ms/p95 ${withVoids.p95} · burst held ${withBurst.median}ms/p95 ${withBurst.p95}`,
);
if (withVoids.median > base.median * 1.6 + 6)
  fail(`voids cost ${withVoids.median - base.median}ms/frame over a ${base.median}ms baseline`);
if (withBurst.median > base.median * 2.2 + 10)
  fail(`a held burst costs ${withBurst.median - base.median}ms/frame over baseline`);

/* -------------------- 8: reduced motion renders nothing -------------------- */

await p.send("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "reduce" }],
});
await p.goto(`${BASE}/`);
// Deliberately not `openVoids` — that retries until something appears, and here
// the correct answer is that nothing ever does.
await p.eval(`(()=>{for(let i=0;i<10;i++) window.dispatchEvent(new Event("sv:spot"));return 1})()`);
await sleep(2500);
const rm = await p.eval(`(() => ({
  matches: matchMedia("(prefers-reduced-motion: reduce)").matches,
  voids: !!document.querySelector("[data-sv-spots]"),
  tear: !!document.querySelector("[data-sv-tear]"),
  corrupt: !!document.querySelector("[data-sv-corrupt]"),
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}))()`);
console.log(
  `\nreduced motion — query=${rm.matches} voids=${rm.voids} tear=${rm.tear} corruption=${rm.corrupt} overflow=${rm.overflow}`,
);
if (!rm.matches) fail("could not emulate prefers-reduced-motion");
if (rm.voids) fail("void layer rendered under reduced motion");
if (rm.tear) fail("tear layer rendered under reduced motion");
if (rm.corrupt) fail("corruption rendered under reduced motion");

await b.close();
console.log(bad === 0 ? "\nALL CLEAN" : `\n${bad} problem(s)`);
process.exit(bad === 0 ? 0 : 1);
