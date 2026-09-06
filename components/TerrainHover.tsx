"use client";

import { useState } from "react";
import { describeDay, type TerrainPoint } from "@/lib/terrain";
import { parseDayKey } from "@/lib/day";

/**
 * The read-off layer for the trajectory: one hit target per day, and a caption
 * saying what that day was.
 *
 * **Separate from `TerrainProfile` on purpose.** The profile is a server
 * component drawing static geometry, and it should stay one — this is the only
 * part that needs state, so it is the only part that ships as JavaScript. It
 * sits over the chart as an absolutely positioned sibling rather than inside
 * the SVG, so the drawing's `preserveAspectRatio="none"` cannot stretch the
 * caption box or the marker into an ellipse.
 *
 * Hit targets are full-height columns, not the points themselves. A 14-day
 * window on a narrow card gives each point a few pixels of diameter, and asking
 * someone to hit that is asking them not to bother; a column is the whole band
 * of x that belongs to that day, which is what the reader means when they point
 * at part of the chart.
 *
 * **Hover is not the only way to get this.** Each column is a real `button`, so
 * the series is walkable by keyboard and every day is announced with its date
 * and figures; `TerrainProfile` also carries the whole series as text in its
 * `aria-label`, and the day-by-day list below the chart is always there. This
 * layer adds a fast read for a sighted pointer user, and nothing depends on it.
 */
export default function TerrainHover({
  points,
  domainMax,
  /** Matches the chart's own right gutter so the columns line up with the plot. */
  rightGutter,
  focusable = true,
  compact = false,
}: {
  points: TerrainPoint[];
  domainMax: number;
  rightGutter: number;
  /** Row-sized: a one-line caption pinned inside the chart box. */
  compact?: boolean;
  /**
   * Whether the columns take keyboard focus.
   *
   * False for the row-sized charts on the home page, and that is an
   * accessibility decision rather than a shortcut: fourteen focus stops per
   * track would put seventy of them between the top of a five-track list and
   * the first thing anyone actually wants to reach. Those rows already carry
   * their figures as text and link to the track's own page, where the full
   * chart *is* focusable and carries the day-by-day list underneath. Nothing is
   * reachable only by mouse; the mouse just gets a shortcut here.
   */
  focusable?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) return null;

  const point = active === null ? null : points[active];
  const plotWidth = 100 - rightGutter;
  const step = plotWidth / Math.max(1, points.length - 1);

  return (
    <div className="pointer-events-none absolute inset-0">
      {point && (
        <>
          {/* The guide, so the caption is tied to a place on the curve rather
              than floating over it. */}
          <div
            className="absolute top-0 bottom-0 w-px"
            style={{ left: `${point.x * plotWidth}%`, background: "var(--sv-cyan)", opacity: 0.55 }}
          />
          {/* The point itself, marked. Square, like everything else here. */}
          <div
            className="absolute h-2 w-2"
            style={{
              left: `${point.x * plotWidth}%`,
              top: `${(1 - point.y) * 100}%`,
              transform: "translate(-50%, -50%)",
              background: "var(--sv-cyan)",
            }}
          />
          <TerrainCaption
            point={point}
            domainMax={domainMax}
            x={point.x * plotWidth}
            compact={compact}
          />
        </>
      )}

      {points.map((p, i) => (
        <button
          key={p.dayKey}
          type="button"
          /*
            The columns are the only interactive thing in a decorative layer, so
            pointer events are switched back on here and nowhere else.
          */
          className="sv-terrain-hit pointer-events-auto absolute top-0 bottom-0 cursor-default border-0 bg-transparent p-0"
          style={{ left: `${Math.max(0, p.x * plotWidth - step / 2)}%`, width: `${step}%` }}
          tabIndex={focusable ? undefined : -1}
          aria-hidden={focusable ? undefined : true}
          onMouseEnter={() => setActive(i)}
          onFocus={() => setActive(i)}
          onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
          onBlur={() => setActive((cur) => (cur === i ? null : cur))}
        >
          <span className="sr-only">
            {longDay(p.dayKey)}: {describeDay(p)}
          </span>
        </button>
      ))}
    </div>
  );
}

/** "5 September 2026", from the day key the series is already built on. */
function longDay(key: string): string {
  return parseDayKey(key).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * The caption box: a comic panel caption, not a rounded tooltip.
 *
 * **Two shapes, because two boxes.** The full chart has room for a stacked
 * block that follows the guide, flipping left in the right third where the
 * newest and most-read days live. A track row does not: it is 56px tall and the
 * chart shares its width with the track's name on one side and Rename/Delete on
 * the other, so a following block ran straight over the actions.
 *
 * The row caption is therefore one line, and it is pinned to whichever half of
 * the chart the reader is *not* pointing at rather than tracking the guide
 * exactly. Nothing is lost by that — the guide line and the marker already say
 * which day it is, to the pixel; the caption only has to say what that day was,
 * and it stays inside the chart's own box while doing it.
 */
function TerrainCaption({
  point,
  domainMax,
  x,
  compact,
}: {
  point: TerrainPoint;
  domainMax: number;
  x: number;
  compact: boolean;
}) {
  const flip = x > (compact ? 50 : 62);

  if (compact) {
    return (
      <div
        className="absolute -top-1 z-10 border-2 px-2 py-1 whitespace-nowrap"
        style={{
          [flip ? "left" : "right"]: 0,
          background: "var(--sv-ink)",
          borderColor: "var(--sv-cyan)",
          color: "var(--fg)",
        }}
      >
        <span className="font-label text-[0.6875rem] uppercase tracking-[0.1em] tabular-nums text-sv-cyan">
          {shortDay(point.dayKey)}
        </span>{" "}
        <span className="font-label text-[0.6875rem] uppercase tracking-[0.1em] tabular-nums">
          {point.count} {point.count === 1 ? "activity" : "activities"}
        </span>{" "}
        <span className="font-label text-[0.6875rem] uppercase tracking-[0.1em] tabular-nums text-muted">
          · {point.cumulative} of {domainMax}
        </span>
      </div>
    );
  }

  return (
    <div
      className="absolute top-1 z-10 min-w-[9rem] border-2 px-2 py-1.5"
      style={{
        left: `${x}%`,
        transform: `translateX(${flip ? "calc(-100% - 8px)" : "8px"})`,
        background: "var(--sv-ink)",
        borderColor: "var(--sv-cyan)",
        color: "var(--fg)",
      }}
    >
      <p className="font-label text-[0.75rem] uppercase tracking-[0.12em] text-sv-cyan">
        {longDay(point.dayKey)}
      </p>
      <p className="mt-1 font-mono text-sm tabular-nums">
        {point.count} {point.count === 1 ? "activity" : "activities"}
      </p>
      <p className="font-label text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
        elevation <span className="tabular-nums text-fg">{point.cumulative}</span> of {domainMax}
      </p>
    </div>
  );
}

/** "1 Sep" — the row caption has one line to spend and the year is not news. */
function shortDay(key: string): string {
  return parseDayKey(key).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
