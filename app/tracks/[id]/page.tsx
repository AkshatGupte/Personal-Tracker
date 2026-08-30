import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Card from "@/components/Card";
import InlineCreateForm from "@/components/InlineCreateForm";
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

      <nav aria-label="Breadcrumb" className="mb-4">
        <Link
          href="/"
          className="rounded-lg text-sm text-muted transition-colors hover:text-fg"
        >
          &larr; All tracks
        </Link>
      </nav>

      {/* Overview and terrain together: the track and how far it has risen. */}
      <section className="mb-5" aria-labelledby="track-heading">
        <div className="card-lit overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-center">
            <div>
              <h1 id="track-heading" className="text-3xl font-extrabold tracking-tight">
                {track.name}
              </h1>

              <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
                <div>
                  <dt className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">
                    Elevation
                  </dt>
                  <dd className="tabular mt-1 text-2xl font-extrabold">{track.terrain.peak}</dd>
                </div>
                <div>
                  <dt className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">
                    Streak
                  </dt>
                  {/* Ember marks real achievement, so a zero streak stays muted. */}
                  <dd
                    className={`tabular mt-1 text-2xl font-extrabold ${
                      track.currentStreak > 0 ? "text-streak" : "text-muted"
                    }`}
                  >
                    {track.currentStreak}
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">
                    Longest
                  </dt>
                  <dd className="tabular mt-1 text-2xl font-extrabold">
                    {track.longestStreak}
                  </dd>
                </div>
              </dl>
            </div>

            <TerrainProfile
              id={track.id}
              terrain={track.terrain}
              scope={track.name}
              height="h-40 sm:h-48"
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <Card title="Topics" delay={0}>
          <InlineCreateForm
            action={addTopic}
            label="Topic name"
            placeholder="e.g. Arrays, Graphs, Present tense"
          />

          {track.topics.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              No topics yet. A Topic is one area inside this track, like Arrays inside
              DSA.
            </p>
          ) : (
            <ul className="-mx-5 mt-4 divide-y divide-border border-t border-border">
              {track.topics.map((topic) => (
                <TopicRow key={topic.id} topic={topic} trackId={track.id} />
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Card title="Completion" delay={1}>
            <div className="py-2">
              <ProgressRing
                completed={track.completedCount}
                total={track.taskCount}
                label={`${track.name} completion`}
              />
            </div>
          </Card>

          <Card title="Consistency" delay={2}>
            <StreakHeatmap countsByDay={track.countsByDay} scope={track.name} />
          </Card>
        </div>
      </div>
    </div>
  );
}
