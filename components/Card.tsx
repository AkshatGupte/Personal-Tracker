import type { ReactNode } from "react";

/**
 * The standard panel: rounded, hairline border, lit top edge and soft shadow.
 * The letter-spaced label header is the reference's signature detail.
 */
export default function Card({
  title,
  action,
  children,
  className = "",
  delay = 0,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Stagger index, so a row of cards rises in one after another. */
  delay?: number;
}) {
  return (
    <section
      className={`card-lit rounded-2xl border border-border bg-surface transition-transform duration-200 hover:-translate-y-0.5 ${className}`}
      style={{ animation: "rise-in 0.5s ease-out both", animationDelay: `${delay * 90}ms` }}
    >
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted">
            {title}
          </h2>
          {action}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
