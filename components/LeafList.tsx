"use client";

import { useCallback, useState } from "react";
import ActivityCell from "@/components/ActivityCell";
import TopicControls from "@/components/TopicControls";
import type { DayChoice } from "@/lib/backdate";
import type { TrackNode } from "@/lib/progress";
import { BACKDATE_DAYS } from "@/lib/windows";

/**
 * The flat view: every actionable leaf in the track, in tree order.
 *
 * "Flat" is meant literally, and it is not the old two-level list adapted.
 * That list was Topic → Tasks, which cannot express five levels — a leaf four
 * deep had nowhere to appear. Listing the leaves themselves works at any depth,
 * and it is the view for the question the app is actually used for: what can I
 * work on right now.
 *
 * Each row carries its ancestry as a breadcrumb, because a bare "BFS" is
 * ambiguous the moment two branches both have one, and the breadcrumb is the
 * only thing that distinguishes them once the hierarchy is flattened away.
 *
 * **This view owns the day.** One selector for the whole list rather than a
 * picker per row, because the real shape of backdating is "I missed Sunday and
 * am filling several leaves in", not "this one leaf was actually Sunday" — one
 * chip and then N presses, instead of N pickers. It is a mode, so it is loud,
 * it names its day in words, and it is client state that dies on reload: a mode
 * you can forget you are in is the whole risk, and one that cannot outlive the
 * visit is a much smaller one.
 */
export default function LeafList({
  leaves,
  trackId,
  all,
  days,
}: {
  leaves: TrackNode[];
  trackId: string;
  all: TrackNode[];
  /** The backdating window, derived on the server beside the per-day counts. */
  days: DayChoice[];
}) {
  const todayKey = days[0]?.key ?? "";
  const [day, setDay] = useState(todayKey);
  const [note, setNote] = useState<string | null>(null);
  const [goalNotes, setGoalNotes] = useState<string[]>([]);

  const chosen = days.find((choice) => choice.key === day) ?? days[0];
  const backdating = (chosen?.offset ?? 0) > 0;

  const pickDay = (key: string) => {
    setDay(key);
    // The notes describe the write that produced them, not the day now selected.
    setNote(null);
    setGoalNotes([]);
  };

  /**
   * Roving keys over the rows.
   *
   * Tab alone walks record → undo → rename → add → move → delete before it
   * reaches the next row, which is six presses per leaf on the one screen meant
   * for repetition. Up/down (and j/k) jump between the record buttons, so the
   * whole list is one keystroke per activity once you are in it.
   *
   * Guarded against firing while typing: `TopicControls` swaps a row's buttons
   * for a rename or move form, and an unguarded `u` there would eat a letter
   * out of a topic's new name.
   */
  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement;
    if (target.closest("input, select, textarea, [contenteditable='true']")) return;

    const rows = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-leaf-row]")];
    if (rows.length === 0) return;
    const here = target.closest<HTMLElement>("[data-leaf-row]");
    const index = here ? rows.indexOf(here) : -1;

    const focusRow = (next: number) => {
      const clamped = Math.min(rows.length - 1, Math.max(0, next));
      rows[clamped]?.querySelector<HTMLButtonElement>("[data-leaf-record]")?.focus();
    };

    switch (event.key) {
      case "ArrowDown":
      case "j":
        event.preventDefault();
        focusRow(index + 1);
        return;
      case "ArrowUp":
      case "k":
        event.preventDefault();
        focusRow(index - 1);
        return;
      case "Home":
        event.preventDefault();
        focusRow(0);
        return;
      case "End":
        event.preventDefault();
        focusRow(rows.length - 1);
        return;
      case "u":
      case "U": {
        if (!here) return;
        const undo = here.querySelector<HTMLButtonElement>("[data-leaf-undo]");
        if (!undo || undo.disabled) return;
        event.preventDefault();
        undo.click();
        return;
      }
      default:
    }
  }, []);

  if (leaves.length === 0) {
    return (
      <p className="py-6 text-sm text-muted">
        <span className="sv-status">nothing to work on yet</span> — add a topic, or open the tree
        view to build one out.
      </p>
    );
  }

  return (
    <div>
      {/*
        The day strip.

        Wraps rather than scrolls: seven chips do not fit on one line at 320px,
        and a horizontally scrolling strip hides the far end of the window
        behind a gesture nothing announces.
      */}
      <div
        role="group"
        aria-label={`Record activity for a day in the last ${BACKDATE_DAYS} days`}
        className="mb-2 flex flex-wrap items-center gap-1"
      >
        {days.map((choice) => {
          const active = choice.key === day;
          return (
            <button
              key={choice.key}
              type="button"
              onClick={() => pickDay(choice.key)}
              aria-pressed={active}
              /* The chip's short label is ambiguous read aloud, so the visible
                 text is hidden and `spoken` is announced instead. */
              aria-label={choice.spoken}
              className={`rounded-none px-2 py-1 font-label text-[0.75rem] uppercase tracking-[0.12em] transition-colors ${
                active
                  ? "bg-accent text-sv-ink"
                  : "border border-border text-muted hover:border-border-interactive hover:text-fg"
              }`}
            >
              <span aria-hidden="true">{choice.label}</span>
            </button>
          );
        })}
      </div>

      {/*
        The mode band.

        Magenta, not yellow. CLAUDE.md keeps magenta for volume *and active
        state*, and a mode being on is an active state; yellow already carries
        both consistency and the primary button fill, and this would be a third
        job for it. The day is stated in words as well as coloured — nothing
        essential here is carried by the plate alone.
      */}
      {backdating && chosen && (
        <div
          className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 px-2.5 py-1.5"
          style={{ borderColor: "var(--accent)", background: "var(--surface)" }}
        >
          <span className="font-label text-[0.75rem] uppercase tracking-[0.12em] text-accent">
            Recording for {chosen.full}
          </span>
          <span className="text-sm text-muted">
            Counts and undo on every row below are for that day.
          </span>
          <button
            type="button"
            onClick={() => pickDay(todayKey)}
            className="ml-auto rounded-none border border-border px-2 py-1 font-label text-[0.75rem] uppercase tracking-[0.12em] text-muted transition-colors hover:border-border-interactive hover:text-fg"
          >
            Back to today
          </button>
        </div>
      )}

      {/*
        The streak consequence, stated where it happened.

        A description and not a celebration: no shatter, no banner, no colour
        beyond the consistency plate the streak already uses everywhere else.
        Backdating moves a derived number, and a number that changes silently is
        a number nobody trusts.
      */}
      <div role="status" aria-live="polite" className="min-h-0">
        {note && (
          <p className="mb-2 font-label text-[0.75rem] uppercase tracking-[0.12em] text-streak">
            {note}
          </p>
        )}
        {/*
          What a recorded activity did to any goal watching this track.

          Stated, never celebrated — the three celebration tiers and the confetti
          live on /goals, and the track half of the app describes behaviour
          rather than scoring it. No XP in the line for the same reason. Muted
          rather than the streak plate, because this is a different signal from
          consistency and must not borrow its colour.
        */}
        {goalNotes.map((line) => (
          <p key={line} className="mb-2 font-label text-[0.75rem] uppercase tracking-[0.12em] text-muted">
            {line}
          </p>
        ))}
      </div>

      <p className="mb-1 hidden font-label text-[0.6875rem] uppercase tracking-[0.12em] text-muted sm:block">
        ↑ ↓ move · Enter records · U undoes
      </p>

      {/* `sv-row` is the hover/focus band — see globals.css. The row is 840px
          wide with 559px of nothing between the topic name and the controls,
          and Delete is at the far end of that traverse. */}
      <ul className="divide-y divide-border" onKeyDown={onKeyDown}>
        {leaves.map((leaf) => (
          <li
            key={leaf.id}
            data-leaf-row={leaf.id}
            className="sv-row -mx-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 py-2.5"
          >
            <div className="flex min-w-0 flex-col">
              {/*
                11px, not the 12px every other label takes.

                This is the one label in the app that sits *directly above the
                thing it qualifies*, so it is the one place where the interface
                label size and the content size are compared side by side. At 12px
                against the 14px name it lost the argument: the ancestry is the
                longer string and in an all-uppercase face with a single weight it
                read as the heading, with the leaf's own name as a subtitle under
                it. The audit that set the 12px floor was right that 8.8px was too
                small to read; it went one step too far here, and only here.

                11 against 14 restores the subordination (1.27x) without returning
                to a size the floor was raised to fix. Everything else stays at
                12px — this is a fix to one relationship, not a re-flattening of
                the scale.
              */}
              {leaf.path.length > 0 && (
                <span className="font-label text-[0.6875rem] uppercase tracking-[0.14em] text-muted">
                  {leaf.path.join(" › ")}
                </span>
              )}
              <span className="min-w-0 truncate text-sm">{leaf.name}</span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <ActivityCell
                /* Keyed by the day as well as the leaf: a day switch while a
                   write is still in flight would otherwise carry that write's
                   optimistic count onto the day now shown. */
                key={`${leaf.id}:${day}`}
                topicId={leaf.id}
                count={day === todayKey ? leaf.count : (leaf.counts?.[day] ?? 0)}
                label={leaf.name}
                day={backdating ? day : undefined}
                dayLabel={backdating ? chosen?.full : undefined}
                onStreakNote={setNote}
                onGoalNotes={setGoalNotes}
              />
              <TopicControls
                node={leaf}
                trackId={trackId}
                all={all}
                canMoveUp={false}
                canMoveDown={false}
                reorder={false}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
