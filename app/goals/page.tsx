import GoalCreateForm from "@/components/goals/GoalCreateForm";
import GoalList from "@/components/goals/GoalList";
import GoalStatsPanel from "@/components/goals/GoalStats";
import TopNav from "@/components/TopNav";
import { ThreadDivider } from "@/components/spiderverse/Threads";
import { getGoalBoard } from "@/lib/goalReads";

/**
 * The Goal Tracker.
 *
 * Reads on every request, like the other data screens, so the figures reflect
 * the database rather than a cache that a write has to remember to clear. Every
 * statistic on this page is derived from the goal rows at render time — see
 * `summariseGoals` — which is what makes "these numbers must update immediately"
 * true by construction rather than by wiring.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Goals · Rendred" };

export default async function GoalsPage() {
  const { goals, stats } = await getGoalBoard();

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
      <TopNav />

      <h1 className="sr-only">Goals</h1>

      <div className="mt-4">
        <GoalStatsPanel stats={stats} />
      </div>

      <ThreadDivider seed={0x60a1} className="mt-6" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Says what a goal is *against the rest of the app*, because the
            distinction is the whole reason this screen exists. */}
        <p className="max-w-[46ch] text-sm leading-relaxed text-muted">
          A goal has a target and a deadline. Tracks are for the work that never
          finishes; this is for the things that do.
        </p>
        <GoalCreateForm />
      </div>

      <GoalList goals={goals} />
    </div>
  );
}
