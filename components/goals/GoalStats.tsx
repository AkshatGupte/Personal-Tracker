import Panel from "@/components/Panel";
import { GlitchText } from "@/components/spiderverse/GlitchText";
import type { GoalStats, WindowTally } from "@/lib/goals";

function Figure({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div>
      <p className="font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl leading-none tabular-nums" style={{ color: tone }}>
        {value}
      </p>
    </div>
  );
}

function Tally({ label, tally }: { label: string; tally: WindowTally }) {
  const pct = tally.total === 0 ? 0 : Math.round((tally.completed / tally.total) * 100);
  return (
    <div>
      <p className="font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 font-mono text-lg tabular-nums">
        {tally.completed} <span className="text-muted">/ {tally.total}</span>
      </p>
      <div className="mt-1 h-1 w-full" style={{ background: "var(--elevated)" }}>
        <div className="sv-goal-bar h-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
      </div>
    </div>
  );
}

/**
 * The board's headline. Every figure is derived from the goal rows on each
 * render, so creating, completing, expiring, archiving or deleting a goal moves
 * these the moment the page revalidates — there is no counter to keep in step.
 *
 * The comic panel is spent here and nowhere else on this screen, per the one-per
 * -screen rule: this is the level that should dominate, and the cards below sit
 * in the band register underneath it.
 */
export default function GoalStatsPanel({ stats }: { stats: GoalStats }) {
  return (
    <Panel
      variant="comic"
      accent="magenta"
      label="Goal performance"
      action={
        <span className="font-label text-[0.75rem] uppercase tracking-[0.12em] tabular-nums text-streak">
          {stats.totalXp} XP
        </span>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-8">
        <div>
          <p className="font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted">
            <GlitchText text="Completion rate" intensity="subtle" trigger="auto" baseColor="var(--muted)" />
          </p>
          <p className="mt-1 font-mono text-5xl leading-none tabular-nums">{stats.completionRate}%</p>
          <div className="mt-3 h-3 w-full" style={{ background: "var(--elevated)" }}>
            <div
              className="sv-goal-bar h-full"
              style={{ width: `${stats.completionRate}%`, background: "var(--accent)" }}
            />
          </div>
          <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-muted">
            {stats.total === 0
              ? "No goals yet. Set one and the board starts keeping score."
              : `${stats.completed} of ${stats.total} goals met. Archived goals are left out of the rate.`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Figure label="Total goals" value={stats.total} />
          <Figure label="Completed" value={stats.completed} tone="var(--sv-yellow)" />
          <Figure label="Active" value={stats.active} tone="var(--sv-cyan)" />
          <Figure label="Expired" value={stats.expired} tone="var(--sv-red)" />
          <Figure label="Archived" value={stats.archived} />
          <Figure label="Avg progress" value={`${stats.averageProgress}%`} />
          <Figure
            label="Goal streak"
            value={`${stats.currentStreak}d`}
            tone={stats.currentStreak > 0 ? "var(--streak)" : undefined}
          />
          <Figure label="Best streak" value={`${stats.bestStreak}d`} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Tally label="This week" tally={stats.thisWeek} />
        <Tally label="This month" tally={stats.thisMonth} />
        <Tally label="All time" tally={stats.allTime} />
      </div>

      {stats.byCategory.length > 0 && (
        <div className="mt-6">
          <p className="font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted">
            Category performance
          </p>
          <ul className="mt-2 space-y-1.5">
            {stats.byCategory.map((row) => (
              <li key={row.category} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate font-label text-[0.75rem] uppercase tracking-[0.12em]">
                  {row.category}
                </span>
                <span className="h-1.5 min-w-0 flex-1" style={{ background: "var(--elevated)" }}>
                  <span
                    className="sv-goal-bar block h-full"
                    style={{ width: `${row.rate}%`, background: "var(--accent)" }}
                  />
                </span>
                <span className="w-20 shrink-0 text-right font-mono text-sm tabular-nums">
                  {row.rate}%
                  <span className="ml-1 text-muted">
                    ({row.completed}/{row.total})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
