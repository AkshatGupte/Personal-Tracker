"use client";

import { useCheckInBeat, type BeatSignal } from "@/components/CheckInBeat";

/**
 * One measurement in the track header: mono label, mono numeral.
 *
 * Lifted out of the track page unchanged, plus one thing — it listens for the
 * check-in beat and, if the beat was about *this* measurement, misregisters the
 * numeral for a moment in that outcome's colour.
 *
 * Only ever one stat at a time. A check-in genuinely moves elevation and streak
 * together, and flashing both would put the composed moment straight back into
 * the two-unrelated-reactions state it exists to fix; the beat picks the one the
 * report line is talking about, and the other simply arrives at its new value.
 *
 * The value itself is still the server's — this adds no state and invents no
 * progress. If the emphasis never plays, the number is unchanged and correct,
 * which is also what happens under reduced motion.
 */
export default function TrackStat({
  label,
  value,
  tone,
  signal,
}: {
  label: string;
  value: number;
  tone?: "ember";
  /** Which beat this stat answers to. Omitted means it never flashes. */
  signal?: BeatSignal;
}) {
  const { beat } = useCheckInBeat();
  const mine = signal && beat?.signal === signal ? beat : null;
  /*
    A crossed streak milestone throws the same misregistration harder, rather
    than adding a second kind of emphasis. It can only ever land here: crossing
    requires the streak to have moved, and a moved streak is exactly what makes
    `signalFor` choose the streak signal.
  */
  const milestone = mine?.outcome.milestone ?? null;

  /*
    Where the numeral rests, as both the utility class and the token behind it.
    The two must agree: the beat picks its tint by comparing against the token,
    and the class is what actually paints. Ember marks real achievement, so a
    zero streak stays muted.
  */
  const rest =
    tone === "ember"
      ? value > 0
        ? { cls: "text-streak", token: "var(--streak)" }
        : { cls: "text-muted", token: "var(--muted)" }
      : { cls: "text-fg", token: "var(--fg)" };

  /*
    Rising takes the signal's own colour; a fall is stated, never celebrated.

    Direction has to be read from the signal being shown, not from the streak
    numbers alone. A `recorded` check-in leaves the streak where it was — that
    is what makes it `recorded` — while still raising the elevation, so reading
    the streak's delta here painted a genuine rise in volume as a fall.
  */
  const rose = !mine
    ? false
    : signal === "streak"
      ? mine.outcome.after > mine.outcome.before
      : mine.outcome.kind !== "withdrawn";
  const wanted = !mine
    ? undefined
    : !rose
      ? "var(--muted)"
      : signal === "streak"
        ? "var(--streak)"
        : "var(--accent)";

  /*
    A tint equal to the resting colour says nothing.

    The streak numeral already rests in `streak` yellow whenever it is above
    zero, so tinting it yellow was a measured no-op — the computed colour during
    the beat came back byte-identical to the resting one — and the whole outcome
    was riding on a 3px shift, while elevation got a full paper-to-magenta swing.
    The more meaningful of the two outcomes had the weaker signal.

    So a numeral that already rests on a plate colour swaps to paper instead of
    to itself. Both directions read as the plates momentarily disagreeing, which
    is the registration error the rest of the theme is built on, and paper is
    already the resting colour of the two neighbouring stats — no colour enters
    the palette to make this work. It also fixes the same collision on a streak
    falling to zero, where muted-onto-muted was equally invisible.
  */
  const tint = wanted === rest.token ? "var(--fg)" : wanted;

  return (
    <div>
      <dt className="font-label text-[0.6rem] uppercase tracking-[0.17em] text-muted">
        {label}
      </dt>
      <dd
        /*
          Remounting is what replays the animation: two check-ins in a row are
          two beats with the same shape, and a CSS animation on a surviving
          element would only run for the first.
        */
        key={mine ? `beat-${mine.seq}` : "rest"}
        className={`mt-1.5 font-mono text-3xl font-medium leading-none tracking-tight tabular-nums ${rest.cls}`}
        style={
          mine
            ? {
                ["--beat-tint" as string]: tint,
                // No fill mode, so the 90ms delay leaves the numeral in its
                // resting colour rather than pre-applying the tint.
                animation: milestone
                  ? "sv-beat-milestone 620ms steps(6, end) 90ms"
                  : "sv-beat 300ms steps(3, end) 90ms",
              }
            : undefined
        }
      >
        {value}
      </dd>
    </div>
  );
}
