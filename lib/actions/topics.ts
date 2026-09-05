"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildTree, canAddChild, canMove, flatten } from "@/lib/tree";
import type { ActionResult } from "@/lib/actions/tracks";

const MAX_NAME = 80;

type ParsedName = { ok: true; name: string } | { ok: false; error: string };

function parseName(raw: FormDataEntryValue | null): ParsedName {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) return { ok: false, error: "Give the topic a name." };
  if (name.length > MAX_NAME)
    return { ok: false, error: `Keep it under ${MAX_NAME} characters.` };
  return { ok: true, name };
}

/**
 * Every live node in a track, as the tree.
 *
 * Soft-deleted rows are excluded here rather than filtered later, which is what
 * makes "deleted nodes leave current calculations" true everywhere at once:
 * depth checks, cycle checks, sibling ordering and coverage all read this.
 */
async function liveTree(trackId: string) {
  const rows = await prisma.topic.findMany({
    where: { trackId, deletedAt: null },
    select: { id: true, parentId: true, name: true, position: true, depth: true },
  });
  return buildTree(rows);
}

/**
 * Adds a topic, either at the top level or under a parent.
 *
 * The depth rule is enforced here and not only in the UI. The form hides the
 * control on a depth-5 node, but a stale page is a page whose buttons describe
 * a tree that has since changed, and the rule has to hold against the tree that
 * exists now.
 */
export async function createTopic(
  trackId: string,
  parentId: string | null,
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseName(formData.get("name"));
  if (!parsed.ok) return { error: parsed.error };

  const parent = parentId
    ? await prisma.topic.findFirst({
        where: { id: parentId, trackId, deletedAt: null },
        select: { depth: true },
      })
    : null;

  if (parentId && !parent) return { error: "That topic no longer exists." };

  const check = canAddChild(parent);
  if (!check.ok) return { error: check.reason };

  // Appended, not prepended: a new sibling belongs after the ones already
  // there, and a stored position means that survives the next reorder.
  const last = await prisma.topic.findFirst({
    where: { trackId, parentId, deletedAt: null },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.topic.create({
    data: {
      trackId,
      parentId,
      name: parsed.name,
      depth: check.depth,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath("/");
  revalidatePath(`/tracks/${trackId}`);
  return {};
}

export async function renameTopic(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseName(formData.get("name"));
  if (!parsed.ok) return { error: parsed.error };

  const topic = await prisma.topic.findFirst({
    where: { id, deletedAt: null },
    select: { trackId: true },
  });
  if (!topic) return { error: "That topic no longer exists." };

  await prisma.topic.update({ where: { id }, data: { name: parsed.name } });
  revalidatePath("/");
  revalidatePath(`/tracks/${topic.trackId}`);
  return {};
}

/**
 * Soft-deletes a leaf.
 *
 * **A parent with children cannot be deleted.** Refused rather than cascaded:
 * cascading would take a whole subtree — and every leaf's history with it —
 * on a single click, which is not what "delete this topic" reads as. Emptying
 * it first is the explicit version of the same intent.
 *
 * The row survives so historical views can still name what was worked on the
 * days it was alive. Nothing hard-deletes a topic; only deleting the whole
 * track does that, through the schema's cascade.
 */
export async function deleteTopic(id: string): Promise<ActionResult> {
  const topic = await prisma.topic.findFirst({
    where: { id, deletedAt: null },
    select: { trackId: true, _count: { select: { children: { where: { deletedAt: null } } } } },
  });
  // Absorbed rather than reported: a double click on the confirm button gets
  // here twice, and the second arrival describes an outcome that already holds.
  if (!topic) return {};

  if (topic._count.children > 0) {
    return { error: "Empty this topic before deleting it — it still has topics inside." };
  }

  await prisma.topic.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath("/");
  revalidatePath(`/tracks/${topic.trackId}`);
  return {};
}

/**
 * Moves a subtree to a new parent, or to the top level when `parentId` is null.
 *
 * Both structural rules are checked against the tree as it is right now, and
 * the whole subtree's depth is rewritten in the same transaction as the move.
 * Leaving `depth` stale would be worse than useless: every later check reads it,
 * so one wrong value quietly permits a six-level tree.
 *
 * Activity is untouched. History belongs to the node, so a leaf carries its
 * record with it and its new parent's coverage counts it from today onward.
 */
export async function moveTopic(id: string, parentId: string | null): Promise<ActionResult> {
  const topic = await prisma.topic.findFirst({
    where: { id, deletedAt: null },
    select: { trackId: true },
  });
  if (!topic) return { error: "That topic no longer exists." };

  const roots = await liveTree(topic.trackId);
  const check = canMove(roots, id, parentId);
  if (!check.ok) return { error: check.reason };

  const node = flatten(roots).find((n) => n.id === id)!;
  const shift = check.depth - node.depth;

  const last = await prisma.topic.findFirst({
    where: { trackId: topic.trackId, parentId, deletedAt: null, NOT: { id } },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.$transaction([
    prisma.topic.update({
      where: { id },
      data: { parentId, depth: check.depth, position: (last?.position ?? -1) + 1 },
    }),
    // Descendants keep their shape and shift by the same amount the root did.
    ...flatten(node.children).map((descendant) =>
      prisma.topic.update({
        where: { id: descendant.id },
        data: { depth: descendant.depth + shift },
      }),
    ),
  ]);

  revalidatePath("/");
  revalidatePath(`/tracks/${topic.trackId}`);
  return {};
}

/**
 * Moves a topic one place up or down among its siblings.
 *
 * Positions are rewritten as a dense 0..n-1 sequence for the whole sibling
 * group rather than the two rows being swapped. Rows created before ordering
 * mattered can share a position, and swapping two equal numbers is a no-op that
 * looks like a broken button.
 */
export async function reorderTopic(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const topic = await prisma.topic.findFirst({
    where: { id, deletedAt: null },
    select: { trackId: true, parentId: true },
  });
  if (!topic) return { error: "That topic no longer exists." };

  const siblings = await prisma.topic.findMany({
    where: { trackId: topic.trackId, parentId: topic.parentId, deletedAt: null },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true },
  });

  const from = siblings.findIndex((s) => s.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= siblings.length) return {};

  const order = siblings.map((s) => s.id);
  [order[from], order[to]] = [order[to], order[from]];

  await prisma.$transaction(
    order.map((topicId, position) =>
      prisma.topic.update({ where: { id: topicId }, data: { position } }),
    ),
  );

  revalidatePath("/");
  revalidatePath(`/tracks/${topic.trackId}`);
  return {};
}
