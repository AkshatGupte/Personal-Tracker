"use client";

import { useActionState, useState } from "react";
import { createGoal } from "@/lib/actions/goals";
import { dayKey, startOfDay } from "@/lib/day";

const field =
  "sv-input w-full rounded-none border border-border-interactive bg-transparent px-2 py-1.5 text-sm placeholder:text-muted focus:border-accent";
const label = "font-label text-[0.75rem] uppercase tracking-[0.12em] text-muted";

/*
  `dayKey`, not `toISOString().slice(0, 10)`.

  `toISOString` converts to UTC first, so local midnight anywhere east of
  Greenwich lands on the *previous* day: at UTC+5:30 a goal started "today"
  defaulted to yesterday, which then made it day 1 of 6 with 8.33 units already
  expected — a brand new goal opened reading "critical". `dayKey` formats from
  the local components and is what the rest of the app already keys days by.
*/
const iso = (d: Date) => dayKey(d);

/**
 * Setting a goal.
 *
 * Collapsed to a single button until asked for. The dashboard's job is to show
 * how the goals in flight are doing; a permanently open eight-field form would
 * put the least frequent action at the top of the most frequent screen.
 *
 * **Weekly and monthly hide the deadline field rather than pre-filling it.** A
 * pre-filled date the user can then edit is a third state to reason about — is
 * this goal weekly, or is it custom and happens to be seven days? The cadence
 * decides the deadline on the server, and only `custom` asks for one.
 */
export type LinkTarget = {
  id: string;
  name: string;
  topics: Array<{ id: string; name: string; depth: number }>;
};

export default function GoalCreateForm({ targets = [] }: { targets?: LinkTarget[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createGoal, {});
  const [cadence, setCadence] = useState("weekly");
  const today = iso(startOfDay());

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-none bg-sv-yellow px-3.5 py-2 font-label text-[0.75rem] uppercase tracking-[0.14em] text-sv-ink transition-opacity hover:opacity-90"
      >
        Set a goal
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        formAction(formData);
        // Only close on a clean run; an error has to stay on screen with the
        // values still in the fields.
        if (!formData.get("title")) return;
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <label className={label} htmlFor="goal-title">
          Goal
        </label>
        <input
          id="goal-title"
          name="title"
          required
          autoFocus
          placeholder="Solve 50 DSA problems"
          className={field}
        />
      </div>

      <div className="sm:col-span-2">
        <label className={label} htmlFor="goal-desc">
          Description <span className="normal-case">(optional)</span>
        </label>
        <input id="goal-desc" name="description" placeholder="Why this, and what counts" className={field} />
      </div>

      <div>
        <label className={label} htmlFor="goal-category">
          Category
        </label>
        <input id="goal-category" name="category" defaultValue="General" list="goal-categories" className={field} />
        <datalist id="goal-categories">
          {["DSA", "Fitness", "Projects", "Learning", "Reading", "General"].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <div>
        <label className={label} htmlFor="goal-unit">
          Unit
        </label>
        <input id="goal-unit" name="unit" defaultValue="problems" list="goal-units" className={field} />
        <datalist id="goal-units">
          {["problems", "hours", "pages", "books", "workouts", "projects", "sessions"].map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </div>

      <div>
        <label className={label} htmlFor="goal-target">
          Target
        </label>
        <input
          id="goal-target"
          name="target"
          type="number"
          step="any"
          min="0.01"
          required
          defaultValue={50}
          className={field}
        />
      </div>

      <div>
        <label className={label} htmlFor="goal-cadence">
          Duration
        </label>
        <select
          id="goal-cadence"
          name="cadence"
          value={cadence}
          onChange={(e) => setCadence(e.target.value)}
          className={field}
        >
          <option value="weekly">Weekly (7 days)</option>
          <option value="monthly">Monthly (30 days)</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/*
        Where progress comes from.

        A goal linked to a Track still has a deadline and still finishes — it is
        a *window over* the track's activity, not a finish line on the track.
        Deleting the goal leaves the track untouched. See CLAUDE.md's axis.

        Offered at creation only, and not editable afterwards: changing what a
        goal watches mid-flight leaves banked progress that came from somewhere
        else, and the bar would then describe two different things at once.

        Topics are indented by depth with a nbsp run rather than a nested
        optgroup — a `select` allows exactly one level of grouping, and the tree
        is up to five deep.
      */}
      <div className="sm:col-span-2">
        <label className={label} htmlFor="goal-source">
          Progress from
        </label>
        <select id="goal-source" name="source" defaultValue="" className={field}>
          <option value="">Typed in by hand</option>
          {targets.map((track) => (
            <optgroup key={track.id} label={track.name}>
              <option value={`track:${track.id}`}>{track.name} — the whole track</option>
              {track.topics.map((topic) => (
                <option key={topic.id} value={`topic:${topic.id}`}>
                  {"\u00a0".repeat((topic.depth - 1) * 3)}
                  {topic.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Linked goals advance when you work the track, and cannot be typed into.
          Nothing before now is counted — the goal starts at zero.
        </p>
      </div>

      {/*
        Repeating. One checkbox, because the *length* of a period is already
        decided by Duration above — a repeating goal simply keeps taking the next
        window of the same length, so there is nothing else to ask.

        Deliberately not a third "cadence" option: cadence says how long a period
        is, and repeating says whether there is another one. Folding them into one
        select would make "weekly" ambiguous between the two.
      */}
      <div className="sm:col-span-2">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            name="repeats"
            className="mt-0.5 h-4 w-4 shrink-0 rounded-none accent-[var(--sv-yellow)]"
          />
          <span>
            <span className={label}>Repeats</span>
            <span className="mt-0.5 block text-sm leading-relaxed text-muted">
              When the window closes, the next one starts on its own — as a new
              goal, so each period is kept and counted on its own terms. Archive
              the current one to stop.
            </span>
          </span>
        </label>
      </div>

      <div>
        <label className={label} htmlFor="goal-start">
          Start
        </label>
        <input id="goal-start" name="startDate" type="date" defaultValue={today} className={field} />
      </div>

      {cadence === "custom" && (
        <div>
          <label className={label} htmlFor="goal-deadline">
            Deadline
          </label>
          <input id="goal-deadline" name="deadline" type="date" defaultValue={today} className={field} />
        </div>
      )}

      {state.error && (
        <p role="alert" className="font-label text-[0.75rem] text-sv-red sm:col-span-2">
          {state.error}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-none bg-sv-yellow px-3.5 py-2 font-label text-[0.75rem] uppercase tracking-[0.14em] text-sv-ink disabled:opacity-60"
        >
          {pending ? "Setting…" : "Set goal · +5 XP"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-none border border-border px-3 py-2 font-label text-[0.75rem] uppercase tracking-[0.12em] text-muted hover:text-fg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
