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

/**
 * What a single check-in did to the streak.
 *
 * Four names, and the numbers beside them carry the rest. `withdrawn` covers
 * both undos — the one that took the track's last check-in of the day and
 * lowered the streak, and the one that left other check-ins standing and
 * changed nothing — because `before` and `after` already say which happened.
 */
export type CheckInKind =
  /** The streak came into being: 0 → 1. Day one, or the first day after a lapse. */
  | "started"
  /** The streak advanced: N → N+1. */
  | "extended"
  /** A check-in that did not move the streak — the day was already banked. */
  | "recorded"
  /** Today's check-in was undone. */
  | "withdrawn";

export type CheckInOutcome = {
  kind: CheckInKind;
  /** The track's current streak before and after the write. */
  before: number;
  after: number;
  /** True when this write set a new longest streak. */
  personalBest: boolean;
};

/**
 * Names what a check-in did, purely by comparing the streak before and after.
 *
 * This is the whole definition of "extended a streak": the recomputed current
 * streak is higher afterwards. Deliberately not a rule with clauses — a clause
 * like "unless they already checked in today" would need stored state saying
 * whether they had, and this codebase keeps no such state anywhere else. A
 * comparison of two summaries needs nothing remembered, so a double-click, a
 * retry or two tabs racing all describe the same write the same way.
 *
 * Consequences worth knowing, all of them intended:
 *
 * - **Day one counts.** 0 → 1 is the streak moving, so it reports as a real
 *   outcome rather than the flattest one; it is only *named* apart, because
 *   "started" and "extended to 6" want different words.
 * - **A second check-in on the same day is `recorded`.** The streak is a
 *   per-track daily fact and the day was already banked by the first one. That
 *   check-in still raised elevation — volume and consistency are separate
 *   signals, and this is the case that separates them.
 * - **Undo then re-check reports as an extension again.** The undo really did
 *   delete the day's rollup row and lower the streak, and the re-check really
 *   did restore it, so this is a faithful account of the write. Nothing here
 *   inflates: there is no counter to farm. If the repeat ever reads as cheap,
 *   damp it in the client for the session and leave this honest.
 *
 * `before` must be recomputed from `CompletionLog` at the same `now` as
 * `after`, never read from `Track.currentStreak` — see `readStreak`.
 */
export function describeCheckIn(
  before: StreakSummary,
  after: StreakSummary,
  checkedIn: boolean,
): CheckInOutcome {
  const advanced = after.current > before.current;

  return {
    kind: !checkedIn
      ? "withdrawn"
      : advanced
        ? before.current === 0
          ? "started"
          : "extended"
        : "recorded",
    before: before.current,
    after: after.current,
    // An undo can lower `longest` as well, which this correctly reports as false.
    personalBest: after.longest > before.longest,
  };
}
