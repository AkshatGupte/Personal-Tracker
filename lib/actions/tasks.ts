"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/tracks";
import { recomputeToday } from "@/lib/completion";
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
 * Marks a task done, or puts it back to pending.
 *
 * Idempotent by construction: asking for a state the task is already in leaves
 * completedAt exactly where it was and simply recomputes, so a double-click, a
 * retry, or two tabs racing all land on the same result rather than logging the
 * same task twice.
 *
 * The task fields, today's CompletionLog row and the track's cached streak are
 * written in one transaction, because a half-applied completion would leave
 * history disagreeing with live task state.
 */
export async function setTaskCompletion(
  id: string,
  complete: boolean,
): Promise<ActionResult> {
  const now = new Date();

  const trackId = await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id },
      // The track is derived here rather than taken from the caller, so the
      // recompute can never be pointed at the wrong track's history.
      select: { status: true, topic: { select: { trackId: true } } },
    });
    if (!task) return null;

    if ((task.status === "completed") !== complete) {
      await tx.task.update({
        where: { id },
        data: {
          status: complete ? "completed" : "pending",
          completedAt: complete ? now : null,
        },
      });
    }

    await recomputeToday(tx, task.topic.trackId, now);
    return task.topic.trackId;
  });

  if (!trackId) return { error: "That task no longer exists." };

  revalidatePath(`/tracks/${trackId}`);
  revalidatePath("/");
  return {};
}

/**
 * Deletes a task. If it was completed today, today's rollup is rebuilt without
 * it, because that row is defined as a rollup of live task state. Earlier days
 * are untouched: history records what was done at the time, and deleting a task
 * now does not undo the day it was finished.
 */
export async function deleteTask(id: string, trackId: string): Promise<ActionResult> {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id },
      select: { topic: { select: { trackId: true } } },
    });
    if (!task) return;

    await tx.task.delete({ where: { id } });
    await recomputeToday(tx, task.topic.trackId, now);
  });

  revalidatePath(`/tracks/${trackId}`);
  revalidatePath("/");
  return {};
}
