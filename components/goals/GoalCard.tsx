"use client";

import { useState, useTransition } from "react";
import { dayKey } from "@/lib/day";
import {
  GOAL_MILESTONES,
  MOMENTUM_COPY,
  deadlineUrgency,
  displayStatus,
  goalFraction,
  goalPercent,
  momentumOf,
  remainingCopy,
  type GoalRow,
} from "@/lib/goals";
import {
  completeGoal,
  deleteGoal,
  editGoal,
  recordGoalProgress,
  setGoalStatus,
  type ProgressReward,
} from "@/lib/actions/goals";
import { CountUp, GoalBanner, MILESTONE_COPY, XpChip } from "./GoalReward";

/** Plate per momentum. Cyan reads "done today" elsewhere, so "on track" takes
 *  it; magenta is volume and belongs to being ahead. */
const MOMENTUM_TONE: Record<string, string> = {
  ahead: "var(--accent)",
  onTrack: "var(--sv-cyan)",
  behind: "var(--sv-yellow)",
  critical: "var(--sv-red)",
  expired: "var(--muted)",
  complete: "var(--sv-yellow)",
};

const action =
  "rounded-none border border-border px-2 py-1 font-label text-[0.75rem] uppercase tracking-[0.12em] text-muted transition-colors hover:border-border-interactive hover:text-fg";

export default function GoalCard({
  goal,
  onComplete,
}: {
  goal: GoalRow;
  /**
   * Fired when a write completes the goal.
   *
   * **The completion beat cannot live in this component**, and that is not a
   * style preference. Completing a goal moves it out of the active list and
   * into the compact completed history, so the very revalidation that completes
   * it unmounts this card — taking the banner and the particles with it after a
   * couple of frames. The largest moment in the feature was the one guaranteed
   * not to be seen. The list owns it instead, where nothing is unmounting.
   */
  onComplete?: (goal: GoalRow, xp: number) => void;
}) {
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"idle" | "edit" | "confirm">("idle");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  /*
    The card renders from `optimistic`, not from the prop.

    A goal write is a server action and a revalidate — perhaps 80ms, but the
    press has to feel instant, and the count-up needs a value to travel *to*
    before the round trip lands. This is the same optimistic pattern the activity
    cell already uses for recording a leaf.
  */
  const [optimistic, setOptimistic] = useState<number | null>(null);
  const [reward, setReward] = useState<ProgressReward & { fire: number }>({ fire: 0 });

  const shown = { ...goal, currentProgress: optimistic ?? goal.currentProgress };
  const status = displayStatus(shown);
  const momentum = momentumOf(shown);
  const percent = goalPercent(shown);
  const urgency = deadlineUrgency(shown);
  const tone = MOMENTUM_TONE[momentum] ?? "var(--muted)";

  const write = (value: number, kind: "set" | "add") => {
    setError(null);
    const next = Math.max(0, kind === "add" ? shown.currentProgress + value : value);
    setOptimistic(next);
    start(async () => {
      const result = await recordGoalProgress(goal.id, value, kind);
      if (result.error) {
        setOptimistic(null);
        setError(result.error);
        return;
      }
      /*
        The server is the authority on rewards — it owns the high-water mark and
        the milestone constraint — so the celebration fires from what it says was
        actually banked, never from what the client guessed.
      */
      if (result.completed) {
        // Hand the celebration to the list before this card goes away.
        onComplete?.(goal, result.xp ?? 0);
        setOptimistic(null);
        return;
      }
      setReward({ ...result, fire: Date.now() });
      setOptimistic(null);
    });
  };

  const celebrating =
    (reward.milestones?.length ?? 0) > 0
      ? "sv-goal-milestone"
      : (reward.xp ?? 0) > 0
        ? "sv-goal-tick"
        : "";

  const topMilestone = reward.milestones?.length
    ? Math.max(...reward.milestones)
    : null;

  return (
    <li
      key={reward.fire || goal.id}
      className={`relative ${celebrating}`}
      style={{
        background: "var(--surface)",
        border: `1px solid ${status === "completed" ? "var(--sv-yellow)" : "var(--border)"}`,
      }}
    >
      {topMilestone ? (
        <GoalBanner
          label={MILESTONE_COPY[topMilestone] ?? "Milestone"}
          xp={reward.xp ?? 0}
          tone="milestone"
          fire={reward.fire}
        />
      ) : (
        <XpChip xp={reward.xp ?? 0} fire={reward.fire} />
      )}

      <div className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="min-w-0 text-lg leading-tight">{goal.title}</h3>
          <span className="font-label text-[0.6875rem] uppercase tracking-[0.14em] text-muted">
            {goal.category}
          </span>
        </div>

        {goal.description && (
          <p className="mt-1 max-w-[52ch] text-sm leading-relaxed text-muted">{goal.description}</p>
        )}

        {/* The figure. The count-up runs here and nowhere else — one moving
            number per card, so the eye knows where to look. */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-mono text-3xl leading-none tabular-nums">
            <CountUp value={Math.round(shown.currentProgress)} />
          </span>
          <span className="font-label text-[0.75rem] uppercase tracking-[0.12em] text-muted">
            / {goal.target} {goal.unit}
          </span>
          <span className="ml-auto font-mono text-sm tabular-nums" style={{ color: tone }}>
            {percent}%
          </span>
        </div>

        {/* The bar, with the four milestone marks standing on it. Square, and
            filled in the momentum plate so the bar and the status agree. */}
        <div className="relative mt-2 h-2.5 w-full" style={{ background: "var(--elevated)" }}>
          <div
            className="sv-goal-bar absolute inset-y-0 left-0"
            style={{ width: `${goalFraction(shown) * 100}%`, background: tone }}
          />
          {GOAL_MILESTONES.map((m) => (
            <span
              key={m}
              aria-hidden="true"
              className="absolute top-0 h-full w-px"
              style={{
                left: `${m}%`,
                background:
                  goal.milestones.includes(m) || percent >= m
                    ? "var(--sv-ink)"
                    : "var(--border-interactive)",
                opacity: m === 100 ? 0 : 1,
              }}
            />
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className="font-label text-[0.75rem] uppercase tracking-[0.12em]"
            style={{ color: tone }}
          >
            {MOMENTUM_COPY[momentum]}
          </span>
          {/* The deadline gets louder as it closes: muted while there is room,
              full contrast and the warning plate once it is genuinely near. */}
          <span
            className="font-label text-[0.75rem] uppercase tracking-[0.12em] tabular-nums"
            style={{
              color:
                status === "expired"
                  ? "var(--sv-red)"
                  : urgency > 0.8
                    ? "var(--sv-yellow)"
                    : urgency > 0.55
                      ? "var(--fg)"
                      : "var(--muted)",
            }}
          >
            {remainingCopy(shown)}
          </span>
          {goal.milestones.length > 0 && (
            <span className="font-label text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
              {goal.milestones.map((m) => `${m}%`).join(" · ")} banked
            </span>
          )}
          <span className="ml-auto font-label text-[0.6875rem] uppercase tracking-[0.12em] text-streak tabular-nums">
            {goal.xp} XP
          </span>
        </div>

        {error && (
          <p role="alert" className="mt-2 font-label text-[0.75rem] text-sv-red">
            {error}
          </p>
        )}

        {/* Actions. The fast path is first and largest: one press is the whole
            interaction for the common case, and everything else is a step away
            from it rather than in its way. */}
        {mode === "idle" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {status !== "completed" && status !== "archived" && (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => write(1, "add")}
                  className="rounded-none bg-sv-yellow px-3 py-1.5 font-label text-[0.75rem] uppercase tracking-[0.14em] text-sv-ink transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  +1 {goal.unit}
                </button>
                <form
                  className="flex items-center gap-1"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = Number(draft);
                    if (Number.isFinite(value)) write(value, "set");
                    setDraft("");
                  }}
                >
                  <input
                    inputMode="decimal"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Set to…"
                    aria-label={`Set progress for ${goal.title}`}
                    className="sv-input w-24 rounded-none border border-border-interactive bg-transparent px-2 py-1 text-sm focus:border-accent"
                  />
                  <button type="submit" disabled={pending || !draft} className={action}>
                    Update
                  </button>
                </form>
              </>
            )}
            <button type="button" onClick={() => setMode("edit")} className={action}>
              Edit
            </button>
            {status === "active" && (
              <button
                type="button"
                onClick={() => start(async () => void (await completeGoal(goal.id)))}
                className={action}
              >
                Complete
              </button>
            )}
            {status === "archived" ? (
              <button
                type="button"
                onClick={() => start(async () => void (await setGoalStatus(goal.id, "active")))}
                className={action}
              >
                Restore
              </button>
            ) : (
              <button
                type="button"
                onClick={() => start(async () => void (await setGoalStatus(goal.id, "archived")))}
                className={action}
              >
                Archive
              </button>
            )}
            {status === "expired" && (
              <button
                type="button"
                onClick={() => start(async () => void (await setGoalStatus(goal.id, "active")))}
                className={action}
              >
                Restart
              </button>
            )}
            <button type="button" onClick={() => setMode("confirm")} className={action}>
              Delete
            </button>
          </div>
        )}

        {mode === "confirm" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* The name at `fg` against a muted sentence. A bold class would
                emphasise nothing at all — Bangers has one weight. */}
            <p className="text-sm text-muted">
              Delete <span className="text-fg">{goal.title}</span> and its history?
            </p>
            <button
              type="button"
              onClick={() => start(async () => void (await deleteGoal(goal.id)))}
              className="rounded-none bg-sv-red px-3 py-1.5 font-label text-[0.75rem] uppercase tracking-[0.14em] text-fg"
            >
              Delete
            </button>
            <button type="button" onClick={() => setMode("idle")} className={action}>
              Keep
            </button>
          </div>
        )}

        {mode === "edit" && (
          <form
            action={async (formData) => {
              const result = await editGoal(goal.id, formData);
              if (result.error) setError(result.error);
              else {
                setError(null);
                setMode("idle");
              }
            }}
            className="mt-3 grid gap-2 sm:grid-cols-2"
          >
            <input
              name="title"
              defaultValue={goal.title}
              aria-label="Title"
              className="sv-input rounded-none border border-border-interactive bg-transparent px-2 py-1 text-sm focus:border-accent sm:col-span-2"
            />
            <input
              name="description"
              defaultValue={goal.description ?? ""}
              aria-label="Description"
              placeholder="Description"
              className="sv-input rounded-none border border-border-interactive bg-transparent px-2 py-1 text-sm focus:border-accent sm:col-span-2"
            />
            <input
              name="category"
              defaultValue={goal.category}
              aria-label="Category"
              className="sv-input rounded-none border border-border-interactive bg-transparent px-2 py-1 text-sm focus:border-accent"
            />
            <input
              name="unit"
              defaultValue={goal.unit}
              aria-label="Unit"
              className="sv-input rounded-none border border-border-interactive bg-transparent px-2 py-1 text-sm focus:border-accent"
            />
            <input
              name="target"
              type="number"
              step="any"
              defaultValue={goal.target}
              aria-label="Target"
              className="sv-input rounded-none border border-border-interactive bg-transparent px-2 py-1 text-sm focus:border-accent"
            />
            <input
              name="deadline"
              type="date"
              /* Local, not UTC — see the note in GoalCreateForm. Editing a
                 goal must not quietly move its deadline back a day. */
              defaultValue={dayKey(goal.deadline)}
              aria-label="Deadline"
              className="sv-input rounded-none border border-border-interactive bg-transparent px-2 py-1 text-sm focus:border-accent"
            />
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="submit"
                className="rounded-none bg-sv-yellow px-3 py-1.5 font-label text-[0.75rem] uppercase tracking-[0.14em] text-sv-ink"
              >
                Save
              </button>
              <button type="button" onClick={() => setMode("idle")} className={action}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </li>
  );
}
