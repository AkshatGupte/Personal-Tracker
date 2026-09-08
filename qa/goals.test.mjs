/**
 * Goal rules: the ones that can be got wrong silently.
 *
 * The visible half of this feature — a bar, a percentage, a card — fails loudly
 * and in front of you. What does not is the reward logic: an XP award that pays
 * twice, a milestone that re-fires on a decrease and re-cross, a momentum band
 * that flips on a single unit, an expiry that never arrives because nothing runs
 * at midnight. Those are what is asserted here.
 */
const {
  GOAL_MILESTONES, GOAL_XP, displayStatus, expectedProgress, goalPercent,
  milestonesCrossed, momentumOf, progressXp, remainingCopy, deadlineUrgency,
  summariseGoals,
} = await import("@/lib/goals");

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? "  ok  " : "  FAIL", name, ok ? "" : `→ got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const ok_ = (name, cond) => eq(name, !!cond, true);

const TODAY = new Date("2026-09-08T12:00:00");
const day = (n) => new Date(TODAY.getTime() + n * 86400000);
/** A ten-day goal for 50, started five days ago — the brief's own example. */
const goal = (over = {}) => ({
  target: 50, currentProgress: 0, startDate: day(-5), deadline: day(5),
  status: "active", completedAt: null, ...over,
});

console.log("expiry is derived, not stored:");
eq("a live deadline is active", displayStatus(goal(), TODAY), "active");
eq("yesterday's deadline is expired", displayStatus(goal({ deadline: day(-1) }), TODAY), "expired");
eq("today's deadline is still active", displayStatus(goal({ deadline: day(0) }), TODAY), "active");
eq("completed outranks expiry", displayStatus(goal({ deadline: day(-9), status: "completed" }), TODAY), "completed");
eq("archived outranks expiry", displayStatus(goal({ deadline: day(-9), status: "archived" }), TODAY), "archived");
ok_(
  "moving the deadline forward un-expires it, with nothing to migrate",
  displayStatus(goal({ deadline: day(-1) }), TODAY) === "expired" &&
    displayStatus(goal({ deadline: day(3) }), TODAY) === "active",
);

console.log("\nmomentum is measured against the deadline:");
eq("half way through, 25 of 50 expected", expectedProgress(goal(), TODAY), 25);
eq("the brief's example: 37 of an expected 25", momentumOf(goal({ currentProgress: 37 }), TODAY), "ahead");
eq("the brief's example: 12 of an expected 25", momentumOf(goal({ currentProgress: 12 }), TODAY), "behind");
eq("dead on the line is on track", momentumOf(goal({ currentProgress: 25 }), TODAY), "onTrack");
eq("a long way behind is critical", momentumOf(goal({ currentProgress: 4 }), TODAY), "critical");
eq("an expired goal reports expiry, not lateness", momentumOf(goal({ currentProgress: 4, deadline: day(-1) }), TODAY), "expired");
eq("a completed goal reports completion", momentumOf(goal({ currentProgress: 50, status: "completed" }), TODAY), "complete");

/*
  The anti-flicker requirement, stated as a sweep rather than an example: one
  unit either side of the expected line must not change the reading.
*/
let flipped = false;
for (let n = 23; n <= 27; n++) {
  if (momentumOf(goal({ currentProgress: n }), TODAY) !== "onTrack") flipped = true;
}
ok_("a single unit either side of expectation never changes the band", !flipped);

console.log("\nday one does not accuse you of being behind:");
const fresh = { ...goal(), startDate: day(0), deadline: day(9) };
eq("untouched on day one is on track", momentumOf(fresh, TODAY), "onTrack");
eq("...and any progress on day one is ahead", momentumOf({ ...fresh, currentProgress: 1 }, TODAY), "ahead");

console.log("\nXP is paid for new ground only — the anti-farming rule:");
eq("first climb to 38 pays", progressXp(37, 38), GOAL_XP.progress);
eq("dropping back to 37 pays nothing", progressXp(38, 37), 0);
eq("re-climbing to 38 pays nothing", progressXp(38, 38), 0);
eq("going past the old high pays again", progressXp(38, 39), GOAL_XP.progress);
let farmed = 0;
let high = 37;
for (const value of [38, 37, 38, 37, 38, 37, 38]) {
  farmed += progressXp(high, value);
  high = Math.max(high, value);
}
eq("37→38 seven times over pays exactly once", farmed, GOAL_XP.progress);

console.log("\nmilestones cross once, ever:");
eq("passing 25% awards 25", milestonesCrossed(50, 12, 13, []), [25]);
eq("a big jump awards every one it passed", milestonesCrossed(50, 0, 40, []), [25, 50, 75]);
eq("landing exactly on target awards the rest", milestonesCrossed(50, 40, 50, [25, 50, 75]), [100]);
eq("already-banked ones are not re-awarded", milestonesCrossed(50, 40, 50, [25, 50, 75, 100]), []);
eq("a decrease awards nothing", milestonesCrossed(50, 40, 10, [25, 50, 75]), []);
eq("re-crossing ground already covered awards nothing", milestonesCrossed(50, 40, 38, [25, 50, 75]), []);
eq("overshooting the target does not award 100 twice", milestonesCrossed(50, 55, 60, [25, 50, 75, 100]), []);
eq("a zero target cannot divide by zero", milestonesCrossed(0, 0, 5, []), []);
eq("100 pays the completion award", GOAL_XP.milestone[100], 200);
eq("and the ladder is the four in the brief", [...GOAL_MILESTONES], [25, 50, 75, 100]);

console.log("\nedge cases from the brief:");
eq("progress exactly on target is 100%", goalPercent(goal({ currentProgress: 50 })), 100);
eq("progress past target still reads 100%", goalPercent(goal({ currentProgress: 71 })), 100);
eq("zero progress is 0%, not NaN", goalPercent(goal()), 0);
eq("a zero target is 0%, not Infinity", goalPercent(goal({ target: 0, currentProgress: 3 })), 0);
eq("deadline today reads as today", remainingCopy(goal({ deadline: day(0) }), TODAY), "Due today");
eq("one day left is singular", remainingCopy(goal({ deadline: day(1) }), TODAY), "1 day left");
eq("a passed deadline counts backwards", remainingCopy(goal({ deadline: day(-3) }), TODAY), "3 days ago");
/* A one-day goal: start and deadline the same day. The span is zero, and the
   naive expected-progress division is the classic crash here. */
const sameDay = goal({ startDate: day(0), deadline: day(0) });
eq("a same-day goal expects its whole target", expectedProgress(sameDay, TODAY), 50);
ok_("...and does not produce NaN urgency", Number.isFinite(deadlineUrgency(sameDay, TODAY)));

console.log("\nurgency climbs as the deadline closes:");
const urgencies = [5, 3, 1, 0].map((d) => deadlineUrgency(goal({ deadline: day(d) }), TODAY));
ok_("it rises monotonically", urgencies.every((u, i) => i === 0 || u >= urgencies[i - 1]));
eq("and is zero for anything not active", deadlineUrgency(goal({ status: "completed" }), TODAY), 0);

console.log("\nthe dashboard figures:");
const row = (over) => ({
  id: Math.random().toString(36), title: "t", category: "DSA", unit: "u", description: null,
  cadence: "custom", createdAt: day(-10), highWater: 0, milestones: [], xp: 0, ...goal(), ...over,
});
const board = [
  ...Array.from({ length: 8 }, () => row({ status: "completed", completedAt: day(-1), currentProgress: 50 })),
  ...Array.from({ length: 3 }, () => row({ currentProgress: 10 })),
  row({ deadline: day(-2), currentProgress: 5 }),
];
const stats = summariseGoals(board, TODAY);
eq("the brief's worked example: 12 total", stats.total, 12);
eq("8 completed", stats.completed, 8);
eq("3 active", stats.active, 3);
eq("1 expired", stats.expired, 1);
eq("67% completion rate", stats.completionRate, 67);
const withArchived = summariseGoals([...board, row({ status: "archived" })], TODAY);
eq("archiving a goal does not change the rate", withArchived.completionRate, 67);
eq("...and is counted separately", withArchived.archived, 1);
eq("an empty board is 0%, not NaN", summariseGoals([], TODAY).completionRate, 0);
eq("category performance is reported", stats.byCategory[0].category, "DSA");

console.log(fails ? `\n${fails} FAILURE(S)` : "\nALL PASS");
process.exit(fails ? 1 : 0);
