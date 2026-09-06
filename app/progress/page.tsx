import Link from "next/link";
import type { Metadata } from "next";
import Panel from "@/components/Panel";
import PeriodStrip from "@/components/PeriodStrip";
import TopNav from "@/components/TopNav";
import {
  getPeriodProgress,
  SUMMARY_MONTHS,
  SUMMARY_WEEKS,
  type Period,
} from "@/lib/progress";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Progress · Rendred",
  description: "Week by week and month by month, what was actually completed.",
};

/**
 * The window is a URL parameter rather than component state.
 *
 * It keeps this page a server component — the switch is two links, so there is
 * no client bundle, no hydration and nothing to keep in sync — and it makes a
 * window shareable and reloadable, which state in a `useState` is not. Anything
 * that is not exactly "month" falls back to weeks, so a hand-edited URL cannot
 * produce a broken page.
 */
function readPeriod(value: string | string[] | undefined): Period {
  return value === "month" ? "month" : "week";
}

const COPY: Record<Period, { noun: string; heading: string; since: string; listLabel: string; count: number }> = {
  week: {
    noun: "week",
    heading: "This week",
    since: "since Monday",
    listLabel: "By week",
    count: SUMMARY_WEEKS,
  },
  month: {
    noun: "month",
    heading: "This month",
    since: "so far this month",
    listLabel: "By month",
    count: SUMMARY_MONTHS,
  },
};

/** "25–31 Aug", or "31 Aug – 6 Sep" when the week straddles a month. */
function formatWeek(start: Date, endExclusive: Date): string {
  const end = new Date(endExclusive.getTime() - 86_400_000);
  const day = (d: Date) => d.getDate();
  const month = (d: Date) => d.toLocaleString("en-GB", { month: "short" });
  return start.getMonth() === end.getMonth()
    ? `${day(start)}–${day(end)} ${month(end)}`
    : `${day(start)} ${month(start)} – ${day(end)} ${month(end)}`;
}

/** "Sep 2026". The year is always shown: six months back can cross one. */
function formatMonth(start: Date): string {
  return start.toLocaleString("en-GB", { month: "short", year: "numeric" });
}

function formatPeriod(period: Period, start: Date, endExclusive: Date): string {
  return period === "month" ? formatMonth(start) : formatWeek(start, endExclusive);
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const period = readPeriod((await searchParams).period);
  const copy = COPY[period];
  const { periods, current, currentDays, tracks, hasAnyHistory } =
    await getPeriodProgress(period);
  const past = [...periods].reverse();

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
      <TopNav />

      {/* The page's name, for the heading outline only — see Home. */}
      <h1 className="sr-only">Progress</h1>

      {/*
        The window switch sits above the figure it changes, in the section-label
        voice rather than as buttons: it selects what is being read, the way the
        top navigation selects a section, and it is not an action that changes
        anything.
      */}
      <nav aria-label="Summary window" className="pt-1">
        <ul className="flex items-center gap-4 font-label text-[0.75rem] uppercase tracking-[0.15em]">
          {(["week", "month"] as const).map((option) => {
            const active = option === period;
            return (
              <li key={option}>
                <Link
                  href={option === "week" ? "/progress" : "/progress?period=month"}
                  /* `true`, not `page`: this selects a window within the
                     section, and the top nav's Progress link is already the
                     page. Both claiming `page` is the duplicate. */
                  aria-current={active ? "true" : undefined}
                  className={
                    active
                      ? "border-b-2 border-sv-yellow pb-0.5 text-fg"
                      : "text-muted transition-colors hover:text-sv-cyan"
                  }
                >
                  {option === "week" ? "Weekly" : "Monthly"}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/*
        The current period, stated plainly. Two figures rather than one: how much
        was finished, and how many days it was spread across — the same total in
        a single sitting and across five days are not the same period.
      */}
      <section
        className="grid grid-cols-1 items-stretch gap-3 border-b border-border pb-5 pt-3 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-8"
        aria-labelledby="period-heading"
      >
        <div className="flex flex-col justify-center gap-4">
          <div>
            {/* Demoted from `h1` — see the note on Home. This is the caption
                of the figure beside it, not the name of the page. */}
            <h2
              id="period-heading"
              className="font-label text-[0.75rem] uppercase tracking-[0.17em] text-muted"
            >
              {copy.heading}
            </h2>
            <p className="mt-2 font-mono text-5xl font-medium leading-none tracking-tight tabular-nums">
              {current.completed}
            </p>
          </div>

          <p className="max-w-[34ch] text-sm leading-relaxed text-muted">
            {current.completed === 0
              ? hasAnyHistory
                ? `activities ${copy.since}. The ${copy.noun} is still open.`
                : "activities. Nothing has been logged yet — work a topic and this fills in."
              : current.elapsedDays === 1
                ? `activities ${copy.since}. The ${copy.noun} has only just begun.`
                : /*
                     5.5: the denominator is *elapsed* days and never said so.
                     It read "across 1 of 6 days", which invites reading 6 as
                     the length of the period — a week has seven and a month has
                     thirty. "Elapsed" is the whole correction, and it is said
                     once: `copy.since` already carries "so far this month", so
                     repeating it here produced "so far this month, ... so far
                     this month".
                   */
                  `activities ${copy.since}, on ${current.activeDays} of the ${current.elapsedDays} days elapsed.`}
          </p>

          <p className="font-label text-[0.75rem] uppercase tracking-[0.14em] tabular-nums text-muted">
            {formatPeriod(period, current.start, current.endExclusive)}
            {period === "week" && " · Mon–Sun"}
          </p>
        </div>

        <div className="flex items-center">
          <PeriodStrip days={currentDays} scope="All tracks" label={copy.noun} />
        </div>
      </section>

      <div className="divide-y divide-border">
        {/* The same surface as Home's Tracks panel, in the same register. This
            route carried no comic panel at all, which made it read as a
            different application; the comic variant is still spent exactly
            once here, on the level that dominates the screen. */}
        <Panel
          variant="comic"
          accent="magenta"
          label="Tracks"
          sublabel={`this ${copy.noun}`}
          action={
            <span className="font-label text-[0.75rem] font-bold uppercase tabular-nums tracking-[0.12em]">
              {tracks.length === 0 ? "none yet" : `${tracks.length} total`}
            </span>
          }
        >
          {tracks.length === 0 ? (
            <p className="py-8 text-sm text-muted">
              No tracks yet.{" "}
              <Link href="/" className="rounded-none text-fg underline underline-offset-4">
                Create one
              </Link>{" "}
              and its {copy.noun}s will show up here.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border border-t-2 border-sv-magenta/40">
              {tracks.map((track) => (
                <li
                  key={track.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-4"
                >
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-2xl leading-tight tracking-tight">
                      <Link
                        href={`/tracks/${track.id}`}
                        className="rounded-none transition-colors hover:text-accent"
                      >
                        {track.name}
                      </Link>
                    </h3>
                    <p className="mt-1 font-label text-[0.75rem] uppercase tracking-[0.12em] tabular-nums text-muted">
                      {track.completed === 0 ? (
                        track.everActive ? (
                          `nothing this ${copy.noun}`
                        ) : (
                          <span className="sv-status">no activity yet</span>
                        )
                      ) : (
                        <>
                          <span className="text-fg">{track.activeDays}</span>
                          {track.activeDays === 1 ? " day" : " days"} this {copy.noun}
                        </>
                      )}
                      {track.currentStreak > 0 && (
                        <>
                          {" · "}
                          <span className="text-streak">
                            {track.currentStreak} day
                          </span>{" "}
                          streak now
                        </>
                      )}
                      {track.longestStreak > 0 && (
                        <>
                          {" · "}
                          longest streak {track.longestStreak}
                        </>
                      )}
                      {track.totalActiveDays > 0 && (
                        <>
                          {" · "}
                          {track.totalActiveDays} active {track.totalActiveDays === 1 ? "day" : "days"} in
                          all
                        </>
                      )}
                    </p>
                  </div>

                  {/*
                    Today's coverage, not the period's volume. The number to its
                    left already carries volume for the period; this answers the
                    other question the new model can ask — how much of the track
                    was touched — and the two are deliberately different signals.
                  */}
                  {/*
                    5.4: the big figure was bare.

                    It rendered as `52`, `8`, `0` with `51% TODAY` under it at
                    8.8px — two numbers, neither of them saying what it counts,
                    and the smaller one carrying all the meaning. The figure now
                    names its own unit on the line beneath it, in the same
                    "worked today" vocabulary the rest of the app uses.
                  */}
                  <div className="justify-self-end text-right">
                    <p className="font-label text-lg leading-none tabular-nums text-muted">
                      <span className={track.completed > 0 ? "text-fg" : undefined}>
                        {track.completed}
                      </span>
                    </p>
                    <p className="mt-1 font-label text-[0.75rem] uppercase tracking-[0.12em] tabular-nums text-muted">
                      {track.completed === 1 ? "activity" : "activities"} this {copy.noun}
                    </p>
                    {track.leafCount > 0 && (
                      <p className="font-label text-[0.75rem] uppercase tracking-[0.12em] tabular-nums text-muted">
                        {track.coverage}% worked today
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel label={copy.listLabel} sublabel={`last ${copy.count}`}>
          {!hasAnyHistory ? (
            <p className="py-8 text-sm text-muted">
              No {copy.noun}s to summarise yet. Working a topic records the day it happened,
              and the {copy.noun}s build up from there.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border border-t border-border">
              {past.map((bucket) => (
                <li
                  key={bucket.key}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-3"
                >
                  <p className="font-label text-[0.75rem] uppercase tracking-[0.12em] tabular-nums">
                    <span className={bucket.isCurrent ? "text-fg" : "text-muted"}>
                      {formatPeriod(period, bucket.start, bucket.endExclusive)}
                    </span>
                    {bucket.isCurrent && (
                      // The space matters: without it a screen reader reads
                      // "6 SeptThis week" as one word.
                      <> <span className="text-[0.75rem] text-muted">this {copy.noun}</span></>
                    )}
                  </p>
                  <p className="font-label text-[0.75rem] uppercase tracking-[0.12em] tabular-nums text-muted">
                    {bucket.completed === 0 ? (
                      "no activity"
                    ) : (
                      <>
                        <span className="text-fg">{bucket.completed}</span>
                        {bucket.completed === 1 ? " activity" : " activities"} ·{" "}
                        <span className="text-fg">{bucket.activeDays}</span>/{bucket.elapsedDays} days
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
