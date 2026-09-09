/**
 * Linking a Goal to a Track, as pure functions.
 *
 * Nothing here touches the database or React. These are the *inputs* to the one
 * query that decides which goals an activity advances, and the words that
 * describe the link afterwards — deliberately not a second copy of the decision
 * itself. `lib/actions/activity.ts` asks the database "which goals watch this
 * leaf" with an `OR` over `trackId` and `topicId IN chain`, and that query is
 * the only definition of link coverage there is. What lives here is the chain it
 * is given, the window test applied to what comes back, and the labels.
 *
 * **A Goal linked to a Track does not give the Track a finish line.** The Track
 * still never finishes; the Goal is a window with a deadline over a slice of the
 * Track's activity, and deleting the Goal leaves the Track untouched. That is
 * the axis the whole app is bent around and this feature sits on the right side
 * of it — see `CLAUDE.md`.
 */

import { startOfDay } from "@/lib/day";
import { MAX_DEPTH } from "@/lib/tree";

/**
 * What a goal watches. **At most one of the two is ever set.**
 *
 * Both null means the goal's progress is typed in by hand, which is how every
 * goal worked before this existed and how one behaves again if its link is
 * broken by a deletion. The invariant is enforced by a `CHECK` constraint in the
 * database rather than here — see the migration and `docs/SCHEMA.md` — because a
 * goal carrying both would advance from one track while claiming to watch the
 * other, and nothing in a rendered page would show it.
 */
export type GoalLink = { trackId: string | null; topicId: string | null };

export const NO_LINK: GoalLink = { trackId: null, topicId: null };

/** True when this goal reads its progress from activity rather than from input. */
export function isLinked(link: GoalLink): boolean {
  return link.trackId !== null || link.topicId !== null;
}

/**
 * A leaf and its ancestors, nearest first.
 *
 * This is what turns "is this leaf inside the watched subtree" into an `IN` over
 * at most five ids, rather than loading a subtree and testing membership. A goal
 * watching topic X advances exactly when X is in this chain, and because the
 * chain is bounded by `MAX_DEPTH` the test costs the same on the deepest tree
 * the app allows as on the shallowest.
 *
 * `rows` is the track's **live** topics. A chain that would run through a
 * soft-deleted ancestor stops there instead, so a goal watching a deleted node
 * stops advancing rather than quietly continuing to collect — which matches what
 * every other figure in the app does with a deleted node.
 *
 * The walk is bounded rather than `while (cursor)`. A corrupted `parentId` cycle
 * is not supposed to be possible — `canMove` refuses one — but this runs inside
 * a transaction, and a spin there would hold a write lock rather than merely
 * return the wrong answer.
 */
export function chainFor(
  rows: ReadonlyArray<{ id: string; parentId: string | null }>,
  leafId: string,
): string[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const chain: string[] = [];
  let cursor: string | null = leafId;

  for (let step = 0; cursor !== null && step <= MAX_DEPTH; step++) {
    if (chain.includes(cursor)) break; // a cycle; stop rather than spin
    const node = byId.get(cursor);
    if (!node) break; // the root, or a soft-deleted ancestor
    chain.push(node.id);
    cursor = node.parentId;
  }

  return chain;
}

export type LinkedGoalWindow = {
  status: string;
  startDate: Date;
  deadline: Date;
};

/**
 * Does activity on `day` advance this goal?
 *
 * **`day` is the day the activity was recorded for, not today.** That is what
 * makes backdating consistent with the rest of the feature: filling in Sunday
 * counts toward a goal whose window included Sunday, and does not count toward
 * one that started on Monday. Testing against today instead would let a
 * backdated entry pay into a window it never happened in.
 *
 * Both edges are inclusive — a goal due today is still live today, which is the
 * same rule `displayStatus` uses for expiry, so a goal cannot be un-expired by
 * one function and expired by the other.
 *
 * **`completed` counts, `archived` does not**, and the asymmetry is deliberate.
 * If a completed goal stopped tracking, then recording the activity that
 * completed it and *undoing* that activity would leave the goal sitting at a
 * figure its own activity no longer supports. Overshoot is already allowed and
 * honest — 52 against a target of 50 is a true fact about the week — completion
 * only ever moves forward, and the deadline stops the counting soon enough.
 * Archiving is "I am not doing this after all", so it stops immediately.
 */
export function advancesOn(goal: LinkedGoalWindow, day: Date): boolean {
  if (goal.status !== "active" && goal.status !== "completed") return false;
  const on = startOfDay(day).getTime();
  return startOfDay(goal.startDate).getTime() <= on && on <= startOfDay(goal.deadline).getTime();
}

/**
 * The create form's select value → a link.
 *
 * **Cannot produce a link with both fields set**, whatever it is handed. The
 * database refuses that combination anyway; this makes the refusal unreachable
 * from the one path that could otherwise attempt it, so a malformed form post is
 * a manual goal rather than a constraint violation the user has to read.
 */
export function parseLinkChoice(raw: unknown): GoalLink {
  if (typeof raw !== "string") return NO_LINK;
  const separator = raw.indexOf(":");
  if (separator <= 0) return NO_LINK;
  const kind = raw.slice(0, separator);
  const id = raw.slice(separator + 1).trim();
  if (!id) return NO_LINK;
  if (kind === "track") return { trackId: id, topicId: null };
  if (kind === "topic") return { trackId: null, topicId: id };
  return NO_LINK;
}

/** The inverse, for a form that has to show what is already selected. */
export function linkChoiceValue(link: GoalLink): string {
  if (link.trackId) return `track:${link.trackId}`;
  if (link.topicId) return `topic:${link.topicId}`;
  return "";
}

/**
 * Where a linked goal's progress comes from, resolved for display.
 *
 * `live` is false when the watched topic has been soft-deleted. A hard-deleted
 * track cannot produce this shape at all — the foreign key is `SetNull`, so the
 * goal simply stops being linked and falls back to manual, keeping its progress.
 */
export type GoalSource =
  | { kind: "track"; trackId: string; trackName: string; live: boolean }
  | { kind: "topic"; trackId: string; trackName: string; topicName: string; live: boolean };

/** "DSA", or "DSA › Graphs". The badge on a linked card. */
export function describeLink(source: GoalSource | null): string | null {
  if (!source) return null;
  return source.kind === "track"
    ? source.trackName
    : `${source.trackName} › ${source.topicName}`;
}

/**
 * The line shown on the *track* page when activity advanced a linked goal.
 *
 * **No XP and no celebration in this string, deliberately.** The reward is real
 * and was banked by the server inside the transaction, but it is performed on
 * `/goals` and nowhere else — `CLAUDE.md` keeps the three celebration tiers and
 * the confetti on that one screen, and the track half of the app describes
 * behaviour rather than scoring it. So this is a statement of fact in the same
 * register as the backdating streak note: what the goal now stands at, and which
 * crossing it just passed if it passed one.
 */
export function describeGoalAdvance(
  goal: { title: string; target: number; unit: string },
  to: number,
  milestones: readonly number[] = [],
): string {
  const figure = `${Math.round(to)}/${goal.target} ${goal.unit}`;
  const top = milestones.length > 0 ? Math.max(...milestones) : null;
  if (top === 100) return `${goal.title} — complete, ${figure}.`;
  if (top !== null) return `${goal.title} — ${top}% reached, ${figure}.`;
  return `${goal.title} — ${figure}.`;
}
