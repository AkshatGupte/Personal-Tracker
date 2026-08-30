"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

const BUILT = [
  { label: "Home", href: "/" },
  { label: "Progress", href: "/progress" },
];

// Shown as planned, never as a working link. See the scope rule in CLAUDE.md.
const PLANNED = [{ label: "Insights", when: "Phase 3" }];

/**
 * The masthead: a wordmark, a rule, and the sections. No pill, no panel.
 *
 * The bearing mark is the one piece of the page that takes its colour from the
 * atmosphere layer rather than from a semantic token — it is a mark, not data.
 */
export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex items-center justify-between gap-4 border-b border-border pb-3.5">
      <Link href="/" className="flex min-w-0 items-center gap-2.5 text-fg">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-[color:var(--m-mark,var(--muted))]"
        >
          <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M12 3.5 L12 20.5 M3.5 12 L20.5 12" stroke="currentColor" strokeWidth="1" opacity=".45" />
          <path d="M12 6.5 L14.6 12 L12 17.5 L9.4 12 Z" fill="currentColor" />
        </svg>
        <span className="font-display text-xl leading-none tracking-tight">Rendred</span>
        <span className="sr-only">home</span>
      </Link>

      {/*
        Navigation sits one step above section labels in the ladder, so it is
        set slightly larger than the 0.6rem gutter labels rather than matching
        them. Planned sections keep an explicit "soon", per the scope rule in
        CLAUDE.md: an unbuilt section is never presented as a working link.
      */}
      <ul className="flex min-w-0 items-center gap-4 overflow-x-auto font-mono text-[0.65rem] uppercase tracking-[0.15em]">
        {BUILT.map((section) => {
          const active = pathname === section.href;
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "whitespace-nowrap border-b border-fg pb-0.5 text-fg"
                    : "whitespace-nowrap text-muted transition-colors hover:text-fg"
                }
              >
                {section.label}
              </Link>
            </li>
          );
        })}
        {PLANNED.map((section) => (
          <li key={section.label} className="hidden sm:block">
            <span
              aria-disabled="true"
              title={`Planned for ${section.when}`}
              className="flex items-baseline gap-1.5 whitespace-nowrap text-muted"
            >
              {section.label}
              {/* Size separates it, not opacity: dimming would push this
                  below the contrast floor the rest of the page holds. */}
              <span className="text-[0.55rem] tracking-[0.1em] text-muted">soon</span>
            </span>
          </li>
        ))}
        <li className="flex items-center">
          <ThemeToggle />
        </li>
      </ul>
    </nav>
  );
}
