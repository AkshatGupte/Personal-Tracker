/**
 * The dimension cut between routes.
 *
 * A template re-mounts on every navigation, which is exactly the hook a page
 * transition needs — and it gives one for free, without AnimatePresence or any
 * animation dependency. The tear is enter-only: the App Router unmounts the
 * outgoing tree before the incoming one paints, so holding an exit would need
 * machinery this app does not have and does not need.
 *
 * 180ms, under the chromatic filter, easing on a cut curve. Fast enough that it
 * reads as a jump between panels and never as loading. The global
 * prefers-reduced-motion rule collapses it to nothing.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="sv-page-in">{children}</div>;
}
