const {
  MAX_DEPTH, buildTree, flatten, leaves, subtreeHeight, canMove, canAddChild,
  intensityTier, parentCoverage, trackCoverage, coveragePercent, subtreeWorked,
} = await import("@/lib/tree");

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? "  ok  " : "  FAIL", name, ok ? "" : `→ got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const ok_ = (name, cond) => eq(name, !!cond, true);

/*
  A fixture five deep on one branch and shallow on another, so depth, ordering,
  ancestry and coverage all have something to be wrong about.

    a (1)
      a1 (2)
        a11 (3)
          a111 (4)
            a1111 (5)   leaf, deepest legal node
        a12 (3)         leaf
      a2 (2)            leaf
    b (1)               leaf
*/
const row = (id, parentId, position, depth, name = id) => ({ id, parentId, name, position, depth });
const ROWS = [
  row("a", null, 0, 1), row("b", null, 1, 1),
  row("a1", "a", 0, 2), row("a2", "a", 1, 2),
  row("a11", "a1", 0, 3), row("a12", "a1", 1, 3),
  row("a111", "a11", 0, 4),
  row("a1111", "a111", 0, 5),
];
const tree = buildTree(ROWS);
const find = (id) => flatten(tree).find((n) => n.id === id);

console.log("shape:");
eq("two roots", tree.map((n) => n.id), ["a", "b"]);
eq("all nodes", flatten(tree).map((n) => n.id), ["a", "a1", "a11", "a111", "a1111", "a12", "a2", "b"]);
eq("leaves, tree order", leaves(tree).map((n) => n.id), ["a1111", "a12", "a2", "b"]);
eq("ancestry of the deepest", find("a1111").path, ["a", "a1", "a11", "a111"]);
eq("a root has no path", find("a").path, []);
ok_("a parent is not a leaf", !find("a11").isLeaf);

console.log("\nordering follows position, not insertion:");
eq("siblings of a", find("a").children.map((n) => n.id), ["a1", "a2"]);
eq(
  "position wins over name",
  buildTree([row("x", null, 1, 1, "aaa"), row("y", null, 0, 1, "zzz")]).map((n) => n.name),
  ["zzz", "aaa"],
);

console.log("\norphans are dropped, not promoted to the root:");
eq("child of a missing parent", buildTree([row("lone", "gone", 0, 2)]).map((n) => n.id), []);

console.log("\nsubtree height:");
eq("leaf is 1", subtreeHeight(find("b")), 1);
eq("a spans 5", subtreeHeight(find("a")), 5);
eq("a11 spans 3", subtreeHeight(find("a11")), 3);

console.log(`\ndepth limit is ${MAX_DEPTH}:`);
eq("limit", MAX_DEPTH, 5);
ok_("a depth-4 node may take a child", canAddChild({ depth: 4 }).ok);
ok_("a depth-5 node may NOT", !canAddChild({ depth: 5 }).ok);
eq("new top-level is depth 1", canAddChild(null), { ok: true, depth: 1 });
eq("child of depth 4 is depth 5", canAddChild({ depth: 4 }), { ok: true, depth: 5 });

console.log("\nmoves — cycles:");
ok_("into itself", !canMove(tree, "a1", "a1").ok);
ok_("into its own child", !canMove(tree, "a", "a11").ok);
ok_("into its own deepest descendant", !canMove(tree, "a", "a1111").ok);
ok_("into an unrelated node", canMove(tree, "b", "a12").ok);
ok_("to the top level", canMove(tree, "a11", null).ok);

console.log("\nmoves — the WHOLE subtree must fit:");
// a11 is 3 tall. Under a2 (depth 2) its deepest lands at 5 — legal.
eq("a11 (3 tall) under a2 (depth 2)", canMove(tree, "a11", "a2"), { ok: true, depth: 3 });
// Under a12 (depth 3) its deepest would land at 6 — refused.
ok_("a11 (3 tall) under a12 (depth 3) is refused", !canMove(tree, "a11", "a12").ok);
ok_("...and says why", /6 levels deep/.test(canMove(tree, "a11", "a12").reason ?? ""));
// a11 above is the case that proves the check is not just about the moved node:
// a11 itself would land at depth 4, which is legal — it is refused because
// a1111, two levels below it, would land at 6.
eq("...and the moved node itself would have fitted", find("a11").depth + 1, 4);
// a111 is only 2 tall, so under a12 (depth 3) its child lands at 5. Legal.
eq("a111 (2 tall) under a12 (depth 3) fits exactly", canMove(tree, "a111", "a12"), { ok: true, depth: 4 });
ok_("a leaf under a depth-4 node fits", canMove(tree, "b", "a111").ok);
ok_("a leaf under a depth-5 node does not", !canMove(tree, "b", "a1111").ok);
ok_("unknown node", !canMove(tree, "nope", null).ok);
ok_("unknown destination", !canMove(tree, "b", "nope").ok);

console.log("\nintensity tiers cap at 5, the stored count does not:");
eq("0", intensityTier(0), 0);
for (const n of [1, 2, 3, 4, 5]) eq(`${n}`, intensityTier(n), n);
eq("6 saturates", intensityTier(6), 5);
eq("99 saturates", intensityTier(99), 5);
eq("negative is neutral", intensityTier(-3), 0);

console.log("\nparent coverage is distinct DIRECT children, not clicks:");
const counts = (obj) => new Map(Object.entries(obj));
eq("one of two children worked", parentCoverage(find("a1"), counts({ a1111: 1 })), { worked: 1, total: 2 });
eq(
  "hammering one child does not raise it",
  parentCoverage(find("a1"), counts({ a1111: 50 })),
  { worked: 1, total: 2 },
);
eq("both children worked", parentCoverage(find("a1"), counts({ a1111: 1, a12: 1 })), { worked: 2, total: 2 });
eq("a leaf has no coverage", parentCoverage(find("b"), counts({ b: 3 })), { worked: 0, total: 0 });
ok_("a child counts when anything beneath it was worked", subtreeWorked(find("a11"), counts({ a1111: 1 })));
ok_("...and not otherwise", !subtreeWorked(find("a11"), counts({ b: 1 })));

console.log("\ntrack coverage is distinct leaves over all leaves:");
eq("nothing worked", trackCoverage(tree, counts({})), { worked: 0, total: 4 });
eq("one leaf", trackCoverage(tree, counts({ b: 1 })), { worked: 1, total: 4 });
eq("volume does not move it", trackCoverage(tree, counts({ b: 99 })), { worked: 1, total: 4 });
eq("two leaves", trackCoverage(tree, counts({ b: 1, a2: 4 })), { worked: 2, total: 4 });
eq("a parent's own count is ignored", trackCoverage(tree, counts({ a1: 9 })), { worked: 0, total: 4 });

console.log("\nthe brief's worked example — 2 of 8 leaves is 25%:");
const eight = buildTree(Array.from({ length: 8 }, (_, i) => row(`L${i}`, null, i, 1)));
eq("coverage", coveragePercent(trackCoverage(eight, counts({ L0: 1, L3: 7 }))), 25);
eq("empty track is 0, not NaN", coveragePercent(trackCoverage([], counts({}))), 0);

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILED`);
process.exitCode = fails === 0 ? 0 : 1;
