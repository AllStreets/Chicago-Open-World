# V2 · True Building Colours and Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give all 41 landmarks their real, sourced colours and materials, plus iconic crown night lighting and optional OSM-tag colours for ordinary buildings. The work stays inside the one shared façade material, so there are no new materials and no new draw calls (backlog F1–F11).

**Architecture:**
- **Data.** `pipeline/data/heroes.json` gains a sourced `look` block per hero. A pipeline style registry turns each look into one row of a style palette. Every building vertex carries a `_STYLE` index (0 = unstyled).
- **Build output.** The build writes `styles.json` (the rows, human-readable, sourced) and `style-palette.png` (an sRGB swatch sheet for review), and bumps the manifest to v5.
- **Runtime.** The app turns `styles.json` into a small float `DataTexture`. The shared façade shader (`app/src/world/materials/facadeMaterial.js`) reads it with `texelFetch`. It recolours windows, mullions, spandrels and body, applies per-finish roughness and metalness, and adds crown night light.
- **Review.** Every visual change goes through the evaluate-and-revert protocol at fixed poses. Each change is kept or reverted per F item.

**Tech Stack:**
- Node 22 ESM pipeline: `@gltf-transform/core` 4.5.1 + `meshopt` (medium = quantize), `sharp`, Vitest 5.
- App: Vite 8 + React 19 + React Three Fiber 9, three 0.186 (`onBeforeCompile`, GLSL3 `texelFetch`), zustand 5, Vitest + RTL.
- e2e: Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md`: Addendum B.1 (standing rules) and B.6 (true building colours). The master plan `docs/superpowers/plans/2026-09-29-vision-master-plan.md` is binding. Backlog items: `docs/superpowers/backlog/2026-09-29-vision-backlog.md` §F.

## Global Constraints

- **No human in the loop.** Decide, then write a `Ruling:` line in the ledger `.superpowers/sdd/2026-09-29-v2-building-colours/progress.md`. The four stop conditions of executing-plans still apply.
- **RAM discipline:** only one heavy process at a time. Either the world build runs, or the dev server plus Playwright runs, never both. Close browsers when done.
- **Budgets (B.1.6):**
  - HIGH: ≤ 900 draw calls per frame (shadow and post passes included), ≤ 4 M triangles, 60 fps on M-series.
  - `app/public/world` ≤ 200 MB (152 MB before V2).
  - V2 adds **zero** draw calls (F8).
- **"No new materials":**
  - Everything goes through `createFacadeMaterial()` / `patchFacadeShader`.
  - No new `Mesh`, no new `Material`, and no new glb layer.
- **Evaluate and revert (B.1.2):**
  - Every colour, material or light change is screenshotted before and after at fixed poses, at day, dusk and night.
  - An unpleasing change is reverted in its **own commit**, with a ledger line.
- **Accuracy is sourced (directive 8).** Every `look` and every `crownLight` carries one or more `https://` source URLs.
  - Where a source names a material but not a hue, the look carries a `note` saying so.
- **README is history (B.1.3):**
  - Never modify an existing image in `docs/screenshots/`.
  - New gallery images are named `docs/screenshots/v2-<subject>-<time>.png`.
- **Human-first:** V2 adds no controls. Colours are always on, and the existing Quality button and ⌘K "Quality: Low" remain the only switches that matter here.
- **TDD:** failing test first for every pure function and pipeline builder.
- **Tile format change for V2 (master plan):**
  - `_STYLE` is added to the `buildings` layer.
  - `styles.json` and `style-palette.png` are added.
  - The manifest goes to `version: 5`.
- **Coordinate frame for poses:** local metres, origin State & Madison, +X east, −Z north, +Y up.
- **Commit trailer on every commit:** `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Push:** `git push origin main` at the end of the milestone (AllStreets/Chicago-Open-World).

## Review Focus

1. **A tile holding only one hero:** its `_STYLE` values are exactly {0, 1}. gltf-transform's `quantize` treats any `_` attribute whose range sits inside [−1, 1] as normalized 12-bit Uint16. That means 1 must still decode to exactly 1.0, not 0.9998, or the shader would pick row 0. **Pinned:** Task 4, test `survives quantization when a tile's styles are only 0 and 1`.
2. **Stale data: a tile's `_STYLE` points past the palette's last row.** This happens when a new world is built against an old `styles.json`, or the fetch is cached. The shader must treat it as unstyled, not sample garbage. **Pinned:** Task 7, test `clamps a style index beyond the palette to 0`.
3. **`styles.json` missing or failing to load** (a v4 world, offline, 404). The app keeps the one-row default palette, logs a warning, never throws, and buildings render as before V2. **Pinned:** Task 6, test `loadStylePalette keeps the default palette when styles.json fails`.
4. **Junk OSM tags:**
   - `building:colour=yes`, `#ggg`, `red;white`, `building:material=wood`.
   - Each is ignored, with no crash and no new style row.
   - **Pinned:** Task 9, test `ignores junk colour and material tags`.
5. **Many distinct OSM colours overflowing the 256-row palette.**
   - Extra looks fall back to index 0.
   - Hero rows are always added first, so they are never lost.
   - **Pinned:** Task 3, test `registry stops at MAX_STYLES and returns 0`.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `pipeline/lib/looks.js` | create | Look schema: `FINISHES`, `FINISH_PRESETS` (F8), `CROWN_KINDS`, `validateLook`, `hexToRgb` |
| `pipeline/lib/styles.js` | create | Style registry (key → palette row), `styleEntry`, `meshStyle`, `writeStylePalettePng` |
| `pipeline/lib/layers.js` | create | Building-layer accumulator moved out of `build-world.js`, now carrying `STYLE`: `bAcc`, `appendBuilding`, `appendLayer`, `asLayer` |
| `pipeline/lib/osmLook.js` | create | F11: `parseOsmColour`, `lookFromOsmTags`, `osmStyleKey`, `quantizeHex` |
| `pipeline/data/heroes.json` | modify | A sourced `look` block on all 41 heroes |
| `pipeline/data/osm-looks.json` | create | F11 on/off switch plus attribution (a revert flips `enabled`) |
| `pipeline/build/build-world.js` | modify | Registry, per-vertex style, `styles.json`, `style-palette.png`, manifest v5 |
| `pipeline/tests/looks.test.js` | create | Schema tests plus "every hero is sourced" |
| `pipeline/tests/styles.test.js` | create | Registry, `meshStyle`, palette PNG |
| `pipeline/tests/layers.test.js` | create | Accumulator plus exact `_STYLE` survival through `writeTileGlb` |
| `pipeline/tests/osmLook.test.js` | create | Tag parsing and junk tolerance |
| `app/src/world/materials/stylePalette.js` | create | Pure: `STYLE_COLS`, `srgbToLinear`, `hexLinear`, `paletteData`, `createStyleTexture` |
| `app/src/world/materials/facadeMaterial.js` | modify | `_style` attribute, `uStylePal`/`uStyleRows` uniforms, recolour, finish presets, crown light, `loadStylePalette` |
| `app/src/world/Scene.jsx` | modify | Calls `loadStylePalette(manifest)` after the manifest loads |
| `app/src/world/materials/__tests__/stylePalette.test.js` | create | Palette packing and texture |
| `app/src/world/materials/__tests__/facadeMaterial.test.js` | modify | Shader contract for style, clamp, crown light, ANGLE-safe derivatives |
| `app/e2e/helpers.js` | create (or extend V1's) | `EVAL_POSES`, `gotoPose`, `drawCallsPerFrame` |
| `app/e2e/eval-looks.spec.js` | create | Evaluate-and-revert captures; runs only when `EVAL_LABEL` is set |
| `README.md` | modify | Gallery section "Vision pass · V2", roadmap, badges |

---

### Task 0: Pre-flight, evaluation harness, "before" shots

**Files:**
- Create: `app/e2e/helpers.js`
- Create: `app/e2e/eval-looks.spec.js`
- Create: `.superpowers/sdd/2026-09-29-v2-building-colours/progress.md` (ledger, gitignored)

**Interfaces:**
- Consumes:
  - `BOOKMARKS` from `app/src/lib/bookmarks.js` (`{ [name]: { position: [x,y,z], target: [x,y,z] } }`);
  - `window.__store` and `window.__gl`, exposed by `app/src/world/Scene.jsx` when the URL has `stats`;
  - `window.__worldReady`;
  - `useStore.getState().startFlight(to, label)`, whose `flight` becomes `null` when the flight ends.
- Produces:
  - `EVAL_POSES: { wrigley, aon, s311 }`: poses as `{ position, target }`.
  - `gotoPose(page, pose, time: 'day'|'dusk'|'night'): Promise<void>`.
  - `drawCallsPerFrame(page, ms = 1000): Promise<{ calls: number, triangles: number, frames: number }>`.
  - A skipped-by-default spec, run with `EVAL_LABEL=<label>`, that writes `../.superpowers/sdd/<EVAL_MILESTONE>/shots/<label>/<pose>-<time>.png`.

- [ ] **Step 1: Pre-flight scan (V1 must have landed).**

Run:
```bash
cd /Users/connorevans/Downloads/Chicago_open_world && git log --oneline -15 && grep -n "version:" pipeline/build/build-world.js && ls app/e2e && grep -rn "clearanceAt" app/src --include=*.js -l | head
```
Expected:
- `version: 4` appears in `build-world.js` (V1's manifest).
- `clearanceAt` exists (V1 · G1).

If `app/e2e/helpers.js` already exists from V1:
- add only the three exports below that are missing;
- keep V1's names;
- record `Ruling: reused V1 e2e helper <names>` in the ledger.

- [ ] **Step 2: Create the ledger.**

```bash
mkdir -p /Users/connorevans/Downloads/Chicago_open_world/.superpowers/sdd/2026-09-29-v2-building-colours
printf '# SDD ledger — plan: docs/superpowers/plans/2026-09-29-v2-building-colours.md\nSpec: Addendum B.6\nV2: started %s\n' "$(date -u +%FT%TZ)" > /Users/connorevans/Downloads/Chicago_open_world/.superpowers/sdd/2026-09-29-v2-building-colours/progress.md
```

- [ ] **Step 3: Write the e2e helper.**

```js
// app/e2e/helpers.js — shared e2e helpers: fixed poses, flying there, and a draw-call reading.
// The composer resets renderer.info on every pass, so draw calls are counted with autoReset off
// and averaged over the frames rendered in the window.
export const EVAL_POSES = {
  // Wrigley Building (249, −873) and Tribune Tower (376, −946) across the river from the south-east
  wrigley: { position: [430, 170, -640], target: [300, 70, -900] },
  // Aon Center (522, −361) from over Grant Park / the harbour
  aon: { position: [1050, 260, 150], target: [522, 180, -361] },
  // 311 South Wacker (−657, 507): the lit crown, from the south-east
  s311: { position: [-150, 360, 1060], target: [-657, 250, 507] },
}

export async function gotoPose(page, pose, time) {
  // pin the calendar exactly as hero-view.spec.js does (sun presets + tree months)
  await page.clock.setFixedTime(new Date('2026-09-28T12:00:00-05:00'))
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto(`/?view=streeterville&time=${time}&stats=1`)
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
  await page.evaluate((p) => window.__store.getState().startFlight(p), pose)
  await page.waitForFunction(() => window.__store.getState().flight === null, null, { timeout: 30_000 })
  await page.waitForTimeout(6000) // tiles at the new pose stream in, the sky tween settles
}

export async function drawCallsPerFrame(page, ms = 1000) {
  return page.evaluate(async (ms) => {
    const gl = window.__gl
    const prev = gl.info.autoReset
    gl.info.autoReset = false
    let frames = 0, on = true
    const tick = () => { if (on) { frames++; requestAnimationFrame(tick) } }
    gl.info.reset()
    requestAnimationFrame(tick)
    await new Promise((r) => setTimeout(r, ms))
    on = false
    const { calls, triangles } = gl.info.render
    gl.info.autoReset = prev
    return { calls: Math.round(calls / Math.max(1, frames)), triangles: Math.round(triangles / Math.max(1, frames)), frames }
  }, ms)
}
```

- [ ] **Step 4: Write the capture spec.**

```js
// app/e2e/eval-looks.spec.js — evaluate-and-revert captures (spec B.1.2). Skipped unless EVAL_LABEL is set.
import { test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { BOOKMARKS } from '../src/lib/bookmarks.js'
import { EVAL_POSES, gotoPose, drawCallsPerFrame } from './helpers.js'

const LABEL = process.env.EVAL_LABEL
const MILESTONE = process.env.EVAL_MILESTONE ?? '2026-09-29-v2-building-colours'
const NAMES = (process.env.EVAL_POSES ?? 'loop,willis,river,museum,hancock,streeterville,navypier,wrigley,aon,s311').split(',')
const TIMES = (process.env.EVAL_TIMES ?? 'day,dusk,night').split(',')
const OUT = `../.superpowers/sdd/${MILESTONE}/shots/${LABEL}`

test.describe('evaluate-and-revert captures', () => {
  test.skip(!LABEL, 'set EVAL_LABEL=<label> to capture')
  for (const name of NAMES) for (const time of TIMES) {
    test(`${name} @ ${time}`, async ({ page }) => {
      const pose = EVAL_POSES[name] ?? BOOKMARKS[name]
      if (!pose) throw new Error(`unknown pose ${name}`)
      await gotoPose(page, pose, time)
      mkdirSync(OUT, { recursive: true })
      await page.screenshot({ path: `${OUT}/${name}-${time}.png`, mask: [page.locator('.wm-clock'), page.locator('.hud-controls')] })
      const dc = await drawCallsPerFrame(page)
      console.log(`EVAL ${LABEL} ${name}-${time} calls=${dc.calls} tris=${dc.triangles} frames=${dc.frames}`)
    })
  }
})
```

- [ ] **Step 5: Check that the normal e2e run still skips it.**

Run: `cd /Users/connorevans/Downloads/Chicago_open_world/app && npx playwright test e2e/eval-looks.spec.js --list`
Expected: lists 30 tests (10 poses × 3 times). A run without `EVAL_LABEL` reports them as skipped.

- [ ] **Step 6: Capture the "before" set (dev server + Playwright only; nothing else heavy).**

Run: `cd /Users/connorevans/Downloads/Chicago_open_world/app && EVAL_LABEL=before npx playwright test e2e/eval-looks.spec.js --workers=1 2>&1 | grep EVAL > ../.superpowers/sdd/2026-09-29-v2-building-colours/before-drawcalls.log`
Expected:
- 30 PNGs in `.superpowers/sdd/2026-09-29-v2-building-colours/shots/before/`;
- 30 `EVAL before … calls=N` lines.

Append to the ledger: `V2 T0: before shots + draw calls captured (max calls=<max>)`.

- [ ] **Step 7: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add app/e2e/helpers.js app/e2e/eval-looks.spec.js
git commit -m "test(e2e): evaluate-and-revert capture harness with fixed poses and per-frame draw calls" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 1: Look schema and validation

**Files:**
- Create: `pipeline/lib/looks.js`
- Test: `pipeline/tests/looks.test.js`

**Interfaces:**
- Produces:
  - `FINISHES: ['glass','metal','granite','limestone','terracotta','concrete']` (index = finish code in the palette).
  - `FINISH_PRESETS: { [finish]: { roughness: number, metalness: number } }`.
  - `CROWN_KINDS: ['none','flood','lantern']` (index = kind code).
  - `isHex(s): boolean`.
  - `hexToRgb('#rrggbb'): [r,g,b]` (0–255).
  - `validateLook(look, key): string[]` (empty = valid).
- Look shape (a superset of B.6):
  ```
  {
    material, finish, base, glass, mullion, spandrel,
    top?, topFromM?, topM?, parts?, render?, note?,
    source: string | string[],
    crownLight?: { kind, color, fromM, toM, intensity, source, render? }
  }
  ```

- [ ] **Step 1: Write the failing test.**

```js
// pipeline/tests/looks.test.js
import { describe, it, expect } from 'vitest'
import { FINISHES, FINISH_PRESETS, CROWN_KINDS, isHex, hexToRgb, validateLook } from '../lib/looks.js'

const ok = { material: 'black anodized aluminium, bronze glass', finish: 'metal', base: '#1c1b1a', glass: '#4a3a2c', mullion: '#121212', spandrel: '#1c1b1a', source: 'https://en.wikipedia.org/wiki/Willis_Tower' }

describe('looks', () => {
  it('six finishes (spec B.6), each with a shader preset', () => {
    expect(FINISHES).toEqual(['glass', 'metal', 'granite', 'limestone', 'terracotta', 'concrete'])
    for (const f of FINISHES) expect(FINISH_PRESETS[f]).toEqual({ roughness: expect.any(Number), metalness: expect.any(Number) })
    expect(CROWN_KINDS).toEqual(['none', 'flood', 'lantern'])
  })
  it('hex helpers', () => {
    expect(isHex('#1c1B1a')).toBe(true); expect(isHex('#fff')).toBe(false); expect(isHex(null)).toBe(false)
    expect(hexToRgb('#ff8000')).toEqual([255, 128, 0])
  })
  it('accepts a complete sourced look', () => {
    expect(validateLook(ok, 'willis')).toEqual([])
    expect(validateLook({ ...ok, source: ['https://a.example/x', 'https://b.example/y'] }, 'w')).toEqual([])
  })
  it('rejects a missing source, a non-https source, a bad finish and bad colours', () => {
    expect(validateLook({ ...ok, source: undefined }, 'w').join()).toMatch(/source/)
    expect(validateLook({ ...ok, source: 'http://x.example' }, 'w').join()).toMatch(/source/)
    expect(validateLook({ ...ok, finish: 'marble' }, 'w').join()).toMatch(/finish/)
    expect(validateLook({ ...ok, glass: 'bronze' }, 'w').join()).toMatch(/glass/)
    expect(validateLook(undefined, 'w')).toEqual(['w: no look block'])
  })
  it('a top colour needs a band above topFromM', () => {
    expect(validateLook({ ...ok, top: '#e8e8e6', topFromM: 442, topM: 443 }, 'w')).toEqual([])
    expect(validateLook({ ...ok, top: '#e8e8e6', topFromM: 442, topM: 442 }, 'w').join()).toMatch(/topM/)
  })
  it('crown light must be sourced, bounded and of a known kind', () => {
    const c = { kind: 'lantern', color: '#fff6e8', fromM: 261, toM: 293, intensity: 1.6, source: 'https://en.wikipedia.org/wiki/311_South_Wacker_Drive' }
    expect(validateLook({ ...ok, crownLight: c }, 'w')).toEqual([])
    expect(validateLook({ ...ok, crownLight: { ...c, kind: 'beacon' } }, 'w').join()).toMatch(/kind/)
    expect(validateLook({ ...ok, crownLight: { ...c, toM: 200 } }, 'w').join()).toMatch(/fromM/)
    expect(validateLook({ ...ok, crownLight: { ...c, intensity: 9 } }, 'w').join()).toMatch(/intensity/)
    expect(validateLook({ ...ok, crownLight: { ...c, source: undefined } }, 'w').join()).toMatch(/crownLight.source/)
  })
  it('a look switched off by evaluate-and-revert must say why', () => {
    expect(validateLook({ ...ok, render: false }, 'w').join()).toMatch(/note/)
    expect(validateLook({ ...ok, render: false, note: 'reverted: reads grey at dusk' }, 'w')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline -- looks`
Expected: FAIL with `Failed to load url ../lib/looks.js` (module not found).

- [ ] **Step 3: Write the minimal implementation.**

```js
// pipeline/lib/looks.js — sourced colour + material blocks ("looks") for landmarks and tagged buildings (spec B.6).
export const FINISHES = ['glass', 'metal', 'granite', 'limestone', 'terracotta', 'concrete']
// F8 "similar materials": one preset per finish, applied as parameters of the shared façade shader — never a new material.
export const FINISH_PRESETS = {
  glass: { roughness: 0.18, metalness: 0.6 },
  metal: { roughness: 0.35, metalness: 0.75 },
  granite: { roughness: 0.45, metalness: 0.05 },   // polished stone (granite, marble)
  limestone: { roughness: 0.85, metalness: 0 },
  terracotta: { roughness: 0.4, metalness: 0.02 }, // glazed terra cotta; fired brick uses it too
  concrete: { roughness: 0.9, metalness: 0 },
}
export const CROWN_KINDS = ['none', 'flood', 'lantern']

const HEX = /^#[0-9a-f]{6}$/i
export const isHex = (s) => typeof s === 'string' && HEX.test(s)
export function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const httpsList = (v) => { const a = [].concat(v ?? []); return a.length > 0 && a.every((u) => typeof u === 'string' && u.startsWith('https://')) }

export function validateLook(look, key = '?') {
  if (!look || typeof look !== 'object') return [`${key}: no look block`]
  const errs = []
  if (!FINISHES.includes(look.finish)) errs.push(`${key}: finish "${look.finish}" is not one of ${FINISHES.join('|')}`)
  for (const k of ['base', 'glass', 'mullion', 'spandrel']) if (!isHex(look[k])) errs.push(`${key}: ${k} must be #rrggbb`)
  if (look.top !== undefined) {
    if (!isHex(look.top)) errs.push(`${key}: top must be #rrggbb`)
    if (!(look.topM > (look.topFromM ?? 0))) errs.push(`${key}: top needs topM above topFromM`)
  }
  if (!httpsList(look.source)) errs.push(`${key}: source must be one or more https URLs`)
  if (typeof look.material !== 'string' || look.material.length < 8) errs.push(`${key}: material description missing`)
  if (look.parts !== undefined && !(Array.isArray(look.parts) && look.parts.every((p) => typeof p === 'string'))) errs.push(`${key}: parts must be a list of mesh part names`)
  if (look.render === false && !(typeof look.note === 'string' && look.note.length > 0)) errs.push(`${key}: render:false needs a note saying why`)
  const c = look.crownLight
  if (c) {
    if (!CROWN_KINDS.slice(1).includes(c.kind)) errs.push(`${key}: crownLight.kind must be flood|lantern`)
    if (!isHex(c.color)) errs.push(`${key}: crownLight.color must be #rrggbb`)
    if (!(c.fromM >= 0 && c.toM > c.fromM)) errs.push(`${key}: crownLight needs 0 <= fromM < toM`)
    if (!(c.intensity > 0 && c.intensity <= 4)) errs.push(`${key}: crownLight.intensity must be in (0, 4]`)
    if (!httpsList(c.source)) errs.push(`${key}: crownLight.source must be https URL(s)`)
  }
  return errs
}
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline -- looks`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add pipeline/lib/looks.js pipeline/tests/looks.test.js
git commit -m "feat(pipeline): sourced look schema with finish presets and crown light (F1, F8)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Sourced looks for all 41 heroes (F1–F7, F9 data)

**Files:**
- Modify: `pipeline/data/heroes.json`. Add a `"look"` key to each of the 41 entries, directly after `"name"`. Nothing else changes.
- Test: `pipeline/tests/looks.test.js` (append).

**Interfaces:**
- Consumes: `validateLook` (Task 1).
- Produces: `heroes[i].look` for every hero; Task 5 reads it through `styles.add(h.key, h.look)`.
- Mesh part names used in `parts`:
  - venue colonnade: `podium`, `entablature`, `column` (from `pipeline/lib/venue.js`);
  - fountain: `rim`, `column`, `basin`;
  - museums: `drum`, `lantern`, `column`, `portico`, `pediment`;
  - water tower: `turret`, `lantern` (from `pipeline/lib/landmarks.js`).

**How the hex values were chosen:**
- Each hex is the rendered sRGB colour of the sourced material description. For example, "black anodized aluminium" becomes `#1c1b1a`, "Mount Airy white granite" `#e6e4de`, "Texas pink granite" `#c9a79a`.
- Where a source names only the material, the look carries a `note`, and the hue was read from reference photographs of the building.
- Row values are sRGB. The app converts them to linear.

**Rulings recorded in this task:**
1. Marble uses the `granite` finish (polished stone).
2. Brick uses `terracotta` (fired clay).
3. Water Tower Place is **grey** marble per Wikipedia, overriding the backlog's "white marble".
4. United Center is precast concrete per Wikipedia, overriding the brick podium drawn today.
5. S.R. Crown Hall's look is recorded but `render: false`. The venue glass-and-steel wall already reads correctly, and a pattern-unaware black recolour would darken the glass. Its refinement belongs to P3.
6. Antenna event colours vary daily. The everyday white is used.
7. Aon Center has no sourced crown lighting, so it gets none (the backlog said "if sourced").

- [ ] **Step 1: Write the failing test (append to `pipeline/tests/looks.test.js`).**

```js
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

describe('heroes.json looks (F1, F7)', () => {
  const heroes = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'heroes.json'), 'utf8')).heroes
  it('all 41 heroes carry a valid, sourced look', () => {
    expect(heroes).toHaveLength(41)
    const errs = heroes.flatMap((h) => validateLook(h.look, h.key))
    expect(errs).toEqual([])
  })
  it('the named targets read as specified (B.6)', () => {
    const L = Object.fromEntries(heroes.map((h) => [h.key, h.look]))
    expect(L.willis).toMatchObject({ finish: 'metal', base: '#1c1b1a', glass: '#4a3a2c' })
    expect(L.aon).toMatchObject({ finish: 'granite', base: '#e6e4de' })
    expect(L.trump).toMatchObject({ finish: 'glass', glass: '#9fb3c4' })
    expect(L.wrigleybldg).toMatchObject({ finish: 'terracotta', crownLight: { kind: 'flood' } })
    expect(L.tribune).toMatchObject({ finish: 'limestone', base: '#cfc6b3' })
    expect(L['311wacker'].crownLight).toMatchObject({ kind: 'lantern', fromM: 261, toM: 293 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline -- looks`
Expected: FAIL. `all 41 heroes carry a valid, sourced look` lists 41 `no look block` errors.

- [ ] **Step 3: Add the looks.** For each hero key below, insert the given object as `"look": {…}` in that hero's entry in `pipeline/data/heroes.json`, keeping 2-space JSON indentation.

```json
{
  "willis": { "material": "black anodized aluminium curtain wall, bronze-tinted glass, white antennas", "finish": "metal", "base": "#1c1b1a", "glass": "#4a3a2c", "mullion": "#121212", "spandrel": "#1c1b1a", "top": "#e6e6e3", "topFromM": 442.5, "topM": 443.5,
    "crownLight": { "kind": "lantern", "color": "#ffffff", "fromM": 500, "toM": 527, "intensity": 2.0, "source": ["https://www.willistower.com/about", "https://www.bdcnetwork.com/home/news/55161905/willis-tower-upgrades-antenna-lighting"] },
    "source": ["https://en.wikipedia.org/wiki/Willis_Tower", "https://www.architecturelab.net/willis-tower-sears-tower-skidmore-owings-merrill/"] },
  "trump": { "material": "clear low-e glass, polished stainless-steel mullions, brushed stainless spandrels, clear anodized aluminium", "finish": "glass", "base": "#c9d0d6", "glass": "#9fb3c4", "mullion": "#d8dde2", "spandrel": "#b9c0c7",
    "source": ["https://global.ctbuh.org/resources/papers/download/29-case-study-trump-international-hotel-tower.pdf", "https://en.wikipedia.org/wiki/Trump_International_Hotel_and_Tower_(Chicago)"] },
  "stregis": { "material": "six shades of blue-green high-performance glass in a gradient", "finish": "glass", "base": "#5f8f93", "glass": "#4f8a8f", "mullion": "#aab4b8", "spandrel": "#3f6f78",
    "source": ["https://studiogang.com/projects/vista-tower/", "https://www.agc-yourglass.com/en-UK/client-testimonial/sculpting-chicago-skyline"] },
  "aon": { "material": "white Mount Airy granite (1992–94 recladding of the Carrara marble), narrow vertical windows", "finish": "granite", "base": "#e6e4de", "glass": "#3b4046", "mullion": "#cfcac1", "spandrel": "#e6e4de",
    "source": ["https://www.wje.com/projects/detail/amoco-building", "https://en.wikipedia.org/wiki/Aon_Center_(Chicago)"] },
  "hancock": { "material": "black anodized aluminium with tinted bronze glass, exposed X-braces, white masts", "finish": "metal", "base": "#1a1a1a", "glass": "#3f3328", "mullion": "#111111", "spandrel": "#1a1a1a", "top": "#e6e6e3", "topFromM": 344.5, "topM": 345.5,
    "crownLight": { "kind": "lantern", "color": "#ffffff", "fromM": 440, "toM": 457, "intensity": 1.8, "source": "https://en.wikipedia.org/wiki/875_North_Michigan_Avenue" },
    "source": ["https://en.wikipedia.org/wiki/875_North_Michigan_Avenue", "https://sah-archipedia.org/buildings/IL-01-031-0043"] },
  "franklin": { "material": "granite shading from deep red at the base to pale rose-beige at the top", "finish": "granite", "base": "#7a3b33", "glass": "#2e3238", "mullion": "#6e3c34", "spandrel": "#7c463d", "top": "#c9a894", "topFromM": 0, "topM": 307,
    "source": "https://en.wikipedia.org/wiki/Franklin_Center_(Chicago)" },
  "twopru": { "material": "polished granite with reflective glass, limestone pilasters", "finish": "granite", "base": "#9a9a98", "glass": "#5f6f7c", "mullion": "#8d8d8b", "spandrel": "#9a9a98", "note": "sources name polished granite; the grey hue is read from photographs",
    "source": ["https://en.wikipedia.org/wiki/Two_Prudential_Plaza", "https://buildingsdb.com/IL/chicago/two-prudential-plaza/"] },
  "onechicago": { "material": "continuous reflective glass with vertical aluminium accents", "finish": "glass", "base": "#8fa3b5", "glass": "#7d95ab", "mullion": "#b8c0c8", "spandrel": "#8fa3b5", "note": "sources say reflective glass; the silver-blue hue is read from photographs",
    "source": ["https://www.gpchicago.com/architecture/one-chicago/", "https://en.wikipedia.org/wiki/One_Chicago_(building)"] },
  "311wacker": { "material": "pale pink Texas granite, translucent lit crown cylinder", "finish": "granite", "base": "#c9a79a", "glass": "#3a3f45", "mullion": "#b38f82", "spandrel": "#bf9d90",
    "crownLight": { "kind": "lantern", "color": "#fff6e8", "fromM": 261, "toM": 293, "intensity": 1.6, "source": "https://en.wikipedia.org/wiki/311_South_Wacker_Drive" },
    "source": "https://en.wikipedia.org/wiki/311_South_Wacker_Drive" },
  "nema": { "material": "floor-to-ceiling window wall framed by white concrete columns and slabs", "finish": "concrete", "base": "#e9e9e6", "glass": "#6f8796", "mullion": "#e9e9e6", "spandrel": "#e9e9e6",
    "source": ["https://en.wikipedia.org/wiki/NEMA_Chicago", "https://buildingsdb.com/IL/chicago/nema-chicago/"] },
  "900michigan": { "material": "cream limestone and green-tinted glass, four corner pavilions lit as lanterns", "finish": "limestone", "base": "#d9ccb0", "glass": "#5e7a6c", "mullion": "#c9bb9f", "spandrel": "#d0c2a6",
    "crownLight": { "kind": "lantern", "color": "#fff1d6", "fromM": 245, "toM": 266, "intensity": 1.4, "source": "https://www.kpf.com/project/900-north-michigan-avenue" },
    "source": ["https://www.kpf.com/project/900-north-michigan-avenue", "https://en.wikipedia.org/wiki/900_North_Michigan"] },
  "chase": { "material": "pearl-grey Texas granite (Marble Falls) on the sweeping curved shaft", "finish": "granite", "base": "#b8b6b0", "glass": "#3c434a", "mullion": "#a9a7a1", "spandrel": "#b8b6b0",
    "source": ["https://en.wikipedia.org/wiki/Chase_Tower_(Chicago)", "https://www.preservationchicago.org/win-jp-morgan-chase-announces-chase-tower-renovation/"] },
  "watertower": { "material": "grey marble panels on slabs and columns", "finish": "granite", "base": "#b9b8b3", "glass": "#2f3338", "mullion": "#a8a7a2", "spandrel": "#b9b8b3", "note": "Wikipedia says grey marble (the backlog's 'white marble' is overridden); marble uses the polished-stone finish",
    "source": "https://en.wikipedia.org/wiki/Water_Tower_Place" },
  "aqua": { "material": "white concrete balcony slabs, blue-green tinted glass 'pools'", "finish": "concrete", "base": "#ecebe6", "glass": "#6fa3a6", "mullion": "#d9dcdc", "spandrel": "#ecebe6",
    "source": ["https://en.wikipedia.org/wiki/Aqua_(Chicago)", "https://www.architecture.org/online-resources/buildings-of-chicago/aqua"] },
  "400lsd": { "material": "faceted bay-window curtain wall, low-reflectance Stopray-coated glass", "finish": "glass", "base": "#7f8f9c", "glass": "#6f8394", "mullion": "#aeb6bd", "spandrel": "#7f8f9c", "note": "the coating takes the sky's hue; the resting grey-blue is read from photographs",
    "source": ["https://www.som.com/projects/400-lake-shore/", "https://gbdmagazine.com/400-lake-shore-som/"] },
  "salesforce": { "material": "silvery-blue vision glass matched to opaque glass spandrels", "finish": "glass", "base": "#9fb2c3", "glass": "#8ea6bb", "mullion": "#c3ccd4", "spandrel": "#9fb2c3",
    "source": "https://www.archpaper.com/2025/01/pelli-clarke-partners-salesforce-tower-chicago/" },
  "110wacker": { "material": "glass with vertical glass fins, linen-finish stainless-steel panels", "finish": "glass", "base": "#b7c0c7", "glass": "#8d9dab", "mullion": "#d0d5d9", "spandrel": "#c2c8cd",
    "source": ["https://www.pohl-facades.com/en/projects/further-projects/110-north-wacker/", "https://en.wikipedia.org/wiki/110_North_Wacker"] },
  "1000m": { "material": "unitized glass curtain wall banded with mill-finish aluminium spandrels", "finish": "glass", "base": "#a9adb0", "glass": "#3d4a55", "mullion": "#b3b7ba", "spandrel": "#b3b7ba",
    "source": ["https://www.archpaper.com/2024/09/jahn-chicago-aluminum-spandrels-curtain-wall/", "https://en.wikipedia.org/wiki/1000M"] },
  "marina1": { "material": "exposed reinforced concrete, painted white", "finish": "concrete", "base": "#d8d6cf", "glass": "#3a4046", "mullion": "#cfcdc6", "spandrel": "#d8d6cf", "note": "sources give exposed concrete; the off-white finish is read from photographs",
    "source": "https://en.wikipedia.org/wiki/Marina_City" },
  "marina2": { "material": "exposed reinforced concrete, painted white", "finish": "concrete", "base": "#d8d6cf", "glass": "#3a4046", "mullion": "#cfcdc6", "spandrel": "#d8d6cf", "note": "sources give exposed concrete; the off-white finish is read from photographs",
    "source": "https://en.wikipedia.org/wiki/Marina_City" },
  "lakepoint": { "material": "bronze-tinted glass in gold/bronze anodized aluminium frames", "finish": "glass", "base": "#3a2f25", "glass": "#4a3a2b", "mullion": "#8a6a3a", "spandrel": "#3a2f25",
    "source": ["https://sah-archipedia.org/buildings/IL-01-031-0051", "https://lakepointtower.org/history/"] },
  "wrigleybldg": { "material": "glazed white terra cotta in six shades, warmer below and cooler and whiter as it rises; floodlit since 1921", "finish": "terracotta", "base": "#eee6d8", "glass": "#3a3f44", "mullion": "#e6ddcc", "spandrel": "#eee6d8", "top": "#f8f8f5", "topFromM": 0, "topM": 134,
    "crownLight": { "kind": "flood", "color": "#fff3dc", "fromM": 0, "toM": 134, "intensity": 0.9, "source": ["https://en.wikipedia.org/wiki/Wrigley_Building", "https://en.wikipedia.org/wiki/Architecture_of_the_night"] },
    "source": ["https://www.architecture.org/online-resources/buildings-of-chicago/wrigley-building", "https://en.wikipedia.org/wiki/Wrigley_Building"] },
  "tribune": { "material": "Indiana limestone, Gothic crown with flying buttresses, crown floodlit at night", "finish": "limestone", "base": "#cfc6b3", "glass": "#33373c", "mullion": "#c2b8a4", "spandrel": "#c9bfab",
    "crownLight": { "kind": "flood", "color": "#ffe9c4", "fromM": 112, "toM": 141, "intensity": 1.1, "source": "https://sah-archipedia.org/buildings/IL-01-031-0089" },
    "source": ["https://en.wikipedia.org/wiki/Tribune_Tower", "https://www.polycor.com/blog/celebrate-indiana-limestone-month-with-a-walking-tour-of-chicago/"] },
  "mart": { "material": "buff limestone and terra cotta with bronze", "finish": "limestone", "base": "#c8b79a", "glass": "#2f3338", "mullion": "#b5a486", "spandrel": "#bfae90",
    "source": "https://www.architecture.org/online-resources/buildings-of-chicago/merchandise-mart" },
  "cbot": { "material": "grey Indiana limestone piers with dark windows and spandrels; aluminium Ceres", "finish": "limestone", "base": "#b9b4a8", "glass": "#2b2f34", "mullion": "#a9a498", "spandrel": "#3a3c3f",
    "source": ["https://www.architecture.org/online-resources/buildings-of-chicago/chicago-board-of-trade-building", "https://en.wikipedia.org/wiki/Chicago_Board_of_Trade_Building"] },
  "crain": { "material": "alternating bands of white aluminium and silver reflective glass", "finish": "glass", "base": "#e8eaea", "glass": "#aab6c0", "mullion": "#d7dadc", "spandrel": "#e8eaea",
    "source": ["https://en.wikipedia.org/wiki/Crain_Communications_Building", "https://buildingsdb.com/IL/chicago/crain-communications-building/"] },
  "unitedcenter": { "material": "precast concrete exterior (chosen over limestone and granite)", "finish": "concrete", "base": "#a0806a", "glass": "#2c3238", "mullion": "#8a7060", "spandrel": "#a0806a", "note": "Wikipedia gives precast concrete; the warm brick-toned hue is read from photographs",
    "source": "https://en.wikipedia.org/wiki/United_Center" },
  "soldierfield": { "material": "Doric colonnades of concrete faced with granite-textured cast stone", "finish": "concrete", "base": "#c8c1b2", "glass": "#3a4046", "mullion": "#b8b1a2", "spandrel": "#c8c1b2", "parts": ["podium", "entablature", "column"],
    "source": ["https://www.nps.gov/subjects/nationalhistoriclandmarks/grant-park-stadium-soldier-field.htm", "https://www.architecture.org/online-resources/buildings-of-chicago/soldier-field"] },
  "wrigleyfield": { "material": "red brick base, dark green steel, ivy", "finish": "terracotta", "base": "#7b3a2a", "glass": "#2c3238", "mullion": "#1f4a33", "spandrel": "#7b3a2a", "parts": [], "note": "the venue palette already draws brick, green steel and ivy; the look is recorded for the building card",
    "source": "https://en.wikipedia.org/wiki/Wrigley_Field" },
  "ratefield": { "material": "precast concrete bowl with dark steel", "finish": "concrete", "base": "#9d9d99", "glass": "#2c3238", "mullion": "#2a3140", "spandrel": "#9d9d99", "parts": [], "note": "the venue palette already draws the bowl; hue read from photographs",
    "source": "https://en.wikipedia.org/wiki/Rate_Field" },
  "wintrust": { "material": "aluminium curtain wall of low-e glass under a curved standing-seam metal roof", "finish": "glass", "base": "#9aa7b1", "glass": "#7890a0", "mullion": "#c5ccd2", "spandrel": "#9aa7b1",
    "source": ["https://www.chicagoconstructionnews.com/150-million-wintrust-arena-christopher-glass-aluminum-collaborates-and-applies-expertise-to-unique-structures-glass-and-aluminum-leed-certified-environment/", "https://en.wikipedia.org/wiki/Wintrust_Arena"] },
  "centennialwheel": { "material": "white-painted steel wheel with an LED rim", "finish": "metal", "base": "#eeeeec", "glass": "#8fa3b5", "mullion": "#eeeeec", "spandrel": "#eeeeec", "parts": [], "note": "the landmark builder already draws white steel and LEDs",
    "source": "https://en.wikipedia.org/wiki/Centennial_Wheel" },
  "cloudgate": { "material": "168 mirror-polished stainless-steel plates", "finish": "metal", "base": "#d9dde0", "glass": "#d9dde0", "mullion": "#d9dde0", "spandrel": "#d9dde0", "parts": [], "note": "the landmark builder already draws mirror steel",
    "source": "https://en.wikipedia.org/wiki/Cloud_Gate" },
  "buckingham": { "material": "Georgia pink marble", "finish": "granite", "base": "#d9b3a6", "glass": "#d9b3a6", "mullion": "#c9a396", "spandrel": "#d9b3a6", "parts": ["rim", "column", "basin"],
    "source": "https://en.wikipedia.org/wiki/Buckingham_Fountain" },
  "pritzker": { "material": "brushed stainless-steel headdress and steel-pipe trellis", "finish": "metal", "base": "#c7ccd0", "glass": "#c7ccd0", "mullion": "#c7ccd0", "spandrel": "#c7ccd0", "parts": [], "note": "the landmark builder already draws brushed steel",
    "source": ["https://en.wikipedia.org/wiki/Jay_Pritzker_Pavilion", "https://www.architecture.org/online-resources/buildings-of-chicago/pritzker-pavilion"] },
  "chicagotheatre": { "material": "glazed off-white ('old ivory') terra cotta, triumphal-arch façade", "finish": "terracotta", "base": "#e8dcc4", "glass": "#3a3f44", "mullion": "#d8ccb4", "spandrel": "#e8dcc4",
    "source": ["https://www.architecture.org/online-resources/buildings-of-chicago/chicago-theatre", "https://cinematreasures.org/theaters/71"] },
  "adler": { "material": "twelve-sided rainbow granite drum under a copper dome", "finish": "granite", "base": "#a88f86", "glass": "#3a3f44", "mullion": "#98807a", "spandrel": "#a88f86", "parts": ["drum"],
    "source": "https://en.wikipedia.org/wiki/Adler_Planetarium" },
  "shedd": { "material": "white Georgia marble, Doric columns", "finish": "granite", "base": "#e7e4dc", "glass": "#3a3f44", "mullion": "#d7d4cc", "spandrel": "#e7e4dc", "parts": ["drum", "lantern"],
    "source": "https://en.wikipedia.org/wiki/Shedd_Aquarium" },
  "fieldmuseum": { "material": "white Georgia marble, Ionic porticos", "finish": "granite", "base": "#e4e1d8", "glass": "#3a3f44", "mullion": "#d4d1c8", "spandrel": "#e4e1d8", "parts": ["column", "portico", "pediment"],
    "source": ["https://en.wikipedia.org/wiki/Field_Museum_of_Natural_History", "https://en.wikipedia.org/wiki/Museum_Campus"] },
  "historicwatertower": { "material": "yellow Joliet–Lemont limestone, castellated Gothic Revival", "finish": "limestone", "base": "#d8c38f", "glass": "#3a3f44", "mullion": "#c8b37f", "spandrel": "#d8c38f", "parts": ["turret", "lantern"],
    "source": ["https://en.wikipedia.org/wiki/Chicago_Water_Tower", "https://sah-archipedia.org/buildings/IL-01-031-0095"] },
  "crownhall": { "material": "black-painted welded steel frame, translucent lower glass to 4.16 m, clear glass above", "finish": "metal", "base": "#1f2124", "glass": "#6c7a80", "mullion": "#151618", "spandrel": "#1f2124", "render": false, "note": "the venue glass-steel wall already reads correctly; a pattern-unaware black recolour would darken the glass — refine in Phase 3",
    "source": ["https://docomomo-us.org/register/s-r-crown-hall", "https://en.wikipedia.org/wiki/S._R._Crown_Hall"] }
}
```

Apply them with a one-off script, which is not committed. First save the object above with the Write tool as `<scratchpad>/v2-looks.json`, then run the command below with `LOOKS=<scratchpad>/v2-looks.json`:

```bash
cd /Users/connorevans/Downloads/Chicago_open_world && LOOKS="$LOOKS" node -e "
const fs=require('fs');const p='pipeline/data/heroes.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));const L=JSON.parse(fs.readFileSync(process.env.LOOKS,'utf8'));
j.heroes=j.heroes.map(h=>{if(!L[h.key])throw new Error('no look for '+h.key);const {key,name,...rest}=h;return {key,name,look:L[h.key],...rest}});
fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n')"
```

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline -- looks heroes`
Expected: PASS. The existing `heroes.test.js` is untouched and stays green.

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add pipeline/data/heroes.json pipeline/tests/looks.test.js
git commit -m "data: sourced colour and material looks for all 41 landmarks, crown lights for Willis, 875 N Michigan, 311 S Wacker, 900 N Michigan, Wrigley Building, Tribune (F1-F7, F9)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

Ledger: append the seven rulings listed at the top of this task, one `Ruling:` line each, with the cost if wrong.

---

### Task 3: Style registry, mesh style rule, palette preview PNG

**Files:**
- Create: `pipeline/lib/styles.js`
- Test: `pipeline/tests/styles.test.js`

**Interfaces:**
- Consumes: `FINISH_PRESETS`, `FINISHES`, `hexToRgb` (Task 1).
- Produces (the cross-plan `_STYLE` palette contract; V3 stations and V6 bridges and landmarks call `add`):
  - `STYLE_COLS = 7`
  - `MAX_STYLES = 256` (rows, including row 0 = "none")
  - `styleEntry(key: string, look): StyleRow`, where StyleRow is:
    ```
    {
      key, finish, base, glass, mullion, spandrel, top, topFromM, topM,
      roughness, metalness,
      crown: null | { kind, color, fromM, toM, intensity }
    }
    ```
  - `createStyleRegistry(): { add(key, look): number, indexOf(key): number, size: number, toJSON(): { version: 1, cols: 7, styles: StyleRow[] } }`
    - `add` returns the existing index for a known key.
    - It returns 0 when the palette is full, or when `look.render === false`.
  - `meshStyle(b: { styleIndex?: number, styleParts?: string[] }, part?: string): number`
    - Without `part` (body pieces, parapets, crowns, LOD1 extrusions), it returns `b.styleIndex ?? 0`.
    - With `part` (venue or landmark meshes), it returns `b.styleIndex` only when the part is listed.
  - `writeStylePalettePng(path, json, cell = 16): Promise<void>`: an sRGB swatch sheet with 7 columns × rows cells.

- [ ] **Step 1: Write the failing test.**

```js
// pipeline/tests/styles.test.js
import { describe, it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path'
import sharp from 'sharp'
import { STYLE_COLS, MAX_STYLES, styleEntry, createStyleRegistry, meshStyle, writeStylePalettePng } from '../lib/styles.js'

const look = (o = {}) => ({ material: 'test material', finish: 'granite', base: '#e6e4de', glass: '#3b4046', mullion: '#cfcac1', spandrel: '#e6e4de', source: 'https://x.example', ...o })

describe('style registry', () => {
  it('row 0 is "none"; heroes get 1..n in insertion order; re-adding a key reuses its row', () => {
    const r = createStyleRegistry()
    expect(r.add('willis', look())).toBe(1)
    expect(r.add('aon', look())).toBe(2)
    expect(r.add('willis', look({ base: '#000000' }))).toBe(1)
    expect(r.indexOf('aon')).toBe(2); expect(r.indexOf('nope')).toBe(0)
    expect(r.size).toBe(3)
    const j = r.toJSON()
    expect(j).toMatchObject({ version: 1, cols: STYLE_COLS })
    expect(j.styles[0]).toEqual({ key: 'none' })
  })
  it('styleEntry resolves finish presets, top defaults and crown light', () => {
    const e = styleEntry('311wacker', look({ crownLight: { kind: 'lantern', color: '#fff6e8', fromM: 261, toM: 293, intensity: 1.6, source: 'https://x.example' } }))
    expect(e).toMatchObject({ key: '311wacker', finish: 'granite', roughness: 0.45, metalness: 0.05, top: '#e6e4de', topFromM: 0, topM: 0 })
    expect(e.crown).toEqual({ kind: 'lantern', color: '#fff6e8', fromM: 261, toM: 293, intensity: 1.6 })
    expect(styleEntry('x', look({ crownLight: { kind: 'flood', color: '#ffffff', fromM: 0, toM: 10, intensity: 1, source: 'https://x.example', render: false } })).crown).toBeNull()
  })
  it('a reverted look (render:false) gets row 0 and no palette row', () => {
    const r = createStyleRegistry()
    expect(r.add('crownhall', look({ render: false, note: 'reverted' }))).toBe(0)
    expect(r.size).toBe(1)
  })
  it('registry stops at MAX_STYLES and returns 0', () => {
    const r = createStyleRegistry()
    for (let i = 1; i < MAX_STYLES; i++) expect(r.add(`k${i}`, look())).toBe(i)
    expect(r.add('overflow', look())).toBe(0)
    expect(r.size).toBe(MAX_STYLES)
  })
  it('meshStyle: body always, venue/landmark meshes only for listed parts', () => {
    const b = { styleIndex: 5, styleParts: ['column'] }
    expect(meshStyle(b)).toBe(5)
    expect(meshStyle(b, 'column')).toBe(5)
    expect(meshStyle(b, 'turf')).toBe(0)
    expect(meshStyle({})).toBe(0)
    expect(meshStyle({ styleIndex: 3 }, 'rim')).toBe(0)
  })
  it('writes an sRGB swatch sheet: 7 columns × rows, base colour in column 0', async () => {
    const r = createStyleRegistry(); r.add('aon', look())
    const path = join(mkdtempSync(join(tmpdir(), 'sp-')), 'p.png')
    await writeStylePalettePng(path, r.toJSON(), 4)
    const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true })
    expect([info.width, info.height]).toEqual([STYLE_COLS * 4, 2 * 4])
    const px = (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)]
    expect(px(1, 5)).toEqual([0xe6, 0xe4, 0xde]) // row 1, column 0 = base
    expect(px(1, 1)).toEqual([0, 0, 0])          // row 0 = none = black
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline -- styles`
Expected: FAIL with the module `../lib/styles.js` not found.

- [ ] **Step 3: Write the minimal implementation.**

```js
// pipeline/lib/styles.js — the style palette: one row per sourced look, indexed per vertex by _STYLE (spec B.6).
// Row 0 is "no style". The app builds a float DataTexture from styles.json; the PNG is a review swatch sheet.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { FINISH_PRESETS, FINISHES, hexToRgb } from './looks.js'

export const STYLE_COLS = 7
export const MAX_STYLES = 256

export function styleEntry(key, look) {
  const p = FINISH_PRESETS[look.finish]
  const c = look.crownLight && look.crownLight.render !== false ? look.crownLight : null
  return {
    key, finish: look.finish, base: look.base, glass: look.glass, mullion: look.mullion, spandrel: look.spandrel,
    top: look.top ?? look.base, topFromM: look.top ? look.topFromM ?? 0 : 0, topM: look.top ? look.topM : 0,
    roughness: p.roughness, metalness: p.metalness,
    crown: c ? { kind: c.kind, color: c.color, fromM: c.fromM, toM: c.toM, intensity: c.intensity } : null,
  }
}

export function createStyleRegistry() {
  const rows = [{ key: 'none' }]
  const byKey = new Map([['none', 0]])
  return {
    add(key, look) {
      if (byKey.has(key)) return byKey.get(key)
      if (!look || look.render === false || rows.length >= MAX_STYLES) return 0
      rows.push(styleEntry(key, look))
      byKey.set(key, rows.length - 1)
      return rows.length - 1
    },
    indexOf: (key) => byKey.get(key) ?? 0,
    get size() { return rows.length },
    toJSON: () => ({ version: 1, cols: STYLE_COLS, styles: rows }),
  }
}

export function meshStyle(b, part) {
  if (!b?.styleIndex) return 0
  if (part === undefined) return b.styleIndex
  return (b.styleParts ?? []).includes(part) ? b.styleIndex : 0
}

export async function writeStylePalettePng(path, json, cell = 16) {
  const rows = json.styles, w = STYLE_COLS * cell, h = rows.length * cell
  const buf = Buffer.alloc(w * h * 4)
  rows.forEach((s, r) => {
    const grey = s.finish ? Math.round((255 * (FINISHES.indexOf(s.finish) + 1)) / FINISHES.length) : 0
    const cols = s.base ? [s.base, s.glass, s.mullion, s.spandrel, s.top, s.crown?.color ?? '#000000', null] : Array(STYLE_COLS).fill('#000000')
    cols.forEach((hex, c) => {
      const [R, G, B] = hex ? hexToRgb(hex) : [grey, grey, grey]
      for (let y = r * cell; y < (r + 1) * cell; y++) for (let x = c * cell; x < (c + 1) * cell; x++) {
        const i = (y * w + x) * 4
        buf[i] = R; buf[i + 1] = G; buf[i + 2] = B; buf[i + 3] = 255
      }
    })
  })
  mkdirSync(dirname(path), { recursive: true })
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toFile(path)
}
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline -- styles`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add pipeline/lib/styles.js pipeline/tests/styles.test.js
git commit -m "feat(pipeline): style registry and palette swatch sheet — the shared _STYLE palette contract" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Building-layer accumulator with `STYLE`; the index survives meshopt exactly

**Files:**
- Create: `pipeline/lib/layers.js`. Move `bAcc`, `appendBuilding` and `asLayer` out of `pipeline/build/build-world.js` (current lines 71–79), add `style`, and add `appendLayer`.
- Modify: `pipeline/build/build-world.js`. Import from `../lib/layers.js` and delete the moved local definitions. Keep `acc` and `append` local, since roads use them.
- Test: `pipeline/tests/layers.test.js`

**Interfaces:**
- Produces:
  - `bAcc(): { positions, normals, uvs, fac, seed, bldg, style }` (all `number[]`).
  - `appendBuilding(dst, mesh: { positions, normals, uvs }, facade: number, seed: number, idx: number, style = 0): void`
  - `appendLayer(dst, src)`: concatenates every array of one accumulator onto another. It is used for 2 km blocks.
  - `asLayer(b): { positions, normals, uvs, extra: { FACADE, SEED, BLDG, STYLE: Float32Array } }`
- **Note for the executor:** V1 (H7) made `_BLDG` unique per file, so the body of `appendBuilding` / `asLayer` in `build-world.js` may differ from the snapshot below. Move **V1's current bodies verbatim** and add only the `style` array and parameter. The test below checks `STYLE` and the arrays that exist today.

**Why this matters (Review Focus 1):** `writeTileGlb` runs `meshopt({ level: 'medium' })`, which quantizes every attribute (`pattern: /.*/`). In `@gltf-transform/functions` 4.5.1 `getQuantizationSettings`:
- an `_` attribute whose min/max lie inside [−1, 1] becomes a normalized 12-bit Uint16;
- one outside that range is skipped and stays float32.

So `_STYLE` ∈ {0, 1} is quantized. Bit replication (`value << 4 | value >> 8`) stores 1 as 65535, which decodes to exactly 1.0. Any tile with an index ≥ 2 stays float32 and exact. The tests pin both regimes and the all-zero tile.

- [ ] **Step 1: Write the failing test.**

```js
// pipeline/tests/layers.test.js
import { describe, it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { bAcc, appendBuilding, appendLayer, asLayer } from '../lib/layers.js'
import { writeTileGlb } from '../lib/tilepack.js'

const tri = (x) => ({ positions: [x, 0, 0, x + 10, 0, 0, x, 10, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], uvs: [0, 0, 10, 0, 0, 10] })
async function roundTrip(styles) {
  const L = bAcc()
  styles.forEach((s, i) => appendBuilding(L, tri(i * 20), 3, 0.5, i, s))
  const path = join(mkdtempSync(join(tmpdir(), 'l-')), 't.glb')
  await writeTileGlb(path, { buildings: asLayer(L) })
  await MeshoptDecoder.ready
  const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read(path)
  const a = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('_STYLE')
  return Array.from({ length: a.getCount() }, (_, i) => a.getScalar(i))
}

describe('building layers', () => {
  it('appendBuilding writes one style per vertex, defaulting to 0', () => {
    const L = bAcc()
    appendBuilding(L, tri(0), 3, 0.5, 7)
    appendBuilding(L, tri(20), 3, 0.5, 8, 12)
    expect(L.style).toEqual([0, 0, 0, 12, 12, 12])
    expect(L.fac).toHaveLength(6); expect(L.seed).toHaveLength(6); expect(L.bldg).toHaveLength(6)
    expect(asLayer(L).extra.STYLE).toBeInstanceOf(Float32Array)
    expect([...asLayer(L).extra.STYLE]).toEqual([0, 0, 0, 12, 12, 12])
  })
  it('appendLayer concatenates every array (2 km blocks)', () => {
    const A = bAcc(), B = bAcc()
    appendBuilding(A, tri(0), 1, 0.1, 0, 2); appendBuilding(B, tri(0), 4, 0.2, 0, 9)
    appendLayer(A, B)
    expect(A.style).toEqual([2, 2, 2, 9, 9, 9]); expect(A.fac).toEqual([1, 1, 1, 4, 4, 4]); expect(A.positions).toHaveLength(18)
  })
  it('survives quantization when a tile\'s styles are only 0 and 1', async () => {
    expect(new Set(await roundTrip([0, 1]))).toEqual(new Set([0, 1]))
  })
  it('survives exactly when indexes exceed 1 (float32 path)', async () => {
    expect(new Set(await roundTrip([0, 37, 255]))).toEqual(new Set([0, 37, 255]))
  })
  it('an all-unstyled tile decodes to zeros', async () => {
    expect(new Set(await roundTrip([0, 0]))).toEqual(new Set([0]))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline -- layers`
Expected: FAIL with the module `../lib/layers.js` not found.

- [ ] **Step 3: Write the implementation and rewire the build.**

```js
// pipeline/lib/layers.js — the per-tile building layer: geometry plus per-vertex façade, seed, building index, style.
export const bAcc = () => ({ positions: [], normals: [], uvs: [], fac: [], seed: [], bldg: [], style: [] })

export function appendBuilding(dst, m, facade, seed, idx, style = 0) {
  for (const k of ['positions', 'normals', 'uvs']) for (const v of m[k]) dst[k].push(v)
  const n = m.positions.length / 3
  for (let v = 0; v < n; v++) { dst.fac.push(facade); dst.seed.push(seed); dst.bldg.push(idx); dst.style.push(style) }
}

export function appendLayer(dst, src) {
  for (const k of ['positions', 'normals', 'uvs', 'fac', 'seed', 'bldg', 'style']) for (const v of src[k]) dst[k].push(v)
}

export const asLayer = (b) => ({
  positions: b.positions, normals: b.normals, uvs: b.uvs,
  extra: { FACADE: new Float32Array(b.fac), SEED: new Float32Array(b.seed), BLDG: new Float32Array(b.bldg), STYLE: new Float32Array(b.style) },
})
```

In `pipeline/build/build-world.js`:
1. Add `import { bAcc, appendBuilding, appendLayer, asLayer } from '../lib/layers.js'`.
2. Delete the local `appendBuilding`, `bAcc` and `asLayer`. Keep `acc` and `append`.
3. Replace the block accumulation line `for (const v of L1.fac) B.b.fac.push(v); for (const v of L1.seed) B.b.seed.push(v); for (const v of L1.bldg) B.b.bldg.push(v)` **and** the `positions`/`normals`/`uvs` pushes of `L1` into `B.b` inside the `for (const k of ['positions','normals','uvs'])` loop with a single `appendLayer(B.b, L1)`. The ground (`B.g`) and water (`B.w`) pushes stay as they are.

If V1 already changed the block accumulation (for example to renumber `_BLDG` per block), keep V1's renumbering and add `for (const v of L1.style) B.b.style.push(v)` next to it instead of `appendLayer`.

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline -- layers tilepack`
Expected: PASS (5 new plus the 6 existing tilepack tests).

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add pipeline/lib/layers.js pipeline/tests/layers.test.js pipeline/build/build-world.js
git commit -m "feat(pipeline): _STYLE per-vertex attribute in the building layer; pinned exact through meshopt quantization" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Build wiring — styles on heroes, `styles.json`, `style-palette.png`, manifest v5

**Files:**
- Modify: `pipeline/build/build-world.js`
- Test: `pipeline/tests/styles.test.js` (append a build-shape test on a pure helper)

**Interfaces:**
- Consumes:
  - `createStyleRegistry`, `meshStyle`, `writeStylePalettePng` (Task 3);
  - `appendBuilding(…, style)` (Task 4);
  - `heroes[].look` (Task 2).
- Produces:
  - `assignHeroStyles(buildings, heroes, registry): void` (exported from `pipeline/lib/styles.js`). It sets `b.styleIndex` and `b.styleParts` on every hero building.
  - `app/public/world/styles.json` (`{ version: 1, cols: 7, styles: StyleRow[] }`, 42 rows = none + 41 heroes, minus reverted ones).
  - `app/public/world/style-palette.png`.
  - `manifest.version === 5`, with `manifest.styles === 'styles.json'` and `manifest.stylePalette === 'style-palette.png'`.

- [ ] **Step 1: Write the failing test (append to `pipeline/tests/styles.test.js`).**

```js
import { assignHeroStyles } from '../lib/styles.js'
describe('assignHeroStyles', () => {
  it('gives each hero building its row and listed parts, in heroes.json order; others untouched', () => {
    const heroes = [{ key: 'willis', look: look() }, { key: 'soldierfield', look: look({ parts: ['column'] }) }, { key: 'crownhall', look: look({ render: false, note: 'n' }) }]
    const bs = [{ hero: 'soldierfield' }, { hero: 'willis' }, { hero: 'crownhall' }, { hero: undefined }]
    const r = createStyleRegistry()
    assignHeroStyles(bs, heroes, r)
    expect(bs.map((b) => b.styleIndex)).toEqual([2, 1, 0, undefined])
    expect(bs[0].styleParts).toEqual(['column'])
    expect(bs[1].styleParts).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline -- styles`
Expected: FAIL with `assignHeroStyles is not a function` (the export does not exist yet).

- [ ] **Step 3: Implement the helper and wire the build.**

Append to `pipeline/lib/styles.js`:

```js
// Heroes are registered first and in heroes.json order, so their rows are stable across builds and never crowded out.
export function assignHeroStyles(buildings, heroes, registry) {
  for (const h of heroes) if (h.look) registry.add(h.key, h.look)
  const byKey = new Map(heroes.map((h) => [h.key, h]))
  for (const b of buildings) {
    if (!b.hero) continue
    b.styleIndex = registry.indexOf(b.hero)
    b.styleParts = byKey.get(b.hero)?.look?.parts ?? []
  }
}
```

In `pipeline/build/build-world.js`:

1. Imports: `import { createStyleRegistry, assignHeroStyles, meshStyle, writeStylePalettePng } from '../lib/styles.js'`.
2. After the sacred-buildings loop (just before `// ── Per-tile assembly`), insert:
   ```js
   // ── Sourced looks (V2): hero rows first; OSM-tagged looks are added in Task 9 ──
   const styles = createStyleRegistry()
   assignHeroStyles(buildings, heroes, styles)
   log(`styles: ${styles.size - 1} rows`)
   ```
3. In the per-tile `t.b.forEach((b, i) => { … })`, pass the style as the last argument:
   - `for (const pc of b.pieces) appendBuilding(L0, extrudeBuilding(pc), family, seed, i, meshStyle(b))`
   - parapets and `extraMeshes`: `…, i, meshStyle(b))`
   - venue meshes: `appendBuilding(L0, v.mesh, v.facade, v.seed, i, meshStyle(b, v.part))` and the same for `L1`
   - LOD1 `keepsShapeAtDistance` pieces and `extraMeshes`: `…, i, meshStyle(b))`
   - LOD1 simplified footprint: `appendBuilding(L1, extrudeBuilding({ outer, holes: [], base: 0, top: b.height }), family, seed, i, meshStyle(b))`
   - The horizon `appendBuilding(hChunks.get(k), …, i)` stays at the default 0. The attribute is still written, because `asLayer` always emits `STYLE`.
4. After the minimap is written:
   ```js
   writeFileSync(join(OUT, 'styles.json'), JSON.stringify(styles.toJSON()))
   await writeStylePalettePng(join(OUT, 'style-palette.png'), styles.toJSON())
   log(`style palette written: ${styles.size} rows`)
   ```
5. In the manifest object: set `version: 5` and add `styles: 'styles.json', stylePalette: 'style-palette.png'` next to `landMask`. Append to `sources`: `{ name: 'Landmark colours and materials — sourced per look in heroes.json', id: 'heroes.json#look' }`.

- [ ] **Step 4: Run the unit tests, then the world build (nothing else heavy running).**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline`
Expected: PASS (all).

Run: `npm run build:world --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline 2>&1 | tail -20`
Expected:
- the log shows `styles: 40 rows` (41 heroes, Crown Hall reverted) and `style palette written: 41 rows`;
- the skyline assertion passes;
- the build exits 0.

Run:
```bash
cd /Users/connorevans/Downloads/Chicago_open_world/app/public/world && node -e "const m=require('./manifest.json');const s=require('./styles.json');console.log(m.version,m.styles,s.styles.length,s.styles[1].key)" && du -sh .
```
Expected: `5 styles.json 41 willis`, and the size is ≤ 200 MB (it was 152 MB).

- [ ] **Step 5: Commit the code, then the regenerated world.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add pipeline/lib/styles.js pipeline/tests/styles.test.js pipeline/build/build-world.js
git commit -m "feat(pipeline): landmarks carry their style row per vertex; styles.json, palette swatches, manifest v5" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git add app/public/world
git commit -m "build: world v5 with _STYLE and the style palette" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: App style palette texture

**Files:**
- Create: `app/src/world/materials/stylePalette.js`
- Modify: `app/src/world/materials/facadeMaterial.js`: add the `uStylePal` and `uStyleRows` uniforms and `loadStylePalette`.
- Modify: `app/src/world/Scene.jsx`. In the `loadManifest().then(…)` success branch, after `setManifest`, add `loadStylePalette(r.manifest)`.
- Test: `app/src/world/materials/__tests__/stylePalette.test.js`

**Interfaces:**
- Consumes: the `styles.json` row shape (Task 3).
- Produces:
  - `STYLE_COLS = 7`.
  - `srgbToLinear(c: number): number`.
  - `hexLinear('#rrggbb'): [r, g, b]` (linear).
  - `paletteData(styles: StyleRow[]): { data: Float32Array, width: 7, height: number }`, with this texel layout per row:
    - col 0: base.rgb, a = finish index;
    - col 1: glass.rgb, a = roughness;
    - col 2: mullion.rgb, a = metalness;
    - col 3: spandrel.rgb, a = 0;
    - col 4: top.rgb, a = topM;
    - col 5: crown.rgb, a = crown intensity;
    - col 6: (crown fromM, crown toM, kind 0|1|2, topFromM).
  - `createStyleTexture(styles): THREE.DataTexture` (RGBA, FloatType, Nearest, no mipmaps).
  - `facadeUniforms.uStylePal: { value: DataTexture }` and `facadeUniforms.uStyleRows: { value: number }`.
  - `loadStylePalette(manifest): Promise<boolean>`.

- [ ] **Step 1: Write the failing test.**

```js
// app/src/world/materials/__tests__/stylePalette.test.js
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as THREE from 'three'
import { STYLE_COLS, srgbToLinear, hexLinear, paletteData, createStyleTexture } from '../stylePalette.js'
import { facadeUniforms, loadStylePalette } from '../facadeMaterial.js'

const row = { key: '311wacker', finish: 'granite', base: '#ffffff', glass: '#000000', mullion: '#808080', spandrel: '#ff0000', top: '#00ff00', topFromM: 5, topM: 10, roughness: 0.45, metalness: 0.05, crown: { kind: 'lantern', color: '#0000ff', fromM: 261, toM: 293, intensity: 1.6 } }

describe('style palette', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('sRGB → linear', () => {
    expect(srgbToLinear(0)).toBe(0); expect(srgbToLinear(1)).toBeCloseTo(1)
    expect(srgbToLinear(0.5)).toBeCloseTo(0.2140, 3)
    expect(hexLinear('#ff0000')).toEqual([1, 0, 0])
  })
  it('packs 7 texels per row; row 0 stays zero', () => {
    const { data, width, height } = paletteData([{ key: 'none' }, row])
    expect([width, height, STYLE_COLS]).toEqual([7, 2, 7])
    expect([...data.slice(0, 28)].every((v) => v === 0)).toBe(true)
    const t = (col) => [...data.slice((7 + col) * 4, (7 + col) * 4 + 4)]
    expect(t(0)).toEqual([1, 1, 1, 2])                 // base, finish index of granite
    expect(t(1)[3]).toBeCloseTo(0.45)                   // roughness
    expect(t(2)[3]).toBeCloseTo(0.05)                   // metalness
    expect(t(3).slice(0, 3)).toEqual([1, 0, 0])         // spandrel
    expect(t(4)).toEqual([0, 1, 0, 10])                 // top colour, topM
    expect(t(5)[2]).toBe(1); expect(t(5)[3]).toBeCloseTo(1.6)
    expect(t(6)).toEqual([261, 293, 2, 5])              // crown band, lantern = 2, topFromM
  })
  it('a row without crown light has kind 0 and intensity 0', () => {
    const { data } = paletteData([{ key: 'none' }, { ...row, crown: null }])
    expect(data[(7 + 5) * 4 + 3]).toBe(0); expect(data[(7 + 6) * 4 + 2]).toBe(0)
  })
  it('makes an exact float texture (no filtering, no mips)', () => {
    const tex = createStyleTexture([{ key: 'none' }, row])
    expect(tex).toBeInstanceOf(THREE.DataTexture)
    expect(tex.type).toBe(THREE.FloatType)
    expect(tex.magFilter).toBe(THREE.NearestFilter); expect(tex.minFilter).toBe(THREE.NearestFilter)
    expect(tex.generateMipmaps).toBe(false)
    expect([tex.image.width, tex.image.height]).toEqual([7, 2])
  })
  it('loadStylePalette installs the rows from the manifest', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ version: 1, cols: 7, styles: [{ key: 'none' }, row] }) })))
    expect(await loadStylePalette({ styles: 'styles.json' })).toBe(true)
    expect(fetch).toHaveBeenCalledWith('/world/styles.json')
    expect(facadeUniforms.uStyleRows.value).toBe(2)
  })
  it('loadStylePalette keeps the default palette when styles.json fails', async () => {
    const before = facadeUniforms.uStylePal.value
    facadeUniforms.uStyleRows.value = 1
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await loadStylePalette({ styles: 'styles.json' })).toBe(false)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
    expect(await loadStylePalette({ styles: 'styles.json' })).toBe(false)
    expect(await loadStylePalette({})).toBe(false)           // a v4 world has no styles
    expect(facadeUniforms.uStylePal.value).toBe(before)
    expect(facadeUniforms.uStyleRows.value).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app -- stylePalette`
Expected: FAIL with the module `../stylePalette.js` not found.

- [ ] **Step 3: Write the implementation.**

```js
// app/src/world/materials/stylePalette.js — styles.json rows → a small exact float texture read by the façade shader.
import * as THREE from 'three'

export const STYLE_COLS = 7
const FINISH = ['glass', 'metal', 'granite', 'limestone', 'terracotta', 'concrete']
const KIND = { flood: 1, lantern: 2 }

export const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
export function hexLinear(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => srgbToLinear(v / 255))
}

export function paletteData(styles) {
  const height = Math.max(1, styles.length)
  const data = new Float32Array(STYLE_COLS * height * 4)
  styles.forEach((s, row) => {
    if (!s.base) return // row 0: no style
    const put = (col, [r, g, b], a) => { const i = (row * STYLE_COLS + col) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a }
    const c = s.crown
    put(0, hexLinear(s.base), FINISH.indexOf(s.finish))
    put(1, hexLinear(s.glass), s.roughness)
    put(2, hexLinear(s.mullion), s.metalness)
    put(3, hexLinear(s.spandrel), 0)
    put(4, hexLinear(s.top ?? s.base), s.topM ?? 0)
    put(5, c ? hexLinear(c.color) : [0, 0, 0], c ? c.intensity : 0)
    put(6, c ? [c.fromM, c.toM, KIND[c.kind]] : [0, 0, 0], s.topFromM ?? 0)
  })
  return { data, width: STYLE_COLS, height }
}

export function createStyleTexture(styles) {
  const { data, width, height } = paletteData(styles)
  const t = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType)
  t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false
  t.needsUpdate = true
  return t
}
```

In `app/src/world/materials/facadeMaterial.js`:
- Add `import { createStyleTexture } from './stylePalette.js'`.
- Add to `facadeUniforms`:
  ```js
    uStylePal: { value: createStyleTexture([{ key: 'none' }]) },
    uStyleRows: { value: 1 },
  ```
- Append:
  ```js
  // Sourced building colours (V2): absent or unreachable styles.json leaves the one-row default — the city renders as before.
  export async function loadStylePalette(manifest) {
    if (!manifest?.styles) return false
    try {
      const r = await fetch(`/world/${manifest.styles}`)
      if (!r.ok) { console.warn(`styles.json HTTP ${r.status} — default colours`); return false }
      const j = await r.json()
      facadeUniforms.uStylePal.value = createStyleTexture(j.styles)
      facadeUniforms.uStyleRows.value = j.styles.length
      return true
    } catch (e) {
      console.warn('styles.json unavailable — default colours', e)
      return false
    }
  }
  ```

In `app/src/world/Scene.jsx`:
- Change the import to `import { loadFacadeTextures, loadStylePalette } from './materials/facadeMaterial.js'`.
- Inside `loadManifest().then((r) => { … })`, after `useStore.getState().setManifest(r.manifest)`, add `loadStylePalette(r.manifest)`.

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app`
Expected: PASS. The 6 new tests pass and every existing app test stays green.

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add app/src/world/materials/stylePalette.js app/src/world/materials/__tests__/stylePalette.test.js app/src/world/materials/facadeMaterial.js app/src/world/Scene.jsx
git commit -m "feat(app): style palette DataTexture from styles.json, graceful when absent" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Façade shader — sourced recolour and finish presets (F2–F8), then evaluate and revert

**Files:**
- Modify: `app/src/world/materials/facadeMaterial.js` (`VERT_HEAD`, `VERT_BODY`, `FRAG_HEAD`, `FRAG_MAP`, `FRAG_ROUGH`, `FRAG_METAL`, `customProgramCacheKey`)
- Test: `app/src/world/materials/__tests__/facadeMaterial.test.js` (append)

**Interfaces:**
- Consumes:
  - `uStylePal` and `uStyleRows` (Task 6);
  - the `_STYLE` glb attribute. GLTFLoader lowercases custom names, so the shader sees `_style`.
- Produces:
  - shader varyings `vStyle`;
  - main-scope locals `si` (int), `styled` (bool), `S0…S4` (vec4), which Task 8's emissive code uses;
  - `customProgramCacheKey() === 'facade-v8'`.

**Shading rule (spec B.6):**
- Styled façade fragments (`si > 0`, not roof, not parapet, not venue) replace the texture colour with the look.
  - The body colour is `base`, blending to `top` between `topFromM` and `topM`.
  - The bottom 20 % of each window cell is spandrel.
  - Window glass follows the texture-array window mask `win`.
  - The cell's side edges are mullions.
  - Texture luminance (±20 %) keeps the family's detail.
  - The per-building seed variation and the curtain-glass tint buckets are skipped, since the colour is sourced.
- Styled venue walls (façade 16, e.g. museums, arenas, colonnades) are recoloured to `base`, keeping the pattern's light and dark.
- Roughness and metalness come from the finish preset. Window glass stays reflective.

- [ ] **Step 1: Write the failing tests (append to the existing `describe('patchFacadeShader', …)` block).**

```js
  it('reads the style attribute and palette (V2)', () => {
    const s = patchFacadeShader(std())
    expect(s.vertexShader).toContain('attribute float _style;')
    expect(s.vertexShader).toContain('vStyle = _style;')
    expect(s.fragmentShader).toContain('uniform sampler2D uStylePal;')
    expect(s.fragmentShader).toMatch(/texelFetch\(uStylePal, ivec2\(col, si\), 0\)/)
    expect(s.uniforms.uStylePal).toBe(facadeUniforms.uStylePal)
    expect(s.uniforms.uStyleRows).toBe(facadeUniforms.uStyleRows)
  })
  it('clamps a style index beyond the palette to 0', () => {
    const f = patchFacadeShader(std()).fragmentShader
    expect(f).toMatch(/int si = int\(vStyle \+ 0\.5\);\s*si = float\(si\) < uStyleRows \? si : 0;/)
    expect(f).toContain('bool styled = si > 0;')
  })
  it('sourced colours skip the random seed variation and glass tint buckets', () => {
    const f = patchFacadeShader(std()).fragmentShader
    expect(f).toContain('if (!isVenue && !styled)')
    expect(f).toContain('if (fi == 3 && !styled)')
  })
  it('finish presets drive roughness and metalness; windows stay glass', () => {
    const f = patchFacadeShader(std()).fragmentShader
    expect(f).toContain('roughnessFactor = mix(S1.a, 0.06, win * 0.95);')
    expect(f).toContain('metalnessFactor = mix(S2.a, 0.9, win * 0.85);')
  })
  it('program cache key changes with the new shader', async () => {
    const { createFacadeMaterial } = await import('../facadeMaterial.js')
    expect(createFacadeMaterial().customProgramCacheKey()).toBe('facade-v8')
  })
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app -- facadeMaterial`
Expected: FAIL. The 5 new tests fail (e.g. `expected … to contain 'attribute float _style;'`). The existing 5 pass.

- [ ] **Step 3: Implement.** In `facadeMaterial.js`, make these edits:

`VERT_HEAD`: after `attribute float _seed;`, add:
```glsl
attribute float _style;
varying float vStyle;
```

`VERT_BODY`: after `vSeed = _seed;`, add:
```glsl
vStyle = _style;
```

`FRAG_HEAD`: after `uniform float uReady;`, add:
```glsl
uniform sampler2D uStylePal;
uniform float uStyleRows;
varying float vStyle;
vec4 styleTexel(int si, int col) { return texelFetch(uStylePal, ivec2(col, si), 0); }
```

`FRAG_MAP`: replace the text from `float fwRow = fwidth(…` through the end of the `if (fi == 3) { … }` block with:
```glsl
float fwRow = fwidth(vWPos.y / 0.42), fwAisle = fwidth(vMUv.x / 17.0) * 17.0;   // before any branch
int si = int(vStyle + 0.5);
si = float(si) < uStyleRows ? si : 0;                   // stale tiles vs palette: unstyled, never garbage
bool styled = si > 0;
vec4 S0 = styleTexel(si, 0), S1 = styleTexel(si, 1), S2 = styleTexel(si, 2), S3 = styleTexel(si, 3), S4 = styleTexel(si, 4);
float S6a = styleTexel(si, 6).a;
if (isVenue) { alb = venueAlbedo(vi, vSeed, vMUv, vWPos, vWNormal, gravel, roofAlb, fwRow, fwAisle); win = 0.0; }
alb = mix(vec3(0.62, 0.6, 0.57), alb, uReady);
win *= uReady;
if (!isVenue && !styled) {
  alb *= mix(0.55, 1.0, smoothstep(0.0, 14.0, vWPos.y)); // ground contact
  alb *= 0.88 + 0.24 * vSeed;                            // per-building variation
}
if (fi == 3 && !styled) {                                // curtain glass: bronze-black, green, silver, blue
  float g = fract(vSeed * 3.7);
  vec3 tint = g < 0.28 ? vec3(0.30, 0.28, 0.27) : g < 0.5 ? vec3(0.62, 0.8, 0.74) : g < 0.78 ? vec3(0.86, 0.9, 0.98) : vec3(0.72, 0.8, 0.95);
  alb *= tint;
}
if (styled && !isRoof && !isParapet && !isVenue) {       // sourced colours (V2 · F1–F8)
  vec2 cf = fract(tuv * T.zw);
  float mull = 1.0 - step(0.06, cf.x) * step(cf.x, 0.94);
  float span = step(cf.y, 0.2);
  vec3 body = S4.a > S6a ? mix(S0.rgb, S4.rgb, smoothstep(S6a, S4.a, vWPos.y)) : S0.rgb;
  vec3 lookC = mix(mix(body, S3.rgb, span), S1.rgb, win);
  lookC = mix(lookC, S2.rgb, mull * (1.0 - span) * 0.9);
  float lum = dot(wallAlb, vec3(0.299, 0.587, 0.114));
  alb = lookC * clamp(lum / 0.45, 0.8, 1.2) * mix(0.55, 1.0, smoothstep(0.0, 14.0, vWPos.y));
}
if (styled && isVenue && vi == 16 && !isRoof) {          // hero-owned stadium and museum walls: recolour, keep the pattern
  float lum = dot(alb, vec3(0.299, 0.587, 0.114));
  alb = S0.rgb * clamp(0.55 + 0.9 * lum, 0.5, 1.3);
}
```
Only these lines replace the block, so the original `if (isVenue) {…}`, the `uReady` mix, `win *= uReady`, the ground-contact / variation block and the `fi == 3` tint are **replaced by this text**, not duplicated. `diffuseColor.rgb *= alb;` stays as the last line of `FRAG_MAP`.

`FRAG_ROUGH`: after the first line, add:
```glsl
if (styled && !isRoof && !isParapet) roughnessFactor = mix(S1.a, 0.06, win * 0.95);
```

`FRAG_METAL`: after the first line, add:
```glsl
if (styled && !isRoof && !isParapet) metalnessFactor = mix(S2.a, 0.9, win * 0.85);
```

`createFacadeMaterial`: change the key to `m.customProgramCacheKey = () => 'facade-v8'`.

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app -- facadeMaterial`
Expected: PASS (10 tests). This includes the unchanged `takes screen-space derivatives only in uniform control flow`: every `dFdx`/`fwidth` still precedes the first `if (isVenue)`, and the style code adds no derivatives.

- [ ] **Step 5: Commit the shader (before evaluating).**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add app/src/world/materials/facadeMaterial.js app/src/world/materials/__tests__/facadeMaterial.test.js
git commit -m "feat(app): façade shader paints sourced landmark colours and finish presets from the style palette (F2-F8)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Capture the "after" set (dev server + Playwright only).**

Run: `cd /Users/connorevans/Downloads/Chicago_open_world/app && EVAL_LABEL=after-f2-f8 EVAL_POSES=loop,willis,river,museum,hancock,streeterville,navypier,wrigley,aon npx playwright test e2e/eval-looks.spec.js --workers=1 2>&1 | grep EVAL > ../.superpowers/sdd/2026-09-29-v2-building-colours/after-f2-f8-drawcalls.log`
Expected: 27 PNGs in `shots/after-f2-f8/` and 27 EVAL lines.

- [ ] **Step 7: Evaluate and revert, one F item at a time.**

Open each before/after pair with the Read tool, for example `shots/before/loop-day.png` against `shots/after-f2-f8/loop-day.png`. Judge the item at its poses:

| F item | Heroes | Poses (day, dusk, night each) | Passes when |
|---|---|---|---|
| F2 | willis | `loop`, `willis` | Willis reads near-black with a bronze cast in the glass, and the antennas above the roof read white |
| F3 | aon | `aon`, `museum` | Aon reads white stone with a fine vertical window grain, not grey glass |
| F4 | trump | `river` | Trump reads silver-blue glass with bright mullion lines |
| F5 | wrigleybldg | `wrigley` | The Wrigley Building reads warm white terra cotta, whiter toward the top |
| F6 | tribune | `wrigley` | Tribune reads pale buff limestone |
| F7 | all other styled heroes | `streeterville`, `hancock`, `navypier`, `museum`, `loop`, `river` | Each hero's colour matches its `material` sentence |
| F8 | all | all poses | Finishes read as different materials (stone matte, glass and metal glossy). Draw calls in `after-f2-f8-drawcalls.log` are ≤ the same pose in `before-drawcalls.log` + 2 (the noise of averaging over frames) |

Revert a hero when any of these holds:
- (a) its colour contradicts its sourced `material`;
- (b) it shows moiré, banding or noise at the pose's distance;
- (c) it reads flat, with no visible window grid where the real building has one;
- (d) it clashes badly with its neighbours in a way the real skyline does not.

**To revert one hero:** set `"render": false` and `"note": "reverted V2: <reason>"` in its look, rebuild the world, and commit alone:
```bash
cd /Users/connorevans/Downloads/Chicago_open_world && npm run build:world --prefix pipeline >/dev/null && git add pipeline/data/heroes.json app/public/world && git commit -m "revert(look): <key> — <reason> (F10)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

**To revert F8 (finish presets) as a whole:** delete the two `styled` lines in `FRAG_ROUGH` and `FRAG_METAL` and the two roughness/metalness test cases, and commit alone as `revert(shader): finish presets (F8)`.

Ledger: one line per F item, in the form `V2 F<n>: KEEP|REVERT <keys> — <one-sentence reason>; shots after-f2-f8/<pose>-<time>.png`.

---

### Task 8: Crown night lighting (F9), then evaluate and revert

**Files:**
- Modify: `app/src/world/materials/facadeMaterial.js` (`FRAG_EMISSIVE`)
- Test: `app/src/world/materials/__tests__/facadeMaterial.test.js` (append)

**Interfaces:**
- Consumes:
  - the `si` and `styled` locals (Task 7);
  - palette column 5 (crown colour and intensity) and column 6 (fromM, toM, kind);
  - the `uNight` and `uLitBoost` uniforms.
- Produces:
  - kind 1 = flood: the lit wall reflects warm light, `diffuseColor × colour`, brighter toward `toM`.
  - kind 2 = lantern: the crown glows in its own light (translucent crown, lit antennas).

- [ ] **Step 1: Write the failing test.**

```js
  it('crown night light: flood reflects off the wall, lantern glows, both only at night inside the band', () => {
    const f = patchFacadeShader(std()).fragmentShader
    const em = f.slice(f.indexOf('crown and façade night lighting'))
    expect(em).toContain('if (styled && uNight > 0.001)')
    expect(em).toContain('vec4 C5 = styleTexel(si, 5), C6 = styleTexel(si, 6);')
    expect(em).toContain('float band = step(C6.r, vWPos.y) * step(vWPos.y, C6.g);')
    expect(em).toMatch(/C6\.b > 0\.5 && C6\.b < 1\.5\) totalEmissiveRadiance \+= diffuseColor\.rgb \* C5\.rgb/)
    expect(em).toMatch(/C6\.b > 1\.5\) totalEmissiveRadiance \+= C5\.rgb \* C5\.a \* band \* uNight \* uLitBoost/)
  })
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app -- facadeMaterial`
Expected: FAIL at `expect(em).toContain('if (styled && uNight > 0.001)')`. `indexOf` returns −1, so `em` is only the final character.

- [ ] **Step 3: Implement.** Prepend to `FRAG_EMISSIVE`, before `if (isVenue && uNight > 0.001) {`:

```glsl
if (styled && uNight > 0.001) {                          // crown and façade night lighting (F9)
  vec4 C5 = styleTexel(si, 5), C6 = styleTexel(si, 6);
  float band = step(C6.r, vWPos.y) * step(vWPos.y, C6.g);
  if (C6.b > 0.5 && C6.b < 1.5) totalEmissiveRadiance += diffuseColor.rgb * C5.rgb * C5.a * (0.35 + 0.65 * smoothstep(C6.r, C6.g, vWPos.y)) * band * uNight;
  else if (C6.b > 1.5) totalEmissiveRadiance += C5.rgb * C5.a * band * uNight * uLitBoost;
}
```

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app -- facadeMaterial`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add app/src/world/materials/facadeMaterial.js app/src/world/materials/__tests__/facadeMaterial.test.js
git commit -m "feat(app): crown night lighting — 311 S Wacker lantern, Wrigley Building floodlights, Tribune crown, 900 N Michigan lanterns, Willis and 875 antennas (F9)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Capture and evaluate.**

Run: `cd /Users/connorevans/Downloads/Chicago_open_world/app && EVAL_LABEL=after-f9 EVAL_POSES=s311,wrigley,loop,hancock,streeterville EVAL_TIMES=dusk,night npx playwright test e2e/eval-looks.spec.js --workers=1 2>&1 | grep EVAL > ../.superpowers/sdd/2026-09-29-v2-building-colours/after-f9-drawcalls.log`
Expected: 10 PNGs in `shots/after-f9/`.

Compare each against `shots/after-f2-f8/<pose>-<time>.png` (and `before/` for `s311`). Keep a crown light when all of these hold:
- the crown reads as a distinct lit feature at night;
- it is subtle at dusk;
- bloom stays within about 2× the crown's width.

Revert when it blows out, looks cartoonish, or lights the wrong part of the building (for example, the whole 311 shaft instead of its crown).

**To revert one crown:** set `"render": false` inside that look's `crownLight`, rebuild the world, and commit alone as `revert(crown): <key> — <reason> (F9)`.

**To adjust once instead of reverting:**
- If a light is merely too strong or too weak, change `intensity` once (halve it, or ×1.5), rebuild and recapture.
- Record `Ruling: <key> crown intensity <old>→<new> — cost if wrong: crown slightly off its real brightness`.
- If it still fails, revert.

Ledger: `V2 F9: KEEP|REVERT <key> — reason` for each of willis, hancock, 311wacker, 900michigan, wrigleybldg and tribune.

---

### Task 9: OSM `building:colour` / `building:material` for ordinary buildings (F11), then evaluate and revert

**Files:**
- Create: `pipeline/lib/osmLook.js`
- Create: `pipeline/data/osm-looks.json`
- Modify: `pipeline/build/build-world.js` (after `assignHeroStyles`)
- Test: `pipeline/tests/osmLook.test.js`

**Interfaces:**
- Consumes:
  - `hexToRgb` and `FINISHES` (Task 1);
  - `registry.add` (Task 3);
  - `b.tags` on OSM buildings (`pipeline/lib/osm.js` → `osmToBuilding`).
- Produces:
  - `NAMED_COLOURS: Record<string, '#rrggbb'>`: muted architectural equivalents of OSM colour words.
  - `MATERIAL_FINISH: Record<string, finish>`.
  - `parseOsmColour(v): '#rrggbb' | null`.
  - `quantizeHex(hex): '#rrggbb'`: channels snapped to multiples of 17, for dedupe.
  - `lookFromOsmTags(tags): Look | null`.
  - `osmStyleKey(look): string` (`osm:<finish>:<base>`).
  - `applyOsmLooks(buildings, registry, { enabled }): { styled: number, skipped: number }`. It skips heroes and anything with `facadeOverride` (sacred buildings, screens).

**Rulings recorded in this task:**
1. OSM colour words map to muted architectural hues, not CSS primaries. For example, `red` becomes brick `#8a3b30`, not `#ff0000`. Cost if wrong: tagged buildings are less saturated than their mappers meant.
2. `wood`, `plastic`, `timber_framing` and unknown materials are ignored, so the façade family stands. Cost if wrong: a few timber buildings keep a masonry look.
3. Colour without material means finish `concrete` (a painted or rendered wall). Cost if wrong: glossy painted metal reads matte.

- [ ] **Step 1: Write the failing test.**

```js
// pipeline/tests/osmLook.test.js
import { describe, it, expect } from 'vitest'
import { parseOsmColour, quantizeHex, lookFromOsmTags, osmStyleKey, applyOsmLooks } from '../lib/osmLook.js'
import { createStyleRegistry, MAX_STYLES } from '../lib/styles.js'
import { validateLook } from '../lib/looks.js'

describe('OSM looks (F11)', () => {
  it('parses hex (long and short) and colour words, case and spacing tolerant', () => {
    expect(parseOsmColour('#AABBCC')).toBe('#aabbcc')
    expect(parseOsmColour('#abc')).toBe('#aabbcc')
    expect(parseOsmColour(' Light Grey ')).toBe('#bdbdba')
    expect(parseOsmColour('red')).toBe('#8a3b30')
  })
  it('ignores junk colour and material tags', () => {
    for (const v of ['yes', '#ggg', 'red;white', '', undefined, 42]) expect(parseOsmColour(v)).toBeNull()
    expect(lookFromOsmTags({ 'building:material': 'wood' })).toBeNull()
    expect(lookFromOsmTags({ 'building:colour': 'yes', 'building:material': 'plastic' })).toBeNull()
    expect(lookFromOsmTags({})).toBeNull()
    expect(lookFromOsmTags(undefined)).toBeNull()
  })
  it('material alone picks a finish with its default colour; colour alone is a painted wall', () => {
    expect(lookFromOsmTags({ 'building:material': 'brick' })).toMatchObject({ finish: 'terracotta', base: quantizeHex('#8a4b3a') })
    expect(lookFromOsmTags({ 'building:material': 'glass' })).toMatchObject({ finish: 'glass' })
    expect(lookFromOsmTags({ 'building:colour': 'white' })).toMatchObject({ finish: 'concrete', base: quantizeHex('#f2f0ea') })
  })
  it('every produced look is a valid sourced look', () => {
    const l = lookFromOsmTags({ 'building:colour': '#336699', 'building:material': 'limestone' })
    expect(validateLook(l, 'osm')).toEqual([])
    expect(osmStyleKey(l)).toBe(`osm:limestone:${quantizeHex('#336699')}`)
  })
  it('quantizes colours so near-duplicates share a row', () => {
    expect(quantizeHex('#8a4b3a')).toBe(quantizeHex('#8b4c3b'))
    expect(quantizeHex('#ffffff')).toBe('#ffffff')
  })
  it('applyOsmLooks styles tagged plain buildings only, and never displaces hero rows', () => {
    const r = createStyleRegistry()
    r.add('willis', { material: 'black anodized aluminium', finish: 'metal', base: '#1c1b1a', glass: '#4a3a2c', mullion: '#121212', spandrel: '#1c1b1a', source: 'https://x.example' })
    const bs = [
      { tags: { 'building:colour': 'white' } },
      { tags: { 'building:colour': 'white' } },
      { hero: 'willis', styleIndex: 1, tags: { 'building:colour': 'red' } },
      { facadeOverride: 'sacred', tags: { 'building:material': 'brick' } },
      { tags: {} },
    ]
    expect(applyOsmLooks(bs, r, { enabled: true })).toEqual({ styled: 2, skipped: 0 })
    expect(bs[0].styleIndex).toBe(2); expect(bs[1].styleIndex).toBe(2)
    expect(bs[2].styleIndex).toBe(1); expect(bs[3].styleIndex).toBeUndefined(); expect(bs[4].styleIndex).toBeUndefined()
  })
  it('disabled (reverted) does nothing; a full palette counts skips', () => {
    const r = createStyleRegistry()
    const b = [{ tags: { 'building:colour': 'white' } }]
    expect(applyOsmLooks(b, r, { enabled: false })).toEqual({ styled: 0, skipped: 0 })
    for (let i = 1; i < MAX_STYLES; i++) r.add(`k${i}`, lookFromOsmTags({ 'building:colour': 'white' }))
    expect(applyOsmLooks([{ tags: { 'building:colour': '#123456' } }], r, { enabled: true })).toEqual({ styled: 0, skipped: 1 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline -- osmLook`
Expected: FAIL with the module `../lib/osmLook.js` not found.

- [ ] **Step 3: Write the implementation.**

```js
// pipeline/lib/osmLook.js — OpenStreetMap building:colour / building:material → a look for non-landmark buildings (F11).
import { hexToRgb } from './looks.js'

// OSM colour words describe a hue family, not a CSS primary: map them to muted architectural equivalents.
export const NAMED_COLOURS = {
  white: '#f2f0ea', black: '#1e1e1e', grey: '#8c8c8a', gray: '#8c8c8a', lightgrey: '#bdbdba', lightgray: '#bdbdba',
  darkgrey: '#555553', darkgray: '#555553', silver: '#b8bcc0', red: '#8a3b30', darkred: '#6b2a24', maroon: '#6b2a24',
  brown: '#6e4a36', tan: '#c2a883', beige: '#d8ccb0', cream: '#e8dfc8', yellow: '#d9c27a', orange: '#b8683c',
  pink: '#d4a59a', blue: '#5e7a95', lightblue: '#8fa9bf', green: '#5d7a5e', darkgreen: '#34503a',
}
export const MATERIAL_FINISH = {
  glass: 'glass', metal: 'metal', steel: 'metal', aluminium: 'metal', aluminum: 'metal', copper: 'metal',
  concrete: 'concrete', plaster: 'concrete', cement_block: 'concrete', stucco: 'concrete',
  brick: 'terracotta', terracotta: 'terracotta', clay: 'terracotta',
  stone: 'limestone', limestone: 'limestone', sandstone: 'limestone',
  granite: 'granite', marble: 'granite',
}
const DEFAULT_BASE = { glass: '#6f8394', metal: '#9aa0a5', concrete: '#bdb9b1', terracotta: '#8a4b3a', limestone: '#cdc3ad', granite: '#9c9a96' }
const SOURCE = ['https://wiki.openstreetmap.org/wiki/Key:building:colour', 'https://wiki.openstreetmap.org/wiki/Key:building:material']

export function parseOsmColour(v) {
  if (typeof v !== 'string') return null
  const s = v.trim().toLowerCase().replace(/[\s_-]/g, '')
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${[...s.slice(1)].map((c) => c + c).join('')}`
  return NAMED_COLOURS[s] ?? null
}

export const quantizeHex = (hex) => `#${hexToRgb(hex).map((c) => (Math.round(c / 17) * 17).toString(16).padStart(2, '0')).join('')}`

export function lookFromOsmTags(tags) {
  if (!tags) return null
  const matTag = String(tags['building:material'] ?? '').trim().toLowerCase()
  const finish = MATERIAL_FINISH[matTag] ?? null
  const colour = parseOsmColour(tags['building:colour'])
  if (!finish && !colour) return null
  const f = finish ?? 'concrete'
  const base = quantizeHex(colour ?? DEFAULT_BASE[f])
  return {
    material: `OSM building:colour=${tags['building:colour'] ?? '-'} building:material=${tags['building:material'] ?? '-'}`,
    finish: f, base, glass: f === 'glass' ? base : '#3a4046', mullion: base, spandrel: base, source: SOURCE,
  }
}

export const osmStyleKey = (look) => `osm:${look.finish}:${look.base}`

export function applyOsmLooks(buildings, registry, { enabled }) {
  let styled = 0, skipped = 0
  if (!enabled) return { styled, skipped }
  for (const b of buildings) {
    if (b.hero || b.facadeOverride) continue
    const look = lookFromOsmTags(b.tags)
    if (!look) continue
    const idx = registry.add(osmStyleKey(look), look)
    if (idx === 0) { skipped++; continue }
    b.styleIndex = idx; b.styleParts = []; styled++
  }
  return { styled, skipped }
}
```

```json
{ "enabled": true, "note": "F11: OSM building:colour / building:material on non-landmark buildings. Set enabled to false to revert (evaluate-and-revert).", "source": "OpenStreetMap contributors (ODbL)" }
```
(saved as `pipeline/data/osm-looks.json`)

In `pipeline/build/build-world.js`:
1. Add `import { applyOsmLooks } from '../lib/osmLook.js'`.
2. Right after `assignHeroStyles(buildings, heroes, styles)`, add:
   ```js
   const osmLooks = applyOsmLooks(buildings, styles, loadJson(join(ROOT, 'data', 'osm-looks.json')))
   log(`OSM-tagged looks: ${osmLooks.styled} buildings, ${osmLooks.skipped} over the palette cap`)
   ```

The per-tile code from Task 5 already passes `meshStyle(b)` for plain buildings, including the LOD1 simplified footprint.

- [ ] **Step 4: Run the tests to verify they pass, then capture the "before" shots on the current (Task 5) world.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline`
Expected: PASS (all).

Run: `cd /Users/connorevans/Downloads/Chicago_open_world/app && EVAL_LABEL=before-f11 EVAL_POSES=westloop,wrigleyville,pilsen,lincolnpark,loop npx playwright test e2e/eval-looks.spec.js --workers=1 2>&1 | grep EVAL > ../.superpowers/sdd/2026-09-29-v2-building-colours/before-f11-drawcalls.log`
Expected: 15 PNGs in `shots/before-f11/`. Stop the dev server before building.

Run: `npm run build:world --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline 2>&1 | grep -E "OSM-tagged|style palette|skyline"`
Expected: `OSM-tagged looks: <n> buildings, <m> over the palette cap`. Record n and m in the ledger. If m > 0, record `Ruling: <m> OSM looks past the 256-row cap stay unstyled — cost if wrong: a few tagged buildings keep family colours`.

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add pipeline/lib/osmLook.js pipeline/tests/osmLook.test.js pipeline/data/osm-looks.json pipeline/build/build-world.js
git commit -m "feat(pipeline): OSM building:colour / building:material looks for ordinary buildings, with a revert switch (F11)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git add app/public/world
git commit -m "build: world with OSM-tagged building looks" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Evaluate.**

Run: `cd /Users/connorevans/Downloads/Chicago_open_world/app && EVAL_LABEL=after-f11 EVAL_POSES=westloop,wrigleyville,pilsen,lincolnpark,loop npx playwright test e2e/eval-looks.spec.js --workers=1 2>&1 | grep EVAL > ../.superpowers/sdd/2026-09-29-v2-building-colours/after-f11-drawcalls.log`

Compare each `shots/after-f11/<pose>-<time>.png` against `shots/before-f11/<pose>-<time>.png` (Step 4). Keep F11 when tagged buildings read plausible and varied without speckling the city. Revert when any of these holds:
- random bright or odd hues dot the neighbourhoods;
- colours fight the façade textures;
- more than a handful of tags are obviously wrong.

**To revert:** set `"enabled": false` in `pipeline/data/osm-looks.json`, rebuild, and commit alone as `revert(looks): OSM-tagged colours — <reason> (F11)`.

Ledger: `V2 F11: KEEP|REVERT — reason; n buildings`.

---

### Task 10: End-of-milestone checklist (master plan)

**Files:**
- Modify: `README.md` (gallery, roadmap, badges)
- Create: `docs/screenshots/v2-willis-day.png`, `docs/screenshots/v2-wrigley-night.png`, `docs/screenshots/v2-aon-dusk.png`, `docs/screenshots/v2-crowns-night.png` (new files only)
- Modify: `app/e2e/hero-view.spec.js-snapshots/*` (only baselines V2 intentionally changed)

**Interfaces:**
- Consumes: everything above.
- Produces: a pushed milestone.

- [ ] **Step 1: Run both unit suites green.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline && npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app`
Expected: both PASS with 0 failures.

- [ ] **Step 2: Run the world build; the skyline assertion must pass.**

Run: `npm run build:world --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline 2>&1 | tail -5`
Expected: exit 0, with the `manifest written` line.

Check that `git status app/public/world` is clean: the build is deterministic since V1 · H4.

- [ ] **Step 3: e2e — regenerate only the baselines V2 intentionally changed, then get 3 consecutive green runs.**

The intentionally changed baselines are the views containing heroes: `streeterville-dusk`, `loop-day`, `river-dusk`, `museum-day`, `streeterville-night`, `hancock-dusk`, `willis-day`, `navypier-night`. `wrigleyville-day` and `westloop-dusk` change only if F11 was kept.

Run: `cd /Users/connorevans/Downloads/Chicago_open_world/app && npx playwright test e2e/hero-view.spec.js -g "streeterville|loop|river|museum|hancock|willis|navypier" --update-snapshots`

Then run `npx playwright test e2e/hero-view.spec.js` three times in a row.
Expected: 3 consecutive runs where all tests pass (the eval spec is skipped).

- [ ] **Step 4: Perf check at the wide Streeterville, wide Loop and densest views.**

Use the fixed perf poses from V1's ledger or helper. If V1 defined none, use:
- wide Streeterville `{ position: [4200, 900, -2600], target: [0, 60, -600] }`;
- wide Loop `{ position: [-3600, 1100, 2600], target: [0, 60, -300] }`;
- densest `BOOKMARKS.loop`.

For each pose:
1. Call `gotoPose(page, pose, 'dusk')`, then `drawCallsPerFrame(page, 2000)`.
2. Read fps with `page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => (++n, performance.now() - t0 < 2000 ? requestAnimationFrame(f) : r(n / 2)); requestAnimationFrame(f) }))`.

Run these from a scratch Playwright spec in the scratchpad, not committed.

Ledger: `V2 perf: <pose> calls=<n> (T0 before: <m>) tris=<t> fps=<f>`.
Expected: calls ≤ the T0 before-value + 2 at every pose (F8: no draw-call increase), and triangles unchanged.

- [ ] **Step 5: Final evaluate-and-revert audit, then the README.**

Check the ledger has a KEEP or REVERT line for each of F2, F3, F4, F5, F6, F7, F8, F9 (six crowns) and F11. Also check that every REVERT has its own `revert(` commit: run `git log --oneline | grep "revert("`.

F1 is satisfied by the looks test. F10 is this ledger.

Copy four kept after-shots to **new** files. Never touch existing images; `cp -n` refuses to overwrite:
```bash
cd /Users/connorevans/Downloads/Chicago_open_world
S=.superpowers/sdd/2026-09-29-v2-building-colours/shots
cp -n $S/after-f2-f8/willis-day.png docs/screenshots/v2-willis-day.png
cp -n $S/after-f9/wrigley-night.png docs/screenshots/v2-wrigley-night.png
cp -n $S/after-f2-f8/aon-dusk.png docs/screenshots/v2-aon-dusk.png
cp -n $S/after-f9/s311-night.png docs/screenshots/v2-crowns-night.png
git status --short docs/screenshots | grep -v '^??' && echo "EXISTING IMAGE CHANGED — STOP" || echo ok
```
Expected: `ok`. If a pictured item was reverted, pick the kept shot nearest to it instead.

In `README.md`, insert this section right after the "Phase 2.5 · Expanded city" gallery table in "How it came together". Do **not** alter any other image reference:

```markdown
### Vision pass · V2 · True colours — *every landmark in its real materials*

<table>
<tr>
<td width="50%"><img src="docs/screenshots/v2-willis-day.png" alt="V2 — Willis Tower in black anodized aluminium and bronze glass" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v2-aon-dusk.png" alt="V2 — Aon Center in white Mount Airy granite" width="100%"/></td>
</tr>
<tr>
<td><em>Willis in black anodized aluminium with bronze glass, its antennas white — colours now come from sourced descriptions, not a random tint.</em></td>
<td><em>Aon Center in white Mount Airy granite, the stone that replaced its Carrara marble in 1992–94.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v2-wrigley-night.png" alt="V2 — the Wrigley Building floodlit at night" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v2-crowns-night.png" alt="V2 — 311 South Wacker's lit crown" width="100%"/></td>
</tr>
<tr>
<td><em>The Wrigley Building's terra cotta under its floodlights, as it has been lit since 1921; Tribune's crown beside it.</em></td>
<td><em>Signature crowns at night — 311 South Wacker's lantern among the Loop's lights.</em></td>
</tr>
</table>
```

Roadmap: change the Vision pass line to `- [ ] **Vision pass** — ~~true building colours~~ ✓ (V2) · unified lake & river ✓ (V1) · CTA lines in true colours with glow + running trains, stadium game nights & crowds, detailed bridges & landmarks`. Keep the checkbox unchecked until V8.

Badges: change the `phase` badge to `phase-vision_pass_V2-45d8ff` and keep all the others.

- [ ] **Step 6: Commit and push.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add README.md docs/screenshots/v2-*.png app/e2e/hero-view.spec.js-snapshots
git commit -m "docs: V2 true colours — gallery, roadmap, badges; e2e baselines for recoloured landmarks" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push origin main
```
Expected: the push succeeds. Ledger: `V2: done, pushed <sha>`.

---

## Self-review notes (for the executor)

- **Spec coverage:**
  - F1: Tasks 1–2
  - F2–F7: Tasks 2 and 7
  - F8: Tasks 1 and 7 (presets, and zero-draw-call proof in Task 10 · Step 4)
  - F9: Tasks 2 and 8
  - F10: T0 capture, the eval steps in Tasks 7–9, and the Task 10 audit
  - F11: Task 9
  - The B.6 no-new-materials rule: Tasks 6–8 only touch `facadeMaterial.js`.
  - Master-plan tile format (`_STYLE`, `styles.json`, `style-palette.png`, manifest v5): Tasks 4–5.
- **Cross-plan contract:** V3 stations and V6 bridges and landmarks register looks with `createStyleRegistry().add(key, look)`, which appends rows after the heroes. They emit `meshStyle(b, part)` per vertex. The palette cap is 256 rows, heroes come first, and OSM looks fill whatever remains; V3 and V6 must add their rows *before* `applyOsmLooks`.
