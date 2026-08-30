# Decisions Log

Running record of decisions made, so future Claude Code sessions (and you)
don't re-litigate them. Append new entries at the top with a date.

---

**2026-08-30 — Terrain is the progress metaphor, and it is data-driven**
Elevation is cumulative completed tasks read from `CompletionLog`. Pace is not
a separate metric: strata sit at fixed elevations, so a steep climb crosses
several within a short span and they bunch. Milestones are drawn only at the
day they were actually crossed. No completions renders a flat baseline and says
so. The maths lives in `lib/terrain.ts` as pure functions so the mapping can be
checked without rendering anything.

**2026-08-30 — Three progress signals stay separate**
Volume is terrain elevation in `accent`. Consistency is the streak count and
heatmap in `streak`. Completion is the finished state in `positive`, which had
zero usages before this change, which is why nothing in the app ever read as
done. No XP, levels, points or badges: the PRD does not define them.

**2026-08-30 — Ember replaces the previous streak colour**
`#E3A857` in dark. It measures 2.10:1 on the light ground, so light uses a
deepened ember `#9A6212` (4.79:1). Ember marks streaks and milestones only; a
zero streak renders muted, because ember should signal real achievement.

**2026-08-30 — Ambient glow retired**
The drifting gradient blobs carried no data. The terrain gradient now provides
the light and the ruled grid stays as ground. Do not reintroduce the blobs.

**2026-08-30 — Focus rings are defined once, globally**
Every interactive control had no `:focus-visible` styling at all. The ring is
now declared once in the base layer. Note that Tailwind's `outline-none`
utility silently defeats it, so inputs must not carry that class.

**2026-08-30 — Track screen established at `/tracks/[id]`**
The IA exposed only Track level; Topics and Tasks had no surface. The Track
screen is the reusable pattern future Topic and Task work builds on:
overview and terrain, then Topics beside Completion and Consistency.
`InlineCreateForm` is shared by tracks and topics and is ready for tasks.

**2026-08-30 — Visual direction changed again, to a dark neon dashboard**
The user supplied a second reference (top nav, greeting hero, glowing stat
cards, progress ring, streak heatmap) and asked to follow it. CLAUDE.md's
"Visual Design Direction" was rewritten again. Supersedes the 2026-08-29
"dashboard template" entry below, which itself superseded the trail direction.
Dark black/purple is now the primary look; light blue/white remains as the
second theme. The two-theme token architecture was kept — only the values and
the card language changed.

**2026-08-30 — Depth is a requirement, not decoration**
The user explicitly asked that it not look like "basic black/purple". The
ambient drifting glow, the ruled grid pattern, the lit card edges and the
drawn-in ring are therefore part of the spec, not optional polish. They are
listed under "Depth and pattern" in CLAUDE.md. Removing them regresses the
design.

**2026-08-30 — Reference features that were NOT built**
The reference shows XP, levels, achievements, a search box, a user avatar and
a "Next Up" recommendation. None appear in `docs/PRD.md`; auto-suggesting what
to study next is an explicit PRD non-goal, and avatars/accounts conflict with
the single-local-user decision. The visual language was adopted and mapped
onto real data instead: the ring shows real task completion, the heatmap reads
real CompletionLog rows, and unbuilt sections appear in the nav as disabled
"soon" chips rather than dead links.

**2026-08-30 — reduce-motion must cancel delays, not just durations**
The first reduced-motion block overrode `animation-duration` and
`iteration-count` but not `animation-delay`. Staggered entrances start at
opacity 0, so content stayed invisible until its delay elapsed — the opposite
of the intent. `animation-delay: -1ms` and `transition-delay: 0s` are now part
of that block. Verified: zero animations running 150ms after load.

**2026-08-29 — Visual direction changed to a dashboard template (reverses the
trail/topographic direction)**
The user supplied a minimal habit-tracker dashboard as the reference and asked
to follow it. This reverses the earlier trail/contour direction entirely: the
topographic metaphor, the moss/amber palette and the Fraunces/Plex type pairing
are gone, and `components/ContourField.tsx` was deleted. CLAUDE.md's "Visual
Design Direction" section was rewritten to match, so future sessions do not
drift back. Superseded: the 2026-08-29 entry "Design system follows CLAUDE.md's
trail metaphor" below.

**2026-08-29 — Two themes from one token set**
Light is blue/white, dark is black/purple. Components reference semantic tokens
(`bg`, `surface`, `fg`, `muted`, `accent`, …) and never a raw hex or a `dark:`
variant; the theme swaps the values. Choice persists in localStorage, falls back
to the system preference, and is applied by a tiny inline script before first
paint so the page never flashes the wrong theme.

**2026-08-29 — Palette corrected for contrast before any UI was written**
The first draft of the new palette failed 4.5:1 in eight places: light
`streak`/`positive` on all three grounds, and dark `accent` on surface and
elevated. Shipped values are light streak `#0369A1`, light positive `#047857`,
dark accent `#A78BFA`. All pairs now pass in both themes.

**2026-08-29 — Body text carries a small word-spacing nudge**
Plus Jakarta Sans has an unusually narrow space glyph (0.188em measured, against
~0.278em for Arial), which made running text read as though words were joined.
`body` sets `word-spacing: 0.06em` to compensate. Do not remove it without
re-checking how body copy reads.

**2026-08-29 — Dashboard widgets wait for their phase**
The reference shows weekday grids, percentage rings and a progress chart. Those
are Phase 2+ and need data that does not exist yet, so the design system was
applied only to real screens. No widget is filled with invented numbers.

**2026-08-29 — Schema constraints added beyond docs/SCHEMA.md**
Building the Prisma schema required decisions the spec did not state, so
`docs/SCHEMA.md` has been updated to match the implementation (per the rule in
the prisma-conventions skill). Specifically: cascade delete on every child
relation so deleting a Track cannot orphan Topics/Tasks/logs; a
`@@unique([trackId, date])` on CompletionLog to actually enforce the
documented "one row per track per day"; sensible defaults (streaks 0, status
"pending", isExpected false); `lastActivityDate` made nullable since a new
track has no activity; and indexes on foreign keys plus `Task.status`.

**2026-08-29 — Dates and enums are stored as DateTime/String**
SQLite has no dedicated date or enum type, so all date fields are `DateTime`
and `status`/`difficulty` stay strings validated in application code, exactly
as docs/SCHEMA.md specifies.

**2026-08-29 — Muted text colour lightened for contrast**
CLAUDE.md specifies cool slate `#5C6B66` for muted/secondary text, but on the
`#1C2321` ground that measures 2.86:1 — below the 3:1 floor for even large
text. Using `#8FA09A` instead (5.84:1, passes AA). The rest of the palette is
unchanged and all of it passes. Recorded here because it is a deliberate
deviation from the brief, made for legibility, not taste.

**2026-08-29 — Font tokens must use `@theme inline`**
In Tailwind v4, a `@theme` token whose value contains `var()` becomes invalid
at computed-value time and silently kills every utility built from it. Because
the font tokens reference next/font's variables, they must be declared in
`@theme inline`. Getting this wrong disabled all three typefaces with no error
anywhere — it was only caught by looking at a screenshot. Colour tokens stay
in the plain `@theme` block so `--color-*` remains available to SVG strokes.

**2026-08-29 — Visual QA runs against a real browser, not the MCP server**
The project's `playwright-visual-qa` skill expects the Playwright MCP server,
which is configured for the `chrome` channel and fails here because only
Chromium is installed. QA is instead run with a short Playwright script from
the scratchpad, so no browser-automation dependency is added to the project.
Adding `--browser chromium` to the MCP server args in `~/.claude.json` would
fix the MCP path if that is ever preferred.

**2026-08-29 — Docs live in `docs/`**
CLAUDE.md and RULES.md already referenced `docs/PRD.md`, `docs/ROADMAP.md`
etc., but the files sat in the project root. Moved them into `docs/` so the
existing references resolve. CLAUDE.md stays at the root, where it is
auto-read from.

**2026-08-29 — Next.js pinned to 15.x (not 14, not 16)**
CLAUDE.md specifies "14+". Chose 15.5 because Node 26 is installed locally and
14 is not reliable on it. Ships with React 19 and Tailwind v4.

**2026-08-29 — Prisma pinned to exactly 7.10.0 (both packages)**
`npm install prisma@latest` resolves to an `8.0.0-rc` prerelease, while
`@prisma/client@latest` resolves to stable 7.10.0 — installing both with
`@latest` produces mismatched majors. Both are pinned with exact versions.
Do not run `npm update` on these without re-checking the pair still matches.

**2026-08-29 — SQLite reached through a driver adapter**
Prisma 7 no longer speaks to SQLite directly; it requires a driver adapter, so
`@prisma/adapter-better-sqlite3` is a required dependency, not an optional
extra. It compiles a small native binary on install.

**2026-08-29 — No `dotenv` dependency**
Prisma's generated config assumes `dotenv`. Replaced with Node's built-in
`process.loadEnvFile()`, which Node 26 supports, keeping the dependency count
down per CLAUDE.md.

**2026-08-29 — Design system follows CLAUDE.md's trail metaphor**
Palette and type roles are defined once as tokens in `app/globals.css`.
Typefaces: Fraunces (display, used sparingly), IBM Plex Sans (body), IBM Plex
Mono (all numbers, streaks and dates). The topographic contour motif in
`components/ContourField.tsx` is the shared vocabulary the streak/progress
visuals will extend — progress should read as a route traced across terrain,
not a filled bar.

**2026-08-29 — Tech stack locked**
Next.js + TypeScript + Tailwind + Prisma + SQLite + Anthropic API
(claude-haiku for LLM calls). Reason: zero/near-zero cost, proven for
solo/small-scale projects, minimal ops overhead.

**2026-08-29 — Streaks are strict, not forgiving**
A missed day resets the streak to 0. No streak freezes or grace periods.

**2026-08-29 — Progress unit = tasks completed**
Progress is measured by discrete completed tasks (e.g. DSA questions
solved), not time spent or self-reported vague check-ins.

**2026-08-29 — Multiple parallel tracks supported**
Not limited to a single goal — user can run several tracks simultaneously
(e.g. DSA + Spanish + Guitar).

**2026-08-29 — Goals are user-defined, not hardcoded**
Track → Topic → Task hierarchy is fully user-created, with LLM-assisted
curriculum suggestions rather than pre-built subject templates.

**2026-08-29 — System is not agentic**
All LLM usage is one-shot/stateless. No autonomous multi-step planning or
background agents in MVP or foreseeable near-term scope.

**2026-08-29 — Personalization deferred to Phase 4**
Favorites/preferences-based tone adaptation is a real planned feature but
explicitly out of MVP scope — it's a prompt-layer addition, not a
structural one, so it's safe to defer.
