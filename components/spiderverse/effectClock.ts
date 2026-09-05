/**
 * A shared clock for the ambient effects, so two of them do not land together.
 *
 * The lightning and the glitch are deliberately independent — neither is
 * triggered, neither knows what the other is for, and syncing them would turn
 * two kinds of weather into one event. But they draw from the same random
 * cadence, so every few minutes both would fire inside the same moment purely
 * by coincidence, and that moment reads as a much busier app than either effect
 * was tuned to be.
 *
 * So: not mutual exclusion, just a nudge. Each spawner records when it fired,
 * and asks whether the *other* one fired recently enough to collide. If it did,
 * the caller postpones itself by a few hundred milliseconds and the two read as
 * two things rather than one pile-up.
 *
 * Module state rather than context: there is exactly one of each spawner in the
 * tree, they are both client-only, and threading a provider through the root
 * layout to carry two numbers would be more machinery than the problem has.
 */

export type EffectKind = "lightning" | "glitch";

const lastFiredAt: Record<EffectKind, number> = { lightning: 0, glitch: 0 };

/** How close two effects have to be before one of them gets out of the way. */
const COLLISION_MS = 1000;

export function markEffect(kind: EffectKind) {
  lastFiredAt[kind] = Date.now();
}

/**
 * True if the *other* effect fired within the collision window. The caller
 * decides what to do about it — both currently reschedule themselves rather
 * than dropping the event, because a skipped strike is a strike the user never
 * gets and the whole point is that these arrive on their own.
 */
export function collidesWithOther(kind: EffectKind): boolean {
  const other: EffectKind = kind === "lightning" ? "glitch" : "lightning";
  return Date.now() - lastFiredAt[other] < COLLISION_MS;
}

/** The stagger to apply on a collision. Long enough to separate, short enough
 *  that the effect still feels spontaneous rather than queued. */
export const STAGGER_MS = () => 300 + Math.random() * 300;
