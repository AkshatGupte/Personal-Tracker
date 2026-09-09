-- Goals that read their progress from a Track.
--
-- Two nullable links, and **at most one of them is ever set**. That invariant is
-- the whole reason this migration is hand-written rather than generated: it is a
-- CHECK constraint, Prisma cannot model one, and SQLite has no
-- `ALTER TABLE ... ADD CONSTRAINT` — a CHECK can only be introduced by rebuilding
-- the table. So the table is rebuilt the way Prisma itself rebuilds SQLite tables:
-- create the new shape, copy every row, drop the old, rename, recreate indexes.
--
-- **Why the constraint is worth the rebuild.** A goal carrying both a trackId and
-- a topicId belonging to a *different* track would advance from one track while
-- its card claimed to watch the other, and nothing on a rendered page would show
-- it. Applying the rule in application code would make it a thing to remember at
-- every write; in the database it is a thing that cannot happen. This project's
-- best invariants — `@@unique([topicId, date])`, `@@unique([goalId, percent])` —
-- are all of this kind.
--
-- **Known trade-off:** `prisma migrate dev` may report drift on this table,
-- because schema.prisma cannot express the CHECK and so the introspected
-- database will not match it. Documented in docs/SCHEMA.md. Do not "fix" the
-- drift by dropping the constraint.
--
-- `SetNull` on both foreign keys, never `Cascade`: deleting a Track must not
-- delete the goals that watched it. A goal that loses its link keeps its progress
-- and falls back to being advanced by hand — which is honest, because the work
-- really was done.

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "target" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "currentProgress" REAL NOT NULL DEFAULT 0,
    "highWater" REAL NOT NULL DEFAULT 0,
    "startDate" DATETIME NOT NULL,
    "deadline" DATETIME NOT NULL,
    "cadence" TEXT NOT NULL DEFAULT 'custom',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "trackId" TEXT,
    "topicId" TEXT,
    CONSTRAINT "Goal_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Goal_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    -- A goal watches a whole track, or one subtree, or nothing. Never two things.
    CONSTRAINT "Goal_one_link" CHECK ("trackId" IS NULL OR "topicId" IS NULL)
);

INSERT INTO "new_Goal" (
    "id", "title", "description", "category", "target", "unit",
    "currentProgress", "highWater", "startDate", "deadline", "cadence",
    "status", "createdAt", "completedAt"
)
SELECT
    "id", "title", "description", "category", "target", "unit",
    "currentProgress", "highWater", "startDate", "deadline", "cadence",
    "status", "createdAt", "completedAt"
FROM "Goal";

DROP TABLE "Goal";
ALTER TABLE "new_Goal" RENAME TO "Goal";

CREATE INDEX "Goal_status_idx" ON "Goal"("status");
CREATE INDEX "Goal_deadline_idx" ON "Goal"("deadline");
CREATE INDEX "Goal_trackId_idx" ON "Goal"("trackId");
CREATE INDEX "Goal_topicId_idx" ON "Goal"("topicId");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
