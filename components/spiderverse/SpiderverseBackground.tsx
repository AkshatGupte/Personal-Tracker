import { HalftoneOverlay } from "./HalftoneOverlay";

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
export default function SpiderverseBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "var(--bg)" }} />

      <div
        className="sv-drift-a absolute -top-[35vh] -left-1/4 h-[120vh] w-[85vw]"
        style={{
          background:
            "radial-gradient(ellipse closest-side, color-mix(in srgb, var(--sv-magenta) 30%, transparent) 0%, transparent 100%)",
        }}
      />
      <div
        className="sv-drift-b absolute -right-1/4 -bottom-[35vh] h-[120vh] w-[85vw]"
        style={{
          background:
            "radial-gradient(ellipse closest-side, color-mix(in srgb, var(--sv-cyan) 26%, transparent) 0%, transparent 100%)",
        }}
      />
      <div
        className="sv-drift-c absolute top-[8vh] right-1/4 h-[80vh] w-[55vw]"
        style={{
          background:
            "radial-gradient(ellipse closest-side, color-mix(in srgb, var(--sv-purple) 32%, transparent) 0%, transparent 100%)",
        }}
      />

      <div className="sv-speedlines sv-speedlines-drift absolute inset-0 opacity-60" />
      <HalftoneOverlay size={5} opacity={0.05} angle={15} />
    </div>
  );
}
