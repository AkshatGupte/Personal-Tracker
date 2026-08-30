"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/tracks";

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
 */
export async function deleteTopic(id: string, trackId: string): Promise<ActionResult> {
  await prisma.topic.delete({ where: { id } });
  revalidatePath(`/tracks/${trackId}`);
  revalidatePath("/");
  return {};
}
