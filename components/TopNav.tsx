"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

// Home is the only built section. The rest are shown as planned, not as links.
// See the scope rule in CLAUDE.md: never present unbuilt sections as working.
const PLANNED = [
  { label: "Progress", when: "Phase 2" },
  { label: "Insights", when: "Phase 3" },
];

export default function TopNav() {
  const pathname = usePathname();
  const onHome = pathname === "/";

  return (
    <nav className="card-lit mb-6 flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2.5 sm:gap-3 sm:px-4">
      <Link
        href="/"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-base font-extrabold text-accent-contrast"
      >
        <span aria-hidden="true">R</span>
        <span className="sr-only">Rendred home</span>
      </Link>

      <ul className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        <li>
          <Link
            href="/"
            aria-current={onHome ? "page" : undefined}
            className={`inline-block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              onHome ? "bg-elevated text-fg" : "text-muted hover:text-fg"
            }`}
          >
            Home
          </Link>
        </li>
        {PLANNED.map((section) => (
          <li key={section.label}>
            <span
              title={`Planned for ${section.when}`}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-muted/70"
            >
              {section.label}
              <span className="rounded-lg bg-elevated px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider">
                soon
              </span>
            </span>
          </li>
        ))}
      </ul>

      <ThemeToggle />
    </nav>
  );
}
