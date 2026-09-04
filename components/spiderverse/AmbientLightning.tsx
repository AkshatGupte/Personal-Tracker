"use client";

import { useEffect, useRef, useState } from "react";
import { r1, rng } from "./rng";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Lichtenberg discharge, breaking off the interface's own edges.
 *
 * **Ambient, and deliberately uncorrelated with anything the user does.** An
 * earlier version fired on the ADD press and on elevation rising; all of that
 * wiring is gone. A strike now arrives on its own every 8-18 seconds and means
 * nothing — it is weather, not feedback. Anything that reports a state change
 * would have to be reliable, and this is explicitly not.
 *
 * **A strike starts on a border and grows away from it.** Origins are sampled
 * along the real edges of real elements — panel borders, the masthead rule, the
 * page column — so the discharge reads as coming *off* the interface rather
 * than floating over it. The first segment leaves along the edge's outward
 * normal with a little angular slop, which is what sells "breaking off".
 *
 * **Three generations, because two is a bolt with forks.** A Lichtenberg figure
 * is self-similar: the same forking logic repeats at every scale, so a branch
 * zoomed in looks like the whole. Generation 0 is the trunk, generation 1 forks
 * off its vertices, and generation 2 forks off *those* — with the same 0.6
 * length and 0.55 width falloff applied per jag at every level, which is what
 * tapers the extremities to capillary threads instead of leaving them blunt.
 *
 * Geometry is straight `L` segments throughout. There is no curve command in
 * this file and there should not be: a discharge follows the path of least
 * resistance in straight runs and turns sharply, and a curve reads as a ribbon.
 */

type Pt = [number, number];
type Stroke = { d: string; width: number };

/** Half-width of a strike's canvas. Local (0,0) is the origin on the border. */
const REACH = 260;

/** Falloff per jag, carried over unchanged from the original bolt. */
const LEN_FALLOFF = 0.6;
const WIDTH_FALLOFF = 0.55;

/**
 * Grows one run of jagged segments, returning the vertices it passed through so
 * a later generation can fork off them.
 */
function grow(
  next: () => number,
  start: Pt,
  angle: number,
  length: number,
  width: number,
  jags: number,
  out: Stroke[],
  wander: number,
  lenFalloff = LEN_FALLOFF,
  widthFalloff = WIDTH_FALLOFF,
): Pt[] {
  const vertices: Pt[] = [start];
  let [x, y] = start;
  let a = angle;
  let len = length;
  let w = width;

  for (let i = 0; i < jags; i++) {
    a += (next() - 0.5) * wander;
    const nx = x + Math.cos(a) * len;
    const ny = y + Math.sin(a) * len;
    out.push({ d: `M ${r1(x)} ${r1(y)} L ${r1(nx)} ${r1(ny)}`, width: Math.max(0.35, w) });
    x = nx;
    y = ny;
    vertices.push([x, y]);
    len *= lenFalloff;
    w *= widthFalloff;
  }
  return vertices;
}

/** Picks `count` distinct interior vertices to fork from. */
function forkPoints(next: () => number, vertices: Pt[], count: number): number[] {
  const candidates = vertices.map((_, i) => i).slice(1, Math.max(2, vertices.length - 1));
  const chosen: number[] = [];
  while (chosen.length < Math.min(count, candidates.length)) {
    const pick = candidates[Math.floor(next() * candidates.length)];
    if (!chosen.includes(pick)) chosen.push(pick);
  }
  return chosen;
}

/**
 * The whole figure, in local coordinates with the border origin at (0,0).
 *
 * `outward` is the edge's normal, so the trunk leaves the border rather than
 * running along it or diving back through it.
 */
function buildFigure(seed: number, outward: number) {
  const next = rng(seed);
  const strokes: Stroke[] = [];

  // Generation 0. The trunk barely tapers — it is the channel everything else
  // hangs off, and a trunk that thinned as fast as its branches would leave the
  // figure with no spine.
  const trunkAngle = outward + (next() - 0.5) * 0.7;
  const trunk = grow(
    next,
    [0, 0],
    trunkAngle,
    46 + next() * 26,
    2.6,
    4 + Math.floor(next() * 4), // 4-7
    strokes,
    0.85,
    0.94,
    0.93,
  );

  // Generation 1.
  const gen1Count = 3 + Math.floor(next() * 3); // 3-5
  for (const at of forkPoints(next, trunk, gen1Count)) {
    const side = next() < 0.5 ? -1 : 1;
    const branch = grow(
      next,
      trunk[at],
      trunkAngle + side * (0.45 + next() * 0.85),
      30 + next() * 20,
      1.9,
      2 + Math.floor(next() * 3), // 2-4
      strokes,
      0.95,
    );

    // Generation 2 — the level that makes it read as a Lichtenberg figure
    // rather than a bolt with a couple of forks.
    const gen2Count = 1 + Math.floor(next() * 3); // 1-3
    for (const sub of forkPoints(next, branch, gen2Count)) {
      const subSide = next() < 0.5 ? -1 : 1;
      grow(
        next,
        branch[sub],
        trunkAngle + subSide * (0.7 + next() * 1.1),
        14 + next() * 12,
        1.0,
        2 + Math.floor(next() * 2), // 2-3
        strokes,
        1.1,
      );
    }
  }

  return strokes;
}

type Edge = { x: number; y: number; dx: number; dy: number; outward: number };

/**
 * Every border a strike is allowed to leave from, in document coordinates.
 *
 * Recomputed per strike rather than cached: panels come and go with the data,
 * and a stale rect would hang a discharge in empty space. Only edges currently
 * on screen are offered, so ambient movement never happens where nobody is.
 */
function collectEdges(): Edge[] {
  const edges: Edge[] = [];
  const sx = window.scrollX;
  const sy = window.scrollY;

  const push = (r: DOMRect, sides: Array<"top" | "right" | "bottom" | "left">) => {
    if (r.width < 40 || r.bottom < 0 || r.top > window.innerHeight) return;
    const x = r.x + sx;
    const y = r.y + sy;
    for (const side of sides) {
      if (side === "top") edges.push({ x, y, dx: r.width, dy: 0, outward: -Math.PI / 2 });
      if (side === "bottom") edges.push({ x, y: y + r.height, dx: r.width, dy: 0, outward: Math.PI / 2 });
      if (side === "left") edges.push({ x, y, dx: 0, dy: r.height, outward: Math.PI });
      if (side === "right") edges.push({ x: x + r.width, y, dx: 0, dy: r.height, outward: 0 });
    }
  };

  document.querySelectorAll(".sv-panel").forEach((el) => {
    push(el.getBoundingClientRect(), ["top", "right", "bottom", "left"]);
  });
  // The masthead rule: its underline is the element's bottom edge.
  const rule = document.querySelector("nav > div:first-child");
  if (rule) push(rule.getBoundingClientRect(), ["bottom"]);
  // The page column's own sides — the outer frame of the reading area.
  const column = document.querySelector("[class*='max-w-5xl']");
  if (column) push(column.getBoundingClientRect(), ["left", "right"]);

  return edges;
}

type Strike = {
  id: number;
  x: number;
  y: number;
  strokes: Stroke[];
  hold: number;
  fade: number;
};

const FLICKER_MS = 90;

export default function AmbientLightning() {
  const reduced = useReducedMotion();
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    if (reduced) return; // Disabled outright, not slowed.
    let alive = true;

    const spawn = () => {
      const edges = collectEdges();
      if (edges.length === 0) return;

      const edge = edges[Math.floor(Math.random() * edges.length)];
      // Anywhere along the edge, not just its ends.
      const t = 0.08 + Math.random() * 0.84;
      const seed = Math.floor(Math.random() * 0x7fffffff);
      const hold = 1000 + Math.random() * 800; // 1.0-1.8s
      const fade = 400 + Math.random() * 300; // 0.4-0.7s

      const strike: Strike = {
        id: (nextId.current += 1),
        x: edge.x + edge.dx * t,
        y: edge.y + edge.dy * t,
        strokes: buildFigure(seed, edge.outward),
        hold,
        fade,
      };

      setStrikes((current) => {
        // One at a time, and rarely two. More than that stops reading as an
        // occasional fluctuation and starts reading as a storm.
        if (current.length >= 2) return current;
        if (current.length === 1 && Math.random() > 0.18) return current;
        return [...current, strike];
      });

      timers.current.push(
        setTimeout(
          () => setStrikes((c) => c.filter((s) => s.id !== strike.id)),
          FLICKER_MS + hold + fade + 60,
        ),
      );
    };

    const schedule = () => {
      const gap = 8000 + Math.random() * 10000; // 8-18s, averaging ~13
      timers.current.push(
        setTimeout(() => {
          if (!alive) return;
          spawn();
          schedule();
        }, gap),
      );
    };

    // A first strike soon after arrival, so the page is not silent for a
    // quarter of a minute before anything happens.
    timers.current.push(setTimeout(spawn, 2500 + Math.random() * 3000));
    schedule();

    // The lab drives this directly; nothing in the app dispatches it.
    const force = () => spawn();
    window.addEventListener("sv:lightning", force);

    return () => {
      alive = false;
      window.removeEventListener("sv:lightning", force);
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [reduced]);

  if (reduced || strikes.length === 0) return null;

  return (
    /*
      Full page width and clipped on the x axis only.

      Each strike is a 520px canvas centred on its origin, so one leaving a
      border near the right edge of a narrow viewport pushed the document 260px
      wider and produced a horizontal scrollbar — measured at 320px. `clip`
      rather than `hidden` because clip does not create a scroll container, and
      clipping only x leaves the discharge free to run off the top or bottom,
      which is where it should be free to go.
    */
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-30 w-full"
      style={{ overflowX: "clip", overflowY: "visible" }}
    >
      {strikes.map((strike) => (
        <svg
          key={strike.id}
          width={REACH * 2}
          height={REACH * 2}
          viewBox={`${-REACH} ${-REACH} ${REACH * 2} ${REACH * 2}`}
          className="sv-strike pointer-events-none absolute"
          style={{
            left: strike.x - REACH,
            top: strike.y - REACH,
            overflow: "visible",
            // Flicker in hard, hold, then fade smoothly. Two animations rather
            // than one keyframe, because the hold is randomised per strike and
            // a single scaled keyframe would stretch the flicker with it.
            animation: `sv-strike-in ${FLICKER_MS}ms linear, sv-strike-out ${strike.fade}ms cubic-bezier(0.4, 0, 0.7, 1) ${FLICKER_MS + strike.hold}ms forwards`,
          }}
          fill="none"
        >
          <g style={{ filter: "blur(3px)", opacity: 0.75 }}>
            {strike.strokes.map((s, i) => (
              <path
                key={`g${i}`}
                d={s.d}
                stroke="var(--sv-cyan)"
                strokeWidth={s.width * 3.6}
                strokeLinecap="round"
              />
            ))}
          </g>
          <g>
            {strike.strokes.map((s, i) => (
              <path key={`c${i}`} d={s.d} stroke="#8FF3FF" strokeWidth={s.width} strokeLinecap="round" />
            ))}
          </g>
        </svg>
      ))}
    </div>
  );
}
