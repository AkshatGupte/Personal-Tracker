import Link from "next/link";
import FocusList from "@/components/review/FocusList";
import GoalPeriodRow from "@/components/review/GoalPeriodRow";
import Panel from "@/components/Panel";
import TopNav from "@/components/TopNav";
import { GlitchText } from "@/components/spiderverse/GlitchText";
import { ThreadDivider } from "@/components/spiderverse/Threads";
import { getReview } from "@/lib/reviewReads";
import { reviewHeadline } from "@/lib/review";
import { STREAK_STATE_COPY } from "@/lib/streak";

/**
 * The weekly review — what happened, and what slipped.
 *
 * The first half of one feature: this explains the week, `/today` turns it into
 * an action. Both read from `getReview`, which composes the three reads that
 * already existed and adds no statistic of its own.
 *
 * **Not a dashboard.** `/progress` is the numbers and the charts and is
 * unchanged; this is the five questions a week actually raises — what did I do,
 * what did I miss, how much progress, what is slipping, what next — answered in
 * sentences, with the last one handing over to Today.
 *
 * **The window is printed.** The project has two definitions of "this week" and
 * they are different spans; this screen names the one it means so there is
 * nothing to reconcile. See `windowFrom`.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Weekly review · Rendred" };

export default async function ReviewPage() {
  const review = await getReview();
  const { window, momentum, tracks, focus, periods, days, hasAnyHistory } = review;

  const worked = tracks.filter((t) => t.weekActivities > 0);
  const untouched = tracks.filter((t) => t.weekActivities === 0);
  /*
    What "slipped" is what this section actually lists: a track with nothing
    recorded this week, and a goal period that expired unmet in it.

    **An at-risk streak is deliberately not counted here.** It has not slipped —
    it is alive, and it is a *today* concern, so it belongs in Focus and on
    Today. A first version counted it in this heading and listed only the
    untouched tracks below, so the count said 2 and one row appeared.
  */
  const slipped = untouched.length + periods.missed.length;
  const activeDaysThisWeek = days.filter((d) => d.count > 0).length;
  const dueThisWeek = periods.met.length + periods.missed.length + periods.open.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
      <TopNav />

      <h1 className="sr-only">Weekly review</h1>

      {/* The one comic panel: how much, and honestly against last week. */}
      <Panel variant="comic" accent="magenta">
        <section aria-labelledby="review-heading" className="py-1">
          <h2
            id="review-heading"
            className="font-label text-[0.75rem] uppercase tracking-[0.17em] text-muted"
          >
            <GlitchText
              text="This week"
              intensity="subtle"
              trigger="auto"
              baseColor="var(--muted)"
            />
            {/* The exact span, because two different windows in this app both
                answer to the name "this week". */}
            <span className="ml-2 tracking-[0.1em] text-muted">{window.label}</span>
          </h2>

          <p className="mt-2 max-w-[52ch] font-display text-2xl leading-tight text-balance">
            {reviewHeadline(momentum, worked.length, periods.met.length)}
          </p>

          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <dt className="font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted">
                Activities
              </dt>
              <dd className="font-mono text-3xl leading-none tabular-nums">{momentum.thisWeek}</dd>
            </div>
            <div>
              <dt className="font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted">
                Last week
              </dt>
              <dd className="font-mono text-3xl leading-none tabular-nums text-muted">
                {momentum.lastWeek}
              </dd>
            </div>
            <div>
              <dt className="font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted">
                Active days
              </dt>
              <dd className="font-mono text-3xl leading-none tabular-nums">
                {activeDaysThisWeek}
                <span className="text-base text-muted">{` / ${momentum.elapsedDays}`}</span>
              </dd>
            </div>
          </dl>

          {/* Bursty or spread? A sentence, not a sparkline — the week is at most
              seven points and a chart of seven points says less than the words. */}
          {momentum.thisWeek > 0 && (
            <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-muted">
              {activeDaysThisWeek === momentum.elapsedDays
                ? "Something recorded every day so far this week."
                : activeDaysThisWeek === 1
                  ? "All of it on one day."
                  : `Spread over ${activeDaysThisWeek} of ${momentum.elapsedDays} days.`}
            </p>
          )}
        </section>
      </Panel>

      <Panel label="What you did" sublabel={`${worked.length} track${worked.length === 1 ? "" : "s"}`}>
        {worked.length === 0 ? (
          <p className="py-2 text-sm leading-relaxed text-muted">
            {hasAnyHistory
              ? "Nothing recorded this week. The week is not a verdict — pick one thing and the next one starts from there."
              : "Nothing recorded yet, anywhere. Add a topic to a track and work it once; this page becomes useful immediately after."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {worked
              .slice()
              .sort((a, b) => b.weekActivities - a.weekActivities)
              .map((track) => (
                <li
                  key={track.id}
                  className="sv-row -mx-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-2 py-2.5"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="min-w-0 text-sm">{track.name}</span>
                    <span className="font-label text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
                      {`${track.weekActiveDays} active day${track.weekActiveDays === 1 ? "" : "s"} · streak ${track.streak}`}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-sm tabular-nums text-accent">
                    {track.weekActivities}
                    <span className="text-muted">
                      {track.weekActivities === 1 ? " activity" : " activities"}
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        )}
      </Panel>

      <ThreadDivider seed={0x51e2} />

      {/* The actionable half of a retrospective. Muted and yellow, never red —
          a missed week is a description, not a failure state. */}
      <Panel label="What slipped" sublabel={slipped > 0 ? `${slipped}` : "nothing"}>
        {slipped === 0 ? (
          <p className="py-2 text-sm leading-relaxed text-muted">
            {/* Vacuously true is still a lie. With no tracks at all, "every
                track was worked" reads as a claim about work that never
                happened. */}
            {tracks.length === 0
              ? "Nothing to slip yet — there are no tracks to fall behind on."
              : "Nothing slipped. Every track was worked this week and no goal period was missed."}
          </p>
        ) : (
          <>
            {untouched.length > 0 && (
              <ul className="divide-y divide-border">
                {untouched.map((track) => (
                  <li
                    key={track.id}
                    className="sv-row -mx-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-2 py-2.5"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="min-w-0 text-sm">{track.name}</span>
                      <span className="font-label text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
                        {track.everActive
                          ? "nothing this week"
                          : track.leafCount === 0
                            ? "no topics yet"
                            : "never worked"}
                        {track.streakState === "atRisk" && (
                          <span className="text-streak">{` · ${STREAK_STATE_COPY.atRisk.toLowerCase()}`}</span>
                        )}
                      </span>
                    </div>
                    <Link
                      href={`/tracks/${track.id}`}
                      className="shrink-0 font-label text-[0.75rem] uppercase tracking-[0.12em] text-muted transition-colors hover:text-fg"
                    >
                      Open &rarr;
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {periods.missed.length > 0 && (
              <>
                <p className="mt-4 font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted">
                  Goal periods missed
                </p>
                <ul className="mt-1 divide-y divide-border">
                  {periods.missed.map((goal) => (
                    <GoalPeriodRow key={goal.id} goal={goal} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </Panel>

      {/*
        Goals due in this window, as individual periods.

        A recurring goal contributes whichever of its periods fell in this week —
        usually one — because a period *is* a Goal row with its own deadline.
        Nothing is aggregated behind the model's back: the series figures on each
        row are derived from the rows themselves.
      */}
      <Panel
        label="Goals this week"
        sublabel={dueThisWeek > 0 ? `${dueThisWeek} due` : undefined}
      >
        {dueThisWeek === 0 ? (
          <p className="py-2 text-sm leading-relaxed text-muted">
            No goal was due this week.{" "}
            <Link href="/goals" className="text-fg underline decoration-dotted">
              A goal
            </Link>{" "}
            is a target with a deadline — and one that repeats will show up here every week on its
            own.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {[...periods.open, ...periods.met, ...periods.missed].map((goal) => (
              <GoalPeriodRow key={goal.id} goal={goal} />
            ))}
          </ul>
        )}
      </Panel>

      <ThreadDivider seed={0x9a3c} />

      {/* The hand-off. Same list Today opens with, so the two screens agree. */}
      <Panel label="Focus next" sublabel={focus.length > 0 ? `${focus.length}` : undefined}>
        <FocusList
          items={focus}
          empty="Nothing is slipping and nothing is due. A good week to add ground rather than hold it."
        />
        <p className="mt-4 text-sm leading-relaxed text-muted">
          <Link href="/today" className="text-fg underline decoration-dotted">
            Today
          </Link>{" "}
          has the same list, shortest first, beside what is still open right now. The full weekly
          and monthly figures are on{" "}
          <Link href="/progress" className="text-fg underline decoration-dotted">
            Progress
          </Link>
          .
        </p>
      </Panel>
    </div>
  );
}
