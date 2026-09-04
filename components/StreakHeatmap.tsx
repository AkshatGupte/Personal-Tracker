import { addDays, dayKey, startOfDay } from "@/lib/day";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKS = 12;

/**
 * Twelve weeks of activity, one cell per day, read from real CompletionLog
 * rows. An empty history renders as an empty grid, which is the honest state
 * until check-ins are actually recorded.
 *
 * The grid is one image with a written summary, and the per-day detail is
 * repeated as visually hidden text. Nothing here is available only on hover.
 */
export default function StreakHeatmap({
  countsByDay,
  scope,
}: {
  /** ISO date (yyyy-mm-dd) to check-ins recorded that day. */
  countsByDay: Record<string, number>;
  scope: string;
}) {
  // Local days, from the same helper the completion writes use, so a cell and
  // the CompletionLog row behind it always mean the same calendar day.
  const today = startOfDay();

  // Monday-first grid: walk back to this week's Monday, then back 11 more
  // weeks so the newest column is the current one.
  const dayOfWeek = (today.getDay() + 6) % 7;
  const start = addDays(today, -dayOfWeek - (WEEKS - 1) * 7);

  const values = Object.values(countsByDay);
  const max = Math.max(1, ...values);

  const columns = Array.from({ length: WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = addDays(start, week * 7 + day);
      const key = dayKey(date);
      return { key, count: countsByDay[key] ?? 0, future: date > today };
    }),
  );

  const activeDays = columns.flat().filter((cell) => !cell.future && cell.count > 0).length;
  const total = columns.flat().reduce((sum, cell) => sum + (cell.future ? 0 : cell.count), 0);

  // Four visible steps, matching the Less to More legend.
  const level = (count: number) =>
    count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4));

  /*
    Four explicitly distinct inks rather than a continuous mix.

    Interpolating straight from magenta to yellow put the two middle steps
    within a few levels of each other — they read as one colour, which is the
    whole problem with a four-step scale nobody can count. Stepping through red
    and orange separates them: each swatch is its own ink, and the top of the
    scale still lands on `streak`, which is what consistency means everywhere
    else in the app.

    Square-cornered like every other data surface here; the rounding was the
    other half of the contribution-graph look.
  */
  const INK = [
    "var(--sv-magenta)",
    "var(--sv-red)",
    "color-mix(in srgb, var(--sv-yellow) 55%, var(--sv-red))",
    "var(--sv-yellow)",
  ];

  const cellStyle = (lvl: number) =>
    lvl === 0
      ? { backgroundColor: "var(--bg)" }
      : { backgroundColor: INK[Math.min(lvl, 4) - 1] };

  const summary =
    total === 0
      ? `${scope}: no activity recorded in the last 12 weeks.`
      : `${scope}: active on ${activeDays} of the last 84 days, ${total} check-ins in total.`;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <div className="flex gap-2" role="img" aria-label={summary}>
          <div className="grid shrink-0 grid-rows-7 gap-1 pt-px">
            {/*
              Every row is labelled. Alternating them kept the column calmer
              but left four of seven rows unnamed, so "which row is Thursday"
              could only be answered by counting.
            */}
            {DAY_LABELS.map((label) => (
              <span
                key={label}
                aria-hidden="true"
                className="flex h-3 items-center font-label text-[0.5rem] uppercase leading-none tracking-[0.06em] text-muted"
              >
                {label}
              </span>
            ))}
          </div>

          {/* The tray shows only through the 1px gaps, which is the grid rule.
              Any stronger and the empty cells stop reading as empty and the
              whole block goes solid. */}
          <div className="flex bg-sv-cyan/25 p-px" style={{ gap: "1px" }}>
            {columns.map((week, w) => (
              <div key={w} className="grid grid-rows-7" style={{ gap: "1px" }}>
                {week.map((cell) => (
                  <span
                    key={cell.key}
                    aria-hidden="true"
                    className="h-3 w-3"
                    // No entrance animation: eighty-four cells fading in
                    // reported nothing. They are simply there.
                    style={{
                      ...cellStyle(cell.future ? 0 : level(cell.count)),
                      visibility: cell.future ? "hidden" : "visible",
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 font-label text-[0.55rem] uppercase tracking-[0.12em] text-muted">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((lvl) => (
          <span
            key={lvl}
            aria-hidden="true"
            className="h-2.5 w-2.5"
            style={cellStyle(lvl)}
          />
        ))}
        <span>More</span>
      </div>

      {/*
        The same per-day detail the grid encodes, as text. Screen readers and
        keyboard users get it without hovering a cell.
      */}
      <details className="font-label text-[0.6rem] text-muted">
        <summary className="cursor-pointer rounded-none py-1 uppercase tracking-[0.14em] hover:text-fg">
          Day by day
        </summary>
        <ul className="mt-2 grid gap-1 tabular-nums sm:grid-cols-2">
          {columns
            .flat()
            .filter((cell) => !cell.future && cell.count > 0)
            .map((cell) => (
              <li key={cell.key}>
                {cell.key}: {cell.count} task{cell.count === 1 ? "" : "s"}
              </li>
            ))}
          {total === 0 && <li>No activity recorded yet.</li>}
        </ul>
      </details>
    </div>
  );
}
