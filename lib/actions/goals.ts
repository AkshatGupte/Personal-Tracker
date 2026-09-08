"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { addDays, startOfDay } from "@/lib/day";
import { GOAL_XP, milestonesCrossed, progressXp } from "@/lib/goals";

export type GoalActionResult = { error?: string };

/**
 * What a write paid, handed back to the client so the celebration can fire.
 *
 * The server decides this, not the browser. A client that worked out its own
 * rewards could pay itself twice for one write, or pay for a write the database
 * rejected — and the whole anti-farming rule lives behind the same transaction
 * that decides them, so it is the only place that can answer honestly.
 */
export type ProgressReward = {
  error?: string;
  from?: number;
  to?: number;
  xp?: number;
  milestones?: number[];
  completed?: boolean;
};

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
 * The one write that matters, and the only place rewards are decided.
 *
 * `mode` is `set` or `add` so the fast path (+1 on the card) and the considered
 * path (type a new figure) share every rule between them rather than growing
 * two copies of the milestone logic.
 *
 * Everything happens in one interactive transaction because the anti-farming
 * rule is a read-then-write: it compares the incoming value against the goal's
 * high-water mark and then moves that mark. Two clicks landing together outside
 * a transaction would both read the old mark and both pay.
 */
export async function recordGoalProgress(
  id: string,
  value: number,
  mode: "set" | "add" = "set",
): Promise<ProgressReward> {
  if (!Number.isFinite(value)) return { error: "That is not a number." };

  try {
    return await prisma.$transaction(async (tx) => {
      const goal = await tx.goal.findUnique({
        where: { id },
        include: { milestones: { select: { percent: true } } },
      });
      if (!goal) return { error: "That goal no longer exists." };
      if (goal.status === "archived") return { error: "This goal is archived." };

      const from = goal.currentProgress;
      /*
        Clamped at zero and left uncapped above the target. Overshooting is
        real — fifty-two problems against a target of fifty is a true fact about
        the week — and the bar and percentage cap themselves for display.
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

          `skipDuplicates` is not available on SQLite, and a check-then-insert
          would reintroduce exactly the race the constraint exists to close. So
          the write is attempted and P2002 — unique violation — is read as "some
          other write already banked this one", which is a success from here.
          Anything else is a real failure and is rethrown.

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
            Completion is a consequence of the number, never a separate button
            the user has to remember. Reaching the target completes the goal;
            the status only moves forward here, so a later correction downward
            does not un-complete something that was genuinely finished.
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
    });
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
