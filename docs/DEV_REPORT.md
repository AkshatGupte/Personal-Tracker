# Development Report

This is a running log of what's been built, explained in plain language.
Newest entries are at the top. See `docs/RULES.md` for the format Claude
Code follows when adding to this file.

---

## 2026-09-06 (later) — Structures that had come unthreaded are joined up again

**What changed:** after the scrolling background went in, some of the wireframe
shapes were floating with no neon threads reaching them, and a few threads
stopped in open space instead of running off the edge of the page. Both are
fixed. Every shape on every screenful now has threads arriving at it, and no
thread ends in mid air.

**What was actually wrong — two separate things:**

1. **The threads were being drawn into a box little more than half the width of
   the page.** When the thread drawing was changed to sit at a band's position,
   it lost the instruction that said "be as wide as the page". A drawing like
   this is treated by the browser as a picture with a fixed shape, so instead of
   stretching to the full width it sized itself square from its height — 720
   pixels wide on a 1280 pixel page. The threads were all squashed into the left
   side while the shapes stayed where they belonged, so the ones on the right had
   nothing reaching them. This affected the very top of the page too, not just
   the new screenfuls.
2. **Mirrored screenfuls pointed their loose branches the wrong way.** Every
   other screenful flips the composition left-to-right. The shapes were being
   flipped but the short branches that run off them were not, so a branch meant
   to leave off the left edge instead pointed back into the middle of the page
   and simply stopped there. Those are now flipped with the shape, and there is a
   second guard that pushes any branch along its own direction until it genuinely
   leaves the frame, so one can never stop halfway again.

**A new check that would have caught it:** `qa/bands-check.mjs`. It reads the
threads and shapes straight out of the finished page and asserts that every shape
has a thread arriving at it, that no thread stops at a loose end, that the
background covers the document exactly, and that there is no sideways scrolling —
across three pages at five window sizes. It was tested by putting each of the two
bugs back and confirming it fails on both, because a check that never fails
proves nothing.

**Note:** it also reports that on a phone two of the five shapes are deliberately
not drawn while their threads remain, which is how it has always been and is not
a fault.

**Roadmap status:** no roadmap item — a fix to the previous entry's work.

---

## 2026-09-06 — The multiverse background now scrolls with the page

**What was built:**
The glowing background — the rift light, the wireframe shapes and the neon
threads between them — used to be pinned to the screen. It covered exactly one
screenful and stayed put while the page slid over it, so on a long track page
you could scroll to the very bottom and find the same five shapes sitting in the
same five places. It now covers the whole page and scrolls with it, drawing a
fresh set of shapes for every screenful. Scrolling moves you *through* the
multiverse instead of over a picture of it, and there is no point on any page
where the background stops.

**How it works (flow):**
1. When a page loads, the app measures how tall the document actually is and how
   tall one screenful is, and divides one by the other to get a number of
   "bands" — screenfuls of background to draw.
2. Band 1 is the composition that was already there, unchanged, so the top of
   every page looks exactly as it did.
3. Every band after that is *generated* from a number derived from its own
   position — the shapes flip to the other side of the page, shift, resize, and
   most importantly are re-shaped, so band 4 holds genuinely different solids
   rather than a copy of band 1. Nothing is tiled, so nothing repeats.
4. The threads that used to run off the bottom edge of the screen now find the
   nearest shape in the next band down and connect to it, so the structure is
   continuous across a boundary rather than stopping at one. Only at the very top
   and very bottom of the page — where there is no neighbour — do they still run
   off the edge.
5. It watches the page for changes in height. Add a track, or open a subtree so
   the page gets longer, and another band appears on its own. Nothing has to be
   told the page grew.

**One thing deliberately left pinned:** the faint diagonal speed lines. They are
a perfectly even hairline pattern with no feature anywhere in them, so there is
no position in them to scroll to, and they were measured to be the single
expensive layer to scroll — 67 milliseconds a frame against a 17ms budget, on
its own. Pinned, the whole scrolling background costs nothing measurable. The
dimensional tears also stay pinned, for a different reason: a tear is a passing
event that happens where you are looking, and spreading them over the whole
document would fire most of them onto screens nobody is on.

**What was checked:** the top of every page is pixel-for-pixel what it was (the
shapes and glows land on the same coordinates as the old hand-written values,
measured, not assumed); no sideways scrollbar at 1440, 1280, 768, 390 and 320px
wide; five shapes per screenful on desktop and three on a phone, at the bottom of
the page exactly as at the top; text contrast still passes everywhere; the tear
effect suite still passes clean; and scrolling runs at full frame rate.

**Roadmap status:** no roadmap item — this is visual work on the existing
atmosphere.

---

## 2026-09-06 — The background masking was undone

**What changed:** the change that held the glowing background back from the
middle of the page has been removed. The atmosphere is global again, exactly as
it was.

**Why:** it worked, and it looked wrong. On a wide screen it left a flat black
rectangle down the centre of the page with the colour surviving only at the
edges, so the page read as two different designs next to each other rather than
one. The design direction says the atmosphere is global; a version that stops at
the content column is not that.

**What this means for readability — the useful part:** the text is still fine.
The ink outline added the day before puts every letter on its own near-black
ground whatever is drifting behind it, and that does not depend on scroll
position. The measured glyph contrast check still passes everywhere. What is no
longer true is the stricter rule the audit asked for, that the *whole area*
behind a line of text stays dark — that is measurably broken again, and it is
recorded as an open item rather than quietly dropped.

The measuring tool is kept, not deleted. It will report a failure until someone
decides what to do instead, and it is the only way to judge whether a future
attempt is better.

**Roadmap status:** no roadmap item. Audit item 3.1 is open again.

---

## 2026-09-06 — UX audit: things that were broken now work

**What was built:**
Nothing new — this is a repair pass over the desktop app from a UX audit. Ten
functional bugs are fixed. The most visible ones: the tree view was drawing
topics at the wrong depth, the buttons on each topic row did not line up in
columns, switching between Flat and Tree threw you back to the top of the page,
and the monthly calendar had no dates in it.

**What was actually wrong, in plain terms:**
- **The tree was one level out.** The first item inside every group lost its
  indent, so a child appeared at the same distance from the left as its parent.
  The error was exactly one level, which made the shape of the tree unreadable
  in the one view that exists to show it.
- **The row buttons jumped.** The `+ Inside` button is not offered on the
  deepest topics, and it was being left out entirely rather than left blank — so
  on those rows everything after it slid 43px to the left. The two controls
  people use most had two different positions down the list. It now holds its
  space.
- **The four little forms behaved four different ways.** Rename and Add put the
  cursor in the box and closed on Escape; Move and the delete confirmation did
  neither, and pressing Enter on "Delete X?" did nothing at all. All four now
  take focus when they open, close on Escape, and put focus back on the button
  you opened them with.
- **Flat/Tree scrolled you to the top.** It is a switch between two arrangements
  of the same list, not a jump to a new page, so it now keeps your position.
- **The monthly calendar had no dates**, and a day that had passed with no
  activity looked identical to a day that has not happened yet. Days now carry
  their number; an empty past day is a filled square, a future day is an
  unfilled dashed one.
- **The delete confirmation for a track was ungrammatical** and did not mention
  that deleting a track destroys every activity ever recorded on it and its
  streak. It says so now.
- **The heatmap key showed a colour the grid never draws.** The key is now built
  from the squares actually on screen.

**One thing could not be reproduced and was not faked:** the audit reported a
React hydration warning about `caret-color` on inputs. That value appears
nowhere in the code and nowhere in the HTML the server sends, and no warning
appears on any page in a clean browser — it is the signature of a browser
extension rewriting the page before React starts. What *was* wrong is that the
project's own browser-checking tool could not have seen such a warning either:
it collected crashes but not `console.error`, which is how React reports this.
That gap is fixed, so the check now means something.

**Technical concepts used:**
- **CDP (Chrome DevTools Protocol)** — every fix was confirmed by driving a real
  browser and measuring, never by reading the code.

**Roadmap status:** no roadmap item — repair work on Phase 2 screens.

---

## 2026-09-06 — Controls now look and behave like controls

**What was built:**
The interface answers when you point at it. Buttons show a hand cursor, rows
highlight as you move down the list, the empty-topic field tells you what to
type, and the square you click to record activity now visibly responds.

**What was wrong:**
- **No button anywhere showed a pointer cursor** — 132 of them on a track page.
  In an interface where controls are deliberately flat and square, the cursor
  was one of the few remaining signals that something is clickable, and it was
  saying the opposite of what the links said.
- **A topic row is 840px wide with 559px of empty space** between the topic name
  and its buttons, repeated fourteen times, and nothing changed as you moved
  across it. Delete is the last button on that journey. Rows now highlight.
- **Delete looked exactly like Rename and Move on hover.** It now goes red.
- **The square you click to record activity** brightened by an amount that was
  invisible even magnified eight times. It now changes fill and takes a magenta
  edge.
- **The create field had no placeholder and no hover.** On a track with nothing
  in it, that field is the only way forward and it rendered as an empty box.
- **Boundaries were too faint to count as boundaries** — the accessibility
  standard asks for a 3:1 difference and they measured 1.32:1. A new colour was
  added for the edges of things you operate, kept separate from the hairline used
  for panel rules so those are unchanged. Measured on screen afterwards: 4.4:1.
- **The focus ring took its colour from the text** it was on, so its visibility
  depended on the element. It is pinned to yellow everywhere — 58 focusable
  elements, one ring.
- **Text was too small.** 102 elements below 11px. Nothing renders below 12px
  now, and no row wraps or overflows at 1280px or 1440px as a result.

**Roadmap status:** no roadmap item — affordance and contrast repair.

---

## 2026-09-06 — The background no longer decides whether text is readable

**What was built:**
The glowing background is now held back inside the column where the content
lives, and pushed to full strength in the margins either side. It looks the
same; it just stops interfering with the words.

**Why this was serious:** the background layers are pinned to the window while
the page scrolls past them, so a bright line that sits harmlessly in the margin
at one scroll position lies directly across a row of buttons at another. The
same row of the same page passed the project's own contrast rule at one scroll
position and failed it at another — 3.50:1 at the top of the page, 7.05:1 a few
hundred pixels down. Legibility was a function of where you happened to be
scrolled to.

**How it works (flow):**
1. The lit background layers get a mask that fades them down to a tenth of their
   strength across the middle 1024px of the window and leaves them untouched
   outside it.
2. Because those layers do not scroll and the content column is always centred
   and always the same width, one fixed mask covers the column at *every* scroll
   position. There is no offset left for it to be wrong at.
3. Below the column width — a phone — the mask does not apply, because there the
   column is the whole screen and hiding it would delete the effect rather than
   move it aside.

**What the measurement said, and what it corrected:** the audit blamed the neon
wireframe shapes. Switching each layer off in turn and re-measuring showed the
soft coloured glows are the bigger contributor — removing the wireframes got the
worst spot from 0.079 to 0.060, removing the glows got it to 0.023. Both are now
masked. The page's own background fill is deliberately left out of the mask,
since masking that would cut a hole through the page itself.

**Technical concepts used:**
- **CSS mask** (a stencil that fades part of a layer out) — no animation was
  changed; every drift timing and keyframe is byte-identical.
- **`qa/column-contrast.mjs`** — a new check that photographs each page with the
  text hidden, at four scroll positions and two window widths, and reads the
  actual brightness behind every piece of text. It fails if any of it is too
  bright or drops under the contrast floor. Result: worst background 0.0168
  against a 0.02 ceiling, worst contrast 6.31:1 against a 4.5:1 floor.

Building that check turned up three ways an earlier version of it lied — it was
measuring decorative duplicate layers as if they were text, treating rows inside
a collapsed section as visible, and a stray backslash had silently disabled the
rule meant to skip text sitting on a solid button. All three are fixed and
written down in the file.

**Roadmap status:** no roadmap item.

---

## 2026-09-06 — The app can be used with a keyboard and a screen reader

**What was built:**
A skip link, a proper main landmark, and every control now says what it acts on.

- **There was no `main` landmark on any page** and no skip link, so reaching the
  content meant tabbing past the whole masthead — on a track page there are
  about 56 focusable elements, five per row.
- **Row buttons said nothing about their row.** A screen reader heard "Delete"
  fourteen times with no way to tell which topic. They now announce "Delete
  Sliding window", matching a pattern the reorder arrows already used.
- **The delete confirmation was also called "Delete"**, identical to the button
  that opened it and to every other row's. It is now "Confirm deleting X".
- **The reason a parent cannot be deleted was mouse-only** — a tooltip on a
  button that keyboard users cannot reach. The button is now reachable and
  announced while still refusing the click, and it no longer looks switched off.
- **The page headings were wrong.** The top-level heading on Home was
  "ELEVATION" — the caption of the first chart, not the name of anything. Each
  page now has a real top-level heading; nothing visible moved.
- **The charts had no per-item alternative.** Heatmap squares and the 28-day
  history strips were unlabelled, and the middle column of the history table was
  completely empty to a screen reader. Every square now has a hover
  ("5 September 2026 — 3 activities") and each history row states its days as a
  sentence.
- **The "Insights — soon" item in the navigation announced nothing at all** — a
  blank entry between Home and Progress. It now reads "Insights — Not built yet".
- **Tab order jumped backwards** on the track page, from the Flat/Tree toggle
  back up to the topic field above it. The toggle moved out of the panel's
  narrow left gutter — where it was also colliding with the panel's own
  metadata — to the top of the content column, which fixed both.

**And the words were made consistent.** The same figure was being called
`8 / 14 TODAY`, `8 OF 14 WORKED`, `51% COMPLETE`, `LEAF COVERAGE` and `51% TODAY`
in five places. It is "worked today" everywhere now. "Complete" is gone
entirely — nothing in this app ever completes, and "0% COMPLETE" on a new track
reads as a verdict on you rather than a description of the day. Parent rows now
say "2/2 direct", because that figure only counts topics directly inside and the
label never said so, which made reading the tree top-down systematically
flattering.

**Roadmap status:** no roadmap item.

---

## 2026-09-05 (late) — Text is now readable wherever the background glows

**What was built:**
Some text on the page was genuinely unreadable. Where one of the bright cyan
lines in the background passed behind the reading column, the words and the
background were **the same brightness** — a measured ratio of 1.01:1, where the
project's own rule requires 4.5:1. Every piece of text now sits on a thin ring
of near-black ink, so it stays legible whatever drifts behind it. Worst case
went from 1.01:1 to 6.41:1, and the whole page now passes.

**Why this one and not the other two options:**
Three fixes were on the table. Dimming the background lines would have undone
what was asked for a session earlier. Putting a dark panel behind the reading
column works on a laptop, but on a phone the reading column *is* the whole
screen, so it would have darkened everything. The ink ring is the only one that
works at every screen size — and an ink outline round lettering is comic-book
language anyway, so it belongs here rather than fighting the look.

**One thing it had to avoid:** the app's typeface has only one weight, and the
design rules are strict that emphasis never comes from making text bolder. The
obvious way to outline text (`-webkit-text-stroke`) draws *on* the letter and
therefore makes it look bolder. The method used here paints copies of the letter
**behind** it instead, so the letter itself is untouched — same shape, same
width, nothing moves on the page.

**How it works (flow):**
1. A ring of eight near-black copies of each letter is drawn one pixel out in
   each direction, behind the letter itself.
2. Those eight copies overlap into a solid patch shaped like the letter, so the
   background immediately under and around it is always the page's own near-black
   — never the glow that happens to be passing.
3. It is inherited from the page body, so every component gets it without asking
   and a new one cannot forget it.
4. It is switched off in five places, all for the same reason: dark text on a
   solid colour (the yellow buttons, the comic panel's caption bar, the brighter
   activity squares) does not need it and would only look heavier, and the
   coloured duplicate layers used by the glitch effects would blot each other out
   if each one carried an opaque ring.

**The measuring tool had to be rebuilt too, and this is worth reading:**
The tool that found the problem worked by hiding the text and photographing what
was behind it. That cannot see this fix — the ink ring is part of how the text is
drawn, so hiding the text hides the ring as well, and a perfectly working fix
still measured 1.01:1. It now photographs the same page twice, once with the
letters made invisible but their ring still drawn and once with everything hidden,
and compares. The pixels that differ are exactly where the text is painted, and
those are what get measured.

To keep this honest, the tool has a mode that strips the ink ring and measures the
same way, so the fix and the change of method can be told apart rather than taken
on trust. Stripped: 5 failures, worst 1.01:1. With it: everything clear, worst
6.41:1.

**Technical concepts used:**
- **`text-shadow`** (copies of text painted behind it) — the outline, chosen
  specifically because it cannot change the letterform.
- **Screenshot differencing** — two photographs of the same frozen page,
  subtracted, to find exactly which pixels the text occupies.
- **`NO_HALO=1`** — a switch on the checking tool that removes the fix and
  re-measures, so its own result can be disproved.

**One thing deliberately left open:** the paint cost of drawing eight copies of
every letter has *not* been measured. Nothing looked slow, but that is an
unmeasured number rather than a cleared one. If it ever matters, dropping the four
diagonal copies halves the work and barely changes the result at this size.

**Roadmap status:** no roadmap item — this closes the open contrast defect
recorded in `docs/DECISIONS.md` and the previous handoff.

---

## 2026-09-05 (late) — The tears in the background appear far less often

**What was built:**
The dark tears that open in the background were arriving too often. They now
show up **about a third as frequently**: measured on a page left alone, one every
15 seconds with a tear visible about a quarter of the time, where before it was
one every 7 seconds and something was on screen more than 70% of the time.

**Why it needed three changes and not one:**
The obvious dial is "how long to wait before the next one", but that was never
what set the real rate. Two other things were quietly adding tears:

1. **How many are allowed on screen at once** was three (two on a phone). At a
   five-second lifetime that number is only reachable when tears are arriving
   faster than they close — so leaving it alone would have let them pile up
   again however long the wait between them got. It is now two, and one on a
   narrow screen.
2. **Tears begetting other tears.** Roughly half of them spawned a follow-up
   when they closed, and one of the five behaviours did it six times out of ten.
   That is what made the waiting time misleading. All of those chances were
   roughly halved, so a follow-up is now the exception that makes one arrival
   memorable rather than the normal way tears appear.
3. **The wait itself** went from 4-9 seconds to 15-30. Notably this was the
   *least* effective of the three on its own — two different settings for it
   measured the same arrival rate — which is why the other two mattered.

Also, the page now opens one tear shortly after load instead of two. A page that
arrives with two tears on it has announced the effect before you have read
anything.

**How it works (flow):**
1. A timer waits 15-30 seconds, opens a tear, and starts the wait again.
2. Before opening one it checks how many are already on screen and does nothing
   if the limit is reached — so the limit, not the timer, is what ultimately
   holds the rate down.
3. When a tear closes it rolls a die: usually nothing, occasionally it disperses
   into two smaller ones or reforms as a bigger one nearby. Those are the
   moments where two or three are briefly visible at once, and they are the only
   ones.

**Technical concepts used:**
- **A measurement script** rather than an estimate — the follow-up chains make
  the timer a poor predictor of what actually appears, so a browser watched an
  untouched page for two to three minutes per setting and counted. That is where
  every number above comes from.

**Checks run:** the tear suite (`qa/spots-check.mjs`) still passes clean at five
screen widths on two pages, and all five behaviours still appear despite fewer
tears being allowed at once.

**Roadmap status:** no roadmap item — visual tuning of the ambient atmosphere.

---

## 2026-09-05 (late) — The dark shapes are now holes torn in the page

**What was built:**
The dark shapes that open in the background used to read as a blob: one growing,
splitting into more, becoming a bigger one. They now read as a **hole ripped in
the interface** — a crack that opens along a jagged line, widens into an
irregular opening with visible black depth behind it, and closes again. Over the
five seconds it lives you can see the surface give way, pieces of the page get
levered up out of the tear, black lightning run out of it across the interface,
and then the page heal over.

**Why it looked like a blob, in one sentence:** the shape was drawn as a wobbly
circle, and a wobbly circle can only get bigger by being enlarged — so however
ragged its edge was, the eye read one lump inflating.

**How it works (flow):**
1. Instead of drawing a ring around a centre, the app first draws the **line the
   surface fails along** — a jagged, kinked line, the way a real crack runs.
2. The outline is then the two **lips** of that line, walked along either side of
   it. That gives it a direction, a length and two pointed ends, which a blob
   cannot have. Points along each lip are marked as *notches* (the surface still
   holding on) or *splinters* (a shard left standing into the gap), so the edge
   is torn rather than merely bumpy.
3. A single number — how far open the tear is right now — drives everything. The
   crack **runs along its line first** and the lips part afterwards, which is why
   the first second is a long hairline and not a small round hole.
4. The app draws the opening **fresh at each stage** of that number, and plays
   those drawings in order: sealed hairline → spreading → widest → closing. The
   shape is never scaled up; it is redrawn wider.
5. As it opens, more happens: fractures out of the edge get longer and more of
   them appear, flaps of the page lift out of the tear, and the corruption bursts
   that break the interface around it hit harder — all read off the same number,
   so the page visibly gets worse as the hole gets wider.
6. The blackness inside is drawn behind the interface, and the torn edge, the
   fractures and the lifted flaps are drawn in front of it. A thin lit rim inside
   the near edge shows the **thickness of the punctured surface**, which is what
   makes it look like there is somewhere behind the page rather than a black
   sticker on top of it.
7. The patch of interface inside the opening is genuinely blanked out, and that
   blanked patch now **follows the tear as it widens** rather than being a fixed
   shape.

**Two of the five behaviours were replaced,** because they were the blob
splitting: what used to be several pieces drifting apart from a centre is now a
single failure **propagating along one line** — three openings in a row, each a
sealed seam until the one before it has torn. The violent one no longer throws
fragments; it throws the split itself, further along the same line.

**Technical concepts used:**
- **Generated SVG geometry** (drawing shapes from maths rather than from an
  image file) — the spine, the two lips, the wall, the flaps and the fractures
  are all computed, so no two tears are the same drawing.
- **CSS keyframes generated per tear** — each opening writes its own animation,
  which is why two on screen never behave alike.
- **An animated `clip-path`** (the shape used to cut a hole in a layer) — this is
  what lets the blanked-out patch of interface grow in step with the drawing.
  It is also why every stage of the tear is built from the same number of points:
  a browser can only animate between two shapes with matching structure.
- **`backdrop-filter`** (a filter applied to whatever is already painted behind
  an element) — unchanged from before; it is what makes the corruption bend and
  split the *real* interface rather than draw a picture of a glitch.
- **`qa/tear-shots.mjs`** — a new checking tool that freezes one tear at nine
  points of its life and photographs it enlarged. The effect is five seconds
  long, small and randomly placed, so it cannot be judged from a live
  screenshot. This tool had been rebuilt from scratch in a temporary folder four
  times; it is in the repo now.

**Checks run:** the existing tear suite (`qa/spots-check.mjs`) passes clean at
five screen widths on two pages — no sideways scrolling, nothing blocking
clicks, corruption stays local and leaves the page exactly as it found it, all
five behaviours appear, and nothing at all renders when the device asks for
reduced motion. Frame timing with tears on screen now matches the same page
without them, after trimming the drawing budget.

**Roadmap status:** no roadmap item — this is visual work on the ambient
atmosphere, outside the Phase 2 feature list.

---

## 2026-09-05 — Brighter, thicker multiverse threads — and a contrast problem they revealed

**What was built:**
The multiverse lines and shapes in the background are now noticeably thicker and
brighter — they read as lit neon tubes rather than thin drawn lines.

- Every stroke got a **second glow pass**. There was one blurred halo under a
  pale core; a single blurred pass can be wide *or* intense but not both, so it
  is now a wide soft glow, a tight saturated one, and the core. This is the same
  three-layer build the lightning uses, so a thread and a lightning bolt are now
  lit by the same rules.
- **Thicker strokes:** the connecting threads went up about 70%, the front faces
  of the shapes about 55%.
- **Brighter:** the shapes and the threads were all raised, roughly a third.

**What this turned up, which matters more than the change itself:**

The project's own design rules say every piece of text must stay clearly legible
against the background *as actually rendered*, and specifically warns that the
glowing background layers lighten it unevenly, so it has to be measured rather
than assumed. Nothing had ever measured it.

So a measurement tool was written, and **it fails** — on the header text where a
bright thread passes behind it, legibility drops to roughly the point where text
and background are the same brightness.

**This is not new, and it is not caused by this change.** Measured with the old
values and the new ones, back to back: 8 failing pairs before, 9 after. The
threads always crossed that text; they were dimmer, so it was less bad. The
brightening deepened a problem that was already there and already breaking the
project's own rule.

**It has been left unfixed on purpose.** The request was for brighter threads,
and that has been delivered in full. Every way of fixing the contrast is a
design decision that is not mine to make quietly: dimming the threads again
undoes what was asked for, adding a dark halo behind small text changes the
typography, and putting a shade behind the reading column changes the layout.
The options are written up in `docs/DECISIONS.md`.

**Technical concepts used:**
- A three-pass glow (wide, tight, core) rather than one blurred pass
- A contrast measuring script that hides only the letters and photographs the
  background underneath them, so the number describes the real composited
  ground rather than an assumption about it

**Verified:** no sideways scrolling at any width; the header text was checked at
3x magnification and is legible where the thread passes between rather than
across it; the void, tear and lightning checks were all re-run on the brighter
background and pass unchanged.

**Roadmap status:** no roadmap item — a visual change, plus a defect found.

---

## 2026-09-05 — The voids now tear through the interface instead of sitting behind it

**What was built:**
The voids read as objects placed near the page rather than holes in it, and the
reason was structural, not cosmetic: the entire void was drawn *behind* the
interface, so a panel painted over it and it could only ever look like something
underneath a surface. It is now split across both depths.

- **The inside of the hole stays behind the interface.** That is the darkness
  you see through the opening, and keeping it there means it can never cover a
  button or a word.
- **The torn edge, the cracks and the pale linework are drawn in front of it.**
  These are the parts a real tear actually shows you, and having them cut across
  a panel is exactly the depth cue that was missing.
- **What is in front of the void is blacked out inside its outline.** Without
  this you would see the interface carrying on inside the hole, which makes the
  edge read as an outline drawn on a panel rather than an opening in one.

Both halves are driven by the *same* animation data — not copies — so they
cannot drift apart from each other however the timing is retuned later.

**The order of events changed, and that matters more than any of it.** Every
void now opens with a sharp little break in the surface at the very start of its
life, before there is anything to see. Previously the first corruption arrived a
third of the way in, well after the shape had faded up, so it read as "a thing
appeared, and later some effects happened near it". Now the surface cracks
first, and the void comes through the crack. That is the whole difference
between something emerging and something being placed.

The existing five-second progression is unchanged: small tear → opening and
growth → heavy corruption → peak → collapse.

**A cost that had to be found and fixed.** The blackout inside the hole is the
expensive part, and it was first drawn once per *piece* — so a swarm, which is
four to six fragments, put six of them on screen at once and pinned the page to
half its frame rate. It is now one per void, on the main body only. That is also
the better reading: a swarm's satellites are fragments thrown off the tear, and
a fragment does not punch its own hole.

**An honest note on measurement:** the test browser here runs without graphics
acceleration and its frame timing fluctuates between 16.7ms and 33.4ms for
*identical* content, so these numbers can rule out a large regression but cannot
prove a small one is absent. Measured back to back in the same run with bursts
suppressed, a page with voids and a page without were identical.

**The trade this makes, stated plainly:** the tear now draws over the interface,
and briefly blacks out whatever is inside it. That is precisely what makes it
read as a tear rather than a decoration — but it does mean a label can be
obscured for a moment while a void passes over it. It is transient, it is
weighted toward the edges of the screen away from the reading column, it fades
in with the void's growth so a young one barely dims anything, and it can never
be clicked.

**Technical concepts used:**
- Splitting one drawing across two depths, driven by one set of animations
- Stroking the outline rather than filling it, so the front half is a band along
  the edge and the interior stays the business of the layer behind

**Verified:** home and track at 1560, 1280, 768, 390 and 320. The check was
extended to the new front layer specifically — it is over the controls, so
proving it unclickable is the whole point: 154 hit-tests per page per width
across *both* layers found none, a real link stays clickable during corruption,
and the layer disappears entirely under reduced motion. No sideways scrolling,
and the page returns exactly to its previous state.

**Roadmap status:** no roadmap item — a visual-system change.

---

## 2026-09-05 — Pale linework over the voids: drawn, not computed

**What was built:**
An addition on top of the existing void effect — nothing about how it behaves
changed. The voids now carry a thin layer of off-white pen work, so they read as
comic artwork being drawn and corrupted rather than as black shapes being
animated. Black is still the mass; the white is a line on it.

**Four additions, all of them thin:**
1. **A broken contour.** The void's own outline, stroked in the theme's warm
   paper white with an irregular dash pattern so most of it is missing. It is
   the same path as the black fill, so it can never drift out of register with
   the shape it belongs to.
2. **A second, fainter pass a hair out of register** — the misprint that makes a
   drawn line look drawn rather than computed.
3. **Short pale ticks** set just off the edge, sometimes doubled the way a pen
   doubles a contour. Where they sit is fixed to the shape, but *which of them
   get drawn* is decided fresh on every frame, so they flicker in and out.
4. **Highlights along the fractures** — a short pale line offset to one side of
   the heavy cracks, catching the lit edge of a split.

**All of it is regenerated on every frame of the shape's own boil.** That is the
whole point: the dashes re-break, the ticks come and go, and the highlights
shift, so the line looks like a hand going over the same drawing again rather
than a border sitting still while the ink underneath moves.

**The corruption got the same treatment:**
- **Loose pale arcs** are struck around a burst — the reference's linework
  circles a form rather than tracing it.
- **The tear bands are no longer rectangles.** They now have ragged top and
  bottom edges. A perfect rectangle was the one shape in the whole effect that
  gave the corruption away as computed.

**One judgement worth recording:** the pen started out derived from the fracture
width, which came out around six pixels on a large void and read as a dashed
border rather than a drawn line. It is now its own number and much thinner, and
the dash pattern was rebalanced to short marks with long gaps — what makes a
contour look hand-drawn is mostly that it is missing.

**Technical concepts used:**
- Stroking the same path that is already being filled, broken up by a dash
  pattern — costs no extra shapes and cannot misalign
- Per-frame regeneration of the pale marks from the same randomness that drives
  the shape's redraw, so the two are in step by construction

**Verified:** home and track at 1560, 1280, 768, 390 and 320. No sideways
scrolling, neither layer ever under the cursor, a link still clickable during
corruption, the page returning exactly to its previous state, all five
behaviours present, nothing under reduced motion, and frame timing unchanged
from a page with no voids at all.

**Roadmap status:** no roadmap item — a visual polish pass.

---

## 2026-09-05 — The lightning redrawn against a reference frame

**What was built:**
The ambient lightning was compared against a still from the film and came up
short in a specific way: it looked like a bare tree branch. Long straight runs,
four or five forks, and a thin bright filament with a faint halo. It now looks
like a discharge.

**Three things changed:**
1. **Short jagged segments instead of long straight ones.** The trunk ran 4-7
   segments of 46-72 pixels — which is a straight line with a couple of kinks.
   It is now 10-14 segments of roughly half that length, wandering much harder.
   Same overall reach, far more angularity.
2. **A fourth level of branching.** There were three; the reference's
   extremities dissolve into a haze of very short hairs rather than ending in
   three countable twigs. That fourth level is the point at which the eye stops
   counting branches and starts reading it as electricity. There are also more
   forks at every level, and they come off at wider angles.
3. **Four drawing passes instead of two.** It was one blurred cyan pass under a
   pale core, which gives a thin bright line with a faint glow. It is now a wide
   soft bloom, a tight saturated cyan sheath, the pale core, and white heat down
   the middle of the heaviest runs only. A single blurred pass can be wide or
   intense but not both — splitting it is what gives the bolt depth and makes it
   read as a thick channel rather than a drawn line.

**How it works (flow):** unchanged — a strike still arrives on its own every
8-18 seconds, still starts on a real border of the interface and grows away from
it, still flickers in hard and fades out slowly. Only what gets drawn changed.

**One thing watched carefully:** the new figure draws far more lines — about 400
per strike against roughly 30 before. The widest blurred pass was then limited
to the heavy runs only, since a hair less than one and a half pixels wide, grown
sevenfold and blurred by nine, contributes nothing an eye can find. After that
the frame rate with strikes on screen was measured as identical to the page with
none, at every width.

**Technical concepts used:**
- A fourth generation in the branch generator, with the same tapering rule at
  each level — which is what makes the figure self-similar
- Layered glow passes at different widths and blurs, rather than one

**Verified:** strikes fired at 1560, 1280, 768, 390 and 320 pixels wide, several
at once — more than the effect ever allows itself. No sideways scrolling at any
width, the strike layer never sits under the cursor, and frame timing is
unchanged from a page with no lightning. The dimensional voids were re-checked
on the same pages and are unaffected.

**Roadmap status:** no roadmap item — a visual-system change.

---

## 2026-09-05 — Every void now lives the same five-second arc

**What was built:**
A void used to open at full size and stay there for however long its behaviour
said — anywhere from a second and a half to twenty-two seconds. Now every one of
them lives the same shape of life, in about five seconds:

1. It seeds **very small and very faint** — about 15% of its final size at a
   third opacity. On the page it is barely a smudge.
2. It **grows steadily**, getting more solid as it goes.
3. It gets **less stable the bigger it gets**. The shape redraws itself about
   four times a second when it is small and nearly twenty times a second at
   full size, and the wobbling, skewing and jumping all scale up with it.
4. It **peaks**, briefly, at its largest — and this is where the corruption is
   strongest: the heaviest distortion, the most tearing, the black lightning and
   the sparks.
5. It **collapses** and is gone.

**The corruption now follows the size, not the clock.** How hard a burst hits,
how large it is drawn, and whether it fires the strongest passes at all are
*all* read from how big the void actually is at that instant. A young void gets
a small, quiet flicker; a peaked one gets everything. Measured across a dozen
bursts: at a third of full size, 4 tear-bands and no erasure; at full size, 7
bands and the erasure pass.

**How it works (flow):**
1. A void opens and picks one of the five behaviours as before.
2. All five now play their character *over* one shared growth curve rather than
   owning their own timeline — the crawler is the calm version of the arc, the
   rupture tears past its own peak two-thirds through, the corruptor puts three
   escalating bursts along it, and so on.
3. Everything unstable in the effect is multiplied by how far up the curve the
   void has got, so instability and size rise together by construction rather
   than by being tuned to match.
4. Its bursts are scheduled at points on that curve; when one fires, the app
   reads the void's real current size and builds the corruption from it.

**Something that had to change alongside it:** with lives dropping from 14-22
seconds to 5, the old spawn interval of one void every 9-20 seconds would have
left the page empty about two thirds of the time. Voids now arrive every 4-9.5
seconds, which keeps the same feeling of presence as before — usually one on
screen, sometimes two or three, occasionally none.

**Two things caught by measuring rather than watching:**
- The first collapse was invisible. It was written as a single heavily-eased
  step, and measured at 80% of full size with only 3% of the life left — so the
  entire disappearance happened in the last hundred milliseconds and read as the
  void being switched off. It now folds down over about seven hundred.
- The intensity of a burst and the size it was drawn at were coming from two
  different places, so they could disagree. Both now come from one number.

**Technical concepts used:**
- One shared growth curve driving size, opacity, instability, redraw rate and
  corruption strength — so they cannot drift apart from each other
- An accelerating rather than constant growth rate, which reads as something
  opening under its own pressure instead of being scaled by something outside it

**Verified:** the arc was measured, not eyeballed — one void stepped through
nine points of its life reported 4801ms total, scale rising 0.15 → 1.11, opacity
0.35 → 1, and a visible fold at the end. Home and track at 1560, 1280, 768, 390
and 320: no sideways scrolling, neither layer ever under the cursor, a real link
still clickable during corruption, the page returning exactly to its previous
state, all five behaviours present, and nothing at all under reduced motion.

**Roadmap status:** no roadmap item — a visual-system change.

---

## 2026-09-05 — The voids are torn holes with fractures, not blobs with a tendril

**What was built:**
A screenshot made the problem obvious: a void looked like a smooth black potato
with one thin curl hanging off it. Decorative, not dimensional. Three things
changed, and the shape one mattered most.

**1. The outlines can now have corners.** The shape was drawn with a curve that
smooths *every* point it passes through, which is why no amount of adjusting the
numbers ever stopped it being a rounded blob — a torn hole is defined by its
sharp points and the notches bitten out of it, and the old shape could not
produce either. Selected points are now marked as corners and the curve is told
to keep them sharp.

**2. Four different kinds of shape**, so two voids on screen are not the same
drawing at different sizes:
- **blot** — a rounded mass with deep notches bitten out of it
- **tear** — a long thin rip with a hard point at each end
- **splinter** — angular, with a cluster of long spikes on one side
- **shatter** — many alternating in-and-out points; a hole that broke

**3. The single decorative tendril is gone, replaced by branching fractures.**
Black cracks now run out of the edge in straight jagged runs that fork twice and
taper to hairlines — the same reasoning the app's lightning uses, which is that a
crack turns sharply and a smooth curve reads as a ribbon.

**And the bursts got teeth.** When a void corrupts the page it now also whips
black fractures out across the interface and throws off small chips of ink and
colour, on top of the distortion that was already there. Every void is now
guaranteed at least one of these moments — previously more than half of the most
common type just drifted for twenty seconds and never did anything, which was
the single biggest reason the layer read as decoration.

**How it works (flow):**
1. A void opens and draws one of the four shape families and one of the five
   behaviours, independently — so a "quiet drifter" might be a jagged shatter or
   a long tear.
2. It writes its own animation, including its own sequence of shape changes.
3. At its scheduled moments, a temporary layer above the app distorts what is
   behind it, whips fractures across it, and throws sparks — then removes itself.
4. Nothing is left behind and nothing is ever clickable.

**Two mistakes worth recording, both caught by looking at pictures:**
- The first spiky shape came out as a symmetrical star, because each point was
  given an independent chance of being a spike and that spreads them evenly
  around the ring. Spikes are now chosen as a small cluster, so one side of the
  shape has three points and the other has none.
- The first burst fractures were enormous — the length being passed in was the
  length of the *first segment*, not the reach of the whole branch, which is
  about two and a half times larger before the forks are added. At full strength
  that drew 600-pixel branches eleven pixels thick, and the screenshot looked
  like a dead shrub laid over the page.

**Technical concepts used:**
- Collapsing a curve's control point onto a point to make a hard corner — the
  one-line change that turns a blob into a tear
- A recursive branch generator with hard tapering, for the fractures
- Fracture count scaled to the size of the piece, which both looks right (a tiny
  fragment should not have three branches) and bounds how much is drawn

**Verified:** home and track at 1560, 1280, 768, 390 and 320. No sideways
scrolling anywhere, neither layer ever sits under the cursor (154 hit-tests per
page per width), a real link stays clickable while corruption is on screen, the
page returns exactly to its previous state, all five behaviours appear, and
reduced motion renders nothing. Frame cost was measured three times against
three baselines on the same page and is indistinguishable from having no voids
at all — the numbers that looked like a slowdown turned out to be the test
renderer itself fluctuating, since the baseline moved the same way.

**Roadmap status:** no roadmap item — a visual-system change.

---

## 2026-09-05 — The voids now corrupt the interface around them

**What was built:**
The black voids added earlier were, fairly, too safe — they drifted and boiled
but they were decorations. They now behave like dimensional anomalies: each one
has a genuinely different personality, and when one fires it **breaks the
rendering of the real interface around it** for a fraction of a second before
everything snaps back.

**Five personalities, not five sets of random numbers.** A void draws one of
five behaviours when it opens:

- **Crawler** — quiet, drifts slowly, occasionally cuts to a new position
  without crossing the space between. The most common, and the reason the
  others feel sudden.
- **Rupture** — sits still, tears itself wide open, throws fragments outward,
  thrashes, and collapses. Over in about six seconds.
- **Swarm** — was never one hole: four to six pieces wandering on their own
  paths that drift apart and come back together.
- **Corruptor** — barely moves at all. Instead it breaks the page around itself
  two to four times, hard.
- **Blink** — arrives, changes shape faster than you can read it, and is gone in
  under two seconds. Often reappears nearby, so it reads as one thing hopping.

**The corruption is real, not a drawing of corruption.** When a void fires, the
actual pixels of the app behind it are affected: the interface is physically
dragged out of shape, its colour channels are pulled apart into red/blue
fringes, horizontal bands of it are shoved sideways, and occasionally a
void-shaped patch of the app is simply erased for a moment before returning.
The screenshots taken while testing show the progress graph's own line bent into
a wobble and the background structures dragged out of true.

**How it works (flow):**
1. A void opens on its own every 9-20 seconds and picks one of the five
   behaviours. Nothing you do triggers it.
2. It writes its **own** animation from scratch — its own path, its own timing,
   its own sequence of shape changes. Two voids never share a timeline.
3. That script also says when this particular void will corrupt the page, and
   how hard.
4. At those moments a second, temporary layer appears **above** the app for
   200-520ms and distorts what is behind it, then removes itself.
5. Nothing is changed permanently. The layer never receives clicks, and the app
   underneath is untouched the whole time.

**The restraint, which took as much work as the effect:** only one corruption
can happen every 2.2 seconds no matter how many voids want one; only the
corruptor and the rupture fire strong ones; the affected area was measured at
3.5% of the screen; and the whole thing is over before you could point at it.
Most of the time the page is completely clean and the voids are just sitting
there.

**Three bugs found by photographing the effect rather than reading the code —
all three looked completely correct as written:**
- The filter definitions were created in the same instant as the elements using
  them, so they did not exist yet. Every burst was drawing its fragments with no
  distortion behind them at all.
- The distortion was being masked to a shape measured in different units than
  the box it was applied to, so it was cropped and offset away from the hole.
- The distortion was aimed at the void itself — which is solid black — so it was
  faithfully distorting black into black. It had to be aimed at the area
  *around* the hole instead.

**Technical concepts used:**
- `backdrop-filter` — a CSS feature that filters whatever is rendered behind an
  element, which is what makes this real corruption of the real app rather than
  a picture of corruption
- An SVG displacement filter — drags pixels out of position, the only thing
  available that can actually move something already drawn
- Per-instance generated CSS animations — each void writes its own keyframes, so
  a slow drift and a hard jump can live in one timeline
- The app's existing fracture shards, imported from the check-in effect rather
  than reinvented, so a burst belongs to the same visual family
- `prefers-reduced-motion` — the whole thing renders nothing at all

**Verified:** home and track pages at 1560, 1280, 768, 390 and 320 pixels, with
the maximum number of voids forced open. No sideways scrolling anywhere; 154
hit-tests per page per width confirmed neither layer is ever what sits under the
cursor; a real link was confirmed clickable *while* corruption was on screen;
the page's text, position, colour and filters were compared before and after and
were identical; all five behaviours were observed; every animated element was
confirmed to be running its own unique animation; and with reduced motion on,
nothing renders. Frame timing during a burst was indistinguishable from the same
page with no voids at all.

**Roadmap status:** no roadmap item — a visual-system change, in the
Spider-Verse direction `CLAUDE.md` sets out.

---

## 2026-09-05 — Dimensional voids: small holes punched in the background

**What was built:**
Small irregular black shapes now open in the background every so often, sit
there for twenty seconds or so, and close. They are borrowed from the way The
Spot's dimensional patches behave in *Across the Spider-Verse* — hand-drawn ink
that crawls, breathes and occasionally breaks apart. There is no character and
no Spider-Man imagery; only the animation language of the holes.

The goal was that they read as **"reality has small holes in it"** rather than
"there are black circles floating around", and almost all of the work went into
that one distinction.

**How it works (flow):**
1. A void opens on its own every 11-24 seconds. Nothing you do triggers one, and
   nothing it does means anything — it is weather, like the lightning and the
   glitch already on the page.
2. It is drawn into the background layer, immediately **on top of** the drifting
   glows and the cyan multiverse structures, and **underneath** every part of the
   interface. So a void that drifts across one of those glowing shapes eats the
   part of it that it covers, while the app itself is never covered by anything.
3. It sits there. The constant motion is only a slow squash-and-stretch and a
   hand-drawn edge wobble; it travels less than 50 pixels in its whole life,
   which is slower than the glows already behind it.
4. When it closes, one time in six it breaks into two or three fragments where it
   was, and one time in five it closes here and reopens a little way off — so it
   reads as the same hole moving or failing, not as unrelated shapes appearing.
5. About one in six also gets a single hard "jump": it is in one place, then
   another, then back, with nothing drawn in between. That is the dimensional
   feeling, and it is rare on purpose.

**Why it can never make the app harder to read:** every piece of text in this
app is light on a dark background, and a void is pure black. Putting one behind
the interface can only make the ground *darker*, which raises contrast rather
than lowering it. Combined with sitting behind everything and ignoring the mouse
entirely, there is no arrangement in which a void hides or blocks anything.

**Two things found by looking at screenshots rather than by reasoning:**
- The first version sized the drawing box instead of the ink inside it, which
  quietly halved every void — a "170px spot" drew 87px of actual hole and the
  whole layer read as specks.
- The first version also nudged the horizontal and vertical position away from
  the centre independently, which sounds the same as "keep them near the edges"
  and is not: it made all four corners far more likely than the edges, and three
  voids promptly stacked in the bottom-right corner of the first screenshot.

**Technical concepts used:**
- Plain CSS animation and hand-generated SVG shapes — no animation library and
  no new dependency, matching the rest of the theme
- Three complete drawings of each shape swapped at about 7 frames a second,
  which is how hand-drawn animation gets its "boil"; a smooth computed wobble
  looks like software, three redrawings look like ink
- Only opacity and movement are animated, so the browser can hand the whole
  thing to the graphics card and none of it costs page performance
- `prefers-reduced-motion` — the effect renders nothing at all, rather than
  freezing, because a half-open hole frozen in place is just a black smear

**Verified:** home and track pages at 1560, 1280, 390 and 320 pixels wide, with
the maximum possible number of voids forced open at each. No sideways scrolling
anywhere; 154 hit-tests per page per width all confirmed the layer is never what
sits under the cursor; the layer confirmed to paint after the atmosphere and
before the UI; and with reduced motion switched on, nothing renders at all. The
check is saved as `qa/spots-check.mjs` rather than thrown away, because this is
the fourth browser check in this project to be lost with a session.

**Roadmap status:** no roadmap item — a visual-system addition, in the
Spider-Verse direction `CLAUDE.md` sets out.

---

## 2026-09-05 — The elevation graph now covers two weeks, not twelve

**What was built:**
The elevation graph was drawing a twelve-week span against about a week of real
activity. Nine tenths of it was flat empty ground and everything that had
actually happened was crushed into a near-vertical spike jammed against the
right-hand edge — it read as a broken chart rather than as progress. It now
covers **two weeks**, so the climb spreads across most of the frame and looks
like the thing it is describing.

The consistency heatmap below it keeps its full twelve weeks, unchanged.

**Why two weeks and not three:** two weeks is the whole number of weeks closest
to a fortnight, so the caption reads as a span a person actually thinks in. With
the activity currently in the database, three weeks would have left about 62% of
the graph as empty run-up before the first day of data; two weeks leaves about
36%. When there is more history to fill a longer frame, lengthening it is one
line.

**How it works (flow):**
1. Two spans are now written down separately, in a new file `lib/windows.ts`:
   the elevation graph's fourteen days, and the heatmap's twelve weeks.
2. When a page loads, the part of the app that reads the database works out two
   cut-off dates from those, instead of one.
3. Activity newer than the graph's cut-off feeds the graph. Activity newer than
   the heatmap's — much older, much more of it — feeds the heatmap.
4. Every caption that names a span ("2 weeks" under the graph, "12 weeks" on the
   Consistency panels, and the descriptions read aloud by screen readers) is
   now generated from those two numbers rather than typed out by hand, so the
   words and the drawing cannot disagree again.

**The trap this avoided, because it is the kind that looks fine and is not:**
One setting was quietly doing two jobs. The graph's span *also* decided how far
back the app fetched activity for the heatmap — while the heatmap had its own,
completely separate "draw twelve weeks of squares" instruction. Shortening the
graph by editing that one number would have left the heatmap drawing all 84 of
its squares with ten weeks of them permanently blank, because the data behind
them had been thrown away before it ever arrived. The two are now separate
settings that cannot be confused for one another.

**One consequence worth knowing about:** the big "Elevation" figure counts
activity *inside the graph's window*. Over twelve weeks that was hard to notice;
over two weeks it means the number will start going down as activity ages out of
the fortnight — around five days from now, with the current data. That is a
change in what that headline number means and it was not part of this request,
so it has been left alone and written up in `docs/DECISIONS.md` rather than
silently redesigned.

**Also fixed:** the sentence under the Elevation figure said "check-ins over 12
weeks". "Check-in" was the old once-a-day tick on a Task, and Tasks no longer
exist — the app counts activity on leaf topics, several of which can land on the
same topic on the same day. It now reads "activities over 2 weeks".

**Technical concepts used:**
- One small file naming every "how far back do we look" span, with the reason
  each is the length it is — so the next window added cannot borrow a number
  chosen for something else
- Captions written from the constants instead of typed out, which is what stops
  the words and the data drifting apart
- A required argument instead of a defaulted one on the per-topic history strip,
  which had been silently inheriting the graph's span

**Verified:** home page and track page at 1560, 1280, 390 and 320 pixels wide —
no sideways scrolling at any of them, and the caption reads "2 weeks" at all
four. The decoupling was proved rather than assumed: a 35-day-old activity row
was planted in a *copy* of the database, and the heatmap picked it up (8 active
days instead of 7) while the graph correctly ignored it (still 52 over two
weeks). `./qa/run-tests.sh` passes all three suites; type checking and linting
are clean. Checked against a throwaway copy of the app on its own port and its
own copy of the database, so the running app and the real data were untouched.

**Roadmap status:** no roadmap item — a correctness and legibility fix to Phase
2 work already shipped.

---

## 2026-09-05 — The elevation graph no longer runs off the edge of the screen

**What was built:**
The graph in the page header stretches to the right edge of the window by
design, and the newest point on it is *today* — so today's marker was sitting
about seven pixels from the edge of the screen. The steepest, most recent and
most meaningful part of the curve was exactly the part squeezed against the
border, and it read as a graph running off the page.

The data now stops short of the edge. Today's marker sits 60px in on a wide
monitor and 19px in at the narrowest size checked.

**How it works (flow):**
1. The drawing reserves a gutter down its right-hand side, and the curve, the
   milestone markers and today's dot are all plotted into the narrower space
   that leaves.
2. The baseline and the horizontal strata still run the full width, so the
   *ground* carries on past today while the *data* ends. That is the honest
   reading of a timeline that ends at now, and it keeps the full-bleed look the
   header was designed around.
3. The caption underneath ("12 weeks" / "next 100") was pulled in by the same
   proportion, so "next 100" sits under the end of the curve rather than out
   past it.

**Technical concepts used:**
- A single reserved width used everywhere the data is plotted, so the curve, the
  markers and the caption cannot drift apart from each other

**Verified:** measured today's marker at four window widths — 60px, 51px, 23px
and 19px clear of the edge, against about 7px before. No sideways scrollbar on
the home page at any of them, and the numbers on screen are unchanged.

**Roadmap status:** none. A visual correction, requested directly.

**Found while checking, and NOT fixed:** at a 320px-wide window the *tree view*
of a track pushes 4px past the screen, because the row of buttons beside each
topic (`+ Inside / Rename / Move / ↑ / ↓ / Delete`) is set never to shrink, and
five levels of indentation leave it no room. That is a separate fault in the
tree view, not in the graph, and it was left alone because this request was
specifically about the graph.

---

## 2026-09-05 — The multiverse structures are properly neon now

**What was built:**
Only the outlines changed — the shapes and their placement are exactly as they
were. They were being drawn in a single faint cyan, which on a near-black page
reads as a muted teal line rather than as anything lit.

They are now drawn the way the app already draws its lightning: a wide, blurred,
saturated cyan halo underneath, and a thin near-white filament on top. That
pairing is what makes a line look like a glowing tube instead of a drawn edge —
a single colour at any brightness is still just a line.

**How it works (flow):**
1. Every outline is stroked twice. The first pass is wide, blurred and in the
   app's cyan; the second is thin and in a pale cyan that is almost white.
2. Near faces get the strongest version, far faces and the connecting edges a
   weaker one, so the depth of each structure is lit as well as drawn.
3. Everything was brightened to match — the structures roughly doubled in
   strength and the connecting threads went up with them.

**Kept restrained where it matters:** the small structures inside panel corners
sit *inside* the reading area, so they take the same treatment at a fraction of
the strength.

**No new colour:** the pale filament is the same value the lightning already
uses, and the halo is the existing cyan token. Nothing was added to the palette.

**Verified:** wide monitor, laptop and phone — no sideways scrollbar on any, no
console errors, content still readable on all three. Checked home, progress and
a track page. Full suite re-run: 72 browser checks and three logic suites, all
passing.

**Roadmap status:** none. A visual adjustment, requested directly.

---

## 2026-09-05 — Multiverse threads redone as defined structures, not a field of cells

**What was built:**
A second pass on the threads. The first attempt was structurally right — straight
edges, no spiderwebs — but it filled the margins with *many* small similar
shapes, which reads as texture rather than as anything in particular. The film
puts a handful of large, clearly-defined shapes on screen and runs long glowing
lines between them.

So there are now **five structures on the whole page**, not a field: one clearly
dominant on the left, two on the right, two small ones in the corners. Long neon
threads run between them and carry on past the edges of the screen.

**What gives each one an identity:** every structure is drawn as a solid seen at
an angle, not as a flat outline. It has a near face, a smaller far face pushed
off to one side, and edges joining their corners — so the eye reads it as a
three-dimensional cell you are looking into. A flat polygon has no near and no
far; that is the whole difference between "a shape" and "a structure".

**The threads are drawn behind the structures**, so a thread arriving at one
disappears underneath it and reads as passing into it rather than stopping at
its edge. Several threads run off the side of the screen instead of stopping,
which is the only thing in the picture that can say the structure continues
outside the window.

**The neon:** each line is drawn twice — a wide blurred faint pass for the glow
and a thin bright pass for the crisp core. Near faces are drawn brightest, far
faces and connecting edges dimmer, so depth is lit as well as drawn. Same cyan
as before; nothing from the reference's orange was used.

**A bug worth recording:** the connecting threads were invisible on the first
render. Their width was written as a fraction of the drawing's own coordinate
space, but these strokes are set to keep a fixed screen thickness — so the
number was being read as a sixth of a pixel. The structures appeared,
unconnected, which looked like a composition choice rather than a fault.

**Also adjusted:** the small structures inside panel corners were dimmed once the
neon core got brighter, so they sit behind the row rather than in front of it.

**Verified:** wide monitor, laptop and phone — no sideways scrollbar on any, the
two smallest structures correctly drop out on the phone. Checked home, progress
and a track page, and confirmed the whole page still renders zero curved
decorative strokes. Full suite re-run: 72 browser checks and three logic suites,
all passing.

**Roadmap status:** none. A visual redesign, requested directly.

---

## 2026-09-05 — Spider webs replaced by multiverse threads

**What was built:**
The spider webs are gone from the whole app and a "multiverse threads" system has
taken their place, based on the Spider-Society lattice from the film.

The difference is structural rather than a restyle. A spider web has a centre,
straight lines radiating out from it, and curved rings sagging between them. The
lattice in the reference has none of those: it is long *straight* struts meeting
at corners, enclosing irregular many-sided cells at very different sizes, with
more cells behind them fading into the dark. So the new drawing has no centre, no
rings and no curves anywhere — the whole app now renders zero curved decorative
strokes, which was checked rather than assumed.

**Where it shows:**
1. **Around the whole page** — two tall lattices down the left and right margins,
   plus two smaller clusters at opposite corners. The margins are the only space
   the layout reliably leaves free, which is what lets the threads be dense
   enough to read as a structure without ever sitting behind a sentence.
2. **In panel corners** — a much sparser fragment than the old webs, suggesting
   the lattice continuing behind the interface.
3. **Hanging from section rules** — a small run of threads instead of the old
   half-web.
4. **The empty state** — a fragment of lattice with nothing in it, keeping the
   same slow breathing animation it already had.

**What makes it look like a dimension rather than a network diagram:**
- Cells enclose space; a diagram is dots joined by lines. Enclosed areas are what
  the eye reads as depth.
- Neighbouring cells differ in size by two or three times, and each is drawn at
  its own brightness — so some read as near and some as far.
- Cells overlap and their edges cross, so the field reads as one interlocked
  structure instead of separate shapes that happen to sit near each other.
- Cells are skipped at random, so the invisible grid they were placed on never
  becomes visible.
- A few long lines run right across each field, entering and leaving, which says
  the structure carries on past the edge of the screen.

**Technical concepts used:**
- Seeded randomness — the same seed always draws the same lattice, which is
  required because these render on the server and a genuinely random drawing
  would not match what the browser then draws
- `preserveAspectRatio="slice"` — lets each field cover its box at any screen
  shape instead of being letterboxed into a strip

**Colours unchanged:** the same cyan, the same faintness. None of the orange or
yellow from the reference image was brought across.

**Preserved:** the section rules reserve exactly the same height as before, so no
page moved by a pixel. Lightning, glitch effects and the background atmosphere
are untouched.

**Verified:** looked at it on a wide monitor, a laptop and a phone — no sideways
scrollbar on any, the corner clusters correctly drop out on the phone, and the
side lattices narrow to hug the edges. Checked home, progress and a track page.
Re-ran the full suite afterwards: 72 browser checks and three logic suites, all
passing.

**Roadmap status:** none. A visual replacement, requested directly.

---

## 2026-09-04 — The background webs read as webbing, not corner stickers

**What was built:**
A visual refinement to the spider webs sitting behind the whole app. They used
to be four complete quarter-webs, one tucked neatly into each corner of the
screen. Four of the same thing in four corners reads as a border pattern, and a
web that stops tidily inside the frame reads as a sticker someone placed there.

Now there are three, each bigger than the space it has and pushed out past its
corner so the screen cuts it off. What you see is part of a larger web that
carries on off-screen. Each is turned slightly, by a different amount, so they
do not look like copies of one shape.

The fourth corner is deliberately left bare — that is what stops the arrangement
resolving back into a frame, and it is also the simplest way to have less sitting
behind the interface.

**New: strands running in from the edges.** Two small groups of silk threads now
run inward from the left and right edges, tied to each other here and there with
short cross-links. Real webs have long anchor lines like these before they have
any spiral, and they are what makes a space feel webbed rather than decorated at
the corners.

**How it works (flow):**
1. The web layer sits behind everything and is cropped by the edges of the
   screen, so pushing a web outward hides its middle and leaves the outer sweep.
2. Each web is turned about its own anchor point rather than its centre, so it
   pivots where it is attached instead of swinging away and leaving the corner
   bare.
3. How far each web is pushed out is expressed as a *proportion of its own size*
   rather than a number of pixels, so when the webs shrink on a phone the same
   fraction is cropped and they still look right.
4. The right-hand strand group is hidden on narrow screens, where the content
   fills the full width and it would sit directly behind the interface.

**Technical concepts used:**
- CSS percentage translation — resolves against the element's own size, which is
  what makes the cropping survive the responsive resize without a second set of
  hand-written numbers
- `transform-origin` set to each web's anchored corner, so rotation pivots on the
  hub

**Deliberately not touched:** the webs inside panels and the ones hanging from
section rules. Those are different elements with their own reasons, and changing
them would have meant changing panels and spacing, which was out of scope.

**Verified:** looked at it on a wide monitor, a laptop and a phone; no sideways
scrollbar at any of them, and the right-hand strand group correctly disappears on
the phone. Re-ran the full suite afterwards — 72 browser checks and three logic
suites, all passing.

**Roadmap status:** none. A visual refinement, requested directly.

---

## 2026-09-04 — The yellow milestone lines no longer cross the page

**What was built:**
A visual fix. The dashed yellow lines marking elevation milestones used to run
all the way across the graph — and because the graph bleeds off the right edge of
the screen, they ran right across the whole page. They were bright, they escaped
the column everything else lines up in, and with only a week of data the graph is
mostly empty, so those two lines were the loudest thing in it.

They now appear only *inside* the ground, so in practice you see a small yellow
number on the left at the milestone's height and a yellow dot where you actually
crossed it, with nothing stretched between them.

**Why that particular fix:** every other horizontal line in that graph — the rock
strata — is already clipped to the shape of the ground. The milestone line was
the one exception, and a line floating in empty sky is what made it read as page
furniture rather than as part of the landscape. Clipping it the same way fixes
the cause rather than just dimming it, which is why it can stay clearly legible
instead of being faded almost to nothing.

The line also now stops at the point the milestone was crossed. Past that point
it said nothing anyway: elevation only ever rises, so once you are above a level
you stay above it.

**Technical concepts used:**
- SVG `clipPath` — the same one the strata already use, so both are clipped to
  the same landform shape and cannot drift apart

**Verified:** re-ran the full suite after the change — 72 browser checks and
three logic suites, all passing — and looked at the graph on both the home page
and a track page.

**Roadmap status:** none. A visual correction, requested directly.

---

## 2026-09-04 — Tasks replaced by a nested Topic tree, with contribution tracking

**What was built:**
The biggest change so far. "Tasks" no longer exist. Instead, a Track holds a
**tree of Topics** that can contain other Topics, up to five levels deep. A Topic
with nothing inside it is the thing you actually work on; a Topic with things
inside it is a heading, and shows how much of its contents you covered.

Working something is now a **count**, not a tick. Click it once, it counts once;
click it five times, it counts five. There is an undo for the most recent click.
The colour goes from dark green to bright green across five steps, and stops
getting brighter after five even though the real number keeps going up.

**How it works (flow):**
1. You open a Track. By default you get the **flat view**: a plain list of every
   workable topic in the track, with the path above it ("Arrays › Two pointers")
   so two things called "BFS" are still telling apart.
2. A **Tree** toggle switches to the full hierarchy, where headings can be
   collapsed and each one shows "2/3 today" — how many of its direct contents
   you touched.
3. Clicking a leaf's green square records an activity. The number changes
   immediately, before the save finishes, so it feels instant; if the save fails
   the number goes back and an error appears.
4. That click is stored as one row per topic per day, with a count. Everything
   else in the app — streaks, the ring, the graph, the history table — is worked
   out from those rows when the page loads. Nothing is stored twice.
5. You can rename, move and reorder topics. Moving checks two things before
   allowing it: you cannot move something inside itself, and the whole branch you
   are moving has to still fit inside five levels.
6. Deleting a heading that still has things inside it is refused. Deleting a
   workable topic hides it but keeps its history, so the record of days you
   worked it stays visible.

**Three different measurements, kept deliberately separate:**
- **A leaf's intensity** — how many times *that one thing* was worked today.
- **A heading's coverage** — how many of its direct contents were worked, not how
  many times. Clicking one child ten times does not make the heading look more
  covered, because that is not breadth.
- **A track's coverage** — how many workable topics were touched, out of all of
  them. Two of eight is 25%, however many clicks those two got.

**Technical concepts used:**
- A **self-referencing table** (a Topic row can point at another Topic as its
  parent) — this is what makes unlimited nesting possible with one table
- A stored `depth` number on each row — so the five-level rule can be checked
  with one lookup instead of walking up the tree every time; it is rewritten for
  the whole branch when something moves
- **Soft delete** (a `deletedAt` date instead of removing the row) — so history
  survives deletion
- **Optimistic updates** (React's `useOptimistic`) — the count changes on the
  click and the server catches up; if the server refuses, the number reverts on
  its own
- Database-enforced "one row per topic per day", so a double-click cannot create
  two rows

**What was removed:** the `Task`, `TaskCheckIn` and `CompletionLog` tables, and
the check-in "beat" that composed the tick, the report line and the flashing
number into one moment. That machinery was published from the task row, and with
tasks gone nothing could trigger it. The streak-milestone celebration went with
it — the maths is still there and still tested, but nothing shows it.

**A bug worth recording, because it nearly shipped invisibly:** the example data
wrote dates as numbers while the app writes them as text. SQLite sorts all
numbers before all text regardless of value, so every "activity since this date"
query silently matched nothing — and only one panel in the whole app used one, so
everything else looked perfect. The seed now writes dates the same way the app
does and fails loudly if it ever doesn't.

**Verified:** 68 checks in total. The tree rules (depth, cycles, coverage,
tiers) have a new logic suite of 46 assertions; the app itself was driven in a
real browser for the rest — creating four levels of nesting, being refused a
sixth *with the client-side guard deliberately bypassed*, refusing a cycle,
reordering, moving a branch and confirming its depths and history followed it,
being refused a parent delete, soft-deleting a leaf and finding it still in the
history marked deleted, and checking every number on screen against the same
figures computed independently in SQL.

**Roadmap status:** new Phase 2 item, marked [x] in `docs/ROADMAP.md`. Several
earlier Phase 1 and Phase 2 items are now marked superseded there rather than
deleted, since they record what was actually built at the time.

---

## 2026-09-04 — "Add new task" is a button now, not a box sitting open

**What was built:**
Every topic used to show an empty task box permanently, so a track with two
topics showed two identical empty boxes and the page read as a form to fill in
rather than as a list of what you are learning. Now each topic shows a small
"+ Add new task" link instead, and the box only appears when you ask for it.

**How it works (flow):**
1. A topic shows "+ Add new task" and nothing else.
2. Click it → the name box, the difficulty dropdown and the Add button appear,
   with the cursor already in the name box so you can type straight away.
3. Type a name, click Add → the task is created and appears in the list.
4. The box **stays open** and empties itself, so you can type the next task
   immediately. Adding tasks is the one thing here anyone does several times in
   a row, and closing after each one would cost a click per task.
5. Press Escape, or click Cancel, to put it away again.

**Technical concepts used:**
- The open/closed state lives inside the task form itself, so nothing else on
  the page had to change to support it
- `aria-expanded` on the trigger — tells a screen reader whether the form it
  controls is currently showing
- Focus is moved into the box on open and back to the trigger on close, so
  someone using only a keyboard is never dropped somewhere unexpected

**Verified:** drove the whole sequence in a real browser against a copy of the
database — no box on load, two triggers (one per topic), click opens and focuses
the field, typing a name and pressing Add creates the task and shows it in the
list, the field clears and stays open, and Escape closes it and returns focus to
the trigger. The created task was confirmed in the database. No console errors.

**Still open:** the *topic* box at the top of the same page still sits open
permanently, and is now the only always-open empty box on the screen. Left as-is
because only the task box was asked about.

**Roadmap status:** none. An interaction change, requested directly.

---

## 2026-09-04 — Bigger glitch, another second on it, and the input hints are gone

**What was built:**
Two things. The glitch effect grew again and now runs about a second longer, and
the grey example text inside the three "add" boxes is gone.

**The glitch:**
- The area it fractures across grew by roughly a third in each direction. A
  small label like "Elevation" now breaks apart over about 126x86 pixels,
  against 96x62 before.
- The three coloured copies pull further apart to match — about two thirds of
  the letter height rather than half — so they stay as far apart relative to the
  bigger space they now have.
- It holds for about a second longer: the fade now starts at two to three
  seconds instead of one to two, and a whole event lasts roughly 2.4 to 3.6
  seconds. Measured on the running app: 2.8 to 3.2 seconds.

Nothing else needed changing for the longer hold. The shards take as many cycles
as fit, the wandering copies take as many turns, and the sparkles spread along
whatever length the hold is — so the duration is a single number and everything
follows it.

**Worth stating plainly:** this effect is now *longer* than a lightning strike,
where it started out deliberately much shorter so the two could never be
confused. That trade was made knowingly and on request; it has now gone past
"same length" to "the glitch is the longer one".

**The placeholder text:**
The three boxes you type into had grey example text in them — "e.g. DSA,
Spanish, Guitar" for a new track, "e.g. Arrays, Graphs, Present tense" for a new
topic, "e.g. Solve: Two Sum" for a new task. All three are removed, and the
now-unused setting that carried them was removed from the shared form component
rather than left dangling.

This costs nothing for screen readers: each box already had a proper hidden name
("Track name", "Topic name", "Task title"), so the example text was never what
identified the field.

**One thing worth knowing:** the task box's example was "e.g. Solve: Two Sum",
which is the exact example `CLAUDE.md` uses for what a Task must *never* be — it
says a Task is a repeating activity like "Practice array problems", not a
one-time item like "Solve: Two Sum". So that hint had been teaching the wrong
idea; it is gone either way.

**Technical concepts used:**
- `aria-label` (a hidden name attached to a form field for screen readers) —
  already present on all three boxes, which is why the visible hints could go
- Removing the unused `placeholder` input from the shared create-form component,
  rather than passing an empty string, so nothing is left half-wired

**Verified:** the effect still switches off entirely under reduced motion, still
never overlaps itself, and still causes no sideways scrollbar at 1440, 1280, 390
or 320 pixels wide. The track box confirmed to still report its name correctly
with no visible hint.

**Roadmap status:** none. Visual tuning and a copy removal, both requested
directly.

---

## 2026-09-04 — The glitch now lingers for a second or two

**What was built:**
The glitch effect holds much longer. It used to be over in about six-tenths of a
second — a blink. It now stays corrupted for one to two seconds and then fades
away over another half-second, so you get time to actually look at it.

**How it works (flow):**
1. The three coloured copies of the text pull apart as before, over about a
   tenth of a second.
2. Then, instead of sitting frozen, they keep *wandering* — jumping around the
   position they landed in, in small discrete steps, for the whole hold. Each of
   the three copies wanders on its own timing, and the three timings are chosen
   so they never fall back into step with each other.
3. The coloured triangles no longer play once and vanish. Each one keeps
   breaking out and snapping back for as long as the hold lasts, every piece on
   its own rhythm, so the cluster shimmers rather than sitting still.
4. The white sparkles are now spread out across the whole hold instead of all
   popping in the first fraction of a second, so there is something catching the
   light throughout.
5. When the fade starts, everything dims out together — but the pieces are still
   moving as they go, rather than freezing first and then fading.

**Why the extra work:** simply making the hold longer would have produced a
still picture pasted over a word for two seconds. A glitch that stops glitching
is a sticker. Keeping the plates disagreeing for the whole hold is what the
extra timing machinery buys.

**One thing given up, deliberately:** the original spec made this effect short
*specifically* so it could never be confused with a lightning strike — two
different kinds of thing should not last the same time. At one to two seconds
they now do occupy the same range, and the two can be on screen together. They
still start at least a second apart, and they still look nothing alike.

**Technical concepts used:**
- Looping animations with deliberately mismatched timings (190/230/270
  milliseconds, which share no common factor) — the same trick the background
  glows already use, so the pattern never visibly repeats
- A separate fade animation layered over the top of the looping one — in CSS an
  animation only affects the properties it names, so the fade can control
  brightness while the loop underneath keeps controlling movement
- Sparkle timings spread along the hold rather than clustered at its start

**Verified:** measured lifetimes of 1.5 to 2.3 seconds from a clean start, and
confirmed the pieces genuinely keep moving through the hold rather than
freezing. Reduced motion still disables it, it still never overlaps itself, and
there is still no sideways scrollbar at 1440, 1280, 390 or 320 pixels wide. An
80-second unattended run: seven glitches, gaps of 8 to 14 seconds, no errors.

**Roadmap status:** none. Visual tuning, requested directly.

---

## 2026-09-04 — Making the glitch big enough to actually see

**What was built:**
No new feature — the glitch effect from the entry below, resized. As first
built it was correct but too small to notice: it fitted itself to the letters
plus six pixels, so glitching a small label like "Elevation" happened inside a
box about the size of a postage stamp and read as a smudge rather than as the
screen corrupting. It now breaks out well past whatever it lands on.

**How it works (flow):**
1. The area the glitch plays in is no longer the words plus a fixed margin. It
   grows with the target and has a generous floor, so even the smallest label
   gets an event roughly three times its own size.
2. How far the three coloured copies of the text pull apart is now tied to how
   big that text is — about half the height of the letters — instead of a fixed
   number of pixels that was too much on small type and invisible on large.
3. The triangles were then *concentrated back onto the words*. Scattering them
   over the whole enlarged area made the effect look like confetti around a
   label rather than a label breaking apart, so the coloured pieces cover the
   text plus a halo while the split copies and the sparkles use the full area.
4. There are more triangles now, and each is smaller relative to the area, which
   is what keeps it reading as a fracture rather than as a few flat slabs.

**Technical concepts used:**
- Sizes derived from the target rather than hard-coded — the same change made in
  four places (the glitch area, the colour split, how far pieces fly, and how
  big the sparkles are), because each one had been tuned against a single
  example and then broke on a different-sized one
- Two nested areas rather than one, so the pieces and the colour copies can be
  concentrated and spread respectively without either fighting the other
- A small colour weighting: cyan appears twice in the list of shard colours,
  because magenta and red are neighbours and an even draw between the three
  made large clusters come out as one red mass

**Verified:** re-checked everything from the entry below at the new size —
reduced motion still disables it, still never overlaps itself, event still
lasts under 0.8 seconds, and still no sideways scrollbar at 1440, 1280, 390 or
320 pixels wide. The two ambient effects still stagger apart, five runs in five.

**Roadmap status:** none. Visual tuning, requested directly.

---

## 2026-09-04 — A second kind of weather: the screen glitch

**What was built:**
A new ambient effect that makes one thing on screen briefly *corrupt*, the way
the film does when a character starts falling apart: the text tears into three
mis-coloured copies, a cluster of coloured triangles breaks out over it, and a
few sharp white sparkles pop where the pieces cross. It picks its own victim —
a heading, a small label, a number, the "Rendred" wordmark — fires roughly every
ten to twenty seconds, and is gone again in about two-thirds of a second.
Everything else on screen is left completely alone while it happens.

This is a sibling of the lightning, not of the check-in shatter. The lightning
and this are both weather: they arrive on their own and mean nothing. The
check-in shatter is unchanged and still means "that worked".

**How it works (flow):**
1. A timer in the layout waits a random ten to twenty seconds.
2. When it goes off, the effect looks at what is currently on screen and builds
   a list of things worth glitching — panel captions, section labels, headings,
   numbers, the wordmark. It skips buttons, sliders and text boxes on purpose:
   a glitch over a control you are about to press reads as the control breaking.
3. It picks one at random and measures where that item's *words* actually sit —
   not the invisible box around them, which in this layout is usually the whole
   width of the page. It then grows that area outwards to give the glitch room
   to break out of.
4. It draws its own layer on top at exactly that spot. Nothing about the real
   text is touched, so it stays readable underneath the whole time.
5. Three copies of the text appear in red, cyan and magenta, offset apart by
   about half the height of the letters. Then ten to sixteen triangles snap in
   over them. Then three to six four-pointed sparkles pop, slightly staggered.
6. It holds for a moment and then everything slides back into place and fades.
   The whole thing lasts between half a second and eight-tenths of a second —
   deliberately about a third as long as a lightning strike, so the two never
   feel like the same event.
7. If your system is set to reduce motion, none of this ever starts.

**Technical concepts used:**
- Reused the check-in shatter's triangle generator rather than writing a second
  one — it grew two settings (which colours, and how big the pieces are) so both
  effects can share it without either being stuck with the other's tuning
- A shared "clock" both ambient effects check before firing — if the other one
  went off in the last second, this one waits a few hundred milliseconds so they
  do not pile into one busy moment
- Browser `Range` measurement — how the effect finds where the actual letters
  are, rather than the empty column around them
- A brightness check on whatever the text is sitting on — the effect adds light,
  so on an already-bright surface it would wash out to a white smear; anything
  that bright is skipped
- CSS keyframes and `clip-path` only, no animation library, matching how the two
  existing effects were built

**Verified:** driven for 90 seconds with nobody touching it — seven glitches,
six different targets, gaps of 8 to 19 seconds, zero errors. Also checked: it
never runs under reduced motion, never overlaps itself even when fired five
times in a row, and adds no sideways scrollbar at 1440, 1280, 390 or 320 pixels
wide.

**Roadmap status:** none. This is visual work, requested directly; it does not
belong to a roadmap phase and nothing in `docs/ROADMAP.md` changed.

---

## 2026-09-04 — The lightning became weather

**What was built:**
The blue lightning was rebuilt from scratch and now works completely
differently. It is no longer attached to anything you do — it simply happens,
roughly every ten to fifteen seconds, on its own, for as long as the page is
open. Each bolt now starts *on* an edge of the interface (the border of a panel,
the line under the masthead) and grows away from it, and it is a much more
detailed shape: a trunk with branches, and smaller branches off those, thinning
to hair-fine tips.

**How it works (flow):**
1. A timer waits a random 8-18 seconds.
2. It looks at what is currently on screen and collects the real edges — panel
   borders, the masthead rule, the sides of the page column — then picks one at
   random and a random point anywhere along it.
3. It grows a trunk outward from that point, away from the edge. Branches fork
   off the trunk at uneven places and angles, and smaller branches fork off
   those. Each level is about 40% shorter and 45% thinner than its parent, which
   is what tapers the tips to threads.
4. The bolt snaps on in about a tenth of a second, holds for a second or two,
   then fades away smoothly. Struck fast, dissipating slow.
5. Then the timer starts again with a new random wait, and the next bolt is a
   brand new shape somewhere else.

**Technical concepts used:**
- **Why it stopped being a reward.** The old version fired when you pressed ADD
  and when your elevation went up, and it was reported as invisible — it was.
  The elevation one only fired on a *second* check-in the same day, so checking
  one task off once a day never showed it, and on the create flow the coloured
  shatter landed on top and erased it. Rather than keep tuning it against those
  collisions, it was reclassified: it is atmosphere, not feedback. Feedback has
  to be reliable; weather does not.
- **Branching that repeats at three scales** is what makes it look like a real
  electrical discharge (the pattern is called a Lichtenberg figure) rather than
  a zigzag with a couple of forks. Measured on a real bolt: 44 segments, split
  4 trunk / 21 branches / 19 sub-branches.
- **One at a time, rarely two** — more than that stops reading as an occasional
  flicker of power and starts reading as a storm.
- **Off entirely when the system asks for reduced motion**, not slowed down.
- **A narrow-screen bug found and fixed on the way**: each bolt is drawn on a
  520px canvas, and one starting near the right edge of a phone-width window
  pushed the page sideways and produced a horizontal scrollbar. The bolt layer
  now trims anything past the page edge without affecting anything else.

**Roadmap status:** no roadmap item — a visual pass on the Spider-Verse
direction in `CLAUDE.md`. Phase 2 still has the learning trajectory view open,
waiting on real check-in data.

---

## 2026-09-04 — Blue lightning and a shatter glitch

**What was built:**
Two new effects. A branching blue-white lightning arc that flickers across the
elevation number when it climbs and off the ADD button when you press it, and a
"shatter" — the thing you touched briefly fractures into mismatched coloured
triangles and snaps back — which is now what confirms a check-in or a newly
created track. There is also a hidden `/lab` page that shows both on their own,
so their timing and colours can be judged without hunting for them in the app.

**How it works (flow):**
1. **Lightning.** A jagged path is generated in code — straight segments with
   sharp turns, never smooth curves — with two to four smaller forks branching
   off it, each getting shorter and thinner as it goes. A brighter core sits on
   a wider blurred copy of itself, which is what makes it look electric.
2. It flickers on and off three times in about 70 milliseconds and then fades,
   because real electricity is instant and irregular. A smooth repeating pulse
   would look like a neon sign.
3. Every strike is drawn fresh, so no two are the same shape.
4. **Shatter.** Nine or so triangles are laid over the thing that changed, each
   cut from a solid colour, each nudged a few pixels and a few degrees out of
   line — then they snap back into place and fade, in about a third of a second.

**Technical concepts used:**
- **Only the two properties browsers can move cheaply** — position and opacity.
  Nothing changes size or layout, so the page never has to be re-measured while
  an effect plays.
- **Nothing fires on bad news.** Undoing a check-in gets no shatter; elevation
  going *down* gets no lightning. And on the track page the bolt only appears
  when the check-in was about elevation, so one tap never sets off five things
  at once.
- **Turned off entirely for reduced motion**, rather than frozen. The background
  atmosphere stays frozen because it is a place; a flash of lightning held still
  would just be a permanent scribble.
- **Two things in the brief were not followed, deliberately** — a proposed
  animation library was left out because the effects are a timer and a CSS rule
  and the project has a standing rule against adding one, and green shards were
  swapped for the palette's own colours because this theme has no green. Both
  flagged rather than silently changed.

**Roadmap status:** no roadmap item — a visual feature pass on the Spider-Verse
direction recorded in `CLAUDE.md`. Phase 2 still has one item open, the learning
trajectory view, waiting on real check-in data.

---

## 2026-09-04 — Stabilization pass: four fixes, no new features

**What was built:**
Nothing new — this was a hunt for things that would bite in real daily use. Four
real problems turned up and were fixed: double-clicking Delete on a track caused
a server error, the delete confirmation did not actually highlight the name of
the thing you were about to delete, error messages looked like ordinary grey
text rather than errors, and the little arrow that opens and closes a topic was
too small to click comfortably.

**How it works (flow):**
1. **Double-click Delete.** The first click removed the track; the second
   arrived, found nothing to remove, and the database driver treated that as a
   failure — a real error in the log for something the user saw as working. It
   now uses a "delete anything matching this" call, which quietly does nothing
   the second time. The other two delete buttons already worked this way; the
   track one had been missed.
2. **"Delete Arrays and its 1 task?"** The name was marked to stand out using
   bold. The app uses a single-weight font on purpose, and bold is switched off
   so it cannot smear — so the name rendered *identically* to the rest of the
   sentence. It now works the other way round: the sentence is dimmed and the
   name is left bright.
3. **Error messages** were the same grey as ordinary secondary text, and while
   the field was correctly marked invalid for screen readers, it did not *look*
   any different. Errors are now red, and the field itself turns red — the same
   red already used on the Delete buttons.
4. **The topic open/close arrow** was a 13x14 pixel target, well under the 24x24
   minimum, and it is the only way to show or hide a topic's tasks. It is now a
   24x24 target. The arrow itself is unchanged; only the clickable area grew.

**Technical concepts used:**
- **Checked the colours against what is actually on screen** rather than against
  the intended value — the form sits on a slightly lighter panel than the page
  background, so the red measures 4.68:1 there rather than the 5.0:1 the raw
  numbers suggest. Still above the 4.5:1 minimum, but only because it was
  measured.
- **Reproduced each problem before fixing it.** One suspected bug (deleting the
  wrong track) turned out to be a mistake in the test, not the app, and was
  dropped rather than "fixed".
- **Also found a long-running local annoyance** — the development server has
  been randomly breaking all session with a confusing error. The cause was an
  abandoned server process from hours earlier still running in the background
  and fighting the new one over the same build folder. Written up in `qa/README.md`
  with how to spot it.

**Roadmap status:** no roadmap item — a stabilization pass over Phase 2 work.
Phase 2 still has one item open, the learning trajectory view, which is waiting
on real check-in data.

---

## 2026-09-04 — Streak milestones get a moment

**What was built:**
When a check-in takes your streak to 7, 14, 30, 60 or 100 days, the line that
already appears beside the task says so in a much louder way — a solid yellow
block reading "Checked in · 7 day streak · milestone" — and the streak number in
the track header jolts harder than it normally does. Every other check-in looks
exactly as it did before.

**How it works (flow):**
1. You tap the tick. The app already worked out your streak just before the tap
   and just after it, because that comparison is how it decides whether to say
   "streak extended" at all.
2. It now also asks a second question of those same two numbers: did any of
   7/14/30/60/100 fall *between* them? Going from 6 to 7 did. Going from 7 to 8
   did not.
3. If one did, the usual line becomes the yellow block and the streak number
   gets the stronger jolt. If not, everything behaves as before.

**Technical concepts used:**
- **Nothing is remembered, and nothing was added to the database** — the whole
  feature is a question asked of two numbers the app already had. This is what
  stops a milestone repeating itself every day afterwards: if you passed 7
  yesterday, today's check-in runs from 7 to 8, and nothing sits between those,
  so there is nothing to celebrate. No "already seen this" flag needed to exist.
- **One rule covers every awkward case** — checking in a second task on the same
  day, undoing a check-in, or undoing one while others stand all leave the
  streak the same or lower it, and the rule only fires when the streak goes *up*.
  None of them needed a special case written for it.
- **The two kinds of "milestone" were given different names** — the app already
  marked 10/50/100/250/500 *total* check-ins on the elevation graph. Those count
  total effort; these count consecutive days. They are different ideas in
  different colours, and having them both called "milestones" in the code was an
  accident waiting to happen, so one is now "elevation milestones" and the other
  "streak milestones".
- **No new screen, popup or badge** — deliberately. It is the same sentence in
  the same place, restyled, plus a stronger version of an animation that was
  already there. There is still no XP, no levels and no points.
- **Checked properly** — 40 automated checks on the rule itself (including
  crossing several milestones at once, and every undo case), then a real browser
  driven through crossing a milestone, re-checking the same day, undoing, and an
  ordinary non-milestone day. Also confirmed that a screen reader announces the
  sentence once rather than three times (the glitch effect paints it three
  times), and that with animations turned off the yellow block and the words
  still appear — the celebration never depends on movement.

**Roadmap status:** completes "Milestone detection + simple celebratory UI" in
Phase 2 of `docs/ROADMAP.md`. One Phase 2 item remains: the learning trajectory
view, which is waiting on several weeks of real check-in data.

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
