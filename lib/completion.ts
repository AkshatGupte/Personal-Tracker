/**
 * The one write path that keeps history, streaks and live task state agreeing.
 *
 * Task.status and Task.completedAt own whether a single task is done.
 * CompletionLog owns daily history. Today's row is a *recomputed rollup* of the
 * tasks whose completedAt falls in today; every earlier row is frozen and is
 * never rewritten, so a streak that was earned stays earned.
 *
 * Recompute, never increment. `increment: 1` double-counts on
 * complete → uncomplete → complete, inflating elevation from a single task.
 * Recomputing is idempotent, which is also what makes a double-click, a retry,
 * or a replayed action harmless.
 *
 * Track.currentStreak / longestStreak / lastActivityDate are a cache of what
 * CompletionLog already implies, and are rebuilt here from scratch rather than
 * nudged, for the same reason.
 */

import type { Prisma } from "@/lib/generated/prisma/client";
import { addDays, startOfDay } from "@/lib/day";
import { summariseStreak } from "@/lib/streak";

/** Any Prisma client, inside a transaction or not. */
type Db = Prisma.TransactionClient;

/**
 * Rewrites today's CompletionLog row for one track from live task state, then
 * rebuilds that track's cached streak numbers.
 *
 * Call this after anything that can change which tasks count as completed
 * today: completing, uncompleting, or deleting a task or a topic. Safe to call
 * when nothing changed — it lands on the same result.
 */
export async function recomputeToday(db: Db, trackId: string, now: Date = new Date()) {
  const dayStart = startOfDay(now);
  const dayEnd = addDays(dayStart, 1);

  const completedToday = await db.task.count({
    where: {
      status: "completed",
      completedAt: { gte: dayStart, lt: dayEnd },
      topic: { trackId },
    },
  });

  if (completedToday === 0) {
    // No row rather than a zero row: a zero would be indistinguishable from a
    // real day of work when read back, and would keep a streak alive on a day
    // nothing was finished.
    await db.completionLog.deleteMany({ where: { trackId, date: dayStart } });
  } else {
    // date is normalised to local midnight on every write. The unique
    // constraint compares the whole DateTime, so writing `new Date()` here
    // would quietly create a second row for today instead of updating one.
    await db.completionLog.upsert({
      where: { trackId_date: { trackId, date: dayStart } },
      create: { trackId, date: dayStart, tasksCompletedCount: completedToday },
      update: { tasksCompletedCount: completedToday },
    });
  }

  const activeDays = await db.completionLog.findMany({
    where: { trackId, tasksCompletedCount: { gt: 0 } },
    select: { date: true },
  });
  const streak = summariseStreak(
    activeDays.map((day) => day.date),
    now,
  );

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

/** The track a task belongs to, or null if the task is gone. */
export async function trackIdForTask(db: Db, taskId: string): Promise<string | null> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { topic: { select: { trackId: true } } },
  });
  return task?.topic.trackId ?? null;
}
