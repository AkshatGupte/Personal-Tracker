import Card from "@/components/Card";
import InlineCreateForm from "@/components/InlineCreateForm";
import StreakHeatmap from "@/components/StreakHeatmap";
import TerrainProfile from "@/components/TerrainProfile";
import TopNav from "@/components/TopNav";
import TrackRow from "@/components/TrackRow";
import { createTrack } from "@/lib/actions/tracks";
import { getHomeProgress } from "@/lib/progress";

// Reads the database on every request, so the page always reflects live data.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { rows, totalTasks, completedTasks, terrain, countsByDay, bestStreak } =
    await getHomeProgress();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <TopNav />

      {/*
        Volume. The most important thing on the screen: how far the ground has
        risen. The numbers sit beside the drawing so the scale is never implied
        by shape alone.
      */}
      <section className="mb-5" aria-labelledby="elevation-heading">
        <div className="card-lit overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-center">
            <div>
              <h1
                id="elevation-heading"
                className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted"
              >
                Elevation
              </h1>
              <p className="tabular mt-3 text-5xl font-extrabold leading-none">
                {terrain.peak}
              </p>
              <p className="mt-2 text-sm text-muted">
                {terrain.hasData
                  ? `tasks completed over 12 weeks, ${terrain.thisWeek} in the last 7 days`
                  : "tasks completed so far. Finish something and the ground rises."}
              </p>

              {bestStreak > 0 && (
                <p className="tabular mt-4 text-sm">
                  <span className="font-semibold text-streak">{bestStreak} day</span>{" "}
                  <span className="text-muted">best active streak</span>
                </p>
              )}
            </div>

            <TerrainProfile id="home" terrain={terrain} scope="All tracks" height="h-40 sm:h-48" />
          </div>
        </div>
      </section>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        {/* Tracks: the work itself, each row a way in. */}
        <Card
          title="Tracks"
          delay={0}
          action={
            <span className="tabular text-xs text-muted">
              {completedTasks} / {totalTasks} tasks
            </span>
          }
        >
          <InlineCreateForm
            action={createTrack}
            label="Track name"
            placeholder="e.g. DSA, Spanish, Guitar"
          />

          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              No tracks yet. A Track is one learning goal, like DSA, Spanish or guitar.
            </p>
          ) : (
            <ul className="-mx-5 mt-4 divide-y divide-border border-t border-border">
              {rows.map((track) => (
                <TrackRow key={track.id} track={track} />
              ))}
            </ul>
          )}
        </Card>

        {/* Consistency, kept visually separate from volume. */}
        <Card title="Consistency" delay={1}>
          <StreakHeatmap countsByDay={countsByDay} scope="All tracks" />
        </Card>
      </div>
    </div>
  );
}
