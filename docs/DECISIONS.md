# Decisions Log

Running record of decisions made, so future Claude Code sessions (and you)
don't re-litigate them. Append new entries at the top with a date.

---

**2026-09-06 (bugfix) — `DimensionalSpots` scrolls with the environment; the
earlier reasoning for pinning it was wrong**

Reported: a spot moves down the page as you scroll instead of staying where it
opened. It does, and the decision that caused it is recorded two entries above,
where the scrolling background was introduced:

> "This one stays pinned to the viewport while the two layers above it now
> scroll, and that is the right split: a tear is a transient event that happens
> where you are looking, not a fixture placed in the environment."

**That confused where a tear opens with what it belongs to.** A spot is a *hole
in the background* — `CLAUDE.md` and the component's own docblock both say so,
and the interior layer sits at `-z-10` specifically to paint over the rift glows
and the neon structures and eat the part of the environment it covers. Pin the
hole to the viewport while the background scrolls and the thing it was cut out
of slides out from behind it. The occlusion is the whole effect, and it stops
landing on anything in particular.

The "spreading them over the document would fire most of them onto screens
nobody is on" worry was real and is answered without pinning: `scrollY` is
captured **at spawn**, so a tear still opens in the viewport the reader is
looking at, and only then becomes a fixture of the page. Read at paint instead
of at spawn and you get the bug back.

**All three layers moved, and they had to move together** — the interior at
`-z-10`, the torn edge at `z-30`, and the corruption burst. They are one tear
drawn in three places; anchoring one and not the others would tear the tear in
half. The burst's coordinate now comes off the spot's own `docY` rather than
being re-derived from `innerHeight` at fire time, which was wrong twice over:
viewport-relative, *and* re-read from whatever the viewport was seconds later.

The off-screen guard in `fireBurst` ("corruption outside the frame is cost with
nothing to show for it") now compares the burst's document y against the current
scroll window. That is what it always meant; it stopped saying it the moment the
tear left viewport space.

**No check caught this, which is why the user did.** `qa/spots-check.mjs`
*reported* the layer's `position` in its console line and never asserted it, so
the value silently went from `fixed` to `fixed` while the world around it
changed. It now opens a tear on the track page, records its document position
and its distance to the nearest wireframe structure, scrolls to three offsets and
requires both to be unchanged within 1px. The second number is the one that
matters — an absolute position could be right while the tear still drifted
relative to its surroundings, and the relationship is what the effect is made
of. Verified against the bug: re-pinning gives 227px on the track page (59px on
home, which is why the check does not use home).

**Process note.** Two dead ends cost time here and neither was the app:
`ChunkLoadError` from rebuilding `.next` under a running server — the same
family as the `next build` hazard already in `qa/README.md`, and the fix is the
same, stop the server, `rm -rf .next`, rebuild, start. And a stale server was
serving one build's HTML against another build's chunks, which presents as an
empty page and looks exactly like a React crash.

---

**2026-09-06 (final) — Three cleanup calls before the usage period**

**`app/not-found.tsx` added.** There was none, so `notFound()` — called by
`app/tracks/[id]` for a dead id and by `/lab` outside development — rendered
Next's stock page *inside* the root layout: an unstyled black-on-white slab with
the rift glows and wireframes drawing behind it. It read as a crash. The new page
reuses `ThreadVoid`, which already meant exactly this ("a structure with nothing
in it"), and spends no comic panel: `CLAUDE.md` allows one per screen for the
level that should dominate, and a 404 outranking a Track would be wrong.

**The check-in outcome cluster deleted from `lib/streak.ts`.** `CheckInKind`,
`CheckInOutcome`, `STREAK_MILESTONES`, `milestoneCrossed` and `describeCheckIn`,
plus `qa/streak-milestone.test.mjs`. Verified dead before removal, and the shape
of the deadness is the point: the *only* production import from `lib/streak` is
`EMPTY_STREAK, summariseStreak` in `lib/progress.ts`. `milestoneCrossed` did have
a caller — `describeCheckIn` — and `describeCheckIn`'s only caller was the suite
testing it. A closed loop of code proving code nothing runs, kept across four
handoffs in case the celebration returned.

It describes what a *check-in* did to a streak, and the check-in stopped existing
in the topic-tree restructure. A function nothing can call is not a feature
waiting to happen; it is a claim about the app that stopped being true. A note at
the foot of the file records what went and says to rewrite rather than restore,
because it was written against a model that is gone. **The naming rule survives
the removal**: `ELEVATION_MILESTONES` is still not called `MILESTONES`, precisely
because there was once a second list on a second signal.

**`qa/column-contrast.mjs` deleted; `qa/ground-stability.mjs` written.** The old
check failed by design for weeks behind a README warning block, which is the
worst state a check can be in — it trains people to stop reading failures.

Two independent reasons it was obsolete, and the second one had not been noticed:
its threshold (`MAX_GROUND_L = 0.02`) asserted the reverted column veil; **and
its stated rationale — "the atmosphere layers are `position: fixed`, so they are
locked to the viewport while the page scrolls past them" — stopped being true
when the atmosphere started spanning the document.** The defect it guarded can no
longer occur. Measured to confirm rather than assumed: the same row's ground is
byte-identical at scrollY 0/150/300/450, spread 0.0000.

So the replacement asserts the invariant that now holds — the ground under a row
does not change as you scroll — which is a genuine, current, load-bearing
property and a one-word change away from being broken (`absolute` → `fixed` on
any atmosphere layer). Calibrated in both states: clean 0.0009-0.0012 everywhere;
re-pinned 0.0028 on the short home page and 0.006-0.020 on routes with room to
scroll. `MAX_DRIFT = 0.0025` sits between, chosen so the regression is caught even
on the page with least travel — the first threshold, 0.004, let the home page
pass while pinned. Verified by re-pinning the layer and watching all six go red.

**Its first version was wrong in the same family of way as the type check's.**
The baseline was keyed by element text; `/progress` renders "activities this
week" three times, so it compared one period card's ground against another's and
reported a confident 0.0109 drift that was two different places on the page.
Three other strings there are duplicated too. Elements are stamped with a
`data-gs` id before any scrolling now. **That is twice in two sessions that a new
check's first version asserted something other than what it claimed** — the
lesson is that a check is not finished until it has been made to fail on purpose.

---

**2026-09-06 (latest) — The trajectory is per-track, per-day, and scaled against
the next milestone**

**The metric, stated first because the whole change hangs on it.** A point is
one calendar day; y is **the track's elevation at the end of that day** — every
activity ever recorded on that track, up to and including that date. Not the
day's own count, and not a windowed subtotal. The day's own count is in the
hover and in the day-by-day list, so both readings of "activity for that day"
are answered, but only one of them is the axis.

**The scaling bug.** `y = cumulative / peak`, normalised against the series' own
total, so the last point was 1.0 for every input that existed. Two activities
and two hundred drew the same picture; one activity on an empty history drew a
flat line and a full-height vertical jump. The drawing carried shape and no
magnitude at all.

**The fix: `domainMax = nextMilestone(elevation)`** — the app's own
`ELEVATION_MILESTONES` ladder (10/50/100/250/500, continuing ×2/×2.5 above),
which was already drawn on the terrain. Four properties follow, and the reason
this beats a hand-picked constant is that none of them had to be arranged:

- *Proportional.* 2 → 20% of frame, 14 → 28%, 54 → 54%, 840 → 84%.
- *Headroom by construction.* Elevation is always strictly below the next
  milestone, so the ridge cannot touch the top edge — asserted over 1 to 2600.
- *Stable.* The domain moves only when a milestone is crossed, so the chart does
  not rescale under the reader day to day.
- *Meaningful.* The axis top is a number the app already means, so the top of
  the frame *is* the next milestone.

**A `baseline` argument on `buildTerrain`.** The series used to start at zero
every fortnight, so a track with 54 activities and a quiet window drew along the
floor while the numeral beside it read 54. It now starts from the elevation
before the window, so the top of the ridge equals the headline figure — the
chart and the number are finally the same measurement. This is the "baseline
offset in `buildTerrain`" flagged in several handoffs.

Consequence worth stating: a milestone crossed *before* the window is no longer
drawn, because there is no day in frame to point at and the ground is already
above it. `reached` now requires the crossing to happen inside the window
(`cumulative - count < value`).

**`Terrain.peak` is gone, split in two** — `elevation` (all-time, the top of the
ridge) and `windowTotal` (inside the window, what the caption's span refers to).
They were one number doing both jobs, which is what let the bug hide.

**The combined all-tracks terrain is deleted.** Stacking every track into one
curve produced a height that answered no question: "how much this week" is a
total, not a shape. The home page keeps the total as a numeral and gives each
track its own trajectory in its own row. The all-tracks *heatmap* and the
`/progress` period strip stay — they are calendars, one square per day, with a
clear reading; the requirement was about the chart with no interpretation, and
they are not it.

**Different tracks have different y-domains, and that had to be said out loud.**
Three rows at 20% / 28% / 54% look like a 2.7x spread when the elevations are 2,
14 and 54. A row-sized chart has no space for an axis caption, so each row's text
line now carries it — "54 of 100 elevation" — in the row's own voice.

**Interaction.** `TerrainHover` is a separate client component so `TerrainProfile`
stays a server component drawing static geometry; only the part that needs state
ships as JavaScript. Hit targets are full-height day columns rather than the
points, because a point is a few pixels wide and asking someone to hit it is
asking them not to bother. The row charts' columns are `tabIndex={-1}`
deliberately: fourteen stops per track would put seventy between the top of a
five-track list and anything worth reaching, and those rows already carry their
figures as text and link to the track page, where the columns *are* focusable
and a day-by-day list sits under the chart.

The row caption is one line pinned inside the chart box rather than a block
following the guide — the full-size version ran straight over Rename/Delete in a
56px row. The guide and marker already say which day it is; the caption only has
to say what that day was.

---

**2026-09-06 (latest) — The two open audit changes are settled: rose kept, 12px
floor kept with one exception**

Both were reviewed against the rendered app at 1440 and 1280, measured in situ,
and neither was decided from the source alone.

**`--border-interactive` (#9a6a7f) stays, on inputs and on the activity cell.**
Sampled against the *real composited ground* at several scroll offsets rather
than against a flat token: **82-94% of the ground around an input clears 3:1,
against 0-2% for `--border` (1.04:1 on the page ground).** WCAG 1.4.11 asks 3:1
of a UI component boundary, and the old value is not a boundary at that level, it
is a suggestion. The design cost is small and was checked at 3x: it reads as an
input, stays ink/magenta rather than violet, and does not turn the row into a
form. The tier-0 activity cell reads as a well with a rim, which is what
`CLAUDE.md` asks of it.

It degrades gracefully in both directions *because* it is mid-tone — contrast
falls as the rift light brightens the ground, passes through 1:1 where the ground
matches the border's own luminance, and rises again beyond it. The worst samples
are exactly where a glow or a neon thread crosses behind an edge.

**The comment justifying it was stale and is rewritten.** It cited "3.39:1
against a composited ground at L=0.02, which is the ceiling the atmosphere is now
clipped to inside the content column" — that ceiling was the column veil, which
was reverted the same day. The token survives losing its stated reason, but the
reason had to be replaced with what was actually measured. Anything proposed to
replace it has to be measured the same way.

**The 12px floor stays; the leaf ancestry label drops to 11px.** The floor
replaced six sizes scattered between 8.0 and 11.2px — 21 distinct
(size, tracking, role) combinations across 59 elements. That was noise, not a
scale, and 8px of single-weight uppercase Bangers is not text. Collapsing it was
right.

What it broke is one relationship, and only one: the leaf path sits *directly
above* the leaf's own name, so it is the single place in the app where a label
and its content are compared side by side. 8.8px → 12px against an unchanged
14px name took the ratio from 1.59x to 1.17x, and since the ancestry is the
longer string in a face with no lowercase and one weight, it read as the heading
with the leaf name as its subtitle. Restored to 11px (1.27x) in `LeafList` and
`LeafHistory` — two elements. 10px was rendered and compared too and is better
hierarchy but back near what the floor was raised to fix; 11 is the step that
buys the subordination without the cost. `TopicControls`' `<select>` option keeps
12px: it is a chooser, not a qualifier.

**`qa/type-scale.mjs`** asserts both halves, because they pull against each other
and fixing one without measuring reintroduces the other. It reads *computed*
sizes, so an arbitrary Tailwind value that fails to compile is caught rather than
counted. `/lab` is excluded — dev-only, and it keeps its own denser labels.

**Its first version was wrong in an instructive way.** The subordination
assertion was written as `label < name`, which 12/14 satisfies — so it passed
the exact state it exists to reject, and the negative test caught that rather
than the code. It now asserts a ratio (≤ 0.82, between 11/14 = 0.79 and
12/14 = 0.86). Both halves were then re-tested by breaking them deliberately: a
flattened label reports `12px over 14px = 0.86`, and an injected 9px label
reports `4 element(s) under 11px`.

---

**2026-09-06 (latest) — Elevation is all-time; the terrain keeps its window**

`CLAUDE.md` says elevation is cumulative and only rises. The headline numeral
was `Terrain.peak`, which is the total *inside the terrain window* — so with
`TERRAIN_DAYS = 14` it fell as activity aged past a fortnight, and two weeks away
from the app took it to zero. Flagged across several sessions, fixed now.

**A separate figure, not a wider window.** The obvious fix — raise
`TERRAIN_DAYS` — is wrong, and `lib/windows.ts` already explains why: the graph
was 84 days and the profile was ~90% flat baseline with every point crushed into
a near-vertical climb against the right edge. The window is short because the
*drawing* needs it short. So the drawing keeps two weeks and the numeral has no
window at all. They were one number wearing two hats, which is exactly the
failure mode `lib/windows.ts` was written to prevent for the heatmap, arriving
again in a different place.

`cumulativeElevation(logs)` in `lib/terrain.ts`, **deliberately with no `days`
parameter.** The monotonicity is then a property of the signature rather than of
the caller: with no window there is nothing for time to push a row out of. A
`days` argument with a large default would leave the bug one careless call away.

**It sums the same rows the terrain sums, soft-deleted topics included.**
Filtering to live leaves would make deleting a topic lower the elevation — the
identical defect by another route. History is kept, so the ground stays raised.
It can still fall by one on an undo, which is the undo working.

**Three pieces of copy had to move with it**, because each was correct only
while the numeral was windowed. Leaving them would have shipped a mislabelled
figure, which is worse than the bug:
- the home caption read "activities over 2 weeks" → "activities recorded", 7-day
  figure retained. `TERRAIN_SPAN` is no longer imported there; the graph beside
  it still states its own span.
- the track page's "No elevation yet" was gated on `!terrain.hasData` ("nothing
  in 2 weeks") → gated on `elevation === 0`. Otherwise a quiet fortnight put
  "Elevation 50" directly above "No elevation yet".
- `TerrainProfile`'s empty label "No elevation yet" → "Nothing in 2 weeks", and
  `describeTerrain`'s "no elevation to show yet" → "no profile to draw yet", so
  a screen reader no longer hears "Elevation 18" followed by "no elevation to
  show".

**`qa/terrain.test.mjs`**, 21 assertions. The load-bearing one ages fixed
activity forward by 1/7/14/30/90/365 days and asserts the figure never moves,
while asserting in the same breath that the *windowed* total does fall — which is
the reason the numeral cannot be it. Validated by restoring the old behaviour and
confirming 5 assertions go red.

Verified end to end against a purpose-built database: 9 activities at 40 days old
plus 4 recent gave headline 13 / window 4; +5 today gave 18 on both pages; ageing
every row to 200+ days held the headline at 18 while the window went to 0; an
empty database still reads "0 activities so far" and "No elevation yet."

**`TERRAIN_DAYS` stays 14 and `Terrain.peak` keeps its meaning** — nothing that
reads the drawing changed. `lib/windows.ts` still says lengthening the span is a
judgement about the data, and that judgement is untouched by this.

---

**2026-09-06 (latest, fix) — Two ways the banded threads came apart**

Reported as "some structures were disconnected from the multiverse". Two
independent defects, both introduced by the banding change above, both now
covered by `qa/bands-check.mjs`.

**1. `<svg>` is a replaced element, so `inset-x-0` does not give it a width.**
`ThreadLines` was `absolute inset-0 h-full w-full`; moving it to a band's
position rewrote that as `absolute inset-x-0` with `top`/`height` inline, and
dropped `w-full`. For an *absolutely positioned replaced element* — which an svg
with a viewBox is — `width: auto` resolves from the intrinsic aspect ratio and
the resolved height, **not** from a `left: 0; right: 0` pair the way a normal
block does. viewBox is 1:1 and the height was one band, so the box came out
square: 720px wide on a 1280px page. Every thread was compressed into the left
56% of the frame while the structures stayed at their true percentages, so the
right-hand solids had nothing arriving at them. **This hit band 0 as well**, so
"band 0 is byte-identical" was true of the glows and the structures and false of
the threads — the earlier geometry probe printed the 720-wide box and it was read
past. `w-full` is back, with a comment saying why it is not redundant.

**2. Mirroring positions without mirroring directions.** Odd bands reflect the
composition about x=50. The structures were reflected and `OUTRUNS` was not, so
`a` — mirrored from x=8 to x=92 — kept `dx = -20` and its two branches pointed
back into the page, terminating at x=72 and x=74. Those are inside the frame, and
the classifier's fall-through drew them as plain segments ending in nothing.
Fixed by negating `dx` on mirrored bands, which is what reflecting a composition
means. `extend()` is the second line of defence for what jitter and the keep-out
clamp can still produce: it pushes any endpoint that would land inside the frame
along its own ray to the first boundary it crosses, so a branch can only ever
leave the composition or reach a neighbouring band's solid. It is an identity on
band 0, whose six endpoints were all hand-placed outside the frame.

**`qa/bands-check.mjs`** reads the threads out of each band's path data in that
band's own viewBox units and maps them to document pixels, rather than
re-deriving the generator's intent — a check that recomputes the thing it is
checking proves nothing. It asserts: the layers equal the document height; the
band count matches; every *rendered* structure has a thread endpoint at its
centre; and no endpoint is left alone inside the frame. "Alone" is the operative
word — an endpoint shared with another endpoint is a junction, which is what
makes the check correct at the two solids a phone does not draw, where the node
is still a real meeting point and only the solid is absent. Both defects were
reintroduced one at a time to confirm it fails on each.

**Process note, recorded because it cost the user something.** A production
`next build` was run in the project root while the user's own dev server was
serving from the same `.next`. It overwrote `.next/server`, and the running dev
server then 500'd on `/tracks/[id]` with `Cannot find module
'./vendor-chunks/@prisma.js'`; other routes recompiled themselves, that one could
not, and touching sources did not clear it because the stale piece is the
server's own webpack runtime. Only a restart fixes it. `qa/README.md` already
warns about `rm -rf .next`; **`next build` in the project root is the same
hazard and was not named.** The port check was run and its output misread,
because it was followed by an unconditional "port free" echo. Resolve the port
*and read the answer* before building, and build in the isolated copy.

---

**2026-09-06 (latest) — The atmosphere spans the document, not the viewport**

`SpiderverseBackground` and the page-wide thread layer were both `fixed
inset-0`: one viewport of environment, pinned, with the page sliding across it.
Both now span the whole document, scroll with it, and draw one band of
composition per screenful. `CLAUDE.md`'s "global, background-only, always-on"
still holds — what changed is that "global" now means the whole page rather than
the whole screen.

**Absolute, not fixed-with-a-scroll-handler, and not `position: relative` on
`body`.** An absolutely positioned element with no positioned ancestor resolves
against the initial containing block, whose origin is the *document* origin — so
`top: 0` is the top of the page and the layer scrolls normally, with no scroll
listener and nothing running per frame. Making `body` relative would have worked
too and was rejected: it silently re-parents every unparented `absolute` in the
app, which is a change to code nobody is looking at.

**The height is measured from `body`'s border box, never from
`documentElement.scrollHeight`.** The layers are absolutely positioned, so they
add to the document's scrollable overflow but not to `body`'s own height.
Measuring the scroll height would mean measuring the thing being sized from that
measurement, and any rounding upward would ratchet the document longer on every
pass. `body`'s box cannot be pushed around by its own absolutely positioned
children, so the loop cannot close. A `ResizeObserver` on it is the whole
"extends when the page grows" behaviour.

**Bands are generated, not tiled.** Band 0 is the hand-set composition,
unchanged and verified against the old Tailwind values in the DOM (glows at
-320/-252/1088x864, 512/108, 256/58; structure centres at 8%/44%, 91%/19%,
88%/80%, 24%/7%, 15%/90%). Above it each band mirrors on parity, jitters
position, scale and opacity, and **re-seeds each polyhedron** — that last part is
what matters, because a band that merely moves the same five solids around is
still a repeat, and two copies on screen together is all it takes to see the
period. The rift glows get the same treatment plus a negative animation delay per
band, so the three incommensurate drift periods do not fall into a vertical
rhythm.

**The vertical off-frame threads became cross-band threads.** They are written as
displacements from their source rather than fixed endpoints, so band 0's numbers
reproduce exactly and the same run off a moved structure leaves in the same
direction. At an internal boundary the endpoint retargets to the nearest solid in
the neighbouring band; at the document's top and bottom, where there is no
neighbour, it still runs off the edge. They are deduplicated by node pair —
without that, band k's downward branch and band k+1's upward branch frequently
resolve to the same pair and lay two neon strokes on one thread at twice the
intensity of every other.

**Per-band `<svg>` with `overflow: visible`, not one document-tall drawing.** The
bloom is a `blur()` on a `<g>`, and a filter's region is the bounding box of what
is inside it — one drawing would make that region the whole page and ask the
compositor for a texture the height of the document.

**The speed lines stay pinned, and that is the one measured exception.**
Attributed layer by layer while scrolling the track page (headless,
`--disable-gpu`, median frame time over 180 frames): baseline 66.7ms against a
16.7ms vsync floor, and removing the speed lines alone returned it to 16.7 while
removing the halftone, the glows, the structures or the thread lines changed
nothing. The cause is `sv-speedline-pan` animating `background-position-x`, which
repaints the element's visible area every frame — cheap as a fixed
viewport-sized promoted surface, a full uncacheable repaint as a document-tall
scrolling one. With it pinned, every remaining scrolling layer measures at the
vsync floor. Nothing is lost: the speed lines are a uniform hairline field with
no located feature, so there is no position in the texture to scroll to, and they
are a camera device rather than a thing in the world. It stays inside the same
container rather than moving to a sibling, so its paint order is unchanged.

**`DimensionalSpots` stays pinned too, for a different reason.** A tear is a
transient event that happens where you are looking, not a fixture placed in the
environment; spreading them over the document would fire most of them onto
screens nobody is on. Occlusion still works — same depth, later in the DOM, so it
paints over whatever band has scrolled under it, and `qa/spots-check.mjs` still
reports the layer ordering clean.

**Module split:** `DimensionalThreads` moved out of `Threads.tsx` into its own
`"use client"` module, because it needs the measured document height. `Threads.tsx`
stays a server module so `ThreadFrame`, `ThreadDivider`, `ThreadVoid` and the
shared `ThreadStructure` keep rendering to HTML on the server instead of shipping
their geometry to the browser; `Neon`, `r1` and `Pt` are exported for the new
layer to build on.

**Band height is held stable against small viewport-height changes** (20%
tolerance). On a phone the URL bar hides mid-scroll and `innerHeight` grows by
60-100px; taking that literally would re-derive every band boundary while the
user is scrolling through them.

**A QA trap found on the way, worth not rediscovering:** `Page.captureScreenshot`
with `captureBeyondViewport: true` *hangs* on a clip at the bottom of a page with
this layer, and inflates the viewport (which re-derives the bands) even when it
does not. Viewport screenshots for this must scroll first and capture with
`captureBeyondViewport: false`.

---

**2026-09-06 (later) — The column veil is reverted; Group 3.1 is open again**
Shipped in the audit pass above and **taken back out the same day at the owner's
request**: "the entire colour scheme is off, make it the same as it was before."

The reason is straightforward and the screenshot settles it. Masking the
atmosphere out of the 1024px reading column does exactly what it was designed to
do, and what it looks like at a wide viewport is a flat near-black rectangle
down the middle of the page with the glows and wireframes surviving only in the
margins. `CLAUDE.md` describes the atmosphere as global and background-only; a
version of it that stops at the content column reads as two designs side by
side, not as one page. The measurement was right and the result was wrong.

Reverted: the `.sv-column-veil` class on `DimensionalThreads`, the wrapper around
the drift glows and speed lines in `SpiderverseBackground`, and the CSS block and
its three tokens. `SpiderverseBackground.tsx` is byte-identical to its previous
state again; `Threads.tsx` differs only by the earlier three-pass neon work.

**What this does and does not reopen, measured after the revert:**

- `qa/column-contrast.mjs` fails again — 14 samples, worst region ground L 0.72,
  worst 1.00:1. The audit's stated invariant ("no content sits on a ground
  brighter than L 0.02") is **not held**, and that item should be treated as
  open rather than done.
- `qa/contrast-check.mjs` is still **ALL CLEAR**, and the distinction matters.
  That check measures the *glyph*, using the halo-aware two-frame method; the
  column check measures the *region*, including the gaps between words. The ink
  halo from 2026-09-05 puts every glyph on its own `--bg` ground regardless of
  what is drifting behind it, and it is scroll-independent, so the specific
  failure the audit opened with — the same row readable at one scroll offset and
  not at another — does not come back with the veil removed. What comes back is
  bright atmosphere *around* type, not under it.

The script is kept rather than deleted. It is the only thing that can evaluate a
future attempt, and the numbers above are only quotable because it exists. It
should be expected to fail until someone decides what to do instead — dimming
the glows globally, or accepting the region ground and relying on the halo, are
both live options and both are the owner's call.

---

**2026-09-06 — Desktop UX audit: 40 defect fixes across five groups**
A UX audit of the desktop app produced a list of functional bugs, affordance
gaps, contrast failures, accessibility defects and copy problems. Everything
below is a fix to something already built — no capability was added, removed or
changed, no animation timing was touched, and the Spider-Verse direction is
unchanged. The decisions worth recording are the ones where the obvious fix was
not the right one.

**The tree indent bug was one full level, not a rounding error.**
`first:border-l-0 first:pl-0` stripped the indent *and* the connecting rule from
the first child of every group. The step is 12px, so the first child of a
depth-2 group rendered at a depth-1 node's x: two different depths shared one
position while one depth occupied two. Removing both overrides gives five
depths, five x positions, 25px apart.

**`+ Inside` is hidden, not omitted.** It was absent on depth-5 rows, which took
its width with it and put the activity cell and Undo 43px left on those rows —
the two most-used controls in the app had two columns instead of one.
`disabled:invisible` reserves the space. It stays `disabled` so it is not a tab
stop and announces nothing.

**Focus for the four inline forms is returned by remembering *which* trigger,
not by holding the node.** The component swaps its whole render for the form, so
the button that opened it is unmounted and there is nothing to hold a ref to.
What is stored is which of the four it was; an effect refocuses it once the
buttons are back. Also: `autoFocus` did not work on the confirm button —
measured, the confirmation rendered with `document.activeElement` still `<body>`,
which additionally meant the Escape handler never received a key. That one is
focused explicitly.

**The parent-delete button is `aria-disabled`, not `disabled`.** Its explanation
is good and was reachable only by hovering a control that cannot be operated.
`aria-disabled` keeps it focusable and announced while still refusing the click,
and the reason moved from `title` to `aria-describedby`. Its opacity went 0.4 →
0.75, because 40% on this ground reads as absent rather than blocked — and a
real tab stop has to look like a control.

**A new `--border-interactive` token, beside `--border` rather than replacing
it.** WCAG 1.4.11 wants 3:1 for a component boundary; `--border` measures 1.32:1
on the page ground. It is doing its other job — panel hairlines and separators —
well, so it is untouched and inputs and the activity cell take the new one.
`#9a6a7f` was chosen against the *worst* ground rather than the flat token:
4.46:1 on `--bg` and 3.39:1 against a composited ground at L 0.02, which is the
ceiling the atmosphere is now held under inside the column. Measured on rendered
pixels afterwards at 4.4:1.

**Affordance states are plain CSS, not Tailwind `hover:` utilities.** Tailwind
wraps `hover:` in `@media (hover: hover)`, and the QA browser reports
`hover: none` — so a hover written as a utility cannot be verified here at all.
That is not a reason to avoid the variant in general, but it is a reason for the
states this audit is about (the create field, the activity cell, the row band,
the destructive action) to be written where they can be measured.

**Group 3 — the audit named the wrong layer, and the measurement said so.**
The brief attributed the scroll-dependent contrast failure to the neon
wireframes at 0.78-0.90 opacity. Toggling each layer and sampling the brightest
pixel behind the column on a track page at scrollY 0: baseline L 0.0793, threads
removed 0.0600, **rift glows removed 0.0232**. The conspicuous layer is not the
dominant one — three overlapping radial glows composite higher than any wireframe,
and CLAUDE.md's "everything under 8% opacity" is true of each layer alone and not
of the three stacked. Both are veiled; the `--bg` fill stays outside the mask,
because masking the page ground would punch a hole through to the canvas.

Why a mask on a viewport-fixed layer is an invariant rather than a patch: the
layer does not scroll and the column is centred at a constant width, so one
horizontal mask covers the column at every scroll offset by construction. Below
68rem it does not apply — the column *is* the viewport there, and veiling it
would delete the atmosphere rather than move it aside; the ink halo carries
legibility at those widths and is width-independent. Result: worst in-column
ground L 0.0168 against a 0.02 ceiling, worst text contrast 6.31:1, across two
widths, three routes and four scroll offsets.

**Sub-view toggles claim `aria-current="true"`, the top nav claims `"page"`.**
Both were claiming `page`, which put two on `/progress?period=month`. The nav
says which section of the site you are in; a toggle says which arrangement of
that section is showing.

**The heatmap legend is derived from the cells actually drawn.** `level()`
quantises against the busiest day, so steps are unreachable at small maxima —
and beyond that a window may simply contain no count that maps to a given step.
The legend printed all five regardless and advertised a magenta that is nowhere
in the grid. Deriving it from the rendered cells means the two cannot disagree.

**`bleed-r` is gone from the home terrain.** It put the `NEXT 100` axis label
338px outside the column, in the decoration layer, with the curve's endpoint dot
inside a lit polygon. An axis label is data.

**1.9 (hydration mismatch) could not be reproduced and no fix was invented.**
`caret-color` appears nowhere in the source and nowhere in the server-rendered
HTML, and no console error appears on `/`, `/tracks/[id]`, `/lab` or `/progress`
in a clean browser. `caret-color: transparent` on inputs is a browser-extension
signature. What *was* wrong and is now fixed is that `qa/cdp.mjs` could not have
seen it either: `page.errors` collected exceptions and `Log` entries but not
`console.error`, which is how React reports a hydration mismatch — so "the
console is clean" was being reported by a check structurally unable to observe
the thing it was checking for.

**Type floor: 59 sizes raised to 12px.** `/lab` and `components/spiderverse/*`
were excluded — the lab is out of scope and the effect internals are not
interface text. Tracking and case are unchanged; only the size moved.

---

**2026-09-05 (late) — The contrast failure is fixed with an ink halo (option 2), and the measurement it defeated was fixed too**
The open decision from the previous handoff. `CLAUDE.md` requires every
text/background pair to clear 4.5:1 against the *composited* ground;
`qa/contrast-check.mjs` measured it and found failures where a bright thread
passes behind the reading column — `--muted` at 1.00-1.02:1, text and background
the same brightness. Worst at 390px, where the reading column is the viewport.
The three options were put up and **option 2 was chosen: a ground of ink round
every glyph.** It is the only one that holds at every width — dimming the threads
undoes what was asked for, and a shade behind the reading column shades the whole
page on a phone.

**A halo, never a stroke, and this is the part that matters.** `text-shadow`
paints copies of the glyph *behind* it: same outline, same width, same metrics,
no reflow. `-webkit-text-stroke` would be one declaration instead of eight and is
exactly what must not be used — it strokes the glyph's own outline, so it reads
as weight, and `CLAUDE.md` is explicit that Bangers ships one weight, that
synthesised bold smears it, and that emphasis never comes from weight here. An
outline that thickens type is that rule broken from the other side.
`paint-order: stroke fill` avoids the thickening and is supported in this Chrome,
but degrades to stroke-*over*-fill anywhere it is not, and the degraded state is
the banned one.

One ring at 1px, eight directions, in `--bg`, inherited from `body` so nothing
opts in and a new component cannot forget it. Eight offset copies union to the
glyph dilated by a pixel, so the interior is covered as well as the edge and the
effective ground becomes `--bg` — `--fg` at about 18:1, `--muted` at about 8.9:1,
whatever drifts behind. One pixel because this is an ink contour in a comic, not
a glow; at two it starts to read as an outlined display treatment on body copy.

**Three opt-outs, each for a stated reason.** `.text-sv-ink`, `.sv-panel-header`
and `.sv-activity` are dark type on a solid plate, where a near-black halo round
near-black type improves nothing and does thicken the letterform. `.text-sv-ink`
is the right predicate rather than a list of components: ink type cannot be drawn
without it, so the next yellow button cannot forget it. `.sv-glitch-layer` (a new
no-op class on `GlitchText`'s duplicate layers) and `.sv-glitch-pass`
(`AmbientGlitch`'s channel copies) are offset copies of one string in the split
plates — usually `screen`-blended, where a near-black halo contributes nothing,
but `GlitchText` is used with `blend="normal"` on the comic caption box and there
an opaque halo behind each copy paints out the copies under it, knocking the
chromatic split out with itself. The base layer keeps its halo.

**The fix defeated the check, so the check was rebuilt.** `contrast-check.mjs`
sampled the ground by hiding the text — which hides the halo with it, because a
halo is part of the text's own rendering. It now freezes every animation and
takes two frames of the same page: glyph fill `transparent` (a `text-shadow` is
painted from glyph geometry and ignores the fill colour, so the halo survives)
and text hidden outright. The pixels they differ on are where the text is
painted. That the old measure was a proxy is separately true: it flags a glow
passing between two words that never touches a letterform, so it is still printed
on every line as `[box N:1]` but no longer decides.

**The mask has to be eroded, and the first attempt was wrong without it.** The
raw difference includes the halo's own antialiased fringe — partly-covered pixels
still nearly as bright as what is behind them — and against those a working halo
reported 1.01:1 and could never pass. Dropping every masked pixel that touches an
unmasked one leaves the glyph body. This is not a way of only measuring pixels
that already pass: survival is decided on geometry alone, and a halo that did not
apply leaves an empty mask and falls back to the box figure, while one too thin
for a heavy glyph leaves lit background showing inside the letterform. Either
fails.

**`NO_HALO=1` exists because the halo and the method landed together**, which
would otherwise make "it passes now" unfalsifiable. Same page, same method,
`body`'s text-shadow removed. Measured on `/` at 1560/1280/390: **5 pairs under
4.5:1 stripped, worst 1.01:1; all clear with the halo, worst 6.41:1.**

**Not measured: the paint cost.** Eight shadows on every glyph in the app is a
real cost and it has not been quantified — the probe was not run. Nothing looked
wrong at either width, but this is an open number, not a cleared one. If it ever
matters, dropping the four diagonal offsets halves it and costs very little
coverage at 1px.

---

**2026-09-05 (late) — Tears made much less frequent, in three places at once**
Called too frequent. Cut, and the important part is that the scheduled interval
was only one of three things setting the rate — changing it alone would have
done very little.

- **Interval** 4.2-9.5s → 15-30s. The old number was chosen when the life
  dropped from 14-22s to five, so the layer would keep the same *presence*.
  That was the wrong target: a tear on screen 70% of the time is wallpaper, not
  atmosphere.
- **Concurrency cap** 3 (2 under 640px) → 2 (1 under 640px), and the forced
  ceiling a dispersal may push to, 5 → 3. The cap and the interval are one
  decision: at a five-second life a cap of three is only reachable when tears
  arrive faster than they close, so leaving it would have let a chain put three
  up regardless.
- **Chains**, which were the easy one to miss. Roughly half of every tear begot
  another — a blink chained 6 times in 10 — so the interval was never the real
  rate. Blink 0.62 → 0.3, dispersal 0.14 → 0.06 (and 2-3 pieces → 2), reform
  0.3 → 0.16. Also one opening spawn on load instead of two: a page that arrives
  with two tears on it has announced the layer before anything has been read.

**Measured, not reasoned about**, because the chains make the interval a poor
predictor. Sampling an untouched home page, 150-180s per setting: before, one
every ~6.9s with the screen occupied over 70% of the time; after, **one every
15.0s at 25%**. Two or three still coexist briefly when a dispersal fires, which
is 6% of tears and is the one moment meant to look like more than one thing.

One thing to know before retuning: 13-26s and 15-30s measured the same arrival
rate to within noise, so the interval is the *least* sensitive of the three
levers. The cap and the chains did most of the work, which is exactly why
changing the interval alone would have looked like it had barely done anything.

---

**2026-09-05 (late) — The dimensional voids are rebuilt as tears: an opening generator, not a blob generator**
Feedback on the previous pass was that the effect read as "one blob grows →
splits into blobs → becomes a larger blob", and that what is wanted is a **hole
or tear in the UI** — an opening with a black depth behind it, not a black
shape on top of it. Explicitly ruled out: blobs, bubbles, blob splitting, smooth
organic portals, clusters of black blobs, generic particles. The layering
(interior behind the UI, edge and corruption in front) was called out as right
and is kept. This is a focused visual correction, not a rewrite of the effect.

**The root cause was geometric, so the fix is too.** The outline was a ring of
jittered radii pushed through a smooth spline. However hard the radii were
thrown around — four families, spikes, notches, cusps — a closed curve drawn
outward from a centre *is* a mass, so it could only grow by being scaled and
could only multiply into more masses. No amount of edge detail survives a scale
on a black silhouette.

The outline is now built from a **line of failure outward**: a jagged spine
(straight runs, sharp turns, the reasoning `growCrack` already records), with
the two lips walked along it. That gives an opening the things a blob
structurally cannot have — a direction, a length, two pointed ends, and a width
that is a hairline at one end and a gaping notch at the other. The four families
are `slit`, `rift`, `breach` and `fracture`; `blot`, `tear`, `splinter` and
`shatter` are gone.

**Growth moved out of the transform and into the geometry.** `growth()` returned
a scale running 0.02 → 1.45 over a life; `openness()` returns how far *open* the
tear is, and `buildCels` consumes it to decide how far the split has run along
the spine and how far the lips have parted. Two separate curves, because the
split runs ahead of the gape — which is why the first second is a long hairline
crack rather than a small round hole. Cels are therefore an ordered
**progression** (sealed hairline → widest → closed again) rather than
interchangeable poses, and the morph track reads the step off the clock instead
of picking one at random. The transform now moves 12% top to bottom and exists
only to keep something alive *between* swaps.

**What was added to make it an opening rather than a silhouette:**
- **A wall.** Outline and an inner edge in one path filled `evenodd`, so the
  crescent between them is the thickness of the punctured surface, lit down one
  side. Small, and it is the whole difference between a hole and a shape. Drawn
  on the *front* layer, because the blackout takes the composited backdrop to 6%
  and anything under it goes with it. First cut squeezed the inner edge to half
  width and the opening read violet instead of black; it is a thin rim now.
- **Flaps** — pieces of the page levered up out of the tear, hinged on real lip
  points, filled `--elevated` and outlined. Tapered outward, not splayed: a
  widened free edge read as a rectangle laid over the hole.
- **The blackout's clip is animated.** It used to be pinned to cel 0, which only
  worked because every cel was the same size. Cel 0 is a sealed hairline now, so
  a static clip would erase nothing for the whole life. It steps through the same
  progression — which is also what makes the *hole* widen rather than the black
  scale, since the region of interface being removed grows in the same shape at
  the same moment. This is why every cel has an identical command structure and
  why irregularity is expressed by moving points, never inserting them.
- **The ink bleed is gone** — the same drawing at 1.08 and half strength, which
  is a soft halo, which is the most reliable way to make a dark mass read as
  organic. Replaced by a hard un-blurred offset plate in the purple separation,
  which is the registration error `CLAUDE.md` names.
- **Fractures lengthen and multiply with the opening**, so the page visibly gets
  worse as the hole gets wider rather than being corrupted on a schedule beside
  it.

**Two archetypes were replaced, for the same reason.** `swarm` was several
pieces on independent radial drifts fanning out as they grew — that is "one blob
splitting into a cluster of blobs", named in the brief. It is now **`cascade`**:
three openings strung along a single line, each a sealed seam until the one
before it has torn. `rupture` threw fragments, which is the same thing smaller;
it now throws *the split itself*, one or two further openings along the same
axis, and its give is expressed as a **surge in openness** rather than an
overscale. `crawler` is `fissure`. `corruptor` and `blink` keep their names and
their characters.

**Budget.** Cels are now a progression *and* two jitter variants of each, so the
per-piece drawing count roughly tripled: measured at 2228 live paths and 195KB
of generated CSS at the five-void hard cap. Trimmed by dropping the fracture
fan-out from three siblings to two, the morph track from 72 stops to 56, and the
multi-piece scripts to seven steps. `qa/spots-check.mjs` then measured voids at
the same median *and* p95 frame time as the baseline on the same page.

---

**2026-09-05 — Threads brightened to three-pass neon; and the 4.5:1 rule is measurably broken**
Asked to make the multiverse lines and shapes thicker and more neon. **This
modifies `Threads.tsx`, which an earlier brief put off limits** — taken as
superseded by an explicit request to change this specific thing, the same way
the lightning was. Geometry, composition and placement are untouched; only
stroke weight and how it is lit changed.

`Neon` now runs three passes instead of two — wide soft bloom (7x, blur 8, 0.72
of bloom), tight saturated sheath (2.9x, blur 2.5), pale core — which is the
same build `AmbientLightning` was given, so a thread and a discharge are lit by
one set of rules rather than two. Widths: threads 0.95 → 1.6, structure front
1.35 → 2.1, back 0.9 → 1.35, edges 0.8 → 1.2. Layer and node opacities up about
a third.

**The important part of this entry is what measuring it revealed.**

`CLAUDE.md`: *"Every text/background pair must clear 4.5:1 against the
composited ground — the rift glows lighten the background, so measure, do not
assume."* Nothing had ever measured it. `qa/contrast-check.mjs` now does, by
hiding **only the glyphs**, screenshotting, and taking the worst pixel under
each string — the ground under a string is a gradient and the worst pixel is
rarely the one you would pick by eye. PNG is decoded from `node:zlib` rather
than adding a dependency.

**Result, measured before and after the change on the same pages:**

| | pairs under 4.5:1 | worst |
|---|---|---|
| before brightening | 8 | 1.01:1 |
| after brightening | 9 | 1.00:1 |

The failures are the header column — `Elevation`, the summary line, and the
terrain's axis labels — where a thread passes behind them. **They pre-date this
change.** The threads always crossed that text; they were dimmer, so it was less
bad. Brightening deepened an existing violation rather than creating one.

**Left unfixed, deliberately, and this is the part to revisit.** The request was
for brighter threads and that is delivered. Every fix is a design decision that
should not be made silently inside a "make it brighter" task:

1. **Dim the threads again** — undoes what was asked for.
2. **A dark halo behind small text** (`paint-order: stroke` or a text-shadow in
   `--bg`). On-theme, since an ink outline round type is comic language, but it
   changes typography, which is explicitly protected.
3. **A shade behind the reading column**, masking the thread layer where content
   sits. Works on desktop and is useless at 390px, where the column *is* the
   viewport — and 390px is where the failures are worst.

Option 2 is the only one that holds at every width. It needs a decision.

---

**2026-09-05 — The void is split across two depths: interior behind the UI, torn edge in front**
The voids read as objects placed over the page rather than holes in it. The
cause was structural: the whole void lived at `-z-10`, so a panel painted over
it and it could only ever read as *behind* a surface, never *through* one.
Putting the whole thing in front would have it hiding content for five seconds,
which is why it went behind originally.

**So it is split, and each half does the job it suits.**

- **Interior at `-z-10`** — the darkness through the opening. Cannot cover a
  control or a word.
- **Edge, fractures and pale linework at `z-30`** (`[data-sv-tear]`) — the torn
  lip of the surface, drawn as a *stroke* of the silhouette rather than a fill,
  so it is a band along the edge and the interior remains the other layer's
  business. Cracks moved here too: a fracture running across a panel is the
  connection to the surrounding UI the brief asked for.
- **A blackout clipped to the silhouette**, also at `z-30`. Without it the rim
  is an outline drawn *on* a panel — you see the interface carrying on inside
  the opening.

Both halves ride the *same* `animName` and `morphNames` the piece already
generates, never copies, so they cannot desynchronise under any future retune.

**`ONSET` is the important part, and it is about order rather than content.**
Every archetype now fires a burst at `t = 0.015`, before the void is visible,
at a fixed `ONSET_STRENGTH = 0.62` — the one burst whose strength is *not* read
off the growth curve, because at 5% scale that rule yields something too faint
to register and a tear does not start gently. Previously the first corruption
landed at 0.24-0.34, well after the shape had faded up, so the sequence read as
"a thing appeared, then effects happened near it". Cracking the surface first
inverts it.

**One blackout per void, not per piece.** Measured with one per piece, a swarm
put six live `backdrop-filter`s on screen and pinned the page to 33.4ms where
the same page without voids reached 16.7. Now `pieceIndex === 0` only — the same
anchor piece the bursts already use. It is also the right reading: a satellite
fragment does not punch its own hole through reality.

**On the frame numbers, honestly.** This environment (`--disable-gpu`, headless)
returns 16.7ms and 33.4ms for *identical* content across consecutive probes, so
it can rule out a large regression and nothing finer. The claim that survives:
measured back to back within one run, with bursts suppressed so only the
persistent layer was live, no-voids and with-voids were identical. The earlier
"six backdrops halves the frame rate" reading was reproducible enough across
runs to act on; the residual is not.

**The trade, recorded because it reverses a previous decision.** "The void can
never hide anything" no longer holds — the front half draws over the interface
and blacks out what is inside it. That *is* the effect: it is what separates a
tear from a decoration, and it was explicitly asked for. What still holds:
`pointer-events: none` (proven by hit-testing both layers, 0/154 at five
widths), `aria-hidden`, placement weighted away from the reading column, an
opacity that ramps with `presence(t)` so a young void barely dims anything, and
a five-second life.

**QA had to be extended, not just re-run.** The existing check hit-tested only
`[data-sv-spots]` — the layer *behind* the UI, where a pass proves nothing. It
now tests both, asserts the front layer's `pointer-events`/`aria-hidden`/
`overflow`, names it explicitly when a link is blocked, and requires it absent
under reduced motion. A first attempt to apply those edits asserted out
mid-script and left the file untouched, and the run that followed reported ALL
CLEAN from the *old* check — worth recording as a reminder that a green result
from an unmodified test file is not evidence of anything.

---

**2026-09-05 — A pale pen layer over the voids, regenerated per cel**
Asked for restrained white/off-white linework and a more hand-drawn comic
reading, explicitly as an addition rather than a rethink. Nothing about the
envelope, the archetypes, the corruption passes or the cadence moved.

**`var(--fg)`, not `#FFF`.** The theme's warm paper white, so the marks read as
part of the same ink system the rest of the app is drawn in. Opacities 0.2-0.5
and widths around 2% of the void's radius: black stays the mass throughout.

**The contour is the fill path, stroked and dashed.** Not a second generated
outline — the same `d` the black `<path>` already uses, with an irregular
`stroke-dasharray`. Costs no geometry and cannot drift out of register with the
shape it belongs to, which a separately-generated outline eventually would. A
second pass at 0.2 opacity is offset `translate(1.6 -1.2)` for the misprint.

**Everything pale is regenerated from the cel's own jitter stream.** The dash
pattern, which ticks are drawn, and where the crack highlights sit all change
with the boil. A pale layer that held still while the ink moved underneath would
read as a border on a wobbling shape; changing together is what reads as a hand
going over the same drawing again. Which ticks appear is a per-cel roll against
`spec.keep`, which is what makes them flicker in and out.

**Where the ticks sit is fixed, what gets drawn is not.** Rolled fresh per cel
they would scatter over the whole edge every frame and read as static; the
positions come from a `markSpec` decided once, the same way the silhouette's
spikes and notches are.

**Two tunings that mattered more than they sound:**
- The pen was first derived as a fraction of `crackWidth`, which put it near 6px
  on a large void — a dashed *border*, not a drawn line. It is now `penWidth`,
  its own number at `radius * 0.022`.
- The dash array was six values from one range, which is an even dash and
  therefore still a border. It now alternates short mark / long gap: what makes
  a contour look hand-drawn is mostly that most of it is missing.

**The tear bands stopped being rectangles.** `tornBand()` walks jittered points
across the top and back along the bottom. A perfect rectangle was the last
purely geometric shape in the effect and the one thing that gave the corruption
away as computed.

**A note for anyone tuning this further.** Black ink on a dark ground loses
contrast far faster than pale ink does, so during the faint phases — early
growth, a flicker, the collapse — the white is *relatively* more visible than at
full presence. That was checked and left as it is: at the widths and opacities
here it reads as a sketch mark surviving a moment longer than the fill, which is
the wanted effect. If the pen is ever thickened, that is the first place it will
go wrong, and the fix is to tie the pale layer's opacity to `presence(t)` rather
than to lower its base opacity.

---

**2026-09-05 — `AmbientLightning` rebuilt against a reference: short jags, four generations, four passes**
Asked to make the lightning match a reference frame — cyan Lichtenberg discharge
with a hot core and a heavy bloom. **This modifies the lightning system, which an
earlier brief in this session put off limits;** that scoping constraint is taken
as superseded by an explicit request to change this specific effect. Nothing else
about it moved: it is still ambient at 8-18s, still originates on a real border
and grows along its outward normal, still flickers in hard and fades out slowly.

Photographed side by side, the old figure read as a **bare tree branch**, for
three separable reasons:

- **Segment geometry.** A trunk of 4-7 jags at 46-72px is a straight line with a
  couple of kinks. Now 10-14 jags at 19-32px with `wander` 0.85 → 1.4: the same
  reach, an order more direction change. Fork angles widened from 26-80° to
  29-95° so branches can leave nearly perpendicular.
- **Branch depth.** Three generations gives a clean, *countable* tree. A fourth
  generation of 5-12px capillaries is the level at which the eye stops counting
  branches and reads electricity. Fork counts also rose at every level (gen1 3-5
  → 5-8, gen2 1-3 → 2-4).
- **The neon pair was not enough.** `CLAUDE.md`'s rule is a blurred colour halo
  under a near-white core, and that is right in principle but produced a thin
  filament with a faint glow: one pass can be wide *or* intense, not both. Four
  now — a wide soft bloom (7x, blur 9, 0.55), a tight saturated sheath (2.6x,
  blur 2.5, 0.95), the `#8FF3FF` core, and `#EAFEFF` heat at 0.42x on strokes
  over 1.6px wide. The white pass is deliberately restricted to heavy runs;
  painting it down the capillaries would flatten the taper the self-similarity
  depends on.

**Cost, measured rather than assumed.** The figure went from ~30 strokes to ~100,
and at four passes that is ~400 paths per strike. The wide bloom was then
filtered to strokes over 1.2px — a 0.8px hair grown sevenfold and blurred by nine
is invisible — which removed roughly a quarter of them. Frame timing with
strikes on screen then measured identical to the same page with none, at all five
widths, and 60fps at 768 and below (worth noting because it shows the headless
renderer is *not* uniformly capped at 30fps, which earlier readings had suggested).

No overflow at any width and no hit-test interference: the strike layer is
`overflowX: clip`, which the compacted figure makes less load-bearing than
before, not more.

---

**2026-09-05 — One five-second envelope; size is the clock and corruption is a function of it**
Asked for a single arc per void — seed small and subtle, grow, destabilise with
growth, peak with the strongest corruption, collapse — in roughly five seconds.

**The envelope is shared and the archetype is the character played over it.**
Previously each archetype owned its whole timeline (crawler 14-22s at full size,
blink 1.5-3s), so "how big is it" carried no information and a burst's strength
had no relationship to what the void was doing. `growth(t, peak)`,
`presence(t)` and `unrest(t)` are now the spine, and `envelopePoses` builds the
common track from a `Character` — peak scale, step count, wobble, spin, cut
chance, flicker, deform. Each script splices its signature events over that
(the rupture's tear, the corruptor's three recoils).

**Everything unstable is multiplied by `unrest(t)`**, which is 0 at the seed and
1 at the peak: positional wobble, rotation, skew, squash, hard-cut probability
and flicker. Instability rises with size by construction rather than by being
tuned to match. The silhouette swap rate rides the same curve — `restMs` was
reinterpreted from `[min, max]` to `[fast at peak, slow at seed]` and is
interpolated by `unrest`, so it accelerates from ~4fps to ~20 *as* the void
grows instead of switching at a window boundary.

**Growth accelerates rather than being linear.** A constant rate reads as a
shape being scaled by something outside it; an accelerating one reads as
something opening under its own pressure. There is a brief hold at full size
before the collapse, without which the largest frame is also the first frame of
the collapse and is never actually seen.

**Corruption strength and size come from one number.** `bursts` was
`{ at, strength }`; strength was computed from the *scheduled* time while the
region was drawn at the size taken from the *pose track*, which a spliced recoil
or a thrash can move a long way. `bursts` is now just `number[]`, and at fire
time `poseAt` gives the void's real scale, from which both the strength and the
drawn size are derived. Measured across a dozen bursts afterwards: 4 tear-bands
and no erasure at a third of full size, 7 bands and the erasure at full size.

*(Honesty note: the specific evidence that first prompted this — "erasure firing
on a 0.32-scale burst" — turned out to be a faulty detector in the measuring
script, which matched `brightness` and so counted the `invert(1) brightness(1.35)`
tear filter as the erasure. The two-sources-of-truth problem was real and the
fix stands on its own, but the number cited for it was wrong.)*

**The collapse needed three stops, not one.** Written as a single stop eased
with `EASE.collapse`, it measured 0.8 scale with 3% of the life left — the curve
is so back-loaded that the whole disappearance happened inside the final ~100ms
and read as the void being switched off. It now steps down over the last ~700ms,
keeping a hard cut on the final stop: a hole closing should *end* abruptly, it
just should not begin abruptly.

**Spawn cadence had to move with it, and this is a consequence rather than a
preference.** At a five-second life the old 9-20s interval leaves the page empty
roughly two thirds of the time, which reads as broken rather than restrained.
Now 4.2-9.5s, preserving the previous presence: usually one void, sometimes two
or three. `BURST_GAP_MS` went 2200 → 2600 because every void now bursts at least
once and the corruptor three times, so the rate arriving at that gate is several
times what it was.

**Blink lost its defining trait and needed a new one.** It was "gone before you
are sure you saw it", which a shared five-second envelope takes away. Its
character is now that it is the only archetype whose *unrest starts high* rather
than arriving with size — it stutters and drops frames while it is still small.

---

**2026-09-05 — Silhouettes get cusps and four families; the tendril becomes branching fractures**
A screenshot settled it: the void read as a smooth black potato with one
decorative curl. The behaviour work from the previous pass was fine — the
*drawing* was the problem, and it had one root cause.

**Catmull-Rom smooths every point it passes through.** With every vertex
smoothed, a closed loop with ±30% radius jitter is a potato, and no retuning of
the radii can change that: a torn hole is defined by cusps and notches, and the
generator could produce neither. `closedSpline` now takes a per-vertex `sharp`
flag and collapses the control point onto any vertex marked sharp, giving that
one a hard corner while its neighbours stay round. One outline can now carry a
smooth ink bulge and a splintered point at once.

**Four silhouette families** — `blot` (deep notches bitten out), `tear` (a thin
rip with a hard point at each end, `squash` down to 0.2), `splinter` (a cluster
of long spikes), `shatter` (12-16 alternating in/out points, most of them
angular). Drawn independently of the behaviour archetype, so a crawler can be a
jagged shatter and a corruptor a long tear — 4 shapes x 5 behaviours rather than
5 things.

**The tendril is gone.** `buildTendril` drew one smooth quadratic curve, which
is exactly what made the void read as a decorated shape. `buildCrack` replaces
it: straight `L` runs, forking twice, tapering hard to hairlines — the reasoning
`AmbientLightning` already records, that a fracture turns sharply and a curve
reads as a ribbon. **Deliberately not shared with the lightning**, which is off
limits this pass and wants different numbers anyway; if they are ever unified,
exporting `grow` and `forkPoints` is the move.

Bursts gained fractures whipping out across the interface plus ink chips. That
is the pass the eye tracks as *movement* — the warp bends what is there and the
shards colour it, but neither travels.

**Every void now bursts at least once.** Crawler was a 45% chance of one weak
burst, so the most common archetype usually drifted for twenty seconds doing
nothing; that was the biggest single contributor to "decorative". The global
2.2s gate is what keeps corruption occasional, not archetypes being silent.

**Two failures, both only visible in a picture:**
- **The first splinter was a symmetrical star.** An independent per-vertex spike
  probability distributes spikes evenly around the ring. They are now chosen as
  a small clustered index set, so one side gets three points and the other none.
- **The first burst fractures were a dead shrub.** `growCrack`'s `length` is the
  first *jag*, not the branch's reach — each jag is 0.7 of the last, so a branch
  runs ~2.5x the value passed, before forks. Passing a figure scaled as a total
  gave 600px branches 11px thick over a 273px burst.

**Fracture count is scaled to piece radius** (1 under 26px, 3 over 46px). It
reads right — a 20px fragment with three branches longer than itself is a bug —
and it bounds the path count, which an uncapped swarm would have pushed past 700
stroke elements.

**Measured, not assumed:** 416 paths across three voids costs nothing detectable
— and the readings that looked like a regression were the headless rasteriser
fluctuating, since three consecutive *baseline* probes on the same page swung
33ms/50ms/50ms while the with-voids probes held steady at 33.4ms. A single
measurement against a single baseline would have produced a confident wrong
conclusion in either direction.

**A QA note:** `holdBurst`'s timeout went from 14s to 50s. Bursts cannot be
forced — spawning caps at three live voids, a crawler holds a slot for up to 22
seconds, and the 2.2s gate drops any burst landing too close to the last — so
the check was intermittently failing on a working effect.

---

**2026-09-05 — The voids corrupt the backdrop; behaviour is archetypes, and each instance writes its own keyframes**
The first pass was directionally right and too static — dark shapes drifting,
every one behaving identically. Two structural changes, not a retune.

**1. Each piece generates its own `@keyframes` at spawn**, injected into a single
`<style>` and removed with the void. The old version shared five global
keyframes and varied durations and offsets, which is *why* every void behaved
the same: a slow creep and a hard positional cut cannot come out of one shared
curve at different speeds. CSS allows `animation-timing-function` **inside a
keyframe stop**, so one generated track holds eased drift, `steps(1,end)` snaps
and a frantic passage in sequence — several time scales in one animation, still
compositor-only, still nothing ticking per frame. The silhouette boil is
authored the same way instead of looped: ~6fps at rest, ~18 while failing.
Verified in QA that every animated element runs a distinct track (72/72 unique).

**2. Five hand-written archetypes** — crawler, rupture, swarm, corruptor, blink —
each with its own piece count, life length, pose script and burst schedule.
Randomising one script's numbers gives variations on one behaviour; these are
five behaviours. Weighted so the quiet one is commonest and the loudest rarest.

**3. Corruption is `backdrop-filter` on the real pixels.** A void at `-z-10`
physically cannot corrupt text painted above it, so a burst is a second,
transient layer at `z-30` — where `AmbientLightning` and `AmbientGlitch` already
live. The void layer itself stays behind all UI as required. Passes: an
`feTurbulence`→`feDisplacementMap` warp (the only thing in CSS that can move
already-rendered pixels), channel separation in `ChromaticDefs`' language but
defined separately so that shared file is not retuned, tear slices, an outright
erasure, and shards imported from `GlitchShatter` rather than reinvented.

**Restraint:** one burst per 2.2s globally however many voids want one; only the
corruptor and rupture fire strong ones; measured at 3.5% of viewport; 200-520ms.

**Three bugs that all read as correct code and were only found by photographing
the effect. Worth recording because each produced a confidently passing check:**

- **`VoidFilters` was rendered inside the burst block**, so the `<filter>` defs
  entered the document in the same commit as the elements referencing them by
  `url(#...)`. Measured mid-run, `#sv-void-warp` did not exist at all — every
  burst drew its shards and erasure with *no displacement whatsoever*, and the
  check still reported "10 backdrop-filtered layers". The defs now mount with
  the voids, which exist for seconds before any burst.
- **The clip path was in the piece's box units (up to 370) while the burst
  element was clamped to 310px.** `path()` has no transform of its own, so the
  silhouette was oversized and offset and the warp was masked to a region that
  no longer matched the hole. The region is now exactly `piece.box`; reach is
  set by the warp's own scale instead.
- **The warp was clipped to the void's own outline** — and the void is opaque
  black sitting directly behind it, so it was faithfully warping black into
  black. It now scales to 2.6× so it bites the *neighbourhood*, keeping the
  anomaly's outline as the mask shape.

Two more found the same way: the shard cluster at `buildShards`' own scale
reached 30% of the region and read as broken glass thrown over the panel, so it
was cut to accents; and the erasure at 62% of the event covered the displacement
underneath it for almost the whole burst, so it is now the shortest pass — gone,
then back but wrong, then right.

**A QA lesson worth keeping.** Freezing a transient needs the *animation* paused
and seeked, not just its removal timer dropped: the first held-burst screenshot
showed a completely clean page because the animation had run to its `opacity: 0`
end state while the element sat there. And the uniqueness check read the
`animation` shorthand's first token — Chrome serialises the name **last**, so it
was comparing durations and reporting three "unique tracks" that were three
lifetimes.

**Left as it is:** the corruption layer draws above the content. That is not a
loosening of "keep the layer behind the UI" — the voids still are. It is the
only position from which something painted in front of a void can be corrupted
at all, and it is `pointer-events: none`, `aria-hidden`, mutates nothing, and
was verified not to take a single hit out of 154 sampled points while a real
link stayed clickable underneath it.

---

**2026-09-05 — Dimensional voids are a background-occlusion effect, not a particle layer**
Asked to borrow The Spot's dimensional-patch animation language — explicitly the
behaviour of the holes, not the character, and with no Spider-Man imagery of any
kind. `components/spiderverse/DimensionalSpots.tsx`, mounted once in the layout.

**The whole design rests on where it is mounted, not on how the shapes are
drawn.** It goes immediately *after* `DimensionalThreads`, at the same `-z-10`
depth, so a void paints over the rift glows and the neon structures and under
every piece of UI. That occlusion is what makes it a hole: the fill is flat
`#000` against a `#0a0a0f` ground, so over bare background a void is a
barely-perceptible darkening and it only becomes unmistakable where there was
something lit for it to swallow. Draw the same shapes *over* the interface, or
on a layer with nothing behind it, and they are black circles floating on a page
— which is the failure the brief named.

A consequence worth writing down, because it means this can never be a
legibility risk: every text colour in this theme is light on dark, and a void is
pure black, so it can only ever *raise* contrast for anything in front of it.
Combined with `pointer-events: none` and sitting behind all content, there is no
arrangement in which it hides or blocks anything. 154 hit-tests per page per
width confirm the layer is never what is under the cursor.

**Restraint is in the cadence, not in the opacity.** Two live voids on mobile
and three on desktop, 11-24s apart, drifting under 50px across a 15-25s life —
slower than the glows behind them. The constant motion is only the edge boil and
a slow squash-stretch; a uniform pulse was rejected as reading like a heartbeat.
The hard positional cut is the one sharp event and about one void in six gets
one. `--sv-cyan`/`--sv-magenta` appear only as a 0.1-opacity 1px rim on about
half of them, which is integration with the existing palette rather than a new
colour, and there is no glow or blur anywhere in the file.

**The boil is three cels, and that is a deliberate rejection of the smoother
option.** An SVG `<filter>` with turbulence would give a rougher edge and would
be a per-pixel pass over a moving element forever, on a layer the size of the
viewport — `CLAUDE.md` already warns about filters over large subtrees. Instead
each void builds three complete drawings of itself and hard-cuts between them at
about 7fps, which is what hand-drawn animation does and why it reads as ink.
Same reasoning as `GlitchText`'s discrete frames: a library cannot help with a
thing defined by *not* interpolating. No dependency was added.

**Not added to `effectClock`.** That clock exists to stop two *flashes* landing
in one loud moment. A void lives twenty seconds and is ambient presence rather
than an event, so there is no pile-up to prevent, and a third kind would mean
rewriting the clock's two-way `other` lookup for nothing.

**Absent under reduced motion, not frozen.** The atmosphere layers hold their
neutral pose because they are scenery; a transient's neutral pose is a permanent
black smear parked over the interface, which is the same conclusion
`AmbientLightning` and `AmbientGlitch` both reached.

**Two faults that only screenshots would have caught, recorded because both
looked correct in the code:**
- Sizing chose the SVG box and let the blob be whatever fitted inside it. But
  `VIEW_SCALE` reserves room for tendrils and bleed, so a "170px void" drew 87px
  of hole and the layer read as specks. The diameter of the *ink* is the number
  worth choosing; the box is derived from it.
- Placement biased x and y away from centre independently. At 62% per axis that
  puts both at an extreme 38% of the time, so voids pile into the four corners
  rather than spreading along the edges — three stacked in the bottom-right of
  the very first screenshot. Now one randomly chosen axis is pushed out and the
  other left free. Independent per-axis bias is not the same as edge bias, and
  the difference is invisible until you look.

**Verified:** 1560/1280/390/320 on home and track, with the maximum number of
voids forced. No horizontal overflow (the layer is `fixed` + `overflow: hidden`,
so a void can hang off the frame without ever creating a scroll container —
`AmbientLightning` had to solve this the harder way because a strike must stay
free to run off the top). Saved as `qa/spots-check.mjs` rather than left in the
scratchpad: it was written twice, having been lost with a session in between,
and that is the fourth browser check this project has lost that way.

---

**2026-09-05 — The terrain window is 14 days, and it is no longer the heatmap's window too**
`TERRAIN_DAYS` was 84 and did two jobs: it set the elevation graph's span, and
`windowStart()` in `lib/progress.ts` built the row filter from it for *both* the
terrain and `countsByDay` — the series the consistency heatmap renders.
`StreakHeatmap` meanwhile carried its own unrelated `const WEEKS = 12` and drew
84 cells regardless. So the two were coupled in the data layer and independent in
the view, which is the worst of both: shortening the graph would have left the
heatmap drawing a full twelve-week grid with ten weeks of it blank, and nothing
in either file would have looked wrong.

Both spans now live in **`lib/windows.ts`**, named after the question they
answer, and `windowStart(days)` takes the span rather than assuming one. The
heatmap reads `HEATMAP_WEEKS` from the same file `lib/progress.ts` reads
`HEATMAP_DAYS` from, so the grid and the filter behind it are one number.

**14 days, not 21.** The request was "around 15, ideally whole weeks". Against
the activity actually in the database (25 rows spanning 2026-08-29 to 09-04), 21
days leaves ~62% of the frame as empty run-up before the first data point and 14
leaves ~36%. Two weeks also says itself cleanly in a caption. Lengthen it when
there is history to fill it — that is a judgement about the data, and it is one
line.

Every caption that names a span is now derived: `TERRAIN_SPAN` / `HEATMAP_SPAN`
via `spanLabel()`, which says whole weeks in weeks and anything else in days. The
"12 weeks" strings in `TerrainProfile`, both Consistency sublabels,
`describeTerrain` and the heatmap's aria summary were all hand-typed and had to
be found by grep — deriving them is what stops that recurring.

`getLeafHistory`'s `days` parameter defaulted to `TERRAIN_DAYS` and is now
required. It had the same fault in miniature: shortening the graph would have
quietly shortened the per-topic history strip too. Its one caller already passed
28 explicitly.

**Left open, deliberately, and flagged rather than fixed:** `terrain.peak` is
the total *inside the window*, and it is what the home page's headline
"Elevation" numeral and the track page's `TrackStat` both render. `CLAUDE.md`
says elevation "only rises". At 84 days that was quietly untrue and effectively
unobservable; at 14 days it becomes visible — with the current data, elevation
will drop from 52 to about 49 in roughly five days as 2026-08-29 ages out. This
is a change in what a headline figure *means*, not a rescale of a drawing, so it
was out of scope for a request to rescale the graph. The fix, if wanted, is to
compute elevation as an all-time cumulative total and let the graph plot only its
window — which needs a baseline offset in `buildTerrain`, because the curve would
no longer start from zero.

"Check-ins over 12 weeks" on the home page became "activities over 2 weeks" in
the same pass. `check-in` was the once-daily Task tick and Tasks are gone; the
figure is a count of `TopicActivity`, which is per node per day and uncapped.

**Verified:** home and track at 1560 / 1280 / 390 / 320 — no horizontal overflow
at any width, caption "2 weeks" at all four. The decoupling was tested rather
than reasoned about: a 35-day-old row planted in a scratch *copy* of `dev.db`
appeared in the heatmap (7 active days to 8) and did not appear in the terrain
(52 over two weeks, unchanged). Run against an isolated copy of the tree on
:3488 with its own database, because the user's own server held :3000 — per
`qa/README.md`, and per the handoff's warning about killing it.

---

**2026-09-05 — The terrain reserves a right gutter; the data insets, the ground does not**
`bleed-r` runs the profile to the window's right edge, and the newest point is
today — so `cx={W - 5}` put today's marker roughly 7px from the screen edge, with
the steepest and most recent part of the curve crushed against it.

`RIGHT_GUTTER = 48` (6.7% of the 720-unit box) now backs the plot off. The
important part is *what* it insets: `PLOT_W` drives the ridge, the area fill, the
milestone contours and dots, and today's marker — but **not** the baseline or the
strata, which still span the full width. The ground continuing past today is the
honest reading of a time axis that ends at now, and it keeps `bleed-r` doing the
job it was added for instead of being undone.

Measured after: 60 / 51 / 23 / 19px of clearance at 1560 / 1280 / 390 / 320.

**A testing failure worth recording, because it produced a confident wrong
answer.** A 320px overflow on the tree view was investigated by a script that
took the track id from the wrong argv slot, so the browser measured
`/tracks/x?view=tree` — a 404 page — and reported no overflow across 120 frames.
The clean result was from a page that does not exist. The same argv slip has now
happened four times in this project's QA scripts; the fix is to have the script
assert the page it landed on before measuring it, not to be more careful.

The overflow is real and remains open: `TopicTree`'s per-node control row is
`shrink-0`, and at 320px with five levels of indentation it pushes 4px past the
viewport. Out of scope for the graph fix; recorded rather than silently patched.

---

**2026-09-05 — Neon is a colour pair, not a brightness**
The structures were stroked in one faint cyan and read as muted teal outlines.
Raising the opacity alone would have made them brighter lines, not lit ones.

They now use the pairing `AmbientLightning` already uses: a wide blurred halo in
`--sv-cyan` under a thin `#8FF3FF` filament. The saturated halo around a
near-white core is what the eye reads as a tube with light inside it; a
single-colour outline at any opacity stays a line. No colour entered the palette
— `#8FF3FF` is the same value the discharge core has used all along, and the
halo takes the token from the caller's text colour.

Depth survived the brightening because the near/far split was raised
proportionally rather than flattened: front faces strongest, back faces and
connecting edges weaker. Panel-corner structures stay the most restrained of the
set — they are inside the reading area, so they take the same treatment at a
fraction of the strength.

---

**2026-09-05 — The unit is a structure, and the composition is placed by hand**
The lattice pass was rejected as "many random polygon shapes". It was: a
space-filling field of small cells on a jittered grid. Two things changed.

**The unit is now a wireframe solid, not a cell.** Near face, a smaller far face
displaced to one side, edges joining corresponding corners. The far face is
scaled *as well as* displaced — displacing alone gives two stacked outlines,
while converging edges are what the eye reads as perspective. Vertex jitter is
±15% of the radius: enough that it is not a regular hexagon, restrained enough
that it still reads as a considered shape rather than the blob heavy jitter
produces.

**The composition is a hand-written list of five positions, not a generator.**
This is the actual correction. A seeded scatter produces an even distribution
however carefully it is tuned — "a few dominant structures with smaller ones
around them" is a composition, which is a decision, and no amount of density
tuning turns a distribution into one. Solids sit outside 22-78% horizontally,
where a centred `max-w-5xl` column lives; threads cross that band and the panels
occlude them anyway.

**Threads terminate at structure centres and are painted first**, so each one
disappears under the solid it arrives at. Ending a thread at a vertex would need
the structure's on-screen geometry at layout time and would look like a graph
edge touching a node — the exact reading being avoided. Several runs have an
endpoint outside 0-100 so they leave the frame; a thread that stops at the edge
reads as a line that ended.

**Neon is two strokes, never a filter.** A wide blurred faint pass plus a thin
bright core, the same construction `AmbientLightning` uses. A `<filter>` over a
full-viewport group is a per-pixel pass over the whole screen for a static
drawing, and `CLAUDE.md` already warns about filters applied over large subtrees.

**Stroke widths under `vectorEffect="non-scaling-stroke"` are screen pixels, not
viewBox units.** The threads shipped invisible on the first render because 0.16
was written for a 0-100 box and rendered as a sixth of a pixel. Worth
remembering: the failure looks like a deliberate composition, not like a bug.

---

**2026-09-05 — Webs replaced by a thread lattice; `SpiderWeb.tsx` deleted**
The orb webs are gone everywhere — viewport, panel corners, section rules and the
empty state — replaced by `components/spiderverse/Threads.tsx`. The old file was
deleted rather than left beside the new one, per "remove the old spiderweb visual
entirely"; the four consumers (`layout`, `Panel`, `page`, `TopNav`) changed by an
import line and a tag name each, nothing else.

**Every stroke is a straight segment, and that is the rule to hold.** A web is a
hub, radials and sagging rings; the Spider-Society lattice is straight struts
meeting at vertices around irregular cells. There is deliberately not one
quadratic command left in the file, and adding a curve would start walking the
drawing back toward what it replaced. Verified against the rendered HTML: zero
`Q` commands in the page.

**What keeps it from reading as a network graph** — the likeliest failure mode,
since "nodes joined by edges" is what this geometry becomes if under-specified:
cells enclose area (a graph does not), neighbours differ 2-3x in scale, each cell
carries its own opacity so depth is lit as well as sized, cells overlap so their
edges cross into one interlocked structure, cells are randomly skipped so the
seeding grid never surfaces, and long spans cross each field edge to edge to say
the structure continues past the frame.

**Struts join vertex to vertex, never centre to centre.** Joining centres draws
lines *through* the cells and produces exactly the spoked hub the webs had.

**Placement is the readability mechanism, not opacity.** The two main fields are
tall bands in the left and right margins — the only ground a centred column
reliably leaves free — and each is density-biased toward the screen edge so it
thins as it approaches the content rather than stopping at a hard line that would
show its own boundary. On a narrow viewport there is no free margin, so the bands
narrow to 72px and the corner clusters drop out entirely.

**This reverses part of the previous pass, deliberately.** That one pushed the
webs off-frame so they cropped; this brief asks for threads kept within the
viewport. A lattice reaching the edges is not the same thing as a large structure
chopped in half — cells cut by the frame are cells that carry on, which is what
the reference does.

Panel clusters are 92px, not the 120 first tried: at 120 the top and bottom
clusters visibly crossed a track row on a narrow viewport, which is the "dense
clusters obscuring content" the brief rules out.

---

**2026-09-04 — The viewport webs are cropped, three not four, plus edge strands**
Reported as feeling like "decorative corner stickers", which was fair: four
complete quarter-discs, one per corner, each ending neatly inside the frame.

Three changes, and the first two matter more than they sound:

- **Cropped.** Each web is now larger than its corner and pushed outward past
  it, so the frame cuts the hub and inner rings away and only the outer sweep
  arcs in. A web that terminates inside the viewport is an object placed on the
  page; one that runs off it is part of a space that continues.
- **Three, not four.** Dropping one is what stops the arrangement resolving into
  a border motif, however differently each is seeded — and it is the cheapest
  way to reduce what sits behind the interface. Bottom-left is bare because the
  content column runs longest down the left.
- **Edge strands.** `WebStrands` draws a few sagging anchor lines running in
  from an edge with sparse cross-links. Real webs are built from bridge lines
  before any spiral, and they are what makes the space read as webbed rather
  than as cornered. Links are deliberately sparse: a full ladder becomes a net,
  and a net in the background is the busyness this pass was reducing.

Two constraints that shaped the implementation:

- **Rotation is small — 6 to 12 degrees — and turns about the hub.** The web is a
  quarter-disc anchored in a right angle; a large rotation swings it off the
  corner it is attached to and bares the very angle it should fill, because
  cropping hides the near edge and not the far one. `transform-origin` is set to
  the anchored corner so it pivots where it is attached.
- **Outward shift is a fraction of the element's own size, not pixels.** These
  are resized in CSS for narrow viewports, and a fixed pixel offset does not
  follow — the same crop has to hold at every size, which a percentage
  translation gives for free and a second set of hand-written numbers would not.

Scope held deliberately: `WebFrame` (panel corners), `WebDivider` (section
rules) and `WebLoader` are untouched. The divider webs do hang into content and
are arguably the busiest webbing on the page, but reserving less height for them
changes layout, which was explicitly out of scope.

---

**2026-09-04 — Every horizontal line in the terrain lives inside the ground**
Reported as "the yellow lines look really out of place", and they did. The
milestone contours ran `x1=0 → x2=W` unclipped at 0.75 opacity in full `--streak`
yellow. On a bleeding profile that is the entire viewport, so two hard yellow
rules crossed the whole page, out past the reading column, over a chart that is
mostly empty at seven days of data.

Dimming them was the obvious fix and the wrong one. The real defect was that they
broke a convention the rest of the drawing already keeps: the strata are clipped
to the landform, and the milestone contour was the only horizontal line allowed
to float in empty sky. It is now clipped to the same path, and additionally stops
at the crossing point — past which it states nothing, since elevation rises
monotonically and the ground is above that level from then on.

Because clipping removes the cause, the line can stay legible (0.55) rather than
being faded into apology. `CLAUDE.md`'s rule is unchanged and still holds:
milestones are drawn only where actually crossed, in `streak` yellow. This makes
that more literally true than it was.

---

**2026-09-04 — One model for branch and leaf; no Task table**
A Topic with live children is a parent; one with none is a leaf and is the unit
of activity. Leaf-ness is **derived, never stored** — that is what lets a leaf
gain children, stop being actionable, and become actionable again later with its
own history still attached, without a migration or a `kind` column.

The old `Task`, `TaskCheckIn` and `CompletionLog` tables were dropped outright.
The brief said there was no meaningful data to preserve and asked for a reset
rather than a compatibility layer, and the reset was consented to explicitly
(Prisma's CLI refuses `migrate reset` without it).

**2026-09-04 — No rollup table; every figure derives from TopicActivity**
`CompletionLog` was a per-track daily rollup that had to be rebuilt whenever
anything was deleted or moved — `recomputeDays`, `affectedDays` and the whole of
`lib/completion.ts` existed to keep derived state honest. Deriving on read
instead means a move or a soft delete changes what the figures *mean* without a
single row being rewritten to keep up. `Track.currentStreak` / `longestStreak` /
`lastActivityDate` went for the same reason plus a stronger one: a strict streak
lapses through inactivity, which writes nothing, so a cached streak has no code
path that could ever expire it.

For one local user the whole history is a few hundred rows, so the read cost of
deriving is not a consideration.

**2026-09-04 — A count per node-day, not a row per click**
Undo has to decrement the same number the intensity tiers read, and the product
question is "how much was this worked today". At zero the row is **deleted**
rather than left at 0: presence means activity, and a zero row would be
indistinguishable from a worked day in every query that reads presence — the
streak most of all.

`increment` is correct here, unlike the old check-in, which was a set-membership
question and had to be recomputed to stay idempotent. A click *is* an increment;
re-running it is meant to add another.

**2026-09-04 — Depth is denormalised, and rewritten across a moved subtree**
Every insert and move checks depth, and walking to the root each time would make
the commonest write the most expensive. The cost is that a stale value silently
permits a six-level tree, since every later check reads it — so the move rewrites
the whole subtree's depths inside the same transaction as the move itself.

The move check is `parent.depth + subtreeHeight(node)`, not the moved node alone.
Checking only the node would happily push its grandchildren past the limit; the
test suite asserts exactly that case.

**2026-09-04 — Three coverage measures, never conflated**
- Leaf intensity is its own count.
- Parent coverage is distinct *direct* children worked, so hammering one child
  does not move it — coverage is breadth, and touching one corner repeatedly is
  not breadth. A child that is itself a parent counts as worked when anything
  beneath it was.
- Track coverage is computed across all leaves at once, **not** as an average of
  the top-level topics' coverage. Averaging would weight a topic holding two
  leaves the same as one holding twenty.

**2026-09-04 — The flat view lists leaves, not top-level topics with children**
The brief said to keep the flat view as default and adapt it "from Tasks to
Topics". The literal adaptation — topics listed, each expanding to its children —
is the old two-level shape and cannot express five levels: a leaf four deep has
nowhere to appear. So the flat view is every actionable leaf in tree order, each
carrying its ancestry as a breadcrumb. It works at any depth and answers the
question the app is actually opened for: what can I work on right now.

Reordering is offered only in the tree view. Flat rows are leaves gathered from
all over the tree, so two adjacent rows are usually not siblings and "move up"
would mean nothing there. The order set in the tree is what the flat list sorts
by, so the two views never disagree.

**2026-09-04 — Green enters the palette, for exactly one signal**
`CLAUDE.md` said the palette has no green and that reaching for one reintroduces
the retired motif system. The brief asked for green as the activity colour and
scoped it — everything else keeps its meaning. Taken as intended and applied
narrowly: `--activity-1..5` are green and nothing else is; cyan still means done,
magenta volume, yellow consistency. `CLAUDE.md` was updated rather than left
contradicting the code.

The ramp is solved, not picked. Every tier clears 4.5:1 against whichever of
paper or ink sits on it — by at least 6.4:1 — and `--activity-N-fg` carries which,
so no component decides. The heatmap deliberately stays on the yellow/magenta
consistency ramp: consistency is a different signal and `CLAUDE.md`'s rule for it
is unchanged.

**2026-09-04 — The check-in beat was removed, not rewired**
`CheckInBeat` and `CheckInReport` composed the tick, the report line and one
emphasised numeral into a single moment, and published from the task row. With
tasks gone nothing could fire them, and a provider that cannot fire is worse than
none. The streak-milestone celebration went with them: `milestoneCrossed` and its
test suite are intact and nothing calls them. If it returns it belongs on the
first activity of a day.

**2026-09-04 — Prisma writes DateTime as TEXT; the seed wrote INTEGER**
Recorded because it cost real time and would have shipped silently. SQLite has no
date type and orders values by **type class before value**, so every INTEGER sorts
below every TEXT. The seed wrote `getTime()` milliseconds; Prisma binds an ISO
string. Rows read back through Prisma perfectly and matched *nothing* on any
`date: { gte: ... }` filter.

Only one place in the app filters dates in the database rather than in
JavaScript — the per-leaf history — so everything else looked correct and that one
panel showed an empty state that read like a legitimate "no data yet".
`prisma/seed.mjs` now asserts both the type and that a range filter matches every
row it just wrote, and fails the seed rather than let it regress.

---

**2026-09-04 — The task form is disclosed, and stays open after a successful add**
`NewTaskForm` now renders a trigger until pressed. The state is local to that
component, so `TopicRow` is unchanged.

Two sub-decisions worth pinning:

- **It does not collapse after an add.** The component already cleared and
  refocused so several tasks could be entered in a row, and that is the one
  repeated action on this screen; auto-closing would charge a press per task.
  Escape and an explicit Cancel are the ways out.
- **It autofocuses on open**, which the sibling create forms deliberately do
  *not* do on mount. The rule those follow is "do not steal focus on arrival";
  nothing opens this one but a deliberate press, so the objection does not
  apply and not focusing would just cost a click.

The *topic* create form on the same page was left open, because only the task
form was in scope. It is now the only always-open empty field on the screen,
which is worth revisiting if the disclosed pattern is kept.

**2026-09-04 — Never kill Next by process-name pattern; check the port**
Recorded because it caused real disruption. Three times this session a
`next dev` was treated as a stale orphan and killed by matching
`[n]ode_modules/.bin/next`, and `.next` was cleared under it. It was the user's
own server on **:3000** — the session's own servers were on 3477/3488 — and the
"orphan" kept reappearing because they kept restarting it.

`qa/README.md` warns that a plain `pgrep -f next` matches the shell running it.
The bigger hazard is the one it did not state: the pattern also matches a server
somebody else is using. Resolve the port first
(`ss -lptnH "sport = :<port>"`), kill by that pid, and never `rm -rf .next`
without knowing that nothing else is serving from it.

Where a change has to be verified while another server holds the project's
`.next`, copy the working tree to the scratch directory, symlink `node_modules`,
and run there on its own port. That is how this change was tested.

---

**2026-09-04 — Input placeholders removed; `aria-label` was always the name**
The three `placeholder` hints are gone (`InlineCreateForm` for tracks and
topics, `NewTaskForm` for tasks), and the `placeholder` prop was deleted from
`InlineCreateForm` rather than left accepting an unused string. The dead
`placeholder:text-muted` utility went with them.

No accessibility cost: every one of these inputs already carried an `aria-label`
and that is still their accessible name. A placeholder is not a label and these
were never doing that job.

Separately worth recording, because it was live for a while: the task hint read
`e.g. Solve: Two Sum`, which is verbatim the example `CLAUDE.md` gives for what
a Task must **never** be — the file's opening section contrasts "Practice array
problems" against exactly that string. The empty-state prose and the `.sv-status`
readouts were left alone; only the typed-field hints were in scope.

**2026-09-04 — The glitch is now the longer of the two ambient effects**
Second enlargement and second extension, both requested. `PAD_X` went 30/0.5/130
to 45/0.7/180 and `PAD_Y` 24/1.2/90 to 36/1.7/120; the split moved from half the
cap height (capped 18) to two thirds (capped 24); `hold` went from 900-1900ms to
1900-2900ms, so an event runs 2.38-3.63s. Measured 2.77-3.18s.

The duration relationship with `AmbientLightning` has now fully inverted. The
original brief made this effect ~600ms *because* a strike is 1.5-2.5s and the
two were meant to read as different species; it is now the longer of the pair.
Recorded rather than argued: it was asked for twice, in two separate steps, and
the second step was taken with the first one's consequence already stated.

Worth knowing for the next change: `hold` is the only number a longer event
needs. Shard cycles, channel-jitter iterations and flare spread are all derived
from it, so none of them has to be touched again.

---

**2026-09-04 — The glitch holds for 1-2s, and gives up the duration tell**
Requested directly. `hold` is now 900-1900ms and the fade 350-600ms, so an event
runs 1.38-2.63s against the previous 510-780ms.

This knowingly spends the thing the original 600ms bought. The brief set that
number so the glitch and a lightning strike could not be mistaken for one
another — "two distinct animation species, not similar-length twins" — and at
1.4-2.6s against a strike's 1.5-2.5s they are exactly that. They still separate
on everything else, and the shared clock still keeps their onsets at least a
second apart, but with both running ~2s the two can now be on screen together,
which the stagger was originally sized to prevent. Widening `COLLISION_MS` from
1000 to ~2500 would restore full separation if that turns out to matter; it was
left alone rather than changed unasked.

**2026-09-04 — A longer hold had to be an active hold, not a freeze**
Stretching the timings alone would have left a static image pasted over a word
for two seconds. The original structure was "in, sit still, out", which reads as
one snap at 600ms and as a sticker at 2000ms. Three layers therefore changed:

- **Channel copies** loop `sv-glitch-jitter` through the hold, wandering around
  the offset the ramp settled on. Each channel has its own period — 190/230/270,
  pairwise coprime — for the same reason the background's rift glows drift on
  37/43/29s: harmonic periods visibly re-align, and a predictable glitch is a
  loop playing rather than something going wrong.
- **Shards** cycle `sv-shard` for as many iterations as the hold allows instead
  of playing once. Per-shard durations already vary, so the cluster shimmers
  rather than strobing in unison.
- **Flares** are spread along the hold instead of bunched into its first 260ms,
  and there are more of them (4-8) to cover the longer span.

The shards' exit is a second animation, `sv-shard-out`, declaring opacity only.
A cycle ending is not the event ending, so the fade has to be able to land
part-way through one; because a CSS animation affects nothing it does not name,
`sv-shard` keeps driving transform underneath and the pieces are still moving as
they dim.

**2026-09-04 — Measurement probes must wait for an idle frame**
Both spawners fire on their own every 8-20s, so any probe watching for
`.sv-glitch-pass` or `svg.sv-strike` can measure an ambient event instead of the
one it forced. This produced a negative event duration and two phantom stagger
failures before it was spotted; the stagger is 5/5 once the probe waits for
idle. Noted in `qa/README.md` because it will happen again.

---

**2026-09-04 — The glitch's geometry is derived from the target, in four places**
Reported as "too small to notice", and it was: the field was the glyph bounds
plus a flat 6px, so a 27x16 section label produced a 39x28 event.

The fix was not one number. Four separate quantities had each been tuned against
one example and were wrong on any other size — the field padding, the channel
split, the shard travel, and the flare size. All four now derive from the target
(padding from its extent with a floor, split and travel from its cap height,
flares from the cluster box). Ratios and floors are in `PAD_X` / `PAD_Y`,
`SHARD_INSET` and the `split` expression.

**2026-09-04 — The cluster and the spread are two different boxes**
Enlarging the field alone made it worse, twice over, and both regressions are
worth recording because either would come back on the next tuning pass:

- Shard reach is a *percentage* of the box, so growing the box grew the shards
  with it and the cluster reverted to three flat slabs — the exact thing the
  0.58 scale had been introduced to fix, undone by a change at the other end.
- Shards are laid one per grid cell across whatever box they are given, so
  handing them the enlarged field scattered them over empty margin and the
  result read as confetti around a word.

So the effect now works at two extents. The channel copies and flares take the
full field, because that spread is what makes the event visible from across the
page; the shards are inset back onto the glyphs plus a halo. The halftone wash
moved inside the cluster too — across the full field it had a hard rectangular
edge sitting in empty margin, which was the only straight line anywhere in the
effect and read as a box drawn around it.

**2026-09-04 — Cyan is weighted twice in the glitch's shard plates**
Magenta and red are adjacent, so an even draw across magenta / cyan / red /
white put two thirds of a cluster in the same warm register. Invisible at the
original size, obvious once clusters got large enough to have real area. Cyan
carries the separation, so it gets a second slot. This is a weighting inside the
existing four plates, not a new colour.

---

**2026-09-04 — `AmbientGlitch` is a third effect, not a variant of the shatter**
The brief asked for a random screen glitch "following the same behavioral
pattern as VenomLightning" and explicitly distinct from `GlitchShatter`. Built
that way: a separate component with its own spawner, mounted in the layout.
`GlitchShatter` is untouched and still fires deterministically on check-in and
track creation.

The two do share geometry. `buildShards` is exported from `GlitchShatter` and
imported here, with two parameters added (`plates`, `scale`) so neither caller
is stuck with the other's tuning. The brief asked for the reuse and it was the
right call anyway — two shard generators would have drifted the first time
either was tuned.

**2026-09-04 — The glitch's third channel is magenta, not green**
The reference frame and the brief both describe red / cyan / **green** channel
copies. `CLAUDE.md` states the palette has no green and that reaching for one
reintroduces the retired motif system, and the brief's own shard-colour section
already accepts that constraint. So the split is red / cyan / magenta — three
distinct prints, still heavier than `GlitchText`'s two-plate 2-7px split, at
5-10px. Flagged to the user rather than decided silently; reversing it is one
entry in `CHANNELS`.

**2026-09-04 — A target is measured by its text, not its box**
The first version measured `getBoundingClientRect()` on the candidate element
and rejected anything wider than 620px to avoid full-page targets. In this
layout every block-level heading and section label spans the whole reading
column, so all of them were rejected and the spawner ended up with a single
eligible element per page — which it then glitched every single time, while
looking entirely functional.

Targets are now measured with a `Range` over their contents, which gives the
tight glyph extent. That fixed the selection bug and is also more faithful to
the reference: the film fractures the character, not the rectangle around him.

**2026-09-04 — The registry excludes controls, containers and bright grounds**
Three filters, each added after watching the effect do something wrong:
- **Controls**, checked in both directions. `.font-label` is the interface's
  label voice and therefore also sits on every button, so the primary CTAs were
  swept in; and `closest()` alone let a `<label>` wrapping its own slider
  through, which got fractured with the control live underneath.
- **Containers.** `.font-label` on the nav `<ul>` made the effect treat
  "HomeProgressInsightssoon" as one label. The rule is "two or more text-bearing
  children makes it a row"; requiring text as a *direct* child was tried first
  and wrongly rejected single labels that wrap their string in one span.
- **Bright grounds**, measured up the ancestor chain. Every layer composites
  with `screen`, so over the yellow CTA the whole event saturated to a white
  smear. The threshold is 0.45 luminance: the magenta caption plate (0.34) stays
  a target because panel captions are the headline case, cyan and yellow (0.7+)
  never are.

Also: `GlitchText` roots return their string tripled from `textContent`, because
its two duplicate layers are `aria-hidden` rather than absent. Text is read with
those and `.sr-only` stripped.

**2026-09-04 — The two ambient spawners stagger, and the lightning needed a fix
to do it**
Neither effect is suppressed and they are not synced; a shared module records
when each last fired, and either postpones itself 300-600ms if the other went
off within a second.

Wiring this up exposed a real bug in `AmbientLightning`. Its concurrency cap
lived inside the `setStrikes` updater, so a flag set in there to report "a
strike was accepted" was still false when the dispatch returned — React batches
the updater. The glitch spawner was reading "no lightning fired" from a tick
that had just fired one, and the two staggered apart on only two runs in five.
The cap now lives in a ref and is decided synchronously: five runs in five.

---

**2026-09-04 — The lightning is ambient, and correlates with nothing**
It first shipped wired to the ADD press and to elevation rising. Both triggers
are removed and the component is now a single spawner mounted in the layout,
firing every 8-18 seconds on its own.

The trigger version failed twice over. It was reported as invisible, and it was:
the elevation bolt rode the beat's one-stat rule, which meant it only fired when
a check-in did *not* move the streak — a person checking one task off once a day
would never have seen it. And on the create flow the shatter landed on the same
strip of form and erased the 2.6px line under solid plates. Rather than keep
tuning weight and stagger against those collisions, the effect was reclassified:
it is weather, not feedback. Anything reporting a state change has to be
reliable, and this never could be.

**2026-09-04 — A strike starts on a border and grows away from it**
Origins are sampled along real element edges — panel borders, the masthead rule,
the page column — recomputed per strike rather than cached, since panels come
and go with the data and a stale rect hangs a discharge in empty space. The
trunk leaves along that edge's outward normal with a little angular slop, which
is what makes it read as breaking *off* the interface instead of floating over
it. Only edges currently on screen are offered.

**2026-09-04 — Three generations, because two is a bolt with forks**
A Lichtenberg figure is self-similar: the same forking logic repeats at every
scale. Trunk, branches off its vertices, and branches off *those*, with the
same 0.6 length / 0.55 width falloff per jag at each level, which tapers the
extremities to capillary threads. Measured on a real strike: 44 segments split
4 trunk / 21 gen-1 / 19 gen-2, widths running 2.60 down to 0.35.

**2026-09-04 — Struck instantly, dissipating slowly**
The entry keeps the hard-cut technique — paired keyframe stops so the browser
cannot interpolate, ~90ms — while the exit is a *smoothly eased* 0.4-0.7s ramp
after a 1.0-1.8s hold. The asymmetry is the character. It is two animations
rather than one, because the hold is randomised per strike and a single keyframe
scaled to the total would stretch the flicker along with it.

**2026-09-04 — The two new effects were built without Framer Motion**
The brief specified Framer Motion for "orchestrating trigger timing". Both
effects are a counter prop, one `setTimeout` and one CSS keyframe — that is the
whole orchestration — so adding a runtime animation dependency would have bought
nothing and would have contradicted the standing CSS-and-SVG-only rule that
`GlitchText` was already written to. Flagged rather than assumed; revisit if
something needs interruptible or sequenced timelines.

Related: the brief asked for shards including green. The palette has no green —
it was retired with the motif system — so the mismatch is built from the plates
the theme owns (magenta, cyan, yellow, red, purple) plus one pure white.

**2026-09-04 — `GlitchText` was already a shatter, and was left alone**
The brief asked to correct it "if it was built as pure chromatic aberration". It
was not: alongside the RGB split it renders clip-path torn bands at higher
intensities. The conditional did not apply, so it is unchanged — and the two
devices now coexist deliberately, `GlitchText` for resting text accents and
`GlitchShatter` for the instant something changes.

**2026-09-04 — Effects never fire on a negative change**
No shatter on an undo, no bolt when elevation falls. The report line already
goes muted for a withdrawal and the beat refuses to tint a fall; an effect that
celebrated those would be reporting the opposite of what happened. The elevation
bolt also rides the beat's existing one-stat rule rather than adding its own, so
a check-in that moved the streak lights the streak and leaves the bolt out —
otherwise a single tap would set off the tick, the report, the shatter, the
misregistration and a bolt at once.

**2026-09-04 — Transients render nothing under reduced motion**
Not "frozen at a neutral pose", which is the rule for the ambient layers. A bolt
or a shatter held at its start state is a permanent scribble over the interface;
the atmosphere is a place and should persist, a discharge is an event and should
not. The state change is still fully reported by the report line and the numbers.

**2026-09-04 — Every delete absorbs a repeat**
`deleteTrack` used `prisma.track.delete`, which raises P2025 when the row has
already gone — so a double click on the confirm button produced a real 500 for
what the user experiences as one successful deletion. It now uses `deleteMany`.

This is not a new idea, it is the one place that had been missed: `deleteTopic`
and `deleteTask` already absorb a repeat through their `findUnique` guard, and
`setCheckIn` is documented as idempotent in both directions. A write that a
double click can break is a write that is wrong for a single-user app where a
double click costs nothing to make.

**2026-09-04 — Emphasis is contrast, never weight**
The app has one font weight and `font-synthesis-weight: none`, so a
`font-semibold` span renders identically to the words around it — not weaker,
identical. The delete confirmations used exactly that to mark the name of the
thing being destroyed, which meant an irreversible action named its target with
no emphasis whatsoever.

Emphasis is now the surrounding sentence in `muted` with the name left at `fg`.
Measured 2.19:1 between the two, which reads clearly without introducing a
colour or borrowing one of the three progress signals. Recorded in `CLAUDE.md`
too, because the failure mode is invisible in review: the class is right there
in the markup and does nothing.

**2026-09-04 — Validation errors use `sv-red`, and the field shows it**
Error text was `muted`, the same colour as ordinary metadata, and `aria-invalid`
was announced with no visual counterpart at all — the field kept its resting
border. Errors are now `sv-red`, which is already this theme's danger colour on
the Delete buttons, and the invalid field takes a red border through an
`aria-invalid:` variant so the ARIA state and the paint cannot drift apart.

Measured 4.68:1 against the panel surface it actually sits on. Worth noting the
method: computed against the `bg` token it would have looked like 5.0:1, but the
form sits on `surface`, which is lighter. Sample the composited ground.

**2026-09-04 — Milestones are streak days, and are derived, never stored**
Streak milestones are 7, 14, 30, 60 and 100 consecutive days, and a crossing is
computed from the `before`/`after` streak pair `describeCheckIn` already
produces: the highest milestone in the half-open interval `(before, after]`.

Storing an "already celebrated" flag was considered and rejected. It would have
been the only piece of remembered UI state in the codebase, and a schema change
for something the numbers already answer — a streak that passed 7 yesterday
arrives today as 7 → 8, and `(7, 8]` contains no milestone, so yesterday's
crossing cannot replay. Every non-advancing write (same-day recheck, undo, an
undo that left other check-ins standing) returns null through the single
`after <= before` guard rather than through a clause of its own.

The accepted cost: undo-then-recheck re-crosses the same milestone, because the
undo genuinely lowered the streak and the recheck genuinely restored it. This is
the same call already recorded for "extending a streak" on 2026-09-03, and it
inflates nothing — there is no counter to farm and the streak is the same length
either way.

**2026-09-04 — Streak milestones and elevation milestones are different signals**
Two lists, deliberately named apart: `STREAK_MILESTONES` in `lib/streak.ts`
counts consecutive days and is yellow, `ELEVATION_MILESTONES` in
`lib/terrain.ts` counts cumulative check-ins and is magenta on the terrain. Both
were previously reachable as `MILESTONES`, which is exactly how a later session
would have conflated the volume and consistency signals that `CLAUDE.md`
requires be kept apart. Neither is called `MILESTONES` any more.

**2026-09-04 — The celebration is the existing report line, louder**
No modal, no toast, no confetti, no badge and no new component: the same one
line, on the same row, at the same moment, swapping its hairline-and-tint for a
solid `streak` caption box — the treatment the comic panel header and the
primary button already use. The streak numeral runs the misregistration it
already runs, with twice the travel, frames and duration. A milestone can only
ever land on the streak numeral, because crossing requires the streak to have
moved and that is exactly what makes `signalFor` choose it.

The dwell is 5600ms against the ordinary 3800, for the same reason the ordinary
figure is 3800: the line is longer to read. Under reduced motion the box, the
colour and the words all remain and only the glitch stops — verified, along with
the accessibility tree announcing the sentence once rather than three times.

**2026-09-04 — The summary window is a URL parameter, not component state**
`/progress` reads weeks; `/progress?period=month` reads months. Chosen over a
client-side toggle so the page stays a server component — no client bundle, no
hydration, nothing to keep in sync — and so a window is bookmarkable and
survives a reload. Anything that is not exactly `month` falls back to weeks, so
a hand-edited URL cannot produce a broken page.

Weeks look back 8 periods and months 6. Both are roughly "as far back as is
still worth comparing against"; eight months of rows would push the list past
the fold on a view whose whole point is a quick read.

**2026-09-04 — Months are calendar months, and never "30 days"**
`monthBuckets` walks real calendar months. Stepping back a fixed 30 days drifts
further off the first of the month with each step, and within six buckets the
labels no longer name the months they contain. The month helper also always
constructs day 1 rather than carrying the day over, because "one month after 31
January" resolves to 2 or 3 March through ordinary date arithmetic — building
from the first has nowhere to overflow to. Covered by a test including leap-year
February and the year boundary.

**2026-09-04 — A track's streak is not scoped to the summary window**
In the per-track breakdown the completions are the window's, but the streak is
the track's current streak, full stop. A streak is a property of the track right
now, not of the period being looked at; truncating it at the first of the month
would report a 40-day streak as six, which is worse than useless — it is wrong
in the direction that discourages.

**2026-09-04 — Symmetry is allowed in the Tracks panel, and nowhere else**
The four corner webs inside the comic panel are drawn to one regular recipe and
are exact mirrors. That is deliberate: there it is a frame motif and matching is
the point. Every other web in the app — the page corners, the dividers — is its
own shape from its own seed. The two rules exist together on purpose and neither
should be generalised to the other.

**2026-09-04 — Corner webs put the hub *in* the corner**
Both earlier attempts inset the hub and fanned the threads back toward the
corner, which draws a wedge that closes to a point and reads as a triangle. It
also put the web's outer edge outside its own square, so the viewBox clipped the
rings away and left only long radials. Hub in the corner, radius equal to the
box: it always fits, and the concentric rings — not the radials — are what make
it read as a web.

**2026-09-04 — Web decoration does not reserve layout space**
The web hanging from a divider is drawn outside its element's box. Reserving its
full drop cost 88px of page height per divider, twice over on the home page. The
rule is the section break and carries the meaning; the web is decoration and
must not push the page apart. It is kept out of the left third of a rule, since
it overhangs whatever follows and the home page's next section starts with text
on the left.

**2026-09-03 — The check-in speaks once, and emphasises one measurement**

How the composed check-in moment is built. Recorded because the obvious
alternative — letting each signal animate when its own number changes — is what
this replaces, and it would be easy to drift back into.

**The problem.** One check-in changes five things on a track page: the tick, the
topic tally, the elevation, the streak and the ring. Each used to redraw when
its own value happened to change, so one act produced five reactions and read as
five unrelated events. Animating all of them harder would only have made that
worse.

**The shape, in three moments.**

1. **Confirm** — the tick flips optimistically and its magenta/cyan plates
   scissor apart, unchanged from before. Instant, local, no server.
2. **State** — when the server answers, one line appears beside the row that was
   clicked, naming what the check-in did and quoting the real numbers. The pause
   between 1 and 2 is deliberate: it is what makes the rest read as *caused by*
   the tick instead of as a second thing that also happened.
3. **Emphasise** — the single measurement that line is about misregisters
   briefly, and its colour flickers. Everything else simply arrives at its new
   value.

**The emphasis colour is chosen against the resting colour, not the signal.**
The first cut tinted the numeral toward its own signal — yellow for the streak,
magenta for the elevation — which is a no-op whenever a numeral already rests in
that colour. Measured: during an `extended` beat the streak numeral's computed
colour came back byte-identical to its resting one, so the more meaningful of
the two outcomes was riding on a 3px shift while elevation got a full
paper-to-magenta swing. The same collision hit a streak falling to zero, where
muted-onto-muted was equally invisible. So a numeral that already rests on a
plate colour swaps to paper instead of to itself; both directions read as the
plates momentarily disagreeing, and no colour enters the palette to make it
work — paper is already what the neighbouring stats rest in, and the numeral
returns to yellow, so `streak` keeps its meaning.

**Exactly one stat is emphasised, and a rule picks it.** The streak is the
headline when it moved; otherwise the volume is. So `started`, `extended` and an
undo that broke the day point at Streak; `recorded` and an undo that left other
check-ins standing point at Elevation. Derived from `before`/`after` rather than
a table per outcome. A check-in genuinely moves elevation *and* streak together,
so flashing both would put the moment straight back into the two-reactions state
this exists to fix.

**A personal best does not light a second number.** It is said in the same
sentence as the outcome ("streak 4 days · longest yet") rather than given its own
celebration, which is the line between reinforcement and a reward system.
`Longest` never flashes.

**`CheckInBeat` is a client context, and it carries no data.** The numbers still
come from the server on the revalidated render; the channel only says *which*
measurement the act was about, plus a sequence number. That number is also what
keeps a single statement on screen: a row shows its line only while its act is
still the live one, so checking in several tasks quickly leaves one statement
rather than a stack.

**Direction is read from the signal, not from the streak.** A `recorded`
check-in leaves the streak where it was — that is what makes it `recorded` —
while still raising the elevation. Reading the streak delta to decide "rose or
fell" painted a genuine rise in volume as a fall. Caught in the browser pass, and
the reason `TrackStat` branches on the signal.

**The ring advances instead of redrawing.** `ProgressRing` was keyed on its
percentage and replayed a 1.1s draw from empty on every check-in — the one
animation on the page that re-performed itself rather than settling. It now
animates from the length it was already showing (620ms on a change, the original
1.1s sweep still on first mount). Same fact, told as a consequence.

**Nothing new is stored and no semantics changed.** No schema change, no
duplicate state, strict streaks untouched. Reduced motion cancels all three
moments; the words, the tick's colour and `aria-pressed` carry everything, and
the report sits in an always-mounted `role="status"` region so it is announced
rather than missed as a freshly inserted one.

**Verification.** 33 browser assertions against a seeded scratch database over
all four outcomes, personal best and its absence, repeat clicks, reduced motion,
1440 / 1280x720 / 390 / 320 with no horizontal overflow, and no console output.

---

**2026-09-03 — "Extending a streak" is a before/after comparison, nothing else**

Settled by the user, and it unblocks the rest of Phase 2's "check-in moment".

**The definition:** a check-in extended the streak **if and only if the track's
recomputed `currentStreak` is higher after the write than before it.** There is
no second clause and nothing is remembered between calls.

It is deliberately a comparison rather than a rule with exceptions. Any rule
phrased as "…unless they already checked in today" needs stored state saying
whether they had, and this codebase keeps no such state anywhere else. Two
`StreakSummary` values need nothing remembered, which is what keeps a
double-click, a retry and two tabs racing all describing the same write the
same way — the same reason the engine recomputes instead of incrementing.

The three cases that were actually in question, and how the comparison answers
them without a special case:

- **Day one counts as an extension** (0 → 1). Structurally the streak moved.
  It is only *named* apart — `started`, so the copy can say "streak started"
  rather than "extended to 1". Calling it merely recorded would give the first
  check-in ever, and the first one after a lapse, the flattest feedback in the
  app at exactly the moment the loop most needs to reward.
- **A second check-in on a day already banked is `recorded`, not extended**
  (N → N). The streak is a per-track *daily* fact. That check-in still raised
  elevation: volume and consistency are separate signals in `CLAUDE.md`, and
  this is the case that separates them.
- **Undo then re-check on the same day reports as an extension again.** The
  undo genuinely deleted the day's rollup row and lowered the streak; the
  re-check genuinely restored it, so this is a faithful account of the write.
  Nothing inflates — there is no counter to farm. If the repeat ever reads as
  cheap, damp it in the client for the session and leave the server honest.
  Doing it on the server would mean storing an "already celebrated today"
  signal, which is the same unstored signal the roadmap already flags as the
  blocker for milestone celebration. That decision stays where it is.

**`before` is read from `CompletionLog`, never from `Track.currentStreak`.**
The cached columns are only refreshed by a write, so after a lapse they still
hold the pre-lapse streak — reading the cache as "before" would compare a stale
5 against a fresh 1 and report a genuine restart as a *fall*. `readStreak` was
split out of `writeStreak` for this, and is called inside the same transaction
and against the same `now` as the recompute that follows.

**The return shape is a named outcome, not a boolean.** An undo that removes a
track's last check-in of the day *lowers* the streak, and a `didExtend: boolean`
cannot say so. `setCheckIn` now returns `{ kind, before, after, personalBest }`
with `kind` one of `started | extended | recorded | withdrawn`. Four names,
because the numbers carry the rest: `withdrawn` covers both undos — the one
that broke today and the one that left other check-ins standing — and `before`
/ `after` already say which happened. `personalBest` is `longest` rising, which
is a fact the schema already holds and costs nothing to report.

**No schema change.** `recomputeToday` already returned this value and
`setCheckIn` discarded it; the only new query is one `findMany` of dates for
the "before".

**Verification.** 10 assertions over the pure semantics — first check-in ever,
extending a live streak, a second check-in on the same day, restart after a
lapse (the case that fails if `before` comes from the cache), undo as the day's
last check-in, undo with others standing, undo→re-check, an idempotent repeat
click, extending without beating the record, and a streak alive from yesterday.
All passing; build clean and unchanged at 111 kB.

---

**2026-09-01 — CompletionLog is a derived rollup, never frozen history**

Settled by the user, and it is the rule the deletion paths turn on. A day's
`CompletionLog` count is always whatever the surviving `TaskCheckIn` rows for
that day say it is. Orphaned check-in history is never preserved.

Deleting a task removes its check-ins by cascade, so **every day it appeared on
is now wrong — not just today**. Same for a topic, one level up. Both paths
therefore:

1. collect the affected dates **before** the delete, because the cascade
   destroys the evidence and they cannot be found afterwards;
2. delete;
3. rebuild each of those days from what survives, via `recomputeDays`.

Today is always included in that set, so deleting a task that was never checked
in still refreshes the current day rather than silently doing nothing.

A day whose only activity was the deleted task loses its row entirely, and the
streak recomputes to match. That is the intended consequence of treating the
log as derived: a streak can shorten if you delete the work that earned it.

**What changed in the engine.** `recomputeToday` now counts today's check-ins
instead of tasks whose `completedAt` falls today; everything else about it —
the single transaction, recompute-never-increment, no zero rows, the streak
rebuild — is untouched. `recomputeDays` is the new generalisation for deletes,
and `affectedDays` is the pre-delete query. `setTaskCompletion` is replaced by
`setCheckIn`, which upserts or deletes today's row; the unique constraint on
`(taskId, date)` absorbs a repeat click rather than throwing.

**Unchanged, deliberately:** `lib/streak.ts`, `lib/terrain.ts`, `lib/rollup.ts`,
the heatmap and the weekly summary. They count active days and are indifferent
to whether the same activity recurs. Verified, not assumed.

**Migration.** `TaskCheckIn` added, `Task.status` / `Task.completedAt` dropped,
with a backfill turning each completed task into one check-in on its local
completion day. The backfill was tested against a copy of the database seeded
with a deliberate edge case — a task completed at 00:30 IST, which is the
previous day in UTC — and it filed correctly under the local day. Naive UTC
truncation would have put it on the wrong date.

**Verification.** 26 engine assertions and 9 UI assertions, all passing: the
same task across four separate days, yesterday not reading as checked today,
five repeat check-ins changing nothing, undo removing only today, history
surviving churn, both delete paths recomputing shared days downward and
removing days that lost their only activity, and streak/terrain/rollup
agreement including a gap correctly failing to extend a streak.

**Two test bugs worth recording**, because both would recur. The first run had
6 failures and every one was in the test, not the engine: a fixture from an
earlier section left a check-in on a shared day and inflated the expected
counts, and `weekBuckets(1)` covers one Monday-to-Sunday week while the fixture
spanned a boundary, so a third of the data sat in the previous bucket. Isolate
fixtures per assertion, and never assume three consecutive days share a week.

**2026-09-01 — Tasks are recurring only; the daily check-in is the core loop**

Settled by the user. A Task is a persistent recurring learning activity —
"Practice array problems", "Read about binary trees" — available indefinitely
and checked in **once per day**. It is never permanently completed. The daily
check-in creates the historical record.

**There is no one-time task type and no `kind` discriminator.** Recurring is
the only model. This was considered and explicitly rejected: supporting both
would double every read path for a case the product does not have.

**What was actually shipped instead, and why it is wrong.** `Task.status` +
`Task.completedAt` model a terminal state a recurring activity never reaches.
Verified against the running engine rather than inferred:

- Tapping an already-checked task **records nothing**. The idempotency guard in
  `setTaskCompletion` short-circuits, so `completedAt` stays on the old day and
  `recomputeToday` — which counts tasks whose `completedAt` falls in today —
  counts zero.
- Uncheck-then-recheck *does* work: it produced `Aug 31=1, Sep 01=1, streak=2`.
  So the aggregate machinery already supports multi-day activity. The
  interaction and the per-task state do not.
- `completedAt` is overwritten on each new check-in, so a Task cannot say it
  was done Monday *and* Tuesday.
- `CompletionLog` has no `taskId`, so "which days did I practice Arrays?" is
  unanswerable.
- The ratio `completedCount / taskCount` reads **100% permanently** once each
  task has been done once — a learning track that is complete forever.

**The split is uneven, and that is the good news.** The aggregate half of the
completion engine is correct and is kept unchanged: the `CompletionLog` rollup,
the streak rebuild, the single write path, recompute-never-increment, frozen
history. Only what it counts changes. Terrain, heatmap, streaks and the weekly
rollup need no modification at all.

**Schema.** `TaskCheckIn { id, taskId, date, createdAt }` with
`@@unique([taskId, date])`. The row's existence is the state; there is no
status field to toggle. `Task.status` and `Task.completedAt` are removed.
`CompletionLog` keeps its shape and is recomputed from check-ins instead of
from `completedAt`. Full specification in `docs/SCHEMA.md`.

**Open decision, blocking.** `TaskCheckIn` cascades from `Task`, so deleting a
Task erases its history and every `CompletionLog` day it contributed to becomes
wrong — not just today's. Either recompute the affected days from the surviving
check-ins, or keep those rows and accept that history is frozen and no longer
reconstructible. The two answers need different code and the choice must be
made before the engine is written.

**The ratio changes meaning, everywhere.** "N of M done" becomes "N of M
checked in today" — starting at zero each morning. This touches the home page,
the track page, `TopicRow` and the `ProgressRing` currently labelled
"Completion — live task state".

**Not gamification.** The check-in loop's reward is the streak, the rising
ground and the day recorded. XP, levels, points, badges and streak freezes stay
forbidden; the loop is not a licence to reopen them.

**2026-09-01 — The reading column is dimmed in the shader, not on the canvas**

The page had a visible rectangle down the middle, exactly the width of the
64rem container: the background and the interface read as two different
surfaces with a seam between them. Two things were drawing it, both aligned to
the same line — the energy field's own horizontal vignette, and the CSS mask on
the canvas, which fell to 6.5% over a 70px ramp.

**A CSS mask cannot tell a bright object from the background.** That is the
whole problem. Everything the column needed protecting from was a handful of
bright things; masking the canvas dimmed the environment along with them, and
the only way to make it dim enough was to make the seam obvious.

So the fade moved into the shaders, where it can apply per object:

- `COLUMN_FADE_GLSL` in `hardLight.ts` is shared by constructs, the ring, its
  trail, both pulse rings and the motes. It takes screen position from
  `gl_FragCoord`, so it is a screen-space effect on a 3D object.
- The energy field has no horizontal falloff at all any more. It is one level
  across the width, which is what makes the ground read as a single surface.
- The canvas mask stays, at 0.82 in the middle — a 1.2:1 ratio, imperceptible.

Measured: edge-to-centre luminance ratio fell from **5.29x to 1.64x**, and the
reading column holds **5.58:1** against the 4.5 floor.

**Three traps, all of which cost a round trip:**

1. `gl_FragCoord` is in **device** pixels; R3F's `size` is in CSS pixels.
   Passing the CSS width put the fade in the wrong place at any device pixel
   ratio above 1. Use `gl.domElement.width`.
2. The fade must be **complete at the container edge**, not centred on it.
   Centred, a construct still ran at ~85% strength exactly where the first line
   of text begins.
3. Fading to a small floor is not enough for additive blending. A construct is
   many overlapping faces deep and each one adds, so a 7% floor still summed to
   a bright green. Constructs, ring and pulse fade to **zero**; only the motes
   keep a floor (0.22), because they are single flat sprites and the middle
   would be dead without them.

**And the thing that was actually brightest was the motes**, not the
constructs. 3200 additive sprites spanning the full width, unfaded, held the
column at 2.9:1 through three rounds of tuning everything else. Worth
remembering: the loudest object is not always the one you are looking at.

**Separately, the field plane was too small.** At 86 units wide it stopped
short of the frame on a 2:1 monitor — the visible width at that depth is about
90 units — and the strip beyond it showed the CSS ground through the canvas as
a lighter band down the edge. Now 150 units.

**2026-09-01 — The ruled grid is removed, from every motif and every route**

It read as a lattice laid over the page rather than as the ground under it, and
at full-window widths it dominated. Removed outright: `.atmosphere::before`,
the `--grid-line` token, the emerald re-tint added earlier the same day for
`willpower`, and the `terrace` rule that hid it by zeroing the pseudo-element.

This reverses a standing rule. CLAUDE.md listed "a faint ruled grid over the
page ground" under *Depth and pattern — required, this is what stops it looking
basic*, and `globals.css` called it "the survey sheet the terrain is drawn on".
Both are now updated; the earlier entries below stand as the record of what was
true at the time.

Tinting it emerald on `willpower` had already been tried a few hours earlier
and was the wrong fix — it made the grid belong to that one motif while leaving
it wrong everywhere else, and it did nothing about the real complaint, which
was that the pattern was too present rather than the wrong colour.

Depth now comes from the atmosphere alone: the layered grounds, the hairline
rule system, the terrain's own light, and on `willpower` the 3D scene. Do not
reintroduce it — the same standing rule as the retired ambient blobs.

Contrast improves as a side effect, since the grid was the lightest thing
sitting over the page ground on every route.

**2026-09-01 — `willpower` rebuilt in three.js; the no-dependency decision reversed**

The flat SVG/CSS version was judged too static — correctly. Two things were
wrong with it, and only one was a calibration problem.

The calibration problem: constructs ran on prime-length cycles of 71–181s with
long dormancy, so the scene was genuinely empty roughly four fifths of the
time. A screenshot taken at random showed a dark green grid and nothing else,
which is exactly what it was most of the time.

The real problem: CSS keyframes cannot produce depth, parallax, or an
environment that is continuously alive without either becoming a scheduler or
becoming noise. The earlier argument for staying dependency-free — that the
contrast floor keeps the layer too dim for 3D fidelity to register — held for
*fidelity* and was wrong about *life*. What the layer needed was motion and
depth, and those survive being dim.

**Added:** `three@0.185.1`, `@react-three/fiber@9.7.0`, `@types/three@0.185.0`,
all pinned exactly. Not drei, not postprocessing, not gsap — the scene needs a
camera, meshes and a render loop, and everything else is hand-written. Cost:
about 1.2MB of JavaScript uncompressed, loaded only on a willpower day. That is
roughly eleven times the rest of the app, and it is the honest price.

**Removed:** `components/WillpowerField.tsx`, `lib/constructs.ts`, and ~600
lines of generated keyframes from `globals.css`. Keeping both would have meant
two systems drifting apart. The CSS ground stays: it is server-rendered, so the
day has its colour before any JavaScript runs and there is no black flash while
the canvas mounts.

**Architecture.** `lib/atmosphere/` holds geometry and quality tiers,
`components/atmosphere/` holds the scene. All six constructs are built from
primitives and merged into one BufferGeometry each — one draw call, one
material, no model file, no texture, and so no licence question.

- The hard-light material is a fresnel rim plus scrolling object-space noise,
  additively blended with depth writing off so a construct's own back faces
  show through it. That translucency is what separates hard light from green
  plastic; the first pass had none and looked like a wireframe.
- Formation and dissolution are one mechanism run in opposite directions: a
  threshold sweeping the object's Y axis, with a hot band at the boundary
  forming and noise eating inward dissolving.
- **React renders the tree once.** Every animation is inside `useFrame`,
  mutating objects directly. The application above cannot be re-rendered by the
  background.

**Traps worth recording**

- `mergeGeometries` returns null on a mixed set: three's primitives are
  indexed, `ExtrudeGeometry` and `RoundedBoxGeometry` are not. Flatten with
  `toNonIndexed()` first. This crashed the whole page.
- An action written as an increment compounds. `scale.multiplyScalar(1.035)`
  runs every frame, so a 3% pulse became an object filling the screen within a
  second. Actions must be absolute offsets from a stored resting transform.
- Placement must be worked out from the camera frustum at the object's own
  depth. "Outside the reading column" is a screen-space idea, and a fixed world
  x that clears the text at one window size sits on top of it at another.

**Measured.** Worst composited ground in the reading column against `--muted`,
with the ring forced to fire every 0.8s so the worst case is actually hit, and
sampled at three window widths because the answer depends on the width:
**5.08:1 at 1918px, 5.13:1 at 1440px, 5.18:1 at 1280px**, against the 4.5
floor, 0 of 30 samples below it at each.

**The margin's share of the frame grows with the window, and that broke both
placement and contrast.** The container is a fixed 64rem, so the page margin is
29% of half-width at 1440px but 47% at 1918px. Anything expressed as a fixed
fraction of the frustum is therefore calibrated for exactly one window: tuned
at 1440px, constructs sat wholly off-screen at 1918px. Placement and size are
now derived from the real gutter in CSS pixels, and constructs are scaled to
the margin they have to fit inside rather than to the window — at 1280px the
margin is only 128px, and a construct sized for a 1920px margin simply spills
across the text.

**The ground is green-black, not blue-black.** `--willpower-ground` is a real
tint now rather than a 2% wash, and the ruled grid is tinted emerald on this
motif instead of staying the purple survey grid. The page ground was otherwise
reading as neutral dark with a purple lattice on it — the background and the
interface looked like two different surfaces. This is a hue shift at low
luminance, not a brightness increase, which is what makes it affordable: a
dark emerald and a dark blue-black differ by a factor of two in luminance and
both sit far under the budget. The first attempt overshot anyway (0.24 alpha
put the column at 3.55:1); the budget it spent was taken back from the
constructs, which no longer dip into the reading column at all.
Reduced motion renders one frame and is byte-identical 3 seconds later. No
horizontal overflow at 390/768/1440 on either route. Switching motif away
destroys the canvas and switching back recreates it, with no console errors.

Liveliness, which was the actual complaint: over 60 seconds of continuous
observation, **0 of 40 frames were identical to the one before**, and every
sample after the first ~7 seconds of load had constructs on screen.

**Not measured: real frame rate.** This environment has no GPU, so everything
renders through swiftshader and the numbers (14–18fps at 1440×900, 60fps at
390×844) describe software fill rate, not the laptop. They scale with pixel
count exactly as software rasterisation would. Real performance is unverified.

**The contrast fight, recorded because it cost the most time.** The canvas mask
is the only reliable guard. Placement alone cannot promise a screen-space
result, because the camera drifts and the ring crosses the frame. Three
attempts failed before it held: ramping the mask from 110px before the gutter
to 90px after dimmed the constructs to invisibility *and* still measured
1.00:1; finishing the ramp 17px inside the gutter put the worst pixel exactly
on the container edge at 3.59:1; confining constructs to the margin passed at
5.11:1 but left the scene nearly empty, because at 1440px the margin is 208px
and a construct is over half of that. What works: the ramp completes exactly at
the container edge, the margin runs at full strength, the column runs at 0.10,
and constructs are free to cross it because the mask handles them there.

**2026-09-01 — Rendred is a laptop application and is not deployed**

Stated plainly so it stops being re-derived. It runs on one machine, for one
person, and there is no hosting plan. "Production" means `next build && next
start` on that same laptop.

What follows from it, and what should stop being treated as an open question:

- No auth, no sessions, no tenancy — there is no second user to separate from.
- Local time is simply correct. The server clock and the reader's clock are the
  same clock, so `lib/day.ts` is not a compromise pending a timezone decision.
- Secrets in `.env` are local files, not deployment configuration. `.env*` is
  gitignored, so machine-specific pins live there safely.
- Development affordances may ship in a build. The motif switcher is rendered
  whenever `RENDRED_DEV_TOOLS=1`, which is set in `.env`, because visual QA is
  run against a production build. On a deployed app that would be a leak; here
  there is nobody to leak it to.
- The outstanding `npm audit` advisories (PostCSS, via Next's bundled copy)
  describe an attack surface that requires hostile input reaching the build.
  Still worth fixing eventually, but not a reason to take a breaking upgrade.
- Do not weigh a design decision by how it would behave on a server, at the
  edge, or behind a CDN.

This is a constraint, not a deferral. If it ever changes, auth and the day
boundary are the two places to revisit first.

**2026-09-01 — A development-only motif switcher**

Temporary scaffolding while the atmosphere layer is being built: a small
control, bottom right, that switches between the five motifs. Comes out when
the visuals are finished.

It writes a cookie and re-renders on the server rather than setting
`data-motif` on the document. That is forced by the design, not a preference —
`lattice` and `willpower` mount server components to draw their geometry, so
flipping the attribute in the browser would recolour the ground and never
summon the lattice or the constructs. That trap is recorded in the handoffs and
this is the fix for it.

Resolution order is cookie → `RENDRED_MOTIF` → the date. The switcher's first
option clears the cookie rather than writing one, so it means "whatever a fresh
browser would see", and it reads `today` or `pinned` depending on whether the
env var is set. The motif that auto resolves to is outlined, so the pinned
state still shows which one it is.

**It is the only place in the product that names a motif on screen.** CLAUDE.md
forbids that, and the rule stands for the interface — this is a tool, gated by
`devToolsEnabled()`, and deleting `components/MotifSwitcher.tsx` plus its use in
the layout removes it entirely.

**2026-09-01 — `willpower` is pinned as the current motif**

`RENDRED_MOTIF="willpower"` in `.env`, so the app opens on the Green Lantern
day while it is being worked on rather than waiting for its turn in the
rotation. `.env*` is gitignored, so this is a local pin and not a change to the
rotation itself — `lib/motif.ts` still resolves Monday-to-Monday as before.
Remove the line to go back to the daily motif.

**2026-09-01 — `willpower`: a fifth motif, and the one that is allowed to move**

Green Lantern-inspired hard-light constructs, added as a fifth motif rather
than as a new theme. The brief that asked for it described Rendred's theme as
already Green Lantern-inspired; it is not, and never was — the theme is
black/purple with four abstract motifs. Adding a motif rather than repainting
the product keeps emerald off the other four days, keeps the survey-sheet
identity, and makes promotion to a default a one-line change if it earns it.

**No new dependencies.** Three.js, R3F and drei were considered and rejected —
the reason is the contrast floor, not conservatism. The base ground clears
6.04:1 and the floor is 4.5:1, so this layer has roughly 1.5:1 of headroom and
has to stay dim. Every advantage real 3D brings (shading, specular, depth of
field, volumetric bloom) is imperceptible at that opacity, while the cost is
about 1MB of client JS in an app whose atmosphere currently ships none.
Recognisability — the actual success criterion — is a property of silhouette,
which is 2D, and a hard-light construct is canonically bright line-art with
glow. Confirmed after the fact: first-load JS is unchanged at 110kB.

- **Geometry** (`lib/constructs.ts`): hammer, sword, shield, spear, chains, and
  the ring. Plain path data, no colour, no React. Each is stroked four times —
  a blurred halo, a wide body, a mid edge, a narrow core — over a gradient
  fill. The halo is what separates hard light from a green wireframe; the first
  pass had none and looked exactly like one.
- **Formation** is `stroke-dashoffset` with `pathLength="1"`, so every path
  draws in step regardless of its real length. The object is manufactured from
  its own outline rather than faded in.
- **Dissolution** reuses the motes that gathered to build it. Same particles,
  run outward — creation and destruction are one visual language, not two
  effects.
- **The ring** is drawn flat and circular and tilted by a CSS 3D transform in
  its own `perspective` container, so the foreshortening as it tumbles is real
  rather than a squashed ellipse. Its own stage also means the scene's mask
  flattening its ancestors cannot break it.
- **The orchestrator is the delay set.** Each construct runs one cycle whose
  length is prime (71/89/103/127/149/181s) with a negative delay, so events
  drift against each other and the sequence never resynchronises. No JS
  scheduler, no rAF, no React state — which is also why the page cannot
  re-render while the scene animates.

**The rule that changed:** the atmosphere is no longer unconditionally static.
`willpower` moves because motion is its subject. This is deliberately narrow —
the retired ambient blobs stay retired, and motion outside this motif still has
to name the state change it reports.

**The rule that did not change:** a motif may never colour data. Asserted per
motif; `accent`, `streak`, `positive` and `fg` compute identically on all five.
The emerald is turned toward teal (hue ~163) and away from `positive` (#4ADE80,
hue ~142) because green already means "completed" here.

Measured at 1440×900, worst composited ground in the reading column against
`--muted`, at the motif's loudest animated frames: **willpower 4.89:1** against
the 4.5 floor, on all three routes. Motif presence 7.63 mean delta / 58.5% of
pixels — inside the band set by voyage (5.19/28.8%) and lattice (12.35/77%).

**Device tiers are keyed to the gutter, not to device names.** The container is
64rem, so the margin only reaches 150px once the window passes 1324px.
Below that the two narrow constructs run at a smaller size; below 1200px the
scene is removed entirely and the ground carries the motif alone. This was
found by measuring, not assumed: at 768px the constructs were still in the DOM
rendering at roughly 3% of intended weight, which is not a tablet tier.

**Reduced motion** keeps one construct on screen, fully formed and completely
still, plus the ground. `animation: none`, not a zero duration, so elements
settle on their base rule rather than on a keyframe. Verified: zero running
animations on every route.

**2026-09-01 — `beacon` fails the contrast floor (pre-existing, not fixed)**

Found while measuring the new motif, so recorded rather than silently changed.
`beacon` puts the worst ground in the reading column at **4.08:1** against
`--muted`, below the 4.5 floor, identically on `/`, `/progress` and the track
page. It is unrelated to `willpower` and predates it — the earlier benchmarks
recorded beacon's *presence* (6.43 / 26.8%) but never its contrast, so it
appears simply never to have been measured. Left alone deliberately: fixing it
means re-tuning another motif's appearance, which was not what this task was
asked to do. `--beacon-sky` and `--beacon-glow` are the two values to pull
down.

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
