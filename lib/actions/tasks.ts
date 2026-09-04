"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/tracks";
import { affectedDays, readStreak, recomputeDays, recomputeToday } from "@/lib/completion";
import { startOfDay } from "@/lib/day";
import { describeCheckIn, type CheckInOutcome } from "@/lib/streak";
import { DIFFICULTIES, type Difficulty } from "@/lib/difficulty";

const MAX_TITLE = 140;

type ParsedTask =
  | { ok: true; title: string; difficulty: Difficulty | null }
  | { ok: false; error: string };

function parseTask(form: FormData): ParsedTask {
  const raw = form.get("title");
  const title = typeof raw === "string" ? raw.trim() : "";
  if (!title) return { ok: false, error: "Give the task a title." };
  if (title.length > MAX_TITLE)
    return { ok: false, error: `Keep it under ${MAX_TITLE} characters.` };

  const rawDifficulty = form.get("difficulty");
  const value = typeof rawDifficulty === "string" ? rawDifficulty.trim() : "";
  if (value && !DIFFICULTIES.includes(value as Difficulty)) {
    return { ok: false, error: "Pick easy, medium or hard." };
  }

  return { ok: true, title, difficulty: value ? (value as Difficulty) : null };
}

/**
 * Appends a task to the end of its topic.
 *
 * Position is assigned explicitly rather than left to insertion order, so a
 * later reorder or a generated curriculum has something real to sort by.
 */
export async function createTask(
  topicId: string,
  trackId: string,
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseTask(formData);
  if (!parsed.ok) return { error: parsed.error };

  const last = await prisma.task.findFirst({
    where: { topicId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.task.create({
    data: {
      topicId,
      title: parsed.title,
      difficulty: parsed.difficulty,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath(`/tracks/${trackId}`);
  revalidatePath("/");
  return {};
}

export async function updateTask(
  id: string,
  trackId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseTask(formData);
  if (!parsed.ok) return { error: parsed.error };

  await prisma.task.update({
    where: { id },
    data: { title: parsed.title, difficulty: parsed.difficulty },
  });

  revalidatePath(`/tracks/${trackId}`);
  return {};
}

/**
 * Records or removes today's check-in for a recurring task.
 *
 * A task is never permanently completed: this writes one `TaskCheckIn` row for
 * today and leaves the task available again tomorrow. The row's existence is
 * the state, so undoing deletes it rather than flipping a flag.
 *
 * Idempotent in both directions. Checking in twice in a day is absorbed by the
 * unique constraint on (taskId, date) rather than producing a second row, and
 * undoing a check-in that is not there deletes nothing. A double-click, a
 * retry, or two tabs racing all land on the same result.
 *
 * Only *today* is ever touched. An earlier day's check-in is not reachable from
 * here, so yesterday cannot be edited by clicking today's tick.
 *
 * Returns what the write did to the track's streak. The streak is read once
 * before the mutation and once after, inside the same transaction and against
 * the same `now`, and the two are compared — that comparison *is* the
 * definition of extending a streak. See `describeCheckIn`. The value was
 * previously computed and thrown away; the check-in cannot report itself as
 * one composed outcome without it.
 */
export type CheckInResult = ActionResult & { outcome?: CheckInOutcome };

export async function setCheckIn(id: string, checkedIn: boolean): Promise<CheckInResult> {
  const now = new Date();
  const today = startOfDay(now);

  const written = await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id },
      // The track is derived here rather than taken from the caller, so the
      // recompute can never be pointed at the wrong track's history.
      select: { topic: { select: { trackId: true } } },
    });
    if (!task) return null;

    const trackId = task.topic.trackId;
    // Taken before the mutation, and from the log rather than Track's cached
    // columns, which a lapse leaves stale until something writes.
    const before = await readStreak(tx, trackId, now);

    if (checkedIn) {
      // upsert rather than create: the unique constraint would otherwise throw
      // on a repeat click, and a repeat click means "yes, still done today".
      await tx.taskCheckIn.upsert({
        where: { taskId_date: { taskId: id, date: today } },
        create: { taskId: id, date: today },
        update: {},
      });
    } else {
      await tx.taskCheckIn.deleteMany({ where: { taskId: id, date: today } });
    }

    const after = await recomputeToday(tx, trackId, now);
    return { trackId, outcome: describeCheckIn(before, after, checkedIn) };
  });

  if (!written) return { error: "That task no longer exists." };

  revalidatePath(`/tracks/${written.trackId}`);
  revalidatePath("/");
  return { outcome: written.outcome };
}

/**
 * Deletes a task, and rebuilds every day it ever contributed to.
 *
 * `CompletionLog` is a derived rollup, not frozen history: a day's count is
 * whatever the surviving check-ins say it is. Deleting a task removes its
 * check-ins by cascade, so every day it appeared on is now wrong — not only
 * today. Those days are collected *before* the delete, because the cascade
 * takes the rows with it and they cannot be found afterwards.
 *
 * A day whose only activity was this task loses its row entirely, and the
 * streak recomputes to match. That is the intended consequence of treating the
 * log as derived rather than as a ledger.
 */
export async function deleteTask(id: string, trackId: string): Promise<ActionResult> {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id },
      select: { topic: { select: { trackId: true } } },
    });
    if (!task) return;

    const days = await affectedDays(tx, { taskId: id });
    await tx.task.delete({ where: { id } });
    // Always includes today, so a task deleted before it was ever checked in
    // still refreshes the current day rather than silently doing nothing.
    await recomputeDays(tx, task.topic.trackId, [...days, startOfDay(now)], now);
  });

  revalidatePath(`/tracks/${trackId}`);
  revalidatePath("/");
  return {};
}
