"use server";

import { revalidatePath } from "next/cache";
import { startOfDay } from "@/lib/day";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/tracks";

/**
 * The whole write path for activity. Two functions, one table, no rollups.
 *
 * The old model kept a per-track daily rollup beside the ground truth and had
 * to rebuild it whenever anything was deleted or moved. Nothing derived is
 * stored now: intensity, coverage, streaks and history are all read out of
 * TopicActivity, so a move or a delete changes what the figures mean without
 * any row needing to be rewritten to keep up.
 */

export type ActivityResult = ActionResult & { count?: number };

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
 * Records one click on a leaf for today.
 *
 * Upsert rather than read-then-write: the unique index on (topicId, date) is
 * what makes a double submit produce one row, and `increment` is correct here
 * precisely because a click *is* an increment. That differs from the old
 * check-in, which was a set-membership question and had to be recomputed —
 * this is a tally, and re-running it is meant to add another.
 */
export async function recordActivity(topicId: string): Promise<ActivityResult> {
  const found = await actionableLeaf(topicId);
  if ("error" in found) return found;

  const date = startOfDay();
  const row = await prisma.topicActivity.upsert({
    where: { topicId_date: { topicId, date } },
    create: { topicId, date, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  revalidatePath("/");
  revalidatePath("/progress");
  revalidatePath(`/tracks/${found.trackId}`);
  return { count: row.count };
}

/**
 * Takes back the most recent click on a leaf today.
 *
 * At zero the row is deleted rather than left sitting at 0. A zero row would be
 * indistinguishable from a worked day in every query that reads presence — the
 * streak count above all — so "no activity" has to mean "no row".
 */
export async function undoActivity(topicId: string): Promise<ActivityResult> {
  const found = await actionableLeaf(topicId);
  if ("error" in found) return found;

  const date = startOfDay();
  const existing = await prisma.topicActivity.findUnique({
    where: { topicId_date: { topicId, date } },
    select: { count: true },
  });
  // Nothing to take back. Absorbed, not reported: this is what a second undo
  // looks like, and it describes an outcome that already holds.
  if (!existing) return { count: 0 };

  const next = existing.count - 1;
  if (next <= 0) {
    await prisma.topicActivity.delete({ where: { topicId_date: { topicId, date } } });
  } else {
    await prisma.topicActivity.update({
      where: { topicId_date: { topicId, date } },
      data: { count: next },
    });
  }

  revalidatePath("/");
  revalidatePath("/progress");
  revalidatePath(`/tracks/${found.trackId}`);
  return { count: Math.max(0, next) };
}
