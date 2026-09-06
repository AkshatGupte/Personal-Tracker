"use client";

import { useEffect, useState } from "react";
import GlitchShatter from "@/components/spiderverse/GlitchShatter";

/**
 * The bench itself. Every control fires a real burst of the real component —
 * nothing here is a mock, so what is tuned here is what ships.
 */
const sectionLabel =
  "font-label text-[0.6rem] uppercase tracking-[0.17em] text-sv-cyan";
const note = "mt-1 max-w-[46ch] text-sm leading-relaxed text-muted";
const fireButton =
  "rounded-none bg-sv-yellow px-3 py-1.5 font-label text-[0.6rem] uppercase tracking-[0.14em] text-sv-ink";

export default function EffectLab() {
  const [shatter, setShatter] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [glitches, setGlitches] = useState<string[]>([]);
  const [glitchCount, setGlitchCount] = useState(0);

  /*
    The spawner owns its own state, so the lab counts what it renders rather
    than being told. A MutationObserver on the strike layer is enough and keeps
    the component free of any lab-only reporting hook.
  */
  useEffect(() => {
    const seen = new Set<string>();
    const observer = new MutationObserver(() => {
      document.querySelectorAll("svg.sv-strike").forEach((el) => {
        const key = el.getAttribute("style") ?? "";
        if (seen.has(key)) return;
        seen.add(key);
        setStrikes((n) => n + 1);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  /*
    The same trick for the ambient glitch, plus the one thing worth knowing
    about it that a screenshot cannot tell you: *what* it picked. Target variety
    is the property most likely to be wrong — a registry selector that matches
    one element on the page produces a spawner that looks fine and glitches the
    same header forever — so the lab records the text of every target it sees.
  */
  useEffect(() => {
    let last = "";
    const observer = new MutationObserver(() => {
      const layer = document.querySelector(".sv-glitch-pass");
      if (!layer) return;
      const text = (layer.textContent ?? "").trim().slice(0, 28) || "(untitled)";
      const rect = (layer as HTMLElement).getBoundingClientRect();
      const key = `${text}@${Math.round(rect.x)},${Math.round(rect.y)}`;
      if (key === last) return;
      last = key;
      setGlitchCount((n) => n + 1);
      // The log is the last twelve, not all of them — over a long watch the
      // count is the useful number and the tail is just scroll.
      setGlitches((seen) => [text, ...seen].slice(0, 12));
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  const [shards, setShards] = useState(9);
  const [panel, setPanel] = useState(0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-10">
      <header>
        <h1 className="font-display text-4xl leading-none">Effect lab</h1>
        <p className={note}>
          Development only. Every effect in isolation, at the sizes it is used at, so the
          branching, the colour mix and the target variety can be judged before any of it
          is trusted on a real screen. Two of the three are ambient and arrive on their
          own — the buttons beside them only force the same spawner to run early.
        </p>
      </header>

      {/* ---------------------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className={sectionLabel}>Ambient lightning</h2>
        <p className={note}>
          Nothing here triggers it. The spawner is mounted once in the layout and fires
          on its own every 8-18 seconds, picking a random point along a real border — a
          panel edge, the masthead rule, the page column. Leave this page open and watch;
          the panels below are targets. &ldquo;Strike now&rdquo; only forces the same
          spawner to run early, for inspection.
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className={fireButton}
            onClick={() => window.dispatchEvent(new Event("sv:lightning"))}
          >
            Strike now
          </button>
          <p className="font-label text-[0.55rem] uppercase tracking-[0.14em] text-muted">
            struck {strikes} {strikes === 1 ? "time" : "times"} since load
          </p>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-6">
          <div className="sv-panel h-28" />
          <div className="sv-panel h-28" />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className={sectionLabel}>Dimensional tears</h2>
        <p className={note}>
          The third ambient effect. A tear opens somewhere every 13-26 seconds and lives
          about five, whichever of the five archetypes it drew — <em>fissure</em> (a long
          quiet split), <em>rupture</em> (the surface gives all at once, and the split
          jumps past its own run), <em>cascade</em> (one failure propagating along a line,
          seam after seam), <em>corruptor</em> (barely moves, breaks the page around
          itself), and <em>blink</em> (a tear that will not hold). Each generates its own
          keyframes, so no two share a timeline.
        </p>
        <p className={note}>
          What to judge is whether it reads as <em>an opening in the surface</em> rather
          than as a shape lying on it. The silhouette is built from a line of failure
          outward — a jagged spine, two lips walked along it — and it grows by the split
          running further and the lips parting, never by the drawing being scaled. Watch
          the edge for the things only a hole has: notches where the surface still holds
          on, splinters standing into the gap, the lit wall of its own thickness inside
          the near lip, and flaps of panel levered up out of it.
        </p>
        <p className={note}>
          The other half is the <em>corruption</em>. When one fires, the interface behind
          it is genuinely displaced, channel-split, torn into bands and sometimes erased
          outright — that is `backdrop-filter` on the real pixels, not a drawing of a
          glitch. Press repeatedly and you will mostly see nothing extra: bursts are
          rate-limited to one every 2.6 seconds however many tears want one, and only
          two tears may be open at once (one on a narrow screen), so pressing harder
          refills a slot rather than raising the rate, and how hard
          one hits is read off how far open the tear is at that instant. Fire a dozen,
          then leave it alone and watch — the contrast between the stillness and the break
          is the whole effect.
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className={fireButton}
            onClick={() => window.dispatchEvent(new Event("sv:spot"))}
          >
            Open a tear
          </button>
          <p className="font-label text-[0.55rem] uppercase tracking-[0.14em] text-muted">
            interior draws behind this page &middot; edge and corruption draw over it
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className={sectionLabel}>Ambient glitch</h2>
        <p className={note}>
          The second ambient effect, and nothing here triggers it either. It fires every
          10-20 seconds, picks <em>one</em> element on screen out of its registry — panel
          captions, section labels, headings, stat numerals, the wordmark — and corrupts
          only that one: channels split apart, shards break out over it, print flares pop
          where they cross. It is over in about half a second, against a lightning
          strike&rsquo;s two. Leave this page alone for a minute and watch the log fill;
          the point of the log is that the targets should keep changing.
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className={fireButton}
            onClick={() => window.dispatchEvent(new Event("sv:glitch"))}
          >
            Glitch now
          </button>
          <p className="font-label text-[0.55rem] uppercase tracking-[0.14em] text-muted">
            {glitchCount === 0
              ? "nothing glitched yet"
              : `${glitchCount} glitched since load`}
          </p>
        </div>
        {/* Deliberately varied targets, so the registry has something to choose
            between on a page that is otherwise all prose. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-4">
          <div>
            <p className="font-label text-[0.6rem] uppercase tracking-[0.17em] text-muted">
              elevation
            </p>
            <p className="mt-1.5 font-mono text-3xl leading-none text-fg" data-sv-glitch>
              248
            </p>
          </div>
          <div>
            <p className="font-label text-[0.6rem] uppercase tracking-[0.17em] text-muted">
              streak
            </p>
            <p className="mt-1.5 font-mono text-3xl leading-none text-streak" data-sv-glitch>
              31
            </p>
          </div>
          <h3 className="font-display text-2xl leading-none" data-sv-glitch>
            Data structures
          </h3>
          <span
            className="font-label text-[0.6rem] uppercase tracking-[0.17em] text-sv-cyan"
            data-sv-glitch
          >
            checked in today
          </span>
        </div>
        <ol className="mt-1 flex flex-col gap-0.5 font-label text-[0.55rem] uppercase tracking-[0.14em] text-muted">
          {glitches.map((target, i) => (
            <li key={`${target}-${i}`}>
              {glitchCount - i}. {target}
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className={sectionLabel}>Glitch shatter · row</h2>
        <p className={note}>
          The confirm effect at the size of a task row. Triangular shards in the theme&rsquo;s
          plates, knocked out of register and snapped back.
        </p>
        <div className="flex items-center gap-6">
          <div className="relative w-[22rem] border border-border px-3 py-3">
            <GlitchShatter fire={shatter} count={shards} />
            <span className="relative text-sm">Practice array problems</span>
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" className={fireButton} onClick={() => setShatter((n) => n + 1)}>
              Shatter
            </button>
            <label className="font-label text-[0.55rem] uppercase tracking-[0.14em] text-muted">
              shards {shards}
              <input
                type="range"
                min={6}
                max={12}
                value={shards}
                onChange={(e) => setShards(Number(e.target.value))}
                className="mt-1 block w-28"
              />
            </label>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className={sectionLabel}>Glitch shatter · panel</h2>
        <p className={note}>
          The same effect over a larger surface, where the shards spread further apart
          and the grid placement matters more.
        </p>
        <div className="flex items-start gap-6">
          <div className="sv-panel relative h-40 w-[24rem]">
            <GlitchShatter fire={panel} count={12} />
          </div>
          <button type="button" className={fireButton} onClick={() => setPanel((n) => n + 1)}>
            Shatter panel
          </button>
        </div>
      </section>
    </div>
  );
}
