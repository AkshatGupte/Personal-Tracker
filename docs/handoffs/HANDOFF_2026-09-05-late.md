# Handoff — 2026-09-05 (late)

> **Superseded by `HANDOFF_2026-09-06.md`.** Section 4 below is resolved (marked
> in place); everything about *what to work on next* is stale. Section 6, on how
> to run a server safely, is still correct — and the newer file's section 6 is
> stricter, after `rm -rf .next` broke the user's running server on 2026-09-06.

For a fresh session with no memory of the previous one. Read `CLAUDE.md`,
`docs/PRD.md`, `docs/SCHEMA.md`, `docs/ROADMAP.md` and `docs/RULES.md` alongside
this. This file only covers what is new, in progress, or not written down
elsewhere.

**This supersedes `HANDOFF_2026-09-05.md`.** That file is still accurate about
the data model (Tasks are gone, a Track holds a recursive tree of Topics, and
`TopicActivity` is the only source of activity figures) — read section 2 of it
for that. Everything it says about *what to work on next* is stale.

**The user is continuing UI work.** This session was almost entirely visual.

---

## 1. Where things stand

Branch `phase2-weekly-progress`, **13 commits ahead of `master`, none pushed**
(no upstream is configured; the remote is
`github.com/AkshatGupte/Personal-Tracker`). Nobody has asked for a push or a PR.

The previous session's large uncommitted tree **has been committed** by the user
as `565dd91 spot` — 57 files, +9103/−2595, covering the Task→Topic restructure,
the whole visual overhaul, and `qa/spots-check.mjs`. The "one whole session sits
uncommitted" warning in the old handoff is resolved.

**What is uncommitted now** is the last three pieces of work, about 416 lines
across two components plus docs and QA:

| File | What is in it |
|---|---|
| `components/spiderverse/DimensionalSpots.tsx` | the pale pen layer and the tear-through split |
| `components/spiderverse/Threads.tsx` | thicker/brighter three-pass neon |
| `qa/contrast-check.mjs` | **new, untracked** — the contrast measuring tool |
| `qa/spots-check.mjs` | extended to test the new front layer |
| `qa/README.md`, `docs/DECISIONS.md`, `docs/DEV_REPORT.md` | write-ups |

Everything type-checks, lints, and `./qa/run-tests.sh` passes.

## 2. What was built this session

All of it is written up properly in `docs/DEV_REPORT.md` (six entries dated
2026-09-05, newest first) and `docs/DECISIONS.md` (six matching entries). **Read
those rather than re-deriving any of it.** In order:

1. **The elevation graph window** — was 84 days against a week of data, now 14.
   The window constants live in the new `lib/windows.ts`; the heatmap keeps its
   own 12 weeks. This is the only non-visual change of the session.
2. **`DimensionalSpots`** — a new effect: irregular black voids in the
   atmosphere. Then evolved over four further passes:
3. **Corruption** — voids break the rendering around them using
   `backdrop-filter` on the real pixels.
4. **Five-second envelope** — every void seeds small, grows, destabilises with
   growth, peaks and collapses. Size drives everything else.
5. **Pale linework** — restrained off-white pen work over the black.
6. **Tearing through** — the void is split across two depths so it reads as a
   hole in the interface rather than a shape behind it.

Plus `AmbientLightning` was rebuilt against a reference frame, and `Threads`
was brightened.

## 3. The effect system, as it now stands

Everything lives in `components/spiderverse/` and is mounted once in
`app/layout.tsx`. Nothing is drawn per screen.

| Component | Depth | What it is |
|---|---|---|
| `SpiderverseBackground` | `-z-10` | ground, rift glows, speed lines, halftone |
| `Threads` (`DimensionalThreads`) | `-z-10` | neon multiverse structures and the lines between them |
| `DimensionalSpots` | **both** | see below |
| `AmbientLightning` | `z-30` | cyan discharge off real interface edges, every 8-18s |
| `AmbientGlitch` | `z-30` | corrupts one text element every 10-20s |
| `GlitchShatter` | inline | the "that landed" confirmation on an action |
| `GlitchText` | inline | resting text accents |

**`DimensionalSpots` is the big one (~2200 lines) and it spans three layers:**

- `[data-sv-spots]` at `-z-10` — the void's **interior**, behind all UI.
- `[data-sv-tear]` at `z-30` — its **torn edge, fractures and pale linework**,
  over the UI, plus a blackout clipped to its outline. This is what makes it
  read as a hole rather than a sticker.
- `[data-sv-corrupt]` at `z-30` — transient corruption bursts.

Both void layers are driven by *the same generated keyframes*. Each void writes
its own `@keyframes` at spawn into a single `<style>` — that is why two voids
never behave alike, and it is the thing to understand before editing timing.

`/lab` (development only) renders every effect in isolation with buttons to fire
them. `qa/README.md` has the table of events (`sv:spot`, `sv:lightning`,
`sv:glitch`).

## 4. ~~The one open decision~~ — RESOLVED, do not re-litigate

**This was decided and fixed after this handoff was written.** Option 2 was
chosen: an ink halo behind every glyph (`--ink-halo` in `app/globals.css`). The
measurement method in `qa/contrast-check.mjs` had to be rebuilt at the same time,
because hiding the text to sample the ground also hides the halo. The page now
measures all clear, worst 6.41:1; `NO_HALO=1` reproduces the old failure under
the same method. See `docs/DECISIONS.md` and `docs/DEV_REPORT.md`.

The original write-up is kept below for the reasoning behind the three options.

### Original entry

**Text contrast against the composited background fails, and it is measurable.**

`CLAUDE.md` requires every text/background pair to clear 4.5:1 against the ground
as actually rendered, and explicitly says to measure rather than assume. Nothing
ever had. `qa/contrast-check.mjs` now does.

```
node qa/contrast-check.mjs http://localhost:3488
```

Where a bright thread passes behind the header column, `Elevation` and the
summary line drop to about 1:1 — text and background the same brightness.

**It pre-dates the brightening.** Measured with the old thread values and the
new ones, back to back: **8 failing pairs before, 9 after**; worst case 1.01:1
before, 1.00:1 after. Brightening deepened an existing violation rather than
creating one. It is worst at 390px, where the reading column is the whole
viewport.

Three fixes, none of which should be chosen silently — see `docs/DECISIONS.md`
for the full write-up:

1. **Dim the threads again.** Undoes what was asked for.
2. **A dark halo behind small text** (`paint-order: stroke`, or a text-shadow in
   `--bg`). On-theme — an ink outline round type is comic language — but it
   changes typography, which `CLAUDE.md` protects.
3. **A shade behind the reading column.** Works on desktop, useless at 390px.

**Option 2 is the only one that holds at every width.** It needs a human
decision, which is why it was left alone.

## 5. Known issues

- ~~**The contrast failure above.**~~ Fixed — see section 4.
- **Elevation now means "activity in the last 14 days".** `CLAUDE.md` says
  elevation "only rises". At 84 days that was unobservable; at 14 the headline
  numeral on Home and the track page will visibly *fall* as activity ages out.
  Flagged and deliberately not redesigned — the fix is an all-time cumulative
  total for the numeral plus a baseline offset in `buildTerrain`.
- **A void can briefly obscure a label.** The tear layer draws over the
  interface by design. It is `pointer-events: none` (proven by hit-testing at
  five widths), weighted away from the reading column, fades in with growth, and
  lasts five seconds. This deliberately reverses the older "a void can never
  hide anything" rule.
- **A 4px horizontal overflow on the tree view at 320px**, from the previous
  handoff: `TopicTree`'s per-node control row is `shrink-0` and five levels of
  indentation leave it nothing to compress. **Not re-verified this session** —
  treat as reported, not confirmed. Letting that row wrap is the likely fix.
- **The streak-milestone celebration is still not rendered.** `milestoneCrossed`
  in `lib/streak.ts` is intact with a passing test suite and nothing calls it.
- **No custom `app/not-found.tsx`**, so a stale URL gets Next's stock 404 — the
  one screen with no design on it. Offered before, not taken up.

## 6. How to look at the UI — read this before trying

**Never kill Next by process name.** Resolve the port first
(`ss -lptnH 'sport = :3000'`) and kill that pid. This has destroyed the user's
own running server three times.

The safe pattern, used all session: copy the tree to a scratch directory,
symlink `node_modules`, use a **copy** of the database, and run on port 3488.
Full recipe in `qa/README.md`. Never point a dev server at `prisma/dev.db`.

```
rsync -a --exclude=.next --exclude=node_modules --exclude=.git . "$S/iso/"
ln -sfn "$PWD/node_modules" "$S/iso/node_modules"
cp prisma/dev.db "$S/iso/qa.db"
cd "$S/iso" && DATABASE_URL="file:$S/iso/qa.db" npx next dev -p 3488
```

**Two checks live in the repo and should be run after any visual change:**

- `SHOT_DIR=/tmp/shots node qa/spots-check.mjs http://localhost:3488` — overflow,
  hit-testing on **both** void layers, layer order, archetype variety, unique
  animation tracks, corruption locality and restoration, frame cost, reduced
  motion. Five widths, two pages.
- `node qa/contrast-check.mjs http://localhost:3488` — the contrast measurement
  above. Currently fails; see section 4.

**A dozen small capture scripts were written this session and live only in the
session scratchpad, which is wiped between sessions.** They are gone. They were
one-screen each and are quick to rebuild; what they did, so you know what to
write:

| Purpose | How it worked |
|---|---|
| crop individual voids | freeze both layers at 0.8 of life, crop each void's rect at 2x |
| catch a corruption burst | drop the 330-680ms removal timers, poll for `[data-sv-corrupt]`, pause and seek its animations to 0.3, crop |
| capture a lightning strike | dispatch `sv:lightning`, pause the strike's animations at 120ms, crop |
| measure the growth arc | freeze one void at nine points of its life and report scale/opacity |
| frame cost | `requestAnimationFrame` deltas, always against a baseline on the same page |

Ask if you want these saved into `qa/` properly — that is a ~10 minute job and
this is the third time this project has lost its capture tooling.

## 7. Traps that cost real time this session

- **Freezing a transient needs the animation paused *and seeked*, not just its
  removal timer dropped.** The first held-burst screenshot was a completely
  clean page: the element was there, but its animation had run to its
  `opacity: 0` end state.
- **`getComputedTiming().iterationDuration` is `null` in this Chrome.** Use
  `.duration`. A probe using the former scrubbed the first 1000ms of a 5000ms
  animation and reported the growth curve topping out at 0.22.
- **Never put a backtick inside a `page.eval` template literal**, including in
  comments. It terminates the string and the error surfaces far away.
- **Chrome serialises the `animation` shorthand with the name LAST.** A
  uniqueness check that split on the first space was comparing durations.
- **A green result from a test file that did not actually change is not
  evidence.** A patch script asserted out mid-way, left `qa/spots-check.mjs`
  untouched, and the run right after reported ALL CLEAN from the *old* check.
- **Judge visuals from crops over real content.** A displacement has nothing to
  displace over empty background; several tuning passes looked like failures
  purely because the burst landed on bare ground.
- **The headless QA browser returns 16.7ms and 33.4ms for identical content.**
  It can rule out a large frame-cost regression and nothing finer. Always
  measure against a baseline in the same run.

## 8. Immediate next step

**Ask the user which they want.** In the order I would suggest:

1. **Commit the outstanding work** (section 1). It is three tasks' worth and the
   tree is otherwise clean, so this is one small commit.
2. **Decide the contrast fix** (section 4). It is the only open item that breaks
   a rule the project sets for itself, and option 2 is the only one that works
   at every width.
3. Continue UI work as directed. If it touches the void effect, read the
   `DimensionalSpots` doc comment first — the file explains its own layering and
   why each decision was made, and several of them look wrong until you read the
   reason.

Do **not** start the learning trajectory view. It remains the last open Phase 2
item and is still deliberately sequenced last, against accumulated real data.
