# Decisions Log

Running record of decisions made, so future Claude Code sessions (and you)
don't re-litigate them. Append new entries at the top with a date.

---

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
