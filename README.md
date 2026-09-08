# Rendred

A gamified personal learning tracker. You create **Tracks** (a subject you are
learning — DSA, Spanish, Guitar), break each into a recursive tree of **Topics**,
and record activity against the leaves. Alongside that, **Goals** are time-boxed
targets with deadlines and rewards.

It is deliberately local-first: one SQLite file on your machine, no accounts, no
server, no telemetry, nothing to sign up for.

---

## Run it locally

**Requirements:** Node 20.12 or newer (the Prisma config uses
`process.loadEnvFile`). Nothing else — no database server, no Docker.

```bash
git clone https://github.com/AkshatGupte/Personal-Tracker.git
cd Personal-Tracker

cp .env.example .env          # the only configuration there is
npm install                   # `postinstall` generates the Prisma client
npx prisma migrate deploy     # creates prisma/dev.db from the migration history

npm run dev                   # http://localhost:3000
```

That is the whole setup. The database file is created by the migration step and
is gitignored, so you start with an empty tracker rather than someone else's
data.

### Production build

There is no deployment target — "production" means running the optimised build
on the same laptop.

```bash
npm run build
npm start                     # http://localhost:3000
```

---

## What is where

| Path | What it holds |
|---|---|
| `app/` | Routes. `/` (tracks), `/progress`, `/goals`, `/tracks/[id]` |
| `components/` | UI. `components/spiderverse/` is the visual/effects layer |
| `lib/` | Business logic — streaks, coverage, terrain, goals |
| `lib/actions/` | Server actions (every write) |
| `prisma/` | Schema and migration history |
| `qa/` | Test suites and browser-driven checks |
| `docs/` | The project's own documentation — start with `DEV_REPORT.md` |

## Checks

```bash
./qa/run-tests.sh             # pure logic suites, no browser, no server
npx tsc --noEmit              # types
npm run lint
```

The rest of `qa/` drives a real browser against a running server and is
documented in [`qa/README.md`](qa/README.md) — start the app first, then point a
check at it, e.g. `node qa/goals.test.mjs`.

## Reading the project

`CLAUDE.md` is the single source of truth for how this is built and why — the
visual rules, the data model's constraints, and the decisions that are
deliberately *not* open for re-litigation. `docs/DEV_REPORT.md` is a running
plain-language log of what was built, newest first, and `docs/DECISIONS.md` has
the reasoning with the measurements behind it.
