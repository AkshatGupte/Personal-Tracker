/**
 * Period rollups over daily completion history.
 *
 * Pure functions, no database and no rendering, so the bucketing can be
 * reasoned about on its own. Weeks run Monday to Sunday, matching the heatmap
 * grid — a summary that disagreed with the heatmap about where a week starts
 * would be worse than no summary at all.
 *
 * Deliberately period-generic: `rollUp` takes whatever buckets it is handed, so
 * the monthly summary needs only a `monthBuckets` function beside `weekBuckets`,
 * and the trajectory view can read the same `PeriodRollup[]` rather than
 * recomputing history a third way.
 *
 * All day boundaries come from lib/day, so a rollup and a streak can never
 * disagree about which day a completion fell on.
 */

import { addDays, dayKey, startOfDay, startOfMonth } from "@/lib/day";
import type { DayLog } from "@/lib/terrain";

export const WEEK_DAYS = 7;

/** A half-open period: `start` inclusive, `endExclusive` exclusive. */
export type PeriodBucket = {
  /** Stable identity, the period's first local day (yyyy-mm-dd). */
  key: string;
  start: Date;
  endExclusive: Date;
};

export type PeriodRollup = PeriodBucket & {
  /** Tasks completed in the period. */
  completed: number;
  /** Distinct days with at least one completion. Separates spread from bursts. */
  activeDays: number;
  /** Days of the period that have actually happened. 7 for a past week. */
  elapsedDays: number;
  /** True for the period containing today, which is still in progress. */
  isCurrent: boolean;
};

/** Monday local midnight for the week containing `date`. */
export function startOfWeek(date: Date = new Date()): Date {
  const day = startOfDay(date);
  // getDay() is Sunday-first; shift so Monday is 0.
  const mondayFirst = (day.getDay() + 6) % 7;
  return addDays(day, -mondayFirst);
}

/**
 * `count` consecutive weeks ending with the one containing `now`, oldest first.
 * The last bucket is the current, partial week.
 */
export function weekBuckets(count: number, now: Date = new Date()): PeriodBucket[] {
  const thisWeek = startOfWeek(now);
  const buckets: PeriodBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -i * WEEK_DAYS);
    buckets.push({ key: dayKey(start), start, endExclusive: addDays(start, WEEK_DAYS) });
  }
  return buckets;
}

/**
 * `count` consecutive calendar months ending with the one containing `now`,
 * oldest first. The last bucket is the current, partial month.
 *
 * Built from calendar arithmetic rather than by stepping a fixed number of
 * days, because months are 28 to 31 days long: `addDays(-30)` would drift a
 * little further off the first of the month with every step back, and by six
 * buckets the labels no longer name the months they hold.
 */
export function monthBuckets(count: number, now: Date = new Date()): PeriodBucket[] {
  const buckets: PeriodBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = startOfMonth(now, -i);
    buckets.push({ key: dayKey(start), start, endExclusive: startOfMonth(start, 1) });
  }
  return buckets;
}

/**
 * Collapses logs to one total per local day.
 *
 * Necessary before counting active days: CompletionLog holds one row per track
 * per day, so across several tracks a single day can arrive as several rows,
 * and counting rows would report one day of work as several.
 */
export function totalsByDay(logs: DayLog[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const log of logs) {
    const key = dayKey(log.date);
    totals.set(key, (totals.get(key) ?? 0) + log.tasksCompletedCount);
  }
  return totals;
}

/**
 * Buckets daily history into the given periods.
 *
 * A period with no activity comes back as a real zero rather than being left
 * out, so a gap reads as a gap. Nothing here invents a value.
 */
export function rollUp(
  logs: DayLog[],
  buckets: PeriodBucket[],
  now: Date = new Date(),
): PeriodRollup[] {
  const totals = totalsByDay(logs);
  const today = startOfDay(now);

  return buckets.map((bucket) => {
    let completed = 0;
    let activeDays = 0;
    let elapsedDays = 0;

    for (let day = new Date(bucket.start); day < bucket.endExclusive; day = addDays(day, 1)) {
      if (day > today) continue; // the rest of the current week has not happened
      elapsedDays++;
      const count = totals.get(dayKey(day)) ?? 0;
      if (count > 0) {
        completed += count;
        activeDays++;
      }
    }

    return {
      ...bucket,
      completed,
      activeDays,
      elapsedDays,
      isCurrent: today >= bucket.start && today < bucket.endExclusive,
    };
  });
}

export type PeriodDay = {
  key: string;
  date: Date;
  count: number;
  /** Inside the period but not yet reached. Never drawn as a zero. */
  isFuture: boolean;
  isToday: boolean;
};

/**
 * Day-by-day inside one period, for showing the shape of a week rather than
 * only its total. Future days are marked rather than reported as zero: a day
 * that has not happened has not been missed.
 */
export function dailyBreakdown(
  logs: DayLog[],
  bucket: PeriodBucket,
  now: Date = new Date(),
): PeriodDay[] {
  const totals = totalsByDay(logs);
  const today = startOfDay(now);
  const days: PeriodDay[] = [];

  for (let day = new Date(bucket.start); day < bucket.endExclusive; day = addDays(day, 1)) {
    const key = dayKey(day);
    days.push({
      key,
      date: new Date(day),
      count: totals.get(key) ?? 0,
      isFuture: day > today,
      isToday: day.getTime() === today.getTime(),
    });
  }
  return days;
}

/** Plain-language summary, used as the text alternative for a period. */
export function describePeriod(period: PeriodRollup, scope: string): string {
  if (period.completed === 0) {
    return `${scope}: nothing completed.`;
  }
  return (
    `${scope}: ${period.completed} task${period.completed === 1 ? "" : "s"} completed ` +
    `across ${period.activeDays} of ${period.elapsedDays} day${period.elapsedDays === 1 ? "" : "s"}.`
  );
}
