/**
 * Terrain maths for the progress visualisation.
 *
 * Elevation is cumulative activity. Nothing here invents a value: every point
 * comes from TopicActivity rows, and a track with nothing recorded produces an
 * explicitly empty terrain rather than a fabricated curve.
 *
 * Pure functions, no rendering, so the mapping can be reasoned about on its own.
 * Day boundaries come from lib/day, so the window here lines up exactly with
 * the days streaks and TopicActivity rows are keyed by.
 */

import { addDays, dayKey, startOfDay } from "@/lib/day";
import { TERRAIN_DAYS, TERRAIN_SPAN } from "@/lib/windows";

/*
  The window itself lives in `lib/windows.ts`, beside the heatmap's, because
  the two must be able to differ. This file used to own the only number, and
  `lib/progress.ts` reached for it to filter the rows feeding *both* the terrain
  and the heatmap — so the graph's span and the heatmap's data were one setting
  wearing two hats. Re-exported here so callers of the terrain maths still have
  it to hand.
*/
export { TERRAIN_DAYS };

/**
 * Cumulative activity totals worth marking on the terrain.
 *
 * **These are volume milestones, and they are not the streak milestones in
 * `lib/streak.ts`.** The two answer different questions and the theme keeps
 * their signals apart: volume is elevation and magenta, consistency is the
 * streak and yellow. The name says `ELEVATION` so the two cannot be reached for
 * interchangeably — before the rename both lists were called `MILESTONES`.
 */
export const ELEVATION_MILESTONES = [10, 50, 100, 250, 500] as const;

/** One day's activity total for whatever scope is being drawn — a single
 *  track, or every track at once. Fed from TopicActivity; nothing stores it. */
export type DayLog = { date: Date; count: number };

export type TerrainPoint = {
  /** 0 at the oldest day, 1 at today. */
  x: number;
  /** 0 at the baseline, 1 at the peak of this series. */
  y: number;
  dayKey: string;
  cumulative: number;
};

export type ReachedMilestone = {
  value: number;
  /** Where on the profile the milestone was actually crossed. */
  x: number;
  y: number;
  dayKey: string;
};

export type Terrain = {
  points: TerrainPoint[];
  /** Total completions in the window. 0 means genuinely nothing logged. */
  peak: number;
  /** Completions logged today. */
  today: number;
  /** Completions in the last 7 days. */
  thisWeek: number;
  reached: ReachedMilestone[];
  /** The next milestone above the current peak, if any. */
  next: number | null;
  hasData: boolean;
};

/**
 * Collapses logs into one total per day and fills gaps with zero, so a stall
 * reads as flat ground rather than disappearing from the series.
 */
export function buildSeries(
  logs: DayLog[],
  days: number = TERRAIN_DAYS,
  today: Date = new Date(),
): { dayKey: string; count: number }[] {
  const totals = new Map<string, number>();
  for (const log of logs) {
    const key = dayKey(log.date);
    totals.set(key, (totals.get(key) ?? 0) + log.count);
  }

  const end = startOfDay(today);

  const series: { dayKey: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(addDays(end, -i));
    series.push({ dayKey: key, count: totals.get(key) ?? 0 });
  }
  return series;
}

/**
 * Turns a daily series into a normalised elevation profile.
 *
 * y is scaled against the window's own peak, so a track with 8 completions and
 * one with 800 both fill their frame. The absolute number is always shown as
 * text beside the drawing so the scale is never misleading.
 */
export function buildTerrain(
  logs: DayLog[],
  days: number = TERRAIN_DAYS,
  today: Date = new Date(),
): Terrain {
  const series = buildSeries(logs, days, today);

  let running = 0;
  const cumulative = series.map((day) => {
    running += day.count;
    return { ...day, cumulative: running };
  });

  const peak = running;
  const hasData = peak > 0;
  const denominator = hasData ? peak : 1;
  const lastIndex = Math.max(1, cumulative.length - 1);

  const points: TerrainPoint[] = cumulative.map((day, i) => ({
    x: i / lastIndex,
    y: day.cumulative / denominator,
    dayKey: day.dayKey,
    cumulative: day.cumulative,
  }));

  // A milestone is only real once the running total actually crosses it, and it
  // is placed at the day it happened rather than at the end of the chart.
  const reached: ReachedMilestone[] = [];
  for (const value of ELEVATION_MILESTONES) {
    if (value > peak) continue;
    const crossing = points.find((point) => point.cumulative >= value);
    if (crossing) {
      reached.push({ value, x: crossing.x, y: value / denominator, dayKey: crossing.dayKey });
    }
  }

  const next = ELEVATION_MILESTONES.find((value) => value > peak) ?? null;

  const todayCount = series[series.length - 1]?.count ?? 0;
  const thisWeek = series.slice(-7).reduce((total, day) => total + day.count, 0);

  return { points, peak, today: todayCount, thisWeek, reached, next, hasData };
}

/**
 * Builds the SVG path for the ridge, plus the closed path used to clip the
 * terrain strata underneath it.
 */
export function ridgePath(points: TerrainPoint[], width: number, height: number): string {
  if (points.length === 0) return "";
  const px = (p: TerrainPoint) => p.x * width;
  const py = (p: TerrainPoint) => height - p.y * height;

  let d = `M ${px(points[0]).toFixed(2)} ${py(points[0]).toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const midX = (px(a) + px(b)) / 2;
    d += ` C ${midX.toFixed(2)} ${py(a).toFixed(2)}, ${midX.toFixed(2)} ${py(b).toFixed(2)}, ${px(b).toFixed(2)} ${py(b).toFixed(2)}`;
  }
  return d;
}

/** Plain-language summary used as the text alternative for the drawing. */
export function describeTerrain(terrain: Terrain, scope: string): string {
  if (!terrain.hasData) {
    return `${scope}: nothing recorded in the last ${TERRAIN_SPAN}, so there is no elevation to show yet.`;
  }
  const milestone = terrain.reached.length
    ? ` Milestones reached: ${terrain.reached.map((m) => m.value).join(", ")}.`
    : "";
  const upcoming = terrain.next ? ` Next milestone at ${terrain.next}.` : "";
  return (
    `${scope}: ${terrain.peak} activities over the last ${TERRAIN_SPAN}, ` +
    `${terrain.thisWeek} in the last 7 days.${milestone}${upcoming}`
  );
}
