/**
 * Recurring goals, as pure functions over windows.
 *
 * **A period is a row, never a reset.** Rolling a recurring goal over creates a
 * *new* `Goal` for the next window, linked to its predecessors by `seriesId`.
 * Resetting `currentProgress` on the existing row is the obvious implementation
 * and it destroys the thing the dashboard is built on: the completed history,
 * the XP ledger, and every statistic that counts goals. A goal that resets has
 * no completion record, so the completion rate silently stops meaning anything.
 * With a row per period, `summariseGoals` needs no changes at all — each period
 * is its own goal, met or missed on its own terms.
 *
 * **Nothing rolls a goal over on a schedule.** There is no cron and no server
 * process in this project, so the roll happens on read — the same reasoning that
 * keeps goal expiry derived rather than stored. Nothing here touches the
 * database; `rollSeriesForward` in `lib/goalWrites.ts` applies what this decides.
 */

import { addDays, daysBetween, startOfDay } from "@/lib/day";

/**
 * How many periods one roll-forward may materialise.
 *
 * **A bound against a runaway, not a product rule.** The owner's decision is
 * that every missed period is created — three weeks away from a weekly goal
 * leaves three missed rows, because that is the honest history and the
 * completion rate should reflect it. This cap only exists because the loop that
 * does it is driven by date arithmetic: a sign error or a zero span would
 * otherwise spin, inside a request, writing rows.
 *
 * Five years of weeks. Anything past it is finished on the next read rather than
 * abandoned, so the cap delays a truly ancient series by a page refresh and
 * loses nothing.
 */
export const MAX_ROLL_FORWARD = 260;

export type PeriodWindow = { startDate: Date; deadline: Date };

/**
 * A period's length in whole days. 0 for a single-day goal.
 *
 * Clamped at zero rather than trusted. `createGoal` refuses a deadline before
 * its start date, so a negative span should be unreachable — but this figure
 * drives the loop below, and a negative one would walk backwards forever.
 */
export function periodSpan(window: PeriodWindow): number {
  return Math.max(0, daysBetween(window.startDate, window.deadline));
}

/**
 * The window after `prev`: the same length, starting the day after it ended.
 *
 * One rule for all three cadences rather than a branch per cadence. `weekly` and
 * `monthly` are spans of 6 and 29 days as `deadlineFor` writes them, so carrying
 * the span forward reproduces them exactly — and a `custom` goal repeats at
 * whatever length it was actually given, instead of having to be re-expressed as
 * one of the two named cadences.
 *
 * Periods never overlap and never leave a gap, which is what lets exactly one
 * member of a series match any given day. Feature A depends on that: two
 * overlapping periods of one series would both advance from the same activity.
 */
export function nextPeriod(prev: PeriodWindow): PeriodWindow {
  const startDate = addDays(startOfDay(prev.deadline), 1);
  return { startDate, deadline: addDays(startDate, periodSpan(prev)) };
}

/**
 * Every window that should exist after `newest`, up to and including today's.
 *
 * **Every missed period is materialised, not skipped.** Three weeks away from a
 * weekly goal produces three windows, and each becomes a row that expires
 * unmet — so the completion rate keeps describing what actually happened.
 * Jumping straight to the current window would quietly delete three misses and
 * flatter every statistic on the dashboard.
 *
 * Empty when `newest` has not ended yet, which is the common case: a series is
 * only rolled when its newest member's deadline is behind us.
 */
export function missedPeriods(newest: PeriodWindow, now: Date = new Date()): PeriodWindow[] {
  const today = startOfDay(now);
  const windows: PeriodWindow[] = [];
  let cursor = newest;

  while (startOfDay(cursor.deadline) < today && windows.length < MAX_ROLL_FORWARD) {
    cursor = nextPeriod(cursor);
    windows.push(cursor);
  }

  return windows;
}

/* ----------------------------------------------------------------- series -- */

export type SeriesMember = {
  seriesId: string | null;
  startDate: Date;
  status: string;
};

export type SeriesRun = {
  /** How many periods the series has had, including the current one. */
  total: number;
  /** How many of them were completed. */
  met: number;
  /** Consecutive completed periods ending at the most recent *finished* one. */
  streak: number;
};

/**
 * How a recurring series has actually gone.
 *
 * "You have hit this six weeks running" is a query over the series rather than a
 * counter anybody has to maintain — which is the whole payoff of a row per
 * period. Nothing here is stored.
 *
 * **The streak counts back from the most recent *finished* period, not from the
 * newest row.** The current period is usually still in flight and not completed
 * yet, and counting it as a break would make a healthy run read as zero for six
 * days out of seven.
 */
export function summariseSeries(members: SeriesMember[]): Map<string, SeriesRun> {
  const bySeries = new Map<string, SeriesMember[]>();
  for (const member of members) {
    if (!member.seriesId) continue;
    const list = bySeries.get(member.seriesId) ?? [];
    list.push(member);
    bySeries.set(member.seriesId, list);
  }

  const runs = new Map<string, SeriesRun>();
  for (const [seriesId, list] of bySeries) {
    const ordered = [...list].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    const met = ordered.filter((m) => m.status === "completed").length;

    /*
      Walk back from the end, skipping the newest period while it is still
      unfinished. `archived` breaks the run like a miss does — it is a period
      that was deliberately not pursued, and calling it a hit would let
      archiving repair a broken run.
    */
    let streak = 0;
    for (let i = ordered.length - 1; i >= 0; i--) {
      const status = ordered[i].status;
      if (i === ordered.length - 1 && status === "active") continue;
      if (status !== "completed") break;
      streak++;
    }

    runs.set(seriesId, { total: ordered.length, met, streak });
  }
  return runs;
}

/** Which period a row is within its own series, 1-based. */
export function periodIndex(members: SeriesMember[], seriesId: string, startDate: Date): number {
  return (
    members
      .filter((m) => m.seriesId === seriesId)
      .filter((m) => m.startDate.getTime() <= startDate.getTime()).length || 1
  );
}

/** "Repeats weekly", "Repeats every 12 days" — the cadence in words. */
export function describeCadence(cadence: string, window: PeriodWindow): string {
  if (cadence === "weekly") return "Repeats weekly";
  if (cadence === "monthly") return "Repeats monthly";
  const span = periodSpan(window) + 1;
  return `Repeats every ${span} day${span === 1 ? "" : "s"}`;
}
