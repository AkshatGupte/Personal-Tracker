"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/tracks";
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

export async function deleteTask(id: string, trackId: string): Promise<ActionResult> {
  await prisma.task.delete({ where: { id } });
  revalidatePath(`/tracks/${trackId}`);
  revalidatePath("/");
  return {};
}
