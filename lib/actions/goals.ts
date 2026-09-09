"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { addDays, startOfDay } from "@/lib/day";
import { GOAL_XP } from "@/lib/goals";
import { parseLinkChoice } from "@/lib/goalLink";
import { applyGoalProgress, type ProgressReward } from "@/lib/goalWrites";

export type GoalActionResult = { error?: string };

/*
  `ProgressReward` is re-exported so the card keeps importing it from here.

  The reward *decision* moved to `lib/goalWrites.ts` when activity on a linked
  Track became a second caller — Prisma has no nested interactive transactions,
  so a function that opens its own could not be called from inside
  `recordActivity`'s. Nothing about the rules changed; only where the body lives.
*/
export type { ProgressReward };

const MAX_TITLE = 90;
const MAX_DESC = 400;

function parseNumber(raw: FormDataEntryValue | null): number | null {
  const value = typeof raw === "string" ? Number(raw.trim()) : NaN;
  return Number.isFinite(value) ? value : null;
}

function parseDate(raw: FormDataEntryValue | null): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const value = new Date(`${raw}T12:00:00`);
  return Number.isNaN(value.getTime()) ? null : startOfDay(value);
}

/** Weekly and monthly write their own deadline; custom takes the one given. */
function deadlineFor(cadence: string, start: Date, custom: Date | null): Date | null {
  if (cadence === "weekly") return addDays(start, 6);
  if (cadence === "monthly") return addDays(start, 29);
  return custom;
}

export async function createGoal(
  _previous: GoalActionResult,
  formData: FormData,
): Promise<GoalActionResult> {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the goal a title." };
  if (title.length > MAX_TITLE) return { error: `Keep the title under ${MAX_TITLE} characters.` };

  const description = String(formData.get("description") ?? "").trim().slice(0, MAX_DESC);
  const category = String(formData.get("category") ?? "").trim() || "General";
  const unit = String(formData.get("unit") ?? "").trim() || "units";
  const cadence = String(formData.get("cadence") ?? "custom");

  const target = parseNumber(formData.get("target"));
  if (target === null || target <= 0) return { error: "Target has to be a number above zero." };

  const startDate = parseDate(formData.get("startDate")) ?? startOfDay();
  const deadline = deadlineFor(cadence, startDate, parseDate(formData.get("deadline")));
  if (!deadline) return { error: "Pick a deadline." };
  if (deadline < startDate) return { error: "The deadline is before the start date." };

  /*
    Where progress comes from. `parseLinkChoice` cannot return both fields set,
    whatever it is handed, so the database's CHECK constraint is unreachable
    from here — a malformed post produces a manual goal rather than an error the
    user has to read.

    **Nothing is backfilled.** A linked goal starts at zero and counts only
    activity recorded from now on. Summing the history at creation would mean
    either awarding milestones for crossings that happened before anyone was
    watching, or skipping them and leaving the ledger disagreeing with the bar.
  */
  const link = parseLinkChoice(formData.get("source"));

  /*
    A recurring goal is a *series of rows*, and this is its first period.

    `seriesId` is a fresh id rather than the goal's own, because Prisma assigns
    the id at insert and the series has to be named before then. Nothing reads it
    as anything but an opaque grouping key.
  */
  const repeats = formData.get("repeats") === "on";

  await prisma.goal.create({
    data: {
      title,
      description: description || null,
      category,
      unit,
      target,
      cadence,
      startDate,
      deadline,
      trackId: link.trackId,
      topicId: link.topicId,
      seriesId: repeats ? randomUUID() : null,
      /*
        Creating pays its 5 XP through the ledger like everything else, as a
        zero-delta entry. A goal's XP is the sum of its rows, so an award that
        did not write a row would simply not exist.
      */
      entries: { create: { delta: 0, value: 0, xp: GOAL_XP.create } },
    },
  });

  revalidatePath("/goals");
  return {};
}

/**
 * Advance a goal from the interface, and report what it paid.
 *
 * A thin wrapper now: it opens the transaction and `applyGoalProgress` decides
 * everything inside it. **The body moved to `lib/goalWrites.ts` rather than
 * being copied** when activity on a linked Track became a second way to advance
 * a goal — `Goal.highWater`, the milestone constraint and the XP ledger are the
 * whole anti-farming story, and two implementations of them would be two sets of
 * rules to keep in step.
 *
 * The transaction is still what makes the anti-farming rule safe: it is a
 * read-then-write against the high-water mark, and two clicks landing together
 * outside one would both read the old mark and both pay.
 */
export async function recordGoalProgress(
  id: string,
  value: number,
  mode: "set" | "add" = "set",
): Promise<ProgressReward> {
  try {
    return await prisma.$transaction((tx) => applyGoalProgress(tx, id, value, mode));
  } finally {
    revalidatePath("/goals");
  }
}

export async function editGoal(id: string, formData: FormData): Promise<GoalActionResult> {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the goal a title." };
  const target = parseNumber(formData.get("target"));
  if (target === null || target <= 0) return { error: "Target has to be a number above zero." };
  const deadline = parseDate(formData.get("deadline"));
  if (!deadline) return { error: "Pick a deadline." };

  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) return { error: "That goal no longer exists." };
  if (deadline < goal.startDate) return { error: "The deadline is before the start date." };

  /*
    Editing a completed goal is allowed, and raising the target reopens it.
    The alternative — a finished goal whose target is now above its progress but
    which still reads "complete" — is a lie the statistics would then repeat.
    Milestones already banked stay banked; they were genuinely crossed.
  */
  const stillComplete = goal.currentProgress >= target;
  await prisma.goal.update({
    where: { id },
    data: {
      title: title.slice(0, MAX_TITLE),
      description: String(formData.get("description") ?? "").trim().slice(0, MAX_DESC) || null,
      category: String(formData.get("category") ?? "").trim() || goal.category,
      unit: String(formData.get("unit") ?? "").trim() || goal.unit,
      target,
      deadline,
      ...(goal.status === "completed" && !stillComplete
        ? { status: "active", completedAt: null }
        : {}),
    },
  });
  revalidatePath("/goals");
  return {};
}

/** Marks a goal done at whatever progress it has. The manual "Complete". */
export async function completeGoal(id: string): Promise<GoalActionResult> {
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) return {};
  if (goal.status === "completed") return {};
  await prisma.goal.update({
    where: { id },
    data: { status: "completed", completedAt: new Date() },
  });
  revalidatePath("/goals");
  return {};
}

export async function setGoalStatus(
  id: string,
  status: "active" | "archived",
): Promise<GoalActionResult> {
  /*
    Restarting an expired goal rolls its window forward from today rather than
    leaving it in the past, where it would expire again on the next render. The
    progress and the ledger stay — this is the same goal being given more time,
    not a new one.
  */
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) return {};
  const reviving = status === "active" && goal.deadline < startOfDay();
  const span = Math.max(
    1,
    Math.round((goal.deadline.getTime() - goal.startDate.getTime()) / 86400000),
  );
  await prisma.goal.update({
    where: { id },
    data: {
      status,
      ...(status === "active" ? { completedAt: null } : {}),
      ...(reviving ? { startDate: startOfDay(), deadline: addDays(startOfDay(), span) } : {}),
    },
  });
  revalidatePath("/goals");
  return {};
}

/** Hard delete. Milestones and the ledger cascade — see the schema. */
export async function deleteGoal(id: string): Promise<GoalActionResult> {
  await prisma.goal.deleteMany({ where: { id } });
  revalidatePath("/goals");
  return {};
}
