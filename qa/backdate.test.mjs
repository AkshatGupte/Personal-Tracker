/**
 * Backdating: the window, its edges, and what a write says about the streak.
 *
 * The visible half of this feature fails loudly — a chip that does not
 * highlight, a count that does not move. What does not is the arithmetic
 * underneath: an off-by-one at the far edge of the window silently lets an
 * eighth day through, a future date accepted quietly rewrites tomorrow, and a
 * day key built through UTC lands a whole day early anywhere east of Greenwich,
 * which is a bug this project has already shipped once.
 *
 * Every assertion passes a fixed `now`. A suite that reads the wall clock is a
 * suite that fails on one particular evening and nobody knows why.
 */
const { backdateWindow, canLogOn, describeStreakChange, longDay } = await import(
  "@/lib/backdate"
);
const { BACKDATE_DAYS } = await import("@/lib/windows");
const { dayKey } = await import("@/lib/day");

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(
    ok ? "  ok  " : "  FAIL",
    name,
    ok ? "" : `→ got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`,
  );
};
const ok_ = (name, cond) => eq(name, !!cond, true);

/*
  Tuesday 8 September 2026, late evening local time.

  **The hour is the load-bearing part.** This machine runs at UTC+5:30, so
  21:40 local is 16:10 UTC on the same date — but a `Date` built for local
  midnight of that day is 18:30 UTC on the *seventh*, and `toISOString()` on it
  reads "2026-09-07". Anything in this file that formats a day through UTC
  therefore comes out a day early, and these assertions go red. That is
  deliberate: it is the one bug in this area that has actually reached users.
*/
const NOW = new Date(2026, 8, 8, 21, 40, 0);
const day = (offset) => new Date(2026, 8, 8 - offset);

console.log("the window is today and the six days before it:");
const window = backdateWindow(NOW);
eq("seven days, no more", window.length, 7);
eq("seven days, and BACKDATE_DAYS says so", window.length, BACKDATE_DAYS);
eq("today is first", window[0].key, "2026-09-08");
eq("today is offset 0", window[0].offset, 0);
eq("the last entry is six days back", window[6].key, "2026-09-02");
eq("the last entry is offset 6", window[6].offset, 6);
eq(
  "the keys run backwards with no gaps",
  window.map((d) => d.key),
  [
    "2026-09-08", "2026-09-07", "2026-09-06", "2026-09-05",
    "2026-09-04", "2026-09-03", "2026-09-02",
  ],
);
eq("today reads Today", window[0].label, "Today");
eq("yesterday reads Yesterday", window[1].label, "Yesterday");
eq("older days read weekday and date", window[2].label, "Sun 6");
eq("the band names the day in full", window[2].full, "Sunday 6 September");

/*
  The chip's visible label and its accessible name are different strings, and
  the difference is the point: "Sun 6" has a row of neighbours to be read
  against and a screen reader has none, so the short form is `aria-hidden` and
  `spoken` is announced. Announcing only the date would throw away the relative
  word, which is the more useful half for the two days that have one.
*/
eq("today is spoken with its date", window[0].spoken, "Today, Tuesday 8 September");
eq("yesterday is spoken with its date", window[1].spoken, "Yesterday, Monday 7 September");
eq("older days are spoken in full", window[2].spoken, "Sunday 6 September");
ok_(
  "no chip is announced by its ambiguous short label alone",
  window.every((choice) => choice.offset < 2 || choice.spoken === choice.full),
);
ok_(
  "every spoken name carries the date, so none is ambiguous read aloud",
  window.every((choice) => choice.spoken.includes(choice.full)),
);
ok_(
  "every key round-trips through dayKey — nothing formatted via UTC",
  window.every((choice, offset) => choice.key === dayKey(day(offset))),
);

console.log("\ncrossing a month boundary:");
const october = backdateWindow(new Date(2026, 9, 2, 9, 0, 0));
eq(
  "the window walks back into September rather than to day 0",
  october.map((d) => d.key),
  [
    "2026-10-02", "2026-10-01", "2026-09-30", "2026-09-29",
    "2026-09-28", "2026-09-27", "2026-09-26",
  ],
);
eq("and names the earlier month correctly", october[6].full, "Saturday 26 September");

console.log("\ncrossing a year boundary:");
const january = backdateWindow(new Date(2027, 0, 2, 9, 0, 0));
eq("december is reached, not month -1", january[6].key, "2026-12-27");

console.log("\nthe edges of the window, which is where an off-by-one lives:");
eq("today is loggable", canLogOn("2026-09-08", NOW).ok, true);
eq("yesterday is loggable", canLogOn("2026-09-07", NOW).ok, true);
eq("six days back is the last loggable day", canLogOn("2026-09-02", NOW).ok, true);
eq("six days back reports offset 6", canLogOn("2026-09-02", NOW).offset, 6);
eq("seven days back is refused", canLogOn("2026-09-01", NOW).ok, false);
eq(
  "and says why, in the window's own words",
  canLogOn("2026-09-01", NOW).reason,
  `Activity can only be recorded for the last ${BACKDATE_DAYS} days.`,
);
ok_(
  "every day the strip offers is a day the server accepts",
  backdateWindow(NOW).every((choice) => canLogOn(choice.key, NOW).ok),
);

console.log("\nthe future is not a thing that can be recorded:");
eq("tomorrow is refused", canLogOn("2026-09-09", NOW).ok, false);
eq("tomorrow says so specifically", canLogOn("2026-09-09", NOW).reason, "That day has not happened yet.");
eq("next year is refused", canLogOn("2027-09-08", NOW).ok, false);

console.log("\nrefusing things that are not days at all:");
for (const bad of ["", "today", "2026-9-8", "26-09-08", "2026-09-08T00:00:00", "2026-13-01", "2026-02-31"]) {
  eq(`refuses ${JSON.stringify(bad)}`, canLogOn(bad, NOW).ok, false);
}
eq("a non-string is refused rather than thrown at", canLogOn(undefined, NOW).ok, false);
eq(
  "a real date that is merely out of window is not called invalid",
  canLogOn("2026-09-01", NOW).reason !== "That is not a date.",
  true,
);

console.log("\nthe hour of the day cannot change which days are loggable:");
for (const hour of [0, 5, 12, 18, 23]) {
  const at = new Date(2026, 8, 8, hour, 30, 0);
  eq(`at ${hour}:30, today is 2026-09-08`, backdateWindow(at)[0].key, "2026-09-08");
  eq(`at ${hour}:30, the window still ends 2026-09-02`, backdateWindow(at)[6].key, "2026-09-02");
}

console.log("\nlongDay says a day the way a sentence would:");
eq("a Tuesday", longDay(new Date(2026, 8, 8)), "Tuesday 8 September");
eq("the first of a month, undecorated", longDay(new Date(2026, 0, 1)), "Thursday 1 January");

console.log("\nthe streak consequence is described, in both directions:");
eq("a revived streak says restored", describeStreakChange(0, 12), "Streak restored — 12 days.");
eq("one day is singular", describeStreakChange(0, 1), "Streak restored — 1 day.");
eq("an extended streak states the new figure", describeStreakChange(3, 5), "Streak now 5 days.");
eq("a broken streak says lost", describeStreakChange(12, 0), "Streak lost — was 12 days.");
eq("a shortened streak states the new figure", describeStreakChange(5, 3), "Streak now 3 days.");
eq("no change says nothing at all", describeStreakChange(4, 4), null);
eq("nothing from nothing says nothing", describeStreakChange(0, 0), null);
ok_(
  "nothing here celebrates — no XP, no exclamation, no milestone word",
  [describeStreakChange(0, 12), describeStreakChange(3, 5), describeStreakChange(12, 0)].every(
    (line) => !/xp|!|milestone|congrat/i.test(line),
  ),
);

console.log(fails === 0 ? "\nall assertions passed" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
