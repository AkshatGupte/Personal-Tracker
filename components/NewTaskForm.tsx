"use client";

import { useActionState, useEffect, useRef } from "react";
import { createTask } from "@/lib/actions/tasks";
import { DIFFICULTIES } from "@/lib/difficulty";
import type { ActionResult } from "@/lib/actions/tracks";

const EMPTY: ActionResult = {};

/**
 * Adds a task to a topic. Kept separate from InlineCreateForm because a task
 * carries two fields, and pushing a select through the single-field primitive
 * would add props no other caller uses.
 */
export default function NewTaskForm({
  topicId,
  trackId,
}: {
  topicId: string;
  trackId: string;
}) {
  const action = createTask.bind(null, topicId, trackId);
  const [state, formAction, pending] = useActionState(action, EMPTY);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear and refocus after a successful add so several tasks can be entered
  // in a row. Not autofocused on mount: the form sits in the page.
  useEffect(() => {
    if (pending || state === EMPTY || state.error) return;
    formRef.current?.reset();
    inputRef.current?.focus();
  }, [state, pending]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          name="title"
          maxLength={140}
          placeholder="e.g. Solve: Two Sum"
          aria-label="Task title"
          aria-invalid={state.error ? true : undefined}
          className="min-w-0 flex-1 rounded-[3px] border border-border bg-transparent px-3 py-1.5 text-sm placeholder:text-muted focus:border-accent"
        />
        <select
          name="difficulty"
          defaultValue=""
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
          className="shrink-0 rounded-[3px] bg-accent px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="font-mono text-[0.7rem] text-muted">
          {state.error}
        </p>
      )}
    </form>
  );
}
