/**
 * Spider web geometry, anchored to the thing it is spun across.
 *
 * Every thread runs between two anchor points, the way a real orb web is built:
 * the hub sits a little *inside* a corner and each spoke runs out to a point
 * that lands exactly on a frame edge. Both ends attached is what makes it read
 * as "a web was spun here" rather than "some lines are here". The chords sag
 * *toward* the hub, which is the one detail separating a web from a wheel.
 *
 * **Nothing here is symmetrical, and that is the point.** Four corners built
 * from one shape — mirrored, rotated, or merely re-seeded — read as a frame
 * motif, which is decoration. A spider does not spin four matching webs. So
 * every placement gets its own reach along each edge, its own hub offset, spoke
 * count, ring count, size and opacity, and the geometry is mapped per corner in
 * plain arithmetic rather than by an SVG mirror transform, so no two are
 * reflections of each other. Two corners carry a second smaller web set off
 * along an edge, so even the *count* per corner varies.
 *
 * Deterministic throughout: irregularity comes from a seeded PRNG, never
 * `Math.random`, so the markup is byte-identical on server and client. These
 * render inside server components and a random path would be a hydration
 * mismatch.
 *
 * All of it is `aria-hidden` decoration. `WebLoader` is the only one carrying
 * meaning, and its caller keeps the sentence that says what is missing.
 */

/** mulberry32. Same seed, same web, every render. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

type Pt = [number, number];

export type Corner = "tl" | "tr" | "bl" | "br";

/**
 * Maps a point from local corner space — corner at the origin, the two edges
 * running along +x and +y — onto the real box.
 *
 * Done in arithmetic rather than with an SVG `scale(-1,1)` because a mirror
 * makes opposite corners handed reflections of one another, which is exactly
 * the symmetry this is trying to avoid.
 */
function mapper(corner: Corner, w: number, h: number) {
  const flipX = corner === "tr" || corner === "br";
  const flipY = corner === "bl" || corner === "br";
  return ([x, y]: Pt): Pt => [flipX ? w - x : x, flipY ? h - y : y];
}

type WebSpec = {
  /** Hub position inside the corner, as a fraction of the box. */
  hubX: number;
  hubY: number;
  /** How far the web is allowed to throw before an edge stops it. */
  reach: number;
  spokes: number;
  rings: number;
  /** Trims the start of the fan's arc, so no two webs begin at the same angle. */
  rotate: number;
  /** Trims the end of it. Independent of `rotate`, so the arc is never centred. */
  trim: number;
  seed: number;
};

/**
 * Casts a ray from the hub and returns where it meets the frame.
 *
 * This is what replaced placing anchors at even fractions along each edge. That
 * older approach made every web the same even sweep at a different scale —
 * which is exactly why four webs with four seeds still read as one shape
 * mirrored. Choosing the *angle* at random and letting the geometry decide
 * which edge it lands on gives genuinely different structures: some spokes hit
 * the top, some the side, and the split is never the same twice.
 *
 * Local space: the corner is the origin, the two frame edges are y=0 and x=0.
 */
function castToEdge(hub: Pt, angle: number, reach: number): Pt {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const ts: number[] = [];
  if (dy < -1e-6) ts.push(-hub[1] / dy); // meets y = 0
  if (dx < -1e-6) ts.push(-hub[0] / dx); // meets x = 0
  const t = Math.min(reach, ...ts.filter((v) => v > 0));
  return [hub[0] + dx * t, hub[1] + dy * t];
}

/** Builds one corner web's paths in local space, then maps them onto the box. */
function buildWeb(spec: WebSpec, box: number, map: (p: Pt) => Pt) {
  const { hubX, hubY, reach, spokes, rings, rotate, trim, seed } = spec;
  const next = rng(seed);
  const hub: Pt = [box * hubX, box * hubY];

  /*
    Angles are drawn at random inside the quadrant that faces the corner, not
    spread evenly across it. Even spacing is a wheel; a real web has spokes that
    crowd in one place and leave a gap in another.

    The span stays *inside* [PI, 1.5PI] — the only arc where a ray from the hub
    can reach both frame edges. `rotate` trims the ends rather than sliding the
    whole fan, which is the bug that made every web hang off a single edge: a
    base of PI + PI/2 put every angle past 1.5PI, so every spoke landed on the
    top and none on the side, and the web stopped hugging its corner.

    The first and last spokes are pinned to the ends of the span so both edges
    always carry an anchor; the rest are random in between and sorted, so the
    chords still connect neighbours.
  */
  const a0 = Math.PI + rotate;
  const a1 = Math.PI + Math.PI / 2 - trim;
  const inner = Array.from({ length: Math.max(0, spokes - 2) }, () => a0 + next() * (a1 - a0));
  const angles = [a0, ...inner, a1].sort((x, y) => x - y);

  // Reach is deliberately past the far edge: an edge must always be what stops
  // a spoke, or the outermost threads end in mid-air and nothing is anchored.
  const anchors = angles.map((a) => castToEdge(hub, a, reach));

  const line = (a: Pt, b: Pt) => {
    const [x1, y1] = map(a);
    const [x2, y2] = map(b);
    return `M ${r1(x1)} ${r1(y1)} L ${r1(x2)} ${r1(y2)}`;
  };
  const spokePaths = anchors.map((a) => line(hub, a));

  const chordPaths: string[] = [];
  for (let ring = 1; ring <= rings; ring++) {
    const f = Math.pow(ring / rings, 1.2 + next() * 0.3) * (0.8 + next() * 0.18);
    const d: string[] = [];
    for (let i = 0; i < anchors.length - 1; i++) {
      const a: Pt = [hub[0] + (anchors[i][0] - hub[0]) * f, hub[1] + (anchors[i][1] - hub[1]) * f];
      const b: Pt = [
        hub[0] + (anchors[i + 1][0] - hub[0]) * f,
        hub[1] + (anchors[i + 1][1] - hub[1]) * f,
      ];
      const slack = 0.72 + next() * 0.14;
      const mid: Pt = [
        hub[0] + ((a[0] + b[0]) / 2 - hub[0]) * slack,
        hub[1] + ((a[1] + b[1]) / 2 - hub[1]) * slack,
      ];
      const [ax, ay] = map(a);
      const [bx, by] = map(b);
      const [cx, cy] = map(mid);
      d.push(`${i === 0 ? `M ${r1(ax)} ${r1(ay)}` : ""} Q ${r1(cx)} ${r1(cy)} ${r1(bx)} ${r1(by)}`);
    }
    chordPaths.push(d.join(" "));
  }

  return { spokePaths, chordPaths };
}

/**
 * Everything about one web, derived from a single seed.
 *
 * Spoke count, ring count, hub position, reach and starting rotation all come
 * out of the seed, so four different seeds cannot coincidentally produce four
 * similar webs the way four hand-tuned configs could.
 */
function specFromSeed(seed: number): WebSpec {
  const next = rng(seed);
  return {
    hubX: 0.3 + next() * 0.26,
    hubY: 0.3 + next() * 0.26,
    // Past the far edge on purpose — see the note in buildWeb.
    reach: 2,
    spokes: 5 + Math.floor(next() * 5), // 5-9
    rings: 2 + Math.floor(next() * 3), // 2-4
    rotate: next() * 0.24, // trims the arc's start
    trim: next() * 0.24, // and its end, independently
    seed,
  };
}

const ORIGIN: Record<Corner, string> = {
  tl: "top-0 left-0",
  tr: "top-0 right-0",
  bl: "bottom-0 left-0",
  br: "bottom-0 right-0",
};

/**
 * One web anchored into a corner, defined entirely by its `seed`.
 *
 * Everything structural — spoke count, spoke angles, ring count, hub, reach,
 * starting rotation — is derived from the seed, so two instances with different
 * seeds are structurally different rather than the same shape rescaled.
 */
export function WebCorner({
  corner = "tr",
  size = 150,
  seed = 0x5eed,
  opacity = 0.34,
  offset,
  className = "",
}: {
  corner?: Corner;
  size?: number;
  seed?: number;
  opacity?: number;
  offset?: { x?: number; y?: number };
  className?: string;
}) {
  const spec = specFromSeed(seed);
  const { spokePaths, chordPaths } = buildWeb(
    { ...spec, reach: size * spec.reach },
    size,
    mapper(corner, size, size),
  );

  /*
    Sized in absolute pixels and nothing else. A percentage `maxWidth`/`maxHeight`
    cap was tried here and it destroyed the webs: the viewBox is square, so a
    non-square cap letterboxes the drawing and shrinks it to a sliver in the
    corner. The web is meant to fill its corner — the frame's `overflow-hidden`
    is what keeps it inside the panel, not a cap on the element.
  */
  const style: React.CSSProperties = { opacity };
  if (offset?.x) style[corner === "tl" || corner === "bl" ? "marginLeft" : "marginRight"] = offset.x;
  if (offset?.y) style[corner === "tl" || corner === "tr" ? "marginTop" : "marginBottom"] = offset.y;

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`pointer-events-none absolute ${ORIGIN[corner]} ${className}`}
      style={style}
      fill="none"
    >
      {/* Spokes at full weight. They are the structure; fading them is what made
          the last pass read as a smudge rather than as silk. */}
      {spokePaths.map((d, i) => (
        <path key={`s${i}`} d={d} stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ))}
      {chordPaths.map((d, i) => (
        <path
          key={`c${i}`}
          d={d}
          stroke="currentColor"
          strokeWidth="0.75"
          strokeOpacity={0.85 - i * 0.1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

/**
 * Webs spun across a frame: one in every corner, plus three extras set along an
 * edge, so no two corners carry the same number of them.
 *
 * Each carries its own seed and nothing else — the differences between them are
 * generated, not hand-tuned, so they cannot drift back into resembling one
 * another.
 *
 * **Sizes are absolute pixels in the 88-250 range and opacities sit between
 * 0.30 and 0.46.** Both numbers are load-bearing and were arrived at by being
 * got wrong: a pass that shrank the webs with percentage caps and dropped them
 * to 0.28 left faint slivers in two corners and nothing anywhere else. A corner
 * web that does not visibly fill its corner is not doing the job.
 */
export function WebFrame({ className = "" }: { className?: string }) {
  const webs: Array<{ key: string; corner: Corner; size: number; seed: number; opacity: number; offset?: { x?: number; y?: number } }> = [
    { key: "tl", corner: "tl", size: 214, seed: 0x5eed21, opacity: 0.42 },
    { key: "tr", corner: "tr", size: 196, seed: 0xa17e93, opacity: 0.46 },
    { key: "tr2", corner: "tr", size: 118, seed: 0x3c0b17, opacity: 0.32, offset: { x: 202 } },
    { key: "bl", corner: "bl", size: 232, seed: 0x7b1d4c, opacity: 0.36 },
    { key: "bl2", corner: "bl", size: 104, seed: 0x91aa35, opacity: 0.3, offset: { y: 196 } },
    { key: "br", corner: "br", size: 250, seed: 0xc4f2a8, opacity: 0.38 },
    { key: "br2", corner: "br", size: 88, seed: 0x2d7f61, opacity: 0.31, offset: { x: 244 } },
  ];

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {webs.map((w) => (
        <WebCorner
          key={w.key}
          corner={w.corner}
          size={w.size}
          seed={w.seed}
          opacity={w.opacity}
          offset={w.offset}
        />
      ))}
    </div>
  );
}

/**
 * A section rule with web strands slung under it.
 *
 * **Independent segments with gaps, not one continuous path.** The previous
 * version chained its curves endpoint to endpoint, which produced a single
 * scalloped line — a waveform, not silk. Real strands break and re-anchor:
 * a few short spans at irregular intervals with open air between them.
 *
 * Each span is drawn as a filled envelope rather than a stroked curve so it can
 * *taper* — thick where it is anchored, thin at the bottom of the sag, the way
 * silk actually hangs. A stroke cannot vary its width along a path, so the
 * outline is built by sampling the curve and offsetting each sample by a width
 * that narrows toward the middle.
 */
function taperedSag(x1: number, x2: number, y: number, sag: number, w0: number, w1: number) {
  const cx = (x1 + x2) / 2;
  const cy = y + sag * 2; // quadratic control: the curve reaches ~sag at its middle
  const at = (t: number): Pt => {
    const u = 1 - t;
    return [u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y + 2 * u * t * cy + t * t * y];
  };
  // Thickest at the anchors, thinnest at the sag. sin gives a smooth waist.
  const width = (t: number) => w0 - (w0 - w1) * Math.sin(Math.PI * t);

  const N = 14;
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const [px, py] = at(t);
    const [nx, ny] = at(Math.min(1, t + 0.02));
    const [bx, by] = at(Math.max(0, t - 0.02));
    // Normal to the local tangent.
    const tx = nx - bx;
    const ty = ny - by;
    const len = Math.hypot(tx, ty) || 1;
    const ox = (-ty / len) * width(t) * 0.5;
    const oy = (tx / len) * width(t) * 0.5;
    top.push(`${r1(px + ox)} ${r1(py + oy)}`);
    bottom.unshift(`${r1(px - ox)} ${r1(py - oy)}`);
  }
  return `M ${top.join(" L ")} L ${bottom.join(" L ")} Z`;
}

export function WebDivider({
  className = "",
  seed = 0xb1a5,
}: {
  className?: string;
  seed?: number;
}) {
  const next = rng(seed);
  const W = 1000;
  const H = 26;

  // Three to five spans, with gaps. Position, length and sag all vary, and a
  // gap is left at each end so the rule is not bracketed symmetrically.
  const count = 3 + Math.floor(next() * 3);
  const spans: Array<{ x1: number; x2: number; sag: number }> = [];
  let cursor = W * (0.03 + next() * 0.08);
  for (let i = 0; i < count; i++) {
    const len = W * (0.09 + next() * 0.13);
    if (cursor + len > W * 0.97) break;
    spans.push({ x1: cursor, x2: cursor + len, sag: 4 + next() * 4 });
    cursor += len + W * (0.05 + next() * 0.12); // the gap
  }

  // A tie dropping from one anchor, on some dividers and not others.
  const tie =
    next() > 0.4 && spans.length
      ? `M ${r1(spans[0].x2)} 2 L ${r1(spans[0].x2 + (next() - 0.5) * 6)} ${r1(8 + next() * 6)}`
      : null;

  return (
    <div aria-hidden="true" className={`relative w-full ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[26px] w-full" fill="none">
        <line x1="0" y1="2" x2={W} y2="2" stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <g fill="var(--sv-cyan)" fillOpacity="0.6">
          {spans.map((sp, i) => (
            <path key={`s${i}`} d={taperedSag(sp.x1, sp.x2, 2, sp.sag, 2.6, 0.45)} />
          ))}
        </g>
        {tie && (
          <path d={tie} stroke="var(--sv-cyan)" strokeOpacity="0.45" strokeWidth="0.75" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
    </div>
  );
}

/**
 * The empty state: a full web with nothing caught in it.
 *
 * Not a spinner — nothing is loading and nothing arrives on its own. It holds
 * still apart from one slow breath, and the caller's sentence carries the
 * meaning. Deliberately off-round: the spoke angles are uneven and the rings
 * are pulled off-centre, so it does not read as a wheel.
 */
export function WebLoader({
  size = 112,
  label,
  seed = 0x77eb,
  className = "",
}: {
  size?: number;
  label?: string;
  seed?: number;
  className?: string;
}) {
  const next = rng(seed);
  const c = size / 2;
  const spokes = 10;
  // Uneven angular spacing, and a hub nudged off centre.
  const angles = Array.from(
    { length: spokes },
    (_, i) => (Math.PI * 2 * i) / spokes + (next() - 0.5) * 0.3,
  );
  const hub: Pt = [c + (next() - 0.5) * size * 0.1, c + (next() - 0.5) * size * 0.1];
  const radius = Array.from({ length: spokes }, () => c * (0.86 + next() * 0.14));

  const spokePaths = angles.map(
    (a, i) =>
      `M ${r1(hub[0])} ${r1(hub[1])} L ${r1(hub[0] + Math.cos(a) * radius[i])} ${r1(hub[1] + Math.sin(a) * radius[i])}`,
  );

  const chordPaths: string[] = [];
  for (let ring = 1; ring <= 4; ring++) {
    const f = Math.pow(ring / 4, 1.25) * (0.9 + next() * 0.08);
    const d: string[] = [];
    for (let i = 0; i < angles.length; i++) {
      const j = (i + 1) % angles.length;
      const p1: Pt = [hub[0] + Math.cos(angles[i]) * radius[i] * f, hub[1] + Math.sin(angles[i]) * radius[i] * f];
      const p2: Pt = [hub[0] + Math.cos(angles[j]) * radius[j] * f, hub[1] + Math.sin(angles[j]) * radius[j] * f];
      const slack = 0.78 + next() * 0.1;
      const cx = hub[0] + ((p1[0] + p2[0]) / 2 - hub[0]) * slack;
      const cy = hub[1] + ((p1[1] + p2[1]) / 2 - hub[1]) * slack;
      d.push(`${i === 0 ? `M ${r1(p1[0])} ${r1(p1[1])}` : ""} Q ${r1(cx)} ${r1(cy)} ${r1(p2[0])} ${r1(p2[1])}`);
    }
    chordPaths.push(d.join(" "));
  }

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="sv-web-breathe shrink-0 text-sv-cyan"
        fill="none"
      >
        {spokePaths.map((d, i) => (
          <path key={`s${i}`} d={d} stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {chordPaths.map((d, i) => (
          <path
            key={`c${i}`}
            d={d}
            stroke="currentColor"
            strokeWidth="0.75"
            strokeOpacity={0.85 - i * 0.12}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {label && <p className="max-w-[34ch] text-sm leading-relaxed text-muted">{label}</p>}
    </div>
  );
}
