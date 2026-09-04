/**
 * Deterministic randomness for generated geometry.
 *
 * mulberry32. The same seed draws the same shape every time, which is what lets
 * generated SVG render inside server components: a `Math.random` path would
 * differ between the server's markup and the client's first render and React
 * would report a hydration mismatch.
 *
 * Client-only effects that generate a fresh shape *after* mount — a lightning
 * strike, a shatter — are free to seed from `Math.random()`, because nothing
 * was server-rendered to disagree with.
 */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One decimal place. Keeps generated path data short and diffable. */
export const r1 = (n: number) => Math.round(n * 10) / 10;
