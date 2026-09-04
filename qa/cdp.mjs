/**
 * A dependency-free Chrome DevTools Protocol driver.
 *
 * Playwright's MCP server does not work on this machine — it looks for a Chrome
 * channel at `/opt/google/chrome`, which is not installed. The Playwright
 * *browser download* is present though, so this talks to that Chromium directly
 * over CDP using Node's built-in WebSocket. No npm dependency, nothing to
 * install, and it lives in the repo so it stops being rebuilt from scratch every
 * session (this is the third time).
 *
 * Excluded from tsconfig and eslint — it is a tool, not application code.
 *
 * Usage:
 *   const b = await launch();
 *   const p = await b.page(1280, 720);
 *   await p.goto("http://localhost:3000");
 *   await p.shot("out.png");                       // viewport
 *   await p.shot("out.png", await p.box(".sel"));  // one element, padded
 *   await b.close();
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function findChrome() {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const root = join(process.env.HOME, ".cache", "ms-playwright");
  if (!existsSync(root)) throw new Error("no ~/.cache/ms-playwright; set CHROME_PATH");
  for (const dir of readdirSync(root).filter((d) => d.startsWith("chromium-")).sort().reverse()) {
    const bin = join(root, dir, "chrome-linux64", "chrome");
    if (existsSync(bin)) return bin;
  }
  throw new Error("no chromium under ~/.cache/ms-playwright; set CHROME_PATH");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ headless = true } = {}) {
  const bin = findChrome();
  const profile = mkdtempSync(join(tmpdir(), "rendred-cdp-"));
  const proc = spawn(
    bin,
    [
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      headless ? "--headless=new" : "",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "about:blank",
    ].filter(Boolean),
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  // Chrome prints the negotiated ws endpoint to stderr when the port is 0.
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Error(`chrome did not start:\n${buf}`)), 20000);
    proc.stderr.on("data", (d) => {
      buf += d;
      const m = buf.match(/ws:\/\/[^\s]+/);
      if (m) {
        clearTimeout(timer);
        resolve(m[0]);
      }
    });
    proc.on("exit", (c) => reject(new Error(`chrome exited ${c}:\n${buf}`)));
  });

  const browser = await connect(wsUrl);

  return {
    async page(width = 1280, height = 720) {
      const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
      return makePage(browser, sessionId, width, height);
    },
    async close() {
      try {
        await browser.send("Browser.close");
      } catch {}
      browser.socket.close();
      proc.kill("SIGKILL");
    },
  };
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const listeners = [];

    socket.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null && pending.has(msg.id)) {
        const { resolve: ok, reject: bad } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? bad(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? "")})`)) : ok(msg.result);
      } else {
        for (const fn of listeners) fn(msg);
      }
    });
    socket.addEventListener("error", reject);
    socket.addEventListener("open", () =>
      resolve({
        socket,
        on: (fn) => listeners.push(fn),
        send(method, params = {}, sessionId) {
          const message = { id: ++id, method, params };
          if (sessionId) message.sessionId = sessionId;
          socket.send(JSON.stringify(message));
          return new Promise((ok, bad) => pending.set(message.id, { resolve: ok, reject: bad }));
        },
      }),
    );
  });
}

function makePage(browser, sessionId, width, height) {
  const send = (method, params) => browser.send(method, params, sessionId);

  const page = {
    send,

    async resize(w, h) {
      width = w;
      height = h;
      await send("Emulation.setDeviceMetricsOverride", {
        width: w,
        height: h,
        deviceScaleFactor: 1,
        mobile: false,
      });
    },

    async goto(url, { settle = 900 } = {}) {
      const loaded = new Promise((resolve) => {
        const off = (msg) => {
          if (msg.sessionId === sessionId && msg.method === "Page.loadEventFired") resolve();
        };
        browser.on(off);
        setTimeout(resolve, 15000);
      });
      await send("Page.navigate", { url });
      await loaded;
      await sleep(settle);
    },

    /** Evaluates an expression in the page and returns its JSON value. */
    async eval(expression) {
      const { result, exceptionDetails } = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? "eval failed");
      return result.value;
    },

    /** A selector's bounding box in page coordinates, optionally padded. */
    async box(selector, pad = 0) {
      const r = await page.eval(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: b.x + scrollX, y: b.y + scrollY, width: b.width, height: b.height };
      })()`);
      if (!r) throw new Error(`no element for ${selector}`);
      return {
        x: Math.max(0, r.x - pad),
        y: Math.max(0, r.y - pad),
        width: r.width + pad * 2,
        height: r.height + pad * 2,
      };
    },

    /**
     * Screenshot to a PNG. `clip` is a page-coordinate box; `scale` magnifies
     * it, which is how a corner detail gets captured large enough to judge.
     */
    async shot(path, clip = null, { scale = 1, full = false } = {}) {
      const params = { format: "png", captureBeyondViewport: true };
      if (clip) params.clip = { ...clip, scale };
      else if (full) {
        const m = await send("Page.getLayoutMetrics");
        params.clip = { x: 0, y: 0, width: m.cssContentSize.width, height: m.cssContentSize.height, scale };
      }
      const { data } = await send("Page.captureScreenshot", params);
      writeFileSync(path, Buffer.from(data, "base64"));
      return path;
    },

    /**
     * Focuses a field and types into it.
     *
     * `Input.insertText` rather than per-character key events: key events go
     * through the browser's own text-input pipeline and are easy to get subtly
     * wrong, while this is what a paste does and lands reliably in a React
     * input. It still fires a real `input` event, which is what the form needs.
     */
    async type(selector, text) {
      const ok = await page.eval(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        el.focus();
        el.value = "";
        return true;
      })()`);
      if (!ok) throw new Error(`no element for ${selector}`);
      await send("Input.insertText", { text });
    },

    /** Waits for `expression` to return truthy, or throws after `timeout` ms. */
    async until(expression, { timeout = 8000, every = 120 } = {}) {
      const deadline = Date.now() + timeout;
      for (;;) {
        if (await page.eval(expression)) return true;
        if (Date.now() > deadline) throw new Error(`timed out waiting for: ${expression}`);
        await sleep(every);
      }
    },

    /**
     * The accessible text of a subtree, as the accessibility tree actually
     * reports it — not `innerText`.
     *
     * The two differ in exactly the place this project cares about: a glitched
     * string is painted three times, and `innerText` sees all three because the
     * duplicate layers are `aria-hidden` rather than `display: none`. Only the
     * AX tree shows whether a screen reader would announce it once.
     */
    async axText(selector) {
      await send("DOM.enable");
      await send("Accessibility.enable");
      const { root } = await send("DOM.getDocument", { depth: -1 });
      const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector });
      if (!nodeId) throw new Error(`no element for ${selector}`);
      const { nodes } = await send("Accessibility.queryAXTree", { nodeId });
      return nodes
        .filter((n) => !n.ignored && n.role?.value === "StaticText")
        .map((n) => n.name?.value ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    },

    /** Console errors and page exceptions seen since the page was created. */
    errors: [],
  };

  browser.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === "Runtime.exceptionThrown")
      page.errors.push(msg.params.exceptionDetails?.exception?.description ?? "exception");
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error")
      page.errors.push(msg.params.entry.text);
  });

  return (async () => {
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");
    await page.resize(width, height);
    return page;
  })();
}
