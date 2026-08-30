const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKS = 12;

/**
 * Twelve weeks of activity, one cell per day, read from real CompletionLog
 * rows. An empty history renders as an empty grid, which is the honest state
 * until tasks are actually completed.
 *
 * The grid is one image with a written summary, and the per-day detail is
 * repeated as visually hidden text. Nothing here is available only on hover.
 */
export default function StreakHeatmap({
  countsByDay,
  scope,
}: {
  /** ISO date (yyyy-mm-dd) to tasks completed that day. */
  countsByDay: Record<string, number>;
  scope: string;
}) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Monday-first grid: walk back to this week's Monday, then back 11 more
  // weeks so the newest column is the current one.
  const dayOfWeek = (today.getUTCDay() + 6) % 7;
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - dayOfWeek - (WEEKS - 1) * 7);

  const values = Object.values(countsByDay);
  const max = Math.max(1, ...values);

  const columns = Array.from({ length: WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + week * 7 + day);
      const key = date.toISOString().slice(0, 10);
      return { key, count: countsByDay[key] ?? 0, future: date > today };
    }),
  );

  const activeDays = columns.flat().filter((cell) => !cell.future && cell.count > 0).length;
  const total = columns.flat().reduce((sum, cell) => sum + (cell.future ? 0 : cell.count), 0);

  // Four visible steps, matching the Less to More legend.
  const level = (count: number) =>
    count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4));

  const cellStyle = (lvl: number) =>
    lvl === 0
      ? { backgroundColor: "var(--border)", opacity: 0.55 }
      : { backgroundColor: "var(--accent)", opacity: 0.28 + lvl * 0.18 };

  const summary =
    total === 0
      ? `${scope}: no activity recorded in the last 12 weeks.`
      : `${scope}: active on ${activeDays} of the last 84 days, ${total} tasks completed in total.`;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <div className="flex gap-2" role="img" aria-label={summary}>
          <div className="grid shrink-0 grid-rows-7 gap-1 pt-px">
            {DAY_LABELS.map((label, i) => (
              <span
                key={label}
                aria-hidden="true"
                className="flex h-3.5 items-center text-[0.6rem] leading-none text-muted"
              >
                {/* Alternate rows only, so the column stays calm. */}
                {i % 2 === 0 ? label : ""}
              </span>
            ))}
          </div>

          <div className="flex gap-1">
            {columns.map((week, w) => (
              <div key={w} className="grid grid-rows-7 gap-1">
                {week.map((cell, d) => (
                  <span
                    key={cell.key}
                    aria-hidden="true"
                    className="h-3.5 w-3.5 rounded-[3px]"
                    style={{
                      ...cellStyle(cell.future ? 0 : level(cell.count)),
                      visibility: cell.future ? "hidden" : "visible",
                      animation: "cell-in 0.4s ease-out both",
                      animationDelay: `${(w * 7 + d) * 4}ms`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[0.65rem] text-muted">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((lvl) => (
          <span
            key={lvl}
            aria-hidden="true"
            className="h-3 w-3 rounded-[3px]"
            style={cellStyle(lvl)}
          />
        ))}
        <span>More</span>
      </div>

      {/*
        The same per-day detail the grid encodes, as text. Screen readers and
        keyboard users get it without hovering a cell.
      */}
      <details className="text-xs text-muted">
        <summary className="cursor-pointer rounded-lg py-1 hover:text-fg">
          Day by day
        </summary>
        <ul className="tabular mt-2 grid gap-1 sm:grid-cols-2">
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
