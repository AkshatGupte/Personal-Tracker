"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import GlitchShatter from "@/components/spiderverse/GlitchShatter";
import type { ActionResult } from "@/lib/actions/tracks";

const EMPTY: ActionResult = {};

type Action = (previous: ActionResult, formData: FormData) => Promise<ActionResult>;

/**
 * One-field create form, used for tracks and for top-level topics.
 *
 * Deliberately not autofocused: the form sits in the page rather than in a
 * dialog, and grabbing focus on arrival is disruptive. Focus returns to the
 * field only after a successful add, where it has been earned.
 *
 * **A placeholder is back, and the earlier reasoning for dropping it was only
 * half the picture.** It was removed because it was not carrying the accessible
 * name — true, and `aria-label` still carries it, so nothing here depends on
 * the placeholder. What that missed is the sighted empty state: on a track with
 * no topics this field is the only way forward, and an unlabelled bordered box
 * above an empty list does not say so. The border was `--border` at 1.32:1 on
 * the page ground, which is barely a box at all.
 */
export default function InlineCreateForm({
  action,
  label,
  placeholder,
  submitLabel = "Add",
}: {
  action: Action;
  /** Accessible name for the field, via `aria-label`. */
  label: string;
  /** Visible prompt. Not the accessible name — `aria-label` still is, so this
   *  disappearing on the first keystroke costs a screen reader nothing. */
  placeholder: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Confirmation only. The lightning that used to fire on the press is gone —
  // it is ambient now and correlates with nothing, so the shatter no longer has
  // to wait its turn and fires as soon as the create comes back.
  const [shatter, setShatter] = useState(0);

  useEffect(() => {
    if (pending || state === EMPTY || state.error) return;
    setShatter((n) => n + 1);
    formRef.current?.reset();
    inputRef.current?.focus();
  }, [state, pending]);

  return (
    <form ref={formRef} action={formAction} className="relative flex flex-col gap-2">
      <GlitchShatter fire={shatter} count={8} />
      <div className="flex gap-2">
        <input
          ref={inputRef}
          name="name"
          maxLength={80}
          aria-label={label}
          aria-invalid={state.error ? true : undefined}
          placeholder={placeholder}
          className="sv-input min-w-0 flex-1 rounded-none border border-border-interactive bg-transparent px-3 py-2 text-sm placeholder:text-muted focus:border-accent aria-invalid:border-sv-red"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-none bg-sv-yellow px-3.5 py-2 font-label text-[0.75rem] uppercase tracking-[0.14em] text-sv-ink transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Adding…" : submitLabel}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="font-label text-[0.75rem] text-sv-red">
          {state.error}
        </p>
      )}
    </form>
  );
}
