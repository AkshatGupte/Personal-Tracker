"use client";

import { useState, useTransition } from "react";
import {
  createTopic,
  deleteTopic,
  moveTopic,
  renameTopic,
  reorderTopic,
} from "@/lib/actions/topics";
import { MAX_DEPTH } from "@/lib/tree";
import type { TrackNode } from "@/lib/progress";

/**
 * Everything structural you can do to one node, in one place.
 *
 * Shared by the flat and tree views deliberately. The two views disagree about
 * what to *show* — a flat list has no expander and no parent coverage — but a
 * rename is a rename in both, and two copies of these controls would be two
 * places for the depth rule to drift out of step.
 *
 * Nothing here is optimistic. These are structural edits: a rejected move has a
 * reason worth reading, and showing the node in its new place first and then
 * snapping it back would be a worse account of what happened than a short wait.
 */

const action =
  "rounded-none px-1.5 py-1 font-label text-[0.58rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg disabled:opacity-40";

type Mode = "view" | "rename" | "add" | "move" | "confirm";

export default function TopicControls({
  node,
  trackId,
  /** Every node in the track, for the move destination list. */
  all,
  /** Whether this node has siblings above/below it. */
  canMoveUp,
  canMoveDown,
  /**
   * Whether to offer the reorder arrows at all.
   *
   * The flat view sets this false. Its rows are leaves gathered from all over
   * the tree, so two adjacent rows are usually not siblings and "move up" would
   * have no meaning there — ordering is a property of a sibling group, and the
   * tree view is where a sibling group is visible. The order set there is what
   * the flat list is sorted by, so the two views never disagree.
   */
  reorder = true,
}: {
  node: TrackNode;
  trackId: string;
  all: TrackNode[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  reorder?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("view");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasChildren = node.children.length > 0;
  // A depth-5 node cannot hold children. Hidden here *and* refused server-side:
  // this page describes a tree that may have changed since it rendered.
  const canHoldChildren = node.depth < MAX_DEPTH;

  const run = (fn: () => Promise<{ error?: string }>, then?: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
      else {
        setMode("view");
        then?.();
      }
    });
  };

  if (mode === "rename") {
    return (
      <Inline
        label="New name"
        defaultValue={node.name}
        submitLabel="Save"
        pending={pending}
        error={error}
        onCancel={() => setMode("view")}
        onSubmit={(formData) => run(() => renameTopic(node.id, formData))}
      />
    );
  }

  if (mode === "add") {
    return (
      <Inline
        label={`New topic inside ${node.name}`}
        submitLabel="Add"
        pending={pending}
        error={error}
        onCancel={() => setMode("view")}
        onSubmit={(formData) => run(() => createTopic(trackId, node.id, {}, formData))}
      />
    );
  }

  if (mode === "move") {
    /*
      Destinations are filtered to what is structurally possible before they are
      offered. The server checks again — this list was computed from a tree that
      may have moved on — but offering a destination that will be refused is a
      worse experience than not offering it.
    */
    const banned = new Set(descendantIds(node));
    const options = all.filter(
      (candidate) =>
        !banned.has(candidate.id) &&
        candidate.id !== node.id &&
        candidate.depth + subtreeHeightOf(node) <= MAX_DEPTH,
    );

    return (
      <form
        action={(formData) => {
          const raw = formData.get("parentId");
          run(() => moveTopic(node.id, raw === "" ? null : String(raw)));
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <select
          name="parentId"
          defaultValue={node.parentId ?? ""}
          aria-label={`Move ${node.name} into`}
          className="rounded-none border border-border bg-transparent px-2 py-1 font-label text-[0.6rem] uppercase tracking-[0.12em] text-fg focus:border-accent"
        >
          <option value="">Top level</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {[...option.path, option.name].join(" › ")}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className={action}>
          {pending ? "Moving…" : "Move"}
        </button>
        <button type="button" onClick={() => setMode("view")} className={action}>
          Cancel
        </button>
        {error && (
          <span role="alert" className="font-label text-[0.58rem] text-sv-red">
            {error}
          </span>
        )}
      </form>
    );
  }

  if (mode === "confirm") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted">
          Delete <span className="text-fg">{node.name}</span>?
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => deleteTopic(node.id))}
          className="rounded-none px-1.5 py-1 font-label text-[0.58rem] uppercase tracking-[0.14em] text-sv-red disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
        <button type="button" onClick={() => setMode("view")} className={action}>
          Cancel
        </button>
        {error && (
          <span role="alert" className="font-label text-[0.58rem] text-sv-red">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {canHoldChildren && (
        <button type="button" onClick={() => setMode("add")} className={action}>
          + Inside
        </button>
      )}
      <button type="button" onClick={() => setMode("rename")} className={action}>
        Rename
      </button>
      <button type="button" onClick={() => setMode("move")} className={action}>
        Move
      </button>
      {reorder && (
        <>
          <button
            type="button"
            disabled={!canMoveUp || pending}
            onClick={() => run(() => reorderTopic(node.id, "up"))}
            aria-label={`Move ${node.name} up`}
            className={action}
          >
            ↑
          </button>
          <button
            type="button"
            disabled={!canMoveDown || pending}
            onClick={() => run(() => reorderTopic(node.id, "down"))}
            aria-label={`Move ${node.name} down`}
            className={action}
          >
            ↓
          </button>
        </>
      )}
      {/*
        A parent's delete is disabled rather than absent, with the reason on the
        control. Hiding it would leave the rule invisible until you had emptied
        the topic for some other purpose and noticed the button appear.
      */}
      <button
        type="button"
        disabled={hasChildren}
        title={hasChildren ? "Empty this topic first — it still has topics inside." : undefined}
        onClick={() => setMode("confirm")}
        className={action}
      >
        Delete
      </button>
      {error && (
        <span role="alert" className="font-label text-[0.58rem] text-sv-red">
          {error}
        </span>
      )}
    </div>
  );
}

/** One-field inline form, used by rename and add-inside. */
function Inline({
  label,
  defaultValue,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  label: string;
  defaultValue?: string;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <form
      action={onSubmit}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        name="name"
        defaultValue={defaultValue}
        maxLength={80}
        autoFocus
        aria-label={label}
        className="min-w-0 flex-1 rounded-none border border-border bg-transparent px-2 py-1 text-sm focus:border-accent"
      />
      <button type="submit" disabled={pending} className="shrink-0 rounded-none bg-sv-yellow px-2.5 py-1 font-label text-[0.6rem] uppercase tracking-[0.14em] text-sv-ink disabled:opacity-60">
        {pending ? "Saving…" : submitLabel}
      </button>
      <button type="button" onClick={onCancel} className={action}>
        Cancel
      </button>
      {error && (
        <span role="alert" className="font-label text-[0.58rem] text-sv-red">
          {error}
        </span>
      )}
    </form>
  );
}

function descendantIds(node: TrackNode): string[] {
  return node.children.flatMap((child) => [child.id, ...descendantIds(child)]);
}

function subtreeHeightOf(node: TrackNode): number {
  return node.children.length === 0 ? 1 : 1 + Math.max(...node.children.map(subtreeHeightOf));
}
