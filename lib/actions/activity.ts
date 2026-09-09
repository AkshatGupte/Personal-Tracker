"use server";

import { revalidatePath } from "next/cache";
import { canLogOn, describeStreakChange } from "@/lib/backdate";
import { dayKey, startOfDay } from "@/lib/day";
import { advancesOn, chainFor, describeGoalAdvance } from "@/lib/goalLink";
import { applyGoalProgress, rollSeriesForward } from "@/lib/goalWrites";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getTrackStreak } from "@/lib/progress";
import type { ActionResult } from "@/lib/actions/tracks";

/**
 * The whole write path for activity. Two functions, one table, no rollups.
 *
 * The old model kept a per-track daily rollup beside the ground truth and had
 * to rebuild it whenever anything was deleted or moved. Nothing derived is
 * stored now: intensity, coverage, streaks and history are all read out of
 * TopicActivity, so a move or a delete changes what the figures mean without
 * any row needing to be rewritten to keep up.
 *
 * **Both writes take an optional day**, defaulting to today, so every existing
 * call site is unchanged. `TopicActivity` is keyed `@@unique([topicId, date])`
 * and every read derives from it, so the data model has always supported
 * backdating — the only thing that was missing was a way to say which day.
 */

export type ActivityResult = ActionResult & {
  count?: number;
  /**
   * Backdated writes only: what the write did to the track's streak.
   *
   * Surfaced rather than hidden. Streaks are derived, so filling in yesterday
   * can revive a run that read as broken and undoing yesterday can end one —
   * both are correct, and both are a number changing for a reason the user
   * cannot see on the row they pressed.
   */
  streakNote?: string;
  /**
   * One line per linked goal this write advanced.
   *
   * Stated, never celebrated. The reward is real and was banked by the server
   * inside the same transaction, but the three celebration tiers and the
   * confetti live on `/goals` and nowhere else — the track half of the app
   * describes behaviour rather than scoring it. Same register as `streakNote`.
   */
  goalNotes?: string[];
};

/**
 * Only a leaf can be worked.
 *
 * Checked on every write rather than trusted from the UI. A page rendered a
 * moment ago describes a tree that may since have gained a child, and a parent
 * accumulating clicks of its own would make its coverage figure a lie — the
 * whole point of coverage is that it comes from the children.
 */
async function actionableLeaf(topicId: string) {
  const topic = await prisma.topic.findFirst({
    where: { id: topicId, deletedAt: null },
    select: {
      trackId: true,
      _count: { select: { children: { where: { deletedAt: null } } } },
    },
  });
  if (!topic) return { error: "That topic no longer exists." } as const;
  if (topic._count.children > 0) {
    return { error: "This topic has topics inside it, so it is not worked directly." } as const;
  }
  return { trackId: topic.trackId } as const;
}

/**
 * Which day this write lands on.
 *
 * **Re-checked here even though the interface only offers seven chips**, for
 * the same reason the depth limit is re-checked on every topic write: a
 * rendered page describes a window that may have rolled over since, and the
 * chips are a courtesy while this is the rule.
 */
function resolveDay(on?: string):
  | { date: Date; key: string; offset: number }
  | { error: string } {
  if (on === undefined) {
    const date = startOfDay();
    return { date, key: dayKey(date), offset: 0 };
  }
  const check = canLogOn(on);
  if (!check.ok) return { error: check.reason };
  return { date: check.date, key: check.key, offset: check.offset };
}

/** Every screen that shows a figure derived from this track's activity. */
function revalidateActivity(trackId: string) {
  revalidatePath("/");
  revalidatePath("/progress");
  revalidatePath(`/tracks/${trackId}`);
}


/**
 * Advance every linked goal that this leaf's activity belongs to, in `tx`.
 *
 * **The query is the only definition of link coverage there is.** A goal
 * watching the whole track matches on `trackId`; a goal watching one subtree
 * matches when its `topicId` is in the leaf's ancestor chain — which is the same
 * question as "is this leaf under that node", asked as an `IN` over at most
 * `MAX_DEPTH` ids instead of by loading a subtree. Nothing in application code
 * re-decides it, so nothing can disagree with it.
 *
 * The window and status test is `advancesOn`, a pure function, applied to what
 * comes back. It takes **the day the activity was recorded for**, not today, so
 * a backdated entry pays into the window it actually happened in.
 *
 * Every matching goal advances. Two goals over the same track — "50 this week"
 * and "200 this month" — are two genuine measurements of the same work, and
 * neither is a subset of the other in any way that could be exploited: each has
 * its own `highWater`, so each unit still pays once per goal.
 *
 * `applyGoalProgress` re-reads the goal it was handed. That is one redundant
 * read per advanced goal and it is kept deliberately — it leaves the reward
 * decision entirely self-contained, which is worth more than the read.
 */
async function advanceLinkedGoals(
  tx: Prisma.TransactionClient,
  topicId: string,
  trackId: string,
  day: Date,
  delta: 1 | -1,
): Promise<string[]> {
  const topics = await tx.topic.findMany({
    where: { trackId, deletedAt: null },
    select: { id: true, parentId: true },
  });
  const chain = chainFor(topics, topicId);

  const where = { OR: [{ trackId }, { topicId: { in: chain } }] };
  const select = {
    id: true, title: true, target: true, unit: true,
    status: true, startDate: true, deadline: true, seriesId: true,
  };

  let candidates = await tx.goal.findMany({ where, select });

  /*
    **Recurring goals are rolled forward here too, not only on `/goals`.**

    Without this there is a silent hole in exactly the case the two features were
    built for: a recurring linked goal, worked daily, by someone who does not
    open the goals screen. Three weeks of activity would advance nothing, because
    the newest period's window closed three weeks ago and its successors did not
    exist yet — and no error would say so.

    Rolled to *today* rather than to `day`, so a backdated write does not leave
    the series short. `advancesOn` then picks whichever period's window actually
    contains the recorded day.

    Skipped entirely when nothing watching this track is recurring, which is the
    common case and costs one comparison.
  */
  const seriesIds = [...new Set(candidates.map((c) => c.seriesId).filter(Boolean))] as string[];
  if (seriesIds.length > 0 && (await rollSeriesForward(tx, seriesIds)) > 0) {
    candidates = await tx.goal.findMany({ where, select });
  }

  const notes: string[] = [];
  for (const goal of candidates) {
    if (!advancesOn(goal, day)) continue;
    const reward = await applyGoalProgress(tx, goal.id, delta, "add");
    if (reward.error || reward.to === undefined) continue;
    // An undo is a negative change: corrected, not announced. Only a forward
    // move gets a line, which matches the shatter rule on the row beside it.
    if (delta === 1) notes.push(describeGoalAdvance(goal, reward.to, reward.milestones ?? []));
  }
  return notes;
}

/**
 * Records one click on a leaf, for `on` or for today.
 *
 * Upsert rather than read-then-write: the unique index on (topicId, date) is
 * what makes a double submit produce one row, and `increment` is correct here
 * precisely because a click *is* an increment. That differs from the old
 * check-in, which was a set-membership question and had to be recomputed —
 * this is a tally, and re-running it is meant to add another.
 *
 * The streak is only read on a *backdated* write. Recording today cannot move
 * the current streak in a way the page does not already show, and this is the
 * one interaction anybody repeats — two extra reads on the common path to
 * describe something that did not happen would be a real cost for nothing.
 */
export async function recordActivity(topicId: string, on?: string): Promise<ActivityResult> {
  const found = await actionableLeaf(topicId);
  if ("error" in found) return found;

  const day = resolveDay(on);
  if ("error" in day) return day;

  const before = day.offset > 0 ? await getTrackStreak(found.trackId) : null;

  /*
    One transaction over the activity row *and* every goal it advances.

    The alternative — write the activity, then advance the goals separately —
    would let a failure land the work in the tracker with the goal it feeds
    unmoved, and the two would disagree until somebody noticed. Prisma has no
    nested interactive transactions, which is why `applyGoalProgress` takes a
    client rather than opening one.
  */
  const { count, goalNotes } = await prisma.$transaction(async (tx) => {
    const row = await tx.topicActivity.upsert({
      where: { topicId_date: { topicId, date: day.date } },
      create: { topicId, date: day.date, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    });
    const notes = await advanceLinkedGoals(tx, topicId, found.trackId, day.date, 1);
    return { count: row.count, goalNotes: notes };
  });

  const streakNote =
    before === null
      ? undefined
      : (describeStreakChange(before, await getTrackStreak(found.trackId)) ?? undefined);

  revalidateActivity(found.trackId);
  /* Unconditional: a roll-forward can create periods without advancing any of
     them, and the board would then be a period out of date. */
  revalidatePath("/goals");
  return { count, streakNote, goalNotes: goalNotes.length > 0 ? goalNotes : undefined };
}

/**
 * Takes back the most recent click on a leaf, for `on` or for today.
 *
 * At zero the row is deleted rather than left sitting at 0. A zero row would be
 * indistinguishable from a worked day in every query that reads presence — the
 * streak count above all — so "no activity" has to mean "no row".
 *
 * Backdated undo exists because a backdated record can be a mistake, and a
 * write that cannot be reversed on the day it landed on is a trap. It is the
 * one path in the app that can *end* a streak from a button press, which is
 * exactly why it says so.
 */
export async function undoActivity(topicId: string, on?: string): Promise<ActivityResult> {
  const found = await actionableLeaf(topicId);
  if ("error" in found) return found;

  const day = resolveDay(on);
  if ("error" in day) return day;

  const existing = await prisma.topicActivity.findUnique({
    where: { topicId_date: { topicId, date: day.date } },
    select: { count: true },
  });
  // Nothing to take back. Absorbed, not reported: this is what a second undo
  // looks like, and it describes an outcome that already holds.
  if (!existing) return { count: 0 };

  const before = day.offset > 0 ? await getTrackStreak(found.trackId) : null;

  /*
    Symmetric, and in one transaction for the same reason.

    Safe against farming by construction rather than by a guard here:
    `progressXp` pays nothing for ground already covered and `highWater` never
    moves down, so record → undo → record pays exactly once. The `GoalProgress`
    row for the decrease is still written — the ledger keeps every write,
    including the ones that paid nothing.
  */
  const next = existing.count - 1;
  await prisma.$transaction(async (tx) => {
    if (next <= 0) {
      await tx.topicActivity.delete({ where: { topicId_date: { topicId, date: day.date } } });
    } else {
      await tx.topicActivity.update({
        where: { topicId_date: { topicId, date: day.date } },
        data: { count: next },
      });
    }
    await advanceLinkedGoals(tx, topicId, found.trackId, day.date, -1);
  });

  const streakNote =
    before === null
      ? undefined
      : (describeStreakChange(before, await getTrackStreak(found.trackId)) ?? undefined);

  revalidateActivity(found.trackId);
  revalidatePath("/goals");
  return { count: Math.max(0, next), streakNote };
}
