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
  "rounded-none px-1.5 py-1 font-label text-[0.58rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg";

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
              aria-invalid={error ? true : undefined}
              className="min-w-0 flex-1 rounded-none border border-border bg-transparent px-3 py-1.5 text-sm focus:border-accent aria-invalid:border-sv-red"
            />
            <button
              type="submit"
              disabled={pending}
              className="shrink-0 rounded-none bg-sv-yellow px-3 py-1.5 font-label text-[0.6rem] uppercase tracking-[0.14em] text-sv-ink disabled:opacity-60"
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
            <p role="alert" className="font-label text-[0.7rem] text-sv-red">
              {error}
            </p>
          )}
        </form>
      </li>
    );
  }

  if (mode === "confirm") {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 py-3.5">
        {/* Muted frame, name at full contrast — see the note in TrackRow. */}
        <p className="text-sm text-muted">
          Delete <span className="text-fg">{topic.name}</span>
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
            className="rounded-none px-1.5 py-1 font-label text-[0.58rem] uppercase tracking-[0.14em] text-sv-red disabled:opacity-60"
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

  // Every activity in this topic has been checked in today. It is a state of
  // the day, not of the topic: tomorrow it starts empty again.
  const allDone = topic.taskCount > 0 && topic.completedCount === topic.taskCount;
  const ratio = topic.taskCount === 0 ? 0 : topic.completedCount / topic.taskCount;

  return (
    <li className="py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((wasOpen) => !wasOpen)}
            aria-expanded={open}
            aria-controls={`tasks-${topic.id}`}
            /*
              A 24px square, which the caret alone was nowhere near: it measured
              13x14, well under the 24x24 minimum, and it is the only way to
              open or close a topic. The glyph is unchanged — this is hit area,
              not size.
            */
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-none text-[0.6rem] text-muted transition-colors hover:text-fg"
          >
            <span aria-hidden="true">{open ? "\u25BE" : "\u25B8"}</span>
            <span className="sr-only">
              {open ? `Hide tasks in ${topic.name}` : `Show tasks in ${topic.name}`}
            </span>
          </button>
          <p className="flex min-w-0 items-baseline gap-2 truncate font-semibold">
            {topic.name}
            {topic.isExpected && (
              <span className="font-label text-[0.55rem] uppercase tracking-[0.14em] text-muted">
                curriculum
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <p className="font-label text-[0.65rem] tabular-nums tracking-[0.1em] text-muted">
            {topic.taskCount === 0 ? (
              <span className="sv-status">no tasks</span>
            ) : (
              <>
                <span className={allDone ? "text-positive" : "text-fg"}>
                  {topic.completedCount}
                </span>
                {" / "}
                {topic.taskCount} today
              </>
            )}
          </p>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMode("rename")} className={actionButton}>
              Rename
            </button>
            <button type="button" onClick={() => setMode("confirm")} className={actionButton}>
              Delete
            </button>
          </div>
        </div>
      </div>

      {/*
        Progress as a stratum: the same hairline language as the terrain, so
        the chart and the list share one grammar. Accent means volume here as
        everywhere; a finished topic switches to positive, which means done.
      */}
      {topic.taskCount > 0 && (
        <div className="relative mt-3 h-0.5 bg-border" aria-hidden="true">
          <div
            className={`absolute inset-y-0 left-0 ${allDone ? "bg-positive" : "bg-accent"}`}
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
      )}

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
