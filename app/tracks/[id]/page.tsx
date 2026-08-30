import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import InlineCreateForm from "@/components/InlineCreateForm";
import Panel from "@/components/Panel";
import ProgressRing from "@/components/ProgressRing";
import StreakHeatmap from "@/components/StreakHeatmap";
import TerrainProfile from "@/components/TerrainProfile";
import TopNav from "@/components/TopNav";
import TopicRow from "@/components/TopicRow";
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

/** One measurement in the hero column: mono label, mono numeral. */
function Stat({ label, value, tone }: { label: string; value: number; tone?: "ember" }) {
  return (
    <div>
      <dt className="font-mono text-[0.6rem] uppercase tracking-[0.17em] text-muted">
        {label}
      </dt>
      <dd
        className={`mt-1.5 font-mono text-3xl font-medium leading-none tracking-tight tabular-nums ${
          // Ember marks real achievement, so a zero streak stays muted.
          tone === "ember" ? (value > 0 ? "text-streak" : "text-muted") : "text-fg"
        }`}
      >
        {value}
      </dd>
    </div>
  );
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
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <TopNav />

      <nav aria-label="Breadcrumb" className="mb-5">
        <Link
          href="/"
          className="rounded-[3px] font-mono text-[0.6rem] uppercase tracking-[0.15em] text-muted transition-colors hover:text-fg"
        >
          &larr; All tracks
        </Link>
      </nav>

      {/* The track and how far its ground has risen. */}
      <section
        className="grid grid-cols-1 items-stretch gap-4 border-b border-border pb-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-8"
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
            <Stat label="Elevation" value={track.terrain.peak} />
            <Stat label="Streak" value={track.currentStreak} tone="ember" />
            <Stat label="Longest" value={track.longestStreak} />
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

        <div className="bleed-r min-h-[9rem] lg:min-h-[13rem]">
          <TerrainProfile
            id={track.id}
            terrain={track.terrain}
            scope={track.name}
            height="h-36 sm:h-44 lg:h-full"
            quiet
          />
        </div>
      </section>

      <div className="divide-y divide-border">
        <Panel
          label="Topics"
          sublabel={`${track.topics.length} in track`}
          action={
            <span className="font-mono text-[0.6rem] uppercase tabular-nums tracking-[0.12em] text-muted">
              {track.taskCount === 0
                ? "no tasks yet"
                : `${track.completedCount} / ${track.taskCount} done`}
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

        <Panel label="Completion" sublabel="live task state">
          <div className="py-2">
            <ProgressRing
              completed={track.completedCount}
              total={track.taskCount}
              label={`${track.name} completion`}
            />
          </div>
        </Panel>

        <Panel label="Consistency" sublabel="12 weeks">
          <StreakHeatmap countsByDay={track.countsByDay} scope={track.name} />
        </Panel>
      </div>
    </div>
  );
}
