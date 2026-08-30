"use client";

import { useState, useTransition } from "react";
import { deleteTask, updateTask } from "@/lib/actions/tasks";
import { DIFFICULTIES } from "@/lib/difficulty";

export type TaskRowData = {
  id: string;
  title: string;
  difficulty: string | null;
  status: string;
};

const actionButton =
  "rounded-lg px-2 py-1 text-xs font-semibold text-muted transition-colors hover:text-fg";

export default function TaskRow({
  task,
  trackId,
}: {
  task: TaskRowData;
  trackId: string;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSave = (formData: FormData) => {
    startTransition(async () => {
      const result = await updateTask(task.id, trackId, formData);
      if (result.error) setError(result.error);
      else {
        setError(null);
        setMode("view");
      }
    });
  };

  const onDelete = () => {
    startTransition(async () => {
      await deleteTask(task.id, trackId);
    });
  };

  if (mode === "edit") {
    return (
      <li className="py-2">
        <form action={onSave} className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <input
              name="title"
              defaultValue={task.title}
              autoFocus
              maxLength={140}
              aria-label="Task title"
              className="min-w-0 flex-1 rounded-lg border border-border bg-elevated px-3 py-1.5 text-sm focus:border-accent"
            />
            <select
              name="difficulty"
              defaultValue={task.difficulty ?? ""}
              aria-label="Difficulty (optional)"
              className="shrink-0 rounded-lg border border-border bg-elevated px-2 py-1.5 text-sm text-muted focus:border-accent"
            >
              <option value="">Difficulty</option>
              {DIFFICULTIES.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
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
      <li className="flex flex-wrap items-center justify-between gap-3 py-2">
        <p className="text-sm">
          Delete <span className="font-semibold">{task.title}</span>? This cannot be
          undone.
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

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-sm">{task.title}</span>
        {task.difficulty && (
          <span className="shrink-0 rounded-lg border border-border px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wider text-muted">
            {task.difficulty}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={() => setMode("edit")} className={actionButton}>
          Edit
        </button>
        <button type="button" onClick={() => setMode("confirm")} className={actionButton}>
          Delete
        </button>
      </div>
    </li>
  );
}
