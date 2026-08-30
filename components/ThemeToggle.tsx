"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * Switches between the light and dark token sets and remembers the choice.
 * Until the user picks, the system preference wins — so the initial state is
 * read back from the document rather than assumed.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const explicit = document.documentElement.getAttribute("data-theme");
    if (explicit === "dark" || explicit === "light") {
      setTheme(explicit);
      return;
    }
    setTheme(
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    );
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private browsing or blocked storage — the toggle still works for
      // this page view, it just will not be remembered.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      // Rendered before the theme is known, so the label stays generic until
      // it resolves — avoids announcing the wrong state to screen readers.
      aria-label={theme ? `Switch to ${theme === "dark" ? "light" : "dark"} theme` : "Switch theme"}
      className="inline-flex h-7 w-7 items-center justify-center rounded-[3px] border border-border text-muted transition-colors hover:border-fg hover:text-fg"
    >
      <span aria-hidden="true" className="text-xs leading-none">
        {theme === "dark" ? "☀" : "☾"}
      </span>
    </button>
  );
}
