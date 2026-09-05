"use client";

import { useEffect, useRef, useState } from "react";
import { buildShards, type Shard } from "./GlitchShatter";
import { collidesWithOther, markEffect, STAGGER_MS } from "./effectClock";
import { r1, rng } from "./rng";
import { useReducedMotion } from "./useReducedMotion";

/**
 * The film's full-intensity corruption glitch, arriving on its own.
 *
 * **Ambient, like the lightning, and for the same reason.** It fires every
 * 10-20 seconds on a target it picks itself and reports nothing. That makes it
 * a sibling of `AmbientLightning` and emphatically *not* of `GlitchShatter`,
 * which stays exactly as it is: a deterministic confirmation on check-in and on
 * creating a track. The two shatters share their geometry (`buildShards` is
 * imported, not re-derived) and share nothing else — one is weather, one is an
 * answer to a press, and merging them would cost the answer its reliability.
 *
 * **Concentrated on one focal point.** The reference frame fractures the
 * character and leaves the buildings behind him merely offset; a page-wide
 * fracture is a broken renderer, not a glitch. So exactly one element is picked
 * per event out of a registry of headers, labels, numerals and the wordmark,
 * and everything else on screen is left alone entirely.
 *
 * **Three passes, in this order.** The channels split, the shards break out over
 * them, and small starburst flares pop at points inside the cluster. The whole
 * thing is over in 510-780ms — deliberately about a third of a lightning
 * strike's life, so the two never read as the same species of event.
 *
 * Nothing here touches the target element. The overlay is a separate layer
 * positioned at the target's document rect, which matters more than it sounds:
 * `.sv-panel-header` already owns its `::before` plate, half the registry
 * animates on its own, and writing styles onto live app DOM would fight all of
 * it. The real element stays legible underneath the whole time — the split
 * copies are additive, exactly like `GlitchText`'s duplicates.
 *
 * `transform`, `opacity` and a static `clip-path` only, so an event stays on
 * the compositor.
 */

/* ---------------------------------------------------------------------------
   Target registry
   ---------------------------------------------------------------------------
   Queried per event rather than cached, for the same reason the lightning
   re-collects its edges: the DOM under it belongs to the data, and a stale rect
   would fracture empty space.
*/
const TARGET_SELECTORS = [
  ".sv-panel-header", // comic-panel caption boxes
  "[data-sv-glitch]", // explicit opt-in; the lab uses this
  "nav a[href='/']", // the wordmark
  "h1",
  "h2",
  ".font-label", // section labels and metadata
  "dd.font-mono", // stat numerals
];

/**
 * Controls are off the registry, whatever they match.
 *
 * `.font-label` is the interface's label voice and therefore also sits on every
 * button, which swept the primary CTAs in. Two separate reasons to keep them
 * out, and either would be enough: a button is not one of the things this was
 * asked to corrupt, and a glitch over a control that is about to be pressed
 * reads as the control failing rather than as atmosphere.
 *
 * Checked in **both directions**, which the first version did not: `closest`
 * alone catches a label inside a button but not a `<label>` that wraps its own
 * slider, and one of those duly got fractured with the control still sitting
 * live underneath the shards.
 */
const EXCLUDED =
  "button, input, select, textarea, label, [role='button'], [aria-disabled='true']";

/**
 * Selectors that are allowed to be containers. Everything else has to hold its
 * own text directly.
 *
 * Without this, `.font-label` matched the nav's `<ul>` and the heatmap's
 * legend wrapper, and the effect cheerfully fractured "HomeProgressInsightssoon"
 * as though it were one label. A caption box and the wordmark genuinely are
 * composed of children, so they are named here rather than the rule being
 * loosened for everyone.
 */
const CONTAINERS = ".sv-panel-header, [data-sv-glitch], nav a[href='/']";

/**
 * The text a sighted reader actually sees.
 *
 * Two things have to come out. `GlitchText` stacks three copies of its string
 * and hides two from the accessibility tree, so a plain `textContent` on the
 * wordmark or a glitched heading returns it tripled — which then got *set*
 * three times over by the channel copies. And `.sr-only` spans carry text that
 * occupies no space, so including them made the copies longer than the thing
 * they were doubling.
 */
function visibleText(el: Element): string {
  let out = "";
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const child = node as Element;
    if (child.getAttribute("aria-hidden") === "true") return;
    if (child.classList.contains("sr-only")) return;
    out += visibleText(child);
  });
  return out;
}

/**
 * True if the element is one label rather than a row of them.
 *
 * The distinction that matters is *how many* text-bearing children there are,
 * not whether there are any. Requiring the text to be a direct child rejected
 * "Elevation" and "Tracks" too, because a label that wraps its own string in a
 * `GlitchText` or a styled span is still a single label — it just has one layer
 * of markup. Two or more is what makes something a row: the nav's `<ul>`, the
 * heatmap's Less/More legend, a header with a label at each end.
 */
function isSingleLabel(el: Element): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim()) return true;
  }
  const withText = Array.from(el.children).filter(
    (child) => visibleText(child).trim().length > 0,
  );
  return withText.length === 1;
}

/**
 * How bright a fill has to be before `screen` blend stops working over it.
 *
 * Every layer of this effect composites additively, which is what makes it glow
 * on the near-black ground. Over the yellow CTA the same layers saturated
 * straight to white and the whole event turned into a bright smear — measured,
 * not guessed. Anything already this light has nowhere left to go.
 */
const MAX_FILL_LUMA = 0.45;

/** Perceived luminance of a computed `rgb()`/`rgba()` string, or null if the
 *  fill is transparent enough for what is behind it to dominate. */
function fillLuma(color: string): number | null {
  const parts = color.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return null;
  const [r, g, b] = parts.map(Number);
  const alpha = parts.length > 3 ? Number(parts[3]) : 1;
  if (alpha < 0.6) return null;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * The luminance of whatever the target is actually sitting on.
 *
 * Reading the element's own `background-color` is not enough, and the panel
 * caption box is exactly why: the label inside it is transparent, so the check
 * came back "no fill" and the ground it composites against — a solid plate —
 * never got measured at all. Walking up to the first opaque ancestor is what
 * the blend mode is really up against.
 *
 * The threshold sits at 0.45 so the magenta caption (0.34) stays a target,
 * because panel captions are the headline case this was asked for and the
 * separation still reads on them. Cyan and yellow plates land above 0.7, and on
 * those the additive layers saturate to a white smear with nothing to see.
 */
function groundLuma(el: Element): number | null {
  let node: Element | null = el;
  while (node && node !== document.body) {
    const luma = fillLuma(getComputedStyle(node).backgroundColor);
    if (luma !== null) return luma;
    node = node.parentElement;
  }
  return null;
}

type Target = {
  x: number;
  y: number;
  /** The fracture field: the glyph bounds grown by `padX` / `padY`. */
  width: number;
  height: number;
  padX: number;
  padY: number;
  /** The glyphs' own height, before padding. Drives how hard the plates miss. */
  textHeight: number;
  text: string;
  font: string;
  letterSpacing: string;
  textTransform: string;
  textAlign: string;
};

/**
 * The fracture field around the glyphs.
 *
 * This started as a flat 6px, which was wrong at both ends and unnoticeable at
 * the small one: a section label is about 27x16, so the entire event happened
 * inside a 39x28 box and read as a smudge on a word rather than as the screen
 * corrupting. The reference frame's fracture is several times the size of the
 * thing it is breaking and spills well past it.
 *
 * So the field scales with the target, with a floor generous enough that even
 * the smallest label in the registry gets an event several times its own area.
 * The floor is what actually fixes the small case; the ratio is what keeps a
 * heading from looking under-fractured by comparison. Both were raised a second
 * time on the same note — still not big enough — and a 36x14 section label now
 * fractures across roughly 126x86.
 *
 * Vertical padding is the more aggressive multiplier of the two on purpose.
 * Text is much wider than it is tall, so an equal ratio gives a long thin strip
 * — and a fracture that never breaks above or below the line it is on reads as
 * a strikethrough.
 */
const PAD_X = { min: 45, ratio: 0.7, max: 180 };
const PAD_Y = { min: 36, ratio: 1.7, max: 120 };

const padFor = (extent: number, { min, ratio, max }: { min: number; ratio: number; max: number }) =>
  Math.round(Math.max(min, Math.min(max, extent * ratio)));

/**
 * How much of the field's padding the shard cluster gives back.
 *
 * The channel copies and the flares want the whole field — that spread is what
 * makes the event register from across the page. The shards do not: they are
 * laid one per grid cell across whatever box they are given, so handing them
 * the full field scattered them over the empty margin and the result read as
 * confetti around a word rather than as that word fracturing.
 *
 * So the cluster gets the glyphs plus a halo, and the two layers work at
 * different extents on purpose. Shards still spill past this box — their
 * polygons are free to run outside 0-100% — they simply start from the text.
 */
const SHARD_INSET = { x: 0.55, y: 0.45 };

/**
 * Everything currently on screen that is worth fracturing.
 *
 * The filters are all about legibility of the result rather than taste: a box
 * narrower than a word has nowhere to put nine shards, a paragraph-length
 * string turns the channel copies into unreadable mush, and an element scrolled
 * out of view would spend the whole event glitching where nobody is looking.
 */
function collectTargets(): Target[] {
  const sx = window.scrollX;
  const sy = window.scrollY;
  const seen = new Set<Element>();
  const targets: Target[] = [];

  for (const selector of TARGET_SELECTORS) {
    document.querySelectorAll(selector).forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);

      const text = visibleText(el).trim();
      if (text.length === 0 || text.length > 48) return;
      if (!isSingleLabel(el) && !el.matches(CONTAINERS)) return;

      /*
        The *text's* bounds, not the element's.

        A section label or a heading in this layout is a block that spans the
        whole reading column, so its border box is 670px of which maybe 90 are
        ink. Measured against the border box, every block-level label failed the
        width cap and the spawner ended up with one eligible target on the page
        and picked it every single time — which looks exactly like a working
        effect until you watch it twice.

        A Range over the contents gives the tight glyph extent instead, which
        fixes the selection bug and is also just more faithful: the reference
        frame fractures the character, not the rectangle he is standing in.
      */
      const range = document.createRange();
      range.selectNodeContents(el);
      const bounds = range.getBoundingClientRect();
      range.detach();
      const r = bounds.width > 0 && bounds.height > 0 ? bounds : el.getBoundingClientRect();

      /*
        Small, but not tiny. 36px rejected "Tracks" and "Elevation" — the small-
        caps section labels this was specifically asked to target, which in this
        type are barely wider than 30px. 26 admits those and still keeps out the
        heatmap's three-letter weekday axis at 9-14px, which is not a focal
        point by any reading.
      */
      if (r.width < 26 || r.height < 10) return;
      if (r.width > 560 || r.height > 160) return; // no paragraph-sized targets
      if (r.bottom < 8 || r.top > window.innerHeight - 8) return;

      if (el.closest(EXCLUDED) || el.querySelector(EXCLUDED)) return;

      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.opacity === "0") return;
      const luma = groundLuma(el);
      if (luma !== null && luma > MAX_FILL_LUMA) return;

      const padX = padFor(r.width, PAD_X);
      const padY = padFor(r.height, PAD_Y);

      targets.push({
        x: r.x + sx - padX,
        y: r.y + sy - padY,
        width: r.width + padX * 2,
        height: r.height + padY * 2,
        padX,
        padY,
        textHeight: r.height,
        text,
        font: cs.font || `${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`,
        letterSpacing: cs.letterSpacing,
        textTransform: cs.textTransform,
        textAlign: cs.textAlign,
      });
    });
  }

  return targets;
}

/* ---------------------------------------------------------------------------
   The three channel copies
   ---------------------------------------------------------------------------
   The reference's separation is much heavier than the app's resting split: the
   copies are metres apart on a cinema screen and read as three distinct prints,
   not as one edge fringe. So 5-10px here against `GlitchText`'s 2-7px, and
   three plates rather than a pair.

   Red / cyan / magenta, not red / green / blue. The film's third channel is
   green and this palette has none — the whole motif system it belonged to was
   retired — so the third print takes the theme's own magenta. On ink at
   `screen` blend the separation reads the same; a green would read as a
   different app.
*/
const CHANNELS = [
  { color: "var(--sv-red)", fx: 1, fy: 0.34, opacity: 0.85, period: 190 },
  { color: "var(--sv-cyan)", fx: -0.92, fy: -0.28, opacity: 0.8, period: 230 },
  { color: "var(--sv-magenta)", fx: 0.26, fy: -0.76, opacity: 0.7, period: 270 },
];

/**
 * Shard plates for this effect only. The film's fracture reads in these three
 * plus a paper flare; yellow and purple belong to the confirm shatter's mix.
 *
 * Cyan appears twice, and that is a weighting rather than a mistake. Magenta
 * and red sit next to each other on the wheel, so an even draw across four
 * entries puts two thirds of the cluster in the same warm register and the
 * whole thing reads as one red mass — observed on a large target, where there
 * is enough shard area for the imbalance to show. Cyan is the complement
 * carrying the separation; giving it a second slot keeps the cluster split
 * between two registers instead of tinted into one.
 */
const GLITCH_PLATES = [
  "var(--sv-magenta)",
  "var(--sv-cyan)",
  "var(--sv-red)",
  "var(--sv-cyan)",
  "#FFFFFF",
];

type Flare = { x: number; y: number; size: number; delay: number; duration: number; rotate: number };

/**
 * Starburst flares, scattered inside the shard cluster.
 *
 * Placed on a jittered ring rather than uniformly, because the reference's
 * sparkles sit at the *edges* where shards cross rather than in the middle of
 * one — a flare centred on a shard face reads as a decal stuck on it.
 */
function buildFlares(
  seed: number,
  width: number,
  height: number,
  count: number,
  sizeBasis: number,
  holdMs: number,
): Flare[] {
  const next = rng(seed);
  /*
    Positioned across the field, but sized against the shard cluster.

    A flat 10-26px was tuned on a panel caption and then measured on a 26px
    label, where one sparkle was as tall as the thing it decorated. Scaling to
    the field fixed that and then broke again when the field grew: for a short
    label the field is mostly padding, so the basis was measuring empty space
    and the flares came out bigger than the fracture they were meant to be
    highlights on. The cluster is the thing they sit on, so it is the thing they
    are measured against.
  */
  const scale = Math.max(11, Math.min(38, sizeBasis * 0.5));
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + next() * 1.4;
    const radius = 0.24 + next() * 0.26;
    return {
      x: r1(width * (0.5 + Math.cos(angle) * radius)),
      y: r1(height * (0.5 + Math.sin(angle) * radius * 1.1)),
      size: Math.round(scale * (0.6 + next() * 0.7)),
      /*
        Spread across the hold, not bunched into its first quarter.

        With a 300ms event every flare had to pop immediately or miss it. Over a
        hold of a second or two, firing them all at the start leaves the rest of
        the event without any specular life in it — so each takes its own slot
        along the hold, jittered so the sequence does not tick.
      */
      delay: Math.round(((i + next() * 0.8) / count) * holdMs),
      duration: Math.round(150 + next() * 100),
      rotate: Math.round(next() * 90),
    };
  });
}

/** One 4-point sparkle. Concave sides are what make it a print flare rather
 *  than a plus sign — a straight-sided cross reads as a UI icon. */
function FlareShape({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M12 0 C13.1 8.9 15.1 10.9 24 12 C15.1 13.1 13.1 15.1 12 24 C10.9 15.1 8.9 13.1 0 12 C8.9 10.9 10.9 8.9 12 0 Z" />
    </svg>
  );
}

type Event = {
  id: number;
  target: Target;
  shards: Shard[];
  flares: Flare[];
  split: number;
  rampMs: number;
  outDelay: number;
  outMs: number;
};

/** The channel ramp. Fixed, because it is the "something is wrong" beat and a
 *  randomised one loses the shared onset the shards land against. */
const RAMP_MS = 130;

export default function AmbientGlitch() {
  const reduced = useReducedMotion();
  const [event, setEvent] = useState<Event | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nextId = useRef(0);
  /** Concurrency cap of one, read synchronously. `event` in the closure would
   *  be a render-old value and a forced double-fire could slip past it. */
  const busy = useRef(false);

  useEffect(() => {
    if (reduced) return; // Disabled outright, not slowed.
    let alive = true;

    const spawn = () => {
      if (!alive || busy.current) return;

      // Two ambient effects on independent timers collide every few minutes.
      // Postpone rather than skip — see effectClock.
      if (collidesWithOther("glitch")) {
        timers.current.push(setTimeout(spawn, STAGGER_MS()));
        return;
      }

      const targets = collectTargets();
      if (targets.length === 0) return;

      const target = targets[Math.floor(Math.random() * targets.length)];
      const seed = Math.floor(Math.random() * 0x7fffffff);
      /*
        The fade begins between one and two seconds in, and the corruption is
        live for all of it.

        This replaces a 160-300ms hold, in two requested steps, and it
        deliberately gives up the one thing the original brief bought with that
        number: at ~600ms the glitch could not be mistaken for a lightning
        strike. At 2.4-3.6s it now outlasts one. They still separate on
        everything else — a bolt is a single discharge leaving a border, this is
        a text element coming apart — but the duration tell is gone, on request,
        and is now inverted rather than merely absent.

        Everything downstream follows from `hold` on its own: the shards take as
        many cycles as fit, the channel jitter takes as many iterations, and the
        flares spread along its whole length. Lengthening the hold is the only
        edit a longer event needs.
      */
      const hold = 1900 + Math.random() * 1000; // fade starts at 2.03-3.03s
      const outMs = 350 + Math.random() * 250; // 350-600ms
      const total = RAMP_MS + hold + outMs; // 2.38-3.63s

      busy.current = true;
      markEffect("glitch");

      /*
        Density follows the field's area: 10-16 shards and 3-6 flares.

        The shard range was 6-10 while fields were the glyph bounds plus 6px.
        Enlarging the field to make the effect noticeable left that count too
        sparse to read as fragmentation — ten small triangles scattered over a
        292x85 area is confetti, not a fracture. The flare count deliberately
        did *not* grow with it: flares are specular highlights on the cluster,
        and more than about six stops reading as light catching the edges and
        starts reading as a sticker sheet.
      */
      const area = target.width * target.height;
      const shardCount = Math.round(10 + Math.min(6, area / 6000));
      // More of them now, because they are spread over a hold several times
      // longer than the one they were counted for — see buildFlares.
      const flareCount = Math.round(4 + Math.min(4, area / 18000));

      const id = (nextId.current += 1);
      setEvent({
        id,
        target,
        /*
          Triangle reach is a percentage of the field, so enlarging the field
          enlarged the shards with it and the cluster went back to being three
          flat plates over the text — the exact thing 0.58 had been chosen to
          fix, reintroduced by a change at the other end. 0.5 over the inset
          cluster box holds the fragmentation at the new size and leaves gaps
          for the halftone and the words to come through.
        */
        shards: buildShards(seed, shardCount, GLITCH_PLATES, 0.5),
        flares: buildFlares(
          seed ^ 0x5bf03635,
          target.width,
          target.height,
          flareCount,
          Math.min(
            target.width - target.padX * SHARD_INSET.x * 2,
            target.height - target.padY * SHARD_INSET.y * 2,
          ),
          hold,
        ),
        /*
          How far the plates miss, scaled to the type rather than fixed.

          A flat 5-10px was set against a heading and then measured on a 16px
          label, where it is most of a line height and unreadable, and on a 37px
          one, where it is a fringe. A fraction of the cap height, with a little
          slop, reads as the same mistake at every size the registry can hand
          over — raised from half to about two thirds along with the field, so
          the copies stay as far apart relative to the space they now have.
        */
        split:
          Math.max(8, Math.min(24, target.textHeight * 0.65)) *
          (0.8 + Math.random() * 0.5),
        rampMs: RAMP_MS,
        outDelay: RAMP_MS + hold,
        outMs,
      });

      timers.current.push(
        setTimeout(() => {
          busy.current = false;
          setEvent((current) => (current?.id === id ? null : current));
        }, total + 40),
      );
    };

    const schedule = () => {
      // 10-20s, averaging ~15. Sparser than the lightning's 8-18s on purpose:
      // this is the louder of the two and should not out-shout it.
      const gap = 10000 + Math.random() * 10000;
      timers.current.push(
        setTimeout(() => {
          if (!alive) return;
          spawn();
          schedule();
        }, gap),
      );
    };

    timers.current.push(setTimeout(spawn, 4000 + Math.random() * 4000));
    schedule();

    // The lab drives this directly; nothing in the app dispatches it.
    const force = () => spawn();
    window.addEventListener("sv:glitch", force);

    return () => {
      alive = false;
      window.removeEventListener("sv:glitch", force);
      timers.current.forEach(clearTimeout);
      timers.current = [];
      busy.current = false;
    };
  }, [reduced]);

  if (reduced || !event) return null;

  const { target, split } = event;
  const travel = split / 5;
  const holdMs = event.outDelay - event.rampMs;

  // In, then out, as two animations rather than one scaled keyframe — the ramp
  // is fixed and the resolve is randomised, so a single keyframe would stretch
  // the onset along with the tail. Same shape as the lightning's flicker/fade.
  const passAnimation =
    `sv-glitch-in ${event.rampMs}ms steps(2, end) both,` +
    ` sv-glitch-out ${event.outMs}ms steps(3, end) ${event.outDelay}ms forwards`;

  /**
   * The same pair with a jitter looping between them, for the layers that would
   * otherwise stand still through a hold that is now seconds rather than a
   * fifth of one.
   *
   * `period` differs per channel and the three are pairwise coprime (19/23/27
   * hundredths), so the composite does not repeat inside any hold this effect
   * can draw. That is the same reason the background's three rift glows drift
   * on 37/43/29s: harmonic periods visibly re-align, and the moment a viewer
   * can predict the next frame the corruption reads as a loop playing rather
   * than as something going wrong.
   */
  const jitterAnimation = (period: number) =>
    `sv-glitch-in ${event.rampMs}ms steps(2, end) both,` +
    ` sv-glitch-jitter ${period}ms steps(4, end) ${event.rampMs}ms ${Math.ceil(holdMs / period)},` +
    ` sv-glitch-out ${event.outMs}ms steps(3, end) ${event.outDelay}ms forwards`;

  return (
    /*
      Clipped on x only, like the lightning layer and for the same measured
      reason: a channel copy pushed 10px past a target sitting hard against a
      narrow viewport's edge would widen the document and flash a horizontal
      scrollbar. Clipping y as well would crop nothing worth keeping but would
      make this a scroll container.
    */
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-30 w-full"
      style={{ overflowX: "clip", overflowY: "visible" }}
    >
      <div
        key={event.id}
        className="pointer-events-none absolute"
        style={{ left: target.x, top: target.y, width: target.width, height: target.height }}
      >
        {/* 1. The channel split. Three copies of the target's own text, set in
               the target's own font, knocked apart. The real element is still
               underneath and untouched, so the string stays readable through
               the whole event — the copies add, they do not replace. */}
        {CHANNELS.map((channel, i) => (
          <div
            key={`ch${i}`}
            className="sv-glitch-pass absolute inset-0"
            style={{
              color: channel.color,
              font: target.font,
              letterSpacing: target.letterSpacing,
              textTransform: target.textTransform as React.CSSProperties["textTransform"],
              textAlign: target.textAlign as React.CSSProperties["textAlign"],
              // The layer is the glyph rect grown by the field padding, so the
              // copies are inset by the same amount to land back on the real
              // text. Inner width therefore still equals the measured glyph
              // width, which is what keeps any wrapping identical.
              padding: `${target.padY}px ${target.padX}px`,
              whiteSpace: "pre-wrap",
              overflow: "hidden",
              mixBlendMode: "screen",
              ["--ch-x" as string]: `${r1(split * channel.fx)}px`,
              ["--ch-y" as string]: `${r1(split * channel.fy)}px`,
              ["--ch-o" as string]: channel.opacity,
              animation: jitterAnimation(channel.period),
            }}
          >
            {target.text}
          </div>
        ))}

        {/* 2 and 3. The cluster: halftone, then the shards over it. Inset to
               the glyphs plus a halo — see SHARD_INSET. */}
        <div
          className="absolute"
          style={{
            left: Math.round(target.padX * SHARD_INSET.x),
            right: Math.round(target.padX * SHARD_INSET.x),
            top: Math.round(target.padY * SHARD_INSET.y),
            bottom: Math.round(target.padY * SHARD_INSET.y),
          }}
        >
          {/* Halftone under the shards rather than covered by them: the
              reference's fracture still shows print texture through every
              shard, and an opaque cluster reads as flat vector plates.

              It lives inside the cluster box, and quietly. Across the whole
              field at 0.55 the wash had a hard rectangular edge sitting in
              empty margin, which at the enlarged size read as a box drawn
              around the glitch — the one part of the effect with a straight
              edge anywhere in it. */}
          <div
            className="sv-glitch-pass absolute inset-0"
            style={{
              backgroundImage: "var(--sv-halftone)",
              backgroundSize: "3px 3px",
              mixBlendMode: "screen",
              ["--ch-x" as string]: "0px",
              ["--ch-y" as string]: "0px",
              ["--ch-o" as string]: 0.35,
              animation: passAnimation,
            }}
          />
          {event.shards.map((shard, i) => {
            const delay = 80 + shard.delay;
            const duration = Math.max(220, Math.min(420, event.outDelay - delay));
            /*
              One cycle used to be the whole event. Now it is a heartbeat: the
              shard breaks out, snaps back and dims, and then does it again for
              as long as the hold lasts. Every shard has its own duration out of
              `buildShards`, so the cluster shimmers continuously instead of the
              pieces strobing in unison.
            */
            const cycles = Math.max(1, Math.ceil((event.outDelay - delay) / duration));
            return (
              <div
                key={`s${i}`}
                className="sv-shard absolute inset-0"
                style={{
                  clipPath: shard.clip,
                  background: shard.color,
                  mixBlendMode: "screen",
                  // Shards break out by the same amount the plates miss by, so
                  // one number carries "how badly did the press slip" across
                  // both passes instead of the two drifting apart when either
                  // is tuned.
                  ["--shard-x" as string]: `${r1(shard.dx * travel)}px`,
                  ["--shard-y" as string]: `${r1(shard.dy * travel)}px`,
                  ["--shard-r" as string]: `${r1(shard.rotate)}deg`,
                  ["--shard-o" as string]: r1(0.6 + shard.opacity * 0.15),
                  /*
                    The fade is a second animation rather than the tail of the
                    first: a cycle ending is not the event ending, and the exit
                    has to be able to land part-way through one. It names only
                    opacity, so `sv-shard` keeps driving the transform and the
                    pieces are still moving as they go.
                  */
                  animation:
                    `sv-shard ${duration}ms steps(4, end) ${delay}ms ${cycles} both,` +
                    ` sv-shard-out ${event.outMs}ms linear ${event.outDelay}ms forwards`,
                }}
              />
            );
          })}
        </div>

        {/* 4. The flares. The one piece of this that exists nowhere else in the
               app, and the detail that carries most of the reference's print
               energy — sharp specular crosses where the plates cross. */}
        {event.flares.map((flare, i) => {
          const delay = 140 + flare.delay;
          const duration = Math.max(120, Math.min(flare.duration, event.outDelay + event.outMs - delay));
          return (
            <div
              key={`f${i}`}
              className="absolute"
              style={{
                left: flare.x - flare.size / 2,
                top: flare.y - flare.size / 2,
                width: flare.size,
                height: flare.size,
                mixBlendMode: "screen",
              }}
            >
              <div
                className="sv-flare"
                style={{
                  ["--flare-r" as string]: `${flare.rotate}deg`,
                  animationDelay: `${delay}ms`,
                  animationDuration: `${duration}ms`,
                }}
              >
                <FlareShape size={flare.size} color={i % 3 === 0 ? "#B8FBFF" : "#FFFFFF"} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
