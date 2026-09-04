"use client";

import { useEffect, useRef, useState } from "react";
import { r1, rng } from "./rng";
import { useReducedMotion } from "./useReducedMotion";

/**
 * The film's glitch: the thing fractures into mismatched coloured shards.
 *
 * **A shatter, not a scanline offset.** Six to twelve triangles are laid over
 * the element, each clipped out of a solid plate colour, each knocked a few
 * pixels and a few degrees out of true before snapping back into alignment and
 * fading. That misalignment-then-register is the whole effect; the RGB split
 * that `GlitchText` does is a different, quieter device and both exist —
 * `GlitchText` for resting text accents, this for the instant something
 * changes.
 *
 * **Quick, not dramatic.** 220-360ms per shard with a small stagger. The film's
 * multi-second body glitch belongs to character moments; an interface confirming
 * an action gets the jolt version, or it becomes something to sit through.
 *
 * **Only for moments of change.** Never put this on an idle element: it says
 * "that just happened", and a version of it that repeats says nothing.
 *
 * Every shard animates `transform` and `opacity` and nothing else. `clip-path`
 * defines each triangle once and is never animated — the shatter reads from the
 * offset and the snap, and holding the path static keeps the whole thing on the
 * compositor with no per-frame path work.
 *
 * The palette deliberately has no green. The film's shards include one, but
 * this theme retired green with the old motif system, so the mismatch here is
 * built from the plates the theme does own plus one pure white.
 */

const PLATES = [
  "var(--sv-magenta)",
  "var(--sv-cyan)",
  "var(--sv-yellow)",
  "var(--sv-red)",
  "var(--sv-purple)",
  "#FFFFFF",
];

type Shard = {
  clip: string;
  color: string;
  dx: number;
  dy: number;
  rotate: number;
  opacity: number;
  delay: number;
  duration: number;
};

/**
 * Shards are seeded into a loose grid rather than scattered freely.
 *
 * Pure random placement clumps: three triangles land on one corner and half the
 * element never fractures at all. One shard per cell, jittered, covers the
 * whole surface while still looking unplanned.
 */
function buildShards(seed: number, count: number): Shard[] {
  const next = rng(seed);
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);

  return Array.from({ length: count }, (_, i) => {
    const cx = (((i % cols) + 0.5) / cols) * 100 + (next() - 0.5) * 22;
    const cy = ((Math.floor(i / cols) + 0.5) / rows) * 100 + (next() - 0.5) * 26;
    const reach = 26 + next() * 34;

    const points = Array.from({ length: 3 }, (_, k) => {
      const angle = (Math.PI * 2 * k) / 3 + next() * 1.7;
      const radius = reach * (0.55 + next() * 0.8);
      return `${r1(cx + Math.cos(angle) * radius)}% ${r1(cy + Math.sin(angle) * radius * 1.15)}%`;
    });

    return {
      clip: `polygon(${points.join(", ")})`,
      color: PLATES[Math.floor(next() * PLATES.length)],
      dx: (next() - 0.5) * 12, // ±6px
      dy: (next() - 0.5) * 12,
      rotate: (next() - 0.5) * 10, // ±5deg
      opacity: 0.5 + next() * 0.35,
      delay: Math.round(next() * 70),
      duration: Math.round(220 + next() * 140),
    };
  });
}

export default function GlitchShatter({
  fire = 0,
  count = 9,
  className = "",
}: {
  /** Change this to shatter. A counter, so consecutive triggers both play. */
  fire?: number;
  /** How many shards. 6-12 is the range the effect reads well in. */
  count?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [burst, setBurst] = useState<{ id: number; seed: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFire = useRef(fire);

  useEffect(() => {
    if (fire === lastFire.current) return;
    lastFire.current = fire;
    if (reduced || fire <= 0) return;

    setBurst((previous) => ({
      id: (previous?.id ?? 0) + 1,
      seed: Math.floor(Math.random() * 0x7fffffff),
    }));
    if (timer.current) clearTimeout(timer.current);
    // Longest shard: 70ms of stagger plus 360ms, with a little slack.
    timer.current = setTimeout(() => setBurst(null), 480);
  }, [fire, reduced]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!burst || reduced) return null;

  return (
    <div
      key={burst.id}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {buildShards(burst.seed, Math.min(12, Math.max(6, count))).map((shard, i) => (
        <div
          key={i}
          className="sv-shard absolute inset-0"
          style={{
            clipPath: shard.clip,
            background: shard.color,
            mixBlendMode: "screen",
            ["--shard-x" as string]: `${r1(shard.dx)}px`,
            ["--shard-y" as string]: `${r1(shard.dy)}px`,
            ["--shard-r" as string]: `${r1(shard.rotate)}deg`,
            ["--shard-o" as string]: shard.opacity,
            animationDelay: `${shard.delay}ms`,
            animationDuration: `${shard.duration}ms`,
          }}
        />
      ))}
    </div>
  );
}
