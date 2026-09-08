# CLAUDE.md

This file is auto-read by Claude Code at the start of every session. It is the
single source of truth for how this project should be built. Always read
`docs/PRD.md`, `docs/SCHEMA.md`, and `docs/ROADMAP.md` before starting work if
they are not already in context.

## Project Summary

A gamified personal learning tracker. Users create their own learning goals
("Tracks", e.g. DSA, Spanish, Guitar) and break them into a **recursive tree of
Topics**, at most 5 levels deep.

**There is no Task model, and this replaced one.** A Topic with children is a
parent and is not actionable; a Topic with no children is a **leaf**, and a leaf
is the unit of activity. Neither is a stored flag — both are questions about
whether the node currently has children, so a leaf that gains children stops
being actionable and becomes actionable again if they are removed, keeping its
own history throughout.

**Activity is a per-node, per-day count, not a once-a-day check-in.** Clicking a
leaf records one activity for that node today; clicking again records another,
and undo takes the most recent one back. This reverses the earlier rule that a
Task was "checked in once per day" — that model, and the Task/TaskCheckIn/
CompletionLog tables behind it, were removed outright rather than migrated.

Nothing here ever finishes: a leaf is a recurring activity and has no terminal
state. Working a leaf is the product's core loop and is meant to feel worth
repeating.

The app shows weekly/monthly progress rollups and streaks (Duolingo-style
dopamine loop), plus an LLM-generated coverage analysis that flags gaps or
imbalance in what the user has actually learned.

Full context: see `docs/PRD.md`.

## Tech Stack (locked — do not deviate without updating this file)

- **Framework:** Next.js 14+ (App Router), TypeScript
- **Styling:** Tailwind CSS (see "Visual Design Direction" below — do not
  ship default Tailwind gray/blue templated UI)
- **Database:** SQLite via Prisma ORM (local-first, zero cost)
- **LLM:** Anthropic API, `claude-haiku-4-5` for coverage/insight calls
  (cheap, fast, sufficient for short structured one-shot prompts — do not
  upgrade the model without a specific reason)
- **Hosting:** none. This runs on the author's laptop and is **not deployed**
  — not to Vercel, not anywhere. Treat "production" as `next build && next
  start` on that same machine. Do not add hosting config, edge/runtime
  constraints, CDN assumptions, or telemetry; do not weigh a decision by how it
  would behave on a server.
- **Auth:** none, and none is planned. One local user on one machine, so
  there is no session, no tenant and no untrusted input from a network.
- **3D:** none, and none is used. `three` and `@react-three/fiber` are still in
  `package.json` but nothing imports them — they existed only for the retired
  `willpower` atmosphere, which was deleted when the Spider-Verse theme landed.
  They are safe to uninstall; do not add a renderer back without a concrete
  visual requirement that CSS and SVG genuinely cannot meet.
- **Animation:** CSS and SVG only. There is no animation library and adding one
  needs a discussion first. `GlitchText` was deliberately written without
  Framer Motion — its glitch frames are discrete style writes, which a library
  does not help with. `AmbientLightning` and `GlitchShatter` were later specified
  *with* Framer Motion for "orchestrating trigger timing" and were still built
  without it: both are a counter prop, a `setTimeout` and a CSS keyframe, which
  is what orchestration means here. Revisit only if something genuinely needs
  interruptible or sequenced timelines.

Do not introduce new frameworks, state management libraries, CSS frameworks,
or databases without discussing it first. Keep the dependency footprint small.

## Visual Design Direction

**Reference:** Spider-Man: Into/Across the Spider-Verse — comic-book print,
not a dashboard. Four-colour separation, Ben-Day halftone, hard registration
edges, RGB chromatic split, and rift lighting. The goal is *a learning
application expressed through a comic visual language*, never "a normal
dashboard with comic colours applied to it".

**Theme:** one, always dark. There is no light theme and no day-of-week motif
rotation — the five-motif system (`voyage`, `lattice`, `beacon`, `willpower`,
`terrace`) was removed entirely, along with its three.js scene. Components
reference tokens only, never a raw hex, and never a `dark:` variant.

**Palette (tokens, not raw hex, in components).** Defined in `app/globals.css`
on `:root` and exposed to Tailwind through `@theme inline`:

| Token | Value | Use |
|---|---|---|
| `bg` | `#0A0A0F` | page ground — near-black, never pure `#000` |
| `surface` | `#16121A` | panels |
| `elevated` | `#1E1826` | inputs, popovers |
| `border` | `#3A2030` | hairlines. Tinted toward ink/magenta, **not violet** |
| `fg` | `#F5F0E6` | primary text — warm paper white, not `#FFF` |
| `muted` | `#ABA0B5` | secondary text |
| `accent` | `#FF2079` | magenta — volume, active states |
| `streak` | `#FFE800` | comic yellow — streaks, milestones, **and the primary CTA fill** |
| `positive` | `#00E5FF` | cyan — checked in today |

Raw plates are also available for treatments that are about ink rather than
meaning: `--sv-magenta`, `--sv-cyan`, `--sv-yellow`, `--sv-purple`, `--sv-red`,
`--sv-ink`, and the fixed split pair `--sv-split-a` / `--sv-split-b`.

**This palette has one green, and it means exactly one thing: activity
intensity.** Everything the no-green rule was originally written about still
holds — "done" is cyan, volume is magenta, consistency is yellow — and reaching
for green anywhere *else* is still reintroducing the retired motif system.

Contribution intensity is a signal none of the existing three can carry: magenta
already means volume, and reusing it would make "how much" and "how broadly" the
same colour. So `--activity-1` through `--activity-5` are green, and nothing
else is. The ramp is solved rather than picked: every tier clears 4.5:1 against
whichever of paper or ink sits on it, by at least 6.4:1, and `--activity-N-fg`
carries which, so no component decides for itself.

Every text/background pair must clear **4.5:1** against the *composited*
ground — the rift glows lighten the background, so measure, do not assume.

**Typography — one family. Bangers, everywhere.**

| Role | Family | Treatment |
|---|---|---|
| Everything: UI, headings, labels, metadata, body, buttons, navigation, measurements, and all user-generated Track and Topic names | Bangers | `font-sans` / `font-display` / `font-comic` / `font-mono` all resolve to it |

This reverses the earlier rule, which reserved Bangers for the wordmark and set
everything else in Archivo with Space Mono for figures. **The user asked for the
comic face across the whole interface** — the old split left the app reading as
a conventional product with a comic hat on. Do not reinstate the split without
being asked.

- **Bangers is inherited from `body` now.** Every family token points at it, so
  new components get it without opting in. Archivo and Space Mono remain in the
  stacks *behind* it as glyph fallbacks — Bangers has a narrow glyph set and no
  true lowercase, so anything it lacks falls through rather than rendering tofu.
- **`.font-label`** is the small-caps interface label (section headings,
  buttons, nav, metadata). It replaced `font-mono` on ~50 elements that were
  only monospaced because the mono used to be the label voice.
- **`.font-mono`** now means "a measurement" and nothing about the family.
- **Weight is always 400.** Bangers ships one weight; asking for 700/800 makes
  the browser synthesise a bold that smears the outline, so `font-synthesis-weight:
  none` is set and hierarchy comes from size, case and tracking instead.
  **A consequence worth stating, because it has already caused a bug: a
  `font-semibold`/`font-bold` class emphasises nothing at all.** It is not
  merely weaker — it renders byte-identical to the text around it. The delete
  confirmations shipped for a while with the name of the thing being deleted
  marked that way and therefore not marked at all. Emphasise with contrast
  instead: mute the surrounding sentence and leave the important span at `fg`.
- **Known trade-off: numerals shift as they change.** Bangers figures are
  strongly proportional — 15.4px for a 1 against 24.9px for an 8 at 48px, a 38%
  spread — and `tabular-nums` cannot fix it because the face has no tabular set.
  An elevation ticking 9 to 10 nudges the stats row. This was accepted
  deliberately in exchange for one voice. Reverting only the figures is a
  one-line change: point `--font-mono` back at `--font-space-mono`.

**Shape language:**
- **Radius is gone. Everything is square, including controls.** The old rule
  gave controls `3px` to mean "interactive"; the user flagged the residual
  rounding twice as reading corporate, so `border-radius: 0` is now universal —
  buttons, inputs, the activity cell and the focus ring included. Interactivity
  is carried by fill and hover instead.
- **Cards and shadows are back, but only as comic devices.** The old "no cards,
  no shadows" rule is retired. What is *still* banned is the soft blurred
  elevation shadow and the rounded SaaS card — a drop shadow here is a hard,
  un-blurred offset block in the *opposite* plate colour (an ink registration
  error), never a blur.
- `Panel` has two registers and the choice carries hierarchy:
  - `variant="band"` (default) — mono label in the gutter, separation by rule
    and space. The workhorse. The topic tree and the leaf list stay here.
  - `variant="comic"` — 2px ink border, solid caption box, hard registration
    plate, halftone. Reserved for the level that should dominate a screen, and
    **spent at most once per screen**. A page where everything is a comic panel
    has no hierarchy left.

**Hierarchy (do not flatten this):**
- Track — strongest visual presence (comic panel)
- Topic (parent) — secondary (band)
- Leaf — highly readable and usable above all
- Recording activity — the strongest interaction feedback in the app
- Progress — visually connected, never noisy

**The atmosphere — global, background-only, always-on:**
- `SpiderverseBackground` is mounted **once** in `app/layout.tsx`. Never draw
  it per screen.
- Three rift glows drift on long, mutually indivisible periods (37 / 43 / 29s)
  and speed lines creep along their own axis. Incommensurate periods matter:
  harmonic ones visibly re-align and the whole thing starts reading as a loop.
- Everything sits under 8% opacity, is transform/background-position only, and
  stays on the compositor. No JS, no state, nothing ticking per frame.
- The ground is painted on `html`, **never on `body`**. `html`'s background
  propagates to the canvas; if `body` paints one too, the `-z-10` atmosphere
  layer renders behind it and the page looks flat black.
- **"Global" means the whole document, not the whole screen.**
  `SpiderverseBackground` and `DimensionalThreads` are `position: absolute` at
  the document top, sized to the measured document height, and they scroll with
  the page — drawing one *band* of composition per screenful, so no page has a
  height at which the multiverse runs out. Absolute rather than fixed because
  the initial containing block's origin is the document origin; `body` must
  **not** be made `position: relative` to achieve this, and the height must be
  measured from `body`'s border box rather than `documentElement.scrollHeight`,
  or the layer ratchets the document longer on every pass. See
  `useDocumentBands` and `docs/DECISIONS.md` (2026-09-06 latest).
- **Bands are generated, never tiled.** Band 0 is the hand-set composition,
  unchanged. Above it, each band mirrors on parity, jitters, and **re-seeds each
  polyhedron** — a band that only moves the same solids around is still a repeat,
  and two copies on screen together is all it takes to see the period. Threads
  that used to leave the frame vertically retarget to the nearest solid in the
  neighbouring band, so a boundary has structure running through it; only at the
  document's top and bottom do they still run off the edge.
- **The speed lines are the only layer pinned to the viewport.**
  `sv-speedline-pan` animates `background-position-x`, which is a full repaint
  every frame — measured at 66.7ms/frame against a 16.7ms floor when it scrolls,
  and the only layer that costs anything. They are also a uniform field with no
  position to scroll *to*, so nothing is lost.
- **Everything else in the environment scrolls together, `DimensionalSpots`
  included.** A spot was left `fixed` at first, on the reasoning that a tear is a
  transient event where you are looking — and that was wrong and shipped as a
  bug. A spot is a *hole in the background*: pin the hole and the background
  slides out from behind it. It captures `scrollY` at spawn so it still opens
  where the reader is looking, then holds that document position for life.
  Structures, threads, spots, the torn edge and the corruption burst must all
  keep their spatial relationships; `qa/spots-check.mjs` asserts it.

**The terrain metaphor — unchanged, and still the product's signature:**
- Elevation is cumulative activity summed from `TopicActivity`; it only rises.
  **The headline numeral is all-time and has no window** (`cumulativeElevation`);
  the terrain *drawing* keeps `TERRAIN_DAYS = 14`. These are two figures, not
  one — wiring the numeral back to a windowed total reintroduces a fixed bug
  where elevation fell as activity aged out. Only an undo may lower it.
- **The trajectory is one chart per Track, never several tracks combined**, and
  its y axis is *that track's elevation at the end of that day* — one point per
  calendar day. A combined all-tracks curve was removed: stacking tracks gives a
  height that answers no question.
- **The y domain is `nextMilestone(elevation)`, never the series' own total.**
  Self-normalising put the last point at 1.0 for every input, so two activities
  and two hundred drew the same picture. The axis top being the next
  `ELEVATION_MILESTONE` gives proportionality, headroom by construction, and a
  scale the app already means. Two charts with different domains must each state
  their own scale — see the track rows.
- The series starts from the elevation *before* the window (`buildTerrain`'s
  `baseline`), so the top of the ridge equals the headline numeral rather than
  restarting at zero every fortnight.
- Pace emerges from geometry — strata at fixed elevations bunch on a steep climb.
- Milestones are drawn only where actually crossed, in `streak` (yellow).
- No completions means a flat baseline and a plain statement, never a fake curve.
- Ember (`streak`) marks streaks and milestones only. A zero streak stays muted.

**Yellow does double duty, and it was a deliberate call.** It is both the
consistency signal and the primary-button fill (`ADD`/`SAVE`, yellow on
`sv-ink`). This was raised as a cost — it weakens the streak signal the terrain,
stats and heatmap all lean on — and the user chose it anyway after being told.
Do not "fix" it back to magenta without asking. Magenta remains volume and
active state; it is no longer the button fill.

**Three separate progress signals — do not conflate them:**
1. Volume — terrain elevation, `accent` (magenta)
2. Consistency — streak count and heatmap, `streak` (yellow)
3. Checked in today — `positive` (cyan), resets with the day

Nothing here finishes: a leaf is a recurring activity and has no terminal state.
Any ratio reads "how much of this was worked today" — coverage — never "how many
are finished".

**There is one milestone list, and its name is deliberate.**
`ELEVATION_MILESTONES` (10/50/100/250/500 cumulative activities) belongs to
volume, is drawn on the terrain, and is now also the trajectory chart's y-axis
ceiling. It is **not** called plain `MILESTONES`, and that matters even though
it is currently alone: there used to be a second list on a second signal, and
the specific name is what stopped the two being reached for interchangeably.

**Streak milestones were removed on 2026-09-06.** `STREAK_MILESTONES`,
`milestoneCrossed` and the whole check-in outcome cluster are gone from
`lib/streak.ts` — see the note at the foot of that file. They described what a
*check-in* did to a streak, and the check-in stopped existing in the topic-tree
restructure; nothing had called them since, and they were reachable only from
their own tests. `git log -- lib/streak.ts` has them.

If a streak celebration is ever built, write it against the activity model
rather than restoring that code, put it on the first activity of a day, **do not
call the list `MILESTONES`**, and keep it a *description* of the streak — never a
modal, toast or confetti.

No XP, levels, points or badges. The comic theme is not a licence to add them,
and neither is a milestone: a milestone is a *description of the streak*, not a
reward on top of it, which is why it is derived from the streak numbers and
nothing is stored.

**Glitch, halftone and chromatic effects — intentional, never ambient noise:**
- `GlitchText` fires in *bursts* with dead air between them, never on a smooth
  loop. Three intensities separate on every axis at once — 2/4/7px of travel,
  2/3/5 frames, ~6s/3s/1.4s of average dead air.
- Each instance randomises its own first delay so several never sync into a
  chorus.
- Glitch belongs on headers, labels and CTAs. **Never on body copy, and never
  on a Track or Topic name.**
- Halftone reads as texture at 4-8% opacity. Above that it is noise over the
  interface.
- The true chromatic aberration filters (`#sv-chromatic`, `#sv-chromatic-heavy`)
  are defined once by `ChromaticDefs` in the layout. **Do not apply an SVG
  filter to a whole route subtree** — it is per-pixel over everything, and with
  `animation-fill-mode: both` its start state applies during any delay before
  the animation runs, leaving the entire page ghosted and unreadable.

**Three ambient/transient effects.** Two of them arrive on their own and mean
nothing; the third is feedback. `AmbientGlitch` was added after this section was
written — see `docs/DECISIONS.md` — and it is a sibling of the lightning, not of
the shatter.
- `AmbientLightning` — a Lichtenberg discharge breaking off the interface's own
  borders. Mounted once in the layout, above the content. **Ambient and
  deliberately uncorrelated with anything the user does:** it arrives on its own
  every 8-18s and means nothing. It replaced a version wired to the ADD press
  and to elevation rising; that wiring is gone and must not come back — an
  effect that reports a state change has to be reliable, and this is not.
  - Origins are sampled along real edges (panel borders, the masthead rule, the
    page column) and the trunk leaves along that edge's outward normal, so it
    reads as breaking *off* the interface rather than floating over it.
  - Three generations, not two. Trunk, forks off its vertices, and forks off
    *those*, with the same 0.6 length / 0.55 width falloff per jag at each
    level. Two generations reads as "a bolt with forks"; the third is what makes
    it self-similar and therefore a Lichtenberg figure.
  - Timing is asymmetric on purpose: a hard 90ms flicker in (paired keyframe
    stops, no interpolation), a 1.0-1.8s hold, then a *smoothly eased* 0.4-0.7s
    fade. Struck instantly, dissipating slowly. **Never loop it** — a smooth
    repeat reads as a neon sign.
  - One strike at a time, rarely two. Its layer is `overflow-x: clip`, because a
    520px canvas centred near a narrow viewport's edge otherwise widens the
    document.
- `AmbientGlitch` — the film's full corruption, on one element at a time. Ambient
  like the lightning: every 10-20s it picks a single target from a registry of
  headers, labels, numerals and the wordmark, splits its text into three offset
  channel copies, breaks a shard cluster over it and pops print flares, then
  fades. It holds 2-3s and runs 2.4-3.6s end to end — longer than a strike, which
  reverses the original intent that the two be told apart by length; that was
  asked for explicitly, twice. It shares `buildShards` with `GlitchShatter` and
  nothing else.
- `GlitchShatter` — the film's fracture: 6-12 clip-path triangles in the plate
  colours, knocked out of register and snapped back over 220-360ms. This is the
  app's "that landed" confirmation, on recording activity and on creating a
  track or topic. It is
  **not** a replacement for `GlitchText`, which stays for resting text accents;
  the two are different devices and both are wanted.
- Neither may go on an idle element, and neither fires on a *negative* change —
  no shatter on an undo, no bolt on elevation falling. Both render nothing at
  all under reduced motion, because a transient frozen at its neutral pose is
  just a permanent scribble over the interface.
- `/lab` renders both in isolation for tuning. Development only; it `notFound()`s
  elsewhere.

**Motion:** every animation must name the state change it reports.
- Recording activity is the one interaction allowed to feel like an event: the
  count moves optimistically and a shatter fires on the press. It fires on a
  recorded click and never on an undo — a negative change is stated, not
  celebrated.
- **The check-in beat is gone.** `CheckInBeat` and `CheckInReport` composed the
  tick, the report line and one emphasised numeral into a single moment. They
  published from the task row, and the restructure removed tasks; a provider
  nothing can fire is worse than none, so they went with it. The streak-milestone
  celebration went too, and on 2026-09-06 so did the code behind it —
  `STREAK_MILESTONES` and `milestoneCrossed` were deleted rather than kept
  waiting for a caller that four handoffs had not produced.
- The route transition (`app/template.tsx`) is a 180ms transform+opacity cut.
  Fast enough to read as a cut, never as loading.
- Always `prefers-reduced-motion` aware. Reduced motion must keep the theme's
  identity — the atmosphere layers stay, frozen at their neutral pose; only the
  movement stops.

**Accessibility:**
- `:focus-visible` is a 3px yellow ring with offset. The browser default
  resolves to near-black on this ground and is invisible — do not remove it.
- Glitch duplicate layers are `aria-hidden`, so a string is announced once.
  Verified against the accessibility tree, not assumed.
- No essential information is carried by colour or glitch alone.

**Process:** state the design plan for a screen before coding it. After
building or changing a screen, verify it at desktop, 1280x720, mobile portrait
and ~320px, and check for horizontal overflow from glitch offsets and
registration plates.

## Data Model

See `docs/SCHEMA.md` for the full schema. Core hierarchy:

```
Track → Topic (recursive, max depth 5) → TopicActivity (one row per node per day)
```

`TopicActivity` is the single source of truth for every activity figure —
intensity, coverage, streaks, history. **There is no rollup table beside it**:
the old `CompletionLog` was derived state that had to be rebuilt whenever
anything moved or was deleted, and deriving on read instead means a move or a
soft delete changes what the figures mean without a row being rewritten.

Three signals, deliberately distinct — see `lib/tree.ts`:
- **Leaf intensity** — that node's own count today; tiers 0/1/2/3/4/5+, stored uncapped.
- **Parent coverage** — distinct *direct* children worked today / total. Clicking
  one child repeatedly does not move it.
- **Track coverage** — distinct active leaves / total leaves, across all leaves at
  once (never an average of per-topic coverage).

Deleting a Topic is a **soft delete**: it leaves current calculations at once and
keeps its history. A parent cannot be deleted while it has children. Streaks are
per-track and **strict** (a missed day resets to 0 — no freezes, no forgiveness),
and a day counts as active only when a *current* leaf was worked.

## LLM Usage Rules

- All LLM calls are **one-shot, stateless** — pass in the data needed, get a
  response back, done. No multi-step agent loops, no autonomous tool-calling
  by the model, no background/scheduled agents.
- LLM is used for exactly two things in MVP:
  1. Generating a suggested curriculum (topic list) when a user creates a
     new Track
  2. Generating short "insight" remarks from the user's progress data
     (gaps, pace, imbalance)
- Gap/coverage comparison logic itself (comparing logged topics vs. expected
  curriculum) should be done in plain application code, NOT via LLM — only
  the parts that require judgment/language go to the model.
- Keep prompts short and structured. Always request structured output
  (JSON) for anything the UI needs to render programmatically.

## Build Phases — respect current phase, do not scope-creep

See `docs/ROADMAP.md`. Do not build Phase 3 (LLM features) or Phase 4
(personalization) work while Phase 1/2 is incomplete, unless explicitly asked.

## Coding Conventions

- File structure: `/app` for routes, `/components` for UI, `/lib` for
  business logic (streaks, coverage comparison, prisma client), `/lib/llm`
  for LLM prompt/response handling
- Prefer server components by default; use client components only where
  interactivity requires it
- Keep components small and single-purpose
- No premature abstraction — build for the current phase's actual needs

## Explicit Non-Goals (for now)

- No multi-user support / auth
- No autonomous/agentic AI behavior (no auto-adjusting study plans, no
  background agents deciding what to do next)
- No personalization/favorites layer (Phase 4, later)
- No mobile app — web only

## Session Workflow

1. Read this file, `docs/PRD.md`, `docs/SCHEMA.md`, `docs/ROADMAP.md`,
   `docs/RULES.md`
2. Confirm which roadmap phase we're working in before writing code
3. Log any new decisions in `docs/DECISIONS.md` as they're made
4. After building any feature or meaningful change, update
   `docs/DEV_REPORT.md` per the rules in `docs/RULES.md` — this is
   mandatory, not optional, and is how the user stays informed of progress
   in plain language
