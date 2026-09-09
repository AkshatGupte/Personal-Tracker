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

## Checking that the ground does not move under the text

```
node qa/ground-stability.mjs http://localhost:3489
```

**This replaced `qa/column-contrast.mjs`, which was deleted on 2026-09-06.**
That check asserted no text in the reading column ever sat on a ground brighter
than L = 0.02 — a ceiling that only made sense while the atmosphere was masked
out of the column. The mask was reverted the day after it shipped, and the check
then spent several sessions failing by design with a warning block here telling
everyone to ignore it. **A check that always fails teaches people to stop reading
failures**, so it went.

What survives is the defect it was written for, which was never "some text is
low contrast": it was that the *same* text passed or failed depending on where
the page happened to be scrolled to, because the atmosphere was `position:
fixed` and pinned to the viewport while the page slid past it. Measured on one
topic row at the time: 3.50:1 at scrollY 0, 5.71:1 at 260, 7.05:1 at 520.

That is structurally impossible now — the atmosphere spans the document and
scrolls with the content, so a row and its ground move together — and this
asserts it stays that way. It samples one element's ground at four scroll
offsets on three routes at two widths and requires the variation to stay
negligible.

**The failure it catches is a one-word change**: making any atmosphere layer
`position: fixed` again. That looks harmless and costs nothing at scroll 0. The
speed lines *are* still fixed, deliberately, for a measured repaint reason — they
are a uniform 4%-opacity hairline field with no located feature, and the
threshold is set from what they actually contribute.

**Calibrated in both states rather than guessed.** Clean it reads 0.0009-0.0012
on every page and width; with the atmosphere re-pinned it reads 0.0028 on the
short home page and 0.006-0.020 on the routes long enough to scroll properly.
`MAX_DRIFT = 0.0025` sits between those bands, so the regression is caught even
on the page with the least room to move — verified by re-pinning the layer and
watching all six checks go red.

**One way it lied first, worth not repeating.** The baseline was keyed by the
element's text, and `/progress` renders "activities this week" three times, once
per period card — so it compared one card's ground against another's and reported
a confident 0.0109 drift that was really two different places on the page. Three
other strings on that route are duplicated too. Elements are stamped with a
`data-gs` id before any scrolling now, so identity comes from the element.

Not a contrast check. `qa/contrast-check.mjs` measures glyph contrast against the
ink halo and is the thing that says text is *readable*; this says the answer does
not depend on scroll position. Keep the two apart when reading a result.

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

**Anchoring — added 2026-09-06 after a bug reached the user.** A spot is a hole
in the background and the background scrolls, so the hole has to scroll with it.
The three spot layers were left `fixed inset-0` when the atmosphere was made
scrollable, and the tear drifted down the page as you scrolled — the occlusion
stopped landing on anything. The suite now opens a tear on the track page,
records its **document** position and its distance to the nearest wireframe
structure, scrolls to three offsets and requires both unchanged within 1px.

The distance is the load-bearing half: an absolute position could be right while
the tear still drifted against its surroundings, and the relationship is what the
effect is made of. Verified against the bug — re-pinning the layers gives 227px
of drift on the track page. It uses the track page rather than home because home
is barely a screen and a half, where the same bug only shows 59px.

**Why nothing caught it before:** the check *reported* the layer's `position` in
its console line and never asserted it, so the value stayed `fixed` while the
world around it changed. A reported value is not a checked value.

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

## Checking the small-text scale

```
node qa/type-scale.mjs http://localhost:3000
```

Two assertions that pull against each other, which is why they are in one place:

- **nothing in the shipped UI below 11px.** A UX audit raised every label to a
  12px floor from six sizes scattered between 8.0 and 11.2px, and that floor is
  worth keeping — single-weight uppercase Bangers at 8px is decoration.
- **every ancestry label is meaningfully smaller than the name it qualifies.**
  The leaf path sits directly above the leaf's own name, so it is the one place
  a label and its content are compared side by side, and the floor inverted it.

It reads *computed* sizes rather than source, so a Tailwind arbitrary value that
silently fails to compile is caught instead of counted. `/lab` is excluded: it is
a dev-only effect harness and keeps its own denser labels.

**The subordination test is a ratio, and that is the point.** Written first as
`label < name`, it passed 12px-over-14px — the exact state it exists to reject —
because 12 really is smaller than 14. The property is *meaningful* subordination,
so the threshold sits between the two candidates (11/14 = 0.79 passes,
12/14 = 0.86 fails). If this check is ever extended, break it on purpose first:
the lenient version looked healthy and asserted nothing.

## Checking the Goal link constraint

```
node qa/goal-constraint.mjs
```

Not a `.test.mjs`: it asserts a property of *SQLite*, which cannot be tested any
other way than by asking SQLite. It replays every migration into a throwaway
database — never touching `prisma/dev.db`, and needing no server — then proves
that `CHECK (trackId IS NULL OR topicId IS NULL)` refuses a goal watching both a
track and a topic, on `INSERT` and on `UPDATE`, while accepting the three legal
shapes; that `@@unique([seriesId, startDate])` refuses a second row for one period
of a recurring series while leaving one-off goals (NULL `seriesId`) free to share
a start date; and that `SetNull` leaves a goal alive with its progress when its
track is deleted.

It uses `better-sqlite3`, already a project dependency through the Prisma
adapter. That is the one exception to this directory being dependency-free and it
is unavoidable: a database constraint has no pure-function form.

Negative-tested by removing the CHECK from the migration (3 assertions fail) and
by switching the foreign key to `Cascade` (4 fail).

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
| `tree.test.mjs` | The Topic tree: shape and ordering, depth limits, move legality, and the three coverage signals. |
| `goals.test.mjs` | The Goal reward rules, weighted at the half that fails silently: the high-water anti-farming mark (37→38→37→38 pays once), milestones crossing once ever, momentum bands fitted to the brief's own worked examples and swept for single-unit flicker, expiry derived rather than stored, and the dashboard's completion-rate arithmetic. |
| `backdate.test.mjs` | The backdating window and its edges: seven days meaning today plus six, the off-by-one at the far edge (6 days back accepted, 7 refused), the future refused, malformed keys refused, and every chip the strip offers being a day the server accepts. Every key is round-tripped through `dayKey` at a **late-evening local `now`**, which is what makes a `toISOString().slice(0, 10)` regression go red rather than pass — that formatting is a day early east of Greenwich and shipped as a bug on 2026-09-08. Also the streak wording in both directions, and that none of it celebrates. Negative-tested against eight reintroduced bugs. |
| `goal-link.test.mjs` | Goals linked to a Track: the ancestor chain that turns a subtree test into an `IN` (a goal on `graphs` matches a leaf five levels beneath it and **not** a leaf in a sibling branch), the chain stopping at a soft-deleted ancestor, a bounded walk that terminates on a corrupted parent cycle, the window tested against **the day recorded rather than today**, inclusive edges, `archived` refused while `completed` still listens, a form value that can never produce a goal watching two things, and a track-page note carrying no XP. Negative-tested against eight reintroduced bugs. Link *coverage* itself is a database query with no second copy, so it is proved by driving the real flow instead. |
| `goal-series.test.mjs` | Recurring goals: periods that abut with no overlap and no gap (asserted over 60 consecutive periods, because an overlap would let one activity advance two members of one series), **every missed period materialised rather than skipped**, month/year boundaries, the bounded loop that stops a bad span spinning inside a request, and the series run counting back from the most recent *finished* period. Negative-tested against seven reintroduced bugs — one of which exposed that the order-independence assertion asserted nothing, and it was rewritten until it failed. |
| `review.test.mjs` | The weekly review and Today: `streakState`'s four states and their boundaries (today *and* yesterday worked is `held`, not `atRisk`; yesterday's activity with a dead run is `lapsed`), the refusal to call a **partial** week a decline, the focus ranking (a streak dying tonight above a goal due today; a track listed once, not twice), goal periods windowed by the week the screen *names* rather than the rolling tally, and copy that stays grammatical for any user-supplied unit. Negative-tested against ten reintroduced bugs — two of which exposed assertions of mine that proved nothing, both rewritten until they failed. |
| `terrain.test.mjs` | Elevation is cumulative and **cannot fall as activity ages** — the same rows read 1/7/14/30/90/365 days later are worth the same. Asserts in the same breath that the *windowed* total does fall, which is why the headline numeral cannot be `Terrain.peak`, and that the drawing's window is untouched. Also the **y-axis domain**: the scale is the next milestone rather than the series' own total, so two activities occupy a fifth of the frame and not all of it, and no elevation from 1 to 2600 reaches the top edge. Restoring the old self-normalising scale fails four assertions. |

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
