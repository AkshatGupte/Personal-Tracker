# CLAUDE.md

This file is auto-read by Claude Code at the start of every session. It is the
single source of truth for how this project should be built. Always read
`docs/PRD.md`, `docs/SCHEMA.md`, and `docs/ROADMAP.md` before starting work if
they are not already in context.

## Project Summary

A gamified personal learning tracker. Users create their own learning goals
("Tracks", e.g. DSA, Spanish, Guitar), break them into Topics and Tasks, and
log completions. The app shows weekly/monthly progress rollups and streaks
(Duolingo-style dopamine loop), plus an LLM-generated coverage analysis that
flags gaps or imbalance in what the user has actually learned.

Full context: see `docs/PRD.md`.

## Tech Stack (locked — do not deviate without updating this file)

- **Framework:** Next.js 14+ (App Router), TypeScript
- **Styling:** Tailwind CSS (see "Visual Design Direction" below — do not
  ship default Tailwind gray/blue templated UI)
- **Database:** SQLite via Prisma ORM (local-first, zero cost)
- **LLM:** Anthropic API, `claude-haiku-4-5` for coverage/insight calls
  (cheap, fast, sufficient for short structured one-shot prompts — do not
  upgrade the model without a specific reason)
- **Hosting:** none required for MVP (runs locally); Vercel free tier if/when
  deployment is needed
- **Auth:** none for MVP — single local user

Do not introduce new frameworks, state management libraries, CSS frameworks,
or databases without discussing it first. Keep the dependency footprint small.

## Visual Design Direction

**Reference:** a survey sheet, not a dashboard. Cartographic and editorial —
hairline rules, a label gutter, generous negative space, and the terrain
running full-bleed as the ground the interface stands on. Depth comes from
layered grounds, the rule system and the terrain's own light. It must never
read as flat black with flat purple text, and it must never read as a row of
rounded cards.

**Theme:** one, not two. Black/purple, always. The light theme and its toggle
were removed: the day's atmosphere is the only variation the interface carries,
and holding a second palette meant every motif was capped by whichever theme
had less contrast headroom — always the light one. Components reference tokens
only, never a raw hex, never a `dark:` variant.

**Palette (tokens, not raw hex, in components):**

| Token | Value | Use |
|---|---|---|
| `bg` | `#0A0A12` | page ground |
| `surface` | `#14141F` | panels |
| `elevated` | `#1C1B2A` | inputs, popovers |
| `border` | `#2A2840` | hairlines |
| `fg` | `#EDEBF5` | primary text |
| `muted` | `#9C96B0` | secondary text |
| `accent` | `#A78BFA` | progress, active, primary action |
| `streak` | `#E3A857` | streaks, milestones, ember |
| `positive` | `#4ADE80` | completion |

Every text/background pair must clear **4.5:1**, and that budget is now shared
with the atmosphere: a motif tints the ground the text sits on, so the check is
against the *composited* ground, not against `bg`. Do not assume, measure.

**Typography:** three families, one job each. Hierarchy comes from family,
size, case and tracking — **not** from weight.

| Role | Family | Treatment |
|---|---|---|
| Measurement — elevation, streak, percentage | IBM Plex Mono 400/500 | large, tight, `tabular-nums` by construction |
| Track names, hero headings | Instrument Serif 400 | one weight exists; it cannot be bolded |
| Topic names, tasks, body, controls | Plus Jakarta Sans 400/500/600 | the single weight-based step in the ladder |
| Labels, metadata, actions, tags | IBM Plex Mono 400 | uppercase, `tracking-[0.14em]`–`[0.17em]`, `muted` |

- Every number in the app sits in the mono. Never set a figure in the sans.
- `body` carries `word-spacing: 0.06em` — Plus Jakarta Sans' space glyph is
  unusually narrow (0.188em). Do not remove it.
- All three load through `next/font/google`. No new dependency.

**Shape language — radius means interactive:**
- Controls (buttons, inputs, the completion tick) carry `3px`. Panels,
  sections and data surfaces carry none.
- Sections are separated by hairline rules and space, never by a box. There is
  no card component; `Panel` is a labelled band with a gutter.
- No shadows, no lit card edges, no hover lift.

**Depth and pattern — required, this is what stops it looking basic:**
- A faint ruled grid over the page ground
- A left gutter carries mono section labels; it collapses to an eyebrow below `lg`
- The terrain runs full-bleed to the window edge (`.bleed-r`)
- Stat visuals are real drawings (SVG terrain, ring, heatmap grid), never bars
- Light comes from the terrain gradient and the atmosphere, never from
  decorative glow. The drifting ambient blobs were retired: they carried no
  data. Do not reintroduce them.

**The terrain metaphor — the product's signature, and strictly data-driven:**
- Elevation is cumulative completed tasks, read from `CompletionLog`
- Pace emerges from geometry: strata sit at fixed elevations, so a steep climb
  crosses several within a short span and they visibly bunch. No extra metric
- Milestones are drawn only where they were actually crossed, never if unreached
- No completions means a flat baseline and a plain statement, never a fake curve
- Keep it where it means something. Do not scatter terrain decoration
- Ember (`streak`) marks streaks and milestones only. A zero streak stays muted

**The atmosphere — a secondary, background-only personalization layer:**
- One of four motifs paints the page ground, resolved on the server from the
  local day: `voyage` and `lattice` and `beacon` rotate through weekdays,
  `terrace` covers the weekend. `lib/motif.ts` is the only place this is
  decided. **The rotation counts weeks Monday to Monday**, the same convention
  as the heatmap and `lib/rollup.ts`, so Monday pairs with Thursday, Tuesday
  with Friday, and Wednesday stands alone. All three appear in every week.
- It is **abstract only** — geometry, light and one hue each. No characters,
  logos, crests, wordmarks, slogans or licensed artwork, ever.
- **It is never named in the interface.** No labels, tooltips or captions.
- The day's motif is stamped on `<html>` as `data-motif`, so a motif may also
  carry a decorative treatment on **non-data** elements — a display heading, a
  section-label marker. The hard rule is unchanged and is the one that matters:
  **a motif may never colour data.** `accent`, `streak` and `positive` keep
  their meanings on every day of the week, verified per motif.
- Motif tokens (`--m-*`) are scoped to the atmosphere element. A treatment
  outside that layer must read the `--voyage-*` / `--lattice-*` / `--beacon-*` /
  `--terrace-*` palettes on `:root` instead — `--m-*` resolves to nothing out
  there and the whole declaration is silently dropped.
- **Judge a motif hue by what it composites to, not by its source value.** The
  near-black ground is hue 240, so a warm hue is dragged toward magenta on the
  way down. Measure the composited ground before deciding a hue is wrong.
- Motif geometry is anchored where the page margin is permanently empty, so
  the densest part of a structure never sits behind text.
- Static. No motion. Halved on narrow screens.
- Every text pair must still clear 4.5:1 on each motif's composited ground.
  Verify, do not assume.
- `lattice` is the exception to "gradient field": a fractured hex lattice drawn
  as SVG in `components/LatticeWeb.tsx`, covering the whole viewport and running
  lighter across the reading column than in the page gutters. That dip is the
  contrast budget, not a decorative choice. It is drawn three times at
  sub-pixel offsets for a static chromatic split; the same misregistration is
  applied to display headings on lattice days.

**Three separate progress signals — do not conflate them:**
1. Volume: terrain elevation, `accent`
2. Consistency: streak count and heatmap, `streak`
3. Completion: the finished state, `positive`

No XP, levels, points or badges. The PRD does not define them.

**Motion:** every animation must name the state change it reports.
- Marking a task complete gets one clear moment — the tick draws, the ring
  advances, the number ticks up
- The ridge and the ring draw themselves as the data is drawn, and replay when
  the value changes
- Nothing else animates. The card stagger, the hover lift and the heatmap cell
  stagger were retired: they reported nothing.
- Always `prefers-reduced-motion` aware.

**Process:** state the design plan for a screen before coding it. After
building or changing any screen, run `playwright-visual-qa` and **look at the
screenshots on more than one motif** before marking it done — the motifs are
the only variation the interface carries now, and each one composites a
different ground under the same text. Confirm it reads as layered and lit,
not flat.

**Scope discipline:** the reference shows XP, levels, achievements and a
"Next Up" recommendation. None of those are in `docs/PRD.md` — and
auto-suggesting what to study next is an explicit non-goal. Adopt the visual
language, map it onto data that actually exists, and never fill a widget with
invented numbers. Navigation to unbuilt sections is shown as disabled/"soon",
not as a working link.

## Data Model

See `docs/SCHEMA.md` for the full schema. Core hierarchy:

```
Track → Topic → Task → CompletionLog
```

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
