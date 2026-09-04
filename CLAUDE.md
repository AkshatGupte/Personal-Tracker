# CLAUDE.md

This file is auto-read by Claude Code at the start of every session. It is the
single source of truth for how this project should be built. Always read
`docs/PRD.md`, `docs/SCHEMA.md`, and `docs/ROADMAP.md` before starting work if
they are not already in context.

## Project Summary

A gamified personal learning tracker. Users create their own learning goals
("Tracks", e.g. DSA, Spanish, Guitar) and break them into Topics and Tasks.

**A Task is a persistent recurring activity, never a one-time item** —
"Practice array problems", not "Solve: Two Sum". It stays available
indefinitely and is **checked in once per day**; the check-in creates the
historical record, and the Task itself is never permanently completed. There is
no one-time task type and none is planned. The daily check-in is the product's
core loop and is meant to feel worth repeating.

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
  does not help with.

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

**This palette has no green.** "Done" is cyan. If you find yourself reaching
for a green, you are reintroducing the retired system.

Every text/background pair must clear **4.5:1** against the *composited*
ground — the rift glows lighten the background, so measure, do not assume.

**Typography — one family. Bangers, everywhere.**

| Role | Family | Treatment |
|---|---|---|
| Everything: UI, headings, labels, metadata, body, buttons, navigation, measurements, and all user-generated Track/Topic/Task names | Bangers | `font-sans` / `font-display` / `font-comic` / `font-mono` all resolve to it |

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
  buttons, inputs, the check-in tick and the focus ring included. Interactivity
  is carried by fill and hover instead.
- **Cards and shadows are back, but only as comic devices.** The old "no cards,
  no shadows" rule is retired. What is *still* banned is the soft blurred
  elevation shadow and the rounded SaaS card — a drop shadow here is a hard,
  un-blurred offset block in the *opposite* plate colour (an ink registration
  error), never a blur.
- `Panel` has two registers and the choice carries hierarchy:
  - `variant="band"` (default) — mono label in the gutter, separation by rule
    and space. The workhorse. Topics and Tasks stay here.
  - `variant="comic"` — 2px ink border, solid caption box, hard registration
    plate, halftone. Reserved for the level that should dominate a screen, and
    **spent at most once per screen**. A page where everything is a comic panel
    has no hierarchy left.

**Hierarchy (do not flatten this):**
- Track — strongest visual presence (comic panel)
- Topic — secondary (band)
- Task — highly readable and usable above all
- Check-in — the strongest interaction feedback in the app
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

**The terrain metaphor — unchanged, and still the product's signature:**
- Elevation is cumulative check-ins read from `CompletionLog`; it only rises.
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

Nothing here finishes: a recurring activity has no terminal state. Any ratio
reads "how many of today's activities are checked in", never "how many tasks
are finished".

**Milestones exist on two of these signals and must not be crossed over.**
`STREAK_MILESTONES` (7/14/30/60/100 consecutive days) belongs to consistency and
is yellow; `ELEVATION_MILESTONES` (10/50/100/250/500 cumulative check-ins)
belongs to volume and is drawn on the terrain. Neither is called plain
`MILESTONES`, precisely so they cannot be reached for interchangeably.

A crossed streak milestone is celebrated by restyling the check-in report line
that already exists — a solid `streak` caption box — and by throwing the streak
numeral's existing misregistration harder. It is not a new surface, and adding
a modal, toast or confetti for it would be.

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
  on a Track/Topic/Task name.**
- Halftone reads as texture at 4-8% opacity. Above that it is noise over the
  interface.
- The true chromatic aberration filters (`#sv-chromatic`, `#sv-chromatic-heavy`)
  are defined once by `ChromaticDefs` in the layout. **Do not apply an SVG
  filter to a whole route subtree** — it is per-pixel over everything, and with
  `animation-fill-mode: both` its start state applies during any delay before
  the animation runs, leaving the entire page ghosted and unreadable.

**Motion:** every animation must name the state change it reports.
- The check-in is the one interaction allowed to feel like an event: the tick's
  magenta and cyan plates scissor apart and snap back over 320ms. It is keyed
  to the *transition* into checked, never to the resting state — otherwise
  every revalidation replays it and the whole list twitches.
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
Track → Topic → Task → TaskCheckIn
                   ↘ (rolled up per day) → CompletionLog
```

`TaskCheckIn` is the ground truth: one row per Task per day, meaning "I did
this today". `CompletionLog` is a per-track daily rollup of those rows and is
always rebuildable from them. A Task carries **no completion state of its own**
— "checked in today" is a question about `TaskCheckIn` for the current day, not
a column, and it does not persist into tomorrow.

Streaks are tracked per-track and are **strict** (a missed day resets the
streak to 0 — no streak freezes, no forgiveness logic).

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
