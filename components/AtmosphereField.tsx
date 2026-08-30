import { motifForDate } from "@/lib/motif";

/**
 * The page ground.
 *
 * Resolved on the server from today's date, so it is stable for the render and
 * cannot mismatch on hydration. It is background-only: it paints a ground tint,
 * the ruled survey grid and one static geometric field, and it never touches a
 * semantic colour. Nothing in the interface names which motif is showing.
 */
export default function AtmosphereField() {
  return (
    <div
      aria-hidden="true"
      data-motif={motifForDate()}
      className="atmosphere pointer-events-none fixed inset-0 -z-10"
    />
  );
}
