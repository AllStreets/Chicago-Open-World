# V3 — Transit: Lines, Colours, Glow, Structure, Stations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start until the user has said "go ahead" and milestones V1 and V2 are pushed** (master plan order).

**Goal:** Every CTA and Metra line inside the world bounds is built from OSM route relations. Each line gets a faithful physical railway (steel bents, girders, ties, rails, third rail, Loop junction boxes, Metra embankments, subway portals), its stations (platforms, canopies, stairs, line-colour signs), and a restrained line-colour glow that reads from the street, from 150 m and from 1,000 m. A Transit dock button, a legend with a switch per line, a `T` key, a ⌘K command and a help-card line control it all. Backlog: C1, C2, C3, C4, C5, C10, C13.

**Architecture:**
- **Fetch.** `pipeline/fetch/fetch-world.js` gains two Overpass kinds: `routes` (route relations with their member tracks and stop nodes) and `stations` (stations and platforms).
- **Build.** `pipeline/build/build-transit.js` is called by `build-world.js`. It turns the kinds into four outputs:
  - ordered, graded, height-profiled paths per relation run;
  - per-tile mesh layers: `transit` (structure), `ties`, `stations`, `glow`, plus a coarse `glow` in LOD1 tiles and 2 km blocks;
  - `app/public/world/transit.json`: lines, routes, stations and stats;
  - the set of OSM way ids it draws, so the flat `rail` ground layer skips them.
- **App.** `TileContent` hands each tile's transit meshes to two module-level `THREE.BatchedMesh` pools (structure and glow), so the whole transit network costs 3 draw calls (structure, structure shadow, glow) however many tiles are loaded. The glow is a camera-facing ribbon expanded in the vertex shader, with distance compensation (2 px minimum) and intensity driven by `uNight`.

**Tech Stack:** Node 22 + Vitest 5 (pipeline), `@gltf-transform` 4.5 + meshoptimizer 1.3, earcut 3; Vite 8 + React 19 + React Three Fiber 9 + three 0.186 (`BatchedMesh`), zustand 5, Vitest + Testing Library (app), Playwright 1.63 (poses, perf).

**Spec:** `docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md`: Addendum B §B.1 (standing rules: the neon rule B.1.1 and budgets B.1.6) and §B.3 (Transit). Addendum A sets the tiles and bounds. The master plan `docs/superpowers/plans/2026-09-29-vision-master-plan.md` is binding. Backlog items: `docs/superpowers/backlog/2026-09-29-vision-backlog.md` §C.


> **Coordinator override (2026-09-29):**
> - The glow ships with **additive blending**, per spec B.3 and the user's "neon glow".
> - Normal alpha blending is only the fallback, and the evaluate-and-revert step of the glow task may choose it only if overlapping lines (the Loop) visibly blow out to white at night. That decision gets a ledger line.
> - The code's `blending` constant starts as `THREE.AdditiveBlending`.

## Global Constraints

- **Official colours (tested, verbatim B.3):**
  - CTA: Red `#c60c30`, Blue `#00a1de`, Brown `#62361b`, Green `#009b3a`, Orange `#f9461c`, Pink `#e27ea6`, Purple `#522398`, Yellow `#f9e300`.
  - Metra is a single blue, `#005596` (backlog default 3), at a dimmer glow (`glow: 0.55` against CTA `1.0`).
- **Neon rule (B.1.1):** the glow is at most ~15 % by day and full at dusk and night. It must be legible from street level, bird's-eye and every angle between, and never cartoonish.
- **Budgets (B.1.6):**
  - HIGH: ≤ 900 draw calls per frame including shadow and post passes, measured at the wide Streeterville and Loop poses.
  - ≤ 4 M triangles per frame; 60 fps on M-series; `app/public/world` ≤ 200 MB.
  - **Transit ≤ 12 calls in total.** V3 may spend at most 3 (structure, its shadow, glow); V4 gets the other 9.
  - Every new system has a LOW fallback.
- **Coordinates:** local metres, origin State & Madison (41.88203 N, −87.62784 W), +X east, −Z north, +Y up. Use `project(lon, lat)` from `shared/project.js`, never a new projection. Tiles are 500 m (`tileKeyFor`), blocks are 2 km (`blockKeyFor`).
- **Sources:** every colour, junction and required station carries a `source` in `pipeline/data/transit-lines.json` (backlog directive 8).
- **Tile format:** V3 adds layers `transit`, `ties`, `stations` and `glow` (LOD0), and `glow` in LOD1 tiles and blocks. It adds `transit.json` and sets manifest `version: 6`. The old `elevated` layer and the sidecar `columns` are removed.
- **Evaluate and revert (B.1.2):** fixed-pose shots (day, dusk, night) before and after. Anything unpleasing is reverted in its own commit, with a `Revert:` ledger line.
- **Human-first (B.1.4):** every control has a button, a ⌘K entry, a help-card line and a hint-bar entry. URL params are for tests only.
- **README:** never modify an existing image. New images are `docs/screenshots/v3-<subject>-<time>.png`, appended to "How it came together".
- **RAM discipline:** one heavy process at a time (world build, or dev server + Playwright). Close browsers when done.
- **Style:** no emojis anywhere; icons come from `react-icons/ri`; use the CHI tokens (`--accent`, `--panel`, `.hud-panel`, `.hud-label`, `.hud-kbd`).
- **Ledger:** `.superpowers/sdd/2026-09-29-v3-transit-lines/progress.md`. Record every `Ruling:`, `Keep:` and `Revert:` line there.
- **Push** to `origin main` at the end of the milestone (Task 17) only.

## Review Focus

1. **A route relation whose member ways are out of order or reversed, or that leaves and re-enters the world bounds.** The path must break into separate runs and never draw a straight jump across the city. Pinned in Task 4 (`chainRelation` "leaves and re-enters" test).
2. **Mixed and short grade tags:**
   - `railway=subway` + `bridge=yes` + `layer=2` means elevated;
   - `tunnel=yes` + `layer=-2` means subway;
   - a 300 m `railway=rail` stretch between two viaducts means embankment;
   - a 40 m CTA bridge on an at-grade line means at-grade.

   Track height must never jump: consecutive vertices differ by at most `RAMP_SLOPE × distance`. Pinned in Task 5 (`gradeOf`, `refineGrades`, `heightProfile` tests).
3. **Shared trackage with both directions of one line.** Brown in both directions plus Orange and Pink on one Loop way must give 3 lanes, not 4. Lanes count distinct lines, in catalog order. Pinned in Task 6 (`linesByWay` test).
4. **The glow at extreme distance, viewport and field of view, or with the camera on the ribbon.** It is never under 2 px and never NaN. Pinned in Task 13 (`glowHalfWidth` tests).
5. **An old world (manifest v5, no `transit.json`) or a failed `transit.json` fetch.** The app renders without transit and the Transit button is disabled with a plain tooltip. `T` does nothing, nothing throws, and no legend appears. Pinned in Task 15 ("without transit data" test).

---

## File Structure

```
pipeline/
  data/transit-lines.json            NEW  line catalog: ids, refs, names, official colours, glow, expectations, junctions, required stations, sources
  lib/sources.js                     MOD  overpassQuery('routes'|'stations'), FETCH_KINDS (moved from fetch-world.js)
  fetch/fetch-world.js               MOD  iterate FETCH_KINDS (adds routes, stations)
  lib/transit/lines.js               NEW  loadCatalog, lineOrder, operatorOf, lineIdFor
  lib/transit/polyline.js            NEW  segLen, cumulative, projectOnPolyline, resample, simplifyLine3, runsWhere
  lib/transit/chain.js               NEW  chainRelation, stopsOnRun, isTrackRole, isStopRole
  lib/transit/grade.js               NEW  gradeOf, refineGrades, heightProfile, RAIL_TOP_Y, AT_GRADE_Y, SUBWAY_Y, RAMP_SLOPE
  lib/transit/trackage.js            NEW  linesByWay, laneOf, planBents
  lib/transit/meshkit.js             NEW  KIND, hexToLinear, createMesh, tri, quad, box, frames, sweep, wall, chunksOf, cumulative3, toLayer, triCount
  lib/transit/structure.js           NEW  elevatedPiece, embankmentPiece, atGradePiece, portalPiece, catenary, bentsMesh, junctionBox
  lib/transit/glow.js                NEW  createGlow, glowPiece, toGlowLayer, GLOW_LIFT_M
  lib/transit/stations.js            NEW  stationFeatures, platformWays, linkStops, stationSite, platformsFor, stationMesh
  lib/transit/validate.js            NEW  transitStats, validateTransit, assertTransit
  lib/tilepack.js                    MOD  COLOR_0 support in writeTileGlb; concatLayers
  build/build-transit.js             NEW  loadTransitCache, buildTransit
  build/build-world.js               MOD  call buildTransit; drop elevated/columns; skip transit ways in flat rail; write layers, transit.json, manifest v6; size guard
  tests/transit-lines.test.js, transit-polyline.test.js, transit-chain.test.js, transit-grade.test.js,
  tests/transit-trackage.test.js, transit-meshkit.test.js, transit-structure.test.js, transit-glow.test.js,
  tests/transit-stations.test.js, transit-build.test.js, world-output.test.js        NEW
  tests/sources.test.js, tests/tilepack.test.js                                      MOD
app/src/
  transit/glowWidth.js               NEW  GLOW_DEFAULTS, worldPerPixel, glowHalfWidth, glowLevel, GLOW_GLSL
  transit/transitMaterials.js        NEW  glowUniforms, structureUniforms, patchGlowShader, patchStructureShader, createGlowMaterial, createStructureMaterial, setLineMask
  transit/pools.js                   NEW  POOL_OF, ATTRS, toPoolGeometry, createPool, getTransitPools, addTileLayer, removeTileLayer, resetTransitPools
  transit/TransitLayer.jsx           NEW  draws the pools, feeds viewport/fov uniforms, line mask, on/off
  transit/__tests__/glowWidth.test.js, transitMaterials.test.js, pools.test.js        NEW
  world/TileContent.jsx              MOD  transit layers → pools; ElevatedL removed
  world/ElevatedL.jsx                DEL  replaced by baked structure
  world/Scene.jsx                    MOD  load transit.json; <TransitLayer/>
  state/store.js                     MOD  transit, transitOn, hiddenLines + actions
  hud/TransitLegend.jsx              NEW  line legend with per-line switches, All / None, collapse
  hud/ControlDock.jsx                MOD  Transit button (pressed / disabled states)
  hud/ControlPills.jsx               MOD  T key
  hud/CommandPalette.jsx             MOD  "Transit lines on / off" command
  hud/HelpOverlay.jsx, hud/HintBar.jsx, hud/Hud.jsx, hud/Hud.css, hud/ControlDock.css   MOD
  hud/__tests__/transit.test.jsx     NEW
  lib/bookmarks.js, lib/places.js, lib/views.js   MOD  wellslake (named view), transit150, transit1000, northside (test poses)
app/e2e/
  transit-poses.spec.js              NEW  evaluate-and-revert captures (SHOTS_DIR), not baselines
  transit-perf.spec.js               NEW  draw calls / triangles / fps log (PERF_LOG)
```

## Screenshot poses (local metres)

Poses are defined as bookmarks in Task 1. Each is a `position` → `target` pair; altitude is `position[1]`, and the 30 m minimum altitude applies.

| Key | Position | Target | What it proves |
|---|---|---|---|
| `wellslake` | `[-420, 30, -335]` | `[-495, 7, -412]` | Street-level Tower 18 (Lake & Wells): bents, girders, ties, rails and the junction box (C4) |
| `transit150` | `[40, 150, 330]` | `[-175, 8, 86]` | 150 m over the Loop's SE corner: the multi-colour Loop ribbon (C2, C3) |
| `transit1000` | `[900, 1000, 1400]` | `[-175, 0, 86]` | 1,000 m: every line readable, width-compensated glow (C3) |
| `northside` | `[-1700, 400, -4270]` | `[-2080, 8, -4773]` | Fullerton: Red/Brown/Purple 4-track corridor and stations (C2, C10) |

Times: `day`, `dusk` and `night`, with the page clock fixed to `2026-09-30T08:15:00-05:00`. That is a weekday rush, so the V4 shots reuse these poses with trains.

**Evaluate-and-revert check** (Task 16 runs it for items S = structure, G = glow, A = girder accent, T = stations):

1. Open each before/after pair with the Read tool, one pose × time at a time.
2. An item **passes** only if all of these hold:
   - (a) every line's colour can be named at `wellslake`, `transit150` and `transit1000`, by day and by night;
   - (b) by day the glow reads as a tint on the track, and no glow pixel is brighter than the sunlit roofs next to it;
   - (c) at night the lines bloom, but the halo is at most ~3× the line width and no neighbouring façade is washed out;
   - (d) `wellslake` shows steel, meaning separate girders, bents and ties, not a flat ribbon;
   - (e) no track floats, runs through a building, or z-fights with the ground.
3. On a fail, make one tuning attempt with the item's knob:
   - G: `GLOW_DEFAULTS.dayLevel`, the night multiplier `2.2` in `patchGlowShader`, or `GLOW_DEFAULTS.baseHalfM`;
   - A: the accent emissive `1.4`;
   - S / T: colours in `COLOURS`.
4. Re-shoot. If it still fails, revert the item's commit with `git revert <sha>` in its own commit, `revert(v3): <item> — evaluate-and-revert`, and add a `Revert:` ledger line. Otherwise add `Keep: <item> — <one-line reason>`.

## Pre-flight (read before Task 1)

- **V1 and V2 changed `build-world.js`:** `_BLDG` uniqueness, `_CALM`, heightfield, `_STYLE`, manifest v4 → v5. Every edit below names its anchor text, not a line number. The line numbers quoted are from commit `c46c64c` and are hints only.
- **V1 interfaces used here (from `2026-09-29-v1-correctness-clearance-water.md`):**
  - `worldUrl(file, version)` in `app/src/lib/manifest.js` (every world fetch goes through it);
  - the e2e settle flags `window.__camRest`, `__skyRest`, `__tilesIdle` and `__hudReady`, which the two new specs wait on;
  - V1's flat-rail call `bufferPolyline(l, …, GROUND_Y.rail, { before, after })`, which Task 12 keeps exactly as V1 left it.
- **V2 interfaces used here (from `2026-09-29-v2-building-colours.md`):**
  - `pipeline/lib/looks.js` → `validateLook(look, key)`, `FINISHES`;
  - `pipeline/lib/styles.js` → `createStyleRegistry().add(key, look)`, the `styles` registry that `build-world.js` creates.
  - Station colours are two sourced V2 **looks** (`stationLooks.cta`, `stationLooks.metra` in `transit-lines.json`), validated with `validateLook` and registered as rows `station-cta` and `station-metra` of the shared palette, so they appear in `styles.json` and `style-palette.png` for review.
  - The station mesh takes its vertex colours from the look: `base` for platforms, `spandrel` for the canopy roof, `mullion` for posts and sign boards, and `glass` for the tower-cab glass.
- **Ruling (write it into the ledger at start):** station geometry is drawn by the transit structure pool (vertex colours taken from the registered V2 looks), not by the building layer's `_STYLE` lookup. That keeps transit within its 3-call budget — cost if wrong: editing a station row in `styles.json` needs a world rebuild to take effect, not just a reload.

---
### Task 1: Transit poses, capture scripts and BEFORE shots

**Files:**
- Modify: `app/src/lib/bookmarks.js` (add 4 poses to `BOOKMARKS`)
- Modify: `app/src/lib/places.js` (`VIEW_NAMES.wellslake`)
- Modify: `app/src/lib/views.js` (append `'wellslake'` to `VIEW_ORDER`)
- Create: `app/e2e/transit-poses.spec.js`, `app/e2e/transit-perf.spec.js`
- Test: `app/src/lib/__tests__/bookmarks.test.js`

**Interfaces:**
- Produces: `BOOKMARKS.wellslake | transit150 | transit1000 | northside` (`{ position:[x,y,z], target:[x,y,z] }`). Tasks 16 and 17 and the V4 plan use them.
- Produces: the env-driven specs, where `SHOTS_DIR=<abs dir> [POSES=a,b] [EXTRA=&k=v]` captures `<dir>/<view>-<time>.png`, and `PERF_LOG=<abs file>` appends one JSON line per pose.

- [ ] **Step 1: Write the failing test** — append to `app/src/lib/__tests__/bookmarks.test.js` inside `describe('bookmarks', …)`:

```js
  it('transit poses exist; Tower 18 is a named view people can step to', async () => {
    const { VIEW_NAMES } = await import('../places.js')
    const { VIEW_ORDER } = await import('../views.js')
    expect(BOOKMARKS.wellslake).toEqual({ position: [-420, 30, -335], target: [-495, 7, -412] })
    expect(BOOKMARKS.transit150).toEqual({ position: [40, 150, 330], target: [-175, 8, 86] })
    expect(BOOKMARKS.transit1000).toEqual({ position: [900, 1000, 1400], target: [-175, 0, 86] })
    expect(BOOKMARKS.northside).toEqual({ position: [-1700, 400, -4270], target: [-2080, 8, -4773] })
    expect(VIEW_NAMES.wellslake).toBe('Tower 18 — the Loop L junction')
    expect(VIEW_ORDER.at(-1)).toBe('wellslake')
    expect(VIEW_NAMES.transit150).toBeUndefined() // test-only poses stay out of ⌘K
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix app -- src/lib/__tests__/bookmarks.test.js`
Expected: FAIL — `expected undefined to deeply equal { position: [ -420, 30, -335 ], … }`

- [ ] **Step 3: Implement the poses and the capture scripts**

In `app/src/lib/bookmarks.js`, add inside `BOOKMARKS` after `willis`:

```js
  // Transit (V3): Tower 18 at Lake & Wells from street level, the Loop from 150 m and 1 km, Fullerton's 4-track corridor
  wellslake: { position: [-420, 30, -335], target: [-495, 7, -412] },
  transit150: { position: [40, 150, 330], target: [-175, 8, 86] },
  transit1000: { position: [900, 1000, 1400], target: [-175, 0, 86] },
  northside: { position: [-1700, 400, -4270], target: [-2080, 8, -4773] },
```

In `app/src/lib/places.js`, add to `VIEW_NAMES` after `soldierfield: 'Soldier Field',`:

```js
  wellslake: 'Tower 18 — the Loop L junction',
```

In `app/src/lib/views.js`, change `VIEW_ORDER` to end with `'soldierfield', 'wellslake']`.

Create `app/e2e/transit-poses.spec.js`:

```js
// app/e2e/transit-poses.spec.js — evaluate-and-revert captures (not baselines).
// SHOTS_DIR=/abs/dir [POSES=wellslake,transit150] [EXTRA='&follow=red'] npx playwright test e2e/transit-poses.spec.js
import { test } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const DIR = process.env.SHOTS_DIR
const POSES = (process.env.POSES ?? 'wellslake,transit150,transit1000,northside').split(',')
const TIMES = (process.env.TIMES ?? 'day,dusk,night').split(',')

test.skip(!DIR, 'set SHOTS_DIR to capture evaluate-and-revert shots')
for (const view of POSES) for (const time of TIMES) {
  test(`${view} @ ${time}`, async ({ page }) => {
    mkdirSync(DIR, { recursive: true })
    await page.clock.setFixedTime(new Date('2026-09-30T08:15:00-05:00')) // a weekday rush: V4 trains run
    await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
    await page.goto(`/?view=${view}&time=${time}${process.env.EXTRA ?? ''}`)
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
    // V1 settle flags (G5); in follow mode the camera never rests, so FOLLOW=1 skips __camRest
    await page.waitForFunction((follow) => (follow || window.__camRest === true) && window.__skyRest === true && window.__tilesIdle === true && window.__hudReady === true, !!process.env.FOLLOW, { timeout: 90_000 })
    await page.waitForTimeout(1500) // transit pools filled from the last tiles
    await page.screenshot({ path: `${DIR}/${view}-${time}.png` })
  })
}
```

Create `app/e2e/transit-perf.spec.js`:

```js
// app/e2e/transit-perf.spec.js — draw calls, triangles and fps at the budget poses; PERF_LOG=/abs/file.jsonl
import { test } from '@playwright/test'
import { appendFileSync } from 'node:fs'

const POSES = (process.env.POSES ?? 'streeterville,loop,transit1000').split(',')
test.skip(!process.env.PERF_LOG, 'set PERF_LOG to record perf')
for (const view of POSES) {
  test(`perf ${view}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-30T08:15:00-05:00'))
    await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
    await page.goto(`/?view=${view}&time=night&stats`)
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
    await page.waitForFunction(() => window.__camRest === true && window.__skyRest === true && window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 90_000 })
    await page.waitForTimeout(2000)
    const r = await page.evaluate(async () => {
      const gl = window.__gl
      const frame = () => new Promise((res) => requestAnimationFrame(() => res()))
      const measure = async () => {
        gl.info.autoReset = false
        const s = []
        for (let i = 0; i < 30; i++) { gl.info.reset(); await frame(); s.push([gl.info.render.calls, gl.info.render.triangles]) }
        gl.info.autoReset = true
        return { calls: Math.max(...s.map((x) => x[0])), tris: Math.max(...s.map((x) => x[1])) }
      }
      const all = await measure()
      let transit = null
      const pools = window.__transitPools // exposed by TransitLayer under ?stats (Task 14); absent before V3
      const extra = window.__trainMeshes ?? [] // exposed by Trains under ?stats (V4)
      if (pools) {
        const hide = [pools.structure.mesh, pools.glow.mesh, ...extra]
        const was = hide.map((m) => m.visible)
        hide.forEach((m) => { m.visible = false })
        const off = await measure()
        hide.forEach((m, i) => { m.visible = was[i] })
        transit = { calls: all.calls - off.calls, tris: all.tris - off.tris }
      }
      const t0 = performance.now()
      for (let i = 0; i < 120; i++) await frame()
      return { ...all, transit, fps: Math.round(120000 / (performance.now() - t0)) }
    })
    appendFileSync(process.env.PERF_LOG, JSON.stringify({ view, at: new Date().toISOString(), ...r }) + '\n')
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --prefix app -- src/lib/__tests__/bookmarks.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Capture the BEFORE shots and perf baseline** (heavy — nothing else running)

```bash
cd app
SHOTS_DIR="$PWD/../.superpowers/sdd/2026-09-29-v3-transit-lines/shots/before" npx playwright test e2e/transit-poses.spec.js --workers=1
PERF_LOG="$PWD/../.superpowers/sdd/2026-09-29-v3-transit-lines/perf-before.jsonl" npx playwright test e2e/transit-perf.spec.js --workers=1
cd ..
```

Expected: `12 passed` and `3 passed`. There are 12 PNGs in `shots/before/` and 3 JSON lines in `perf-before.jsonl`, each with `transit: null`. Copy the three perf lines into the ledger as `Perf before V3: …`, then close the browser and stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/bookmarks.js app/src/lib/places.js app/src/lib/views.js app/src/lib/__tests__/bookmarks.test.js app/e2e/transit-poses.spec.js app/e2e/transit-perf.spec.js
git commit -m "test(v3): transit poses (Tower 18 view, 150 m, 1 km, Fullerton), capture + perf specs"
```

---

### Task 2: Line catalog with official colours

**Files:**
- Create: `pipeline/data/transit-lines.json`
- Create: `pipeline/lib/transit/lines.js`
- Test: `pipeline/tests/transit-lines.test.js`

**Interfaces:**
- Produces: `loadCatalog(path?) → { sources, lines: Line[], junctions: Junction[], stationLooks: { cta: Look, metra: Look }, requiredStations: string[] }` (`Look` is V2's look block), where
  - `Line = { id, name, operator: 'cta'|'metra', refs: string[], names: string[], colour: '#rrggbb', glow: number, source: string, expect: { inBounds: boolean, minSegments?, minKm?, maxKm? } }`;
  - `Junction = { name, lat, lon, size, tower, source }`.
- Produces: `lineOrder(catalog) → string[]` (file order: 8 CTA lines, then 11 Metra lines). The glow's `_LINE` index is the position in this list.
- Produces: `operatorOf(tags) → 'cta'|'metra'|null` and `lineIdFor(tags, catalog) → string|null`.

- [ ] **Step 1: Write the failing test** — `pipeline/tests/transit-lines.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { loadCatalog, lineOrder, lineIdFor, operatorOf } from '../lib/transit/lines.js'

// Spec Addendum B.3 — copied verbatim; the catalog must match exactly.
const OFFICIAL = { red: '#c60c30', blue: '#00a1de', brown: '#62361b', green: '#009b3a', orange: '#f9461c', pink: '#e27ea6', purple: '#522398', yellow: '#f9e300' }
const METRA = ['up-n', 'up-nw', 'up-w', 'md-n', 'md-w', 'ncs', 'bnsf', 'hc', 'sws', 'ri', 'me']
const cat = loadCatalog()

describe('transit line catalog', () => {
  it('CTA lines carry the official colours, exactly', () => {
    for (const [id, hex] of Object.entries(OFFICIAL)) expect(cat.lines.find((l) => l.id === id)?.colour).toBe(hex)
  })
  it('every Metra line is the one Metra blue, at a dimmer glow than CTA', () => {
    for (const id of METRA) {
      const l = cat.lines.find((x) => x.id === id)
      expect(l.colour).toBe('#005596'); expect(l.operator).toBe('metra'); expect(l.glow).toBeLessThan(1)
    }
    for (const id of Object.keys(OFFICIAL)) expect(cat.lines.find((l) => l.id === id).glow).toBe(1)
  })
  it('19 unique lines in catalog order, each citing a source', () => {
    expect(cat.lines).toHaveLength(19)
    expect(new Set(cat.lines.map((l) => l.id)).size).toBe(19)
    expect(lineOrder(cat)).toEqual([...Object.keys(OFFICIAL), ...METRA])
    for (const l of cat.lines) expect(cat.sources[l.source]).toMatch(/https?:\/\//)
    for (const j of cat.junctions) expect(cat.sources[j.source]).toMatch(/https?:\/\//)
  })
  it('recognises CTA and Metra relations by ref or name, and nothing else', () => {
    expect(lineIdFor({ network: 'CTA', ref: 'Red' }, cat)).toBe('red')
    expect(lineIdFor({ operator: 'Chicago Transit Authority', name: 'CTA Brown Line: Kimball => Loop' }, cat)).toBe('brown')
    expect(lineIdFor({ network: 'CTA', name: 'Purple Line Express' }, cat)).toBe('purple')
    expect(lineIdFor({ network: 'Metra', ref: 'UP-NW' }, cat)).toBe('up-nw')
    expect(lineIdFor({ network: 'Metra', name: 'Union Pacific Northwest Line' }, cat)).toBe('up-nw')
    expect(lineIdFor({ network: 'Metra', name: 'Union Pacific North Line' }, cat)).toBe('up-n')
    expect(lineIdFor({ network: 'Metra', ref: 'MD W' }, cat)).toBe('md-w')
    expect(lineIdFor({ operator: 'Metra', name: 'Metra Electric District: Millennium => University Park' }, cat)).toBe('me')
    expect(lineIdFor({ network: 'Amtrak', ref: 'Hiawatha' }, cat)).toBeNull()
    expect(lineIdFor({ network: 'NICTD', name: 'South Shore Line' }, cat)).toBeNull()
    expect(operatorOf({ network: 'Metra' })).toBe('metra')
    expect(operatorOf({})).toBeNull()
  })
  it('station looks are valid V2 looks (shared palette rows station-cta / station-metra)', async () => {
    const { validateLook } = await import('../lib/looks.js')
    expect(validateLook(cat.stationLooks.cta, 'station-cta')).toEqual([])
    expect(validateLook(cat.stationLooks.metra, 'station-metra')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix pipeline -- transit-lines`
Expected: FAIL — `Failed to load url ../lib/transit/lines.js`

- [ ] **Step 3: Write the catalog and the matcher**

Create `pipeline/data/transit-lines.json`:

```json
{
  "sources": {
    "ctaColours": "CTA GTFS routes.txt route_color (C60C30, 00A1DE, 62361B, 009B3A, F9461C, E27EA6, 522398, F9E300) — https://www.transitchicago.com/downloads/sch_data/google_transit.zip",
    "metraColour": "Metra brand blue, single colour per spec Addendum B.3 / backlog default 3 — https://metra.com/",
    "loopJunctions": "Chicago-L.org, The Loop — junctions and interlocking towers — https://www.chicago-l.org/operations/lines/loop.html",
    "routes": "OpenStreetMap route relations (ODbL) via Overpass — https://www.openstreetmap.org/copyright"
  },
  "lines": [
    { "id": "red", "name": "Red Line", "operator": "cta", "refs": ["red"], "names": ["red line"], "colour": "#c60c30", "glow": 1.0, "source": "ctaColours", "expect": { "inBounds": true, "minSegments": 6, "minKm": 6, "maxKm": 90 } },
    { "id": "blue", "name": "Blue Line", "operator": "cta", "refs": ["blue"], "names": ["blue line"], "colour": "#00a1de", "glow": 1.0, "source": "ctaColours", "expect": { "inBounds": true, "minSegments": 6, "minKm": 6, "maxKm": 90 } },
    { "id": "brown", "name": "Brown Line", "operator": "cta", "refs": ["brown", "brn"], "names": ["brown line"], "colour": "#62361b", "glow": 1.0, "source": "ctaColours", "expect": { "inBounds": true, "minSegments": 6, "minKm": 6, "maxKm": 90 } },
    { "id": "green", "name": "Green Line", "operator": "cta", "refs": ["green", "g"], "names": ["green line"], "colour": "#009b3a", "glow": 1.0, "source": "ctaColours", "expect": { "inBounds": true, "minSegments": 6, "minKm": 6, "maxKm": 90 } },
    { "id": "orange", "name": "Orange Line", "operator": "cta", "refs": ["orange", "org"], "names": ["orange line"], "colour": "#f9461c", "glow": 1.0, "source": "ctaColours", "expect": { "inBounds": true, "minSegments": 6, "minKm": 6, "maxKm": 90 } },
    { "id": "pink", "name": "Pink Line", "operator": "cta", "refs": ["pink"], "names": ["pink line"], "colour": "#e27ea6", "glow": 1.0, "source": "ctaColours", "expect": { "inBounds": true, "minSegments": 6, "minKm": 6, "maxKm": 90 } },
    { "id": "purple", "name": "Purple Line", "operator": "cta", "refs": ["purple", "p"], "names": ["purple line"], "colour": "#522398", "glow": 1.0, "source": "ctaColours", "expect": { "inBounds": true, "minSegments": 6, "minKm": 6, "maxKm": 90 } },
    { "id": "yellow", "name": "Yellow Line", "operator": "cta", "refs": ["yellow", "y"], "names": ["yellow line"], "colour": "#f9e300", "glow": 1.0, "source": "ctaColours", "expect": { "inBounds": false } },
    { "id": "up-n", "name": "Union Pacific North", "operator": "metra", "refs": ["up-n", "upn"], "names": ["union pacific north"], "colour": "#005596", "glow": 0.55, "source": "metraColour", "expect": { "inBounds": true, "minSegments": 2, "minKm": 2, "maxKm": 70 } },
    { "id": "up-nw", "name": "Union Pacific Northwest", "operator": "metra", "refs": ["up-nw", "upnw"], "names": ["union pacific northwest"], "colour": "#005596", "glow": 0.55, "source": "metraColour", "expect": { "inBounds": true, "minSegments": 2, "minKm": 2, "maxKm": 70 } },
    { "id": "up-w", "name": "Union Pacific West", "operator": "metra", "refs": ["up-w", "upw"], "names": ["union pacific west"], "colour": "#005596", "glow": 0.55, "source": "metraColour", "expect": { "inBounds": true, "minSegments": 2, "minKm": 2, "maxKm": 70 } },
    { "id": "md-n", "name": "Milwaukee District North", "operator": "metra", "refs": ["md-n", "mdn"], "names": ["milwaukee district north"], "colour": "#005596", "glow": 0.55, "source": "metraColour", "expect": { "inBounds": true, "minSegments": 2, "minKm": 2, "maxKm": 70 } },
    { "id": "md-w", "name": "Milwaukee District West", "operator": "metra", "refs": ["md-w", "mdw"], "names": ["milwaukee district west"], "colour": "#005596", "glow": 0.55, "source": "metraColour", "expect": { "inBounds": true, "minSegments": 2, "minKm": 2, "maxKm": 70 } },
    { "id": "ncs", "name": "North Central Service", "operator": "metra", "refs": ["ncs"], "names": ["north central service"], "colour": "#005596", "glow": 0.55, "source": "metraColour", "expect": { "inBounds": true, "minSegments": 2, "minKm": 2, "maxKm": 70 } },
    { "id": "bnsf", "name": "BNSF", "operator": "metra", "refs": ["bnsf"], "names": ["bnsf"], "colour": "#005596", "glow": 0.55, "source": "metraColour", "expect": { "inBounds": true, "minSegments": 2, "minKm": 2, "maxKm": 70 } },
    { "id": "hc", "name": "Heritage Corridor", "operator": "metra", "refs": ["hc"], "names": ["heritage corridor"], "colour": "#005596", "glow": 0.55, "source": "metraColour", "expect": { "inBounds": true, "minSegments": 2, "minKm": 2, "maxKm": 70 } },
    { "id": "sws", "name": "SouthWest Service", "operator": "metra", "refs": ["sws"], "names": ["southwest service"], "colour": "#005596", "glow": 0.55, "source": "metraColour", "expect": { "inBounds": true, "minSegments": 2, "minKm": 2, "maxKm": 70 } },
    { "id": "ri", "name": "Rock Island", "operator": "metra", "refs": ["ri"], "names": ["rock island"], "colour": "#005596", "glow": 0.55, "source": "metraColour", "expect": { "inBounds": true, "minSegments": 2, "minKm": 2, "maxKm": 70 } },
    { "id": "me", "name": "Metra Electric", "operator": "metra", "refs": ["me"], "names": ["metra electric"], "colour": "#005596", "glow": 0.55, "source": "metraColour", "expect": { "inBounds": true, "minSegments": 2, "minKm": 2, "maxKm": 70 } }
  ],
  "junctions": [
    { "name": "Tower 18 (Lake & Wells)", "lat": 41.88574, "lon": -87.6338, "size": 36, "tower": true, "source": "loopJunctions" },
    { "name": "Lake & Wabash junction", "lat": 41.88574, "lon": -87.6261, "size": 27, "tower": false, "source": "loopJunctions" },
    { "name": "Tower 12 (Van Buren & Wabash)", "lat": 41.8768, "lon": -87.626, "size": 27, "tower": true, "source": "loopJunctions" },
    { "name": "Van Buren & Wells junction", "lat": 41.8768, "lon": -87.6337, "size": 27, "tower": false, "source": "loopJunctions" }
  ],
  "stationLooks": {
    "cta": { "finish": "concrete", "base": "#a7a39a", "glass": "#1c2630", "mullion": "#2b3137", "spandrel": "#3a4540", "material": "Cast-concrete platform deck, painted steel canopy and posts, dark-glass windbreaks (CTA elevated stations)", "source": ["https://en.wikipedia.org/wiki/Chicago_%22L%22", "https://www.transitchicago.com/"] },
    "metra": { "finish": "concrete", "base": "#b0aca3", "glass": "#223038", "mullion": "#394049", "spandrel": "#5b6770", "material": "Concrete low-level platforms with steel-frame shelters and grey standing-seam canopies (Metra city stations)", "source": ["https://en.wikipedia.org/wiki/Metra", "https://metra.com/"] }
  },
  "requiredStations": ["clark\\s*/\\s*lake", "merchandise mart", "washington\\s*/\\s*wells", "quincy", "adams\\s*/\\s*wabash", "roosevelt", "fullerton", "belmont", "sedgwick", "ogilvie", "union station"]
}
```

Create `pipeline/lib/transit/lines.js`:

```js
// pipeline/lib/transit/lines.js — which CTA / Metra line an OSM route relation is, from the sourced catalog.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'transit-lines.json')
export const loadCatalog = (path = DATA) => JSON.parse(readFileSync(path, 'utf8'))
export const lineOrder = (catalog) => catalog.lines.map((l) => l.id)

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-')

export function operatorOf(tags = {}) {
  const s = `${tags.network ?? ''};${tags.operator ?? ''}`
  if (/\bcta\b|chicago transit authority/i.test(s)) return 'cta'
  if (/\bmetra\b|northeast illinois regional commuter/i.test(s)) return 'metra'
  return null
}

export function lineIdFor(tags = {}, catalog) {
  const op = operatorOf(tags)
  if (!op) return null
  const lines = catalog.lines.filter((l) => l.operator === op)
  const ref = norm(tags.ref)
  if (ref) {
    const hit = lines.find((l) => l.refs.includes(ref))
    if (hit) return hit.id
  }
  // longest alias first, so "union pacific northwest" wins over "union pacific north"
  const name = String(tags.name ?? '').toLowerCase()
  const aliases = lines.flatMap((l) => l.names.map((n) => [n, l.id])).sort((a, b) => b[0].length - a[0].length)
  return aliases.find(([n]) => name.includes(n))?.[1] ?? null
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --prefix pipeline -- transit-lines`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/data/transit-lines.json pipeline/lib/transit/lines.js pipeline/tests/transit-lines.test.js
git commit -m "feat(transit): sourced line catalog — official CTA colours, one Metra blue, relation matcher"
```

---

### Task 3: Fetch route relations and stations

**Files:**
- Modify: `pipeline/lib/sources.js` (the `overpassQuery` body; add `FETCH_KINDS`)
- Modify: `pipeline/fetch/fetch-world.js:27` (`const KINDS = {…}` → import `FETCH_KINDS`)
- Test: `pipeline/tests/sources.test.js`

**Interfaces:**
- Produces: `overpassQuery('routes', bbox)`. The response holds relation elements (with `members` of `type`, `ref` and `role`), way elements (with `nodes`, `geometry` and `tags`) that are members of those relations inside the bbox, and node elements (with `lat`, `lon` and `tags`) that are members of those relations inside the bbox.
- Produces: `overpassQuery('stations', bbox)`: station nodes and ways, public-transport station nodes, and platform ways, all with `out geom`.
- Produces: `FETCH_KINDS: { [kind]: [nx, ny] }`, including `routes: [1, 1]` and `stations: [1, 1]`. The cache files are `pipeline/cache/world/osm-routes-0.json` and `osm-stations-0.json`.

- [ ] **Step 1: Write the failing test** — append to `pipeline/tests/sources.test.js`:

```js
import { FETCH_KINDS } from '../lib/sources.js'

describe('transit fetch kinds (V3)', () => {
  const bb = '(41.826,-87.695,41.952,-87.595)'
  it('routes: relations with their member tracks and stop nodes inside the world', () => {
    const q = overpassQuery('routes', WORLD_BBOX)
    expect(q).toContain(`relation["type"="route"]["route"~"^(subway|light_rail|train)$"]${bb}->.r;`)
    expect(q).toContain('.r out body;')
    expect(q).toContain(`way(r.r)${bb};out geom;`)
    expect(q).toContain(`node(r.r)${bb};out;`)
  })
  it('stations: station nodes/ways and train/subway platforms, with geometry', () => {
    const q = overpassQuery('stations', WORLD_BBOX)
    for (const f of ['node["railway"="station"]', 'way["railway"="station"]', 'node["public_transport"="station"]', 'way["railway"="platform"]', 'way["public_transport"="platform"]["train"="yes"]', 'way["public_transport"="platform"]["subway"="yes"]']) expect(q).toContain(f + bb)
    expect(q.endsWith('out geom;')).toBe(true)
  })
  it('the world fetch downloads both in one chunk each, next to the existing kinds', () => {
    expect(FETCH_KINDS.routes).toEqual([1, 1])
    expect(FETCH_KINDS.stations).toEqual([1, 1])
    expect(FETCH_KINDS.allbuildings).toEqual([6, 8])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix pipeline -- sources`
Expected: FAIL — `unknown overpass kind: routes`

- [ ] **Step 3: Implement**

In `pipeline/lib/sources.js`, replace the whole `export function overpassQuery(kind, { s, w, n, e }) { … }` with:

```js
// Transit (V3): route relations with their member tracks + stop nodes; stations and platforms.
const QUERIES = {
  routes: (bb) => `[out:json][timeout:180];relation["type"="route"]["route"~"^(subway|light_rail|train)$"]${bb}->.r;.r out body;way(r.r)${bb};out geom;node(r.r)${bb};out;`,
  stations: (bb) => `[out:json][timeout:180];(node["railway"="station"]${bb};way["railway"="station"]${bb};node["public_transport"="station"]${bb};way["railway"="platform"]${bb};way["public_transport"="platform"]["train"="yes"]${bb};way["public_transport"="platform"]["subway"="yes"]${bb};);out geom;`,
}

export function overpassQuery(kind, { s, w, n, e }) {
  const bb = `(${s},${w},${n},${e})`
  if (QUERIES[kind]) return QUERIES[kind](bb)
  const f = FILTERS[kind]
  if (!f) throw new Error(`unknown overpass kind: ${kind}`)
  return `[out:json][timeout:180];(${f.map((x) => x + bb + ';').join('')});${kind === 'trees' ? 'out;' : 'out geom;'}`
}

// chunk grid per kind for the world fetch (nx × ny sub-boxes)
export const FETCH_KINDS = { allbuildings: [6, 8], parts: [2, 3], water: [2, 3], parks: [2, 3], roads: [3, 4], trees: [2, 3], rail: [2, 3], stadiums: [1, 1], routes: [1, 1], stations: [1, 1] }
```

In `pipeline/fetch/fetch-world.js`:
- replace the import line with `import { WORLD_BBOX, USER_AGENT, chunkBBox, footprintsUrl, cityBoundaryUrl, overpassQuery, FETCH_KINDS } from '../lib/sources.js'`;
- delete the line `const KINDS = { allbuildings: [6, 8], … stadiums: [1, 1] }`;
- change `for (const [kind, [nx, ny]] of Object.entries(KINDS)) {` to `for (const [kind, [nx, ny]] of Object.entries(FETCH_KINDS)) {`.

(If V1 added its own kinds to `KINDS`, move them into `FETCH_KINDS` unchanged.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --prefix pipeline -- sources`
Expected: PASS (all `sources` tests, including 3 new)

- [ ] **Step 5: Download the two kinds** (network; about 1 minute; the existing chunk files are skipped)

Run: `npm run fetch:world --prefix pipeline`
Expected: the output includes `✓ osm-routes-0.json (N)` with N > 500, `✓ osm-stations-0.json (M)` with M > 150, then `world fetch done`. Log both counts in the ledger.

- [ ] **Step 6: Commit** (the cache is gitignored; only code is committed)

```bash
git add pipeline/lib/sources.js pipeline/fetch/fetch-world.js pipeline/tests/sources.test.js
git commit -m "feat(transit): Overpass kinds for route relations (tracks + stops) and stations/platforms"
```

---

### Task 4: Polylines and relation chaining

**Files:**
- Create: `pipeline/lib/transit/polyline.js`, `pipeline/lib/transit/chain.js`
- Test: `pipeline/tests/transit-polyline.test.js`, `pipeline/tests/transit-chain.test.js`

**Interfaces:**
- Produces (`polyline.js`, all on `[x, z]` points unless named `3`):
  - `segLen(a, b) → m`
  - `cumulative(pts) → number[]`
  - `projectOnPolyline(pts, p) → { s, d, i, t, pt:[x,z] }`
  - `resample(pts, segTags, maxSeg) → { pts, tags }`: `tags[i]` belongs to segment `i`.
  - `simplifyLine3(pts3, tol) → pts3`: Douglas–Peucker on the larger of plan offset and height error, so ramps survive.
  - `runsWhere(pts3, pred) → pts3[][]`: maximal runs of ≥ 2 consecutive points where `pred(p)` holds.
- Produces (`chain.js`):
  - `chainRelation(rel, ways: Map<id, { id, nodes:number[], pts:[x,z][], tags }>) → Run[]`, where `Run = { pts:[x,z][], segWay:number[], wayIds:number[] }`.
  - `stopsOnRun(run, stops:[{ id, name, pt }], maxD = 40) → [{ id, name, pt, s, d }]`, sorted by `s`.
  - `isTrackRole(role)` and `isStopRole(role)`; `MIN_RUN_M = 50`.

- [ ] **Step 1: Write the failing tests**

`pipeline/tests/transit-polyline.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { segLen, cumulative, projectOnPolyline, resample, simplifyLine3, runsWhere } from '../lib/transit/polyline.js'

describe('transit polylines', () => {
  it('arc length and projection', () => {
    expect(cumulative([[0, 0], [30, 40], [30, 50]])).toEqual([0, 50, 60])
    const p = projectOnPolyline([[0, 0], [100, 0], [100, 100]], [60, 7])
    expect(p.s).toBeCloseTo(60); expect(p.d).toBeCloseTo(7); expect(p.i).toBe(0); expect(p.pt).toEqual([60, 0])
    expect(projectOnPolyline([[0, 0], [100, 0], [100, 100]], [103, 50]).s).toBeCloseTo(150)
    expect(segLen([0, 0], [3, 4])).toBe(5)
  })
  it('resample splits long segments and carries each segment tag onto its pieces', () => {
    const r = resample([[0, 0], [30, 0], [35, 0]], ['a', 'b'], 12)
    expect(r.pts.map((p) => p[0])).toEqual([0, 10, 20, 30, 35])
    expect(r.tags).toEqual(['a', 'a', 'a', 'b'])
  })
  it('simplifyLine3 keeps corners and heights', () => {
    const s = simplifyLine3([[0, 7, 0], [50, 7, 0.5], [100, 7, 0], [100, 3, 100]], 2)
    expect(s).toEqual([[0, 7, 0], [100, 7, 0], [100, 3, 100]])
    expect(simplifyLine3([[0, 7.2, 0], [400, 7.2, 0], [800, -9, 0]], 3)).toHaveLength(3) // a portal ramp is kept
  })
  it('runsWhere returns maximal runs of 2+ points', () => {
    const r = runsWhere([[0, 1, 0], [1, 1, 0], [2, -9, 0], [3, 1, 0], [4, 1, 0], [5, 1, 0], [6, -9, 0], [7, 1, 0]], (p) => p[1] > 0)
    expect(r.map((x) => x.length)).toEqual([2, 3])
  })
})
```

`pipeline/tests/transit-chain.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { chainRelation, stopsOnRun, isStopRole, isTrackRole } from '../lib/transit/chain.js'

const W = (id, nodes, pts) => [id, { id, nodes, pts, tags: {} }]
const ways = new Map([
  W(1, [10, 11], [[0, 0], [100, 0]]),
  W(2, [12, 11], [[200, 0], [100, 0]]), // mapped against the direction of travel
  W(3, [12, 13], [[200, 0], [300, 0]]),
  W(4, [10, 14], [[0, 0], [-100, 0]]),
  W(5, [20, 21], [[0, 50], [30, 50]]), // 30 m: too short to be a run
])
const rel = (refs) => ({ members: refs.map((ref) => ({ type: 'way', ref, role: '' })) })
const maxStep = (run) => Math.max(...run.pts.slice(1).map((p, i) => Math.hypot(p[0] - run.pts[i][0], p[1] - run.pts[i][1])))

describe('chainRelation', () => {
  it('orders members into one continuous run, reversing ways mapped backwards', () => {
    const [r, ...rest] = chainRelation(rel([1, 2, 3]), ways)
    expect(rest).toHaveLength(0)
    expect(r.pts).toEqual([[0, 0], [100, 0], [200, 0], [300, 0]])
    expect(r.segWay).toEqual([1, 2, 3]); expect(r.wayIds).toEqual([1, 2, 3])
  })
  it('flips the first way when only its start touches the next member', () => {
    expect(chainRelation(rel([1, 4]), ways)[0].pts).toEqual([[100, 0], [0, 0], [-100, 0]])
  })
  it('a route that leaves and re-enters the world splits into runs — never a jump across the gap', () => {
    const runs = chainRelation(rel([1, 98, 97, 3]), ways) // 98 and 97 lie outside the bbox (no geometry)
    expect(runs).toHaveLength(2)
    for (const run of runs) expect(maxStep(run)).toBeLessThanOrEqual(100)
    expect(chainRelation(rel([1, 3]), ways)).toHaveLength(2) // present but not touching: still no bridge
  })
  it('drops runs shorter than 50 m and ignores non-track members', () => {
    expect(chainRelation(rel([5]), ways)).toEqual([])
    expect(chainRelation({ members: [{ type: 'way', ref: 1, role: 'platform' }, { type: 'node', ref: 7, role: 'stop' }] }, ways)).toEqual([])
    expect(isTrackRole('')).toBe(true); expect(isTrackRole('forward')).toBe(true); expect(isTrackRole('platform')).toBe(false)
    expect(isStopRole('stop_entry_only')).toBe(true); expect(isStopRole('platform')).toBe(false)
  })
})

describe('stopsOnRun', () => {
  it('projects stop nodes onto the run in travel order, dropping far ones', () => {
    const run = { pts: [[0, 0], [300, 0]] }
    const s = stopsOnRun(run, [{ id: 1, name: 'A', pt: [150, 10] }, { id: 2, name: 'B', pt: [50, -5] }, { id: 3, name: 'far', pt: [100, 90] }])
    expect(s.map((x) => [x.id, x.s])).toEqual([[2, 50], [1, 150]])
    expect(s[0].pt).toEqual([50, -5])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --prefix pipeline -- transit-polyline transit-chain`
Expected: FAIL — `Failed to load url ../lib/transit/polyline.js`

- [ ] **Step 3: Implement**

`pipeline/lib/transit/polyline.js`:

```js
// pipeline/lib/transit/polyline.js — arc length, projection, resampling and simplification on track polylines.
export const segLen = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1])

export function cumulative(pts) {
  const s = [0]
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + segLen(pts[i - 1], pts[i]))
  return s
}

export function projectOnPolyline(pts, p) {
  const cum = cumulative(pts)
  let best = { d: Infinity, s: 0, i: 0, t: 0, pt: pts[0] }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz
    const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)) : 0
    const q = [a[0] + dx * t, a[1] + dz * t], d = Math.hypot(p[0] - q[0], p[1] - q[1])
    if (d < best.d) best = { d, s: cum[i] + t * Math.sqrt(L2), i, t, pt: q }
  }
  return best
}

export function resample(pts, segTags, maxSeg) {
  const out = [pts[0]], tags = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(segLen(a, b) / maxSeg))
    for (let k = 1; k <= n; k++) { out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); tags.push(segTags[i]) }
  }
  return { pts: out, tags }
}

// deviation of p from chord a→b: the larger of the plan offset and the height error (ramps must survive)
function perp3(p, a, b) {
  const dx = b[0] - a[0], dz = b[2] - a[2], L2 = dx * dx + dz * dz
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / L2)) : 0
  return Math.max(Math.hypot(p[0] - (a[0] + dx * t), p[2] - (a[2] + dz * t)), Math.abs(p[1] - (a[1] + (b[1] - a[1]) * t)))
}
export function simplifyLine3(pts, tol) {
  if (pts.length < 3) return pts
  let maxD = 0, idx = 0
  for (let i = 1; i < pts.length - 1; i++) { const d = perp3(pts[i], pts[0], pts.at(-1)); if (d > maxD) { maxD = d; idx = i } }
  if (maxD <= tol) return [pts[0], pts.at(-1)]
  return [...simplifyLine3(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplifyLine3(pts.slice(idx), tol)]
}

export function runsWhere(pts, pred) {
  const out = []
  let cur = []
  for (const p of pts) {
    if (pred(p)) cur.push(p)
    else { if (cur.length >= 2) out.push(cur); cur = [] }
  }
  if (cur.length >= 2) out.push(cur)
  return out
}
```

`pipeline/lib/transit/chain.js`:

```js
// pipeline/lib/transit/chain.js — an OSM route relation → ordered runs of track (with the way under each segment) and its stops.
import { projectOnPolyline, cumulative } from './polyline.js'

const JOIN_M = 1
export const MIN_RUN_M = 50
export const isTrackRole = (role = '') => role === '' || role === 'forward' || role === 'backward'
export const isStopRole = (role = '') => /^stop(_entry_only|_exit_only)?$/.test(role)

const ends = (w) => [{ node: w.nodes?.[0], pt: w.pts[0] }, { node: w.nodes?.at(-1), pt: w.pts.at(-1) }]
const meet = (a, b) => (a.node != null && a.node === b.node) || Math.hypot(a.pt[0] - b.pt[0], a.pt[1] - b.pt[1]) < JOIN_M
const touches = (end, w) => ends(w).some((e) => meet(end, e))

export function chainRelation(rel, ways) {
  const list = rel.members.filter((m) => m.type === 'way' && isTrackRole(m.role)).map((m) => ways.get(m.ref))
  const runs = []
  let cur = null
  const finish = () => { if (cur && cumulative(cur.pts).at(-1) >= MIN_RUN_M) runs.push(cur); cur = null }
  const start = (w, next) => {
    const [a, b] = ends(w)
    const flip = !!next && !touches(b, next) && touches(a, next)
    cur = { pts: flip ? [...w.pts].reverse() : [...w.pts], segWay: Array(w.pts.length - 1).fill(w.id), wayIds: [w.id], end: flip ? a : b }
  }
  for (let i = 0; i < list.length; i++) {
    const w = list[i]
    if (!w || w.pts.length < 2) { finish(); continue } // outside the bbox: the run breaks here
    const n = list[i + 1], next = n && n.pts.length >= 2 ? n : null
    if (!cur) { start(w, next); continue }
    const [a, b] = ends(w)
    let pts, end
    if (meet(cur.end, a)) { pts = w.pts; end = b }
    else if (meet(cur.end, b)) { pts = [...w.pts].reverse(); end = a }
    else { finish(); start(w, next); continue }
    cur.pts.push(...pts.slice(1)); cur.segWay.push(...Array(pts.length - 1).fill(w.id)); cur.wayIds.push(w.id); cur.end = end
  }
  finish()
  return runs.map(({ pts, segWay, wayIds }) => ({ pts, segWay, wayIds }))
}

export function stopsOnRun(run, stops, maxD = 40) {
  return stops
    .map((st) => ({ st, pr: projectOnPolyline(run.pts, st.pt) }))
    .filter(({ pr }) => pr.d <= maxD)
    .sort((a, b) => a.pr.s - b.pr.s)
    .map(({ st, pr }) => ({ id: st.id, name: st.name, pt: st.pt, s: +pr.s.toFixed(1), d: +pr.d.toFixed(1) }))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --prefix pipeline -- transit-polyline transit-chain`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/transit/polyline.js pipeline/lib/transit/chain.js pipeline/tests/transit-polyline.test.js pipeline/tests/transit-chain.test.js
git commit -m "feat(transit): relation chaining into ordered runs; stops in travel order"
```

---

### Task 5: Grade classification and track heights

**Files:**
- Create: `pipeline/lib/transit/grade.js`
- Test: `pipeline/tests/transit-grade.test.js`

**Interfaces:**
- Consumes: `segLen` from `polyline.js`.
- Produces:
  - `gradeOf(tags) → 'elevated'|'embankment'|'at_grade'|'subway'`
  - `refineGrades(segs:[{ grade, len, rail }]) → grade[]`, where `rail` is true for `railway=rail` (Metra)
  - `targetY(grade, operator) → m`
  - `heightProfile(pts:[x,z][], segGrades, operator) → y[]`: rail-top heights, 2 decimals.
- Produces the constants: `RAIL_TOP_Y = { cta: 7.2, metra: 5.8 }`, `AT_GRADE_Y = 0.35`, `SUBWAY_Y = -9`, `RAMP_SLOPE = 0.04`, `SHORT_EMBANKMENT_GAP_M = 600`, `SHORT_BRIDGE_M = 120`.

- [ ] **Step 1: Write the failing test** — `pipeline/tests/transit-grade.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { gradeOf, refineGrades, heightProfile, RAIL_TOP_Y, AT_GRADE_Y, SUBWAY_Y, RAMP_SLOPE } from '../lib/transit/grade.js'

describe('gradeOf — OSM tags → grade', () => {
  it.each([
    [{ railway: 'subway', bridge: 'yes', layer: '2' }, 'elevated'],     // the L: CTA tracks are tagged railway=subway even when elevated
    [{ railway: 'subway', bridge: 'viaduct' }, 'elevated'],
    [{ railway: 'subway', layer: '1' }, 'elevated'],
    [{ railway: 'subway', tunnel: 'yes', layer: '-2' }, 'subway'],
    [{ railway: 'subway', location: 'underground' }, 'subway'],
    [{ railway: 'rail', layer: '-1' }, 'subway'],
    [{ railway: 'rail', embankment: 'yes' }, 'embankment'],
    [{ railway: 'rail', layer: '1' }, 'embankment'],
    [{ railway: 'rail', bridge: 'yes', layer: '1' }, 'elevated'],
    [{ railway: 'rail', cutting: 'yes' }, 'at_grade'],
    [{ railway: 'subway' }, 'at_grade'],                                 // Dan Ryan / Kennedy medians
    [{ railway: 'rail', bridge: 'no', tunnel: 'no' }, 'at_grade'],
  ])('%j → %s', (tags, grade) => expect(gradeOf(tags)).toBe(grade))
})

describe('refineGrades', () => {
  const seg = (grade, len, rail = true) => ({ grade, len, rail })
  it('a short at-grade gap between Metra viaducts is embankment; a long one stays at grade', () => {
    expect(refineGrades([seg('elevated', 30), seg('at_grade', 300), seg('elevated', 30)])).toEqual(['elevated', 'embankment', 'elevated'])
    expect(refineGrades([seg('elevated', 30), seg('at_grade', 900), seg('elevated', 30)])).toEqual(['elevated', 'at_grade', 'elevated'])
  })
  it('a 40 m bridge on an at-grade CTA line stays at grade (no 7 m hump)', () => {
    expect(refineGrades([seg('at_grade', 400, false), seg('elevated', 40, false), seg('at_grade', 400, false)])).toEqual(['at_grade', 'at_grade', 'at_grade'])
    expect(refineGrades([seg('elevated', 40, false), seg('at_grade', 400, false)])).toEqual(['at_grade', 'at_grade'])
    expect(refineGrades([seg('elevated', 400, false), seg('at_grade', 400, false)])).toEqual(['elevated', 'at_grade'])
  })
})

describe('heightProfile', () => {
  const line = Array.from({ length: 101 }, (_, i) => [i * 10, 0])
  const slopeOk = (pts, y) => pts.slice(1).every((p, i) => Math.abs(y[i + 1] - y[i]) <= RAMP_SLOPE * Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]) + 0.011)
  it('elevated → subway: holds the deck, then ramps down into the portal on the subway side', () => {
    const grades = [...Array(50).fill('elevated'), ...Array(50).fill('subway')]
    const y = heightProfile(line, grades, 'cta')
    expect(y[0]).toBe(RAIL_TOP_Y.cta); expect(y[50]).toBe(RAIL_TOP_Y.cta)
    expect(y[51]).toBeCloseTo(RAIL_TOP_Y.cta - 0.4, 2)
    expect(y[100]).toBe(SUBWAY_Y)
    expect(slopeOk(line, y)).toBe(true)
  })
  it('at grade next to elevated rises on the at-grade side; never jumps', () => {
    const grades = [...Array(50).fill('at_grade'), ...Array(50).fill('elevated')]
    const y = heightProfile(line, grades, 'metra')
    expect(y[0]).toBe(AT_GRADE_Y); expect(y[100]).toBe(RAIL_TOP_Y.metra)
    expect(y[40]).toBeCloseTo(RAIL_TOP_Y.metra - 0.04 * 100, 2)
    expect(slopeOk(line, y)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix pipeline -- transit-grade`
Expected: FAIL — `Failed to load url ../lib/transit/grade.js`

- [ ] **Step 3: Implement** — `pipeline/lib/transit/grade.js`:

```js
// pipeline/lib/transit/grade.js — elevated / embankment / at_grade / subway from OSM tags, and rail-top heights with ramps.
import { segLen } from './polyline.js'

export const RAIL_TOP_Y = { cta: 7.2, metra: 5.8 } // CTA deck ~23 ft over the street; Chicago rail embankments ~19 ft
export const AT_GRADE_Y = 0.35   // rail top on ballast
export const SUBWAY_Y = -9       // rail top in the tubes (hidden)
export const RAMP_SLOPE = 0.04   // 4 % inclines and portal ramps
export const SHORT_EMBANKMENT_GAP_M = 600
export const SHORT_BRIDGE_M = 120

const yes = (v) => v != null && v !== 'no'

export function gradeOf(tags = {}) {
  const layer = parseInt(tags.layer ?? '0', 10) || 0
  if (yes(tags.tunnel) || tags.location === 'underground' || (layer < 0 && !yes(tags.bridge))) return 'subway'
  if (yes(tags.bridge)) return 'elevated'
  if (yes(tags.embankment)) return 'embankment'
  if (yes(tags.cutting)) return 'at_grade'
  if (layer >= 1) return tags.railway === 'rail' ? 'embankment' : 'elevated'
  return 'at_grade'
}

export function refineGrades(segs) {
  const out = segs.map((s) => s.grade)
  const runs = []
  segs.forEach((s, i) => {
    const last = runs.at(-1)
    if (last && last.grade === s.grade) { last.end = i; last.len += s.len } else runs.push({ grade: s.grade, start: i, end: i, len: s.len })
  })
  const raised = (r) => r && (r.grade === 'elevated' || r.grade === 'embankment')
  const low = (r) => !r || r.grade === 'at_grade'
  const fill = (r, g) => { for (let i = r.start; i <= r.end; i++) out[i] = g }
  runs.forEach((r, k) => {
    const prev = runs[k - 1], next = runs[k + 1]
    // Chicago rail rides embankments between viaducts; OSM rarely tags the embankment itself
    if (segs[r.start].rail && r.grade === 'at_grade' && r.len <= SHORT_EMBANKMENT_GAP_M && raised(prev) && raised(next)) fill(r, 'embankment')
    // a short CTA bridge on a line that is otherwise at grade crosses a ditch or canal at track level
    // (Metra bridges are real rises between embankments, so the rule skips railway=rail)
    if (!segs[r.start].rail && r.grade === 'elevated' && r.len <= SHORT_BRIDGE_M && low(prev) && low(next) && (prev || next)) fill(r, 'at_grade')
  })
  return out
}

export const targetY = (grade, operator) => (grade === 'subway' ? SUBWAY_Y : grade === 'at_grade' ? AT_GRADE_Y : RAIL_TOP_Y[operator] ?? RAIL_TOP_Y.metra)

// each vertex takes the higher target of its two segments; a forward and a backward pass limit the slope,
// so ramps always fall on the lower side (the at-grade approach, or the subway portal)
export function heightProfile(pts, segGrades, operator) {
  const n = pts.length, y = Array(n).fill(-Infinity)
  segGrades.forEach((g, i) => { const t = targetY(g, operator); y[i] = Math.max(y[i], t); y[i + 1] = Math.max(y[i + 1], t) })
  for (let i = 1; i < n; i++) y[i] = Math.max(y[i], y[i - 1] - RAMP_SLOPE * segLen(pts[i - 1], pts[i]))
  for (let i = n - 2; i >= 0; i--) y[i] = Math.max(y[i], y[i + 1] - RAMP_SLOPE * segLen(pts[i], pts[i + 1]))
  return y.map((v) => +v.toFixed(2))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --prefix pipeline -- transit-grade`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/transit/grade.js pipeline/tests/transit-grade.test.js
git commit -m "feat(transit): grade classification from bridge/tunnel/layer/embankment tags; slope-limited rail heights"
```

---

### Task 6: Shared trackage and bent planning

**Files:**
- Create: `pipeline/lib/transit/trackage.js`
- Test: `pipeline/tests/transit-trackage.test.js`

**Interfaces:**
- Consumes: `buildGridIndex(items, cell, keyFn)` from `pipeline/lib/enrich.js`.
- Produces:
  - `linesByWay(routes:[{ line, wayIds }], order:string[]) → Map<wayId, lineId[]>`: distinct lines, in catalog order.
  - `laneOf(lines, id) → { lane, lanes }`: `lane = i − (k−1)/2`.
  - `planBents(pieces:[{ wayId, pts:[x,y,z][] }], opts?) → Bent[]`, where `Bent = { a:[x,z], b:[x,z], y, dir:[dx,dz] }` gives the two post feet, the rail-top height and the track direction. Paired tracks (parallel, 2.5–6.5 m apart) share one bent, planted by the lower way id.
- Produces the constants: `BENT_SPACING_M = 18`, `POST_OUTSET_M = 1.6`, `SINGLE_HALF_SPAN_M = 2.0`.

- [ ] **Step 1: Write the failing test** — `pipeline/tests/transit-trackage.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { linesByWay, laneOf, planBents } from '../lib/transit/trackage.js'

const ORDER = ['red', 'blue', 'brown', 'green', 'orange', 'pink', 'purple', 'yellow']

describe('shared trackage', () => {
  it('counts distinct lines per way, not relations: both Brown directions + Orange + Pink = 3 lanes', () => {
    const m = linesByWay([
      { line: 'pink', wayIds: [5] }, { line: 'brown', wayIds: [5, 6] }, { line: 'brown', wayIds: [7, 5] }, { line: 'orange', wayIds: [5] },
    ], ORDER)
    expect(m.get(5)).toEqual(['brown', 'orange', 'pink'])
    expect(m.get(6)).toEqual(['brown'])
    expect(laneOf(m.get(5), 'brown')).toEqual({ lane: -1, lanes: 3 })
    expect(laneOf(m.get(5), 'pink')).toEqual({ lane: 1, lanes: 3 })
    expect(laneOf(['red'], 'red')).toEqual({ lane: 0, lanes: 1 })
  })
})

describe('planBents', () => {
  const line = (id, z) => ({ wayId: id, pts: [[0, 7.2, z], [100, 7.2, z]] })
  it('paired tracks share one bent every 18 m, posts outside both tracks', () => {
    const b = planBents([line(1, 0), line(2, 3.8)])
    expect(b).toHaveLength(6) // 9, 27, 45, 63, 81, 99
    for (const x of b) {
      expect(Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1])).toBeCloseTo(3.8 + 2 * 1.6, 5)
      expect(x.y).toBeCloseTo(7.2)
    }
    expect(b.map((x) => Math.round(x.a[0]))).toEqual([9, 27, 45, 63, 81, 99])
  })
  it('a single track gets its own narrower bent; crossing tracks never pair', () => {
    expect(planBents([line(1, 0)]).map((x) => Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1]))).toEqual(Array(6).fill(4))
    const cross = { wayId: 2, pts: [[50, 7.2, -50], [50, 7.2, 50]] }
    const b = planBents([line(1, 0), cross])
    expect(b.every((x) => Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1]) === 4)).toBe(true)
  })
  it('spacing carries across vertices of a bending track', () => {
    const b = planBents([{ wayId: 1, pts: [[0, 7, 0], [10, 7, 0], [30, 7, 0]] }])
    expect(b.map((x) => Math.round(x.a[0]))).toEqual([9, 27])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix pipeline -- transit-trackage`
Expected: FAIL — `Failed to load url ../lib/transit/trackage.js`

- [ ] **Step 3: Implement** — `pipeline/lib/transit/trackage.js`:

```js
// pipeline/lib/transit/trackage.js — which lines share each track (side-by-side glow strips) and where the L's bents stand.
import { buildGridIndex } from '../enrich.js'

export function linesByWay(routes, order) {
  const m = new Map()
  for (const r of routes) for (const w of r.wayIds) { if (!m.has(w)) m.set(w, new Set()); m.get(w).add(r.line) }
  const rank = (id) => { const i = order.indexOf(id); return i < 0 ? 1e9 : i }
  return new Map([...m].map(([w, s]) => [w, [...s].sort((a, b) => rank(a) - rank(b))]))
}

export function laneOf(lines, id) {
  const k = lines.length, i = lines.indexOf(id)
  return { lane: i - (k - 1) / 2, lanes: k }
}

export const BENT_SPACING_M = 18
export const POST_OUTSET_M = 1.6
export const SINGLE_HALF_SPAN_M = 2.0
const PAIR_MIN = 2.5, PAIR_MAX = 6.5, PARALLEL = 0.95

function nearestParallel(idx, wayId, p, t) {
  let best = null
  for (const s of idx.query(p, 50)) {
    if (s.wayId === wayId) continue
    const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], L = Math.hypot(dx, dz)
    if (!L || Math.abs((dx / L) * t[0] + (dz / L) * t[1]) < PARALLEL) continue
    const f = Math.max(0, Math.min(1, ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dz) / (L * L)))
    const q = [s.a[0] + dx * f, s.a[1] + dz * f], d = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (d >= PAIR_MIN && d <= PAIR_MAX && (!best || d < best.d)) best = { wayId: s.wayId, pt: q, d }
  }
  return best
}

export function planBents(pieces, { spacing = BENT_SPACING_M, outset = POST_OUTSET_M, singleHalf = SINGLE_HALF_SPAN_M } = {}) {
  const segs = []
  for (const p of pieces) for (let i = 0; i < p.pts.length - 1; i++) {
    const a = p.pts[i], b = p.pts[i + 1]
    segs.push({ wayId: p.wayId, a: [a[0], a[2]], b: [b[0], b[2]], mid: [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2] })
  }
  const idx = buildGridIndex(segs, 50, (s) => s.mid)
  const bents = []
  for (const p of pieces) {
    let d = spacing / 2
    for (let i = 0; i < p.pts.length - 1; i++) {
      const A = p.pts[i], B = p.pts[i + 1], L = Math.hypot(B[0] - A[0], B[2] - A[2])
      if (L < 1e-6) continue
      const t = [(B[0] - A[0]) / L, (B[2] - A[2]) / L], side = [-t[1], t[0]]
      for (; d < L; d += spacing) {
        const f = d / L, x = A[0] + (B[0] - A[0]) * f, z = A[2] + (B[2] - A[2]) * f, y = A[1] + (B[1] - A[1]) * f
        const partner = nearestParallel(idx, p.wayId, [x, z], t)
        if (partner && partner.wayId < p.wayId) continue // the partner track plants this bent
        if (partner) {
          const u = [(partner.pt[0] - x) / partner.d, (partner.pt[1] - z) / partner.d]
          bents.push({ a: [x - u[0] * outset, z - u[1] * outset], b: [partner.pt[0] + u[0] * outset, partner.pt[1] + u[1] * outset], y, dir: t })
        } else {
          bents.push({ a: [x + side[0] * singleHalf, z + side[1] * singleHalf], b: [x - side[0] * singleHalf, z - side[1] * singleHalf], y, dir: t })
        }
      }
      d -= L
    }
  }
  return bents
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --prefix pipeline -- transit-trackage`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/transit/trackage.js pipeline/tests/transit-trackage.test.js
git commit -m "feat(transit): shared-trackage lanes by distinct line; shared bents for paired tracks"
```

---
### Task 7: Mesh kit, and a tile writer that keeps colours

**Files:**
- Create: `pipeline/lib/transit/meshkit.js`
- Modify: `pipeline/lib/tilepack.js`: in `writeTileGlb`, after the `TEXCOORD_0` line; add `concatLayers` at the end of the file
- Test: `pipeline/tests/transit-meshkit.test.js`, `pipeline/tests/tilepack.test.js`

**Interfaces:**
- Produces (`meshkit.js`, a triangle soup whose vertices carry position, normal, linear RGB colour, `kind` and `along`):
  - `KIND = { steel:0, concrete:1, ballast:2, rail:3, accent:4, roof:5, sign:6, glass:7, dark:8, stainless:9, door:10, headlight:11, tail:12, livery:13 }`. Kinds 9–13 are reserved for V4 rolling stock.
  - `hexToLinear('#rrggbb') → [r,g,b]`: sRGB to linear.
  - `createMesh() → { positions, normals, colors, kind, along }`
  - `tri(m, a, b, c, n, col, kind, al?)` and `quad(m, a, b, c, d, n, col, kind, al?)`. Winding is made counter-clockwise as seen from `n`.
  - `box(m, centre, ax, ay, az, half:[hx,hy,hz], col, kind, faces = BOX_FACES)`, with `BOX_FACES = ['top','bottom','front','back','left','right']`. `front` is `+ax`, `left` is `+az`.
  - `frames(pts3) → [{ t:[tx,tz], s:[sx,sz], miter }]`. `s = (−t_z, t_x)` is the right-hand side when travelling along `t`.
  - `sweep(m, pts3, profile:[[u,v]…], col, kind, { closed = true } = {})`. `u` runs across (right is +), `v` is up from the polyline. For closed loops the profile goes counter-clockwise. `along` is arc length from the piece start.
  - `wall(m, pts3, { u, thick, bottom:(p)=>y, top:(p)=>y }, col, kind)`
  - `chunksOf(pts3, len) → pts3[][]`
  - `cumulative3(pts3) → number[]`: XZ arc length.
  - `toLayer(m) → { positions, normals, colors, extra: { KIND, ALONG } }`
  - `triCount(m) → number`
  - `cross3`, `unit3`
- Produces (`tilepack.js`):
  - `writeTileGlb` writes `m.colors` as `COLOR_0` (VEC3) when present.
  - `concatLayers(list) → layer`: concatenates positions, normals, uvs, colors and every `extra` key.

- [ ] **Step 1: Write the failing tests**

`pipeline/tests/transit-meshkit.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { KIND, hexToLinear, createMesh, quad, box, sweep, chunksOf, cumulative3, toLayer, triCount } from '../lib/transit/meshkit.js'

const tris = (m) => Array.from({ length: m.positions.length / 9 }, (_, t) => [0, 1, 2].map((k) => m.positions.slice(t * 9 + k * 3, t * 9 + k * 3 + 3)))
const faceNormal = ([a, b, c]) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]] }

describe('meshkit', () => {
  it('sRGB hex → linear colour', () => {
    expect(hexToLinear('#ffffff')).toEqual([1, 1, 1]); expect(hexToLinear('#000000')).toEqual([0, 0, 0])
    expect(hexToLinear('#c60c30')[0]).toBeCloseTo(0.565, 2)
    expect(KIND.accent).toBe(4); expect(KIND.livery).toBe(13)
  })
  it('quads wind counter-clockwise as seen from their normal', () => {
    const m = createMesh()
    quad(m, [0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 1, 0], [1, 1, 1], KIND.steel)
    for (const t of tris(m)) expect(faceNormal(t)[1]).toBeGreaterThan(0)
  })
  it('a box has 6 outward faces', () => {
    const m = createMesh()
    box(m, [5, 5, 5], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 2, 3], [1, 1, 1], KIND.steel)
    expect(m.positions.length / 3).toBe(36)
    for (let i = 0; i < 36; i++) {
      const p = m.positions.slice(i * 3, i * 3 + 3), n = m.normals.slice(i * 3, i * 3 + 3)
      expect((p[0] - 5) * n[0] + (p[1] - 5) * n[1] + (p[2] - 5) * n[2]).toBeGreaterThan(0)
    }
  })
  it('sweep extrudes a profile along the track with outward normals and arc length', () => {
    const m = createMesh(), pts = [[0, 5, 0], [10, 5, 0], [20, 5, 0]] // eastbound: right-hand side is +z (south)
    sweep(m, pts, [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]], [1, 1, 1], KIND.steel)
    expect(m.positions.length / 3).toBe(4 * 2 * 6)
    const normals = new Set(Array.from({ length: m.normals.length / 3 }, (_, i) => m.normals.slice(i * 3, i * 3 + 3).map((v) => Math.round(v)).join(',')))
    expect(normals).toEqual(new Set(['0,-1,0', '0,0,1', '0,1,0', '0,0,-1']))
    expect(Math.max(...m.along)).toBe(20); expect(Math.min(...m.along)).toBe(0)
    expect(Math.max(...m.positions.filter((_, i) => i % 3 === 1))).toBe(6)
  })
  it('chunksOf cuts a polyline into equal pieces; cumulative3 measures in plan', () => {
    const c = chunksOf([[0, 0, 0], [50, 0, 0]], 20)
    expect(c.map((p) => cumulative3(p).at(-1))).toEqual([20, 20, 10])
    expect(cumulative3([[0, 0, 0], [3, 9, 4]])).toEqual([0, 5])
  })
  it('toLayer exposes KIND and ALONG per vertex; triCount counts triangles', () => {
    const m = createMesh()
    box(m, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1], [1, 1, 1], KIND.rail, ['top'])
    const l = toLayer(m)
    expect(l.extra.KIND).toEqual(new Float32Array(6).fill(3)); expect(l.extra.ALONG).toHaveLength(6)
    expect(l.colors).toHaveLength(18); expect(triCount(m)).toBe(2)
  })
})
```

Append to `pipeline/tests/tilepack.test.js`:

```js
describe('tilepack colours + concat (V3)', () => {
  it('COLOR_0 and large custom scalars survive compression', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 't-')), 'c.glb')
    const tri = { positions: [0, 0, 0, 10, 0, 0, 0, 0, 10], normals: [0, 1, 0, 0, 1, 0, 0, 1, 0], colors: [0.5, 0.25, 1, 0.5, 0.25, 1, 0.5, 0.25, 1], extra: { KIND: new Float32Array([4, 4, 4]), ALONG: new Float32Array([0, 350.5, 700.25]) } }
    await writeTileGlb(path, { transit: tri })
    await MeshoptDecoder.ready
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read(path)
    const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0]
    const c = prim.getAttribute('COLOR_0').getElement(0, [])
    expect(c[0]).toBeCloseTo(0.5, 2); expect(c[1]).toBeCloseTo(0.25, 2); expect(c[2]).toBeCloseTo(1, 2)
    expect(prim.getAttribute('_KIND').getScalar(0)).toBe(4)
    const along = [0, 1, 2].map((i) => prim.getAttribute('_ALONG').getScalar(i)).sort((a, b) => a - b)
    expect(along[2]).toBeCloseTo(700.25, 1)
  })
  it('concatLayers joins layers and their extras', async () => {
    const { concatLayers } = await import('../lib/tilepack.js')
    const a = { positions: [1, 2, 3], normals: [0, 1, 0], colors: [1, 0, 0], extra: { SIDE: new Float32Array([1]) } }
    const out = concatLayers([a, a])
    expect(out.positions).toEqual([1, 2, 3, 1, 2, 3]); expect(out.colors).toEqual([1, 0, 0, 1, 0, 0])
    expect(out.extra.SIDE).toEqual(new Float32Array([1, 1]))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --prefix pipeline -- transit-meshkit tilepack`
Expected: FAIL. `Failed to load url ../lib/transit/meshkit.js`, and in tilepack `Cannot read properties of null (reading 'getElement')` (no `COLOR_0`) and `concatLayers is not a function`.

- [ ] **Step 3: Implement**

`pipeline/lib/transit/meshkit.js`:

```js
// pipeline/lib/transit/meshkit.js — a tiny triangle-soup builder for track structure, stations and rolling stock.
// Every vertex carries position, normal, linear RGB colour, a material kind and along-track metres.
export const KIND = { steel: 0, concrete: 1, ballast: 2, rail: 3, accent: 4, roof: 5, sign: 6, glass: 7, dark: 8, stainless: 9, door: 10, headlight: 11, tail: 12, livery: 13 }

export function hexToLinear(hex) {
  const n = parseInt(hex.slice(1), 16)
  const c = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)]
}

export const createMesh = () => ({ positions: [], normals: [], colors: [], kind: [], along: [] })
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const unit3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] }
const neg = (v) => [-v[0], -v[1], -v[2]]

export function tri(m, a, b, c, n, col, kind, al = [0, 0, 0]) {
  if (dot(cross3(sub(b, a), sub(c, a)), n) < 0) { [b, c] = [c, b]; al = [al[0], al[2], al[1]] }
  for (const [p, s] of [[a, al[0]], [b, al[1]], [c, al[2]]]) {
    m.positions.push(p[0], p[1], p[2]); m.normals.push(n[0], n[1], n[2]); m.colors.push(col[0], col[1], col[2]); m.kind.push(kind); m.along.push(s)
  }
}
export function quad(m, a, b, c, d, n, col, kind, al = [0, 0, 0, 0]) {
  tri(m, a, b, c, n, col, kind, [al[0], al[1], al[2]])
  tri(m, a, c, d, n, col, kind, [al[0], al[2], al[3]])
}

export const BOX_FACES = ['top', 'bottom', 'front', 'back', 'left', 'right']
export function box(m, c, ax, ay, az, h, col, kind, faces = BOX_FACES) {
  const P = (sx, sy, sz) => [0, 1, 2].map((k) => c[k] + ax[k] * sx * h[0] + ay[k] * sy * h[1] + az[k] * sz * h[2])
  const F = {
    top: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1], ay],
    bottom: [[-1, -1, -1], [-1, -1, 1], [1, -1, 1], [1, -1, -1], neg(ay)],
    front: [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1], ax],
    back: [[-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, -1, 1], neg(ax)],
    left: [[-1, -1, 1], [-1, 1, 1], [1, 1, 1], [1, -1, 1], az],
    right: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], neg(az)],
  }
  for (const f of faces) { const [a, b, cc, d, n] = F[f]; quad(m, P(...a), P(...b), P(...cc), P(...d), n, col, kind) }
}

const unit2 = (v) => { const l = Math.hypot(v[0], v[1]); return l ? [v[0] / l, v[1] / l] : [NaN, NaN] }
export function frames(pts) {
  return pts.map((p, i) => {
    const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)]
    const d0 = i > 0 ? unit2([p[0] - prev[0], p[2] - prev[2]]) : unit2([next[0] - p[0], next[2] - p[2]])
    const d1 = i < pts.length - 1 ? unit2([next[0] - p[0], next[2] - p[2]]) : d0
    let t = unit2([d0[0] + d1[0], d0[1] + d1[1]])
    if (!Number.isFinite(t[0])) t = Number.isFinite(d1[0]) ? d1 : [1, 0]
    const s = [-t[1], t[0]]
    const cos = Math.abs(s[0] * -d1[1] + s[1] * d1[0])
    return { t, s, miter: Number.isFinite(cos) ? Math.min(2, 1 / Math.max(0.5, cos)) : 1 }
  })
}

export function cumulative3(pts) {
  const s = [0]
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]))
  return s
}

export function sweep(m, pts, profile, col, kind, { closed = true } = {}) {
  const F = frames(pts), S = cumulative3(pts)
  const ring = (i) => profile.map(([u, v]) => [pts[i][0] + F[i].s[0] * u * F[i].miter, pts[i][1] + v, pts[i][2] + F[i].s[1] * u * F[i].miter])
  const edges = closed ? profile.length : profile.length - 1
  let prev = ring(0)
  for (let i = 1; i < pts.length; i++) {
    const cur = ring(i)
    const t = unit2([pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]])
    if (!Number.isFinite(t[0])) { prev = cur; continue }
    const side = [-t[1], t[0]]
    for (let k = 0; k < edges; k++) {
      const k2 = (k + 1) % profile.length, [u0, v0] = profile[k], [u1, v1] = profile[k2]
      const nu = v1 - v0, nv = -(u1 - u0), L = Math.hypot(nu, nv) || 1 // outward for a counter-clockwise profile
      const n = [(side[0] * nu) / L, nv / L, (side[1] * nu) / L]
      quad(m, prev[k], prev[k2], cur[k2], cur[k], n, col, kind, [S[i - 1], S[i - 1], S[i], S[i]])
    }
    prev = cur
  }
}

export function wall(m, pts, { u, thick, bottom, top }, col, kind) {
  const F = frames(pts)
  const at = (i, du, y) => [pts[i][0] + F[i].s[0] * (u + du) * F[i].miter, y, pts[i][2] + F[i].s[1] * (u + du) * F[i].miter]
  for (let i = 0; i < pts.length - 1; i++) {
    const j = i + 1, t = unit2([pts[j][0] - pts[i][0], pts[j][2] - pts[i][2]])
    if (!Number.isFinite(t[0])) continue
    const n = [-t[1], 0, t[0]]
    const b0 = bottom(pts[i]), b1 = bottom(pts[j]), t0 = top(pts[i]), t1 = top(pts[j])
    if (t0 - b0 < 0.05 && t1 - b1 < 0.05) continue
    for (const e of [-1, 1]) quad(m, at(i, (e * thick) / 2, b0), at(j, (e * thick) / 2, b1), at(j, (e * thick) / 2, t1), at(i, (e * thick) / 2, t0), [n[0] * e, 0, n[2] * e], col, kind)
    quad(m, at(i, -thick / 2, t0), at(j, -thick / 2, t1), at(j, thick / 2, t1), at(i, thick / 2, t0), [0, 1, 0], col, kind)
  }
}

export function chunksOf(pts, len) {
  const out = []
  let cur = [pts[0]], acc = 0
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1]
    const b = pts[i]
    let seg = Math.hypot(b[0] - a[0], b[2] - a[2])
    while (seg > 0 && acc + seg >= len) {
      const f = (len - acc) / seg, p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
      cur.push(p); out.push(cur); cur = [p]; seg -= len - acc; acc = 0; a = p
    }
    if (seg > 0) { cur.push(b); acc += seg }
  }
  if (cur.length >= 2) out.push(cur)
  return out
}

export const toLayer = (m) => ({ positions: m.positions, normals: m.normals, colors: m.colors, extra: { KIND: new Float32Array(m.kind), ALONG: new Float32Array(m.along) } })
export const triCount = (m) => m.positions.length / 9
```

In `pipeline/lib/tilepack.js`, `writeTileGlb`: after `if (m.uvs?.length) prim.setAttribute('TEXCOORD_0', acc(m.uvs, 'VEC2'))` add:

```js
    if (m.colors?.length) prim.setAttribute('COLOR_0', acc(m.colors, 'VEC3'))
```

Append to `pipeline/lib/tilepack.js`:

```js
// Joins same-shaped layers (e.g. every tile's coarse glow into its 2 km block).
export function concatLayers(list) {
  const out = { positions: [], normals: [], uvs: [], colors: [], extra: {} }
  for (const m of list) {
    for (const k of ['positions', 'normals', 'uvs', 'colors']) for (const v of m[k] ?? []) out[k].push(v)
    for (const [k, arr] of Object.entries(m.extra ?? {})) { out.extra[k] ??= []; for (const v of arr) out.extra[k].push(v) }
  }
  out.extra = Object.fromEntries(Object.entries(out.extra).map(([k, v]) => [k, new Float32Array(v)]))
  return out
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --prefix pipeline -- transit-meshkit tilepack`
Expected: PASS (6 meshkit + all tilepack tests, including 2 new)

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/transit/meshkit.js pipeline/lib/tilepack.js pipeline/tests/transit-meshkit.test.js pipeline/tests/tilepack.test.js
git commit -m "feat(transit): mesh kit (box, sweep, wall, chunks) and COLOR_0 + concatLayers in the tile writer"
```

---

### Task 8: Track structure — the L's steel, Metra embankments, portals, catenary, Loop junctions

**Files:**
- Create: `pipeline/lib/transit/structure.js`
- Test: `pipeline/tests/transit-structure.test.js`

**Interfaces:**
- Consumes: `meshkit.js` (Task 7) and `AT_GRADE_Y` (Task 5).
- Produces (every `pts` argument is `[x, y_railTop, z][]`):
  - `elevatedPiece(m, ties, { pts, operator, colours })`:
    - CTA gets plate girders under each rail, ties (into `ties`), running rails, a third rail on the left, a walkway on the right, and a line-colour fascia on both outer girder webs that cycles every 20 m through `colours`.
    - Metra gets a through-girder viaduct with a ballasted deck.
  - `embankmentPiece(m, { pts, operator })`: ballast bed, rails, CTA third rail, concrete retaining walls down to y = 0.
  - `atGradePiece(m, { pts, operator })`: ballast bed and rails.
  - `portalPiece(m, { pts, operator })`: the U-channel trench walls (parapet at y = 1.0), bed, rails, and a headwall where the track passes below −4.6 m.
  - `catenary(m, { pts })`: masts every 60 m and the contact and messenger wires (for `electrified=contact_line`).
  - `bentsMesh(m, bents)`: the cross beam, two posts with base plates, and two knee braces per bent. A bent is skipped when its foot would be below 1.5 m.
  - `junctionBox(m, { x, z, y, size, tower })`: a 9 m grid of posts and cross girders, plus the interlocking tower cab when `tower`.
- Produces the constants `GAUGE_M`, `TIE`, `RAIL`, `GIRDER`, `DECK_DROP` (0.34), `GIRDER_BOTTOM` (1.74), `THIRD_RAIL`, `WALKWAY`, `BED`, `PORTAL`, `BENT`, `JUNCTION_GRID_M`, `ACCENT_CYCLE_M` and `COLOURS`.

Reference dimensions (all sourced to AREMA and CTA practice as summarised on Chicago-L.org's "Structure" pages, https://www.chicago-l.org/operations/structure.html):
- standard gauge 1,435 mm;
- 8 ft 6 in ties at 24 in centres;
- 115 lb rail about 0.16 m tall;
- plate girders about 1.4 m deep under each rail;
- top-contact third rail outside the gauge;
- bents every 18 m (60 ft);
- Loop clearance about 4.3–5 m under the girders.

- [ ] **Step 1: Write the failing test** — `pipeline/tests/transit-structure.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { createMesh, KIND } from '../lib/transit/meshkit.js'
import { elevatedPiece, embankmentPiece, atGradePiece, portalPiece, catenary, bentsMesh, junctionBox, GIRDER_BOTTOM, PORTAL } from '../lib/transit/structure.js'

const straight = (y, L = 100) => Array.from({ length: 11 }, (_, i) => [(i * L) / 10, y, 0])
const ys = (m) => m.positions.filter((_, i) => i % 3 === 1)
const xs = (m) => m.positions.filter((_, i) => i % 3 === 0)
const has = (m, k) => m.kind.includes(k)
const finite = (m) => m.positions.every(Number.isFinite) && m.normals.every(Number.isFinite)
const red = [0.565, 0.004, 0.03]

describe('track structure', () => {
  it('CTA elevated: girders, ties every 0.61 m, rails, third rail, walkway, line-colour fascia', () => {
    const m = createMesh(), ties = createMesh()
    elevatedPiece(m, ties, { pts: straight(7.2), operator: 'cta', colours: [red] })
    expect(ties.positions.length / 3 / 12).toBe(164) // top + bottom quad per tie; 100 m / 0.61 m
    for (const k of [KIND.steel, KIND.rail, KIND.accent]) expect(has(m, k)).toBe(true)
    expect(Math.max(...ys(m))).toBeCloseTo(7.25, 2) // third rail top
    expect(Math.min(...ys(m))).toBeCloseTo(7.2 - GIRDER_BOTTOM, 5)
    const i = m.kind.indexOf(KIND.accent)
    expect(m.colors.slice(i * 3, i * 3 + 3)).toEqual(red)
    expect(finite(m) && finite(ties)).toBe(true)
  })
  it('the fascia cycles through every line sharing the track', () => {
    const m = createMesh(), blue = [0, 0.35, 0.73]
    elevatedPiece(m, createMesh(), { pts: straight(7.2), operator: 'cta', colours: [red, blue] })
    const accents = new Set(m.kind.map((k, i) => (k === KIND.accent ? m.colors.slice(i * 3, i * 3 + 3).join() : null)).filter(Boolean))
    expect(accents.size).toBe(2)
  })
  it('Metra viaduct: through girders and a ballast deck, no ties', () => {
    const m = createMesh(), ties = createMesh()
    elevatedPiece(m, ties, { pts: straight(5.8), operator: 'metra', colours: [] })
    expect(ties.positions).toHaveLength(0); expect(has(m, KIND.ballast)).toBe(true)
    expect(Math.max(...ys(m))).toBeCloseTo(6.7, 2); expect(Math.min(...ys(m))).toBeCloseTo(4.5, 2)
  })
  it('embankment walls reach the ground; at-grade beds sit on it', () => {
    const e = createMesh(); embankmentPiece(e, { pts: straight(5.8), operator: 'metra' })
    expect(Math.min(...ys(e))).toBe(0); expect(has(e, KIND.concrete) && has(e, KIND.ballast)).toBe(true)
    const g = createMesh(); atGradePiece(g, { pts: straight(0.35), operator: 'cta' })
    expect(Math.max(...ys(g))).toBeCloseTo(0.4, 2); expect(Math.min(...ys(g))).toBeGreaterThanOrEqual(-0.12)
  })
  it('a subway portal: trench walls to the parapet and a headwall over the tunnel mouth', () => {
    const pts = Array.from({ length: 17 }, (_, i) => [i * 10, +(0.35 - i * 0.4).toFixed(2), 0]) // 0.35 → −6.05
    const m = createMesh(); portalPiece(m, { pts, operator: 'cta' })
    expect(Math.max(...ys(m))).toBeCloseTo(PORTAL.parapet, 5)
    // the headwall spans wider than the trench walls (|z| ≤ 2.8), right where the track passes −4.6 m (x = 130)
    const verts = Array.from({ length: m.positions.length / 3 }, (_, i) => m.positions.slice(i * 3, i * 3 + 3))
    expect(verts.some(([x, , z]) => Math.abs(z) > 2.9 && Math.abs(x - 130) < 0.5)).toBe(true)
  })
  it('catenary masts and wires ride above the track', () => {
    const m = createMesh(); catenary(m, { pts: straight(0.35, 200) })
    expect(Math.max(...ys(m))).toBeCloseTo(0.35 + 6.2, 1)
  })
  it('bents stand on the street and stop under the girders; low bents are skipped', () => {
    const m = createMesh()
    bentsMesh(m, [{ a: [0, -3.5], b: [0, 3.5], y: 7.2, dir: [1, 0] }])
    expect(Math.min(...ys(m))).toBe(0); expect(Math.max(...ys(m))).toBeCloseTo(7.2 - GIRDER_BOTTOM, 5)
    const low = createMesh(); bentsMesh(low, [{ a: [0, -3.5], b: [0, 3.5], y: 2, dir: [1, 0] }])
    expect(low.positions).toHaveLength(0)
  })
  it('a Loop junction box spans its square on a 9 m grid, with a tower cab', () => {
    const m = createMesh(); junctionBox(m, { x: 0, z: 0, y: 7.2, size: 36, tower: true })
    expect(Math.min(...xs(m))).toBeCloseTo(-18.3, 5); expect(Math.max(...xs(m))).toBeCloseTo(18.3, 5)
    expect(Math.min(...ys(m))).toBe(0); expect(Math.max(...ys(m))).toBeCloseTo(11.1, 5)
    expect(has(m, KIND.glass)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix pipeline -- transit-structure`
Expected: FAIL — `Failed to load url ../lib/transit/structure.js`

- [ ] **Step 3: Implement** — `pipeline/lib/transit/structure.js`:

```js
// pipeline/lib/transit/structure.js — the physical railway: the CTA's open-deck steel elevated, Metra viaducts and
// embankments, at-grade ballast, subway portals, catenary and the Loop junction boxes. pts = [x, railTopY, z][].
import { KIND, hexToLinear, box, sweep, wall, chunksOf, cumulative3, cross3, unit3 } from './meshkit.js'

export const GAUGE_M = 1.435
export const TIE = { spacing: 0.61, length: 2.59, width: 0.2, depth: 0.18 }
export const RAIL = { width: 0.07, height: 0.16 }
export const GIRDER = { offset: 0.8, depth: 1.4, width: 0.36 }
export const DECK_DROP = RAIL.height + TIE.depth             // rail top → girder top
export const GIRDER_BOTTOM = DECK_DROP + GIRDER.depth        // rail top → girder bottom
export const THIRD_RAIL = { offset: 1.45, width: 0.08 }
export const WALKWAY = { offset: 1.95, width: 0.75 }
export const BED = { top: 1.6, foot: 2.2, topV: -0.16, footV: -0.46 } // ballast half-widths and heights under rail top
export const PORTAL = { half: 2.6, thick: 0.4, parapet: 1.0, mouth: -4.6, clearance: 4.2 }
export const BENT = { post: 0.56, beamDepth: 0.7, beamWidth: 0.6, brace: 1.6, minFoot: 1.5 }
export const JUNCTION_GRID_M = 9
export const ACCENT_CYCLE_M = 20
export const CATENARY = { spacing: 60, mast: 6.2, arm: 5.9, contact: 5.5, messenger: 6.1, offset: 2.7 }
export const COLOURS = { steel: '#2f3a33', concrete: '#9c9a92', ballast: '#6d665e', rail: '#8a8580', tie: '#4a3a2c', dark: '#23272a', cab: '#3b4a3f', glass: '#1c2630' }
const C = Object.fromEntries(Object.entries(COLOURS).map(([k, v]) => [k, hexToLinear(v)]))
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1]
const rect = (u, w, v0, v1) => [[u - w / 2, v0], [u + w / 2, v0], [u + w / 2, v1], [u - w / 2, v1]]

function railsOn(m, pts, thirdRail) {
  for (const s of [-1, 1]) sweep(m, pts, rect((s * GAUGE_M) / 2, RAIL.width, -RAIL.height, 0), C.rail, KIND.rail)
  if (thirdRail) sweep(m, pts, rect(thirdRail * THIRD_RAIL.offset, THIRD_RAIL.width, -0.07, 0.05), C.steel, KIND.steel)
}

function tiesOn(ties, pts) {
  const S = cumulative3(pts), L = S.at(-1)
  let i = 0
  for (let d = TIE.spacing / 2; d < L; d += TIE.spacing) {
    while (i < pts.length - 2 && S[i + 1] < d) i++
    const a = pts[i], b = pts[i + 1], f = (d - S[i]) / (S[i + 1] - S[i] || 1)
    const c = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - RAIL.height - TIE.depth / 2, a[2] + (b[2] - a[2]) * f]
    const t = unit3([b[0] - a[0], 0, b[2] - a[2]]), side = [-t[2], 0, t[0]]
    box(ties, c, side, Y, t, [TIE.length / 2, TIE.depth / 2, TIE.width / 2], C.tie, KIND.concrete, ['top', 'bottom'])
  }
}

function bed(m, pts) {
  sweep(m, pts, [[BED.top, BED.topV], [-BED.top, BED.topV]], C.ballast, KIND.ballast, { closed: false }) // painted ties
  sweep(m, pts, [[BED.foot, BED.footV], [BED.top, BED.topV]], C.ballast, KIND.concrete, { closed: false })
  sweep(m, pts, [[-BED.top, BED.topV], [-BED.foot, BED.footV]], C.ballast, KIND.concrete, { closed: false })
}

// the line-colour accent: a thin lit strip on each outer girder web, cycling through the lines that share the track
function accent(m, pts, colours) {
  if (!colours.length) return
  chunksOf(pts, ACCENT_CYCLE_M).forEach((chunk, k) => {
    for (const s of [-1, 1]) sweep(m, chunk, rect(s * (GIRDER.offset + GIRDER.width / 2 + 0.006), 0.012, -DECK_DROP - 0.16, -DECK_DROP - 0.04), colours[k % colours.length], KIND.accent)
  })
}

export function elevatedPiece(m, ties, { pts, operator, colours = [] }) {
  if (operator === 'metra') { // Chicago's through-girder rail viaducts: girders beside the tracks, ballasted deck between
    for (const s of [-1, 1]) sweep(m, pts, rect(s * 2.25, 0.3, -1.3, 0.9), C.dark, KIND.steel)
    sweep(m, pts, rect(0, 4.2, -1.3, -0.5), C.concrete, KIND.concrete)
    bed(m, pts); railsOn(m, pts, 0)
    return
  }
  for (const s of [-1, 1]) sweep(m, pts, rect(s * GIRDER.offset, GIRDER.width, -GIRDER_BOTTOM, -DECK_DROP), C.steel, KIND.steel)
  tiesOn(ties, pts)
  railsOn(m, pts, -1)
  sweep(m, pts, rect(WALKWAY.offset, WALKWAY.width, -DECK_DROP - 0.06, -DECK_DROP), C.steel, KIND.steel)
  accent(m, pts, colours)
}

export function embankmentPiece(m, { pts, operator }) {
  bed(m, pts); railsOn(m, pts, operator === 'cta' ? -1 : 0)
  for (const s of [-1, 1]) wall(m, pts, { u: s * (BED.foot + 0.15), thick: 0.3, bottom: () => 0, top: (p) => p[1] + BED.footV }, C.concrete, KIND.concrete)
}

export function atGradePiece(m, { pts, operator }) {
  bed(m, pts); railsOn(m, pts, operator === 'cta' ? -1 : 0)
}

export function portalPiece(m, { pts, operator }) {
  bed(m, pts); railsOn(m, pts, operator === 'cta' ? -1 : 0)
  for (const s of [-1, 1]) wall(m, pts, { u: s * PORTAL.half, thick: PORTAL.thick, bottom: (p) => p[1] - 0.6, top: () => PORTAL.parapet }, C.concrete, KIND.concrete)
  // headwall over the tunnel mouth, at the first point deep enough to swallow a train
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]]
    if ((a[1] > PORTAL.mouth) === (b[1] > PORTAL.mouth)) continue
    const deep = a[1] <= PORTAL.mouth ? a : b, t = unit3([b[0] - a[0], 0, b[2] - a[2]]), side = [-t[2], 0, t[0]]
    const y0 = deep[1] + PORTAL.clearance, h = (PORTAL.parapet - y0) / 2
    if (h > 0.15) box(m, [deep[0], y0 + h, deep[2]], side, Y, t, [PORTAL.half + PORTAL.thick, h, 0.3], C.concrete, KIND.concrete)
    break
  }
}

export function catenary(m, { pts }) {
  const S = cumulative3(pts)
  let i = 0
  for (let d = CATENARY.spacing / 2; d < S.at(-1); d += CATENARY.spacing) {
    while (i < pts.length - 2 && S[i + 1] < d) i++
    const a = pts[i], b = pts[i + 1], f = (d - S[i]) / (S[i + 1] - S[i] || 1)
    const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
    const t = unit3([b[0] - a[0], 0, b[2] - a[2]]), side = [-t[2], 0, t[0]]
    const foot = [p[0] + side[0] * CATENARY.offset, p[2] + side[2] * CATENARY.offset], top = p[1] + CATENARY.mast
    box(m, [foot[0], top / 2, foot[1]], side, Y, t, [0.15, top / 2, 0.15], C.dark, KIND.steel, ['front', 'back', 'left', 'right', 'top'])
    box(m, [p[0] + side[0] * (CATENARY.offset / 2), p[1] + CATENARY.arm, p[2] + side[2] * (CATENARY.offset / 2)], side, Y, t, [CATENARY.offset / 2 + 0.15, 0.06, 0.06], C.dark, KIND.steel)
  }
  sweep(m, pts, rect(0, 0.04, CATENARY.contact, CATENARY.contact + 0.04), C.dark, KIND.dark)
  sweep(m, pts, rect(0, 0.04, CATENARY.messenger, CATENARY.messenger + 0.04), C.dark, KIND.dark)
}

export function bentsMesh(m, bents) {
  for (const { a, b, y, dir } of bents) {
    const yTop = y - GIRDER_BOTTOM, yFoot = yTop - BENT.beamDepth
    if (yFoot < BENT.minFoot) continue // ramp foot: the girders rest on the ground there
    const ax = unit3([b[0] - a[0], 0, b[1] - a[1]]), az = [dir[0], 0, dir[1]]
    const span = Math.hypot(b[0] - a[0], b[1] - a[1])
    box(m, [(a[0] + b[0]) / 2, yTop - BENT.beamDepth / 2, (a[1] + b[1]) / 2], ax, Y, az, [span / 2 + BENT.post / 2, BENT.beamDepth / 2, BENT.beamWidth / 2], C.steel, KIND.steel)
    for (const [p, s] of [[a, 1], [b, -1]]) {
      box(m, [p[0], yFoot / 2, p[1]], ax, Y, az, [BENT.post / 2, yFoot / 2, BENT.post / 2], C.steel, KIND.steel, ['front', 'back', 'left', 'right'])
      box(m, [p[0], 0.05, p[1]], ax, Y, az, [0.45, 0.05, 0.45], C.concrete, KIND.concrete, ['top', 'front', 'back', 'left', 'right'])
      const lo = [p[0] + ax[0] * s * 0.1, yFoot - BENT.brace, p[1] + ax[2] * s * 0.1], hi = [p[0] + ax[0] * s * BENT.brace, yFoot, p[1] + ax[2] * s * BENT.brace]
      const d = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], len = Math.hypot(...d), dx = unit3(d)
      box(m, [lo[0] + d[0] / 2, lo[1] + d[1] / 2, lo[2] + d[2] / 2], dx, cross3(az, dx), az, [len / 2, 0.1, 0.1], C.steel, KIND.steel)
    }
  }
}

export function junctionBox(m, { x, z, y, size, tower }) {
  const n = Math.floor(size / JUNCTION_GRID_M), h = (n * JUNCTION_GRID_M) / 2
  const yTop = y - GIRDER_BOTTOM, yFoot = yTop - BENT.beamDepth
  for (let i = 0; i <= n; i++) for (let k = 0; k <= n; k++) {
    box(m, [x - h + i * JUNCTION_GRID_M, yFoot / 2, z - h + k * JUNCTION_GRID_M], X, Y, Z, [BENT.post / 2, yFoot / 2, BENT.post / 2], C.steel, KIND.steel, ['front', 'back', 'left', 'right'])
  }
  for (let i = 0; i <= n; i++) {
    const o = -h + i * JUNCTION_GRID_M
    box(m, [x, yTop - BENT.beamDepth / 2, z + o], X, Y, Z, [h + 0.3, BENT.beamDepth / 2, 0.3], C.steel, KIND.steel)
    box(m, [x + o, yTop - BENT.beamDepth / 2, z], X, Y, Z, [0.3, BENT.beamDepth / 2, h + 0.3], C.steel, KIND.steel)
  }
  if (tower) { // the interlocking tower cab rides the structure at one corner of the junction
    const c = [x + h - 2.5, y + 1.8, z - h + 2.5]
    box(m, c, X, Y, Z, [2.0, 1.8, 1.6], C.cab, KIND.steel)
    box(m, [c[0], c[1] + 0.3, c[2]], X, Y, Z, [2.02, 0.55, 1.62], C.glass, KIND.glass, ['front', 'back', 'left', 'right'])
    box(m, [c[0], c[1] + 1.95, c[2]], X, Y, Z, [2.3, 0.15, 1.9], C.dark, KIND.steel)
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --prefix pipeline -- transit-structure`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/transit/structure.js pipeline/tests/transit-structure.test.js
git commit -m "feat(transit): CTA steel elevated (girders, ties, rails, third rail, bents), Metra viaducts/embankments, portals, catenary, Loop junctions"
```

---

### Task 9: Glow ribbons

**Files:**
- Create: `pipeline/lib/transit/glow.js`
- Test: `pipeline/tests/transit-glow.test.js`

**Interfaces:**
- Produces: `createGlow() → { positions, normals, colors, side, lane, lanes, line, intensity, ghost }`.
- Produces: `glowPiece(g, pts3, { lines, colours, lineIndex, intensity })`. For each line it emits one ribbon of 2 vertices per point (`side` −1 / +1), lifted `GLOW_LIFT_M` above rail top.
  - `NORMAL` holds the unit 3D track **tangent**; the shader expands the ribbon across it, towards the camera.
  - `lane = j − (k−1)/2` and `lanes = k` place shared-trackage strips side by side.
  - `line` is the catalog index, and `ghost = 1` where rail top is below −1 m (subway: hidden unless Scan asks).
- Produces: `toGlowLayer(g) → { positions, normals, colors, extra: { SIDE, LANE, LANES, LINE, INTENSITY, GHOST } }`.
- Produces the constants `GLOW_LIFT_M = 0.45` and `GHOST_BELOW_Y = -1`.

- [ ] **Step 1: Write the failing test** — `pipeline/tests/transit-glow.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { createGlow, glowPiece, toGlowLayer, GLOW_LIFT_M } from '../lib/transit/glow.js'
import { hexToLinear } from '../lib/transit/meshkit.js'

const LOOP = { lines: ['brown', 'orange', 'pink'], colours: ['#62361b', '#f9461c', '#e27ea6'].map(hexToLinear), lineIndex: [2, 4, 5], intensity: [1, 1, 1] }

describe('glow ribbons', () => {
  it('one ribbon per line, side by side on shared trackage', () => {
    const g = createGlow()
    glowPiece(g, [[0, 7.2, 0], [10, 7.2, 0], [20, 7.2, 5]], LOOP)
    expect(g.positions.length / 3).toBe(3 * 2 * 6)
    expect(new Set(g.lane)).toEqual(new Set([-1, 0, 1])); expect(new Set(g.lanes)).toEqual(new Set([3]))
    expect(new Set(g.side)).toEqual(new Set([-1, 1])); expect(new Set(g.line)).toEqual(new Set([2, 4, 5]))
    expect(new Set(g.positions.filter((_, i) => i % 3 === 1))).toEqual(new Set([7.2 + GLOW_LIFT_M]))
    for (let i = 0; i < g.normals.length; i += 3) expect(Math.hypot(g.normals[i], g.normals[i + 1], g.normals[i + 2])).toBeCloseTo(1, 6)
    const brown = g.line.indexOf(2)
    expect(g.colors.slice(brown * 3, brown * 3 + 3)).toEqual(hexToLinear('#62361b'))
  })
  it('subway track is ghosted; the layer exposes every attribute per vertex', () => {
    const g = createGlow()
    glowPiece(g, [[0, -9, 0], [50, -9, 0]], { lines: ['red'], colours: [hexToLinear('#c60c30')], lineIndex: [0], intensity: [1] })
    expect(new Set(g.ghost)).toEqual(new Set([1]))
    const l = toGlowLayer(g)
    for (const k of ['SIDE', 'LANE', 'LANES', 'LINE', 'INTENSITY', 'GHOST']) expect(l.extra[k]).toHaveLength(6)
    expect(l.colors).toHaveLength(18)
  })
  it('does nothing for a piece with no lines or one point', () => {
    const g = createGlow()
    glowPiece(g, [[0, 7, 0]], LOOP); glowPiece(g, [[0, 7, 0], [9, 7, 0]], { lines: [], colours: [], lineIndex: [], intensity: [] })
    expect(g.positions).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix pipeline -- transit-glow`
Expected: FAIL — `Failed to load url ../lib/transit/glow.js`

- [ ] **Step 3: Implement** — `pipeline/lib/transit/glow.js`:

```js
// pipeline/lib/transit/glow.js — the line-colour glow: one ribbon per line per track, expanded towards the camera
// in the vertex shader (app/src/transit/transitMaterials.js). NORMAL carries the track tangent.
export const GLOW_LIFT_M = 0.45 // above rail top: clear of the rails, below a passing train's floor
export const GHOST_BELOW_Y = -1

export const createGlow = () => ({ positions: [], normals: [], colors: [], side: [], lane: [], lanes: [], line: [], intensity: [], ghost: [] })

function tangents(pts) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d) || 1
    return [d[0] / l, d[1] / l, d[2] / l]
  })
}

export function glowPiece(g, pts, { lines, colours, lineIndex, intensity }) {
  if (pts.length < 2 || !lines.length) return
  const T = tangents(pts), k = lines.length
  const vert = (i, side, j) => {
    const p = pts[i]
    g.positions.push(p[0], p[1] + GLOW_LIFT_M, p[2]); g.normals.push(...T[i]); g.colors.push(...colours[j])
    g.side.push(side); g.lane.push(j - (k - 1) / 2); g.lanes.push(k); g.line.push(lineIndex[j]); g.intensity.push(intensity[j])
    g.ghost.push(p[1] < GHOST_BELOW_Y ? 1 : 0)
  }
  for (let j = 0; j < k; j++) for (let i = 0; i < pts.length - 1; i++) {
    for (const [a, s] of [[i, -1], [i, 1], [i + 1, 1], [i, -1], [i + 1, 1], [i + 1, -1]]) vert(a, s, j)
  }
}

const F = (a) => new Float32Array(a)
export const toGlowLayer = (g) => ({
  positions: g.positions, normals: g.normals, colors: g.colors,
  extra: { SIDE: F(g.side), LANE: F(g.lane), LANES: F(g.lanes), LINE: F(g.line), INTENSITY: F(g.intensity), GHOST: F(g.ghost) },
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --prefix pipeline -- transit-glow`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/transit/glow.js pipeline/tests/transit-glow.test.js
git commit -m "feat(transit): line-colour glow ribbons with shared-trackage lanes and subway ghosting"
```

---

### Task 10: Stations

**Files:**
- Create: `pipeline/lib/transit/stations.js`
- Test: `pipeline/tests/transit-stations.test.js`

**Interfaces:**
- Consumes: `operatorOf` (Task 2), `projectOnPolyline` (Task 4), and `box`, `quad`, `tri`, `hexToLinear`, `KIND`, `cross3`, `unit3` (Task 7). Also `earcut` and `project`.
- Produces:
  - `normName(name) → string`: lower-case, without a trailing " station" or bracketed text.
  - `stationFeatures(elements) → Station[]`, with `Station = { id:'st-n123', key, name, pt:[x,z], operator:'cta'|'metra'|null, osm:string[] }`. Rail stations only, merged when they share a name within 150 m and have a compatible operator; the first element's id wins.
  - `platformWays(elements) → [{ outline:[x,z][], centre:[x,z] }]`
  - `linkStops(stations, routes, order)`: sets `stop.station` (id or null) on every route stop, and `station.lines` (catalog order).
  - `stationSite(st, pieces:[{ operator, lines, pts3, pts2, grades }]) → { p:[x,z], y, t:[tx,tz], side:[sx,sz], grade, operator, partner:number|null } | null`, within 120 m; a piece carrying one of the station's lines is preferred.
  - `platformsFor(st, site, platforms) → [{ outline }]`: OSM platforms within 90 m, else synthetic side platforms.
  - `stationMesh(m, st, site, platforms, { look, lineColours })`. `look` is a V2 look (see Pre-flight): `base` for platforms, `spandrel` for the canopy, `mullion` for posts and boards.
- Produces the constants `PLATFORM = { cta: { length:128, width:3.7, aboveRail:1.07 }, metra: { length:240, width:4.0, aboveRail:0.25 } }`, `PLATFORM_EDGE_M = 1.55`, `CANOPY`, `STEP` and `SIGN`.

Reference: CTA 8-car trains are 8 × 14.63 m = 117 m, so platforms are about 128 m (420 ft). The CTA car floor is about 1.07 m above rail top. Metra city platforms are low-level, and Metra Electric's are high-level; the low value is used. Sources: https://en.wikipedia.org/wiki/Chicago_%22L%22 and https://en.wikipedia.org/wiki/Metra.

- [ ] **Step 1: Write the failing test** — `pipeline/tests/transit-stations.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { project, unproject } from '../../shared/project.js'
import { createMesh, KIND, hexToLinear } from '../lib/transit/meshkit.js'
import { stationFeatures, linkStops, stationSite, platformsFor, stationMesh, normName } from '../lib/transit/stations.js'

const ll = (x, z) => { const [lon, lat] = unproject(x, z); return { lon, lat } }
const look = { finish: 'concrete', base: '#a7a39a', glass: '#1c2630', mullion: '#2b3137', spandrel: '#3a4540' }
const ys = (m) => m.positions.filter((_, i) => i % 3 === 1)

describe('stations', () => {
  it('merges the node, building and stop-area of one station; drops bus stations; keeps a same-named station far away', () => {
    const els = [
      { type: 'node', id: 1, ...ll(0, 0), tags: { railway: 'station', name: 'Clark/Lake', network: 'CTA' } },
      { type: 'way', id: 2, geometry: [ll(-20, -10), ll(20, -10), ll(20, 10)], tags: { railway: 'station', name: 'Clark/Lake' } },
      { type: 'node', id: 3, ...ll(30, 0), tags: { public_transport: 'station', station: 'subway', name: 'Clark/Lake Station' } },
      { type: 'node', id: 4, ...ll(5, 5), tags: { public_transport: 'station', bus: 'yes', name: 'Clark/Lake' } },
      { type: 'node', id: 5, ...ll(2000, 0), tags: { railway: 'station', name: 'Clark/Lake' } },
      { type: 'node', id: 6, ...ll(0, 500), tags: { railway: 'station' } },
    ]
    const s = stationFeatures(els)
    expect(s).toHaveLength(2)
    expect(s[0]).toMatchObject({ id: 'st-n1', name: 'Clark/Lake', operator: 'cta', osm: ['n1', 'w2', 'n3'] })
    expect(s[0].pt[0]).toBeCloseTo(0, 3)
    expect(normName('Clark/Lake Station')).toBe('clark/lake'); expect(normName('Roosevelt (Red)')).toBe('roosevelt')
  })
  it('links route stops to stations by name (250 m) or proximity (60 m); lines in catalog order', () => {
    const stations = [{ id: 'st-n1', key: 'clark/lake', pt: [0, 0] }]
    const routes = [
      { line: 'brown', stops: [{ name: null, pt: [40, 0] }] },
      { line: 'blue', stops: [{ name: 'Clark/Lake', pt: [200, 0] }] },
      { line: 'red', stops: [{ name: 'Far', pt: [500, 0] }] },
    ]
    linkStops(stations, routes, ['red', 'blue', 'brown'])
    expect(stations[0].lines).toEqual(['blue', 'brown'])
    expect(routes.map((r) => r.stops[0].station)).toEqual(['st-n1', 'st-n1', null])
  })
  const piece = { operator: 'cta', lines: ['red'], pts3: [[-200, 7.2, 0], [200, 7.2, 0]], pts2: [[-200, 0], [200, 0]], grades: ['elevated'] }
  it('an elevated station: side platform at deck height + 1.07 m, canopy, signs in the line colour, stairs to the street', () => {
    const st = { id: 'st-n9', pt: [0, 3], lines: ['red'] }
    const site = stationSite(st, [piece])
    expect(site).toMatchObject({ y: 7.2, grade: 'elevated', operator: 'cta', partner: null })
    const plats = platformsFor(st, site, [])
    expect(plats).toHaveLength(1)
    const cz = plats[0].outline.reduce((a, p) => a + p[1], 0) / 4
    expect(cz).toBeCloseTo(1.55 + 1.85, 5)
    const m = createMesh()
    stationMesh(m, st, site, plats, { look, lineColours: { red: hexToLinear('#c60c30') } })
    expect(Math.max(...ys(m))).toBeCloseTo(7.2 + 1.07 + 3.2 + 0.18, 2)
    expect(Math.min(...ys(m))).toBeCloseTo(0, 5)
    const i = m.kind.indexOf(KIND.sign)
    expect(m.colors.slice(i * 3, i * 3 + 3)).toEqual(hexToLinear('#c60c30'))
    expect(m.colors.slice(0, 3)).toEqual(hexToLinear(look.base)) // platform top first, in the look's base colour
  })
  it('a subway station is a street entrance with a line-colour pylon; no station further than 120 m from track', () => {
    const deep = { ...piece, pts3: [[-200, -9, 0], [200, -9, 0]], grades: ['subway'] }
    const st = { id: 'st-n8', pt: [0, 10], lines: ['red'] }
    const site = stationSite(st, [deep])
    const m = createMesh()
    stationMesh(m, st, site, [], { look, lineColours: { red: hexToLinear('#c60c30') } })
    expect(Math.max(...ys(m))).toBeCloseTo(3.4, 5); expect(Math.min(...ys(m))).toBeCloseTo(0, 5)
    expect(m.kind.includes(KIND.sign)).toBe(true)
    expect(stationSite({ pt: [0, 400], lines: [] }, [piece])).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix pipeline -- transit-stations`
Expected: FAIL — `Failed to load url ../lib/transit/stations.js`

- [ ] **Step 3: Implement** — `pipeline/lib/transit/stations.js`:

```js
// pipeline/lib/transit/stations.js — stations from OSM, the lines that stop there, and platform / canopy /
// stair / sign geometry. Colours come from a V2 look (base = platform, spandrel = canopy, mullion = frames).
import earcut from 'earcut'
import { project } from '../../../shared/project.js'
import { operatorOf } from './lines.js'
import { projectOnPolyline } from './polyline.js'
import { box, quad, tri, hexToLinear, KIND, cross3, unit3 } from './meshkit.js'

export const PLATFORM = { cta: { length: 128, width: 3.7, aboveRail: 1.07 }, metra: { length: 240, width: 4.0, aboveRail: 0.25 } }
export const PLATFORM_EDGE_M = 1.55
export const MERGE_M = 150, STOP_MATCH_M = 250, STOP_NEAR_M = 60, SITE_M = 120, PLATFORM_MATCH_M = 90
export const CANOPY = { share: 0.6, height: 3.2, post: 7.5 }
export const STEP = { rise: 0.18, run: 0.28, width: 1.8 }
export const SIGN = { height: 2.3, board: [1.6, 0.45] }
const LOOK_ROLES = { platform: 'base', roof: 'spandrel', frame: 'mullion', glass: 'glass' }
const Y = [0, 1, 0]

const isRailStation = (t = {}) => t.railway === 'station' || ['subway', 'train', 'light_rail'].includes(t.station) ||
  (t.public_transport === 'station' && (t.train === 'yes' || t.subway === 'yes' || t.light_rail === 'yes'))
const isPlatform = (t = {}) => t.railway === 'platform' || (t.public_transport === 'platform' && (t.train === 'yes' || t.subway === 'yes'))
export const normName = (s) => String(s ?? '').toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+station\s*$/, '').replace(/\s+/g, ' ').trim()
const mean = (pts) => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length]
const centreOf = (el) => (el.type === 'node' ? project(el.lon, el.lat) : el.geometry?.length ? mean(el.geometry.map((p) => project(p.lon, p.lat))) : null)

export function stationFeatures(elements) {
  const out = []
  for (const el of elements) {
    const t = el.tags ?? {}
    if (!isRailStation(t) || !t.name) continue
    const pt = centreOf(el)
    if (!pt) continue
    const key = normName(t.name), osm = `${el.type[0]}${el.id}`
    const op = operatorOf(t) ?? (t.station === 'subway' ? 'cta' : t.train === 'yes' || t.station === 'train' ? 'metra' : null)
    const hit = out.find((s) => s.key === key && Math.hypot(s.pt[0] - pt[0], s.pt[1] - pt[1]) < MERGE_M && (!s.operator || !op || s.operator === op))
    if (hit) {
      hit.operator ??= op
      if (el.type === 'node' && !hit.fromNode) { hit.pt = pt; hit.fromNode = true }
      hit.osm.push(osm)
      continue
    }
    out.push({ id: `st-${osm}`, key, name: t.name, pt, operator: op, fromNode: el.type === 'node', osm: [osm] })
  }
  return out.map(({ fromNode, ...s }) => s)
}

function lineToOutline(pts, hw) {
  const L = [], R = []
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const s = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]
    L.push([p[0] + s[0] * hw, p[1] + s[1] * hw]); R.push([p[0] - s[0] * hw, p[1] - s[1] * hw])
  })
  return [...L, ...R.reverse()]
}

export function platformWays(elements) {
  const out = []
  for (const el of elements) {
    if (el.type !== 'way' || !isPlatform(el.tags) || !(el.geometry?.length >= 2)) continue
    const pts = el.geometry.map((p) => project(p.lon, p.lat))
    const closed = pts.length >= 4 && Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < 0.01
    const outline = closed ? pts.slice(0, -1) : lineToOutline(pts, PLATFORM.cta.width / 2)
    out.push({ outline, centre: mean(outline) })
  }
  return out
}

export function linkStops(stations, routes, order) {
  const lines = new Map(stations.map((s) => [s, new Set()]))
  for (const r of routes) for (const stop of r.stops) {
    const key = normName(stop.name)
    let best = null, bd = Infinity
    for (const s of stations) {
      const d = Math.hypot(s.pt[0] - stop.pt[0], s.pt[1] - stop.pt[1]), lim = key && s.key === key ? STOP_MATCH_M : STOP_NEAR_M
      if (d < lim && d < bd) { best = s; bd = d }
    }
    stop.station = best?.id ?? null
    if (best) lines.get(best).add(r.line)
  }
  for (const s of stations) s.lines = [...lines.get(s)].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

export function stationSite(st, pieces) {
  let best = null
  for (const pc of pieces) {
    const pr = projectOnPolyline(pc.pts2, st.pt)
    if (pr.d > SITE_M) continue
    const score = pr.d - ((st.lines ?? []).some((l) => pc.lines.includes(l)) ? 1000 : 0)
    if (!best || score < best.score) best = { score, pc, pr }
  }
  if (!best) return null
  const { pc, pr } = best, a = pc.pts3[pr.i], b = pc.pts3[pr.i + 1]
  const tl = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1, t = [(b[0] - a[0]) / tl, (b[2] - a[2]) / tl], side = [-t[1], t[0]]
  let partner = null
  for (const q of pieces) {
    if (q === pc) continue
    const qr = projectOnPolyline(q.pts2, pr.pt)
    if (qr.d < 2.5 || qr.d > 6.5) continue
    const off = (qr.pt[0] - pr.pt[0]) * side[0] + (qr.pt[1] - pr.pt[1]) * side[1]
    if (partner === null || Math.abs(off) < Math.abs(partner)) partner = off
  }
  return { p: pr.pt, y: +(a[1] + (b[1] - a[1]) * pr.t).toFixed(2), t, side, grade: pc.grades[Math.min(pr.i, pc.grades.length - 1)], operator: pc.operator, partner }
}

export function platformsFor(st, site, platforms) {
  const osm = platforms.filter((p) => Math.hypot(p.centre[0] - st.pt[0], p.centre[1] - st.pt[1]) < PLATFORM_MATCH_M &&
    projectOnPolyline([[site.p[0] - site.t[0] * 300, site.p[1] - site.t[1] * 300], [site.p[0] + site.t[0] * 300, site.p[1] + site.t[1] * 300]], p.centre).d < 12)
  if (osm.length) return osm.map(({ outline }) => ({ outline }))
  const P = PLATFORM[site.operator] ?? PLATFORM.cta, edge = PLATFORM_EDGE_M + P.width / 2
  const synth = (off) => {
    const c = [site.p[0] + site.side[0] * off, site.p[1] + site.side[1] * off], hl = P.length / 2, hw = P.width / 2
    return { outline: [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([u, v]) => [c[0] + site.t[0] * u + site.side[0] * v, c[1] + site.t[1] * u + site.side[1] * v]) }
  }
  if (site.partner === null) return [synth(edge)] // single track: one platform on the right
  const s = Math.sign(site.partner)
  return [synth(-s * edge), synth(site.partner + s * edge)] // side platforms outside both tracks
}

function obb(outline) {
  let a = [1, 0], best = -1
  outline.forEach((p, i) => {
    const q = outline[(i + 1) % outline.length], l = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (l > best) { best = l; a = [(q[0] - p[0]) / l, (q[1] - p[1]) / l] }
  })
  const b = [-a[1], a[0]], us = outline.map((p) => p[0] * a[0] + p[1] * a[1]), vs = outline.map((p) => p[0] * b[0] + p[1] * b[1])
  const cu = (Math.min(...us) + Math.max(...us)) / 2, cv = (Math.min(...vs) + Math.max(...vs)) / 2
  return { a, b, c: [a[0] * cu + b[0] * cv, a[1] * cu + b[1] * cv], hl: (Math.max(...us) - Math.min(...us)) / 2, hw: (Math.max(...vs) - Math.min(...vs)) / 2 }
}

function slab(m, outline, yTop, thick, col, kind) {
  const flat = outline.flat(), idx = earcut(flat)
  for (let i = 0; i < idx.length; i += 3) tri(m, ...[idx[i], idx[i + 1], idx[i + 2]].map((k) => [flat[k * 2], yTop, flat[k * 2 + 1]]), Y, col, kind)
  const c = mean(outline)
  outline.forEach((p, i) => {
    const q = outline[(i + 1) % outline.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1
    let n = [(q[1] - p[1]) / l, 0, -(q[0] - p[0]) / l]
    if (n[0] * ((p[0] + q[0]) / 2 - c[0]) + n[2] * ((p[1] + q[1]) / 2 - c[1]) < 0) n = [-n[0], 0, -n[2]]
    quad(m, [p[0], yTop - thick, p[1]], [q[0], yTop - thick, q[1]], [q[0], yTop, q[1]], [p[0], yTop, p[1]], n, col, kind)
  })
}

function stairs(m, at, o, yTop, col) {
  const n = Math.ceil(yTop / STEP.rise), rise = yTop / n, out = [o.a[0], 0, o.a[1]]
  for (let i = 0; i < n; i++) { // descending outward beyond the platform end
    const u = o.hl + i * STEP.run, y = yTop - (i + 1) * rise, w = STEP.width / 2
    quad(m, at(u, -w, y), at(u + STEP.run, -w, y), at(u + STEP.run, w, y), at(u, w, y), Y, col.platform, KIND.concrete)
    quad(m, at(u, -w, y), at(u, w, y), at(u, w, y + rise), at(u, -w, y + rise), out, col.platform, KIND.concrete)
  }
  const s0 = at(o.hl, 0, yTop), s1 = at(o.hl + n * STEP.run, 0, 0)
  const d = [s1[0] - s0[0], s1[1] - s0[1], s1[2] - s0[2]], len = Math.hypot(...d), dx = unit3(d), bz = [o.b[0], 0, o.b[1]]
  let ay = cross3(bz, dx)
  if (ay[1] < 0) ay = ay.map((v) => -v)
  for (const v of [-1, 1]) { // stringers: their lower edge runs along the stair line, so they never dip below the street
    const off = v * (STEP.width / 2 + 0.08)
    const c = [0, 1, 2].map((k) => s0[k] + d[k] / 2 + bz[k] * off + ay[k] * 0.2)
    box(m, c, dx, ay, bz, [len / 2, 0.2, 0.06], col.frame, KIND.steel)
  }
}

export function stationMesh(m, st, site, platforms, { look, lineColours }) {
  const col = Object.fromEntries(Object.entries(LOOK_ROLES).map(([role, key]) => [role, hexToLinear(look[key])]))
  const bands = st.lines?.length ? st.lines.map((l) => lineColours[l]) : [hexToLinear('#565a5c')]
  if (!site || site.y < -1 || !platforms.length) { // subway (or no track): a street entrance with a line-colour pylon
    const [x, z] = st.pt, X = [1, 0, 0], Z = [0, 0, 1]
    for (const [cx, cz, hx, hz] of [[x, z - 3, 1.1, 0.06], [x - 1.05, z, 0.06, 3], [x + 1.05, z, 0.06, 3]]) box(m, [cx, 0.55, cz], X, Y, Z, [hx, 0.55, hz], col.frame, KIND.steel)
    box(m, [x + 1.9, 1.4, z - 3], X, Y, Z, [0.2, 1.4, 0.2], col.frame, KIND.steel)
    bands.forEach((c, i) => box(m, [x + 1.9, 3.4 - (i + 0.5) * (0.6 / bands.length), z - 3], X, Y, Z, [0.22, 0.3 / bands.length, 0.22], c, KIND.sign))
    return
  }
  const P = PLATFORM[site.operator] ?? PLATFORM.cta, yTop = site.y + P.aboveRail
  for (const { outline } of platforms) {
    slab(m, outline, yTop, 0.3, col.platform, KIND.concrete)
    const o = obb(outline), ax = [o.a[0], 0, o.a[1]], bz = [o.b[0], 0, o.b[1]]
    const at = (u, v, y) => [o.c[0] + o.a[0] * u + o.b[0] * v, y, o.c[1] + o.a[1] * u + o.b[1] * v]
    const cl = o.hl * CANOPY.share
    box(m, at(0, 0, yTop + CANOPY.height + 0.09), ax, Y, bz, [cl, 0.09, o.hw + 0.2], col.roof, KIND.roof)
    for (let u = -cl + 1; u <= cl - 1 + 1e-6; u += CANOPY.post) box(m, at(u, 0, yTop + CANOPY.height / 2), ax, Y, bz, [0.1, CANOPY.height / 2, 0.1], col.frame, KIND.steel, ['front', 'back', 'left', 'right'])
    for (const u of [-o.hl + 4, 0, o.hl - 4]) { // line-colour signs facing the track at both ends and the middle
      box(m, at(u, 0, yTop + SIGN.height / 2), ax, Y, bz, [0.05, SIGN.height / 2, 0.05], col.frame, KIND.steel, ['front', 'back', 'left', 'right'])
      box(m, at(u, 0, yTop + SIGN.height + 0.3), ax, Y, bz, [SIGN.board[0] / 2, SIGN.board[1] / 2, 0.03], col.frame, KIND.dark)
      const h = SIGN.board[1] / bands.length
      bands.forEach((c, i) => box(m, at(u, 0, yTop + SIGN.height + 0.3 + SIGN.board[1] / 2 - (i + 0.5) * h), ax, Y, bz, [SIGN.board[0] / 2 - 0.04, h / 2, 0.045], c, KIND.sign, ['left', 'right']))
    }
    if (site.y >= 3) stairs(m, at, o, yTop, col)
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --prefix pipeline -- transit-stations`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/transit/stations.js pipeline/tests/transit-stations.test.js
git commit -m "feat(transit): stations from OSM — merged features, line links, platforms, canopies, stairs, line-colour signs"
```

---
### Task 11: Transit build and validation

**Files:**
- Create: `pipeline/lib/transit/validate.js`, `pipeline/build/build-transit.js`
- Test: `pipeline/tests/transit-build.test.js`

**Interfaces:**
- Consumes: everything from Tasks 2–10, plus V2's `validateLook` (`pipeline/lib/looks.js`) and the style registry's `add(key, look)`.
- Produces (`validate.js`):
  - `transitStats(pieces:[{ lines, pts2 }]) → { [lineId]: { segments, km } }`. `segments` counts the distinct OSM track ways carrying the line inside the world.
  - `validateTransit(stats, catalog, stations) → { errors: string[], warnings: string[] }`. Out-of-range CTA lines are errors (strict); out-of-range Metra lines are warnings; lines expected outside the world warn if found. Missing required stations are errors.
  - `assertTransit(v, log = console)`: prints the warnings, and throws when there are errors.
- Produces (`build-transit.js`):
  - `loadTransitCache(cacheDir) → { routeEls, stationEls }`
  - `gradeRuns(piece) → [{ grade, pts3 }]`
  - `buildTransit({ routeEls, stationEls, catalog, styles? }) → { json, tiles: Map<tileKey, { transit, ties, stations, glow, glowLod }>, wayIds: Set<number>, stats, validation }`. The layers are ready for `writeTileGlb`.
  - The `transit.json` schema, v1:
    ```
    {
      version: 1,
      lines: [{ id, name, operator, colour, glow, source, index, ...(every other catalog field, e.g. V4's service) }],
      routes: [{ id: '<line>-<relationId>-<run>', line, relation, name, from, to,
                 path: [[x, y, z]...] (≤ 12 m spacing, rail-top y),
                 stops: [{ station: id|null, name, s }] }],
      stations: [{ id, name, operator, lines, x, z, y (platform top, or 0 below ground), grade, heading, osm }],
      junctions: [{ name, x, z }],
      stats
    }
    ```

- [ ] **Step 1: Write the failing test** — `pipeline/tests/transit-build.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { unproject } from '../../shared/project.js'
import { loadCatalog } from '../lib/transit/lines.js'
import { buildTransit, gradeRuns } from '../build/build-transit.js'
import { transitStats, validateTransit, assertTransit } from '../lib/transit/validate.js'

const ll = (x, z) => { const [lon, lat] = unproject(x, z); return { lon, lat } }
const catalog = loadCatalog()

describe('validateTransit', () => {
  const cat = {
    lines: [
      { id: 'red', operator: 'cta', expect: { inBounds: true, minSegments: 6, minKm: 6, maxKm: 90 } },
      { id: 'up-n', operator: 'metra', expect: { inBounds: true, minSegments: 2, minKm: 2, maxKm: 70 } },
      { id: 'yellow', operator: 'cta', expect: { inBounds: false } },
    ],
    requiredStations: ['clark\\s*/\\s*lake'],
  }
  it('passes a healthy build; a thin Metra line only warns', () => {
    const v = validateTransit({ red: { segments: 20, km: 30 }, 'up-n': { segments: 1, km: 3 } }, cat, [{ name: 'Clark/Lake' }])
    expect(v.errors).toEqual([]); expect(v.warnings).toEqual(['up-n: 1 segments < 2'])
  })
  it('a thin CTA line, a missing station and an unexpected line are reported', () => {
    const v = validateTransit({ red: { segments: 3, km: 2 }, yellow: { segments: 2, km: 1 } }, cat, [])
    expect(v.errors).toEqual(['red: 3 segments < 6', 'station missing: /clark\\s*/\\s*lake/'])
    expect(v.warnings).toEqual(['up-n: 0 segments < 2', 'yellow: expected outside the world but found 2 segments'])
    const log = { warn: vi.fn() }
    expect(() => assertTransit(v, log)).toThrow(/transit validation failed/); expect(log.warn).toHaveBeenCalledTimes(2)
    expect(transitStats([{ lines: ['red', 'blue'], pts2: [[0, 0], [300, 400]] }, { lines: ['red'], pts2: [[0, 0], [0, 1000]] }])).toEqual({ red: { segments: 2, km: 1.5 }, blue: { segments: 1, km: 0.5 } })
  })
})

describe('buildTransit', () => {
  // A Red Line run north along x = 100 (clear of tile edges): 400 m of elevated, then 800 m of subway; a stop and its station on the elevated part.
  const routeEls = [
    { type: 'way', id: 1, nodes: [101, 102], geometry: [ll(100, 0), ll(100, -400)], tags: { railway: 'subway', bridge: 'yes', layer: '2' } },
    { type: 'way', id: 2, nodes: [102, 103], geometry: [ll(100, -400), ll(100, -1200)], tags: { railway: 'subway', tunnel: 'yes', layer: '-2' } },
    { type: 'node', id: 200, ...ll(100, -200), tags: { public_transport: 'stop_position', name: 'Test/Lake' } },
    { type: 'relation', id: 10, tags: { type: 'route', route: 'subway', network: 'CTA', ref: 'Red', name: 'CTA Red Line', to: '95th/Dan Ryan' },
      members: [{ type: 'way', ref: 1, role: '' }, { type: 'way', ref: 2, role: '' }, { type: 'node', ref: 200, role: 'stop' }] },
    { type: 'relation', id: 11, tags: { type: 'route', route: 'train', network: 'Amtrak' }, members: [{ type: 'way', ref: 1, role: '' }] },
  ]
  const stationEls = [{ type: 'node', id: 300, ...ll(103, -200), tags: { railway: 'station', name: 'Test/Lake', network: 'CTA' } }]
  const added = []
  const out = buildTransit({ routeEls, stationEls, catalog, styles: { add: (k) => { added.push(k); return added.length } } })

  it('lines carry official colours and their catalog index; routes are graded and height-profiled', () => {
    expect(out.json.lines).toHaveLength(1)
    expect(out.json.lines[0]).toMatchObject({ id: 'red', colour: '#c60c30', index: 0, operator: 'cta' })
    expect(out.json.lines[0].expect).toBeUndefined()
    const [r] = out.json.routes
    expect(r).toMatchObject({ id: 'red-10-0', line: 'red', to: '95th/Dan Ryan' })
    expect(r.path[0][1]).toBe(7.2); expect(r.path.at(-1)[1]).toBe(-9)
    expect(r.stops).toEqual([{ station: 'st-n300', name: 'Test/Lake', s: 200 }])
  })
  it('the station sits on the elevated deck; only CTA/Metra ways are claimed', () => {
    expect(out.json.stations).toEqual([expect.objectContaining({ id: 'st-n300', lines: ['red'], grade: 'elevated', y: 8.27, operator: 'cta' })])
    expect([...out.wayIds].sort()).toEqual([1, 2])
    expect(out.stats.red.segments).toBe(2); expect(out.stats.red.km).toBeCloseTo(1.2, 2)
    expect(added).toEqual(['station-cta', 'station-metra'])
  })
  it('tiles: structure, ties and stations on the elevated tile; only ghosted glow deep in the subway', () => {
    const t0 = out.tiles.get('0_-1'), t2 = out.tiles.get('0_-3')
    expect(t0.transit.positions.length).toBeGreaterThan(0); expect(t0.ties.positions.length).toBeGreaterThan(0)
    expect(t0.stations.positions.length).toBeGreaterThan(0); expect(t0.glow.positions.length).toBeGreaterThan(0)
    expect(out.tiles.get('0_-2').transit.positions.length).toBeGreaterThan(0) // the portal
    expect(t2.transit.positions).toHaveLength(0)
    expect(new Set(t2.glow.extra.GHOST)).toEqual(new Set([1]))
    expect([...out.tiles.values()].some((t) => t.glowLod.positions.length > 0)).toBe(true)
  })
  it('gradeRuns splits a piece where the grade changes', () => {
    const runs = gradeRuns({ pts3: [[0, 7, 0], [1, 7, 0], [2, 3, 0], [3, 0, 0]], grades: ['elevated', 'elevated', 'subway'] })
    expect(runs.map((r) => [r.grade, r.pts3.length])).toEqual([['elevated', 3], ['subway', 2]])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix pipeline -- transit-build`
Expected: FAIL — `Failed to load url ../build/build-transit.js`

- [ ] **Step 3: Implement**

`pipeline/lib/transit/validate.js`:

```js
// pipeline/lib/transit/validate.js — the build refuses a transit network missing a CTA line or a landmark station.
export function transitStats(pieces) {
  const out = {}
  for (const p of pieces) {
    let len = 0
    for (let i = 1; i < p.pts2.length; i++) len += Math.hypot(p.pts2[i][0] - p.pts2[i - 1][0], p.pts2[i][1] - p.pts2[i - 1][1])
    for (const l of p.lines) { out[l] ??= { segments: 0, km: 0 }; out[l].segments++; out[l].km = +(out[l].km + len / 1000).toFixed(3) }
  }
  return out
}

export function validateTransit(stats, catalog, stations) {
  const errors = [], warnings = []
  for (const l of catalog.lines) {
    const s = stats[l.id] ?? { segments: 0, km: 0 }, e = l.expect ?? {}
    if (e.inBounds === false) { if (s.segments) warnings.push(`${l.id}: expected outside the world but found ${s.segments} segments`); continue }
    const bad = s.segments < e.minSegments ? `${l.id}: ${s.segments} segments < ${e.minSegments}`
      : s.km < e.minKm || s.km > e.maxKm ? `${l.id}: ${s.km.toFixed(1)} km outside [${e.minKm}, ${e.maxKm}]` : null
    if (bad) (l.operator === 'cta' ? errors : warnings).push(bad)
  }
  for (const re of catalog.requiredStations ?? []) if (!stations.some((s) => new RegExp(re, 'i').test(s.name))) errors.push(`station missing: /${re}/`)
  return { errors, warnings }
}

export function assertTransit(v, log = console) {
  for (const w of v.warnings) log.warn(`   transit warning: ${w}`)
  if (v.errors.length) throw new Error(`transit validation failed:\n  ${v.errors.join('\n  ')}`)
}
```

`pipeline/build/build-transit.js`:

```js
// pipeline/build/build-transit.js — V3 transit build: OSM route relations + stations → transit.json and per-tile
// structure, tie, station and glow layers. Called by build-world.js; pure over its inputs (no file writes).
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { project } from '../../shared/project.js'
import { tileKeyFor } from '../lib/tiles.js'
import { splitLineByTiles } from '../lib/tilepack.js'
import { lineIdFor, lineOrder } from '../lib/transit/lines.js'
import { chainRelation, stopsOnRun, isStopRole } from '../lib/transit/chain.js'
import { resample, simplifyLine3, runsWhere, segLen } from '../lib/transit/polyline.js'
import { gradeOf, refineGrades, heightProfile, RAIL_TOP_Y } from '../lib/transit/grade.js'
import { linesByWay, planBents } from '../lib/transit/trackage.js'
import { createMesh, toLayer, hexToLinear } from '../lib/transit/meshkit.js'
import { elevatedPiece, embankmentPiece, atGradePiece, portalPiece, catenary, bentsMesh, junctionBox } from '../lib/transit/structure.js'
import { createGlow, glowPiece, toGlowLayer } from '../lib/transit/glow.js'
import { stationFeatures, platformWays, linkStops, stationSite, platformsFor, stationMesh, PLATFORM } from '../lib/transit/stations.js'
import { transitStats, validateTransit } from '../lib/transit/validate.js'
import { validateLook } from '../lib/looks.js'

export const RESAMPLE_M = 12
export const PORTAL_DEPTH_Y = -6 // subway track above this is an open ramp and gets trench walls
export const GLOW_LOD_TOL_M = 3
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100

const elementsOf = (dir, kind) => readdirSync(dir).filter((f) => f.startsWith(`osm-${kind}-`)).sort()
  .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).data.elements)
export const loadTransitCache = (cacheDir) => ({ routeEls: elementsOf(cacheDir, 'routes'), stationEls: elementsOf(cacheDir, 'stations') })

export function gradeRuns({ pts3, grades }) {
  const out = []
  grades.forEach((g, i) => {
    const last = out.at(-1)
    if (last && last.grade === g) last.pts3.push(pts3[i + 1]); else out.push({ grade: g, pts3: [pts3[i], pts3[i + 1]] })
  })
  return out
}
function* byTile(pts3) { // splitLineByTiles keys on [x, z]; carry y along as the third value
  for (const [k, lines] of splitLineByTiles(pts3.map(([x, y, z]) => [x, z, y]))) for (const l of lines) yield [k, l.map(([x, z, y]) => [x, y, z])]
}

export function buildTransit({ routeEls, stationEls, catalog, styles = null }) {
  const order = lineOrder(catalog), lineById = new Map(catalog.lines.map((l) => [l.id, l]))
  const colourOf = (id) => hexToLinear(lineById.get(id).colour)
  const ways = new Map(), nodes = new Map(), rels = []
  for (const el of routeEls) {
    if (el.type === 'way' && el.geometry?.length >= 2) ways.set(el.id, { id: el.id, nodes: el.nodes ?? [], pts: el.geometry.map((p) => project(p.lon, p.lat)), tags: el.tags ?? {} })
    else if (el.type === 'node') nodes.set(el.id, el)
    else if (el.type === 'relation') rels.push(el)
  }
  rels.sort((a, b) => a.id - b.id) // deterministic: the first run to cover a way draws it

  // ── routes: every run of every CTA / Metra relation, graded and height-profiled
  const routes = [], pieces = new Map()
  for (const rel of rels) {
    const line = lineIdFor(rel.tags, catalog)
    if (!line) continue
    const operator = lineById.get(line).operator
    const stops = rel.members.filter((m) => m.type === 'node' && isStopRole(m.role)).map((m) => nodes.get(m.ref)).filter(Boolean)
      .map((n) => ({ id: n.id, name: n.tags?.name ?? null, pt: project(n.lon, n.lat) }))
    chainRelation(rel, ways).forEach((run, k) => {
      const { pts, tags: segWay } = resample(run.pts, run.segWay, RESAMPLE_M)
      const grades = refineGrades(segWay.map((w, i) => ({ grade: gradeOf(ways.get(w).tags), len: segLen(pts[i], pts[i + 1]), rail: ways.get(w).tags.railway === 'rail' })))
      const ys = heightProfile(pts, grades, operator)
      const pts3 = pts.map((p, i) => [p[0], ys[i], p[1]])
      routes.push({ id: `${line}-${rel.id}-${k}`, line, relation: rel.id, name: rel.tags.name ?? '', from: rel.tags.from ?? '', to: rel.tags.to ?? '', wayIds: [...new Set(segWay)], pts3, stops: stopsOnRun({ pts }, stops) })
      for (let i = 0; i < segWay.length;) {
        let j = i
        while (j + 1 < segWay.length && segWay[j + 1] === segWay[i]) j++
        if (!pieces.has(segWay[i])) pieces.set(segWay[i], { wayId: segWay[i], operator, tags: ways.get(segWay[i]).tags, pts3: pts3.slice(i, j + 2), grades: grades.slice(i, j + 1) })
        i = j + 1
      }
    })
  }
  const lanes = linesByWay(routes, order)
  const drawn = [...pieces.values()].sort((a, b) => a.wayId - b.wayId)
  for (const pc of drawn) { pc.lines = lanes.get(pc.wayId) ?? []; pc.pts2 = pc.pts3.map((p) => [p[0], p[2]]) }

  // ── per-tile layers
  const tiles = new Map()
  const T = (k) => { if (!tiles.has(k)) tiles.set(k, { transit: createMesh(), ties: createMesh(), stations: createMesh(), glow: createGlow(), glowLod: createGlow() }); return tiles.get(k) }
  const glowSpec = (pc) => ({ lines: pc.lines, colours: pc.lines.map(colourOf), lineIndex: pc.lines.map((l) => order.indexOf(l)), intensity: pc.lines.map((l) => lineById.get(l).glow) })
  for (const pc of drawn) {
    for (const run of gradeRuns(pc)) {
      const parts = run.grade === 'subway' ? runsWhere(run.pts3, (p) => p[1] > PORTAL_DEPTH_Y) : [run.pts3]
      for (const part of parts) for (const [k, pts] of byTile(part)) {
        const t = T(k), piece = { pts, operator: pc.operator, colours: pc.lines.map(colourOf) }
        if (run.grade === 'elevated') elevatedPiece(t.transit, t.ties, piece)
        else if (run.grade === 'embankment') embankmentPiece(t.transit, piece)
        else if (run.grade === 'at_grade') atGradePiece(t.transit, piece)
        else portalPiece(t.transit, piece)
        if (pc.tags.electrified === 'contact_line' && run.grade !== 'subway') catenary(t.transit, piece)
      }
    }
    for (const [k, pts] of byTile(pc.pts3)) glowPiece(T(k).glow, pts, glowSpec(pc))
    for (const [k, pts] of byTile(simplifyLine3(pc.pts3, GLOW_LOD_TOL_M))) glowPiece(T(k).glowLod, pts, glowSpec(pc))
  }
  // bents: CTA steel every 18 m; Metra viaducts longer than 60 m on piers every 25 m
  const raised = (op) => drawn.filter((pc) => pc.operator === op).flatMap((pc) => gradeRuns(pc).filter((r) => r.grade === 'elevated').map((r) => ({ wayId: pc.wayId, pts: r.pts3 })))
  const metraLong = raised('metra').filter((p) => segLen([p.pts[0][0], p.pts[0][2]], [p.pts.at(-1)[0], p.pts.at(-1)[2]]) > 60)
  for (const b of [...planBents(raised('cta')), ...planBents(metraLong, { spacing: 25, outset: 0.8, singleHalf: 2.4 })]) {
    bentsMesh(T(tileKeyFor([(b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2])).transit, [b])
  }
  for (const j of catalog.junctions ?? []) {
    const [x, z] = project(j.lon, j.lat)
    junctionBox(T(tileKeyFor([x, z])).transit, { x, z, y: RAIL_TOP_Y.cta, size: j.size, tower: j.tower })
  }

  // ── stations (colours are the V2 looks station-cta / station-metra, registered in the shared palette)
  const looks = catalog.stationLooks ?? {}
  const lookErrors = Object.entries(looks).flatMap(([op, look]) => validateLook(look, `station-${op}`))
  for (const [op, look] of Object.entries(looks)) styles?.add(`station-${op}`, look)
  const stations = stationFeatures(stationEls)
  linkStops(stations, routes, order)
  const platforms = platformWays(stationEls), withLines = drawn.filter((p) => p.lines.length)
  const stationOut = stations.map((st) => {
    const site = stationSite(st, withLines), operator = site?.operator ?? st.operator ?? 'cta', above = !!site && site.y > -1
    stationMesh(T(tileKeyFor(st.pt)).stations, st, site, above ? platformsFor(st, site, platforms) : [], { look: looks[operator], lineColours: Object.fromEntries(st.lines.map((l) => [l, colourOf(l)])) })
    return { id: st.id, name: st.name, operator, lines: st.lines, x: r1(st.pt[0]), z: r1(st.pt[1]), y: above ? r2(site.y + PLATFORM[operator].aboveRail) : 0, grade: site?.grade ?? 'unknown', heading: site ? r2(Math.atan2(site.t[0], site.t[1])) : 0, osm: st.osm }
  })

  const stats = transitStats(drawn)
  const validation = validateTransit(stats, catalog, stationOut)
  validation.errors.push(...lookErrors)
  const present = order.filter((id) => routes.some((r) => r.line === id))
  const json = {
    version: 1,
    lines: present.map((id) => { const { expect, refs, names, ...rest } = lineById.get(id); return { ...rest, index: order.indexOf(id) } }),
    routes: routes.map((r) => ({ id: r.id, line: r.line, relation: r.relation, name: r.name, from: r.from, to: r.to,
      path: r.pts3.map(([x, y, z]) => [r1(x), r2(y), r1(z)]), stops: r.stops.map((s) => ({ station: s.station ?? null, name: s.name, s: s.s })) })),
    stations: stationOut,
    junctions: (catalog.junctions ?? []).map(({ name, lat, lon }) => { const [x, z] = project(lon, lat); return { name, x: r1(x), z: r1(z) } }),
    stats,
  }
  const layers = new Map([...tiles].map(([k, t]) => [k, { transit: toLayer(t.transit), ties: toLayer(t.ties), stations: toLayer(t.stations), glow: toGlowLayer(t.glow), glowLod: toGlowLayer(t.glowLod) }]))
  return { json, tiles: layers, wayIds: new Set(pieces.keys()), stats, validation }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --prefix pipeline -- transit-build`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/transit/validate.js pipeline/build/build-transit.js pipeline/tests/transit-build.test.js
git commit -m "feat(transit): build-transit — graded routes, per-tile structure/ties/stations/glow, transit.json, validation"
```

---

### Task 12: Wire transit into the world build (manifest v6)

**Files:**
- Modify: `pipeline/build/build-world.js` (the anchors are quoted below)
- Create: `pipeline/tests/world-output.test.js`

**Interfaces:**
- Consumes: `buildTransit` and `loadTransitCache` (Task 11), `assertTransit`, `loadCatalog`, `concatLayers` (Task 7), and V2's `styles` registry variable in `main()`.
- Produces:
  - LOD0 tile glbs with the named meshes `transit`, `ties`, `stations` and `glow`; LOD1 tile glbs and 2 km block glbs with a `glow` mesh.
  - No `elevated` mesh and no sidecar `columns`.
  - `app/public/world/transit.json`.
  - A manifest with `version: 6` and `transit: 'transit.json'`.
  - A build that fails when `public/world` exceeds 200 MB.

- [ ] **Step 1: Write the failing test** — `pipeline/tests/world-output.test.js`:

```js
// Checks the built world on disk (skipped on a clone without app/public/world).
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'public', 'world')
const has = existsSync(join(OUT, 'manifest.json'))
const json = (f) => JSON.parse(readFileSync(join(OUT, f), 'utf8'))
const nodeNames = async (f) => {
  await MeshoptDecoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
  return (await io.read(join(OUT, f))).getRoot().listNodes().map((n) => n.getName())
}

describe.skipIf(!has)('built world — transit (V3)', () => {
  it('manifest v6 lists transit.json', () => {
    const m = json('manifest.json')
    expect(m.version).toBe(6); expect(m.transit).toBe('transit.json')
  })
  it('transit.json has the CTA lines in official colours, routes and stations', () => {
    const t = json('transit.json')
    for (const id of ['red', 'blue', 'brown', 'green', 'orange', 'pink', 'purple']) expect(t.lines.find((l) => l.id === id)).toBeTruthy()
    expect(t.lines.find((l) => l.id === 'red').colour).toBe('#c60c30')
    expect(t.routes.length).toBeGreaterThan(14); expect(t.stations.length).toBeGreaterThan(40)
    expect(t.stations.find((s) => /clark\s*\/\s*lake/i.test(s.name))).toBeTruthy()
  })
  it('the Tower 18 tile (-1_-1) carries structure, ties, stations and glow; the old deck and columns are gone', async () => {
    const names = await nodeNames('tiles/-1_-1.glb')
    for (const n of ['transit', 'ties', 'stations', 'glow']) expect(names).toContain(n)
    expect(names).not.toContain('elevated')
    expect(json('tiles/-1_-1.json').columns).toBeUndefined()
    expect(await nodeNames('tiles/-1_-1.lod1.glb')).toContain('glow')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix pipeline -- world-output`
Expected: FAIL. `expected 5 to be 6` (V2's manifest), and later `expected [ 'buildings', 'ground', 'water', 'elevated' ] to include 'transit'`.

- [ ] **Step 3: Implement** — `pipeline/build/build-world.js`. Make these edits in order. Each one names the exact text to find.

1. **Imports.**
   - Add `statSync` to the `node:fs` import.
   - Extend the tilepack import with `concatLayers`.
   - Remove `isElevatedRail, ` from the `../lib/ground.js` import.
   - Add:
     ```js
     import { buildTransit, loadTransitCache } from './build-transit.js'
     import { loadCatalog } from '../lib/transit/lines.js'
     import { assertTransit } from '../lib/transit/validate.js'
     ```

2. **Build transit.** Directly after the line that starts `log(\`parks ${parks.length}, water`, insert:
   ```js
     // ── Transit (V3): CTA + Metra tracks, stations and glow ────────────────────
     const transit = buildTransit({ ...loadTransitCache(CACHE), catalog: loadCatalog(), styles })
     assertTransit(transit.validation)
     log(`transit: lines ${transit.json.lines.length} · routes ${transit.json.routes.length} · stations ${transit.json.stations.length} · tiles ${transit.tiles.size}`)
   ```
   `styles` is V2's `createStyleRegistry()` instance. If V2 named it differently, use that name and add a `Ruling:` line.

3. **Tile accumulator.** In `const tile = (k) => { … T.set(k, { … }) … }`, delete `elevated: acc(), ` and `, columns: []` (`rail: acc()` stays).

4. **The rail loop.** Replace the whole `for (const e of rail) { … }` block with:
   ```js
     for (const e of rail) {
       if (transit.wayIds.has(e.id)) continue // CTA and Metra tracks are drawn by the transit layers
       const t = e.tags || {}, pts = e.geometry.map((p) => project(p.lon, p.lat))
       if ((t.tunnel && t.tunnel !== 'no') || parseInt(t.layer ?? '0', 10) < 0) continue
       for (const [k, lines] of splitLineByTiles(pts)) for (const l of lines) {
         append(tile(k).rail, bufferPolyline(l, t.railway === 'rail' ? 2.4 : 1.8, GROUND_Y.rail, { before, after }))
       }
     }
     for (const k of transit.tiles.keys()) tile(k) // a tile that holds only track still gets written
   ```
   Keep the `bufferPolyline(…)` call's trailing arguments exactly as V1 left them in the old else-branch; `{ before, after }` is V1's miter carry-over. If V1 computed `before`/`after` inside the old loop body, keep those lines above the call.

   Ruling: freight and Amtrak-only viaducts are now drawn flat, as the ground `rail` layer — cost if wrong: a few freight bridges lose their deck (they were plain ribbons before).

5. **Content check.** Change `const hasContent = L0.positions.length || t.roads.positions.length || parksM.positions.length || waterM.positions.length` to end with `|| transit.tiles.has(key)`.

6. **Tile writes.** Replace the two `await writeTileGlb(join(OUT, 'tiles', …))` calls with the lines below. Keep any extra layers V1/V2 added to these calls (for example `_CALM` on the water layer) exactly as they are, and only add the transit keys:
   ```js
       const tr = transit.tiles.get(key) ?? {}
       await writeTileGlb(join(OUT, 'tiles', `${key}.glb`), { buildings: asLayer(L0), ground: ground0, water: waterM, transit: tr.transit, ties: tr.ties, stations: tr.stations, glow: tr.glow })
       await writeTileGlb(join(OUT, 'tiles', `${key}.lod1.glb`), { buildings: asLayer(L1), ground: ground1, water: waterM, glow: tr.glowLod })
   ```

7. **Blocks.**
   - In `blocks.set(bk, { b: bAcc(), g: …, w: acc() })`, add `, gl: []`.
   - After the line `for (const v of ground1.extra.LAYER) B.g.extra.LAYER.push(v)`, add `if (tr.glowLod?.positions.length) B.gl.push(tr.glowLod)`.
   - In the block `writeTileGlb(join(OUT, 'blocks', `${bk}.glb`), { … })` call, add `glow: B.gl.length ? concatLayers(B.gl) : undefined` to the layer object.

8. **Sidecar.** Change `JSON.stringify({ buildings: meta, trees: t.trees, props: t.props, columns: t.columns })` to `JSON.stringify({ buildings: meta, trees: t.trees, props: t.props })`. Keep any keys V1/V2 added.

9. **transit.json and the manifest.** Directly before `writeFileSync(join(OUT, 'manifest.json'), …`, add:
   ```js
     writeFileSync(join(OUT, 'transit.json'), JSON.stringify(transit.json))
   ```
   In the manifest object:
   - set `version: 6`;
   - add `transit: 'transit.json',` next to `landMask`;
   - append to `sources`:
     ```js
         { name: 'OpenStreetMap (ODbL) — CTA and Metra route relations, stations, platforms', id: 'overpass-transit' },
         { name: 'CTA GTFS route colours', id: 'cta-gtfs' },
     ```

10. **Size guard (B.1.6).** Directly after `log('manifest written')`, add the following. If V1/V2 already added an equivalent guard, keep theirs and skip this.
    ```js
      const dirBytes = (d) => readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? dirBytes(join(d, e.name)) : statSync(join(d, e.name)).size), 0)
      const worldBytes = dirBytes(OUT)
      log(`public/world: ${(worldBytes / 1e6).toFixed(1)} MB`)
      if (worldBytes > 200e6) throw new Error(`public/world is ${(worldBytes / 1e6).toFixed(1)} MB — over the 200 MB budget (B.1.6)`)
    ```

- [ ] **Step 4: Run the world build** (heavy — nothing else running; about 10–20 min)

Run: `npm run build:world --prefix pipeline`
Expected, in order:
- a `transit: lines 18 · routes R · stations S · tiles N` line, with R ≥ 15 and S ≥ 60 (18 = 7 CTA + 11 Metra; fewer is fine if the only missing ones are Metra lines that raised warnings);
- zero or more `transit warning:` lines, Metra only;
- the skyline assertion passes;
- `manifest written`;
- `public/world: X MB` with X ≤ 200.

If it throws `transit validation failed`:
- A CTA line or required station is missing. Inspect with:
  ```
  node -e "const t=require('./app/public/world/transit.json');console.log(t.stats)"
  ```
  (when the file was written), or log `lineIdFor` misses.
- Fix the catalog (`refs`/`names`, or the station regex), not the check.
- Record a `Ruling:`.

Log the transit line, the warnings and the MB figure in the ledger.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --prefix pipeline`
Expected: PASS (every file, including `world-output` with 3 tests)

- [ ] **Step 6: Commit** (the world is committed, per the Phase 2.5 convention)

```bash
git add pipeline/build/build-world.js pipeline/tests/world-output.test.js app/public/world
git commit -m "feat(transit): world build v6 — transit/ties/stations/glow tile layers, transit.json, flat rail skips CTA/Metra"
```

---
### Task 13: Glow width and the transit materials (app)

**Files:**
- Create: `app/src/transit/glowWidth.js`, `app/src/transit/transitMaterials.js`
- Test: `app/src/transit/__tests__/glowWidth.test.js`, `app/src/transit/__tests__/transitMaterials.test.js`

**Interfaces:**
- Consumes: `facadeUniforms.uNight` (`app/src/world/materials/facadeMaterial.js`): the one day/night signal.
- Produces (`glowWidth.js`):
  - `GLOW_DEFAULTS = { minPx: 2, baseHalfM: 0.18, dayLevel: 0.15 }`
  - `worldPerPixel(dist, tanHalfFov, viewportH) → m/px`
  - `glowHalfWidth(dist, tanHalfFov, viewportH, minPx?, baseHalfM?) → m`: `max(baseHalf, ½·minPx·worldPerPixel)`.
  - `glowLevel(night, day?) → 0.15…1`
  - `GLOW_GLSL`: `owGlowHalfWidth` and `owGlowLevel`, the same formulas in GLSL.
- Produces (`transitMaterials.js`):
  - `MAX_LINES = 32`, `NIGHT_BOOST = 2.2`, `ACCENT_NIGHT = 1.4`
  - `glowUniforms = { uNight, uViewportH, uTanHalfFov, uMinPx, uBaseHalf, uLineOn: Float32Array(32), uGhost }`
  - `structureUniforms = { uNight, uAccent }`
  - `patchGlowShader(shader)`, `patchStructureShader(shader)`, `createGlowMaterial()`, `createStructureMaterial()`
  - `setLineMask(lines:[{ id, index }], hidden:string[])`

- [ ] **Step 1: Write the failing tests**

`app/src/transit/__tests__/glowWidth.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { glowHalfWidth, worldPerPixel, glowLevel, GLOW_DEFAULTS, GLOW_GLSL } from '../glowWidth.js'

const T = (deg) => Math.tan((deg * Math.PI) / 360)

describe('glow width', () => {
  it('is the physical strip up close', () => {
    expect(glowHalfWidth(20, T(42), 1000)).toBe(GLOW_DEFAULTS.baseHalfM)
  })
  it('never drops under 2 px at any distance, field of view or viewport', () => {
    for (const d of [1, 50, 150, 1000, 6000, 100000]) for (const fov of [30, 42, 90]) for (const vh of [300, 1000, 2160]) {
      const px = (2 * glowHalfWidth(d, T(fov), vh)) / worldPerPixel(d, T(fov), vh)
      expect(px).toBeGreaterThanOrEqual(GLOW_DEFAULTS.minPx - 1e-9)
    }
  })
  it('grows linearly with distance once compensated (1 km → 6 km)', () => {
    expect(glowHalfWidth(6000, T(42), 1000) / glowHalfWidth(1000, T(42), 1000)).toBeCloseTo(6, 5)
  })
  it('stays finite with the camera on the ribbon or a zero-height viewport', () => {
    expect(glowHalfWidth(0, T(42), 1000)).toBe(GLOW_DEFAULTS.baseHalfM)
    expect(Number.isFinite(glowHalfWidth(500, T(42), 0))).toBe(true)
    expect(Number.isFinite(glowHalfWidth(-5, T(42), 1000))).toBe(true)
  })
  it('glow level: 15 % by day, full at night, clamped; GLSL mirrors the constants', () => {
    expect(glowLevel(0)).toBeCloseTo(0.15); expect(glowLevel(1)).toBe(1); expect(glowLevel(3)).toBe(1)
    expect(glowLevel(-1)).toBeCloseTo(0.15); expect(glowLevel(0.5)).toBeCloseTo(0.575)
    expect(GLOW_GLSL).toContain('float owGlowHalfWidth(')
    expect(GLOW_GLSL).toContain('0.150 + 0.850 * clamp(night, 0.0, 1.0)')
  })
})
```

`app/src/transit/__tests__/transitMaterials.test.js`:

```js
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { patchGlowShader, patchStructureShader, glowUniforms, structureUniforms, setLineMask, createGlowMaterial, createStructureMaterial } from '../transitMaterials.js'
import { facadeUniforms } from '../../world/materials/facadeMaterial.js'

const lib = (k) => ({ vertexShader: THREE.ShaderLib[k].vertexShader, fragmentShader: THREE.ShaderLib[k].fragmentShader, uniforms: {} })

describe('transit materials', () => {
  it('glow: expands a camera-facing ribbon from the tangent, width-compensated, lanes side by side', () => {
    const s = patchGlowShader(lib('basic'))
    for (const a of ['_side', '_lane', '_lanes', '_line', '_intensity', '_ghost']) expect(s.vertexShader).toContain(`attribute float ${a};`)
    expect(s.vertexShader).toContain('owGlowHalfWidth(owDist, uTanHalfFov, uViewportH, uMinPx, uBaseHalf)')
    expect(s.vertexShader).toContain('_lane * 2.0 * owHw + _side * owHw')
    expect(s.fragmentShader).toContain('owGlowLevel(uNight)')
    expect(s.uniforms.uNight).toBe(facadeUniforms.uNight)
    const m = createGlowMaterial()
    expect(m.transparent).toBe(true); expect(m.depthWrite).toBe(false); expect(m.side).toBe(THREE.DoubleSide); expect(m.vertexColors).toBe(true)
  })
  it('structure: kinds drive painted ties, polished rails, lit accents and signs', () => {
    const s = patchStructureShader(lib('standard'))
    expect(s.vertexShader).toContain('attribute float _kind;'); expect(s.vertexShader).toContain('attribute float _along;')
    expect(s.fragmentShader).toContain('fract(vAlong / 0.61)')
    expect(s.fragmentShader).toContain('if (owK == 4) totalEmissiveRadiance')
    expect(s.uniforms.uAccent).toBe(structureUniforms.uAccent)
    expect(createStructureMaterial().vertexColors).toBe(true)
    expect(() => patchStructureShader({ vertexShader: 'void main(){}', fragmentShader: '', uniforms: {} })).toThrow(/missing/)
  })
  it('the line mask switches single lines off by catalog index', () => {
    setLineMask([{ id: 'red', index: 0 }, { id: 'blue', index: 1 }, { id: 'up-n', index: 8 }], ['blue', 'up-n'])
    expect(glowUniforms.uLineOn.value[0]).toBe(1); expect(glowUniforms.uLineOn.value[1]).toBe(0)
    expect(glowUniforms.uLineOn.value[8]).toBe(0); expect(glowUniforms.uLineOn.value[2]).toBe(1)
    setLineMask([{ id: 'blue', index: 1 }], [])
    expect(glowUniforms.uLineOn.value[1]).toBe(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --prefix app -- src/transit/__tests__/glowWidth.test.js src/transit/__tests__/transitMaterials.test.js`
Expected: FAIL — `Failed to resolve import "../glowWidth.js"`

- [ ] **Step 3: Implement**

`app/src/transit/glowWidth.js`:

```js
// app/src/transit/glowWidth.js — how wide the line glow is: its physical strip up close, never under 2 px far away (B.3).
export const GLOW_DEFAULTS = { minPx: 2, baseHalfM: 0.18, dayLevel: 0.15 }

export const worldPerPixel = (dist, tanHalfFov, viewportH) => (2 * Math.max(0, dist) * tanHalfFov) / Math.max(1, viewportH)

export function glowHalfWidth(dist, tanHalfFov, viewportH, minPx = GLOW_DEFAULTS.minPx, baseHalfM = GLOW_DEFAULTS.baseHalfM) {
  return Math.max(baseHalfM, 0.5 * minPx * worldPerPixel(dist, tanHalfFov, viewportH))
}

// the neon rule (B.1.1): ~15 % by day, full at dusk and night
export function glowLevel(night, day = GLOW_DEFAULTS.dayLevel) {
  return day + (1 - day) * Math.min(1, Math.max(0, night))
}

const d = GLOW_DEFAULTS.dayLevel
export const GLOW_GLSL = /* glsl */ `
float owGlowHalfWidth(float dist, float tanHalfFov, float viewportH, float minPx, float baseHalf) {
  float wpp = 2.0 * max(dist, 0.0) * tanHalfFov / max(1.0, viewportH);
  return max(baseHalf, 0.5 * minPx * wpp);
}
float owGlowLevel(float night) { return ${d.toFixed(3)} + ${(1 - d).toFixed(3)} * clamp(night, 0.0, 1.0); }
`
```

`app/src/transit/transitMaterials.js`:

```js
// app/src/transit/transitMaterials.js — the two transit materials: vertex-coloured structure (steel, concrete,
// ballast with painted ties, lit signs, line-colour accents) and the camera-facing, width-compensated line glow.
import * as THREE from 'three'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'
import { GLOW_DEFAULTS, GLOW_GLSL } from './glowWidth.js'

export const MAX_LINES = 32
export const NIGHT_BOOST = 2.2   // HDR headroom at night so selective bloom (threshold 0.55) catches the glow
export const ACCENT_NIGHT = 1.4  // girder fascia emissive at night
export const glowUniforms = {
  uNight: facadeUniforms.uNight,
  uViewportH: { value: 1000 },
  uTanHalfFov: { value: Math.tan((42 * Math.PI) / 360) },
  uMinPx: { value: GLOW_DEFAULTS.minPx },
  uBaseHalf: { value: GLOW_DEFAULTS.baseHalfM },
  uLineOn: { value: new Float32Array(MAX_LINES).fill(1) },
  uGhost: { value: 0 }, // Scan (Phase 5) raises this to show subway track
}
export const structureUniforms = { uNight: facadeUniforms.uNight, uAccent: { value: 1 } }

const need = (src, marker, what) => {
  if (!src.includes(marker)) throw new Error(`${what} shader: missing ${marker}`)
  return marker
}

export function patchGlowShader(shader) {
  Object.assign(shader.uniforms, glowUniforms)
  const v = shader.vertexShader, f = shader.fragmentShader
  shader.vertexShader = v
    .replace(need(v, '#include <common>', 'glow'), `#include <common>
attribute float _side;
attribute float _lane;
attribute float _lanes;
attribute float _line;
attribute float _intensity;
attribute float _ghost;
uniform float uViewportH;
uniform float uTanHalfFov;
uniform float uMinPx;
uniform float uBaseHalf;
uniform float uLineOn[${MAX_LINES}];
uniform float uGhost;
varying float vGlowSide;
varying float vGlowOn;
${GLOW_GLSL}`)
    .replace(need(v, '#include <begin_vertex>', 'glow'), `#include <begin_vertex>
{
  vec4 owW = modelMatrix * vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    owW = modelMatrix * batchingMatrix * vec4(transformed, 1.0);
  #endif
  vec3 owTan = normalize(normal); // NORMAL carries the track tangent
  vec3 owToCam = cameraPosition - owW.xyz;
  float owDist = length(owToCam);
  vec3 owAcross = cross(owTan, owToCam / max(owDist, 1e-3));
  float owLen = length(owAcross);
  owAcross = owLen > 1e-4 ? owAcross / owLen : vec3(0.0, 1.0, 0.0);
  float owHw = owGlowHalfWidth(owDist, uTanHalfFov, uViewportH, uMinPx, uBaseHalf);
  transformed += owAcross * (_lane * 2.0 * owHw + _side * owHw);
  vGlowSide = _side;
  vGlowOn = uLineOn[int(_line + 0.5)] * mix(1.0, uGhost, _ghost) * _intensity;
}`)
  shader.fragmentShader = f
    .replace(need(f, '#include <common>', 'glow'), `#include <common>
uniform float uNight;
varying float vGlowSide;
varying float vGlowOn;
${GLOW_GLSL}`)
    .replace(need(f, '#include <opaque_fragment>', 'glow'), `outgoingLight = diffuseColor.rgb * (1.0 + ${NIGHT_BOOST.toFixed(1)} * uNight);
diffuseColor.a = (1.0 - smoothstep(0.35, 1.0, abs(vGlowSide))) * owGlowLevel(uNight) * vGlowOn;
if (diffuseColor.a < 0.004) discard;
#include <opaque_fragment>`)
  return shader
}

export function patchStructureShader(shader) {
  Object.assign(shader.uniforms, structureUniforms)
  const v = shader.vertexShader, f = shader.fragmentShader
  shader.vertexShader = v
    .replace(need(v, '#include <common>', 'structure'), `#include <common>
attribute float _kind;
attribute float _along;
varying float vKind;
varying float vAlong;`)
    .replace(need(v, '#include <begin_vertex>', 'structure'), `#include <begin_vertex>
vKind = _kind;
vAlong = _along;`)
  shader.fragmentShader = f
    .replace(need(f, '#include <common>', 'structure'), `#include <common>
uniform float uNight;
uniform float uAccent;
varying float vKind;
varying float vAlong;`)
    .replace(need(f, '#include <roughnessmap_fragment>', 'structure'), `#include <roughnessmap_fragment>
int owK = int(vKind + 0.5);
if (owK == 2) { // ballast with painted ties every 0.61 m
  float owTie = step(1.0 - 0.2 / 0.61, fract(vAlong / 0.61));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.12, 0.09), owTie * 0.85);
  roughnessFactor = 0.95;
}
if (owK == 3) roughnessFactor = 0.3;`)
    .replace(need(f, '#include <metalnessmap_fragment>', 'structure'), `#include <metalnessmap_fragment>
if (owK == 0 || owK == 3) metalnessFactor = 0.45;`)
    .replace(need(f, '#include <emissivemap_fragment>', 'structure'), `#include <emissivemap_fragment>
if (owK == 4) totalEmissiveRadiance += diffuseColor.rgb * (0.08 + ${ACCENT_NIGHT.toFixed(1)} * uNight) * uAccent;
if (owK == 6) totalEmissiveRadiance += diffuseColor.rgb * (0.25 + 1.2 * uNight);
if (owK == 7) totalEmissiveRadiance += vec3(1.0, 0.85, 0.6) * 0.5 * uNight;`)
  return shader
}

export function createGlowMaterial() {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
  m.onBeforeCompile = (s) => { patchGlowShader(s) }
  m.customProgramCacheKey = () => 'ow-transit-glow-v1'
  return m
}

export function createStructureMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.2 })
  m.onBeforeCompile = (s) => { patchStructureShader(s) }
  m.customProgramCacheKey = () => 'ow-transit-structure-v1'
  return m
}

export function setLineMask(lines, hidden) {
  const a = glowUniforms.uLineOn.value
  a.fill(1)
  for (const l of lines) if (l.index < MAX_LINES) a[l.index] = hidden.includes(l.id) ? 0 : 1
}
```

Ruling: the glow uses normal alpha blending, not additive. Additive blending of five Loop lines, plus two tracks at 1 km, sums to white; alpha blending keeps each colour nameable, and bloom still comes from the HDR colour at night — cost if wrong: a little less "neon" where lines overlap (a one-line `blending: THREE.AdditiveBlending` switch).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --prefix app -- src/transit/__tests__/glowWidth.test.js src/transit/__tests__/transitMaterials.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/transit/glowWidth.js app/src/transit/transitMaterials.js app/src/transit/__tests__/glowWidth.test.js app/src/transit/__tests__/transitMaterials.test.js
git commit -m "feat(transit): distance-compensated glow (2 px minimum, 15 % by day) and the structure material"
```

---

### Task 14: Transit pools, TransitLayer, tile wiring, store and data load

**Files:**
- Create: `app/src/transit/pools.js`, `app/src/transit/TransitLayer.jsx`
- Modify: `app/src/state/store.js`
- Modify: `app/src/world/TileContent.jsx` (the layer switch in `useMemo`; add the pool effect; drop ElevatedL)
- Delete: `app/src/world/ElevatedL.jsx`
- Modify: `app/src/world/Scene.jsx` (fetch `transit.json`; mount `<TransitLayer />`)
- Test: `app/src/transit/__tests__/pools.test.js`, `app/src/state/__tests__/store.test.js`

**Interfaces:**
- Consumes: `createStructureMaterial`, `createGlowMaterial`, `glowUniforms`, `structureUniforms` and `setLineMask` (Task 13); `worldUrl(file, version)` (V1); `QUALITY` (`app/src/lib/quality.js`).
- Produces (`pools.js`):
  - `TRANSIT_LAYERS = ['transit', 'ties', 'stations', 'glow']`
  - `POOL_OF = { transit, ties, stations → 'structure'; glow → 'glow' }`
  - `ATTRS = { structure: ['position', 'normal', 'color', '_kind', '_along'], glow: ['position', 'normal', 'color', '_side', '_lane', '_lanes', '_line', '_intensity', '_ghost'] }`
  - `toPoolGeometry(geometry, matrix, names) → BufferGeometry`: Float32, dequantized, indexed, with `matrix` baked in.
  - `createPool(material, cap) → { mesh: THREE.BatchedMesh, count, add(geometry) → handle, remove(handle) }`
  - `getTransitPools() → { structure, glow }` (a lazy singleton) and `resetTransitPools()` (tests).
  - `addTileLayer(layer, geometry, matrix, quality?) → handle | null`. `ties` at LOW gives `null`.
  - `removeTileLayer(handle)`
- Produces (store):
  - `transit: object | null` and `setTransit(json)`
  - `transitOn: true`, `setTransitOn(bool)` and `toggleTransit()`, the names V7 relies on
  - `hiddenLines: string[]`, `toggleLine(id)` and `setHiddenLines(ids)`
- Produces (`TransitLayer`): renders both pools, which is ≤ 3 draw calls (structure, structure shadow, glow). Under `?stats` it exposes `window.__transitPools`.

- [ ] **Step 1: Write the failing tests**

`app/src/transit/__tests__/pools.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import * as THREE from 'three'
import { toPoolGeometry, createPool, addTileLayer, removeTileLayer, getTransitPools, resetTransitPools, ATTRS, TRANSIT_LAYERS } from '../pools.js'

const geo = (names, n = 3) => {
  const g = new THREE.BufferGeometry()
  for (const a of names) g.setAttribute(a, new THREE.BufferAttribute(new Float32Array(n * (['position', 'normal', 'color'].includes(a) ? 3 : 1)).fill(0.5), ['position', 'normal', 'color'].includes(a) ? 3 : 1))
  return g
}

describe('transit pools', () => {
  beforeEach(() => resetTransitPools())
  it('dequantizes normalized attributes and bakes the tile node matrix (meshopt quantization)', () => {
    const g = geo(ATTRS.structure)
    g.setAttribute('position', new THREE.BufferAttribute(new Int16Array([0, 0, 0, 32767, 0, 0, 0, 0, 32767]), 3, true))
    const m = new THREE.Matrix4().makeTranslation(1000, 0, 0).multiply(new THREE.Matrix4().makeScale(500, 500, 500))
    const out = toPoolGeometry(g, m, ATTRS.structure)
    expect(Array.from(out.getAttribute('position').array).map((v) => Math.round(v))).toEqual([1000, 0, 0, 1500, 0, 0, 1000, 0, 500])
    expect(out.getAttribute('position').array).toBeInstanceOf(Float32Array)
    expect(Array.from(out.index.array)).toEqual([0, 1, 2])
    expect(() => toPoolGeometry(geo(['position']), new THREE.Matrix4(), ATTRS.structure)).toThrow(/lacks normal/)
  })
  it('tile layers join one of two batched meshes and leave again', () => {
    const p = getTransitPools()
    expect(p.structure.mesh).toBeInstanceOf(THREE.BatchedMesh); expect(p.glow.mesh).toBeInstanceOf(THREE.BatchedMesh)
    const a = addTileLayer('transit', geo(ATTRS.structure), new THREE.Matrix4(), 'HIGH')
    const b = addTileLayer('stations', geo(ATTRS.structure), new THREE.Matrix4(), 'HIGH')
    const c = addTileLayer('glow', geo(ATTRS.glow), new THREE.Matrix4(), 'HIGH')
    expect(p.structure.count).toBe(2); expect(p.glow.count).toBe(1)
    removeTileLayer(a); removeTileLayer(c)
    expect(p.structure.count).toBe(1); expect(p.glow.count).toBe(0)
    removeTileLayer(b); removeTileLayer(null)
    expect(TRANSIT_LAYERS).toEqual(['transit', 'ties', 'stations', 'glow'])
  })
  it('LOW quality skips tie geometry; unknown layers are ignored', () => {
    expect(addTileLayer('ties', geo(ATTRS.structure), new THREE.Matrix4(), 'LOW')).toBeNull()
    expect(addTileLayer('buildings', geo(ATTRS.structure), new THREE.Matrix4(), 'HIGH')).toBeNull()
    expect(getTransitPools().structure.count).toBe(0)
  })
  it('a full pool grows instead of dropping a tile', () => {
    const pool = createPool(new THREE.MeshBasicMaterial(), { instances: 2, vertices: 4, indices: 4 })
    for (let i = 0; i < 5; i++) pool.add(toPoolGeometry(geo(ATTRS.structure), new THREE.Matrix4(), ATTRS.structure))
    expect(pool.count).toBe(5)
  })
})
```

Append to `app/src/state/__tests__/store.test.js`, inside `describe('store', …)`:

```js
  it('transit: data, on/off, per-line visibility', () => {
    const s = useStore.getState()
    expect(s.transit).toBeNull(); expect(s.transitOn).toBe(true); expect(s.hiddenLines).toEqual([])
    s.setTransit({ lines: [] }); expect(useStore.getState().transit).toEqual({ lines: [] })
    s.toggleLine('red'); expect(useStore.getState().hiddenLines).toEqual(['red'])
    s.toggleLine('red'); expect(useStore.getState().hiddenLines).toEqual([])
    s.toggleTransit(); expect(useStore.getState().transitOn).toBe(false)
    s.setTransitOn(true); expect(useStore.getState().transitOn).toBe(true)
    s.setHiddenLines(['a', 'b']); expect(useStore.getState().hiddenLines).toEqual(['a', 'b'])
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --prefix app -- src/transit/__tests__/pools.test.js src/state/__tests__/store.test.js`
Expected: FAIL — `Failed to resolve import "../pools.js"`; `expected undefined to be null` (store)

- [ ] **Step 3: Implement**

`app/src/transit/pools.js`:

```js
// app/src/transit/pools.js — every streamed tile's transit meshes drawn by two batched meshes, so the whole
// network costs ≤ 3 draw calls (structure, its shadow, glow) however many tiles are loaded (B.1.6).
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { createStructureMaterial, createGlowMaterial } from './transitMaterials.js'

export const TRANSIT_LAYERS = ['transit', 'ties', 'stations', 'glow']
export const POOL_OF = { transit: 'structure', ties: 'structure', stations: 'structure', glow: 'glow' }
export const ATTRS = {
  structure: ['position', 'normal', 'color', '_kind', '_along'],
  glow: ['position', 'normal', 'color', '_side', '_lane', '_lanes', '_line', '_intensity', '_ghost'],
}
const CAP = { structure: { instances: 2048, vertices: 1_500_000, indices: 3_000_000 }, glow: { instances: 4096, vertices: 400_000, indices: 800_000 } }
const GET = ['getX', 'getY', 'getZ', 'getW']

// Tiles are meshopt-quantized (normalized ints + a node transform); pools need one plain Float32 layout.
export function toPoolGeometry(src, matrix, names) {
  const g = new THREE.BufferGeometry()
  for (const n of names) {
    const a = src.getAttribute(n)
    if (!a) throw new Error(`transit pool: tile mesh lacks ${n}`)
    const out = new Float32Array(a.count * a.itemSize)
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a[GET[k]](i)
    g.setAttribute(n, new THREE.BufferAttribute(out, a.itemSize))
  }
  const count = g.getAttribute('position').count
  g.setIndex(new THREE.BufferAttribute(src.index ? Uint32Array.from(src.index.array) : Uint32Array.from({ length: count }, (_, i) => i), 1))
  g.applyMatrix4(matrix)
  return g
}

export function createPool(material, cap) {
  const mesh = new THREE.BatchedMesh(cap.instances, cap.vertices, cap.indices, material)
  const size = { instances: cap.instances, vertices: cap.vertices, indices: cap.indices }
  const pool = {
    mesh, count: 0,
    add(geometry) {
      const v = geometry.getAttribute('position').count, i = geometry.index.count
      let gid
      try { gid = mesh.addGeometry(geometry) } catch {
        mesh.optimize()
        try { gid = mesh.addGeometry(geometry) } catch {
          size.vertices = Math.ceil((size.vertices + v) * 1.5); size.indices = Math.ceil((size.indices + i) * 1.5)
          mesh.setGeometrySize(size.vertices, size.indices)
          gid = mesh.addGeometry(geometry)
        }
      }
      if (pool.count >= size.instances) { size.instances *= 2; mesh.setInstanceCount(size.instances) }
      const iid = mesh.addInstance(gid)
      pool.count++
      return { gid, iid }
    },
    remove(h) {
      if (!h) return
      mesh.deleteInstance(h.iid); mesh.deleteGeometry(h.gid); pool.count--
    },
  }
  return pool
}

let pools = null
export function getTransitPools() {
  pools ??= { structure: createPool(createStructureMaterial(), CAP.structure), glow: createPool(createGlowMaterial(), CAP.glow) }
  return pools
}
export function resetTransitPools() { pools = null }

export function addTileLayer(layer, geometry, matrix, quality = useStore.getState().quality) {
  const which = POOL_OF[layer]
  if (!which) return null
  if (layer === 'ties' && quality === 'LOW') return null // LOW: no tie geometry; the deck still reads as track
  return { which, h: getTransitPools()[which].add(toPoolGeometry(geometry, matrix, ATTRS[which])) }
}
export function removeTileLayer(handle) { if (handle) getTransitPools()[handle.which].remove(handle.h) }
```

`app/src/transit/TransitLayer.jsx`:

```jsx
// app/src/transit/TransitLayer.jsx — draws the pooled track structure, stations and line glow;
// keeps the glow's viewport/fov uniforms, line mask and on/off in step with the app.
import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useStore } from '../state/store.js'
import { QUALITY } from '../lib/quality.js'
import { getTransitPools } from './pools.js'
import { glowUniforms, structureUniforms, setLineMask } from './transitMaterials.js'

export default function TransitLayer() {
  const pools = getTransitPools()
  const quality = useStore((s) => s.quality)
  const on = useStore((s) => s.transitOn)
  const hidden = useStore((s) => s.hiddenLines)
  const lines = useStore((s) => s.transit?.lines)
  useEffect(() => { setLineMask(lines ?? [], hidden) }, [lines, hidden])
  useEffect(() => { structureUniforms.uAccent.value = on ? 1 : 0; pools.glow.mesh.visible = on }, [on, pools])
  useEffect(() => { if (new URLSearchParams(window.location.search).has('stats')) window.__transitPools = pools }, [pools])
  useFrame(({ camera, size, gl }) => {
    glowUniforms.uViewportH.value = size.height * gl.getPixelRatio()
    glowUniforms.uTanHalfFov.value = Math.tan(((camera.fov ?? 42) * Math.PI) / 360)
  })
  return (
    <>
      <primitive object={pools.structure.mesh} castShadow={QUALITY[quality].shadows} receiveShadow />
      <primitive object={pools.glow.mesh} renderOrder={2} />
    </>
  )
}
```

`app/src/state/store.js`: inside `create((set) => ({ … }))`, after `setQuality: …,` add:

```js
  transit: null,
  setTransit: (transit) => set({ transit }),
  transitOn: true,
  setTransitOn: (transitOn) => set({ transitOn }),
  toggleTransit: () => set((s) => ({ transitOn: !s.transitOn })),
  hiddenLines: [],
  setHiddenLines: (hiddenLines) => set({ hiddenLines }),
  toggleLine: (id) => set((s) => ({ hiddenLines: s.hiddenLines.includes(id) ? s.hiddenLines.filter((x) => x !== id) : [...s.hiddenLines, id] })),
```

`app/src/world/TileContent.jsx`:
- Delete `import ElevatedL from './ElevatedL.jsx'` and the JSX line `{side?.columns?.length > 0 && <ElevatedL columns={side.columns} />}`.
- Delete the `else if (layer === 'elevated') { … }` branch in the `useMemo` traverse. If V1 has already rewritten that branch, delete whatever `'elevated'` handling remains.
- Add the import `import { TRANSIT_LAYERS, addTileLayer, removeTileLayer } from '../transit/pools.js'`.
- In the `useMemo` traverse, directly after `const layer = o.name || o.parent?.name`, add:
  ```js
      if (TRANSIT_LAYERS.includes(layer)) { o.visible = false; return } // drawn by the transit pools
  ```
- After the `useMemo`, add:
  ```js
    // hand this tile's track, stations and glow to the shared batched meshes; take them back on unmount
    useEffect(() => {
      const handles = []
      scene.updateMatrixWorld(true)
      scene.traverse((o) => {
        const layer = o.name || o.parent?.name
        if (o.isMesh && TRANSIT_LAYERS.includes(layer)) handles.push(addTileLayer(layer, o.geometry, o.matrixWorld))
      })
      return () => handles.forEach(removeTileLayer)
    }, [scene])
  ```

Run `git rm app/src/world/ElevatedL.jsx`.

`app/src/world/Scene.jsx`:
- Add the import `import TransitLayer from '../transit/TransitLayer.jsx'`.
- Inside `loadManifest().then((r) => { … })`, after the `landMask` fetch line, add:
  ```js
        if (r.manifest.transit) fetch(worldUrl(r.manifest.transit, r.manifest.version)).then((x) => (x.ok ? x.json() : null)).then((j) => j && useStore.getState().setTransit(j)).catch(() => {})
  ```
  V1 already imports `worldUrl` here.
- In the returned JSX, directly after `{manifest && <TileStreamer manifest={manifest} />}`, add `<TransitLayer />`.

Ruling: switching to LOW mid-session keeps the tie geometry of tiles that are already loaded; new tiles load without ties — cost if wrong: a few extra triangles until those tiles stream out.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --prefix app`
Expected: PASS (all; the 4 new pool tests and the new store test included; nothing imports `ElevatedL`)

- [ ] **Step 5: Commit**

```bash
git add app/src/transit/pools.js app/src/transit/TransitLayer.jsx app/src/transit/__tests__/pools.test.js app/src/state/store.js app/src/state/__tests__/store.test.js app/src/world/TileContent.jsx app/src/world/Scene.jsx
# the ElevatedL.jsx deletion is already staged by `git rm` in Step 3
git commit -m "feat(transit): tiles hand track/stations/glow to two batched pools (3 draw calls); transit state + data load"
```

---

### Task 15: Transit HUD — dock button, legend, T key, ⌘K, help and hint

**Files:**
- Create: `app/src/hud/TransitLegend.jsx`
- Modify: `app/src/hud/ControlDock.jsx`, `app/src/hud/ControlDock.css`, `app/src/hud/ControlPills.jsx`, `app/src/hud/CommandPalette.jsx`, `app/src/hud/HelpOverlay.jsx`, `app/src/hud/HintBar.jsx`, `app/src/hud/Hud.jsx`, `app/src/hud/Hud.css`
- Test: `app/src/hud/__tests__/transit.test.jsx`

**Interfaces:**
- Consumes: the store's `transit`, `transitOn`, `toggleTransit`, `setTransitOn`, `hiddenLines`, `toggleLine` and `setHiddenLines` (Task 14).
- Produces:
  - a dock button whose accessible name is `Transit lines: on (T)`, `Transit lines: off (T)` or `Transit lines: data unavailable`, with `aria-pressed`, and `aria-disabled` when there is no data;
  - `<TransitLegend />` (role `group`, name `Transit lines`), with a button per line (`aria-pressed` = shown) and All / None / collapse;
  - the `T` key (ignored while typing or with no data);
  - the ⌘K command `Transit lines on / off`;
  - a help-card group `Transit` and a hint `T transit`.
- V7 later folds the dock button and the `T` key into its feature registry, keeping the names above.

- [ ] **Step 1: Write the failing test** — `app/src/hud/__tests__/transit.test.jsx`:

```jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import Hud from '../Hud.jsx'
import { useStore } from '../../state/store.js'

const transit = { lines: [
  { id: 'red', name: 'Red Line', operator: 'cta', colour: '#c60c30', index: 0 },
  { id: 'up-n', name: 'Union Pacific North', operator: 'metra', colour: '#005596', index: 8 },
], routes: [], stations: [] }

describe('transit HUD', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState()); useStore.setState({ transit })
    try { localStorage.setItem('chi-ow-help-seen', '1') } catch {}
  })
  it('the Transit dock button turns lines, glow and legend off and on', () => {
    render(<Hud />)
    expect(screen.getByRole('group', { name: 'Transit lines' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Transit lines: on (T)' }))
    expect(useStore.getState().transitOn).toBe(false)
    expect(screen.queryByRole('group', { name: 'Transit lines' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Transit lines: off (T)' })).toHaveAttribute('aria-pressed', 'false')
  })
  it('each line has its own switch; All / None', () => {
    render(<Hud />)
    const red = screen.getByRole('button', { name: /Red Line/ })
    expect(red).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(red)
    expect(useStore.getState().hiddenLines).toEqual(['red'])
    fireEvent.click(screen.getByRole('button', { name: 'None' })); expect(useStore.getState().hiddenLines).toEqual(['red', 'up-n'])
    fireEvent.click(screen.getByRole('button', { name: 'All' })); expect(useStore.getState().hiddenLines).toEqual([])
    expect(screen.getByText('Metra')).toBeInTheDocument()
  })
  it('T toggles transit, but not while typing', () => {
    render(<Hud />)
    fireEvent.keyDown(window, { code: 'KeyT' }); expect(useStore.getState().transitOn).toBe(false)
    const input = document.createElement('input'); document.body.appendChild(input)
    fireEvent.keyDown(input, { code: 'KeyT' }); expect(useStore.getState().transitOn).toBe(false)
    input.remove()
  })
  it('without transit data the button is disabled and nothing breaks', () => {
    useStore.setState({ transit: null })
    render(<Hud />)
    const b = screen.getByRole('button', { name: 'Transit lines: data unavailable' })
    expect(b).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(b); fireEvent.keyDown(window, { code: 'KeyT' })
    expect(useStore.getState().transitOn).toBe(true)
    expect(screen.queryByRole('group', { name: 'Transit lines' })).toBeNull()
  })
  it('⌘K, the help card and the hint bar know transit', () => {
    render(<Hud />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'transit' } })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(useStore.getState().transitOn).toBe(false)
    act(() => useStore.getState().setHelpOpen(true))
    expect(screen.getByText(/CTA and Metra lines, their glow and the legend/)).toBeInTheDocument()
    expect(document.querySelector('.hud-hints').textContent).toMatch(/T\s*transit/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix app -- src/hud/__tests__/transit.test.jsx`
Expected: FAIL — `Unable to find role="group" and name "Transit lines"`

- [ ] **Step 3: Implement**

Create `app/src/hud/TransitLegend.jsx`:

```jsx
// app/src/hud/TransitLegend.jsx — the line legend: a swatch and an on/off switch for every line in the world.
import { useState } from 'react'
import { RiArrowDownSLine, RiArrowUpSLine } from 'react-icons/ri'
import { useStore } from '../state/store.js'

export default function TransitLegend() {
  const transit = useStore((s) => s.transit)
  const on = useStore((s) => s.transitOn)
  const hidden = useStore((s) => s.hiddenLines)
  const [open, setOpen] = useState(true)
  if (!transit || !on) return null
  const { toggleLine, setHiddenLines } = useStore.getState()
  const groups = [['CTA L', transit.lines.filter((l) => l.operator === 'cta')], ['Metra', transit.lines.filter((l) => l.operator === 'metra')]]
  return (
    <div className="hud-panel transit-legend" role="group" aria-label="Transit lines">
      <div className="tl-head">
        <span className="hud-label">Transit lines</span>
        <button type="button" className="tl-mini" onClick={() => setHiddenLines([])}>All</button>
        <button type="button" className="tl-mini" onClick={() => setHiddenLines(transit.lines.map((l) => l.id))}>None</button>
        <button type="button" className="tl-mini" aria-label={open ? 'Collapse legend' : 'Expand legend'} onClick={() => setOpen(!open)}>{open ? <RiArrowDownSLine /> : <RiArrowUpSLine />}</button>
      </div>
      {open && groups.map(([title, lines]) => lines.length > 0 && (
        <section key={title}>
          <h3 className="hud-label tl-group">{title}</h3>
          {lines.map((l) => {
            const shown = !hidden.includes(l.id)
            return (
              <button key={l.id} type="button" className={`tl-line${shown ? ' on' : ''}`} aria-pressed={shown} onClick={() => toggleLine(l.id)}>
                <i className="tl-swatch" style={{ background: l.colour }} />
                <span>{l.name}</span>
              </button>
            )
          })}
        </section>
      ))}
    </div>
  )
}
```

`app/src/hud/ControlDock.jsx`:
- Import `RiTrainLine` alongside the other `react-icons/ri` imports.
- Replace `function Btn(…) { … }` with:
  ```jsx
  function Btn({ label, onClick, children, wide, pressed, disabled }) {
    return (
      <button type="button" className={`dock-btn${wide ? ' wide' : ''}${pressed ? ' active' : ''}`} aria-label={label} title={label}
        aria-pressed={pressed} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onClick}>{children}</button>
    )
  }
  ```
- In `ControlDock()`, add `const transit = useStore((s) => s.transit)` and `const transitOn = useStore((s) => s.transitOn)`.
- Insert this row before the row that holds `Home view (H)`:
  ```jsx
        <div className="dock-row">
          <Btn label={transit ? `Transit lines: ${transitOn ? 'on' : 'off'} (T)` : 'Transit lines: data unavailable'} pressed={transit ? transitOn : undefined}
            disabled={!transit} onClick={() => useStore.getState().toggleTransit()} wide>
            <RiTrainLine /><span>Transit</span><span className="hud-kbd">T</span>
          </Btn>
        </div>
  ```

Append to `app/src/hud/ControlDock.css`:

```css
.dock-btn.active { color: var(--accent); border-color: rgba(var(--accent-rgb), 0.45); background: rgba(var(--accent-rgb), 0.08); }
.dock-btn[aria-disabled="true"] { opacity: 0.4; cursor: default; }
```

`app/src/hud/ControlPills.jsx`: inside `onKey`, after `if (e.code === 'KeyO') …`, add:

```js
      if (e.code === 'KeyT' && useStore.getState().transit) useStore.getState().toggleTransit()
```

`app/src/hud/CommandPalette.jsx`: in `commands()`, before the `c:help` entry, add:

```js
    { id: 'tr:toggle', kind: 'command', name: 'Transit lines on / off', sub: 'T', run: () => s.toggleTransit() },
```

`app/src/hud/HelpOverlay.jsx`: add to `GROUPS`, after the `'Time and quality'` entry:

```js
  ['Transit', [['T', 'or the Transit button — CTA and Metra lines, their glow and the legend'], ['Legend', 'click a line to hide or show it; All / None']]],
```

`app/src/hud/HintBar.jsx`: in `HINTS`, insert `['T', 'transit'],` before `['?', 'help']`.

`app/src/hud/Hud.jsx`: import `TransitLegend from './TransitLegend.jsx'` and render `<TransitLegend />` after `<ControlDock />`.

Append to `app/src/hud/Hud.css`:

```css
.transit-legend { position: absolute; left: 16px; bottom: 56px; width: 232px; max-height: 46vh; overflow: auto; padding: 10px 10px 8px; display: flex; flex-direction: column; gap: 4px; animation: hud-rise 0.5s ease both; }
.tl-head { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
.tl-head .hud-label { flex: 1; }
.tl-mini { background: none; border: 1px solid var(--border); border-radius: var(--r-sm); color: var(--text-muted); font: 500 10px var(--font-ui); letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 6px; cursor: pointer; display: inline-flex; align-items: center; }
.tl-mini:hover { color: var(--text); border-color: var(--border-strong); }
.tl-group { margin: 6px 0 2px; }
.tl-line { display: flex; align-items: center; gap: 8px; width: 100%; background: none; border: 0; padding: 3px 4px; border-radius: var(--r-sm); color: var(--text-faint); font: 500 12px var(--font-ui); cursor: pointer; text-align: left; }
.tl-line.on { color: var(--text); }
.tl-line:hover { background: rgba(var(--accent-rgb), 0.06); }
.tl-swatch { width: 18px; height: 4px; border-radius: 2px; opacity: 0.35; box-shadow: none; }
.tl-line.on .tl-swatch { opacity: 1; box-shadow: 0 0 6px currentColor; }
.hud-root[data-compact="true"] .transit-legend { max-height: 30vh; width: 200px; }
```

Ruling: the legend can be collapsed with a chevron, so it never covers the city on small windows — cost if wrong: one extra click.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --prefix app`
Expected: PASS (all, including the 5 new transit HUD tests; the existing help, palette and hud tests are unchanged)

- [ ] **Step 5: Commit**

```bash
git add app/src/hud/TransitLegend.jsx app/src/hud/ControlDock.jsx app/src/hud/ControlDock.css app/src/hud/ControlPills.jsx app/src/hud/CommandPalette.jsx app/src/hud/HelpOverlay.jsx app/src/hud/HintBar.jsx app/src/hud/Hud.jsx app/src/hud/Hud.css app/src/hud/__tests__/transit.test.jsx
git commit -m "feat(hud): Transit button, line legend with per-line switches, T key, ⌘K command, help + hint"
```

---

### Task 16: AFTER shots, evaluate-and-revert, perf check

**Files:**
- Modify: `.superpowers/sdd/2026-09-29-v3-transit-lines/progress.md` (the ledger; gitignored)
- Possibly revert: the commits of Task 8 (S), Task 13 (G), the `accent` call (A) or Task 10 (T), each in its own commit

**Interfaces:**
- Consumes: the Task 1 specs and BEFORE shots; `window.__transitPools` (Task 14).

- [ ] **Step 1: Capture the AFTER shots and perf** (heavy — nothing else running)

```bash
cd app
SHOTS_DIR="$PWD/../.superpowers/sdd/2026-09-29-v3-transit-lines/shots/after" npx playwright test e2e/transit-poses.spec.js --workers=1
PERF_LOG="$PWD/../.superpowers/sdd/2026-09-29-v3-transit-lines/perf-after.jsonl" npx playwright test e2e/transit-perf.spec.js --workers=1
cd ..
```

Expected: `12 passed`, `3 passed`. Every perf line has `transit.calls ≤ 3`, `calls ≤ 900` and `tris ≤ 4000000`.

If `transit.calls > 3`, the pools are being drawn more than once. Check that TileContent hides the transit meshes (`o.visible = false`), then re-run. If `calls > 900`, V3 is not the cause when the before/after delta is ≤ 3. Log it for V8, and do not block on it.

- [ ] **Step 2: Evaluate** — for each pose × time, Read `shots/before/<pose>-<time>.png`, then `shots/after/<pose>-<time>.png`. Apply the checklist (a)–(e) under "Screenshot poses" to the items S, G, A and T. Write one ledger line per item, `Keep: S — …` or `Tune: G — dayLevel 0.15 → 0.10 …`.

- [ ] **Step 3: Tune once, if an item failed.** Change only that item's knob:
  - G: `GLOW_DEFAULTS.dayLevel`, `NIGHT_BOOST` or `GLOW_DEFAULTS.baseHalfM` (app only — no rebuild);
  - A: `ACCENT_NIGHT` (app only);
  - S / T: `COLOURS` in `structure.js` or `stationLooks` (these need a world rebuild).

  Run the matching unit tests (`npm test --prefix app` or `npm test --prefix pipeline`), re-shoot only the failing poses (`POSES=<list>`), and re-evaluate. Commit the tune with `git commit -am "tune(v3): <item> <knob> <old> → <new> — evaluate-and-revert"`.

- [ ] **Step 4: Revert what still fails.**
  - G or A: `git revert --no-edit <sha of the Task 13 commit>`, or remove the `accent(m, pts, colours)` call in `elevatedPiece` and rebuild.
  - S or T: revert that task's commit and rebuild the world.
  - Each revert is its own commit, `revert(v3): <item> — evaluate-and-revert`, with a `Revert:` ledger line that states the reason.
  - A reverted G removes C3. Record it as `Revert: G … — C3 reopened for V8 review`.

- [ ] **Step 5: Log the perf check** — add to the ledger:
  ```
  Perf V3: streeterville calls A (transit +a) tris B fps C · loop … · transit1000 …
  ```
  Also add `Budget: transit 3/12 calls used by V3`.

---

### Task 17: End of milestone — suites, e2e baselines, README gallery, roadmap, push

**Files:**
- Modify: `README.md`: append a gallery subsection and update the roadmap line. Existing images are never touched.
- Create: `docs/screenshots/v3-transit-loop-night.png`, `docs/screenshots/v3-transit-tower18-day.png`, `docs/screenshots/v3-transit-northside-dusk.png`
- Modify: the `app/e2e/hero-view.spec.js-snapshots/*` whose views show track (intentionally regenerated)

- [ ] **Step 1: Both suites green**

Run: `npm test --prefix pipeline && npm test --prefix app`
Expected: PASS (both)

- [ ] **Step 2: Regenerate only the baselines V3 changed, then 3 consecutive green e2e runs** (heavy)

```bash
cd app
npx playwright test e2e/hero-view.spec.js --workers=1 --update-snapshots -g "loop|river|willis|westloop|wrigleyville"
for i in 1 2 3; do npx playwright test e2e/hero-view.spec.js --workers=1 || break; done
cd ..
```

Expected: the three runs print `10 passed`. Streeterville, museum, hancock and navypier keep their old baselines. If one of them now differs because track is visible in it, regenerate that one too, and add `Ruling: baseline <view> regenerated — track now visible`.

- [ ] **Step 3: Gallery images** — copy three AFTER shots under new names (they are never overwritten later):

```bash
cp .superpowers/sdd/2026-09-29-v3-transit-lines/shots/after/transit150-night.png docs/screenshots/v3-transit-loop-night.png
cp .superpowers/sdd/2026-09-29-v3-transit-lines/shots/after/wellslake-day.png docs/screenshots/v3-transit-tower18-day.png
cp .superpowers/sdd/2026-09-29-v3-transit-lines/shots/after/northside-dusk.png docs/screenshots/v3-transit-northside-dusk.png
```

If Task 16 reverted G, pick day shots instead of the night one, and caption them honestly.

- [ ] **Step 4: README** — in "How it came together", after the last `### ` gallery subsection (V1/V2 add theirs first) and before the line `Everything is reachable with the keyboard…`, append:

```markdown
### Vision pass · V3 transit — *the L and Metra in their true colours*

<table>
<tr>
<td width="33%"><img src="docs/screenshots/v3-transit-loop-night.png" alt="V3 — the Loop at night, each line glowing in its CTA colour" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v3-transit-tower18-day.png" alt="V3 — Tower 18 at Lake and Wells from the street" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v3-transit-northside-dusk.png" alt="V3 — Fullerton's four-track corridor at dusk" width="100%"/></td>
</tr>
<tr>
<td><em>Every CTA and Metra line from OpenStreetMap, in official colours — the Loop shows each line sharing the track side by side.</em></td>
<td><em>The L as steel: bents, plate girders, ties, running and third rails, and the Tower 18 junction box.</em></td>
<td><em>Stations with platforms, canopies, stairs and line-colour signs; the glow stays a tint by day and blooms at night.</em></td>
</tr>
</table>
```

In "Controls", add the row `` | `T` · Transit button | CTA and Metra lines on/off; the legend switches single lines | ``. In "Roadmap", leave the "Vision pass" checkbox open, and append ` — **V3 transit lines ✓**` to its line.

- [ ] **Step 5: Ledger + commit + push**

Add the ledger lines `V3 done: C1 C2 C3 C4 C5 C10 C13 — <keep/revert summary>` and `Perf: …` (from Task 16).

```bash
git add README.md docs/screenshots/v3-transit-loop-night.png docs/screenshots/v3-transit-tower18-day.png docs/screenshots/v3-transit-northside-dusk.png app/e2e/hero-view.spec.js-snapshots
git commit -m "docs(v3): transit gallery, controls and roadmap; e2e baselines with track"
git push origin main
```

Expected: the push succeeds. Close the browser and the dev server.

---

## Self-review (done while writing)

- **Spec coverage:**
  - C1: Tasks 2, 3, 4, 11 and 12 (`validateTransit` presence and segment counts).
  - C2: Task 2 (colour test), Task 6 (lanes) and Task 9 (strips).
  - C3: Tasks 9 and 13; Task 16 checks it at 3 distances.
  - C4: Task 8 (structure) and Task 1 (`wellslake` pose).
  - C5: Task 5 (grades and ramps) and Task 8 (embankment, portal); subway track is ghosted in the glow for Scan.
  - C10: Task 10, plus the required-station check in Task 11.
  - C13: Task 15.
  - B.1.6: Task 14 (pools) and Task 16 (perf log).
  - The glow's day/night intensity: `glowLevel` / `owGlowLevel` (Task 13).
- **Cross-plan names:**
  - `transitOn`, `setTransitOn` (V7);
  - `worldUrl`, the settle flags and `{ before, after }` (V1);
  - `validateLook` and `styles.add` (V2);
  - `clearanceAt` is not used by V3; V4's follow cam uses it.
- **Types:**
  - `pts3` is always `[x, y, z]`; only `byTile` converts to and from `[x, z, y]` for `splitLineByTiles`.
  - Glow `_LINE` is the catalog index, the same index `setLineMask` receives through `transit.json` → `lines[].index`.
