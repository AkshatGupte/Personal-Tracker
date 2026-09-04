import { prisma } from "@/lib/prisma";
import { addDays, dayKey, startOfDay } from "@/lib/day";
import { EMPTY_STREAK, summariseStreak } from "@/lib/streak";
import {
  dailyBreakdown,
  monthBuckets,
  rollUp,
  weekBuckets,
  type PeriodBucket,
  type PeriodDay,
  type PeriodRollup,
} from "@/lib/rollup";
import { buildTerrain, TERRAIN_DAYS, type DayLog } from "@/lib/terrain";

/** Oldest day still inside the terrain window. */
function windowStart(): Date {
  return addDays(startOfDay(), -(TERRAIN_DAYS - 1));
}

/** Sums daily counts into the map the heatmap reads. */
function toCountsByDay(logs: DayLog[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const log of logs) {
    const key = dayKey(log.date);
    counts[key] = (counts[key] ?? 0) + log.tasksCompletedCount;
  }
  return counts;
}

/**
 * Streaks are recomputed from CompletionLog on every read, rather than read
 * out of Track.currentStreak.
 *
 * A strict streak has to break through inactivity, and inactivity by
 * definition writes nothing — so a user who stops for a week triggers no code
 * that could reset the cached number. Deriving it here means the displayed
 * streak is correct the moment it lapses, without a render doing writes. The
 * cached columns are still kept current by the write path, and this is what
 * they would say if rebuilt.
 */
function streakOf(activeDays: Date[]) {
  return activeDays.length === 0 ? EMPTY_STREAK : summariseStreak(activeDays);
}

/** One row per track per day, so a track's whole history is a small read. */
function groupByTrack(logs: { trackId: string; date: Date; tasksCompletedCount: number }[]) {
  const byTrack = new Map<string, DayLog[]>();
  for (const log of logs) {
    const list = byTrack.get(log.trackId) ?? [];
    list.push({ date: log.date, tasksCompletedCount: log.tasksCompletedCount });
    byTrack.set(log.trackId, list);
  }
  return byTrack;
}

/**
 * Everything the home screen needs: one terrain across all tracks, plus a
 * per-track summary carrying its own elevation.
 */
export async function getHomeProgress() {
  const since = windowStart();

  const today = startOfDay();

  const [tracks, logs, totalTasks, checkedInToday] = await Promise.all([
    prisma.track.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { topics: true } },
        topics: {
          select: {
            tasks: {
              select: {
                // Today's check-in only. A task is never permanently complete,
                // so the question is always "did this happen today".
                _count: { select: { checkIns: { where: { date: today } } } },
              },
            },
          },
        },
      },
    }),
    // The whole history, not just the terrain window: a streak can be longer
    // than 12 weeks, and truncating the read would silently cap it.
    prisma.completionLog.findMany({
      select: { trackId: true, date: true, tasksCompletedCount: true },
    }),
    prisma.task.count(),
    prisma.taskCheckIn.count({ where: { date: today } }),
  ]);

  const windowLogs = logs.filter((log) => log.date >= since);
  const allByTrack = groupByTrack(logs);
  const windowByTrack = groupByTrack(windowLogs);

  const rows = tracks.map((track) => {
    const tasks = track.topics.flatMap((topic) => topic.tasks);
    const active = (allByTrack.get(track.id) ?? [])
      .filter((log) => log.tasksCompletedCount > 0)
      .map((log) => log.date);

    return {
      id: track.id,
      name: track.name,
      currentStreak: streakOf(active).current,
      topicCount: track._count.topics,
      taskCount: tasks.length,
      completedCount: tasks.filter((task) => task._count.checkIns > 0).length,
      terrain: buildTerrain(windowByTrack.get(track.id) ?? []),
    };
  });

  return {
    rows,
    totalTasks,
    // "checked in today", not "finished ever" — the figure resets each morning.
    completedTasks: checkedInToday,
    terrain: buildTerrain(
      windowLogs.map((l) => ({ date: l.date, tasksCompletedCount: l.tasksCompletedCount })),
    ),
    countsByDay: toCountsByDay(windowLogs),
    bestStreak: rows.reduce((best, row) => Math.max(best, row.currentStreak), 0),
  };
}

/** Everything one track screen needs. Returns null when the id is unknown. */
export async function getTrackDetail(id: string) {
  const since = windowStart();
  const today = startOfDay();

  const track = await prisma.track.findUnique({
    where: { id },
    include: {
      topics: {
        // Explicit position first; createdAt only breaks ties, so existing
        // rows created before ordering existed still sort predictably.
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        include: {
          tasks: {
            orderBy: [{ position: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              title: true,
              difficulty: true,
              // Today's row only: yesterday's check-in must not read as checked.
              checkIns: { where: { date: today }, select: { id: true } },
            },
          },
        },
      },
    },
  });
  if (!track) return null;

  const logs = await prisma.completionLog.findMany({
    where: { trackId: id },
    select: { date: true, tasksCompletedCount: true },
  });

  const windowLogs = logs.filter((log) => log.date >= since);
  const streak = streakOf(
    logs.filter((log) => log.tasksCompletedCount > 0).map((log) => log.date),
  );

  const topics = track.topics.map((topic) => ({
    id: topic.id,
    name: topic.name,
    isExpected: topic.isExpected,
    taskCount: topic.tasks.length,
    completedCount: topic.tasks.filter((task) => task.checkIns.length > 0).length,
    tasks: topic.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      difficulty: task.difficulty,
      checkedInToday: task.checkIns.length > 0,
    })),
  }));

  // The ratio answers "how many of today's activities have been checked in",
  // and starts at zero each morning. It is deliberately not "how many tasks are
  // finished": a recurring activity never finishes, so that figure would sit at
  // 100% forever once each task had been done once.
  const taskCount = topics.reduce((total, topic) => total + topic.taskCount, 0);
  const completedCount = topics.reduce((total, topic) => total + topic.completedCount, 0);

  return {
    id: track.id,
    name: track.name,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    createdAt: track.createdAt,
    topics,
    taskCount,
    completedCount,
    terrain: buildTerrain(windowLogs),
    countsByDay: toCountsByDay(windowLogs),
  };
}

/** How many periods the summary looks back over, including the current one. */
export const SUMMARY_WEEKS = 8;
export const SUMMARY_MONTHS = 6;

/** The two windows the summary can be read over. */
export type Period = "week" | "month";

/**
 * How far back each window looks, and how each is built.
 *
 * The counts differ on purpose: eight weeks and six months are both roughly
 * "as far back as is still worth comparing against", and eight months of rows
 * would push the list past the fold for a view whose point is a quick read.
 */
const WINDOW: Record<Period, { count: number; buckets: (count: number, now: Date) => PeriodBucket[] }> = {
  week: { count: SUMMARY_WEEKS, buckets: weekBuckets },
  month: { count: SUMMARY_MONTHS, buckets: monthBuckets },
};

export type TrackPeriod = {
  id: string;
  name: string;
  currentStreak: number;
  /** The current period only. */
  completed: number;
  activeDays: number;
  /** True if the track has ever logged anything, at any time. */
  everActive: boolean;
};

/**
 * The summary over one window: an all-tracks series plus the current period
 * broken down per track.
 *
 * Reads the same CompletionLog rows everything else does, bucketed by the
 * shared rollup layer rather than by any maths of its own — which is why weeks
 * and months are the same function rather than two. `rollUp`, `dailyBreakdown`
 * and `describePeriod` never knew what a week was: they walk a bucket from its
 * start to its exclusive end, so handing them month buckets is the whole change.
 */
export async function getPeriodProgress(period: Period = "week", now: Date = new Date()) {
  const window = WINDOW[period];
  const buckets = window.buckets(window.count, now);

  const [tracks, logs] = await Promise.all([
    prisma.track.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
    prisma.completionLog.findMany({
      select: { trackId: true, date: true, tasksCompletedCount: true },
    }),
  ]);

  const periods = rollUp(
    logs.map((l) => ({ date: l.date, tasksCompletedCount: l.tasksCompletedCount })),
    buckets,
    now,
  );
  const current = periods[periods.length - 1];
  const currentDays = dailyBreakdown(
    logs.map((l) => ({ date: l.date, tasksCompletedCount: l.tasksCompletedCount })),
    buckets[buckets.length - 1],
    now,
  );

  const byTrack = groupByTrack(logs);
  const trackPeriods: TrackPeriod[] = tracks.map((track) => {
    const own = byTrack.get(track.id) ?? [];
    const thisPeriod = rollUp(own, [buckets[buckets.length - 1]], now)[0];
    const active = own.filter((log) => log.tasksCompletedCount > 0).map((log) => log.date);

    /*
      The streak is deliberately not scoped to the period. A streak is a
      property of the track right now, not of the window being looked at, and
      truncating it at the first of the month would report a 40-day streak as
      six.
    */
    return {
      id: track.id,
      name: track.name,
      currentStreak: streakOf(active).current,
      completed: thisPeriod.completed,
      activeDays: thisPeriod.activeDays,
      everActive: active.length > 0,
    };
  });

  return {
    period,
    periods,
    current,
    currentDays,
    tracks: trackPeriods,
    /** Nothing has ever been logged, anywhere. Distinct from a quiet period. */
    hasAnyHistory: logs.length > 0,
  };
}

export type PeriodProgress = Awaited<ReturnType<typeof getPeriodProgress>>;
export type { PeriodDay, PeriodRollup };
