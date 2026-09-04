import InlineCreateForm from "@/components/InlineCreateForm";
import { GlitchText } from "@/components/spiderverse/GlitchText";
import { WebDivider, WebLoader } from "@/components/spiderverse/SpiderWeb";
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
        className="grid grid-cols-1 items-stretch gap-4 pb-2 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-8"
        aria-labelledby="elevation-heading"
      >
        <div className="sv-settle flex flex-col justify-center gap-5 py-2">
          <div>
            <h1
              id="elevation-heading"
              className="font-label text-[0.6rem] uppercase tracking-[0.17em] text-muted"
            >
              <GlitchText text="Elevation" intensity="subtle" trigger="auto" baseColor="var(--muted)" />
            </h1>
            {/*
              Keyed by the value, so the flash fires on the *change* and never on
              the resting state — a check-in that raises the ground is marked,
              and a plain revalidation is not.
            */}
            <p
              key={terrain.peak}
              className="sv-value-flash mt-2 font-mono text-5xl font-medium leading-none tracking-tight tabular-nums"
            >
              {/*
                The measurement glitches too, at the quietest intensity: a burst
                every 4.5-9s lasting 50-90ms. Rare and short enough that the
                figure stays readable — a number you cannot read at a glance has
                stopped being a measurement.
              */}
              <GlitchText text={String(terrain.peak)} intensity="subtle" trigger="auto" />
            </p>
          </div>

          <p className="max-w-[34ch] text-sm leading-relaxed text-muted">
            {terrain.hasData
              ? `check-ins over 12 weeks, ${terrain.thisWeek} in the last 7 days`
              : "check-ins so far. Check in to something and the ground rises."}
          </p>

          {bestStreak > 0 && (
            <p className="font-label text-[0.65rem] uppercase tracking-[0.14em] tabular-nums">
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

      {/* Webbing instead of a flat rule between the two halves of the page. */}
      <WebDivider className="mb-2" seed={0xd93a} />

      <div>
        {/* Tracks are the loudest surface on this page: the comic panel is spent
            here and nowhere else on Home, so the hierarchy still reads. */}
        <Panel
          variant="comic"
          accent="magenta"
          label="Tracks"
          action={
            <span className="font-label text-[0.6rem] font-bold uppercase tabular-nums tracking-[0.12em]">
              {totalTasks === 0 ? (
                <span className="sv-status">no tasks yet</span>
              ) : (
                `${completedTasks} / ${totalTasks} today`
              )}
            </span>
          }
        >
          <InlineCreateForm
            action={createTrack}
            label="Track name"
            placeholder="e.g. DSA, Spanish, Guitar"
          />

          {rows.length === 0 ? (
            <div className="py-8">
              <p className="font-display text-3xl leading-none text-sv-yellow">No tracks yet</p>
              {/*
                An empty web, not a spinner: nothing is loading and nothing is
                coming on its own. The sentence still carries the meaning — the
                drawing never has to be read to understand the screen.
              */}
              <WebLoader
                className="mt-4"
                label="A Track is one learning goal, like DSA, Spanish or guitar."
              />
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-border border-t-2 border-sv-magenta/40">
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
