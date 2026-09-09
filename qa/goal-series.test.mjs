/**
 * Recurring goals: the period arithmetic, and the properties a reset would break.
 *
 * The visible half fails loudly — a checkbox that does nothing, a card with no
 * period number. What does not is the arithmetic that decides *which rows should
 * exist*: a period that overlaps its predecessor would let one activity advance
 * two members of the same series, a skipped missed period would quietly delete a
 * miss and flatter the completion rate, and a zero or negative span would spin a
 * loop that writes rows inside a request.
 *
 * Every assertion passes a fixed `now`.
 */
const {
  MAX_ROLL_FORWARD, describeCadence, missedPeriods, nextPeriod, periodIndex,
  periodSpan, summariseSeries,
} = await import("@/lib/goalSeries");
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

const d = (y, m, day) => new Date(y, m - 1, day);
const keys = (windows) => windows.map((w) => `${dayKey(w.startDate)}..${dayKey(w.deadline)}`);

/** A weekly window as `deadlineFor` writes one: start + 6 days. */
const week = (from) => ({ startDate: from, deadline: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6) });

console.log("a period's span, as the cadences actually write them:");
eq("weekly is 6 days end to end", periodSpan(week(d(2026, 9, 7))), 6);
eq("monthly is 29", periodSpan({ startDate: d(2026, 9, 1), deadline: d(2026, 9, 30) }), 29);
eq("a single-day goal is 0", periodSpan({ startDate: d(2026, 9, 9), deadline: d(2026, 9, 9) }), 0);
/*
  Clamped rather than trusted. `createGoal` refuses a deadline before its start,
  so this should be unreachable — but the span drives the roll-forward loop, and
  a negative one would walk backwards forever.
*/
eq("a reversed window is clamped, not negative", periodSpan({ startDate: d(2026, 9, 9), deadline: d(2026, 9, 2) }), 0);

console.log("\nthe next period abuts the last — no overlap, no gap:");
const first = week(d(2026, 9, 7));
const second = nextPeriod(first);
eq("it starts the day after the deadline", dayKey(second.startDate), "2026-09-14");
eq("and keeps the same length", dayKey(second.deadline), "2026-09-20");
eq("the span is preserved exactly", periodSpan(second), periodSpan(first));
/*
  The no-overlap property is load-bearing for Feature A: two overlapping periods
  of one series would both match the same recorded day and both advance from one
  activity. Asserted as a property over a long run rather than on one example.
*/
let cursor = first;
let overlapped = false;
let gapped = false;
for (let i = 0; i < 60; i++) {
  const next = nextPeriod(cursor);
  if (next.startDate <= cursor.deadline) overlapped = true;
  if ((next.startDate - cursor.deadline) / 86400000 !== 1) gapped = true;
  cursor = next;
}
ok_("60 consecutive periods never overlap", !overlapped);
ok_("60 consecutive periods leave no gap", !gapped);

console.log("\nevery missed period is created, not skipped:");
/*
  The owner's decision, and the reason this file exists. Away for three weeks
  from a weekly goal leaves three rows that expire unmet, so the completion rate
  keeps describing what happened. Jumping to the current window would delete
  three misses.
*/
eq(
  "three weeks away produces three periods, ending with today's",
  keys(missedPeriods(week(d(2026, 9, 7)), d(2026, 10, 1))),
  ["2026-09-14..2026-09-20", "2026-09-21..2026-09-27", "2026-09-28..2026-10-04"],
);
ok_(
  "the last one contains today",
  (() => {
    const all = missedPeriods(week(d(2026, 9, 7)), d(2026, 10, 1));
    const last = all[all.length - 1];
    return last.startDate <= d(2026, 10, 1) && d(2026, 10, 1) <= last.deadline;
  })(),
);
eq("a window still open rolls nothing", missedPeriods(week(d(2026, 9, 7)), d(2026, 9, 10)).length, 0);
eq("its own last day rolls nothing", missedPeriods(week(d(2026, 9, 7)), d(2026, 9, 13)).length, 0);
eq("the day after it closes rolls exactly one", keys(missedPeriods(week(d(2026, 9, 7)), d(2026, 9, 14))), ["2026-09-14..2026-09-20"]);
eq("a future newest rolls nothing", missedPeriods(week(d(2026, 12, 1)), d(2026, 9, 9)).length, 0);

console.log("\nperiods walk across month and year boundaries:");
eq(
  "a weekly series crosses into October",
  keys(missedPeriods(week(d(2026, 9, 21)), d(2026, 10, 6))),
  ["2026-09-28..2026-10-04", "2026-10-05..2026-10-11"],
);
eq(
  "and across the new year",
  keys(missedPeriods(week(d(2026, 12, 21)), d(2027, 1, 2))),
  ["2026-12-28..2027-01-03"],
);
eq(
  "a monthly period does not overflow a short month",
  keys(missedPeriods({ startDate: d(2026, 1, 31), deadline: d(2026, 3, 1) }, d(2026, 4, 5))),
  ["2026-03-02..2026-03-31", "2026-04-01..2026-04-30"],
);

console.log("\nthe loop is bounded, so a bad span cannot spin inside a request:");
const ancient = missedPeriods(week(d(2000, 1, 1)), d(2026, 9, 9));
eq("a 26-year-old weekly series stops at the cap", ancient.length, MAX_ROLL_FORWARD);
ok_("and the cap is finite", Number.isFinite(MAX_ROLL_FORWARD) && MAX_ROLL_FORWARD > 0);
/*
  A single-day goal advances one day per period, which is the fastest a series
  can accumulate rows — the tightest test of the bound.
*/
eq(
  "a single-day goal left for ten years also stops at the cap",
  missedPeriods({ startDate: d(2016, 1, 1), deadline: d(2016, 1, 1) }, d(2026, 9, 9)).length,
  MAX_ROLL_FORWARD,
);

console.log("\nhow a series has actually gone, derived from its rows:");
const member = (seriesId, day, status) => ({ seriesId, startDate: d(2026, 9, day), status });
const run = (members) => summariseSeries(members).get("s1");

eq(
  "four periods, three met",
  run([
    member("s1", 1, "completed"),
    member("s1", 8, "completed"),
    member("s1", 15, "active"),
    member("s1", 22, "completed"),
  ]),
  { total: 4, met: 3, streak: 1 },
);
/*
  The streak counts back from the most recent *finished* period. The current one
  is usually still in flight, and treating "not completed yet" as a break would
  report a healthy run as zero on six days out of seven.
*/
eq(
  "the unfinished current period does not break the run",
  run([member("s1", 1, "completed"), member("s1", 8, "completed"), member("s1", 15, "active")]),
  { total: 3, met: 2, streak: 2 },
);
eq(
  "a missed period does break it",
  run([member("s1", 1, "completed"), member("s1", 8, "active"), member("s1", 15, "active")]),
  { total: 3, met: 1, streak: 0 },
);
eq(
  "archiving a period breaks the run rather than repairing it",
  run([member("s1", 1, "completed"), member("s1", 8, "archived"), member("s1", 15, "completed")]),
  { total: 3, met: 2, streak: 1 },
);
eq("a brand new series", run([member("s1", 1, "active")]), { total: 1, met: 0, streak: 0 });
eq("one-off goals are not a series", summariseSeries([member(null, 1, "completed")]).size, 0);
ok_(
  "two series do not contaminate each other",
  (() => {
    const map = summariseSeries([
      member("s1", 1, "completed"),
      { seriesId: "s2", startDate: d(2026, 9, 1), status: "active" },
    ]);
    return map.get("s1").met === 1 && map.get("s2").met === 0;
  })(),
);
/*
  Order in the input must not matter — rows come back from the database in
  whatever order the query gives, and the streak is a question about sequence.

  **The input here is chosen so that dropping the sort actually changes the
  answer.** A first version of this assertion used
  `[15/active, 1/completed, 8/completed]`, which walks back to a streak of 2
  whether or not it is sorted — so it passed with the sort removed and asserted
  nothing. This ordering gives 2 sorted and 1 unsorted: the unfinished period
  lands in the middle, where the "skip the newest if unfinished" rule cannot see
  it and the walk stops early.
*/
eq(
  "the answer does not depend on row order",
  run([member("s1", 8, "completed"), member("s1", 15, "active"), member("s1", 1, "completed")]),
  { total: 3, met: 2, streak: 2 },
);

console.log("\nwhich period a row is:");
const members = [member("s1", 1, "completed"), member("s1", 8, "completed"), member("s1", 15, "active")];
eq("the first", periodIndex(members, "s1", d(2026, 9, 1)), 1);
eq("the second", periodIndex(members, "s1", d(2026, 9, 8)), 2);
eq("the third", periodIndex(members, "s1", d(2026, 9, 15)), 3);
eq("never zero, even for a row not in the list", periodIndex(members, "s1", d(2020, 1, 1)), 1);

console.log("\nthe cadence in words:");
eq("weekly", describeCadence("weekly", week(d(2026, 9, 7))), "Repeats weekly");
eq("monthly", describeCadence("monthly", { startDate: d(2026, 9, 1), deadline: d(2026, 9, 30) }), "Repeats monthly");
eq("a custom span says its length", describeCadence("custom", { startDate: d(2026, 9, 1), deadline: d(2026, 9, 12) }), "Repeats every 12 days");
eq("a one-day custom span is singular", describeCadence("custom", { startDate: d(2026, 9, 1), deadline: d(2026, 9, 1) }), "Repeats every 1 day");

console.log(fails === 0 ? "\nall assertions passed" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
