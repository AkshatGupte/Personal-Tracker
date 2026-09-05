/**
 * Resets the database to a small example tree.
 *
 * Exists so the hierarchy can actually be exercised: depth, coverage at every
 * level, all five intensity tiers, and history stretching back far enough for a
 * streak and a terrain window to mean something. A tree two levels deep with one
 * click on it would let every one of those look correct while being wrong.
 *
 * Deliberately two subjects. The restructure's whole point is that the model is
 * not DSA-shaped, and a seed containing only DSA would never test that.
 *
 * Run with:  node prisma/seed.mjs
 */
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";

/*
  Raw SQL through better-sqlite3 rather than Prisma Client.

  The generated client is TypeScript and this project has no TS runner, so a
  plain `node prisma/seed.mjs` cannot import it — and adding a runner to seed a
  local database would be a dependency bought for one script. better-sqlite3 is
  already here underneath the Prisma adapter, and the inserts are three flat
  tables. Ids are UUIDs rather than cuids: the column is TEXT and nothing in the
  app parses an id.
*/
const file = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
const db = new Database(file);
db.pragma("foreign_keys = ON");

/*
  Dates go in as ISO strings, because that is what Prisma writes.

  SQLite has no date type — a DATETIME column holds whatever you put in it — and
  it orders values by *type class* before value, with every INTEGER sorting
  below every TEXT. An earlier version of this seed wrote `getTime()`
  milliseconds, which read back through Prisma perfectly and then silently
  matched nothing on any `date: { gte: ... }` filter, because the bind was a
  string and the rows were integers. The app looked entirely correct except for
  the one panel that filters dates in the database rather than in JavaScript.

  So: write exactly what the application writes. The self-check at the bottom
  fails the seed rather than let that regress quietly.
*/
const iso = (d) => new Date(d).toISOString();

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const daysAgo = (n) => {
  const d = startOfDay();
  d.setDate(d.getDate() - n);
  return d;
};

/**
 * The tree, as nested literals. `activity` is a map of days-ago → clicks and
 * may only appear on a leaf; the seed asserts that rather than trusting it,
 * because a parent with activity is exactly the bug the coverage rules exist to
 * prevent and it should not be possible to introduce one here by accident.
 */
const TRACKS = [
  {
    name: "DSA",
    children: [
      {
        name: "Arrays",
        children: [
          {
            name: "Two pointers",
            children: [
              { name: "Opposite ends", activity: { 0: 3, 1: 1, 2: 2, 4: 1 } },
              {
                name: "Fast and slow",
                children: [
                  {
                    // Depth 4, and a parent — so its own history stays attached
                    // while it is not actionable, which is the case the
                    // leaf-becomes-parent rule exists for.
                    name: "Cycle detection",
                    children: [
                      // Depth 5: the deepest the model allows. These are the
                      // nodes the "reject a 6th level" check is run against.
                      { name: "Linked list cycle", activity: { 0: 5, 3: 2 } },
                      { name: "Happy number", activity: { 1: 1 } },
                    ],
                  },
                ],
              },
            ],
          },
          { name: "Sliding window", activity: { 0: 2, 1: 4, 2: 1, 3: 3, 5: 1 } },
          { name: "Prefix sums", activity: { 1: 1, 6: 2 } },
        ],
      },
      {
        name: "Graphs",
        children: [
          { name: "Traversal", children: [{ name: "BFS", activity: { 0: 1, 2: 3 } }, { name: "DFS", activity: { 3: 2 } }] },
          { name: "Shortest paths", activity: { 0: 4 } },
        ],
      },
      // A top-level leaf, so the flat view is not uniformly deep.
      { name: "Review yesterday's problems", activity: { 0: 7, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 } },
    ],
  },
  {
    name: "Spanish",
    children: [
      {
        name: "Grammar",
        children: [
          { name: "Present tense", activity: { 1: 2, 4: 1 } },
          { name: "Subjunctive", activity: {} },
        ],
      },
      { name: "Listening", activity: { 0: 2, 1: 1, 3: 1 } },
      { name: "Vocabulary", activity: { 2: 1 } },
    ],
  },
];

const insertTrack = db.prepare(`INSERT INTO "Track" (id, name, createdAt) VALUES (?, ?, ?)`);
const insertTopic = db.prepare(
  `INSERT INTO "Topic" (id, trackId, parentId, name, position, depth, deletedAt, createdAt)
   VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
);
const insertActivity = db.prepare(
  `INSERT INTO "TopicActivity" (id, topicId, date, count, updatedAt) VALUES (?, ?, ?, ?, ?)`,
);

function insertNodes(trackId, nodes, parentId, depth) {
  nodes.forEach((node, position) => {
    if (depth > 5) throw new Error(`Seed exceeds MAX_DEPTH at "${node.name}"`);
    const kids = node.children ?? [];
    if (kids.length > 0 && node.activity) {
      throw new Error(`Seed puts activity on a parent: "${node.name}"`);
    }

    const id = randomUUID();
    insertTopic.run(id, trackId, parentId, node.name, position, depth, iso(Date.now()));

    for (const [ago, count] of Object.entries(node.activity ?? {})) {
      insertActivity.run(randomUUID(), id, iso(daysAgo(Number(ago))), count, iso(Date.now()));
    }
    insertNodes(trackId, kids, id, depth + 1);
  });
}

db.transaction(() => {
  db.prepare(`DELETE FROM "TopicActivity"`).run();
  db.prepare(`DELETE FROM "Topic"`).run();
  db.prepare(`DELETE FROM "Track"`).run();

  for (const track of TRACKS) {
    const id = randomUUID();
    insertTrack.run(id, track.name, iso(Date.now()));
    insertNodes(id, track.children, null, 1);
  }
})();

const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n;

/*
  Self-check: a date range filter of the kind the app runs must actually match
  what was just written. This is the assertion that would have caught the
  integer-vs-text bug at seed time instead of in a blank history panel.
*/
const since = iso(daysAgo(27));
const matched = db
  .prepare(`SELECT COUNT(*) AS n FROM "TopicActivity" WHERE date >= ?`)
  .get(since).n;
const total = count("TopicActivity");
if (matched !== total) {
  throw new Error(
    `Seed wrote dates the app cannot filter: ${matched}/${total} rows match "date >= ${since}". ` +
      `Dates must be ISO strings, matching what Prisma writes.`,
  );
}

const types = db.prepare(`SELECT DISTINCT typeof(date) AS t FROM "TopicActivity"`).all().map((r) => r.t);
if (types.length !== 1 || types[0] !== "text") {
  throw new Error(`Seed wrote date as ${types.join("/")}; Prisma writes text.`);
}

console.log(
  `seeded ${count("Track")} tracks, ${count("Topic")} topics, ${total} activity rows ` +
    `(all ${matched} match a date filter)`,
);
db.close();
