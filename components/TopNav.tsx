"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlitchText } from "@/components/spiderverse/GlitchText";
import { ThreadDivider } from "@/components/spiderverse/Threads";

const BUILT = [
  { label: "Home", href: "/" },
  { label: "Progress", href: "/progress" },
  { label: "Goals", href: "/goals" },
];

// Shown as planned, never as a working link. See the scope rule in CLAUDE.md.
// "Not built yet" is what a user can act on. The roadmap phase it belongs to
// is an internal scheduling detail and meant nothing on the screen.
const PLANNED = [{ label: "Insights", note: "Not built yet" }];

/**
 * The masthead: a wordmark, a rule, and the sections.
 *
 * The wordmark is the one place in the whole app that gets Bangers and a live
 * RGB split. It qualifies on both counts the theme sets for it: short, and
 * author-written. Nothing a user typed is ever set this way — Track, Topic and
 * Task names stay in Archivo throughout.
 *
 * Intensity is `subtle` on purpose. This sits at the top of every screen, and a
 * masthead that tears itself apart every two seconds is a masthead you stop
 * being able to ignore. It fires roughly every 4.5-9s.
 */
export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav>
      <div className="flex items-center justify-between gap-4 border-b-2 border-sv-magenta pb-2.5">
      <Link href="/" className="flex min-w-0 items-center gap-2.5 text-fg">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-sv-cyan"
        >
          <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M12 3.5 L12 20.5 M3.5 12 L20.5 12" stroke="currentColor" strokeWidth="1" opacity=".45" />
          <path d="M12 6.5 L14.6 12 L12 17.5 L9.4 12 Z" fill="currentColor" />
        </svg>
        <GlitchText
          text="Rendred"
          intensity="subtle"
          trigger="auto"
          className="font-comic text-2xl leading-none"
        />
        <span className="sr-only">home</span>
      </Link>

      {/*
        Navigation sits one step above section labels in the ladder, so it is
        set slightly larger than the 0.6rem gutter labels rather than matching
        them. Planned sections keep an explicit "soon", per the scope rule in
        CLAUDE.md: an unbuilt section is never presented as a working link.
      */}
      <ul className="flex min-w-0 items-center gap-4 overflow-x-auto font-label text-[0.75rem] uppercase tracking-[0.15em]">
        {BUILT.map((section) => {
          const active = pathname === section.href;
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "whitespace-nowrap border-b-2 border-sv-yellow pb-0.5 text-fg"
                    : "whitespace-nowrap text-muted transition-colors hover:text-sv-cyan"
                }
              >
                {section.label}
              </Link>
            </li>
          );
        })}
        {/*
          The planned section announces one thing, not nothing.

          It read as an empty `listitem` in the accessibility tree: a bare
          generic carrying `aria-disabled`, which means nothing without a widget
          role, wrapping two text spans that were never joined into a name. A
          screen reader arriving at the nav list heard an unexplained blank item
          between Home and Progress. One element, one explicit name, and the
          visible treatment is unchanged — still a label plus a "soon" marker,
          still not presented as a working link.
        */}
        {PLANNED.map((section) => (
          <li key={section.label} className="hidden sm:block">
            <span
              role="note"
              aria-label={`${section.label} — ${section.note}`}
              title={section.note}
              className="flex items-baseline gap-1.5 whitespace-nowrap text-muted"
            >
              <span aria-hidden="true">{section.label}</span>
              {/* Size separates it, not opacity: dimming would push this
                  below the contrast floor the rest of the page holds. */}
              <span aria-hidden="true" className="sv-status text-[0.75rem] text-muted">
                soon
              </span>
            </span>
          </li>
        ))}
        </ul>
      </div>
      {/* The masthead rule keeps its magenta weight; the threads hang off it
          rather than replacing it, so the section break still reads when
          skimmed. */}
      <ThreadDivider seed={0x2f71} />
    </nav>
  );
}
