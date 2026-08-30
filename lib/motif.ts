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

export const MOTIFS = ["voyage", "lattice", "beacon", "terrace"] as const;
export type Motif = (typeof MOTIFS)[number];

/** Weekdays rotate through these three; the weekend has its own. */
const WEEKDAY_CYCLE = ["voyage", "lattice", "beacon"] as const;
const WEEKEND: Motif = "terrace";

/**
 * Week number, counted from a fixed epoch. Only used to rotate the weekday
 * order, so it needs to be stable and monotonic rather than ISO-correct.
 */
function weekIndex(date: Date): number {
  const days = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
  return Math.floor(days / 7);
}

/**
 * Saturday and Sunday get the weekend sky. Weekdays step through the cycle,
 * offset by the week, so Monday is not permanently the same motif.
 */
export function motifForDate(date: Date = new Date()): Motif {
  const day = date.getDay();
  if (day === 0 || day === 6) return WEEKEND;

  const offset = (day - 1 + weekIndex(date)) % WEEKDAY_CYCLE.length;
  return WEEKDAY_CYCLE[offset];
}
