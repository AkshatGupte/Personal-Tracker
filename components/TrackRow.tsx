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
  topicCount: number;
  taskCount: number;
  completedCount: number;
  terrain: Terrain;
};

const actionButton =
  "rounded-none px-1.5 py-1 font-label text-[0.58rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg";

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
              className="min-w-0 flex-1 rounded-none border border-border bg-transparent px-3 py-1.5 text-sm focus:border-accent aria-invalid:border-sv-red"
            />
            <button
              type="submit"
              disabled={pending}
              className="shrink-0 rounded-none bg-sv-yellow px-3 py-1.5 font-label text-[0.6rem] uppercase tracking-[0.14em] text-sv-ink disabled:opacity-60"
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
            <p role="alert" className="font-label text-[0.7rem] text-sv-red">
              {error}
            </p>
          )}
        </form>
      </li>
    );
  }

  if (mode === "confirm") {
    // Deleting a track cascades, so say plainly what else goes with it.
    const alsoRemoved = [
      track.topicCount > 0 && `${track.topicCount} topic${track.topicCount === 1 ? "" : "s"}`,
      track.taskCount > 0 && `${track.taskCount} task${track.taskCount === 1 ? "" : "s"}`,
    ].filter(Boolean) as string[];

    return (
      <li className="flex flex-wrap items-center justify-between gap-3 py-4">
        {/* The frame is muted so the name carries, which is the only emphasis
            available: the app has one font weight and `font-synthesis-weight:
            none`, so the `font-semibold` that used to be here rendered exactly
            like the words around it. In a destructive, irreversible flow the
            thing being destroyed has to be unmistakable. */}
        <p className="text-sm text-muted">
          Delete <span className="text-fg">{track.name}</span>
          {alsoRemoved.length > 0 && <> and its {alsoRemoved.join(" and ")}</>}? This
          cannot be undone.
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="rounded-none px-1.5 py-1 font-label text-[0.58rem] uppercase tracking-[0.14em] text-sv-red disabled:opacity-60"
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
        <p className="mt-1 font-label text-[0.6rem] uppercase tracking-[0.12em] tabular-nums text-muted">
          {track.taskCount === 0 ? (
            <span className="sv-status">
              {track.topicCount} topic{track.topicCount === 1 ? "" : "s"}, no tasks yet
            </span>
          ) : (
            <>
              <span className="text-fg">{track.completedCount}</span> of {track.taskCount}{" "}
              checked in today
            </>
          )}
          {track.currentStreak > 0 && (
            <>
              {" · "}
              <span className="font-semibold text-streak">{track.currentStreak} day</span>{" "}
              streak
            </>
          )}
        </p>
      </div>

      {/* The track's own elevation, small. Flat when nothing is completed. */}
      <div className="hidden sm:block" aria-hidden="true">
        <TerrainProfile
          id={track.id}
          terrain={track.terrain}
          scope={track.name}
          height="h-10"
          compact
        />
      </div>

      <div className="flex shrink-0 items-center gap-1 justify-self-start sm:justify-self-end">
        <button type="button" onClick={() => setMode("rename")} className={actionButton}>
          Rename
        </button>
        <button type="button" onClick={() => setMode("confirm")} className={actionButton}>
          Delete
        </button>
      </div>
    </li>
  );
}
