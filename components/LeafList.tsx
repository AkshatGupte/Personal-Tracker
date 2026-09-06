"use client";

import ActivityCell from "@/components/ActivityCell";
import TopicControls from "@/components/TopicControls";
import type { TrackNode } from "@/lib/progress";

/**
 * The flat view: every actionable leaf in the track, in tree order.
 *
 * "Flat" is meant literally, and it is not the old two-level list adapted.
 * That list was Topic → Tasks, which cannot express five levels — a leaf four
 * deep had nowhere to appear. Listing the leaves themselves works at any depth,
 * and it is the view for the question the app is actually used for: what can I
 * work on right now.
 *
 * Each row carries its ancestry as a breadcrumb, because a bare "BFS" is
 * ambiguous the moment two branches both have one, and the breadcrumb is the
 * only thing that distinguishes them once the hierarchy is flattened away.
 */
export default function LeafList({
  leaves,
  trackId,
  all,
}: {
  leaves: TrackNode[];
  trackId: string;
  all: TrackNode[];
}) {
  if (leaves.length === 0) {
    return (
      <p className="py-6 text-sm text-muted">
        <span className="sv-status">nothing to work on yet</span> — add a topic, or open the tree
        view to build one out.
      </p>
    );
  }

  /* `sv-row` is the hover/focus band — see globals.css. The row is 840px wide
     with 559px of nothing between the topic name and the controls, and Delete
     is at the far end of that traverse. */
  return (
    <ul className="divide-y divide-border">
      {leaves.map((leaf) => (
        <li
          key={leaf.id}
          className="sv-row -mx-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 py-2.5"
        >
          <div className="flex min-w-0 flex-col">
            {leaf.path.length > 0 && (
              <span className="font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted">
                {leaf.path.join(" › ")}
              </span>
            )}
            <span className="min-w-0 truncate text-sm">{leaf.name}</span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ActivityCell topicId={leaf.id} count={leaf.count} label={leaf.name} />
            <TopicControls
              node={leaf}
              trackId={trackId}
              all={all}
              canMoveUp={false}
              canMoveDown={false}
              reorder={false}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
