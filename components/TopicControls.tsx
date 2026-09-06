"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  "rounded-none px-1.5 py-1 font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg disabled:opacity-40";

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

  /*
    Focus has to come back to the control that opened the form, and the trigger
    is *unmounted* while the form is open — this whole component swaps its
    render for the form, so there is no live node to hold on to. What is
    remembered instead is which trigger it was; the effect below refocuses it
    once the buttons are back on screen.

    Before this the four forms behaved four different ways: rename and add
    autofocused and closed on Escape, move and delete did neither, and after any
    of them closed `document.activeElement` was `<body>` — a keyboard user was
    dropped back at the top of the document from the middle of a fourteen-row
    list. Cancel on the delete confirm was worse than nothing: it landed on the
    row's Move button, one control to the left of where it started.
  */
  type Trigger = Exclude<Mode, "view">;
  /* One ref holding all four, rather than four refs in a fresh object literal
     every render — that object is a new identity each time, which the effect
     below would then have to either list as a dependency and re-run on every
     render, or leave out and lie about. */
  const triggers = useRef<Record<Trigger, HTMLButtonElement | null>>({
    add: null,
    rename: null,
    move: null,
    confirm: null,
  });
  const returnTo = useRef<Trigger | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    /*
      Entering the confirm state focuses its button explicitly, rather than
      through `autoFocus` like the other three.

      Measured: `autoFocus` on this button did nothing — the confirmation
      rendered with `document.activeElement` still `<body>`, which also meant
      the Escape handler on the wrapper never received a key, so the form could
      not be closed from the keyboard either. The input and the select take
      `autoFocus` reliably; this one does not, and rather than leave the
      behaviour depending on which element type a branch happens to render, the
      focus is placed where it can be seen to happen.
    */
    if (mode === "confirm") {
      confirmButton.current?.focus();
      return;
    }
    if (mode !== "view") return;
    const which = returnTo.current;
    if (!which) return;
    returnTo.current = null;
    // Optional-chained rather than asserted: a successful delete unmounts the
    // row, and a save can re-render it. There is nothing to focus then, and
    // that is the correct outcome, not a failure.
    triggers.current[which]?.focus();
  }, [mode]);

  const open = (next: Trigger) => {
    returnTo.current = next;
    setError(null);
    setMode(next);
  };
  const close = () => setMode("view");
  /** Escape closes every form. Bubbles from whatever inside it has focus. */
  const onEscape = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") close();
  };

  const hasChildren = node.children.length > 0;
  const blockedId = `delete-blocked-${node.id}`;
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
        onCancel={close}
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
        onCancel={close}
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
        onKeyDown={onEscape}
        className="flex flex-wrap items-center gap-2"
      >
        <select
          name="parentId"
          defaultValue={node.parentId ?? ""}
          autoFocus
          aria-label={`Move ${node.name} into`}
          className="sv-input rounded-none border border-border-interactive bg-transparent px-2 py-1 font-label text-[0.75rem] uppercase tracking-[0.12em] text-fg focus:border-accent"
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
        <button type="button" onClick={close} className={action}>
          Cancel
        </button>
        {error && (
          <span role="alert" className="font-label text-[0.75rem] text-sv-red">
            {error}
          </span>
        )}
      </form>
    );
  }

  if (mode === "confirm") {
    return (
      <div className="flex flex-wrap items-center gap-2" onKeyDown={onEscape}>
        <p className="text-sm text-muted">
          Delete <span className="text-fg">{node.name}</span>?
        </p>
        {/*
          A distinct accessible name from the trigger that opened it. Several
          rows can be in confirm state at once, and every one of them offered a
          button called "Delete" — as did every row that was not.
        */}
        <button
          ref={confirmButton}
          type="button"
          disabled={pending}
          aria-label={`Confirm deleting ${node.name}`}
          onClick={() => run(() => deleteTopic(node.id))}
          className="rounded-none px-1.5 py-1 font-label text-[0.75rem] uppercase tracking-[0.14em] text-sv-red disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
        <button type="button" onClick={close} className={action}>
          Cancel
        </button>
        {error && (
          <span role="alert" className="font-label text-[0.75rem] text-sv-red">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {/*
        Rendered on every row, hidden rather than omitted at depth 5.

        A depth-5 node cannot hold children, and dropping the button used to
        drop its width with it: the activity cell and Undo on those rows sat
        43px left of every other row, so the two controls a user reaches for
        most had two x positions down the list instead of one. `invisible`
        keeps the column. It is also `disabled`, so it is not a tab stop and no
        screen reader announces a control that does nothing.
      */}
      {/*
        Every row action names its topic.

        The accessibility tree read `+ INSIDE / RENAME / MOVE / DELETE` with
        nothing to say which row it belonged to, fourteen times over — WCAG
        2.4.6. The pattern is already in this file: the reorder arrows below
        have announced "Move Dynamic Programming up" all along. The visible
        labels are unchanged; only the accessible name is longer.
      */}
      <button
        ref={(el) => { triggers.current.add = el; }}
        type="button"
        disabled={!canHoldChildren}
        aria-label={`Add a topic inside ${node.name}`}
        onClick={() => open("add")}
        className={`${action} disabled:invisible`}
      >
        + Inside
      </button>
      <button
        ref={(el) => { triggers.current.rename = el; }}
        type="button"
        aria-label={`Rename ${node.name}`}
        onClick={() => open("rename")}
        className={action}
      >
        Rename
      </button>
      <button
        ref={(el) => { triggers.current.move = el; }}
        type="button"
        aria-label={`Move ${node.name} to another topic`}
        onClick={() => open("move")}
        className={action}
      >
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
      {/*
        A parent's delete is refused, and the reason has to reach a keyboard.

        It was a `disabled` button carrying a `title`. `disabled` takes it out of
        the tab order, so the explanation — which is a good one — was reachable
        only by hovering a control you cannot operate. `aria-disabled` keeps it
        focusable and announced while still refusing the click, and the reason is
        attached with `aria-describedby` rather than a `title`, which assistive
        tech is not obliged to read at all. The `title` stays for the pointer.

        It is also no longer at 40% opacity, which read as absent rather than
        blocked — see `.sv-action-blocked`.
      */}
      <button
        ref={(el) => { triggers.current.confirm = el; }}
        type="button"
        aria-disabled={hasChildren || undefined}
        aria-describedby={hasChildren ? blockedId : undefined}
        title={hasChildren ? "Empty this topic first — it still has topics inside." : undefined}
        aria-label={`Delete ${node.name}`}
        onClick={() => {
          if (hasChildren) return;
          open("confirm");
        }}
        className={`${action} ${hasChildren ? "sv-action-blocked" : "sv-action-destructive"}`}
      >
        Delete
      </button>
      {hasChildren && (
        <span id={blockedId} className="sr-only">
          Empty this topic first — it still has topics inside.
        </span>
      )}
      {error && (
        <span role="alert" className="font-label text-[0.75rem] text-sv-red">
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
        className="sv-input min-w-0 flex-1 rounded-none border border-border-interactive bg-transparent px-2 py-1 text-sm focus:border-accent"
      />
      <button type="submit" disabled={pending} className="shrink-0 rounded-none bg-sv-yellow px-2.5 py-1 font-label text-[0.75rem] uppercase tracking-[0.14em] text-sv-ink disabled:opacity-60">
        {pending ? "Saving…" : submitLabel}
      </button>
      <button type="button" onClick={onCancel} className={action}>
        Cancel
      </button>
      {error && (
        <span role="alert" className="font-label text-[0.75rem] text-sv-red">
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
