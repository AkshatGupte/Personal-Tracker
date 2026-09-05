import { dayKey } from "@/lib/day";
import { intensityTier } from "@/lib/tree";
import type { LeafHistoryRow } from "@/lib/progress";

/**
 * Per-leaf activity over the window: one row per node, one cell per day.
 *
 * **Deleted nodes stay, and are marked.** A history that quietly dropped the
 * rows for something you removed would disagree with the contribution graph
 * above it, which counts the days those clicks happened. The strikethrough and
 * the label say the node is gone; the days it was worked are still true.
 *
 * The same tier scale as the leaf cells, so a dense cell here and a dense cell
 * in the list mean the same amount. Reusing `intensityTier` rather than a
 * second scale is the point — two ramps that drifted apart would make the
 * history quietly lie about what a colour meant.
 */
export default function LeafHistory({
  rows,
  days,
}: {
  rows: LeafHistoryRow[];
  /** Oldest-first day keys, the columns. */
  days: string[];
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-sm text-muted">
        <span className="sv-status">no activity recorded yet</span> — work a topic and its
        history starts here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse">
        <caption className="sr-only">
          Activity per topic over the last {days.length} days
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-[14rem] pb-2 text-left font-label text-[0.55rem] uppercase tracking-[0.14em] text-muted">
              Topic
            </th>
            <th scope="col" className="pb-2 text-left font-label text-[0.55rem] uppercase tracking-[0.14em] text-muted">
              Last {days.length} days
            </th>
            <th scope="col" className="w-[4rem] pb-2 text-right font-label text-[0.55rem] uppercase tracking-[0.14em] text-muted">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <th scope="row" className="py-2 pr-3 text-left align-middle font-normal">
                <span className="flex min-w-0 flex-col">
                  {row.path.length > 0 && (
                    <span className="truncate font-label text-[0.5rem] uppercase tracking-[0.14em] text-muted">
                      {row.path.join(" › ")}
                    </span>
                  )}
                  <span className={`truncate text-sm ${row.deleted ? "text-muted line-through" : ""}`}>
                    {row.name}
                  </span>
                  {row.deleted && (
                    <span className="font-label text-[0.5rem] uppercase tracking-[0.14em] text-sv-red">
                      deleted
                    </span>
                  )}
                </span>
              </th>
              <td className="py-2 align-middle">
                <div className="flex gap-[2px]">
                  {days.map((day) => {
                    const count = row.byDay[day] ?? 0;
                    return (
                      <span
                        key={day}
                        title={`${day}: ${count === 0 ? "nothing" : count}`}
                        data-tier={intensityTier(count)}
                        className="sv-activity h-3 w-3 shrink-0"
                      />
                    );
                  })}
                </div>
              </td>
              <td className="py-2 text-right align-middle font-label text-[0.65rem] tabular-nums text-muted">
                <span className="text-fg">{row.total}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The window's day keys, oldest first. */
export function historyDays(count: number): string[] {
  const out: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = count - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    out.push(dayKey(day));
  }
  return out;
}
