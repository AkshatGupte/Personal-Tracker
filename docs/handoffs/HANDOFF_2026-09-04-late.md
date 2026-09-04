# Handoff — 2026-09-04 (late)

For a fresh session with no memory of the previous one. Read `CLAUDE.md`,
`docs/PRD.md`, `docs/SCHEMA.md`, `docs/ROADMAP.md` and `docs/RULES.md` alongside
this. This file only covers what is new, in progress, or not written down
elsewhere.

**This supersedes `HANDOFF_2026-09-04.md`** (same date, earlier in the day). That
file describes a spider-web visual regression as the top priority — it was fixed
hours ago and none of it is still true. Read this one instead; the older file is
kept only because handoffs are a running record.

---

## 1. Where things stand

Branch `phase2-weekly-progress`, **11 commits ahead of `master`, none pushed**,
working tree clean. Remote is `github.com/AkshatGupte/Personal-Tracker`. Nobody
has asked for a push or a PR — do not assume one is wanted.

**Phase 2 is complete except one item.** Shipped today: the monthly summary and
the streak-milestone celebration, both ticked in `docs/ROADMAP.md`.

The only Phase 2 item left is the **learning trajectory view**, and it is
blocked on data, not on code — see section 4.

Everything from today is in `docs/DEV_REPORT.md` (six entries) and
`docs/DECISIONS.md` (fourteen entries dated 2026-09-04). Nothing was decided
this session that is not written down.

## 2. What was built today, newest first

Each of these is one commit; `git log --oneline` reads in the same order.

- **Ambient lightning** (`73cfdf9`). `AmbientLightning` replaced `VenomLightning`,
  which is deleted. It fires on its own every 8-18s from a random point on a real
  UI border and has no connection to anything the user does. The earlier
  triggered version (ADD press, elevation rise) was reported as invisible and
  was — see `DECISIONS.md` for why it was reclassified as atmosphere rather than
  retuned.
- **The two effects first landed** (`8eadf6f`), along with `GlitchShatter` and
  the `/lab` bench. `GlitchShatter` is unchanged and still fires on check-in and
  track creation — that one *is* feedback and stays reliable.
- **Stabilization pass** (`2843a1f`). Four real defects, each reproduced before
  it was fixed. Most useful to know: `deleteTrack` threw a 500 on a double
  click, and the delete confirmations were emphasising the name with
  `font-semibold`, which does nothing in a one-weight font.
- **Streak milestones** (`899c5bb`) and **the monthly summary** (`5ae13ab`).
- **Home page compaction** (`c11e07c`) — 1075px down to 803px.
- **The spider-web work** (`fae0211` through `3922e74`), which is what the
  superseded handoff was about. Settled and approved.

## 3. Open questions the user has not answered

None of these block anything, but do not silently decide them a second time.

- **Framer Motion.** The effects brief asked for it; `CLAUDE.md` requires a
  discussion before adding an animation library, so both effects were built
  without it and this was flagged. No reply either way.
- **`sv-page-in` holds a 14px translate** while a route is slow to paint,
  because of its `animation-fill-mode: both`. That briefly widens the document
  and can flash a horizontal scrollbar while the page is still invisible.
  Pre-existing, minor, **not fixed**. The one-character fix is to start the
  keyframe at `-14px` instead of `+14px`; it was offered and not taken up.
- **`CLAUDE.md` is stale in one line**: it says `three` and `@react-three/fiber`
  are still in `package.json` and safe to uninstall. They are already gone —
  dependencies are down to Prisma, Next and React. Offered as a one-line
  correction, no reply.
- **A paragraph in the shatter brief** described spider-web spokes ("8-13 radial
  lines from an anchor point"). It was read as a paste error from the earlier web
  work and ignored. If it meant something, it was never built.

## 4. The thing that actually blocks progress

**The app has no content in it.** `prisma/dev.db` holds 1 track, 2 topics and
**zero tasks and zero check-ins**. There is nothing to check into, so the core
loop cannot be exercised at all.

This blocks two roadmap items on its own:

- **Learning trajectory view** (Phase 2). The roadmap explicitly wants its shape
  chosen against real accumulated data rather than guessed. There is none.
- **LLM insight remarks** (Phase 3). The PRD names generic filler as a failure
  condition, and remarks generated over an empty database would be exactly that.

If the user wants to move forward on either, the highest-leverage thing is for
them to put real tracks and tasks in and check in for a few days. Say so plainly
rather than building against an empty database.

## 5. Phase 3 is next, and needs two things from the user

Phase 3 is Smart Coverage & Insights. Its first item — an LLM-suggested
curriculum when a Track is created — needs no accumulated history and is
genuinely startable. It would also fix the cold-start problem above: creating a
track currently hands you an empty box.

Verified prerequisites, all currently missing:

- **No `ANTHROPIC_API_KEY` in `.env`.** The user has to supply it.
- **No `@anthropic-ai/sdk` installed**, and no `lib/llm/` directory.
  `CLAUDE.md` says keep the dependency footprint small; these calls are one-shot
  JSON in / JSON out, so plain `fetch` would avoid a new dependency. Ask.
- **`InsightLog` is specced in `docs/SCHEMA.md` but not in `prisma/schema.prisma`.**
  Phase 3 needs a migration for it.

**Load the `llm-call-conventions` skill before writing any Anthropic API code** —
it is a project skill and exists for exactly this.

## 6. Known issues and traps

- **The `.next` corruption has a specific cause, and it is not only dev/build
  switching.** `next dev` spawns a `next-server` child; killing the parent, or
  killing by port, leaves that child alive still writing `.next`. Two of them
  sharing the directory produces
  `TypeError: __webpack_modules__[moduleId] is not a function` and 500s on every
  page. One survived a whole session and poisoned every server started after it.
  Before starting a server, check by hand:

  ```
  ps -eo pid,args | grep -E "[n]ext-server|[n]ode_modules/\.bin/next"
  ```

  The `[n]` matters — a plain `pgrep -f next` or `pkill -f "next dev"` **also
  matches the shell running that command**, which kills your own shell mid-script
  and looks like an unrelated failure. This cost real time twice today.
  Full write-up in `qa/README.md`.

- **Never point a dev server at `prisma/dev.db`.** Copy it somewhere scratch and
  set `DATABASE_URL` to the copy. That is the user's own data.

- **`qa/` is in the repo now** and should stay there — it was rebuilt from a
  temporary folder three sessions running before that. `qa/cdp.mjs` drives the
  Playwright-bundled Chromium over CDP (the Playwright MCP server does not work
  on this machine — it wants a Chrome at `/opt/google/chrome` that is not
  installed). `./qa/run-tests.sh` runs the logic suites.

- **The effects are transients that remove themselves on a JS timer.** Pausing
  their CSS animation does **not** stop that timer, so a screenshot taken a
  moment later catches nothing. Freeze them by seeking — the recipe is in
  `qa/README.md`.

- **A single sampled read will miss them.** A strike is visible for about two
  seconds but a shatter is gone in under half of one. Poll in a
  `MutationObserver` or an interval; a fixed `sleep` lands between frames more
  often than on them.

## 7. Immediate next step

**Ask the user which direction they want, and do not start building until they
answer.** There are three live options and they lead to very different work:

1. **Phase 3** — blocked until they provide an `ANTHROPIC_API_KEY` and choose
   SDK versus plain `fetch`. Start with the curriculum suggestion.
2. **Use the app for real** — the honest prerequisite for the trajectory view
   and for insights that are not generic filler.
3. **More visual work** — this is what most of today was, and they have been
   iterating on it in short, specific passes.

Do **not** start the learning trajectory view. It is the last open Phase 2 item
and it is deliberately sequenced last, against real data that does not exist yet.
