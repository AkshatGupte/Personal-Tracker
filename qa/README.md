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

2. **Only ever have one Next process running, and clear `.next` between them.**

   The symptom is always the same: `TypeError: __webpack_modules__[moduleId] is
   not a function` and a 500 on every page. It has three causes, and the first
   is by far the most common and the least obvious:

   - **An orphaned `next-server` from an earlier run.** `next dev` spawns a
     `next-server` child, and killing the parent — or killing by port, which
     finds only the listener — leaves that child alive, still watching files and
     still writing `.next`. Two of them sharing the directory corrupt it. One
     survived a whole session this way and poisoned every server started after
     it. Check for them by hand before starting anything:

     ```
     ps -eo pid,args | grep -E "[n]ext-server|[n]ode_modules/\.bin/next"
     ```

     Note the `[n]` — a plain `pgrep -f next` or `pkill -f "next dev"` also
     matches *the shell running that very command*, which kills your own shell
     mid-script and looks like an unrelated failure.

   - **Switching between `npm run dev` and `npm run build`.** They share the
     directory too.

   - **Editing a watched file while a server runs.** Anything under the project
     root triggers a recompile, `qa/` included — it is excluded from tsconfig
     and ESLint, not from the file watcher.

   `rm -rf .next` after stopping everything, and start one server.

## Logic tests

```
./qa/run-tests.sh
```

Runs every `*.test.mjs` here. No test framework and no dependencies — these
cover pure functions over dates and numbers, and a runner would be more
machinery than the thing it runs. `register-alias.mjs` is what lets plain `node`
resolve the project's `@/` imports.

| Suite | Covers |
|---|---|
| `period-buckets.test.mjs` | Week and month bucketing, including leap-year February, the year boundary, and the 31st-of-the-month overflow that breaks naive month arithmetic. |
| `streak-milestone.test.mjs` | Streak milestone crossing: the crossing itself, no replay of an earlier day's, every non-advancing write (same-day recheck, undo, restart), and several milestones crossed at once. |

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
