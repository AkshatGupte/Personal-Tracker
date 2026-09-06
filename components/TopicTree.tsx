"use client";

import { useState } from "react";
import ActivityCell from "@/components/ActivityCell";
import TopicControls from "@/components/TopicControls";
import { coveragePercent } from "@/lib/tree";
import type { TrackNode } from "@/lib/progress";

/**
 * The tree view: the whole hierarchy, with the same activity semantics as the
 * flat view.
 *
 * **A parent shows coverage; a leaf shows its count.** The two are different
 * questions and are drawn differently on purpose — a rule that fills for
 * breadth, a filled cell for volume. Giving a parent a green cell summing its
 * children would let hammering one child look like covering all of them, which
 * is the exact confusion the hierarchy exists to prevent.
 *
 * Expansion is component state and is not persisted. The brief says it need not
 * survive a reload, and storing it would mean a tree whose shape has changed
 * underneath a saved set of ids.
 */
export default function TopicTree({
  roots,
  trackId,
  all,
}: {
  roots: TrackNode[];
  trackId: string;
  all: TrackNode[];
}) {
  // Everything starts open. The point of this view is the shape; opening it
  // collapsed would hide the thing the reader switched views to see.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (roots.length === 0) {
    return (
      <p className="py-6 text-sm text-muted">
        <span className="sv-status">nothing in this track yet</span>
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {roots.map((node, i) => (
        <Node
          key={node.id}
          node={node}
          trackId={trackId}
          all={all}
          collapsed={collapsed}
          toggle={toggle}
          canMoveUp={i > 0}
          canMoveDown={i < roots.length - 1}
        />
      ))}
    </ul>
  );
}

function Node({
  node,
  trackId,
  all,
  collapsed,
  toggle,
  canMoveUp,
  canMoveDown,
}: {
  node: TrackNode;
  trackId: string;
  all: TrackNode[];
  collapsed: Set<string>;
  toggle: (id: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const isOpen = !collapsed.has(node.id);
  const percent = coveragePercent({ worked: node.worked, total: node.total });

  /*
    Every sibling is indented and ruled, the first one included.

    `first:border-l-0 first:pl-0` used to strip both from the first child of
    each group. The indent step is 12px, so the first child of a depth-2 group
    rendered at the x of a depth-1 node — the error was exactly one full level,
    and it put two different depths on the same x while splitting one depth
    across two. Measured in the seed tree: `Graphs` (depth 1) at 423 against
    `Two pointers` (depth 2) at 422.
  */
  return (
    <li className="border-l border-border pl-3">
      {/* The band goes on the row, never on the `li`: an `li` contains its whole
          subtree, so hovering a parent would light every descendant with it and
          the highlight would stop meaning "this row". */}
      <div className="sv-row -mx-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {node.isLeaf ? (
            // Alignment placeholder. A leaf has nothing to expand, and letting
            // its name slide left would break the column the tree reads down.
            <span aria-hidden="true" className="inline-block h-5 w-5" />
          ) : (
            <button
              type="button"
              onClick={() => toggle(node.id)}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.name}`}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-none text-[0.75rem] text-muted transition-colors hover:text-fg"
            >
              <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
            </button>
          )}

          <span className="min-w-0 truncate text-sm">{node.name}</span>

          {/*
            "Direct", and the word is doing real work.

            The figure counts distinct *direct* children worked today — see
            `lib/tree.ts` — so `Two pointers` reads 2/2 with a full bar while its
            grandchild `Happy number` has never been touched. Nothing in the old
            label said so, and reading the tree top-down therefore gave a
            systematically optimistic picture of a track. The calculation is
            correct and deliberate; only the label was lying by omission.

            The full sentence goes to assistive tech, where there is room for it.
          */}
          {!node.isLeaf && (
            <span
              className="font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted"
              title={`${node.worked} of ${node.total} topics directly inside ${node.name} worked today. Topics deeper down are not counted here.`}
            >
              <span aria-hidden="true">
                {node.worked}/{node.total} direct
              </span>
              <span className="sr-only">
                {node.worked} of {node.total} topics directly inside worked today
              </span>
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {node.isLeaf && (
            <ActivityCell topicId={node.id} count={node.count} label={node.name} />
          )}
          <TopicControls
            node={node}
            trackId={trackId}
            all={all}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
          />
        </div>
      </div>

      {!node.isLeaf && (
        <div className="sv-coverage mb-1 ml-7" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>
      )}

      {!node.isLeaf && isOpen && (
        <ul className="ml-3 flex flex-col">
          {node.children.map((child, i) => (
            <Node
              key={child.id}
              node={child}
              trackId={trackId}
              all={all}
              collapsed={collapsed}
              toggle={toggle}
              canMoveUp={i > 0}
              canMoveDown={i < node.children.length - 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
