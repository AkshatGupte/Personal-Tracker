# Roadmap

Work through phases in order. Do not start a later phase until the current
one is functionally complete, unless explicitly told otherwise.

## Phase 1 — Core Tracking (foundation)
- [x] Project scaffold: Next.js + TypeScript + Tailwind + Prisma + SQLite
- [x] Prisma schema from `docs/SCHEMA.md`
      — **superseded.** Shipped as Track/Topic/Task/CompletionLog; replaced by
      the recursive Topic tree in the restructure below. Task, TaskCheckIn and
      CompletionLog no longer exist
- [x] CRUD: create/edit/delete Track
- [x] CRUD: add Topic under Track
- [x] CRUD: add Task under Topic
      — **superseded.** Tasks are gone; a leaf Topic is the unit of activity and
      Topics nest instead
- [x] Mark Task complete → updates CompletionLog + streak logic
      — **superseded twice.** First by the daily check-in (Phase 2), then by the
      activity model: `TopicActivity` is now the only activity table and every
      figure derives from it on read
- [x] Strict streak logic (reset on missed day) — unchanged by both
      restructures; `summariseStreak` never knew what fed it
- [x] Basic UI: list tracks, view topics/tasks, mark complete

## Phase 2 — Progress Visibility

- [x] **Daily check-in model — the core product loop.**
      — **superseded by the topic-tree restructure.** A leaf Topic replaced the
      Task, and activity is a per-node, per-day *count* rather than a once-daily
      check-in, so a leaf can be worked several times in one day. `TaskCheckIn`
      and `CompletionLog` were dropped; `TopicActivity` is the single source of
      truth. Streaks, terrain, heatmap and the rollup layer were again unchanged
      — they count active days and are indifferent to what produced them
- [x] **The check-in moment** — the immediate feedback that makes the loop worth
      repeating, as one composed beat rather than four unrelated updates. No XP,
      levels, badges or points; see Explicit Non-Goals
      — **partly retired.** `CheckInBeat`/`CheckInReport` published from the task
      row and went with tasks. Recording activity now confirms with an optimistic
      count and a shatter, which keeps the "that landed" half; the composed beat
      and the streak-milestone celebration are gone; `milestoneCrossed` and
      `STREAK_MILESTONES` were deleted on 2026-09-06 after four handoffs with no
      caller
- [x] Weekly summary view (per-track activity, coverage, streak status) — `/progress`
- [x] Monthly summary view — `/progress?period=month`. `monthBuckets` beside
      `weekBuckets`; `rollUp`, `dailyBreakdown` and `describePeriod` were
      already period-agnostic and were not touched. The window is a URL
      parameter, so the page stays a server component
- [x] Progress bar components (per Track, per Topic) — the coverage ring and the
      per-parent coverage rule in the tree view
- [x] Milestone detection + simple celebratory UI. Shipped as **streak**
      milestones at 7/14/30/60/100 days, derived rather than stored, so a
      milestone crossed on an earlier day cannot replay
      — **retired, and the code is gone as of 2026-09-06.** The celebration
      lived in the check-in report line, which the restructure removed;
      `milestoneCrossed`, `STREAK_MILESTONES` and their suite were deleted
      rather than kept waiting for a caller. If a streak celebration returns it
      belongs on the first activity of a day and should be written against the
      activity model, not restored from `git log -- lib/streak.ts`. The volume milestones in
      `lib/terrain.ts` (`ELEVATION_MILESTONES`, 10/50/100/250/500 cumulative
      activities) are a separate signal and are still drawn on the terrain
- [x] **Recursive Topic tree + contribution tracking.** Tracks hold a Topic tree
      up to 5 levels deep; leaves are the unit of activity and carry a per-day
      click count with undo. Parent coverage is distinct direct children worked;
      track coverage is distinct active leaves over all leaves. Flat and tree
      views share one persisted sibling order. Moves are cycle- and depth-checked
      server-side, deletes of parents are refused, deleted nodes are soft-deleted
      and stay in history. Green (`--activity-1..5`) is the one new colour and
      means only intensity

- [ ] Learning trajectory view — consistency and momentum over time, not a
      point-in-time count. Should answer: am I consistent, is my momentum
      improving, is progress trending up or declining, and is it sustained
      or a series of isolated bursts? The streak counter, `TopicActivity`,
      heatmap and terrain elevation are *inputs* to this, not the answer.
      Representation deliberately undecided (trend line, trajectory, rolling
      average, or otherwise) — choose it against real accumulated data.
      Sequencing: after the weekly/monthly summaries exist and several weeks
      of real activity have built up, so the shape is chosen rather than
      guessed.

## Goals — Goal Tracking & Rewards (added 2026-09-08, outside the phase order)

Requested directly and built ahead of the remaining Phase 2 item. A Goal is a
time-boxed target with a deadline and a terminal state — the opposite shape to a
Track, which never finishes. See `docs/SCHEMA.md` and the XP note in `CLAUDE.md`.

- [x] Goal model: title, description, category, target, unit, start, deadline,
      weekly/monthly/custom cadence, status
- [x] Dashboard: totals, completion rate, average progress, week/month/all-time
      tallies, goal streak, category performance
- [x] Goal cards: animated bar with milestone marks, momentum against the
      deadline, escalating deadline weight, fast `+1` and set-to paths
- [x] Milestones at 25/50/75/100, each paying once — enforced by a unique
      constraint, not a flag
- [x] XP ledger with an anti-farming high-water mark; three celebration tiers
- [x] Filters (all/active/completed/expired/archived) and a completed history
      that is never removed
- [x] `qa/goals.test.mjs` — 48 assertions over the reward and momentum rules

Not built, and deliberately: no levels, no badges, no cross-goal leaderboard.
The XP reversal is scoped to Goals only — see `CLAUDE.md`.

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
      (Track → nested Topics) that communicates covered vs. remaining ground
      and the progression through it
- [ ] Decide the representation only after evaluating the real learning
      experience and the data model. Candidates, none preferred: tree,
      dependency graph, mind map, progression path, radial layout,
      terrain-based, or something else entirely. **Do not lock this in
      early** — nothing about it should be built or half-built before the
      evaluation happens
- [ ] Prerequisites / dependency relations between Topics — only if
      the chosen representation genuinely needs them. This is a schema
      change, so it waits on that decision rather than leading it

Depends on Phase 3: an LLM-generated curriculum gives a Track enough
structure to be worth exploring. `Topic.position` already stores explicit order
at every level, so sequence is available without new schema — and the tree view
shipped with the restructure covers part of what this phase imagined.

## Explicitly Deferred / Not Planned Unless Requested
- Multi-user auth
- Agentic/autonomous study planning
- Mobile app
- Cloud deployment (Vercel or otherwise) — **not planned.** Rendred runs on
  one laptop and is not deployed. This is a standing constraint, not a
  deferral: see `docs/DECISIONS.md`.
