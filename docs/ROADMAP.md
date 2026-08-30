# Roadmap

Work through phases in order. Do not start a later phase until the current
one is functionally complete, unless explicitly told otherwise.

## Phase 1 — Core Tracking (foundation)
- [x] Project scaffold: Next.js + TypeScript + Tailwind + Prisma + SQLite
- [x] Prisma schema from `docs/SCHEMA.md` (Track, Topic, Task, CompletionLog)
- [x] CRUD: create/edit/delete Track
- [x] CRUD: add Topic under Track
- [x] CRUD: add Task under Topic
- [ ] Mark Task complete → updates CompletionLog + streak logic
- [ ] Strict streak logic (reset on missed day)
- [ ] Basic UI: list tracks, view topics/tasks, mark complete

## Phase 2 — Progress Visibility
- [ ] Weekly summary view (per-track task counts, streak status)
- [ ] Monthly summary view
- [ ] Progress bar components (per Track, per Topic)
- [ ] Milestone detection (e.g. every 10/50/100 tasks) + simple celebratory UI

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

## Explicitly Deferred / Not Planned Unless Requested
- Multi-user auth
- Agentic/autonomous study planning
- Mobile app
- Cloud deployment (Vercel) — only if/when the user wants remote access
