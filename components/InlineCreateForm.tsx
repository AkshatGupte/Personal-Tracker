"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionResult } from "@/lib/actions/tracks";

const EMPTY: ActionResult = {};

type Action = (previous: ActionResult, formData: FormData) => Promise<ActionResult>;

/**
 * One-field create form used for tracks and topics, and ready for tasks.
 *
 * Deliberately not autofocused: the form sits in the page rather than in a
 * dialog, and grabbing focus on arrival is disruptive. Focus returns to the
 * field only after a successful add, where it has been earned.
 */
export default function InlineCreateForm({
  action,
  label,
  placeholder,
  submitLabel = "Add",
}: {
  action: Action;
  /** Accessible name for the field. */
  label: string;
  placeholder: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pending || state === EMPTY || state.error) return;
    formRef.current?.reset();
    inputRef.current?.focus();
  }, [state, pending]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          name="name"
          maxLength={80}
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={state.error ? true : undefined}
          className="min-w-0 flex-1 rounded-[3px] border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-[3px] bg-accent px-3.5 py-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Adding…" : submitLabel}
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
