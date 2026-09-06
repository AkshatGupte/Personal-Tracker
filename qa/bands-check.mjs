/**
 * The scrolling multiverse: does the background actually reach the bottom, and
 * does every structure in it connect to something?
 *
 * The atmosphere spans the document rather than the viewport (see
 * `components/spiderverse/useDocumentBands.ts`), drawing one *band* of
 * composition per screenful. Band 0 is the hand-set composition; every band
 * above it is generated. This checks the properties that hand-placement gave for
 * free and generation does not:
 *
 * 1. **The layers cover the document.** Not the viewport, not a fixed height —
 *    the measured height of `body`, exactly, at every width.
 * 2. **Nothing is disconnected.** Every structure has at least one thread
 *    arriving at its centre. A generated band that produced an orphan would be a
 *    solid floating with no relation to anything, which is the failure the whole
 *    thread system exists to prevent.
 * 3. **Nothing dangles.** No thread stops at an arbitrary point inside the
 *    frame. These runs either join two structures or carry on out of the
 *    composition; a segment ending in mid air is a snapped thread, and it is
 *    exactly what a mirrored band produced when its structures were reflected
 *    but its branch directions were not.
 * 4. No horizontal overflow, at five widths.
 *
 * Threads are read out of the DOM in each band's own viewBox units and converted
 * to document pixels, so this measures what is actually drawn rather than
 * re-deriving the generator's intent — a check that recomputes the thing it is
 * checking proves nothing.
 *
 * Usage: node qa/bands-check.mjs [base-url]
 */
import { launch } from "./cdp.mjs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const WIDTHS = [
  [1440, 900],
  [1280, 720],
  [768, 1024],
  [390, 844],
  [320, 640],
];

let failures = 0;
const fail = (m) => {
  failures++;
  console.log(`  FAIL ${m}`);
};

const b = await launch();
const p = await b.page(1280, 720);

const pages = [
  { name: "home", path: "/" },
  { name: "progress", path: "/progress" },
];

// The track page needs a real id, and re-seeding regenerates them.
const trackHref = await (async () => {
  await p.goto(`${BASE}/`, { settle: 2500 });
  return p.eval(`(() => {
    const a = [...document.querySelectorAll('a[href^="/tracks/"]')][0];
    return a ? a.getAttribute("href") : null;
  })()`);
})();
if (trackHref) pages.push({ name: "track", path: trackHref });
else console.log("note: no track link on the home page — track page not measured");

/*
  Everything is read in one pass in the page.

  A structure's centre comes from its own bounding box, so a scale transform is
  accounted for without this having to know about one. A thread's endpoints come
  from its path data in viewBox units, mapped through its band's own box — which
  is the only way to compare the two, since the SVG uses
  `preserveAspectRatio="none"` and its units are percentages of the band.
*/
const probe = `(() => {
  const de = document.documentElement;
  const kids = [...document.body.children];
  const layer = kids.find((e) => String(e.className || "").includes("text-sv-cyan"));
  if (!layer) return { error: "thread layer not found" };

  const bodyH = Math.round(document.body.getBoundingClientRect().height);
  const bgLayer = kids.find(
    (e) =>
      String(e.className || "").includes("-z-10") &&
      !String(e.className || "").includes("text-sv-cyan") &&
      !e.hasAttribute("data-sv-spots"),
  );

  const centre = (el) => {
    const r = el.getBoundingClientRect();
    return [r.left + scrollX + r.width / 2, r.top + scrollY + r.height / 2];
  };

  /*
    Structures: every square SVG in the layer that is not a thread drawing, and
    that is actually drawn.

    The two smallest are \`hidden sm:block\` — on a phone the content column is
    the full width, so the composition thins to three solids and the threads
    between them. Those hidden elements have no box at all, so measuring them
    would put a phantom structure at 0,0 and call every real one an orphan.
  */
  const structures = [...layer.querySelectorAll("svg:not([preserveAspectRatio])")]
    .filter((el) => el.getClientRects().length > 0)
    .map(centre);

  // Threads: parse "M x y L x y" out of each band's paths, in that band's units.
  const ends = [];
  for (const svg of layer.querySelectorAll('svg[preserveAspectRatio="none"]')) {
    const r = svg.getBoundingClientRect();
    const top = r.top + scrollY;
    const seen = new Set();
    for (const path of svg.querySelectorAll("path")) {
      const d = path.getAttribute("d");
      if (seen.has(d)) continue; // the same run is stroked three times for the neon
      seen.add(d);
      const n = d.match(/-?[0-9]+(?:\\.[0-9]+)?/g);
      if (!n || n.length < 4) continue;
      const pt = (i) => [
        r.left + scrollX + (parseFloat(n[i]) / 100) * r.width,
        top + (parseFloat(n[i + 1]) / 100) * r.height,
      ];
      ends.push(pt(0), pt(2));
    }
  }

  return {
    bodyH,
    vh: innerHeight,
    overflowX: de.scrollWidth - de.clientWidth,
    layerH: Math.round(layer.getBoundingClientRect().height),
    bgH: bgLayer ? Math.round(bgLayer.getBoundingClientRect().height) : null,
    bands: layer.querySelectorAll('svg[preserveAspectRatio="none"]').length,
    structures,
    ends,
    frame: [innerWidth, innerHeight],
  };
})()`;

const near = (a, c, tol) => Math.hypot(a[0] - c[0], a[1] - c[1]) <= tol;

for (const page of pages) {
  console.log(`\n${page.name}`);
  for (const [w, h] of WIDTHS) {
    await p.resize(w, h);
    await p.goto(BASE + page.path, { settle: 2200 });
    const m = await p.eval(probe);
    if (m.error) {
      fail(`${page.name}@${w}: ${m.error}`);
      continue;
    }

    const expectBands = Math.max(1, Math.ceil(m.bodyH / m.vh));
    const notes = [];

    if (m.layerH !== m.bodyH) notes.push(`thread layer ${m.layerH} != document ${m.bodyH}`);
    if (m.bgH !== m.bodyH) notes.push(`atmosphere ${m.bgH} != document ${m.bodyH}`);
    if (m.bands !== expectBands) notes.push(`${m.bands} bands drawn, ${expectBands} expected`);
    if (m.overflowX !== 0) notes.push(`overflow-x ${m.overflowX}`);

    /*
      Tolerance is generous on purpose. A thread terminates at a structure's
      *centre*, and the structures are up to 460px across, so "did this line
      arrive at that solid" is not a sub-pixel question — while a dangling end
      sits in open space, nowhere near one.
    */
    const TOL = 6;
    const orphans = m.structures.filter((s) => !m.ends.some((e) => near(e, s, TOL)));

    /*
      A dangling end is one that is *alone*: inside the drawn frame, not at a
      structure, and not shared with another thread.

      The "shared with another thread" half is what makes this correct rather
      than merely strict. Several runs converge on every composition node, so an
      endpoint with company is a junction — including at the two solids a phone
      does not draw, where the node is still a real place the threads meet and
      only the solid is absent. A branch snapped off mid-flight has neither a
      structure nor a neighbour, which is exactly what a mirrored band produced
      when its structures were reflected but its branch directions were not.

      Endpoints outside the frame are the branches carrying on out of the
      composition, which is what they are for.
    */
    const [fw] = m.frame;
    const dangling = m.ends.filter((e) => {
      if (e[0] < -0.05 * fw || e[0] > 1.05 * fw) return false;
      if (e[1] < 0 || e[1] > m.bodyH) return false;
      if (m.structures.some((s) => near(e, s, TOL))) return false;
      return !m.ends.some((o) => o !== e && near(e, o, TOL));
    });

    if (orphans.length) notes.push(`${orphans.length} structure(s) with no thread`);
    if (dangling.length) notes.push(`${dangling.length} thread(s) ending in mid air`);

    if (notes.length) fail(`${page.name}@${w}x${h}: ${notes.join("; ")}`);
    else
      console.log(
        `  ok   @${w}x${h} doc ${m.bodyH} · ${m.bands} bands · ${m.structures.length} structures, all connected · ${m.ends.length} endpoints, none dangling`,
      );
  }
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL CLEAN");
await b.close();
process.exit(failures ? 1 : 0);
