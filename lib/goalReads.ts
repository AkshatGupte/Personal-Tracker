/**
 * Every goal read, in one place, mirroring how `lib/progress.ts` owns the
 * activity reads. Pure maths lives in `lib/goals.ts`; this only fetches.
 */

import { prisma } from "@/lib/prisma";
import { summariseGoals, type GoalRow, type GoalStats } from "@/lib/goals";
import type { GoalSource } from "@/lib/goalLink";
import { periodIndex, summariseSeries } from "@/lib/goalSeries";
import { rollSeriesForward } from "@/lib/goalWrites";
import { readTopicTrees } from "@/lib/progress";

export type GoalBoard = { goals: GoalRow[]; stats: GoalStats };

/**
 * Where one goal's progress comes from, resolved for display.
 *
 * Null means the progress is typed in — either the goal was never linked, or
 * its link was broken by a hard-deleted track, in which case `SetNull` has
 * already cleared the column and the goal is simply manual again.
 *
 * `live` is false only for a **soft-deleted** watched topic. That row still
 * exists and the foreign key still points at it, so the link is intact while the
 * node it names is not — and nothing will ever advance the goal again, because a
 * deleted node is in no leaf's ancestor chain. That has to be said on the card
 * rather than left as a goal that silently stopped moving.
 */
function sourceOf(row: {
  trackId: string | null;
  topicId: string | null;
  track: { name: string } | null;
  topic: { name: string; deletedAt: Date | null; track: { id: string; name: string } } | null;
}): GoalSource | null {
  if (row.topicId && row.topic) {
    return {
      kind: "topic",
      trackId: row.topic.track.id,
      trackName: row.topic.track.name,
      topicName: row.topic.name,
      live: row.topic.deletedAt === null,
    };
  }
  if (row.trackId && row.track) {
    return { kind: "track", trackId: row.trackId, trackName: row.track.name, live: true };
  }
  return null;
}

/**
 * Every goal, newest deadline first, with its milestones and banked XP.
 *
 * **XP is summed from the ledger rather than stored on the goal.** A running
 * total on a row has no way to be checked and every write is a chance for it to
 * drift; the rows that paid it are already there, and for one local user the
 * whole ledger is a few hundred rows. It is the same argument the schema makes
 * for not caching streaks on Track.
 */
export async function getGoalBoard(): Promise<GoalBoard> {
  /*
    **A read that writes, and it has to be.** Nothing in this project runs at
    midnight — no cron, no server process — so a recurring goal's next period
    cannot be created by a scheduled job. It is created the next time anything
    looks at the board, which is the same reasoning that keeps expiry derived
    rather than stored.

    Before the read, so the rows it returns already include any period that
    should exist. Doing it after would show a board one period out of date until
    the next refresh.
  */
  await rollSeriesForward(prisma);

  const rows = await prisma.goal.findMany({
    orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
    include: {
      milestones: { select: { percent: true, xp: true } },
      entries: { select: { xp: true } },
      /*
        Where a linked goal reads its progress from. Two shallow joins rather
        than a tree walk: the badge needs the track and, for a subtree link, the
        watched node — not the whole ancestry. "DSA › Graphs" identifies it, and
        a full path would cost a walk per card for a longer string.
      */
      track: { select: { name: true } },
      topic: { select: { name: true, deletedAt: true, track: { select: { id: true, name: true } } } },
    },
  });

  /*
    Series facts are derived from the rows in hand — "you have hit this six weeks
    running" is a query over the series, not a counter anybody maintains. That is
    the payoff of a row per period.
  */
  const runs = summariseSeries(rows);

  const goals: GoalRow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    unit: row.unit,
    cadence: row.cadence,
    target: row.target,
    currentProgress: row.currentProgress,
    highWater: row.highWater,
    startDate: row.startDate,
    deadline: row.deadline,
    status: row.status as GoalRow["status"],
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    milestones: row.milestones.map((m) => m.percent).sort((a, b) => a - b),
    trackId: row.trackId,
    topicId: row.topicId,
    source: sourceOf(row),
    seriesId: row.seriesId,
    period: row.seriesId ? periodIndex(rows, row.seriesId, row.startDate) : null,
    series: row.seriesId ? (runs.get(row.seriesId) ?? null) : null,
    xp:
      row.milestones.reduce((sum, m) => sum + m.xp, 0) +
      row.entries.reduce((sum, e) => sum + e.xp, 0),
  }));

  return { goals, stats: summariseGoals(goals) };
}

/** One goal's progress history, oldest first. For the card's sparkline. */
export async function getGoalHistory(goalId: string) {
  return prisma.goalProgress.findMany({
    where: { goalId },
    orderBy: { at: "asc" },
    select: { value: true, delta: true, at: true, xp: true },
  });
}

/**
 * What a new goal may be linked to: every track, and every live topic under it.
 *
 * Parents are offered as well as leaves, and that is the point of subtree
 * linking — "Graphs" means any leaf beneath Graphs, which is what a goal like
 * "20 graph problems this week" actually means. Ordering and leaf-ness come from
 * `buildTree`, so the picker lists topics in the same order the track page does
 * rather than inventing a second ordering.
 */
export async function getLinkTargets(): Promise<
  Array<{ id: string; name: string; topics: Array<{ id: string; name: string; depth: number }> }>
> {
  const [tracks, trees] = await Promise.all([
    prisma.track.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
    readTopicTrees(),
  ]);
  return tracks.map((track) => ({
    id: track.id,
    name: track.name,
    topics: (trees.get(track.id) ?? []).map((node) => ({
      id: node.id,
      name: node.name,
      depth: node.depth,
    })),
  }));
}
