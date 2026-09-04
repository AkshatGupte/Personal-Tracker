"use client";

import { useState } from "react";
import GlitchShatter from "@/components/spiderverse/GlitchShatter";
import VenomLightning from "@/components/spiderverse/VenomLightning";

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
  const [bolt, setBolt] = useState(0);
  const [wide, setWide] = useState(0);
  const [shatter, setShatter] = useState(0);
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
        <h2 className={sectionLabel}>Venom lightning · stat accent</h2>
        <p className={note}>
          The size used behind the elevation numeral. Fire it repeatedly — the bolt is
          regenerated every strike, so no two are the same shape.
        </p>
        <div className="flex items-center gap-6">
          <div className="relative inline-flex items-center justify-center px-6 py-2">
            <VenomLightning fire={bolt} width={130} height={44} className="-left-2 top-1/2 -translate-y-1/2" />
            <span className="relative font-mono text-5xl leading-none tabular-nums">96</span>
          </div>
          <button type="button" className={fireButton} onClick={() => setBolt((n) => n + 1)}>
            Strike
          </button>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className={sectionLabel}>Venom lightning · wide arc</h2>
        <p className={note}>
          The button-press variant, arcing outward. Longer box, so the spine takes more
          segments and the forks have room to taper.
        </p>
        <div className="flex items-center gap-6">
          <div className="relative inline-block">
            <VenomLightning fire={wide} width={260} height={60} className="-left-24 top-1/2 -translate-y-1/2" />
            <span className="relative inline-block rounded-none bg-sv-yellow px-4 py-2 font-label text-[0.65rem] uppercase tracking-[0.14em] text-sv-ink">
              Add
            </span>
          </div>
          <button type="button" className={fireButton} onClick={() => setWide((n) => n + 1)}>
            Arc
          </button>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className={sectionLabel}>Venom lightning · idle accent</h2>
        <p className={note}>
          Self-firing every 8-15 seconds. Left running, it should read as an occasional
          power fluctuation and never as a loop.
        </p>
        <div className="relative inline-flex w-fit items-center gap-2 border border-border px-4 py-2">
          <VenomLightning idle width={96} height={28} className="-right-6 top-1/2 -translate-y-1/2" />
          <span className="font-comic text-2xl leading-none">Rendred</span>
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
