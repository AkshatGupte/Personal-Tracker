"use client";

import { useEffect, useRef, useState } from "react";
import { buildShards, type Shard } from "./GlitchShatter";
import { r1, rng } from "./rng";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Dimensional voids — holes that open in the atmosphere and briefly corrupt the
 * reality in front of them.
 *
 * ## The two layers, and why there have to be two
 *
 * **The void** is drawn at `-z-10`, mounted after `DimensionalThreads`, so it
 * paints over the rift glows and the neon structures and under every piece of
 * UI. Flat `#000` on a `#0a0a0f` ground: over bare background it is a
 * barely-perceptible darkening, and it only becomes an unmistakable hole where
 * there was something lit to swallow. That occlusion is what makes it a hole
 * rather than a shape.
 *
 * **The corruption** is drawn at `z-30`, above the content, and this is not
 * negotiable: a layer behind the interface cannot corrupt text painted in front
 * of it, and "put a black shape over the text" is the exact failure this effect
 * exists to avoid. So a burst is a separate, transient overlay in the same
 * position `AmbientLightning` and `AmbientGlitch` already occupy —
 * `pointer-events: none`, nothing mutated, gone in under half a second.
 *
 * The burst's core element is the void's **own silhouette**, filled not with
 * ink but with a `backdrop-filter`. So during a burst the hole punches
 * *through* to the front, and what shows inside it is the real interface,
 * displaced and channel-split. That also resolves the layering mismatch: a void
 * sitting behind an opaque panel is invisible until it corrupts, and then it
 * arrives through the panel, which is the right reading.
 *
 * ## Why `backdrop-filter`, and what it buys
 *
 * It samples the *actually rendered pixels* behind the element, so this is real
 * corruption of the real interface rather than a decoration that resembles it:
 *
 * - `url(#sv-void-warp)` — `feTurbulence` into `feDisplacementMap`. Genuine
 *   displacement: text under it is dragged into illegible ink and springs back.
 *   Nothing else in CSS can move the backdrop's pixels, which is why this is a
 *   filter and not a stack of offset copies.
 * - `url(#sv-void-split)` — channel offsets on the backdrop. The device
 *   `ChromaticDefs` established, written separately here and wider, because
 *   that file is shared with `GlitchText` and the page transition and must not
 *   be retuned for this.
 * - plain function filters (`invert`, `hue-rotate`, `brightness(0.08)`) for the
 *   tear slices and the swallow, which need no filter graph.
 *
 * `CLAUDE.md` warns against SVG filters over a route subtree. This is the
 * opposite case and that warning's own escape clause: one small region, for a
 * few hundred milliseconds, one at a time.
 *
 * ## Why each void generates its own keyframes
 *
 * The previous version shared five global keyframes and varied only durations
 * and offsets, which is why every void behaved identically however those
 * numbers were retuned — a slow creep and a hard positional cut cannot come out
 * of one shared curve. Each piece now emits its **own** `@keyframes`, and
 * because CSS lets a keyframe stop carry its own `animation-timing-function`, a
 * single track can hold eased drift, `steps(1,end)` snaps and a frantic burst in
 * sequence. Several time scales in one animation, still entirely on the
 * compositor, still nothing ticking per frame.
 *
 * The silhouette boil is authored the same way rather than looped: a track of
 * irregular cel swaps, ~6fps while the void is quiet and ~18 while it is coming
 * apart.
 *
 * ## Archetypes, not parameters
 *
 * Five hand-written scripts — `crawler`, `rupture`, `swarm`, `corruptor`,
 * `blink` — differing in piece count, life length, pose sequence and how often
 * they corrupt. Randomising one script's numbers produces variations on one
 * behaviour; these are five behaviours.
 *
 * Shards come from `GlitchShatter`'s `buildShards` and ride its `.sv-shard`
 * class, so a burst is visibly the same fracture vocabulary the rest of the app
 * already speaks rather than a parallel invention.
 *
 * Absent under reduced motion — not slowed, not frozen.
 */

type Pt = [number, number];

/** One complete drawing of a piece — the unit the morph track swaps between. */
type Cel = {
  /** Centred on the origin, for the SVG's own `viewBox`. */
  blob: string;
  /** The same path in box coordinates, for `clip-path: path()`, which has no
   *  transform of its own. */
  boxed: string;
  /** Branching ink fractures running out of the edge. */
  cracks: Stroke[];
};

/** One straight run of a fracture. Width tapers along the branch. */
type Stroke = { d: string; w: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const pick = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/* ---------------------------------------------------------------- geometry */

/**
 * A closed Catmull-Rom spline through the points, as cubic Béziers.
 *
 * Curves rather than lines: a polygon reads as a facet of one of the Threads
 * structures, which is the one thing these must not be mistaken for.
 * Catmull-Rom passes exactly through every point, so the irregularity designed
 * into the radii survives into the drawn shape instead of being averaged away.
 */
function closedSpline(pts: Pt[], sharp: boolean[], ox = 0, oy = 0): string {
  const n = pts.length;
  const X = (i: number) => pts[i][0] + ox;
  const Y = (i: number) => pts[i][1] + oy;
  let d = `M ${r1(X(0))} ${r1(Y(0))}`;
  for (let i = 0; i < n; i++) {
    const p0 = (i - 1 + n) % n;
    const p1 = i;
    const p2 = (i + 1) % n;
    const p3 = (i + 2) % n;
    /*
      A zero tangent at a vertex is what makes a corner.

      Catmull-Rom smooths every point it passes through, and smoothing *every*
      point is precisely why the first version came out a soft potato however
      hard the radii were jittered — a torn hole is defined by its cusps and its
      notches, and this curve had neither. Collapsing the control point onto a
      vertex marked `sharp` gives that vertex a hard corner while its neighbours
      stay round, so one outline can carry both a smooth ink bulge and a
      splintered point.
    */
    const t1 = sharp[p1] ? 0 : 1;
    const t2 = sharp[p2] ? 0 : 1;
    const c1x = X(p1) + ((X(p2) - X(p0)) / 6) * t1;
    const c1y = Y(p1) + ((Y(p2) - Y(p0)) / 6) * t1;
    const c2x = X(p2) - ((X(p3) - X(p1)) / 6) * t2;
    const c2y = Y(p2) - ((Y(p3) - Y(p1)) / 6) * t2;
    d += ` C ${r1(c1x)} ${r1(c1y)}, ${r1(c2x)} ${r1(c2y)}, ${r1(X(p2))} ${r1(Y(p2))}`;
  }
  return `${d} Z`;
}

/**
 * One straight run of a fracture, returning the vertices it passed through so a
 * later generation can branch off them.
 *
 * Straight `L` segments, never curves. This is the same reasoning
 * `AmbientLightning` records for its discharge: a fracture follows the path of
 * least resistance in straight runs and turns sharply, and a curve reads as a
 * ribbon. The thing this replaced was a single smooth quadratic tendril, and a
 * smooth curve hanging off a blob is exactly what made the void read as a
 * decorated shape rather than as something splitting.
 */
function growCrack(
  next: () => number,
  start: Pt,
  angle: number,
  length: number,
  width: number,
  jags: number,
  out: Stroke[],
  wander: number,
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
    out.push({ d: `M ${r1(x)} ${r1(y)} L ${r1(nx)} ${r1(ny)}`, w: Math.max(0.4, w) });
    x = nx;
    y = ny;
    vertices.push([x, y]);
    len *= 0.7;
    w *= 0.52;
  }
  return vertices;
}

/**
 * A branching fracture running out of the void's edge.
 *
 * Three generations, tapering hard, so the extremities end as hairlines rather
 * than blunt stubs — the self-similarity is what makes it read as something
 * that cracked rather than as drawn lines.
 *
 * **Deliberately local rather than shared with `AmbientLightning`.** That file
 * is off limits, and the two want different numbers anyway: a discharge is a
 * long neon channel with a barely-tapering trunk, and this is short, black, and
 * taper-dominated. If they are ever unified, exporting `grow` and `forkPoints`
 * from the lightning is the move — they are pure geometry.
 */
function buildCrack(
  next: () => number,
  from: Pt,
  angle: number,
  length: number,
  width: number,
): Stroke[] {
  const out: Stroke[] = [];
  const trunk = growCrack(next, from, angle, length, width, 2 + Math.floor(next() * 3), out, 0.95);

  const branch = (vertices: Pt[], count: number, scale: number, gen: number) => {
    for (let i = 0; i < count; i++) {
      if (vertices.length < 2) return;
      const at = 1 + Math.floor(next() * (vertices.length - 1));
      const from2 = vertices[at];
      const back = vertices[at - 1];
      const along = Math.atan2(from2[1] - back[1], from2[0] - back[0]);
      const side = (next() < 0.5 ? -1 : 1) * (0.5 + next() * 0.9);
      const kids = growCrack(
        next,
        from2,
        along + side,
        length * scale,
        width * scale,
        1 + Math.floor(next() * 2),
        out,
        1.2,
      );
      if (gen < 2) branch(kids, next() < 0.6 ? 1 : 0, scale * 0.6, gen + 1);
    }
  };
  branch(trunk, 1 + Math.floor(next() * 3), 0.55, 1);

  return out;
}

/** Room around the blob for fractures, ink bleed and transient overscale. */
const VIEW_SCALE = 1.95;

/**
 * How a void's outline is shaped. Four families, so two voids on screen are not
 * the same drawing at different sizes.
 *
 * The failure this exists to fix: one generator with jittered radii produces
 * one shape. However much the numbers move, a smooth closed curve with ±30% of
 * radius variation is a potato every time, and the screenshots showed exactly
 * that — a rounded blob with a hair.
 */
type Silhouette = "blot" | "tear" | "splinter" | "shatter";

const SILHOUETTES: Silhouette[] = ["blot", "tear", "splinter", "shatter"];

/**
 * Builds every cel of one piece.
 *
 * The *base* geometry — family, lobe count, radii, which vertices are cusps,
 * elongation, rotation, where the fractures hang from — is drawn once, so all
 * cels are unmistakably the same object; each cel then perturbs it. `spread` is
 * how hard: a resting void perturbs a few percent and boils, a rupturing one
 * perturbs hard and looks like it is tearing itself apart between frames.
 */
function buildCels(
  seed: number,
  radius: number,
  box: number,
  celCount: number,
  spread: number,
): { cels: Cel[]; crackWidth: number } {
  const next = rng(seed);
  const half = box / 2;
  const family = SILHOUETTES[Math.floor(next() * SILHOUETTES.length)];

  /*
    Vertex count, elongation and how violently the radius swings, per family.

    `squash` below 0.4 is a genuine slit rather than an oval, which is what
    makes a `tear` read as a rip in something instead of as a lozenge.
  */
  const lobes =
    family === "shatter" ? 12 + Math.floor(next() * 4) : 8 + Math.floor(next() * 4);
  const squash =
    family === "tear" ? 0.2 + next() * 0.18 : 0.5 + next() * 0.45;
  const spin = next() * Math.PI * 2;
  const cos = Math.cos(spin);
  const sin = Math.sin(spin);

  /*
    Which vertices are special is chosen up front, not rolled per vertex.

    An independent probability at each vertex distributes the spikes evenly
    around the ring, and an evenly spiked ring is a star — which is what the
    first splinter came out as. Picking a small set of indices and letting them
    land where they land gives one side of the shape three points and the other
    side none, which is what tearing actually looks like.
  */
  const special = new Set<number>();
  if (family === "splinter" || family === "blot") {
    const count = 2 + Math.floor(next() * 3);
    // Seeded from one position and walked unevenly, so they cluster.
    let at = Math.floor(next() * lobes);
    for (let k = 0; k < count; k++) {
      special.add(at % lobes);
      at += 1 + Math.floor(next() * 3);
    }
  }

  const base: { a: number; r: number; sharp: boolean }[] = [];
  for (let i = 0; i < lobes; i++) {
    const a = (Math.PI * 2 * i) / lobes + (next() - 0.5) * 0.5;
    // A wider resting range, so the mass between the special vertices is
    // already lopsided rather than a clean ring with features attached to it.
    let r = radius * (0.5 + next() * 0.6);
    let sharp = next() < 0.2;

    if (family === "splinter" && special.has(i)) {
      // A long spike with a hard point on the end.
      r = radius * (1.3 + next() * 0.55);
      sharp = true;
    } else if (family === "blot" && special.has(i)) {
      // A deep notch bitten out of the mass.
      r = radius * (0.22 + next() * 0.18);
      sharp = true;
    } else if (family === "shatter") {
      // Alternating in and out, most vertices angular: a hole that broke.
      r = radius * (i % 2 === 0 ? 0.95 + next() * 0.4 : 0.4 + next() * 0.28);
      sharp = next() < 0.72;
    } else if (family === "tear" && (i === 0 || i === Math.floor(lobes / 2))) {
      // The two ends of a rip are always points.
      r = radius * (1.15 + next() * 0.35);
      sharp = true;
    }
    base.push({ a, r, sharp });
  }

  /* Fractures, not one tendril. Some voids have none — a hole that is only a
     hole still belongs, and giving every one of them branches would make the
     branches the motif. */
  /*
    Scaled to the piece, for two reasons that happen to agree.

    Visually, a 20px fragment with three branching fractures reads as a bug —
    the branches are longer than the thing they came out of. Structurally, this
    is what bounds the path count: a swarm is up to six pieces, each with four
    cels, and an uncapped three fractures apiece would put ~700 stroke elements
    on screen for one void. Measured at 416 paths for three voids with no
    detectable frame cost, but that is a software rasteriser with nothing else
    to do, and there is no reason to spend it.
  */
  const crackBudget = radius < 26 ? 1 : radius < 46 ? 2 : 3;
  const crackCount = next() < 0.72 ? 1 + Math.floor(next() * crackBudget) : 0;
  const crackSpec = Array.from({ length: crackCount }, () => ({
    at: Math.floor(next() * lobes),
    spread: (next() - 0.5) * 1.1,
    /* Shorter than the first pass. At 0.42-1.02x the radius the branches were
       longer than the mass they came out of and read as twigs; a fracture
       should look like it came *off* the hole, so the hole has to stay the
       larger thing. */
    length: radius * (0.3 + next() * 0.42),
    seed: Math.floor(next() * 0x7fffffff),
  }));

  // Thick at the root, tapering hard along the branch: a split, not a stem.
  const crackWidth = Math.max(1.2, radius * 0.17);

  const cels: Cel[] = Array.from({ length: celCount }, (_, cel) => {
    const jitter = rng((seed ^ (0x9e3779b9 * (cel + 1))) >>> 0);

    const sharp: boolean[] = [];
    const pts: Pt[] = base.map(({ a, r, sharp: isSharp }) => {
      const ja = a + (jitter() - 0.5) * 0.09 * spread;
      const jr = r * (1 + (jitter() - 0.5) * 0.16 * spread);
      sharp.push(isSharp);
      const px = Math.cos(ja) * jr;
      const py = Math.sin(ja) * jr * squash;
      return [px * cos - py * sin, px * sin + py * cos];
    });

    const cracks = crackSpec.flatMap((spec) => {
      const anchor = pts[spec.at % pts.length];
      const outward = Math.atan2(anchor[1], anchor[0]) + spec.spread;
      return buildCrack(
        rng((spec.seed ^ (0x85ebca6b * (cel + 1))) >>> 0),
        anchor,
        outward,
        spec.length,
        crackWidth,
      );
    });

    return {
      blob: closedSpline(pts, sharp),
      boxed: closedSpline(pts, sharp, half, half),
      cracks,
    };
  });

  return { cels, crackWidth };
}

/* -------------------------------------------------------------- timelines */

/**
 * One moment in a piece's life. Everything a piece does is a list of these.
 *
 * `ease` is the timing function for the segment *starting* at this pose, which
 * is the whole reason a track can change character mid-flight: an eased stop
 * drifts to the next pose, a `steps(1,end)` stop holds and then cuts to it.
 */
type Pose = {
  at: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  rot: number;
  skew: number;
  o: number;
  ease?: string;
};

const EASE = {
  /** Slow and organic. Nothing in the environment moves faster than this. */
  drift: "cubic-bezier(0.4, 0, 0.6, 1)",
  /** No interpolation at all — the pose is held, and then it is somewhere else. */
  cut: "steps(1, end)",
  /** A hole tearing open. */
  punch: "cubic-bezier(0.15, 0.95, 0.3, 1)",
  /** Reality closing over. */
  collapse: "cubic-bezier(0.75, 0, 0.95, 0.25)",
  /** Two-frame stutter, borrowed from the glitch language. */
  stutter: "steps(2, end)",
} as const;

const REST: Omit<Pose, "at"> = { x: 0, y: 0, sx: 1, sy: 1, rot: 0, skew: 0, o: 1 };

function poseCss(p: Pose): string {
  return (
    `transform:translate3d(${r1(p.x)}px,${r1(p.y)}px,0) rotate(${r1(p.rot)}deg)` +
    ` skewX(${r1(p.skew)}deg) scale3d(${r2(Math.max(0, p.sx))},${r2(Math.max(0, p.sy))},1);` +
    `opacity:${r2(clamp01(p.o))}`
  );
}

/**
 * Turns a pose list into keyframes.
 *
 * Sorted and separated by time, because two stops at the same percentage
 * silently drop one — and a hard cut is *written* as two stops a whisker apart,
 * so this is exactly where that would bite.
 */
function keyframesFrom(name: string, poses: Pose[]): string {
  const sorted = [...poses].sort((a, b) => a.at - b.at);
  const out: Pose[] = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last && p.at - last.at < 0.0008) out.push({ ...p, at: last.at + 0.0008 });
    else out.push(p);
  }
  const body = out
    .map(
      (p) =>
        `${r2(clamp01(p.at) * 100)}%{${poseCss(p)}${p.ease ? `;animation-timing-function:${p.ease}` : ""}}`,
    )
    .join("");
  return `@keyframes ${name}{${body}}`;
}

/**
 * The silhouette track: which cel is showing, and when.
 *
 * Not a loop. `hot` marks the windows where the piece is coming apart, and
 * inside them the swap rate goes from a resting ~6fps to about 18 — the
 * difference between ink that is alive and ink that is failing. Every swap is a
 * hard cut, because hand-drawn animation does not cross-fade.
 */
function morphTracks(
  next: () => number,
  prefix: string,
  celCount: number,
  lifeMs: number,
  hot: { from: number; to: number }[],
  restMs: [number, number],
): { names: string[]; css: string } {
  const isHot = (u: number) => hot.some((h) => u >= h.from && u <= h.to);
  const boundaries: { t: number; cel: number }[] = [];
  let t = 0;
  let cel = 0;

  // Capped: a track is CSS text, and past a few dozen stops the extra frames
  // are not visible at these rates anyway.
  while (t < 1 && boundaries.length < 72) {
    boundaries.push({ t, cel });
    /*
      The swap rate rides the growth curve rather than switching between two
      speeds. `restMs` is [fast at the peak, slow at the seed], and `unrest`
      interpolates between them — so a young void boils at about 4fps and a
      peaked one redraws itself at nearly 20, and the acceleration is visible
      *as* the void grows instead of arriving at a window boundary.
    */
    const frameMs = isHot(t)
      ? 38 + next() * 26
      : (restMs[1] + (restMs[0] - restMs[1]) * unrest(t)) * (0.8 + next() * 0.45);
    t += frameMs / lifeMs;
    let n = Math.floor(next() * celCount);
    if (n === cel) n = (n + 1) % celCount;
    cel = n;
  }

  const names: string[] = [];
  let css = "";
  for (let k = 0; k < celCount; k++) {
    const name = `${prefix}m${k}`;
    names.push(name);
    const stops = boundaries
      .map((b) => `${r2(clamp01(b.t) * 100)}%{opacity:${b.cel === k ? 1 : 0}}`)
      .join("");
    css += `@keyframes ${name}{${stops}}`;
  }
  return { names, css };
}

/** Where a pose track has the piece at time `t`. Used to anchor a burst on the
 *  void rather than on the spot's nominal centre. */
function poseAt(poses: Pose[], t: number): { x: number; y: number; s: number } {
  let a = poses[0];
  let b = poses[poses.length - 1];
  for (let i = 0; i < poses.length - 1; i++) {
    if (t >= poses[i].at && t <= poses[i + 1].at) {
      a = poses[i];
      b = poses[i + 1];
      break;
    }
  }
  const span = Math.max(1e-6, b.at - a.at);
  const u = clamp01((t - a.at) / span);
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    s: a.sx + (b.sx - a.sx) * u,
  };
}

/* ------------------------------------------------------------- archetypes */

type Archetype = "crawler" | "rupture" | "swarm" | "corruptor" | "blink";

/**
 * Every void lives the same five-second arc: it seeds small and faint, grows,
 * grows *less stable* as it grows, peaks, and collapses.
 *
 * **The envelope is shared and the archetype is the character played over it.**
 * Before this, each archetype owned its whole timeline — the crawler drifted at
 * full size for twenty-two seconds, the blink was gone in one and a half — so
 * "how big is it" carried no meaning and a void's corruption had no relationship
 * to what the void was doing. Size is now the clock: everything else in the
 * effect is a function of it.
 *
 * That is also what makes the corruption feel earned rather than scheduled. A
 * burst's strength, its region and how violent the silhouette is at that moment
 * are all read off the same growth curve, so a small young void is quiet and a
 * peaked one throws the lightning.
 */

/** Where the void is largest. Everything after this is the collapse. */
const GROW_PEAK = 0.78;

/**
 * Scale at time `t`, from a seed to `peak`.
 *
 * Deliberately accelerating rather than linear: a constant growth rate reads as
 * a shape being scaled by something outside it, while an accelerating one reads
 * as something opening under its own pressure. The brief hold at full size
 * before the collapse is what gives the peak a moment to be seen — without it
 * the largest frame is also the first frame of the collapse and is never read.
 */
function growth(t: number, peak: number): number {
  if (t <= 0) return 0;
  if (t < 0.06) return (t / 0.06) * 0.16;
  if (t < GROW_PEAK) {
    const u = (t - 0.06) / (GROW_PEAK - 0.06);
    return 0.16 + Math.pow(u, 1.45) * (peak - 0.16);
  }
  if (t < 0.9) return peak;
  const u = (t - 0.9) / 0.1;
  return peak * (1 - u) * (1 - u);
}

/**
 * How present the ink is. Faint while it is small, solid once it has grown.
 *
 * "Small" alone is not "subtle": a hard black shape at 15% scale is still a hard
 * black shape, and it arrives as a dot rather than as something surfacing. The
 * opacity ramp is what makes the first second read as *almost* nothing.
 */
function presence(t: number): number {
  if (t < 0.03) return (t / 0.03) * 0.3;
  if (t < 0.34) return 0.3 + ((t - 0.03) / 0.31) * 0.52;
  return Math.min(1, 0.82 + ((t - 0.34) / 0.4) * 0.18);
}

/** Instability, 0 at the seed and 1 at the peak. Every wobble, skew, hard cut
 *  and flicker in the file is scaled by this, so the void comes apart in
 *  proportion to how big it has got. */
function unrest(t: number): number {
  return Math.pow(clamp01(t / GROW_PEAK), 1.7);
}

/** What separates one archetype from another, over the shared envelope. */
type Character = {
  /** Scale at full size. */
  peak: number;
  /** How many poses the life is cut into — the base resolution of its motion. */
  steps: number;
  /** Positional unrest in px at peak. */
  wobble: number;
  /** Rotational unrest in degrees at peak. */
  spin: number;
  /** Chance a late pose is a hard cut rather than a drift. */
  cutChance: number;
  /** Chance a late pose blanks for a frame. */
  flicker: number;
  /** How hard the silhouette squashes and skews at peak. */
  deform: number;
};

/**
 * The shared spine: seed, growth, escalating unrest, peak, collapse.
 *
 * Archetypes call this and then splice their own signature events in — the
 * rupture's tear, the corruptor's recoils. `keyframesFrom` sorts and separates
 * stops, so a spliced pose can land anywhere without the caller minding order.
 */
function envelopePoses(next: () => number, ch: Character): Pose[] {
  const poses: Pose[] = [
    { at: 0, ...REST, sx: 0.02, sy: 0.02, o: 0, ease: EASE.punch },
  ];

  let x = 0;
  let y = 0;
  let rot = 0;

  for (let i = 1; i <= ch.steps; i++) {
    const t = (i / ch.steps) * 0.86;
    const u = unrest(t);
    const s = growth(t, ch.peak);

    x += (next() - 0.5) * ch.wobble * u;
    y += (next() - 0.5) * ch.wobble * 0.78 * u;
    rot += (next() - 0.5) * ch.spin * u;

    // Squash on one axis is stretch on the other, so the mass is conserved and
    // it reads as deformation rather than as the thing changing size.
    const squash = 1 + (next() - 0.5) * ch.deform * u;

    poses.push({
      at: t,
      x,
      y,
      rot,
      sx: s * squash,
      sy: s / squash,
      skew: (next() - 0.5) * 30 * u,
      o: u > 0.4 && next() < ch.flicker ? 0.12 : presence(t),
      ease: u > 0.3 && next() < ch.cutChance ? EASE.cut : EASE.drift,
    });
  }

  /*
    The collapse, over the last ~700ms and in three stops rather than one.

    A single eased stop from full size to nothing was measured at 0.8 scale with
    3% of the life left: `EASE.collapse` is so back-loaded that everything
    happened inside the final hundred milliseconds, which reads as the void
    being switched off rather than folding. Stepping it down gives the fold
    somewhere to happen, and the hard cut on the last stop keeps the *finish*
    instant — a hole closing over should end abruptly, it just should not begin
    abruptly.
  */
  const held = growth(0.86, ch.peak);
  poses.push({ at: 0.9, ...REST, x, y, rot, sx: held * 0.74, sy: held * 0.9, ease: EASE.collapse });
  poses.push({ at: 0.955, ...REST, x, y, rot, sx: held * 0.26, sy: held * 0.42, ease: EASE.cut });
  poses.push({ at: 1, ...REST, x, y, rot, sx: 0.02, sy: 0.06, o: 0 });
  return poses;
}

type Script = {
  /** One pose track per piece. Piece 0 is what bursts are anchored to. */
  pieces: { poses: Pose[]; scale: number }[];
  /** Windows where the silhouette should be failing rather than boiling. */
  hot: { from: number; to: number }[];
  /**
   * Normalised times at which reality breaks. **Not how hard** — that is read
   * off the void's actual size when the moment arrives.
   *
   * This was an `{ at, strength }` pair, and the two disagreed: strength came
   * from the *scheduled* time while the burst was drawn at the size taken from
   * the *pose track*, which a spliced recoil or a thrash can move a long way.
   * Measured, a burst drawn at 0.32 scale was still firing the erasure pass,
   * which is meant for a peaked void. One source of truth now.
   */
  bursts: number[];
  lifeMs: number;
  celCount: number;
  /** Cel perturbation. High values look like the shape cannot hold together. */
  celSpread: number;
  /** Silhouette swap interval: [fast at the peak, slow at the seed]. */
  restMs: [number, number];
  /** Peak scale, so a burst can be sized to the void that threw it. */
  peak: number;
};

/** Roughly five seconds for every void, with just enough spread that several on
 *  screen do not beat in time with each other. */
const life = (next: () => number) => 4500 + next() * 1100;

/**
 * **Crawler** — the quiet one, and the reason the others land.
 *
 * Smallest peak, least unrest, and it drifts while it grows. It still tears at
 * the top of its arc, but it is the version of the arc you can look away from.
 */
function crawlerScript(next: () => number): Script {
  const peak = 0.9 + next() * 0.2;
  const poses = envelopePoses(next, {
    peak,
    steps: 13,
    wobble: 26,
    spin: 9,
    cutChance: 0.22,
    flicker: 0.04,
    deform: 0.2,
  });

  return {
    pieces: [{ poses, scale: 1 }],
    hot: [{ from: 0.66, to: 0.95 }],
    bursts: [0.74 + next() * 0.08],
    lifeMs: life(next),
    celCount: 4,
    celSpread: 1.1,
    restMs: [70, 250],
    peak,
  };
}

/**
 * **Rupture** — the growth fails.
 *
 * Follows the envelope until roughly two-thirds through, then tears past its own
 * peak in a single stepped jump and throws fragments. The one archetype whose
 * collapse is violent rather than a fold.
 */
function ruptureScript(next: () => number): Script {
  const peak = 1.2 + next() * 0.25;
  const tear = 0.66 + next() * 0.07;
  const poses = envelopePoses(next, {
    peak,
    steps: 15,
    wobble: 34,
    spin: 16,
    cutChance: 0.42,
    flicker: 0.1,
    deform: 0.34,
  });

  // The tear itself, spliced over the envelope. Nothing eases into it.
  poses.push({ at: tear - 0.012, ...REST, sx: growth(tear, peak) * 0.92, sy: growth(tear, peak) * 0.9, ease: EASE.cut });
  poses.push({
    at: tear,
    ...REST,
    sx: peak * 1.5,
    sy: peak * 1.15,
    skew: (next() - 0.5) * 30,
    ease: EASE.cut,
  });
  poses.push({ at: tear + 0.03, ...REST, sx: peak * 0.95, sy: peak * 1.45, rot: (next() - 0.5) * 24, ease: EASE.stutter });

  let t = tear + 0.06;
  while (t < 0.9) {
    poses.push({
      at: t,
      ...REST,
      x: (next() - 0.5) * 46,
      y: (next() - 0.5) * 36,
      sx: peak * (0.7 + next() * 0.7),
      sy: peak * (0.7 + next() * 0.7),
      rot: (next() - 0.5) * 34,
      skew: (next() - 0.5) * 28,
      o: next() < 0.2 ? 0.2 : 1,
      ease: EASE.cut,
    });
    t += 0.026 + next() * 0.03;
  }

  const pieces = [{ poses, scale: 1 }];

  // Fragments, thrown at the tear and dying on their own arcs.
  const fragments = 3 + Math.floor(next() * 3);
  for (let i = 0; i < fragments; i++) {
    const angle = (Math.PI * 2 * i) / fragments + next() * 0.9;
    const reach = 44 + next() * 95;
    const dies = tear + 0.12 + next() * 0.16;
    pieces.push({
      scale: 0.22 + next() * 0.24,
      poses: [
        { at: 0, ...REST, o: 0, sx: 0.4, sy: 0.4, ease: EASE.cut },
        { at: tear, ...REST, o: 0, sx: 0.5, sy: 0.5, ease: EASE.cut },
        { at: tear + 0.008, ...REST, o: 1, ease: EASE.drift },
        {
          at: dies,
          ...REST,
          x: Math.cos(angle) * reach,
          y: Math.sin(angle) * reach,
          rot: (next() - 0.5) * 90,
          sx: 0.5,
          sy: 0.6,
          o: 0,
          ease: EASE.cut,
        },
        { at: 1, ...REST, x: Math.cos(angle) * reach, y: Math.sin(angle) * reach, o: 0 },
      ],
    });
  }

  return {
    pieces,
    hot: [{ from: tear - 0.02, to: 0.95 }],
    bursts: [tear, ...(next() < 0.5 ? [0.42] : [])],
    lifeMs: life(next),
    celCount: 6,
    celSpread: 2.6,
    restMs: [46, 210],
    peak,
  };
}

/**
 * **Swarm** — one hole that was never quite one hole.
 *
 * Every piece grows on the same envelope, but each is on its own drift and its
 * own unrest, so they separate as they get bigger and only look like one thing
 * at the seed. They never move as a unit: the moment they read as a formation,
 * the effect is a particle system.
 */
function swarmScript(next: () => number): Script {
  const peak = 1 + next() * 0.2;
  const count = 4 + Math.floor(next() * 3);

  const pieces = Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + next() * 1.2;
    const poses = envelopePoses(next, {
      peak,
      steps: 11,
      wobble: 30,
      spin: 14,
      cutChance: 0.26,
      flicker: 0.08,
      deform: 0.26,
    });
    // Separation rides on the growth, so they fan out as they open.
    const out = 34 + next() * 74;
    for (const pose of poses) {
      const u = unrest(pose.at);
      pose.x += Math.cos(angle) * out * u;
      pose.y += Math.sin(angle) * out * u;
    }
    return { poses, scale: 0.36 + next() * 0.28 };
  });

  return {
    pieces,
    hot: [{ from: 0.64, to: 0.95 }],
    bursts: [0.72 + next() * 0.08],
    lifeMs: life(next),
    celCount: 4,
    celSpread: 1.6,
    restMs: [58, 220],
    peak,
  };
}

/**
 * **Corruptor** — the archetype the brief is really about.
 *
 * Grows steadily and calmly and puts all its energy into the page instead of
 * into itself: three bursts, escalating with its size, and it only ever flinches
 * around them. Keeping the void nearly still is the point — the reading has to
 * be "this thing is doing something to the page", not "this thing is wriggling".
 */
function corruptorScript(next: () => number): Script {
  const peak = 1.1 + next() * 0.25;
  const poses = envelopePoses(next, {
    peak,
    steps: 12,
    wobble: 14,
    spin: 6,
    cutChance: 0.16,
    flicker: 0.03,
    deform: 0.16,
  });

  const bursts: number[] = [];
  const hot: { from: number; to: number }[] = [];

  // Spread across the growth so the escalation is legible: the first is a
  // twitch on a small void, the last is a peaked one coming apart.
  for (const at of [0.34, 0.58, 0.8]) {
    const jittered = at + (next() - 0.5) * 0.05;
    bursts.push(jittered);
    hot.push({ from: jittered - 0.015, to: jittered + 0.05 });
    const s = growth(jittered, peak);
    const u = unrest(jittered);
    poses.push({ at: jittered - 0.014, ...REST, sx: s, sy: s, ease: EASE.cut });
    poses.push({
      at: jittered,
      ...REST,
      sx: s * (1.2 + 0.2 * u),
      sy: s * (0.8 - 0.08 * u),
      skew: (next() - 0.5) * 34 * u,
      x: (next() - 0.5) * 26 * u,
      ease: EASE.cut,
    });
    poses.push({ at: jittered + 0.016, ...REST, sx: s * 0.88, sy: s * 1.18, ease: EASE.stutter });
    poses.push({ at: jittered + 0.045, ...REST, sx: s, sy: s, ease: EASE.drift });
  }

  return {
    pieces: [{ poses, scale: 1 }],
    hot,
    bursts,
    lifeMs: life(next),
    celCount: 5,
    celSpread: 1.5,
    restMs: [64, 260],
    peak,
  };
}

/**
 * **Blink** — unstable from the first frame.
 *
 * Same five seconds as the rest, but it never settles into its growth: it
 * stutters up in hard steps and drops out for a frame at a time throughout. It
 * used to be defined by being brief, which the shared envelope takes away — so
 * its character is now that it is the only one whose *unrest starts high*
 * instead of arriving with size.
 */
function blinkScript(next: () => number): Script {
  const peak = 1 + next() * 0.3;
  const poses = envelopePoses(next, {
    peak,
    steps: 22,
    wobble: 30,
    spin: 22,
    cutChance: 0.9,
    flicker: 0.3,
    deform: 0.42,
  });

  // Its opacity does not ramp with size like the others: it is already
  // flickering while it is small, which is what makes it read as faulty rather
  // than as young.
  for (const pose of poses) {
    if (pose.at > 0.04 && pose.at < 0.9 && next() < 0.28) pose.o = 0;
  }

  return {
    pieces: [{ poses, scale: 1 }],
    hot: [{ from: 0.2, to: 0.95 }],
    bursts: [0.3, 0.76 + next() * 0.06],
    lifeMs: life(next),
    celCount: 6,
    celSpread: 2.4,
    restMs: [40, 150],
    peak,
  };
}

const SCRIPTS: Record<Archetype, (next: () => number) => Script> = {
  crawler: crawlerScript,
  rupture: ruptureScript,
  swarm: swarmScript,
  corruptor: corruptorScript,
  blink: blinkScript,
};

/** Weighted so the screen is usually calm: the quiet archetype is the most
 *  common thing on it and the loudest is the rarest. */
const WEIGHTS: [Archetype, number][] = [
  ["crawler", 0.3],
  ["corruptor", 0.22],
  ["swarm", 0.19],
  ["blink", 0.16],
  ["rupture", 0.13],
];

function chooseArchetype(): Archetype {
  const roll = Math.random();
  let acc = 0;
  for (const [kind, weight] of WEIGHTS) {
    acc += weight;
    if (roll <= acc) return kind;
  }
  return "crawler";
}

/* ------------------------------------------------------------------ model */

type Piece = {
  key: string;
  box: number;
  cels: Cel[];
  crackWidth: number;
  animName: string;
  morphNames: string[];
};

type Spot = {
  id: number;
  kind: Archetype;
  /** Viewport percentages, so a resize mid-life does not strand a void. */
  x: number;
  y: number;
  ink: number;
  lifeMs: number;
  pieces: Piece[];
  css: string;
};

type Slice = {
  top: number;
  height: number;
  dx: number;
  filter: string;
  delay: number;
  dur: number;
};

type Spark = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
  delay: number;
  dur: number;
};

type Burst = {
  id: number;
  cx: number;
  cy: number;
  size: number;
  /** The void's own scale when it fired. The whole burst is drawn at this, so
   *  a young void's corruption is physically smaller as well as weaker. */
  scale: number;
  clip: string;
  warp: boolean;
  swallow: boolean;
  split: boolean;
  slices: Slice[];
  shards: Shard[];
  /** Ink fractures whipping out across the interface. */
  cracks: Stroke[];
  sparks: Spark[];
  ms: number;
};

/**
 * Recolourings for the tear slices — bands of the real interface, shoved
 * sideways. Four distinct treatments rather than one parameterised: a single
 * hue rotated by varying amounts reads as a colour wash over the region, and
 * the point is that different bands are wrong in different ways.
 */
const SLICE_FILTERS = [
  "invert(1) hue-rotate(190deg) saturate(2.2)",
  "hue-rotate(96deg) saturate(3) contrast(1.5)",
  "invert(1) brightness(1.35) saturate(0.4)",
  "hue-rotate(-70deg) contrast(2) brightness(1.15)",
];

/** The three plates the film's fracture reads in, as `AmbientGlitch` narrows
 *  them. The full plate set turns a small cluster into confetti. */
const SHARD_PLATES = ["var(--sv-magenta)", "var(--sv-cyan)", "#FFFFFF"] as const;

function buildBurst(
  id: number,
  cx: number,
  cy: number,
  size: number,
  clip: string,
  strength: number,
  scale: number,
): Burst {
  const seed = Math.floor(Math.random() * 0x7fffffff);
  const next = rng(seed);
  const ms = 200 + strength * 320;

  const sliceCount = Math.round(2 + strength * 5);
  const slices: Slice[] = Array.from({ length: sliceCount }, () => ({
    top: next() * 94,
    height: 3 + next() * 16 * strength,
    /*
      Signed, with a floor. A plain `(rand - 0.5) * range` puts half the bands
      within a few pixels of home — measured on a live burst, four of seven
      slices had moved under 2px and simply read as faint colour bars. A tear
      that does not visibly jump is not a tear.
    */
    dx: (next() < 0.5 ? -1 : 1) * (14 + next() * 54) * strength,
    filter: SLICE_FILTERS[Math.floor(next() * SLICE_FILTERS.length)],
    delay: Math.round(next() * ms * 0.35),
    dur: Math.round(90 + next() * 190),
  }));

  return {
    id,
    cx,
    cy,
    size,
    scale,
    clip,
    /*
      Which passes run.

      Retuned twice after photographing frozen bursts, and both times in the
      same direction. The shard cluster was carrying the whole effect: at
      `buildShards`' own scale a triangle reaches up to 30% of the region, so
      over a 436px burst they came out 130px across and the result read as
      broken glass thrown over the panel — a generic glitch overlay, and the
      exact thing this is not meant to be.

      The displacement is the pass that says "the rendering is failing", so it
      runs on all but the weakest bursts. The shards are now accents around it:
      a handful, small, and dim enough that they never out-shout the warp.
    */
    warp: strength > 0.32,
    // Erasing the interface outright: the strongest thing here, and the rarest.
    swallow: strength > 0.72 && next() < 0.7,
    split: strength > 0.3,
    slices,
    shards: buildShards(seed ^ 0x51ed270b, Math.round(2 + strength * 3), SHARD_PLATES, 0.15),
    /*
      Fractures whipping out *across the interface*, not just around the hole.

      This is the pass that carries the "aggressive" reading. The warp bends
      what is there and the shards colour it, but neither of them adds anything
      the eye tracks as movement; a black branch snapping outward does, and it
      is the same ink the void itself is made of, so it reads as the hole
      reaching rather than as an overlay.
    */
    cracks: (() => {
      /*
        `growCrack`'s `length` is the length of the *first jag*, not the reach of
        the branch — each subsequent jag is 0.7 of the last, so a branch runs to
        roughly 2.5x whatever is passed in, and the generations fork off that.

        The first version passed a figure scaled as though it were the total.
        At strength 1 over a 273px burst that produced 600px branches 11px
        thick: the screenshot was a dead shrub laid over the page, which is
        neither a crack nor anything to do with this app. Per-jag length is now
        a small fraction of the region, so a branch reaches about a third of it.
      */
      const count = Math.round(2 + strength * 2);
      return Array.from({ length: count }, (_, i) => {
        const angle = (Math.PI * 2 * i) / count + next() * 1.4;
        const inner = size * 0.18;
        return buildCrack(
          rng((seed ^ (0x1b873593 * (i + 1))) >>> 0),
          [size / 2 + Math.cos(angle) * inner, size / 2 + Math.sin(angle) * inner],
          angle,
          size * (0.06 + next() * 0.06) * (0.7 + strength * 0.5),
          Math.max(1.2, size * 0.011),
        );
      }).flat();
    })(),
    sparks: Array.from({ length: Math.round(3 + strength * 9) }, () => {
      const angle = next() * Math.PI * 2;
      const reach = size * (0.2 + next() * 0.5);
      return {
        x: size / 2 + Math.cos(angle) * size * 0.16,
        y: size / 2 + Math.sin(angle) * size * 0.16,
        dx: Math.cos(angle) * reach,
        dy: Math.sin(angle) * reach,
        size: 2 + next() * 5,
        // Mostly ink, occasionally a plate — a spark off a fracture is a chip
        // of the same black, and a field of coloured dots would be particles.
        color: next() < 0.7 ? "#000" : SHARD_PLATES[Math.floor(next() * SHARD_PLATES.length)],
        delay: Math.round(next() * ms * 0.3),
        dur: Math.round(180 + next() * 260),
      };
    }),
    ms,
  };
}

/* ---------------------------------------------------------------- cadence */

const maxSpots = (width: number) => (width < 640 ? 2 : 3);
const HARD_MAX = 5;
/**
 * No two bursts inside this window, however many voids want one.
 *
 * The single most important restraint in the file. Corruption that overlaps
 * itself stops being an event and becomes a filter over the app, and three
 * corruptors on screen would otherwise be able to chain indefinitely.
 *
 * Raised with the five-second envelope: every void now bursts at least once in
 * its life and the corruptor three times, so the rate arriving at this gate is
 * several times what it was and the gate is doing correspondingly more work.
 */
const BURST_GAP_MS = 2600;

/**
 * A placement, weighted toward the frame rather than the middle.
 *
 * Both axes are decided together. Biasing them independently sounds equivalent
 * and is not: at 62% each, both land at an extreme 38% of the time and voids
 * pile into the four corners. Pushing *one* randomly chosen axis out and
 * leaving the other free spreads them along the edges instead.
 */
function placement(): { x: number; y: number } {
  const free = () => pick(-5, 105);
  const outer = () => (Math.random() < 0.5 ? pick(-5, 26) : pick(74, 105));
  if (Math.random() < 0.62) {
    return Math.random() < 0.5 ? { x: outer(), y: free() } : { x: free(), y: outer() };
  }
  return { x: free(), y: free() };
}

export default function DimensionalSpots() {
  const reduced = useReducedMotion();
  const [spots, setSpots] = useState<Spot[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nextId = useRef(0);
  /* Counted synchronously rather than inside the state updater, for the reason
     `AmbientLightning` documents: React batches the updater, so a cap read from
     inside it is stale for anything deciding in the same tick. */
  const live = useRef(0);
  const placed = useRef(new Map<number, { px: number; py: number; ink: number }>());
  const lastBurst = useRef(0);

  useEffect(() => {
    if (reduced) return; // Absent, not slowed. See the note further down.
    let alive = true;
    const positions = placed.current;

    const after = (ms: number, fn: () => void) => {
      timers.current.push(
        setTimeout(() => {
          if (alive) fn();
        }, ms),
      );
    };

    const fireBurst = (
      cx: number,
      cy: number,
      size: number,
      clip: string,
      strength: number,
      scale: number,
    ) => {
      const now = Date.now();
      if (now - lastBurst.current < BURST_GAP_MS) return;
      // Corruption outside the frame is cost with nothing to show for it.
      if (cx < -size || cy < -size || cx > window.innerWidth + size || cy > window.innerHeight + size)
        return;
      lastBurst.current = now;

      const burst = buildBurst((nextId.current += 1), cx, cy, size, clip, strength, scale);
      setBursts((current) => [...current, burst]);
      after(burst.ms + 140, () => setBursts((c) => c.filter((b) => b.id !== burst.id)));
    };

    const spawn = (near?: { x: number; y: number; ink: number; forced: boolean }) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (vw === 0 || vh === 0) return;

      const cap = near?.forced ? HARD_MAX : maxSpots(vw);
      if (live.current >= cap) return;

      const kind = chooseArchetype();
      const seed = Math.floor(Math.random() * 0x7fffffff);
      const script = SCRIPTS[kind](rng(seed));

      /* Sized by the ink, not by the SVG box: `VIEW_SCALE` reserves room for
         tendrils and bleed, so choosing the box halves every void. */
      const shorter = Math.min(vw, vh);
      const ink = near
        ? Math.max(26, near.ink * pick(0.34, 0.56))
        : Math.min(190, Math.max(46, shorter * pick(0.07, 0.19)));

      /*
        Where it opens. A dispersal or a reform stays close to whatever it came
        from — that proximity is what makes it read as the same event
        continuing. An independent void gets five attempts at a position not
        sitting on top of a live one; best-of rather than reject-until-clear, so
        a busy frame still always gets its void.
      */
      let x: number;
      let y: number;
      if (near) {
        x = Math.max(-6, Math.min(106, near.x + (pick(-16, 16) * 100) / vw));
        y = Math.max(-6, Math.min(106, near.y + (pick(-16, 16) * 100) / vh));
      } else {
        let best = placement();
        let bestGap = -Infinity;
        for (let attempt = 0; attempt < 5; attempt++) {
          const candidate = attempt === 0 ? best : placement();
          const px = (candidate.x / 100) * vw;
          const py = (candidate.y / 100) * vh;
          let gap = Infinity;
          for (const other of positions.values()) {
            gap = Math.min(gap, Math.hypot(px - other.px, py - other.py) - (other.ink + ink) * 0.62);
          }
          if (gap > bestGap) {
            bestGap = gap;
            best = candidate;
          }
          if (gap > 0) break;
        }
        x = best.x;
        y = best.y;
      }

      const id = (nextId.current += 1);
      const prefix = `svv${id}`;
      let css = "";

      const pieces: Piece[] = script.pieces.map((spec, i) => {
        const pieceInk = ink * spec.scale;
        const box = pieceInk * VIEW_SCALE;
        const { cels, crackWidth } = buildCels(
          (seed ^ (0xc2b2ae35 * (i + 1))) >>> 0,
          pieceInk / 2,
          box,
          script.celCount,
          script.celSpread,
        );

        const animName = `${prefix}p${i}`;
        css += keyframesFrom(animName, spec.poses);

        const morph = morphTracks(
          rng((seed ^ (0x27d4eb2f * (i + 1))) >>> 0),
          animName,
          script.celCount,
          script.lifeMs,
          script.hot,
          script.restMs,
        );
        css += morph.css;

        return { key: `${id}-${i}`, box, cels, crackWidth, animName, morphNames: morph.names };
      });

      live.current += 1;
      positions.set(id, { px: (x / 100) * vw, py: (y / 100) * vh, ink });
      setSpots((current) => [
        ...current,
        { id, kind, x, y, ink, lifeMs: script.lifeMs, pieces, css },
      ]);

      /*
        Corruption is scheduled off the same script that drives the void, and
        anchored by evaluating the pose track at the burst's own moment — so
        reality breaks where the hole will actually be by then, not where it
        started out.
      */
      const anchor = script.pieces[0].poses;
      const anchorCel = pieces[0].cels[0];
      for (const at of script.bursts) {
        after(at * script.lifeMs, () => {
          const pose = poseAt(anchor, at);
          /*
            How grown the void actually is at this instant.

            `poseAt` walks the same track the void is animating, so this is its
            real size rather than a second guess at it — and both how hard the
            burst hits and how large it is drawn come from this one number. A
            young void is quiet and small; a peaked one throws everything.
          */
          const grown = clamp01(pose.s / script.peak);
          fireBurst(
            (x / 100) * window.innerWidth + pose.x,
            (y / 100) * window.innerHeight + pose.y,
            /*
              Exactly the piece's box, and it must stay exactly that.

              `clip` is a path generated in the piece's own box coordinates, and
              `path()` carries no transform of its own — so the element it is
              applied to has to be that same size or the silhouette lands in the
              wrong place at the wrong scale. An earlier version clamped this
              size independently, which quietly put a 370-unit path inside a
              310px element: the clip then cropped the top-left corner of the
              shape and the displacement appeared to do nothing, because it was
              being masked to a region that no longer matched the hole.

              The box is already bounded — ink caps at 190 and `VIEW_SCALE` is
              1.95 — so there is nothing here that needs clamping. How far the
              corruption reaches is set by the warp's own scale instead.
            */
            pieces[0].box,
            anchorCel.boxed,
            clamp01(0.18 + grown * 0.82),
            Math.max(0.25, grown),
          );
        });
      }

      // What happens as it goes. Both interesting outcomes start before the
      // parent is gone, so the eye reads one continuous event.
      const fate = Math.random();
      if (kind === "blink" && fate < 0.62) {
        // Blinks chain: one anomaly hopping, not three unrelated arrivals.
        after(script.lifeMs * 0.82, () => spawn({ x, y, ink: ink * pick(1.5, 2.6), forced: false }));
      } else if (fate < 0.14) {
        const shards = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < shards; i++) {
          after(script.lifeMs * 0.86 + i * pick(80, 240), () =>
            spawn({ x, y, ink, forced: true }),
          );
        }
      } else if (fate < 0.3) {
        after(script.lifeMs + pick(200, 700), () =>
          spawn({ x, y, ink: ink * pick(1.7, 2.4), forced: false }),
        );
      }

      after(script.lifeMs + 90, () => {
        live.current = Math.max(0, live.current - 1);
        positions.delete(id);
        setSpots((c) => c.filter((s) => s.id !== id));
      });
    };

    const schedule = () => {
      /*
        Retimed with the envelope, not independently.

        A void used to live 14-22 seconds, so one every 9-20 kept two or three
        on screen. At a five-second life the same interval leaves the page empty
        roughly two thirds of the time — the layer would read as broken rather
        than as restrained. This keeps the same *presence* as before: usually
        one void, sometimes two or three, occasionally none.
      */
      after(pick(4200, 9500), () => {
        spawn();
        schedule();
      });
    };

    after(pick(1800, 3600), () => spawn());
    after(pick(5200, 8500), () => spawn());
    schedule();

    const force = () => spawn();
    window.addEventListener("sv:spot", force);

    return () => {
      alive = false;
      window.removeEventListener("sv:spot", force);
      timers.current.forEach(clearTimeout);
      timers.current = [];
      live.current = 0;
      positions.clear();
    };
  }, [reduced]);

  /*
    Absent under reduced motion, not frozen. The atmosphere layers hold their
    neutral pose because they are scenery; a transient's neutral pose is a
    permanent smear parked over the interface — the conclusion
    `AmbientLightning` and `AmbientGlitch` both reached.
  */
  if (reduced || (spots.length === 0 && bursts.length === 0)) return null;

  return (
    <>
      {/* Every live void's bespoke keyframes. Built from numbers computed in
          this file; no external string reaches it. */}
      <style dangerouslySetInnerHTML={{ __html: spots.map((s) => s.css).join("") }} />

      {/*
        The filter graphs, mounted with the *voids* rather than with the bursts.

        They were originally inside the burst block, which looked tidy and was
        wrong: the defs then entered the document in the same commit as the
        elements referencing them by `url(#...)`, and a burst lives for about
        four hundred milliseconds. Measured mid-run, `#sv-void-warp` did not
        exist at all — every burst was drawing its shards and its swallow with
        no displacement behind them, which is precisely the pass that makes this
        corruption rather than decoration. A void always exists for seconds
        before it asks for a burst, so hanging the defs here means the filters
        are resolvable long before anything points at them.
      */}
      <VoidFilters />

      {/*
        The voids. `fixed` with `overflow: hidden`: fixed so one placed past an
        edge measures against the viewport rather than the document, hidden so
        it can hang half outside the frame without establishing a scroll
        container. `AmbientLightning` had to solve this the harder way, because
        a strike must stay free to run off the top.
      */}
      <div
        aria-hidden="true"
        data-sv-spots=""
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        {spots.map((spot) => (
          <div
            key={spot.id}
            data-void={spot.kind}
            className="absolute"
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
          >
            {spot.pieces.map((piece) => (
              <div
                key={piece.key}
                className="absolute"
                style={{
                  left: -piece.box / 2,
                  top: -piece.box / 2,
                  width: piece.box,
                  height: piece.box,
                  animation: `${piece.animName} ${Math.round(spot.lifeMs)}ms linear both`,
                }}
              >
                <svg
                  viewBox={`${-piece.box / 2} ${-piece.box / 2} ${piece.box} ${piece.box}`}
                  className="h-full w-full overflow-visible"
                >
                  {piece.cels.map((cel, i) => (
                    <g
                      key={i}
                      style={{
                        animation: `${piece.morphNames[i]} ${Math.round(spot.lifeMs)}ms steps(1, end) both`,
                      }}
                    >
                      {/* Ink bleed: the same drawing, fractionally larger and
                          half strength, which softens the edge without a blur
                          and without a glow. */}
                      <path d={cel.blob} fill="#000" opacity={0.4} transform="scale(1.08)" />
                      <path d={cel.blob} fill="#000" />
                      {/* Fractures running out of the hole. Each run carries
                          its own tapering width, so a branch thins to a
                          hairline instead of ending blunt. */}
                      {cel.cracks.map((crack, c) => (
                        <path
                          key={c}
                          d={crack.d}
                          fill="none"
                          stroke="#000"
                          strokeWidth={crack.w}
                          strokeLinecap="round"
                        />
                      ))}
                    </g>
                  ))}
                </svg>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/*
        The corruption, above the content — the only place from which the
        rendering of something painted in front of the void can be broken.
        Purely visual and `pointer-events: none`: nothing here reads, writes or
        blocks anything, and it is gone within half a second.
      */}
      {bursts.length > 0 && (
        <div
          aria-hidden="true"
          data-sv-corrupt=""
          className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
        >
          {bursts.map((burst) => (
            <div
              key={burst.id}
              className="absolute"
              style={{
                left: burst.cx - burst.size / 2,
                top: burst.cy - burst.size / 2,
                width: burst.size,
                height: burst.size,
                /* Scaling the whole region, rather than each pass, keeps the
                   silhouette clip aligned with the element it is applied to —
                   `path()` has no transform of its own, so the two must stay in
                   the same coordinate space. */
                transform: `scale(${r2(burst.scale)})`,
              }}
            >
              {/* 1. The hole arriving through the interface: its own silhouette,
                     filled with a displacement of whatever is in front of it
                     rather than with ink. */}
              {burst.warp && (
                <div
                  className="absolute inset-0"
                  style={{
                    clipPath: `path('${burst.clip}')`,
                    /*
                      Blown up well past the silhouette, and that is the whole
                      trick.

                      Clipped to the hole's own outline the displacement was
                      invisible, and the reason is obvious in hindsight: the
                      void is opaque black ink and it sits directly behind this
                      element, so the filter was faithfully warping black into
                      black. What has to be displaced is the *neighbourhood* —
                      the panel edges, threads and type around the hole — with
                      the ink sitting in the middle of it. Keeping the void's
                      own irregular outline as the clip means the warped region
                      is still shaped like the anomaly rather than like a box.
                    */
                    transform: "scale(2.6)",
                    backdropFilter: "url(#sv-void-warp)",
                    WebkitBackdropFilter: "url(#sv-void-warp)",
                    animation: `sv-void-burst ${Math.round(burst.ms)}ms steps(3, end) both`,
                  }}
                />
              )}

              {/* 2. Swallowed: the interface inside the silhouette is simply
                     gone for a moment, and then it is back.

                     Deliberately the *shortest* pass in the burst. At 62% of
                     the event it covered the displacement underneath it for
                     almost the whole thing — near-black over a warp is just
                     near-black — so the order reads properly only when the
                     erasure is a single hard beat and the warp outlives it:
                     gone, then back but wrong, then right again. */}
              {burst.swallow && (
                <div
                  className="absolute inset-0"
                  style={{
                    clipPath: `path('${burst.clip}')`,
                    backdropFilter: "brightness(0.08) saturate(0)",
                    WebkitBackdropFilter: "brightness(0.08) saturate(0)",
                    animation: `sv-void-swallow ${Math.round(burst.ms * 0.3)}ms steps(2, end) both`,
                  }}
                />
              )}

              {/* 3. Channel separation on the real backdrop, spilling past the
                     silhouette — the corruption reaches further than the hole. */}
              {burst.split && (
                <div
                  className="absolute inset-0"
                  style={{
                    clipPath: `path('${burst.clip}')`,
                    transform: "scale(1.34)",
                    backdropFilter: "url(#sv-void-split)",
                    WebkitBackdropFilter: "url(#sv-void-split)",
                    animation: `sv-void-burst ${Math.round(burst.ms * 1.1)}ms steps(4, end) both`,
                  }}
                />
              )}

              {/* 4. Tearing: bands of the real interface, recoloured and shoved
                     sideways. Uneven heights and gaps on purpose — an even
                     stack is a scanline overlay, a different and much more
                     generic effect. */}
              {burst.slices.map((slice, i) => (
                <div
                  key={`t${i}`}
                  className="absolute"
                  style={{
                    left: "-18%",
                    width: "136%",
                    top: `${slice.top}%`,
                    height: `${slice.height}%`,
                    backdropFilter: slice.filter,
                    WebkitBackdropFilter: slice.filter,
                    ["--tear-x" as string]: `${r1(slice.dx)}px`,
                    animation: `sv-void-tear ${slice.dur}ms steps(2, end) ${slice.delay}ms both`,
                  }}
                />
              ))}

              {/* 5. Fractures whipping out across the interface, and the chips
                     that come off them. The one pass here the eye actually
                     tracks as movement — the warp bends and the shards colour,
                     but neither of them travels. */}
              <svg
                className="absolute inset-0 h-full w-full overflow-visible"
                viewBox={`0 0 ${r1(burst.size)} ${r1(burst.size)}`}
                style={{
                  animation: `sv-void-crack ${Math.round(burst.ms * 0.8)}ms steps(3, end) both`,
                }}
              >
                {burst.cracks.map((crack, c) => (
                  <path
                    key={`c${c}`}
                    d={crack.d}
                    fill="none"
                    stroke="#000"
                    strokeWidth={crack.w}
                    strokeLinecap="round"
                  />
                ))}
              </svg>

              {burst.sparks.map((spark, i) => (
                <div
                  key={`k${i}`}
                  className="absolute"
                  style={{
                    left: spark.x,
                    top: spark.y,
                    width: spark.size,
                    height: Math.max(1, spark.size * 0.45),
                    background: spark.color,
                    ["--spark-x" as string]: `${r1(spark.dx)}px`,
                    ["--spark-y" as string]: `${r1(spark.dy)}px`,
                    animation: `sv-void-spark ${spark.dur}ms steps(4, end) ${spark.delay}ms both`,
                  }}
                />
              ))}

              {/* 6. Shards, from GlitchShatter's own generator and riding its
                     class, so a burst is visibly the same fracture the rest of
                     the app already speaks. */}
              {burst.shards.map((shard, i) => (
                <div
                  key={`s${i}`}
                  className="sv-shard absolute inset-0"
                  style={{
                    clipPath: shard.clip,
                    background: shard.color,
                    mixBlendMode: "screen",
                    ["--shard-x" as string]: `${r1(shard.dx)}px`,
                    ["--shard-y" as string]: `${r1(shard.dy)}px`,
                    ["--shard-r" as string]: `${r1(shard.rotate)}deg`,
                    ["--shard-o" as string]: r2(shard.opacity * 0.42),
                    animationDelay: `${shard.delay}ms`,
                    animationDuration: `${shard.duration}ms`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Filter graphs for the corruption, deliberately kept out of `ChromaticDefs`.
 *
 * That file is referenced by `GlitchText` and the page transition, and tuning a
 * shared filter for this effect would silently retune both. These are wider and
 * rougher than type could survive, which is the point: they are applied to the
 * interface, not to a word.
 */
function VoidFilters() {
  return (
    <svg
      aria-hidden
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
    >
      <defs>
        {/*
          Genuine displacement of the backdrop. Turbulence drives a displacement
          map, so the pixels behind the element are dragged out of place and
          spring back — the only thing in CSS that can actually move what is
          already rendered, and the reason this is a filter graph rather than a
          stack of offset copies.

          The frequency is anisotropic: equal frequencies give an even sizzle
          that reads as noise, while a coarser horizontal band reads as
          something being pulled sideways.
        */}
        <filter
          id="sv-void-warp"
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
          colorInterpolationFilters="sRGB"
        >
          {/*
            Coarse and strong. At `baseFrequency="0.016 0.055"` with
            `scale="16"` this was a 16px ripple spread over an 800px region: it
            provably changed the pixels — a byte-compare of the frame with and
            without it differed — and was invisible to look at, which is the
            same as not being there. A lower frequency makes each wave big
            enough to read as the surface being pulled, and the larger scale
            makes the pull far enough to notice inside a 400ms event.
          */}
          <feTurbulence
            type="turbulence"
            baseFrequency="0.009 0.026"
            numOctaves="2"
            seed="11"
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="34"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Channel separation in the language `ChromaticDefs` established —
            duplicate, offset, strip to one channel, screen back together — but
            pushed far wider than type could take. */}
        <filter id="sv-void-split" colorInterpolationFilters="sRGB">
          <feOffset in="SourceGraphic" dx="-7" dy="1" result="pushA" />
          <feColorMatrix
            in="pushA"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="chanA"
          />
          <feOffset in="SourceGraphic" dx="7" dy="-1" result="pushB" />
          <feColorMatrix
            in="pushB"
            type="matrix"
            values="0 0 0 0 0
                    0 0.4 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="chanB"
          />
          <feBlend in="chanA" in2="chanB" mode="screen" result="split" />
          <feBlend in="SourceGraphic" in2="split" mode="screen" />
        </filter>
      </defs>
    </svg>
  );
}
