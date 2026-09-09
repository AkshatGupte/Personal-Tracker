import Link from "next/link";
import type { FocusItem } from "@/lib/review";

/**
 * What to do next, ranked. **The join between the two screens.**
 *
 * `/review` renders it as the last section of a retrospective and `/today`
 * renders it as the first thing you see. It is the same list from the same
 * `buildFocus`, so the two screens cannot form two opinions about what matters —
 * which is the whole reason they are one feature rather than two.
 *
 * A server component: nothing here is interactive beyond a link, and the
 * ranking is decided on the server where the data already is.
 */

const TONE: Record<FocusItem["tone"], string> = {
  /* Maps onto the three existing signals and invents no fourth. Yellow is
     consistency, magenta is volume and active state, cyan is done-today. Red is
     deliberately absent: "not done yet" is not an error. */
  streak: "var(--streak)",
  accent: "var(--accent)",
  positive: "var(--positive)",
  muted: "var(--muted)",
};

export default function FocusList({
  items,
  limit,
  empty,
}: {
  items: FocusItem[];
  /** Today shows the top few; the review shows the lot. */
  limit?: number;
  /** What to say when there is nothing to do. Never an empty box. */
  empty: string;
}) {
  const shown = limit ? items.slice(0, limit) : items;

  if (shown.length === 0) {
    return <p className="py-2 text-sm leading-relaxed text-muted">{empty}</p>;
  }

  return (
    <>
      <ol className="divide-y divide-border">
        {shown.map((item, index) => (
          <li key={`${item.kind}-${item.href}-${index}`} className="sv-row -mx-2 px-2 py-2.5">
            <Link href={item.href} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {/* The rank is drawn, but the reason is *written* — no essential
                  information is carried by the plate colour alone. */}
              <span
                aria-hidden="true"
                className="inline-block h-3 w-1 shrink-0 self-center"
                style={{ background: TONE[item.tone] }}
              />
              <span className="min-w-0 text-sm text-fg">{item.action}</span>
              <span className="min-w-0 text-sm text-muted">— {item.why}</span>
            </Link>
          </li>
        ))}
      </ol>
      {limit && items.length > shown.length && (
        <p className="mt-2 font-label text-[0.75rem] uppercase tracking-[0.12em] text-muted">
          {items.length - shown.length} more in the weekly review
        </p>
      )}
    </>
  );
}
