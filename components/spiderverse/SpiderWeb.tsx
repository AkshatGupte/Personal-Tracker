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
 * Webs in the corners of a frame, and only in the corners.
 *
 * **Four, one per corner, all from the same seed.** They are exact mirrors of
 * each other, which is deliberate and is the one place in the app where
 * symmetry is allowed — a frame motif is what this is meant to be. Everywhere
 * else (the dividers, the page corners) each web is its own shape.
 *
 * **The size is small and fixed on purpose.** Larger webs, and extra ones offset
 * along an edge, were tried: on a panel holding a single track — barely 190px
 * tall — the corners reached past each other and the strands ran straight
 * through the middle of the content. A corner decoration that crosses the
 * middle of the box has stopped being a corner decoration. 84px stays in the
 * corner whether the panel is short or long, and on the shortest panel the top
 * and bottom pairs still clear each other.
 *
 * Percentage caps are still not the way to hold it there: the viewBox is square,
 * so a non-square cap letterboxes the drawing and shrinks it to a sliver. Size
 * it small and let it be its natural size.
 *
 * The caller positions this. `Panel` hangs it off the *content* box rather than
 * the panel box, so the top pair start below the caption bar instead of being
 * half-buried under it — a web with its hub hidden is the hubless fan this
 * theme keeps having to reject.
 */
export function WebFrame({ className = "" }: { className?: string }) {
  const corners: Corner[] = ["tl", "tr", "bl", "br"];

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute overflow-hidden ${className}`}>
      {corners.map((corner) => (
        <WebCorner key={corner} corner={corner} size={84} seed={0x5eed21} opacity={0.4} />
      ))}
    </div>
  );
}

/**
 * A section rule with one web hung from it.
 *
 * **One web, not a row of curves.** Three attempts came before this and two of
 * them failed the same way: a continuous scalloped line read as an audio
 * waveform, and independent sagging spans read as plain curved arcs. Neither
 * had a hub, a spoke or a ring in it — and an arc is not a web, however it is
 * tapered or broken up. Whatever else changes here, radial structure is the
 * part that cannot be dropped.
 *
 * So this is a real half orb-web growing out of the rule: the hub sits *on* the
 * line, the spokes fan into the half-plane below it, the outermost two run
 * along the line itself so the web is anchored at both ends, and the rings sag
 * back toward the hub between neighbouring spokes.
 *
 * **Nothing about it is even.** The spoke angles are random within the fan
 * rather than spaced, and every spoke gets its own length, so the outer boundary
 * is ragged. An even fan at even radii is a semicircle, and a semicircle drawn
 * under a horizontal line is exactly the arch this is trying not to be.
 *
 * The rule is a plain full-width element and the web is a separate, fixed-size
 * SVG positioned along it. They cannot share one `preserveAspectRatio="none"`
 * viewBox: that stretches the drawing to the container's width, which squashes
 * a web flat into — again — an arch.
 */
function buildHangingWeb(seed: number, radius: number, hub: Pt) {
  const next = rng(seed);

  /*
    The fan runs from 0 to PI, measured with +y pointing down, so the whole web
    hangs below the rule. The extremes are pinned so both ends land on the line
    itself; everything between them is random and then sorted, so the rings
    still connect neighbours.
  */
  const spokes = 7 + Math.floor(next() * 4); // 7-10
  const inner = Array.from({ length: spokes - 2 }, () => 0.12 + next() * (Math.PI - 0.24));
  const angles = [0, ...inner, Math.PI].sort((a, b) => a - b);

  // Every spoke its own length. This is what keeps the outer edge from
  // resolving into a smooth semicircular arc.
  const radii = angles.map(() => radius * (0.66 + next() * 0.34));

  const at = (i: number, f: number): Pt => [
    hub[0] + Math.cos(angles[i]) * radii[i] * f,
    hub[1] + Math.sin(angles[i]) * radii[i] * f,
  ];

  const spokePaths = angles.map(
    (_, i) => `M ${r1(hub[0])} ${r1(hub[1])} L ${r1(at(i, 1)[0])} ${r1(at(i, 1)[1])}`,
  );

  const rings = 3 + Math.floor(next() * 2); // 3-4
  const ringPaths: string[] = [];
  for (let ring = 1; ring <= rings; ring++) {
    const f = Math.pow(ring / rings, 1.15) * (0.82 + next() * 0.16);
    const d: string[] = [];
    for (let i = 0; i < angles.length - 1; i++) {
      const a = at(i, f);
      const b = at(i + 1, f);
      // Control point pulled back toward the hub: the sag that separates a web
      // from a wheel.
      const slack = 0.74 + next() * 0.14;
      const c: Pt = [
        hub[0] + ((a[0] + b[0]) / 2 - hub[0]) * slack,
        hub[1] + ((a[1] + b[1]) / 2 - hub[1]) * slack,
      ];
      d.push(
        `${i === 0 ? `M ${r1(a[0])} ${r1(a[1])}` : ""} Q ${r1(c[0])} ${r1(c[1])} ${r1(b[0])} ${r1(b[1])}`,
      );
    }
    ringPaths.push(d.join(" "));
  }

  return { spokePaths, ringPaths };
}

export function WebDivider({
  className = "",
  seed = 0xb1a5,
  radius = 46,
}: {
  className?: string;
  seed?: number;
  /** How far the web hangs below the rule. */
  radius?: number;
}) {
  const place = rng(seed);
  // Where along the rule the web hangs. Off-centre, and different per seed, so
  // the two dividers on a page are not a matched pair.
  const at = 18 + place() * 60;

  const W = radius * 2 + 4;
  const H = radius + 6;
  const { spokePaths, ringPaths } = buildHangingWeb(seed, radius, [W / 2, 1]);

  return (
    <div aria-hidden="true" className={`relative w-full ${className}`} style={{ height: H + 4 }}>
      {/* The rule itself: a plain element, so no viewBox can stretch it. */}
      <div className="absolute inset-x-0 top-0 border-t" style={{ borderColor: "var(--border)" }} />
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="absolute top-0 text-sv-cyan"
        style={{ left: `${at}%`, transform: "translateX(-50%)", opacity: 0.42 }}
        fill="none"
      >
        {spokePaths.map((d, i) => (
          <path key={`s${i}`} d={d} stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {ringPaths.map((d, i) => (
          <path
            key={`r${i}`}
            d={d}
            stroke="currentColor"
            strokeWidth="0.75"
            strokeOpacity={0.85 - i * 0.1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}

/**
 * Webs in the four corners of the viewport, behind everything.
 *
 * Mounted once in the root layout beside the atmosphere, never per screen. The
 * page content is a centred column, so on a wide monitor there is a lot of bare
 * ground either side of it — this is what frames that.
 *
 * **Four different seeds and four different sizes, and no mirroring.** Unlike
 * the panel corners, these are meant to read as four separate webs that happen
 * to share a page, not as one motif repeated. They also run much fainter: they
 * sit behind real content rather than inside a bordered panel, and a strand at
 * panel weight across the whole viewport competes with the interface.
 *
 * **They shrink on a narrow viewport, and that is the point of them.** On a wide
 * monitor they fill ground the layout never uses. On a phone the content column
 * *is* the full width, so a full-size corner web stops framing anything and
 * starts sitting behind the interface. The CSS size overrides the attribute
 * size; the viewBox is square and so is the element, so it scales uniformly
 * with nothing to letterbox.
 *
 * Pure decoration — `aria-hidden`, `pointer-events-none`, no animation, so
 * there is nothing for reduced motion to freeze.
 */
export function WebPageCorners() {
  const webs: Array<{ corner: Corner; size: number; seed: number; opacity: number; size2: string }> = [
    { corner: "tl", size: 268, seed: 0x14b7e2, opacity: 0.2, size2: "h-[116px] w-[116px] sm:h-[268px] sm:w-[268px]" },
    { corner: "tr", size: 322, seed: 0x8f3d55, opacity: 0.17, size2: "h-[140px] w-[140px] sm:h-[322px] sm:w-[322px]" },
    { corner: "bl", size: 300, seed: 0x2ea9c1, opacity: 0.16, size2: "h-[130px] w-[130px] sm:h-[300px] sm:w-[300px]" },
    { corner: "br", size: 244, seed: 0xd6714a, opacity: 0.19, size2: "h-[106px] w-[106px] sm:h-[244px] sm:w-[244px]" },
  ];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden text-sv-cyan"
    >
      {webs.map((w) => (
        <WebCorner
          key={w.corner}
          corner={w.corner}
          size={w.size}
          seed={w.seed}
          opacity={w.opacity}
          className={w.size2}
        />
      ))}
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
