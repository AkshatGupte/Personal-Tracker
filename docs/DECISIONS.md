# Decisions Log

Running record of decisions made, so future Claude Code sessions (and you)
don't re-litigate them. Append new entries at the top with a date.

---

**2026-08-31 — Lattice becomes a neon multiverse lattice; motifs may now decorate**
Reworked against a Spider-Verse-styled reference. Three changes, and one rule
change underneath them.

- **Geometry**: the organic spider web is replaced by a fractured hex lattice —
  a broken honeycomb with a few larger nested apertures and long struts. Angular
  rather than organic, which reads as structure under tension instead of as an
  insect's web.
- **Palette**: neon multiverse. Magenta above, electric blue below, white
  edges, replacing the classic-suit red/blue.
- **Chromatic split**: the lattice is drawn three times at sub-pixel offsets —
  cyan low, magenta high, true colour on top. Static; nothing animates. The
  same misregistration is applied to display headings, which is how the
  reference's title-card banner reads without building a comic panel around it.

**The rule change:** `data-motif` moved from the atmosphere div to `<html>`, so
a motif can decorate non-data elements — headings, section-label markers. The
constraint that actually protects the product is untouched and still verified
per motif: **a motif may never colour data.** Section labels also take a small
marker on lattice days, inserted via CSS `content` so it never reaches an
accessible name.

**A trap worth recording:** `--m-*` tokens are scoped to the atmosphere element.
The heading treatment first used `var(--m-web-c1)` and silently did nothing —
an unresolved custom property makes the whole declaration invalid at
computed-value time. Treatments outside the background layer must read the
`--lattice-*` palette on `:root`. Caught because the test asserted on computed
`text-shadow` rather than on a screenshot.

Measured after the change: worst ground in the reading column 4.73:1 against
the 4.5 floor; treatments confirmed absent on the other three motifs.

**2026-08-31 — The light theme and its toggle were removed**
One palette now: black and purple. The day's atmosphere is the only variation
the interface carries, so a second full palette was maintenance for a choice
nobody was making. It was also actively holding the design back: every motif
had to satisfy whichever theme had less contrast headroom, and that was always
light — measured, the base ground alone gives 6.04:1 in dark against 4.66:1 in
light, so light set the ceiling on how vivid any motif could be. Removing it
roughly doubled the available budget.

Gone: `components/ThemeToggle.tsx`, the pre-paint theme script in the layout,
the `prefers-color-scheme` block and the `[data-theme]` blocks. `:root` carries
the values directly and declares `color-scheme: dark`.

**2026-08-31 — The lattice web covers the whole viewport, not one margin**
The first full version anchored the web off the right edge and masked it to the
page gutter, which was contrast-safe and wrong: most of the page looked
untouched. The geometry now anchors outside every edge and corner, and the mask
is keyed to the gutter rather than to a percentage — full weight in the two
margins, roughly a seventh of that across the reading column. Keying it to the
gutter matters at narrow widths: below the container size there is no margin,
so the whole web simply runs at the safe strength instead of putting full
weight over text.

Measured at 1440 wide: worst ground in the reading column 4.67:1 against the
4.5 floor; in the gutters, where no text sits, the threads run far stronger.
Four rounds of tuning to get there — 0.25 fade read 3.28:1, 0.20 read 4.36:1.

**2026-08-31 — Motif rotation counts weeks from a Monday (correctness fix)**
`weekIndex` divided days since the Unix epoch by 7. 1 Jan 1970 was a Thursday,
so the index rolled over mid-week and the documented pairing — Monday with
Thursday, Tuesday with Friday, Wednesday alone — never actually happened; the
motif changed on Thursdays instead. Distribution was still even, so nothing was
starved, but the behaviour contradicted the documentation and disagreed with
the Monday weeks used by the heatmap and `lib/rollup.ts`. Same class of defect
as the UTC day boundary fixed in Item 6: a week boundary inherited from an
epoch rather than chosen. `lib/motif.ts` now counts from a fixed Monday via
`startOfWeek`, with a guard for dates before the origin. Nine tests cover it.

**2026-08-31 — A motif hue must be judged after compositing, not at source**
Lattice was specified at hue 350 (crimson) and measured at hue 320 (magenta) on
screen. The near-black ground is hue 240, and a low-alpha warm overlay is
dragged toward it — 30 degrees for lattice, against 6 for voyage and 8 for
terrace, because red sits furthest from the ground hue. Worse, 320 was the
closest of all four composited motifs to `accent` purple at 255, so it read as
a dirty version of the app's own accent rather than as its own colour.

Fixed by rotating the source to hue 9 **at unchanged saturation and lightness**
— the channel spread is identical, only the middle channel moved. Saturation
was deliberately not raised. Light theme now composites to hue 15, a clear
scarlet. Dark theme sits near-achromatic at 6% luminance where hue readings are
unstable, so it was judged visually rather than numerically.

**2026-08-31 — Lattice is anchored inside the frame, in the empty margin**
The anchor sat off-canvas at `105% -10%`. Only the far field reached the
screen, where spokes are effectively parallel and rings effectively straight,
so it read as diagonal streaks. The spoke-and-ring intersection that *is* a web
never entered the viewport. Measured as the weakest of the four motifs: mean
pixel delta 5.01 against terrace 13.1, with only 24.2% of pixels changed by 5
or more.

The anchor now sits at `96% 58%` — inside the right page margin and below the
hero, which the empty-space audit identified as permanently empty at desktop
widths. Spokes at 9 degrees and rings at 68px make cells read as roughly square
around 430px out. A mask fades the convergence so it never reads as a bullseye,
and the node reads as an anchor point rather than a target. After the change:
mean delta 8.59 and 53.7% of pixels at 5 or more — between voyage and terrace,
no longer the weakest and not the loudest.

This also answers the empty-space question without adding content: the motif
was strengthened where the page is structurally empty, rather than filling that
space with something to look at.

**2026-08-31 — Weekly rollups are a period-generic layer, not a weekly one**
`lib/rollup.ts` takes whatever buckets it is handed. `weekBuckets` is the only
week-specific thing in it, so the monthly summary needs a `monthBuckets`
function beside it and nothing else, and the trajectory view can read the same
`PeriodRollup[]` rather than computing history a third way. Written this way
deliberately: three features consume the same aggregation, and Phase 3's "pace
comparison, this week vs last week" is a fourth.

**Every period carries two figures, not one.** `completed` and `activeDays`.
The same total finished in one sitting and spread across five days are not the
same week, and only the second figure can tell them apart. This is also the
distinction the future trajectory work needs for "sustained vs bursty", so it
is recorded from the start rather than retrofitted.

**Weeks run Monday to Sunday**, matching the heatmap grid. A summary that
disagreed with the heatmap about where a week begins would be worse than no
summary.

**Buckets are half-open** (`start` inclusive, `endExclusive` exclusive) and
consecutive buckets touch exactly, so no day can be double-counted or lost at a
boundary. Verified for the Sunday/Monday midnight boundary specifically.

**Future days are not zeros.** The current week counts only elapsed days, and a
day that has not arrived is drawn as an outline rather than as an empty cell —
it has not been missed. Rows dated in the future are ignored entirely.

**Days are counted, not rows.** `CompletionLog` holds one row per track per
day, so three tracks active on one Tuesday arrive as three rows. `totalsByDay`
collapses them first; counting rows would report one day of work as three.

**2026-08-31 — The weekly view uses the heatmap's cell language, not bars**
The first draft put a bar per week beside the hero. Two things were wrong with
it: CLAUDE.md states stat visuals are "real drawings … never bars", and a
per-week bar strip is a trend reading, which would have pre-empted the
trajectory representation that is deliberately still undecided. Replaced with a
single-week day strip in the heatmap's own cell vocabulary — one period, so it
cannot be read as direction over time, and a week here reads the same as a week
in the twelve-week grid.

The "by week" list is a table of totals for the same reason: it reports what
each week held without drawing a line through them.

**2026-08-30 — UI critique verified against the build; four of six points held**
A critique was written from two empty-state screenshots. Measured against the
running app rather than accepted or dismissed wholesale, as with the earlier
twelve-point criticism.

**Real, and fixed:**
- `0 / 0` fractions carried no unit. Now `21 / 35 done`, or `no tasks yet`
  when a track has none, on both panel headers and per topic.
- The consistency heatmap labelled four of seven rows. All seven are labelled
  now; alternating them kept the column calm but meant "which row is Thursday"
  could only be answered by counting.
- The terrain's empty-state sentence floated in the middle of the empty
  drawing, disconnected from the number it explained. Worse than reported: on
  the home screen the same message appeared **three times** — hero prose,
  terrain caption, and once per empty track row. The terrain now takes a
  `quiet` prop in hero placements and renders only the dashed baseline; the
  statement sits beside the number, and the track page gained the sentence it
  never had. Compact row profiles keep their words, since nothing else there
  says it.
- **Not in the critique, but found while checking it:** the redesign had
  dropped the "soon" affordance on Progress and Insights, leaving unbuilt
  sections looking like dead links. That violates the scope rule in CLAUDE.md.
  Restored, and the nav is now one step above section labels in the type
  ladder rather than matching them.

**False when measured:**
- *Contrast on nav and small-caps labels.* Everything measures 6.95:1 or
  better against the composited ground, against a 4.5:1 floor. The real issue
  underneath was **size and rank**, not contrast: nav sat at the same 9.6px as
  gutter labels. Nav moved to 10.4px; the labels stay.
- *The heatmap will break on mobile.* It already sits in an `overflow-x-auto`
  container and fits at 390px (358px content in a 358px box) with no page
  overflow.

**Rejected, with reason:**
- *"Nothing shows terrain; the core differentiator is carried by copy."* The
  terrain is the full-bleed hero on both screens. The critique read two
  empty-state screenshots, where CLAUDE.md deliberately specifies a flat
  dashed baseline and a plain statement rather than a fabricated curve. With
  data it is the dominant element on the page. The inference was reasonable
  from those screens; the conclusion is wrong.
- *The ring and heatmap are "generic dashboard widgets".* Both are named in
  CLAUDE.md and both read real data. Reinventing a chart type to avoid looking
  conventional is not a good enough reason to make completion harder to read.

**Tested, holds:** topic/task nesting was checked with five topics and 35
tasks. The hierarchy reads. The weakest link is topic-to-topic separation,
which currently rests on the progress stratum under each topic name, and the
add-task form repeating once per open topic gets noisy at five. Neither is
broken; both are worth watching once a real curriculum exists.

**2026-08-30 — Visual direction: survey sheet, approved from a specimen**
Approved after four rounds against a throwaway specimen artifact, not from
prose. Supersedes the "dark neon dashboard" direction below and the card
language that came with it. CLAUDE.md has been rewritten to match; trust that
file over any earlier entry here.

The direction sharpens what already existed rather than replacing it: the
terrain was always the signature, and it was sitting inside a rounded widget
surrounded by generic dashboard chrome. It now runs full-bleed as the ground.

**Radius means interactive.** Controls carry 3px; panels, sections and data
surfaces carry none. This is the rule that replaced "panels 1rem, controls
0.5rem", and it is a test anyone can apply. `card-lit`, the drop shadow, the
hover lift and `components/Card.tsx` are retired; `Panel` is a labelled band
with a gutter, not a box. This reverses the 2026-08-30 "Depth is a requirement"
entry below — the *intent* of that entry stands (it must not look flat and
cheap) but it is now met by layered grounds, the rule system and the terrain's
light rather than by shadowed rounded boxes.

**Three type families, because hierarchy may not lean on weight.** This
reverses "one family, Plus Jakarta Sans". Instrument Serif ships a single
weight and so cannot be bolded; IBM Plex Mono carries every number in the app
and guarantees tabular figures; Jakarta keeps body and controls. Six
distinguishable levels, only one of which is a weight change. Both new faces
load through `next/font/google` — no new dependency, roughly 40–55KB of woff2.

**2026-08-30 — The atmosphere: a personalization layer that may not touch data**
A visual layer keyed to the local day, from the user's own interests. Abstract
only — geometry, light and one hue each, never a character, logo, crest,
wordmark, slogan or licensed artwork. That constraint is not only legal: a
crest is exactly what would make it read as merchandise rather than as taste.
**It is never named in the interface.**

Architecturally it is a separate token layer that is structurally incapable of
carrying meaning. `--m-*` tokens paint only the page ground; `accent`, `streak`
and `positive` keep their meanings in every motif, so the three-signal rule
survives intact and the contrast matrix does not multiply — only the composited
ground needs re-checking, which is 8 measurements rather than 8 x every pair.
Verified: the ridge stroke, the completion tick and all three semantic tokens
are byte-identical across all four motifs.

Three hues are permanently spoken for — accent (purple in dark, blue in light),
streak (amber), positive (green) — so the motifs take indigo, crimson, cyan and
pale sky. Beacon was first drafted jade and was changed: it sat close enough to
`positive` to be misread as completion. The ring geometry carries that motif's
influence; the hue did not need to.

Resolution is pure and server-side (`lib/motif.ts`), so there is no hydration
mismatch and nothing is stored. This is **not** Phase 4 personalization, which
is stored preferences shaping LLM tone; it shares only the word.

**2026-08-30 — Atmosphere had to be re-tuned once it was on a real page**
The specimen judged it in 215px frames. At full page width the same alpha values
read as a wash over the whole screen, and the repeating geometry turned into
dense hatching. Alphas were roughly halved and the geometry spacing nearly
doubled. Worth remembering: a background field calibrated in a small frame will
always be too strong at page scale.

**2026-08-30 — Motion audited down to what reports a state change**
Kept: the completion tick, the ring advancing, the ridge drawing as the data is
drawn. Retired: the card entrance stagger, the card hover lift, the heatmap
cell stagger, and a summit dot that faded in a second after load. Each of those
animated on load without reporting anything. Note the honest limit: the ridge
and ring draw on mount as well as on change, because a true change-only
animation would need state carried across navigations, which is not worth the
machinery.

**2026-08-30 — Full-bleed offsets must be measured from the container**
`margin-right: calc(50% - 50vw)` resolves the percentage against whichever
column the element sits in, not the page container, so the terrain over-extended
and pushed today's summit off-screen. `.bleed-r` now measures from the 64rem
container with a `max()` floor at the page gutter, so it degrades to exactly the
padding once the viewport is narrower than the container.

**2026-08-30 — Two future capabilities admitted to scope, representation left open**
Scope verification, no code written. Neither capability was captured anywhere:
one existed only as a negative ("no topic graphs, trees or mind maps") with no
future home, which reads as a permanent no rather than a deferral.

1. **Learning trajectory / consistency over time** — Phase 2, last item. The
   existing weekly and monthly summaries are point-in-time rollups, and Phase
   3's "pace comparison" is LLM-generated *text*, not a representation. Neither
   answers "is my momentum improving, or am I drifting". The streak counter,
   heatmap and terrain elevation are inputs to this, not the answer.
2. **Track structure exploration** (Track → Topic → Task) — new Phase 5.

**The representation is deliberately undecided for both, and that is the
decision.** Tree, dependency graph, mind map, progression path, radial and
terrain-based are all still candidates; picking one now would commit the data
model before the learning experience has been evaluated. A future session may
not resolve this by default — the choice needs real data and a design pass.

Two constraints that follow, so a later session does not trip on them:
- Trajectory must not be folded into the three existing signals. CLAUDE.md
  keeps volume (terrain, accent), consistency (streak, ember) and completion
  (positive) separate; trajectory is a *derived reading* of history, and
  giving it its own borrowed colour or bolting it onto the terrain would
  conflate two of them. It needs its own treatment or a deliberate extension
  of that rule.
- Prerequisites and dependency relations stay unbuilt, and stay a consequence
  of the representation decision rather than a prerequisite for it. Adding the
  schema first would quietly pick the graph.

Phases were not renumbered: CLAUDE.md refers to Phase 3 and Phase 4 by number.
Structure exploration is Phase 5 because it depends on Phase 3 — a generated
curriculum is what gives a Track enough structure to be worth exploring.
Recorded in `docs/ROADMAP.md`, `docs/PRD.md` (post-MVP section, so the
"is it in the PRD?" scope gate in CLAUDE.md does not later refuse them) and
the 2026-08-30 handoff's deferral list.

**2026-08-30 — The displayed streak is recomputed on read, not read from the cache**
A strict streak breaks through inactivity, and inactivity writes nothing, so no
code path exists to reset the cached `currentStreak` when a user simply stops.
Rendering does not write (a render doing writes is its own problem), so the
read path derives the streak from `CompletionLog` and displays that. The cached
columns are still written on every completion and are what a rebuild would
produce; they are a cache, and the read no longer trusts them. Consequence: a
cached value can lag if history is edited outside the app, and it catches up on
the next write. Verified: a lapsed streak reads 0 with no write occurring.

**2026-08-30 — `longestStreak` is a pure recompute, not a high-water mark**
`max(stored, computed)` was rejected. It would make the column impossible to
rebuild from `CompletionLog`, which contradicts calling it a cache. The only
case where a recompute lowers it is uncompleting work finished today, which is
a same-day correction rather than lost history — earlier days are frozen and
cannot be shortened.

**2026-08-30 — A day with no completions has no `CompletionLog` row**
When today's rollup recomputes to zero the row is deleted rather than written
as `tasksCompletedCount: 0`. A zero row is indistinguishable from real activity
when reading "which days were active", and would keep a streak alive on a day
nothing was finished.

**2026-08-30 — Deleting a task or topic recomputes today's rollup**
Today's row is defined as a rollup of live task state, so a task completed
today and then deleted must leave it. Earlier days are untouched: history
records what was done at the time, and deleting the task now does not undo the
day it was finished. The same holds for uncompleting something finished on an
earlier day — the task clears, the history stays.

**2026-08-30 — Streak history is read whole, not through the terrain window**
Terrain shows 12 weeks; a streak can be longer. Reading only the window would
silently cap `longestStreak` at 84. `CompletionLog` holds at most one row per
track per day, so a full read stays small for a single local user.

**2026-08-30 — Completion is a toggle button, not a checkbox input**
`aria-pressed` carries the state and the accessible name stays constant, which
is what a screen reader wants from a toggle; it also needs no surrounding form.
The tick updates optimistically and falls back to `Task.status` when the page
revalidates, so a rejected write corrects itself rather than leaving a false
tick. Uncompletion is supported, because a mis-click otherwise has no remedy.

**2026-08-30 — A stale `.next` cache can fail the build with a webpack crash**
`npm run build` died with `TypeError: Cannot read properties of undefined
(reading 'length')` in webpack's `WasmHash`, with no reference to any project
file. It is the incremental cache, not the code: `rm -rf .next` then rebuild
passes, and the committed baseline builds clean. Worth trying first before
hunting a phantom code problem.

**2026-08-30 — Completion model settled (supersedes the open question below)**
Approved before writing Item 6. Source of truth splits as follows:

- `Task.status` + `Task.completedAt` own whether a single task is done, and when
- The completion ratio is derived from `Task.status` on read, never stored
- `CompletionLog` owns historical daily activity: streaks, heatmap, terrain
- `Track.currentStreak` / `longestStreak` / `lastActivityDate` are a cache of
  what `CompletionLog` already implies, and can always be rebuilt from it

**Today's `CompletionLog` row is a recomputed rollup of `Task.completedAt`;
earlier days are frozen.** On any completion or uncompletion, set or clear the
task fields, then recompute only the current day's row. Never rewrite an
earlier day.

Consequences, all intended:
- The ratio changes immediately, because it reads live task state
- History is never rewritten, so a streak that was earned stays earned
- Terrain does not decrease across days. It may adjust within the current day,
  which is a correction rather than history
- Uncompleting or deleting a task completed on an earlier day clears the task
  but leaves that day's history intact

**Recompute, never increment.** `increment: 1` double-counts on
complete, uncomplete, complete, inflating elevation from a single task.
Recomputing is idempotent, which also makes retries and double-clicks safe.
Recompute the streak from `CompletionLog` rather than doing
`currentStreak + 1`, which drifts on any retry.

Note that `buildTerrain` does not enforce monotonicity: it is a plain
cumulative sum and would render a decrease faithfully. Monotonicity is a
property of this write policy, not of the drawing code.

**2026-08-30 — Day boundaries move to local time, via one shared helper**
All day maths is currently UTC (`lib/terrain.ts`, `lib/progress.ts`,
`components/StreakHeatmap.tsx`). For a single local user that rolls the day at
05:30 IST, so a task finished at 02:00 Tuesday counts as Monday and can break a
strict streak unfairly. CLAUDE.md specifies local-first and a single local
user, and the server is the user's own machine, so local time is unambiguous.
Reads and writes must share one `startOfDay()` helper. If the app is ever
deployed to Vercel the server returns to UTC and this needs revisiting.

**2026-08-30 — `CompletionLog.date` must be normalised on write**
`@@unique([trackId, date])` compares the full `DateTime`, so writing
`new Date()` creates a new row per completion instead of upserting, silently
breaking the documented one-row-per-track-per-day invariant. Reads would hide
the damage, because `toCountsByDay` sums by day key. Every write goes through
the shared day helper.

**2026-08-30 — Broad visual critique deferred until real completion data exists**
A twelve-point design criticism was verified against the working tree. Four
points were real (compact terrain empty state, three simultaneously empty
visualisations, one uppercase eyebrow per card, two sources of truth for
completion). Three were false when measured: unused desktop space is 23% at
1440x900 worst case and 13% with three tracks, typography is sound apart from a
missing middle step in the scale, and cards are not themselves the problem.
The rest are artefacts of having no completion data. Decision: fix only the
compact terrain empty state now, and revisit visual identity after the
completion engine exists, because most of the criticism is measuring an empty
room rather than a badly designed one.

**2026-08-30 — `CompletionLog` authority is an OPEN question for Item 6**
Not yet decided, recorded so it is not missed. The terrain reads
`CompletionLog`; the completion ratio reads `Task.status`. Nothing reconciles
them, and `buildTerrain` is cumulative so elevation only ever rises. If a task
can be un-completed, the ratio falls while the terrain does not. Item 6 must
decide whether `CompletionLog` is authoritative or derived from
`Task.completedAt` before writing the engine.

**2026-08-30 — Explicit `position` on Topic and Task**
Both were ordered by `createdAt` only. Added `position Int @default(0)` to each,
with composite indexes `(trackId, position)` and `(topicId, position)`. New rows
append as max+1. Reads sort by `position` then `createdAt`, so rows created
before the column existed still order predictably. Nothing reorders rows yet;
the field exists so ordering is not retrofitted once curricula are generated.
Prerequisites and dependency relations were deliberately not added.

**2026-08-30 — A `"use server"` module may only export async functions**
`DIFFICULTIES` was first declared in `lib/actions/tasks.ts`. It crossed the
server/client boundary as a non-array and crashed the track page with
"DIFFICULTIES.map is not a function". Constants now live in
`lib/difficulty.ts`. Type-only exports from an action module remain fine
because they are erased at compile time.

**2026-08-30 — Task form is not built on InlineCreateForm**
A task carries a title and an optional difficulty. Pushing a select through the
single-field primitive would have added props no other caller uses, so
`NewTaskForm` is separate. `InlineCreateForm` still serves tracks and topics.

**2026-08-30 — Grid children need an explicit base column**
Both pages used `grid` with columns defined only at `lg`. Grid items default to
`min-width: auto`, so at narrow widths content forced the track wider than the
viewport and the page scrolled sideways: 400px against a 390px viewport, and
327px against 320px on the home page before Tasks existed. Adding
`grid-cols-1` at the base fixes both and changes nothing at desktop.

**2026-08-30 — Terrain is the progress metaphor, and it is data-driven**
Elevation is cumulative completed tasks read from `CompletionLog`. Pace is not
a separate metric: strata sit at fixed elevations, so a steep climb crosses
several within a short span and they bunch. Milestones are drawn only at the
day they were actually crossed. No completions renders a flat baseline and says
so. The maths lives in `lib/terrain.ts` as pure functions so the mapping can be
checked without rendering anything.

**2026-08-30 — Three progress signals stay separate**
Volume is terrain elevation in `accent`. Consistency is the streak count and
heatmap in `streak`. Completion is the finished state in `positive`, which had
zero usages before this change, which is why nothing in the app ever read as
done. No XP, levels, points or badges: the PRD does not define them.

**2026-08-30 — Ember replaces the previous streak colour**
`#E3A857` in dark. It measures 2.10:1 on the light ground, so light uses a
deepened ember `#9A6212` (4.79:1). Ember marks streaks and milestones only; a
zero streak renders muted, because ember should signal real achievement.

**2026-08-30 — Ambient glow retired**
The drifting gradient blobs carried no data. The terrain gradient now provides
the light and the ruled grid stays as ground. Do not reintroduce the blobs.

**2026-08-30 — Focus rings are defined once, globally**
Every interactive control had no `:focus-visible` styling at all. The ring is
now declared once in the base layer. Note that Tailwind's `outline-none`
utility silently defeats it, so inputs must not carry that class.

**2026-08-30 — Track screen established at `/tracks/[id]`**
The IA exposed only Track level; Topics and Tasks had no surface. The Track
screen is the reusable pattern future Topic and Task work builds on:
overview and terrain, then Topics beside Completion and Consistency.
`InlineCreateForm` is shared by tracks and topics and is ready for tasks.

**2026-08-30 — Visual direction changed again, to a dark neon dashboard**
The user supplied a second reference (top nav, greeting hero, glowing stat
cards, progress ring, streak heatmap) and asked to follow it. CLAUDE.md's
"Visual Design Direction" was rewritten again. Supersedes the 2026-08-29
"dashboard template" entry below, which itself superseded the trail direction.
Dark black/purple is now the primary look; light blue/white remains as the
second theme. The two-theme token architecture was kept — only the values and
the card language changed.

**2026-08-30 — Depth is a requirement, not decoration**
The user explicitly asked that it not look like "basic black/purple". The
ambient drifting glow, the ruled grid pattern, the lit card edges and the
drawn-in ring are therefore part of the spec, not optional polish. They are
listed under "Depth and pattern" in CLAUDE.md. Removing them regresses the
design.

**2026-08-30 — Reference features that were NOT built**
The reference shows XP, levels, achievements, a search box, a user avatar and
a "Next Up" recommendation. None appear in `docs/PRD.md`; auto-suggesting what
to study next is an explicit PRD non-goal, and avatars/accounts conflict with
the single-local-user decision. The visual language was adopted and mapped
onto real data instead: the ring shows real task completion, the heatmap reads
real CompletionLog rows, and unbuilt sections appear in the nav as disabled
"soon" chips rather than dead links.

**2026-08-30 — reduce-motion must cancel delays, not just durations**
The first reduced-motion block overrode `animation-duration` and
`iteration-count` but not `animation-delay`. Staggered entrances start at
opacity 0, so content stayed invisible until its delay elapsed — the opposite
of the intent. `animation-delay: -1ms` and `transition-delay: 0s` are now part
of that block. Verified: zero animations running 150ms after load.

**2026-08-29 — Visual direction changed to a dashboard template (reverses the
trail/topographic direction)**
The user supplied a minimal habit-tracker dashboard as the reference and asked
to follow it. This reverses the earlier trail/contour direction entirely: the
topographic metaphor, the moss/amber palette and the Fraunces/Plex type pairing
are gone, and `components/ContourField.tsx` was deleted. CLAUDE.md's "Visual
Design Direction" section was rewritten to match, so future sessions do not
drift back. Superseded: the 2026-08-29 entry "Design system follows CLAUDE.md's
trail metaphor" below.

**2026-08-29 — Two themes from one token set**
Light is blue/white, dark is black/purple. Components reference semantic tokens
(`bg`, `surface`, `fg`, `muted`, `accent`, …) and never a raw hex or a `dark:`
variant; the theme swaps the values. Choice persists in localStorage, falls back
to the system preference, and is applied by a tiny inline script before first
paint so the page never flashes the wrong theme.

**2026-08-29 — Palette corrected for contrast before any UI was written**
The first draft of the new palette failed 4.5:1 in eight places: light
`streak`/`positive` on all three grounds, and dark `accent` on surface and
elevated. Shipped values are light streak `#0369A1`, light positive `#047857`,
dark accent `#A78BFA`. All pairs now pass in both themes.

**2026-08-29 — Body text carries a small word-spacing nudge**
Plus Jakarta Sans has an unusually narrow space glyph (0.188em measured, against
~0.278em for Arial), which made running text read as though words were joined.
`body` sets `word-spacing: 0.06em` to compensate. Do not remove it without
re-checking how body copy reads.

**2026-08-29 — Dashboard widgets wait for their phase**
The reference shows weekday grids, percentage rings and a progress chart. Those
are Phase 2+ and need data that does not exist yet, so the design system was
applied only to real screens. No widget is filled with invented numbers.

**2026-08-29 — Schema constraints added beyond docs/SCHEMA.md**
Building the Prisma schema required decisions the spec did not state, so
`docs/SCHEMA.md` has been updated to match the implementation (per the rule in
the prisma-conventions skill). Specifically: cascade delete on every child
relation so deleting a Track cannot orphan Topics/Tasks/logs; a
`@@unique([trackId, date])` on CompletionLog to actually enforce the
documented "one row per track per day"; sensible defaults (streaks 0, status
"pending", isExpected false); `lastActivityDate` made nullable since a new
track has no activity; and indexes on foreign keys plus `Task.status`.

**2026-08-29 — Dates and enums are stored as DateTime/String**
SQLite has no dedicated date or enum type, so all date fields are `DateTime`
and `status`/`difficulty` stay strings validated in application code, exactly
as docs/SCHEMA.md specifies.

**2026-08-29 — Muted text colour lightened for contrast**
CLAUDE.md specifies cool slate `#5C6B66` for muted/secondary text, but on the
`#1C2321` ground that measures 2.86:1 — below the 3:1 floor for even large
text. Using `#8FA09A` instead (5.84:1, passes AA). The rest of the palette is
unchanged and all of it passes. Recorded here because it is a deliberate
deviation from the brief, made for legibility, not taste.

**2026-08-29 — Font tokens must use `@theme inline`**
In Tailwind v4, a `@theme` token whose value contains `var()` becomes invalid
at computed-value time and silently kills every utility built from it. Because
the font tokens reference next/font's variables, they must be declared in
`@theme inline`. Getting this wrong disabled all three typefaces with no error
anywhere — it was only caught by looking at a screenshot. Colour tokens stay
in the plain `@theme` block so `--color-*` remains available to SVG strokes.

**2026-08-29 — Visual QA runs against a real browser, not the MCP server**
The project's `playwright-visual-qa` skill expects the Playwright MCP server,
which is configured for the `chrome` channel and fails here because only
Chromium is installed. QA is instead run with a short Playwright script from
the scratchpad, so no browser-automation dependency is added to the project.
Adding `--browser chromium` to the MCP server args in `~/.claude.json` would
fix the MCP path if that is ever preferred.

**2026-08-29 — Docs live in `docs/`**
CLAUDE.md and RULES.md already referenced `docs/PRD.md`, `docs/ROADMAP.md`
etc., but the files sat in the project root. Moved them into `docs/` so the
existing references resolve. CLAUDE.md stays at the root, where it is
auto-read from.

**2026-08-29 — Next.js pinned to 15.x (not 14, not 16)**
CLAUDE.md specifies "14+". Chose 15.5 because Node 26 is installed locally and
14 is not reliable on it. Ships with React 19 and Tailwind v4.

**2026-08-29 — Prisma pinned to exactly 7.10.0 (both packages)**
`npm install prisma@latest` resolves to an `8.0.0-rc` prerelease, while
`@prisma/client@latest` resolves to stable 7.10.0 — installing both with
`@latest` produces mismatched majors. Both are pinned with exact versions.
Do not run `npm update` on these without re-checking the pair still matches.

**2026-08-29 — SQLite reached through a driver adapter**
Prisma 7 no longer speaks to SQLite directly; it requires a driver adapter, so
`@prisma/adapter-better-sqlite3` is a required dependency, not an optional
extra. It compiles a small native binary on install.

**2026-08-29 — No `dotenv` dependency**
Prisma's generated config assumes `dotenv`. Replaced with Node's built-in
`process.loadEnvFile()`, which Node 26 supports, keeping the dependency count
down per CLAUDE.md.

**2026-08-29 — Design system follows CLAUDE.md's trail metaphor**
Palette and type roles are defined once as tokens in `app/globals.css`.
Typefaces: Fraunces (display, used sparingly), IBM Plex Sans (body), IBM Plex
Mono (all numbers, streaks and dates). The topographic contour motif in
`components/ContourField.tsx` is the shared vocabulary the streak/progress
visuals will extend — progress should read as a route traced across terrain,
not a filled bar.

**2026-08-29 — Tech stack locked**
Next.js + TypeScript + Tailwind + Prisma + SQLite + Anthropic API
(claude-haiku for LLM calls). Reason: zero/near-zero cost, proven for
solo/small-scale projects, minimal ops overhead.

**2026-08-29 — Streaks are strict, not forgiving**
A missed day resets the streak to 0. No streak freezes or grace periods.

**2026-08-29 — Progress unit = tasks completed**
Progress is measured by discrete completed tasks (e.g. DSA questions
solved), not time spent or self-reported vague check-ins.

**2026-08-29 — Multiple parallel tracks supported**
Not limited to a single goal — user can run several tracks simultaneously
(e.g. DSA + Spanish + Guitar).

**2026-08-29 — Goals are user-defined, not hardcoded**
Track → Topic → Task hierarchy is fully user-created, with LLM-assisted
curriculum suggestions rather than pre-built subject templates.

**2026-08-29 — System is not agentic**
All LLM usage is one-shot/stateless. No autonomous multi-step planning or
background agents in MVP or foreseeable near-term scope.

**2026-08-29 — Personalization deferred to Phase 4**
Favorites/preferences-based tone adaptation is a real planned feature but
explicitly out of MVP scope — it's a prompt-layer addition, not a
structural one, so it's safe to defer.
