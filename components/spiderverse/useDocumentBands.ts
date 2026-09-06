"use client";

import { useEffect, useState } from "react";

/**
 * How tall the document is, in screenfuls.
 *
 * The atmosphere used to be `fixed inset-0`: one viewport of environment,
 * pinned, with the page sliding over it. That is a wallpaper — scroll far
 * enough and the same five structures are still in the same five places, and
 * the multiverse turns out to be exactly one screen deep.
 *
 * This is what lets it be a place instead. The background layers span the whole
 * document and scroll with it, and each layer draws `bands` screenfuls of
 * composition rather than one. Nothing is tiled: every band past the first is
 * generated from its own seed, so the structures continue rather than repeat.
 *
 * **The measurement is of `body`'s border box, deliberately, and not of
 * `documentElement.scrollHeight`.** The background layers are absolutely
 * positioned, so they contribute to the document's scrollable overflow but not
 * to `body`'s own height — measuring the scroll height would mean measuring the
 * thing we are about to size from that measurement, and a layer that came out a
 * pixel tall than its input would ratchet the document longer on every pass.
 * `body`'s box cannot be pushed around by its own absolutely positioned
 * children, so the loop cannot close.
 *
 * A `ResizeObserver` watches it, which is the whole "extends with the content"
 * requirement: add a track, open a subtree, and the document grows, the
 * observer fires, and a band is added. No scroll handler and nothing per frame
 * — this recomputes when the page's *shape* changes, not when it moves.
 */
export interface DocumentBands {
  /** Document height in px. 0 until measured. */
  height: number;
  /** One screenful in px — the unit the composition is written in. 0 until measured. */
  band: number;
  /** How many screenfuls to draw. 1 until measured, which is the server's view. */
  bands: number;
  /** False on the server and on the first client render, so hydration matches. */
  measured: boolean;
}

/**
 * Small viewport-height changes do not move the band unit.
 *
 * On a phone the URL bar hides as you scroll down and `innerHeight` grows by
 * 60-100px mid-gesture. Taking that literally would re-derive every band
 * boundary while the user is scrolling *through* them, and the whole background
 * would slide against the content. A real orientation change or window resize
 * clears 20% easily; a toolbar does not.
 */
const BAND_TOLERANCE = 0.2;

export function useDocumentBands(): DocumentBands {
  const [metrics, setMetrics] = useState<{ height: number; band: number; width: number } | null>(
    null,
  );

  useEffect(() => {
    const measure = () => {
      const width = window.innerWidth;
      const viewport = Math.max(1, window.innerHeight);
      /*
        Rounded, because a fractional height leaves the layer a subpixel below
        `body` and that subpixel is scrollable overflow — a page with nothing to
        scroll would acquire a scrollbar purely from its own background.
      */
      const height = Math.max(Math.round(document.body.getBoundingClientRect().height), viewport);

      setMetrics((prev) => {
        const keepBand =
          prev !== null &&
          prev.width === width &&
          Math.abs(viewport - prev.band) / prev.band < BAND_TOLERANCE;
        const band = keepBand ? prev.band : viewport;
        if (prev && prev.height === height && prev.band === band && prev.width === width) {
          return prev;
        }
        return { height, band, width };
      });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    // `resize` as well as the observer: the viewport can change without `body`
    // changing at all, and the band unit is derived from the viewport.
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  if (metrics === null) {
    return { height: 0, band: 0, bands: 1, measured: false };
  }

  return {
    height: metrics.height,
    band: metrics.band,
    bands: Math.max(1, Math.ceil(metrics.height / metrics.band)),
    measured: true,
  };
}
