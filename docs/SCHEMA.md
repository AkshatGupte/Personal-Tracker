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
