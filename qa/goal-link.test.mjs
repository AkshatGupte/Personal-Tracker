/**
 * Goals linked to a Track: the parts that fail silently.
 *
 * The visible half fails loudly — a badge that does not render, a picker with no
 * options. What does not is the *matching*: a subtree test that quietly includes
 * a sibling, a window test run against today instead of the day recorded, a
 * status filter that lets an archived goal keep collecting, or a chain walk that
 * spins on a cycle inside a transaction and holds a write lock.
 *
 * **What is not asserted here, and deliberately.** Link coverage — "does this
 * goal watch this leaf" — is a database query in `lib/actions/activity.ts`
 * (`OR: [{trackId}, {topicId: {in: chain}}]`) and there is no second copy of it
 * to test. What is testable is the chain that query is *given* and the window
 * test applied to what it returns, which is what this file covers. The query
 * itself, the CHECK constraint and the transaction are covered by the migration
 * check and by driving the real flow against the database.
 *
 * Every assertion passes a fixed `now`.
 */
const { advancesOn, chainFor, describeGoalAdvance, describeLink, isLinked, linkChoiceValue, NO_LINK, parseLinkChoice } =
  await import("@/lib/goalLink");
const { MAX_DEPTH } = await import("@/lib/tree");

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
  A five-level track, which is the deepest the app allows:

    dsa
      graphs
        traversal
          bfs
            variants
      dp
        knapsack
*/
const TOPICS = [
  { id: "dsa", parentId: null },
  { id: "graphs", parentId: "dsa" },
  { id: "traversal", parentId: "graphs" },
  { id: "bfs", parentId: "traversal" },
  { id: "variants", parentId: "bfs" },
  { id: "dp", parentId: "dsa" },
  { id: "knapsack", parentId: "dp" },
];

console.log("the ancestor chain is what turns a subtree test into an IN:");
eq("a deep leaf, nearest first", chainFor(TOPICS, "variants"), [
  "variants", "bfs", "traversal", "graphs", "dsa",
]);
eq("a root is its own chain", chainFor(TOPICS, "dsa"), ["dsa"]);
eq("a shallow leaf", chainFor(TOPICS, "knapsack"), ["knapsack", "dp", "dsa"]);
eq("a node that is not in the tree has no chain", chainFor(TOPICS, "nope"), []);
eq("an empty tree has no chain", chainFor([], "bfs"), []);

/*
  The whole point, stated as the thing that would be wrong: a goal watching
  `graphs` must advance from `variants` (five levels down) and must NOT advance
  from `knapsack`, which is a sibling branch. Both are leaves of the same track.
*/
ok_("a goal on graphs is matched by a leaf beneath it", chainFor(TOPICS, "variants").includes("graphs"));
ok_("a goal on graphs is NOT matched by a leaf in a sibling branch", !chainFor(TOPICS, "knapsack").includes("graphs"));
ok_("a goal on the leaf itself is matched", chainFor(TOPICS, "variants").includes("variants"));
ok_("a goal on a deeper node is not matched by a shallower leaf", !chainFor(TOPICS, "graphs").includes("bfs"));

console.log("\nthe chain never runs longer than the tree can be:");
ok_(
  "no chain exceeds MAX_DEPTH",
  TOPICS.every((t) => chainFor(TOPICS, t.id).length <= MAX_DEPTH),
);
/*
  A cycle is not supposed to be reachable — `canMove` refuses one — but this walk
  runs inside a transaction, where a spin holds a write lock rather than merely
  returning a wrong answer. So it is bounded, and that bound is asserted.
*/
const CYCLE = [
  { id: "a", parentId: "c" },
  { id: "b", parentId: "a" },
  { id: "c", parentId: "b" },
];
ok_("a corrupted parent cycle terminates", chainFor(CYCLE, "a").length <= MAX_DEPTH + 1);
eq("and returns each node once", chainFor(CYCLE, "a"), ["a", "c", "b"]);

console.log("\na chain stops at a soft-deleted ancestor:");
/*
  `rows` is the track's *live* topics. When `traversal` is soft-deleted it is
  absent, so the chain from `variants` stops below it — and a goal watching
  `graphs` stops advancing, which is what every other figure in the app does with
  a deleted node. The alternative, walking through the gap, would have a deleted
  topic silently still feeding a goal.
*/
const LIVE = TOPICS.filter((t) => t.id !== "traversal");
eq("the chain stops rather than jumping the gap", chainFor(LIVE, "variants"), ["variants", "bfs"]);
ok_("so a goal on the deleted node's parent no longer matches", !chainFor(LIVE, "variants").includes("graphs"));

console.log("\nthe window is tested against the day recorded, not today:");
const goal = (over = {}) => ({
  status: "active",
  startDate: new Date(2026, 8, 7),
  deadline: new Date(2026, 8, 13),
  ...over,
});
const day = (d) => new Date(2026, 8, d);

eq("a day inside the window advances it", advancesOn(goal(), day(9)), true);
eq("the first day is inclusive", advancesOn(goal(), day(7)), true);
eq("the last day is inclusive", advancesOn(goal(), day(13)), true);
eq("the day before the window does not", advancesOn(goal(), day(6)), false);
eq("the day after the window does not", advancesOn(goal(), day(14)), false);
/*
  The backdating case, and the reason `advancesOn` takes a day at all. Recording
  *today* for a goal whose window closed yesterday must not pay; backdating into
  a window that was open must. A version that tested `new Date()` would get both
  of these backwards.
*/
eq("backdating into an open window pays", advancesOn(goal(), day(8)), true);
eq("backdating before the window does not pay", advancesOn(goal({ startDate: day(10) }), day(8)), false);
eq("a closed window is not reopened by recording today", advancesOn(goal({ deadline: day(8) }), day(9)), false);
eq("the time of day is irrelevant", advancesOn(goal(), new Date(2026, 8, 13, 23, 59, 59)), true);

console.log("\nstatus decides whether a goal is still listening:");
eq("active listens", advancesOn(goal({ status: "active" }), day(9)), true);
/*
  Completed listens too, and the asymmetry is deliberate. If it stopped, then
  recording the activity that completed a goal and undoing it would leave the
  goal at a figure its own activity no longer supports.
*/
eq("completed still listens, so an undo can still take it back", advancesOn(goal({ status: "completed" }), day(9)), true);
eq("archived does not — 'I am not doing this after all'", advancesOn(goal({ status: "archived" }), day(9)), false);
eq("an unknown status does not listen", advancesOn(goal({ status: "nonsense" }), day(9)), false);

console.log("\nthe form value can never produce a goal watching two things:");
eq("a track choice", parseLinkChoice("track:t1"), { trackId: "t1", topicId: null });
eq("a topic choice", parseLinkChoice("topic:n1"), { trackId: null, topicId: "n1" });
eq("the empty choice is manual", parseLinkChoice(""), NO_LINK);
eq("an unknown prefix is manual", parseLinkChoice("cheese:n1"), NO_LINK);
eq("a missing id is manual", parseLinkChoice("topic:"), NO_LINK);
eq("a bare id is manual", parseLinkChoice("n1"), NO_LINK);
eq("a non-string is manual", parseLinkChoice(undefined), NO_LINK);
eq("a cuid containing no colon still parses", parseLinkChoice("topic:cmtob:x"), { trackId: null, topicId: "cmtob:x" });
ok_(
  "no input whatsoever yields both fields set",
  ["track:a", "topic:b", "", "x", "track:", ":a", "track:a:topic:b", undefined, 7, null].every((raw) => {
    const link = parseLinkChoice(raw);
    return !(link.trackId !== null && link.topicId !== null);
  }),
);

console.log("\nlinked-ness is derived from the columns, never a flag:");
eq("a track link is linked", isLinked({ trackId: "t", topicId: null }), true);
eq("a topic link is linked", isLinked({ trackId: null, topicId: "n" }), true);
eq("neither is manual", isLinked(NO_LINK), false);
eq("round-trips back to a form value", linkChoiceValue(parseLinkChoice("topic:n1")), "topic:n1");
eq("manual round-trips to the empty choice", linkChoiceValue(NO_LINK), "");

console.log("\nthe badge says where a number comes from:");
eq("a whole track", describeLink({ kind: "track", trackName: "DSA", live: true }), "DSA");
eq("a subtree", describeLink({ kind: "topic", trackName: "DSA", topicName: "Graphs", live: true }), "DSA › Graphs");
eq("no link, no badge", describeLink(null), null);

console.log("\nthe track page states what a goal did, and does not celebrate it:");
const g = { title: "Solve 50 DSA problems", target: 50, unit: "problems" };
eq("a plain advance", describeGoalAdvance(g, 12, []), "Solve 50 DSA problems — 12/50 problems.");
eq("a milestone crossing", describeGoalAdvance(g, 25, [25]), "Solve 50 DSA problems — 25% reached, 25/50 problems.");
eq("the highest crossing of several", describeGoalAdvance(g, 40, [25, 50, 75]), "Solve 50 DSA problems — 75% reached, 40/50 problems.");
eq("completion is said plainly", describeGoalAdvance(g, 50, [100]), "Solve 50 DSA problems — complete, 50/50 problems.");
/*
  The reward is real and was banked inside the transaction — but the three
  celebration tiers and the confetti live on /goals, and the track half of the
  app describes behaviour rather than scoring it. So no XP figure and no
  exclamation reaches this string.
*/
ok_(
  "no XP, no exclamation, no congratulation on the track page",
  [
    describeGoalAdvance(g, 12, []),
    describeGoalAdvance(g, 25, [25]),
    describeGoalAdvance(g, 50, [100]),
  ].every((line) => !/xp|!|congrat|well done|nice/i.test(line)),
);

console.log(fails === 0 ? "\nall assertions passed" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
