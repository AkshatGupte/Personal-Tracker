import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import InlineCreateForm from "@/components/InlineCreateForm";
import LeafHistory, { historyDays } from "@/components/LeafHistory";
import LeafList from "@/components/LeafList";
import Panel from "@/components/Panel";
import ProgressRing from "@/components/ProgressRing";
import StreakHeatmap from "@/components/StreakHeatmap";
import TerrainProfile from "@/components/TerrainProfile";
import TopNav from "@/components/TopNav";
import TopicTree from "@/components/TopicTree";
import TrackStat from "@/components/TrackStat";
import { createTopic } from "@/lib/actions/topics";
import { getLeafHistory, getTrackDetail, type TrackNode } from "@/lib/progress";
import { HEATMAP_SPAN } from "@/lib/windows";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const track = await getTrackDetail(id);
  return { title: track ? `${track.name} · Rendred` : "Rendred" };
}

/** Every node in the track, flattened — the move control's destination list. */
function flattenNodes(nodes: TrackNode[]): TrackNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
  const track = await getTrackDetail(id);
  if (!track) notFound();

  // 28 days, named here rather than borrowed from another window: this is a
  // per-row strip, and a month of 3px cells is about as much as one row can
  // carry and still have a date readable out of it.
  const HISTORY_DAYS = 28;
  const history = await getLeafHistory(track.id, HISTORY_DAYS);

  /*
    The view lives in the URL rather than in component state, which keeps this
    page a server component — the whole tree and its coverage are computed on
    the server, and lifting the toggle into React would drag all of that across
    the boundary to decide which of two lists to render.
  */
  const isTree = view === "tree";
  const allNodes = flattenNodes(track.tree);

  // createTopic takes the track id and a parent; bound to null here, so the
  // form at the top of the panel always adds at the top level.
  const addTopic = createTopic.bind(null, track.id, null);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <TopNav />

        <nav aria-label="Breadcrumb" className="mb-5">
          <Link
            href="/"
            className="rounded-none font-label text-[0.75rem] uppercase tracking-[0.15em] text-muted transition-colors hover:text-fg"
          >
            &larr; All tracks
          </Link>
        </nav>

        {/*
          The track and how far its ground has risen — and the one comic panel
          this screen spends.

          `Panel`'s own rule puts the loud register on "the Track header on a
          track page", and this route had none at all, which is what made it
          read as an older screen than Home and Progress. Topics and Tasks below
          stay banded, so the hierarchy is unchanged.

          No `label`: the caption box renders an h2, and putting one above the
          track's h1 would invert the heading order for no visual gain. Without
          it the panel is border, registration plate and halftone only, which is
          the part that carries the register.

          The terrain gives up `bleed-r` here, because a panel that a child
          escapes has no frame left.
        */}
        <Panel variant="comic" accent="magenta">
        <section
          className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-8"
          aria-labelledby="track-heading"
        >
          <div className="flex flex-col justify-center gap-6 py-2">
            <h1
              id="track-heading"
              className="font-display text-4xl leading-[1.05] tracking-tight text-balance"
            >
              {track.name}
            </h1>

            <dl className="flex flex-wrap gap-x-8 gap-y-4">
              {/*
                Only these two answer to a check-in, and only ever one of them at
                a time — see CheckInBeat. Longest is not a third emphasis: a new
                personal best is said in the report line, as part of the same
                outcome, rather than lighting up a second number.
              */}
              <TrackStat label="Elevation" value={track.elevation} />
              <TrackStat
                label="Streak"
                value={track.currentStreak}
                tone="ember"
              />
              <TrackStat label="Longest" value={track.longestStreak} />
              <TrackStat label="Active days" value={track.activeDayCount} />
            </dl>

            {/*
              The statement sits beside the number it explains rather than
              floating in the middle of the empty terrain, which read as stray
              text. The terrain itself stays a plain dashed baseline.
            */}
            {/*
              Keyed on the elevation figure, not on the terrain's window.

              This read `!track.terrain.hasData`, which is "nothing in the last
              2 weeks" — fine while the numeral above was the same windowed
              total, and contradictory now that it is all-time. A track with 50
              activities and a quiet fortnight would have shown "Elevation 50"
              directly above "No elevation yet". The sentence belongs to the
              numeral, so it asks the numeral's question.
            */}
            {track.elevation === 0 && (
              <p className="max-w-[34ch] text-sm leading-relaxed text-muted">
                No elevation yet. Working a topic raises the ground.
              </p>
            )}
          </div>

          <div className="min-h-[9rem] lg:min-h-[13rem]">
            <TerrainProfile
              id={track.id}
              terrain={track.terrain}
              scope={track.name}
              height="h-36 sm:h-44 lg:h-full"
              quiet
            />
          </div>
        </section>
        </Panel>

        <div className="divide-y divide-border">
          <Panel
            label={isTree ? "Tree" : "Topics"}
            sublabel={
              isTree
                ? `${allNodes.length} topic${allNodes.length === 1 ? "" : "s"} in the tree`
                : `${track.leafCount} topic${track.leafCount === 1 ? "" : "s"} to work on`
            }
            action={
              <span className="font-label text-[0.75rem] uppercase tabular-nums tracking-[0.12em] text-muted">
                {track.leafCount === 0
                  ? "nothing to work on yet"
                  : `${track.workedToday} / ${track.leafCount} worked today`}
              </span>
            }
          >
            {/*
              The view toggle sits at the top of the content column, not in the
              panel's gutter.

              Two things were wrong with it there. The gutter is 7rem, and at
              1440px the label, the sublabel, the count and a yellow chip could
              not fit: `TODAY` wrapped onto the toggle's own baseline and read as
              part of the toggle group. And the gutter is rendered *before* the
              content, so the first tab stop inside the panel was a control 46px
              below the field it precedes — focus went `← All tracks` → Flat →
              Tree → back up to the topic name input.

              Here it is above the form both visually and in the DOM, so tab
              order runs down the page and the gutter is text only.

              Links, not buttons. The view is a URL, so it is shareable, it
              survives a reload, and the back button does what it looks like it
              should — none of which a piece of component state gives.
            */}
            <div className="mb-3 flex items-center justify-end gap-1">
              <ViewLink href={`/tracks/${track.id}`} active={!isTree} label="Flat" />
              <ViewLink href={`/tracks/${track.id}?view=tree`} active={isTree} label="Tree" />
            </div>

            <InlineCreateForm
              action={addTopic}
              label="Topic name"
              placeholder="Name a topic to work on"
            />

            <div className="mt-2 border-t border-border">
              {isTree ? (
                <TopicTree roots={track.tree} trackId={track.id} all={allNodes} />
              ) : (
                <LeafList leaves={track.leaves} trackId={track.id} all={allNodes} />
              )}
            </div>
          </Panel>

          <Panel label="Today" sublabel="topics worked">
            <div className="py-2">
              {/*
                Coverage, not completion. The ratio answers "how much of this
                track did I touch today" and resets each morning; nothing here
                ever finishes, so it is never "how many are done".
              */}
              <ProgressRing
                completed={track.workedToday}
                total={track.leafCount}
                label={`${track.name} leaves worked today`}
              />
            </div>
          </Panel>

          {/* The heatmap's own window, not the terrain's — see lib/windows.ts. */}
          <Panel label="Consistency" sublabel={`${HEATMAP_SPAN} · leaves covered`}>
            <StreakHeatmap countsByDay={track.countsByDay} scope={track.name} />
          </Panel>

          <Panel label="History" sublabel={`per topic · ${HISTORY_DAYS} days`}>
            <LeafHistory rows={history} days={historyDays(HISTORY_DAYS)} />
          </Panel>
        </div>
    </div>
  );
}

/** One half of the view toggle. Active state is carried by fill, not weight —
 *  the display face has one weight and a bold class would mark nothing. */
function ViewLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      /*
        Scroll is kept. This is a panel-level view switch, not a page
        navigation: the same topics in a different arrangement, halfway down a
        long page. Next scrolls to the top by default, so from `scrollY=900` the
        toggle threw the reader back to the masthead — and asymmetrically, since
        flat→tree landed at 0 and tree→flat at 96.
      */
      scroll={false}
      /*
        `true`, not `page`. The top nav owns `aria-current="page"` — it says
        which section of the site you are in — and this says which of two
        arrangements of one section is showing. Both claiming `page` put two of
        them on `/progress?period=month`.
      */
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "rounded-none bg-sv-yellow px-2 py-0.5 font-label text-[0.75rem] uppercase tracking-[0.14em] text-sv-ink"
          : "rounded-none px-2 py-0.5 font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg"
      }
    >
      {label}
    </Link>
  );
}
