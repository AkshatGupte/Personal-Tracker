# Data Schema

Ground truth for `prisma/schema.prisma` — keep the two in sync.

**Superseded once, deliberately.** This file used to describe Track → Topic →
Task → TaskCheckIn → CompletionLog. Tasks are gone: a Topic tree replaced them,
and a leaf Topic *is* the unit of activity. Nothing was migrated — see
`docs/DECISIONS.md`.

## The shape, in one line

```
Track → Topic (recursive, max depth 5) → TopicActivity (one row per node per day)
```

A Topic with live children is a **parent**: it is not actionable and has no
activity of its own. A Topic with no live children is a **leaf**: it is the only
thing that can be worked. Neither is a stored flag — both are questions about
whether the node currently has children, which is what lets a leaf become a
parent and back again without any migration of its history.

## Entities

### Track
A top-level learning goal, e.g. "DSA" or "Spanish".

| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| name | string | |
| createdAt | datetime | |

**No cached streak columns**, and this is deliberate. A strict streak breaks
through *inactivity*, and inactivity writes nothing — so a cached number has no
code path that could expire it and would read as alive days after it lapsed.
Streaks, coverage and totals are derived from TopicActivity on every read.

### Topic
A node in a Track's tree. The same model is both branch and leaf.

| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| trackId | string | FK → Track, cascade |
| parentId | string? | null for a top-level topic; FK → Topic, cascade |
| name | string | |
| position | int | explicit order among siblings; shared by both views |
| depth | int | 1..5, denormalised so the limit is one read to enforce |
| deletedAt | datetime? | soft delete; the row and its history survive |
| createdAt | datetime | |

`depth` is denormalised on purpose: every insert and move checks it, and walking
to the root each time would make the commonest write the most expensive. It is
rewritten across the whole moved subtree inside the move's transaction — a stale
value there silently permits a six-level tree, since every later check reads it.

### TopicActivity
One row per topic per day, holding how many times that leaf was worked. **The
single source of truth for every activity figure in the app.**

| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| topicId | string | FK → Topic, cascade |
| date | datetime | local midnight, via `startOfDay()` in `lib/day.ts` |
| count | int | ≥ 1 while the row exists; stored uncapped |
| updatedAt | datetime | |

Unique on `(topicId, date)`, enforced in the database so a double submit cannot
produce two rows for one day.

A **count**, not a row per click: the product question is "how much was this
worked today", and undo has to decrement the same number the tiers read. At zero
the row is **deleted** rather than left at 0 — presence means activity, and a
zero row would be indistinguishable from a worked day in every query that reads
presence, the streak above all.

**The `(topicId, date)` key is also what makes backdating free** (2026-09-09).
`date` was never assumed to be today — it is whichever local midnight the write
names — so recording for a past day needed no column, no flag and no migration,
only a parameter. `lib/backdate.ts` limits it to the last 7 days
(`BACKDATE_DAYS`) and the server re-checks on every write. Everything downstream
is derived from these rows, so a backdated entry moves the streak, the heatmap,
the terrain and the coverage figures with no row rewritten to keep up — which is
the same property that makes a move or a soft delete correct for free.

There is deliberately **no per-track daily rollup table**. The old CompletionLog
was pure derived state that had to be rebuilt whenever anything was deleted or
moved; deriving instead means a move or a soft delete changes what the figures
mean without a single row being rewritten to keep up.

### InsightLog (Phase 3)
Stores generated LLM remarks so they're not regenerated unnecessarily and
so past insights remain viewable.

| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| trackId | string? | null if it's a cross-track insight |
| period | string | "weekly" \| "monthly" |
| generatedAt | datetime | |
| content | string | the LLM-generated remark text |

### UserPreferences (Phase 4 — future)
| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| key | string | e.g. "favoriteGame" |
| value | string | e.g. "Elden Ring" |

## Relationships

```
Track  1───n  Topic
Topic  1───n  Topic      (self, via parentId; max depth 5)
Topic  1───n  TopicActivity
```

Deleting a **Track** cascades and hard-deletes everything under it — that is the
only hard delete in the app, because a deleted track leaves no history anything
could still belong to. Deleting a **Topic** is a soft delete and is refused
while it has live children.

## Constraints & Defaults

- **Max depth is 5.** A depth-5 node cannot receive children. Enforced in
  `lib/tree.ts` (`canAddChild`, `canMove`), applied by the server actions, and
  additionally hidden in the UI. The UI hiding is a courtesy; the server check
  is the rule, because a rendered page describes a tree that may since have
  changed.
- **A move must not create a cycle.** Checked by walking *down* from the moving
  node: a node cannot be moved into its own descendant.
- **A move must fit entirely.** The check is `parent.depth + subtreeHeight(node)`,
  not the moved node alone — checking only the node would happily push its
  grandchildren past the limit.
- **A parent cannot be deleted while it has live children.** Refused rather than
  cascaded: cascading would take a whole subtree, and every leaf's history with
  it, on one click.
- **Only a leaf can receive activity**, re-checked on every write.
- **Soft-deleted nodes** leave current tree and coverage calculations
  immediately and keep their activity rows for historical views.
- `position` is rewritten as a dense `0..n-1` sequence for the whole sibling
  group on reorder, never swapped — rows can share a position, and swapping two
  equal numbers is a no-op that looks like a broken button.
- **Dates are stored the way Prisma writes them: ISO strings.** SQLite has no
  date type and orders by type class before value, so integer-millisecond rows
  silently match nothing on any `date >= ...` filter. `prisma/seed.mjs` asserts
  this rather than trusting it.

## Key Logic Notes (not schema, but affects it)

Three different questions, three different answers. Conflating them is the easy
mistake, and `lib/tree.ts` keeps them apart:

- **Leaf intensity** = that node's own count today. Tiers are fixed: 0 neutral,
  1-4 their own tier, 5+ the top tier. The stored count is never capped.
- **Parent coverage** = distinct *direct* children worked today / total direct
  children. Clicking one child five times does not move it — the figure is
  breadth, and touching the same corner repeatedly is not breadth. A child that
  is itself a parent counts as worked when anything beneath it was worked.
- **Track coverage** = distinct active leaves / total leaves, computed across all
  leaves at once. Deliberately *not* an average of the top-level topics'
  coverage, which would weight a topic holding two leaves the same as one holding
  twenty.

**A day is active when at least one *current* leaf received activity.** Rows
belonging to deleted nodes, or to nodes that have since gained children, stay in
history but cannot hold a streak up — otherwise deleting the last thing you ever
worked on would leave the streak it earned standing.

Streaks remain **strict and per-track**: a missed day resets to 0, with no
freezes and no forgiveness. `summariseStreak` in `lib/streak.ts` was not changed
by the restructure; only what feeds it did.

---

## Goals (added 2026-09-08)

A time-boxed target: "50 DSA problems by Sunday". **Deliberately not a Track.** A
Track is open-ended and never finishes — that is the product's core claim — while
a Goal has a target, a deadline and a terminal state. Modelling one as the other
would have forced a finish line onto the thing that must not have one, so they
are separate tables and a Goal carries its own progress rather than reading
`TopicActivity`.

```
Goal → GoalMilestone (one row per crossing, at most one per percent)
     → GoalProgress  (one row per write: the audit trail and the XP ledger)
```

### Goal

| Column | Notes |
|---|---|
| `target`, `unit` | What counts as done. Float, so "30 hours" and "2.5 books" both work |
| `currentProgress` | The live figure. Denormalised from `entries` because every card reads it |
| `highWater` | The highest `currentProgress` has ever been. **The anti-farming mechanism** |
| `startDate`, `deadline`, `cadence` | The window. `weekly`/`monthly` derive their own deadline |
| `status` | `active` \| `completed` \| `archived` — and **never `expired`** |

**`expired` is not a stored status, and that is load-bearing.** Expiry is a
question about the deadline and today, answered on read in `lib/goals.ts`. A
stored one would need something to run at midnight to set it, and with no server
process and no cron that something does not exist — so the column would read
"active" for a goal that expired last week. It is the same argument that keeps
streaks off `Track`.

**`highWater` is the one deliberate exception to derive-on-read.** The
anti-farming rule is a read-then-write — compare the incoming value against the
mark, then move it — so it has to be evaluated inside the transaction that writes
the new progress, and cannot be recomputed afterwards.

#### Linking a Goal to a Track (added 2026-09-09)

| Column | Notes |
|---|---|
| `trackId` | Set → advanced by activity anywhere on this track. `SetNull` |
| `topicId` | Set → advanced by activity on this node's subtree only. `SetNull` |

**At most one of the two is ever set, and a CHECK constraint enforces it** —
`CHECK (trackId IS NULL OR topicId IS NULL)`, written by hand in
`prisma/migrations/20260909120000_goal_track_link/migration.sql`. Both null means
progress is typed in, which is how every goal worked before this existed. A row
carrying both — a track, and a topic from a *different* track — would advance
from one while its card named the other, and nothing rendered would show it.
This is the same class of invariant as `@@unique([topicId, date])` and
`@@unique([goalId, percent])`: held by the database rather than remembered by
application code. "Linked" is therefore derived (`trackId != null || topicId !=
null`) and is not a flag.

**Two costs, both deliberate.** SQLite has no `ALTER TABLE ADD CONSTRAINT`, so
the migration rebuilds the table the way Prisma rebuilds SQLite tables. And
`schema.prisma` cannot express a CHECK, so `prisma migrate dev` may report drift
on `Goal` — **do not resolve that by dropping the constraint.**
`qa/goal-constraint.mjs` replays every migration into a throwaway database and
proves the constraint refuses the bad row.

`SetNull` rather than `Cascade` on both: deleting a Track must not delete the
goals that watched it. Such a goal keeps its `currentProgress` — the work really
was done — and falls back to being advanced by hand.

**Which goals an activity advances** is one query, and it is the only definition:
`OR: [{ trackId }, { topicId: { in: chain } }]`, where `chain` is the worked
leaf and its ancestors, at most `MAX_DEPTH` ids. The window and status test is
`advancesOn` in `lib/goalLink.ts`, applied to what comes back, and it takes **the
day the activity was recorded for** rather than today — so a backdated entry pays
only into windows that were open on that day.

#### Recurring goals (added 2026-09-09)

| Column | Notes |
|---|---|
| `seriesId` | Goals in one recurring series share this. Null for a one-off |

**A period is a row, never a reset.** Rolling over creates a *new* `Goal` for
the next window rather than zeroing `currentProgress` on this one. A reset would
leave no completion record and would overwrite the period's own XP ledger, so
`completionRate` and every window tally in `summariseGoals` would silently stop
meaning anything. With a row per period those functions needed **no changes at
all**.

**`@@unique([seriesId, startDate])` — one row per period, ever.** This is what
makes rolling forward *on read* safe: the roll is a read-then-write and two
concurrent renders of `/goals` can both find the next period missing. They
collide here and P2002 is absorbed, exactly as `@@unique([goalId, percent])`
arbitrates a milestone. One-off goals keep `NULL`, and SQLite treats NULLs as
distinct in a unique index, so any number of them may share a start date.

**Nothing rolls a series over on a schedule.** `rollSeriesForward` in
`lib/goalWrites.ts` runs from `getGoalBoard` *and* from the activity write path —
the second matters, or a recurring linked goal would stop counting for anyone who
never opens `/goals`. Periods abut exactly (next starts the day after the last
ended, same span), which is what lets exactly one member of a series match any
recorded day. Every missed period is created rather than skipped, so the
completion rate describes what actually happened. A rolled period writes no
ledger row and pays no XP; **archiving the newest period stops the series**, so
there is no `repeating` flag to be a second source of truth.

### GoalMilestone

One row per crossing, `@@unique([goalId, percent])`. **That constraint is the
whole "trigger only once" requirement**, enforced by the database rather than by
an application flag somebody has to remember to check: a double submit, a
decrease and re-cross, or two tabs racing all collide on it instead of paying
twice. `xp` is banked at award time so a later retune of the XP table cannot
silently restate what the ledger already paid.

### GoalProgress

Every write, including decreases and the ones that paid nothing — the brief asks
that progress history support future analytics, and a history that kept only the
rewarding half could not. `value` stores the resulting total so the series is
readable without replaying every delta from zero.

**A goal's XP is the sum of its rows, never a column.** A running total has no
way to be checked and every write is a chance for it to drift.

