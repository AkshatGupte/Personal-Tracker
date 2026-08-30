# Development Report

This is a running log of what's been built, explained in plain language.
Newest entries are at the top. See `docs/RULES.md` for the format Claude
Code follows when adding to this file.

---

## 2026-08-30 — Terrain redesign, accessibility fixes, and Topics

**What was built:**
Rendred now shows your progress as a landscape. The more tasks you finish, the
higher the ground rises, and the line is drawn from your real records rather
than decoration. There is also a proper page for each Track, where you can add
the topics inside it. Along the way, several things that were quietly
inaccessible were fixed.

**How the landscape works (flow):**
1. Every day you complete tasks, the app stores a count for that day.
2. The page adds those counts up over the last 12 weeks, so the line only ever
   climbs, and its height is the total work you have done.
3. Horizontal bands sit at fixed heights. When you work fast the line crosses
   several bands quickly and they bunch together, so a steep stretch reads as a
   burst of effort. Nothing extra is calculated to produce that.
4. Milestones (10, 50, 100 and up) are marked at the exact day you passed them.
   A milestone you have not reached is simply not drawn.
5. With nothing completed, the ground is flat and the page says so. It never
   draws a climb that did not happen.

**Three things kept separate, on purpose:**
- **How much** you have done is the landscape height.
- **How consistently** you show up is the streak count and the activity grid.
- **Finishing something** is the completion colour, which until now was defined
  in the design but never actually used anywhere.

**The Track page:**
Clicking a track opens its own page: the track's landscape and streak at the
top, its topics on the left, and completion and consistency on the right. You
can add, rename and delete topics, and deleting warns you if tasks would go
with it. This layout is the pattern the task screens will reuse.

**Accessibility problems fixed:**
- **Nothing showed a focus outline.** All eight buttons and both text boxes had
  no visible indicator, so anyone navigating by keyboard could not tell where
  they were. Every control now shows a clear ring.
- **The charts were silent to screen readers.** The ring and the activity grid
  now describe themselves in plain sentences with the real numbers.
- **Day counts were mouse-only.** The activity grid's per-day figures were in
  hover tooltips, unreachable by keyboard or touch. There is now a "Day by day"
  list containing the same information as text.
- A zero streak was being highlighted in the achievement colour, which implied
  an achievement that had not happened. It is now muted.

**Technical concepts used:**
- Cumulative totals - each day adds to the running count, so the line only rises
- SVG drawing - the landscape is a real drawn shape, sharp at any size
- `:focus-visible` - shows the outline for keyboard users without adding a ring
  on every mouse click
- Server Actions - adding and renaming topics talks straight to the server
- Playwright checks - both themes, desktop and phone, a click-through of adding
  and deleting a topic, a keyboard walk confirming every control shows focus,
  and a check that reduced motion turns all animation off

**Roadmap status:** Phase 1, item 4 ("CRUD: add Topic under Track") marked [x]
complete in `docs/ROADMAP.md`. `CLAUDE.md` was updated to record the terrain
rules and the new streak colour. Screenshot data was deleted, so the database
is empty.

---

## 2026-08-30 — Rebuilt to the dark dashboard reference

**What was built:**
The app was restyled again to match the new reference image: a top navigation
bar, a large greeting, and three glowing cards — a circular progress ring, a
12-week activity grid, and a summary panel — above the Tracks list. It has
real depth now: a soft coloured glow drifts slowly behind the page, a faint
grid runs across the background, and the cards catch a little light on their
top edge. Dark (black/purple) is the main look; light (blue/white) is still
there via the same toggle.

**How it works (flow):**
1. The page asks the database for your tracks, how many tasks exist, how many
   are finished, and the daily completion history.
2. The ring is drawn as a real shape whose length is set by the actual
   percentage — it draws itself in when the page loads.
3. The activity grid lays out the last 12 weeks, one small square per day,
   shaded by how many tasks were finished that day. It reads real records,
   so today it is empty until you start completing things.
4. The glow and grid sit behind everything in a fixed layer, so scrolling
   never disturbs them.
5. Everything still runs off the same named colour slots, so both themes work
   without writing any screen twice.

**What was deliberately not copied:**
The reference shows XP points, levels, achievements, a search box, a profile
picture and a "Next Up" suggestion. None of those are in the plan — and the
app is specifically not meant to decide what you should study next. So rather
than invent numbers, the same card shapes were pointed at data that genuinely
exists. Sections that do not exist yet appear in the menu greyed out with a
"soon" tag instead of pretending to be links.

**Problems found and fixed while checking:**
- **Reduce-motion was half-done.** Turning on the system "reduce motion"
  setting shortened the animations but did not remove their *delays* — so
  parts of the page stayed invisible for a third of a second before snapping
  in, which is the opposite of what that setting is for. Now nothing is
  delayed and nothing animates.
- **The empty ring showed a dot.** At 0% the rounded end of the line still
  painted a small mark, which looked like a sliver of progress that was not
  real. It now draws nothing at 0%.
- One screenshot showed a red "1 Issue" badge; that turned out to be a
  temporary reload artefact, not a fault — a clean production build shows no
  errors at all.

**Technical concepts used:**
- Design tokens — one set of named colours, swapped per theme
- SVG drawing — the ring and the activity grid are drawn shapes, so they can
  animate and stay sharp at any size
- `prefers-reduced-motion` — the browser setting for people who find movement
  uncomfortable; all animation is disabled when it is on
- Playwright checks — screenshots in both themes at desktop and phone size,
  a click-through re-test of adding/renaming/deleting a track, and a
  measurement proving the animations actually run and then stop

**Roadmap status:** no roadmap item changed — this was a visual direction
change, not a Phase 1 feature. Item 3 (create/edit/delete Track) was
re-tested afterwards and still works. Phase 1 item 4 (add Topic under a
Track) is next. Demo data used for the screenshots was deleted, so the
database is empty.

---

## 2026-08-30 — Create, rename and delete Tracks

**What was built:**
You can now actually use the app. Type a name, press Add, and a Track appears
in the list. Each track can be renamed in place, or deleted — and deleting
asks first, spelling out exactly what else will disappear with it. The counts
in the Status panel update as you go.

**How it works (flow):**
1. You type a name and press Add → the browser sends it straight to the
   server, with no page reload.
2. The server checks the name is not blank and not too long. If it is, the
   form shows a short message and nothing is saved.
3. If the name is fine, a new Track row is written to the database.
4. The page is told its data is stale, so it re-reads from the database and
   the new track appears in the list with the counts updated.
5. Rename works the same way. Delete first swaps the row into a confirmation
   that names what will be removed, and only deletes once you confirm.

**Why delete asks first:**
Deleting a Track also deletes every Topic, Task and daily record underneath
it — that is built into the database and cannot be undone. So the
confirmation names them: "Delete DSA and its 2 topics and 2 tasks?" If a
track is empty, it just asks about the track.

**What was checked:**
- Adding a blank name is refused, and no track is created
- Two tracks created, renamed, and one deleted — the list and the counts
  tracked each change correctly
- Renaming to a blank name is refused and leaves the original name alone
- Cancelling a delete leaves everything untouched
- The cursor does not get grabbed by the name box when the page loads, but
  does return to it after adding, so several tracks can be typed in a row
- Checked in both light and dark themes; no errors in the browser console

**Technical concepts used:**
- Server Actions — the form talks directly to the server without a separate
  API layer, so validation and saving happen in one place
- Cascade delete (already in the database) — removing a Track cleans up
  everything belonging to it automatically
- Revalidation — after a change, the page is marked stale so it re-reads
  fresh data instead of showing a cached copy
- Playwright click-through test — a script that actually types, clicks and
  confirms, rather than only reading the code

**Roadmap status:** Phase 1, item 3 ("CRUD: create/edit/delete Track") —
marked [x] complete in `docs/ROADMAP.md`. Test data created during checking
was deleted afterwards, so the database is empty.

---

## 2026-08-29 — Redesigned to the dashboard reference (light + dark themes)

**What was built:**
The whole look of the app changed. The earlier "trail map" style — dark green
background with contour lines — is gone, replaced by the clean card-based
dashboard from the reference images you sent. It now comes in two themes:
blue-on-white for light, purple-on-black for dark, with a button in the corner
to switch between them. Your choice is remembered.

**How it works (flow):**
1. All the colours are defined once as named slots — "page background",
   "card", "main text", "accent" — rather than written into each screen.
2. Picking a theme swaps what colour each named slot points at. Every screen
   updates automatically, because no screen knows an actual colour.
3. A tiny script runs before the page is drawn, checks what you chose last
   time, and applies it immediately — so you never see a flash of the wrong
   theme while the page loads.
4. If you have never chosen, it follows your computer's own light/dark setting.
5. The home page reads live counts of tracks, topics and tasks straight from
   the database — the first time the app has actually talked to the database.

**Two problems found by looking at it:**
- **Words ran together.** The new font, Plus Jakarta Sans, has an unusually
  narrow space character — measured at about two-thirds the width of a normal
  font's space. "SQLite via Prisma 7" read as "SQLite viaPrisma 7". Widened
  the gap slightly to fix it.
- **Colours failed readability.** The first colour set was checked before any
  screen was built, and eight combinations were too faint to read against
  their background. They were corrected before writing any UI, rather than
  after.

**Technical concepts used:**
- Design tokens — colours stored as named slots instead of fixed values, so
  one switch restyles the whole app
- Theme persistence — the choice is saved in the browser so it survives
  closing the tab
- Contrast checking — every text/background pair measured against the 4.5:1
  readability standard, in both themes, before building
- Playwright screenshots in both themes, plus a click-test proving the toggle
  overrides the system setting and survives a page reload

**Roadmap status:** no roadmap item changed. This was a change of visual
direction, not a Phase 1 feature. Phase 1 item 3 (create/edit/delete Track)
is still the next thing to build. `CLAUDE.md` was rewritten so its design
section matches what was actually built.

---

## 2026-08-29 — Database tables created (Track, Topic, Task, CompletionLog)

**What was built:**
The app now has real database tables. It can store learning goals ("Tracks"),
the topics inside them, the individual tasks inside those, and a per-day tally
of how many tasks were finished. Nothing in the app writes to these yet — the
buttons and screens come next — but the structure they will write into exists
and has been tested.

**How it works (flow):**
1. The tables are described in one file, `prisma/schema.prisma`, in plain
   readable terms rather than database code.
2. Running a migration (a recorded, repeatable change to the database
   structure) turned that description into actual tables in `prisma/dev.db`,
   a single file on your machine.
3. The migration is saved in `prisma/migrations/` so the exact same structure
   can be rebuilt from scratch later.
4. A throwaway test then created a track with a topic and a task, checked the
   safety rules held, and deleted it again — leaving the database empty.

**What the test confirmed:**
- A new Track correctly starts at streak 0 with no recorded activity
- A new Task correctly starts as "pending"
- The database **refuses** a second daily tally for the same track on the same
  day — this is what keeps streak counting honest
- Deleting a Track automatically removes its topics, tasks and daily tallies,
  so nothing is left orphaned

**Technical concepts used:**
- Migration — a saved, replayable instruction for changing the database
  structure, so the database can always be rebuilt to match the code
- Unique constraint — a database-level rule that blocks duplicate rows; used
  here to guarantee one tally per track per day
- Cascade delete — when a Track is deleted, everything belonging to it is
  deleted too, automatically
- Indexes — lookup shortcuts so finding "all topics in this track" or "all
  pending tasks" stays fast as data grows

**Roadmap status:** Phase 1, item 2 ("Prisma schema from docs/SCHEMA.md") —
marked [x] complete in `docs/ROADMAP.md`. `docs/SCHEMA.md` was updated to
record the constraints and defaults added while building it.

---

## 2026-08-29 — Visual QA pass on the scaffold (typography fix)

**What was built:**
Checked the scaffold screen in a real browser instead of trusting that the
code was right — and found the fonts were not working at all. Every heading,
label and number was falling back to the plain system font, so none of the
project's chosen typefaces were showing. Fixed that, made the faint background
lines actually look like a contour map, and lightened the muted grey so
secondary text is readable.

**How it works (flow):**
1. Started the app, opened it in an automated browser, took screenshots at
   desktop and phone widths.
2. Compared the screenshots against the "Visual Design Direction" in
   CLAUDE.md → spotted that the headline was not a serif and the numbers were
   not monospaced.
3. Asked the browser what fonts it had actually loaded → it reported none,
   confirming the styling tool had silently discarded all three font settings.
4. Fixed the cause, re-took the screenshots, and confirmed all three typefaces
   now load and apply.

**What was wrong, in plain words:**
- **Fonts:** Tailwind (the styling tool) has two ways to declare a setting.
  One of them quietly fails if the setting points at another setting — which
  is exactly what font settings do here. All three fonts were declared the
  wrong way, so they were thrown away without any error message. Only looking
  at the page revealed it.
- **Contour lines:** they were evenly spaced wavy lines that read as generic
  decoration. Replaced with real nested elevation rings around two summits,
  spaced tight-then-wide the way a real map shows steep ground flattening out.
- **Readability:** the muted grey from the design brief measured 2.86:1
  against the dark background — below the accessibility minimum of 4.5:1 — so
  the tagline and labels were genuinely hard to read. Lightened to 5.84:1.

**Technical concepts used:**
- Playwright (software that drives a real browser automatically) — used to
  load the page and capture screenshots without a human clicking
- Contrast ratio check — a standard measure of whether text is legible
  against its background; anything under 4.5:1 fails for normal text
- Screenshot comparison at 500 milliseconds — proved the contour animation
  genuinely draws in over time, and that turning on the system's
  "reduce motion" setting skips it and shows the finished state instantly

**Roadmap status:** still Phase 1, item 1 — this was a correction to work
already marked complete, not a new item. No roadmap checkbox changed.

---

## 2026-08-29 — Project scaffold (Next.js + Tailwind + Prisma + SQLite)

**What was built:**
The empty shell of the app now exists and runs. There is a working web page
with the project's own visual style — dark ink background, warm off-white
text, and faint contour lines like a topographic map — plus a database
connection wired up and ready for real data. Nothing can be tracked yet; this
is the foundation everything else sits on.

**How it works (flow):**
1. You run `npm run dev` → Next.js (the web framework) starts a local server
   at `http://localhost:3000`.
2. Next.js loads the root layout, which pulls in three typefaces — a serif for
   headings, a plain sans for reading, and a monospace one reserved for
   numbers and dates so they read like data.
3. The page draws the contour-line background, which traces itself in once on
   load, then stops. If your system is set to reduce motion, it skips the
   animation entirely.
4. Separately, the app can now open a SQLite database — a single file on disk
   at `prisma/dev.db` — through a shared connection kept in `lib/prisma.ts`.
   Nothing reads or writes to it yet, because no tables are defined until the
   next step.

**Technical concepts used:**
- Next.js 15 with the App Router (the web framework that turns files into
  pages) — pinned to version 15 because it works properly on your Node 26
- Tailwind CSS v4 (a styling tool where colours and fonts are defined once as
  named tokens) — used to define the trail palette so no screen has to
  hand-pick colours
- Prisma 7 (a tool that lets code talk to the database without writing raw
  SQL) — set up pointing at SQLite, with tables still to come
- Driver adapter (`@prisma/adapter-better-sqlite3`) — Prisma 7 no longer talks
  to SQLite directly, it needs this small piece in between
- Shared database connection in `lib/prisma.ts` — stops the app opening a new
  connection every time you save a file during development
- SVG `pathLength` — normalises every contour line to the same length so one
  animation setting draws them all correctly

**Roadmap status:** Phase 1, item 1 ("Project scaffold: Next.js + TypeScript +
Tailwind + Prisma + SQLite") — marked [x] complete in `docs/ROADMAP.md`. The
Prisma schema itself (item 2) is deliberately still empty.

---
