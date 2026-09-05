/**
 * The topic tree, as pure functions over plain rows.
 *
 * Everything structural lives here and nothing in this file touches the
 * database: depth, ancestry, cycles, leaf-ness and every coverage figure are
 * decided from a flat array of nodes. That is what lets the same rules run in a
 * server action before a write, in a page render after a read, and in the test
 * suite with no database at all.
 *
 * **Leaf-ness is derived, never stored.** A node is actionable exactly when it
 * has no live children. So a leaf that gains a child stops being actionable the
 * instant the child exists, and becomes actionable again if the child is
 * removed — with its own activity history still attached, because that history
 * belongs to the node and not to its position.
 */

/** Hard limit. A depth-5 node cannot receive children, in the UI or the API. */
export const MAX_DEPTH = 5;

/** A node as it comes out of the database, before the tree is assembled. */
export type TopicRow = {
  id: string;
  parentId: string | null;
  name: string;
  position: number;
  depth: number;
};

export type TreeNode = TopicRow & {
  children: TreeNode[];
  /** No live children. Only a leaf is actionable. */
  isLeaf: boolean;
  /** Names from the root down to but excluding this node. */
  path: string[];
};

/**
 * Assembles rows into a forest, ordered by `position` then `name`.
 *
 * Rows whose parent is missing from the input — a child of a soft-deleted node,
 * most often — are dropped rather than promoted to the root. Promoting them
 * would silently resurrect a subtree the user deleted the top of, and make it
 * actionable at a depth it was never checked against.
 */
export function buildTree(rows: TopicRow[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const row of rows) {
    byId.set(row.id, { ...row, children: [], isLeaf: true, path: [] });
  }

  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId === null) {
      roots.push(node);
      continue;
    }
    const parent = byId.get(node.parentId);
    if (parent) parent.children.push(node);
  }

  const order = (a: TreeNode, b: TreeNode) =>
    a.position - b.position || a.name.localeCompare(b.name);

  const walk = (nodes: TreeNode[], path: string[]) => {
    nodes.sort(order);
    for (const node of nodes) {
      node.path = path;
      node.isLeaf = node.children.length === 0;
      walk(node.children, [...path, node.name]);
    }
  };
  walk(roots, []);

  return roots;
}

/** Every node in the forest, parents before their own children. */
export function flatten(nodes: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (list: TreeNode[]) => {
    for (const node of list) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

/** Every actionable node, in tree order. The flat view's whole content. */
export function leaves(nodes: TreeNode[]): TreeNode[] {
  return flatten(nodes).filter((node) => node.isLeaf);
}

/** A node and everything under it. */
export function subtree(node: TreeNode): TreeNode[] {
  return flatten([node]);
}

/** How many levels the subtree rooted at `node` occupies. A leaf is 1. */
export function subtreeHeight(node: TreeNode): number {
  if (node.children.length === 0) return 1;
  return 1 + Math.max(...node.children.map(subtreeHeight));
}

/* --------------------------------------------------------------------------
   Moves
   --------------------------------------------------------------------------
   Two independent rules, and both have to hold. They fail for different
   reasons and are reported separately, because "you cannot put a node inside
   itself" and "that would be six levels deep" are not the same problem and a
   single "invalid move" would leave the user guessing which.
*/

export type MoveRejection = { ok: false; reason: string };
export type MoveCheck = { ok: true; depth: number } | MoveRejection;

/**
 * Can `nodeId` become a child of `parentId` (or a root, when null)?
 *
 * The cycle check walks *down* from the moving node rather than up from the
 * target: a node cannot be moved into its own descendant, and the descendant
 * set is exactly what makes that true. Walking up from the target would reach
 * the same answer but only after the move had already been half-imagined.
 */
export function canMove(
  roots: TreeNode[],
  nodeId: string,
  parentId: string | null,
): MoveCheck {
  const all = flatten(roots);
  const node = all.find((n) => n.id === nodeId);
  if (!node) return { ok: false, reason: "That topic no longer exists." };

  if (parentId === null) {
    const height = subtreeHeight(node);
    return height > MAX_DEPTH
      ? { ok: false, reason: `That subtree is ${height} levels deep and the limit is ${MAX_DEPTH}.` }
      : { ok: true, depth: 1 };
  }

  if (parentId === nodeId) {
    return { ok: false, reason: "A topic cannot be moved inside itself." };
  }

  const parent = all.find((n) => n.id === parentId);
  if (!parent) return { ok: false, reason: "That destination no longer exists." };

  if (subtree(node).some((n) => n.id === parentId)) {
    return { ok: false, reason: "A topic cannot be moved inside one of its own children." };
  }

  // The deepest node in the subtree ends up at the parent's depth plus the
  // subtree's own height. Checking only the moving node would happily push its
  // grandchildren past the limit.
  const deepest = parent.depth + subtreeHeight(node);
  if (deepest > MAX_DEPTH) {
    return {
      ok: false,
      reason: `That would put a topic ${deepest} levels deep, and the limit is ${MAX_DEPTH}.`,
    };
  }

  return { ok: true, depth: parent.depth + 1 };
}

/** Can a new child be created under `parent`? Null means a new top-level topic. */
export function canAddChild(parent: { depth: number } | null): MoveCheck {
  const depth = parent ? parent.depth + 1 : 1;
  return depth > MAX_DEPTH
    ? { ok: false, reason: `That topic is already ${MAX_DEPTH} levels deep and cannot hold children.` }
    : { ok: true, depth };
}

/* --------------------------------------------------------------------------
   Activity and coverage
   --------------------------------------------------------------------------
   Three different questions, deliberately three different answers. Conflating
   them is the easy mistake: a parent that summed its children's clicks would
   reward hammering one child, and a track that averaged its parents' coverage
   would weight a topic with two leaves the same as one with twenty.
*/

/** Clicks per topic id for a single day. Absent means none. */
export type DayCounts = Map<string, number>;

/** Visual tiers. The stored count is uncapped; only the display saturates. */
export const MAX_TIER = 5;

/** 0 → neutral, 1-4 → their own tier, 5 or more → the top tier. */
export function intensityTier(count: number): number {
  if (count <= 0) return 0;
  return Math.min(count, MAX_TIER);
}

/**
 * A parent's coverage: how many of its *direct* children were worked today,
 * over how many it has.
 *
 * Direct children, and distinct ones. Clicking one child five times moves this
 * not at all — the figure answers "how much of this area did I touch", and
 * touching the same corner repeatedly is not breadth. A child that is itself a
 * parent counts as worked when anything beneath it was worked, so the measure
 * stays meaningful at every level rather than only above the leaves.
 */
export function parentCoverage(node: TreeNode, counts: DayCounts): { worked: number; total: number } {
  const total = node.children.length;
  if (total === 0) return { worked: 0, total: 0 };
  const worked = node.children.filter((child) => subtreeWorked(child, counts)).length;
  return { worked, total };
}

/** True when this node, or anything beneath it, has activity on the day. */
export function subtreeWorked(node: TreeNode, counts: DayCounts): boolean {
  return subtree(node).some((n) => (counts.get(n.id) ?? 0) > 0);
}

/**
 * A track's coverage: distinct active leaves over total leaves.
 *
 * Computed across all leaves at once rather than by averaging the top-level
 * topics' coverage. Averaging would give a topic holding two leaves the same
 * weight as one holding twenty, so working both leaves of the small one would
 * read as a bigger day than working ten of the large one.
 */
export function trackCoverage(roots: TreeNode[], counts: DayCounts): { worked: number; total: number } {
  const all = leaves(roots);
  return {
    worked: all.filter((leaf) => (counts.get(leaf.id) ?? 0) > 0).length,
    total: all.length,
  };
}

/** Coverage as a percentage, 0 when there is nothing to cover. */
export function coveragePercent({ worked, total }: { worked: number; total: number }): number {
  return total === 0 ? 0 : Math.round((worked / total) * 100);
}
