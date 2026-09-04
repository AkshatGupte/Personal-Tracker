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
  /**
   * The streak milestone this write crossed, or null. Highest one, if a single
   * write crossed several.
   */
  milestone: number | null;
};

/**
 * Streak lengths worth marking.
 *
 * **Consistency milestones, and deliberately not the volume ones in
 * `lib/terrain.ts`.** Those count cumulative check-ins and are drawn on the
 * terrain; these count consecutive days and belong to the streak. The theme
 * keeps the two signals apart — volume is magenta, consistency is yellow — so
 * they must not be reached for interchangeably, which is why neither list is
 * called just `MILESTONES` any more.
 *
 * Ascending, and `milestoneCrossed` relies on it.
 */
export const STREAK_MILESTONES = [7, 14, 30, 60, 100] as const;

/**
 * The highest milestone in `(before, after]`, or null.
 *
 * Half-open at the bottom and closed at the top, which is what makes this
 * "crossed by *this* write" rather than "reached at some point". A streak that
 * passed 7 yesterday arrives here as 7 → 8, and `(7, 8]` holds no milestone, so
 * yesterday's crossing is never replayed. Nothing has to be stored to get that:
 * the pair itself says whether the line was crossed just now.
 *
 * `after <= before` returns null, which covers every non-advancing write at
 * once — a second check-in on the same day, an undo, and an undo that left
 * other check-ins standing. None of them can cross anything, so none of them
 * needs a clause here.
 *
 * A single write normally moves the streak by one and so can cross at most one
 * milestone. It is still written to take the highest of several, because a
 * recompute is free to move the streak by more than a day — deleting a task
 * rebuilds every day it touched — and reporting the smaller of two crossed
 * lines would be simply wrong.
 */
export function milestoneCrossed(before: number, after: number): number | null {
  if (after <= before) return null;
  const crossed = STREAK_MILESTONES.filter((value) => value > before && value <= after);
  return crossed.length > 0 ? crossed[crossed.length - 1] : null;
}

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
 * - **Undo then re-check reports as an extension again**, and re-crosses the
 *   same milestone with it. The undo really did delete the day's rollup row and
 *   lower the streak, and the re-check really did restore it, so this is a
 *   faithful account of the write. Nothing here inflates: there is no counter to
 *   farm, nothing is stored, and the streak is the same length afterwards as it
 *   was before the undo. If the repeat ever reads as cheap, damp it in the
 *   client for the session and leave this honest.
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
    /*
      Derived from the same two numbers as everything else here, with no extra
      condition on `checkedIn`: an undo removes a check-in, so it can only leave
      the streak where it was or lower it, and `milestoneCrossed` already
      returns null for both. Adding the clause anyway would be the kind of rule
      this function is written to avoid.
    */
    milestone: milestoneCrossed(before.current, after.current),
  };
}
