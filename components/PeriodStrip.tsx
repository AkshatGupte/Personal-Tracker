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
  /*
    Alpha in the fill, not `opacity` on the element.

    The two composite identically over the page ground, so nothing about the
    grid changed — but element opacity also dims everything *inside* the cell,
    and the cells now contain their date. A 0.28-opacity cell would have taken
    its numeral down with it and put the date under the contrast floor.
  */
  const cellStyle = (lvl: number) =>
    lvl === 0
      ? { backgroundColor: "color-mix(in srgb, var(--border) 55%, transparent)" }
      : {
          backgroundColor: `color-mix(in srgb, var(--accent) ${Math.round(
            (0.28 + lvl * 0.18) * 100,
          )}%, transparent)`,
        };

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

    Widened from 15rem when the dates went in: at 15rem a month's cells are
    about 30px and a 12px numeral inside one has almost no margin. 18rem puts
    them near 36px, which still keeps the block shorter than the week's.
  */
  const single = days.length <= 7;

  return (
    <figure className={`m-0 w-full ${single ? "max-w-[22rem]" : "max-w-[18rem]"}`}>
      {/* The weekday header is its own row rather than a caption under every
          cell: a month has up to six cells per column and repeating the letter
          under each of them turns the grid into text. */}
      <div aria-hidden="true" className="mb-1.5 grid grid-cols-7 gap-1.5">
        {INITIALS.map((initial, i) => (
          <span
            key={i}
            className="text-center font-label text-[0.75rem] uppercase leading-none tracking-[0.05em] text-muted"
          >
            {initial}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5" role="img" aria-label={summary}>
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead${i}`} aria-hidden="true" />
        ))}
        {/*
          Every cell carries its date, and an elapsed empty day no longer looks
          like one that has not arrived.

          A month drew as ~30 unnumbered squares under a `M T W T F S S` header,
          so there was no way to read a date off it at all — and the two empty
          states were a filled `--border` tray against an outlined one at half
          opacity, which at this size is the same grey square twice. A day that
          was available and went unworked and a day that has not happened are
          opposite facts about the period.

          They are separated by fill and by edge rather than by opacity: an
          elapsed empty day is a filled tray with a solid edge, a future day has
          no fill and a dashed one. Opacity was the wrong axis twice over — it
          was what made the two look alike, and it would now dim the date inside
          the cell along with the cell. Numbers are 12px, the interface floor,
          not the 8-10px they would naturally want at this size.
        */}
        {days.map((day) => (
          <div
            key={day.key}
            aria-hidden="true"
            className="flex aspect-square w-full items-center justify-center font-label text-[0.75rem] leading-none tabular-nums"
            style={
              day.isFuture
                ? { border: "1px dashed var(--border)", color: "var(--muted)" }
                : {
                    ...cellStyle(level(day.count)),
                    color: day.count === 0 ? "var(--muted)" : "var(--fg)",
                    // Today is named by an outline rather than by a brighter
                    // fill, which would read as "more activity".
                    ...(day.isToday ? { outline: "1px solid var(--positive)" } : {}),
                  }
            }
          >
            {day.date.getDate()}
          </div>
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
