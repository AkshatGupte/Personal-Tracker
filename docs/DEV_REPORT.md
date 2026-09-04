![alt text](image.png)# Development Report

This is a running log of what's been built, explained in plain language.
Newest entries are at the top. See `docs/RULES.md` for the format Claude
Code follows when adding to this file.

---

## 2026-09-04 — Monthly progress, beside the weekly one

**What was built:**
The Progress page can now be read a month at a time as well as a week at a
time. There is a small Weekly / Monthly switch at the top; picking Monthly shows
how many tasks you finished this month, a little calendar of the month with the
active days filled in, each track's total for the month, and a list of the last
six months. Weekly is still what you get by default and is unchanged.

**How it works (flow):**
1. You click "Monthly". That is an ordinary link — it takes you to
   `/progress?period=month` rather than changing anything in the page.
2. The page reads that one word out of the address and picks the set of date
   ranges to use: eight weeks, or six months.
3. Those ranges go to the same counting code the weekly view already used. That
   code never knew what a week was — it just walks a range from its first day to
   its last and counts what is in the database — so handing it months needed no
   new counting logic at all.
4. The same numbers come back, and the page swaps its wording ("since Monday"
   becomes "so far this month", "By week" becomes "By month").

**Technical concepts used:**
- **Date ranges built from the calendar, not from a fixed number of days** —
  months are 28 to 31 days long, so stepping back "30 days" six times drifts off
  the first of the month and eventually the labels name the wrong months. The new
  `monthBuckets` walks real calendar months instead.
- **A guard against the classic month-maths bug** — asking a computer for "one
  month after the 31st of January" usually gives you the 2nd or 3rd of March,
  because the 31st of February does not exist and it quietly rolls over. The new
  helper always builds the *first* of a month, which has nowhere to roll to.
  Checked with a test covering that case, leap-year February, and the year
  boundary.
- **The choice lives in the web address** — so the page still needs no
  JavaScript sent to the browser (it stayed at 180 bytes), the view can be
  bookmarked and reloaded, and a hand-typed nonsense value quietly falls back to
  the weekly view instead of breaking.
- **One day-grid component instead of two** — the week strip became a period
  strip. It is always seven columns wide: a week is one row, a month is five or
  six rows with the days before the 1st left blank, so it reads as a small
  calendar. A month drawn as a single row of 31 squares was tried first and the
  squares were too small to read.

**Roadmap status:** completes "Monthly summary view" in Phase 2 of
`docs/ROADMAP.md`. Phase 2 now has two items left: the milestone celebration
(waiting on one decision) and the learning trajectory view (waiting on real
check-in data).

---

## 2026-09-04 — The spider webs, and a much tighter home page

**What was built:**
The web decoration around the app was rebuilt so it actually looks like spider
webs, and the home page was tightened up — it is now about a quarter shorter,
with far less empty space between the masthead, the elevation figure and the
Tracks box. Webs now appear in the four corners of the Tracks box, in the four
corners of the window itself, and hanging from the two dividing lines.

**How it works (flow):**
1. Every web is drawn from a "seed" — a starting number. The same seed always
   draws exactly the same web, which matters because these are drawn on the
   server: a web that came out differently in the browser than on the server
   would be reported as an error.
2. A web is built by putting a hub in the corner, running straight threads out
   from it, and then hanging curved threads between neighbouring ones. The
   curved threads sag back toward the hub, which is the detail that separates a
   spider web from a wheel.
3. The seed decides how many threads, at what angles, and how long each one is.
   For the Tracks box that variation is switched off, so all four corners match.
   For the window corners it is turned up, so all four differ.

**Technical concepts used:**
- **The bug that made them look like triangles** — the hub was being nudged
  inward from the corner while the threads still ran their full length, so the
  outer edge of the web fell outside the square it was drawn in and got cut off.
  What survived the cut was a few long straight lines. Pinning the hub to the
  corner means the web always fits, so every ring is drawn.
- **Variation measured against the gap, not the whole quarter-turn** — the
  earlier version could shove three threads on top of each other and leave a
  bare wedge next to them, which reads as a handful of lines no matter how many
  rings cross it.
- **Decoration that does not take up space** — the webs hanging from the two
  dividing lines used to reserve 88 pixels of page height each. They now hang
  outside their own box, so they cost almost no layout while looking the same.
  That alone was most of the gap above the Tracks panel.
- **Two long-standing layout bugs in the elevation strip** — its box was coming
  out 322 pixels tall instead of the intended 192, because the drawing inside it
  was falling back to its own natural proportions; and a flexible-layout rule
  meant it refused to shrink to fit however the height was written. Both are
  fixed, which is the other half of the space saved.
- **A screenshot tool that now lives in the repo** (`qa/`) — it drives a real
  browser to take pictures of the app and check nothing overflows the screen
  width. It had been rebuilt from scratch three sessions running because it was
  only ever kept in a temporary folder.

**Roadmap status:** no roadmap item — this is the Spider-Verse visual direction
recorded in `CLAUDE.md`, not a Phase 2 feature.

---

## 2026-09-03 — The check-in moment: one act, one piece of feedback

**What was built:**
Checking in now tells you what it *did*. Before, tapping a task quietly changed
five things on the page — the tick, the topic tally, the elevation, the streak
and the ring — each redrawing when its own number happened to move, so one act
looked like five unrelated twitches. Now the tap produces a single statement
beside the task ("Checked in · streak 4 days · longest yet"), and the one
measurement that statement is about is briefly marked. The underlying model is
unchanged: activities are still permanent and recurring, the same activity is
still checked in on many different days, and that daily record is still the only
thing the app treats as true.

**How it works (flow):**
1. You tap the tick. It flips immediately and its coloured plates split apart —
   this does not wait for anything, so the app always answers instantly.
2. The tap is saved, and the app compares your streak from just before the save
   with your streak just after. That comparison is the whole definition of
   "extended a streak" — there is no separate tally being kept.
3. That comparison comes back as one of four plain outcomes: **started** (a
   streak begins), **extended** (it grew), **recorded** (the day was already
   counted, so the streak stayed put), or **withdrawn** (you untapped).
4. A short line appears next to the task saying which of those happened, and
   quoting the real numbers. It deliberately waits for the answer to come back
   — that small pause is what makes everything after it read as *caused by*
   your tap rather than as a second thing that also happened.
5. Exactly one number at the top of the page is then emphasised: the streak if
   the streak moved, otherwise the elevation. Everything else simply arrives at
   its new value without performing.
6. The line clears itself after about four seconds, and tapping anything else
   clears it at once, so it never gets in your way.

**Beating your record is part of the same sentence:**
When a check-in sets a new longest streak, the line says "· longest yet" and
that is all. No second number lights up and nothing is awarded. Personal bests
were the most obvious place a points-and-badges layer could have crept in, and
it deliberately did not.

**What the numbers still come from:**
Nothing new is stored and nothing is duplicated. The daily record remains the
source of truth; the daily totals, streaks, rising ground, heatmap and weekly
summary are all still worked out from it. There was no database change. The one
thing that changed is that the app now *reports* a value it was already
calculating and previously threw away.

**Looks and motion:**
Built entirely from what the theme already had — the existing colours keep their
existing meanings (yellow for streaks, cyan for a day recorded, magenta for
volume), the existing typefaces, and the existing short, snapped animation
style. No new colour, glow, badge or icon. One fix was needed along the way: the
streak number already sits in streak-yellow, so marking it *in* yellow did
nothing at all and the whole outcome was riding on a three-pixel nudge. A number
already resting in a colour now briefly drops to plain white instead, which
reads as a printing plate slipping — the same idea the rest of the design is
built on.

**Reduced motion:** every part of this respects it. With motion turned down the
movement stops and the words, colours and tick state carry the whole message,
so nothing is communicated by animation alone.

**Verified:** 41 automated checks driving a real browser against a test copy of
the database, all passing, run twice in a row with identical results. They cover
all four outcomes; a personal best and a check-in that is not one; starting a
streak from nothing; restarting after a lapse; both kinds of untap — the one
that breaks today and the one that does not; a streak falling back to zero;
rapid repeated tapping; reduced motion; and the layout at desktop, 1280×720,
phone and 320px with no sideways scrolling and no browser errors. The real
database was never touched.

**No gamification added.** No points, levels, badges, coins, streak freezes,
reminders or daily targets. Streaks remain strict — a missed day still resets
to zero, with no forgiveness.

**Roadmap status:** completes "The check-in moment" in Phase 2 of
`docs/ROADMAP.md`. Still open in that phase: the monthly summary, milestone
celebration, and the learning trajectory view.

---

## 2026-09-01 — Daily check-ins: the same activity, every day

**What was built:**
Tasks are now the recurring activities they were always meant to be. "Practice
array problems" stays on your list forever, and each day you tap it to say you
did it today. Tomorrow it is waiting again, unticked. You never create the same
task twice, and it is never permanently finished.

**How it works (flow):**
1. Tapping a task writes one record: this activity, this day.
2. That record is the only thing the app treats as true. Everything else —
   your daily totals, your streak, the rising ground, the heatmap, the weekly
   summary — is worked out from those records.
3. Tomorrow the tick is empty again, because it asks "did I do this *today*",
   and today has changed.
4. Tapping twice in one day does nothing the second time. The database itself
   refuses a duplicate, so a double tap or a slow connection cannot log the
   same day twice.
5. Untapping removes only today. Every earlier day stays exactly as it was.

**The change to what the numbers mean:**
"4 of 8 done" used to count tasks you had finished — which, for activities you
repeat, would have climbed to 8 of 8 and stayed there forever. It now reads
"4 of 8 today" and starts empty each morning. That is the number the daily
habit actually lives on. The elevation figure now counts check-ins rather than
finished tasks, so the ground keeps rising for as long as you keep going.

**What happens when you delete something:**
You decided the history should be recalculated rather than left frozen, and
that is what it does. Deleting a task removes its check-ins and then rebuilds
every day it was part of — not just today. A day where that task was your only
activity disappears, and your streak recalculates honestly to match. Deleting a
whole topic does the same for all its tasks. Nothing is left behind pointing at
something that no longer exists.

**What was left alone:**
Streaks, the terrain, the heatmap and the weekly summary needed no changes at
all. They count *days you were active*, and they never cared whether you
repeated an activity or did a new one. That was checked rather than assumed.

**Existing data:**
The upgrade converts any task previously marked finished into a single check-in
on the day it was finished. This was tested against a copy of the database with
a deliberately awkward case — an activity completed at half past midnight,
which falls on the previous day in world time — and it filed under the right
local day.

**Verified:** 26 checks against the engine and 9 against the actual screen, all
passing. The same task across four separate days; yesterday not showing as
ticked today; five repeat taps changing nothing; undo touching only today;
history surviving repeated tick/untick; both delete paths rebuilding correctly;
and streaks, terrain and weekly totals still agreeing.

**No gamification added.** No points, levels or badges. The reward is the
streak, the rising ground, and the day being recorded.

**Roadmap status:** completes the daily check-in item in Phase 2. The
"check-in moment" item — making that tap *feel* like something — remains open.

---

## 2026-09-01 — Tasks are recurring, and the daily check-in is now written down

**What changed:** documentation only. No code was touched.

**The decision:**
A Task in Rendred is an ongoing activity you repeat — "Practice array
problems", "Read about binary trees" — not a one-off item you finish once and
tick off forever. The same Task stays on your list indefinitely and you check
in to it once a day. That daily check-in is what gets recorded. The Task itself
is never "done". There is no second kind of task and none is planned.

**Why this needed writing down:**
None of the planning documents said any of that. The word "recurring" did not
appear anywhere, and "check-in" did not either. The schema's own example of a
Task was *"Solve: Two Sum"* — a problem you solve once. So the app was built
for one-time tasks, which is not what it is for.

**What I checked before changing anything:**
I ran the real app against a task that had been checked yesterday. Tapping it
again today did **nothing at all** — no record for today. The only way to
register a second day was to untick it and tick it again, which nobody would
guess. And even then, the task forgets it was ever done yesterday: only a
running per-day total for the whole track survives, so "which days did I
practise Arrays?" cannot be answered.

There is also a quieter problem: the "4 of 8 done" figure counts tasks that are
finished. With activities you repeat, that reaches 8 of 8 and stays there
forever — a learning track that claims to be complete.

**The good news:** roughly half the existing machinery is already right.
Streaks, the heatmap, the rising terrain and the weekly summary all count *days
you were active*, and they do not care whether you repeated the same activity
or did a new one. Those need no changes. Only the per-task half is wrong.

**What was written down:**
- The recurring model and the daily check-in, in the product requirements
- A new record — one row per task per day — in the data plan, replacing the
  single "finished" flag a task currently carries
- Two new items on the roadmap: the check-in itself, and the moment of
  feedback that makes it worth doing again
- A note in the project's design rules that green no longer means "finished",
  it means "done today", and resets each morning

**One question left open, deliberately:** if you delete a Task, should the days
it contributed to be recalculated, or should that history stay frozen? Both are
defensible and they need different code, so it is flagged as blocking rather
than guessed at.

**No new gamification.** The reward for checking in is the streak, the rising
ground and the day being recorded. No points, levels or badges.

**Roadmap status:** adds two unstarted items to Phase 2 in `docs/ROADMAP.md`.

---

## 2026-09-01 — The dark band down the middle of the page

**What was wrong:**
The green day had a visibly darker rectangle running down the centre of the
page, exactly as wide as the column the text sits in. The background and the
interface looked like two different surfaces with a join between them, rather
than one environment.

**Why it was there:**
The text has to stay readable, so the middle of the page was being held dark.
Two separate things were doing that, both lined up on the same edge — the
background's own shading, and a mask over the whole 3D layer. Together they
drew a rectangle.

**How it was fixed:**
The dimming moved into the 3D layer itself, where it can be applied to the
bright objects alone rather than to everything. Now the background runs at one
even level right across the width, and only the glowing objects fade out as
they approach the text. The mask over the canvas remains but is so slight it
cannot be seen.

**Measured:** the difference in brightness between the edge of the screen and
the middle dropped from **5.3x to 1.6x** — near enough even that there is no
edge to see — while readability actually improved, to **5.58 against a 4.5 pass
mark**.

**Something else found along the way:**
The brightest thing over the text was never the big constructs — it was the
drifting specks. Three thousand of them, spread across the whole width, each
one faint but adding up. They held the page below the readability mark through
several rounds of adjusting everything else. They are now thinned over the text
and left alone everywhere else.

**Also fixed:** the sheet of light that forms the background was slightly too
small and stopped short of the screen edge on a wide monitor, leaving a paler
strip down the side.

**Roadmap status:** not a roadmap item — a fix to the daily atmosphere layer.

---

## 2026-09-01 — The ruled grid is gone

**What changed:**
The faint squared grid that sat behind every page is removed — on all four
routes and all five daily backgrounds, not just the green one. It was reading
as a mesh laid on top of the page rather than as the surface underneath it, and
on a wide screen it took over.

**Why it needed removing rather than adjusting:**
Earlier the same day it was re-tinted green so it would blend into the green
day. That was the wrong fix: it made the grid fit one background while leaving
it wrong on the other four, and the actual problem was never its colour — it
was that the pattern was simply too present.

**What holds the depth now:**
The background layers, the hairline rules that separate sections, the terrain's
own light, and on the green day the 3D scene. Nothing was added to compensate.

**A side benefit:**
The grid was the lightest thing sitting over the page background on every
route, so removing it makes the text slightly easier to read everywhere.

**Note:** this reverses a written rule. The project's design notes listed the
grid as required, so those notes were updated to match. The older entries in
`docs/DECISIONS.md` are left alone — they record what was true when written.

**Roadmap status:** not a roadmap item — a design change to the shared page
background.

---

## 2026-09-01 — The willpower day rebuilt in real 3D

**What was built:**
The green "willpower" day is now a real 3D environment rather than flat shapes
drawn on the page. Objects made of emerald light — a fist, a hammer, a sword, a
shield, a bow, a chain — build themselves out in the margins, hang there and do
one small thing, then come apart. A ring falls through the depth of the scene
trailing light and lands with a soft pulse. Behind all of it the background
itself is always moving. Nothing ever sits completely still.

**Why it was rebuilt:**
The first version was too static, and that was two separate faults. One was a
mistake I made: the objects appeared on very long timers, so the screen was
genuinely empty about four fifths of the time — a screenshot taken at random
showed a dark green grid and nothing else, because that is what it usually was.
The other was a real limit: drawing with CSS cannot give you depth or
perspective, and depth is most of what makes a space feel alive.

**How it works (flow):**
1. On a willpower day the page paints its green ground immediately, before any
   code runs, so there is no black flash.
2. A 3D canvas then loads behind the interface and takes over.
3. Four objects run independently. Each one gathers, builds itself as a bright
   edge sweeps along it, holds and makes one small movement, then loses
   cohesion and breaks up. Then a different object appears somewhere else.
4. If nothing else is on screen, the next object comes back immediately — the
   scene is never allowed to empty out.
5. The camera drifts very slowly on three timings that never line up, so near
   things slide past faster than far things. That difference is what makes it
   read as a space rather than a picture.

**The thing that took the longest:**
Keeping the text readable. There is a minimum contrast the writing must keep
against whatever is behind it, and a glowing 3D scene fights that constantly.
Placing objects carefully is not enough on its own, because the camera moves
and the ring crosses the whole screen. The fix is a mask over the middle of the
page: the margins run at full brightness, the reading column runs at a tenth of
it. Three earlier attempts failed — one dimmed the objects into invisibility
and *still* failed the check, another left the scene almost empty. Measured
now, with the ring forced to fire constantly so the worst moment is actually
caught, and checked at three window widths because the answer changes with the
width: **5.08, 5.13 and 5.18 against a 4.5 pass mark, with none of 30 samples
below it at any width.**

**Two things that were still wrong, and are now fixed:**
The ruled grid was still the original purple, so it sat on top of the green
rather than belonging to it, and the middle of the page read as neutral dark
rather than green. The ground is now a dark emerald and the grid is tinted to
match. Separately, the objects were placed using a fixed proportion of the
screen, which was measured on a narrower window — on a wider one they all fell
outside the edges. Placement and size are now worked out from the real width of
the page margin, so they sit in it on any window.

**Was the original complaint fixed:**
Measured over a minute of continuous watching: **none of 40 frames were
identical to the one before**, and after the first few seconds of loading,
every single sample had objects on screen.

**What this cost:**
Two new libraries, three.js and React Three Fiber, about 1.2MB of code for the
browser to download — roughly eleven times the size of the rest of the app. It
only loads on a willpower day. This reverses an earlier decision to avoid them,
which is recorded in `docs/DECISIONS.md`.

**Still true:**
Nothing here touches your tracks, topics, tasks, completions or streaks. You
cannot click it. With "reduce motion" turned on it renders a single still frame
and stops completely. Switching to another day releases it entirely.

**One thing I could not check:**
Real speed. This machine has no graphics card available to the test browser, so
everything was drawn in software. The frame rates I measured describe that, not
your laptop. It is the one claim in this entry I cannot stand behind.

**Technical concepts used:**
- three.js / React Three Fiber (tools for drawing 3D in a web page) — the scene
- Shaders (small programs that run on the graphics card, once per pixel) — used
  for the light-object look and the moving background
- A mask (a rule for how strongly to show something in each area) — used to
  hold the middle of the page down so the text stays readable

**Roadmap status:** not a roadmap item — a rework of the daily atmosphere
layer. Phase 2's remaining items are untouched.

---

## 2026-09-01 — A switcher for the daily backgrounds, and one pinned day

**What was built:**
Two small things, both for working on the visuals rather than for using the
app. A control in the bottom-right corner lets you switch between the five
daily backgrounds instead of waiting for one to come round. And the app now
opens on the green "willpower" day every time, until that pin is removed.

**How it works (flow):**
1. Clicking a name in the control saves your choice in a small browser cookie.
2. The page then asks the server to redraw itself. This matters: two of the
   backgrounds draw real shapes that the server has to build. Changing the
   colour in the browser alone would tint the page and never summon the
   lattice or the constructs — a trap that has cost time before.
3. The server picks what to show in this order: your switcher choice first, the
   pinned setting second, and the day's date last.
4. The first button clears your choice rather than setting one, so it means
   "whatever a fresh browser would show". It reads "pinned" while a background
   is pinned, and "today" once that pin is removed. The one it lands on gets a
   thin outline so you can still see which it is.
5. Your choice survives a reload, so you can keep working on one background.

**How to change it back:**
Both settings live in `.env`, which is not committed. `RENDRED_MOTIF` is the
pinned day — delete that line and the app returns to the normal rotation.
`RENDRED_DEV_TOOLS` keeps the switcher visible in a built copy of the app;
delete it and the switcher only appears while developing.

**A note on the rule it bends:**
The project has a standing rule that the interface never names which background
is showing — if it needs explaining, it has failed. This control names all five.
That is deliberate and it is why it is a development tool: it only renders when
development tools are switched on, and deleting one file plus one line in the
layout removes it completely.

**Also recorded, not built:**
Rendred runs on one laptop and is not going to be deployed. That was written
into `CLAUDE.md`, `docs/PRD.md`, `docs/ROADMAP.md` and `docs/DECISIONS.md`, so
it stops being an open question. Several things follow from it and no longer
need debating: no accounts or logins, local time being simply correct rather
than a compromise, settings in `.env` being local files rather than deployment
configuration, and development tools being allowed to ship in a build.

**Technical concepts used:**
- A cookie (a small note the browser sends back with each request) — used so
  the server knows which background you picked
- Server-side rendering — the page is rebuilt by the app rather than repainted
  by the browser, which is what makes the drawn backgrounds appear at all
- Environment variables (settings kept in a file outside the code) — used for
  the pinned day and for showing the tool in a built copy

**Roadmap status:** not a roadmap item — temporary tooling for the atmosphere
work, plus a documentation correction.

---

## 2026-09-01 — Willpower: a day made of hard light

**What was built:**
A fifth daily background, called "willpower". On its day the page ground turns
a deep emerald and objects made of green light — a hammer, a sword, a shield, a
spear, a chain — build themselves in the empty margins beside the page, do one
small thing, and break apart again. Every so often a ring falls through the
scene and lands. It is background only: you cannot click it, it never covers
what you are reading, and it never tells you anything about your learning.

**How it works (flow):**
1. When a page is requested, the app checks the day and picks that day's
   background. This happens on the server, once, so it cannot flicker.
2. On a willpower day it draws six shapes into the page margins. The shapes are
   stored as plain outlines — the same way the app already stores the lattice.
3. Each object then runs a fixed sequence: specks of light drift inward, the
   outline draws itself as if being traced, the inside fills with light, the
   object moves once, and then it comes apart into the same specks it gathered.
4. Nothing schedules this. Each object simply repeats on its own timer, and the
   timers are lengths that share no common factor (71, 89, 103, 127, 149 and
   181 seconds). Because of that they slide out of step with each other and the
   sequence never settles into a pattern you can predict.
5. The falling ring is tilted in real 3D by the browser, so it squashes and
   turns as it drops rather than just sliding down the screen.

**Why it looks the way it does:**
The obvious way to build this would have been a 3D engine. That was measured
and rejected. Text has to stay readable against whatever sits behind it, and
there is a hard minimum for that. The plain background scores 6.04 where 4.5 is
the pass mark, which leaves very little room — so this layer has to stay faint.
Everything a 3D engine is good at (realistic shading, glare, depth blur) is
invisible when something is that faint, and it would have added roughly a
megabyte for the browser to download. What actually makes an object
recognisable is its outline, which is flat. So it is drawn flat, and the page
downloads exactly as much as it did before: 110kB, unchanged.

**What was measured, not assumed:**
- Readability behind the effect: **4.89** against the 4.5 pass mark, on all
  three pages, checked at the brightest moment the animation ever reaches.
- The meaning of colours is untouched. Purple still means progress, amber still
  means streak, green still means completed — verified identical on all five
  backgrounds. The emerald was deliberately pushed toward teal so the ground is
  never mistaken for the green that means "done".
- No sideways scrolling at phone, tablet or desktop width; no browser console
  errors; nothing on the page intercepts a click.
- On narrower screens the objects are removed rather than shrunk. Below the
  width where the page has empty margins there is nowhere to put an object that
  is not on top of the text, so only the emerald ground remains.

**If you have "reduce motion" turned on:**
Nothing moves at all. One shield stays on screen, fully formed and still, and
the emerald ground remains, so the day still looks like itself.

**Something found along the way, not fixed:**
While measuring, the "beacon" background turned out to score **4.08** — below
the 4.5 pass mark. That is an existing problem, nothing to do with this work,
and it looks like it was simply never measured before. It is written up in
`docs/DECISIONS.md` with the two values that need lowering. Left alone because
fixing it changes how a different day looks, which was not what was asked for.

**Technical concepts used:**
- SVG (shapes described as instructions rather than as a picture, so they stay
  sharp at any size) — used for every construct and the ring
- CSS animation on the browser's own compositor — used for the whole sequence,
  which is why the app itself never redraws while this is moving
- A CSS 3D transform — used to give the falling ring real perspective
- A mask tied to the page margin — used to keep the effect off the text

**Roadmap status:** not a roadmap item — an addition to the daily atmosphere
layer. Phase 2's remaining items (monthly summary, milestone celebration,
learning trajectory) are untouched.

---

## 2026-08-31 — One theme instead of two

**What was built:**
The light/dark switch is gone. The app now has a single look — the black
ground with purple accents — and the only thing that varies is the day's
background atmosphere. There is nothing left to toggle, so the toggle button
was removed from the header.

**How it works (flow):**
1. Previously the page loaded, ran a small script before anything was drawn to
   decide light or dark, and then every colour had to be defined twice.
2. Now the colours are simply declared once and used. The script, the second
   set of colours, and the toggle button are all deleted.
3. The page tells the browser it is a dark page, so scrollbars and form
   controls match instead of appearing as bright white boxes.

**Why it was worth doing:**
Text has to stay readable against whatever colour sits behind it, and there is
a measurable minimum for that. Holding two themes meant every background
atmosphere had to be readable in *both*, so the weaker of the two set the
limit — and that was always the light theme. Measured, the plain background
gives a comfortable 6.04 against a required 4.5 in dark, but only 4.66 in
light. Dropping the light theme roughly doubled the room available, which is
what let the atmospheres become as vivid as they now are.

**Technical concepts used:**
- CSS custom properties (named colour values reused across the app) — reduced
  from two sets to one
- Contrast ratio measurement (a standard score for how readable text is
  against its background) — used to justify the removal rather than assume it

**Roadmap status:** no roadmap item — a design-system change supporting
Phase 2's visuals. Recorded in `docs/DECISIONS.md`.

---

## 2026-08-31 — The lattice day, rebuilt

**What was built:**
One of the four daily background atmospheres — the one called "lattice" — was
completely redrawn. It used to be a soft red-and-blue spider web. It is now a
fractured neon honeycomb in magenta and electric blue that spans the whole
window, with a deliberate colour-fringing effect like a slightly misprinted
comic. On lattice days, large headings pick up that same fringing.

**How it works (flow):**
1. When a page is requested, the app checks what day it is and picks that
   day's atmosphere. This is decided once, on the server, so it cannot flicker
   or disagree with itself.
2. The three other atmospheres are painted with plain colour gradients. A
   gradient can only make a soft glow, and a lattice needs actual lines with
   ends, gaps and broken cells — so this one is drawn as a real shape instead.
3. The shape is drawn three times, each shifted by a fraction of a pixel and
   tinted differently, which is what produces the fringed, misprinted look.
   Nothing moves; it is completely still.
4. The lattice is drawn at full strength in the empty margins on either side of
   the page, and roughly a seventh of that strength behind the text itself.
   That dip is not a style choice — it is what keeps the words readable.
5. On narrow screens there are no margins, so the whole thing simply runs at
   the gentler strength rather than sitting at full weight over the text.

**The rule that changed:**
Until now an atmosphere could only paint the page background. It may now also
decorate things that are *not* data — a heading, a small marker beside a
section label. The rule that actually protects the app is untouched and is
re-checked for every atmosphere: **an atmosphere may never colour data.**
Purple always means progress, amber always means streak, green always means
completed — on every day of the week, no exceptions.

**Technical concepts used:**
- SVG (a way of describing shapes as instructions rather than as a picture, so
  they stay sharp at any size) — used to draw the lattice
- A mask (a rule saying how strongly to show something in each area) tied to
  the page's side margins — used to keep the lattice off the reading column
- Contrast measurement — the reading column was measured at 4.73 against the
  4.5 minimum after the change

**Roadmap status:** no roadmap item — refinement of the daily atmosphere layer
shipped with the survey redesign. Recorded in `docs/DECISIONS.md`.

---

## 2026-08-31 — The weekly progress view

**What was built:**
A new Progress page, reachable from the top navigation, which until now said
"soon". It answers one question: what actually got done this week. It shows the
week's total, which days of the week you were active, a per-track breakdown
with each track's streak, and a list of the last eight weeks. Weeks run Monday
to Sunday, the same as the grid on the other screens.

**How it works (flow):**
1. The page reads the daily completion records — the same ones the terrain and
   the streak already use. Nothing new is stored.
2. A new piece of code sorts those days into weeks. It works out, for each
   week, how many tasks were finished and on how many separate days.
3. Two numbers per week rather than one, on purpose: four tasks in one sitting
   and four tasks across four days are not the same week, and only the second
   number tells them apart.
4. The current week counts only the days that have actually happened. On a
   Monday it says "1 of 1 day", not "1 of 7".
5. A week with nothing in it is shown as a real, empty week — it is not
   skipped, and nothing is drawn to fill the space.

**A deliberate restraint:**
The first version had a small bar for each week beside the heading. It was
removed for two reasons. The project's design rules say the visuals should be
real drawings rather than bar charts; and a row of weekly bars is really a
trend line, which is the *next* piece of work and one whose form has
deliberately not been decided yet. Building it here by accident would have
settled that question without meaning to. What is there instead is the current
week shown as seven day squares, in the same visual language as the existing
twelve-week grid.

**What was checked:**
- 21 tests of the week maths on its own: Monday and Sunday boundaries, the
  midnight between them, weeks that straddle a month, empty weeks kept in
  sequence, gaps preserved, several tracks active on the same day counting as
  one day, and a year of weeks bucketing without drift
- 19 browser checks: contrast at or above 4.5:1 on all four backgrounds in
  both themes, keyboard reachable with a visible focus ring, the day strip
  carrying a text description, no sideways scrolling at 390, 768 or 1280
- The rendered figures were cross-checked against the database independently,
  using SQL rather than the app's own code, on data containing gaps, empty
  weeks, three tracks and a Sunday completion. Every week matched
- The completion and streak tests from earlier work were re-run and still pass
- Typecheck, lint and a production build pass; the console is clean; the test
  data was removed afterwards

**Technical concepts used:**
- A reusable "period" layer — the same code will produce monthly summaries by
  handing it months instead of weeks, so the monthly view is a small addition
  rather than a second implementation
- Half-open date ranges (start included, end excluded) — the standard way to
  make sure no day is counted twice or dropped at a boundary
- Server-rendered page reading live data on every request, like the others

**Roadmap status:** Phase 2, "Weekly summary view" complete. Two other Phase 2
items were found to be already built and are now ticked. Monthly, milestone
celebration and trajectory remain.

---

## 2026-08-30 — The survey redesign, and a quiet daily atmosphere

**What was built:**
Rendred no longer looks like a dashboard. It looks like a survey sheet: your
terrain runs edge to edge across the top of the page as the ground everything
else stands on, sections are separated by thin ruled lines instead of rounded
boxes, and the numbers are set in a typewriter-style face so they read as
measurements. There is also a new, deliberately quiet touch — the faint pattern
and tint behind the page changes with the day of the week, drawn from your own
interests. It is never labelled and never named; you will know why Wednesday
looks different, and nobody else needs to.

**How it works (flow):**
1. The page is rendered on the server, which checks what day it is locally and
   picks one of four background "atmospheres" — three that rotate across
   weekdays, one for the weekend.
2. That choice sets a handful of background-only colour variables. They paint
   a faint tint, a ruled grid and one piece of geometry behind everything.
3. The rest of the page uses a completely separate set of colours — the ones
   that carry meaning. Purple is progress, amber is your streak, green is
   completion.
4. Because the two sets never mix, changing the day can never change what a
   colour means. The terrain, the ring and the tick look identical on every
   day of the week. This was checked, not assumed.

**What changed visually:**
- **Typography.** Three faces instead of one: a serif for track names, a
  monospace for every number and label, and the existing sans for body text
  and tasks. Hierarchy now comes from which face is used, at what size, in
  what case — not from making things bold.
- **No more cards.** Rounded corners now mean one thing only: you can click it.
  Buttons, inputs and the completion tick are rounded; panels and sections are
  not. They are separated by a hairline and by space.
- **Full-bleed terrain.** It runs off the right edge of the page, with
  milestone values printed in the left margin at the exact height they were
  crossed, like contour lines on a map.
- **Less motion.** Animations that reported nothing were removed: cards sliding
  in, cards lifting on hover, the heatmap fading in cell by cell, and a dot that
  appeared a second after load. What survives is the moment a task is completed
  and the drawing of the data itself.

**What did NOT change:**
Nothing about how the app actually works. The completion engine, the streak
rules, the database and every server action are untouched. The full Item 6 test
suite was re-run against the redesign and still passes.

**What was checked:**
- Typecheck, lint and a production build all pass
- The Item 6 engine suites re-run in full: 15 + 21 + 3 checks, all passing,
  including three browser tabs completing at the same moment
- 21 redesign checks: the completion tick still reachable by keyboard with a
  visible focus ring and a 32px target, contrast at or above 4.5:1 on all four
  atmospheres in both themes, nothing animating under reduced motion, and no
  sideways scrolling at 390px or 768px
- Screenshots reviewed in both themes, desktop and phone. Four problems were
  found this way and fixed: the terrain over-extending past the window, the
  atmosphere being far too strong at full page size, the scale labels colliding
  with the landform, and a panel label drifting to the bottom of the page
- The browser console is clean, the database passes its integrity sweep, and
  the test data was removed afterwards

**Technical concepts used:**
- `next/font/google` — loads the two new typefaces with the app, no new package
- CSS custom properties in two separate layers — one for meaning, one for
  atmosphere, so the second cannot leak into the first
- Container-relative full-bleed maths — lets the terrain escape the page
  column without over-shooting the window
- A pure server-side function for the day-to-atmosphere choice, so the server
  and the browser can never disagree about it

**Roadmap status:** no roadmap item. This is the visual direction approved on
2026-08-30 and recorded in `CLAUDE.md` and `docs/DECISIONS.md`.

---

## 2026-08-30 — Marking tasks complete, and the streak engine behind it

**What was built:**
Every task now has a tick box. Click it and the task is done: the ring on the
right advances, the elevation number rises, the streak counts up, and today
lights up on the twelve-week grid. Click it again and it goes back to pending.
This is the piece that makes the rest of the app mean anything — until now
nothing in the app ever wrote a day of activity, so every chart sat at zero for
a real user.

**How it works (flow):**
1. You click the tick on a task → the tick fills in straight away, before the
   server has answered, so the click feels immediate.
2. The server marks that one task as done and stamps the time on it.
3. It then rebuilds *today's* daily record for that track by counting the
   tasks whose completion time falls in today — it does not add one to a
   running total. Counting again from scratch is what makes a double-click,
   a retry, or a complete-undo-complete round trip harmless: the answer is
   always the same.
4. It recalculates the streak by walking back through the daily records: how
   many days in a row end at today (or yesterday, since today is not over),
   and what the longest such run has ever been.
5. Steps 2 to 4 happen in a single transaction — a unit of work the database
   either applies completely or not at all — so history can never end up
   disagreeing with the tasks it came from.
6. The page re-reads from the database, and the ring, elevation, streak and
   grid all update together.

**The rules it follows:**
- **Strict streaks, no forgiveness.** Miss a day and the count goes to zero.
  There are no freezes and no grace periods, and the code has no place to add
  one. Today does not count as missed until it is over, so a streak whose last
  activity was yesterday is still alive.
- **Streaks are per track.** Practising Spanish does not protect a DSA streak.
- **History is written once.** Only today's record can change. A day you
  already earned stays earned, even if you later delete or un-tick the task
  that earned it.
- **The "3 of 8 done" figure always reads the tasks themselves**, so it drops
  the instant you un-tick something, while the history behind the terrain does
  not rewrite itself.
- **A lapsed streak shows as lapsed without you having to do anything.**
  Stopping for a week does not send anything to the server, so there is nothing
  to trigger a reset; the streak is therefore worked out fresh each time the
  page is read.
- **Days are your local days.** Everything used to roll over at 5:30am India
  time, which could break a streak unfairly. All day boundaries now come from
  one shared piece of code.

**What was checked:**
- 13 tests of the streak rules on their own: a missed day resets, a gap breaks
  the run, the longest run survives a lapse, month boundaries and a run longer
  than the twelve-week chart all count correctly
- 36 checks driven through a real browser against the production build:
  completing, un-completing, three completions in one day sharing one record,
  complete-undo-complete not double counting, three rapid clicks on one task,
  three browser tabs completing at the same moment, two tracks not affecting
  each other, deleting a task completed today, un-completing a task finished
  days ago, and the home screen totals
- Keyboard only: the tick is reachable by Tab, shows a focus ring, and toggles
  with both Space and Enter
- Reduced motion: nothing is left animating, and the tick is fully drawn
  rather than frozen mid-animation
- Both themes, and a 390px phone width with no sideways scrolling
- The browser console is clean, and the database passes an integrity sweep:
  no duplicate day records, every date stored at local midnight, no completed
  task missing its timestamp, no orphaned rows
- Typecheck, lint and a production build all pass. Test data was removed
  afterwards

**Technical concepts used:**
- Prisma transaction (a group of database writes that all succeed or all fail
  together) — keeps the task, the daily record and the streak in step
- Upsert (update the row if it exists, otherwise create it) — one daily record
  per track per day, enforced by the database itself
- React `useOptimistic` — shows the tick immediately and quietly corrects
  itself if the server disagrees
- `aria-pressed` on a toggle button — tells a screen reader whether the task
  is done, without changing what the button is called

**Roadmap status:** Phase 1, "Mark Task complete → updates CompletionLog +
streak logic" and "Strict streak logic (reset on missed day)" are complete.
The remaining Phase 1 item is the basic-UI checkbox, whose last missing piece
(the mark-complete surface) landed here.

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
