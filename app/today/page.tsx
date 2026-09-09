import Link from "next/link";
import FocusList from "@/components/review/FocusList";
import GoalPeriodRow from "@/components/review/GoalPeriodRow";
import Panel from "@/components/Panel";
import TopNav from "@/components/TopNav";
import { GlitchText } from "@/components/spiderverse/GlitchText";
import { ThreadDivider } from "@/components/spiderverse/Threads";
import { getReview } from "@/lib/reviewReads";
import { todayHeadline } from "@/lib/review";
import { STREAK_STATE_COPY } from "@/lib/streak";

/**
 * Today — the screen you open to decide what to do now.
 *
 * The second half of one feature: `/review` explains what happened, this turns
 * it into an action. Both read from `getReview`, so the two cannot disagree
 * about a single figure or a single judgement.
 *
 * **Deliberately not another statistics page.** The first thing on it is the
 * ranked list of things to do, and the numbers come after — inverted from
 * `/progress`, which is the numbers and nothing else. The strongest honest pull
 * the app has is "this streak is alive and will end tonight", and that is a pure
 * description of existing state: no freeze, no forgiveness, no reward.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Today · Rendred" };

export default async function TodayPage() {
  const review = await getReview();
  const { atRisk, held, tracks, goals, focus, activitiesToday, workedLeavesToday, totalLeaves } =
    review;

  /* In flight now: active periods due today or within the week, nearest first.
     Recurring series need no special case — a period is a Goal. */
  const inFlight = goals
    .filter((goal) => goal.display === "active")
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 6);

  const workedTracks = tracks.filter((track) => track.workedToday > 0);

  /*
    The roster, ordered by what needs attention — the same principle as Focus,
    so the two lists on this screen do not disagree about priority. Unrenewed
    first, then held, then everything without a live run; ties by name so the
    order is stable between renders rather than following creation order.
  */
  const STATE_RANK = { atRisk: 0, held: 1, lapsed: 2, none: 3 } as const;
  const roster = [...tracks].sort(
    (a, b) =>
      STATE_RANK[a.streakState] - STATE_RANK[b.streakState] ||
      b.streak - a.streak ||
      a.name.localeCompare(b.name),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
      <TopNav />

      <h1 className="sr-only">Today</h1>

      {/*
        The screen's single comic panel, spent on the thing that expires today.

        `Panel`'s rule is one comic register per screen, and this is the level
        that should dominate: everything else here is a band.
      */}
      <Panel variant="comic" accent={atRisk.length > 0 ? "yellow" : "cyan"}>
        <section aria-labelledby="today-heading" className="py-1">
          <h2
            id="today-heading"
            className="font-label text-[0.75rem] uppercase tracking-[0.17em] text-muted"
          >
            <GlitchText text="Today" intensity="subtle" trigger="auto" baseColor="var(--muted)" />
          </h2>

          <p className="mt-2 max-w-[46ch] font-display text-2xl leading-tight text-balance">
            {todayHeadline(activitiesToday, atRisk.length)}
          </p>

          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <dt className="font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted">
                Activities
              </dt>
              <dd className="font-mono text-2xl leading-none tabular-nums">{activitiesToday}</dd>
            </div>
            <div>
              <dt className="font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted">
                Leaves worked
              </dt>
              <dd className="font-mono text-2xl leading-none tabular-nums">
                {workedLeavesToday}
                <span className="text-base text-muted">{` / ${totalLeaves}`}</span>
              </dd>
            </div>
            <div>
              <dt className="font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted">
                Streaks held
              </dt>
              <dd className="font-mono text-2xl leading-none tabular-nums text-positive">
                {held.length}
              </dd>
            </div>
            {atRisk.length > 0 && (
              <div>
                <dt className="font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted">
                  To renew
                </dt>
                <dd className="font-mono text-2xl leading-none tabular-nums text-streak">
                  {atRisk.length}
                </dd>
              </div>
            )}
          </dl>
        </section>
      </Panel>

      {/* The list first, the figures after. This is the difference between a
          screen you act on and a screen you read. */}
      <Panel label="Do next" sublabel={focus.length > 0 ? `${focus.length} waiting` : undefined}>
        <FocusList
          items={focus}
          limit={5}
          empty="Nothing is slipping. Work whatever you feel like — the tracker is open."
        />
      </Panel>

      <ThreadDivider seed={0x70d1} />

      <Panel label="Streaks" sublabel={`${held.length} held today`}>
        {tracks.length === 0 ? (
          <p className="py-2 text-sm leading-relaxed text-muted">
            No tracks yet. <Link href="/" className="text-fg underline decoration-dotted">Make one</Link> and
            the first thing you record starts a streak.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {roster.map((track) => {
              /* Cyan = worked today, yellow = a consistency signal, muted =
                 neither. The same three signals the rest of the app uses, and
                 never red: an unrenewed streak is not a failure state. */
              const tone =
                track.streakState === "held"
                  ? "var(--positive)"
                  : track.streakState === "atRisk"
                    ? "var(--streak)"
                    : "var(--muted)";
              return (
                <li
                  key={track.id}
                  className="sv-row -mx-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-2 py-2.5"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="min-w-0 text-sm">{track.name}</span>
                    {/* Stated in words as well as coloured. */}
                    <span
                      className="font-label text-[0.6875rem] uppercase tracking-[0.12em]"
                      style={{ color: tone }}
                    >
                      {STREAK_STATE_COPY[track.streakState]}
                      <span className="text-muted">
                        {` · ${track.workedToday} of ${track.leafCount} worked today`}
                      </span>
                    </span>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-3">
                    <span className="font-mono text-sm tabular-nums" style={{ color: tone }}>
                      {track.streak}
                      <span className="text-muted">{track.streak === 1 ? " day" : " days"}</span>
                    </span>
                    <Link
                      href={`/tracks/${track.id}`}
                      className="font-label text-[0.75rem] uppercase tracking-[0.12em] text-muted transition-colors hover:text-fg"
                    >
                      Work it &rarr;
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel label="Goals" sublabel={inFlight.length > 0 ? "in flight" : undefined}>
        {inFlight.length === 0 ? (
          <p className="py-2 text-sm leading-relaxed text-muted">
            Nothing in flight.{" "}
            <Link href="/goals" className="text-fg underline decoration-dotted">
              Set a goal
            </Link>{" "}
            if there is something with a deadline; tracks are for the work that never finishes.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {inFlight.map((goal) => (
              <GoalPeriodRow key={goal.id} goal={goal} />
            ))}
          </ul>
        )}
      </Panel>

      {workedTracks.length > 0 && (
        <Panel label="Done today" sublabel={`${workedTracks.length} track${workedTracks.length === 1 ? "" : "s"}`}>
          <ul className="divide-y divide-border">
            {workedTracks.map((track) => (
              <li
                key={track.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2"
              >
                <span className="min-w-0 text-sm">{track.name}</span>
                <span className="font-label text-[0.6875rem] uppercase tracking-[0.12em] text-positive tabular-nums">
                  {track.workedToday} of {track.leafCount} leaves
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* The hand-off, stated as the question the other screen answers. */}
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Wondering how the week has gone?{" "}
        <Link href="/review" className="text-fg underline decoration-dotted">
          The weekly review
        </Link>{" "}
        has the retrospective.
      </p>
    </div>
  );
}
