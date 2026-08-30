"use client";

import { useOptimistic, useState, useTransition } from "react";
import { deleteTask, setTaskCompletion, updateTask } from "@/lib/actions/tasks";
import { DIFFICULTIES } from "@/lib/difficulty";

export type TaskRowData = {
  id: string;
  title: string;
  difficulty: string | null;
  status: string;
};

// Actions recede until sought: mono, uppercase, small. They must never
// compete with the task title they sit beside.
const actionButton =
  "rounded-[3px] px-1.5 py-1 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg";

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

  // The tick flips on the click and the server catches up. Task.status stays
  // the source of truth: when the page revalidates, this falls back to it, so
  // a rejected write corrects itself rather than leaving a false tick.
  const [done, setDone] = useOptimistic(task.status === "completed");

  const onToggle = () => {
    const next = !done;
    startTransition(async () => {
      setDone(next);
      const result = await setTaskCompletion(task.id, next);
      setError(result.error ?? null);
    });
  };

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
              className="min-w-0 flex-1 rounded-[3px] border border-border bg-transparent px-3 py-1.5 text-sm focus:border-accent"
            />
            <select
              name="difficulty"
              defaultValue={task.difficulty ?? ""}
              aria-label="Difficulty (optional)"
              className="shrink-0 rounded-[3px] border border-border bg-transparent px-2 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted focus:border-accent"
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
              className="shrink-0 rounded-[3px] bg-accent px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-accent-contrast disabled:opacity-60"
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
            <p role="alert" className="font-mono text-[0.7rem] text-muted">
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
            className="rounded-[3px] px-1.5 py-1 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-streak disabled:opacity-60"
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
        {/*
          A toggle button rather than a checkbox input: the accessible name
          stays put and aria-pressed carries the state, and it needs no form.
          Padding gives it a comfortable target around a small mark.
        */}
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={done}
          aria-label={`Mark ${task.title} complete`}
          className="shrink-0 rounded-[3px] p-1.5"
        >
          <span
            aria-hidden="true"
            className={`flex h-5 w-5 items-center justify-center rounded-[3px] border transition-colors ${
              done
                ? "border-positive bg-positive/15 text-positive"
                : "border-border text-transparent hover:border-accent"
            }`}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
              <path
                d="M3.5 8.5 6.5 11.5 12.5 4.5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                // One short moment on the tick itself. Reduced motion cancels
                // it globally, and the state is never carried by motion alone.
                style={done ? { animation: "check-in 0.28s ease-out both" } : undefined}
              />
            </svg>
          </span>
        </button>

        <span className={`min-w-0 truncate text-sm ${done ? "text-muted" : ""}`}>
          {task.title}
        </span>
        {task.difficulty && (
          <span className="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted">
            {task.difficulty}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {error && (
          <span role="alert" className="font-mono text-[0.6rem] text-muted">
            {error}
          </span>
        )}
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
