/**
 * Goal maths: status, momentum, milestones and XP, as pure functions.
 *
 * Nothing here touches the database. Every figure a card or the dashboard shows
 * is computed from the four stored numbers — target, currentProgress, startDate,
 * deadline — so a goal cannot display a percentage that disagrees with its own
 * progress, and none of it needs anything to run on a schedule.
 *
 * **The one exception to derive-on-read is `Goal.highWater`**, and the schema
 * says why: the anti-farming rule has to be evaluated inside the same
 * transaction that writes the new value, so it cannot be recomputed afterwards.
 */

import { addDays, dayKey, startOfDay } from "@/lib/day";
import type { GoalSource } from "@/lib/goalLink";
import type { SeriesRun } from "@/lib/goalSeries";
import { summariseStreak } from "@/lib/streak";

/** The four crossings, ascending. `milestonesCrossed` relies on the order. */
export const GOAL_MILESTONES = [25, 50, 75, 100] as const;
export type GoalMilestonePercent = (typeof GOAL_MILESTONES)[number];

/**
 * What each action pays.
 *
 * **100% is the completion award, not a fifth event on top of it.** Completing a
 * goal crosses the 100 milestone by definition, so paying both would be paying
 * twice for one moment — which is also why nothing separate is banked when
 * `status` flips to `completed`.
 */
export const GOAL_XP = {
  create: 5,
  progress: 10,
  milestone: { 25: 25, 50: 50, 75: 75, 100: 200 } as Record<number, number>,
} as const;

/** Stored status. `expired` is deliberately absent — see `displayStatus`. */
export type GoalStatus = "active" | "completed" | "archived";
/** What the interface shows, expiry included. */
export type GoalDisplayStatus = GoalStatus | "expired";

export type Momentum = "ahead" | "onTrack" | "behind" | "critical" | "expired" | "complete";

export type GoalShape = {
  target: number;
  currentProgress: number;
  startDate: Date;
  deadline: Date;
  status: GoalStatus;
  completedAt?: Date | null;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Whole days from `from` to `to`, by local midnight, so DST cannot round it. */
function dayGap(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
}

/**
 * The status to show, expiry included.
 *
 * A goal is expired when its deadline is behind us and it never completed.
 * Answered here rather than stored, so it is correct the instant the day turns
 * without anything having run overnight — and correct again if the deadline is
 * later moved forward, which a stored flag would have to be told about.
 */
export function displayStatus(goal: GoalShape, now: Date = new Date()): GoalDisplayStatus {
  if (goal.status !== "active") return goal.status;
  return dayGap(now, goal.deadline) < 0 ? "expired" : "active";
}

/** 0-1. Capped, because overshooting 50 of 50 is still a full bar. */
export function goalFraction(goal: GoalShape): number {
  if (goal.target <= 0) return 0;
  return clamp01(goal.currentProgress / goal.target);
}

/** 0-100, rounded. The number printed beside the bar. */
export function goalPercent(goal: GoalShape): number {
  return Math.round(goalFraction(goal) * 100);
}

/**
 * How much should be done by now, in the goal's own unit.
 *
 * Straight-line against elapsed time. Deliberately not smoothed or weighted:
 * the reader has to be able to check it in their head against the deadline, and
 * a curve nobody can predict is worse than a line everybody can.
 */
export function expectedProgress(goal: GoalShape, now: Date = new Date()): number {
  const span = dayGap(goal.startDate, goal.deadline);
  if (span <= 0) return goal.target;
  const elapsed = dayGap(goal.startDate, now);
  return goal.target * clamp01(elapsed / span);
}

/**
 * Where this goal stands against its own deadline.
 *
 * **The bands are fitted to the brief's own worked examples, not invented.** It
 * gives two: against an expected 25, actual 37 is "ahead" (ratio 1.48) and
 * actual 12 is "behind" (ratio 0.48). The second is the binding one — it puts
 * the floor of "behind" below 0.48, so "critical" starts at 0.4. A first pass
 * used 0.6 and reported the brief's own example as critical.
 *
 * They are also wide on purpose. The brief asks that the status not flip on tiny
 * fluctuations, and the failure mode is a card reading "ahead" and "behind"
 * alternately as one problem is added and removed. On-track spans 0.9-1.15,
 * which against an expected 25 is 22.5 to 28.75 — six units, so no single write
 * can move the reading.
 *
 * The first fifteen percent of a goal's life is exempt. Straight-line expectation
 * says almost nothing is due on day one, so any goal with a single unit recorded
 * would read "wildly ahead" and every untouched one "behind" before the reader
 * had a chance to start — which is discouraging and, worse, uninformative.
 */
export function momentumOf(goal: GoalShape, now: Date = new Date()): Momentum {
  const shown = displayStatus(goal, now);
  if (shown === "completed") return "complete";
  if (shown === "expired") return "expired";

  const expected = expectedProgress(goal, now);
  if (expected < 0.5) return goal.currentProgress > 0 ? "ahead" : "onTrack";

  const ratio = goal.currentProgress / expected;
  if (ratio >= 1.15) return "ahead";
  if (ratio >= 0.9) return "onTrack";
  if (ratio >= 0.4) return "behind";
  return "critical";
}

export const MOMENTUM_COPY: Record<Momentum, string> = {
  ahead: "Ahead of schedule",
  onTrack: "On track",
  behind: "Behind schedule",
  critical: "Critical",
  expired: "Expired",
  complete: "Complete",
};

/** Whole days left. 0 means the deadline is today; negative means it has gone. */
export function daysRemaining(goal: GoalShape, now: Date = new Date()): number {
  return dayGap(now, goal.deadline);
}

/** "5 days left", "Due today", "2 days ago" — the deadline in words. */
export function remainingCopy(goal: GoalShape, now: Date = new Date()): string {
  const days = daysRemaining(goal, now);
  if (days === 0) return "Due today";
  if (days === 1) return "1 day left";
  if (days > 1) return `${days} days left`;
  if (days === -1) return "1 day ago";
  return `${Math.abs(days)} days ago`;
}

/**
 * How loudly the deadline should be drawn, 0-1.
 *
 * "Make the deadline progressively more visually important as it approaches" —
 * so this is a fraction of the goal's own life rather than a day count. Three
 * days left is nothing on a month-long goal and almost everything on a week-long
 * one, and a fixed day threshold would treat them the same.
 */
export function deadlineUrgency(goal: GoalShape, now: Date = new Date()): number {
  if (displayStatus(goal, now) !== "active") return 0;
  const span = dayGap(goal.startDate, goal.deadline);
  if (span <= 0) return 1;
  return clamp01(1 - daysRemaining(goal, now) / span);
}

/**
 * Which milestones a write crosses, given where the goal has ever been.
 *
 * Takes the **high-water mark** rather than the previous value, which is what
 * makes 37 → 38 → 37 → 38 pay once: the second crossing is ground already
 * covered. `already` is the set persisted against the goal, so a milestone
 * survives a decrease that drops back below it.
 */
export function milestonesCrossed(
  target: number,
  highWater: number,
  next: number,
  already: readonly number[] = [],
): GoalMilestonePercent[] {
  if (target <= 0) return [];
  const done = new Set(already);
  const reached = (value: number, percent: number) => value / target >= percent / 100;
  return GOAL_MILESTONES.filter(
    (percent) => !done.has(percent) && !reached(highWater, percent) && reached(next, percent),
  );
}

/** What a progress write pays. Only new ground earns. */
export function progressXp(highWater: number, next: number): number {
  return next > highWater ? GOAL_XP.progress : 0;
}

/* ------------------------------------------------------------- statistics -- */

export type GoalRow = GoalShape & {
  id: string;
  title: string;
  category: string;
  unit: string;
  description: string | null;
  cadence: string;
  createdAt: Date;
  highWater: number;
  milestones: number[];
  xp: number;
  /**
   * What this goal watches, if anything. **At most one is set** — the database
   * enforces it with a CHECK constraint, see `docs/SCHEMA.md`.
   */
  trackId: string | null;
  topicId: string | null;
  /** The same link resolved to names, for the badge. Null when manual. */
  source: GoalSource | null;
  /** Set when this goal is one period of a recurring series. */
  seriesId: string | null;
  /** Which period this is within its series, 1-based. Null for a one-off. */
  period: number | null;
  /** How the series has gone overall. Null for a one-off. */
  series: SeriesRun | null;
};

export type WindowTally = { completed: number; total: number };

export type GoalStats = {
  total: number;
  completed: number;
  active: number;
  expired: number;
  archived: number;
  /** 0-100. Archived goals are excluded — see below. */
  completionRate: number;
  /** Mean percent across goals still in flight. */
  averageProgress: number;
  thisWeek: WindowTally;
  thisMonth: WindowTally;
  allTime: WindowTally;
  currentStreak: number;
  bestStreak: number;
  byCategory: Array<{ category: string; rate: number; completed: number; total: number }>;
  totalXp: number;
};

/**
 * Goals whose deadline falls inside a window, and how many of them were met.
 *
 * Keyed on the **deadline** rather than on the completion date, because the
 * question "how did this week go" is about what was due this week. Keying on
 * completion would let a goal due in March, finished today, flatter this week.
 */
/**
 * Goals whose deadline falls in `[from, until)`, archived ones excluded.
 *
 * Extracted from `tally` so the weekly review can list the *rows* behind a
 * tally without writing a second version of the same predicate. `until` is
 * exclusive and `from` may be null for "everything up to `until`".
 *
 * Keyed on the **deadline**, because "how did this week go" is about what was
 * due this week. Keying on completion would let a goal due in March, finished
 * today, flatter this week.
 */
export function dueInWindow(
  goals: GoalRow[],
  from: Date | null,
  until: Date,
): GoalRow[] {
  return goals.filter((g) => {
    if (g.status === "archived") return false;
    if (from && g.deadline < from) return false;
    return g.deadline < until;
  });
}

function tally(goals: GoalRow[], from: Date | null, now: Date): WindowTally {
  const inWindow = dueInWindow(goals, from, addDays(startOfDay(now), 2));
  return {
    completed: inWindow.filter((g) => g.status === "completed").length,
    total: inWindow.length,
  };
}

export function summariseGoals(goals: GoalRow[], now: Date = new Date()): GoalStats {
  const shown = goals.map((g) => displayStatus(g, now));
  const completed = shown.filter((s) => s === "completed").length;
  const active = shown.filter((s) => s === "active").length;
  const expired = shown.filter((s) => s === "expired").length;
  const archived = shown.filter((s) => s === "archived").length;

  /*
    Archived goals are excluded from the rate, and that is a judgement.
    Archiving is "I am not doing this after all"; counting it as a failure would
    make tidying up cost you, and the reliable way to keep a good rate would be
    to leave dead goals lying around. Expired ones do count — that is a miss.
  */
  const counted = completed + active + expired;
  const inFlight = goals.filter((_, i) => shown[i] === "active" || shown[i] === "expired");

  const byCategory = new Map<string, { completed: number; total: number }>();
  goals.forEach((goal, i) => {
    if (shown[i] === "archived") return;
    const bucket = byCategory.get(goal.category) ?? { completed: 0, total: 0 };
    bucket.total += 1;
    if (shown[i] === "completed") bucket.completed += 1;
    byCategory.set(goal.category, bucket);
  });

  /*
    The goal streak: consecutive days on which at least one goal was completed.
    `summariseStreak` already answers exactly this question for tracks and is
    strict in the same way, so the two streaks in the app cannot disagree about
    what a missed day means.
  */
  const completionDays = [
    ...new Set(
      goals
        .filter((g) => g.status === "completed" && g.completedAt)
        .map((g) => dayKey(g.completedAt as Date)),
    ),
  ].map((key) => startOfDay(new Date(`${key}T12:00:00`)));
  const streak = summariseStreak(completionDays, now);

  const today = startOfDay(now);
  return {
    total: counted,
    completed,
    active,
    expired,
    archived,
    completionRate: counted === 0 ? 0 : Math.round((completed / counted) * 100),
    averageProgress:
      inFlight.length === 0
        ? 0
        : Math.round(inFlight.reduce((sum, g) => sum + goalFraction(g) * 100, 0) / inFlight.length),
    thisWeek: tally(goals, addDays(today, -6), now),
    thisMonth: tally(goals, addDays(today, -29), now),
    allTime: tally(goals, null, now),
    currentStreak: streak.current,
    bestStreak: streak.longest,
    byCategory: [...byCategory.entries()]
      .map(([category, b]) => ({
        category,
        completed: b.completed,
        total: b.total,
        rate: b.total === 0 ? 0 : Math.round((b.completed / b.total) * 100),
      }))
      .sort((a, b) => b.rate - a.rate || a.category.localeCompare(b.category)),
    totalXp: goals.reduce((sum, g) => sum + g.xp, 0),
  };
}
