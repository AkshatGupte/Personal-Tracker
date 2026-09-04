# Roadmap

Work through phases in order. Do not start a later phase until the current
one is functionally complete, unless explicitly told otherwise.

## Phase 1 — Core Tracking (foundation)
- [x] Project scaffold: Next.js + TypeScript + Tailwind + Prisma + SQLite
- [x] Prisma schema from `docs/SCHEMA.md` (Track, Topic, Task, CompletionLog)
- [x] CRUD: create/edit/delete Track
- [x] CRUD: add Topic under Track
- [x] CRUD: add Task under Topic
- [x] Mark Task complete → updates CompletionLog + streak logic
      — **superseded.** Shipped as a one-time completion (`Task.status` +
      `Task.completedAt`). The aggregate half of it (CompletionLog rollup,
      streak rebuild, one write path, recompute-never-increment) is correct and
      is kept; the per-task half models the wrong thing. Replaced by the daily
      check-in item in Phase 2
- [x] Strict streak logic (reset on missed day)
- [x] Basic UI: list tracks, view topics/tasks, mark complete

## Phase 2 — Progress Visibility

- [x] **Daily check-in model — the core product loop.** Tasks are persistent
      recurring activities checked in once per day. `TaskCheckIn` is the ground
      truth; `CompletionLog` stays a derived per-track daily rollup of it.
      `Task.status` and `Task.completedAt` removed. Deleting a task or topic
      cascades its check-ins and recomputes every day it touched — the log is a
      rollup, never frozen history. Streaks, terrain, heatmap and the weekly
      rollup were unchanged: they count active days and are indifferent to
      recurrence
- [x] **The check-in moment.** The immediate feedback that makes the loop worth
      repeating: the tick, the ring, the elevation rising, the streak
      advancing — one composed beat rather than four unrelated updates. Must
      say plainly when a check-in *extended a streak* versus merely happened.
      No XP, levels, badges or points; see Explicit Non-Goals
- [x] Weekly summary view (per-track task counts, streak status) — `/progress`
- [x] Monthly summary view — `/progress?period=month`. `monthBuckets` beside
      `weekBuckets`; `rollUp`, `dailyBreakdown` and `describePeriod` were
      already period-agnostic and were not touched. The window is a URL
      parameter, so the page stays a server component
- [x] Progress bar components (per Track, per Topic) — the topic stratum meter
      and the completion ring, shipped with the redesign
- [x] Milestone detection + simple celebratory UI. Shipped as **streak**
      milestones at 7/14/30/60/100 days, derived from the before/after streak
      pair the check-in already computes — so nothing is stored, no schema
      changed, and a milestone crossed on an earlier day cannot replay. The
      celebration is the existing check-in report line in a louder register (a
      solid `streak` caption box) plus a stronger version of the numeral's
      existing misregistration: no new surface, and no XP, badges or levels.
      The volume milestones in `lib/terrain.ts` (`ELEVATION_MILESTONES`, 10/50/
      100/250/500 cumulative check-ins) are a separate signal and stay drawn on
      the terrain
- [ ] Learning trajectory view — consistency and momentum over time, not a
      point-in-time count. Should answer: am I consistent, is my momentum
      improving, is progress trending up or declining, and is it sustained
      or a series of isolated bursts? The streak counter, `CompletionLog`,
      heatmap and terrain elevation are *inputs* to this, not the answer.
      Representation deliberately undecided (trend line, trajectory, rolling
      average, or otherwise) — choose it against real accumulated data.
      Sequencing: after the weekly/monthly summaries exist and several weeks
      of real completions have built up, so the shape is chosen rather than
      guessed.

## Phase 3 — Smart Coverage & Insights
- [ ] LLM call: generate suggested curriculum on Track creation
      (structured JSON output, Claude Haiku)
- [ ] Coverage comparison logic (plain code, per `SCHEMA.md` notes)
- [ ] LLM call: generate weekly/monthly insight remark from progress data
- [ ] Store remarks in InsightLog, display in UI
- [ ] Manual "regenerate insight" trigger (on-demand button, not automatic
      background job)

## Phase 4 — Personalization (future / not started until asked)
- [ ] UserPreferences storage (key/value)
- [ ] Preferences settings UI
- [ ] Inject preferences into insight prompt context
- [ ] A/B feel-check: does personalized tone actually feel better, or
      gimmicky? (worth a manual gut-check before investing further)

## Phase 5 — Structure & Exploration (future / representation undecided)
Making a Track's structure legible: what has been learned, what remains, and
how it is ordered. In scope as a capability; the form it takes is not decided.

- [ ] A richer visual representation of a Track's learning structure
      (Track → Topic → Task) that communicates covered vs. remaining ground
      and the progression through it
- [ ] Decide the representation only after evaluating the real learning
      experience and the data model. Candidates, none preferred: tree,
      dependency graph, mind map, progression path, radial layout,
      terrain-based, or something else entirely. **Do not lock this in
      early** — nothing about it should be built or half-built before the
      evaluation happens
- [ ] Prerequisites / dependency relations between Topics or Tasks — only if
      the chosen representation genuinely needs them. This is a schema
      change, so it waits on that decision rather than leading it

Depends on Phase 3: an LLM-generated curriculum gives a Track enough
structure to be worth exploring. `Topic.position` and `Task.position`
already store explicit order, so sequence is available without new schema.

## Explicitly Deferred / Not Planned Unless Requested
- Multi-user auth
- Agentic/autonomous study planning
- Mobile app
- Cloud deployment (Vercel or otherwise) — **not planned.** Rendred runs on
  one laptop and is not deployed. This is a standing constraint, not a
  deferral: see `docs/DECISIONS.md`.
