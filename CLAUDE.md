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

**Reference:** a dark, high-contrast learning dashboard — a top navigation
bar, a greeting hero, and a row of glowing stat cards (a circular progress
ring, a streak heatmap, a call to action). Depth comes from ambient gradient
glow, a faint grid/dot pattern, and soft accent light on card edges. It must
never read as flat black with flat purple text.

**Themes:** ship both from one semantic token set. Dark is black/purple and is
the primary look; light is blue/white. Components reference tokens only —
never a raw hex, never a `dark:` variant. The toggle persists and falls back
to the system preference.

**Palette (tokens, not raw hex, in components):**

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#FFFFFF` | `#0A0A12` | page ground |
| `surface` | `#F7F8FC` | `#14141F` | cards, panels |
| `elevated` | `#FFFFFF` | `#1C1B2A` | inputs, popovers, nav pill |
| `border` | `#E4E7F0` | `#2A2840` | hairlines, card edges |
| `fg` | `#14161F` | `#EDEBF5` | primary text |
| `muted` | `#5F6478` | `#9C96B0` | secondary text |
| `accent` | `#2563EB` | `#A78BFA` | progress, active, primary action |
| `streak` | `#9A6212` | `#E3A857` | streaks, milestones, ember |
| `positive` | `#047857` | `#4ADE80` | completion |

Every text/background pair must clear **4.5:1**, verified in both themes. An
earlier palette draft failed in eight places — do not assume, measure.

**Typography:** one family, Plus Jakarta Sans.
- Headings 600–800, tight tracking; hero heading is large and may accent a
  single word in `accent`
- Section labels: small, uppercase, `tracking-[0.18em]`
- Numbers, percentages, streak counts, dates: `tabular-nums`
- `body` carries `word-spacing: 0.06em` — this font's space glyph is unusually
  narrow (0.188em). Do not remove it.

**Depth and pattern — required, this is what stops it looking basic:**
- A faint ruled grid over the page ground, stronger in dark
- Cards sit on `surface` with a soft accent-tinted top edge (`.card-lit`)
- Stat visuals are real drawings (SVG terrain, ring, heatmap grid), never bars
- Light comes from the terrain gradient, not from decorative glow. The drifting
  ambient blobs were retired: they carried no data. Do not reintroduce them.

**The terrain metaphor — the product's signature, and strictly data-driven:**
- Elevation is cumulative completed tasks, read from `CompletionLog`
- Pace emerges from geometry: strata sit at fixed elevations, so a steep climb
  crosses several within a short span and they visibly bunch. No extra metric
- Milestones are drawn only where they were actually crossed, never if unreached
- No completions means a flat baseline and a plain statement, never a fake curve
- Keep it where it means something. Do not scatter terrain decoration
- Ember (`streak`) marks streaks and milestones only. A zero streak stays muted

**Three separate progress signals — do not conflate them:**
1. Volume: terrain elevation, `accent`
2. Consistency: streak count and heatmap, `streak`
3. Completion: the finished state, `positive`

No XP, levels, points or badges. The PRD does not define them.

**Motion:** purposeful, and always `prefers-reduced-motion` aware.
- The progress ring draws itself in on load
- Heatmap cells fade in on a short stagger
- Cards lift slightly on hover; the ambient glow drifts continuously
- Marking a task complete gets one clear moment — the ring advances and the
  number ticks up

**Process:** state the design plan for a screen before coding it. After
building or changing any screen, run `playwright-visual-qa` and **look at the
screenshots in both themes** before marking it done. Confirm it reads as
layered and lit, not flat.

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
