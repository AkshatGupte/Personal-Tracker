import type { ReactNode } from "react";

/**
 * A section of the sheet.
 *
 * What used to be a rounded, shadowed card is now a labelled band: a hairline
 * rule above it, a mono label in the gutter, and the content in the main
 * column. At narrow widths the gutter collapses and the label sits above its
 * content as a tracked eyebrow.
 *
 * Nothing here is a box. Separation comes from the rule and the space.
 */
export default function Panel({
  label,
  sublabel,
  action,
  children,
  className = "",
}: {
  /** Mono gutter label, e.g. "Topics". */
  label?: string;
  /** Small second line under the label, e.g. a count. */
  sublabel?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`grid grid-cols-1 gap-x-6 gap-y-3 py-6 lg:grid-cols-[7rem_minmax(0,1fr)] ${className}`}>
      {(label || action) && (
        <div className="flex items-baseline justify-between gap-3 lg:flex-col lg:items-start lg:justify-start lg:gap-1.5 lg:pt-0.5">
          {label && (
            <h2 className="motif-mark font-mono text-[0.6rem] uppercase leading-relaxed tracking-[0.17em] text-muted">
              {label}
              {sublabel && (
                <span className="mt-0.5 block text-[0.58rem] tracking-[0.1em] opacity-70">
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
