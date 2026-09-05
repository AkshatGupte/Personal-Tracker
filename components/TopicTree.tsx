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

  return (
    <li className="border-l border-border pl-3 first:border-l-0 first:pl-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
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
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-none text-[0.6rem] text-muted transition-colors hover:text-fg"
            >
              <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
            </button>
          )}

          <span className="min-w-0 truncate text-sm">{node.name}</span>

          {!node.isLeaf && (
            <span className="font-label text-[0.55rem] uppercase tracking-[0.14em] text-muted">
              {node.worked}/{node.total} today
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
