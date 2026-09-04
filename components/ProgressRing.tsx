"use client";

import { useState } from "react";

/**
 * Circular completion ring, drawn as SVG so it can animate its own stroke on
 * load. Shows real task completion — never an invented XP or level number.
 *
 * On a *change* it advances from the length it was already showing rather than
 * wiping to empty and redrawing. Redrawing was the one animation on this page
 * that re-performed itself on every check-in, which is exactly how a signal
 * stops reading as part of the moment and starts reading as its own unrelated
 * reaction. A ring that grows by a slice is the same fact, told as a
 * consequence.
 */
export default function ProgressRing({
  completed,
  total,
  label = "Task progress",
}: {
  completed: number;
  total: number;
  /** Names what the ring covers, used in the text alternative. */
  label?: string;
}) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const radius = 66;
  const circumference = 2 * Math.PI * radius;

  /*
    The value this ring was last showing, so the next draw can start there.

    Adjusted during render rather than in an effect: the new length has to be
    known for the very first paint after the change, and an effect would run a
    frame too late and let the ring snap before it animated. This is state
    rather than a ref so that a double-invoked render leaves it correct.
    `from` is null on first mount only, which keeps the original entrance.
  */
  const [seen, setSeen] = useState<{ at: number; from: number | null }>({
    at: percent,
    from: null,
  });
  if (seen.at !== percent) setSeen({ at: percent, from: seen.at });
  const from = seen.at === percent ? seen.from : seen.at;

  // Offset counts backwards from a full circle, so the dash always starts at
  // the top and only its length changes.
  const offsetFor = (value: number) => circumference - circumference * (value / 100);

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
      <div className="relative">
        <svg
          width="168"
          height="168"
          viewBox="0 0 168 168"
          className="-rotate-90"
          role="img"
          aria-label={
            total === 0
              ? `${label}: no tasks yet.`
              : `${label}: ${completed} of ${total} tasks complete, ${percent} percent.`
          }
        >
          <circle
            cx="84"
            cy="84"
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth="12"
          />
          {/*
            At 0% the round line cap would still paint a dot, reading as a
            sliver of progress that does not exist — so draw nothing.
          */}
          {percent > 0 && (
            <circle
              /*
                Keyed by the value so finishing a task re-runs the draw: the
                ring visibly advances to its new length instead of snapping.
              */
              key={percent}
              cx="84"
              cy="84"
              r={radius}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offsetFor(percent)}
              style={{
                ["--ring-from" as string]: `${offsetFor(from ?? 0)}px`,
                // The full sweep is an entrance and can take its time; an
                // advance is part of a check-in and has to keep its pace.
                animation: `ring-draw ${
                  from === null ? "1.1s" : "620ms"
                } cubic-bezier(0.22, 1, 0.36, 1) both`,
              }}
            />
          )}
        </svg>
        <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-4xl font-medium leading-none tracking-tight tabular-nums">
            {percent}%
          </span>
          <span className="mt-1.5 font-label text-[0.6rem] uppercase tracking-[0.15em] text-muted">
            complete
          </span>
        </div>
      </div>

      <p aria-hidden="true" className="font-label text-[0.65rem] uppercase leading-relaxed tracking-[0.14em] tabular-nums text-muted">
        <span className="text-fg">{completed}</span> of <span className="text-fg">{total}</span> tasks
      </p>
    </div>
  );
}
