import type { ReactNode } from "react";
import { WebFrame } from "@/components/spiderverse/SpiderWeb";
import { GlitchText } from "@/components/spiderverse/GlitchText";

/**
 * A section of the sheet, in two registers.
 *
 * The comic register is a three-plate misregistration rather than a border and
 * a drop shadow: cyan holds the plate, magenta echoes it 3px down-right, and a
 * faint yellow pass sits 2px the other way — see `.sv-panel` in globals.css,
 * which also carries the slow coloured glow that keeps a panel from reading as
 * pasted onto the ground. The offset is fixed and identical on every panel; it
 * is a press error, and a moving or per-panel-random one reads as a bug.
 *
 * **band** (default) is the original: a mono label in the gutter, content in
 * the main column, separation from rules and space. It stays the workhorse,
 * because a page where every section is a bordered comic panel has no
 * hierarchy left to spend — it just looks busy.
 *
 * **comic** is the loud one: a 2px ink border, a solid caption box across the
 * top, a hard registration plate offset behind it, and halftone over the
 * surface. It is reserved for the level that should dominate a screen — Tracks
 * on the home page, the Track header on a track page — and used sparingly on
 * purpose. Topic and Task surfaces stay in `band`.
 *
 * The registration plate is a real sibling rather than a box-shadow. Panels can
 * carry `wobble`, and a clip-path clips the element's own shadow away with it.
 * It also cannot be a child: the panel paints its own background, so a
 * negative-z child would render behind that background and never be seen.
 */
type Accent = "magenta" | "cyan" | "yellow";

const BORDER: Record<Accent, string> = {
  magenta: "var(--sv-magenta)",
  cyan: "var(--sv-cyan)",
  yellow: "var(--sv-yellow)",
};

export default function Panel({
  label,
  sublabel,
  action,
  children,
  variant = "band",
  accent = "magenta",
  wobble = false,
  className = "",
}: {
  /** Mono gutter label, e.g. "Topics". */
  label?: string;
  /** Small second line under the label, e.g. a count. */
  sublabel?: string;
  action?: ReactNode;
  children: ReactNode;
  variant?: "band" | "comic";
  accent?: Accent;
  wobble?: boolean;
  className?: string;
}) {
  if (variant === "comic") {
    const surface = (
      <div className={`sv-panel relative h-full ${wobble ? "sv-wobble" : ""}`}>
        {(label || action) && (
          <div
            className="sv-panel-header relative flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 py-1.5 sm:px-4"
            style={{ background: BORDER[accent], color: "var(--sv-ink)" }}
          >
            <h2 className="font-label text-[0.6rem] uppercase leading-relaxed tracking-[0.17em]">
              {label && <GlitchText text={label} intensity="subtle" trigger="auto" blend="normal" baseColor="var(--sv-ink)" />}
              {sublabel && (
                <span className="ml-2 tracking-[0.1em] opacity-80">{sublabel}</span>
              )}
            </h2>
            {action}
          </div>
        )}

        <div className="relative min-w-0 p-3 sm:p-4">
          {/* One web per corner and nothing in between — see WebFrame.
              Hung off the *content* box rather than the panel box: an absolutely
              positioned child resolves `inset-0` against the padding box, so
              this already spans this element edge to edge, padding included.
              That box starts just under the caption bar and ends at the panel's
              inner edge, which is what puts the top pair below the bar instead
              of half-buried under it — with no header height hardcoded here to
              drift out of sync. */}
          <WebFrame className="inset-0 text-sv-cyan" />
          <div className="relative">{children}</div>
        </div>
      </div>
    );

    return <div className={`relative my-4 ${className}`}>{surface}</div>;
  }

  return (
    <section
      className={`grid grid-cols-1 gap-x-6 gap-y-3 py-5 lg:grid-cols-[7rem_minmax(0,1fr)] ${className}`}
    >
      {(label || action) && (
        <div className="flex items-baseline justify-between gap-3 lg:flex-col lg:items-start lg:justify-start lg:gap-1.5 lg:pt-0.5">
          {label && (
            <h2 className="font-label text-[0.6rem] uppercase leading-relaxed tracking-[0.17em] text-sv-cyan">
              <GlitchText text={label} intensity="subtle" trigger="auto" baseColor="var(--sv-cyan)" />
              {sublabel && (
                <span className="mt-0.5 block text-[0.58rem] tracking-[0.1em] text-muted">
                  {sublabel}
                </span>
              )}
            </h2>
          )}
          {action}
        </div>
      )}
      <div className="min-w-0">{children}</div>
    </section>
  );
}
