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
  "rounded-lg px-2 py-1 text-xs font-semibold text-muted transition-colors hover:text-fg";

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
      <li className="px-5 py-4">
        <form action={onRename} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              name="name"
              defaultValue={track.name}
              autoFocus
              maxLength={80}
              aria-label="Track name"
              className="min-w-0 flex-1 rounded-lg border border-border bg-elevated px-3 py-1.5 text-sm focus:border-accent"
            />
            <button
              type="submit"
              disabled={pending}
              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast disabled:opacity-60"
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
            <p role="alert" className="text-sm text-muted">
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
      <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p className="text-sm">
          Delete <span className="font-semibold">{track.name}</span>
          {alsoRemoved.length > 0 && <> and its {alsoRemoved.join(" and ")}</>}? This
          cannot be undone.
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-streak disabled:opacity-60"
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
    <li className="group grid grid-cols-1 items-center gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
      <div className="min-w-0">
        <h3 className="truncate font-semibold">
          <Link
            href={`/tracks/${track.id}`}
            className="rounded-lg transition-colors hover:text-accent"
          >
            {track.name}
          </Link>
        </h3>
        <p className="tabular mt-0.5 text-xs text-muted">
          {track.taskCount === 0 ? (
            `${track.topicCount} topic${track.topicCount === 1 ? "" : "s"}, no tasks yet`
          ) : (
            <>
              <span className="text-fg">{track.completedCount}</span> of {track.taskCount}{" "}
              tasks done
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
