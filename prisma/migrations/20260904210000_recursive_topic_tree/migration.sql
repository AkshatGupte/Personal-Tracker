-- Recursive topic tree, replacing the Track → Topic → Task structure.
--
-- The old model is dropped outright rather than migrated into the new one.
-- Per the restructure brief there is no meaningful data to preserve, and a
-- compatibility layer would have outlived its usefulness the moment it existed.
--
-- Gone: Task, TaskCheckIn, CompletionLog, and Track's cached streak columns.
-- A leaf Topic is now the unit of activity, and TopicActivity is the single
-- source of truth every figure in the app derives from.

PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "TaskCheckIn";
DROP TABLE IF EXISTS "CompletionLog";
DROP TABLE IF EXISTS "Task";
DROP TABLE IF EXISTS "Topic";
DROP TABLE IF EXISTS "Track";

CREATE TABLE "Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "depth" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Topic_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Topic_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Topic_trackId_idx" ON "Topic"("trackId");
CREATE INDEX "Topic_parentId_idx" ON "Topic"("parentId");
CREATE INDEX "Topic_trackId_parentId_position_idx" ON "Topic"("trackId", "parentId", "position");

CREATE TABLE "TopicActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TopicActivity_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TopicActivity_topicId_idx" ON "TopicActivity"("topicId");
CREATE INDEX "TopicActivity_date_idx" ON "TopicActivity"("date");
CREATE UNIQUE INDEX "TopicActivity_topicId_date_key" ON "TopicActivity"("topicId", "date");

PRAGMA foreign_keys=ON;
