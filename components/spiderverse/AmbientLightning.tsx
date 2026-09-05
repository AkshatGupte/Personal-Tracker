"use client";

import { useEffect, useRef, useState } from "react";
import { collidesWithOther, markEffect, STAGGER_MS } from "./effectClock";
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

  /*
    Generation 0. The trunk barely tapers — it is the channel everything else
    hangs off, and a trunk that thinned as fast as its branches would leave the
    figure with no spine.

    **Short jags, many of them.** This ran 4-7 segments of 46-72px, which is a
    near-straight line with a couple of kinks: photographed against the
    reference it read as a bare tree branch rather than a discharge. A real
    channel changes direction constantly and travels a long way doing it, so the
    segment count roughly doubled and each one is now about half as long. Same
    total reach, an order more angularity.
  */
  const trunkAngle = outward + (next() - 0.5) * 0.7;
  const trunk = grow(
    next,
    [0, 0],
    trunkAngle,
    19 + next() * 13,
    4.4,
    10 + Math.floor(next() * 5), // 10-14
    strokes,
    1.4,
    0.988,
    0.978,
  );

  // Generation 1. More forks than before, and shorter: the reference's density
  // comes from the number of branches, not from their length.
  const gen1Count = 5 + Math.floor(next() * 4); // 5-8
  for (const at of forkPoints(next, trunk, gen1Count)) {
    const side = next() < 0.5 ? -1 : 1;
    const branch = grow(
      next,
      trunk[at],
      trunkAngle + side * (0.5 + next() * 1.15),
      18 + next() * 16,
      2.5,
      3 + Math.floor(next() * 3), // 3-5
      strokes,
      1.05,
    );

    // Generation 2 — the level that makes it read as a Lichtenberg figure
    // rather than a bolt with a couple of forks.
    const gen2Count = 2 + Math.floor(next() * 3); // 2-4
    for (const sub of forkPoints(next, branch, gen2Count)) {
      const subSide = next() < 0.5 ? -1 : 1;
      const twig = grow(
        next,
        branch[sub],
        trunkAngle + subSide * (0.7 + next() * 1.2),
        11 + next() * 10,
        1.4,
        2 + Math.floor(next() * 3), // 2-4
        strokes,
        1.25,
      );

      /*
        Generation 3 — the capillaries.

        The reference is *feathery*: the extremities dissolve into a haze of
        very short hairs rather than ending in three visible twigs. Two
        generations gave a clean, countable tree; this is the level at which the
        eye stops counting branches and starts reading it as electricity.
      */
      if (next() < 0.75) {
        for (const tip of forkPoints(next, twig, 1 + Math.floor(next() * 2))) {
          grow(
            next,
            twig[tip],
            trunkAngle + (next() < 0.5 ? -1 : 1) * (0.9 + next() * 1.4),
            5 + next() * 7,
            0.8,
            1 + Math.floor(next() * 2), // 1-2
            strokes,
            1.5,
          );
        }
      }
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
  /*
    How many strikes are live, decided synchronously.

    The cap used to be applied inside the `setStrikes` updater, which is the
    natural place for it — until the shared effect clock needed to know, in the
    same tick, whether a strike had actually been accepted. React batches that
    updater, so a flag set inside it is still false when the dispatch returns,
    and the glitch spawner was reading "no lightning fired" from a tick that had
    just fired one. Measured: the two staggered apart on only two runs in five.
  */
  const live = useRef(0);

  useEffect(() => {
    if (reduced) return; // Disabled outright, not slowed.
    let alive = true;

    const spawn = () => {
      // The ambient glitch runs on its own independent timer, so every few
      // minutes the two coincide. Neither is suppressed — one just gets out of
      // the other's way by a few hundred ms. See effectClock.
      if (collidesWithOther("lightning")) {
        timers.current.push(setTimeout(spawn, STAGGER_MS()));
        return;
      }

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

      // One at a time, and rarely two. More than that stops reading as an
      // occasional fluctuation and starts reading as a storm.
      if (live.current >= 2) return;
      if (live.current === 1 && Math.random() > 0.18) return;

      live.current += 1;
      // Only a strike that actually drew counts as something to stagger around.
      markEffect("lightning");
      setStrikes((current) => [...current, strike]);

      timers.current.push(
        setTimeout(() => {
          live.current = Math.max(0, live.current - 1);
          setStrikes((c) => c.filter((s) => s.id !== strike.id));
        }, FLICKER_MS + hold + fade + 60),
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
      live.current = 0;
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
          {/*
            Three passes, not two: a wide soft bloom, a saturated cyan sheath,
            and a hot core.

            The pair this replaced — one blurred cyan pass at 3.6x under a
            `#8FF3FF` core — gave a thin bright filament with a faint halo. In
            the reference the bolt is a *thick* channel: a broad cyan glow, a
            solid cyan body inside it, and white heat down the middle of the
            heaviest runs. Splitting the glow into a far wide/soft pass and a
            near tight/bright one is what produces that depth; a single blurred
            pass can be wide or intense but not both.
          */}
          {/* The wide bloom skips the capillaries. A 0.8px hair grown to 5.6px
              and blurred by 9 contributes nothing an eye can find, and the
              third generation is most of the stroke count — measured at ~400
              paths per strike before this, against ~30 for the old two-pass
              figure. */}
          <g style={{ filter: "blur(9px)", opacity: 0.55 }}>
            {strike.strokes
              .filter((s) => s.width > 1.2)
              .map((s, i) => (
                <path
                  key={`b${i}`}
                  d={s.d}
                  stroke="var(--sv-cyan)"
                  strokeWidth={s.width * 7}
                  strokeLinecap="round"
                />
              ))}
          </g>
          <g style={{ filter: "blur(2.5px)", opacity: 0.95 }}>
            {strike.strokes.map((s, i) => (
              <path
                key={`g${i}`}
                d={s.d}
                stroke="var(--sv-cyan)"
                strokeWidth={s.width * 2.6}
                strokeLinecap="round"
              />
            ))}
          </g>
          <g>
            {strike.strokes.map((s, i) => (
              <path key={`c${i}`} d={s.d} stroke="#8FF3FF" strokeWidth={s.width} strokeLinecap="round" />
            ))}
          </g>
          {/* White heat, on the heavy runs only. Painting it down the
              capillaries too would flatten the taper that makes the figure
              read as self-similar. */}
          <g>
            {strike.strokes
              .filter((s) => s.width > 1.6)
              .map((s, i) => (
                <path
                  key={`h${i}`}
                  d={s.d}
                  stroke="#EAFEFF"
                  strokeWidth={s.width * 0.42}
                  strokeLinecap="round"
                />
              ))}
          </g>
        </svg>
      ))}
    </div>
  );
}
