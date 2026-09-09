/**
 * How far back each read looks, in one place.
 *
 * There is more than one window in this app and they are **not the same
 * number**, deliberately. They were once, and that was a bug waiting to
 * happen: `TERRAIN_DAYS` set the elevation graph's span *and* filtered the rows
 * that fed the consistency heatmap, so shortening the graph silently blanked
 * ten of the heatmap's twelve weeks — the grid still drew 84 cells, but the
 * data behind them had been thrown away upstream.
 *
 * Two signals, two questions, two spans:
 *
 * - **Volume** (the terrain) asks "how much ground have I covered lately?" It
 *   is a shape, and a shape needs the data to fill its frame. Over twelve weeks
 *   a week of real use is a flat line with a vertical spike glued to the right
 *   edge, which reads as a broken chart rather than as progress.
 * - **Consistency** (the heatmap) asks "how regularly do I show up?" That
 *   question is only worth asking over a long span — a fortnight of squares
 *   cannot show a habit forming or lapsing — so it keeps its twelve weeks.
 *
 * Any new window belongs here too, named after what it answers, so the next one
 * cannot quietly borrow a span that was chosen for something else.
 */

/**
 * The elevation graph's span: two weeks.
 *
 * Was 84 days (twelve weeks). With a week or two of real activity the profile
 * was ~90% flat baseline and every point was crushed into a near-vertical
 * climb against the right-hand edge. Two weeks is the whole number of weeks
 * closest to a fortnight, so the caption reads as a span a person actually
 * thinks in, and the curve occupies most of the frame at the volume of use this
 * app is built for.
 *
 * Lengthen it when there is enough history to fill it. That is a judgement
 * about the data, not about the drawing, and it is one line here.
 */
export const TERRAIN_DAYS = 14;

/** The consistency heatmap's span. A habit is not visible over a fortnight. */
export const HEATMAP_WEEKS = 12;
export const HEATMAP_DAYS = HEATMAP_WEEKS * 7;

/**
 * A span written the way a caption should say it.
 *
 * Whole weeks are said in weeks, anything else in days, so a window can be
 * retuned to an odd number without a caption starting to claim "2.14 weeks".
 * Every caption that names a window derives it from here, which is what stops
 * the constant and the words drifting apart again.
 */
export function spanLabel(days: number): string {
  if (days % 7 !== 0) return `${days} day${days === 1 ? "" : "s"}`;
  const weeks = days / 7;
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}

/** "2 weeks" — the elevation graph's span, for captions and text alternatives. */
export const TERRAIN_SPAN = spanLabel(TERRAIN_DAYS);

/** "12 weeks" — the heatmap's span. */
export const HEATMAP_SPAN = spanLabel(HEATMAP_DAYS);

/**
 * How far back activity may be recorded: today and the six days before it.
 *
 * **Counted the way `windowStart(7)` in `lib/progress.ts` already counts** —
 * today is one of the seven, not an extra one on top. The two would drift apart
 * the first time anyone compared "this week's activity" against "the days I am
 * allowed to fill in", and there is no reason for them to disagree.
 *
 * The limit exists because streaks are derived, so a backdated entry can revive
 * a streak that read as broken. That is correct — the streak should describe
 * what actually happened — but with no limit at all the streak would stop being
 * a statement about behaviour and become one about how thorough somebody was at
 * typing it in. Seven days covers the real case (you forgot to log for a few
 * days and are catching up) and not much else.
 *
 * Enforced in `lib/backdate.ts` and applied by the server actions. The day
 * chips in the interface are a courtesy; the server check is the rule, exactly
 * as it is for the depth limit.
 */
export const BACKDATE_DAYS = 7;

/*
  No `BACKDATE_SPAN` beside the other two, on purpose.

  `spanLabel(7)` is "1 week", which is correct and reads badly in the one place
  this window is captioned ("a day in the last 1 week"). More to the point, the
  server's refusal says "the last 7 days" — so a caption in weeks would describe
  the same rule in different units to the same person. The days are named
  directly at both call sites instead.
*/
