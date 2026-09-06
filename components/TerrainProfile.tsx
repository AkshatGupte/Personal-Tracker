import { describeDay, describeTerrain, ridgePath, type Terrain } from "@/lib/terrain";
import { parseDayKey } from "@/lib/day";
import TerrainHover from "./TerrainHover";
import { TERRAIN_SPAN } from "@/lib/windows";

const W = 720;
const H = 200;
const STRATA = 7;

/**
 * Right gutter, in viewBox units, between the newest data point and the edge.
 *
 * The profile bleeds to the right edge of the window on the home page, and the
 * newest point is *today* — so with the plot running the full width, today's
 * marker sat five units from the frame, which is about seven real pixels from
 * the edge of the screen. The steepest, most recent and most meaningful part of
 * the curve was the part squeezed against the border, and it read as a graph
 * running off the page rather than as one that ends.
 *
 * The gutter insets the **data** only. The baseline and the strata still run
 * the full width, so the ground carries on past today — which is the honest
 * reading of a time axis that ends at now, and keeps the bleed doing the job it
 * was added for.
 *
 * 48 of 720 is 6.7%: about 65px of clearance on a wide monitor and 25px at
 * 390px wide, at both of which the summit marker and its glow sit clear.
 */
const RIGHT_GUTTER = 48;
const PLOT_W = W - RIGHT_GUTTER;

/**
 * The elevation profile: cumulative activity over the terrain window.
 *
 * The span is `TERRAIN_SPAN` and the caption below the drawing is written from
 * it, so the words and the plotted range cannot disagree. It was twelve weeks
 * of hardcoded caption against a twelve-week constant somewhere else.
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
  const ridge = ridgePath(terrain.points, PLOT_W, H);
  const area = `${ridge} L ${PLOT_W} ${H} L 0 ${H} Z`;
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
                    The contour is clipped to the landform, like the strata,
                    and stops at the point it was crossed.

                    It used to run the full width, unclipped, in hard yellow —
                    two bright rules straight across an almost empty chart, out
                    past the reading column and off the side of a bleeding
                    profile. That read as page chrome rather than as terrain,
                    and it broke the one rule the rest of this drawing keeps:
                    **every horizontal line in here lives inside the ground.**
                    The strata are clipped for exactly that reason; a gridline
                    floating in empty sky is the only thing that was not.

                    Clipping fixes it at the root rather than by dimming. The
                    contour now appears only where the ground has actually
                    reached that level, which is also the only place it says
                    anything — elevation rises monotonically, so past the
                    crossing the ground is above it and to the left it had not
                    got there yet. It can therefore stay legible at 0.55 instead
                    of being faded into apology.

                    The value stays in the margin as an axis label, and the dot
                    marks the crossing. In a row-sized profile there is no margin
                    to label, so the line is dropped and only the dot is drawn.
                  */}
                  {!compact && (
                  <line
                    clipPath={`url(#${clipId})`}
                    x1="0"
                    y1={H - milestone.y * H}
                    x2={milestone.x * PLOT_W}
                    y2={H - milestone.y * H}
                    stroke="var(--streak)"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                    strokeOpacity="0.55"
                    vectorEffect="non-scaling-stroke"
                  />
                  )}
                  <circle
                    cx={milestone.x * PLOT_W}
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

              {/* Today — the end of the data, not the end of the frame. */}
              <circle
                cx={PLOT_W}
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
              className="pointer-events-none absolute left-0 -translate-y-1/2 font-label text-[0.75rem] uppercase tracking-[0.14em] tabular-nums text-streak"
              style={{ top: `${(1 - milestone.y) * 100}%` }}
              title={`${milestone.value} activities recorded`}
            >
              {/* The bare number floated with nothing to say what it counted,
                  against gridlines that are nearly invisible by design. */}
              {milestone.value} <span className="lowercase tracking-normal">done</span>
            </span>
          ))}

        {!terrain.hasData && !quiet && (
          <p
            className={
              compact
                ? "sv-status absolute inset-0 flex items-center justify-center font-label text-[0.75rem] uppercase text-muted"
                : "sv-status absolute inset-0 flex items-center justify-center px-4 text-center font-label text-[0.75rem] uppercase text-muted"
            }
          >
            {/*
              Names the window, because this label belongs to the *drawing* and
              the drawing is two weeks.

              It read "No elevation yet", which was unambiguous only while the
              headline numeral was the same windowed total. Elevation is all-time
              now, so a track with a real total and a quiet fortnight would have
              put "Elevation 50" directly above "No elevation yet". This is the
              wording `describeTerrain` already uses for the same state, so the
              drawing and its text alternative now say the same thing.
            */}
            {compact
              ? `Nothing in ${TERRAIN_SPAN}`
              : `Nothing in ${TERRAIN_SPAN} \u00b7 working a topic raises the ground`}
          </p>
        )}

        {/*
          Read-off. Only where there is something to read: on an empty window
          every column would report "0 activities" fourteen times, which is
          noise wearing the costume of data.
        */}
        {terrain.hasData && (
          <TerrainHover
            points={terrain.points}
            domainMax={terrain.domainMax}
            rightGutter={(RIGHT_GUTTER / W) * 100}
            focusable={!compact}
            compact={compact}
          />
        )}
      </div>

      {!compact && terrain.hasData && (
        <div
          aria-hidden="true"
          /* Right padding matches RIGHT_GUTTER as a share of the width, so
             "next N" sits under the end of the curve rather than out in the
             bleed past it. */
          className="mt-1.5 flex justify-between font-label text-[0.75rem] uppercase tracking-[0.12em] text-muted"
          style={{ paddingRight: `${(RIGHT_GUTTER / W) * 100}%` }}
        >
          {/*
            Both axes named, and the y axis now names its *scale* as well as its
            unit. "height = activities" said what was measured and not what
            against — which was the whole complaint, because the height was
            measured against the series' own total and therefore always full.
            "0 - N elevation" says the domain out loud, and N is the milestone
            the top of the frame sits on.
          */}
          <span>{TERRAIN_SPAN} · one point per day</span>
          <span className="tabular-nums">0–{terrain.domainMax} elevation</span>
        </div>
      )}

      {/*
        Milestones as marginalia: each reached value is set at the elevation it
        was actually crossed, so the number and the place agree. Still plain
        text, so nothing here requires reading the drawing or hovering it.
      */}
      {!compact && terrain.reached.length > 0 && (
        <figcaption className="sr-only">
          {terrain.reached.map((m) => `${m.value} activities reached.`).join(" ")}
          {` Next milestone at ${terrain.domainMax}.`}
        </figcaption>
      )}

      {/*
        The series as text, the same way the heatmap carries its own.

        A hover is for a pointer and a chart is for eyes; this is the version
        that survives having neither. It is a disclosure rather than a permanent
        table because fourteen lines under every track row would bury the rows —
        and it lists only the days that actually happened, since "0 activities"
        repeated eleven times is not a reading of anything.
      */}
      {!compact && terrain.hasData && (
        <details className="mt-2">
          <summary className="cursor-pointer font-label text-[0.75rem] uppercase tracking-[0.12em] text-muted">
            Day by day
          </summary>
          <ul className="mt-2 space-y-1 font-label text-[0.75rem] uppercase tracking-[0.1em] text-muted">
            {terrain.points
              .filter((point) => point.count > 0)
              .map((point) => (
                <li key={point.dayKey} className="tabular-nums">
                  {parseDayKey(point.dayKey).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                  })}
                  {" \u2014 "}
                  {describeDay(point)}
                </li>
              ))}
          </ul>
        </details>
      )}
    </figure>
  );
}
