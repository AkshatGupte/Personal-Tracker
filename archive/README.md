# Archive

Code that is **not part of the running application**. Nothing here is compiled,
type-checked, linted or bundled — `archive` is excluded in `tsconfig.json` and
ignored by ESLint, and no file under `app/`, `components/` or `lib/` imports it.

It exists so that a decision that was made once can be reversed cheaply, without
anyone having to reconstruct the shape of the code from a changelog.

Delete a directory here only when you are sure the option it preserves is one
you never want back.

| Directory | What it preserves |
|---|---|
| `atmosphere-seam/` | The pluggable-background layer Rendred used before the Spider-Verse theme, and the way a non-Spider-Verse atmosphere (such as the Green Lantern construct) was mounted into the app. See its own README. |
