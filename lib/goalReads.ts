/**
 * Every goal read, in one place, mirroring how `lib/progress.ts` owns the
 * activity reads. Pure maths lives in `lib/goals.ts`; this only fetches.
 */

import { prisma } from "@/lib/prisma";
import { summariseGoals, type GoalRow, type GoalStats } from "@/lib/goals";

export type GoalBoard = { goals: GoalRow[]; stats: GoalStats };

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
  const rows = await prisma.goal.findMany({
    orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
    include: {
      milestones: { select: { percent: true, xp: true } },
      entries: { select: { xp: true } },
    },
  });

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
