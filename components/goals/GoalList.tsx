"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Panel from "@/components/Panel";
import { ThreadVoid } from "@/components/spiderverse/Threads";
import { displayStatus, type GoalDisplayStatus, type GoalRow } from "@/lib/goals";
import GoalCard from "./GoalCard";
import { GoalBanner, SparkBurst } from "./GoalReward";
import { useReducedMotion } from "@/components/spiderverse/useReducedMotion";

type Filter = "all" | GoalDisplayStatus;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "expired", label: "Expired" },
  { key: "archived", label: "Archived" },
];

const longDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/**
 * The goals themselves, filtered.
 *
 * **Completed goals are never removed, only filtered.** They are the evidence
 * the dashboard's completion rate is built on, and a history that quietly drops
 * what it counted cannot be checked. Archived is a separate filter from
 * completed for the same reason — abandoning a goal and meeting one are
 * different outcomes and must not be told the same way.
 *
 * Ordering puts what needs attention first: active goals by nearest deadline,
 * then expired, then completed newest first, then archived. The reader's
 * question on opening this screen is "what needs doing", not "what happened".
 */
export default function GoalList({ goals }: { goals: GoalRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  /*
    The completion beat lives here, not on the card.

    A completed goal leaves the active list for the compact history below, so
    the card that fired the write is unmounted by the revalidation that follows
    it — and with it any banner or particle burst it was holding. Hoisting the
    moment to the list, which does not unmount, is what lets the biggest
    celebration in the feature actually finish playing.

    It clears itself on a timer rather than on an animation event: the burst is
    many elements with staggered durations, and under reduced motion it renders
    nothing at all and would therefore never fire one.
  */
  const [party, setParty] = useState<{ title: string; xp: number; fire: number } | null>(null);
  const reduced = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!party) return;
    timer.current = setTimeout(() => setParty(null), reduced ? 2600 : 3200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [party, reduced]);

  const decorated = useMemo(
    () => goals.map((goal) => ({ goal, status: displayStatus(goal) })),
    [goals],
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: decorated.length };
    for (const { status } of decorated) map[status] = (map[status] ?? 0) + 1;
    return map;
  }, [decorated]);

  const rank: Record<GoalDisplayStatus, number> = {
    active: 0,
    expired: 1,
    completed: 2,
    archived: 3,
  };

  const shown = decorated
    .filter(({ status }) => filter === "all" || status === filter)
    .sort((a, b) => {
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      if (a.status === "completed") {
        return (b.goal.completedAt?.getTime() ?? 0) - (a.goal.completedAt?.getTime() ?? 0);
      }
      return a.goal.deadline.getTime() - b.goal.deadline.getTime();
    });

  const completed = shown.filter((s) => s.status === "completed");
  const rest = shown.filter((s) => s.status !== "completed");

  return (
    <div className="relative">
      {/*
        The completion overlay. Deliberately over the whole list rather than one
        card: a goal completing is the loudest thing this screen does, and by the
        time it fires the card it came from may already have moved.
      */}
      {party && (
        <div
          className={`pointer-events-none absolute inset-0 z-30 flex items-start justify-center pt-10 ${
            reduced ? "" : "sv-goal-complete"
          }`}
        >
          <SparkBurst seed={party.fire % 100000} />
          <GoalBanner
            label={`Goal complete · ${party.title}`}
            xp={party.xp}
            tone="complete"
            fire={party.fire}
          />
        </div>
      )}
    <>
      {/*
        The filters sit above the panel, not in its gutter `action` slot.

        That slot is a narrow column beside the label — right for a single count
        like "2 / 15 today", and far too narrow for five buttons, which stacked
        vertically and landed on top of the label itself.
      */}
      <div
        role="group"
        aria-label="Filter goals by status"
        className="mb-2 flex flex-wrap gap-1"
      >
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`rounded-none px-2.5 py-1 font-label text-[0.75rem] uppercase tracking-[0.12em] transition-colors ${
              filter === f.key
                ? "bg-sv-yellow text-sv-ink"
                : "border border-border text-muted hover:border-border-interactive hover:text-fg"
            }`}
          >
            {f.label}
            <span className="ml-1 tabular-nums opacity-70">{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>

    <Panel label="Goals" sublabel={`${counts.active ?? 0} active`}>
      {shown.length === 0 ? (
        <ThreadVoid
          size={112}
          seed={0x60a1}
          label={
            filter === "all"
              ? "No goals yet. A goal is a target with a deadline — the tracks are for the work that never finishes, this is for the things that do."
              : `Nothing ${filter} right now.`
          }
        />
      ) : (
        <>
          <ul className="grid gap-3">
            {rest.map(({ goal }) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onComplete={(done, xp) =>
                  setParty({ title: done.title, xp, fire: Date.now() })
                }
              />
            ))}
          </ul>

          {completed.length > 0 && (
            <>
              {rest.length > 0 && (
                <p className="mt-6 font-label text-[0.75rem] uppercase tracking-[0.14em] text-streak">
                  Completed goals
                </p>
              )}
              <ul className="mt-2 grid gap-2">
                {completed.map(({ goal }) => (
                  <li
                    key={goal.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t px-1 py-2"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span className="text-streak" aria-hidden="true">
                      ✓
                    </span>
                    <span className="min-w-0 text-sm">{goal.title}</span>
                    <span className="font-label text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
                      {goal.category} · {Math.round(goal.currentProgress)}/{goal.target} {goal.unit}
                    </span>
                    <span className="ml-auto font-label text-[0.6875rem] uppercase tracking-[0.12em] text-muted tabular-nums">
                      {goal.completedAt ? `Completed ${longDate(goal.completedAt)}` : "Completed"}
                      <span className="ml-2 text-streak">{goal.xp} XP</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Panel>
    </>
    </div>
  );
}
