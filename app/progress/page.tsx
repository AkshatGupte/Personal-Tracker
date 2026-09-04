import Link from "next/link";
import type { Metadata } from "next";
import Panel from "@/components/Panel";
import TopNav from "@/components/TopNav";
import WeekStrip from "@/components/WeekStrip";
import { getWeeklyProgress, SUMMARY_WEEKS } from "@/lib/progress";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Progress · Rendred",
  description: "Week by week, what was actually completed.",
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

export default async function ProgressPage() {
  const { weeks, current, currentDays, tracks, hasAnyHistory } = await getWeeklyProgress();
  const past = [...weeks].reverse();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <TopNav />

      {/*
        This week, stated plainly. Two figures rather than one: how much was
        finished, and how many days it was spread across — the same total in a
        single sitting and across five days are not the same week.
      */}
      <section
        className="grid grid-cols-1 items-stretch gap-4 border-b border-border pb-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-8"
        aria-labelledby="week-heading"
      >
        <div className="flex flex-col justify-center gap-5 py-2">
          <div>
            <h1
              id="week-heading"
              className="font-label text-[0.6rem] uppercase tracking-[0.17em] text-muted"
            >
              This week
            </h1>
            <p className="mt-2 font-mono text-5xl font-medium leading-none tracking-tight tabular-nums">
              {current.completed}
            </p>
          </div>

          <p className="max-w-[34ch] text-sm leading-relaxed text-muted">
            {current.completed === 0
              ? hasAnyHistory
                ? "tasks completed since Monday. The week is still open."
                : "tasks completed. Nothing has been logged yet — finish a task and this fills in."
              : current.elapsedDays === 1
                ? "tasks completed since Monday. The week has only just begun."
                : `tasks completed since Monday, across ${current.activeDays} of ${current.elapsedDays} days so far.`}
          </p>

          <p className="font-label text-[0.6rem] uppercase tracking-[0.14em] tabular-nums text-muted">
            {formatWeek(current.start, current.endExclusive)} · Mon–Sun
          </p>
        </div>

        <div className="flex items-end pb-2">
          <WeekStrip days={currentDays} scope="All tracks" />
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
          sublabel="this week"
          action={
            <span className="font-label text-[0.6rem] font-bold uppercase tabular-nums tracking-[0.12em]">
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
              and its weeks will show up here.
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
                    <p className="mt-1 font-label text-[0.6rem] uppercase tracking-[0.12em] tabular-nums text-muted">
                      {track.completed === 0 ? (
                        track.everActive ? (
                          "nothing this week"
                        ) : (
                          "no completions yet"
                        )
                      ) : (
                        <>
                          <span className="text-fg">{track.activeDays}</span>
                          {track.activeDays === 1 ? " day" : " days"} active
                        </>
                      )}
                      {track.currentStreak > 0 && (
                        <>
                          {" · "}
                          <span className="text-streak">{track.currentStreak} day</span> streak
                        </>
                      )}
                    </p>
                  </div>

                  <p className="justify-self-end font-label text-lg leading-none tabular-nums text-muted">
                    <span className={track.completed > 0 ? "text-fg" : undefined}>
                      {track.completed}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel label="By week" sublabel={`last ${SUMMARY_WEEKS}`}>
          {!hasAnyHistory ? (
            <p className="py-8 text-sm text-muted">
              No weeks to summarise yet. Completing a task records the day it happened,
              and the weeks build up from there.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border border-t border-border">
              {past.map((week) => (
                <li
                  key={week.key}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-3"
                >
                  <p className="font-label text-[0.65rem] uppercase tracking-[0.12em] tabular-nums">
                    <span className={week.isCurrent ? "text-fg" : "text-muted"}>
                      {formatWeek(week.start, week.endExclusive)}
                    </span>
                    {week.isCurrent && (
                      // The space matters: without it a screen reader reads
                      // "6 SeptThis week" as one word.
                      <> <span className="text-[0.55rem] text-muted">this week</span></>
                    )}
                  </p>
                  <p className="font-label text-[0.65rem] uppercase tracking-[0.12em] tabular-nums text-muted">
                    {week.completed === 0 ? (
                      "no activity"
                    ) : (
                      <>
                        <span className="text-fg">{week.completed}</span>
                        {week.completed === 1 ? " task" : " tasks"} ·{" "}
                        <span className="text-fg">{week.activeDays}</span>/{week.elapsedDays} days
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
