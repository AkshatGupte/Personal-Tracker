"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { CheckInOutcome } from "@/lib/streak";

/**
 * The one channel a check-in speaks on.
 *
 * A check-in changes five things on a track page at once — the tick, the topic
 * tally, the elevation, the streak and the ring — and before this they each
 * simply redrew when their own number happened to change. Five reactions to one
 * act read as five events. This carries the outcome from the row that was
 * clicked to the header, so that exactly one measurement is emphasised and the
 * rest merely settle.
 *
 * It carries no data of its own: the numbers still come from the server on the
 * revalidated render, and this only says *which* of them the act was about.
 * Nothing here is a second copy of progress.
 */

/** Which measurement the check-in's headline is about. */
export type BeatSignal = "streak" | "elevation";

export type Beat = {
  /** Rises on every check-in, so two identical outcomes still read as two acts. */
  seq: number;
  outcome: CheckInOutcome;
  signal: BeatSignal;
};

/**
 * The streak is the headline when it moved; otherwise the volume is.
 *
 * `started`, `extended` and an undo that broke the day all move the streak, so
 * they point at it. `recorded` and an undo that left other check-ins standing
 * do not, so they point at the elevation — which is the thing that did change.
 * One rule, derived from the numbers, rather than a table per outcome.
 */
export function signalFor(outcome: CheckInOutcome): BeatSignal {
  return outcome.after === outcome.before ? "elevation" : "streak";
}

type BeatChannel = {
  beat: Beat | null;
  /** Returns the sequence number of the act, so a caller can tell if it is still the live one. */
  publish: (outcome: CheckInOutcome) => number;
};

// The default makes the provider optional: a TaskRow rendered outside one still
// works, it just has no header listening.
const Context = createContext<BeatChannel>({ beat: null, publish: () => 0 });

export function CheckInBeatProvider({ children }: { children: React.ReactNode }) {
  const [beat, setBeat] = useState<Beat | null>(null);
  // Counted in a ref as well as in state so `publish` can hand the number back
  // synchronously; the state update has not landed yet when the caller needs it.
  const count = useRef(0);

  const publish = useCallback((outcome: CheckInOutcome) => {
    const seq = (count.current += 1);
    setBeat({ seq, outcome, signal: signalFor(outcome) });
    return seq;
  }, []);

  const value = useMemo(() => ({ beat, publish }), [beat, publish]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCheckInBeat() {
  return useContext(Context);
}
