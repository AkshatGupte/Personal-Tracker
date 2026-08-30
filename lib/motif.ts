/**
 * The atmosphere layer: which sky sits behind the page today.
 *
 * A secondary, background-only layer. It never touches data. The semantic
 * colours keep their meanings in every motif — `accent` is progress and
 * terrain, `streak` is consistency, `positive` is completion — and the motif
 * tokens are a separate set that may only paint the ground.
 *
 * Pure and deterministic: the same date always resolves to the same motif, so
 * a server render and any later render agree. Nothing is stored, and nothing
 * about it is ever named in the interface.
 */

import { daysBetween } from "@/lib/day";
import { startOfWeek } from "@/lib/rollup";

export const MOTIFS = ["voyage", "lattice", "beacon", "terrace"] as const;
export type Motif = (typeof MOTIFS)[number];

/** Weekdays rotate through these three; the weekend has its own. */
const WEEKDAY_CYCLE = ["voyage", "lattice", "beacon"] as const;
const WEEKEND: Motif = "terrace";

/**
 * A fixed Monday to count weeks from. Any Monday works; this one is arbitrary.
 *
 * Counting from the Unix epoch instead was a real bug: 1 Jan 1970 was a
 * Thursday, so the index rolled over mid-week and the documented pairing
 * (Monday with Thursday, Tuesday with Friday, Wednesday alone) never actually
 * happened — the motif changed on Thursdays. Weeks here now begin on Monday,
 * the same convention as the heatmap and lib/rollup.
 */
const WEEK_ORIGIN = new Date(2024, 0, 1);

/**
 * Whole weeks since the origin, counted Monday to Monday. Used only to rotate
 * the weekday order, so it needs to be stable and monotonic rather than
 * ISO-correct.
 */
function weekIndex(date: Date): number {
  return Math.floor(daysBetween(WEEK_ORIGIN, startOfWeek(date)) / 7);
}

/**
 * Saturday and Sunday get the weekend sky. Weekdays step through the cycle,
 * offset by the week, so Monday is not permanently the same motif.
 */
export function motifForDate(date: Date = new Date()): Motif {
  const day = date.getDay();
  if (day === 0 || day === 6) return WEEKEND;

  // Dates before the origin give a negative index, and JS % keeps the sign.
  const n = WEEKDAY_CYCLE.length;
  const offset = (((day - 1 + weekIndex(date)) % n) + n) % n;
  return WEEKDAY_CYCLE[offset];
}
