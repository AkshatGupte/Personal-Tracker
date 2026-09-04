/**
 * Global SVG filter definitions for true chromatic aberration.
 *
 * This is the real thing rather than a stack of coloured box-shadows: the
 * source is duplicated, each copy is pushed a few pixels with feOffset, and
 * feColorMatrix strips it down to a single channel before the copies are
 * screened back together. The result separates *the artwork's own colours*,
 * so letterforms keep their shape while their edges split — which is what a
 * misregistered print plate actually does, and what a shadow can never fake.
 *
 * Rendered once in the root layout; components reference the ids by url().
 */
export default function ChromaticDefs() {
  return (
    <svg
      aria-hidden
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
    >
      <defs>
        {/* Keep only red, only green, only blue. */}
        <filter id="sv-chromatic" colorInterpolationFilters="sRGB">
          <feOffset in="SourceGraphic" dx="-2" dy="0" result="pushA" />
          <feColorMatrix
            in="pushA"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="chanA"
          />
          <feOffset in="SourceGraphic" dx="2" dy="0" result="pushB" />
          <feColorMatrix
            in="pushB"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="chanB"
          />
          <feBlend in="chanA" in2="chanB" mode="screen" result="split" />
          <feBlend in="SourceGraphic" in2="split" mode="screen" />
        </filter>

        {/* Wider separation for hero type, with a vertical component so the
            split does not read as a flat horizontal smear. */}
        <filter id="sv-chromatic-heavy" colorInterpolationFilters="sRGB">
          <feOffset in="SourceGraphic" dx="-4" dy="1" result="pushA" />
          <feColorMatrix
            in="pushA"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0.25 0 0
                    0 0 0 1 0"
            result="chanA"
          />
          <feOffset in="SourceGraphic" dx="4" dy="-1" result="pushB" />
          <feColorMatrix
            in="pushB"
            type="matrix"
            values="0 0 0 0 0
                    0 0.55 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="chanB"
          />
          <feBlend in="chanA" in2="chanB" mode="screen" result="split" />
          <feBlend in="SourceGraphic" in2="split" mode="screen" />
        </filter>
      </defs>
    </svg>
  );
}
