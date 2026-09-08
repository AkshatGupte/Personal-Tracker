import Link from "next/link";
import Panel from "@/components/Panel";
import TopNav from "@/components/TopNav";
import { GlitchText } from "@/components/spiderverse/GlitchText";
import { ThreadVoid } from "@/components/spiderverse/Threads";

/**
 * The 404, in Rendred's own voice.
 *
 * There was none, so a stale bookmark or a deleted track's URL landed on Next's
 * stock page: white ground, system font, and a bare "404 | This page could not
 * be found" outside the app's atmosphere entirely. The layout still wrapped it,
 * so the rift glows and the wireframes drew *behind* an unstyled black-on-white
 * slab — which read as the app having crashed rather than as a page that is not
 * there.
 *
 * Reached by more than a mistyped URL: `app/tracks/[id]` calls `notFound()` for
 * an id that no longer exists, and `/lab` calls it outside development. Deleting
 * a track and then hitting Back is the ordinary way to arrive here, so this is a
 * real state of the app rather than an edge case.
 *
 * **`ThreadVoid` carries the meaning, and it is the one place it already
 * meant this.** It is the empty-state device the rest of the app uses — one
 * wireframe solid with nothing inside it — and "a structure with nothing in it"
 * is exactly what a missing route is. Nothing new was invented for this page;
 * every piece of it is already on another screen.
 *
 * No comic panel. `CLAUDE.md` allows one per screen and reserves it for the
 * level that should dominate — on a page whose whole content is one sentence
 * and a way out, the band register is the honest choice, and spending the loud
 * device on an error would put a 404 above a Track in the hierarchy.
 */
export const metadata = {
  title: "Not found · Rendred",
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
      <TopNav />

      {/*
        The real heading. Visible, unlike the `sr-only` h1 on the other screens:
        those have a wordmark and a stat block to lead with, and this page has
        nothing else to be.
      */}
      <h1 className="mt-8 font-display text-4xl uppercase tracking-[0.04em] sm:text-5xl">
        <GlitchText text="Nothing here" intensity="heavy" trigger="auto" />
      </h1>

      <Panel label="404" sublabel="no such page" className="mt-6">
        <ThreadVoid
          size={128}
          seed={0x404b}
          label="This address does not point at anything in Rendred. A track that was deleted keeps its history but loses its page, so an old link to one lands here."
        />

        {/*
          Two ways out, and the difference between them matters more than it
          looks: Home is where the tracks are, and the back link is for the
          person who got here from somewhere inside the app.
        */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            /* The app's primary fill, same as every ADD/SAVE. Yellow on ink,
               square, per the shape rule. */
            className="rounded-none bg-sv-yellow px-3.5 py-2 font-label text-[0.75rem] uppercase tracking-[0.14em] text-sv-ink transition-opacity hover:opacity-90"
          >
            All tracks
          </Link>
          <Link
            href="/progress"
            className="font-label text-[0.75rem] uppercase tracking-[0.14em] text-muted underline-offset-4 hover:text-fg hover:underline"
          >
            Progress
          </Link>
        </div>
      </Panel>
    </div>
  );
}
