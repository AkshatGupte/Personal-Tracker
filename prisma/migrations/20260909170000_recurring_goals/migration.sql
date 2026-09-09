-- Recurring goals: a period is a row, linked by seriesId.
--
-- **Hand-written to avoid a table rebuild.** `ALTER TABLE ADD COLUMN` plus
-- `CREATE UNIQUE INDEX` adds both of these without touching the table
-- definition, which matters here for a specific reason: the previous migration
-- put a `CHECK (trackId IS NULL OR topicId IS NULL)` on Goal, and
-- `schema.prisma` cannot express a CHECK. A generated migration that chose to
-- rebuild the table would write a fresh CREATE TABLE without it and silently
-- drop the invariant. `qa/goal-constraint.mjs` replays every migration in this
-- directory and would catch that, but not creating the hazard is better than
-- catching it.
--
-- The unique index is the load-bearing part. Rolling a series forward is a
-- read-then-write that happens *on read* — there is no cron in this project — so
-- two concurrent renders of /goals can both find the next period missing and
-- both try to create it. They collide on this instead, and the loser is read as
-- "somebody else already made it", which is a success. One-off goals keep NULL
-- here and SQLite treats NULLs as distinct in a unique index, so any number of
-- them may share a start date.

ALTER TABLE "Goal" ADD COLUMN "seriesId" TEXT;

CREATE UNIQUE INDEX "Goal_seriesId_startDate_key" ON "Goal"("seriesId", "startDate");
CREATE INDEX "Goal_seriesId_idx" ON "Goal"("seriesId");
