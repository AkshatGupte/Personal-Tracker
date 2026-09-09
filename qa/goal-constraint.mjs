/**
 * The Goal link CHECK constraint, asserted against a real database.
 *
 *   node qa/goal-constraint.mjs
 *
 * **Why this is not a `.test.mjs`.** The logic suites in this directory are pure
 * functions over dates and numbers and take no dependencies. This one asserts a
 * property of *SQLite*, which cannot be tested any other way than by asking
 * SQLite — so it opens `better-sqlite3`, which is already a project dependency
 * through the Prisma adapter. It builds a throwaway database by replaying every
 * migration in order, so it never touches `prisma/dev.db` and needs no server.
 *
 * **What it is for.** `Goal.trackId` and `Goal.topicId` say what a goal watches,
 * and at most one may be set. A row carrying both — a track, and a topic from a
 * *different* track — would advance from one while its card claimed the other,
 * and nothing on a rendered page would show it. Application code enforcing that
 * would be a rule to remember at every write; the constraint makes it a thing
 * that cannot happen, which is the pattern `@@unique([topicId, date])` and
 * `@@unique([goalId, percent])` already established here.
 *
 * A constraint that has never been made to fail is not known to exist. This is
 * what makes it fail.
 */
import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const MIGRATIONS = join(ROOT, "prisma/migrations");

let fails = 0;
const check = (name, cond, detail = "") => {
  if (!cond) fails++;
  console.log(cond ? "  ok  " : "  FAIL", name, cond ? "" : detail);
};

/* A fresh database with the real schema, built the way `migrate deploy` would. */
const dir = mkdtempSync(join(tmpdir(), "rendred-constraint-"));
const db = new Database(join(dir, "check.db"));
db.pragma("foreign_keys = ON");

const applied = readdirSync(MIGRATIONS)
  .filter((name) => !name.endsWith(".toml"))
  .sort();
for (const name of applied) {
  db.exec(readFileSync(join(MIGRATIONS, name, "migration.sql"), "utf8"));
}
console.log(`replayed ${applied.length} migrations into a throwaway database\n`);

db.prepare("INSERT INTO \"Track\" (id, name, createdAt) VALUES ('tk','DSA',datetime('now'))").run();
db.prepare(
  "INSERT INTO \"Topic\" (id, trackId, parentId, name, position, depth, createdAt) VALUES ('tp','tk',NULL,'Graphs',0,1,datetime('now'))",
).run();

let seq = 0;
const insert = (trackId, topicId) => {
  const sql = `INSERT INTO "Goal" (id,title,category,target,unit,currentProgress,highWater,startDate,deadline,cadence,status,createdAt,trackId,topicId)
               VALUES (?,'g','G',50,'u',0,0,'2026-09-09','2026-09-16','weekly','active',datetime('now'),?,?)`;
  try {
    db.prepare(sql).run(`g${seq++}`, trackId, topicId);
    return null;
  } catch (error) {
    return error.message;
  }
};

console.log("the three legal shapes are accepted:");
check("a whole-track link", insert("tk", null) === null);
check("a subtree link", insert(null, "tp") === null);
check("neither — a manual goal", insert(null, null) === null);

console.log("\nthe illegal shape is refused by the database, not by application code:");
const both = insert("tk", "tp");
check("a goal watching a track AND a topic", both !== null, "→ the row was ACCEPTED");
check(
  "and the refusal names the constraint",
  both !== null && /Goal_one_link/.test(both),
  `→ got ${JSON.stringify(both)}`,
);

console.log("\nan UPDATE cannot sneak past it either:");
let updated = null;
try {
  db.prepare("UPDATE \"Goal\" SET topicId='tp' WHERE trackId='tk'").run();
} catch (error) {
  updated = error.message;
}
check("setting the second column on an already-linked goal", updated !== null, "→ the update was ACCEPTED");

console.log("\none row per period per series — what makes rolling forward on read safe:");
/*
  The roll happens on *read*, so two concurrent renders of /goals can both find
  the next period missing and both try to create it. The unique index is what
  makes the loser collide instead of duplicating a period. Without it, a series
  could silently grow two rows for one window, and Feature A would then advance
  both from the same activity.
*/
let pseq = 0;
const period = (seriesId, startDate) => {
  const sql = `INSERT INTO "Goal" (id,title,category,target,unit,currentProgress,highWater,startDate,deadline,cadence,status,createdAt,seriesId)
               VALUES (?,'g','G',50,'u',0,0,?,?,'weekly','active',datetime('now'),?)`;
  try {
    db.prepare(sql).run(`p${pseq++}`, startDate, startDate, seriesId);
    return null;
  } catch (error) {
    return error.message;
  }
};
check("two periods of one series on different days", period("s1", "2026-09-07") === null && period("s1", "2026-09-14") === null);
const clash = period("s1", "2026-09-07");
check("a second row for the same period", clash !== null, "→ the duplicate was ACCEPTED");
/*
  One-off goals keep NULL here, and SQLite treats NULLs as distinct in a unique
  index — so this constraint must not accidentally forbid two one-off goals that
  happen to start on the same day.
*/
check(
  "one-off goals are unaffected — NULLs stay distinct",
  period(null, "2026-09-07") === null && period(null, "2026-09-07") === null,
  "→ two one-off goals starting the same day were REFUSED",
);
check("a different series may reuse the same start date", period("s2", "2026-09-07") === null);

console.log("\nSetNull, so a deleted track leaves the goal manual rather than gone:");
db.prepare("DELETE FROM \"Goal\"").run();
db.prepare(
  `INSERT INTO "Goal" (id,title,category,target,unit,currentProgress,highWater,startDate,deadline,cadence,status,createdAt,trackId)
   VALUES ('keep','g','G',50,'u',7,7,'2026-09-09','2026-09-16','weekly','active',datetime('now'),'tk')`,
).run();
db.prepare("DELETE FROM \"Track\" WHERE id='tk'").run();
const survivor = db.prepare("SELECT id, trackId, topicId, currentProgress FROM \"Goal\" WHERE id='keep'").get();
check("the goal survived its track", !!survivor, "→ it was deleted with the track");
check("its progress is intact", survivor?.currentProgress === 7, `→ got ${survivor?.currentProgress}`);
check("its link was cleared", survivor?.trackId === null, `→ got ${survivor?.trackId}`);
check(
  "the topic link went too, since the track's topics cascaded",
  survivor?.topicId === null,
  `→ got ${survivor?.topicId}`,
);

db.close();
console.log(fails === 0 ? "\nALL CLEAN" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
