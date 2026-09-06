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

/**
 * All-time cumulative activity. **The headline elevation numeral, and the one
 * figure in this file that has no window.**
 *
 * `CLAUDE.md` says elevation is cumulative and only rises. The numeral was
 * `Terrain.peak`, which is the total *inside the terrain window* — so with
 * `TERRAIN_DAYS = 14` it fell as activity aged past a fortnight, and a person
 * who stopped for two weeks watched their elevation drop to zero. That
 * contradicts the documented model, and it contradicts the metaphor: ground you
 * have covered does not un-cover itself because time passed.
 *
 * The fix is deliberately a *separate* figure rather than a widened window. The
 * terrain drawing needs a short span or the profile is 90% flat baseline with a
 * spike glued to the right edge — see `lib/windows.ts`, which explains why the
 * window is two weeks and why it should stay two weeks. So the drawing keeps its
 * window and the numeral loses it; they answer different questions and they are
 * no longer the same number wearing two hats.
 *
 * **Why this takes no `days` argument at all.** The monotonicity the model
 * promises is a property of the signature, not of the caller: with no window
 * there is nothing for the passage of time to push a row out of, so this cannot
 * fall as activity ages however it is called. A `days` parameter with a large
 * default would put the bug one careless argument away.
 *
 * It sums the same rows the terrain sums, including those belonging to
 * soft-deleted topics, which matters for the same reason: filtering to live
 * leaves would make deleting a topic *lower* the elevation, which is the
 * identical defect arriving by another route. History is kept, so the ground
 * stays raised.
 *
 * It can still go down by exactly one when a recorded activity is undone. That
 * is the undo doing its job, not a window discarding data.
 */
export function cumulativeElevation(logs: DayLog[]): number {
  return logs.reduce((total, log) => total + log.count, 0);
}

/**
 * The next elevation milestone strictly above `value`.
 *
 * Above the named list it carries on with the list's own 1 - 2.5 - 5 rhythm
 * (500, 1000, 2500, 5000, ...) rather than stopping, so the axis never runs out
 * of ceiling on a long-lived track.
 */
export function nextMilestone(value: number): number {
  for (const milestone of ELEVATION_MILESTONES) {
    if (milestone > value) return milestone;
  }
  const steps = [2, 2.5, 2];
  let milestone: number = ELEVATION_MILESTONES[ELEVATION_MILESTONES.length - 1];
  let i = 0;
  while (milestone <= value) {
    milestone = Math.round(milestone * steps[i % steps.length]);
    i++;
  }
  return milestone;
}

/** One day on the trajectory. One point per calendar day, gaps included. */
export type TerrainPoint = {
  /** 0 at the oldest day in the window, 1 at today. */
  x: number;
  /** `cumulative / domainMax`. Strictly below 1 — see `domainMax`. */
  y: number;
  dayKey: string;
  /** Activities recorded on this track on this day alone. */
  count: number;
  /** The track's elevation at the end of this day: all-time, not windowed. */
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
  /**
   * The top of the y axis, and the next elevation milestone — one number,
   * deliberately.
   *
   * **This replaced `y = cumulative / peak`, which was the scaling bug.**
   * Normalising a series against its own total puts the last point at exactly
   * 1.0 every time, so the ridge filled the frame whether the track had two
   * activities or two hundred, and a single activity on an empty history drew a
   * flat line and then a full-height vertical jump. The picture carried no
   * magnitude at all.
   *
   * A fixed scale fixes that, and this one is not arbitrary: the axis top is a
   * number the app already means and already draws. Consequences that follow
   * for free —
   *
   * - **Proportional.** 2 activities is 2/10 of the frame; 200 is 200/250.
   * - **Headroom by construction.** Elevation is always strictly below the next
   *   milestone, so the ridge can never touch the top edge.
   * - **Stable.** The domain only moves when a milestone is actually crossed,
   *   so the chart does not rescale under the reader day to day.
   * - **Readable.** The top of the frame *is* the next milestone, so "climbing
   *   toward the top" is literally true rather than a decoration.
   */
  domainMax: number;
  /** Elevation at the newest day: all-time, and the value the headline shows. */
  elevation: number;
  /** Activities inside the window. What the caption's span refers to. */
  windowTotal: number;
  /** Activities recorded today. */
  today: number;
  /** Activities in the last 7 days. */
  thisWeek: number;
  reached: ReachedMilestone[];
  /** True when the *window* holds activity. Elevation may be non-zero anyway. */
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
  /**
   * The track's elevation *before* the window opens.
   *
   * Without it the ridge restarts at zero every fortnight, so a track with 100
   * activities and a quiet two weeks drew a line along the floor while the
   * numeral beside it read 100. The chart and the figure have to be the same
   * measurement or one of them is lying; this is what makes the top of the
   * ridge equal the headline elevation.
   */
  baseline = 0,
): Terrain {
  const series = buildSeries(logs, days, today);

  let running = baseline;
  const cumulative = series.map((day) => {
    running += day.count;
    return { ...day, cumulative: running };
  });

  const elevation = running;
  const windowTotal = elevation - baseline;
  const hasData = windowTotal > 0;
  const domainMax = nextMilestone(elevation);
  const lastIndex = Math.max(1, cumulative.length - 1);

  const points: TerrainPoint[] = cumulative.map((day, i) => ({
    x: i / lastIndex,
    y: day.cumulative / domainMax,
    dayKey: day.dayKey,
    count: day.count,
    cumulative: day.cumulative,
  }));

  /*
    A milestone is only real once elevation actually crosses it, and it is drawn
    at the day it happened rather than at the end of the chart.

    Only milestones crossed *inside this window* get a position, because that is
    the only place there is a day to point at. One crossed before the window is
    already under the ridge's starting height and needs no marker — the ground
    is simply above it.
  */
  const reached: ReachedMilestone[] = [];
  for (const value of ELEVATION_MILESTONES) {
    if (value > elevation) continue;
    const crossing = points.find((point) => point.cumulative >= value);
    if (crossing && crossing.cumulative - crossing.count < value) {
      reached.push({ value, x: crossing.x, y: value / domainMax, dayKey: crossing.dayKey });
    }
  }

  const todayCount = series[series.length - 1]?.count ?? 0;
  const thisWeek = series.slice(-7).reduce((total, day) => total + day.count, 0);

  return { points, domainMax, elevation, windowTotal, today: todayCount, thisWeek, reached, hasData };
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
    /*
      "no profile to draw", not "no elevation to show". This sentence is the
      drawing's text alternative and the drawing is windowed, but elevation is
      all-time now — so on a track with a real total and a quiet fortnight the
      old wording had a screen reader announce "Elevation 18" and then "no
      elevation to show yet".
    */
    return `${scope}: nothing recorded in the last ${TERRAIN_SPAN}, so there is no profile to draw yet.`;
  }
  const milestone = terrain.reached.length
    ? ` Milestones reached in this window: ${terrain.reached.map((m) => m.value).join(", ")}.`
    : "";
  /*
    Says what the axis is, because this sentence is the whole chart for anyone
    not looking at it. The reader gets the metric, the range and the scale, in
    that order — the same three things the drawing carries.
  */
  return (
    `${scope}: elevation ${terrain.elevation}, plotted daily over the last ` +
    `${TERRAIN_SPAN} against a scale topping out at the next milestone of ` +
    `${terrain.domainMax}. ${terrain.windowTotal} activities in that window, ` +
    `${terrain.thisWeek} in the last 7 days.${milestone}`
  );
}

/**
 * One day, in the words the hover uses. Kept here beside the maths so the
 * tooltip, the text alternative and the day-by-day list cannot drift apart.
 */
export function describeDay(point: TerrainPoint): string {
  const activities = `${point.count} ${point.count === 1 ? "activity" : "activities"}`;
  return `${activities}, elevation ${point.cumulative}`;
}
