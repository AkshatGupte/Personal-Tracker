"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ActionResult = { error?: string };

const MAX_NAME = 80;

type ParsedName = { ok: true; name: string } | { ok: false; error: string };

/** Trims and checks a track name. Tagged so the caller can narrow on `ok`. */
function parseName(raw: FormDataEntryValue | null): ParsedName {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) return { ok: false, error: "Give the track a name." };
  if (name.length > MAX_NAME)
    return { ok: false, error: `Keep it under ${MAX_NAME} characters.` };
  return { ok: true, name };
}

export async function createTrack(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseName(formData.get("name"));
  if (!parsed.ok) return { error: parsed.error };

  await prisma.track.create({ data: { name: parsed.name } });
  revalidatePath("/");
  return {};
}

export async function renameTrack(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseName(formData.get("name"));
  if (!parsed.ok) return { error: parsed.error };

  await prisma.track.update({ where: { id }, data: { name: parsed.name } });
  revalidatePath("/");
  return {};
}

/**
 * Deletes a track. Topics, tasks and completion logs beneath it go too —
 * the schema cascades, so this cannot leave orphaned rows behind.
 */
export async function deleteTrack(id: string): Promise<ActionResult> {
  await prisma.track.delete({ where: { id } });
  revalidatePath("/");
  return {};
}
