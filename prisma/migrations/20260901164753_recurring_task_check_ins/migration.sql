/*
  Warnings:

  - You are about to drop the column `completedAt` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Task` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "TaskCheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskCheckIn_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Backfill: every task currently marked completed becomes one check-in, on the
-- local day it was completed.
--
-- This must run BEFORE the Task table is redefined, because that step drops the
-- columns it reads. Dates are normalised to *local* midnight to match
-- startOfDay() in lib/day.ts: SQLite stores these as UTC, so the value is
-- shifted into local time, truncated to the day, then shifted back.
INSERT INTO "TaskCheckIn" ("id", "taskId", "date", "createdAt")
SELECT
    lower(hex(randomblob(16))),
    "id",
    strftime('%Y-%m-%dT%H:%M:%S.000+00:00', datetime(date(datetime("completedAt", 'localtime')) || ' 00:00:00', 'utc')),
    "completedAt"
FROM "Task"
WHERE "status" = 'completed' AND "completedAt" IS NOT NULL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Task_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("createdAt", "difficulty", "id", "position", "title", "topicId") SELECT "createdAt", "difficulty", "id", "position", "title", "topicId" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_topicId_idx" ON "Task"("topicId");
CREATE INDEX "Task_topicId_position_idx" ON "Task"("topicId", "position");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TaskCheckIn_taskId_idx" ON "TaskCheckIn"("taskId");

-- CreateIndex
CREATE INDEX "TaskCheckIn_date_idx" ON "TaskCheckIn"("date");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCheckIn_taskId_date_key" ON "TaskCheckIn"("taskId", "date");
