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

/**
 * One corner web, built with its hub *at* the corner.
 *
 * **This is the shape everyone pictures when they hear "web in a corner":** an
 * apex tucked into the angle, straight radials running out from it, and a stack
 * of concentric threads sagging between neighbouring radials. It replaced a
 * version that put the hub some way *inside* the box and fanned the spokes back
 * toward the corner — that one drew a narrow wedge with two or three faint
 * chords across it, which does not read as a web at all. The user's word for
 * it was "a triangle", and that was fair.
 *
 * Two things had to change together. The hub moved to the corner, so the web
 * opens outward across the full quarter-turn instead of closing to a point. And
 * the rings went from two-to-four faint chords to five evenly stepped threads
 * at full weight: the concentric rings *are* the web. Spokes alone are a fan.
 *
 * `jitter` is what separates the two uses. At zero the angles are evenly spaced
 * and every radial is the same length — a true symmetrical web, which is what
 * the Tracks panel wants. Above zero the seed pushes the angles around and
 * varies each radial's length, so every instance is its own shape — which is
 * what the page corners want.
 *
 * **Three rules keep an irregular web a web rather than a fan of lines.**
 *
 * 1. *The hub stays at the exact corner, always.* It used to drift inward by up
 *    to `box * jitter * 0.5` while the radials still reached `box`, which put
 *    the rim out past `1.3 * box` — outside a viewBox that is only `box` square.
 *    The square clipped it, and what it clipped was the outer rings: the
 *    surviving drawing was long straight radials running off the edge with a
 *    couple of threads near the hub. Pinned at the corner, a radius of `box`
 *    always fits, touching (box, 0) and (0, box) and bulging to 0.71 in the
 *    diagonal.
 * 2. *Angle jitter scales with the gap between radials, not with the whole
 *    quarter-turn.* A flat ±18 degrees against a 12-degree spacing clustered
 *    three radials together and left a bare wedge beside them, which reads as a
 *    handful of lines however many rings cross it.
 * 3. *Radial lengths vary gently.* Large variation makes the outer rings zig-zag
 *    so hard they stop reading as rings.
 */
type CornerWebSpec = {
  /** Radials, counted inclusive of the two that lie along the edges. */
  spokes: number;
  /** Concentric threads between hub and rim. */
  rings: number;
  /** 0 = perfectly regular. Higher varies the angles and radial lengths. */
  jitter: number;
  seed: number;
};

function buildCornerWeb(box: number, spec: CornerWebSpec, map: (p: Pt) => Pt) {
  const { spokes, rings, jitter, seed } = spec;
  const next = rng(seed);

  // Rule 1: the hub is the corner. Anything else puts the rim outside the
  // viewBox and the square clips the outer rings away.
  const hub: Pt = [0, 0];

  /*
    Angles run the quarter turn from the +x edge to the +y edge. The first and
    last are pinned to exactly 0 and PI/2 whatever the jitter, so both radials
    lie along a real frame edge and the web is visibly attached to the border at
    both ends rather than floating near it.

    Rule 2: jitter is measured in fractions of the gap between neighbouring
    radials, so it can never open a bare wedge or stack three radials together.
  */
  const gap = Math.PI / 2 / (spokes - 1);
  const angles = Array.from({ length: spokes }, (_, i) => {
    const base = i * gap;
    if (i === 0 || i === spokes - 1) return base;
    return base + (next() - 0.5) * jitter * gap * 0.9;
  }).sort((a, b) => a - b);

  // Rule 3: gentle length variation. Enough that the rim is not a clean
  // quarter-circle, not so much that the outer rings stop reading as rings.
  const radii = angles.map((_, i) =>
    i === 0 || i === spokes - 1 ? box : box * (1 - next() * jitter * 0.22),
  );

  const at = (i: number, f: number): Pt => [
    hub[0] + Math.cos(angles[i]) * radii[i] * f,
    hub[1] + Math.sin(angles[i]) * radii[i] * f,
  ];

  const line = (a: Pt, b: Pt) => {
    const [x1, y1] = map(a);
    const [x2, y2] = map(b);
    return `M ${r1(x1)} ${r1(y1)} L ${r1(x2)} ${r1(y2)}`;
  };
  const spokePaths = angles.map((_, i) => line(hub, at(i, 1)));

  /*
    Rings step evenly out from the hub. Even spacing is right here even for the
    irregular webs: it is the ring *stack* that says "web", and unevenly spaced
    rings just read as noise crossing a fan.
  */
  const ringPaths: string[] = [];
  for (let ring = 1; ring <= rings; ring++) {
    const f = ring / rings;
    const d: string[] = [];
    for (let i = 0; i < angles.length - 1; i++) {
      const a = at(i, f);
      const b = at(i + 1, f);
      // Control point pulled back toward the hub. This sag is the whole
      // difference between a spider web and a wheel.
      const slack = 0.86 - next() * jitter * 0.1;
      const c: Pt = [
        hub[0] + ((a[0] + b[0]) / 2 - hub[0]) * slack,
        hub[1] + ((a[1] + b[1]) / 2 - hub[1]) * slack,
      ];
      const [ax, ay] = map(a);
      const [bx, by] = map(b);
      const [cx, cy] = map(c);
      d.push(`${i === 0 ? `M ${r1(ax)} ${r1(ay)}` : ""} Q ${r1(cx)} ${r1(cy)} ${r1(bx)} ${r1(by)}`);
    }
    ringPaths.push(d.join(" "));
  }

  return { spokePaths, ringPaths };
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
  jitter = 0.5,
  className = "",
}: {
  corner?: Corner;
  size?: number;
  seed?: number;
  opacity?: number;
  offset?: { x?: number; y?: number };
  /** 0 draws a perfectly regular web. Higher makes it its own shape. */
  jitter?: number;
  className?: string;
}) {
  const pick = rng(seed ^ 0x9e37);
  const { spokePaths, ringPaths } = buildCornerWeb(
    size,
    {
      // A regular web is drawn to a fixed recipe; an irregular one takes its
      // counts from the seed as well as its angles, so two of them cannot come
      // out as the same web at different scales.
      spokes: jitter === 0 ? 7 : 7 + Math.floor(pick() * 4),
      rings: jitter === 0 ? 5 : 5 + Math.floor(pick() * 3),
      jitter,
      seed,
    },
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
      {/* Rings at near-full weight too. They were the faint part before, and a
          web whose rings you cannot see is a fan. */}
      {ringPaths.map((d, i) => (
        <path
          key={`r${i}`}
          d={d}
          stroke="currentColor"
          strokeWidth="0.9"
          strokeOpacity={0.92 - i * 0.04}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

/**
 * Webs in the corners of a frame, and only in the corners.
 *
 * **Four, one per corner, drawn to the same regular recipe.** `jitter={0}` means
 * evenly spaced radials of equal length and evenly stepped rings, and the four
 * are exact mirrors of each other. This is the one place in the app where
 * symmetry is wanted — a frame motif is what it is meant to be. Everywhere else
 * (the dividers, the page corners) each web is its own shape.
 *
 * **The size is small and fixed on purpose, and it is pinned by arithmetic.**
 * With the hub in the corner the web is a quarter-disc of radius `size`, so the
 * top and bottom pairs meet as soon as `2 * size` passes the content height.
 * A panel holding a single track is about 164px of content, which puts the hard
 * ceiling at 82 and 74 comfortably under it — at 84 the left and right pairs
 * met and webbed the full height of both edges. Larger webs, and extra ones
 * offset along an edge, were both tried too and both ran strands straight
 * through the middle of the content; a corner decoration that crosses the
 * middle of the box has stopped being one.
 *
 * So legibility here comes from the geometry, not from more pixels: a hub in
 * the corner, seven radials and five rings read as a web at 74px, where the old
 * inward-facing fan with two chords did not read as one at 250px.
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
        <WebCorner key={corner} corner={corner} size={74} seed={0x5eed21} opacity={0.42} jitter={0} />
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
  radius = 78,
}: {
  className?: string;
  seed?: number;
  /** How far the web hangs below the rule. */
  radius?: number;
}) {
  const place = rng(seed);
  /*
    Where along the rule the web hangs. Off-centre, and different per seed, so
    the two dividers on a page are not a matched pair.

    Kept out of the left third on purpose. The web hangs past the bottom of this
    element into whatever follows, and on the home page what follows starts with
    a text column on the left — a seed that placed the web at 20% would drop
    cyan strands straight through the heading. The right two-thirds of a rule is
    reliably open space.
  */
  const at = 34 + place() * 44;

  const W = radius * 2 + 4;
  const H = radius + 6;
  const { spokePaths, ringPaths } = buildHangingWeb(seed, radius, [W / 2, 1]);

  /*
    **The web hangs out of the element rather than being boxed by it.** Reserving
    the web's full drop made each divider 88px of vertical layout — two of them
    on the home page, which is most of the reason the page read as loose. Silk
    hanging into the space below is what it should look like anyway; the rule is
    the section break, and the web is decoration that should not push the page
    apart. Reserve a little over half the drop so the thin lower tip is the only
    part that overlaps, and keep the rest as overflow.
  */
  const reserve = Math.round(radius * 0.5) + 10;

  return (
    <div aria-hidden="true" className={`relative w-full ${className}`} style={{ height: reserve }}>
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
 * to share a page, not as one motif repeated. The `jitter` is what does it: the
 * seed sets each web's radial count, ring count, angles, radial lengths and hub
 * offset, so no two are the same shape at different scales. They also run much fainter: they
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
  const webs: Array<{ corner: Corner; size: number; seed: number; opacity: number; jitter: number; size2: string }> = [
    { corner: "tl", size: 268, seed: 0x14b7e2, opacity: 0.3, jitter: 0.7, size2: "h-[116px] w-[116px] sm:h-[268px] sm:w-[268px]" },
    { corner: "tr", size: 322, seed: 0x8f3d55, opacity: 0.27, jitter: 1, size2: "h-[140px] w-[140px] sm:h-[322px] sm:w-[322px]" },
    { corner: "bl", size: 300, seed: 0x2ea9c1, opacity: 0.27, jitter: 0.55, size2: "h-[130px] w-[130px] sm:h-[300px] sm:w-[300px]" },
    { corner: "br", size: 244, seed: 0xd6714a, opacity: 0.3, jitter: 0.85, size2: "h-[106px] w-[106px] sm:h-[244px] sm:w-[244px]" },
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
          jitter={w.jitter}
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
