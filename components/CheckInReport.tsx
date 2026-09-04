import { GlitchText } from "@/components/spiderverse/GlitchText";
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
 *
 * One check-in in a hundred crosses a streak milestone, and that one gets the
 * same line in a louder register rather than a surface of its own — see
 * `MilestoneReport` below.
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

/**
 * A crossed streak milestone, said louder in the same place.
 *
 * **Not a new surface, and deliberately so.** It is the same one line, on the
 * same row, at the same moment — it just stops being a hairline-and-tint and
 * becomes a solid caption box, which is the treatment the comic panel's header
 * and the primary button already use. Nothing appears that was not there for an
 * ordinary check-in, so there is no modal, no toast, no confetti and nothing
 * for the eye to have to dismiss.
 *
 * Yellow because a streak milestone is a *consistency* event, and consistency
 * is yellow throughout the app. Volume milestones are a different signal and
 * are drawn on the terrain in magenta; the two must not borrow each other's
 * colour. See `STREAK_MILESTONES` against `ELEVATION_MILESTONES`.
 *
 * The glitch is allowed here: this is an interface label in the label voice,
 * not body copy and not a name the user typed. Its duplicate layers are
 * `aria-hidden`, so the live region still announces the sentence once.
 *
 * Under reduced motion the box, the colour and the words all remain and only
 * the glitch stops — the celebration is carried by the treatment, never by the
 * movement.
 */
function MilestoneReport({ outcome }: { outcome: CheckInOutcome }) {
  const text = `Checked in · ${outcome.milestone} day streak · milestone${
    outcome.personalBest ? " · longest yet" : ""
  }`;

  return (
    <p
      className="sv-report-in mt-2 ml-9 inline-block px-2 py-1 font-label text-[0.58rem] uppercase leading-relaxed tracking-[0.14em]"
      style={{ background: "var(--streak)", color: "var(--sv-ink)" }}
    >
      <GlitchText
        text={text}
        intensity="subtle"
        trigger="auto"
        blend="normal"
        baseColor="var(--sv-ink)"
      />
    </p>
  );
}

export default function CheckInReport({ outcome }: { outcome: CheckInOutcome }) {
  if (outcome.milestone) return <MilestoneReport outcome={outcome} />;

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
