/**
 * Resolves the project's `@/` import alias for plain `node` runs.
 *
 * The alias is a tsconfig `paths` entry, which the Next build understands and
 * bare node does not. The logic tests import straight from `lib/` so they can
 * run without a bundler or a test framework; this is what lets them.
 */
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ROOT = pathToFileURL(new URL("../", import.meta.url).pathname);

export async function resolve(specifier, context, next) {
  if (!specifier.startsWith("@/")) return next(specifier, context);

  // TypeScript imports carry no file extension, so put one back: the alias
  // points at a directory of .ts modules, and node needs the real filename.
  const base = new URL(specifier.slice(2), ROOT);
  for (const url of [new URL(base.href + ".ts"), new URL(base.href + ".tsx"), base]) {
    if (existsSync(url)) return next(url.href, context);
  }
  return next(base.href, context);
}
