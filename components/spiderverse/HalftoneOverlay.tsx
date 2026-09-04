"use client";

import { useId } from "react";

/**
 * Ben-Day dot texture.
 *
 * The piece most "glitch UI" work leaves out, and the reason those clones read
 * as cyberpunk rather than comic. Cheap four-colour printing resolves tone as a
 * grid of dots, and every frame of the film is built on top of that fact — so a
 * flat panel with no dot structure will never look printed no matter how much
 * RGB split is layered over it.
 *
 * Drawn as an SVG pattern rather than a CSS radial-gradient specifically for
 * `patternTransform`: real halftone screens are rotated (commonly 15°/45°) so
 * the separations do not moiré against each other. A CSS gradient tile cannot
 * rotate without rotating the element.
 *
 * Opacity belongs in the 4-8% band. Past that it stops being paper and starts
 * being noise laid over the interface.
 */
interface HalftoneOverlayProps {
  /** Tile size in px. Smaller = finer screen. */
  size?: number;
  /** 0.04-0.08 is texture. Higher is a pattern, and it will fight your text. */
  opacity?: number;
  color?: string;
  /** Screen angle in degrees. */
  angle?: number;
  className?: string;
}

export function HalftoneOverlay({
  size = 4,
  opacity = 0.06,
  color = "var(--fg)",
  angle = 15,
  className = "",
}: HalftoneOverlayProps) {
  // Ids must be unique per instance or a second overlay silently reuses the
  // first one's pattern and any per-instance size/angle is ignored.
  const id = `halftone-${useId().replace(/:/g, "")}`;

  return (
    <svg
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ opacity }}
    >
      <defs>
        <pattern
          id={id}
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
          patternTransform={`rotate(${angle})`}
        >
          <circle cx={size / 2} cy={size / 2} r={size * 0.22} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
