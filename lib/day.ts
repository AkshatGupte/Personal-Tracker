/**
 * Day boundaries, in local time, in one place.
 *
 * Every part of the app that asks "which day is this?" — streaks, the heatmap,
 * the terrain window, and the CompletionLog rows themselves — must agree, or a
 * completion can be written into one day and read out of another. UTC was the
 * earlier answer and rolled the day at 05:30 IST, which could break a strict
 * streak through no fault of the user. The server is the user's own machine and
 * there is a single local user, so local time is unambiguous here.
 *
 * If this is ever deployed to a server in another timezone, this is the file to
 * revisit — nothing else does day maths of its own.
 */

const MS_PER_DAY = 86_400_000;

/** Local midnight for the day containing `date`. */
export function startOfDay(date: Date = new Date()): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** `days` later (or earlier, if negative), preserving the time of day. */
export function addDays(date: Date, days: number): Date {
  const moved = new Date(date);
  moved.setDate(moved.getDate() + days);
  return moved;
}

/** Local yyyy-mm-dd. Sorts and compares as a string, so it doubles as a key. */
export function dayKey(date: Date): string {
  const local = new Date(date);
  const month = `${local.getMonth() + 1}`.padStart(2, "0");
  const day = `${local.getDate()}`.padStart(2, "0");
  return `${local.getFullYear()}-${month}-${day}`;
}

/** Turns a yyyy-mm-dd key back into that day's local midnight. */
export function parseDayKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Whole days from `from` to `to`. Rounds, because a daylight-saving boundary
 * makes a calendar day 23 or 25 hours long and truncation would miscount it.
 */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}
