
const { milestoneCrossed, describeCheckIn, STREAK_MILESTONES } = await import("@/lib/streak");

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? "  ok  " : "  FAIL", name, ok ? "" : `→ got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const summary = (current, longest = current) => ({ current, longest, lastActivity: null });

console.log("milestones are 7/14/30/60/100:");
eq("list", [...STREAK_MILESTONES], [7, 14, 30, 60, 100]);

console.log("\ncrossing on this write:");
for (const m of [7, 14, 30, 60, 100]) eq(`${m - 1} → ${m}`, milestoneCrossed(m - 1, m), m);

console.log("\nno replay of an earlier day's crossing:");
eq("7 → 8 (crossed 7 yesterday)", milestoneCrossed(7, 8), null);
eq("14 → 15", milestoneCrossed(14, 15), null);
eq("100 → 101", milestoneCrossed(100, 101), null);
eq("31 → 32", milestoneCrossed(31, 32), null);

console.log("\nnon-milestone extensions:");
for (const [a, b] of [[0, 1], [1, 2], [4, 5], [8, 9], [50, 51], [200, 201]])
  eq(`${a} → ${b}`, milestoneCrossed(a, b), null);

console.log("\nsame-day recheck (streak unmoved) never celebrates:");
for (const n of [0, 6, 7, 13, 14, 99, 100]) eq(`${n} → ${n}`, milestoneCrossed(n, n), null);

console.log("\nundo never celebrates, including undoing off a milestone:");
eq("7 → 6", milestoneCrossed(7, 6), null);
eq("100 → 0", milestoneCrossed(100, 0), null);
eq("1 → 0", milestoneCrossed(1, 0), null);

console.log("\nstreak restart after a lapse:");
eq("0 → 1", milestoneCrossed(0, 1), null);
eq("0 → 7 (a recompute jumping straight to 7)", milestoneCrossed(0, 7), 7);

console.log("\nseveral crossed in one update → the highest:");
eq("6 → 14", milestoneCrossed(6, 14), 14);
eq("0 → 100", milestoneCrossed(0, 100), 100);
eq("13 → 61", milestoneCrossed(13, 61), 60);
eq("6 → 30", milestoneCrossed(6, 30), 30);

console.log("\nthreaded through describeCheckIn:");
eq("extended onto 7", describeCheckIn(summary(6), summary(7), true).milestone, 7);
eq("extended onto 7 is kind=extended", describeCheckIn(summary(6), summary(7), true).kind, "extended");
eq("extended onto 8", describeCheckIn(summary(7), summary(8), true).milestone, null);
eq("recorded (same day)", describeCheckIn(summary(7), summary(7), true).milestone, null);
eq("recorded is kind=recorded", describeCheckIn(summary(7), summary(7), true).kind, "recorded");
eq("withdrawn off a milestone", describeCheckIn(summary(7), summary(6), false).milestone, null);
eq("withdrawn is kind=withdrawn", describeCheckIn(summary(7), summary(6), false).kind, "withdrawn");
eq("started at 1", describeCheckIn(summary(0), summary(1), true).milestone, null);
eq("undo→recheck re-crosses (accepted)", describeCheckIn(summary(6), summary(7), true).milestone, 7);

console.log("\nmilestone always implies the streak moved (so the beat points at it):");
let consistent = true;
for (let b = 0; b <= 120; b++)
  for (let a = 0; a <= 120; a++)
    if (milestoneCrossed(b, a) !== null && !(a > b)) consistent = false;
eq("no milestone without after > before", consistent, true);

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
