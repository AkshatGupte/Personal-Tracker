"use client";

import { useOptimistic, useState, useTransition } from "react";
import { recordActivity, undoActivity } from "@/lib/actions/activity";
import GlitchShatter from "@/components/spiderverse/GlitchShatter";
import { intensityTier, MAX_TIER } from "@/lib/tree";

/**
 * A leaf's activity for a day: the count, the click that raises it, the undo.
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
 * That holds for a backdated record too — filling in a day you did the work on
 * is still a recorded click, and it is the streak *note* rather than the effect
 * that carries the consequence.
 */
export default function ActivityCell({
  topicId,
  count,
  label,
  day,
  dayLabel,
  onStreakNote,
  onGoalNotes,
}: {
  topicId: string;
  /** The count for `day`, from the server. */
  count: number;
  /** The leaf's name, for the buttons' accessible labels. */
  label: string;
  /**
   * `yyyy-mm-dd` to record onto. Undefined means today and is passed through as
   * undefined, so the common path calls the action exactly as it always did.
   */
  day?: string;
  /** "Sunday 6 September" — named in the accessible label when backdating, so
   *  the day is never carried by the mode's colour alone. */
  dayLabel?: string;
  /** Backdated writes hand their streak note up; the list states it once. */
  onStreakNote?: (note: string) => void;
  /**
   * Lines for any linked goals this write advanced, handed up the same way.
   *
   * The cell does not render them itself: several rows can each advance the same
   * goal, and a note per row would repeat one fact across the list. The list owns
   * the status region and states each one once.
   */
  onGoalNotes?: (notes: string[]) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(count);
  const [error, setError] = useState<string | null>(null);
  const [shatter, setShatter] = useState(0);

  const backdated = day !== undefined && dayLabel !== undefined;
  const forDay = backdated ? ` for ${dayLabel}` : "";

  const run = (delta: 1 | -1) => {
    setError(null);
    startTransition(async () => {
      setOptimistic(Math.max(0, optimistic + delta));
      const result =
        delta === 1 ? await recordActivity(topicId, day) : await undoActivity(topicId, day);
      // No revert branch needed: leaving the transition drops the optimistic
      // value, and the server's count is what renders next either way.
      if (result.error) setError(result.error);
      else if (delta === 1) setShatter((n) => n + 1);
      if (result.streakNote) onStreakNote?.(result.streakNote);
      if (result.goalNotes?.length) onGoalNotes?.(result.goalNotes);
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
          /* The keyboard roving in LeafList moves between these. */
          data-leaf-record={topicId}
          aria-label={`Record activity on ${label}${forDay}`}
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
        data-leaf-undo={topicId}
        aria-label={`Undo last activity on ${label}${forDay}`}
        className="rounded-none px-1 py-1 font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg disabled:invisible"
      >
        Undo
      </button>

      {/* Announced, not just drawn: the cell's colour is the only other thing
          that changes, and colour alone carries no information here. */}
      <span aria-live="polite" className="sr-only">
        {optimistic === 0
          ? `${label}: no activity${forDay || " today"}`
          : `${label}: ${optimistic}${forDay || " today"}${optimistic >= MAX_TIER ? ", top intensity" : ""}`}
      </span>

      {error && (
        <span role="alert" className="font-label text-[0.75rem] text-sv-red">
          {error}
        </span>
      )}
    </div>
  );
}
