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

- [x] **Backdated and faster activity entry** (2026-09-09). Activity can be
      recorded for any of the last 7 days — today and the six before it — from a
      day strip above the flat leaf list, with counts and undo following the
      chosen day. The window is `BACKDATE_DAYS` in `lib/windows.ts`, the rules
      are pure functions in `lib/backdate.ts`, and the server re-checks the day
      on every write rather than trusting the chips. Backdating retroactively
      moves the streak, because streaks are derived; that is stated in words on
      the row, in both directions, as a description and never a celebration.
      `summariseStreak` is untouched — strict is still strict. Keyboard roving
      (up/down, j/k, Home/End, Enter, U) on the same list. **No schema change**:
      `TopicActivity` was already keyed per topic per day. Deliberately not
      extended to the tree view, whose coverage figures are today-signals.

      Built ahead of the trajectory view below because that item is blocked on
      accumulated activity rather than on effort, and being unable to log a day
      you missed is one of the reasons there is so little of it.

- [x] **Weekly review + Today, as one feature** (2026-09-09). `/review` answers
      what happened this week — how much, across which tracks, what slipped, which
      goal periods were met or missed — and `/today` turns it into action, leading
      with the ranked list of what needs doing now. **One read (`getReview`)
      composes the three that already existed and adds no statistic**, and
      `buildFocus` is the single ranked list both screens render, so they cannot
      form two opinions. `streakState` was added beside `summariseStreak` without
      altering it — strict stays strict and "at risk" is a description. The review
      names its window explicitly, because the project has two different spans
      both called "this week". A partial week may not claim a decline. Recurring
      goal periods appear as themselves, with no special-case statistics.
      `qa/review.test.mjs`.

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
- [x] **Goals linked to a Track** (2026-09-09). A goal can read its progress from
      a whole Track or from one Topic subtree instead of being typed in, so the
      work is recorded once — in the tracker — rather than twice. `recordActivity`
      advances every watching goal **inside the same transaction**, routed through
      the existing reward path (`applyGoalProgress`, extracted to
      `lib/goalWrites.ts`) rather than a second one. At most one of
      `Goal.trackId` / `Goal.topicId` is set, enforced by a **CHECK constraint**;
      both are `SetNull`, so deleting a Track leaves its goals with their progress
      and makes them manual again. Nothing is backfilled; a linked goal starts at
      zero. Backdated activity pays only into windows that were open on that day.
      A linked card loses `+1` and "Set to…". No celebration on the track page —
      the confetti stays on `/goals`. `qa/goal-link.test.mjs` and
      `qa/goal-constraint.mjs`.
- [x] **Recurring goals** (2026-09-09). "Repeats" on the create form gives a goal
      a `seriesId`; when a period's window closes the next one is created — **as
      a new row, never a reset of the old one**, so the completed history and the
      XP ledger survive and `summariseGoals` needed no changes. Rolled forward
      **on read** (there is no cron), on `/goals` *and* on the activity path, so a
      recurring linked goal still counts for somebody who never opens the goals
      screen. **Every missed period is materialised**, so three weeks away leaves
      three honest misses rather than a flattered completion rate. One row per
      period is enforced by `@@unique([seriesId, startDate])`, which is what makes
      rolling on read safe against concurrent renders. A rolled period pays no XP.
      Archiving the newest period stops the series — no new flag.
      `qa/goal-series.test.mjs`.

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
