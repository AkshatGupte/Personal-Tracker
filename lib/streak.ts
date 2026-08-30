/**
 * Strict streak maths, as pure functions over the days a track logged activity.
 *
 * Strict means strict: a missed day resets the current streak to 0. There are
 * no grace periods, no freezes and no forgiveness of any kind, and none may be
 * added here. Streaks are per-track — finishing something in one track does not
 * protect another track's streak — which is why this only ever sees one track's
 * days at a time.
 *
 * Today counts as "not missed yet". A streak whose last activity was yesterday
 * is still alive; two days without activity ends it.
 */

import { addDays, dayKey, daysBetween, parseDayKey, startOfDay } from "@/lib/day";

export type StreakSummary = {
  current: number;
  longest: number;
  /** Local midnight of the most recent day with activity, null if never. */
  lastActivity: Date | null;
};

export const EMPTY_STREAK: StreakSummary = { current: 0, longest: 0, lastActivity: null };

/**
 * `activeDays` is every date on which this track logged at least one
 * completion. Duplicates and time-of-day are fine; both are normalised away.
 */
export function summariseStreak(activeDays: Date[], now: Date = new Date()): StreakSummary {
  const keys = [...new Set(activeDays.map(dayKey))].sort();
  if (keys.length === 0) return EMPTY_STREAK;

  // Longest run of consecutive calendar days anywhere in the history.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < keys.length; i++) {
    const gap = daysBetween(parseDayKey(keys[i - 1]), parseDayKey(keys[i]));
    run = gap === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  // The current run has to end today or yesterday, otherwise a day was missed.
  const today = startOfDay(now);
  const active = new Set(keys);
  let cursor = active.has(dayKey(today)) ? today : addDays(today, -1);
  let current = 0;
  while (active.has(dayKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  return { current, longest, lastActivity: parseDayKey(keys[keys.length - 1]) };
}
