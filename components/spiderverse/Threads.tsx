/**
 * Multiverse structures and the threads between them.
 *
 * **What this draws, and what it deliberately stopped drawing.** The first pass
 * at this was a lattice: a space-filling field of small irregular cells seeded
 * on a jittered grid. It was structurally right — straight edges, no hub, no
 * rings — and still wrong, because a field of many similar cells reads as
 * texture. What the film actually puts on screen is a handful of *large,
 * legible* wireframe polyhedra at very different scales, with long struts
 * running between and past them. Few and defined, not many and even.
 *
 * So the unit here is a **structure**, not a cell:
 *
 * - A front face — an irregular polygon, but a deliberate one: the vertices vary
 *   by ±15% of the radius, enough that it is not a regular hexagon and not so
 *   much that it stops reading as a considered shape.
 * - A back face — the same polygon, scaled down and displaced, which is what
 *   makes it a solid seen in perspective rather than an outline.
 * - Connecting edges between corresponding vertices.
 *
 * That is what gives each one a geometric identity. A random polygon has no
 * front and no back; a prism does, and the eye reads the depth immediately.
 *
 * **Threads connect the structures, and are drawn behind them.** Each thread
 * runs between two structure centres, so it disappears under the solid it
 * arrives at and reads as passing into it — which is what the reference does.
 * Terminating a thread at a vertex instead would need the structure's on-screen
 * geometry at layout time, and would look like a graph edge touching a node.
 *
 * Some threads carry on past their destination to the edge of the frame. That is
 * the only thing in the drawing that can say the structure continues outside the
 * viewport, and without it a bounded composition reads as an object on a page.
 *
 * **The page-wide layer lives in `DimensionalThreads.tsx`, not here.** It spans
 * the whole document and generates a band of composition per screenful, which
 * needs the measured document height and therefore has to be a client
 * component. This file stays a server module so the four in-page pieces below
 * — `ThreadFrame`, `ThreadDivider`, `ThreadVoid` and the shared
 * `ThreadStructure` — keep rendering to HTML on the server rather than shipping
 * their geometry to the browser as JS. `Neon`, `r1` and `Pt` are exported for
 * that layer to build on.
 *
 * **Neon is two strokes in two colours, not a filter.** A wide blurred pass in
 * `--sv-cyan` for the bloom, and a thin pass in pale cyan for the core — which
 * is exactly what `AmbientLightning` already does, down to the same `#8FF3FF`.
 * The colour pair is what makes it read as lit rather than merely drawn: a
 * single-colour outline at any opacity is a line, while a saturated halo around
 * a near-white filament is a tube with light in it.
 *
 * A `<filter>` would be a per-pixel pass over the whole screen for a static
 * drawing, and `CLAUDE.md` warns about filters applied over large subtrees.
 *
 * Deterministic throughout: irregularity comes from a seeded PRNG, never
 * `Math.random`, so the markup is byte-identical on server and client. These
 * render inside server components and a random path would be a hydration
 * mismatch.
 *
 * All of it is `aria-hidden` decoration. `ThreadVoid` is the only one carrying
 * meaning, and its caller keeps the sentence that says what is missing.
 */

/** mulberry32. Same seed, same structure, every render. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const r1 = (n: number) => Math.round(n * 10) / 10;

export type Pt = [number, number];

/**
 * One wireframe polyhedron: front face, back face, and the edges joining them.
 *
 * The back face is scaled *and* displaced rather than only displaced. Displacing
 * alone gives a prism seen straight on, which reads as two stacked outlines;
 * scaling as well makes the far face smaller and the connecting edges converge,
 * which is what the eye reads as perspective.
 */
function buildStructure(seed: number, box: number) {
  const next = rng(seed);
  const c = box / 2;
  const sides = 5 + Math.floor(next() * 3); // 5-7
  const spin = next() * Math.PI * 2;
  // Leaves room for the displaced back face inside the same box.
  const radius = c * 0.62;

  /*
    ±15% on the radius. Enough that this is not a regular polygon, restrained
    enough that it still reads as one deliberate shape — the failure mode being
    corrected here is exactly the blob that heavy jitter produces.
  */
  const front: Pt[] = Array.from({ length: sides }, (_, i) => {
    const a = spin + (Math.PI * 2 * i) / sides;
    const rr = radius * (0.85 + next() * 0.3);
    return [c + Math.cos(a) * rr, c + Math.sin(a) * rr];
  });

  const away = next() * Math.PI * 2;
  const depth = radius * (0.3 + next() * 0.28);
  const shrink = 0.62 + next() * 0.2;
  const bx = c + Math.cos(away) * depth;
  const by = c + Math.sin(away) * depth;
  const back: Pt[] = front.map(([x, y]) => [bx + (x - c) * shrink, by + (y - c) * shrink]);

  const face = (pts: Pt[]) => `M ${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(" L ")} Z`;

  return {
    /** Front face, drawn brightest — it is the near edge of the solid. */
    front: face(front),
    /** Back face, drawn fainter, which is what places it behind. */
    back: face(back),
    edges: front.map(
      ([x, y], i) => `M ${r1(x)} ${r1(y)} L ${r1(back[i][0])} ${r1(back[i][1])}`,
    ),
  };
}

/**
 * The two-pass neon stroke: blurred bloom underneath, crisp core on top.
 *
 * `paint` is repeated rather than the group being reused with a CSS filter,
 * because a blur on a group that also contains the crisp pass would blur that
 * too — the core has to stay outside the blurred subtree to stay crisp.
 */
/** The pale filament at the centre of the glow. Same value AmbientLightning
 *  uses for its discharge core — this is the theme's existing neon, not a new
 *  colour, and it sits inside the cyan plate rather than beside it. */
const CORE = "#8FF3FF";

export function Neon({
  paths,
  width,
  bloom,
  core,
}: {
  paths: string[];
  /** Core stroke width. The bloom is drawn several times wider. */
  width: number;
  /** Bloom opacity. */
  bloom: number;
  /** Core opacity. */
  core: number;
}) {
  return (
    <>
      {/*
        Two bloom passes, not one.

        A single blurred pass can be wide or intense but not both: widen it and
        it goes to mist, tighten it and there is no halo left. Splitting it into
        a far soft glow and a near saturated sheath is what makes a stroke read
        as a lit tube rather than a coloured line — the same three-pass build
        `AmbientLightning` uses, so a thread and a discharge are lit by the same
        rules.

        Both take `currentColor` from the caller, so the cyan token stays the
        single source for the plate.
      */}
      <g style={{ filter: "blur(8px)", opacity: bloom * 0.72 }}>
        {paths.map((d, i) => (
          <path
            key={`w${i}`}
            d={d}
            stroke="currentColor"
            strokeWidth={r1(width * 7)}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      <g style={{ filter: "blur(2.5px)", opacity: bloom }}>
        {paths.map((d, i) => (
          <path
            key={`b${i}`}
            d={d}
            stroke="currentColor"
            strokeWidth={r1(width * 2.9)}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      {/* Crisp near-white filament on top. The two together are the neon; the
          core alone is a hairline and the bloom alone is a smudge. */}
      <g style={{ opacity: core }}>
        {paths.map((d, i) => (
          <path
            key={`c${i}`}
            d={d}
            stroke={CORE}
            strokeWidth={width}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    </>
  );
}

/**
 * One structure, sized and positioned by the caller.
 *
 * Square viewBox and square element, so it scales uniformly with nothing to
 * letterbox and no aspect ratio to distort the solid.
 */
export function ThreadStructure({
  seed,
  size,
  opacity = 0.5,
  className = "",
  style,
}: {
  seed: number;
  size: number;
  opacity?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { front, back, edges } = buildStructure(seed, 100);

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`pointer-events-none absolute ${className}`}
      style={{ opacity, ...style }}
      fill="none"
    >
      {/* Far face and the converging edges sit back; the near face carries the
          weight. Depth is lit as well as drawn. */}
      <Neon paths={[back]} width={1.35} bloom={0.55} core={0.55} />
      <Neon paths={edges} width={1.2} bloom={0.48} core={0.5} />
      <Neon paths={[front]} width={2.1} bloom={0.92} core={1} />
    </svg>
  );
}


/**
 * One small structure in each corner of a frame.
 *
 * Replaces the four matching orb webs the panels used to carry, and the lattice
 * patches that briefly replaced those. A panel corner is *inside* the reading
 * area, so what goes there is one small solid suggesting the structure continues
 * behind the interface — not a field competing with the row beneath it.
 *
 * Sized at 84px. The bound is the same one the webs had: a panel holding a
 * single row is about 164px of content, so anything approaching half that puts
 * the top and bottom corners into each other across the middle.
 *
 * Four seeds, no mirroring, so the four are structurally different rather than
 * one shape rotated — which is what stops a frame motif forming.
 */
export function ThreadFrame({ className = "" }: { className?: string }) {
  const corners: Array<{ seed: number; cls: string }> = [
    { seed: 0x5eed21, cls: "left-0 top-0" },
    { seed: 0x71c4a9, cls: "right-0 top-0" },
    { seed: 0x3b90f7, cls: "left-0 bottom-0" },
    { seed: 0xa42d18, cls: "right-0 bottom-0" },
  ];

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute overflow-hidden ${className}`}>
      {corners.map((corner) => (
        <ThreadStructure
          key={corner.cls}
          seed={corner.seed}
          size={84}
          // The most restrained of the lot, and it has to stay that way: this
          // one is *inside* the reading area, so it takes the neon treatment at
          // a fraction of the page structures' strength.
          opacity={0.3}
          className={corner.cls}
        />
      ))}
    </div>
  );
}

/**
 * A section rule with one small structure hanging off it.
 *
 * The rule is a plain full-width element and the structure is a separate,
 * fixed-size square. They cannot share one stretched viewBox: that squashes the
 * solid flat.
 *
 * **The reserved height is unchanged from the web this ultimately replaced**, so
 * no page has moved by a pixel across either redesign.
 */
export function ThreadDivider({
  className = "",
  seed = 0xb1a5,
  radius = 78,
}: {
  className?: string;
  seed?: number;
  /** How far the structure reaches below the rule. */
  radius?: number;
}) {
  const place = rng(seed);
  /*
    Where along the rule it hangs. Off-centre, and different per seed, so two
    dividers on a page are not a matched pair. Kept out of the left third: it
    hangs into whatever follows, and on the home page that starts with a text
    column on the left.
  */
  const at = 34 + place() * 44;
  const reserve = Math.round(radius * 0.5) + 10;

  return (
    <div aria-hidden="true" className={`relative w-full ${className}`} style={{ height: reserve }}>
      {/* The rule itself: a plain element, so no viewBox can stretch it. */}
      <div className="absolute inset-x-0 top-0 border-t" style={{ borderColor: "var(--border)" }} />
      <ThreadStructure
        seed={seed}
        size={radius + 10}
        opacity={0.6}
        className="top-0 text-sv-cyan"
        style={{ left: `${at}%`, transform: "translateX(-50%)" }}
      />
    </div>
  );
}

/**
 * The empty state: one structure with nothing in it.
 *
 * Not a spinner — nothing is loading and nothing arrives on its own. It holds
 * still apart from one slow breath, and the caller's sentence carries the
 * meaning. Keeps `sv-web-breathe`, the animation this element already had.
 */
export function ThreadVoid({
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
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ThreadStructure
          seed={seed}
          size={size}
          opacity={0.85}
          className="sv-web-breathe inset-0 text-sv-cyan"
        />
      </div>
      {label && <p className="max-w-[34ch] text-sm leading-relaxed text-muted">{label}</p>}
    </div>
  );
}
