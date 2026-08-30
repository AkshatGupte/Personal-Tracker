import { prisma } from "@/lib/prisma";
import { addDays, dayKey, startOfDay } from "@/lib/day";
import { EMPTY_STREAK, summariseStreak } from "@/lib/streak";
import {
  dailyBreakdown,
  rollUp,
  weekBuckets,
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

  const [tracks, logs, totalTasks, completedTasks] = await Promise.all([
    prisma.track.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { topics: true } },
        topics: { select: { tasks: { select: { status: true } } } },
      },
    }),
    // The whole history, not just the terrain window: a streak can be longer
    // than 12 weeks, and truncating the read would silently cap it.
    prisma.completionLog.findMany({
      select: { trackId: true, date: true, tasksCompletedCount: true },
    }),
    prisma.task.count(),
    prisma.task.count({ where: { status: "completed" } }),
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
      completedCount: tasks.filter((task) => task.status === "completed").length,
      terrain: buildTerrain(windowByTrack.get(track.id) ?? []),
    };
  });

  return {
    rows,
    totalTasks,
    completedTasks,
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
            select: { id: true, title: true, difficulty: true, status: true },
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
    completedCount: topic.tasks.filter((task) => task.status === "completed").length,
    tasks: topic.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      difficulty: task.difficulty,
      status: task.status,
    })),
  }));

  // The completion ratio is derived from live task state, never from history:
  // it answers "how much of this track is done now", which is a different
  // question from "what was finished on each day".
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

/** How many weeks the summary looks back over, including the current one. */
export const SUMMARY_WEEKS = 8;

export type TrackWeek = {
  id: string;
  name: string;
  currentStreak: number;
  /** This week only. */
  completed: number;
  activeDays: number;
  /** True if the track has ever logged anything, at any time. */
  everActive: boolean;
};

/**
 * The weekly summary: one all-tracks series plus this week broken down per
 * track. Reads the same CompletionLog rows everything else does, bucketed by
 * the shared rollup layer rather than by any maths of its own.
 */
export async function getWeeklyProgress(now: Date = new Date()) {
  const buckets = weekBuckets(SUMMARY_WEEKS, now);

  const [tracks, logs] = await Promise.all([
    prisma.track.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
    prisma.completionLog.findMany({
      select: { trackId: true, date: true, tasksCompletedCount: true },
    }),
  ]);

  const weeks = rollUp(
    logs.map((l) => ({ date: l.date, tasksCompletedCount: l.tasksCompletedCount })),
    buckets,
    now,
  );
  const current = weeks[weeks.length - 1];
  const currentDays = dailyBreakdown(
    logs.map((l) => ({ date: l.date, tasksCompletedCount: l.tasksCompletedCount })),
    buckets[buckets.length - 1],
    now,
  );

  const byTrack = groupByTrack(logs);
  const trackWeeks: TrackWeek[] = tracks.map((track) => {
    const own = byTrack.get(track.id) ?? [];
    const thisWeek = rollUp(own, [buckets[buckets.length - 1]], now)[0];
    const active = own.filter((log) => log.tasksCompletedCount > 0).map((log) => log.date);

    return {
      id: track.id,
      name: track.name,
      currentStreak: streakOf(active).current,
      completed: thisWeek.completed,
      activeDays: thisWeek.activeDays,
      everActive: active.length > 0,
    };
  });

  return {
    weeks,
    current,
    currentDays,
    tracks: trackWeeks,
    /** Nothing has ever been logged, anywhere. Distinct from a quiet week. */
    hasAnyHistory: logs.length > 0,
  };
}

export type WeeklyProgress = Awaited<ReturnType<typeof getWeeklyProgress>>;
export type { PeriodDay, PeriodRollup };
