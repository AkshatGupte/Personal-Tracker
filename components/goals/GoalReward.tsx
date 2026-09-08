"use client";

import { useEffect, useRef, useState } from "react";
import { rng } from "@/components/spiderverse/rng";
import { useReducedMotion } from "@/components/spiderverse/useReducedMotion";

/**
 * A number that travels to its new value instead of jumping.
 *
 * **Duration is bounded, not proportional.** 37 → 38 and 37 → 420 both land in
 * well under a second: a count-up that scales with the distance feels broken on
 * a large correction, because the reader has already read the new figure off the
 * progress bar and is waiting for the numeral to catch up with them.
 *
 * Under reduced motion it is simply the number. There is nothing to freeze here
 * — a half-counted figure is a wrong figure — so this is one of the few effects
 * that renders its end state rather than a neutral pose.
 */
export function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = from.current;
    if (start === value) return;
    const began = performance.now();
    const ms = Math.min(900, 220 + Math.abs(value - start) * 26);

    const step = (now: number) => {
      const t = Math.min(1, (now - began) / ms);
      // Ease-out cubic: quick off the mark, settles onto the figure.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (t < 1) frame.current = requestAnimationFrame(step);
      else from.current = value;
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      from.current = value;
    };
  }, [value, reduced]);

  return <span className={className}>{shown}</span>;
}

type Spark = { x: number; y: number; r: number; d: number; size: number; colour: string };

/**
 * The particle burst. Completion only.
 *
 * Squares in the four plate colours, thrown along their own angles from the
 * centre of the card. Deterministic from a seed so a re-render mid-flight does
 * not reshuffle them, and capped at 26 — past that it stops reading as ink
 * thrown off a press and starts reading as a party popper, which is the line
 * `CLAUDE.md` draws between premium and childish.
 */
export function SparkBurst({ seed, count = 26 }: { seed: number; count?: number }) {
  const reduced = useReducedMotion();
  if (reduced) return null;

  const next = rng(seed);
  const plates = ["var(--sv-magenta)", "var(--sv-cyan)", "var(--sv-yellow)", "var(--fg)"];
  const sparks: Spark[] = Array.from({ length: count }, () => {
    const angle = next() * Math.PI * 2;
    const distance = 60 + next() * 150;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 40, // biased upward, as thrown things are
      r: (next() - 0.5) * 540,
      d: 620 + next() * 620,
      size: 3 + Math.round(next() * 5),
      colour: plates[Math.floor(next() * plates.length)],
    };
  });

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
      {sparks.map((spark, i) => (
        <span
          key={i}
          className="sv-goal-spark absolute left-1/2 top-1/2 block"
          style={
            {
              width: spark.size,
              height: spark.size,
              background: spark.colour,
              "--sx": `${spark.x}px`,
              "--sy": `${spark.y}px`,
              "--sr": `${spark.r}deg`,
              "--sd": `${spark.d}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** What a write earned, floating up from the card corner. */
export function XpChip({ xp, fire }: { xp: number; fire: number }) {
  const reduced = useReducedMotion();
  if (xp <= 0) return null;
  return (
    <span
      key={fire}
      aria-hidden="true"
      className={`pointer-events-none absolute -top-1 right-2 font-label text-[0.75rem] uppercase tracking-[0.14em] text-streak ${
        reduced ? "" : "sv-goal-xp"
      }`}
    >
      +{xp} XP
    </span>
  );
}

export const MILESTONE_COPY: Record<number, string> = {
  25: "Milestone",
  50: "Halfway",
  75: "Almost there",
  100: "Goal complete",
};

/**
 * The banner: the loudest thing the goal system says, and it says it once.
 *
 * One element for both milestone and completion, differing only in plate and
 * dwell — the same device at two volumes, rather than two devices the reader has
 * to learn separately. It carries the announcement for assistive tech too, so
 * the celebration is not something only sighted users are told about.
 */
export function GoalBanner({
  label,
  xp,
  tone,
  fire,
}: {
  label: string;
  xp: number;
  tone: "milestone" | "complete";
  fire: number;
}) {
  const reduced = useReducedMotion();
  const complete = tone === "complete";
  return (
    <div
      key={fire}
      role="status"
      className={`pointer-events-none absolute inset-x-0 -top-3 z-20 flex justify-center ${
        reduced ? "" : "sv-goal-banner"
      }`}
      style={{ ["--bd" as string]: complete ? "2600ms" : "1900ms" }}
    >
      <span
        className="border-2 px-3 py-1 font-label text-[0.75rem] uppercase tracking-[0.16em]"
        style={{
          background: "var(--sv-ink)",
          borderColor: complete ? "var(--sv-yellow)" : "var(--sv-cyan)",
          color: complete ? "var(--sv-yellow)" : "var(--fg)",
        }}
      >
        {label}
        {xp > 0 && <span className="ml-2 text-streak">+{xp} XP</span>}
      </span>
    </div>
  );
}
