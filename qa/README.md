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

   - **Switching between `npm run dev` and `npm run build`.** They share the
     directory too.

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
| `DimensionalSpots` | ambient, 9-20s | `window.dispatchEvent(new Event("sv:spot"))` |
| `GlitchShatter` | deterministic feedback | a `fire` counter prop |

**The voids are the one effect you cannot judge by firing it.** The other three
are events — you press the button, you watch the half-second, you decide. A void
draws one of five archetypes and lives anywhere from 1.5 to 22 seconds, and the
question is whether the stillness and the sudden corruption read as one anomaly.
Open a few and then leave the page alone.

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
