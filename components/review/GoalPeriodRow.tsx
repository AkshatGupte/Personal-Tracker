import Link from "next/link";
import type { GoalSignal } from "@/lib/review";

/**
 * One goal period, as a line rather than a card.
 *
 * **A recurring goal's periods each render as their own row, because each one
 * *is* its own Goal.** Nothing here reaches past the row into the series to
 * invent a figure: `period` and `series` come straight from `getGoalBoard`,
 * which derives them from the rows themselves. A completed period stays
 * completed and a missed one stays missed — this only reads them.
 *
 * A line and not a `GoalCard`: the card owns the write path, the celebration and
 * the optimistic count, and none of that belongs on a reading screen. Reusing it
 * here would have put a second `+1` in the app for the same number.
 */

const STATUS_TONE: Record<string, string> = {
  completed: "var(--streak)",
  expired: "var(--muted)",
  active: "var(--positive)",
  archived: "var(--muted)",
};

const STATUS_WORD: Record<string, string> = {
  completed: "Met",
  expired: "Missed",
  active: "In flight",
  archived: "Archived",
};

export default function GoalPeriodRow({ goal }: { goal: GoalSignal }) {
  const href = goal.linked && goal.trackId ? `/tracks/${goal.trackId}` : "/goals";

  return (
    <li className="sv-row -mx-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-2 py-2.5">
      <div className="flex min-w-0 flex-col">
        <span className="min-w-0 text-sm">{goal.title}</span>
        <span className="font-label text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
          {/* The outcome in words first, then the figures. Colour repeats it,
              never replaces it. */}
          <span style={{ color: STATUS_TONE[goal.display] ?? "var(--muted)" }}>
            {STATUS_WORD[goal.display] ?? goal.display}
          </span>
          {` · ${Math.round(goal.current)}/${goal.target} ${goal.unit}`}
          {goal.seriesId && goal.period !== null && ` · period ${goal.period}`}
          {goal.series && goal.series.total > 1 && ` · met ${goal.series.met} of ${goal.series.total}`}
          {goal.series && goal.series.streak > 1 && (
            <span className="text-streak">{` · ${goal.series.streak} in a row`}</span>
          )}
        </span>
      </div>

      <Link
        href={href}
        className="shrink-0 font-label text-[0.75rem] uppercase tracking-[0.12em] text-muted transition-colors hover:text-fg"
      >
        {/* Linked goals are advanced by working the track — there is deliberately
            no way to type into one, here or anywhere. */}
        {goal.linked ? (goal.sourceLabel ?? "Open track") : "Open goal"} &rarr;
      </Link>
    </li>
  );
}
