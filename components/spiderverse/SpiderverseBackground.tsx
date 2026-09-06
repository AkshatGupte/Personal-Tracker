"use client";

import { HalftoneOverlay } from "./HalftoneOverlay";
import { rng } from "./rng";
import { useDocumentBands } from "./useDocumentBands";

/**
 * The page ground: rift light, paper tooth, speed lines.
 *
 * Mounted once in the root layout and never per screen, so every route inherits
 * the same environment and nothing has to remember to draw it.
 *
 * Three layers, all deliberately weak — the corner glows are the film's
 * dimension-rift lighting, magenta bleeding in from one side and cyan from the
 * other, so the frame is never lit evenly. Everything sits under 8% opacity: a
 * background that competes with a task list is a failed background however good
 * it looks on its own.
 *
 * It also moves. Three glows drift on long, mutually indivisible periods and
 * the speed lines creep along their own axis, so an idle page still reads as a
 * place. All of it is CSS on the compositor — no JS, no state, nothing ticking
 * per frame — and the global prefers-reduced-motion rule freezes every one of
 * them at its neutral pose without removing the layer.
 *
 * ## It spans the document, not the viewport
 *
 * This layer used to be `fixed inset-0`: one viewport of rift light, pinned,
 * with the page sliding across it. Scrolling therefore moved the content and
 * nothing else, and the lighting stayed welded to the screen — which is the
 * reading of a wallpaper rather than of a place the interface is inside.
 *
 * It is now `position: absolute` at the top of the document, sized to the
 * document, and it scrolls with the page. Absolute is what makes that work
 * without touching anything else: an absolutely positioned element with no
 * positioned ancestor resolves against the initial containing block, whose
 * origin is the *document* origin rather than the current scroll position. So
 * `top: 0` means the top of the page and the layer scrolls away normally, and
 * `body` does not have to become `position: relative` — which would silently
 * re-parent every unparented `absolute` in the app.
 *
 * The glow trio is then drawn once per screenful (`bands`), so there is no
 * height at which the light runs out. Band 0 is the hand-set composition
 * unchanged; every band above it is a *seeded variation* of it, not a copy —
 * the magenta and cyan sides alternate, offsets, scales and animation phases
 * are jittered per band. A repeated strip would announce its own period within
 * two screens, which is the failure this exists to avoid.
 *
 * The speed lines and the halftone stay one element each rather than being
 * drawn per band. Both are continuous screens at an angle — 115° hairlines and
 * a 15°-rotated dot grid — and a band boundary is only invisible in them if the
 * band height happens to be a whole number of tile periods, which it never is.
 * One element has no boundary to hide.
 *
 * **The speed lines stay pinned to the viewport, and that is a measured
 * decision rather than an oversight.** Scrolling this layer costs 66.7ms a frame
 * against a 16.7ms vsync floor on the track page (headless, `--disable-gpu`);
 * pinning it puts the whole page back on the floor, and removing every *other*
 * scrolling layer instead changes nothing. The reason is `sv-speedline-pan`,
 * which animates `background-position-x`: that repaints the element's visible
 * area every frame, so as a fixed viewport-sized layer it is one cheap
 * promoted surface and as a document-tall scrolling one it is a full repaint
 * that can never be cached.
 *
 * Nothing is lost by pinning it. Speed lines are a uniform hairline field with
 * no located feature anywhere in them — there is no position in the texture to
 * scroll *to* — and they are a camera device rather than a thing in the world,
 * which is exactly what the rift light and the structures are. It stays inside
 * this container rather than moving to a sibling so its paint order is
 * unchanged: above the glows, below the neon.
 *
 * **Every glow is sized `ellipse closest-side`, and that is load-bearing.** A
 * bare `circle` resolves to `farthest-corner`, so in a box far wider than it is
 * tall the gradient is still part-opaque when it reaches the top and bottom
 * edges — and the box clips it into a hard horizontal line straight across the
 * viewport. On a 1865x885 screen the magenta wash ended in a visible seam at
 * 45vh with flat black under it, and the cyan began at another. `closest-side`
 * ties the fade to the box's own half-width and half-height, so it is always
 * fully transparent before any edge and there is nothing left to clip.
 *
 * This only ever showed on wide, short viewports, which is why it survived
 * review: a full-page screenshot inflates the viewport height, and the bug
 * disappears in exactly the image you would check it with.
 *
 * This replaced the retired five-motif AtmosphereField, now deleted. No
 * renderer is needed:
 * it is flat colour, one gradient stop and a repeating ramp.
 */

/** One rift glow, placed in band units — 1.0 is one screenful. */
interface Glow {
  key: string;
  /** `sv-drift-a` | `sv-drift-b` | `sv-drift-c`. Carries the period and the pose. */
  drift: string;
  background: string;
  /** Distance from the document top, in bands. */
  top: number;
  /** In bands. */
  height: number;
  /** Horizontal placement, as the CSS value for `left` or `right`. */
  left?: string;
  right?: string;
  /** In vw, which is what the hand-set composition was written in. */
  width: number;
  /** Negative seconds, so bands sit at different points of the same cycle. */
  delay: number;
}

const MAGENTA =
  "radial-gradient(ellipse closest-side, color-mix(in srgb, var(--sv-magenta) 30%, transparent) 0%, transparent 100%)";
const CYAN =
  "radial-gradient(ellipse closest-side, color-mix(in srgb, var(--sv-cyan) 26%, transparent) 0%, transparent 100%)";
const PURPLE =
  "radial-gradient(ellipse closest-side, color-mix(in srgb, var(--sv-purple) 32%, transparent) 0%, transparent 100%)";

/*
  Band 0, written out in band units so it is the same code path as every other
  band. These are the original hand-set values converted from the Tailwind
  classes they used to be: `-top-[35vh]` is -0.35 bands, `-bottom-[35vh]` on a
  `h-[120vh]` box inside a one-band box is a top of 1 + 0.35 - 1.2 = 0.15, and
  so on. Nothing here is new; the arithmetic is only moved out of Tailwind so a
  band index can be added to it.
*/
const BAND_ZERO: Array<Omit<Glow, "key" | "top"> & { top: number }> = [
  { drift: "sv-drift-a", background: MAGENTA, top: -0.35, height: 1.2, left: "-25%", width: 85, delay: 0 },
  { drift: "sv-drift-b", background: CYAN, top: 0.15, height: 1.2, right: "-25%", width: 85, delay: 0 },
  { drift: "sv-drift-c", background: PURPLE, top: 0.08, height: 0.8, right: "25%", width: 55, delay: 0 },
];

/** The three drift periods, so a band's phase offset can be drawn from its own. */
const PERIOD: Record<string, number> = {
  "sv-drift-a": 37,
  "sv-drift-b": 43,
  "sv-drift-c": 29,
};

/**
 * The glow trio for one screenful.
 *
 * Band 0 is returned verbatim — the composition below the fold is the one that
 * was tuned, and nothing about extending the background downward is a reason to
 * change it.
 *
 * Above it, each band is the same trio re-placed from its own seed. The sides
 * alternate on band parity rather than randomly: two adjacent bands lit from
 * the same side would merge into one very long wash down one edge, and pure
 * chance produces that run often enough to see it.
 */
function glowsForBand(index: number): Glow[] {
  if (index === 0) {
    return BAND_ZERO.map((glow) => ({ ...glow, key: `0-${glow.drift}` }));
  }

  const next = rng(0x5f1a7c ^ Math.imul(index, 0x9e3779b1));
  const flip = index % 2 === 1;
  const side = (near: boolean, offset: string) =>
    (flip ? !near : near) ? { left: offset } : { right: offset };

  return BAND_ZERO.map((glow, i) => {
    const scale = 0.86 + next() * 0.3;
    const nudge = (next() - 0.5) * 0.3;
    const near = glow.left !== undefined;
    return {
      key: `${index}-${glow.drift}`,
      drift: glow.drift,
      background: glow.background,
      top: index + glow.top + nudge,
      height: glow.height * scale,
      width: glow.width * (0.9 + next() * 0.24),
      ...side(near, i === 2 ? "25%" : "-25%"),
      delay: -next() * PERIOD[glow.drift],
    };
  });
}

export default function SpiderverseBackground() {
  const { height, band, bands, measured } = useDocumentBands();

  /*
    Band units resolve to px once the document has been measured, and to `vh`
    before that. Which matters for exactly one render: the server has no
    viewport, so it emits the same one-band composition it always did, written
    in the same `vh` the Tailwind classes used — so the markup React hydrates
    against is unchanged and the first paint is identical to the old one.
  */
  const unit = (n: number) => (measured ? `${(n * band).toFixed(1)}px` : `${(n * 100).toFixed(1)}vh`);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden"
      style={{ height: measured ? `${height}px` : "100vh" }}
    >
      <div className="absolute inset-0" style={{ background: "var(--bg)" }} />

      {Array.from({ length: bands }, (_, index) => index).flatMap((index) =>
        glowsForBand(index).map((glow) => (
          <div
            key={glow.key}
            className={`${glow.drift} absolute`}
            style={{
              top: unit(glow.top),
              height: unit(glow.height),
              width: `${glow.width.toFixed(1)}vw`,
              left: glow.left,
              right: glow.right,
              background: glow.background,
              // Omitted entirely on band 0, so its declaration is unchanged.
              animationDelay: glow.delay ? `${glow.delay.toFixed(2)}s` : undefined,
            }}
          />
        )),
      )}

      {/* Fixed, not absolute. See the note above the component — this is the one
          layer whose repaint cost is not free to scroll, and it is also the one
          with no located feature to scroll. */}
      <div className="sv-speedlines sv-speedlines-drift fixed inset-0 opacity-60" />
      <HalftoneOverlay size={5} opacity={0.05} angle={15} />
    </div>
  );
}
