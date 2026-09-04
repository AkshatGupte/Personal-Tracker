# The atmosphere seam

Preserved so that swapping Rendred's background for something other than the
Spider-Verse atmosphere — the Green Lantern construct, or anything else — is an
afternoon rather than an archaeology project.

**The running app does not use any of this.** Rendred's UI is Spider-Verse only:
one theme, one always-on background, no rotation, no renderer.

---

## Read this first: where the Green Lantern code actually is

**It is not in this folder, and it is not anywhere in the Rendred repository.**

The Green Lantern work — the `willpower` motif and its three.js scene — lived in
`components/atmosphere/*` and `lib/atmosphere/*`. Those files were **never
committed to git**, so when the Spider-Verse theme landed and they were deleted,
they went permanently. Nothing can recover them from this repo, and this README
will not pretend otherwise.

The real Green Lantern source of truth is the standalone sibling project:

```
~/Projects/lantern-construct          # Vite + three 0.185.1 + GSAP, vanilla three
    HANDOFF.md                        # its own context; read this before touching it
    src/config.js                     # colours, bloom, camera, quality tiers
    src/scene/scene.js                # renderer, camera, EffectComposer chain
    src/constructs/                   # hardLight, sword, ring, particleField, ambientField
    src/animation/timeline.js         # the GSAP timeline
```

That project is **independent by design** and its own handoff says not to couple
the two. Re-integration means *porting* a scene out of it, the same way the
Spider-Verse components were ported in — not importing across projects and not
merging the repos.

---

## What is in this folder

Four files, recovered from git history at commit `7c7315a`. They are the
*seam* — the mechanism by which a background got chosen and mounted — which is
the part that makes a swap cheap. The artwork is replaceable; this is not.

| File | Was at | What it does |
|---|---|---|
| `motif.ts` | `lib/motif.ts` | Resolves which background is showing. Pure and deterministic — same date, same answer, so server and client renders agree. Note its `MOTIFS` array no longer lists `willpower`; this is the post-removal version. |
| `AtmosphereField.tsx` | `components/AtmosphereField.tsx` | The mount point. Server component, resolves the motif, renders the matching layer. This is the file whose *shape* matters most. |
| `LatticeWeb.tsx` | `components/LatticeWeb.tsx` | One concrete background, as a worked example: deterministic SVG geometry, chromatic split by drawing three offset copies, faded as a flattened drawing rather than per-stroke. |
| `web.ts` | `lib/web.ts` | The geometry generator behind it. Seeded PRNG, no `Math.random`, so the markup is byte-identical every render and can be produced on the server. |

`LatticeWeb`/`web.ts` are kept because they answer the questions a new
background will hit anyway: how to stay deterministic across server and client,
and how to sit behind text without wrecking contrast.

---

## Putting a different background back

The current background is `components/spiderverse/SpiderverseBackground.tsx`,
mounted once in `app/layout.tsx`. That single mount point is the whole seam —
whatever renders there is the app's atmosphere.

1. **Restore the chooser only if you want more than one background.** For a
   straight swap you do not need `motif.ts` at all: render your component in
   `app/layout.tsx` where `<SpiderverseBackground />` is now. Copy `motif.ts`
   back to `lib/` only if a *rotation* is wanted again, and re-read the comment
   in it about counting weeks from a fixed Monday — that was a real bug once.
2. **Port the scene from `lantern-construct`.** It is vanilla three driven by
   GSAP, not React Three Fiber, so it wants an imperative mount in a
   `useEffect` with an explicit dispose on unmount, not a `<Canvas>` tree.
3. **Reinstall the renderer.** `three`, `@react-three/fiber` and `@types/three`
   were uninstalled from Rendred when it became Spider-Verse only, because
   nothing imported them:
   ```
   npm install three@0.185.1 @types/three@0.185.0 --save
   # only if you actually want the React wrapper; the lantern project does not use it:
   npm install @react-three/fiber@9.7.0
   ```
   `lantern-construct` also depends on `gsap@3.13.0`.
4. **Restore the env switches if you want them.** `.env` used to carry
   `RENDRED_MOTIF` (pin one background instead of rotating) and
   `RENDRED_DEV_TOOLS` (keep the dev switcher visible in a production build).
   Both were removed as dead config. The `MotifSwitcher` component they drove
   was never committed and is gone.

## Three rules that will bite you

These cost real debugging time before, and none of them are obvious.

- **Paint the page ground on `html`, never on `body`.** `html`'s background
  propagates to the canvas. If `body` paints one too, a `-z-10` background layer
  renders *behind* it and is invisible — the symptom is a flat black page no
  matter how far you turn the opacities up. See the comment in
  `app/globals.css`.
- **Never apply an SVG filter to a whole route subtree.** It is per-pixel over
  everything, and with `animation-fill-mode: both` its start state applies
  during any delay before the animation runs, leaving the entire page ghosted
  and unreadable while a route compiles.
- **Keep it background-only and under ~8% opacity, and honour
  `prefers-reduced-motion` by freezing at a neutral pose rather than removing
  the layer.** A background that competes with a task list is a failed
  background however good it looks on its own.
