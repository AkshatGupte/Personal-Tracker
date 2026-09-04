"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/tracks";
import { affectedDays, recomputeDays } from "@/lib/completion";
import { startOfDay } from "@/lib/day";

const MAX_NAME = 80;

type ParsedName = { ok: true; name: string } | { ok: false; error: string };

/** Trims and checks a topic name. Tagged so the caller can narrow on `ok`. */
function parseName(raw: FormDataEntryValue | null): ParsedName {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) return { ok: false, error: "Give the topic a name." };
  if (name.length > MAX_NAME)
    return { ok: false, error: `Keep it under ${MAX_NAME} characters.` };
  return { ok: true, name };
}

export async function createTopic(
  trackId: string,
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseName(formData.get("name"));
  if (!parsed.ok) return { error: parsed.error };

  // Appended to the end of the track. Position is assigned explicitly so a
  // later reorder or a generated curriculum has something real to sort by.
  const last = await prisma.topic.findFirst({
    where: { trackId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  // isExpected stays false: topics added by hand are not curriculum entries.
  // The LLM-suggested curriculum sets that flag in Phase 3.
  await prisma.topic.create({
    data: { trackId, name: parsed.name, position: (last?.position ?? -1) + 1 },
  });
  revalidatePath(`/tracks/${trackId}`);
  revalidatePath("/");
  return {};
}

export async function renameTopic(
  id: string,
  trackId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseName(formData.get("name"));
  if (!parsed.ok) return { error: parsed.error };

  await prisma.topic.update({ where: { id }, data: { name: parsed.name } });
  revalidatePath(`/tracks/${trackId}`);
  return {};
}

/**
 * Deletes a topic. Its tasks go with it, because the schema cascades, so the
 * caller is expected to confirm first and name what is lost.
 *
 * Today's rollup is rebuilt afterwards: if any of those tasks were completed
 * today they no longer exist, so today's count must not still include them.
 * Earlier days stay as they were.
 */
export async function deleteTopic(id: string, trackId: string): Promise<ActionResult> {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const topic = await tx.topic.findUnique({
      where: { id },
      select: { trackId: true },
    });
    if (!topic) return;

    // Same rule as deleting a task, one level up: the topic's tasks cascade,
    // their check-ins cascade with them, and every day any of those tasks
    // appeared on has to be rebuilt from what survives. Collected before the
    // delete, because the cascade destroys the evidence.
    const days = await affectedDays(tx, { task: { topicId: id } });
    await tx.topic.delete({ where: { id } });
    await recomputeDays(tx, topic.trackId, [...days, startOfDay(now)], now);
  });

  revalidatePath(`/tracks/${trackId}`);
  revalidatePath("/");
  return {};
}
