"use client";

import { useEffect, useRef, useState } from "react";
import { buildShards, type Shard } from "./GlitchShatter";
import { r1, rng } from "./rng";
import { useReducedMotion } from "./useReducedMotion";
import { useDocumentBands } from "./useDocumentBands";

/**
 * Dimensional tears — holes that rip open in the interface, show the dark
 * behind it, and briefly corrupt the reality around them.
 *
 * ## What this has to read as, and the one mistake that stops it
 *
 * **"A hole has opened in the interface and something from the other side is
 * breaking through" — not "an animated black shape appeared on the
 * interface".** That distinction is the whole brief, and the failure mode is
 * geometric rather than decorative: a closed curve drawn outward from a centre
 * is a mass, so it can only get bigger by being scaled and can only multiply
 * into more masses. The previous version did exactly that and read, accurately,
 * as a blob growing, splitting and re-merging, however jagged its outline was
 * made.
 *
 * So the geometry starts from a **line of failure** — a jagged spine — and the
 * outline is the two lips walked along it. See `buildCels`. An opening built
 * that way has a direction, a length, two pointed ends and an uneven width,
 * none of which a blob generator can be talked into. Growth is the split
 * running further along that line and the lips parting; it is *not* a scale
 * factor, and the transform moves 12% over a whole life precisely so it cannot
 * become one again.
 *
 * ## The three layers, and why there have to be three
 *
 * **The interior** is drawn at `-z-10`, mounted after `DimensionalThreads`, so
 * it paints over the rift glows and the neon structures and under every piece
 * of UI. Flat `#000` on a `#0a0a0f` ground: over bare background it is a
 * barely-perceptible darkening, and it only becomes an unmistakable hole where
 * there was something lit to swallow. That occlusion is what makes it a hole
 * rather than a shape.
 *
 * **The torn edge** is drawn at `z-30`, over the interface: the lip, the wall
 * of the surface's own thickness, the fractures running out, the flaps of page
 * levered up, and the pale pen work. These are what a tear actually shows you,
 * and having them cut across a panel is the depth cue a layer sitting entirely
 * behind the UI cannot give. It also carries the **blackout** — the interface
 * inside the opening, removed — whose clip is animated so it widens with the
 * tear rather than being a fixed silhouette.
 *
 * **The corruption** is drawn at `z-30` too, and this is not negotiable: a
 * layer behind the interface cannot corrupt text painted in front of it, and
 * "put a black shape over the text" is the exact failure this effect exists to
 * avoid. So a burst is a separate, transient overlay in the same position
 * `AmbientLightning` and `AmbientGlitch` already occupy — `pointer-events:
 * none`, nothing mutated, gone in under half a second.
 *
 * The burst's core element is the tear's **own silhouette at that moment**,
 * filled not with ink but with a `backdrop-filter`. So during a burst the hole
 * punches *through* to the front, and what shows inside it is the real
 * interface, displaced and channel-split.
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
 * ## Why each tear generates its own keyframes
 *
 * An earlier version shared five global keyframes and varied only durations and
 * offsets, which is why every one behaved identically however those numbers
 * were retuned — a slow creep and a hard positional cut cannot come out of one
 * shared curve. Each piece now emits its **own** `@keyframes`, and because CSS
 * lets a keyframe stop carry its own `animation-timing-function`, a single
 * track can hold eased drift, `steps(1,end)` snaps and a frantic burst in
 * sequence. Several time scales in one animation, still entirely on the
 * compositor, still nothing ticking per frame.
 *
 * The silhouette is authored the same way rather than looped: a track of
 * irregular cel swaps that *advances the opening* — see `morphTracks` — ~4fps
 * while the tear is quiet and ~18 while it is failing.
 *
 * ## Archetypes, not parameters
 *
 * Five hand-written scripts — `fissure`, `rupture`, `cascade`, `corruptor`,
 * `blink` — differing in piece count, pose sequence, when the opening surges
 * and how often they corrupt. Randomising one script's numbers produces
 * variations on one behaviour; these are five behaviours. Two of them replaced
 * archetypes that were themselves the blob reading: a `swarm` of pieces
 * drifting radially apart, and a `rupture` that threw fragments.
 *
 * Shards come from `GlitchShatter`'s `buildShards` and ride its `.sv-shard`
 * class, so a burst is visibly the same fracture vocabulary the rest of the app
 * already speaks rather than a parallel invention.
 *
 * Absent under reduced motion — not slowed, not frozen.
 *
 * `qa/tear-shots.mjs` freezes one tear at nine points of its life and crops it
 * large. Nothing here can be judged from a live screenshot.
 */

type Pt = [number, number];

/**
 * One complete drawing of an opening at one moment of its life — the unit the
 * morph track swaps between.
 *
 * **Cels are an ordered progression, not a set of interchangeable poses.** Cel
 * 0 is a sealed hairline and the last is the tear at its widest; advancing
 * through them *is* the tear propagating, and running back down them is it
 * closing over. This is the correction that stopped the effect reading as a
 * black shape being scaled up: the geometry is rebuilt at every step, so the
 * lips part, the split runs further along its own line, and the notches and
 * splinters along the edge change as the surface gives way. Nothing about the
 * opening is a transform of the frame before it.
 */
type Cel = {
  /** The torn edge, centred on the origin, for the SVG's own `viewBox`. */
  outline: string;
  /** The same path in box coordinates, for `clip-path: path()`, which has no
   *  transform of its own. */
  boxed: string;
  /**
   * Outline and inner edge in one path, filled `evenodd`, so what is painted is
   * the crescent between them: the **thickness of the punctured surface**, lit
   * down one side.
   *
   * This is the cheapest thing in the file that does the most work. A hole
   * drawn as one flat silhouette is a sticker whatever its outline does; a hole
   * with a visible wall inside its near lip has somewhere behind it. Empty
   * while the tear is still a hairline, because a hairline has no inside.
   */
  wall: string;
  /** Branching ink fractures running out of the torn edge. */
  cracks: Stroke[];
  /**
   * Irregular dash pattern for the pale contour.
   *
   * The highlight is the *same* outline path as the fill, stroked and broken up
   * — which is why it costs no extra geometry and why it can never drift out of
   * register with the shape it belongs to. Regenerated per cel, so the mark
   * re-breaks every frame and reads as a line being drawn again rather than a
   * border sitting there.
   */
  dash: string;
  dashOffset: number;
  /** Short pale ticks set just off the edge. Some cels omit some of them. */
  marks: Stroke[];
  /** Pale highlights along the heavy fracture runs. */
  crackHighlights: Stroke[];
  /** Pieces of the surface levered up out of the tear and bent away from it. */
  flaps: Flap[];
};

/**
 * A shard of the interface's own surface, hinged on the torn edge.
 *
 * Filled in the panel colour rather than in ink, which is the point: it is a
 * piece of the *page*, standing proud of the hole it came out of. `lit` is its
 * outer edge, drawn as a pale crease so the fold is legible against the black
 * behind it.
 */
type Flap = { d: string; lit: string };

/** One straight run of a fracture. Width tapers along the branch. `a`/`b` are
 *  kept so a highlight can be offset from the run without re-parsing its `d`. */
type Stroke = { d: string; w: number; a: Pt; b: Pt };

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
 * smooth curve hanging off a mass is exactly what made the old silhouette read
 * as a decorated shape rather than as something splitting.
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
    out.push({
      d: `M ${r1(x)} ${r1(y)} L ${r1(nx)} ${r1(ny)}`,
      w: Math.max(0.4, w),
      a: [x, y],
      b: [nx, ny],
    });
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
      if (gen < 2) branch(kids, next() < 0.4 ? 1 : 0, scale * 0.6, gen + 1);
    }
  };
  /*
    Two siblings at most off the trunk, where it used to be three.

    Not a visual decision — the self-similarity survives it, and the third
    generation is what carries that. It is a budget one: fractures are now
    rebuilt for every step of the opening *and* both jitter variants of it, so
    each extra branch is multiplied by roughly eighteen drawings per piece. At
    the five-void hard cap the old fan-out measured 2228 live paths.
  */
  branch(trunk, 1 + Math.floor(next() * 2), 0.55, 1);

  return out;
}

/** Room around the opening for fractures, flaps and transient overscale. */
const VIEW_SCALE = 1.95;

/**
 * How an opening is shaped. Four families, and every one of them is an
 * *opening*.
 *
 * **This replaced a blob generator, and the replacement is structural rather
 * than a retune.** The outline used to be a ring of jittered radii pushed
 * through a smooth spline. However hard the radii were thrown around — spikes,
 * notches, cusps, four families of them — a closed curve drawn outward from a
 * centre reads as a mass, because that is what it is. Growing it meant scaling
 * it, splitting it meant several masses, and the whole thing landed as "a black
 * blob appeared on the interface".
 *
 * A tear is not a mass with an irregular border. It is two lips either side of
 * a line of failure. So the geometry starts from that line — a jagged spine —
 * and the outline is the two lips walked out along it. That gives an opening
 * the things a blob structurally cannot have: a direction, a length, two
 * pointed ends, and a width that is a hairline at one end and a gaping notch at
 * the other. It also gives growth somewhere to happen that is not a scale
 * factor — the split runs further along the spine and the lips part wider,
 * which is the difference between a tear spreading and a shape being enlarged.
 *
 * - `slit` — long, narrow, nearly straight. A seam that gave.
 * - `rift` — a wandering run with one wide gape off centre.
 * - `breach` — short and wide, heavily notched. The most hole-like.
 * - `fracture` — hard kinks in the spine and a ragged, uneven gape.
 */
type Silhouette = "slit" | "rift" | "breach" | "fracture";

const SILHOUETTES: Silhouette[] = ["slit", "rift", "breach", "fracture"];

/**
 * Samples per lip, and it must be a constant.
 *
 * The outline is also emitted as `clip-path: path()` for the blackout that
 * removes the interface inside the opening, and that clip is *animated* so the
 * blackout tracks the tear as it spreads. CSS can only animate between two
 * paths built from the same command sequence, so every cel has to be
 * structurally identical — same point count, same segment types — and differ
 * only in coordinates. Every irregularity below is therefore expressed by
 * moving a point, never by inserting one.
 */
const LIP = 8;

/** Nodes in the spine. Enough for it to wander and kink, few enough that the
 *  runs between them read as straight. */
const SPINE = 9;

/**
 * Jitter variants per progress step.
 *
 * The progression carries the opening and this carries the boil: two drawings
 * of the *same* moment of the tear, swapped between, so the edge crawls while
 * the tear is holding still. Without it a stalled cel is a frozen picture; with
 * more than two the ink starts to shimmer and the progression stops reading.
 */
const VARIANTS = 2;

/**
 * Builds every cel of one piece.
 *
 * The *base* geometry — family, spine, width profile, which points on which lip
 * are notches or splinters, where the fractures and flaps hang — is drawn once,
 * so every cel is unmistakably the same tear at a different stage. Each cel
 * then evaluates it at its own progress `p` and perturbs it. `spread` is how
 * hard: a quiet opening perturbs a few percent, a failing one perturbs enough
 * that the edge cannot hold its shape between frames.
 */
function buildCels(
  seed: number,
  radius: number,
  box: number,
  stepCount: number,
  spread: number,
): { cels: Cel[]; crackWidth: number; penWidth: number } {
  const next = rng(seed);
  const half = box / 2;
  const family = SILHOUETTES[Math.floor(next() * SILHOUETTES.length)];

  const spin = next() * Math.PI * 2;
  const cosA = Math.cos(spin);
  const sinA = Math.sin(spin);

  /*
    Half-length of the run at full open, and how far the lips ever part, in
    units of the piece's radius.

    Bounded by the box rather than by taste: the box is `ink * VIEW_SCALE`, so
    half of it is 0.975 of the ink and a reach past about 1.75 radii would put
    the tips outside the region the blackout clip can act on.
  */
  const reach =
    family === "slit"
      ? 1.5 + next() * 0.25
      : family === "rift"
        ? 1.2 + next() * 0.3
        : family === "breach"
          ? 0.85 + next() * 0.25
          : 1.3 + next() * 0.3;
  const gape =
    family === "slit"
      ? 0.16 + next() * 0.08
      : family === "rift"
        ? 0.42 + next() * 0.16
        : family === "breach"
          ? 0.72 + next() * 0.22
          : 0.34 + next() * 0.16;

  /*
    The spine: the line the surface fails along.

    Straight runs with sharp turns, for the reason `growCrack` records — a crack
    follows the path of least resistance and turns abruptly, and a curve reads
    as a ribbon. `kink` is how violently it turns, which is most of what
    separates a `fracture` from a `slit`.
  */
  const kink = family === "fracture" ? 1.8 : family === "slit" ? 0.3 : 0.9;
  const spine: Pt[] = [];
  {
    let drift = 0;
    let slope = (next() - 0.5) * 0.3;
    let sum = 0;
    for (let i = 0; i < SPINE; i++) {
      const u = i / (SPINE - 1);
      slope += (next() - 0.5) * 0.34 * kink;
      drift += slope * 0.2;
      spine.push([(u * 2 - 1) * reach, drift * 0.5]);
      sum += drift * 0.5;
    }
    // Recentred, so the wander does not walk the whole tear off its own origin.
    const mean = sum / SPINE;
    for (const p of spine) p[1] -= mean;
  }

  /*
    Where the tear starts and how wide it is along its length.

    `bulge` is off centre by design. A width that peaks in the middle and tapers
    evenly to both ends is a lens, and a lens is a smooth organic shape by
    another name. Peaking a third of the way along leaves one long tapering run
    and one short blunt one, which is what a real tear looks like.
  */
  const nucleus = 0.28 + next() * 0.44;
  const bulge = 0.25 + next() * 0.5;
  const profile = spine.map((_, i) => {
    const u = i / (SPINE - 1);
    // Zero at both ends: a tear finishes in a point, always, in every family.
    const taper = Math.pow(Math.sin(Math.PI * u), 0.7);
    const off = u - bulge;
    const mass = 0.4 + 0.6 * Math.exp(-(off * off) / 0.08);
    return taper * mass * (0.6 + next() * 0.7);
  });

  /*
    What each point on each lip is, decided once.

    Rolled per lip index rather than per cel, for the reason the old spikes were
    also chosen up front: decided fresh every frame they scatter over the whole
    edge and read as static rather than as one edge holding its identity. A
    `notch` is the surface still holding on — a tab of it bridging the gap — and
    a `splinter` is a shard of it left standing proud into the opening. Both are
    what stops the two lips reading as a pair of smooth curves, which is the
    failure mode that would put the blob back.
  */
  const lipSpec = Array.from({ length: LIP * 2 }, () => {
    const roll = next();
    return {
      kind: roll < 0.26 ? "notch" : roll < 0.46 ? "splinter" : "plain",
      jag: (next() - 0.5) * 0.55,
      /** Travel *along* the spine, so the two lips never mirror each other. */
      along: (next() - 0.5) * 1,
      sharp: next() < 0.82,
      amount: 0.5 + next() * 0.9,
    };
  });

  /** The spine, its normal and its half-width, at any point along it. */
  const spineAt = (u: number) => {
    const f = clamp01(u) * (SPINE - 1);
    const i = Math.min(SPINE - 2, Math.floor(f));
    const t = f - i;
    const a = spine[i];
    const b = spine[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return {
      x: a[0] + dx * t,
      y: a[1] + dy * t,
      nx: -dy / len,
      ny: dx / len,
      tx: dx / len,
      ty: dy / len,
      w: profile[i] + (profile[i + 1] - profile[i]) * t,
    };
  };

  /**
   * The outline at progress `p`.
   *
   * `run` and `part` are separate curves and that separation is the whole
   * reading. The split travels along the spine *ahead* of the lips parting, so
   * the first second is a long hairline crack rather than a small round hole —
   * which is what a surface tearing actually does, and what the old growth
   * curve, being a single scale factor, could not express.
   *
   * `squeeze` shrinks the whole thing toward the inner edge for the wall path,
   * offset along `ox`/`oy`: the crescent left between the two is the thickness
   * of the surface.
   */
  const lips = (
    p: number,
    jitter: () => number,
    squeeze: number,
    ox: number,
    oy: number,
  ): { pts: Pt[]; sharp: boolean[] } => {
    const run = 0.14 + Math.pow(p, 0.55) * 0.86;
    const part = Math.pow(p, 1.45);
    const lo = clamp01(nucleus - run * nucleus);
    const hi = clamp01(nucleus + run * (1 - nucleus));

    const pts: Pt[] = [];
    const sharp: boolean[] = [];
    for (let side = 0; side < 2; side++) {
      for (let k = 0; k < LIP; k++) {
        const s = side === 0 ? k / (LIP - 1) : 1 - k / (LIP - 1);
        const u = lo + (hi - lo) * s;
        const sp = spineAt(u);
        const spec = lipSpec[side * LIP + k];
        const tip = s <= 0 || s >= 1;

        let width = sp.w * gape * radius * part * squeeze;
        if (spec.kind === "notch") width *= 0.04 + jitter() * 0.12;
        else if (spec.kind === "splinter") width *= 1.35 + spec.amount * 0.7;
        width *= 1 + (spec.jag + (jitter() - 0.5) * 0.55 * spread) * 0.6;

        /* The tips are cusps, not width-zero samples on the lip: pushed a
           little past the last spine point along its own direction, so the tear
           ends in a point that leads somewhere rather than in a blunt seam. */
        const lead = tip ? radius * (0.05 + jitter() * 0.05) * (s >= 1 ? 1 : -1) : 0;
        const glide = spec.along * radius * 0.1 * part;
        const dir = side === 0 ? 1 : -1;

        const px = sp.x * radius + sp.nx * (tip ? 0 : width) * dir + sp.tx * (glide + lead) + ox;
        const py = sp.y * radius + sp.ny * (tip ? 0 : width) * dir + sp.ty * (glide + lead) + oy;
        pts.push([px * cosA - py * sinA, px * sinA + py * cosA]);
        /* Most points are corners. Catmull-Rom collapses to a straight line
           between two sharp vertices, so a mostly-sharp ring is a mostly-
           polygonal outline with the occasional rounded bulge — angular enough
           to be torn, irregular enough not to read as a facet. */
        sharp.push(tip || spec.sharp || spec.kind !== "plain");
      }
    }
    return { pts, sharp };
  };

  /*
    Fractures, not one tendril. Some openings have none — a hole that is only a
    hole still belongs, and giving every one of them branches would make the
    branches the motif.

    Scaled to the piece, for two reasons that happen to agree. Visually, a 20px
    fragment with three branching fractures reads as a bug. Structurally, this
    is what bounds the path count: cels are now a progression *and* two variants
    of each, so the per-piece budget is several times what it was.
  */
  const crackBudget = radius < 26 ? 1 : radius < 46 ? 2 : 3;
  const crackCount = next() < 0.8 ? 1 + Math.floor(next() * crackBudget) : 0;
  const crackSpec = Array.from({ length: crackCount }, () => ({
    at: Math.floor(next() * LIP * 2),
    spread: (next() - 0.5) * 1.1,
    length: 0.26 + next() * 0.36,
    /** Openness at which this fracture appears. Staggered, so the ink escaping
     *  the tear accumulates with it rather than arriving all at once. */
    from: 0.12 + next() * 0.46,
    seed: Math.floor(next() * 0x7fffffff),
  }));

  // Thick at the root, tapering hard along the branch: a split, not a stem.
  const crackWidth = Math.max(1.2, radius * 0.16);
  /*
    The pen. Thin and its own number, not a fraction of the fracture width —
    derived from that it came out near 6px on a large void, which reads as a
    dashed border rather than as a line someone drew.
  */
  const penWidth = Math.max(0.9, radius * 0.022);

  /*
    Where the pale sketch ticks sit, decided once, for the same reason the lip
    character is. Which of them are *drawn* is still decided per cel, and that
    is what makes them flicker in and out.
  */
  const markSpec = Array.from({ length: 2 + Math.floor(next() * 3) }, () => ({
    at: Math.floor(next() * LIP * 2),
    out: 0.1 + next() * 0.22,
    len: 0.22 + next() * 0.3,
    bow: (next() - 0.5) * 0.5,
    // A second stroke beside the first, the way a pen doubles a contour.
    twin: next() < 0.4,
    keep: 0.55 + next() * 0.35,
  }));

  /*
    Flaps: the surface itself, levered up.

    Hinged on a real pair of adjacent lip points rather than placed near the
    edge, so a flap is always attached to the tear that produced it and swings
    further out as that tear opens. They arrive late — an opening that starts by
    shedding pieces of the page reads as an explosion, and what is wanted is a
    surface that resists and then gives.
  */
  const flapSpec = Array.from({ length: 2 + Math.floor(next() * 2) }, () => ({
    at: 1 + Math.floor(next() * (LIP - 3)),
    side: next() < 0.5 ? 0 : 1,
    lift: 0.55 + next() * 0.8,
    twist: (next() - 0.5) * 0.8,
    from: 0.3 + next() * 0.26,
  }));

  const cels: Cel[] = [];
  for (let step = 0; step < stepCount; step++) {
    /* Never a true zero: cel 0 is a sealed hairline, which is a thing you can
       see arriving. A genuinely closed path is a degenerate line and the first
       swap would be a shape appearing out of nowhere. */
    const p = 0.06 + (step / Math.max(1, stepCount - 1)) * 0.94;

    for (let variant = 0; variant < VARIANTS; variant++) {
      const jitter = rng((seed ^ (0x9e3779b9 * (step * VARIANTS + variant + 1))) >>> 0);
      const { pts, sharp } = lips(p, jitter, 1, 0, 0);

      /*
        The inner edge, for the wall. Squeezed toward the spine and shifted, so
        the crescent between the two paths is wide on one side and nothing on
        the other — a hole is lit from somewhere, and an even ring would read as
        a stroke rather than as thickness.
      */
      /* Thin, and tied to the gape rather than to the radius. Squeezed to half
         width the crescent swallowed the opening and the hole read violet
         instead of black — the wall is the *edge* of the surface, so it has to
         be a rim inside the near lip and nothing at all on the far one. */
      const depth = Math.min(radius * 0.05, gape * radius * p * 0.4);
      const inner = lips(p, rng((seed ^ 0x165667b1) >>> 0), 0.82, depth * 0.6, -depth);

      const cracks = crackSpec.flatMap((spec) => {
        if (p < spec.from) return [];
        const anchor = pts[spec.at % pts.length];
        const outward = Math.atan2(anchor[1], anchor[0]) + spec.spread;
        return buildCrack(
          rng((spec.seed ^ (0x85ebca6b * (step + 1))) >>> 0),
          anchor,
          outward,
          // Lengthens with the opening: the corruption escaping the tear grows
          // with the tear rather than being scheduled beside it.
          radius * spec.length * (0.45 + p * 1.15),
          crackWidth,
        );
      });

      /*
        The pale layer. Black stays the mass; this is a pen going over it.

        Everything here is regenerated from the cel's own jitter stream, so it
        redraws with the boil instead of sitting still while the ink underneath
        moves — which is the whole difference between "a highlight" and "a
        drawing being made".
      */
      // Alternating short mark / long gap, rather than six values of the same
      // range: an even dash pattern is a border, and what makes a contour read
      // as drawn is that most of it is missing.
      const dash = Array.from({ length: 6 }, (_, k) =>
        k % 2 === 0
          ? r1(Math.max(1.5, radius * (0.05 + jitter() * 0.16)))
          : r1(Math.max(3, radius * (0.14 + jitter() * 0.4))),
      ).join(" ");
      const dashOffset = r1(jitter() * radius * 2);

      const marks: Stroke[] = [];
      for (const spec of markSpec) {
        // Omitted on some cels: a mark that is always there is a border.
        if (jitter() > spec.keep) continue;
        const anchor = pts[spec.at % pts.length];
        const outward = Math.atan2(anchor[1], anchor[0]);
        const perp = outward + Math.PI / 2;
        const reps = spec.twin ? 2 : 1;
        for (let k = 0; k < reps; k++) {
          const off = radius * (spec.out + k * 0.09);
          const cx = anchor[0] + Math.cos(outward) * off;
          const cy = anchor[1] + Math.sin(outward) * off;
          const len = radius * spec.len * (1 - k * 0.25) * (0.8 + jitter() * 0.4);
          const x1 = cx - Math.cos(perp) * len * 0.5;
          const y1 = cy - Math.sin(perp) * len * 0.5;
          const x2 = cx + Math.cos(perp) * len * 0.5;
          const y2 = cy + Math.sin(perp) * len * 0.5;
          const bow = len * (spec.bow + (jitter() - 0.5) * 0.25);
          marks.push({
            d: `M ${r1(x1)} ${r1(y1)} Q ${r1(cx + Math.cos(outward) * bow)} ${r1(cy + Math.sin(outward) * bow)}, ${r1(x2)} ${r1(y2)}`,
            w: penWidth,
            a: [x1, y1],
            b: [x2, y2],
          });
        }
      }

      // A highlight riding the heavy fracture runs, offset to one side and
      // short of the end — a pen catching the lit edge of a split, not a
      // second crack.
      const crackHighlights: Stroke[] = [];
      for (const run of cracks) {
        if (run.w < crackWidth * 0.45) continue;
        const dx = run.b[0] - run.a[0];
        const dy = run.b[1] - run.a[1];
        const len = Math.hypot(dx, dy) || 1;
        const off = run.w * 0.42;
        const nx = (-dy / len) * off;
        const ny = (dx / len) * off;
        const t0 = 0.1 + jitter() * 0.2;
        const t1 = t0 + 0.45 + jitter() * 0.3;
        crackHighlights.push({
          d: `M ${r1(run.a[0] + dx * t0 + nx)} ${r1(run.a[1] + dy * t0 + ny)} L ${r1(run.a[0] + dx * t1 + nx)} ${r1(run.a[1] + dy * t1 + ny)}`,
          w: Math.max(0.5, run.w * 0.16),
          a: run.a,
          b: run.b,
        });
      }

      const flaps: Flap[] = [];
      for (const spec of flapSpec) {
        if (p < spec.from) continue;
        const i = spec.side * LIP + spec.at;
        const a = pts[i];
        const b = pts[i + 1];
        if (!a || !b) continue;
        const ex = b[0] - a[0];
        const ey = b[1] - a[1];
        const len = Math.hypot(ex, ey) || 1;
        // Out of the opening, decided by which way is away from its centre —
        // a flap folds back over the surface, never down into the hole.
        let nx = -ey / len;
        let ny = ex / len;
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        if (nx * mx + ny * my < 0) {
          nx = -nx;
          ny = -ny;
        }
        /* Tapered outward, not splayed. Widening the free edge made a flap
           read as a rectangle laid over the hole; narrowing it makes the same
           four points read as a tab still hinged on the lip and bent back. */
        const lift = radius * 0.17 * spec.lift * p * (0.85 + jitter() * 0.3);
        const c: Pt = [
          b[0] + nx * lift * (1 + spec.twist) - (ex / len) * lift * 0.3,
          b[1] + ny * lift * (1 + spec.twist) - (ey / len) * lift * 0.3,
        ];
        const d: Pt = [
          a[0] + nx * lift * (1 - spec.twist) * 0.7 + (ex / len) * lift * 0.3,
          a[1] + ny * lift * (1 - spec.twist) * 0.7 + (ey / len) * lift * 0.3,
        ];
        flaps.push({
          d:
            `M ${r1(a[0])} ${r1(a[1])} L ${r1(b[0])} ${r1(b[1])}` +
            ` L ${r1(c[0])} ${r1(c[1])} L ${r1(d[0])} ${r1(d[1])} Z`,
          lit: `M ${r1(d[0])} ${r1(d[1])} L ${r1(c[0])} ${r1(c[1])}`,
        });
      }

      const outline = closedSpline(pts, sharp);
      cels.push({
        outline,
        boxed: closedSpline(pts, sharp, half, half),
        // Empty while the tear is a hairline: there is no inside yet, and a
        // crescent drawn across a slit is just a second stroke.
        wall: p < 0.2 ? "" : `${outline} ${closedSpline(inner.pts, inner.sharp)}`,
        cracks,
        dash,
        dashOffset,
        marks,
        crackHighlights,
        flaps,
      });
    }
  }

  return { cels, crackWidth, penWidth };
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
 * **Not a random walk over the cel set any more.** It used to pick a cel at
 * random on every swap, which is exactly why the opening could only ever grow
 * by being scaled — every cel was the same size, so the shape carried no
 * progress and all of it had to come out of the transform. The cel is now a
 * *function of the openness curve*: the step is read off the clock, so each
 * swap advances the tear a little further along its own spine, and the swaps on
 * the way down close it again.
 *
 * What remains random is which of the two jitter variants of that step is
 * showing, and when the swaps happen. `hot` marks the windows where the surface
 * is failing rather than boiling, and inside them the rate goes from a resting
 * ~4fps to about 18 and the step over- and under-runs its own opening by one —
 * the tear giving and catching. Never by more than one: two would drop a
 * near-closed seam into the middle of a peak, and the progression is the thing
 * carrying the whole reading.
 *
 * Every swap is a hard cut, because hand-drawn animation does not cross-fade.
 */
function morphTracks(
  next: () => number,
  prefix: string,
  stepCount: number,
  lifeMs: number,
  hot: { from: number; to: number }[],
  restMs: [number, number],
  surges: number[],
  offset: number,
): { names: string[]; css: string; boundaries: { t: number; cel: number }[] } {
  const isHot = (u: number) => hot.some((h) => u >= h.from && u <= h.to);
  const boundaries: { t: number; cel: number }[] = [];
  const top = stepCount - 1;
  let t = 0;
  let last = -1;

  // Capped: a track is CSS text, emitted once per cel, and past a few dozen
  // stops the extra frames are not visible at these rates anyway.
  while (t < 1 && boundaries.length < 56) {
    const open = openWith(surges, t, offset);
    let step = Math.round(open * top);
    if (isHot(t)) step = Math.max(0, Math.min(top, step + (next() < 0.5 ? -1 : 1)));

    const variant = Math.floor(next() * VARIANTS);
    let cel = step * VARIANTS + variant;
    if (cel === last) cel = step * VARIANTS + ((variant + 1) % VARIANTS);
    last = cel;
    boundaries.push({ t, cel });

    /*
      The swap rate rides the opening rather than switching between two speeds.
      `restMs` is [fast at the peak, slow at the seed] — so a sealed tear
      redraws at about 4fps and a gaping one at nearly 20, and the acceleration
      is visible *as* it opens instead of arriving at a window boundary.
    */
    const frameMs = isHot(t)
      ? 38 + next() * 26
      : (restMs[1] + (restMs[0] - restMs[1]) * open) * (0.8 + next() * 0.45);
    t += frameMs / lifeMs;
  }

  const names: string[] = [];
  let css = "";
  for (let k = 0; k < stepCount * VARIANTS; k++) {
    const name = `${prefix}m${k}`;
    names.push(name);
    const stops = boundaries
      .map((b) => `${r2(clamp01(b.t) * 100)}%{opacity:${b.cel === k ? 1 : 0}}`)
      .join("");
    css += `@keyframes ${name}{${stops}}`;
  }
  return { names, css, boundaries };
}

/**
 * The blackout's clip track — the interface inside the opening, removed.
 *
 * The blackout has to follow the tear, and it cannot simply be one of the cels:
 * cel 0 is a sealed hairline now, so a static clip would either erase nothing
 * for the whole life or erase the full gape from the first frame. It also
 * cannot be one blackout per cel — that was measured at six live
 * `backdrop-filter`s pinning the page to 30fps.
 *
 * So it is one element with an animated `clip-path`, stepped through the same
 * boundaries the silhouette uses. Emitted once per *step* rather than once per
 * swap: a path string is several hundred characters and the two variants of a
 * step differ by a percent or two of edge jitter, which nothing can see through
 * a `brightness(0.06)` blackout.
 */
function clipTrack(
  name: string,
  boundaries: { t: number; cel: number }[],
  cels: Cel[],
): string {
  let body = "";
  let lastStep = -1;
  for (const b of boundaries) {
    const step = Math.floor(b.cel / VARIANTS);
    if (step === lastStep) continue;
    lastStep = step;
    body += `${r2(clamp01(b.t) * 100)}%{clip-path:path('${cels[step * VARIANTS].boxed}')}`;
  }
  return body ? `@keyframes ${name}{${body}}` : "";
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

type Archetype = "fissure" | "rupture" | "cascade" | "corruptor" | "blink";

/**
 * Every opening lives the same five-second arc: the surface cracks, the split
 * runs, the lips part, the tear gapes at its widest, and then it contracts and
 * the page closes over it.
 *
 * **The envelope is shared and the archetype is the character played over it.**
 * Before this, each archetype owned its whole timeline, so "how open is it"
 * carried no meaning and a tear's corruption had no relationship to what the
 * tear was doing. Openness is now the clock: everything else in the effect is a
 * function of it.
 *
 * That is also what makes the corruption feel earned rather than scheduled. A
 * burst's strength, its region and how violent the edge is at that moment are
 * all read off the same opening curve, so a fresh crack is quiet and a gaping
 * tear throws the lightning.
 */

/** Where the tear is widest. Everything after this is the closing. */
const GROW_PEAK = 0.78;

/**
 * The break that lets the tear start, before there is an opening to see.
 *
 * The order matters more than the moment does. Previously the first corruption
 * arrived a quarter to a third of the way through a life — well after the shape
 * had faded up — so the sequence read as "a thing appeared, and later some
 * effects happened near it". Firing at the very start inverts that: the surface
 * cracks first and the tear comes through the crack, which is the whole
 * difference between something breaking through and something being placed.
 */
const ONSET = 0.015;

/**
 * The onset is sharp regardless of how open the tear is.
 *
 * Every other burst takes its strength from the opening, which is the point of
 * the envelope — but at `ONSET` there is barely a seam and that rule would
 * produce a burst too faint to read as anything. A tear does not start gently;
 * it starts as a snap and *then* something comes through.
 */
const ONSET_STRENGTH = 0.62;

/**
 * How far open the tear is at time `t`, from sealed to its widest.
 *
 * **This is the file's clock, and it drives geometry rather than a scale
 * factor.** The curve it replaced returned a scale, which meant "bigger" could
 * only ever be "the same drawing, enlarged" — the single reason the effect read
 * as a blob growing. `buildCels` consumes this number to decide how far the
 * split has run along its spine and how far the lips have parted, so the same
 * curve now produces a different *drawing* at every point rather than a
 * different size of one drawing.
 *
 * Deliberately accelerating rather than linear: a constant rate reads as
 * something being opened by an outside hand, an accelerating one as a surface
 * giving way under its own load. The hold at full gape is what lets the peak be
 * seen at all — without it the widest frame is also the first frame of the
 * close and is never read.
 */
function openness(t: number): number {
  if (t <= 0) return 0;
  if (t < 0.08) return (t / 0.08) * 0.12;
  if (t < GROW_PEAK) {
    const u = (t - 0.08) / (GROW_PEAK - 0.08);
    return 0.12 + Math.pow(u, 1.4) * 0.88;
  }
  if (t < 0.88) return 1;
  const u = (t - 0.88) / 0.12;
  return Math.pow(1 - u, 1.3);
}

/**
 * Openness with a script's surges spliced in, and a piece's own delay applied.
 *
 * A **surge** is the surface losing all at once: the split jumps to its full
 * run for a few frames, out of sequence with the curve. It is expressed here,
 * on the opening, rather than as an overscale on the transform — a jump in size
 * is the shape being thrown at the screen, and a jump in openness is the tear
 * winning.
 *
 * An **offset** is a piece that has not torn yet. Its pose track still runs
 * from the beginning, so what is on screen before its offset is a sealed seam
 * rather than nothing — and then that seam splits. A piece that faded in would
 * be a second void arriving; a seam that opens is the same failure spreading.
 *
 * One function, used by the morph track, the burst strengths and the blackout
 * clip alike, so those three can never disagree about how open the tear is.
 */
function openWith(surges: number[], t: number, offset = 0): number {
  const local = offset > 0 ? clamp01((t - offset) / Math.max(0.08, 1 - offset)) : clamp01(t);
  if (t >= offset) {
    for (const s of surges) if (t >= s && t <= s + 0.055) return Math.max(openness(local), 0.9);
  }
  return openness(local);
}

/**
 * How present the ink is.
 *
 * Ramps fast and then sits near solid, which is the opposite of what this did
 * before. The old curve kept the first third of the life at half strength
 * because the void arrived as a hard black shape at 15% scale and needed
 * hiding. What arrives now is a hairline crack, and a crack that fades up reads
 * as a smudge — it wants to be crisp from the first frame and simply small.
 */
function presence(t: number): number {
  if (t < 0.02) return (t / 0.02) * 0.55;
  if (t < 0.3) return 0.55 + ((t - 0.02) / 0.28) * 0.35;
  return Math.min(1, 0.9 + ((t - 0.3) / 0.4) * 0.1);
}

/** Instability, 0 at the seed and 1 at the widest. Every wobble, skew, hard cut
 *  and flicker in the file is scaled by this, so the surface comes apart in
 *  proportion to how far the tear has opened. */
function unrest(t: number): number {
  return Math.pow(clamp01(t / GROW_PEAK), 1.7);
}

/**
 * The piece's physical scale — and it is nearly constant, which is the
 * correction this whole pass is about.
 *
 * The transform used to carry the growth, running 0.02 to 1.45 over a life. A
 * scale on a black silhouette is indistinguishable from a blob inflating, and
 * no amount of edge detail survives it: whatever is drawn, the eye reads one
 * shape getting bigger. Growth now lives in the geometry, so all this has left
 * to do is keep something moving *between* cel swaps, which at four to twenty
 * swaps a second is a real job — a wholly static transform makes the swaps read
 * as a slideshow.
 *
 * Twelve percent, top to bottom. Enough to breathe, far too little to be read
 * as the thing growing.
 */
function bodyScale(t: number, peak: number): number {
  return peak * (0.9 + openness(t) * 0.12);
}

/** What separates one archetype from another, over the shared envelope. */
type Character = {
  /** Scale of the piece's box. Near 1 — see `bodyScale`. */
  peak: number;
  /** How many poses the life is cut into — the base resolution of its motion. */
  steps: number;
  /** Positional unrest in px at the widest. */
  wobble: number;
  /** Rotational unrest in degrees at the widest. */
  spin: number;
  /** Chance a late pose is a hard cut rather than a drift. */
  cutChance: number;
  /** Chance a late pose blanks for a frame. */
  flicker: number;
  /** How hard the piece squashes and skews at the widest. */
  deform: number;
};

/**
 * The shared spine: a crack, a run, escalating unrest, the widest gape, and the
 * page closing over.
 *
 * Archetypes call this and then splice their own signature events in — the
 * rupture's give, the corruptor's recoils. `keyframesFrom` sorts and separates
 * stops, so a spliced pose can land anywhere without the caller minding order.
 */
function envelopePoses(next: () => number, ch: Character): Pose[] {
  /* Starts at very nearly full size and invisible, not at a speck. There is
     nothing to grow: what makes the first frames small is that the tear itself
     is a hairline, and the box it is drawn in has always been the same box. */
  const poses: Pose[] = [
    { at: 0, ...REST, sx: ch.peak * 0.9, sy: ch.peak * 0.9, o: 0, ease: EASE.punch },
  ];

  let x = 0;
  let y = 0;
  let rot = 0;

  for (let i = 1; i <= ch.steps; i++) {
    const t = (i / ch.steps) * 0.86;
    const u = unrest(t);
    const s = bodyScale(t, ch.peak);

    x += (next() - 0.5) * ch.wobble * u;
    y += (next() - 0.5) * ch.wobble * 0.78 * u;
    rot += (next() - 0.5) * ch.spin * u;

    // Squash on one axis is stretch on the other, so the mass is conserved and
    // it reads as the surface being strained rather than as the tear resizing.
    const squash = 1 + (next() - 0.5) * ch.deform * u;

    poses.push({
      at: t,
      x,
      y,
      rot,
      sx: s * squash,
      sy: s / squash,
      skew: (next() - 0.5) * 22 * u,
      o: u > 0.4 && next() < ch.flicker ? 0.12 : presence(t),
      ease: u > 0.3 && next() < ch.cutChance ? EASE.cut : EASE.drift,
    });
  }

  /*
    The page closing over, in the last ~700ms.

    The tear itself is already shutting — the cel progression runs back down to
    a hairline over the same window — so what is left here is the seam snapping
    closed and the ink going. A vertical pinch on the last two stops, hard cut
    on the finish: a surface that has healed does it abruptly, it just does not
    *begin* abruptly.
  */
  const held = bodyScale(0.86, ch.peak);
  poses.push({ at: 0.9, ...REST, x, y, rot, sx: held, sy: held * 0.94, ease: EASE.collapse });
  poses.push({ at: 0.965, ...REST, x, y, rot, sx: held * 0.92, sy: held * 0.4, ease: EASE.cut });
  poses.push({ at: 1, ...REST, x, y, rot, sx: held * 0.7, sy: 0.05, o: 0 });
  return poses;
}

/** One piece of an opening. `dx`/`dy` are in units of the void's ink, applied
 *  as a static placement — a chain of openings along one line of failure, never
 *  a formation that drifts as a unit. */
type PieceSpec = {
  poses: Pose[];
  scale: number;
  /** Normalised time before which this piece is still a sealed seam. */
  offset: number;
  dx: number;
  dy: number;
};

type Script = {
  /** One pose track per piece. Piece 0 is what bursts are anchored to. */
  pieces: PieceSpec[];
  /** Windows where the edge should be failing rather than boiling. */
  hot: { from: number; to: number }[];
  /**
   * Normalised times at which reality breaks. **Not how hard** — that is read
   * off how open the tear actually is when the moment arrives.
   *
   * This was an `{ at, strength }` pair, and the two disagreed: strength came
   * from the *scheduled* time while the burst was drawn at the size taken from
   * the pose track, which a spliced recoil can move a long way. One source of
   * truth now, and it is `openWith`.
   */
  bursts: number[];
  /** Times the split jumps to its full run in a single frame. See `openWith`. */
  surges: number[];
  lifeMs: number;
  /** Steps in the opening progression. Each is drawn in `VARIANTS` jitters. */
  stepCount: number;
  /** Per-cel edge perturbation. High values look like the lips cannot hold. */
  celSpread: number;
  /** Silhouette swap interval: [fast at the widest, slow at the seam]. */
  restMs: [number, number];
};

/** Roughly five seconds for every opening, with just enough spread that several
 *  on screen do not beat in time with each other. */
const life = (next: () => number) => 4500 + next() * 1100;

/**
 * **Fissure** — the quiet one, and the reason the others land.
 *
 * A long split that runs a long way and never gapes much: the version of the
 * arc you can look away from. It still corrupts three times, escalating, so
 * even the calm archetype carries the beat the brief asks for — the surrounding
 * interface getting worse as the tear gets wider.
 */
function fissureScript(next: () => number): Script {
  const peak = 0.95 + next() * 0.12;
  const poses = envelopePoses(next, {
    peak,
    steps: 13,
    wobble: 20,
    spin: 7,
    cutChance: 0.2,
    flicker: 0.04,
    deform: 0.16,
  });

  return {
    pieces: [{ poses, scale: 1, offset: 0, dx: 0, dy: 0 }],
    hot: [{ from: 0.66, to: 0.95 }],
    bursts: [ONSET, 0.44 + next() * 0.06, 0.76 + next() * 0.06],
    surges: [],
    lifeMs: life(next),
    stepCount: 8,
    celSpread: 1,
    restMs: [70, 250],
  };
}

/**
 * **Rupture** — the surface loses.
 *
 * Follows the envelope until roughly two-thirds through and then gives all at
 * once: the split jumps to its full run in a single frame and keeps failing
 * after it. The one archetype whose close is violent rather than a fold.
 *
 * Its signature used to be thrown fragments — small independent shapes on their
 * own arcs — which is a cluster of blobs by any other name and is gone. What it
 * throws now is the *split itself*, continuing: one or two further openings
 * along the same line of failure, which tear open after the first has. They sit
 * on one axis and never radially, because a ring of satellites around a centre
 * is exactly the reading being corrected.
 */
function ruptureScript(next: () => number): Script {
  const peak = 1.05 + next() * 0.12;
  const give = 0.6 + next() * 0.08;
  const poses = envelopePoses(next, {
    peak,
    steps: 15,
    wobble: 26,
    spin: 12,
    cutChance: 0.4,
    flicker: 0.1,
    deform: 0.26,
  });

  // The give, spliced over the envelope. Nothing eases into it. The *opening*
  // jumps — see `surges`; this is only the strain that goes with it.
  const held = bodyScale(give, peak);
  poses.push({ at: give - 0.012, ...REST, sx: held, sy: held, ease: EASE.cut });
  poses.push({
    at: give,
    ...REST,
    sx: peak * 1.12,
    sy: peak * 0.92,
    skew: (next() - 0.5) * 26,
    ease: EASE.cut,
  });
  poses.push({ at: give + 0.03, ...REST, sx: peak * 0.96, sy: peak * 1.1, rot: (next() - 0.5) * 18, ease: EASE.stutter });

  let t = give + 0.06;
  while (t < 0.9) {
    poses.push({
      at: t,
      ...REST,
      x: (next() - 0.5) * 32,
      y: (next() - 0.5) * 26,
      sx: peak * (0.93 + next() * 0.18),
      sy: peak * (0.93 + next() * 0.18),
      rot: (next() - 0.5) * 22,
      skew: (next() - 0.5) * 20,
      o: next() < 0.18 ? 0.24 : 1,
      ease: EASE.cut,
    });
    t += 0.026 + next() * 0.03;
  }

  const pieces: PieceSpec[] = [{ poses, scale: 1, offset: 0, dx: 0, dy: 0 }];

  const axis = next() * Math.PI * 2;
  const kids = 1 + Math.floor(next() * 2);
  for (let i = 0; i < kids; i++) {
    const away = (i % 2 === 0 ? 1 : -1) * (0.85 + next() * 0.6);
    const wander = (next() - 0.5) * 0.3;
    pieces.push({
      scale: 0.4 + next() * 0.26,
      offset: give + 0.02 + next() * 0.08,
      dx: Math.cos(axis) * away - Math.sin(axis) * wander,
      dy: Math.sin(axis) * away + Math.cos(axis) * wander,
      poses: envelopePoses(next, {
        peak: peak * 0.9,
        steps: 10,
        wobble: 18,
        spin: 14,
        cutChance: 0.5,
        flicker: 0.12,
        deform: 0.3,
      }),
    });
  }

  return {
    pieces,
    hot: [{ from: give - 0.02, to: 0.95 }],
    bursts: [ONSET, 0.4, give],
    surges: [give],
    lifeMs: life(next),
    // Coarser than the single-piece scripts, because every step is drawn twice
    // per piece and this one has up to three of them.
    stepCount: 7,
    celSpread: 2.4,
    restMs: [46, 210],
  };
}

/**
 * **Cascade** — one failure, propagating.
 *
 * Three or four openings strung along a single line, each a sealed seam until
 * the one before it has torn, then splitting in turn. What this replaced was
 * the `swarm`: several pieces on independent radial drifts that fanned out as
 * they grew, which is precisely "one blob splitting into a cluster of blobs"
 * and is the single strongest thing that made the effect read as organic.
 *
 * The difference is the axis. Everything here happens along one direction, in
 * sequence, at decreasing size — a crack running across a pane, not a colony.
 * They are placed statically rather than animated apart: a formation that
 * separates as it grows is a particle system whatever its pieces are shaped
 * like.
 */
function cascadeScript(next: () => number): Script {
  const peak = 0.95 + next() * 0.12;
  const count = 3;
  const axis = next() * Math.PI * 2;
  const pieces: PieceSpec[] = [];
  let along = 0;

  for (let i = 0; i < count; i++) {
    along += 0.8 + next() * 0.5;
    const wander = (next() - 0.5) * 0.4;
    pieces.push({
      poses: envelopePoses(next, {
        peak,
        steps: 11,
        wobble: 16,
        spin: 9,
        cutChance: 0.26,
        flicker: 0.07,
        deform: 0.2,
      }),
      scale: i === 0 ? 1 : 0.44 + next() * 0.28,
      offset: i === 0 ? 0 : 0.1 + i * 0.12 + next() * 0.05,
      dx: i === 0 ? 0 : Math.cos(axis) * along - Math.sin(axis) * wander,
      dy: i === 0 ? 0 : Math.sin(axis) * along + Math.cos(axis) * wander,
    });
  }

  return {
    pieces,
    hot: [{ from: 0.6, to: 0.95 }],
    bursts: [ONSET, 0.46 + next() * 0.06, 0.74 + next() * 0.06],
    surges: [0.5 + next() * 0.1],
    lifeMs: life(next),
    stepCount: 7,
    celSpread: 1.5,
    restMs: [58, 220],
  };
}

/**
 * **Corruptor** — the archetype the brief is really about.
 *
 * Opens steadily and calmly and puts all its energy into the page instead of
 * into itself: three bursts, escalating with the gape, and it only ever flinches
 * around them. Keeping the tear nearly still is the point — the reading has to
 * be "this thing is doing something to the page", not "this thing is wriggling".
 */
function corruptorScript(next: () => number): Script {
  const peak = 1 + next() * 0.1;
  const poses = envelopePoses(next, {
    peak,
    steps: 12,
    wobble: 12,
    spin: 5,
    cutChance: 0.16,
    flicker: 0.03,
    deform: 0.14,
  });

  const bursts: number[] = [ONSET];
  const surges: number[] = [];
  const hot: { from: number; to: number }[] = [];

  // Spread across the opening so the escalation is legible: the first is a
  // twitch on a fresh crack, the last is a gaping tear coming apart.
  for (const at of [0.34, 0.58, 0.8]) {
    const jittered = at + (next() - 0.5) * 0.05;
    bursts.push(jittered);
    hot.push({ from: jittered - 0.015, to: jittered + 0.05 });
    if (at > 0.5) surges.push(jittered);
    const s = bodyScale(jittered, peak);
    const u = unrest(jittered);
    poses.push({ at: jittered - 0.014, ...REST, sx: s, sy: s, ease: EASE.cut });
    poses.push({
      at: jittered,
      ...REST,
      sx: s * (1.08 + 0.1 * u),
      sy: s * (0.92 - 0.06 * u),
      skew: (next() - 0.5) * 26 * u,
      x: (next() - 0.5) * 20 * u,
      ease: EASE.cut,
    });
    poses.push({ at: jittered + 0.016, ...REST, sx: s * 0.94, sy: s * 1.08, ease: EASE.stutter });
    poses.push({ at: jittered + 0.045, ...REST, sx: s, sy: s, ease: EASE.drift });
  }

  return {
    pieces: [{ poses, scale: 1, offset: 0, dx: 0, dy: 0 }],
    hot,
    bursts,
    surges,
    lifeMs: life(next),
    stepCount: 9,
    celSpread: 1.4,
    restMs: [64, 260],
  };
}

/**
 * **Blink** — a tear that will not hold.
 *
 * Same five seconds as the rest, but it never settles into its opening: it
 * stutters wider in hard steps, snaps shut for a frame at a time throughout,
 * and surges twice. Its character is that its unrest *starts high* instead of
 * arriving with the gape.
 */
function blinkScript(next: () => number): Script {
  const peak = 1 + next() * 0.14;
  const poses = envelopePoses(next, {
    peak,
    steps: 22,
    wobble: 24,
    spin: 18,
    cutChance: 0.9,
    flicker: 0.3,
    deform: 0.34,
  });

  // Its opacity does not ramp with the opening like the others: it is already
  // flickering while it is a seam, which is what makes it read as faulty rather
  // than as young.
  for (const pose of poses) {
    if (pose.at > 0.04 && pose.at < 0.9 && next() < 0.28) pose.o = 0;
  }

  return {
    pieces: [{ poses, scale: 1, offset: 0, dx: 0, dy: 0 }],
    hot: [{ from: 0.2, to: 0.95 }],
    bursts: [ONSET, 0.5 + next() * 0.06, 0.76 + next() * 0.06],
    surges: [0.3 + next() * 0.08, 0.64 + next() * 0.08],
    lifeMs: life(next),
    stepCount: 9,
    celSpread: 2.2,
    restMs: [40, 150],
  };
}

const SCRIPTS: Record<Archetype, (next: () => number) => Script> = {
  fissure: fissureScript,
  rupture: ruptureScript,
  cascade: cascadeScript,
  corruptor: corruptorScript,
  blink: blinkScript,
};

/** Weighted so the screen is usually calm: the quiet archetype is the most
 *  common thing on it and the loudest is the rarest. */
const WEIGHTS: [Archetype, number][] = [
  ["fissure", 0.3],
  ["corruptor", 0.22],
  ["cascade", 0.19],
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
  return "fissure";
}

/* ------------------------------------------------------------------ model */

type Piece = {
  key: string;
  box: number;
  /** Static placement relative to the void's origin, in px. A chain of
   *  openings along one line of failure — see `cascadeScript`. */
  dx: number;
  dy: number;
  cels: Cel[];
  crackWidth: number;
  penWidth: number;
  animName: string;
  morphNames: string[];
  /** Keyframe name for the animated blackout clip. Anchor piece only. */
  clipName: string;
  /** The clip's own first frame, so the element is correct before the
   *  animation's first stop applies. */
  clipStart: string;
};

type Spot = {
  id: number;
  kind: Archetype;
  /**
   * Horizontal placement, as a percentage of the viewport width. Still a
   * percentage because there is no horizontal scroll: document x and viewport
   * x are the same number, and a percentage survives a resize.
   */
  x: number;
  /**
   * Vertical placement *at the moment it opened*, as a viewport percentage.
   *
   * Kept because the chaining and the burst pose maths are written in this
   * space, and because it is what a resize would want. It is **not** what the
   * tear is drawn at — see `docY`.
   */
  y: number;
  /**
   * Where the tear sits in the *document*, in px from the top of the page.
   *
   * **This is the fix for a tear that slid over the multiverse as you
   * scrolled.** A spot is a hole in the background, and the background scrolls
   * with the document now; a hole pinned to the viewport stops being a hole in
   * anything, because the thing it was cut out of moves out from behind it. It
   * opens where you are looking — `scrollY` is captured at spawn — and from
   * then on it belongs to that place in the page and travels with the
   * structures and threads around it.
   */
  docY: number;
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
  /** A torn edge rather than a rectangle — see `tornBand`. */
  clip: string;
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
  /** Viewport x — the same as document x, there being no horizontal scroll. */
  cx: number;
  /** Document y, inherited from the tear's own anchor so the two stay welded. */
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
  /** Pale marks thrown round the break — the pen following the damage. */
  sketch: Stroke[];
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

/**
 * A band with torn edges instead of straight ones.
 *
 * A tear slice was a perfect rectangle, which is the one shape that gives the
 * corruption away as computed. Walking a few jittered points across the top and
 * back along the bottom costs nothing and makes the band look ripped out of the
 * page — the same reasoning the void's own outline follows, applied to the part
 * of the burst that was still geometric.
 */
function tornBand(next: () => number): string {
  const steps = 5;
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * 100;
    top.push(`${r1(x)}% ${r1(next() * 26)}%`);
    bottom.push(`${r1(x)}% ${r1(100 - next() * 26)}%`);
  }
  return `polygon(${[...top, ...bottom.reverse()].join(", ")})`;
}

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
    clip: tornBand(next),
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
    /*
      The pen following the break.

      Loose arcs struck around the burst, in the same warm paper white the void
      wears — the reference's linework does not trace the form so much as circle
      it. Kept to a handful and thin: black is still the event, and this is the
      hand that drew it passing over.
    */
    sketch: Array.from({ length: Math.round(1 + strength * 3) }, () => {
      const angle = next() * Math.PI * 2;
      const dist = size * (0.22 + next() * 0.3);
      const cx = size / 2 + Math.cos(angle) * dist;
      const cy = size / 2 + Math.sin(angle) * dist;
      const perp = angle + Math.PI / 2;
      const len = size * (0.12 + next() * 0.22);
      const bow = len * (0.25 + next() * 0.5) * (next() < 0.5 ? -1 : 1);
      const x1 = cx - Math.cos(perp) * len * 0.5;
      const y1 = cy - Math.sin(perp) * len * 0.5;
      const x2 = cx + Math.cos(perp) * len * 0.5;
      const y2 = cy + Math.sin(perp) * len * 0.5;
      return {
        d: `M ${r1(x1)} ${r1(y1)} Q ${r1(cx + Math.cos(angle) * bow)} ${r1(cy + Math.sin(angle) * bow)}, ${r1(x2)} ${r1(y2)}`,
        w: Math.max(0.8, size * 0.006),
        a: [x1, y1] as Pt,
        b: [x2, y2] as Pt,
      };
    }),
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

/**
 * How many tears may be open at once.
 *
 * Lowered from 2/3 after the effect was called too frequent. The cap and the
 * interval are one decision, not two: at a five-second life a cap of three is
 * only reachable when tears are arriving faster than they close, so leaving it
 * at three would have let a chain put three on screen even after the interval
 * was tripled.
 */
const maxSpots = (width: number) => (width < 640 ? 1 : 2);
/** The ceiling a dispersal or a reform may push past `maxSpots` to. */
const HARD_MAX = 3;
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
  /*
    The same measurement the atmosphere and the threads are sized from, so all
    three layers cover exactly the same page and a tear cannot be clipped at a
    height the structures behind it carry on past.
  */
  const { height, measured } = useDocumentBands();
  const documentHeight = measured ? `${height}px` : "100vh";
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
      /*
        Corruption outside the frame is cost with nothing to show for it.

        `cy` is a document coordinate now, so "the frame" is the part of the
        document currently on screen — which is what this always meant, and what
        it stopped saying once the tear anchored to the page instead of to the
        viewport. A tear that has scrolled away does not spend a backdrop-filter
        on a burst nobody can see.
      */
      const viewTop = window.scrollY;
      if (
        cx < -size ||
        cx > window.innerWidth + size ||
        cy < viewTop - size ||
        cy > viewTop + window.innerHeight + size
      )
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
        const { cels, crackWidth, penWidth } = buildCels(
          (seed ^ (0xc2b2ae35 * (i + 1))) >>> 0,
          pieceInk / 2,
          box,
          script.stepCount,
          script.celSpread,
        );

        const animName = `${prefix}p${i}`;
        css += keyframesFrom(animName, spec.poses);

        const morph = morphTracks(
          rng((seed ^ (0x27d4eb2f * (i + 1))) >>> 0),
          animName,
          script.stepCount,
          script.lifeMs,
          script.hot,
          script.restMs,
          script.surges,
          spec.offset,
        );
        css += morph.css;

        // Only the anchor piece erases what is in front of it — see the tear
        // layer's own note on why that is one per void and not one per piece.
        const clipName = i === 0 ? `${animName}c` : "";
        if (clipName) css += clipTrack(clipName, morph.boundaries, cels);

        return {
          key: `${id}-${i}`,
          box,
          dx: spec.dx * ink,
          dy: spec.dy * ink,
          cels,
          crackWidth,
          penWidth,
          animName,
          morphNames: morph.names,
          clipName,
          clipStart: cels[0].boxed,
        };
      });

      live.current += 1;
      /*
        The document coordinate, fixed once, here.

        Read at spawn rather than at paint: the tear opens where the reader is
        looking, and then stays where it opened. Reading `scrollY` later would
        put it wherever they had scrolled to by then, which is the bug this
        replaced — the hole drifting across the structures it was torn out of.
      */
      const docY = window.scrollY + (y / 100) * vh;
      positions.set(id, { px: (x / 100) * vw, py: (y / 100) * vh, ink });
      setSpots((current) => [
        ...current,
        { id, kind, x, y, docY, ink, lifeMs: script.lifeMs, pieces, css },
      ]);

      /*
        Corruption is scheduled off the same script that drives the tear, and
        anchored by evaluating the pose track at the burst's own moment — so
        reality breaks where the opening will actually be by then, not where it
        started out.
      */
      const anchor = script.pieces[0].poses;
      for (const at of script.bursts) {
        after(at * script.lifeMs, () => {
          const pose = poseAt(anchor, at);
          /*
            How far open the tear actually is at this instant.

            `openWith` is the same function the silhouette progression and the
            blackout clip read, surges included, so the burst cannot disagree
            with the drawing it is firing out of. Both how hard it hits and how
            large it is drawn come from this one number: a fresh crack is quiet
            and small, a gaping tear throws everything.

            It also chooses which *cel* supplies the silhouette, so the
            corruption is clipped to the opening as it is at that moment rather
            than to a shape it had seconds earlier.
          */
          const open = openWith(script.surges, at);
          const onset = at <= ONSET + 0.001;
          const step = Math.round(open * (script.stepCount - 1));
          fireBurst(
            (x / 100) * window.innerWidth + pose.x,
            /*
              Document space, off the tear's own anchor — not
              `(y / 100) * innerHeight`, which was both viewport-relative and
              re-derived from whatever the viewport happened to be at the moment
              the burst fired. The corruption has to break out of the opening,
              so it has to share the opening's coordinate exactly.
            */
            docY + pose.y,
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
            pieces[0].cels[step * VARIANTS].boxed,
            onset ? ONSET_STRENGTH : clamp01(0.18 + open * 0.82),
            // The opening break is drawn wider than the hairline behind it: the
            // crack in the surface has to be visible before the tear is.
            onset ? 0.55 : Math.max(0.3, open),
          );
        });
      }

      /*
        What happens as it goes. Both interesting outcomes start before the
        parent is gone, so the eye reads one continuous event.

        **These are the second source of frequency and were the easier one to
        miss.** Roughly half of every tear used to beget another — a blink
        chained six times out of ten — so the scheduled interval was never the
        real rate. Halved across the board: a chain is now the exception that
        makes one arrival memorable rather than the normal way tears appear.
      */
      const fate = Math.random();
      if (kind === "blink" && fate < 0.3) {
        // Blinks chain: one anomaly hopping, not two unrelated arrivals.
        after(script.lifeMs * 0.82, () => spawn({ x, y, ink: ink * pick(1.5, 2.6), forced: false }));
      } else if (fate < 0.06) {
        const shards = 2;
        for (let i = 0; i < shards; i++) {
          after(script.lifeMs * 0.86 + i * pick(80, 240), () =>
            spawn({ x, y, ink, forced: true }),
          );
        }
      } else if (fate < 0.16) {
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
        The interval, and the reasoning it reversed.

        It was 4.2-9.5s, chosen when the life dropped to five seconds so the
        layer would keep the *presence* the old 14-22s tears had. That was the
        wrong target: a tear at roughly 70% duty is not restraint, it is
        wallpaper, and the effect was called too frequent. Ambient here means
        the page is usually clean and a tear is an event you catch.

        Read this together with the two other things that set the real rate: the
        cap above, and the chain probabilities in `spawn`. Raising this alone
        does very little, which is why "less often" had to be all three.

        **Measured rather than reasoned about, because the chains make this
        number a poor predictor of the rate.** Sampling an untouched home page:
        one tear every 15.0s with the screen occupied 25% of the time, against
        roughly one every 6.9s and over 70% before. Two or three can still
        briefly coexist when a dispersal fires, which is 6% of tears and is the
        one moment that is meant to look like more than one thing.

        Worth knowing before retuning: 13-26s and 15-30s measured the same
        arrival rate to within noise over three minutes. This interval is the
        least sensitive of the three levers, and reaching for it alone is what
        makes a "less often" pass fail.
      */
      after(pick(15000, 30000), () => {
        spawn();
        schedule();
      });
    };

    // One on arrival rather than two. A page that opens with two tears on it
    // has told you what the layer is before you have read anything.
    after(pick(5000, 11000), () => spawn());
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
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden"
        style={{ height: documentHeight }}
      >
        {spots.map((spot) => (
          <div
            key={spot.id}
            data-void={spot.kind}
            className="absolute"
            style={{ left: `${spot.x}%`, top: spot.docY }}
          >
            {spot.pieces.map((piece) => (
              <div
                key={piece.key}
                className="absolute"
                style={{
                  left: -piece.box / 2 + piece.dx,
                  top: -piece.box / 2 + piece.dy,
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
                      {/*
                        A hard misregistration plate under the ink, in the
                        purple separation.

                        What this replaced was an "ink bleed" — the same drawing
                        at 1.08 and half strength. That is a soft halo by any
                        other name, and a soft halo round a dark mass is the
                        single most reliable way to make something read as
                        organic; it was doing real work to keep the old shape
                        looking like a blob. An un-blurred offset plate is the
                        comic device that belongs here instead, and `CLAUDE.md`
                        names it: a drop shadow in this app is a registration
                        error, never a blur.
                      */}
                      <path
                        d={cel.outline}
                        fill="var(--sv-purple)"
                        opacity={0.32}
                        transform="translate(2.5 -2)"
                      />
                      <path d={cel.outline} fill="#000" />
                    </g>
                  ))}
                </svg>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/*
        The tear itself, drawn **over** the interface.

        This is the layer that decides whether the effect reads as a hole or as
        a sticker, and the reasoning is worth keeping. A void whose whole body
        sits at `-z-10` is *behind* the UI: a panel paints over it and it reads
        as something underneath a surface, never as something coming through
        one. But putting the whole void in front would have it hiding content
        for five seconds at a time, which was the reason it went behind in the
        first place.

        So the void is split across both depths, and each half does the job it
        is suited to:

        - **Interior, behind the UI** (the layer above) — the darkness you see
          through the opening. It can never cover a control or a word.
        - **Edge and fractures, in front of the UI** (here) — the torn lip of
          the surface, the wall of its own thickness inside that lip, the cracks
          running out, the flaps of page levered up, and the pale linework.
          These are what a tear actually shows you, and having them cut across a
          panel is precisely the depth cue that was missing.

        Both halves are driven by the *same generated keyframes* — the piece's
        own `animName` and `morphNames`, not copies — so they cannot drift out
        of register with each other however the timeline is retuned.
      */}
      <div
        aria-hidden="true"
        data-sv-tear=""
        className="pointer-events-none absolute inset-x-0 top-0 z-30 overflow-hidden"
        style={{ height: documentHeight }}
      >
        {spots.map((spot) => (
          <div
            key={spot.id}
            className="absolute"
            style={{ left: `${spot.x}%`, top: spot.docY }}
          >
            {spot.pieces.map((piece, pieceIndex) => (
              <div
                key={piece.key}
                className="absolute"
                style={{
                  left: -piece.box / 2 + piece.dx,
                  top: -piece.box / 2 + piece.dy,
                  width: piece.box,
                  height: piece.box,
                  animation: `${piece.animName} ${Math.round(spot.lifeMs)}ms linear both`,
                }}
              >
                {/*
                  What is in front of the opening, gone.

                  Without this the rim is an outline drawn on a panel rather
                  than a hole in one — you would see the interface carrying on
                  inside the tear.

                  **Its clip is animated, and it has to be.** It used to be
                  pinned to cel 0, which worked only because every cel was the
                  same size. Cel 0 is now a sealed hairline, so a static clip
                  would erase nothing at all for the whole life. The clip
                  therefore steps through the same progression the silhouette
                  does — see `clipTrack` — which is also what makes the hole
                  *widen* rather than the black *scale*: the region of interface
                  being removed grows with the drawing, in the same shape, at
                  the same moment.

                  It inherits the piece's opacity, which is `presence(t)`, so a
                  fresh crack barely dims what it covers and only a gaping tear
                  punches through. That ramp is free — it is the same animation
                  the body is already running.

                  **Only the anchor piece erases.** Measured with one per piece,
                  a four-piece void put four live `backdrop-filter`s on screen
                  at once and pinned the page to 30fps where the same page
                  without voids reached 60. It is also the wrong reading: the
                  later pieces of a cascade are the same failure continuing
                  along one line, and they are read as belonging to the opening
                  that is already through the surface.
                */}
                {pieceIndex === 0 && (
                  <div
                    className="absolute inset-0"
                    style={{
                      clipPath: `path('${piece.clipStart}')`,
                      backdropFilter: "brightness(0.06) saturate(0)",
                      WebkitBackdropFilter: "brightness(0.06) saturate(0)",
                      animation: piece.clipName
                        ? `${piece.clipName} ${Math.round(spot.lifeMs)}ms steps(1, end) both`
                        : undefined,
                    }}
                  />
                )}

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
                      {/*
                          The thickness of the punctured surface: the crescent
                          between the torn edge and the inner edge, filled
                          `evenodd`, lit down one side.

                          Small, and it is the difference between a hole and a
                          silhouette. A flat black shape has no inside; a wall
                          visible inside the near lip says there is a depth
                          behind the page and this is how far down it starts.
                          Drawn here rather than on the layer behind, because
                          the blackout above takes the composited backdrop to 6%
                          and anything painted underneath it would go with it.
                      */}
                      {cel.wall && (
                        <path d={cel.wall} fillRule="evenodd" fill="var(--sv-purple)" opacity={0.45} />
                      )}
                      {/* The torn lip of the surface. A stroke rather than a
                          fill, so it is a band along the edge and the interior
                          stays the business of the layer behind. Mitred, not
                          rounded: a rounded join files every cusp off the edge,
                          and the cusps are what make it torn. */}
                      <path
                        d={cel.outline}
                        fill="none"
                        stroke="#000"
                        strokeWidth={piece.crackWidth * 0.85}
                        strokeLinejoin="miter"
                        strokeMiterlimit={8}
                      />
                      {/* Fractures running out across the interface rather than
                          under it — the tear spreading into its surroundings,
                          which is what connects the two. They lengthen and
                          multiply with the opening, so the page gets visibly
                          worse as the hole gets wider. */}
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
                      {/*
                          Pieces of the surface, levered up out of the tear.

                          Filled in the panel colour and outlined in ink: a
                          fragment of the *page* standing proud of the hole it
                          came out of, not another piece of darkness. This is
                          the pass that says the interface was ripped rather
                          than that something was drawn on top of it, and it is
                          why the satellite blobs the rupture used to throw
                          could go.
                      */}
                      {cel.flaps.map((flap, f) => (
                        <g key={`f${f}`}>
                          <path
                            d={flap.d}
                            fill="var(--elevated)"
                            stroke="#000"
                            strokeWidth={piece.crackWidth * 0.4}
                            strokeLinejoin="miter"
                          />
                          {/* Outlined all the way round, faintly, and brightly
                              along the outer edge. Filled alone it disappears
                              against the black it is standing in front of —
                              `--elevated` on a hole is one panel colour on
                              another — and a piece of the page nobody can see
                              is not a piece of the page. */}
                          <path
                            d={flap.d}
                            fill="none"
                            stroke="var(--fg)"
                            strokeWidth={piece.penWidth * 0.8}
                            strokeOpacity={0.22}
                            strokeLinejoin="miter"
                          />
                          <path
                            d={flap.lit}
                            fill="none"
                            stroke="var(--fg)"
                            strokeWidth={piece.penWidth * 1.2}
                            strokeOpacity={0.55}
                            strokeLinecap="round"
                          />
                        </g>
                      ))}
                      <path
                        d={cel.outline}
                        fill="none"
                        stroke="var(--fg)"
                        strokeWidth={piece.penWidth}
                        strokeOpacity={0.5}
                        strokeDasharray={cel.dash}
                        strokeDashoffset={cel.dashOffset}
                        strokeLinecap="round"
                      />
                      <path
                        d={cel.outline}
                        fill="none"
                        stroke="var(--fg)"
                        strokeWidth={piece.penWidth * 0.7}
                        strokeOpacity={0.2}
                        strokeDasharray={cel.dash}
                        strokeDashoffset={cel.dashOffset * 1.7}
                        strokeLinecap="round"
                        transform="translate(1.6 -1.2)"
                      />
                      {cel.crackHighlights.map((hi, h) => (
                        <path
                          key={`h${h}`}
                          d={hi.d}
                          fill="none"
                          stroke="var(--fg)"
                          strokeWidth={hi.w}
                          strokeOpacity={0.42}
                          strokeLinecap="round"
                        />
                      ))}
                      {cel.marks.map((mark, m) => (
                        <path
                          key={`m${m}`}
                          d={mark.d}
                          fill="none"
                          stroke="var(--fg)"
                          strokeWidth={mark.w}
                          strokeOpacity={0.45}
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
          className="pointer-events-none absolute inset-x-0 top-0 z-30 overflow-hidden"
          style={{ height: documentHeight }}
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
                    clipPath: slice.clip,
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
                {burst.sketch.map((arc, k) => (
                  <path
                    key={`w${k}`}
                    d={arc.d}
                    fill="none"
                    stroke="var(--fg)"
                    strokeWidth={arc.w}
                    strokeOpacity={0.5}
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
