# qa

Screenshot and visual-check tooling. **Not application code** — nothing under
`app/`, `components/` or `lib/` imports it, and it is excluded from `tsconfig.json`
and ESLint. It is plain ESM with no dependencies, run by hand with `node`.

This exists because it had been rebuilt from scratch in a session scratchpad
three times. It lives in the repo now so that stops.

## Why not Playwright?

The Playwright MCP server does not work on this machine: it looks for a Chrome
channel at `/opt/google/chrome`, which is not installed. The Playwright *browser
download* is present, so `cdp.mjs` drives that Chromium directly over the Chrome
DevTools Protocol using Node's built-in `WebSocket`. Set `CHROME_PATH` to
override which binary it uses.

## Two standing rules when checking a screen

1. **Never point a dev server at `prisma/dev.db`.** That is the user's real
   data. Copy it somewhere scratch and set `DATABASE_URL` to the copy:

   ```
   cp prisma/dev.db /tmp/qa.db
   DATABASE_URL="file:/tmp/qa.db" npx next dev -p 3477
   ```

2. **Only ever have one Next process running, and clear `.next` between them.**

   The symptom is always the same: `TypeError: __webpack_modules__[moduleId] is
   not a function` and a 500 on every page. It has three causes, and the first
   is by far the most common and the least obvious:

   - **An orphaned `next-server` from an earlier run.** `next dev` spawns a
     `next-server` child, and killing the parent — or killing by port, which
     finds only the listener — leaves that child alive, still watching files and
     still writing `.next`. Two of them sharing the directory corrupt it. One
     survived a whole session this way and poisoned every server started after
     it. Check for them by hand before starting anything:

     ```
     ps -eo pid,args | grep -E "[n]ext-server|[n]ode_modules/\.bin/next"
     ```

     Note the `[n]` — a plain `pgrep -f next` or `pkill -f "next dev"` also
     matches *the shell running that very command*, which kills your own shell
     mid-script and looks like an unrelated failure.

     **A match is not proof of an orphan.** The same pattern matches a server
     the user is actively using, and killing one is far worse than leaving a
     stale process alone. This happened three times in one session: a server on
     :3000 was killed as an "orphan" and `.next` cleared under it, and it kept
     "reappearing" because the user kept restarting it. Resolve the port before
     killing anything:

     ```
     ss -lptnH 'sport = :3000'      # who is actually serving
     ```

     Kill by that pid, never by name pattern, and never `rm -rf .next` unless
     you know nothing else is serving from it.

     **Read the answer.** This was run, and then followed by an unconditional
     "port free" line that made it look empty when it was not. The check is
     worthless if the next line contradicts it.

   - **Switching between `npm run dev` and `npm run build`.** They share the
     directory too.

     **`next build` in the project root is the same hazard as `rm -rf .next`,
     and it is easier to run by accident.** It overwrites `.next/server` under a
     running dev server, which then 500s with `Cannot find module
     './vendor-chunks/...'`. Some routes recompile out of it; the ones whose
     chunks were replaced rather than removed do not, and touching sources will
     not help — the stale piece is the dev server's own webpack runtime, so only
     a restart clears it. Build in the isolated copy, or stop the server first.

   - **Editing a watched file while a server runs.** Anything under the project
     root triggers a recompile, `qa/` included — it is excluded from tsconfig
     and ESLint, not from the file watcher.

   `rm -rf .next` after stopping everything, and start one server.

   **If another server legitimately holds `.next`** — the user is using the app
   and you still need to verify a change — do not fight it for the directory.
   Copy the working tree somewhere scratch, symlink `node_modules`, and run
   there on its own port and its own database copy:

   ```
   rsync -a --exclude=.next --exclude=node_modules --exclude=.git . "$SCRATCH/iso/"
   ln -s "$PWD/node_modules" "$SCRATCH/iso/node_modules"
   cp prisma/dev.db "$SCRATCH/iso/qa.db"
   cd "$SCRATCH/iso" && DATABASE_URL="file:$SCRATCH/iso/qa.db" npx next dev -p 3488
   ```

   The copy has its own `.next`, so the two never collide, and the user's app
   and real data are untouched.

## Checking text contrast against the composited ground

`CLAUDE.md` requires every text/background pair to clear 4.5:1 **against the
background as actually rendered**, and says to measure rather than assume,
because the atmosphere lightens the ground unevenly. Nothing measured it until
`qa/contrast-check.mjs` existed.

```
node qa/contrast-check.mjs http://localhost:3488
```

It collects text sitting on open background (not inside a panel, which has its
own opaque ground), freezes every animation, and takes two screenshots of the
same frame: one with the glyph fill set to `transparent`, one with the text
hidden outright. Every background layer is identical in both, so the pixels they
differ on are exactly where the text is painted. That region, eroded by a pixel
to drop the antialiased fringe, is measured against the text colour.

```
node qa/contrast-check.mjs http://localhost:3488
NO_HALO=1 node qa/contrast-check.mjs http://localhost:3488   # same method, halo removed
```

**The two-frame method replaced "the worst pixel anywhere in the element's
rect".** That was written before the ink halo existed and it measures the wrong
pair twice over: it flags a glow passing through the gap between two words
without ever touching a letterform, and — fatally — a halo is *part of* the
text's own rendering, so sampling the ground by hiding the text hides the halo
with it. A working halo scored 1.01:1 under the old method. The old figure is
still printed on every line as `[box N:1]`, because it remains the honest
picture of how bright the region behind the type gets.

`NO_HALO=1` strips `body`'s text-shadow and measures the same way. The halo and
the method landed together, so without this "it passes now" would be
unfalsifiable; with it, the two changes can be told apart. Measured on `/` at
1560/1280/390: **5 pairs under 4.5:1 with the halo stripped, worst 1.01:1; all
clear with it, worst 6.41:1.**

PNG is decoded in the script from `node:zlib` rather than adding a dependency —
the rest is a scanline unfilter, and this directory stays dependency-free.

## Checking the reading column against the atmosphere

`qa/column-contrast.mjs` guards one invariant: **no text in the content column
ever sits on a bright ground, at any scroll offset.**

> **This check currently FAILS, by decision.** The fix it was written for — a
> mask holding the atmosphere back from the reading column — was reverted on
> 2026-09-06 because of how it looked: a flat rectangle down the middle of a
> wide page, with the effect surviving only in the margins. See
> `docs/DECISIONS.md`. Expect 14 failures, worst region ground L 0.72.
>
> Glyph legibility is *not* what is failing here — `qa/contrast-check.mjs` is
> still all clear, because the ink halo puts every letter on its own `--bg`
> ground. This check measures the region, gaps between words included. Keep the
> two apart when reading a result.

```
node qa/column-contrast.mjs http://localhost:3488 /tracks/<id>
```

The defect it exists to prevent is not "some text is low contrast" — it is that
the *same* text passed or failed depending on where the page happened to be
scrolled to, because the atmosphere layers are `position: fixed` while the page
is about 1950px tall. Measured before the fix on one topic row: 3.50:1 at
scrollY 0, 5.71:1 at 260, 7.05:1 at 520.

It sweeps two widths, three routes and four scroll offsets, hides the text,
photographs the frame and reads the real composited ground behind every text
region. Two assertions: nothing brighter than L 0.02 behind text, and nothing
under 4.5:1.

**Three ways an earlier version of it lied, all now handled in the file:**

- `GlitchText` paints two offset duplicates of every heading. Hiding only the
  base string leaves a cyan copy of the word where the word was, and a cyan
  label then measures 1.00:1 against a "ground" of L 0.86 — it is reading itself.
  `.sv-glitch-layer` is hidden with the text.
- Text on a solid surface — a comic panel, a yellow button, a filled activity
  cell — is not on the atmosphere at all, and `visibility: hidden` takes the
  surface away with the text. Those are excluded.
- The heatmap's day-by-day list lives in a closed `<details>`, which Chrome hides
  with `content-visibility` rather than `display: none`. Its rows still report a
  laid-out rect, so unpainted rows were measured — and their stale rects landed
  on a table two panels away. `checkVisibility()` catches it.

And one trap worth repeating from the README's own list: a `\d` written inside a
`page.eval` template literal becomes a literal `d`. That silently disabled the
"skip text on a solid surface" rule and the check confidently reported 1.03:1 on
ink-on-yellow buttons.

## Checking the scrolling multiverse

```
node qa/bands-check.mjs http://localhost:3489
```

The atmosphere spans the document rather than the viewport, drawing one *band*
of composition per screenful. Band 0 is the hand-set composition; every band
above it is generated, and this asserts the properties hand-placement gave for
free and generation does not — across three pages at five window sizes:

- the two layers are exactly the measured document height, and the band count
  matches `ceil(document / viewport)`
- **every rendered structure has a thread arriving at its centre.** A generated
  band that produced an orphan is a solid floating with no relation to anything
- **no thread endpoint is left alone inside the frame.** These runs either join
  two structures or carry on out of the composition; a segment stopping at an
  arbitrary interior point is a snapped thread
- no horizontal overflow

Two things about how it measures, both load-bearing:

- It reads path data out of each band's `<svg>` in that band's own viewBox units
  and maps it to document pixels. It does **not** re-run the generator — a check
  that recomputes the thing it is checking proves nothing. This is what caught a
  bug where the thread drawing was 720px wide on a 1280px page.
- "Dangling" means *alone*: an endpoint that coincides with another endpoint is a
  junction. That is what makes it correct on a phone, where two of the five
  solids are deliberately not drawn (`hidden sm:block`) but their threads remain
  — the node is still a real meeting point, only the solid is absent. Hidden
  structures are excluded from the orphan count for the same reason; they have no
  box, and measuring one would put a phantom at 0,0.

It was validated by reintroducing each of the two bugs it was written for and
confirming it fails on both. A check that has never failed has not been tested.

## Checking the dimensional voids

`qa/spots-check.mjs` covers everything `DimensionalSpots` could plausibly break:
no horizontal overflow at 1560/1280/768/390/320 (voids are allowed to hang off
the frame, so this is the likely fault), no hit-test interference from either
layer, layer order, archetype variety, every animated element running its own
generated track, corruption staying local and leaving nothing behind, frame cost
against a baseline, and nothing at all rendering under `prefers-reduced-motion`.

```
SHOT_DIR=/tmp/shots node qa/spots-check.mjs http://localhost:3488
```

**Three traps this script had to learn, all of which produced confidently
passing results first:**

- **It retries the spawn event until the layer appears** rather than dispatching
  once and sleeping. In dev, Next compiles a route on first request, so the
  first visit to `/tracks/...` can still be hydrating when the events fire —
  they go nowhere, and the check reports "the effect did not run" for a page
  that works on the very next load.
- **Freezing a burst needs the animation paused *and seeked*, not just its
  removal timer dropped.** The first held-burst screenshot was a completely
  clean page: the element was still there, but its animation had run to its
  `opacity: 0` end state. Same trap the ambient glitch has, one section down.
- **Uniqueness must read `animationName`, never the `animation` shorthand.**
  Chrome serialises the shorthand with the name *last*, so splitting on the
  first space compares durations — the check reported "3 unique tracks" when it
  was counting three lifetimes.

Frame cost is reported against a no-voids baseline on the same page, because
`cdp.mjs` launches with `--disable-gpu`: every pixel including `backdrop-filter`
is composited on the CPU, so an absolute number means little and only a
*regression* against baseline is meaningful.

## The effect lab

`/lab` renders every effect in isolation, at the sizes they are used at, with
buttons to fire them on demand. Development only — it `notFound()`s in any other
environment. (`VenomLightning`, which this section used to name, was replaced by
`AmbientLightning` and no longer exists.)

| Effect | Kind | Fire it with |
|---|---|---|
| `AmbientLightning` | ambient, 8-18s | `window.dispatchEvent(new Event("sv:lightning"))` |
| `AmbientGlitch` | ambient, 10-20s | `window.dispatchEvent(new Event("sv:glitch"))` |
| `DimensionalSpots` | ambient, 13-26s | `window.dispatchEvent(new Event("sv:spot"))` |
| `GlitchShatter` | deterministic feedback | a `fire` counter prop |

**The tears are the one effect you cannot judge by firing it.** The other three
are events — you press the button, you watch the half-second, you decide. A tear
draws one of five archetypes (`fissure`, `rupture`, `cascade`, `corruptor`,
`blink`) and lives about five seconds, and the question is whether it reads as
*an opening in the surface* rather than as a shape lying on it. Open a few and
then leave the page alone.

**Dispatching `sv:spot` does not sample the real cadence.** Live, a tear arrives
every 13-26s and at most two are open at once (one under 640px), so the layer is
clean roughly three quarters of the time. Firing the event only refills a free
slot. To judge frequency rather than appearance, watch an untouched page for two
minutes.

**Use `qa/tear-shots.mjs` for the silhouette.** Five seconds, small, and
randomly placed is not something a live screenshot can settle:

```
node qa/tear-shots.mjs http://localhost:3488 /tmp/tear-shots
```

It freezes a tear at nine points of its life and crops it at 2x — a fresh tear
per frame, because the component's removal timers keep running while its
animations are paused. What to look for at each stage: a hairline crack early, a
split that has *run* along its line before the lips part, notches and splinters
on the edge, the lit wall of the surface's own thickness inside the near lip,
flaps of panel levered up, and fractures that lengthen as it widens. If it reads
as one shape getting bigger, the progression has broken — see the decisions entry
for why that is a geometry fault and not a tuning one.

Judging the corruption specifically needs a frozen frame over *content*: a
displacement has nothing to displace over empty background, and several tuning
passes looked like failures purely because the burst landed on bare ground. The
corruptor and the rupture are the two that fire strong bursts.

The two ambient ones cap their own concurrency, so dispatching faster than an
event's lifetime (about 1.5-2.5s for a strike, 2.4-3.6s for a glitch) is a no-op
rather than an overlap.

Capturing a transient is harder than it looks. Both effects remove themselves
from the DOM on a timer, and pausing a CSS animation does **not** stop that
timer, so a screenshot taken a moment later catches nothing. Freeze them by
seeking instead:

```js
for (const a of document.getAnimations()) {
  const n = a.animationName;
  if (n === "sv-bolt" || n === "sv-shard") { a.pause(); a.currentTime = n === "sv-bolt" ? 30 : 95; }
}
```

**`AmbientGlitch` can usually just be photographed.** It holds for two to three
seconds now, which comfortably outlasts a CDP screenshot round trip, so dispatch
it, wait, and shoot. That is also the *truer* picture: its flares are staggered
across the hold, so a frozen frame with every animation seeked to its peak shows
all of them lit at once, which never actually happens.

```js
// wait for idle first, or you photograph an ambient event instead of yours
while (document.querySelector(".sv-glitch-pass")) await sleep(80);
window.dispatchEvent(new Event("sv:glitch"));
await sleep(1200);  // anywhere from ~250ms to ~2.3s lands mid-hold
```

Freeze it only when you need a *specific* phase. The component still removes
itself on a JS timer that pausing animations does not stop, so drop that timer
first, by delay range — it is the only 2300-3800ms timeout in the app:

```js
const real = window.setTimeout;
window.setTimeout = (fn, ms, ...r) => (ms >= 2300 && ms <= 3800) ? 0 : real(fn, ms, ...r);
window.dispatchEvent(new Event("sv:glitch"));
// ...await a frame in which `.sv-glitch-pass` exists, then:
for (const a of document.getAnimations()) {
  if (!/^sv-(glitch|shard|flare)/.test(a.animationName || "")) continue;
  const t = a.effect.getComputedTiming();
  a.pause();
  a.currentTime = t.delay + t.activeDuration * 0.35;
}
```

Seek `sv-glitch-in` to its full `activeDuration` and leave `sv-glitch-out` at 0
to catch the split at maximum separation; `sv-glitch-jitter` is the one that
picks *which* moment of the hold you get, since it loops; push `sv-glitch-out`
to about 45% for a resolve frame instead.

**One trap that cost two wrong readings here.** Both spawners fire on their own
every 8-20 seconds, and every measurement that watches for `.sv-glitch-pass` or
`svg.sv-strike` will happily pick up one of those instead of the event it just
forced. A concurrency probe read a negative duration that way, and a stagger
probe reported two failures that were not failures. Wait for an idle frame
before each measured run.

A bolt spends most of its 200ms dark, so a fixed `sleep` lands on an off-frame
more often than an on-frame. Do not pause everything — freezing the route
transition mid-fade dims the whole page and ruins the shot.

## Logic tests

```
./qa/run-tests.sh
```

Runs every `*.test.mjs` here. No test framework and no dependencies — these
cover pure functions over dates and numbers, and a runner would be more
machinery than the thing it runs. `register-alias.mjs` is what lets plain `node`
resolve the project's `@/` imports.

| Suite | Covers |
|---|---|
| `period-buckets.test.mjs` | Week and month bucketing, including leap-year February, the year boundary, and the 31st-of-the-month overflow that breaks naive month arithmetic. |
| `streak-milestone.test.mjs` | Streak milestone crossing: the crossing itself, no replay of an earlier day's, every non-advancing write (same-day recheck, undo, restart), and several milestones crossed at once. |

## Using it


```js
import { launch } from "./qa/cdp.mjs";

const b = await launch();
const p = await b.page(1280, 720);
await p.goto("http://localhost:3477/");

await p.shot("home.png", null, { full: true });        // whole page
const box = await p.box(".sv-panel", 14);              // an element, padded
await p.shot("panel.png", box);
await p.shot("corner.png", { ...box, width: 300, height: 300 }, { scale: 3 });

console.log(p.errors);   // console errors and page exceptions
await b.close();
```

`p.eval(expr)` returns a JSON value from the page, which is how overflow checks
are done — compare `document.documentElement.scrollWidth` against `innerWidth`
at 1440, 1280, 390 and 320.

### Screenshotting a scrolling page — do not use `captureBeyondViewport`

`p.shot()` sets `captureBeyondViewport: true`, which is right for a full-page or
element shot and **wrong for anything that has to look like the viewport.**

Since the atmosphere started spanning the document (see `useDocumentBands`),
this matters more than it used to. `captureBeyondViewport` inflates the viewport
to the size of what it is capturing, so `innerHeight` becomes the height of the
whole page — and the background derives its band size from `innerHeight`, so what
comes back is one enormous band stretched over the document rather than the three
the user actually sees. It is the same family as the trap noted above about
`ellipse closest-side`: the bug disappears in exactly the image you would check
it with.

Worse, a *clipped* capture at the bottom of a long page with this layer **hangs**
— no error, no timeout, the call simply never returns. It cost two dead runs.

So for a viewport shot: scroll first, then capture with the flag off.

```js
await p.eval(`scrollTo(0, ${y}); 1`);
await new Promise((r) => setTimeout(r, 600));
const { data } = await p.send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: false,
});
writeFileSync(out, Buffer.from(data, "base64"));
```

`p.send` is exposed on the page object for exactly this kind of escape hatch —
it is also how `Emulation.setEmulatedMedia` is used to force
`prefers-reduced-motion: reduce`, which is the only way to get a *deterministic*
screenshot of this app: it removes the tears, the lightning and the ambient
glitch, and freezes the drift glows at their neutral pose.
