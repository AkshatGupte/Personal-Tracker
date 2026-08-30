"use client";

import { useState, useTransition } from "react";
import { deleteTopic, renameTopic } from "@/lib/actions/topics";

export type TopicRowData = {
  id: string;
  name: string;
  taskCount: number;
  completedCount: number;
  isExpected: boolean;
};

const actionButton =
  "rounded-lg px-2 py-1 text-xs font-semibold text-muted transition-colors hover:text-fg";

export default function TopicRow({
  topic,
  trackId,
}: {
  topic: TopicRowData;
  trackId: string;
}) {
  const [mode, setMode] = useState<"view" | "rename" | "confirm">("view");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onRename = (formData: FormData) => {
    startTransition(async () => {
      const result = await renameTopic(topic.id, trackId, formData);
      if (result.error) setError(result.error);
      else {
        setError(null);
        setMode("view");
      }
    });
  };

  const onDelete = () => {
    startTransition(async () => {
      await deleteTopic(topic.id, trackId);
    });
  };

  if (mode === "rename") {
    return (
      <li className="px-5 py-3.5">
        <form action={onRename} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              name="name"
              defaultValue={topic.name}
              autoFocus
              maxLength={80}
              aria-label="Topic name"
              className="min-w-0 flex-1 rounded-lg border border-border bg-elevated px-3 py-1.5 text-sm focus:border-accent"
            />
            <button
              type="submit"
              disabled={pending}
              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("view");
                setError(null);
              }}
              className={actionButton}
            >
              Cancel
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-muted">
              {error}
            </p>
          )}
        </form>
      </li>
    );
  }

  if (mode === "confirm") {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <p className="text-sm">
          Delete <span className="font-semibold">{topic.name}</span>
          {topic.taskCount > 0 && (
            <>
              {" "}
              and its {topic.taskCount} task{topic.taskCount === 1 ? "" : "s"}
            </>
          )}
          ? This cannot be undone.
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-streak disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
          <button type="button" onClick={() => setMode("view")} className={actionButton}>
            Cancel
          </button>
        </div>
      </li>
    );
  }

  const allDone = topic.taskCount > 0 && topic.completedCount === topic.taskCount;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate font-semibold">
          {topic.name}
          {topic.isExpected && (
            <span className="rounded-lg border border-border px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wider text-muted">
              curriculum
            </span>
          )}
        </p>
        <p className="tabular mt-0.5 text-xs text-muted">
          {topic.taskCount === 0 ? (
            "No tasks yet"
          ) : (
            <>
              <span className={allDone ? "font-semibold text-positive" : "text-fg"}>
                {topic.completedCount}
              </span>
              {" of "}
              {topic.taskCount} task{topic.taskCount === 1 ? "" : "s"} done
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={() => setMode("rename")} className={actionButton}>
          Rename
        </button>
        <button type="button" onClick={() => setMode("confirm")} className={actionButton}>
          Delete
        </button>
      </div>
    </li>
  );
}
