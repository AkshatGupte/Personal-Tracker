/**
 * The weekly review and Today: the judgements, not the figures.
 *
 * **Only the genuinely new behaviour is asserted here.** Every number these two
 * screens show comes from a read that already existed and is already covered —
 * `tree.test.mjs` for coverage, `period-buckets.test.mjs` for the week window,
 * `goals.test.mjs` for momentum and expiry, `goal-series.test.mjs` for periods.
 * What is new is the *synthesis*: whether a streak is renewed, what to do next
 * and in what order, and whether a partial week is allowed to claim a decline.
 *
 * Every assertion passes a fixed `now`.
 */
const { streakState, STREAK_STATE_COPY } = await import("@/lib/streak");
const { buildFocus, goalPeriodsInWeek, reviewHeadline, todayHeadline, weekMomentum, windowFrom } =
  await import("@/lib/review");

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

/** Wednesday 9 September 2026, late evening — the UTC-offset trap again. */
const NOW = new Date(2026, 8, 9, 21, 40, 0);
const d = (day) => new Date(2026, 8, day);

console.log("streakState — a description of a streak, never a change to one:");
const summary = (lastDay, current) => ({
  current,
  longest: Math.max(current, 1),
  lastActivity: lastDay === null ? null : d(lastDay),
});

eq("worked today is held", streakState(summary(9, 4), NOW), "held");
eq("worked yesterday with a live run is at risk", streakState(summary(8, 4), NOW), "atRisk");
eq("worked two days ago has lapsed", streakState(summary(7, 0), NOW), "lapsed");
eq("no history at all is none", streakState(summary(null, 0), NOW), "none");
/*
  The boundary that matters: today *and* yesterday both worked is `held`, not
  `atRisk`. A version keyed on "was yesterday worked" rather than on the most
  recent day would offer to renew a streak that is already renewed, which is the
  one thing this screen must never do.
*/
eq("today and yesterday both worked is held, not at risk", streakState(summary(9, 12), NOW), "held");
eq("a single day of history, today", streakState(summary(9, 1), NOW), "held");
eq("a single day of history, yesterday", streakState(summary(8, 1), NOW), "atRisk");
/*
  `lastActivity` set but `current` zero is a real state, not a hypothetical: a
  node worked yesterday that has since gained children or been deleted leaves
  history behind while contributing nothing to the run. Calling that "at risk"
  would offer to renew a streak that does not exist.
*/
eq("yesterday's activity with a dead run is lapsed, not at risk", streakState(summary(8, 0), NOW), "lapsed");
eq("a week ago is lapsed", streakState(summary(2, 0), NOW), "lapsed");
ok_(
  "the hour of the day cannot change the answer",
  [0, 6, 12, 23].every((h) => streakState(summary(9, 3), new Date(2026, 8, 9, h, 30)) === "held"),
);
ok_(
  "every state has words, so nothing is carried by colour alone",
  ["held", "atRisk", "lapsed", "none"].every((s) => (STREAK_STATE_COPY[s] ?? "").length > 0),
);

console.log("\nweekMomentum refuses to claim a fall on a partial week:");
const period = (completed, elapsedDays) => ({
  key: "k", start: d(1), endExclusive: d(8), completed, activeDays: 1, elapsedDays, isCurrent: true,
});

/*
  The bug this exists to prevent: three days measured against a full seven always
  looks like a decline, so a naive comparison reports "down" every Monday of a
  perfectly good week. That is an artefact of when you looked, not a signal.
*/
eq("3 so far against last week's 20, mid-week, claims nothing", weekMomentum([period(20, 7), period(3, 3)]).direction, "partial");
eq("and says both figures instead", weekMomentum([period(20, 7), period(3, 3)]).sentence, "3 activities so far, 3 days in. Last week: 20.");
eq("the same shortfall on a COMPLETE week is a real decline", weekMomentum([period(20, 7), period(3, 7)]).direction, "down");
eq("already past last week is 'up' even mid-week", weekMomentum([period(5, 7), period(9, 3)]).direction, "up");
eq("level on a complete week is flat", weekMomentum([period(8, 7), period(8, 7)]).direction, "flat");
eq("level mid-week claims nothing", weekMomentum([period(8, 7), period(8, 4)]).direction, "partial");
eq("no previous week at all", weekMomentum([period(4, 3)]).direction, "first");
eq("two empty weeks are flat, not a decline", weekMomentum([period(0, 7), period(0, 3)]).direction, "flat");
eq("an empty week says so plainly", weekMomentum([period(0, 7), period(0, 3)]).sentence, "Nothing recorded this week yet.");
eq("one activity is singular", weekMomentum([period(0, 7), period(1, 3)]).sentence, "1 activity this week, past last week's 0.");

console.log("\nbuildFocus ranks by what expires soonest, not by size:");
const track = (over = {}) => ({
  id: "t1", name: "DSA", streak: 4, streakState: "held",
  workedToday: 1, leafCount: 5, weekActivities: 3, weekActiveDays: 2, everActive: true, ...over,
});
const goal = (over = {}) => ({
  id: "g1", title: "50 problems", category: "DSA", unit: "problems",
  target: 50, current: 10, percent: 20, display: "active", momentum: "onTrack",
  daysLeft: 4, linked: false, sourceLabel: null, trackId: null,
  seriesId: null, period: null, series: null, ...over,
});
const kinds = (items) => items.map((i) => i.kind);

eq("a healthy track and an on-track goal need nothing", kinds(buildFocus([track()], [goal()])), []);
eq(
  "a streak that dies tonight outranks a goal due today",
  kinds(buildFocus([track({ streakState: "atRisk" })], [goal({ daysLeft: 0 })])),
  ["renewStreak", "goalDueToday"],
);
eq(
  "due today outranks critical, which outranks merely behind",
  kinds(
    buildFocus([], [
      goal({ id: "a", momentum: "behind" }),
      goal({ id: "b", momentum: "critical" }),
      goal({ id: "c", daysLeft: 0 }),
    ]),
  ),
  ["goalDueToday", "goalCritical", "goalBehind"],
);
eq(
  "an untouched track ranks below every goal in trouble",
  kinds(buildFocus([track({ weekActivities: 0 })], [goal({ momentum: "critical" })])),
  ["goalCritical", "trackUntouched"],
);
eq(
  "a never-worked track is last, and says why",
  buildFocus([track({ everActive: false, weekActivities: 0, streakState: "none", leafCount: 0 })], [])[0],
  {
    kind: "startTracking",
    action: "Work DSA for the first time",
    why: "it has no topics yet",
    href: "/tracks/t1",
    weight: 60,
    tone: "muted",
  },
);
/*
  A track cannot appear twice. An at-risk streak already implies nothing was
  recorded today, and listing "renew this" beside "pick something up in this"
  would be the same instruction twice.
*/
eq(
  "an at-risk track is listed once, not also as untouched",
  kinds(buildFocus([track({ streakState: "atRisk", weekActivities: 0 })], [])),
  ["renewStreak"],
);
/*
  A longer run has more to lose, and it is the only tie-break with meaning.

  **The names are chosen so that alphabetical order contradicts streak order.**
  A first version used a 40-day "DSA" and a 2-day "Spanish", which sorts
  correctly either way — the final `localeCompare` tie-break put DSA first
  regardless of weight, so flattening the weight to a constant still passed and
  the assertion proved nothing. Here the longer streak is the alphabetically
  *later* name, so only the weight can produce this order.
*/
eq(
  "among at-risk streaks the longer run comes first",
  buildFocus(
    [
      track({ id: "small", name: "Algorithms", streakState: "atRisk", streak: 2 }),
      track({ id: "big", name: "Zoology", streakState: "atRisk", streak: 40 }),
    ],
    [],
  ).map((i) => i.action),
  ["Work Zoology", "Work Algorithms"],
);
/*
  **These fixtures are deliberately ones that *would* produce an item if the
  status guard were removed.** A first version used an on-track goal four days
  out, which falls through every branch anyway — so deleting the guard changed
  nothing and the assertion was vacuous. One is due today and the other is
  critical, so only the guard can keep the list empty.
*/
eq(
  "expired and completed goals are never actions, however urgent they look",
  kinds(
    buildFocus([], [
      goal({ id: "e", display: "expired", daysLeft: 0 }),
      goal({ id: "c", display: "completed", momentum: "critical" }),
      goal({ id: "a", display: "archived", daysLeft: 0 }),
    ]),
  ),
  [],
);
eq(
  "a linked goal sends you to its track, not to /goals",
  buildFocus([], [goal({ daysLeft: 0, linked: true, trackId: "tk9" })])[0].href,
  "/tracks/tk9",
);
eq(
  "a manual goal sends you to /goals",
  buildFocus([], [goal({ daysLeft: 0, linked: false })])[0].href,
  "/goals",
);
/*
  **The units are user-supplied free text**, so nothing here can singularise
  "papers" or "hours". A first version read "1 papers to go" on a goal one unit
  short, and it reached a screenshot before anyone noticed because the suite said
  nothing about the phrasing. The number is now placed where a plural noun is
  correct whatever the remainder is.
*/
eq(
  "a remainder of one is still grammatical",
  buildFocus([], [goal({ daysLeft: 0, target: 3, current: 2, unit: "papers" })])[0].why,
  "due today — 1 of 3 papers left",
);
ok_(
  "no reason reads '1 <plural>' anywhere",
  buildFocus([], [
    goal({ id: "a", daysLeft: 0, target: 3, current: 2, unit: "papers" }),
    goal({ id: "b", momentum: "critical", target: 10, current: 9, unit: "hours" }),
    goal({ id: "c", momentum: "behind", target: 2, current: 1, unit: "books" }),
  ]).every((i) => !/\b1 (papers|hours|books|problems)\b/.test(i.why)),
);
ok_(
  "every item states its reason in words",
  buildFocus(
    [track({ streakState: "atRisk" }), track({ id: "t2", name: "X", weekActivities: 0 })],
    [goal({ daysLeft: 0 })],
  ).every((i) => i.why.length > 0 && i.action.length > 0),
);
ok_(
  "nothing is red, and nothing scolds",
  buildFocus(
    [track({ streakState: "atRisk" }), track({ id: "t2", name: "X", weekActivities: 0 })],
    [goal({ momentum: "critical" })],
  ).every((i) => ["streak", "accent", "positive", "muted"].includes(i.tone)),
);

console.log("\ngoal periods are windowed by the week the review names:");
const win = windowFrom({ start: d(7), endExclusive: d(14) });
eq("the window is printed as a span", win.label, "Mon 7 – Sun 13 Sep");
eq(
  "a window crossing a month names both",
  windowFrom({ start: new Date(2026, 8, 28), endExclusive: new Date(2026, 9, 5) }).label,
  "Mon 28 Sep – Sun 4 Oct",
);

const row = (over = {}) => ({
  id: "x", title: "weekly", category: "DSA", unit: "problems", description: null,
  cadence: "weekly", target: 5, currentProgress: 0, highWater: 0,
  startDate: d(7), deadline: d(13), status: "active", createdAt: d(7), completedAt: null,
  milestones: [], xp: 0, trackId: null, topicId: null, source: null,
  seriesId: null, period: null, series: null, ...over,
});

const inWeek = goalPeriodsInWeek(
  [
    row({ id: "met", status: "completed", currentProgress: 5, completedAt: d(9) }),
    row({ id: "missed", deadline: d(8) }),
    row({ id: "open", deadline: d(13) }),
    row({ id: "before", deadline: d(6), status: "completed" }),
    row({ id: "after", deadline: d(20) }),
    row({ id: "archived", status: "archived" }),
  ],
  win,
  NOW,
);
eq("met this week", inWeek.met.map((g) => g.id), ["met"]);
eq("missed this week", inWeek.missed.map((g) => g.id), ["missed"]);
eq("still open this week", inWeek.open.map((g) => g.id), ["open"]);
ok_(
  "a period due before or after the window is excluded",
  !JSON.stringify(inWeek).includes('"before"') && !JSON.stringify(inWeek).includes('"after"'),
);
ok_("archived periods are excluded", !JSON.stringify(inWeek).includes('"archived"'));

/*
  Recurring goals need no special case, and this asserts it: three periods of one
  series with different deadlines land in the window that contains each, and the
  series figures ride along on the row rather than being recomputed.
*/
const series = { total: 3, met: 2, streak: 2 };
const seriesWeek = goalPeriodsInWeek(
  [
    row({ id: "p1", seriesId: "s", period: 1, series, deadline: d(6), status: "completed" }),
    row({ id: "p2", seriesId: "s", period: 2, series, deadline: d(13), status: "completed", currentProgress: 5 }),
    row({ id: "p3", seriesId: "s", period: 3, series, deadline: d(20) }),
  ],
  win,
  NOW,
);
eq("exactly the period whose deadline falls in this week", seriesWeek.met.map((g) => g.id), ["p2"]);
eq("and it carries the series record untouched", seriesWeek.met[0].series, series);
eq("and its place in the series", seriesWeek.met[0].period, 2);

console.log("\nheadlines are sentences, never scores:");
eq("an empty week", reviewHeadline(weekMomentum([period(0, 7), period(0, 3)]), 0, 0), "Nothing recorded this week. It starts whenever you do.");
eq(
  "a good week",
  reviewHeadline(weekMomentum([period(5, 7), period(9, 3)]), 2, 1),
  "9 activities this week, past last week's 5. Across 2 tracks. 1 goal met.",
);
eq("today with streaks to renew leads on them", todayHeadline(0, 2), "2 streaks still to renew today.");
eq("one streak is singular", todayHeadline(0, 1), "1 streak still to renew today.");
eq("today with nothing yet", todayHeadline(0, 0), "Nothing recorded today yet.");
eq("today with work done", todayHeadline(3, 0), "3 activities recorded today.");
ok_(
  "no headline grades, scores or scolds",
  [
    reviewHeadline(weekMomentum([period(0, 7), period(0, 3)]), 0, 0),
    reviewHeadline(weekMomentum([period(20, 7), period(3, 7)]), 1, 0),
    todayHeadline(0, 0),
  ].every((line) => !/xp|score|%|grade|fail|should have|only/i.test(line)),
);

console.log(fails === 0 ? "\nall assertions passed" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
