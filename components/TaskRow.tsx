"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useCheckInBeat } from "@/components/CheckInBeat";
import CheckInReport from "@/components/CheckInReport";
import { deleteTask, setCheckIn, updateTask } from "@/lib/actions/tasks";
import { DIFFICULTIES } from "@/lib/difficulty";
import type { CheckInOutcome } from "@/lib/streak";

export type TaskRowData = {
  id: string;
  title: string;
  difficulty: string | null;
  /**
   * Whether this activity has been checked in *today*. It is derived per
   * render for the current day, not stored on the task — a recurring activity
   * has no finished state, and yesterday's check-in must not read as checked.
   */
  checkedInToday: boolean;
};

/**
 * How long the outcome line stands before it clears.
 *
 * Derived from the interaction rather than picked round. The line is readable
 * about 370ms after the click (~100ms round trip, then a 90ms delay and a 180ms
 * entrance); the longest of them — "Checked in · day already counted · streak 4"
 * — is eight tokens of tracked uppercase mono, which is slower to read than
 * prose and takes roughly 2.5s; and about a second of slack covers an eye that
 * was on the tick or the header first. That totals just under four.
 *
 * It is capped at the other end by the fact that this describes a moment. A
 * line still standing well after the act is the interface talking about the
 * past while the user acts in the present, and that is what reads as sluggish.
 * It blocks nothing either way: clicking any tick clears the standing line at
 * once, so this governs only the last check-in of a run.
 */
const REPORT_DWELL_MS = 3800;

/**
 * The same, for a crossed streak milestone.
 *
 * Longer for the same reason the ordinary figure is 3800: the line is longer to
 * read. "Checked in · 30 day streak · milestone · longest yet" is thirteen
 * tokens of tracked uppercase against eight, and it wraps to two lines on a
 * narrow screen. The cap at the other end still applies — this describes a
 * moment, and a line still standing long after the act reads as sluggish — so
 * it buys reading time and no more. Clicking any tick still clears it at once.
 */
const MILESTONE_DWELL_MS = 5600;

// Actions recede until sought: mono, uppercase, small. They must never
// compete with the task title they sit beside.
const actionButton =
  "rounded-none px-1.5 py-1 font-label text-[0.58rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg";

/** The tick glyph, drawn three times during a check-in: two plates and the real one. */
function TickPath({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style}
      />
    </svg>
  );
}

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

  // The tick flips on the click and the server catches up. Today's check-in
  // row stays the source of truth: when the page revalidates, this falls back
  // to it, so a rejected write corrects itself rather than leaving a false tick.
  const [done, setDone] = useOptimistic(task.checkedInToday);

  /**
   * Fires once on the *transition* into checked, never on the resting state.
   *
   * The check-in is the product's core loop, so it is the one interaction in
   * the app allowed to feel like an event: the tick's magenta and cyan plates
   * scissor apart and snap back over 320ms. Keyed to the change rather than to
   * `done`, or every re-render of an already-checked task would replay it and
   * the whole list would twitch on each revalidation.
   */
  const [justChecked, setJustChecked] = useState(false);
  const splitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * The second half of the beat: what the check-in actually did.
   *
   * Held per row, because the line belongs to the row that was clicked. It is
   * tagged with the act that produced it and shown only while that act is still
   * the live one, so checking in several tasks quickly leaves one statement
   * rather than a stack of them — the same singleness the header keeps by
   * emphasising only one measurement.
   */
  const [report, setReport] = useState<{ seq: number; outcome: CheckInOutcome } | null>(
    null,
  );
  const reportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { beat, publish } = useCheckInBeat();
  const live = report && report.seq === (beat?.seq ?? 0) ? report.outcome : null;

  useEffect(() => () => {
    if (splitTimer.current) clearTimeout(splitTimer.current);
    if (reportTimer.current) clearTimeout(reportTimer.current);
  }, []);

  const onToggle = () => {
    const next = !done;
    if (next) {
      setJustChecked(true);
      if (splitTimer.current) clearTimeout(splitTimer.current);
      splitTimer.current = setTimeout(() => setJustChecked(false), 340);
    }
    // Cleared on the click, not when the next line lands: the old line
    // describes a write that is being replaced, and leaving it up for the
    // round trip states the opposite of what is happening.
    if (reportTimer.current) clearTimeout(reportTimer.current);
    setReport(null);

    startTransition(async () => {
      setDone(next);
      const result = await setCheckIn(task.id, next);
      setError(result.error ?? null);

      if (result.outcome) {
        setReport({ seq: publish(result.outcome), outcome: result.outcome });
        reportTimer.current = setTimeout(
          () => setReport(null),
          result.outcome.milestone ? MILESTONE_DWELL_MS : REPORT_DWELL_MS,
        );
      }
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
              className="min-w-0 flex-1 rounded-none border border-border bg-transparent px-3 py-1.5 text-sm focus:border-accent"
            />
            <select
              name="difficulty"
              defaultValue={task.difficulty ?? ""}
              aria-label="Difficulty (optional)"
              className="shrink-0 rounded-none border border-border bg-transparent px-2 py-1.5 font-label text-[0.65rem] uppercase tracking-[0.12em] text-muted focus:border-accent"
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
            <p role="alert" className="font-label text-[0.7rem] text-muted">
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

  return (
    <li className="py-2">
      <div className="flex items-center justify-between gap-3">
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
            aria-label={`Check in to ${task.title} for today`}
            className="shrink-0 rounded-none p-1.5"
          >
            <span
              aria-hidden="true"
              className={`relative flex h-6 w-6 items-center justify-center rounded-none border-2 transition-colors ${
                done
                  ? "border-positive bg-positive/15 text-positive"
                  : "border-border text-transparent hover:border-sv-yellow"
              }`}
            >
              {/* The two plates. Present only during the burst, so a checked task
                  at rest is a clean cyan tick and not a permanently fringed one. */}
              {justChecked && (
                <>
                  <span className="sv-checkin-a pointer-events-none absolute inset-0 flex items-center justify-center text-sv-magenta mix-blend-screen">
                    <TickPath />
                  </span>
                  <span className="sv-checkin-b pointer-events-none absolute inset-0 flex items-center justify-center text-sv-cyan mix-blend-screen">
                    <TickPath />
                  </span>
                </>
              )}
              <span className="relative">
                <TickPath
                  // One short moment on the tick itself. Reduced motion cancels it
                  // globally, and the state is never carried by motion alone —
                  // colour, the border and aria-pressed all say it too.
                  style={done ? { animation: "check-in 0.28s ease-out both" } : undefined}
                />
              </span>
            </span>
          </button>

          <span className={`min-w-0 truncate text-sm ${done ? "text-muted line-through decoration-positive/60" : ""}`}>
            {task.title}
          </span>
          {task.difficulty && (
            <span className="shrink-0 border border-border px-1.5 py-0.5 font-label text-[0.55rem] uppercase tracking-[0.14em] text-muted">
              {task.difficulty}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {error && (
            <span role="alert" className="font-label text-[0.6rem] text-muted">
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
      </div>

      {/*
        A live region that is always mounted, so the outcome is announced when
        it arrives rather than being missed as a freshly inserted region. Empty
        it takes no space, so an unchecked row lays out exactly as before.
      */}
      <div role="status" aria-live="polite" className="min-w-0">
        {live && <CheckInReport outcome={live} />}
      </div>
    </li>
  );
}
