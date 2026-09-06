"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { recordActivity, undoActivity } from "@/lib/actions/activity";
import GlitchShatter from "@/components/spiderverse/GlitchShatter";
import { intensityTier, MAX_TIER } from "@/lib/tree";

/**
 * A leaf's activity for today: the count, the click that raises it, the undo.
 *
 * **Optimistic, and reverted on failure.** The number moves on the press and the
 * write follows. This is the one interaction anyone repeats, and a round trip
 * before the count changes makes a second click feel like it missed — which
 * produces exactly the double-click this then has to be correct about.
 *
 * The optimistic value is the *whole* truth while a write is in flight, not a
 * flag beside it. React discards it when the transition settles and the server's
 * number takes over, so a failed write needs no rollback code: the count simply
 * goes back to what the server last said, and an error line explains why.
 *
 * The shatter fires on a recorded click and never on an undo. It is the app's
 * "that landed" confirmation, and a negative change is stated, not celebrated.
 */
export default function ActivityCell({
  topicId,
  count,
  label,
}: {
  topicId: string;
  /** Today's count, from the server. */
  count: number;
  /** The leaf's name, for the buttons' accessible labels. */
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(count);
  const [error, setError] = useState<string | null>(null);
  const [shatter, setShatter] = useState(0);
  const liveRef = useRef<HTMLSpanElement>(null);

  const run = (delta: 1 | -1) => {
    setError(null);
    startTransition(async () => {
      setOptimistic(Math.max(0, optimistic + delta));
      const result = delta === 1 ? await recordActivity(topicId) : await undoActivity(topicId);
      // No revert branch needed: leaving the transition drops the optimistic
      // value, and the server's count is what renders next either way.
      if (result.error) setError(result.error);
      else if (delta === 1) setShatter((n) => n + 1);
    });
  };

  const tier = intensityTier(optimistic);

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <GlitchShatter fire={shatter} count={7} />
        <button
          type="button"
          onClick={() => run(1)}
          data-tier={tier}
          data-pending={pending || undefined}
          aria-label={`Record activity on ${label}`}
          className="sv-activity h-7 w-7 font-label text-[0.75rem] tabular-nums hover:brightness-125"
        >
          {/* The count is the label. A zero cell shows a dot instead: "0" reads
              as a measured value, and an untouched leaf has not been measured. */}
          {optimistic > 0 ? optimistic : <span aria-hidden="true">·</span>}
        </button>
      </div>

      <button
        type="button"
        onClick={() => run(-1)}
        disabled={optimistic === 0}
        aria-label={`Undo last activity on ${label}`}
        className="rounded-none px-1 py-1 font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg disabled:invisible"
      >
        Undo
      </button>

      {/* Announced, not just drawn: the cell's colour is the only other thing
          that changes, and colour alone carries no information here. */}
      <span ref={liveRef} aria-live="polite" className="sr-only">
        {optimistic === 0
          ? `${label}: no activity today`
          : `${label}: ${optimistic} today${optimistic >= MAX_TIER ? ", top intensity" : ""}`}
      </span>

      {error && (
        <span role="alert" className="font-label text-[0.75rem] text-sv-red">
          {error}
        </span>
      )}
    </div>
  );
}
