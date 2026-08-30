"use client";

import { useState, useTransition } from "react";
import NewTaskForm from "@/components/NewTaskForm";
import TaskRow, { type TaskRowData } from "@/components/TaskRow";
import { deleteTopic, renameTopic } from "@/lib/actions/topics";

export type TopicRowData = {
  id: string;
  name: string;
  taskCount: number;
  completedCount: number;
  isExpected: boolean;
  tasks: TaskRowData[];
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
  // Open by default: adding tasks is the main thing to do here, and hiding it
  // behind a click would put friction on the primary action.
  const [open, setOpen] = useState(true);
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
    <li className="px-5 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((wasOpen) => !wasOpen)}
            aria-expanded={open}
            aria-controls={`tasks-${topic.id}`}
            className="shrink-0 rounded-lg px-1 text-xs text-muted transition-colors hover:text-fg"
          >
            <span aria-hidden="true">{open ? "\u25BE" : "\u25B8"}</span>
            <span className="sr-only">
              {open ? `Hide tasks in ${topic.name}` : `Show tasks in ${topic.name}`}
            </span>
          </button>
          <div className="min-w-0">
            <p className="flex min-w-0 items-center gap-2 truncate font-semibold">
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
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setMode("rename")} className={actionButton}>
            Rename
          </button>
          <button type="button" onClick={() => setMode("confirm")} className={actionButton}>
            Delete
          </button>
        </div>
      </div>

      {open && (
        <div id={`tasks-${topic.id}`} className="mt-3 border-l border-border pl-4">
          {topic.tasks.length > 0 && (
            <ul className="mb-2 divide-y divide-border">
              {topic.tasks.map((task) => (
                <TaskRow key={task.id} task={task} trackId={trackId} />
              ))}
            </ul>
          )}
          <NewTaskForm topicId={topic.id} trackId={trackId} />
        </div>
      )}
    </li>
  );
}
