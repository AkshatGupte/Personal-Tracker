/**
 * The goal reward decision, in exactly one place.
 *
 * This file exists because there are now **two** callers that have to advance a
 * goal — the card's `+1` / "Set to…" on `/goals`, and activity on a linked
 * Track — and there must not be two reward paths. `Goal.highWater`, the
 * `@@unique([goalId, percent])` milestone constraint and the XP ledger are the
 * whole anti-farming story, and a second implementation of them would be a
 * second set of rules to keep in step.
 *
 * **It takes a transaction client rather than opening its own.** That is the
 * only structural difference from the version that lived in
 * `lib/actions/goals.ts`, and it is what lets `recordActivity` write the
 * activity row and advance every goal watching it inside one transaction —
 * Prisma has no nested interactive transactions, so a function that opened its
 * own could never be called from inside another.
 *
 * It lives in `lib/` rather than `lib/actions/` because every export of a
 * `"use server"` module is a server action, and a transaction client is not
 * serialisable across that boundary. `lib/actions/goals.ts` keeps the thin
 * public wrapper; this is the body.
 */

import type { Prisma } from "@/lib/generated/prisma/client";
import { GOAL_XP, milestonesCrossed, progressXp } from "@/lib/goals";
import { missedPeriods } from "@/lib/goalSeries";

/**
 * What a write paid, handed back so the caller can report it.
 *
 * The server decides this, not the browser. A client that worked out its own
 * rewards could pay itself twice for one write, or pay for a write the database
 * rejected — and the anti-farming rule lives behind the same transaction that
 * decides them, so this is the only place that can answer honestly.
 */
export type ProgressReward = {
  error?: string;
  from?: number;
  to?: number;
  xp?: number;
  milestones?: number[];
  completed?: boolean;
};

/**
 * Advance one goal, decide what it paid, and write both.
 *
 * `mode` is `set` or `add` so the fast path (+1 on a card, or one recorded
 * activity) and the considered path (type a new figure) share every rule between
 * them rather than growing two copies of the milestone logic.
 *
 * Everything here must run inside one transaction because the anti-farming rule
 * is a read-then-write: it compares the incoming value against the goal's
 * high-water mark and then moves that mark. Two writes landing together outside
 * a transaction would both read the old mark and both pay.
 */
export async function applyGoalProgress(
  tx: Prisma.TransactionClient,
  id: string,
  value: number,
  mode: "set" | "add" = "set",
): Promise<ProgressReward> {
  if (!Number.isFinite(value)) return { error: "That is not a number." };

  const goal = await tx.goal.findUnique({
    where: { id },
    include: { milestones: { select: { percent: true } } },
  });
  if (!goal) return { error: "That goal no longer exists." };
  if (goal.status === "archived") return { error: "This goal is archived." };

  const from = goal.currentProgress;
  /*
    Clamped at zero and left uncapped above the target. Overshooting is real —
    fifty-two problems against a target of fifty is a true fact about the week —
    and the bar and percentage cap themselves for display.
  */
  const to = Math.max(0, mode === "add" ? from + value : value);
  if (to === from) return { from, to, xp: 0, milestones: [], completed: false };

  const crossed = milestonesCrossed(
    goal.target,
    goal.highWater,
    to,
    goal.milestones.map((m) => m.percent),
  );
  const xp = progressXp(goal.highWater, to);
  const nowComplete = goal.target > 0 && to >= goal.target;

  await tx.goalProgress.create({ data: { goalId: id, delta: to - from, value: to, xp } });

  const banked: number[] = [];
  for (const percent of crossed) {
    /*
      Insert and let the unique constraint arbitrate.

      `skipDuplicates` is not available on SQLite, and a check-then-insert would
      reintroduce exactly the race the constraint exists to close. So the write
      is attempted and P2002 — unique violation — is read as "some other write
      already banked this one", which is a success from here. Anything else is a
      real failure and is rethrown.

      `banked` rather than `crossed` is what the caller is told about, so the
      celebration fires for milestones this write actually paid for.
    */
    try {
      await tx.goalMilestone.create({
        data: { goalId: id, percent, xp: GOAL_XP.milestone[percent] ?? 0 },
      });
      banked.push(percent);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "P2002") throw error;
    }
  }

  await tx.goal.update({
    where: { id },
    data: {
      currentProgress: to,
      highWater: Math.max(goal.highWater, to),
      /*
        Completion is a consequence of the number, never a separate button the
        user has to remember. Reaching the target completes the goal; the status
        only moves forward here, so a later correction downward — including an
        undone activity on a linked goal — does not un-complete something that
        was genuinely finished.
      */
      ...(nowComplete && goal.status === "active"
        ? { status: "completed", completedAt: new Date() }
        : {}),
    },
  });

  return {
    from,
    to,
    xp: xp + banked.reduce((sum, p) => sum + (GOAL_XP.milestone[p] ?? 0), 0),
    milestones: banked,
    completed: nowComplete && goal.status === "active",
  };
}

/* ------------------------------------------------------ recurring series -- */

/**
 * Materialise every period a recurring series is missing, up to today's.
 *
 * **Called on read, because nothing in this project runs at midnight.** There is
 * no cron and no server process, so a series cannot be rolled over by a
 * scheduled job; it is rolled the next time anything looks at it. That is the
 * same reasoning that keeps goal expiry derived rather than stored, and streaks
 * off `Track`.
 *
 * **Every missed period is created, not skipped** — the owner's decision. Three
 * weeks away from a weekly goal leaves three rows that expire unmet, so the
 * completion rate keeps describing what actually happened. Jumping to the
 * current window would quietly delete three misses and flatter every statistic
 * on the dashboard.
 *
 * **A rolled period pays no XP.** `createGoal` banks `GOAL_XP.create` because
 * setting a goal is a deliberate act; a period that appeared on its own is not
 * one, and paying for it would mean a weekly goal left untouched for a year
 * quietly banked 260 XP for nothing. So no ledger row is written at all — a
 * period's ledger starts empty, and a goal's XP is the sum of its rows.
 *
 * **Archiving the newest period stops the series.** That is the off switch, and
 * it needs no new column: `status` already says it, the card already offers it,
 * and there is no flag anyone has to remember to clear. Restoring it resumes.
 *
 * Concurrency is handled by `@@unique([seriesId, startDate])` rather than by
 * checking first. Two renders of `/goals` can both find the next period missing;
 * they collide on the index and P2002 is read as "somebody else already made
 * it", which is a success from here.
 */
export async function rollSeriesForward(
  tx: Prisma.TransactionClient,
  seriesIds?: string[],
  now: Date = new Date(),
): Promise<number> {
  const members = await tx.goal.findMany({
    where: seriesIds ? { seriesId: { in: seriesIds } } : { seriesId: { not: null } },
    select: {
      id: true, seriesId: true, title: true, description: true, category: true,
      target: true, unit: true, cadence: true, status: true,
      startDate: true, deadline: true, trackId: true, topicId: true,
    },
  });
  if (members.length === 0) return 0;

  const bySeries = new Map<string, typeof members>();
  for (const member of members) {
    if (!member.seriesId) continue;
    const list = bySeries.get(member.seriesId) ?? [];
    list.push(member);
    bySeries.set(member.seriesId, list);
  }

  let created = 0;
  for (const list of bySeries.values()) {
    const newest = list.reduce((latest, m) =>
      m.startDate.getTime() > latest.startDate.getTime() ? m : latest,
    );
    // The off switch. Archiving the newest period ends the series.
    if (newest.status === "archived") continue;

    for (const window of missedPeriods(newest, now)) {
      try {
        await tx.goal.create({
          data: {
            title: newest.title,
            description: newest.description,
            category: newest.category,
            target: newest.target,
            unit: newest.unit,
            cadence: newest.cadence,
            seriesId: newest.seriesId,
            /* The link carries over — a recurring linked goal is the whole
               point of the two features together. */
            trackId: newest.trackId,
            topicId: newest.topicId,
            startDate: window.startDate,
            deadline: window.deadline,
            /* A fresh period starts empty. `highWater` starts at 0 too, so the
               new period's own first unit is new ground and pays once, while
               the previous period's mark cannot suppress it. */
            status: "active",
          },
        });
        created++;
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code !== "P2002") throw error;
      }
    }
  }
  return created;
}
