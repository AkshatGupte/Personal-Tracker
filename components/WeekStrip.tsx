import type { PeriodDay } from "@/lib/rollup";

const INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * One week, day by day.
 *
 * Deliberately the heatmap's own cell language rather than a new chart: the
 * design direction calls for real drawings and grids, never bars, and reusing
 * the grid means a week here and a week in the twelve-week heatmap read the
 * same way.
 *
 * Scope is a single week, so it says nothing about direction over time. Days
 * that have not happened are drawn as an empty outline rather than as a filled
 * zero — a Thursday that has not arrived has not been missed, but the week
 * still has to read as a week.
 */
export default function WeekStrip({
  days,
  scope,
}: {
  days: PeriodDay[];
  scope: string;
}) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const level = (count: number) => (count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4)));

  /*
    Magenta, not the heatmap's yellow, and the two are not inconsistent.

    This strip shares the heatmap's cell geometry but answers a different
    question: it sits under "this week, N tasks completed" and encodes *volume*
    across the days of one week. The twelve-week heatmap under "Consistency"
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
      ? `${scope}: nothing completed so far this week.`
      : `${scope}: ${total} task${total === 1 ? "" : "s"} completed on ${done.length} day${
          done.length === 1 ? "" : "s"
        } this week.`;

  return (
    <figure className="m-0 w-full max-w-[22rem]">
      <div className="grid grid-cols-7 gap-1.5" role="img" aria-label={summary}>
        {days.map((day, i) => (
          <div key={day.key} className="flex min-w-0 flex-col gap-1.5">
            <div
              aria-hidden="true"
              className="aspect-square w-full rounded-[2px]"
              style={
                day.isFuture
                  ? { border: "1px solid var(--border)", opacity: 0.5 }
                  : cellStyle(level(day.count))
              }
            />
            <span
              aria-hidden="true"
              className={`text-center font-label text-[0.55rem] uppercase leading-none tracking-[0.05em] ${
                day.isToday ? "text-fg" : "text-muted"
              }`}
            >
              {INITIALS[i]}
            </span>
          </div>
        ))}
      </div>

      {/* The same detail as text, so nothing here is available only visually. */}
      <figcaption className="sr-only">
        {done.length === 0
          ? "No days with completions yet this week."
          : done.map((d) => `${d.key}: ${d.count} task${d.count === 1 ? "" : "s"}.`).join(" ")}
      </figcaption>
    </figure>
  );
}
