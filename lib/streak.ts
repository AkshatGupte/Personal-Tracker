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
 * Whether a streak is renewed, alive-but-unrenewed, lapsed, or absent.
 *
 * **A description of an existing streak, computed beside it — never a change to
 * it.** Strict means strict: `summariseStreak` above is untouched, and nothing
 * here extends, protects or forgives a run. "At risk" is the observation that a
 * streak whose last activity was yesterday is still running and will end tonight
 * if nothing is recorded; it is the strongest honest pull the app can exert
 * precisely because it invents nothing.
 *
 * **It must be fed the same `activeDays` that produced `summary`** — days on
 * which a *currently live* leaf was worked. `getHomeProgress` computes both from
 * one array for that reason: a second derivation would eventually disagree with
 * the streak number shown on every other screen.
 *
 * `atRisk` requires `current > 0` as well as yesterday's activity. The two can
 * come apart: a node worked yesterday that has since gained children or been
 * deleted leaves `lastActivity` set while contributing nothing to the run, and
 * calling that "at risk" would offer to renew a streak that does not exist.
 */
export type StreakState = "held" | "atRisk" | "lapsed" | "none";

export function streakState(summary: StreakSummary, now: Date = new Date()): StreakState {
  if (!summary.lastActivity) return "none";
  const gap = daysBetween(summary.lastActivity, now);
  if (gap <= 0) return "held";
  if (gap === 1 && summary.current > 0) return "atRisk";
  return "lapsed";
}

/** What each state says, in words. Nothing here is carried by colour alone. */
export const STREAK_STATE_COPY: Record<StreakState, string> = {
  held: "Renewed today",
  atRisk: "Alive, not yet renewed today",
  lapsed: "Lapsed",
  none: "Not started",
};

/*
  Removed 2026-09-06: the whole check-in outcome cluster.

  `CheckInKind`, `CheckInOutcome`, `STREAK_MILESTONES`, `milestoneCrossed` and
  `describeCheckIn` lived here and are gone, along with the suite that tested
  them. They described what a single *check-in* did to a streak, and the
  check-in is not a thing any more — activity became a per-node, per-day count
  in the topic-tree restructure, `CheckInBeat`/`CheckInReport` went with tasks,
  and nothing has published an outcome since. The cluster was reachable only
  from its own tests: a closed loop of code proving code that nothing calls.

  It was flagged as dead across four handoffs and kept each time in case the
  celebration returned. It has not, and a function nothing can call is not a
  feature waiting to happen — it is a claim about the app that stopped being
  true. `git log -- lib/streak.ts` has the whole thing if a streak celebration
  is ever built, and it should be rewritten against the activity model rather
  than restored, because it was written against check-ins.

  **If streak milestones do come back, do not call the list `MILESTONES`.**
  `ELEVATION_MILESTONES` in `lib/terrain.ts` is named that way precisely so two
  different signals — consecutive days, and cumulative volume — cannot be
  reached for interchangeably. That naming rule survives this removal and is the
  one piece of it worth carrying forward.
*/
