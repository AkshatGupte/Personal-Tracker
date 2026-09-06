"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * RGB-split glitch text. Zero dependencies.
 *
 * Three stacked copies of the same string: a base in paper-white and two
 * duplicates in magenta and cyan, offset against each other. That pairing on an
 * ink ground is the film's title-card signature.
 *
 * **The scheduling is the whole trick.** A glitch on a smooth loop reads as a
 * shader and stops being interesting after one cycle; real interference arrives
 * in short bursts with dead air between them. So this fires 2-5 *discrete*
 * frames over 50-190ms, then goes quiet for seconds. Frames snap rather than
 * tween — an eased transition would smear the jump back into a loop.
 *
 * Ported from the design-system version, which drove the same thing through
 * Framer Motion. It used `animate` with `duration: 0`, i.e. it was already only
 * setting styles, so the library was doing nothing a plain inline transform
 * cannot — and this app has no animation dependency and is not gaining one.
 * `useReducedMotion` and `useInView` are replaced by the two small hooks below.
 *
 * Only the duplicates move; the readable layer never does. The duplicates are
 * aria-hidden, so the string is announced once — verified against Chrome's
 * accessibility tree, not assumed.
 */

type Intensity = "subtle" | "medium" | "heavy";
type Trigger = "hover" | "auto" | "onView";

interface GlitchTextProps {
  text: string;
  intensity?: Intensity;
  trigger?: Trigger;
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div";
  /** True SVG chromatic aberration. Hero type only — it is a per-pixel filter. */
  chromatic?: boolean | "heavy";
  baseColor?: string;
  /** `screen` glows on a dark ground; `normal` on a saturated fill. */
  blend?: "screen" | "normal";
  className?: string;
}

interface Tuning {
  offset: number;
  steps: number;
  burst: [number, number];
  pause: [number, number];
  slices: number;
}

/**
 * The three levels separate on every axis at once — 2/4/7px of travel, 2/3/5
 * frames, and roughly 6s / 3s / 1.4s of average dead air — because amplitude
 * alone left `subtle` and `medium` indistinguishable side by side.
 */
const TUNING: Record<Intensity, Tuning> = {
  subtle: { offset: 2, steps: 2, burst: [50, 90], pause: [4500, 9000], slices: 0 },
  medium: { offset: 4, steps: 3, burst: [80, 150], pause: [1800, 4500], slices: 1 },
  heavy: { offset: 7, steps: 5, burst: [90, 190], pause: [700, 2200], slices: 3 },
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = ([min, max]: [number, number]) => rand(min, max);

/** matchMedia, guarded for SSR and for the older addListener signature. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

function useInView(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!enabled || !ref.current) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.4 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [ref, enabled]);
  return inView;
}

interface Frame {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  bands: Array<{ top: number; height: number; shift: number }>;
}

const REST: Frame = { ax: 0, ay: 0, bx: 0, by: 0, bands: [] };

function makeFrame(t: Tuning): Frame {
  // Alternating axes: one plate leads horizontally, the other vertically, so
  // the pair scissors apart instead of sliding as one block.
  const ax = rand(-t.offset, t.offset);
  const ay = rand(-t.offset, t.offset) * 0.4;
  const bands = Array.from({ length: t.slices }, () => ({
    top: rand(0, 82),
    height: rand(4, 16),
    shift: rand(-t.offset * 2.4, t.offset * 2.4),
  }));
  return { ax, ay, bx: -ax * rand(0.6, 1.2), by: -ay * rand(0.6, 1.4), bands };
}

export function GlitchText({
  text,
  intensity = "medium",
  trigger = "auto",
  as: Host = "span",
  chromatic = false,
  baseColor = "var(--fg)",
  blend = "screen",
  className = "",
}: GlitchTextProps) {
  const tuning = TUNING[intensity];
  const reduced = usePrefersReducedMotion();

  const hostRef = useRef<HTMLElement | null>(null);
  const inView = useInView(hostRef, trigger === "onView");
  const [hovered, setHovered] = useState(false);
  const [frame, setFrame] = useState<Frame>(REST);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const active =
    !reduced && (trigger === "auto" ? true : trigger === "hover" ? hovered : inView);

  useEffect(() => {
    if (!active) {
      clearTimers();
      setFrame(REST);
      return;
    }
    let alive = true;

    const runBurst = () => {
      if (!alive) return;
      const steps = tuning.steps;
      const stepMs = pick(tuning.burst) / steps;
      let i = 0;
      const step = () => {
        if (!alive) return;
        if (i >= steps) {
          setFrame(REST);
          schedule();
          return;
        }
        setFrame(makeFrame(tuning));
        i += 1;
        timers.current.push(setTimeout(step, stepMs));
      };
      step();
    };

    const schedule = () => {
      if (!alive) return;
      timers.current.push(setTimeout(runBurst, pick(tuning.pause)));
    };

    // Randomised first delay, so several instances never sync into a chorus —
    // which instantly reads as "a CSS animation".
    timers.current.push(setTimeout(runBurst, rand(120, 900)));

    return () => {
      alive = false;
      clearTimers();
    };
  }, [active, tuning, clearTimers]);

  // Block-level hosts must stay block-level: forcing inline-block on an h1
  // makes two consecutive headings share a line.
  const display = Host === "span" ? "inline-block" : "block";
  // `sv-glitch-layer` carries no styling of its own — it is the hook the ink
  // halo uses to stay off the duplicate channel copies. See `globals.css`.
  const layer =
    "sv-glitch-layer absolute inset-0 select-none pointer-events-none will-change-transform";
  const filterId = chromatic === "heavy" ? "url(#sv-chromatic-heavy)" : "url(#sv-chromatic)";

  return (
    <Host
      ref={hostRef as never}
      className={`relative ${display} ${className}`}
      onMouseEnter={trigger === "hover" ? () => setHovered(true) : undefined}
      onMouseLeave={trigger === "hover" ? () => setHovered(false) : undefined}
      style={chromatic ? { filter: filterId } : undefined}
    >
      <span
        aria-hidden
        className={layer}
        style={{
          color: "var(--sv-split-a)",
          mixBlendMode: blend,
          transform: `translate3d(${frame.ax}px, ${frame.ay}px, 0)`,
        }}
      >
        {text}
      </span>
      <span
        aria-hidden
        className={layer}
        style={{
          color: "var(--sv-split-b)",
          mixBlendMode: blend,
          transform: `translate3d(${frame.bx}px, ${frame.by}px, 0)`,
        }}
      >
        {text}
      </span>

      {/* Torn bands, only during a burst and only at higher intensities. */}
      {frame.bands.map((band, i) => (
        <span
          key={i}
          aria-hidden
          className={layer}
          style={{
            color: i % 2 ? "var(--sv-split-b)" : "var(--sv-split-a)",
            clipPath: `polygon(0 ${band.top}%, 100% ${band.top}%, 100% ${
              band.top + band.height
            }%, 0 ${band.top + band.height}%)`,
            transform: `translate3d(${band.shift}px, 0, 0)`,
          }}
        >
          {text}
        </span>
      ))}

      <span className="relative" style={{ color: baseColor }}>
        {text}
      </span>
    </Host>
  );
}
