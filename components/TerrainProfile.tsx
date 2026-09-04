import { describeTerrain, ridgePath, type Terrain } from "@/lib/terrain";

const W = 720;
const H = 200;
const STRATA = 7;

/**
 * The elevation profile: cumulative completed tasks over the last 12 weeks.
 *
 * Height is work done. The horizontal strata sit at fixed elevations, so where
 * the climb is steep the ridge crosses several of them within a short span and
 * they visibly bunch. Pace comes out of the geometry rather than a separate
 * invented metric.
 *
 * With no completions this renders a flat baseline and says so. It never draws
 * a curve that did not happen.
 *
 * The atmosphere behind the page never reaches in here: ridge, strata, fill and
 * milestones are drawn in `accent` and `streak` always, because they
 * are data. Only the sky behind them changes with the day.
 */
export default function TerrainProfile({
  id,
  terrain,
  scope,
  height = "h-44",
  compact = false,
  quiet = false,
}: {
  /**
   * Unique per instance. The gradient and clip path are referenced by id, so
   * two profiles on one page would otherwise share the first one's geometry.
   */
  id: string;
  terrain: Terrain;
  /** Names what the profile covers, used in the text alternative. */
  scope: string;
  height?: string;
  /** Row-sized: drops strata and the caption, keeps ridge and milestones. */
  compact?: boolean;
  /**
   * Suppresses the empty-state sentence, for placements where the surrounding
   * layout already states it. The dashed baseline still says "no ground yet"
   * on its own; repeating the words beside the number that means the same
   * thing reads as stray text rather than as an annotation.
   */
  quiet?: boolean;
}) {
  const ridge = ridgePath(terrain.points, W, H);
  const area = `${ridge} L ${W} ${H} L 0 ${H} Z`;
  const summit = terrain.points[terrain.points.length - 1];
  const summitY = H - (summit?.y ?? 0) * H;
  const fillId = `terrain-fill-${id}`;
  const clipId = `terrain-clip-${id}`;

  return (
    <figure className="m-0 flex h-full flex-col">
      <div className={`relative w-full flex-1 ${height}`}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          role="img"
          aria-label={describeTerrain(terrain, scope)}
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
            </linearGradient>
            <clipPath id={clipId}>
              <path d={area} />
            </clipPath>
          </defs>

          {/* Baseline: always drawn, so empty terrain still reads as ground. */}
          <line
            x1="0"
            y1={H - 0.5}
            x2={W}
            y2={H - 0.5}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray={terrain.hasData ? undefined : "4 6"}
            vectorEffect="non-scaling-stroke"
          />

          {terrain.hasData && (
            <>
              <path
                d={area}
                fill={`url(#${fillId})`}
                style={{ animation: "terrain-fill 900ms ease-out both" }}
              />

              {/* Strata, clipped to the landform so they read as rock layers. */}
              <g clipPath={`url(#${clipId})`} style={{ display: compact ? "none" : undefined }}>
                {Array.from({ length: STRATA }, (_, i) => {
                  const y = H - ((i + 1) / (STRATA + 1)) * H;
                  return (
                    <line
                      key={i}
                      x1="0"
                      y1={y}
                      x2={W}
                      y2={y}
                      stroke="var(--terrain-line)"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </g>

              {/* Milestones sit where they were actually crossed. */}
              {terrain.reached.map((milestone) => (
                <g key={milestone.value}>
                  {/*
                    The contour runs the full width so the value set in the
                    margin and the point it was crossed read as one elevation.
                    In a row-sized profile there is no margin to label, so the
                    line is dropped and only the crossing point is marked.
                  */}
                  {!compact && (
                  <line
                    x1="0"
                    y1={H - milestone.y * H}
                    x2={W}
                    y2={H - milestone.y * H}
                    stroke="var(--streak)"
                    strokeWidth="1"
                    strokeDasharray="3 4"
                    strokeOpacity="0.75"
                    vectorEffect="non-scaling-stroke"
                  />
                  )}
                  <circle
                    cx={milestone.x * W}
                    cy={H - milestone.y * H}
                    r="3.5"
                    fill="var(--streak)"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ))}

              <path
                d={ridge}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pathLength={1}
                style={{
                  strokeDasharray: 1,
                  strokeDashoffset: 1,
                  animation: "ridge-draw 1.2s cubic-bezier(0.22, 1, 0.36, 1) both",
                }}
              />

              {/* Today. */}
              <circle
                cx={W - 5}
                cy={summitY}
                r="4"
                fill="var(--accent)"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        {!compact &&
          terrain.reached.map((milestone) => (
            <span
              key={milestone.value}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 -translate-y-1/2 font-label text-[0.6rem] uppercase tracking-[0.14em] tabular-nums text-streak"
              style={{ top: `${(1 - milestone.y) * 100}%` }}
            >
              {milestone.value}
            </span>
          ))}

        {!terrain.hasData && !quiet && (
          <p
            className={
              compact
                ? "sv-status absolute inset-0 flex items-center justify-center font-label text-[0.55rem] uppercase text-muted"
                : "sv-status absolute inset-0 flex items-center justify-center px-4 text-center font-label text-[0.65rem] uppercase text-muted"
            }
          >
            {compact ? "No elevation yet" : "No elevation yet \u00b7 completed tasks raise the ground"}
          </p>
        )}
      </div>

      {!compact && terrain.hasData && (
        <div
          aria-hidden="true"
          className="mt-1.5 flex justify-between pr-4 font-label text-[0.6rem] uppercase tracking-[0.12em] text-muted sm:pr-6"
        >
          <span>12 weeks</span>
          {terrain.next && <span className="tabular-nums">next {terrain.next}</span>}
        </div>
      )}

      {/*
        Milestones as marginalia: each reached value is set at the elevation it
        was actually crossed, so the number and the place agree. Still plain
        text, so nothing here requires reading the drawing or hovering it.
      */}
      {!compact && terrain.reached.length > 0 && (
        <figcaption className="sr-only">
          {terrain.reached.map((m) => `${m.value} tasks reached.`).join(" ")}
          {terrain.next ? ` Next milestone at ${terrain.next}.` : ""}
        </figcaption>
      )}
    </figure>
  );
}
