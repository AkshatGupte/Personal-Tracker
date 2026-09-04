/**
 * The one write path that keeps history, streaks and live check-in state agreeing.
 *
 * `TaskCheckIn` is the ground truth: one row per task per day, meaning "I did
 * this activity today". `CompletionLog` is a *derived* per-track daily rollup of
 * those rows, and `Track.currentStreak` / `longestStreak` / `lastActivityDate`
 * are in turn a cache of what `CompletionLog` implies. Every layer can be
 * rebuilt from the one below it, and that is what the functions here do.
 *
 * Recompute, never increment. `increment: 1` double-counts on
 * check-in → undo → check-in, inflating elevation from a single activity.
 * Recomputing is idempotent, which is also what makes a double-click, a retry,
 * or a replayed action harmless.
 *
 * **CompletionLog is a rollup, not frozen history.** A day's row is whatever
 * the surviving check-ins for that day say it is. Deleting a task or a topic
 * therefore has to rebuild every day it touched, not just today — see
 * `recomputeDays`.
 */

import type { Prisma } from "@/lib/generated/prisma/client";
import { startOfDay } from "@/lib/day";
import { summariseStreak } from "@/lib/streak";

/** Any Prisma client, inside a transaction or not. */
type Db = Prisma.TransactionClient;

/** Check-ins recorded for one track on one day. */
async function countForDay(db: Db, trackId: string, date: Date): Promise<number> {
  return db.taskCheckIn.count({
    where: { date, task: { topic: { trackId } } },
  });
}

/**
 * Rewrites one day's CompletionLog row for one track from the check-ins that
 * currently exist for it.
 *
 * A day with no check-ins gets no row rather than a zero row: a zero would be
 * indistinguishable from real activity when read back, and would keep a streak
 * alive on a day nothing was done.
 */
async function writeDay(db: Db, trackId: string, date: Date): Promise<void> {
  const count = await countForDay(db, trackId, date);

  if (count === 0) {
    await db.completionLog.deleteMany({ where: { trackId, date } });
    return;
  }

  // date is normalised to local midnight on every write. The unique constraint
  // compares the whole DateTime, so writing `new Date()` here would quietly
  // create a second row for the day instead of updating one.
  await db.completionLog.upsert({
    where: { trackId_date: { trackId, date } },
    create: { trackId, date, tasksCompletedCount: count },
    update: { tasksCompletedCount: count },
  });
}

/**
 * The track's streak as its history currently stands, writing nothing.
 *
 * This exists so a caller can capture the streak *before* it mutates anything
 * and compare the two. It reads `CompletionLog` rather than the cached columns
 * on `Track` deliberately: the cache is only refreshed by a write, so after a
 * lapse it still holds the pre-lapse streak. Reading it as the "before" would
 * compare a stale 5 against a fresh 1 and report a genuine restart as a fall.
 *
 * `now` matters for the same reason — the current run has to end today or
 * yesterday — so pass the same `now` used for the write that follows.
 */
export async function readStreak(db: Db, trackId: string, now: Date = new Date()) {
  const activeDays = await db.completionLog.findMany({
    where: { trackId, tasksCompletedCount: { gt: 0 } },
    select: { date: true },
  });
  return summariseStreak(
    activeDays.map((day) => day.date),
    now,
  );
}

/** Rebuilds the cached streak columns from the track's full activity history. */
async function writeStreak(db: Db, trackId: string, now: Date) {
  const streak = await readStreak(db, trackId, now);

  await db.track.update({
    where: { id: trackId },
    data: {
      currentStreak: streak.current,
      longestStreak: streak.longest,
      lastActivityDate: streak.lastActivity,
    },
  });

  return streak;
}

/**
 * Rebuilds today's rollup for one track, then its streak.
 *
 * Call after anything that changes today and only today: a check-in or an undo.
 * Safe to call when nothing changed — it lands on the same result.
 */
export async function recomputeToday(db: Db, trackId: string, now: Date = new Date()) {
  const today = startOfDay(now);
  await writeDay(db, trackId, today);
  return writeStreak(db, trackId, now);
}

/**
 * Rebuilds an arbitrary set of days for one track, then its streak.
 *
 * This is the deletion path. Deleting a task or a topic removes check-ins
 * across its whole history, so every day it contributed to is now wrong — not
 * just today's. The caller collects those dates *before* deleting, because the
 * cascade takes the rows with it and they cannot be found afterwards.
 *
 * Days that end up with no surviving check-ins lose their row entirely, which
 * is how a streak correctly breaks when the only activity on a day is deleted.
 */
export async function recomputeDays(
  db: Db,
  trackId: string,
  dates: Date[],
  now: Date = new Date(),
) {
  // De-duplicated by timestamp: several deleted tasks commonly share a day, and
  // rewriting the same row repeatedly is wasted work rather than wrong.
  const unique = new Map(dates.map((date) => [date.getTime(), date]));
  for (const date of unique.values()) {
    await writeDay(db, trackId, date);
  }
  return writeStreak(db, trackId, now);
}

/**
 * Every day a set of tasks has ever been checked in on, with the track they
 * belong to. Must be called before the deletion that removes them.
 */
export async function affectedDays(
  db: Db,
  where: Prisma.TaskCheckInWhereInput,
): Promise<Date[]> {
  const rows = await db.taskCheckIn.findMany({
    where,
    select: { date: true },
    distinct: ["date"],
  });
  return rows.map((row) => row.date);
}

/** The track a task belongs to, or null if the task is gone. */
export async function trackIdForTask(db: Db, taskId: string): Promise<string | null> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { topic: { select: { trackId: true } } },
  });
  return task?.topic.trackId ?? null;
}
