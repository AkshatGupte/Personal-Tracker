import InlineCreateForm from "@/components/InlineCreateForm";
import Panel from "@/components/Panel";
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
        Volume, as ground rather than as a chart in a box. The measurements sit
        in the left column and the terrain runs off the right edge of the page,
        so the horizon is a structural line instead of a widget border.
      */}
      <section
        className="grid grid-cols-1 items-stretch gap-4 border-b border-border pb-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-8"
        aria-labelledby="elevation-heading"
      >
        <div className="flex flex-col justify-center gap-5 py-2">
          <div>
            <h1
              id="elevation-heading"
              className="font-mono text-[0.6rem] uppercase tracking-[0.17em] text-muted"
            >
              Elevation
            </h1>
            <p className="mt-2 font-mono text-5xl font-medium leading-none tracking-tight tabular-nums">
              {terrain.peak}
            </p>
          </div>

          <p className="max-w-[34ch] text-sm leading-relaxed text-muted">
            {terrain.hasData
              ? `tasks completed over 12 weeks, ${terrain.thisWeek} in the last 7 days`
              : "tasks completed so far. Finish something and the ground rises."}
          </p>

          {bestStreak > 0 && (
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] tabular-nums">
              <span className="text-streak">{bestStreak} day</span>{" "}
              <span className="text-muted">best active streak</span>
            </p>
          )}
        </div>

        <div className="bleed-r min-h-[9rem] lg:min-h-[12rem]">
          <TerrainProfile
            id="home"
            terrain={terrain}
            scope="All tracks"
            height="h-36 sm:h-44 lg:h-full"
            quiet
          />
        </div>
      </section>

      <div className="divide-y divide-border">
        <Panel
          label="Tracks"
          action={
            <span className="font-mono text-[0.6rem] uppercase tabular-nums tracking-[0.12em] text-muted">
              {totalTasks === 0 ? "no tasks yet" : `${completedTasks} / ${totalTasks} done`}
            </span>
          }
        >
          <InlineCreateForm
            action={createTrack}
            label="Track name"
            placeholder="e.g. DSA, Spanish, Guitar"
          />

          {rows.length === 0 ? (
            <p className="py-8 text-sm text-muted">
              No tracks yet. A Track is one learning goal, like DSA, Spanish or guitar.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border border-t border-border">
              {rows.map((track) => (
                <TrackRow key={track.id} track={track} />
              ))}
            </ul>
          )}
        </Panel>

        {/* Consistency, kept visually separate from volume. */}
        <Panel label="Consistency" sublabel="12 weeks">
          <StreakHeatmap countsByDay={countsByDay} scope="All tracks" />
        </Panel>
      </div>
    </div>
  );
}
