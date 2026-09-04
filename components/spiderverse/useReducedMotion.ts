"use client";

import { useEffect, useState } from "react";

/**
 * Tracks `prefers-reduced-motion`, live.
 *
 * Starts `false` and corrects after mount rather than reading the media query
 * during render: the server has no `window`, and guessing `true` would flash
 * the reduced variant to everyone on first paint.
 *
 * Lives here rather than inside one component because three effects now need
 * it, and the global CSS rule that flattens animation durations is not enough
 * on its own — an effect that *schedules* work in JavaScript has to stop
 * scheduling it, not merely run it faster.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return reduced;
}
