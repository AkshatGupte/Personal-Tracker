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
- [x] Strict streak logic (reset on missed day)
- [ ] Basic UI: list tracks, view topics/tasks, mark complete

## Phase 2 — Progress Visibility
- [x] Weekly summary view (per-track task counts, streak status) — `/progress`
- [ ] Monthly summary view — reuses `lib/rollup.ts`; needs only a
      `monthBuckets` function beside `weekBuckets`
- [x] Progress bar components (per Track, per Topic) — the topic stratum meter
      and the completion ring, shipped with the redesign
- [ ] Milestone detection (e.g. every 10/50/100 tasks) + simple celebratory UI
      — detection already exists in `lib/terrain.ts` (`reached`, `next`);
      what remains is the celebratory moment, which needs a "already seen"
      signal that is not currently stored
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
- Cloud deployment (Vercel) — only if/when the user wants remote access
