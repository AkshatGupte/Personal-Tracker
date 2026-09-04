import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckInBeatProvider } from "@/components/CheckInBeat";
import InlineCreateForm from "@/components/InlineCreateForm";
import Panel from "@/components/Panel";
import ProgressRing from "@/components/ProgressRing";
import StreakHeatmap from "@/components/StreakHeatmap";
import TerrainProfile from "@/components/TerrainProfile";
import TopNav from "@/components/TopNav";
import TopicRow from "@/components/TopicRow";
import TrackStat from "@/components/TrackStat";
import { createTopic } from "@/lib/actions/topics";
import { getTrackDetail } from "@/lib/progress";

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

export default async function TrackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const track = await getTrackDetail(id);
  if (!track) notFound();

  // createTopic takes the track id first, so bind it to match the form action
  // signature the shared create form expects.
  const addTopic = createTopic.bind(null, track.id);

  return (
    // The channel has to enclose both the header stats and the task rows: a
    // check-in happens deep in the list and is answered at the top of the page.
    <CheckInBeatProvider>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <TopNav />

        <nav aria-label="Breadcrumb" className="mb-5">
          <Link
            href="/"
            className="rounded-none font-label text-[0.6rem] uppercase tracking-[0.15em] text-muted transition-colors hover:text-fg"
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
              <TrackStat label="Elevation" value={track.terrain.peak} signal="elevation" />
              <TrackStat
                label="Streak"
                value={track.currentStreak}
                tone="ember"
                signal="streak"
              />
              <TrackStat label="Longest" value={track.longestStreak} />
            </dl>

            {/*
              The statement sits beside the number it explains rather than
              floating in the middle of the empty terrain, which read as stray
              text. The terrain itself stays a plain dashed baseline.
            */}
            {!track.terrain.hasData && (
              <p className="max-w-[34ch] text-sm leading-relaxed text-muted">
                No elevation yet. Completing a task raises the ground.
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
            label="Topics"
            sublabel={`${track.topics.length} in track`}
            action={
              <span className="font-label text-[0.6rem] uppercase tabular-nums tracking-[0.12em] text-muted">
                {track.taskCount === 0
                  ? "no tasks yet"
                  : `${track.completedCount} / ${track.taskCount} today`}
              </span>
            }
          >
            <InlineCreateForm
              action={addTopic}
              label="Topic name"
              placeholder="e.g. Arrays, Graphs, Present tense"
            />

            {track.topics.length === 0 ? (
              <p className="py-8 text-sm text-muted">
                No topics yet. A Topic is one area inside this track, like Arrays inside
                DSA.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border border-t border-border">
                {track.topics.map((topic) => (
                  <TopicRow key={topic.id} topic={topic} trackId={track.id} />
                ))}
              </ul>
            )}
          </Panel>

          <Panel label="Today" sublabel="checked in">
            <div className="py-2">
              <ProgressRing
                completed={track.completedCount}
                total={track.taskCount}
                label={`${track.name} checked in today`}
              />
            </div>
          </Panel>

          <Panel label="Consistency" sublabel="12 weeks">
            <StreakHeatmap countsByDay={track.countsByDay} scope={track.name} />
          </Panel>
        </div>
      </div>
    </CheckInBeatProvider>
  );
}
