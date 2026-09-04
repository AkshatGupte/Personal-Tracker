import { buildWeb } from "@/lib/web";

// Built once at module load: the geometry is deterministic, so there is no
// reason to recompute it per request.
const WEB = buildWeb();

/** The chromatic split: the same drawing, offset, in two opposed hues. */
const CHANNELS = [
  { key: "c1", dx: -1.6, dy: -0.6, stroke: "var(--m-web-c1)" },
  { key: "c2", dx: 1.6, dy: 0.6, stroke: "var(--m-web-c2)" },
  { key: "true", dx: 0, dy: 0, stroke: "var(--m-web)" },
] as const;

/**
 * The fractured hex lattice behind the `lattice` atmosphere.
 *
 * Covers the whole viewport, anchored past every edge, and masked so it runs
 * lighter across the middle where the text is and heavier at the margins.
 * Drawn as SVG rather than as a repeating gradient because a gradient can only
 * make a field; a lattice needs edges with ends, gaps and broken cells.
 *
 * The drawing is rendered three times at sub-pixel offsets — one hue low, the
 * opposite high, and the true colour on top. That misregistration is the
 * chromatic aberration the reference leans on, and it is static: the offsets
 * never move, so there is nothing for reduced-motion to suppress.
 *
 * The strokes are drawn at full alpha and the whole drawing is faded by CSS
 * instead. That matters: with per-stroke alpha, every crossing composites twice
 * and the joins brighten, which pushed the ground under the text well past the
 * contrast floor. Fading the flattened drawing bounds the result no matter how
 * many edges overlap.
 */
export default function LatticeWeb() {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${WEB.width} ${WEB.height}`}
      preserveAspectRatio="xMidYMid slice"
      className="lattice-web"
      focusable="false"
    >
      {CHANNELS.map((channel) => (
        <g
          key={channel.key}
          transform={`translate(${channel.dx} ${channel.dy})`}
          fill="none"
          stroke={channel.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        >
          {WEB.threads.map((thread, i) => (
            <path key={i} d={thread.d} strokeWidth={thread.weight} />
          ))}
        </g>
      ))}
      <g fill="var(--m-web)">
        {WEB.nodes.map((node, i) => (
          <circle key={i} cx={node.x.toFixed(1)} cy={node.y.toFixed(1)} r={node.r.toFixed(1)} />
        ))}
      </g>
    </svg>
  );
}
