"use client";

import { Neon, ThreadStructure, r1, type Pt } from "./Threads";
import { rng } from "./rng";
import { useDocumentBands } from "./useDocumentBands";

/**
 * The multiverse Rendred sits inside. Mounted once in the root layout.
 *
 * ## It is the document deep, not the viewport deep
 *
 * This used to be `fixed inset-0`: five structures, pinned to the screen, with
 * the page sliding across them. Scroll to the bottom of a long track and the
 * same dominant solid was still at the same 8%/44% it started at — so however
 * good the composition was, what it described was a printed backdrop one screen
 * deep rather than a place the interface is inside.
 *
 * The layer now spans the whole document and scrolls with it, and the
 * composition is drawn once per screenful. **Bands are generated, not tiled.**
 * Band 0 is the hand-set composition below, untouched. Every band above it
 * mirrors it on parity, jitters each structure's position, scale and opacity
 * from that band's own seed, and — the part that actually matters —
 * re-seeds each polyhedron, so no two bands contain the same solids. A tiled
 * strip announces its period the moment two copies are on screen together.
 *
 * **Threads cross the band boundaries**, which is what stops a boundary from
 * existing at all. The runs that used to leave the frame vertically now find
 * the nearest structure in the neighbouring band and terminate there, so a
 * thread genuinely runs from a solid on one screen to a solid on the next. Only
 * at the very top and the very bottom of the document — where there is no
 * neighbour — do they carry on out of frame as before. The runs that leave
 * *sideways* still do, at every band: crossing the edge is the only thing in the
 * drawing that says the structure continues past it.
 *
 * Each band's threads are their own `<svg>` with `overflow: visible` rather than
 * one document-tall drawing. The bloom is a `blur()` on a `<g>`, so its filter
 * region is the bounding box of the paths inside it — one drawing would make
 * that region the whole document and ask the compositor for a texture the height
 * of the page. Per band, it stays about two screens at worst, which is what the
 * cross-band runs need and no more.
 *
 * **On a phone the two smallest drop out and the rest shrink.** The content
 * column is the full width there, so what remains is deliberately sparse — three
 * structures at the edges and the threads between them. That is a per-structure
 * responsive class and it applies to every band, so the density per screenful is
 * the same at the bottom of the document as at the top.
 *
 * Pure decoration — `aria-hidden`, `pointer-events-none`, no animation, so
 * there is nothing for reduced motion to freeze.
 */

interface Node {
  id: string;
  /** Percent of viewport width. */
  x: number;
  /** Percent of one band, measured from that band's top. */
  y: number;
  size: number;
  seed: number;
  opacity: number;
  cls: string;
  /** Applied as a transform, so the responsive width classes still govern. */
  scale: number;
}

/*
  The composition, in viewport percentages.

  Placed by hand rather than generated. That is the whole correction this pass
  makes: a seeded scatter produces an even field however carefully it is tuned,
  and "a few dominant structures with smaller ones around them" is a
  composition, which is a decision and not a distribution.

  Everything sits outside roughly 22-78% horizontally, which is where a centred
  max-w-5xl column lives on a wide screen. The threads cross that band; the
  solids do not.
*/
const NODES: Node[] = [
  // The dominant one. Everything else is read in relation to it.
  { id: "a", x: 8, y: 44, size: 460, seed: 0x14b7e2, opacity: 0.9, scale: 1, cls: "w-[150px] sm:w-[300px] lg:w-[460px]" },
  { id: "b", x: 91, y: 19, size: 300, seed: 0x8f3d55, opacity: 0.8, scale: 1, cls: "w-[110px] sm:w-[210px] lg:w-[300px]" },
  { id: "c", x: 88, y: 80, size: 380, seed: 0xd6714a, opacity: 0.84, scale: 1, cls: "w-[130px] sm:w-[250px] lg:w-[380px]" },
  { id: "d", x: 24, y: 7, size: 170, seed: 0x2ea9c1, opacity: 0.7, scale: 1, cls: "hidden sm:block sm:w-[120px] lg:w-[170px]" },
  { id: "e", x: 15, y: 90, size: 200, seed: 0x3b90f7, opacity: 0.74, scale: 1, cls: "hidden sm:block sm:w-[140px] lg:w-[200px]" },
];

/** Threads between structures. Ids rather than coordinates, so one topology
 *  serves every band. */
const LINKS: Array<[string, string]> = [
  ["a", "d"],
  ["a", "e"],
  ["a", "c"],
  ["d", "b"],
  ["b", "c"],
  ["e", "c"],
];

/*
  Branches off a structure, carrying on past it.

  Written as a *displacement* from the source rather than as a fixed endpoint,
  which is the one change that lets them generalise: band 0's numbers are
  reproduced exactly (a is at 8,44, so -20,-38 is the original -12,6), and the
  same run off a structure the next band has moved still leaves in the same
  direction by the same amount.

  **A mirrored band mirrors these too.** Reflecting a composition has to reflect
  its directions, not only its positions — and getting that wrong is visible
  rather than subtle. `a` mirrors from x=8 to x=92, so a branch that still ran
  dx=-20 left the *right-hand* structure pointing back into the middle of the
  page and stopped at x=72, which is inside the frame: a thread ending in mid
  air. `extend` below is the belt to this braces, for the cases jitter and the
  keep-out clamp can still produce.
*/
const OUTRUNS: Array<{ from: string; dx: number; dy: number }> = [
  { from: "a", dx: -20, dy: -38 },
  { from: "a", dx: -18, dy: 44 },
  { from: "b", dx: 21, dy: -27 },
  { from: "c", dx: 20, dy: 32 },
  { from: "e", dx: -11, dy: 24 },
  { from: "d", dx: 12, dy: -21 },
];

/**
 * The centre column, kept clear of solids.
 *
 * The hand-set composition holds to it by eye; a jittered one needs it stated,
 * or a structure eventually lands behind the text it was placed to avoid.
 */
const KEEP_OUT: [number, number] = [28, 72];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Outside the band's frame, with the same 5% margin the sideways test uses. */
const outside = ([x, y]: Pt) => x <= -5 || x >= 105 || y <= 0 || y >= 100;

/**
 * Push a branch along its own direction until it leaves the frame.
 *
 * **A branch may never stop inside the frame.** The whole point of these runs is
 * that they carry on past their structure and out of the composition — a segment
 * that ends at an arbitrary interior point is not that, it is a thread snapped
 * off, and it reads as a structure that failed to connect to anything.
 *
 * Band 0's six endpoints were all hand-placed outside the frame, so this is an
 * identity there and the original composition is untouched. It earns its keep on
 * the generated bands, where a mirrored origin, ±5 of jitter or the keep-out
 * clamp can leave a displacement pointing somewhere it no longer reaches.
 *
 * Solved rather than stepped: `t` is the first boundary the ray crosses, so the
 * direction is preserved exactly and only the length changes.
 */
function extend(origin: Pt, dx: number, dy: number): Pt {
  const end: Pt = [origin[0] + dx, origin[1] + dy];
  if (outside(end)) return end;

  const crossings: number[] = [];
  if (dx > 0) crossings.push((105 - origin[0]) / dx);
  if (dx < 0) crossings.push((-5 - origin[0]) / dx);
  if (dy > 0) crossings.push((100 - origin[1]) / dy);
  if (dy < 0) crossings.push((0 - origin[1]) / dy);
  if (crossings.length === 0) return end; // a zero displacement; not one of ours

  // The nearest boundary, plus a margin so the endpoint is clearly past it.
  const t = Math.min(...crossings.filter((n) => n > 0)) * 1.08;
  return [r1(origin[0] + dx * t), r1(origin[1] + dy * t)];
}

/**
 * One screenful of structures.
 *
 * Band 0 is returned verbatim. Above it: mirrored on parity so the dominant
 * solid does not run down one edge of the whole document, jittered within
 * bounds, and re-seeded — `seed` is what picks the polygon, so changing it is
 * what makes band 3 contain different *shapes* rather than the same five moved
 * about.
 */
function bandNodes(index: number): Node[] {
  if (index === 0) return NODES;

  const next = rng(0x7c9e51 ^ Math.imul(index, 0x9e3779b1));
  const flip = index % 2 === 1;

  return NODES.map((node) => {
    let x = (flip ? 100 - node.x : node.x) + (next() - 0.5) * 10;
    if (x > KEEP_OUT[0] && x < KEEP_OUT[1]) x = x < 50 ? KEEP_OUT[0] : KEEP_OUT[1];
    return {
      ...node,
      x: r1(x),
      y: r1(clamp(node.y + (next() - 0.5) * 14, 4, 96)),
      opacity: r1(clamp(node.opacity + (next() - 0.5) * 0.16, 0.55, 0.95)),
      scale: r1(0.82 + next() * 0.32),
      seed: (node.seed ^ Math.imul(index, 0x45d9f3b)) >>> 0,
    };
  });
}

/**
 * Every thread in the document, bucketed by the band that draws it.
 *
 * Coordinates are band-local: a run leaving band `k` downward is expressed with
 * a `y` past 100, and the SVG for that band draws it with `overflow: visible`.
 * That keeps each drawing's blur region local while letting the line itself
 * cross the boundary.
 *
 * Cross-band runs are deduplicated. Band `k`'s downward branch retargets to the
 * nearest solid in band `k+1`, and band `k+1`'s upward branch retargets to the
 * nearest solid in band `k` — frequently the same pair, and drawing it from both
 * ends would lay two neon strokes on one thread and light it at twice the
 * intensity of every other.
 */
function buildBands(bands: number) {
  const nodesByBand = Array.from({ length: bands }, (_, k) => bandNodes(k));
  const runsByBand: Array<Array<{ from: Pt; to: Pt }>> = Array.from({ length: bands }, () => []);
  const drawn = new Set<string>();

  const at = (k: number, id: string): Pt => {
    const node = nodesByBand[k].find((n) => n.id === id)!;
    return [node.x, node.y];
  };

  for (let k = 0; k < bands; k++) {
    for (const [from, to] of LINKS) {
      runsByBand[k].push({ from: at(k, from), to: at(k, to) });
    }

    for (const { from, dx, dy } of OUTRUNS) {
      const origin = at(k, from);
      // The band's structures are mirrored on parity, so its branches are too —
      // otherwise they point back into the page instead of off its near edge.
      const end = extend(origin, k % 2 === 1 ? -dx : dx, dy);

      // Leaves sideways. There is nothing out there to connect to, and crossing
      // the edge is the point.
      const sideways = end[0] < -5 || end[0] > 105;
      const neighbour = end[1] < 0 ? k - 1 : end[1] > 100 ? k + 1 : k;

      if (sideways || neighbour === k || neighbour < 0 || neighbour >= bands) {
        runsByBand[k].push({ from: origin, to: end });
        continue;
      }

      // The neighbouring band's coordinates, expressed in this one's.
      const offset = (neighbour - k) * 100;
      let best = nodesByBand[neighbour][0];
      let bestDistance = Infinity;
      for (const node of nodesByBand[neighbour]) {
        const distance = Math.hypot(node.x - end[0], node.y + offset - end[1]);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = node;
        }
      }

      const [lo, hi] =
        k < neighbour ? [`${k}:${from}`, `${neighbour}:${best.id}`] : [`${neighbour}:${best.id}`, `${k}:${from}`];
      const key = `${lo}|${hi}`;
      if (drawn.has(key)) continue;
      drawn.add(key);

      runsByBand[k].push({ from: origin, to: [best.x, r1(best.y + offset)] });
    }
  }

  return { nodesByBand, runsByBand };
}

/**
 * One band's threads.
 *
 * `preserveAspectRatio="none"` on a 0-100 box, so coordinates are literally
 * percentages of the band. Distortion is irrelevant here and nowhere else: a
 * straight line stays straight under a non-uniform scale, only its angle
 * changes, and a thread has no shape to lose. The structures are separate
 * elements for exactly this reason — a solid *does* have a shape to lose.
 *
 * `overflow: visible` because an SVG root clips to its viewport by default, and
 * the runs that cross into the next band are drawn past the edge of this one on
 * purpose. The layer above clips at the document edges instead.
 */
function ThreadLines({
  runs,
  opacity,
  top,
  height,
}: {
  runs: Array<{ from: Pt; to: Pt }>;
  opacity: number;
  top: string;
  height: string;
}) {
  const paths = runs.map(
    ({ from, to }) => `M ${r1(from[0])} ${r1(from[1])} L ${r1(to[0])} ${r1(to[1])}`,
  );
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      /*
        `w-full` is load-bearing and is not the same as `inset-x-0` here.

        An `<svg>` with a viewBox is a *replaced* element with an intrinsic
        aspect ratio, and for an absolutely positioned replaced element a `width`
        of `auto` resolves from that ratio and the resolved height — it does not
        stretch to a `left: 0; right: 0` pair the way a normal block does. With
        the height set to one band and the ratio 1:1, this box came out square:
        720px wide on a 1280px page, so every thread was squeezed into the left
        56% of the frame while the structures stayed at their true percentages
        and nothing joined up.
      */
      className="pointer-events-none absolute inset-x-0 w-full"
      style={{ opacity, top, height, overflow: "visible" }}
      fill="none"
    >
      {/*
        Stroke widths here are screen pixels, not viewBox units, because
        `non-scaling-stroke` is set — a 0.16 written for a 0-100 box renders as
        a sixth of a pixel and disappears, which is exactly what happened on the
        first pass and left the structures unconnected.
      */}
      <Neon paths={paths} width={1.6} bloom={0.68} core={1} />
    </svg>
  );
}

export function DimensionalThreads() {
  const { height, band, bands, measured } = useDocumentBands();
  const { nodesByBand, runsByBand } = buildBands(bands);

  /*
    Band units resolve to px once the document is measured, and to `vh` before
    it. That matters for one render: the server has no viewport, so it emits the
    same single-band composition in the same `vh` the Tailwind classes used, and
    the markup React hydrates against is unchanged.
  */
  const unit = (n: number) => (measured ? `${(n * band).toFixed(1)}px` : `${(n * 100).toFixed(1)}vh`);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden text-sv-cyan"
      style={{ height: measured ? `${height}px` : "100vh" }}
    >
      {/* Threads first, so every structure paints over the threads arriving at
          it and each one reads as passing behind the solid. */}
      {runsByBand.map((runs, index) => (
        <ThreadLines
          key={`runs-${index}`}
          runs={runs}
          opacity={0.78}
          top={unit(index)}
          height={unit(1)}
        />
      ))}

      {nodesByBand.flatMap((nodes, index) =>
        nodes.map((node) => (
          <ThreadStructure
            key={`${index}-${node.id}`}
            seed={node.seed}
            size={node.size}
            opacity={node.opacity}
            className={`${node.cls} h-auto`}
            style={{
              left: `${node.x}%`,
              top: unit(index + node.y / 100),
              transform:
                node.scale === 1
                  ? "translate(-50%, -50%)"
                  : `translate(-50%, -50%) scale(${node.scale})`,
            }}
          />
        )),
      )}
    </div>
  );
}
