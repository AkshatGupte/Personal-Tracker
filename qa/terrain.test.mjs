/**
 * Elevation: the headline numeral is cumulative and does not fall with time.
 *
 * `CLAUDE.md` says elevation is cumulative and only rises. It was
 * `Terrain.windowTotal` — the total *inside the terrain window* — so with
 * `TERRAIN_DAYS = 14` it dropped as activity aged past a fortnight, and a
 * fortnight away from the app took it to zero. These are the properties the fix
 * has to hold, written so the old behaviour fails them.
 *
 * The terrain drawing keeps its window on purpose (see `lib/windows.ts`), so
 * the window's behaviour is asserted here too — the point of the fix is that
 * the two figures are now separate, not that the window went away.
 */
const { buildTerrain, cumulativeElevation, nextMilestone, ELEVATION_MILESTONES } =
  await import("@/lib/terrain");
const { TERRAIN_DAYS } = await import("@/lib/windows");

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? "  ok  " : "  FAIL", name, ok ? "" : `→ got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const ok_ = (name, cond) => eq(name, !!cond, true);

/** A fixed "today" so nothing here depends on when it is run. */
const TODAY = new Date("2026-09-06T12:00:00Z");
const daysAgo = (n) => new Date(TODAY.getTime() - n * 86400000);
const log = (n, count) => ({ date: daysAgo(n), count });

console.log("the numeral is the whole history:");
eq("nothing recorded is 0, not NaN", cumulativeElevation([]), 0);
eq("one day", cumulativeElevation([log(0, 3)]), 3);
eq("sums every day", cumulativeElevation([log(0, 3), log(5, 2), log(400, 7)]), 12);
eq(
  "several rows on one day are volume, not one",
  cumulativeElevation([log(2, 1), log(2, 1), log(2, 1)]),
  3,
);

/*
  The regression itself.

  A day just inside the window and a day just outside it. The windowed total
  sees one; the elevation numeral sees both. If the numeral is ever wired back
  to the windowed total, this is the assertion that goes red.
*/
console.log("\nactivity older than the window still counts — the bug:");
const straddling = [log(TERRAIN_DAYS - 1, 4), log(TERRAIN_DAYS, 6), log(90, 10)];
eq("elevation counts all of it", cumulativeElevation(straddling), 20);
eq(
  "the terrain window still only counts what is inside it",
  buildTerrain(straddling, TERRAIN_DAYS, TODAY).windowTotal,
  4,
);
ok_(
  "elevation is strictly greater than the windowed total here",
  cumulativeElevation(straddling) > buildTerrain(straddling, TERRAIN_DAYS, TODAY).windowTotal,
);

/*
  Ageing, stated as the property rather than as one example: the same activity,
  read on a later day, is worth the same.
*/
console.log("\nit cannot fall as activity ages:");
const fixed = [log(0, 2), log(3, 5), log(9, 1)];
const before = cumulativeElevation(fixed);
let monotonic = true;
let windowFell = false;
for (const shift of [1, 7, 14, 30, 90, 365]) {
  const later = new Date(TODAY.getTime() + shift * 86400000);
  if (cumulativeElevation(fixed) !== before) monotonic = false;
  // Same rows, later day: the windowed total is expected to fall away.
  if (buildTerrain(fixed, TERRAIN_DAYS, later).windowTotal < before) windowFell = true;
}
ok_("unchanged 1, 7, 14, 30, 90 and 365 days later", monotonic);
ok_("the windowed total does fall — which is why the numeral cannot be it", windowFell);
eq(
  "a whole year later it is still the same number",
  cumulativeElevation(fixed),
  8,
);

console.log("\nrecording activity raises it:");
let history = [];
let last = cumulativeElevation(history);
let everFell = false;
let alwaysRose = true;
for (const [day, count] of [[20, 3], [13, 1], [6, 4], [1, 2], [0, 5]]) {
  history = [...history, log(day, count)];
  const now = cumulativeElevation(history);
  if (now < last) everFell = true;
  if (now <= last) alwaysRose = false;
  last = now;
}
ok_("never fell across five additions", !everFell);
ok_("rose on every one of them", alwaysRose);
eq("and lands on the true total", last, 15);

/*
  Undo is the one thing allowed to lower it, and that is the undo working
  rather than a window discarding data. A row's count is what falls.
*/
console.log("\nundo is the only way down:");
eq("one activity undone takes exactly one back", cumulativeElevation([log(0, 2)]), 2);
eq("...leaving the rest", cumulativeElevation([log(0, 1)]), 1);

/*
  The y-axis domain, which is the scaling bug this file also has to hold shut.

  The old drawing normalised against the series' own total — `y = cumulative /
  peak` — so the last point was 1.0 every time and the ridge filled the frame
  whether the track had two activities or two hundred. These assert the three
  properties the fixed domain has to keep, and the first of them is the report
  that started it: two activities must not fill the chart.
*/
console.log("\nthe domain is a fixed scale, not the series' own total:");
const frame = (logs, baseline = 0) => {
  const t = buildTerrain(logs, TERRAIN_DAYS, TODAY, baseline);
  return { top: Math.max(...t.points.map((p) => p.y)), domain: t.domainMax, elevation: t.elevation };
};

const tiny = frame([log(4, 1), log(1, 1)]);
eq("2 activities scale against the first milestone", tiny.domain, 10);
eq("...and occupy a fifth of the frame, not all of it", +tiny.top.toFixed(3), 0.2);
ok_("...which is nowhere near the top", tiny.top < 0.25);

const big = frame([log(3, 40), log(1, 14)]);
ok_("54 activities occupy much more of the frame than 2 do", big.top > tiny.top * 2.5);
eq("...on a scale that moved up with them", big.domain, 100);

/*
  Headroom is structural rather than a margin someone remembered to add: the
  domain is the next milestone *strictly above* the elevation, so the ridge
  cannot reach the top edge for any input at all.
*/
let touchedTop = false;
for (const n of [1, 2, 9, 10, 11, 49, 50, 51, 99, 100, 249, 250, 501, 999, 2600]) {
  const f = frame([log(0, n)]);
  if (f.top >= 1) touchedTop = true;
  if (f.domain <= f.elevation) touchedTop = true;
}
ok_("no elevation from 1 to 2600 ever reaches the top of the frame", !touchedTop);

eq(
  "the ladder carries on past the named milestones",
  [0, 2, 10, 50, 120, 600, 1200, 3000].map(nextMilestone),
  [10, 10, 50, 100, 250, 1000, 2500, 5000],
);

/*
  The baseline: the ridge starts from the elevation the track already had, so
  the top of the drawing is the same number the headline shows. Without it the
  chart restarts at zero every fortnight and disagrees with the figure beside
  it.
*/
console.log("\nthe ridge starts where the track already stood:");
const carried = buildTerrain([log(2, 4)], TERRAIN_DAYS, TODAY, 35);
eq("elevation carries the baseline", carried.elevation, 39);
eq("the window total does not", carried.windowTotal, 4);
eq("the oldest point sits at the baseline, not at zero", carried.points[0].cumulative, 35);
ok_("...and off the floor of the frame", carried.points[0].y > 0.3);
eq("a milestone crossed before the window is not re-drawn", carried.reached.length, 0);

console.log("\nevery day is a point, and carries its own count:");
const daily = buildTerrain([log(13, 2), log(7, 3)], TERRAIN_DAYS, TODAY, 0);
eq("one point per day in the window", daily.points.length, TERRAIN_DAYS);
eq("the oldest day carries its own activities", daily.points[0].count, 2);
eq("a day with nothing is a real point at zero", daily.points[1].count, 0);
eq("...and holds the elevation flat rather than dipping", daily.points[1].cumulative, 2);
eq("the day with 3 carries 3", daily.points[6].count, 3);
eq("and the elevation steps up there", daily.points[6].cumulative, 5);

console.log("\nthe drawing is untouched:");
const drawn = buildTerrain([log(1, 2), log(0, 3)], TERRAIN_DAYS, TODAY);
eq("still one point per day in the window", drawn.points.length, TERRAIN_DAYS);
eq("windowTotal is still the windowed total", drawn.windowTotal, 5);
eq("today is still today's own count", drawn.today, 3);
eq("this week is still 7 days", drawn.thisWeek, 5);
ok_("hasData still describes the window", drawn.hasData);
ok_("milestones are still the volume list", ELEVATION_MILESTONES[0] === 10);

console.log(fails ? `\n${fails} FAILURE(S)` : "\nALL PASS");
process.exit(fails ? 1 : 0);
