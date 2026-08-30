---
name: playwright-visual-qa
description: Use after building or changing any UI screen or component, before marking it complete. Verifies the UI visually using Playwright.
---

# Visual QA with Playwright

After building or changing any screen/component:

1. Start the dev server if it isn't already running
2. Use Playwright to navigate to the affected screen
3. Take a screenshot
4. Self-critique the screenshot against the "Visual Design Direction"
   section in CLAUDE.md — check palette, typography, the
   trail/contour-line signature element, and animation restraint
5. If anything looks generic, broken, or off-spec, fix it and re-screenshot
6. Only mark the roadmap item / report entry as done once the screenshot
   actually matches the design direction

Do not skip this step for "small" UI changes — templated-looking output
is exactly what this project is trying to avoid.
