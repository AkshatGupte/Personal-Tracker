"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import TerrainProfile from "@/components/TerrainProfile";
import { deleteTrack, renameTrack } from "@/lib/actions/tracks";
import type { Terrain } from "@/lib/terrain";

export type TrackRowData = {
  id: string;
  name: string;
  currentStreak: number;
  /** Every live node in the track, at any depth. */
  topicCount: number;
  /** Actionable nodes — those with no children. */
  leafCount: number;
  /** Distinct leaves worked today. */
  workedToday: number;
  terrain: Terrain;
};

const actionButton =
  "rounded-none px-1.5 py-1 font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg";

export default function TrackRow({ track }: { track: TrackRowData }) {
  const [mode, setMode] = useState<"view" | "rename" | "confirm">("view");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onRename = (formData: FormData) => {
    startTransition(async () => {
      const result = await renameTrack(track.id, formData);
      if (result.error) setError(result.error);
      else {
        setError(null);
        setMode("view");
      }
    });
  };

  const onDelete = () => {
    startTransition(async () => {
      await deleteTrack(track.id);
    });
  };

  if (mode === "rename") {
    return (
      <li className="py-4">
        <form action={onRename} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              name="name"
              defaultValue={track.name}
              autoFocus
              maxLength={80}
              aria-label="Track name"
              aria-invalid={error ? true : undefined}
              className="sv-input min-w-0 flex-1 rounded-none border border-border-interactive bg-transparent px-3 py-1.5 text-sm focus:border-accent aria-invalid:border-sv-red"
            />
            <button
              type="submit"
              disabled={pending}
              className="shrink-0 rounded-none bg-sv-yellow px-3 py-1.5 font-label text-[0.75rem] uppercase tracking-[0.14em] text-sv-ink disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("view");
                setError(null);
              }}
              className={actionButton}
            >
              Cancel
            </button>
          </div>
          {error && (
            <p role="alert" className="font-label text-[0.75rem] text-sv-red">
              {error}
            </p>
          )}
        </form>
      </li>
    );
  }

  if (mode === "confirm") {
    /*
      Deleting a track is the only hard delete in the app: it cascades to every
      topic and every TopicActivity row under it, so the streak and the whole
      recorded history go with it. See docs/SCHEMA.md.

      What was here read "Delete DSA and its 28 topics and 22 of them worked
      directly? This cannot be undone." — two clauses joined by a second "and"
      with no noun to attach to, and the one consequence that actually matters
      left out. A user could reasonably read it as removing the topics and
      keeping the record of the work.
    */
    const topics =
      track.topicCount > 0
        ? ` and its ${track.topicCount} topic${track.topicCount === 1 ? "" : "s"}`
        : "";

    return (
      <li className="flex flex-wrap items-center justify-between gap-3 py-4">
        {/* The frame is muted so the name carries, which is the only emphasis
            available: the app has one font weight and `font-synthesis-weight:
            none`, so the `font-semibold` that used to be here rendered exactly
            like the words around it. In a destructive, irreversible flow the
            thing being destroyed has to be unmistakable. */}
        <p className="text-sm text-muted">
          Delete <span className="text-fg">{track.name}</span>
          {topics}? Every activity ever recorded on this track
          {track.currentStreak > 0 && (
            <>
              , and its <span className="text-fg">{track.currentStreak}-day streak</span>,
            </>
          )}{" "}
          {track.currentStreak > 0 ? "are" : "is"} permanently destroyed. This cannot be
          undone.
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="rounded-none px-1.5 py-1 font-label text-[0.75rem] uppercase tracking-[0.14em] text-sv-red disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
          <button type="button" onClick={() => setMode("view")} className={actionButton}>
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="grid grid-cols-1 items-center gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
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
          {track.leafCount === 0 ? (
            <span className="sv-status">
              {track.topicCount === 0
                ? "nothing in this track yet"
                : `${track.topicCount} topic${track.topicCount === 1 ? "" : "s"}, nothing to work on yet`}
            </span>
          ) : (
            <>
              <span className="text-fg">{track.workedToday}</span> of {track.leafCount}{" "}
              worked today
            </>
          )}
          {track.currentStreak > 0 && (
            <>
              {" · "}
              <span className="font-semibold text-streak">{track.currentStreak} day</span>{" "}
              streak
            </>
          )}
          {/*
            The chart's own scale, in words, and it is not decoration.

            Every track's trajectory is drawn against *its own* next milestone,
            which is what stops two activities filling the frame. The cost is
            that two rows side by side have different y axes: at a glance
            Spanish's ridge at 20% and DSA's at 54% look like a 2.7x difference
            when the elevations behind them are 2 and 54. A row-sized chart has
            no space for an axis caption, so the axis is stated here instead —
            the same two numbers the drawing is built from, in the row's own
            voice.
          */}
          {track.terrain.elevation > 0 && (
            <>
              {" · "}
              <span className="text-fg">{track.terrain.elevation}</span> of{" "}
              {track.terrain.domainMax} elevation
            </>
          )}
        </p>
      </div>

      {/*
        This track's trajectory, and it is the reason the home page no longer
        carries one big chart: a curve means something against a single subject
        and nothing against every subject stacked together.

        Raised from h-10 to h-14. At 40px the fourteen daily points sat within a
        couple of pixels of each other vertically and there was nothing to aim
        at; the row still reads as a row at 56px, and the shape becomes a shape.
        `overflow-visible` so the read-off caption can stand clear of a row that
        is shorter than the caption is tall.
      */}
      <div className="hidden overflow-visible sm:block">
        <TerrainProfile
          id={track.id}
          terrain={track.terrain}
          scope={track.name}
          height="h-14"
          compact
        />
      </div>

      <div className="flex shrink-0 items-center gap-1 justify-self-start sm:justify-self-end">
        <button type="button" onClick={() => setMode("rename")} className={actionButton}>
          Rename
        </button>
        <button
          type="button"
          onClick={() => setMode("confirm")}
          className={`${actionButton} sv-action-destructive`}
        >
          Delete
        </button>
      </div>
    </li>
  );
}
