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
 * Deletes a track. Its whole topic tree and every activity row beneath it go
 * too — the schema cascades, so this cannot leave orphaned rows behind. This is
 * the one place anything is hard-deleted: a topic on its own is soft-deleted so
 * its history survives, but a deleted track has no history left to belong to.
 *
 * `deleteMany` rather than `delete`, so a repeat is absorbed instead of
 * throwing. `delete` raises P2025 when the row has already gone, which a double
 * click on the confirm button reliably produces: the first call removes the
 * track and the second arrives to find nothing, surfacing as a 500 in the
 * console for what the user experiences as one successful deletion.
 *
 * This matches the rest of the write path rather than introducing a new idea —
 * `deleteTopic` and `deleteTask` already absorb a repeat through their
 * `findUnique` guard, and `setCheckIn` is idempotent in both directions by
 * design. This was the one delete that was not.
 */
export async function deleteTrack(id: string): Promise<ActionResult> {
  await prisma.track.deleteMany({ where: { id } });
  revalidatePath("/");
  return {};
}
