"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import GlitchShatter from "@/components/spiderverse/GlitchShatter";
import VenomLightning from "@/components/spiderverse/VenomLightning";
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

  /*
    Two different moments, deliberately not the same effect.

    The bolt is *contact* — it fires the instant the button is pressed, before
    anything has been saved, the way energy is channelled through a touch. The
    shatter is *confirmation*, and waits for the server to say the thing was
    actually created. Firing both on the click would say the work was done
    before it was, and firing both on the response would lose the sense that
    the press itself did something.
  */
  const [bolt, setBolt] = useState(0);
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
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={state.error ? true : undefined}
          className="min-w-0 flex-1 rounded-none border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted focus:border-accent aria-invalid:border-sv-red"
        />
        {/* The bolt arcs out from the button rather than sitting inside it, so
            the wrapper is only a positioning anchor and takes no space. */}
        <span className="relative shrink-0">
          <VenomLightning
            fire={bolt}
            width={190}
            height={46}
            className="right-full top-1/2 -translate-y-1/2 translate-x-6"
          />
          <button
            type="submit"
            disabled={pending}
            onClick={() => setBolt((n) => n + 1)}
            className="relative rounded-none bg-sv-yellow px-3.5 py-2 font-label text-[0.65rem] uppercase tracking-[0.14em] text-sv-ink transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Adding…" : submitLabel}
          </button>
        </span>
      </div>
      {state.error && (
        <p role="alert" className="font-label text-[0.7rem] text-sv-red">
          {state.error}
        </p>
      )}
    </form>
  );
}
