/**
 * Geometry for the `lattice` atmosphere: a fractured hexagonal wireframe.
 *
 * The earlier version drew an organic spider web. This one is angular and
 * faceted — a lattice of hex cells, broken into fragments, with a few larger
 * cells nested like apertures. It reads as structure under tension rather than
 * as an insect's web, which keeps it abstract while still being unmistakably
 * of a piece with the rest of the motif.
 *
 * Pure and deterministic — a fixed seed, no Math.random — so the markup is
 * identical on every render and can be generated on the server.
 */

export type WebThread = { d: string; weight: number };
export type WebNode = { x: number; y: number; r: number };
export type Web = { width: number; height: number; threads: WebThread[]; nodes: WebNode[] };

/** Small deterministic PRNG (mulberry32). Same seed, same lattice, always. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The six corners of a pointy-top hexagon. */
function hexPoints(cx: number, cy: number, r: number, wobble: number, next: () => number) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const rr = r * (1 + (next() - 0.5) * wobble);
    pts.push([cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr]);
  }
  return pts;
}

/**
 * One hex cell, drawn edge by edge so individual edges can be dropped. A
 * complete honeycomb reads as a pattern swatch; a broken one reads as a
 * structure that has been through something.
 */
function addHex(
  cx: number,
  cy: number,
  r: number,
  next: () => number,
  threads: WebThread[],
  nodes: WebNode[],
  { drop = 0.3, weight = 1, wobble = 0.1 } = {},
) {
  const pts = hexPoints(cx, cy, r, wobble, next);
  for (let i = 0; i < 6; i++) {
    if (next() < drop) continue;
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % 6];
    threads.push({
      d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      weight,
    });
    if (next() < 0.08) nodes.push({ x: x2, y: y2, r: 0.9 + next() * 1.2 });
  }
}

/**
 * Builds the lattice across the whole frame: a broken honeycomb, a handful of
 * larger nested apertures, and long struts that cut across the grid.
 */
export function buildWeb(width = 1440, height = 900, seed = 0x5eed): Web {
  const next = rng(seed);
  const threads: WebThread[] = [];
  const nodes: WebNode[] = [];

  // The honeycomb. Cells thin out toward the middle, where the text sits.
  const r = 74;
  const stepX = r * Math.sqrt(3);
  const stepY = r * 1.5;
  for (let row = -1; row * stepY < height + r; row++) {
    for (let col = -1; col * stepX < width + r; col++) {
      const cx = col * stepX + (row % 2 ? stepX / 2 : 0);
      const cy = row * stepY;
      // Distance from the horizontal centre, 0 at the middle, 1 at the edges.
      const edgeness = Math.abs(cx / width - 0.5) * 2;
      if (next() > 0.25 + edgeness * 0.7) continue;
      addHex(cx, cy, r, next, threads, nodes, {
        drop: 0.42 - edgeness * 0.2,
        weight: 0.55 + next() * 0.5,
        wobble: 0.09,
      });
    }
  }

  // Apertures: a few larger cells with a second ring inside, like a lens.
  const apertures: [number, number, number][] = [
    [width * 0.06, height * 0.16, 190],
    [width * 0.95, height * 0.3, 230],
    [width * 0.88, height * 0.86, 170],
    [width * 0.12, height * 0.92, 150],
    [width * 0.5, height * -0.08, 200],
  ];
  for (const [cx, cy, big] of apertures) {
    addHex(cx, cy, big, next, threads, nodes, { drop: 0.18, weight: 1.3, wobble: 0.05 });
    addHex(cx, cy, big * 0.62, next, threads, nodes, { drop: 0.3, weight: 0.8, wobble: 0.07 });
    // Spokes tying the inner ring to the outer one.
    const outer = hexPoints(cx, cy, big, 0, next);
    const inner = hexPoints(cx, cy, big * 0.62, 0, next);
    for (let i = 0; i < 6; i++) {
      if (next() < 0.4) continue;
      threads.push({
        d: `M ${inner[i][0].toFixed(1)} ${inner[i][1].toFixed(1)} L ${outer[i][0].toFixed(1)} ${outer[i][1].toFixed(1)}`,
        weight: 0.7,
      });
    }
  }

  // Struts: long straight runs cutting across the grid at shallow angles.
  for (let i = 0; i < 7; i++) {
    const y0 = height * (-0.1 + next() * 1.2);
    const y1 = y0 + (next() - 0.5) * height * 0.7;
    threads.push({
      d: `M -60 ${y0.toFixed(1)} L ${(width + 60).toFixed(1)} ${y1.toFixed(1)}`,
      weight: 0.5,
    });
  }

  return { width, height, threads, nodes };
}
