import type { CheckInOutcome } from "@/lib/streak";

/**
 * What the check-in did, said once, beside the thing that was checked.
 *
 * The tick is the confirmation and it is instant and optimistic. This is the
 * *consequence*, and it deliberately waits for the server, because it quotes
 * real numbers. That gap is the composition: something happened, then what it
 * meant, then the page agreeing with it.
 *
 * Mono uppercase because every number in this app sits in the mono, and a
 * hairline in the outcome's own colour because the same colour is what the
 * header emphasises a moment later — that pairing is what ties a line down here
 * to a numeral up there. Yellow means the streak moved, cyan means the day was
 * already counted, muted means something was taken back. The words say all of
 * it too, so none of it rests on colour.
 */

type Phrase = { text: string; tint: string };

function phrase(outcome: CheckInOutcome): Phrase {
  switch (outcome.kind) {
    case "started":
      return { text: "Checked in · streak started", tint: "var(--streak)" };

    case "extended":
      return {
        text: `Checked in · streak ${outcome.after} days${
          // `personalBest` is also true on the very first check-in ever, where
          // "longest yet" over a one-day streak is noise. `started` handles that
          // case, so saying it only here needs no extra condition.
          outcome.personalBest ? " · longest yet" : ""
        }`,
        tint: "var(--streak)",
      };

    case "recorded":
      return {
        text: `Checked in · day already counted · streak ${outcome.after}`,
        tint: "var(--positive)",
      };

    case "withdrawn":
      return {
        // The numbers separate the two undos: one took the day's last check-in
        // and broke the streak, the other left others standing.
        text:
          outcome.after < outcome.before
            ? "Check-in removed · today no longer counts"
            : "Check-in removed · day still counts",
        tint: "var(--muted)",
      };
  }
}

export default function CheckInReport({ outcome }: { outcome: CheckInOutcome }) {
  const { text, tint } = phrase(outcome);

  return (
    <p
      // Indented past the tick so it reads as annotation on that row rather
      // than as a new item in the list.
      className="sv-report-in mt-2 ml-9 border-l-2 pl-2 font-label text-[0.58rem] uppercase leading-relaxed tracking-[0.14em]"
      style={{ borderColor: tint, color: tint }}
    >
      {text}
    </p>
  );
}
