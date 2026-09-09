import { prisma } from "@/lib/prisma";
import { addDays, dayKey, startOfDay } from "@/lib/day";
import { backdateWindow } from "@/lib/backdate";
import { EMPTY_STREAK, streakState, summariseStreak, type StreakState } from "@/lib/streak";
import {
  dailyBreakdown,
  monthBuckets,
  rollUp,
  weekBuckets,
  type PeriodBucket,
  type PeriodDay,
  type PeriodRollup,
} from "@/lib/rollup";
import { buildTerrain, cumulativeElevation, type DayLog } from "@/lib/terrain";
import { HEATMAP_DAYS, TERRAIN_DAYS } from "@/lib/windows";
import {
  buildTree,
  coveragePercent,
  flatten,
  leaves,
  parentCoverage,
  subtreeWorked,
  trackCoverage,
  type DayCounts,
  type TreeNode,
} from "@/lib/tree";

/**
 * Every read in the app, derived from TopicActivity.
 *
 * There is one activity table and no rollup beside it. Streaks, coverage,
 * terrain and the heatmap are all computed here from the same rows, which is
 * what makes a move or a soft delete correct for free: the figures describe the
 * tree as it is now, so nothing has to be rewritten when it changes.
 *
 * **Current figures use live leaves; history does not.** A deleted node keeps
 * its rows and still appears in what happened on the days it was alive, but it
 * is not part of today's coverage and cannot hold a streak up on its own.
 */

/**
 * Oldest day still inside a window of `days`, counting today as the last one.
 *
 * **There are two windows and they are not interchangeable.** This used to be a
 * single `windowStart()` built from `TERRAIN_DAYS`, and both the terrain rows
 * and the heatmap rows were filtered through it — so the elevation graph's span
 * silently decided how much history the consistency heatmap was allowed to see.
 * Shortening the graph blanked ten of the heatmap's twelve weeks: the grid still
 * drew every cell, but the rows behind them had been dropped here. The spans
 * are named in `lib/windows.ts` and each caller now says which one it means.
 */
function windowStart(days: number): Date {
  return addDays(startOfDay(), -(days - 1));
}

type ActivityRow = { topicId: string; date: Date; count: number; trackId: string };

/** Every activity row, with the track its node currently belongs to. */
async function readActivity(where?: { trackId?: string }): Promise<ActivityRow[]> {
  const rows = await prisma.topicActivity.findMany({
    where: where?.trackId ? { topic: { trackId: where.trackId } } : undefined,
    select: { topicId: true, date: true, count: true, topic: { select: { trackId: true } } },
  });
  return rows.map((row) => ({
    topicId: row.topicId,
    date: row.date,
    count: row.count,
    trackId: row.topic.trackId,
  }));
}

/** Clicks per topic for one day. The map every coverage figure reads. */
function countsForDay(rows: ActivityRow[], day: Date): DayCounts {
  const key = dayKey(day);
  const counts: DayCounts = new Map();
  for (const row of rows) {
    if (dayKey(row.date) !== key) continue;
    counts.set(row.topicId, (counts.get(row.topicId) ?? 0) + row.count);
  }
  return counts;
}

/**
 * Per-day totals for a set of rows, as the shape terrain and rollup read.
 *
 * Sums clicks rather than counting distinct nodes: this feeds the volume
 * signal — elevation and the heatmap — and volume is how much was done, not how
 * widely it was spread. Coverage is the breadth measure and is computed
 * separately, from the same rows.
 */
function toDayLogs(rows: ActivityRow[]): DayLog[] {
  const byDay = new Map<string, DayLog>();
  for (const row of rows) {
    const key = dayKey(row.date);
    const existing = byDay.get(key);
    if (existing) existing.count += row.count;
    else byDay.set(key, { date: startOfDay(row.date), count: row.count });
  }
  return [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Distinct live leaves worked per day — the contribution series.
 *
 * This is breadth, and it is what the heatmap reads. Volume would let one leaf
 * clicked nine times paint the same square as nine leaves clicked once, which
 * is the distinction the whole coverage model exists to make; the terrain still
 * carries volume, so both signals are on the page and neither is guessing.
 *
 * Counted against the leaves that exist *now*, so a day's square answers "how
 * much of the track as it stands did I cover", and a deleted node cannot leave
 * a square standing for ground that is no longer there.
 */
function coverageByDay(rows: ActivityRow[], liveLeafIds: Set<string>): Record<string, number> {
  const perDay = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!liveLeafIds.has(row.topicId) || row.count <= 0) continue;
    const key = dayKey(row.date);
    const set = perDay.get(key) ?? new Set<string>();
    set.add(row.topicId);
    perDay.set(key, set);
  }
  return Object.fromEntries([...perDay].map(([key, set]) => [key, set.size]));
}

/**
 * The days a track was active, restricted to leaves that still exist.
 *
 * A day counts when at least one *current* leaf was worked. Rows belonging to
 * deleted nodes, or to nodes that have since gained children and stopped being
 * leaves, stay in history but cannot prop a streak up — otherwise deleting the
 * last thing you ever worked on would leave the streak it earned standing.
 */
function activeDays(rows: ActivityRow[], liveLeafIds: Set<string>): Date[] {
  const days = new Set<string>();
  for (const row of rows) {
    if (!liveLeafIds.has(row.topicId)) continue;
    if (row.count > 0) days.add(dayKey(row.date));
  }
  return [...days].map((key) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  });
}

function streakOf(days: Date[]) {
  return days.length === 0 ? EMPTY_STREAK : summariseStreak(days);
}

/**
 * One track's current streak, on its own.
 *
 * Exists for the backdating path in `lib/actions/activity.ts`, which has to say
 * what a write did to the streak and therefore has to read it twice around the
 * write. **It reuses `activeDays(rows, liveLeafIds)` rather than deriving its
 * own** — leaf-ness and "a day is active when a *current* leaf was worked" are
 * the rules every other streak on every other screen is computed by, and a
 * second derivation here would eventually disagree with all of them.
 */
export async function getTrackStreak(trackId: string): Promise<number> {
  const [rows, trees] = await Promise.all([readActivity({ trackId }), readTrees([trackId])]);
  const liveLeafIds = new Set(leaves(trees.get(trackId) ?? []).map((leaf) => leaf.id));
  return streakOf(activeDays(rows, liveLeafIds)).current;
}

/** The live tree for a set of tracks, keyed by track id. */
async function readTrees(trackIds?: string[]) {
  const rows = await prisma.topic.findMany({
    where: { deletedAt: null, ...(trackIds ? { trackId: { in: trackIds } } : {}) },
    select: { id: true, trackId: true, parentId: true, name: true, position: true, depth: true },
  });
  const byTrack = new Map<string, TreeNode[]>();
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = grouped.get(row.trackId) ?? [];
    list.push(row);
    grouped.set(row.trackId, list);
  }
  for (const [trackId, list] of grouped) byTrack.set(trackId, buildTree(list));
  return byTrack;
}

/**
 * Every live topic, flattened in tree order, keyed by track.
 *
 * For the goal link picker. It goes through `readTrees` and `flatten` rather
 * than querying topics directly so the picker lists them in the same order the
 * track page does — ordering is `position` then name, decided in `buildTree`,
 * and a second query would sort by whatever the database felt like.
 */
export async function readTopicTrees(): Promise<Map<string, TreeNode[]>> {
  const byTrack = await readTrees();
  return new Map([...byTrack].map(([trackId, roots]) => [trackId, flatten(roots)]));
}

/* ------------------------------------------------------------------ home -- */

export async function getHomeProgress() {
  const sinceTerrain = windowStart(TERRAIN_DAYS);
  const sinceHeatmap = windowStart(HEATMAP_DAYS);
  const today = startOfDay();

  const [tracks, rows] = await Promise.all([
    prisma.track.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
    readActivity(),
  ]);
  const trees = await readTrees(tracks.map((t) => t.id));

  const todayCounts = countsForDay(rows, today);
  let totalLeaves = 0;
  let workedLeaves = 0;

  const trackRows = tracks.map((track) => {
    const roots = trees.get(track.id) ?? [];
    const all = flatten(roots);
    const leafNodes = leaves(roots);
    const liveLeafIds = new Set(leafNodes.map((l) => l.id));
    const own = rows.filter((r) => r.trackId === track.id);

    const coverage = trackCoverage(roots, todayCounts);
    totalLeaves += coverage.total;
    workedLeaves += coverage.worked;

    /*
      One streak summary, two figures off it.

      `streakState` has to be fed the *same* `activeDays` that produced the
      number beside it — days on which a currently live leaf was worked. Derived
      here rather than in the screen that wants it, because that array is already
      in hand and a second derivation elsewhere would eventually disagree with
      every streak the app shows.
    */
    const days = activeDays(own, liveLeafIds);
    const streak = streakOf(days);

    return {
      id: track.id,
      name: track.name,
      currentStreak: streak.current,
      longestStreak: streak.longest,
      lastActivity: streak.lastActivity,
      streakState: streakState(streak) as StreakState,
      activeDayCount: days.length,
      topicCount: all.length,
      leafCount: coverage.total,
      workedToday: coverage.worked,
      coverage: coveragePercent(coverage),
      /*
        One trajectory per track, and the baseline is what makes it a trajectory
        rather than a fortnightly restart: the ridge begins at the elevation the
        track already stood at, so its top equals the track's own headline
        figure instead of counting from zero again every two weeks.
      */
      terrain: buildTerrain(
        toDayLogs(own.filter((r) => r.date >= sinceTerrain)),
        TERRAIN_DAYS,
        new Date(),
        cumulativeElevation(toDayLogs(own.filter((r) => r.date < sinceTerrain))),
      ),
    };
  });

  const allLiveLeafIds = new Set(
    tracks.flatMap((track) => leaves(trees.get(track.id) ?? []).map((l) => l.id)),
  );

  /*
    The last 7 days across every track, for the sentence under the headline.

    This used to come off a combined all-tracks terrain, and that chart is gone:
    stacking every track's activity into one curve produced a line whose height
    answered no question anyone asks. "How much did I do this week" is a total,
    not a shape, so what survives is the total.
  */
  const sinceWeek = windowStart(7);
  const thisWeek = rows
    .filter((r) => r.date >= sinceWeek)
    .reduce((total, r) => total + r.count, 0);

  return {
    rows: trackRows,
    totalLeaves,
    workedLeaves,
    coverage: coveragePercent({ worked: workedLeaves, total: totalLeaves }),
    /*
      The headline numeral, and deliberately not `terrain.peak`.

      `rows` is unfiltered here — every activity row, all time — while the
      terrain below it is fed the windowed rows. That difference is the whole
      fix: the drawing keeps its two weeks and the figure beside it stops
      losing history to them. See `cumulativeElevation`.
    */
    elevation: cumulativeElevation(toDayLogs(rows)),
    thisWeek,
    countsByDay: coverageByDay(rows.filter((r) => r.date >= sinceHeatmap), allLiveLeafIds),
    bestStreak: trackRows.reduce((best, row) => Math.max(best, row.currentStreak), 0),
  };
}

/* ------------------------------------------------------------- one track -- */

export type TrackNode = {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  isLeaf: boolean;
  path: string[];
  /** Leaves only: today's clicks, uncapped. */
  count: number;
  /**
   * Leaves in the flat view only: day key → clicks, over the backdating window.
   *
   * Optional, and that is the type saying something true rather than being
   * lax. Only the flat list can record onto a past day; the tree view's figures
   * are parent coverage, which is a *today* signal (cyan means worked today),
   * and making it time-travel would mean re-deriving coverage per day for every
   * node in the tree. So the tree's nodes carry no window and cannot pretend to.
   */
  counts?: Record<string, number>;
  /** Parents only: direct children worked today, over how many there are. */
  worked: number;
  total: number;
  children: TrackNode[];
};

function decorate(node: TreeNode, counts: DayCounts): TrackNode {
  const coverage = parentCoverage(node, counts);
  return {
    id: node.id,
    name: node.name,
    parentId: node.parentId,
    depth: node.depth,
    isLeaf: node.isLeaf,
    path: node.path,
    count: node.isLeaf ? (counts.get(node.id) ?? 0) : 0,
    worked: coverage.worked,
    total: coverage.total,
    children: node.children.map((child) => decorate(child, counts)),
  };
}

/** Everything one track screen needs. Returns null when the id is unknown. */
export async function getTrackDetail(id: string) {
  const track = await prisma.track.findUnique({ where: { id }, select: { id: true, name: true, createdAt: true } });
  if (!track) return null;

  const sinceTerrain = windowStart(TERRAIN_DAYS);
  const sinceHeatmap = windowStart(HEATMAP_DAYS);
  const today = startOfDay();
  const [rows, trees] = await Promise.all([readActivity({ trackId: id }), readTrees([id])]);

  const roots = trees.get(id) ?? [];
  const todayCounts = countsForDay(rows, today);
  const leafNodes = leaves(roots);
  const liveLeafIds = new Set(leafNodes.map((l) => l.id));

  const streak = streakOf(activeDays(rows, liveLeafIds));
  const coverage = trackCoverage(roots, todayCounts);
  const windowLogs = toDayLogs(rows.filter((r) => r.date >= sinceTerrain));

  /*
    Clicks per leaf per day over the backdating window, so the flat list can
    show the count for whichever day it is recording onto rather than always
    today's. Built from the rows already in hand — this costs a pass over a few
    hundred rows, not a second query.
  */
  const backdateKeys = new Set(backdateWindow().map((choice) => choice.key));
  const windowCounts = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const key = dayKey(row.date);
    if (!backdateKeys.has(key)) continue;
    const bucket = windowCounts.get(row.topicId) ?? {};
    bucket[key] = (bucket[key] ?? 0) + row.count;
    windowCounts.set(row.topicId, bucket);
  }

  return {
    id: track.id,
    name: track.name,
    createdAt: track.createdAt,
    tree: roots.map((root) => decorate(root, todayCounts)),
    /*
      The days the flat list may record onto, derived here rather than in the
      browser. The chips and the per-leaf counts above have to come from the
      same window — a chip whose day was never bucketed would silently read
      zero — and deriving both on the server is what makes that structural
      rather than a thing to remember.
    */
    backdateDays: backdateWindow(),
    /** The flat view's content: every actionable leaf, in tree order. */
    leaves: leafNodes.map((leaf) => ({
      id: leaf.id,
      name: leaf.name,
      parentId: leaf.parentId,
      depth: leaf.depth,
      isLeaf: true as const,
      path: leaf.path,
      count: todayCounts.get(leaf.id) ?? 0,
      counts: windowCounts.get(leaf.id) ?? {},
      worked: 0,
      total: 0,
      children: [] as TrackNode[],
    })),
    currentStreak: streak.current,
    longestStreak: streak.longest,
    activeDayCount: activeDays(rows, liveLeafIds).length,
    leafCount: coverage.total,
    workedToday: coverage.worked,
    coverage: coveragePercent(coverage),
    /* All time, unwindowed — see the note in getHomeProgress. */
    elevation: cumulativeElevation(toDayLogs(rows)),
    terrain: buildTerrain(
      windowLogs,
      TERRAIN_DAYS,
      new Date(),
      cumulativeElevation(toDayLogs(rows.filter((r) => r.date < sinceTerrain))),
    ),
    countsByDay: coverageByDay(rows.filter((r) => r.date >= sinceHeatmap), liveLeafIds),
  };
}

export type TrackDetail = NonNullable<Awaited<ReturnType<typeof getTrackDetail>>>;

/* --------------------------------------------------------------- periods -- */

export const SUMMARY_WEEKS = 8;
export const SUMMARY_MONTHS = 6;

export type Period = "week" | "month";

const WINDOW: Record<Period, { count: number; buckets: (count: number, now: Date) => PeriodBucket[] }> = {
  week: { count: SUMMARY_WEEKS, buckets: weekBuckets },
  month: { count: SUMMARY_MONTHS, buckets: monthBuckets },
};

export type TrackPeriod = {
  id: string;
  name: string;
  currentStreak: number;
  longestStreak: number;
  /** Days this track was ever active, over its whole history. */
  totalActiveDays: number;
  /** Live leaves worked today, over how many the track has. */
  coverage: number;
  leafCount: number;
  /** The current period only. */
  completed: number;
  activeDays: number;
  everActive: boolean;
};

/**
 * The summary over one window: an all-tracks series plus the current period
 * broken down per track.
 *
 * The bucketing layer is untouched by the restructure. `rollUp`,
 * `dailyBreakdown` and `describePeriod` never knew what a task was — they walk
 * a bucket from its start to its exclusive end over `{date, count}` — so
 * pointing them at activity totals instead of completion rollups is the whole
 * change on this side.
 */
export async function getPeriodProgress(period: Period = "week", now: Date = new Date()) {
  const window = WINDOW[period];
  const buckets = window.buckets(window.count, now);
  const today = startOfDay(now);

  const [tracks, rows] = await Promise.all([
    prisma.track.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
    readActivity(),
  ]);
  const trees = await readTrees(tracks.map((t) => t.id));
  const todayCounts = countsForDay(rows, today);

  const allLogs = toDayLogs(rows);
  const periods = rollUp(allLogs, buckets, now);
  const current = periods[periods.length - 1];
  const currentDays = dailyBreakdown(allLogs, buckets[buckets.length - 1], now);

  const trackPeriods: TrackPeriod[] = tracks.map((track) => {
    const roots = trees.get(track.id) ?? [];
    const liveLeafIds = new Set(leaves(roots).map((l) => l.id));
    const own = rows.filter((r) => r.trackId === track.id);
    const days = activeDays(own, liveLeafIds);
    const streak = streakOf(days);
    const coverage = trackCoverage(roots, todayCounts);
    const thisPeriod = rollUp(toDayLogs(own), [buckets[buckets.length - 1]], now)[0];

    /*
      The streak is deliberately not scoped to the period. A streak is a
      property of the track right now, not of the window being looked at, and
      truncating it at the first of the month would report a 40-day streak as
      six.
    */
    return {
      id: track.id,
      name: track.name,
      currentStreak: streak.current,
      longestStreak: streak.longest,
      totalActiveDays: days.length,
      coverage: coveragePercent(coverage),
      leafCount: coverage.total,
      completed: thisPeriod.completed,
      activeDays: thisPeriod.activeDays,
      everActive: days.length > 0,
    };
  });

  return {
    period,
    periods,
    current,
    currentDays,
    tracks: trackPeriods,
    hasAnyHistory: rows.length > 0,
    /*
      The buckets themselves, so a caller can name the *same* window this series
      was built on rather than deriving a second one. The weekly review prints
      its window, and two definitions of "this week" on one screen is exactly the
      confusion it exists to remove.
    */
    buckets,
  };
}

export type PeriodProgress = Awaited<ReturnType<typeof getPeriodProgress>>;
export type { PeriodDay, PeriodRollup };

/* --------------------------------------------------------------- history -- */

export type LeafHistoryRow = {
  id: string;
  name: string;
  path: string[];
  deleted: boolean;
  /** Day key → clicks. */
  byDay: Record<string, number>;
  total: number;
};

/**
 * Per-leaf history for one track, including nodes that have been deleted.
 *
 * Deleted nodes are marked rather than hidden. The brief asks for their
 * activity to stay visible in historical views, and a history that quietly drops
 * the rows for something you removed is a history that disagrees with the
 * contribution graph above it.
 */
/*
  `days` is required rather than defaulting to the terrain's window. It used to
  default to `TERRAIN_DAYS`, which meant shortening the elevation graph would
  quietly shorten this strip too — the same one-number-two-jobs fault the
  heatmap was hit by. The one caller names its own span.
*/
export async function getLeafHistory(trackId: string, days: number): Promise<LeafHistoryRow[]> {
  const since = addDays(startOfDay(), -(days - 1));

  const topics = await prisma.topic.findMany({
    where: { trackId },
    select: {
      id: true,
      name: true,
      parentId: true,
      position: true,
      depth: true,
      deletedAt: true,
      activity: { where: { date: { gte: since } }, select: { date: true, count: true } },
    },
  });

  // Ancestry is read from the live tree so a surviving node shows where it sits
  // now. A deleted node's parents may be gone too, so its path falls back to
  // whatever can still be resolved rather than failing.
  const live = topics.filter((t) => t.deletedAt === null);
  const nodesById = new Map(topics.map((t) => [t.id, t]));
  const pathOf = (id: string): string[] => {
    const out: string[] = [];
    let cursor = nodesById.get(id)?.parentId ?? null;
    while (cursor) {
      const parent = nodesById.get(cursor);
      if (!parent) break;
      out.unshift(parent.name);
      cursor = parent.parentId;
    }
    return out;
  };
  const liveWithChildren = new Set(live.map((t) => t.parentId).filter(Boolean) as string[]);

  return topics
    .filter((topic) => topic.activity.length > 0)
    // Parents are excluded: their contribution is their children's, and listing
    // a node that used to be a leaf beside the children that replaced it would
    // double-count the same days to the reader.
    .filter((topic) => !liveWithChildren.has(topic.id))
    .map((topic) => {
      const byDay: Record<string, number> = {};
      let total = 0;
      for (const row of topic.activity) {
        byDay[dayKey(row.date)] = (byDay[dayKey(row.date)] ?? 0) + row.count;
        total += row.count;
      }
      return {
        id: topic.id,
        name: topic.name,
        path: pathOf(topic.id),
        deleted: topic.deletedAt !== null,
        byDay,
        total,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

export { subtreeWorked };
