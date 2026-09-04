# Data Schema

Database: SQLite via Prisma. This is the ground-truth schema — Claude Code
should generate the actual `schema.prisma` file from this and keep it in
sync if changes are made.

## Entities

### Track
Represents a top-level learning goal (e.g. "DSA", "Spanish").

| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| name | string | e.g. "DSA" |
| createdAt | datetime | |
| currentStreak | int | strict streak count, resets to 0 on missed day |
| longestStreak | int | best streak ever, for motivation display |
| lastActivityDate | date? | null until the first completion; used to compute streak resets |

### Topic
A sub-category within a Track (e.g. "Arrays", "Graphs").

| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| trackId | string | foreign key → Track |
| name | string | e.g. "Arrays" |
| isExpected | bool | true if part of the LLM-suggested curriculum, false if user-added ad hoc |
| createdAt | datetime | |

### Task
A **persistent recurring learning activity** within a Topic — "Practice array
problems", "Read about binary trees". A Task is never permanently completed: it
stays available indefinitely and is checked in once per day. There is no
one-time task type and no `kind` discriminator; recurring is the only model.

| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| topicId | string | foreign key → Topic |
| title | string | |
| difficulty | string? | optional: easy / medium / hard |
| position | int | explicit order within the Topic; appended as max+1 |
| createdAt | datetime | |

**`status` and `completedAt` are removed.** They modelled a terminal state a
recurring activity never reaches: a single timestamp cannot hold "done Monday
*and* Tuesday", and it was overwritten on each new check-in. Whether a Task was
done on a given day is a question for `TaskCheckIn`.

### TaskCheckIn
One row per Task per day. This is the record the whole product is built on:
the user's statement that they did this activity today.

| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| taskId | string | foreign key → Task |
| date | date | local midnight, same convention as CompletionLog |
| createdAt | datetime | the actual time of day, kept for interest only |

A check-in is created and deleted, never toggled through a status field — the
row's existence *is* the state. Undoing today's check-in deletes today's row
and leaves every earlier row untouched.

### CompletionLog
One row per day per track — a rollup of that day's `TaskCheckIn` rows, so
streaks and weekly/monthly rollups can be read without recounting check-ins
every time. Unchanged in shape: only what it is computed *from* changes.

| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| trackId | string | foreign key → Track |
| date | date | one entry per track per day |
| tasksCompletedCount | int | count of tasks completed that day |

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
Track 1---N Topic 1---N Task 1---N TaskCheckIn
Track 1---N CompletionLog
Track 1---N InsightLog (optional)
```

`TaskCheckIn` is the ground truth for activity. `CompletionLog` is a derived
per-track daily rollup of it and can always be rebuilt from it.

All child relations use **cascade delete** — deleting a Track removes its
Topics, Tasks and CompletionLogs, so "delete Track" cannot leave orphans.

## Constraints & Defaults (as implemented)

Added when the schema was built; recorded here so this file matches
`prisma/schema.prisma`.

| Where | Rule | Why |
|---|---|---|
| CompletionLog | `@@unique([trackId, date])` | enforces the "one entry per track per day" rule above |
| Track | `currentStreak`, `longestStreak` default `0` | a new track starts with no streak |
| Track | `lastActivityDate` nullable | nothing has been completed yet |
| Topic | `isExpected` defaults `false` | topics are user-added unless the curriculum marks them |
| TaskCheckIn | `@@unique([taskId, date])` | one check-in per task per day — the rule the whole model rests on, enforced by the database rather than by application code |
| CompletionLog | `tasksCompletedCount` defaults `0` | |
| all | `createdAt` defaults to now | |
| Topic, Task, CompletionLog | index on the foreign key | keeps per-track lookups cheap |
| TaskCheckIn | index on `taskId`, and on `date` | per-task history and per-day rollups are the two read shapes |
| Topic, Task | `position` defaults `0`, composite index with the parent id | ordered reads without a sort |

**Ordering note:** Topics and Tasks are ordered by `position` with `createdAt`
only breaking ties. Order is stored rather than inferred from creation time,
because a generated curriculum is a sequence and creation order does not
survive editing or regeneration. Nothing reorders rows yet; the field exists so
that ordering is not retrofitted later.

**Type note:** SQLite has no dedicated date or enum type. All `date`/`datetime`
fields are stored as `DateTime`, and `difficulty` is a plain string validated in
application code.

**Cascade note:** `TaskCheckIn` cascades from `Task`. Deleting a Task therefore
erases its history, and the days it contributed to must be recomputed — see the
deletion rule in Key Logic Notes.

**Phase note:** Track, Topic, Task, TaskCheckIn and CompletionLog all exist in
`prisma/schema.prisma`. InsightLog (Phase 3) and UserPreferences (Phase 4) are
documented below and deliberately not modelled yet.

## Key Logic Notes (not schema, but affects it)

- **Streak calculation:** on each check-in, recompute today's `CompletionLog`
  row for that track, then rebuild the streak from the full set of active days.
  The displayed streak is derived on read (see below), because inactivity
  writes nothing and so no write path could ever catch a lapse.
- **Who owns what:** `TaskCheckIn` owns the ground truth — one row means "this
  activity was done on this day". `CompletionLog` owns the per-track daily
  rollup of those rows. `Track.currentStreak` / `longestStreak` /
  `lastActivityDate` are a cache of what `CompletionLog` implies. Each layer is
  rebuildable from the one below it, and nothing is stored that could be
  derived without cost.
- **A Task has no completion state of its own.** "Checked in today" is a
  question about `TaskCheckIn`, answered per render for the current day. It is
  not a column, and it does not persist into tomorrow.
- **The per-track ratio changes meaning.** It was "how many of this track's
  tasks are finished", which for a recurring activity is either meaningless or
  permanently 100%. It becomes **"how many of today's activities have been
  checked in"** — a figure that starts at zero each morning and is the point of
  the daily loop. Every place showing `N / M done` reads this instead.
- **Today's row is a rollup, earlier rows are frozen:** on check-in, undo or
  deletion, today's `CompletionLog` row is recomputed by counting today's
  `TaskCheckIn` rows for that track. Earlier days are never rewritten, so a
  streak that was earned stays earned. Counts are recomputed, never
  incremented, which makes repeat clicks and retries harmless.
- **Deleting a Task erases its history.** Check-ins cascade, so a deleted Task
  takes its past days with it. Every `CompletionLog` day that task contributed
  to is now wrong, not just today's. Either recompute the affected days from
  the surviving check-ins, or decide deliberately that history is frozen and
  keep the rows — **this is an open decision and must be settled before the
  check-in engine is written**, because the two answers need different code.
- **A day with no completions has no row.** Zero-count rows are deleted rather
  than stored, so a row always means real activity.
- **`date` is always local midnight.** `@@unique([trackId, date])` compares the
  whole `DateTime`, so every write normalises through the shared `startOfDay()`
  helper in `lib/day.ts`; reads use the same helper. Day boundaries are local,
  not UTC — see `docs/DECISIONS.md`.
- **The displayed streak is recomputed from `CompletionLog` on read.**
  Inactivity writes nothing, so a lapse cannot be caught by a write; deriving
  it on read is what makes the strict reset actually appear.
- **Coverage gap detection:** compare the set of `Topic.name` where
  `isExpected = true` and none of whose Tasks has ever been checked in, against
  the full expected list. "Untouched" now means no `TaskCheckIn` has ever
  existed for any task under that topic — which is a stronger and more useful
  signal than the old "no task marked complete", because it also exposes topics
  that were started and then abandoned. This is plain code — no LLM call needed for the comparison
  itself, only for generating the expected list and the final remark text.
