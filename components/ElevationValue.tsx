"use client";

import { useEffect, useRef, useState } from "react";
import { GlitchText } from "@/components/spiderverse/GlitchText";
import VenomLightning from "@/components/spiderverse/VenomLightning";

/**
 * The elevation figure, with an arc across it when the ground actually rises.
 *
 * **It owns the value change, which is why the key moved in here.** The figure
 * used to be keyed on the value in the page so the flash would replay; that
 * remounts whatever renders it, and a component that remounts cannot remember
 * what the number was a moment ago. The key now sits on the inner span — the
 * flash still replays — while this component survives, so it can compare.
 *
 * Only a *rise* strikes. Elevation is cumulative and normally only climbs, but
 * deleting a task rebuilds every day it touched and can lower it, and a bolt
 * celebrating a fall would be reporting the opposite of what happened. Nothing
 * fires on first mount either: arriving on the page is not a change.
 */
export default function ElevationValue({ value }: { value: number }) {
  const [strike, setStrike] = useState(0);
  const previous = useRef(value);

  useEffect(() => {
    if (value === previous.current) return;
    const rose = value > previous.current;
    previous.current = value;
    if (rose) setStrike((n) => n + 1);
  }, [value]);

  return (
    <span className="relative inline-block">
      <VenomLightning
        fire={strike}
        width={150}
        height={54}
        className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      />
      <span key={value} className="sv-value-flash relative">
        <GlitchText text={String(value)} intensity="subtle" trigger="auto" />
      </span>
    </span>
  );
}
