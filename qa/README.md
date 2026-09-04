# qa

Screenshot and visual-check tooling. **Not application code** — nothing under
`app/`, `components/` or `lib/` imports it, and it is excluded from `tsconfig.json`
and ESLint. It is plain ESM with no dependencies, run by hand with `node`.

This exists because it had been rebuilt from scratch in a session scratchpad
three times. It lives in the repo now so that stops.

## Why not Playwright?

The Playwright MCP server does not work on this machine: it looks for a Chrome
channel at `/opt/google/chrome`, which is not installed. The Playwright *browser
download* is present, so `cdp.mjs` drives that Chromium directly over the Chrome
DevTools Protocol using Node's built-in `WebSocket`. Set `CHROME_PATH` to
override which binary it uses.

## Two standing rules when checking a screen

1. **Never point a dev server at `prisma/dev.db`.** That is the user's real
   data. Copy it somewhere scratch and set `DATABASE_URL` to the copy:

   ```
   cp prisma/dev.db /tmp/qa.db
   DATABASE_URL="file:/tmp/qa.db" npx next dev -p 3477
   ```

2. **`rm -rf .next` when switching between `npm run dev` and `npm run build`.**
   They share the directory and corrupt each other, which shows up as
   `TypeError: __webpack_modules__[moduleId] is not a function` and a 500.

## Using it

```js
import { launch } from "./qa/cdp.mjs";

const b = await launch();
const p = await b.page(1280, 720);
await p.goto("http://localhost:3477/");

await p.shot("home.png", null, { full: true });        // whole page
const box = await p.box(".sv-panel", 14);              // an element, padded
await p.shot("panel.png", box);
await p.shot("corner.png", { ...box, width: 300, height: 300 }, { scale: 3 });

console.log(p.errors);   // console errors and page exceptions
await b.close();
```

`p.eval(expr)` returns a JSON value from the page, which is how overflow checks
are done — compare `document.documentElement.scrollWidth` against `innerWidth`
at 1440, 1280, 390 and 320.
