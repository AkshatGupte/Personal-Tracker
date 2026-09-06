import InlineCreateForm from "@/components/InlineCreateForm";
import { GlitchText } from "@/components/spiderverse/GlitchText";
import { ThreadDivider, ThreadVoid } from "@/components/spiderverse/Threads";
import Panel from "@/components/Panel";
import StreakHeatmap from "@/components/StreakHeatmap";
import TerrainProfile from "@/components/TerrainProfile";
import TopNav from "@/components/TopNav";
import TrackRow from "@/components/TrackRow";
import { createTrack } from "@/lib/actions/tracks";
import { getHomeProgress } from "@/lib/progress";
import { HEATMAP_SPAN, TERRAIN_SPAN } from "@/lib/windows";

// Reads the database on every request, so the page always reflects live data.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { rows, totalLeaves, workedLeaves, terrain, countsByDay, bestStreak } =
    await getHomeProgress();

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
      <TopNav />

      {/*
        The page's own name, for the heading outline only.

        `ELEVATION` was the `h1` here and `THIS WEEK` was the one on Progress —
        both of them section labels for the figure beside them, neither of them
        the name of anything. A document whose top-level heading is the caption
        of its first widget has no outline. Visually hidden because the audit's
        constraint is that nothing changes about what is displayed where; the
        visible label stays exactly where it was, one level down.
      */}
      <h1 className="sr-only">Home — all tracks</h1>

      {/*
        Volume, as ground rather than as a chart in a box. The measurements sit
        in the left column and the terrain runs off the right edge of the page,
        so the horizon is a structural line instead of a widget border.
      */}
      <section
        className="grid grid-cols-1 items-stretch gap-3 pb-3 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-8"
        aria-labelledby="elevation-heading"
      >
        <div className="sv-settle flex flex-col justify-center gap-4">
          <div>
            <h2
              id="elevation-heading"
              className="font-label text-[0.75rem] uppercase tracking-[0.17em] text-muted"
            >
              <GlitchText text="Elevation" intensity="subtle" trigger="auto" baseColor="var(--muted)" />
            </h2>
            {/*
              Keyed by the value, so the flash fires on the *change* and never on
              the resting state — a check-in that raises the ground is marked,
              and a plain revalidation is not.

              The measurement glitches too, at the quietest intensity: rare and
              short enough that the figure stays readable — a number you cannot
              read at a glance has stopped being a measurement.
            */}
            <p
              key={terrain.peak}
              className="sv-value-flash mt-2 font-mono text-5xl font-medium leading-none tracking-tight tabular-nums"
            >
              <GlitchText text={String(terrain.peak)} intensity="subtle" trigger="auto" />
            </p>
          </div>

          <p className="max-w-[34ch] text-sm leading-relaxed text-muted">
            {/*
              "Activities", not "check-ins". A check-in was a once-a-day tick on
              a Task, and Tasks are gone — the figure above is a count of
              recorded activity on leaf topics, several of which can land on the
              same node on the same day. The span is read from the window rather
              than written out, so it follows the graph beside it.
            */}
            {terrain.hasData
              ? `activities over ${TERRAIN_SPAN}, ${terrain.thisWeek} in the last 7 days`
              : "activities so far. Work a topic and the ground rises."}
          </p>

          {bestStreak > 0 && (
            <p className="font-label text-[0.75rem] uppercase tracking-[0.14em] tabular-nums">
              <span className="text-streak">{bestStreak} day</span>{" "}
              <span className="text-muted">best active streak</span>
            </p>
          )}
        </div>

        {/*
          The chart carries the height, not this wrapper, and not `h-full`.

          `lg:h-full` here resolved to auto against an auto-height row, so the
          box fell back to the SVG's own 720x200 viewBox ratio and came out
          322px at full column width — nearly twice the 12rem intended, and most
          of the empty space above the Tracks panel. Pinning the *wrapper* to a
          fixed height instead only moved the problem: the chart still claimed
          100% of it and squeezed the "2 weeks / next 100" caption out of the
          bottom of the figure, straight onto the divider rule below.

          A definite height on the chart does not work either: the chart box is
          `flex-1`, whose `flex-basis: 0%` beats a height class, and 0% of an
          indefinite height falls back to content — the SVG ratio again.

          So the height goes on the wrapper and the chart asks for `h-auto`, plus
          `min-h-0`. That last one is the whole fix: a flex item defaults to
          `min-height: auto`, which floors it at its min-content height — and
          the SVG's ratio makes that 322px, so it refused to shrink into the box
          however the height was written. With the floor released the figure's
          `h-full` resolves against a definite box, the chart's `flex-1` grows
          into the real free space, and the caption keeps its own line inside
          the figure instead of being pushed out of the bottom onto the rule.
        */}
        {/*
          `bleed-r` is gone, and with it the only piece of content that escaped
          the reading column.

          It pushed the figure past the container into the decoration margin, so
          at 1440px the `NEXT 100` axis label landed at x=1362 — 338px outside
          the 1024px column, sitting in the atmosphere layer, with the curve's
          endpoint dot inside a lit wireframe polygon. An axis label is data: it
          is the thing that says what the drawing measures, and it cannot be
          read against a background the interface does not control. The terrain
          keeps its full height and simply ends where the column does.
        */}
        <div className="h-[10rem] lg:h-[11rem]">
          <TerrainProfile
            id="home"
            terrain={terrain}
            scope="All tracks"
            height="h-36 sm:h-44 lg:h-auto min-h-0"
            quiet
          />
        </div>
      </section>

      {/* Webbing instead of a flat rule between the two halves of the page. The
          section above keeps a little bottom padding so the terrain's own
          baseline does not land on this rule and read as one merged line —
          the terrain bleeds past the container, so the two would join up into a
          single stroke running the full width of the window. */}
      <ThreadDivider seed={0xd93a} />

      <div>
        {/* Tracks are the loudest surface on this page: the comic panel is spent
            here and nowhere else on Home, so the hierarchy still reads. */}
        <Panel
          variant="comic"
          accent="magenta"
          label="Tracks"
          action={
            <span className="font-label text-[0.75rem] font-bold uppercase tabular-nums tracking-[0.12em]">
              {totalLeaves === 0 ? (
                <span className="sv-status">nothing to work on yet</span>
              ) : (
                `${workedLeaves} / ${totalLeaves} today`
              )}
            </span>
          }
        >
          <InlineCreateForm
            action={createTrack}
            label="Track name"
            placeholder="Name a learning goal, e.g. Spanish"
          />

          {rows.length === 0 ? (
            <div className="py-8">
              <p className="font-display text-3xl leading-none text-sv-yellow">No tracks yet</p>
              {/*
                An empty web, not a spinner: nothing is loading and nothing is
                coming on its own. The sentence still carries the meaning — the
                drawing never has to be read to understand the screen.
              */}
              <ThreadVoid
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

        {/* Consistency, kept visually separate from volume — and on its own,
            longer window. A habit is not visible over a fortnight, so this
            stays at twelve weeks while the terrain above shortened to two;
            both spans are named in lib/windows.ts. */}
        <Panel label="Consistency" sublabel={HEATMAP_SPAN}>
          <StreakHeatmap countsByDay={countsByDay} scope="All tracks" />
        </Panel>
      </div>
    </div>
  );
}
