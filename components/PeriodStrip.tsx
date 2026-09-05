import type { PeriodDay } from "@/lib/rollup";

const INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

/** Monday-first column index, 0-6. `getDay()` is Sunday-first. */
function column(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * One period, day by day.
 *
 * Deliberately the heatmap's own cell language rather than a new chart: the
 * design direction calls for real drawings and grids, never bars, and reusing
 * the grid means a week here and a week in the twelve-week heatmap read the
 * same way.
 *
 * **Always seven columns, however long the period is.** A week is one row; a
 * month is four to six rows with the days before the 1st left blank, so it
 * lands as a small calendar. Laying a month out as a single strip of 31 cells
 * was the obvious alternative and it does not work — at this width the cells
 * shrink to a few pixels and the shape of the month stops being readable, which
 * is the only reason the strip exists.
 *
 * Scope is a single period, so it says nothing about direction over time. Days
 * that have not happened are drawn as an empty outline rather than as a filled
 * zero — a Thursday that has not arrived has not been missed, but the period
 * still has to read as a whole.
 */
export default function PeriodStrip({
  days,
  scope,
  label,
}: {
  days: PeriodDay[];
  scope: string;
  /** What one period is called here, e.g. "week" or "month". */
  label: string;
}) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const level = (count: number) => (count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4)));

  // Blank cells so the first day lands under its real weekday. Zero for a week,
  // since a week bucket already starts on a Monday.
  const lead = days.length ? column(days[0].date) : 0;

  /*
    Magenta, not the heatmap's yellow, and the two are not inconsistent.

    This strip shares the heatmap's cell geometry but answers a different
    question: it sits under "this week, N activities" and encodes *volume*
    across the days of one period. The twelve-week heatmap under "Consistency"
    encodes whether the days were kept at all. Same grammar, different signal,
    so the hue follows the signal.

    These cells are also roughly four times the heatmap's, and yellow at a low
    opacity over near-black turns olive at that size — a colour the palette does
    not contain.
  */
  const cellStyle = (lvl: number) =>
    lvl === 0
      ? { backgroundColor: "var(--border)", opacity: 0.55 }
      : { backgroundColor: "var(--accent)", opacity: 0.28 + lvl * 0.18 };

  const done = days.filter((d) => !d.isFuture && d.count > 0);
  const total = done.reduce((sum, d) => sum + d.count, 0);
  const summary =
    total === 0
      ? `${scope}: nothing completed so far this ${label}.`
      : `${scope}: ${total} activit${total === 1 ? "y" : "ies"} on ${done.length} day${
          done.length === 1 ? "" : "s"
        } this ${label}.`;

  /*
    A month is five or six rows, so it needs narrower cells than a week's single
    row or the block towers over the figure it is annotating — roughly 290px
    tall at the week's cell size, which is more vertical space than the whole
    left-hand column uses.
  */
  const single = days.length <= 7;

  return (
    <figure className={`m-0 w-full ${single ? "max-w-[22rem]" : "max-w-[15rem]"}`}>
      {/* The weekday header is its own row rather than a caption under every
          cell: a month has up to six cells per column and repeating the letter
          under each of them turns the grid into text. */}
      <div aria-hidden="true" className="mb-1.5 grid grid-cols-7 gap-1.5">
        {INITIALS.map((initial, i) => (
          <span
            key={i}
            className="text-center font-label text-[0.55rem] uppercase leading-none tracking-[0.05em] text-muted"
          >
            {initial}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5" role="img" aria-label={summary}>
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead${i}`} aria-hidden="true" />
        ))}
        {days.map((day) => (
          <div
            key={day.key}
            aria-hidden="true"
            className="aspect-square w-full"
            style={
              day.isFuture
                ? { border: "1px solid var(--border)", opacity: 0.5 }
                : {
                    ...cellStyle(level(day.count)),
                    // Today is named by an outline rather than by a brighter
                    // fill, which would read as "more activity".
                    ...(day.isToday ? { outline: "1px solid var(--positive)" } : {}),
                  }
            }
          />
        ))}
      </div>

      {/* The same detail as text, so nothing here is available only visually. */}
      <figcaption className="sr-only">
        {done.length === 0
          ? `No days with completions yet this ${label}.`
          : done.map((d) => `${d.key}: ${d.count} activit${d.count === 1 ? "y" : "ies"}.`).join(" ")}
      </figcaption>
    </figure>
  );
}
