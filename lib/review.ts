/**
 * The weekly review and the Today screen, from one set of judgements.
 *
 * **This adds no statistics.** Every figure it hands out comes from a read that
 * already existed — `getHomeProgress`, `getPeriodProgress("week")` and
 * `getGoalBoard` — and what lives here is the *synthesis*: which of those facts
 * matter right now, in what order, said in what words. Two screens read from it
 * so a user never has to reconcile two versions of their own week.
 *
 * The split between them is a question, not a data set:
 *
 *   /review — what happened, and what slipped
 *   /today  — what to do about it now
 *
 * `buildFocus` is the join. Both screens render the same ranked list, sliced
 * differently, so "focus next" on Sunday and "do this now" on Monday cannot
 * drift apart into two opinions.
 */

import { addDays, dayKey, daysBetween, startOfDay } from "@/lib/day";
import {
  daysRemaining,
  displayStatus,
  dueInWindow,
  goalPercent,
  momentumOf,
  type GoalDisplayStatus,
  type GoalRow,
  type Momentum,
} from "@/lib/goals";
import { describeLink } from "@/lib/goalLink";
import type { SeriesRun } from "@/lib/goalSeries";
import type { PeriodRollup } from "@/lib/rollup";
import type { StreakState } from "@/lib/streak";

/* ------------------------------------------------------------- the window -- */

export type ReviewWindow = { start: Date; endExclusive: Date; label: string };

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The review's week, printed.
 *
 * **This project has two definitions of "this week" and they are not the same
 * window.** `weekBuckets` uses Monday-start calendar weeks, which is what
 * `/progress` and its eight-bucket series mean; `summariseGoals`'s `thisWeek`
 * tally uses a rolling seven days keyed on each goal's deadline. Both are
 * correct for what they answer, and mixing them on one screen would put activity
 * from one window beside goals from another and call the pair "this week".
 *
 * The review takes the **calendar week**, from the same bucket the activity
 * series is built on, and filters goal periods by that same window rather than
 * reusing the rolling tally. The window is printed on the screen so nothing
 * about it is implicit.
 */
export function windowFrom(bucket: { start: Date; endExclusive: Date }): ReviewWindow {
  const last = addDays(bucket.endExclusive, -1);
  const sameMonth = last.getMonth() === bucket.start.getMonth();
  const left = `${WEEKDAYS[bucket.start.getDay()]} ${bucket.start.getDate()}`;
  const right = `${WEEKDAYS[last.getDay()]} ${last.getDate()} ${MONTHS[last.getMonth()]}`;
  return {
    start: bucket.start,
    endExclusive: bucket.endExclusive,
    label: sameMonth
      ? `${left} – ${right}`
      : `${left} ${MONTHS[bucket.start.getMonth()]} – ${right}`,
  };
}

/* -------------------------------------------------------------- momentum -- */

export type WeekMomentum = {
  thisWeek: number;
  lastWeek: number;
  /** Days of this week that have actually happened, 1-7. */
  elapsedDays: number;
  /**
   * `up` / `flat` / `down` only when the comparison is honest. `partial` means
   * the week is not finished and is not yet ahead, so no claim is made.
   */
  direction: "up" | "down" | "flat" | "partial" | "first";
  sentence: string;
};

/**
 * This week against last week, refusing to claim a fall on a partial week.
 *
 * **Three days measured against a full seven always looks like a decline**, so a
 * naive comparison would report "down" every Monday and Tuesday of a perfectly
 * good week. That is not a signal, it is an artefact of when you looked.
 *
 * So a direction is claimed only when it can be: when the week is complete, or
 * when this week has *already* passed last week's total, at which point being
 * ahead is a fact no further days can undo. Otherwise both figures are stated
 * and nothing is inferred from them. This is the same discipline the terrain
 * follows — a plain statement rather than a curve that flatters or scolds.
 */
export function weekMomentum(periods: PeriodRollup[]): WeekMomentum {
  const current = periods[periods.length - 1];
  const previous = periods[periods.length - 2];
  const thisWeek = current?.completed ?? 0;
  const lastWeek = previous?.completed ?? 0;
  const elapsedDays = current?.elapsedDays ?? 0;
  const complete = elapsedDays >= 7;

  const plural = (n: number) => `${n} activit${n === 1 ? "y" : "ies"}`;

  if (!previous || (lastWeek === 0 && thisWeek === 0)) {
    return {
      thisWeek, lastWeek, elapsedDays,
      direction: previous ? "flat" : "first",
      sentence:
        thisWeek === 0
          ? "Nothing recorded this week yet."
          : `${plural(thisWeek)} this week.`,
    };
  }

  if (thisWeek > lastWeek) {
    return {
      thisWeek, lastWeek, elapsedDays,
      direction: "up",
      sentence: `${plural(thisWeek)} this week, past last week's ${lastWeek}.`,
    };
  }
  if (thisWeek === lastWeek && complete) {
    return {
      thisWeek, lastWeek, elapsedDays,
      direction: "flat",
      sentence: `${plural(thisWeek)} this week, level with last week.`,
    };
  }
  if (complete) {
    return {
      thisWeek, lastWeek, elapsedDays,
      direction: "down",
      sentence: `${plural(thisWeek)} this week, down from ${lastWeek}.`,
    };
  }
  return {
    thisWeek, lastWeek, elapsedDays,
    direction: "partial",
    sentence: `${plural(thisWeek)} so far, ${elapsedDays} day${elapsedDays === 1 ? "" : "s"} in. Last week: ${lastWeek}.`,
  };
}

/* --------------------------------------------------------------- signals -- */

export type TrackSignal = {
  id: string;
  name: string;
  streak: number;
  streakState: StreakState;
  /** Live leaves worked today, over how many the track has. */
  workedToday: number;
  leafCount: number;
  /** Activity recorded inside the review's window. */
  weekActivities: number;
  weekActiveDays: number;
  /** Has this track ever been worked? Separates "new" from "abandoned". */
  everActive: boolean;
};

export type GoalSignal = {
  id: string;
  title: string;
  category: string;
  unit: string;
  target: number;
  current: number;
  percent: number;
  display: GoalDisplayStatus;
  momentum: Momentum;
  daysLeft: number;
  /** Linked goals are advanced by working a track, never typed into. */
  linked: boolean;
  sourceLabel: string | null;
  trackId: string | null;
  /** Recurring goals: this period's place in its series, and the series' record. */
  seriesId: string | null;
  period: number | null;
  series: SeriesRun | null;
};

export function toGoalSignal(goal: GoalRow, now: Date = new Date()): GoalSignal {
  return {
    id: goal.id,
    title: goal.title,
    category: goal.category,
    unit: goal.unit,
    target: goal.target,
    current: goal.currentProgress,
    percent: goalPercent(goal),
    display: displayStatus(goal, now),
    momentum: momentumOf(goal, now),
    daysLeft: daysRemaining(goal, now),
    linked: goal.trackId !== null || goal.topicId !== null,
    sourceLabel: describeLink(goal.source),
    /* Whichever track owns the link — a subtree-linked goal points at the track
       containing that node, so "work the track" has somewhere to go. */
    trackId: goal.source?.trackId ?? null,
    seriesId: goal.seriesId,
    period: goal.period,
    series: goal.series,
  };
}

/**
 * The goal periods that belong to the review's week, split by outcome.
 *
 * **Recurring goals need no special case here, and that is the point of B's
 * model.** A period *is* a Goal row with its own deadline, so a weekly series
 * simply contributes whichever of its periods fell in this window — usually
 * exactly one. Completed periods stay completed, missed ones read as expired,
 * and nothing is rewritten. A statistic that reached past the rows into the
 * series would be a second source of truth; there is none.
 *
 * Uses `dueInWindow`, the same predicate `summariseGoals`'s tally uses, so the
 * rows listed here are exactly the rows a tally over this window would count.
 */
export function goalPeriodsInWeek(
  goals: GoalRow[],
  window: ReviewWindow,
  now: Date = new Date(),
): { met: GoalSignal[]; missed: GoalSignal[]; open: GoalSignal[] } {
  const due = dueInWindow(goals, window.start, window.endExclusive);
  const met: GoalSignal[] = [];
  const missed: GoalSignal[] = [];
  const open: GoalSignal[] = [];
  for (const goal of due) {
    const signal = toGoalSignal(goal, now);
    if (signal.display === "completed") met.push(signal);
    else if (signal.display === "expired") missed.push(signal);
    else open.push(signal);
  }
  const byDeadline = (a: GoalSignal, b: GoalSignal) => a.daysLeft - b.daysLeft;
  return { met: met.sort(byDeadline), missed: missed.sort(byDeadline), open: open.sort(byDeadline) };
}

/* ----------------------------------------------------------------- focus -- */

export type FocusKind =
  | "renewStreak"
  | "goalDueToday"
  | "goalCritical"
  | "goalBehind"
  | "trackUntouched"
  | "restartStreak"
  | "startTracking";

export type FocusItem = {
  kind: FocusKind;
  /** The action, in the imperative. */
  action: string;
  /** Why it is on the list, one clause. Never carried by colour alone. */
  why: string;
  href: string;
  /** Lower sorts first. */
  weight: number;
  /** Maps onto the three existing signals. Never a fourth, never red. */
  tone: "streak" | "accent" | "positive" | "muted";
};

/**
 * What to do next, ranked, from the state both screens already have.
 *
 * **The single piece of judgement the two screens share.** `/review` shows it as
 * "focus next" at the end of a retrospective and `/today` shows it as the action
 * list at the top; they are the same list, so the two screens cannot form two
 * opinions about what matters.
 *
 * The ranking is by *what expires soonest*, not by size:
 *
 *   1. a streak that will end tonight — the only item with a deadline of hours
 *   2. a goal period due today
 *   3. a goal in real trouble, then one merely behind
 *   4. a track untouched this week
 *   5. a lapsed streak, which can be restarted but is not urgent
 *   6. a track never worked at all
 *
 * **Nothing here is red and nothing scolds.** An at-risk streak is a consistency
 * signal, so it is `streak` yellow; goals in trouble take `accent` magenta, which
 * already means volume and active state. Red would make "you have not done this
 * yet" read as an error, which it is not.
 */
/*
  No `now` parameter, deliberately. Everything time-dependent — `daysLeft`,
  `display`, `momentum`, `streakState` — is already resolved against a clock by
  the time a signal reaches here. Taking a second `now` would imply this function
  respects it, and it would silently not.
*/
export function buildFocus(tracks: TrackSignal[], goals: GoalSignal[]): FocusItem[] {
  const items: FocusItem[] = [];

  for (const track of tracks) {
    if (track.streakState === "atRisk") {
      items.push({
        kind: "renewStreak",
        action: `Work ${track.name}`,
        why: `${track.streak}-day streak ends tonight unless something is recorded`,
        href: `/tracks/${track.id}`,
        /* A longer run is more urgent than a shorter one — it is the thing with
           more to lose, and it is the only tie-break that means anything here. */
        weight: 10 - Math.min(9, track.streak / 100),
        tone: "streak",
      });
    }
  }

  for (const goal of goals) {
    if (goal.display !== "active") continue;
    const where = goal.linked && goal.trackId ? `/tracks/${goal.trackId}` : "/goals";
    /*
      Phrased so it is always grammatical. "1 papers to go" was the first
      version, and the unit is user-supplied free text — there is no reliable
      way to singularise "papers", "hours" or "problems" from here, so the
      number is put where a plural noun is correct regardless.
    */
    const left = `${Math.max(0, Math.round(goal.target - goal.current))} of ${goal.target} ${goal.unit} left`;
    if (goal.daysLeft === 0) {
      items.push({
        kind: "goalDueToday",
        action: goal.title,
        why: `due today — ${left}`,
        href: where,
        weight: 20,
        tone: "accent",
      });
    } else if (goal.momentum === "critical") {
      items.push({
        kind: "goalCritical",
        action: goal.title,
        why: `well behind with ${goal.daysLeft} day${goal.daysLeft === 1 ? "" : "s"} left — ${left}`,
        href: where,
        weight: 30 + goal.daysLeft / 1000,
        tone: "accent",
      });
    } else if (goal.momentum === "behind") {
      items.push({
        kind: "goalBehind",
        action: goal.title,
        why: `behind schedule — ${left}`,
        href: where,
        weight: 35 + goal.daysLeft / 1000,
        tone: "accent",
      });
    }
  }

  for (const track of tracks) {
    if (track.streakState === "atRisk") continue;
    if (track.weekActivities === 0 && track.everActive) {
      items.push({
        kind: "trackUntouched",
        action: `Pick something up in ${track.name}`,
        why: "nothing recorded this week",
        href: `/tracks/${track.id}`,
        weight: 40,
        tone: "muted",
      });
    } else if (track.streakState === "lapsed" && track.weekActivities > 0) {
      items.push({
        kind: "restartStreak",
        action: `Start a new streak in ${track.name}`,
        why: "the last one lapsed",
        href: `/tracks/${track.id}`,
        weight: 50,
        tone: "muted",
      });
    } else if (!track.everActive) {
      items.push({
        kind: "startTracking",
        action: `Work ${track.name} for the first time`,
        why: track.leafCount === 0 ? "it has no topics yet" : "nothing recorded on it yet",
        href: `/tracks/${track.id}`,
        weight: 60,
        tone: "muted",
      });
    }
  }

  return items.sort((a, b) => a.weight - b.weight || a.action.localeCompare(b.action));
}

/**
 * The one-line answer to "how did the week go", for the headline.
 *
 * Deliberately a sentence rather than a score. Tracks are described and never
 * graded, and a letter or a percentage here would be a grade.
 */
export function reviewHeadline(
  momentum: WeekMomentum,
  tracksWorked: number,
  goalsMet: number,
): string {
  if (momentum.thisWeek === 0) {
    return "Nothing recorded this week. It starts whenever you do.";
  }
  const parts = [momentum.sentence];
  if (tracksWorked > 0) {
    parts.push(`Across ${tracksWorked} track${tracksWorked === 1 ? "" : "s"}.`);
  }
  if (goalsMet > 0) {
    parts.push(`${goalsMet} goal${goalsMet === 1 ? "" : "s"} met.`);
  }
  return parts.join(" ");
}

/** Today, in words, for the Today headline. Same discipline: no grade. */
export function todayHeadline(activitiesToday: number, atRisk: number): string {
  if (atRisk > 0) {
    return `${atRisk} streak${atRisk === 1 ? "" : "s"} still to renew today.`;
  }
  if (activitiesToday === 0) {
    return "Nothing recorded today yet.";
  }
  return `${activitiesToday} activit${activitiesToday === 1 ? "y" : "ies"} recorded today.`;
}

/** Local `yyyy-mm-dd`, re-exported so screens never reach for toISOString. */
export const todayKey = (now: Date = new Date()) => dayKey(startOfDay(now));
export { daysBetween };
