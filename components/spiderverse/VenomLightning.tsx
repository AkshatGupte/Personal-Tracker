"use client";

import { useEffect, useRef, useState } from "react";
import { r1, rng } from "./rng";
import { useReducedMotion } from "./useReducedMotion";

/**
 * A bio-electric arc, in the shape Miles' venom strike actually takes.
 *
 * **Branching and jagged, never a smooth neon glow.** The reference is an
 * electric discharge forking through a hand, so the geometry is straight `L`
 * segments with hard angle changes — no curve commands anywhere in here — and
 * a main bolt that throws two to four shorter branches off its interior
 * vertices. Each branch steps away in two or three jags, losing about 40% of
 * its length and 45% of its width at every step, so it tapers to a thread
 * rather than stopping at full weight.
 *
 * **It flickers, it does not pulse.** Real discharge is instantaneous and
 * irregular, so a strike is three hard on/off frames inside roughly 70ms and
 * then a fade — `sv-bolt` in globals.css cuts between opacities with no
 * interpolation. A smooth loop would read as a neon sign, which is the exact
 * thing this is not.
 *
 * **Every strike is a new bolt.** The seed is drawn per strike, after mount, so
 * two strikes in the same place are never the same shape. That is safe here
 * precisely because nothing is server-rendered: the component draws nothing at
 * rest, so there is no markup for a hydration check to disagree with.
 *
 * Only `opacity` is animated. The geometry is generated once per strike and the
 * blur is a static paint filter, so nothing here can trigger layout.
 */

type Pt = [number, number];
type Stroke = { d: string; width: number };

/**
 * One bolt: a jagged spine across the box, plus tapering forks.
 *
 * The spine's endpoints are pinned near the mid-line while its interior points
 * are free to throw. A bolt that starts and ends wherever it likes reads as a
 * stray scribble; one that enters and leaves level reads as current passing
 * *through* something, which is the whole idea.
 */
function buildBolt(seed: number, w: number, h: number) {
  const next = rng(seed);
  const segments = 3 + Math.floor(next() * 4); // 3-6

  const spine: Pt[] = [];
  for (let i = 0; i <= segments; i++) {
    const end = i === 0 || i === segments;
    const spread = end ? 0.08 : 0.44;
    spine.push([(i / segments) * w, h / 2 + (next() - 0.5) * h * 2 * spread]);
  }

  const strokes: Stroke[] = [
    { d: `M ${spine.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(" L ")}`, width: 1.7 },
  ];

  const forks = 2 + Math.floor(next() * 3); // 2-4
  for (let f = 0; f < forks; f++) {
    // Interior vertices only: a fork from an endpoint looks like a second bolt.
    const at = 1 + Math.floor(next() * Math.max(1, segments - 1));
    let [x, y] = spine[at];
    let angle = (next() < 0.5 ? -1 : 1) * (0.5 + next() * 0.9); // 29-80 degrees off
    let len = (w / segments) * (0.45 + next() * 0.55);
    let width = 1.2;

    for (let step = 0, steps = 2 + Math.floor(next() * 2); step < steps; step++) {
      angle += (next() - 0.5) * 0.9;
      const nx = x + Math.cos(angle) * len;
      const ny = y + Math.sin(angle) * len;
      strokes.push({ d: `M ${r1(x)} ${r1(y)} L ${r1(nx)} ${r1(ny)}`, width });
      x = nx;
      y = ny;
      len *= 0.6;
      width *= 0.55;
    }
  }

  return strokes;
}

export type LightningProps = {
  /**
   * Change this to fire a strike. A counter rather than a boolean, so two
   * strikes in a row are two distinct values and the second is not swallowed.
   */
  fire?: number;
  /** Fire on its own every 8-15s. For ambient power-fluctuation accents. */
  idle?: boolean;
  width?: number;
  height?: number;
  className?: string;
};

export default function VenomLightning({
  fire = 0,
  idle = false,
  width = 120,
  height = 34,
  className = "",
}: LightningProps) {
  const reduced = useReducedMotion();
  const [strike, setStrike] = useState<{ id: number; seed: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastFire = useRef(fire);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // A strike removes itself. It is a moment, not a state, so nothing is left
  // on screen once it has played.
  const play = () =>
    setStrike((previous) => {
      const id = (previous?.id ?? 0) + 1;
      timers.current.push(setTimeout(() => setStrike(null), 320));
      return { id, seed: Math.floor(Math.random() * 0x7fffffff) };
    });

  useEffect(() => {
    if (fire === lastFire.current) return;
    lastFire.current = fire;
    if (reduced || fire <= 0) return;
    play();
  }, [fire, reduced]);

  useEffect(() => {
    if (!idle || reduced) return;
    let alive = true;
    /*
      Sparse on purpose. The brief calls this an ambient power fluctuation, and
      anything more frequent stops reading as a fluctuation and starts reading
      as a loop — the same failure the glitch bursts are tuned against.
    */
    const schedule = () => {
      const wait = 8000 + Math.random() * 7000;
      timers.current.push(
        setTimeout(() => {
          if (!alive) return;
          play();
          schedule();
        }, wait),
      );
    };
    schedule();
    return () => {
      alive = false;
      clear();
    };
  }, [idle, reduced]);

  useEffect(() => () => clear(), []);

  // Nothing at rest, and nothing at all under reduced motion: a bolt frozen at
  // its neutral pose would be a permanent scribble over the interface, which is
  // not what "keep the identity, stop the movement" means for a transient.
  if (!strike || reduced) return null;

  const strokes = buildBolt(strike.seed, width, height);

  return (
    <svg
      key={strike.id}
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`sv-bolt pointer-events-none absolute ${className}`}
      style={{ overflow: "visible" }}
      fill="none"
    >
      {/* The discharge glow: the same geometry, heavier and blurred, behind the
          core. A static paint filter — never animated. */}
      <g style={{ filter: "blur(2.5px)", opacity: 0.55 }}>
        {strokes.map((s, i) => (
          <path
            key={`g${i}`}
            d={s.d}
            stroke="var(--sv-cyan)"
            strokeWidth={s.width * 3.2}
            strokeLinecap="round"
            strokeLinejoin="miter"
          />
        ))}
      </g>
      {/* The core, a touch whiter than the plate so it reads as hotter. */}
      <g>
        {strokes.map((s, i) => (
          <path
            key={`c${i}`}
            d={s.d}
            stroke="#8FF3FF"
            strokeWidth={s.width}
            strokeLinecap="round"
            strokeLinejoin="miter"
          />
        ))}
      </g>
    </svg>
  );
}
