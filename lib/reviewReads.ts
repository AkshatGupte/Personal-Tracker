/**
 * The one read behind the weekly review and Today.
 *
 * Split from `lib/review.ts` for the reason the project keeps everywhere else:
 * **pure logic in `lib/` as testable functions, fetching in its own module.**
 * `lib/goals.ts` / `lib/goalReads.ts` are the same pair. It is not cosmetic —
 * `qa/*.test.mjs` runs pure functions under plain `node`, and a synthesis module
 * that imported Prisma could not be loaded by a suite at all. It was written
 * that way first and the suite refused to start, which is how this got fixed.
 */

import { getGoalBoard } from "@/lib/goalReads";
import { getHomeProgress, getPeriodProgress } from "@/lib/progress";
import {
  buildFocus,
  goalPeriodsInWeek,
  toGoalSignal,
  weekMomentum,
  windowFrom,
  type TrackSignal,
} from "@/lib/review";

/**
 * Everything both screens need, composed from the reads that already exist.
 *
 * **No new query and no new statistic.** `getHomeProgress` owns the per-track
 * current facts, `getPeriodProgress("week")` owns the week's series and its
 * bucketing, and `getGoalBoard` owns the goals — including rolling recurring
 * series forward, which is why simply opening either screen keeps a series
 * current. This function joins the three and applies the judgements above.
 *
 * It costs three reads where a bespoke query would cost one, and that is the
 * deliberate trade: for one local user the whole history is a few hundred rows,
 * and the alternative is a fourth derivation of streaks and coverage that could
 * disagree with the three screens already shipped.
 */
export async function getReview(now: Date = new Date()) {
  const [home, week, board] = await Promise.all([
    getHomeProgress(),
    getPeriodProgress("week", now),
    getGoalBoard(),
  ]);

  const window = windowFrom(week.buckets[week.buckets.length - 1]);
  const momentum = weekMomentum(week.periods);

  /*
    Per-track signals: current facts from `home`, the week's figures from
    `week.tracks`. Joined by id rather than recomputed — the two reads already
    agree because both derive from the same rows, and re-deriving here is what
    would break that.
  */
  const weekById = new Map(week.tracks.map((t) => [t.id, t]));
  const tracks: TrackSignal[] = home.rows.map((row) => {
    const period = weekById.get(row.id);
    return {
      id: row.id,
      name: row.name,
      streak: row.currentStreak,
      streakState: row.streakState,
      workedToday: row.workedToday,
      leafCount: row.leafCount,
      weekActivities: period?.completed ?? 0,
      weekActiveDays: period?.activeDays ?? 0,
      everActive: period?.everActive ?? false,
    };
  });

  const goals = board.goals.map((goal) => toGoalSignal(goal, now));
  const focus = buildFocus(tracks, goals);
  const periods = goalPeriodsInWeek(board.goals, window, now);

  const atRisk = tracks.filter((t) => t.streakState === "atRisk");
  const held = tracks.filter((t) => t.streakState === "held");
  const activitiesToday = home.rows.reduce((sum, row) => sum + row.workedToday, 0);

  return {
    window,
    momentum,
    tracks,
    goals,
    focus,
    periods,
    atRisk,
    held,
    /** Distinct live leaves worked today across every track. */
    workedLeavesToday: home.workedLeaves,
    totalLeaves: home.totalLeaves,
    activitiesToday,
    /** The all-time volume figure, unchanged and unwindowed. */
    elevation: home.elevation,
    stats: board.stats,
    hasAnyHistory: week.hasAnyHistory,
    /** The week's day-by-day breakdown, for the review's spread sentence. */
    days: week.currentDays,
  };
}

export type Review = Awaited<ReturnType<typeof getReview>>;
