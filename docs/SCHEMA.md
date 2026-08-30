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
An individual completable item within a Topic (e.g. "Solve: Two Sum").

| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| topicId | string | foreign key → Topic |
| title | string | |
| difficulty | string? | optional: easy / medium / hard |
| position | int | explicit order within the Topic; appended as max+1 |
| status | string | "pending" \| "completed" |
| completedAt | datetime? | null until completed |
| createdAt | datetime | |

### CompletionLog
One row per day per track — used to compute streaks and weekly/monthly
rollups without recalculating from raw task data every time.

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
Track 1---N Topic 1---N Task
Track 1---N CompletionLog
Track 1---N InsightLog (optional)
```

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
| Task | `status` defaults `"pending"` | tasks start incomplete |
| CompletionLog | `tasksCompletedCount` defaults `0` | |
| all | `createdAt` defaults to now | |
| Topic, Task, CompletionLog | index on the foreign key; Task also on `status` | keeps per-track and pending/completed lookups cheap |
| Topic, Task | `position` defaults `0`, composite index with the parent id | ordered reads without a sort |

**Ordering note:** Topics and Tasks are ordered by `position` with `createdAt`
only breaking ties. Order is stored rather than inferred from creation time,
because a generated curriculum is a sequence and creation order does not
survive editing or regeneration. Nothing reorders rows yet; the field exists so
that ordering is not retrofitted later.

**Type note:** SQLite has no dedicated date or enum type. All `date`/`datetime`
fields are stored as `DateTime`, and `status`/`difficulty` are plain strings
validated in application code.

**Phase note:** only Track, Topic, Task and CompletionLog exist in
`prisma/schema.prisma` today. InsightLog (Phase 3) and UserPreferences
(Phase 4) are documented below but deliberately not modelled yet.

## Key Logic Notes (not schema, but affects it)

- **Streak calculation:** on each task completion, upsert today's
  `CompletionLog` row for that track. A scheduled/on-load check compares
  `lastActivityDate` to today — if more than 1 day has passed with no log,
  `currentStreak` resets to 0.
- **Coverage gap detection:** compare the set of `Topic.name` where
  `isExpected = true` and no completed `Task` exists, against the full
  expected list. This is plain code — no LLM call needed for the comparison
  itself, only for generating the expected list and the final remark text.
