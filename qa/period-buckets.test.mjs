// Month bucketing, checked against the cases that break naive month maths.
const { startOfMonth } = await import("@/lib/day");
const { monthBuckets, weekBuckets } = await import("@/lib/rollup");

let fails = 0;
const eq = (name, got, want) => {
  const ok = got === want;
  if (!ok) fails++;
  console.log(ok ? "  ok  " : "  FAIL", name, ok ? "" : `\n        got  ${got}\n        want ${want}`);
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

console.log("startOfMonth never overflows a short month:");
// 31 Jan + 1 month is the classic setMonth bug: it lands on 2 or 3 March.
eq("31 Jan 2026 +1", iso(startOfMonth(new Date(2026, 0, 31), 1)), "2026-02-01");
eq("31 Mar 2026 +1", iso(startOfMonth(new Date(2026, 2, 31), 1)), "2026-04-01");
eq("31 Dec 2026 +1 crosses the year", iso(startOfMonth(new Date(2026, 11, 31), 1)), "2027-01-01");
eq("1 Jan 2026 -1 crosses back", iso(startOfMonth(new Date(2026, 0, 1), -1)), "2025-12-01");

console.log("\nmonthBuckets:");
const six = monthBuckets(6, new Date(2026, 8, 4)); // 4 Sep 2026
eq("count", six.length, 6);
eq("oldest starts Apr", iso(six[0].start), "2026-04-01");
eq("newest starts Sep", iso(six[5].start), "2026-09-01");
eq("newest ends 1 Oct", iso(six[5].endExclusive), "2026-10-01");
eq("Feb 2024 is 29 days (leap)", (() => {
  const [feb] = monthBuckets(1, new Date(2024, 1, 15));
  return Math.round((feb.endExclusive - feb.start) / 86400000);
})(), 29);
eq("Feb 2026 is 28 days", (() => {
  const [feb] = monthBuckets(1, new Date(2026, 1, 15));
  return Math.round((feb.endExclusive - feb.start) / 86400000);
})(), 28);

console.log("\nbuckets are contiguous and non-overlapping:");
const twelve = monthBuckets(12, new Date(2026, 8, 4));
let contiguous = true;
for (let i = 1; i < twelve.length; i++)
  if (twelve[i].start.getTime() !== twelve[i - 1].endExclusive.getTime()) contiguous = false;
eq("each month starts where the last ended", contiguous, true);
eq("12 back crosses the year", iso(twelve[0].start), "2025-10-01");

console.log("\nweeks are untouched:");
const w = weekBuckets(8, new Date(2026, 8, 4));
eq("count", w.length, 8);
eq("current week starts Monday", w[7].start.getDay(), 1);
eq("week is 7 days", Math.round((w[7].endExclusive - w[7].start) / 86400000), 7);

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
