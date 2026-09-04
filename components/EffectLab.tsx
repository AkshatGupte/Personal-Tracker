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
  const [shards, setShards] = useState(9);
  const [panel, setPanel] = useState(0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-10">
      <header>
        <h1 className="font-display text-4xl leading-none">Effect lab</h1>
        <p className={note}>
          Development only. Both effects in isolation, at the sizes they are used at, so
          the branching and the colour mix can be judged before they are wired into
          state changes across the app.
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
