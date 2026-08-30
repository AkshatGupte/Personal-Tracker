import { prisma } from "@/lib/prisma";
import { buildTerrain, dayKey, TERRAIN_DAYS, type DayLog } from "@/lib/terrain";

/** Oldest day still inside the terrain window. */
function windowStart(): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (TERRAIN_DAYS - 1));
  return start;
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
    prisma.completionLog.findMany({
      where: { date: { gte: since } },
      select: { trackId: true, date: true, tasksCompletedCount: true },
    }),
    prisma.task.count(),
    prisma.task.count({ where: { status: "completed" } }),
  ]);

  const byTrack = new Map<string, DayLog[]>();
  for (const log of logs) {
    const list = byTrack.get(log.trackId) ?? [];
    list.push({ date: log.date, tasksCompletedCount: log.tasksCompletedCount });
    byTrack.set(log.trackId, list);
  }

  const rows = tracks.map((track) => {
    const tasks = track.topics.flatMap((topic) => topic.tasks);
    return {
      id: track.id,
      name: track.name,
      currentStreak: track.currentStreak,
      topicCount: track._count.topics,
      taskCount: tasks.length,
      completedCount: tasks.filter((task) => task.status === "completed").length,
      terrain: buildTerrain(byTrack.get(track.id) ?? []),
    };
  });

  return {
    rows,
    totalTasks,
    completedTasks,
    terrain: buildTerrain(logs.map((l) => ({ date: l.date, tasksCompletedCount: l.tasksCompletedCount }))),
    countsByDay: toCountsByDay(logs),
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
    where: { trackId: id, date: { gte: since } },
    select: { date: true, tasksCompletedCount: true },
  });

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

  const taskCount = topics.reduce((total, topic) => total + topic.taskCount, 0);
  const completedCount = topics.reduce((total, topic) => total + topic.completedCount, 0);

  return {
    id: track.id,
    name: track.name,
    currentStreak: track.currentStreak,
    longestStreak: track.longestStreak,
    createdAt: track.createdAt,
    topics,
    taskCount,
    completedCount,
    terrain: buildTerrain(logs),
    countsByDay: toCountsByDay(logs),
  };
}
