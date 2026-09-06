/**
 * The small-text scale: a floor, and one subordination that has to survive it.
 *
 * A UX audit raised every label in the app to a 12px floor, replacing six sizes
 * spread between 8.0 and 11.2px. The floor was right — Bangers is uppercase
 * with a single weight, and at 8px that is decoration rather than text — but
 * collapsing six sizes into one flattened the only place where a label and the
 * content it describes are set side by side, and inverted it:
 *
 *   DYNAMIC PROGRAMMING   ← ancestry, 12px, the longer string
 *   PARTITION DP          ← the leaf's own name, 14px
 *
 * At 12/14 the ancestry read as the heading. At 11/14 it reads as the qualifier
 * it is. Both halves of that are asserted here, because both can regress and
 * they pull in opposite directions — the fix for one is the reintroduction of
 * the other if it is applied without measuring.
 *
 * Measures the *computed* size of rendered text, not the source, so a Tailwind
 * arbitrary value that silently fails to compile is caught rather than counted.
 *
 * `/lab` is excluded deliberately: it is a development-only effect harness that
 * `notFound()`s outside dev, it is not product UI, and it keeps its own denser
 * labels down to 8.8px.
 *
 * Usage: node qa/type-scale.mjs [base-url]
 */
import { launch } from "./cdp.mjs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const WIDTHS = [[1440, 900], [1280, 720]];

/** The floor, in px. 11 rather than 12: one role sits below the general label
 *  size on purpose, and that role is asserted separately below. */
const FLOOR = 11;

let failures = 0;
const fail = (m) => { failures++; console.log(`  FAIL ${m}`); };

const b = await launch();
const p = await b.page(1440, 900);

await p.goto(`${BASE}/`, { settle: 2500 });
const track = await p.eval(`(() => { const a = document.querySelector('a[href^="/tracks/"]'); return a && a.getAttribute("href"); })()`);
const pages = [{ name: "home", path: "/" }, { name: "progress", path: "/progress" }];
if (track) pages.push({ name: "track", path: track });
else console.log("note: no track link on the home page — track page not measured");

/*
  Every element holding its own visible text, with the size actually computed
  for it. Elements are skipped when they only contain other elements, so a
  wrapper does not report the size its children overrode.
*/
const probe = `(() => {
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("[aria-hidden='true']")) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    out.push({
      px: Math.round(parseFloat(cs.fontSize) * 100) / 100,
      text: el.textContent.trim().slice(0, 28),
      tag: el.tagName.toLowerCase(),
    });
  }
  return out;
})()`;

/**
 * How much smaller the ancestry label has to be than the name it qualifies.
 *
 * **"Strictly smaller" is not the assertion**, and writing it that way first was
 * a mistake caught by re-introducing the bug: at 12px over a 14px name the label
 * *is* smaller and still reads as the heading, so the check passed the exact
 * state it exists to reject. The property is meaningful subordination, so the
 * threshold is a ratio.
 *
 * 0.82 sits between the two candidates and is not otherwise tuned: 11/14 = 0.79
 * passes, 12/14 = 0.86 fails. It is expressed against the name rather than as an
 * absolute px so that restyling the name carries the label with it.
 */
const SUBORDINATE = 0.82;

/*
  The ancestry label and the name it qualifies, read as a pair from the same
  row, so this asserts the *relationship* rather than two independent numbers.
  Either could be restyled and the assertion still means what it says.
*/
const pairProbe = `(() => {
  const out = [];
  for (const col of document.querySelectorAll(".flex.min-w-0.flex-col")) {
    const label = col.querySelector(":scope > span.font-label");
    const name = [...col.querySelectorAll(":scope > span")].find((s) => !s.classList.contains("font-label"));
    if (!label || !name) continue;
    out.push({
      label: parseFloat(getComputedStyle(label).fontSize),
      name: parseFloat(getComputedStyle(name).fontSize),
      text: label.textContent.trim().slice(0, 24),
    });
  }
  return out;
})()`;

for (const page of pages) {
  console.log(`\n${page.name}`);
  for (const [w, h] of WIDTHS) {
    await p.resize(w, h);
    await p.goto(BASE + page.path, { settle: 2200 });

    const found = await p.eval(probe);
    const under = found.filter((f) => f.px < FLOOR);
    const sizes = [...new Set(found.map((f) => f.px))].sort((a, b) => a - b);

    const pairs = await p.eval(pairProbe);
    const inverted = pairs.filter((q) => q.label / q.name > SUBORDINATE);

    const notes = [];
    if (under.length) {
      const worst = under.sort((a, b) => a.px - b.px)[0];
      notes.push(`${under.length} element(s) under ${FLOOR}px, smallest ${worst.px}px "${worst.text}"`);
    }
    if (inverted.length) {
      const q = inverted[0];
      notes.push(
        `${inverted.length} ancestry label(s) not subordinate to the name they qualify ` +
          `(e.g. ${q.label}px over ${q.name}px = ${(q.label / q.name).toFixed(2)}, ` +
          `needs <= ${SUBORDINATE} — "${q.text}")`,
      );
    }

    if (notes.length) fail(`${page.name}@${w}x${h}: ${notes.join("; ")}`);
    else
      console.log(
        `  ok   @${w}x${h} ${found.length} text elements, sizes ${sizes.join("/")}px · ` +
          `${pairs.length} ancestry pair(s), all subordinate`,
      );
  }
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL CLEAN");
await b.close();
process.exit(failures ? 1 : 0);
