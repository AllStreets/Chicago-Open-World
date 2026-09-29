# V1 — Correctness, Camera Clearance, Unified Water Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start until the user has said "go ahead"** (master plan, backlog A7).

**Goal:** Close the Phase 2.5 review minors (H1–H10), keep the camera out of buildings (G1, G2), fix ⌘K/Ctrl+K (G4) and the e2e settle (G5), clear the trees off every venue (D1), and turn the river, harbours, lagoons and Lake Michigan into one continuous, reflective body of water (B1–B10).

**Architecture:** The pipeline gains small pure modules: `trees`, `water`, `blocks`, `raster`, `lake`, `shore`, `heightfield` and `manifest`. `build-world.js` uses them to write tile format v4:
- `_CALM` on water;
- `ground/lake.glb`;
- `water/shore.png`;
- `heightfield.png`;
- a unique `_BLDG` per file.

In the app, one `WaterSurface` ShaderMaterial draws the lake mesh and every tile's water. It samples one shared half-resolution planar reflection, rendered once per frame by `WaterRig` from a mirrored camera that sees only a `REFLECT_LAYER`. `lib/clearance.js` decodes the heightfield. Flights and free flight clamp against `clearanceAt(x, z)`.

**Tech Stack:**
- Node 20+ ESM pipeline: earcut, polygon-clipping, sharp, gltf-transform + meshopt.
- Vite 8, React 19, @react-three/fiber 9, drei 10, three 0.186.
- zustand 5.
- Vitest 5 (jsdom in the app).
- Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md`, Addendum B (binding: B.1, B.2, B.4 first bullet, B.7, B.8) and Addendum A.
- Items: `docs/superpowers/backlog/2026-09-29-vision-backlog.md`.
- Ordering and tile-format rulings: `docs/superpowers/plans/2026-09-29-vision-master-plan.md`.

## Global Constraints

- **No human in the loop.** Decide and record `Ruling:` lines in the ledger `.superpowers/sdd/2026-09-29-v1-correctness-clearance-water/progress.md` (one line per task completion: `Task N: complete (commits a..b, tests: …)`). The four stop conditions of executing-plans still apply.
- **Budgets (B.1):**
  - HIGH: ≤ 900 draw calls per frame (shadow and post passes included), measured at the wide Streeterville and Loop poses.
  - ≤ 4 M triangles per frame; 60 fps on M-series.
  - `app/public/world` ≤ 200 MB.
  - Water may add ≤ 2 calls of its own, plus one shared reflection pass.
  - Every new system has a LOW fallback: at LOW, reflections are off.
- **Tile format (master plan, V1):**
  - `_CALM` is added to the water layer.
  - `water/shore.png` and `heightfield.png` are added.
  - `_BLDG` becomes unique per file.
  - Manifest **v4**.
- **Water values (B.2):**
  - `_CALM`: river 0.6, harbour or lagoon 0.35, open lake 1.0.
  - Lake plane at y = 0.02; polygon water at y = 0.04.
  - Shore texture at 4 m/px.
  - Lake 120 km E–W × 160 km N–S, centred on the shoreline.
  - Reflection at ½ resolution at HIGH, off at LOW.
  - The river turns green on March 17.
- **Camera (B.7):**
  - The heightfield is the max roof height per 8 m cell.
  - Clearance = height + 25 m.
  - Flights lift both their path and their end pose.
  - Free flight slides rather than stops.
  - The interface other plans consume is `app/src/lib/clearance.js` → `clearanceAt(x, z) → number` and `loadHeightfield(url, grid) → Promise<void>`.
- **Evaluate and revert:**
  - Every visual change gets day/dusk/night screenshots at fixed poses before and after (`app/scripts/capture.mjs`, Task 20).
  - An unpleasing change is reverted in its own commit, with a ledger line.
  - Eval shots live under the ledger folder (git-ignored). Only curated gallery shots go to `docs/screenshots/v1-<subject>-<time>.png`.
- **README:** never modify an existing image. Append to the "How it came together" gallery.
- **Human-first:** every feature has a button, a ⌘K entry and a help-card line. URL parameters are for tests only (`?view`, `?time`, `?stats`, `?reflect=0`).
- **RAM discipline:** one heavy process at a time (world build, or dev server + Playwright). Close browsers when done.
- **TDD:** a failing test first for every pure function, builder and state machine.
- **Commits:** every commit message ends with the trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` (written below as a second `-m`).
- **Coordinates:** local metres. Origin State & Madison, +X east, −Z north, +Y up (`shared/project.js`).

## Review Focus

1. **A tree just outside a venue hull that rounds to inside.** Sidecars store 0.1 m. The shipped data has one at (838.2, 2007.0), 1 cm inside the Soldier Field hull. Expected: the filter decides on the rounded coordinates it writes, so the build gate never disagrees with the file. Pinned by Task 7 test `filters on the coordinates it writes`.
2. **A returning visitor's browser holds v3 tiles after the v4 rebuild.** Old sidecars have old trees; old water has no `_CALM`. Expected: every world file URL carries the manifest version, so nothing stale mixes in. Pinned by Task 13 test `every world URL carries the manifest version`.
3. **The heightfield is missing or cannot be decoded** (old manifest, 404, decode error). Expected: flights and free flight still work, with 25 m clearance and no exception. Pinned by Task 14 test `a failed load falls back to 25 m everywhere`.
4. **A flight that starts low in a street canyon.** For example, a double-click after gliding down Wabash. Expected: no frame inside a tower, and no 3 km balloon arc caused by a near-zero sine envelope. Pinned by Task 15 test `a flight that starts low between towers never enters one and does not balloon`.
5. **Typing the letter "k" in the ⌘K search box.** For example, "Kinzie" or "Oak Park". Expected: it types; only ⌘/Ctrl + K closes. Pinned by Task 12 test `plain k types into the search`.

## Findings that drive this plan (verified at plan time)

**B2 — why the water differs (root cause, for the ledger in Task 21):**
1. **Two materials.** Tile and block water uses `groundMaterials().river`: a flat `MeshStandardMaterial` with a 40 m tiled `waternormals.jpg`, normalScale 0.35 and metalness 0.9, reflecting only the PMREM sky. Lake Michigan is `Lake.jsx`: a three `Water` with its own 1024² mirror render, distortion 1.6 and noise size 2.5. The patterns and colours cannot match; the user's screenshot shows the ripple-pattern polygon beside the reflective lake.
2. **Two heights.** Polygon water sits at y 0.04 (`GROUND_Y.water`) while the lake is at y −2, so a harbour polygon reads as a separate sheet above the lake.
3. **Grey far lake.** The lake is fog-graded to the grey fog colour (#b4c6d6 by day), while the nearby harbour is dark blue.

**D1 — trees at Soldier Field.** Evidence from the shipped build (manifest `generatedAt` 2026-09-29T05:10Z, built after commit c0820e7):
- The relation r16699535 hull spans x 813–1032 and z 1994–2351.
- There are 0 trees within 90 m of the field centre (929.6, 2197.0). Only one tree lies inside the hull: (838.2, 2007.0), on the NW plaza corner, 0.0095 m inside the edge after 0.1 m rounding.

So the user's screenshot most likely predates the venue filter, or came from cached tile JSON. The code still has four real gaps that can put trees back:
1. The hull test runs on unrounded points, but the sidecar stores rounded ones.
2. Venue coverage is keyed on a `fieldRing` venue mesh or `hero === 'buckingham'`. Arenas (United Center, Wintrust) are only covered by the footprint test, and a venue whose builder stops emitting `fieldRing` silently loses its protection.
3. Nothing fails the build when a tree lands in a venue.
4. Tile JSON is fetched without a version.

Tasks 7 and 13 close all four, and the build now asserts zero trees in every venue hull.

**H3.** There are no way/relation id collisions in today's cache (checked over all 48 `osm-allbuildings` chunks), so no data edit is needed. The guard makes a future collision fail loudly.

**H8** is closed by G4 (Task 12).

---

## File Structure

**Pipeline (create)**
- `pipeline/lib/manifest.js`: `MANIFEST_VERSION`, reproducible stamp, stable cache-file order (H4).
- `pipeline/lib/trees.js`: where trees may stand; venue zones; the build gate (H6, D1).
- `pipeline/lib/water.js`: calm factor, water layer with `_CALM`, breakwaters (B5, B7).
- `pipeline/lib/blocks.js`: 2 km block accumulation with unique `_BLDG` and a block sidecar (H7).
- `pipeline/lib/raster.js`: grid, scanline fill, chamfer distance, 16-bit height encoding.
- `pipeline/lib/lake.js`: the open-lake polygon (rect − land − water) (B4).
- `pipeline/lib/shore.js`: distance-to-shore image (B6).
- `pipeline/lib/heightfield.js`: roof-height raster for camera clearance (G1).
- Tests: `pipeline/tests/{manifest,trees,water,blocks,raster,lake,shore,heightfield}.test.js`.

**Pipeline (modify)**
- `pipeline/build/build-world.js`: uses all of the above; manifest v4.
- `pipeline/lib/heroes.js`: typed OSM refs (H3).
- `pipeline/lib/sacred.js`: storefront congregations untouched (H5).
- `pipeline/lib/venue.js`: `innerRadius` clamp (H9).
- `pipeline/lib/buildings.js`: `lod1Pieces` keeps courtyards (H1).
- `pipeline/lib/ribbon.js` and `pipeline/lib/tilepack.js`: miters carried across tile seams (H2).
- `pipeline/lib/ground.js`: `flatMesh` moves here; `GROUND_Y.lake`.
- `pipeline/lib/sources.js` and `pipeline/fetch/fetch-world.js`: lagoons/ponds and breakwaters.
- `pipeline/data/*`: unchanged.

**App (create)**
- `app/src/lib/clearance.js`: heightfield decode + `clearanceAt` (G1/G2 contract).
- `app/src/lib/waterPalette.js`: water colours by sun elevation + `isGreenRiverDay` (B3, B9).
- `app/src/lib/rest.js`: settle detector (G5).
- `app/src/world/dispose.js`: frees GLB geometry (H10).
- `app/src/world/water/mirror.js`: mirrored camera + reflection texture matrix.
- `app/src/world/materials/waterSurface.js`: the one water material, shared uniforms, texture loading.
- `app/src/world/WaterRig.jsx`: per-frame water uniforms + the single reflection pass.
- `app/scripts/capture.mjs`: fixed-pose screenshots, perf and bookmark-clearance readouts.
- Tests next to each, under the existing `__tests__` folders.

**App (modify)**
- `app/src/hud/CommandPalette.jsx` (G4).
- `app/src/lib/manifest.js`: `worldUrl`.
- `app/src/lib/flight.js` and `app/src/lib/cameraMath.js` (G1, G2).
- `app/src/camera/AtlasRig.jsx`.
- `app/src/lib/quality.js`: `reflection`.
- `app/src/world/{Land,Lake,TileContent,TileStreamer,Scene,SkyRig}.jsx`.
- `app/src/hud/{LoadingScreen,HelpOverlay}.jsx`.
- `app/src/world/materials/groundMaterials.js`: river material removed.
- `app/e2e/hero-view.spec.js` (G5).

---

### Task 1: Reproducible pipeline output and manifest v4 constant (H4)

**Files:**
- Create: `pipeline/lib/manifest.js`
- Modify: `pipeline/build/build-world.js` (the `chunks` helper, the `cityRows` line, the manifest `version`/`generatedAt`)
- Test: `pipeline/tests/manifest.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `MANIFEST_VERSION: 4`
  - `manifestStamp(env = process.env, now = () => new Date()) → {} | { generatedAt: string }`
  - `sortCacheFiles(names: string[], prefix: string) → string[]` (numeric chunk order)

- [ ] **Step 1: Write the failing test**

```js
// pipeline/tests/manifest.test.js
import { describe, it, expect } from 'vitest'
import { MANIFEST_VERSION, manifestStamp, sortCacheFiles } from '../lib/manifest.js'

describe('reproducible builds (H4)', () => {
  it('orders cache chunks numerically and ignores other kinds', () => {
    const names = ['osm-water-10.json', 'osm-parks-0.json', 'osm-water-2.json', 'osm-water-0.json', 'footprints-1.json']
    expect(sortCacheFiles(names, 'osm-water-')).toEqual(['osm-water-0.json', 'osm-water-2.json', 'osm-water-10.json'])
    expect(sortCacheFiles(['footprints-10.json', 'footprints-9.json'], 'footprints-')).toEqual(['footprints-9.json', 'footprints-10.json'])
  })
  it('writes no timestamp unless asked (two builds are byte-identical)', () => {
    expect(manifestStamp({})).toEqual({})
    expect(manifestStamp({ CHI_BUILD_STAMP: '1' }, () => new Date('2026-09-29T12:00:00Z'))).toEqual({ generatedAt: '2026-09-29T12:00:00.000Z' })
  })
  it('V1 tile format is manifest v4', () => {
    expect(MANIFEST_VERSION).toBe(4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix pipeline -- tests/manifest.test.js`
Expected: FAIL — `Failed to resolve import "../lib/manifest.js"`

- [ ] **Step 3: Write the implementation**

```js
// pipeline/lib/manifest.js — world manifest constants and reproducible build output.
export const MANIFEST_VERSION = 4

// A timestamp only when asked for (CHI_BUILD_STAMP=1): two builds of the same cache are byte-identical.
export function manifestStamp(env = process.env, now = () => new Date()) {
  return env.CHI_BUILD_STAMP === '1' ? { generatedAt: now().toISOString() } : {}
}

// readdirSync order is filesystem-dependent: read cache chunks by kind prefix, then numeric chunk index.
export function sortCacheFiles(names, prefix) {
  const idx = (f) => Number(f.slice(prefix.length).replace(/\.json$/, ''))
  return names.filter((f) => f.startsWith(prefix)).sort((a, b) => idx(a) - idx(b))
}
```

In `pipeline/build/build-world.js`:
- Add the import `import { MANIFEST_VERSION, manifestStamp, sortCacheFiles } from '../lib/manifest.js'`.
- Replace
  ```js
  const chunks = (kind) => readdirSync(CACHE).filter((f) => f.startsWith(`osm-${kind}-`)).flatMap((f) => loadJson(join(CACHE, f)).data.elements)
  ```
  with
  ```js
  const chunks = (kind) => sortCacheFiles(readdirSync(CACHE), `osm-${kind}-`).flatMap((f) => loadJson(join(CACHE, f)).data.elements)
  ```
- Replace
  ```js
  const cityRows = readdirSync(CACHE).filter((f) => f.startsWith('footprints-')).flatMap((f) => loadJson(join(CACHE, f)).data)
  ```
  with
  ```js
  const cityRows = sortCacheFiles(readdirSync(CACHE), 'footprints-').flatMap((f) => loadJson(join(CACHE, f)).data)
  ```
- In the manifest object, replace `version: 3, generatedAt: new Date().toISOString(),` with `version: MANIFEST_VERSION, ...manifestStamp(),`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix pipeline`
Expected: PASS (all suites green, including `tests/manifest.test.js`)

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/manifest.js pipeline/tests/manifest.test.js pipeline/build/build-world.js
git commit -m "fix(pipeline): reproducible builds — sorted cache chunks, no timestamp unless CHI_BUILD_STAMP=1; manifest v4 (H4)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Match heroes on OSM type + id (H3)

**Files:**
- Modify: `pipeline/lib/heroes.js` (append exports)
- Modify: `pipeline/build/build-world.js` (hero lookup, `suppress`, sacred override lookup)
- Test: `pipeline/tests/heroes.test.js` (append a `describe`)

**Interfaces:**
- Consumes: building records with `id` (`'w123'`, `'r123'`, `'s…'`, `'m-…'`) and `osmId: number | null` (from `lib/osm.js` `osmToBuilding`).
- Produces:
  - `parseOsmRef(ref: number | string) → { type: 'w' | 'r' | null, id: number }`
  - `matchesOsm(b, ref) → boolean`
  - `findByOsm(buildings, ref) → building | null` (throws on an untyped ref that matches more than one element)

- [ ] **Step 1: Write the failing test** (append to `pipeline/tests/heroes.test.js`)

```js
import { parseOsmRef, matchesOsm, findByOsm } from '../lib/heroes.js'

describe('typed OSM refs (H3)', () => {
  const way = { id: 'w16699535', osmId: 16699535 }, rel = { id: 'r16699535', osmId: 16699535 }, other = { id: 'w1', osmId: 1 }
  it('a typed ref picks the right element when a way and a relation share an id', () => {
    expect(findByOsm([way, rel, other], 'r16699535')).toBe(rel)
    expect(findByOsm([way, rel, other], 'w16699535')).toBe(way)
  })
  it('a bare numeric id still works when it is unambiguous', () => {
    expect(findByOsm([rel, other], 16699535)).toBe(rel)
    expect(findByOsm([rel, other], '16699535')).toBe(rel)
    expect(findByOsm([other], 16699535)).toBe(null)
  })
  it('a bare id that matches both a way and a relation is an error, not a silent pick', () => {
    expect(() => findByOsm([way, rel], 16699535)).toThrow(/ambiguous OSM id 16699535/)
  })
  it('suppress lists and overrides accept typed refs', () => {
    expect(matchesOsm(way, 'r16699535')).toBe(false)
    expect(matchesOsm(rel, 'r16699535')).toBe(true)
    expect(matchesOsm(rel, 16699535)).toBe(true)
  })
  it('rejects malformed refs', () => {
    expect(() => parseOsmRef('x12')).toThrow(/bad OSM ref/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix pipeline -- tests/heroes.test.js`
Expected: FAIL — `findByOsm is not a function` (the export does not exist yet)

- [ ] **Step 3: Write the implementation** (append to `pipeline/lib/heroes.js`)

```js
// OSM ids are unique per element type only: way 123 and relation 123 are different buildings.
// A ref is 'w123' / 'r123' (typed) or a bare number / digit string (must then be unambiguous).
export function parseOsmRef(ref) {
  if (typeof ref === 'number') return { type: null, id: ref }
  const m = /^([wr])?(\d+)$/.exec(String(ref))
  if (!m) throw new Error(`bad OSM ref: ${ref}`)
  return { type: m[1] ?? null, id: Number(m[2]) }
}

export function matchesOsm(b, ref) {
  const { type, id } = parseOsmRef(ref)
  return b.osmId === id && (!type || b.id?.[0] === type)
}

export function findByOsm(buildings, ref) {
  const hits = buildings.filter((b) => matchesOsm(b, ref))
  if (hits.length > 1) throw new Error(`ambiguous OSM id ${ref}: ${hits.map((b) => b.id).join(', ')} — write it as 'w…' or 'r…'`)
  return hits[0] ?? null
}
```

In `pipeline/build/build-world.js`:
- Change the import to `import { applyHero, findByOsm, matchesOsm } from '../lib/heroes.js'`.
- Replace `let b = h.match.osmId ? buildings.find((x) => x.osmId === h.match.osmId) : null` with `let b = h.match.osmId ? findByOsm(buildings, h.match.osmId) : null`.
- Replace
  ```js
    const suppressed = new Set(heroes.flatMap((h) => h.suppress || []))
    const kept = buildings.filter((b) => !suppressed.has(b.osmId) && (b.source !== 'osm-stadium' || heroFor.has(b)))
  ```
  with
  ```js
    const suppressed = heroes.flatMap((h) => h.suppress || [])
    const kept = buildings.filter((b) => !suppressed.some((r) => b.osmId != null && matchesOsm(b, r)) && (b.source !== 'osm-stadium' || heroFor.has(b)))
  ```
- Replace `override: sacredOverrides[String(b.osmId)]` with `override: sacredOverrides[b.id] ?? sacredOverrides[String(b.osmId)]`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix pipeline`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/heroes.js pipeline/tests/heroes.test.js pipeline/build/build-world.js
git commit -m "fix(pipeline): heroes, suppress lists and sacred overrides match OSM type + id; ambiguous bare ids fail the build (H3)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Storefront congregations keep their extrusion (H5)

**Files:**
- Modify: `pipeline/lib/sacred.js` (`SACRED_TYPES`, `sacredKind`, first line of `shapeSacred`)
- Test: `pipeline/tests/sacred.test.js` (append)

**Interfaces:**
- Consumes: `shapeSacred(b, ctx)` with `ctx.override` (from `data/sacred.json`, passed by build-world).
- Produces: `sacredKind(tags, { override } = {}) → kind | null`. Without an override it returns null for `building=yes`.

- [ ] **Step 1: Write the failing test** (append to `pipeline/tests/sacred.test.js`)

```js
describe('storefront congregations (H5)', () => {
  const shop = rect(-10, -6, 10, 6)
  const tags = { building: 'yes', amenity: 'place_of_worship', religion: 'christian', name: 'Iglesia Pentecostal Monte Sion' }
  it('a building=yes place of worship keeps its plain extrusion', () => {
    expect(sacredKind(tags)).toBe(null)
    expect(shapeSacred(bldg(shop, tags), { front: [20, 0] })).toBe(null)
  })
  it('an explicit sacred.json override still shapes a building=yes church', () => {
    const r = shapeSacred(bldg(rect(-20, -8, 20, 8), { ...tags, name: 'Saint Mary of the Angels' }), { front: [40, 0], override: { crown: 'dome' } })
    expect(r).not.toBe(null)
    expect(r.facade).toBe('sacred')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix pipeline -- tests/sacred.test.js`
Expected: FAIL — `expected 'church' to be null`

- [ ] **Step 3: Write the implementation**

In `pipeline/lib/sacred.js`, delete the line `const SACRED_TYPES = new Set(['church', 'cathedral', 'chapel', 'mosque', 'synagogue', 'temple', 'shrine', 'yes'])` and replace the start of `sacredKind`:

```js
// Only buildings typed as a house of worship are reshaped. A building=yes storefront that hosts a
// congregation stays a storefront (Phase 2.5 ruling), unless data/sacred.json names it explicitly.
export function sacredKind(tags = {}, { override = null } = {}) {
  const t = tags.building, rel = (tags.religion || '').toLowerCase(), den = (tags.denomination || '').toLowerCase(), name = tags.name || ''
  const typed = ['church', 'cathedral', 'chapel', 'mosque', 'synagogue', 'temple', 'shrine'].includes(t)
  if (!typed && !override) return null
```

(The remaining lines of `sacredKind`, from `if (t === 'mosque' || …` down, are unchanged.) In `shapeSacred`, replace `const kind = sacredKind(b.tags)` with `const kind = sacredKind(b.tags, { override: ctx.override })`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix pipeline -- tests/sacred.test.js`
Expected: PASS (the new tests and all existing sacred tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/sacred.js pipeline/tests/sacred.test.js
git commit -m "fix(pipeline): building=yes congregations keep their extrusion unless sacred.json overrides them (H5)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Bowl inner radius never goes negative (H9)

**Files:**
- Modify: `pipeline/lib/venue.js` (new export; one line in `bowl()`)
- Test: `pipeline/tests/venue.test.js` (append)

**Interfaces:**
- Produces: `innerRadius(innerHits: number[], rO: number) → number`. It returns > 0 for every rO > 0, and is unchanged from today for rO ≥ 12.

- [ ] **Step 1: Write the failing test** (append to `pipeline/tests/venue.test.js`)

```js
import { innerRadius } from '../lib/venue.js'

describe('bowl inner radius (H9)', () => {
  it('real venues: the field edge, but at least 6 m of stand', () => {
    expect(innerRadius([50], 100)).toBe(50)
    expect(innerRadius([98], 100)).toBe(94)
    expect(innerRadius([64], 166)).toBe(64) // Soldier Field along its axis: unchanged
  })
  it('tiny hulls never flip the ray through the centre', () => {
    expect(innerRadius([50], 8)).toBe(4)
    expect(innerRadius([50], 3)).toBe(1.5)
    expect(innerRadius([2], 8)).toBe(2)
    for (const rO of [0.5, 1, 2, 5, 6, 7, 11]) expect(innerRadius([100], rO)).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix pipeline -- tests/venue.test.js`
Expected: FAIL — `innerRadius is not a function`

- [ ] **Step 3: Write the implementation**

Add to `pipeline/lib/venue.js`, after `lookup()`:

```js
// Field-edge radius of one bowl ray: the field edge, at least 6 m of stand before the outer wall, and on a
// tiny hull (rO < 12) never below half the outer radius — `rO − 6` alone goes negative and flips the ray.
export function innerRadius(innerHits, rO) {
  const edge = Math.max(...innerHits)
  return Math.max(Math.min(edge, rO - 6), Math.min(edge, 0.5 * rO), 0.1)
}
```

In `bowl()`, replace `const rI = Math.min(Math.max(...hI), rO - 6)` with `const rI = innerRadius(hI, rO)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix pipeline -- tests/venue.test.js`
Expected: PASS (new tests plus all existing venue tests; real-venue geometry unchanged)

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/venue.js pipeline/tests/venue.test.js
git commit -m "fix(pipeline): venue bowl inner radius stays positive on tiny hulls (H9)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: LOD1 and block roofs keep their courtyards (H1)

**Files:**
- Modify: `pipeline/lib/buildings.js` (append `lod1Pieces`)
- Modify: `pipeline/build/build-world.js` (the LOD1 `else if (b.area >= 80)` branch)
- Test: `pipeline/tests/buildings.test.js` (append)

**Interfaces:**
- Consumes: `simplifyRing` (already imported in buildings.js); `extrudeBuilding({ outer, holes, base, top })` from `lib/extrude.js`.
- Produces: `lod1Pieces(b, tol = 2) → Array<{ outer, holes, base: 0, top: b.height }>`. Blocks are built from LOD1, so they inherit it.

- [ ] **Step 1: Write the failing test** (append to `pipeline/tests/buildings.test.js`)

```js
import { lod1Pieces } from '../lib/buildings.js'
import { extrudeBuilding } from '../lib/extrude.js'

describe('LOD1 courtyards (H1)', () => {
  const b = { height: 20, polygons: [{ outer: [[0, 0], [40, 0], [40, -40], [0, -40]], holes: [[[10, -10], [30, -10], [30, -30], [10, -30]]] }] }
  it('carries the holes through simplification', () => {
    const [p] = lod1Pieces(b)
    expect(p.holes).toHaveLength(1)
    expect(p).toMatchObject({ base: 0, top: 20 })
  })
  it('no roof triangle covers the open courtyard', () => {
    const m = extrudeBuilding(lod1Pieces(b)[0])
    const inTri = ([px, pz], a, c, d) => {
      const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1])
      const d1 = s([px, pz], a, c), d2 = s([px, pz], c, d), d3 = s([px, pz], d, a)
      return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
    }
    const P = m.positions
    for (let i = 0; i < P.length; i += 9) {
      if (m.normals[i + 1] < 0.99) continue // roof triangles only
      expect(inTri([20, -20], [P[i], P[i + 2]], [P[i + 3], P[i + 5]], [P[i + 6], P[i + 8]])).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix pipeline -- tests/buildings.test.js`
Expected: FAIL — `lod1Pieces is not a function`

- [ ] **Step 3: Write the implementation** (append to `pipeline/lib/buildings.js`)

```js
// LOD1 footprint of a plain building: the simplified outline AND its courtyards, so far roofs stay open.
export function lod1Pieces(b, tol = 2) {
  const out = []
  for (const p of b.polygons) {
    const outer = simplifyRing(p.outer, tol)
    if (outer.length < 3) continue
    const holes = (p.holes || []).map((h) => simplifyRing(h, tol)).filter((h) => h.length >= 3)
    out.push({ outer, holes, base: 0, top: b.height })
  }
  return out
}
```

In `pipeline/build/build-world.js`:
- Change the import to `import { normalizeFootprint, applyBuildingParts, hashSeed, keepsShapeAtDistance, lod1Pieces } from '../lib/buildings.js'`.
- Replace
  ```js
      else if (b.area >= 80) for (const p of b.polygons) {
        const outer = simplifyRing(p.outer, 2)
        if (outer.length >= 3) appendBuilding(L1, extrudeBuilding({ outer, holes: [], base: 0, top: b.height }), family, seed, i)
      }
  ```
  with
  ```js
      else if (b.area >= 80) for (const pc of lod1Pieces(b)) appendBuilding(L1, extrudeBuilding(pc), family, seed, i)
  ```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix pipeline`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/buildings.js pipeline/tests/buildings.test.js pipeline/build/build-world.js
git commit -m "fix(pipeline): LOD1 and block roofs keep courtyards (H1)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Road and rail miters carried across tile seams (H2)

**Files:**
- Modify: `pipeline/lib/ribbon.js` (`bufferPolyline` gains `ends`)
- Modify: `pipeline/lib/tilepack.js` (append `splitLineWithContext`)
- Modify: `pipeline/build/build-world.js` (roads loop; at-grade rail branch)
- Test: `pipeline/tests/ribbon.test.js` (append)

**Interfaces:**
- Produces:
  - `bufferPolyline(points, hw, y = 0, ends = { before?: [x,z] | null, after?: [x,z] | null })`. The neighbour points outside the piece set the end tangents.
  - `splitLineWithContext(points) → Map<tileKey, Array<{ line: [x,z][], before: [x,z] | null, after: [x,z] | null }>>`. The existing `splitLineByTiles` stays, for elevated columns.

- [ ] **Step 1: Write the failing test** (append to `pipeline/tests/ribbon.test.js`)

```js
import { splitLineWithContext } from '../lib/tilepack.js'

describe('tile seams (H2)', () => {
  const bend = [[450, 100], [495, 100], [505, 130]] // the bend vertex sits on the 0_0 | 1_0 seam's pieces
  it('splits with the neighbour points outside each piece', () => {
    const m = splitLineWithContext(bend)
    expect(m.get('0_0')).toEqual([{ line: [[450, 100], [495, 100]], before: null, after: [505, 130] }])
    expect(m.get('1_0')).toEqual([{ line: [[495, 100], [505, 130]], before: [450, 100], after: null }])
  })
  it('both pieces put identical vertices on the shared bend (no notch)', () => {
    const m = splitLineWithContext(bend)
    const near = (mesh) => {
      const out = new Set()
      for (let i = 0; i < mesh.positions.length; i += 3) {
        const x = mesh.positions[i], z = mesh.positions[i + 2]
        if (Math.hypot(x - 495, z - 100) < 12) out.add(`${x.toFixed(6)},${z.toFixed(6)}`)
      }
      return [...out].sort()
    }
    const [a] = m.get('0_0'), [b] = m.get('1_0')
    const ma = bufferPolyline(a.line, 4, 0.12, a), mb = bufferPolyline(b.line, 4, 0.12, b)
    expect(near(ma)).toHaveLength(2)
    expect(near(ma)).toEqual(near(mb))
  })
  it('without ends a piece still buffers like before', () => {
    expect(bufferPolyline([[0, 0], [10, 0]], 2, 0.05)).toEqual(bufferPolyline([[0, 0], [10, 0]], 2, 0.05, {}))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix pipeline -- tests/ribbon.test.js`
Expected: FAIL — `splitLineWithContext is not a function`

- [ ] **Step 3: Write the implementation**

Append to `pipeline/lib/tilepack.js`:

```js
// Like splitLineByTiles, but each piece remembers the point before its first vertex and after its last,
// so ribbons on both sides of a tile seam miter the shared vertex identically (no notch).
export function splitLineWithContext(points) {
  const out = new Map()
  let curKey = null, cur = null
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const key = tileKeyFor([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
    if (key !== curKey) {
      if (cur) cur.after = b
      cur = { line: [a, b], before: points[i - 2] ?? null, after: null }
      curKey = key
      if (!out.has(key)) out.set(key, [])
      out.get(key).push(cur)
    } else cur.line.push(b)
  }
  return out
}
```

In `pipeline/lib/ribbon.js`:
- Change the signature to `export function bufferPolyline(points, hw, y = 0, ends = {}) {`.
- Replace the two tangent lines in the loop:
  ```js
    const d0 = i > 0 ? norm(sub(pts[i], prev)) : norm(sub(next, pts[i]))
    const d1 = i < pts.length - 1 ? norm(sub(next, pts[i])) : d0
  ```
  with
  ```js
    const d0 = i > 0 ? norm(sub(pts[i], prev)) : dir(ends.before, pts[0]) ?? norm(sub(next, pts[i]))
    const d1 = i < pts.length - 1 ? norm(sub(next, pts[i])) : dir(pts[i], ends.after) ?? d0
  ```
- Add above `export function bufferPolyline`:
  ```js
  // Direction a → b, or null when either point is missing or they coincide.
  const dir = (a, b) => (a && b && Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-3 ? norm(sub(b, a)) : null)
  ```

In `pipeline/build/build-world.js`:
- Change the import to `import { clipPolysToTile, splitLineByTiles, splitLineWithContext, writeTileGlb, mergeGroundLayers, blockKeyFor, BLOCK_TILES } from '../lib/tilepack.js'`.
- Replace the roads loop body
  ```js
    for (const [k, lines] of splitLineByTiles(pts)) for (const l of lines) {
      const t = tile(k); append(t.roads, bufferPolyline(l, hw, GROUND_Y.roads)); append(t.roadsLod1, bufferPolyline(l, hw, GROUND_Y.roads))
      if (!['motorway', 'motorway_link', 'service'].includes(e.tags.highway)) append(t.walks, bufferPolyline(l, hw + 3, GROUND_Y.sidewalks))
    }
  ```
  with
  ```js
    for (const [k, pieces] of splitLineWithContext(pts)) for (const { line: l, before, after } of pieces) {
      const t = tile(k), ends = { before, after }
      append(t.roads, bufferPolyline(l, hw, GROUND_Y.roads, ends)); append(t.roadsLod1, bufferPolyline(l, hw, GROUND_Y.roads, ends))
      if (!['motorway', 'motorway_link', 'service'].includes(e.tags.highway)) append(t.walks, bufferPolyline(l, hw + 3, GROUND_Y.sidewalks, ends))
    }
  ```
- In the rail loop, replace `for (const [k, lines] of splitLineByTiles(pts)) for (const l of lines) {` with `for (const [k, pieces] of splitLineWithContext(pts)) for (const { line: l, before, after } of pieces) {`.
- In the same loop, replace `} else append(tile(k).rail, bufferPolyline(l, t.railway === 'rail' ? 2.4 : 1.8, GROUND_Y.rail))` with `} else append(tile(k).rail, bufferPolyline(l, t.railway === 'rail' ? 2.4 : 1.8, GROUND_Y.rail, { before, after }))`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix pipeline`
Expected: PASS (new seam tests plus existing ribbon and tilepack tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/ribbon.js pipeline/lib/tilepack.js pipeline/tests/ribbon.test.js pipeline/build/build-world.js
git commit -m "fix(pipeline): road and rail ribbons miter across tile seams — no notch (H2)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Trees — courtyards stay green, venues stay clear, the build enforces it (H6, D1)

**Files:**
- Create: `pipeline/lib/trees.js`
- Modify: `pipeline/build/build-world.js` (replace the block from `// no park trees inside rebuilt venues` to `for (const p of keptTrees) treeNodes.push(p)`; add the gate after the tile loop)
- Test: `pipeline/tests/trees.test.js`

**Interfaces:**
- Consumes: `convexHull` (`lib/venue.js`), `pointInRing` (`lib/geom.js`), the build's `heroFor: Map<building, heroSpec>`.
- Produces:
  - `TREE_FREE_HEROES: Set<string>`
  - `roundTree([x, z]) → [x, z]` (0.1 m)
  - `insideFootprint(p, b) → boolean` (holes are open ground)
  - `isVenue(spec) → boolean`
  - `venueZones(buildings, specFor: (b) => spec | undefined) → Array<{ key, ring }>`
  - `filterTrees(points, { zones: ring[], clearings: ring[], nearBuildings: (p) => building[] }) → { kept: [x,z][], removed: { venue, clearing, building } }`
  - `assertNoVenueTrees(tileTrees: Iterable<[tileKey, tree[]]>, zones) → void` (throws)

- [ ] **Step 1: Reproduce against the shipped data (read-only, no build)**

Run:
```bash
node --input-type=module -e "
import { readFileSync, readdirSync } from 'node:fs'
const W = 'app/public/world', m = JSON.parse(readFileSync(W + '/manifest.json', 'utf8'))
const trees = readdirSync(W + '/tiles').filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(W + '/tiles/' + f, 'utf8')).trees.map((t) => [f, t[0], t[1]]))
for (const [key, x, z] of [['soldierfield field', 929.6, 2197.0], ['wrigley home', -2325, -7321], ['ratefield home', -533, 5751]]) console.log(key, trees.filter(([, a, b]) => Math.hypot(a - x, b - z) < 90).length)
"
```
Expected (plan-time data): `soldierfield field 0`, `wrigley home 0`, `ratefield home 7`. The Rate Field trees are at z ≈ 5670, along 35th St, outside the bowl.

Record in the ledger:
- `D1: shipped data has 0 trees on the Soldier Field field; one tree 1 cm inside the hull after rounding at (838.2, 2007.0).`
- `Root causes fixed: rounded-vs-unrounded check, fieldRing-keyed coverage, no build gate, unversioned tile JSON (Task 13).`

If the numbers differ (the world was rebuilt since), log the actual counts and continue; the fix is the same.

- [ ] **Step 2: Write the failing test**

```js
// pipeline/tests/trees.test.js
import { describe, it, expect } from 'vitest'
import { insideFootprint, venueZones, filterTrees, assertNoVenueTrees, roundTree, isVenue } from '../lib/trees.js'

const sq = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]

describe('trees in courtyards (H6)', () => {
  const b = { bbox: { minX: 0, minZ: 0, maxX: 40, maxZ: 40 }, polygons: [{ outer: sq(0, 0, 40, 40), holes: [sq(10, 10, 30, 30)] }] }
  it('a tree in an open courtyard stays; a tree on the roof goes', () => {
    expect(insideFootprint([20, 20], b)).toBe(false)
    expect(insideFootprint([5, 5], b)).toBe(true)
    const r = filterTrees([[20, 20], [5, 5]], { nearBuildings: () => [b] })
    expect(r.kept).toEqual([[20, 20]])
    expect(r.removed.building).toBe(1)
  })
})

describe('venues stay tree-free (D1)', () => {
  const field = { hero: 'soldierfield', polygons: [{ outer: sq(10.07, 0, 110, 100), holes: [] }] }
  const arena = { hero: 'unitedcenter', polygons: [{ outer: sq(500, 0, 600, 80), holes: [] }] }
  const tower = { hero: 'willis', polygons: [{ outer: sq(900, 0, 960, 60), holes: [] }] }
  const specs = new Map([[field, { key: 'soldierfield', venue: { kind: 'football' } }], [arena, { key: 'unitedcenter', facade: 'arena' }], [tower, { key: 'willis' }]])
  const zones = venueZones([field, arena, tower], (b) => specs.get(b))
  it('covers open-air venues and arenas, not towers', () => {
    expect(zones.map((z) => z.key)).toEqual(['soldierfield', 'unitedcenter'])
    expect(isVenue({ key: 'wrigleyfield', venue: {} })).toBe(true)
    expect(isVenue({ key: 'willis' })).toBe(false)
  })
  it('filters on the coordinates it writes: a tree 1 cm outside a hull that rounds inside is removed', () => {
    expect(roundTree([10.06, 50])).toEqual([10.1, 50])
    const r = filterTrees([[10.06, 50], [5, 50], [550, 40]], { zones: zones.map((z) => z.ring) })
    expect(r.kept).toEqual([[5, 50]])
    expect(r.removed.venue).toBe(2)
  })
  it('the build gate names the venue and the tile', () => {
    expect(() => assertNoVenueTrees([['0_0', [[50, 50, 1, 0]]]], zones)).toThrow(/soldierfield 50,50 \(tile 0_0\)/)
    expect(() => assertNoVenueTrees([['0_0', [[5, 50, 1, 0]]]], zones)).not.toThrow()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test --prefix pipeline -- tests/trees.test.js`
Expected: FAIL — `Failed to resolve import "../lib/trees.js"`

- [ ] **Step 4: Write the implementation**

```js
// pipeline/lib/trees.js — where a tree may stand: never inside a footprint (courtyards are open ground),
// never inside a venue, never in a landmark's clearing. Decisions are made on the rounded coordinates the
// sidecars store, so the check and the file can never disagree.
import { pointInRing } from './geom.js'
import { convexHull } from './venue.js'

// Arenas and plazas without a field mesh that must still stay clear.
export const TREE_FREE_HEROES = new Set(['unitedcenter', 'wintrust', 'buckingham'])

export const roundTree = ([x, z]) => [+x.toFixed(1), +z.toFixed(1)]

export function insideFootprint(p, b) {
  if (b.bbox && (p[0] < b.bbox.minX || p[0] > b.bbox.maxX || p[1] < b.bbox.minZ || p[1] > b.bbox.maxZ)) return false
  return b.polygons.some((q) => pointInRing(p, q.outer) && !(q.holes || []).some((h) => pointInRing(p, h)))
}

export const isVenue = (spec) => Boolean(spec && (spec.venue || spec.stands || TREE_FREE_HEROES.has(spec.key)))

export function venueZones(buildings, specFor) {
  return buildings
    .filter((b) => isVenue(specFor(b)))
    .map((b) => ({ key: specFor(b).key, ring: convexHull(b.polygons.flatMap((p) => p.outer)) }))
}

export function filterTrees(points, { zones = [], clearings = [], nearBuildings = () => [] } = {}) {
  const kept = [], removed = { venue: 0, clearing: 0, building: 0 }
  for (const raw of points) {
    const p = roundTree(raw)
    if (zones.some((z) => pointInRing(p, z))) removed.venue++
    else if (clearings.some((c) => pointInRing(p, c))) removed.clearing++
    else if (nearBuildings(p).some((b) => insideFootprint(p, b))) removed.building++
    else kept.push(p)
  }
  return { kept, removed }
}

export function assertNoVenueTrees(tileTrees, zones) {
  const bad = []
  for (const [key, trees] of tileTrees) for (const t of trees) for (const z of zones) {
    if (pointInRing([t[0], t[1]], z.ring)) bad.push(`${z.key} ${t[0]},${t[1]} (tile ${key})`)
  }
  if (bad.length) throw new Error(`trees inside venues (${bad.length}): ${bad.slice(0, 10).join('; ')}`)
}
```

In `pipeline/build/build-world.js`:
- Add `import { venueZones, filterTrees, assertNoVenueTrees } from '../lib/trees.js'`.
- Replace the block from `// no park trees inside rebuilt venues (Soldier Field sits inside Burnham Park)` through `for (const p of keptTrees) treeNodes.push(p)` with:

```js
  // Trees: never in a venue (Soldier Field sits inside Burnham Park), a landmark clearing, or through a roof —
  // courtyards are open ground. Filtered on the rounded coordinates the sidecars store.
  const zones = venueZones(buildings, (b) => heroFor.get(b))
  const footIdx = buildGridIndex(buildings.filter((b) => b.area > 30), 200, (b) => b.centroid)
  const clearings = buildings.flatMap((b) => b.clearPolys ?? [])
  const { kept: keptTrees, removed } = filterTrees(treeNodes, { zones: zones.map((z) => z.ring), clearings, nearBuildings: (p) => footIdx.query(p, 400) })
  log(`trees removed — venues ${removed.venue}, clearings ${removed.clearing}, footprints ${removed.building}; venue zones: ${zones.map((z) => z.key).join(', ')}`)
  treeNodes.length = 0
  for (const p of keptTrees) treeNodes.push(p)
```

- Directly after the line `log(`tiles: ${tiles.length}`)`, add:

```js
  assertNoVenueTrees([...T].map(([k, t]) => [k, t.trees]), zones)
  log('venue tree check: 0 trees inside any venue')
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test --prefix pipeline`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add pipeline/lib/trees.js pipeline/tests/trees.test.js pipeline/build/build-world.js
git commit -m "fix(pipeline): courtyard trees kept, venue/arena hulls tree-free on rounded coords, build fails on any venue tree (H6, D1)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Water layer with `_CALM`, lagoons, breakwaters (B5, B7 data)

**Files:**
- Create: `pipeline/lib/water.js`
- Modify: `pipeline/lib/ground.js` (move `flatMesh` here from build-world; add `GROUND_Y.lake`)
- Modify: `pipeline/lib/sources.js` (`FILTERS.water`, new `FILTERS.shore`)
- Modify: `pipeline/fetch/fetch-world.js` (`KINDS.shore`)
- Modify: `pipeline/build/build-world.js` (remove the local `flatMesh`; import it; water tiles via `waterLayer`; breakwaters)
- Test: `pipeline/tests/water.test.js`; append to `pipeline/tests/ground.test.js` and `pipeline/tests/sources.test.js`

**Interfaces:**
- Produces:
  - `flatMesh(polys, y) → { positions, normals, uvs }` (moved; same behaviour).
  - `GROUND_Y.lake = 0.02`.
  - `CALM = { river: 0.6, sheltered: 0.35, lake: 1.0 }`
  - `calmFor(tags) → number`
  - `keepWater(tags) → boolean`
  - `waterLayer(polys: Array<{ outer, holes, tags }>, y) → { positions, normals, uvs, extra: { CALM: Float32Array } }`
  - `BREAKWATER = { width: 6, top: 1.8 }`
  - `strokeRing(points, hw) → ring`
  - `breakwaterBuildings(ways: Array<{ id?, points: [x,z][], tags }>) → building[]`. These are records with `pieces`, `facadeOverride: 'wall'` and `seedOverride: STYLE.wall.concrete`.
  - New Overpass kind `shore`.

- [ ] **Step 1: Write the failing tests**

```js
// pipeline/tests/water.test.js
import { describe, it, expect } from 'vitest'
import { CALM, calmFor, keepWater, waterLayer, strokeRing, breakwaterBuildings, BREAKWATER } from '../lib/water.js'
import { signedArea } from '../lib/geom.js'
import { STYLE } from '../lib/venue.js'

const sq = (x) => [[x, 0], [x + 10, 0], [x + 10, -10], [x, -10]]

describe('calm factor (B.2)', () => {
  it('rivers and canals 0.6; harbours, lagoons and ponds 0.35; the open lake 1.0', () => {
    expect(calmFor({ water: 'river' })).toBe(0.6)
    expect(calmFor({ water: 'canal' })).toBe(0.6)
    expect(calmFor({ waterway: 'canal', area: 'yes' })).toBe(0.6)
    expect(calmFor({ water: 'harbour' })).toBe(0.35)
    expect(calmFor({ natural: 'water', water: 'lagoon' })).toBe(0.35)
    expect(calmFor({ natural: 'water', water: 'pond' })).toBe(0.35)
    expect(CALM.lake).toBe(1)
  })
  it('drops fountains and Lake Michigan itself (the lake mesh is baked separately)', () => {
    expect(keepWater({ natural: 'water', water: 'fountain' })).toBe(false)
    expect(keepWater({ natural: 'water', name: 'Lake Michigan' })).toBe(false)
    expect(keepWater({ water: 'harbour', name: 'Monroe Harbor' })).toBe(true)
  })
  it('the water layer carries one calm value per vertex', () => {
    const m = waterLayer([{ outer: sq(0), holes: [], tags: { water: 'river' } }, { outer: sq(20), holes: [], tags: { water: 'harbour' } }], 0.04)
    expect(m.extra.CALM).toBeInstanceOf(Float32Array)
    expect(m.extra.CALM.length).toBe(m.positions.length / 3)
    expect(m.extra.CALM[0]).toBeCloseTo(0.6, 5)
    expect(m.extra.CALM[m.extra.CALM.length - 1]).toBeCloseTo(0.35, 5)
    expect(new Set(m.positions.filter((_, i) => i % 3 === 1))).toEqual(new Set([0.04]))
  })
})

describe('breakwaters (B7)', () => {
  it('a mapped line becomes a 6 m wide concrete footprint, 1.8 m above the water', () => {
    expect(Math.abs(signedArea(strokeRing([[0, 0], [100, 0]], 3)))).toBeCloseTo(600, 6)
    const [b] = breakwaterBuildings([{ id: 42, points: [[0, 0], [100, 0]], tags: { man_made: 'breakwater' } }])
    expect(b.id).toBe('bw42')
    expect(b.pieces[0]).toMatchObject({ base: 0, top: BREAKWATER.top })
    expect(b.facadeOverride).toBe('wall')
    expect(b.seedOverride).toBe(STYLE.wall.concrete)
    expect(b.noParapet).toBe(true)
  })
  it('a closed way is its own footprint', () => {
    const ring = [[0, 0], [20, 0], [20, -8], [0, -8], [0, 0]]
    const [b] = breakwaterBuildings([{ id: 7, points: ring, tags: {} }])
    expect(Math.abs(signedArea(b.polygons[0].outer))).toBeCloseTo(160, 6)
  })
})
```

Append to `pipeline/tests/ground.test.js`:

```js
import { flatMesh } from '../lib/ground.js'

describe('flat meshes + lake level', () => {
  it('flatMesh triangulates a polygon with a hole, facing up', () => {
    const m = flatMesh([{ outer: [[0, 0], [10, 0], [10, -10], [0, -10]], holes: [[[3, -3], [7, -3], [7, -7], [3, -7]]] }], 0.04)
    expect(m.positions.length / 9).toBe(8)
    for (let i = 1; i < m.normals.length; i += 3) expect(m.normals[i]).toBe(1)
  })
  it('the lake sits just under the polygon water', () => {
    expect(GROUND_Y.lake).toBe(0.02)
    expect(GROUND_Y.lake).toBeLessThan(GROUND_Y.water)
  })
})
```

Append to `pipeline/tests/sources.test.js`:

```js
describe('water + shore kinds (B5, B7)', () => {
  it('water pulls lagoons and ponds, not only rivers and harbours', () => {
    const q = overpassQuery('water', WORLD_BBOX)
    expect(q).toContain('way["natural"="water"]')
    expect(q).toContain('lagoon')
    expect(q).toContain('relation["water"="harbour"]')
  })
  it('shore pulls breakwaters', () => {
    expect(overpassQuery('shore', WORLD_BBOX)).toContain('"man_made"~"^(breakwater|groyne)$"')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --prefix pipeline -- tests/water.test.js tests/ground.test.js tests/sources.test.js`
Expected: FAIL — `Failed to resolve import "../lib/water.js"`; `flatMesh is not a function`; `unknown overpass kind: shore`

- [ ] **Step 3: Write the implementation**

`pipeline/lib/ground.js`:
- Add `import earcut from 'earcut'` at the top.
- Change `GROUND_Y` to `export const GROUND_Y = { lake: 0.02, water: 0.04, beaches: 0.07, parks: 0.08, pitches: 0.09, rail: 0.09, sidewalks: 0.1, roads: 0.12 }`.
- Append the function moved verbatim from build-world:

```js
// Polygons (outer + holes, local metres) → flat up-facing triangles at height y; uv = world xz.
export function flatMesh(polys, y) {
  const positions = [], normals = [], uvs = []
  for (const { outer, holes } of polys) {
    const flat = [], hi = []
    for (const [x, z] of outer) flat.push(x, z)
    for (const h of holes) { hi.push(flat.length / 2); for (const [x, z] of h) flat.push(x, z) }
    const t = earcut(flat, hi.length ? hi : undefined, 2)
    for (let i = 0; i < t.length; i += 3) {
      let [a, b, c] = [t[i], t[i + 1], t[i + 2]]
      const cr = (flat[b * 2 + 1] - flat[a * 2 + 1]) * (flat[c * 2] - flat[a * 2]) - (flat[b * 2] - flat[a * 2]) * (flat[c * 2 + 1] - flat[a * 2 + 1])
      if (cr < 0) [b, c] = [c, b]
      for (const k of [a, b, c]) { positions.push(flat[k * 2], y, flat[k * 2 + 1]); normals.push(0, 1, 0); uvs.push(flat[k * 2], flat[k * 2 + 1]) }
    }
  }
  return { positions, normals, uvs }
}
```

`pipeline/lib/water.js`:

```js
// pipeline/lib/water.js — OSM water polygons → one water layer with a per-vertex calm factor (B.2), and
// breakwaters as low concrete footprints so the harbours read (B7).
import { flatMesh } from './ground.js'
import { openRing, signedArea, ringCentroid, ringBBox } from './geom.js'
import { STYLE } from './venue.js'

export const CALM = { river: 0.6, sheltered: 0.35, lake: 1.0 }

export function calmFor(tags = {}) {
  if (['river', 'canal', 'stream'].includes(tags.water) || tags.waterway) return CALM.river
  return CALM.sheltered
}

// Lake Michigan is the baked lake mesh; fountains belong to their landmark builders.
export const keepWater = (tags = {}) => tags.water !== 'fountain' && tags.name !== 'Lake Michigan'

export function waterLayer(polys, y) {
  const out = { positions: [], normals: [], uvs: [] }, calm = []
  for (const p of polys) {
    const m = flatMesh([p], y)
    for (const k of ['positions', 'normals', 'uvs']) for (const v of m[k]) out[k].push(v)
    const c = calmFor(p.tags)
    for (let i = 0; i < m.positions.length / 3; i++) calm.push(c)
  }
  return { ...out, extra: { CALM: new Float32Array(calm) } }
}

export const BREAKWATER = { width: 6, top: 1.8 }

// A polyline → the closed outline of a band hw either side (central-difference normals).
export function strokeRing(pts, hw) {
  const L = [], R = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1
    const n = [-dz / l, dx / l]
    L.push([pts[i][0] + n[0] * hw, pts[i][1] + n[1] * hw])
    R.push([pts[i][0] - n[0] * hw, pts[i][1] - n[1] * hw])
  }
  return [...L, ...R.reverse()]
}

export function breakwaterBuildings(ways) {
  const out = []
  ways.forEach((w, i) => {
    const pts = w.points
    const closed = pts.length >= 4 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]
    const outer = closed ? openRing(pts) : strokeRing(pts, BREAKWATER.width / 2)
    const area = Math.abs(signedArea(outer))
    if (outer.length < 3 || area < 1) return
    out.push({
      id: `bw${w.id ?? i}`, osmId: null, source: 'osm-breakwater', tags: w.tags ?? {}, name: w.tags?.name ?? 'Breakwater',
      address: null, stories: null, year: null, polygons: [{ outer, holes: [] }], area, centroid: ringCentroid(outer), bbox: ringBBox(outer),
      height: BREAKWATER.top, heightSource: 'default', parts: null,
      pieces: [{ outer, holes: [], base: 0, top: BREAKWATER.top }],
      facadeOverride: 'wall', seedOverride: STYLE.wall.concrete, noParapet: true,
    })
  })
  return out
}
```

`pipeline/lib/sources.js`: replace the `water:` entry and add `shore:` in `FILTERS`:

```js
  water: ['relation["water"="river"]', 'way["water"="river"]', 'way["waterway"="canal"]["area"]', 'way["water"="canal"]', 'way["water"="harbour"]', 'relation["water"="harbour"]',
    'way["natural"="water"]', 'relation["natural"="water"]["water"~"^(lagoon|pond|basin|reservoir)$"]'],
  shore: ['way["man_made"~"^(breakwater|groyne)$"]'],
```

`pipeline/fetch/fetch-world.js`: change `KINDS` to `{ allbuildings: [6, 8], parts: [2, 3], water: [2, 3], parks: [2, 3], roads: [3, 4], trees: [2, 3], rail: [2, 3], stadiums: [1, 1], shore: [2, 3] }`.

`pipeline/build/build-world.js`:
- Delete the local `function flatMesh(polys, y) { … }`.
- Change the ground import to `import { roadHalfWidth, isElevatedRail, scatterInPolygon, GROUND_Y, flatMesh } from '../lib/ground.js'`.
- Add `import { waterLayer, keepWater, breakwaterBuildings, CALM } from '../lib/water.js'`.
- Replace `const water = osmPolys(uniq(chunks('water')))` with `const water = osmPolys(uniq(chunks('water'))).filter((p) => keepWater(p.tags))`.
- Replace `const waterM = flatMesh(clipPolysToTile(polysFor('water', bounds), bounds), GROUND_Y.water)` with `const waterM = waterLayer(clipPolysToTile(polysFor('water', bounds), bounds), GROUND_Y.water)`.
- After the line `log(`sacred buildings shaped: …`)`, add:

```js
  // ── Breakwaters: low concrete lines that shape the harbours (B7) ──────────
  const breakwaters = breakwaterBuildings(uniq(chunks('shore')).filter((e) => e.geometry).map((e) => ({ id: e.id, points: e.geometry.map((p) => project(p.lon, p.lat)), tags: e.tags || {} })))
  for (const b of breakwaters) buildings.push(b)
  log(`breakwaters: ${breakwaters.length}`)
```

(Until Task 11 fetches `osm-shore-*`, `chunks('shore')` returns `[]`, so the build still runs.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix pipeline`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/water.js pipeline/lib/ground.js pipeline/lib/sources.js pipeline/fetch/fetch-world.js pipeline/build/build-world.js pipeline/tests/water.test.js pipeline/tests/ground.test.js pipeline/tests/sources.test.js
git commit -m "feat(pipeline): water layer carries _CALM (river 0.6, harbour/lagoon 0.35); fetch lagoons/ponds and breakwaters; breakwaters as concrete (B5, B7)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `_BLDG` unique per file — blocks and horizon chunks (H7)

**Files:**
- Create: `pipeline/lib/blocks.js`
- Modify: `pipeline/build/build-world.js` (block accumulation, block write and sidecar, horizon index)
- Test: `pipeline/tests/blocks.test.js`; append a large-id round-trip to `pipeline/tests/tilepack.test.js`

**Interfaces:**
- Consumes: the per-tile `L1` (`bAcc()` shape `{ positions, normals, uvs, fac, seed, bldg }`), `ground1` (`{ …, extra: { LAYER } }`) and `waterM` (`{ …, extra: { CALM } }`, Task 8).
- Produces:
  - `createBlock() → Block`
  - `addTileToBlock(B, key, { buildings, ground, water, count })`
  - `blockLayers(B) → { buildings, ground, water }` (ready for `writeTileGlb`)
  - `blockSidecar(B) → { tiles: Array<{ key, base, count }> }`
  - Block `_BLDG = base + tile-local index`. Picking maps it back via `blocks/<bk>.json`.
  - Manifest block entries gain `meta: 'blocks/<bk>.json'`.

- [ ] **Step 1: Write the failing tests**

```js
// pipeline/tests/blocks.test.js
import { describe, it, expect } from 'vitest'
import { createBlock, addTileToBlock, blockLayers, blockSidecar } from '../lib/blocks.js'

const tri = (ids) => ({ positions: ids.flatMap(() => [0, 0, 0]), normals: ids.flatMap(() => [0, 1, 0]), uvs: ids.flatMap(() => [0, 0]), fac: ids.map(() => 1), seed: ids.map(() => 0.5), bldg: ids })
const ground = { positions: [], normals: [], uvs: [], extra: { LAYER: new Float32Array(0) } }
const water = (n, c) => ({ positions: Array(n * 3).fill(0), normals: Array(n * 3).fill(0), uvs: Array(n * 2).fill(0), extra: { CALM: new Float32Array(n).fill(c) } })

describe('blocks (H7)', () => {
  it('shifts each tile’s building indices so _BLDG is unique inside the block', () => {
    const B = createBlock()
    addTileToBlock(B, '0_0', { buildings: tri([0, 0, 0, 1, 1, 1]), ground, water: water(3, 0.6), count: 2 })
    addTileToBlock(B, '1_0', { buildings: tri([0, 0, 0, 1, 1, 1]), ground, water: water(3, 0.35), count: 2 })
    const L = blockLayers(B)
    expect([...L.buildings.extra.BLDG]).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3])
    expect(new Set(L.buildings.extra.BLDG).size).toBe(4)
    expect(blockSidecar(B)).toEqual({ tiles: [{ key: '0_0', base: 0, count: 2 }, { key: '1_0', base: 2, count: 2 }] })
  })
  it('water calm travels into the block', () => {
    const B = createBlock()
    addTileToBlock(B, '0_0', { buildings: tri([]), ground, water: water(3, 0.6), count: 0 })
    expect(blockLayers(B).water.extra.CALM).toHaveLength(3)
  })
})
```

Append to the `tilepack` describe in `pipeline/tests/tilepack.test.js`:

```js
  it('large building ids survive compression exactly (blocks hold thousands)', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 't-')), 'big.glb')
    const tri = { positions: [0, 0, 0, 10, 0, 0, 0, 10, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], uvs: [0, 0, 10, 0, 0, 10] }
    await writeTileGlb(path, { buildings: { ...tri, extra: { BLDG: new Float32Array([0, 4500, 9000]) } } })
    await MeshoptDecoder.ready
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read(path)
    const a = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('_BLDG')
    expect([a.getScalar(0), a.getScalar(1), a.getScalar(2)].sort((x, y) => x - y)).toEqual([0, 4500, 9000])
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --prefix pipeline -- tests/blocks.test.js tests/tilepack.test.js`
Expected: FAIL — `Failed to resolve import "../lib/blocks.js"`. The tilepack round-trip may already pass; that is fine and is kept as a guard.

- [ ] **Step 3: Write the implementation**

```js
// pipeline/lib/blocks.js — 2 km far-detail blocks: the LOD1 content of up to 16 tiles in one file.
// _BLDG stays unique inside a block: each tile's indices are shifted by the buildings of the tiles before it,
// and blocks/<bk>.json maps a block _BLDG back to (tile key, tile-local index) for picking.
export function createBlock() {
  return {
    b: { positions: [], normals: [], uvs: [], fac: [], seed: [], bldg: [] },
    g: { positions: [], normals: [], uvs: [], layer: [] },
    w: { positions: [], normals: [], uvs: [], calm: [] },
    tiles: [], count: 0,
  }
}

export function addTileToBlock(B, key, { buildings, ground, water, count }) {
  const base = B.count
  for (const k of ['positions', 'normals', 'uvs']) {
    for (const v of buildings[k]) B.b[k].push(v)
    for (const v of ground[k]) B.g[k].push(v)
    for (const v of water[k]) B.w[k].push(v)
  }
  for (const v of buildings.fac) B.b.fac.push(v)
  for (const v of buildings.seed) B.b.seed.push(v)
  for (const v of buildings.bldg) B.b.bldg.push(v + base)
  for (const v of ground.extra?.LAYER ?? []) B.g.layer.push(v)
  for (const v of water.extra?.CALM ?? []) B.w.calm.push(v)
  B.tiles.push({ key, base, count })
  B.count += count
}

export function blockLayers(B) {
  return {
    buildings: { positions: B.b.positions, normals: B.b.normals, uvs: B.b.uvs, extra: { FACADE: new Float32Array(B.b.fac), SEED: new Float32Array(B.b.seed), BLDG: new Float32Array(B.b.bldg) } },
    ground: { positions: B.g.positions, normals: B.g.normals, uvs: B.g.uvs, extra: { LAYER: new Float32Array(B.g.layer) } },
    water: { positions: B.w.positions, normals: B.w.normals, uvs: B.w.uvs, extra: { CALM: new Float32Array(B.w.calm) } },
  }
}

export const blockSidecar = (B) => ({ tiles: B.tiles })
```

In `pipeline/build/build-world.js`:
- Add `import { createBlock, addTileToBlock, blockLayers, blockSidecar } from '../lib/blocks.js'`.
- Replace
  ```js
      if (!blocks.has(bk)) blocks.set(bk, { b: bAcc(), g: { ...acc(), extra: { LAYER: [] } }, w: acc() })
      const B = blocks.get(bk)
      for (const k of ['positions', 'normals', 'uvs']) { for (const v of L1[k]) B.b[k].push(v); for (const v of ground1[k]) B.g[k].push(v); for (const v of waterM[k]) B.w[k].push(v) }
      for (const v of L1.fac) B.b.fac.push(v); for (const v of L1.seed) B.b.seed.push(v); for (const v of L1.bldg) B.b.bldg.push(v)
      for (const v of ground1.extra.LAYER) B.g.extra.LAYER.push(v)
  ```
  with
  ```js
      if (!blocks.has(bk)) blocks.set(bk, createBlock())
      addTileToBlock(blocks.get(bk), key, { buildings: L1, ground: ground1, water: waterM, count: meta.length })
  ```
- Replace
  ```js
      await writeTileGlb(join(OUT, 'blocks', `${bk}.glb`), { buildings: asLayer(B.b), ground: { ...B.g, extra: { LAYER: new Float32Array(B.g.extra.LAYER) } }, water: B.w })
      blockList.push({ key: bk, file: `blocks/${bk}.glb`, bounds: { minX: bx * size, maxX: (bx + 1) * size, minZ: bz * size, maxZ: (bz + 1) * size } })
  ```
  with
  ```js
      await writeTileGlb(join(OUT, 'blocks', `${bk}.glb`), blockLayers(B))
      writeFileSync(join(OUT, 'blocks', `${bk}.json`), JSON.stringify(blockSidecar(B)))
      blockList.push({ key: bk, file: `blocks/${bk}.glb`, meta: `blocks/${bk}.json`, bounds: { minX: bx * size, maxX: (bx + 1) * size, minZ: bz * size, maxZ: (bz + 1) * size } })
  ```
- Horizon chunks use a per-chunk index. Replace
  ```js
      if (!hChunks.has(k)) hChunks.set(k, bAcc())
      appendBuilding(hChunks.get(k), extrudeBuilding({ outer: hb.outer, holes: [], base: 0, top: hb.top }), FACADE_FAMILIES.indexOf(hb.family), hb.seed, i)
  ```
  with
  ```js
      if (!hChunks.has(k)) hChunks.set(k, { ...bAcc(), n: 0 })
      const H = hChunks.get(k)
      appendBuilding(H, extrudeBuilding({ outer: hb.outer, holes: [], base: 0, top: hb.top }), FACADE_FAMILIES.indexOf(hb.family), hb.seed, H.n++)
  ```
  and change `hBoxes.forEach((hb, i) => {` to `hBoxes.forEach((hb) => {`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix pipeline`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/blocks.js pipeline/tests/blocks.test.js pipeline/tests/tilepack.test.js pipeline/build/build-world.js
git commit -m "fix(pipeline): _BLDG unique per block and horizon chunk, blocks/<bk>.json maps ids back to tiles (H7)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Raster primitives (grid, scanline fill, distance field, 16-bit heights)

**Files:**
- Create: `pipeline/lib/raster.js`
- Test: `pipeline/tests/raster.test.js`

**Interfaces:**
- Produces:
  - `makeGrid({ minX, minZ, maxX, maxZ }, cell) → { minX, minZ, cell, width, height }`
  - `cellOf(grid, x, z) → index | -1`
  - `fillPolygon(grid, rings, visit: (index) => void)` (even-odd over all rings, cell-centre sampling)
  - `distanceField(mask: Uint8Array, w, h) → Float32Array` (distance in cells to the nearest non-zero cell; 8-neighbour chamfer)
  - `encodeHeights(h: ArrayLike<number>, scale) → Uint8Array` (RGB: R = high byte, G = low byte of `round(h/scale)`, B = 0)
  - Row 0 = `minZ` (north). Column 0 = `minX`.

- [ ] **Step 1: Write the failing test**

```js
// pipeline/tests/raster.test.js
import { describe, it, expect } from 'vitest'
import { makeGrid, cellOf, fillPolygon, distanceField, encodeHeights } from '../lib/raster.js'

describe('raster', () => {
  const g = makeGrid({ minX: 0, minZ: 0, maxX: 80, maxZ: 40 }, 8)
  it('grid dimensions round up; cellOf maps world → index, −1 outside', () => {
    expect(g).toEqual({ minX: 0, minZ: 0, cell: 8, width: 10, height: 5 })
    expect(cellOf(g, 12, 20)).toBe(2 * 10 + 1)
    expect(cellOf(g, -1, 0)).toBe(-1)
    expect(cellOf(g, 80, 0)).toBe(-1)
  })
  it('fills cells whose centres are inside; holes stay empty', () => {
    const hit = new Set()
    fillPolygon(g, [[[0, 0], [40, 0], [40, 40], [0, 40]], [[16, 16], [24, 16], [24, 24], [16, 24]]], (k) => hit.add(k))
    expect(hit.size).toBe(25 - 1) // 5×5 cells, centre cell (20,20) is in the hole
    expect(hit.has(cellOf(g, 20, 20))).toBe(false)
    expect(hit.has(cellOf(g, 44, 4))).toBe(false)
  })
  it('chamfer distance: 1 per straight step, √2 per diagonal step', () => {
    const m = new Uint8Array(9 * 9); m[4 * 9 + 4] = 1
    const d = distanceField(m, 9, 9)
    expect(d[4 * 9 + 4]).toBe(0)
    expect(d[4 * 9 + 7]).toBeCloseTo(3, 6)
    expect(d[5 * 9 + 5]).toBeCloseTo(Math.SQRT2, 6)
  })
  it('heights as decimetres in two bytes: 527.3 m → 0x14 0x99', () => {
    const px = encodeHeights([527.3, 0, 7000], 0.1)
    expect([...px.slice(0, 3)]).toEqual([0x14, 0x99, 0])
    expect([...px.slice(3, 6)]).toEqual([0, 0, 0])
    expect([...px.slice(6, 9)]).toEqual([0xff, 0xff, 0]) // clamped at 6553.5 m
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix pipeline -- tests/raster.test.js`
Expected: FAIL — `Failed to resolve import "../lib/raster.js"`

- [ ] **Step 3: Write the implementation**

```js
// pipeline/lib/raster.js — world-aligned rasters for baked textures (shore distance, camera heightfield).
// Row 0 is minZ (north), column 0 is minX (west); cell centres are sampled.
export function makeGrid({ minX, minZ, maxX, maxZ }, cell) {
  return { minX, minZ, cell, width: Math.ceil((maxX - minX) / cell), height: Math.ceil((maxZ - minZ) / cell) }
}

export function cellOf(g, x, z) {
  const i = Math.floor((x - g.minX) / g.cell), j = Math.floor((z - g.minZ) / g.cell)
  return i < 0 || j < 0 || i >= g.width || j >= g.height ? -1 : j * g.width + i
}

// Scanline fill, even-odd over all rings (holes stay empty): visit(index) for every cell centre inside.
export function fillPolygon(g, rings, visit) {
  let minZ = Infinity, maxZ = -Infinity
  for (const r of rings) for (const p of r) { if (p[1] < minZ) minZ = p[1]; if (p[1] > maxZ) maxZ = p[1] }
  const j0 = Math.max(0, Math.floor((minZ - g.minZ) / g.cell - 0.5)), j1 = Math.min(g.height - 1, Math.ceil((maxZ - g.minZ) / g.cell - 0.5))
  const xs = []
  for (let j = j0; j <= j1; j++) {
    const z = g.minZ + (j + 0.5) * g.cell
    xs.length = 0
    for (const r of rings) for (let a = 0, b = r.length - 1; a < r.length; b = a++) {
      const [xa, za] = r[a], [xb, zb] = r[b]
      if ((za > z) !== (zb > z)) xs.push(xa + ((z - za) * (xb - xa)) / (zb - za))
    }
    xs.sort((p, q) => p - q)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - g.minX) / g.cell - 0.5)), i1 = Math.min(g.width - 1, Math.floor((xs[k + 1] - g.minX) / g.cell - 0.5))
      for (let i = i0; i <= i1; i++) visit(j * g.width + i)
    }
  }
}

// Distance (in cells) from every cell to the nearest non-zero mask cell — two-pass 8-neighbour chamfer.
export function distanceField(mask, w, h) {
  const d = new Float32Array(w * h), D = Math.SQRT2
  for (let k = 0; k < d.length; k++) d[k] = mask[k] ? 0 : 1e9
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i
    let v = d[k]
    if (i > 0) v = Math.min(v, d[k - 1] + 1)
    if (j > 0) {
      v = Math.min(v, d[k - w] + 1)
      if (i > 0) v = Math.min(v, d[k - w - 1] + D)
      if (i < w - 1) v = Math.min(v, d[k - w + 1] + D)
    }
    d[k] = v
  }
  for (let j = h - 1; j >= 0; j--) for (let i = w - 1; i >= 0; i--) {
    const k = j * w + i
    let v = d[k]
    if (i < w - 1) v = Math.min(v, d[k + 1] + 1)
    if (j < h - 1) {
      v = Math.min(v, d[k + w] + 1)
      if (i < w - 1) v = Math.min(v, d[k + w + 1] + D)
      if (i > 0) v = Math.min(v, d[k + w - 1] + D)
    }
    d[k] = v
  }
  return d
}

// Heights → 8-bit RGB carrying 16-bit steps of `scale` metres (browsers read PNGs through an 8-bit canvas).
export function encodeHeights(h, scale) {
  const out = new Uint8Array(h.length * 3)
  for (let k = 0; k < h.length; k++) {
    const v = Math.max(0, Math.min(65535, Math.round(h[k] / scale)))
    out[k * 3] = v >> 8
    out[k * 3 + 1] = v & 255
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix pipeline -- tests/raster.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/raster.js pipeline/tests/raster.test.js
git commit -m "feat(pipeline): raster primitives — scanline fill, chamfer distance, 16-bit height encoding" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Lake mesh, shore texture, camera heightfield; fetch and build world v4 (B4, B6, G1 data)

**Files:**
- Create: `pipeline/lib/lake.js`, `pipeline/lib/shore.js`, `pipeline/lib/heightfield.js`
- Modify: `pipeline/build/build-world.js` (solid land; bakes; manifest entries)
- Test: `pipeline/tests/lake.test.js`, `pipeline/tests/shore.test.js`, `pipeline/tests/heightfield.test.js`
- Output (committed): `app/public/world/**`, including the new `ground/lake.glb`, `water/shore.png` and `heightfield.png`

**Interfaces:**
- Consumes:
  - `makeGrid`, `fillPolygon`, `cellOf`, `distanceField`, `encodeHeights` (Task 10).
  - `flatMesh`, `GROUND_Y.lake` (Task 8).
  - `CALM.lake` (Task 8).
  - `breakwaters` (Task 8).
  - `tiles`, `blockList`, `hBoxes`, `shoreX`, `z0`, `z1` (existing locals in `main()`).
- Produces:
  - `LAKE = { width: 120000, depth: 160000 }`
  - `lakePolygons({ center, land, water }) → Array<{ outer, holes }>`
  - `SHORE = { cell: 4, maxDist: 200 }`
  - `bakeShore({ bounds, land, water }) → { grid, pixels: Uint8Array }` (0 on shore … 255 at ≥ 200 m)
  - `HEIGHTFIELD = { cell: 8, scale: 0.1 }`
  - `bakeHeightfield({ pieces, points }, bounds) → { grid, heights: Float32Array }`
  - `meshPoints(buildings) → [x, y, z][]`
  - `boundsUnion(list) → bounds`
  - Manifest v4 keys, consumed by the app in Tasks 14 and 21:
    - `lake: 'ground/lake.glb'`
    - `shore: { file: 'water/shore.png', minX, minZ, cell, width, height, maxDist }`
    - `heightfield: { file: 'heightfield.png', minX, minZ, cell, width, height, scale }`

- [ ] **Step 1: Write the failing tests**

```js
// pipeline/tests/lake.test.js
import { describe, it, expect } from 'vitest'
import { lakePolygons, LAKE } from '../lib/lake.js'
import { pointInRing } from '../lib/geom.js'

describe('lake polygon (B4)', () => {
  const land = [{ outer: [[-5000, -5000], [0, -5000], [0, 5000], [-5000, 5000]], holes: [] }]
  const harbour = [{ outer: [[0, 0], [300, 0], [300, 300], [0, 300]], holes: [] }]
  const lake = lakePolygons({ center: [0, 0], land, water: harbour })
  const inLake = (p) => lake.some((q) => pointInRing(p, q.outer) && !q.holes.some((h) => pointInRing(p, h)))
  it('is 120 km east–west and 160 km north–south around the shoreline', () => {
    expect(LAKE).toEqual({ width: 120000, depth: 160000 })
    expect(inLake([59000, 79000])).toBe(true)
    expect(inLake([61000, 0])).toBe(false)
  })
  it('never overlaps land or the mapped harbour (no z-fighting)', () => {
    expect(inLake([-100, 0])).toBe(false)
    expect(inLake([150, 150])).toBe(false)
    expect(inLake([1000, 150])).toBe(true)
  })
})
```

```js
// pipeline/tests/shore.test.js
import { describe, it, expect } from 'vitest'
import { bakeShore, SHORE } from '../lib/shore.js'

describe('shore distance texture (B6)', () => {
  const land = [{ outer: [[0, 0], [20, 0], [20, 40], [0, 40]], holes: [] }]
  const { grid, pixels } = bakeShore({ bounds: { minX: 0, minZ: 0, maxX: 400, maxZ: 40 }, land, water: [] })
  it('4 m cells over the band', () => {
    expect(SHORE).toEqual({ cell: 4, maxDist: 200 })
    expect(grid).toEqual({ minX: 0, minZ: 0, cell: 4, width: 100, height: 10 })
  })
  it('0 on land, grows with distance, saturates at 200 m', () => {
    expect(pixels[5 * 100 + 2]).toBe(0)
    expect(pixels[5 * 100 + 15]).toBe(Math.round((44 / 200) * 255)) // cell centre x=62, nearest land centre x=18
    expect(pixels[5 * 100 + 99]).toBe(255)
  })
  it('mapped water carves the land (harbours and lagoons get their own shore)', () => {
    const r = bakeShore({ bounds: { minX: 0, minZ: 0, maxX: 400, maxZ: 40 }, land, water: [{ outer: [[8, 0], [16, 0], [16, 40], [8, 40]], holes: [] }] })
    expect(r.pixels[5 * 100 + 2]).toBeGreaterThan(0)
  })
})
```

```js
// pipeline/tests/heightfield.test.js
import { describe, it, expect } from 'vitest'
import { bakeHeightfield, meshPoints, boundsUnion, HEIGHTFIELD } from '../lib/heightfield.js'

describe('camera heightfield (G1)', () => {
  const bounds = { minX: -40, minZ: -40, maxX: 120, maxZ: 120 }
  const { grid, heights } = bakeHeightfield({
    pieces: [{ outer: [[0, 0], [40, 0], [40, 40], [0, 40]], top: 100 }, { outer: [[81, 81], [83, 81], [83, 83], [81, 83]], top: 60 }],
    points: [[100, 250, 100]],
  }, bounds)
  const at = (x, z) => heights[Math.floor((z - grid.minZ) / grid.cell) * grid.width + Math.floor((x - grid.minX) / grid.cell)]
  it('max roof height per 8 m cell', () => {
    expect(HEIGHTFIELD).toEqual({ cell: 8, scale: 0.1 })
    expect(grid.width).toBe(20)
    expect(at(20, 20)).toBe(100)
    expect(at(-36, -36)).toBe(0)
  })
  it('thin footprints and crown vertices still mark their cells', () => {
    expect(at(82, 82)).toBe(60)
    expect(at(100, 100)).toBe(250)
  })
  it('meshPoints reads crown and venue vertices; boundsUnion spans tiles and blocks', () => {
    expect(meshPoints([{ extraMeshes: [{ positions: [1, 2, 3] }], venueMeshes: [{ mesh: { positions: [4, 5, 6] } }] }])).toEqual([[1, 2, 3], [4, 5, 6]])
    expect(boundsUnion([{ minX: 0, minZ: 0, maxX: 500, maxZ: 500 }, { minX: -2000, minZ: 0, maxX: 0, maxZ: 2000 }])).toEqual({ minX: -2000, minZ: 0, maxX: 500, maxZ: 2000 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --prefix pipeline -- tests/lake.test.js tests/shore.test.js tests/heightfield.test.js`
Expected: FAIL — `Failed to resolve import "../lib/lake.js"` (and likewise for `shore.js` and `heightfield.js`)

- [ ] **Step 3: Write the implementation**

```js
// pipeline/lib/lake.js — the open lake: a 120 × 160 km rectangle centred on the shoreline, minus land and minus
// the mapped water polygons (river, harbours, lagoons), so no two water surfaces ever overlap.
import polygonClipping from 'polygon-clipping'
import { openRing, signedArea } from './geom.js'

export const LAKE = { width: 120000, depth: 160000 }
const close = (r) => [...r, r[0]]

export function lakePolygons({ center, land, water }) {
  const [cx, cz] = center, hw = LAKE.width / 2, hd = LAKE.depth / 2
  const rect = [[[cx - hw, cz - hd], [cx + hw, cz - hd], [cx + hw, cz + hd], [cx - hw, cz + hd], [cx - hw, cz - hd]]]
  const cut = [...land, ...water].map((p) => [close(p.outer), ...(p.holes || []).map(close)])
  return polygonClipping.difference(rect, ...cut)
    .map(([outer, ...holes]) => ({ outer: openRing(outer), holes: holes.map(openRing) }))
    .filter((p) => p.outer.length >= 3 && Math.abs(signedArea(p.outer)) > 1)
}
```

```js
// pipeline/lib/shore.js — distance to the nearest shore over the lake band, as an 8-bit image the water shader
// reads for foam and the shallow tint: 0 on the shore, 255 at maxDist metres or more.
import { makeGrid, fillPolygon, distanceField } from './raster.js'

export const SHORE = { cell: 4, maxDist: 200 }

export function bakeShore({ bounds, land, water }) {
  const g = makeGrid(bounds, SHORE.cell)
  const mask = new Uint8Array(g.width * g.height)
  for (const p of land) fillPolygon(g, [p.outer, ...(p.holes || [])], (k) => { mask[k] = 1 })
  for (const p of water) fillPolygon(g, [p.outer, ...(p.holes || [])], (k) => { mask[k] = 0 })
  const d = distanceField(mask, g.width, g.height)
  const pixels = new Uint8Array(d.length)
  for (let k = 0; k < d.length; k++) pixels[k] = Math.min(255, Math.round(((d[k] * SHORE.cell) / SHORE.maxDist) * 255))
  return { grid: g, pixels }
}
```

```js
// pipeline/lib/heightfield.js — the tallest thing in every 8 m cell (roofs, crowns, stands), for camera clearance.
import { makeGrid, fillPolygon, cellOf } from './raster.js'

export const HEIGHTFIELD = { cell: 8, scale: 0.1 }

export function bakeHeightfield({ pieces, points }, bounds) {
  const g = makeGrid(bounds, HEIGHTFIELD.cell)
  const h = new Float32Array(g.width * g.height)
  const put = (k, y) => { if (k >= 0 && y > h[k]) h[k] = y }
  for (const pc of pieces) {
    fillPolygon(g, [pc.outer], (k) => put(k, pc.top)) // courtyards count as roof: conservative
    for (const [x, z] of pc.outer) put(cellOf(g, x, z), pc.top) // footprints thinner than a cell
  }
  for (const [x, y, z] of points) put(cellOf(g, x, z), y)
  return { grid: g, heights: h }
}

export function meshPoints(buildings) {
  const out = []
  for (const b of buildings) for (const m of [...(b.extraMeshes || []), ...(b.venueMeshes || []).map((v) => v.mesh)]) {
    for (let i = 0; i < m.positions.length; i += 3) out.push([m.positions[i], m.positions[i + 1], m.positions[i + 2]])
  }
  return out
}

export function boundsUnion(list) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity
  for (const b of list) { minX = Math.min(minX, b.minX); minZ = Math.min(minZ, b.minZ); maxX = Math.max(maxX, b.maxX); maxZ = Math.max(maxZ, b.maxZ) }
  return { minX, minZ, maxX, maxZ }
}
```

In `pipeline/build/build-world.js`:
- Add the imports:
  ```js
  import { lakePolygons } from '../lib/lake.js'
  import { bakeShore, SHORE } from '../lib/shore.js'
  import { bakeHeightfield, meshPoints, boundsUnion, HEIGHTFIELD } from '../lib/heightfield.js'
  import { encodeHeights } from '../lib/raster.js'
  ```
- Solid land (city-boundary holes filled). Directly after the `const region = [...]` line, add:
  ```js
    // Land is solid: enclave holes in the city boundary (other municipalities) are still land, never lake.
    const landSolid = [...landPolys, ...region].map((p) => ({ outer: p.outer, holes: [] }))
  ```
- Replace `await writeMeshGlb(join(OUT, 'ground', 'land.glb'), flatMesh([...landPolys, ...region], 0))` with `await writeMeshGlb(join(OUT, 'ground', 'land.glb'), flatMesh(landSolid, 0))`.
- Directly after the line `log(`horizon: ${hBoxes.length} buildings in ${hChunks.size} chunks`)`, add:

```js
  // ── Lake Michigan, the shoreline texture, the camera heightfield ────────────
  const lakePolys = lakePolygons({ center: [shoreX(0), 0], land: landSolid, water })
  const lakeM = flatMesh(lakePolys, GROUND_Y.lake)
  await writeMeshGlb(join(OUT, 'ground', 'lake.glb'), { ...lakeM, extra: { CALM: new Float32Array(lakeM.positions.length / 3).fill(CALM.lake) } })
  log(`lake: ${lakePolys.length} polygons, ${lakeM.positions.length / 9} triangles`)
  const shoreXs = []
  for (let z = z0; z <= z1; z += 250) shoreXs.push(shoreX(z))
  const shoreBounds = { minX: Math.min(...shoreXs) - 600, maxX: Math.max(...shoreXs) + 1600, minZ: z0 - 2000, maxZ: z1 + 2000 }
  const shore = bakeShore({ bounds: shoreBounds, land: [...landSolid, ...breakwaters.map((b) => b.polygons[0])], water })
  mkdirSync(join(OUT, 'water'), { recursive: true })
  await sharp(Buffer.from(shore.pixels), { raw: { width: shore.grid.width, height: shore.grid.height, channels: 1 } }).png({ compressionLevel: 9 }).toFile(join(OUT, 'water', 'shore.png'))
  const hf = bakeHeightfield({ pieces: [...buildings.flatMap((b) => b.pieces), ...hBoxes], points: meshPoints(buildings) }, boundsUnion([...tiles.map((t) => t.bounds), ...blockList.map((b) => b.bounds)]))
  await sharp(Buffer.from(encodeHeights(hf.heights, HEIGHTFIELD.scale)), { raw: { width: hf.grid.width, height: hf.grid.height, channels: 3 } }).png({ compressionLevel: 9 }).toFile(join(OUT, 'heightfield.png'))
  log(`shore ${shore.grid.width}×${shore.grid.height} px, heightfield ${hf.grid.width}×${hf.grid.height} px`)
```

- In the manifest object, replace `tiles, blocks: blockList, land: 'ground/land.glb', landMask: 'land.json',` with:

```js
    tiles, blocks: blockList, land: 'ground/land.glb', lake: 'ground/lake.glb', landMask: 'land.json',
    shore: { file: 'water/shore.png', ...shore.grid, maxDist: SHORE.maxDist },
    heightfield: { file: 'heightfield.png', ...hf.grid, scale: HEIGHTFIELD.scale },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix pipeline`
Expected: PASS (all suites)

- [ ] **Step 5: Fetch the new water and shore data (network, light)**

Run: `rm -f pipeline/cache/world/osm-water-*.json && npm run fetch:world --prefix pipeline`
Expected: `✓ osm-water-0.json (…)` through `✓ osm-water-5.json`, then `✓ osm-shore-0.json` through `✓ osm-shore-5.json`, then `world fetch done`. The other kinds are skipped because they are cached.

- [ ] **Step 6: Build world v4 (heavy; nothing else running)**

Run: `npm run build:world --prefix pipeline`
Expected log lines, in order:
- `trees removed — venues <n>, clearings <n>, footprints <n>; venue zones: unitedcenter, soldierfield, wrigleyfield, ratefield, wintrust, buckingham` (order as in heroes.json)
- `breakwaters: <n > 0>`
- `venue tree check: 0 trees inside any venue`
- `lake: …`
- `shore … px, heightfield … px`
- `skyline: missing 0, wrong height 0`
- `manifest written`

No exception.

Then run: `ls -la app/public/world/ground/lake.glb app/public/world/water/shore.png app/public/world/heightfield.png && du -sh app/public/world && node -e "const m=require('./app/public/world/manifest.json'); console.log(m.version, m.lake, m.shore.width, m.heightfield.width, 'generatedAt' in m, m.blocks[0].meta)"`
Expected: three files exist; the size is ≤ `200M`; the last line is `4 ground/lake.glb <w> <w> false blocks/<key>.json`.

Record in the ledger:
- the world size;
- the breakwater count;
- the lake triangle count;
- the Soldier Field venue-tree count (0).

If `du` exceeds 200 MB, stop condition: record it, then halve the shore resolution (`SHORE.cell = 8`) with a `Ruling:` line and rebuild.

- [ ] **Step 7: Commit (code + world output)**

```bash
git add pipeline/lib/lake.js pipeline/lib/shore.js pipeline/lib/heightfield.js pipeline/tests/lake.test.js pipeline/tests/shore.test.js pipeline/tests/heightfield.test.js pipeline/build/build-world.js app/public/world
git commit -m "feat(pipeline): world v4 — baked lake mesh (120×160 km, land and harbours cut out), shore distance texture, camera heightfield, breakwaters, lagoons (B4, B6, B7, G1)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: ⌘K / Ctrl+K close the palette from its input; Ctrl+K never reaches the browser (G4, closes H8)

**Files:**
- Modify: `app/src/hud/CommandPalette.jsx`
- Test: `app/src/hud/__tests__/palette.test.jsx` (append)

**Interfaces:**
- Produces: `isPaletteKey(e) → boolean` (exported; ⌘ or Ctrl + `k`/`K` or `code === 'KeyK'`).

- [ ] **Step 1: Write the failing test** (append inside `describe('CommandPalette', …)`)

```js
  it('⌘K and Ctrl+K close the palette from inside its input (G4)', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'k', metaKey: true })
    expect(useStore.getState().paletteOpen).toBe(false)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const notPrevented = fireEvent.keyDown(screen.getByRole('combobox'), { key: 'K', ctrlKey: true, shiftKey: true })
    expect(notPrevented).toBe(false) // the browser's own Ctrl+K search never sees it
    expect(useStore.getState().paletteOpen).toBe(false)
  })
  it('Ctrl+K on the page opens the palette and stops the browser default', () => {
    render(<CommandPalette />)
    expect(fireEvent.keyDown(window, { key: 'k', ctrlKey: true })).toBe(false)
    expect(useStore.getState().paletteOpen).toBe(true)
  })
  it('plain k types into the search (review focus)', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const input = screen.getByRole('combobox')
    expect(fireEvent.keyDown(input, { key: 'k' })).toBe(true)
    fireEvent.change(input, { target: { value: 'k' } })
    expect(useStore.getState().paletteOpen).toBe(true)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix app -- src/hud/__tests__/palette.test.jsx`
Expected: FAIL on the first new test — `expected true to be false`. The input's `stopPropagation` keeps ⌘K from reaching the window listener.

- [ ] **Step 3: Write the implementation**

In `app/src/hud/CommandPalette.jsx`, add above `function commands()`:

```js
// ⌘K on Mac, Ctrl+K on Windows/Linux; code covers non-Latin keyboard layouts.
export const isPaletteKey = (e) => (e.metaKey || e.ctrlKey) && (e.key?.toLowerCase() === 'k' || e.code === 'KeyK')
```

In the window listener, replace `if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {` with `if (isPaletteKey(e)) {`.

In `onKeyDown`, make the first branch:

```js
    if (isPaletteKey(e)) { e.preventDefault(); e.stopPropagation(); close(); return }
```

so the handler reads `const onKeyDown = (e) => { if (isPaletteKey(e)) { … } if (e.key === 'ArrowDown') …`, with the rest unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix app -- src/hud/__tests__/palette.test.jsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/hud/CommandPalette.jsx app/src/hud/__tests__/palette.test.jsx
git commit -m "fix(hud): ⌘K/Ctrl+K close the palette from its input and never fall through to the browser (G4, closes H8)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Versioned world URLs and GPU disposal on unmount (H10, D1 cache factor)

**Files:**
- Create: `app/src/world/dispose.js`
- Modify: `app/src/lib/manifest.js` (append `worldUrl`)
- Modify: `app/src/world/Land.jsx`
- Modify: `app/src/world/TileContent.jsx` (url, sidecar fetch, `release`)
- Modify: `app/src/world/TileStreamer.jsx` (passes `version`)
- Modify: `app/src/world/Scene.jsx` (passes `version` to `Land`)
- Test: `app/src/lib/__tests__/manifest.test.js` (append); `app/src/world/__tests__/dispose.test.jsx` (new)

**Interfaces:**
- Produces:
  - `worldUrl(file: string, version?: number) → string` (`/world/<file>?v=<version>`)
  - `disposeObject(root: THREE.Object3D | null) → number` (geometries disposed; materials are shared and never disposed)
  - `Land({ file, version })`
  - `TileContent({ id, file, meta, lod, mats, version, onReady })`

- [ ] **Step 1: Write the failing tests**

Append to `app/src/lib/__tests__/manifest.test.js`:

```js
describe('worldUrl (review focus: no stale v3 files after a v4 rebuild)', () => {
  it('every world URL carries the manifest version', async () => {
    const { worldUrl } = await import('../manifest.js')
    expect(worldUrl('tiles/0_0.glb', 4)).toBe('/world/tiles/0_0.glb?v=4')
    expect(worldUrl('tiles/0_0.json', 4)).toBe('/world/tiles/0_0.json?v=4')
    expect(worldUrl('ground/land.glb')).toBe('/world/ground/land.glb')
  })
})
```

```jsx
// app/src/world/__tests__/dispose.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import * as THREE from 'three'
import { disposeObject } from '../dispose.js'

const h = vi.hoisted(() => ({ scene: null, urls: [] }))
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({ GLTFLoader: class { loadAsync(url) { h.urls.push(url); return Promise.resolve({ scene: h.scene }) } } }))
vi.mock('../materials/useGroundMaterials.js', () => ({ useGroundMaterials: () => ({ land: {} }) }))
import Land from '../Land.jsx'

describe('disposal (H10)', () => {
  it('disposeObject frees every geometry and leaves shared materials alone', () => {
    const mat = new THREE.MeshStandardMaterial(), matSpy = vi.spyOn(mat, 'dispose')
    const a = new THREE.BufferGeometry(), b = new THREE.BufferGeometry()
    const sa = vi.spyOn(a, 'dispose'), sb = vi.spyOn(b, 'dispose')
    const g = new THREE.Group(); g.add(new THREE.Mesh(a, mat)); g.add(new THREE.Mesh(b, mat))
    expect(disposeObject(g)).toBe(2)
    expect(sa).toHaveBeenCalledTimes(1); expect(sb).toHaveBeenCalledTimes(1); expect(matSpy).not.toHaveBeenCalled()
    expect(disposeObject(null)).toBe(0)
  })
  it('Land disposes its geometry on unmount (no leak across remounts) and loads a versioned URL', async () => {
    const geo = new THREE.BufferGeometry(), spy = vi.spyOn(geo, 'dispose')
    h.scene = new THREE.Group(); h.scene.add(new THREE.Mesh(geo))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {}) // <primitive> is an R3F tag; react-dom warns
    const { unmount } = render(<Land file="ground/land.glb" version={4} />)
    await waitFor(() => expect(document.querySelector('primitive')).not.toBeNull())
    unmount()
    err.mockRestore()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(h.urls).toEqual(['/world/ground/land.glb?v=4'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --prefix app -- src/lib/__tests__/manifest.test.js src/world/__tests__/dispose.test.jsx`
Expected: FAIL — `worldUrl is not a function`; `Failed to resolve import "../dispose.js"`

- [ ] **Step 3: Write the implementation**

Append to `app/src/lib/manifest.js`:

```js
// Every world file is fetched with the manifest version: a format bump never mixes cached old tiles with new ones.
export const worldUrl = (file, version) => `/world/${file}${version ? `?v=${version}` : ''}`
```

```js
// app/src/world/dispose.js — free the GPU buffers of a loaded glTF scene. Materials are shared across
// tiles (façades, ground, water) and are never disposed here.
export function disposeObject(root) {
  let n = 0
  root?.traverse?.((o) => { if (o.geometry) { o.geometry.dispose(); n++ } })
  return n
}
```

Replace `app/src/world/Land.jsx` with:

```jsx
// app/src/world/Land.jsx — the city's land mass (global, low-poly) under the streamed tiles.
// Loaded imperatively (no Suspense): it always reports done, loaded or not, so it can never hold the loading screen.
import { useEffect, useState } from 'react'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { useStore } from '../state/store.js'
import { useGroundMaterials } from './materials/useGroundMaterials.js'
import { worldUrl } from '../lib/manifest.js'
import { disposeObject } from './dispose.js'

export default function Land({ file, version }) {
  const mats = useGroundMaterials()
  const [scene, setScene] = useState(null)
  useEffect(() => {
    let alive = true, loaded = null
    new GLTFLoader().loadAsync(worldUrl(file, version))
      .then((g) => { loaded = g.scene; if (alive) setScene(g.scene); else disposeObject(g.scene) })
      .catch((e) => console.warn('land failed', e))
      .finally(() => useStore.getState().markLoaded('land'))
    return () => { alive = false; disposeObject(loaded) }
  }, [file, version])
  useEffect(() => {
    if (!scene || !mats) return
    scene.traverse((o) => { if (o.isMesh) { o.material = mats.land; o.receiveShadow = true } })
  }, [scene, mats])
  return scene && mats ? <primitive object={scene} /> : null
}
```

`app/src/world/TileContent.jsx`:
- Add the imports `import { worldUrl } from '../lib/manifest.js'` and `import { disposeObject } from './dispose.js'`.
- Change the `release` timer body `scene.traverse((o) => o.isMesh && o.geometry.dispose())` to `disposeObject(scene)`.
- Change the signature to `export default function TileContent({ id, file, meta, lod, mats, version, onReady }) {`.
- Change `const url = `/world/${file}`` to `const url = worldUrl(file, version)`.
- Change `fetch(`/world/${meta}`)` to `fetch(worldUrl(meta, version))`, and the effect deps from `[meta, lod]` to `[meta, lod, version]`.

`app/src/world/TileStreamer.jsx`: in the returned JSX, change `<TileContent id={id} file={file} meta={t?.meta} lod={lod} mats={mats} onReady={onReady} />` to `<TileContent id={id} file={file} meta={t?.meta} lod={lod} mats={mats} version={manifest.version} onReady={onReady} />`.

`app/src/world/Scene.jsx`: change `{manifest && <Land file={manifest.land} />}` to `{manifest && <Land file={manifest.land} version={manifest.version} />}`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix app`
Expected: PASS (all app suites)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/manifest.js app/src/world/dispose.js app/src/world/Land.jsx app/src/world/TileContent.jsx app/src/world/TileStreamer.jsx app/src/world/Scene.jsx app/src/lib/__tests__/manifest.test.js app/src/world/__tests__/dispose.test.jsx
git commit -m "fix(app): world files fetched with the manifest version; Land and released tiles dispose their geometry (H10, D1)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: `clearance.js` — decode the heightfield, answer `clearanceAt(x, z)` (G1/G2 contract)

**Files:**
- Create: `app/src/lib/clearance.js`
- Modify: `app/src/world/Scene.jsx` (load after the manifest; expose under `?stats`)
- Test: `app/src/lib/__tests__/clearance.test.js`

**Interfaces:**
- Consumes: manifest `heightfield: { file, minX, minZ, cell, width, height, scale }` (Task 11); `worldUrl` (Task 13).
- Produces (the contract V4/V5 use):
  - `CLEARANCE_M = 25`
  - `decodeHeightfield(rgba: Uint8ClampedArray, { width, height }) → Uint16Array` (decimetres)
  - `setHeightfield(grid, dm: Uint16Array | null)`
  - `roofHeightAt(x, z) → metres` (max of the 4 surrounding cells; 0 without data or outside)
  - `clearanceAt(x, z) → roofHeightAt + 25`
  - `loadHeightfield(url, grid) → Promise<void>` (never throws; on failure clears the field, which gives 25 m everywhere)
  - Under `?stats`: `window.__clearanceAt`.

- [ ] **Step 1: Write the failing test**

```js
// app/src/lib/__tests__/clearance.test.js
import { describe, it, expect, afterEach, vi } from 'vitest'
import { CLEARANCE_M, decodeHeightfield, setHeightfield, roofHeightAt, clearanceAt, loadHeightfield } from '../clearance.js'

const grid = { minX: 0, minZ: 0, cell: 8, width: 4, height: 3, scale: 0.1 }

describe('camera clearance (G1/G2)', () => {
  afterEach(() => setHeightfield(grid, null))
  it('decodes decimetres from R (high byte) and G (low byte)', () => {
    const rgba = new Uint8ClampedArray(4 * 12)
    rgba[5 * 4] = 0x14; rgba[5 * 4 + 1] = 0x99; rgba[5 * 4 + 3] = 255
    const dm = decodeHeightfield(rgba, grid)
    expect(dm[5]).toBe(5273)
    expect(dm[0]).toBe(0)
  })
  it('no data → 25 m everywhere', () => {
    expect(CLEARANCE_M).toBe(25)
    expect(clearanceAt(12, 12)).toBe(25)
  })
  it('roof + 25 m over a tower; 25 m over open ground and outside the grid', () => {
    const dm = new Uint16Array(12); dm[5] = 3000 // cell i=1, j=1 (x 8–16, z 8–16): 300 m
    setHeightfield(grid, dm)
    expect(roofHeightAt(12, 12)).toBeCloseTo(300, 6)
    expect(clearanceAt(12, 12)).toBeCloseTo(325, 6)
    expect(clearanceAt(31, 23)).toBe(25)
    expect(clearanceAt(-500, -500)).toBe(25)
  })
  it('samples conservatively: a point up to one cell from a tall cell sees it', () => {
    const dm = new Uint16Array(12); dm[5] = 3000
    setHeightfield(grid, dm)
    expect(clearanceAt(19.5, 12)).toBeCloseTo(325, 6)
    expect(clearanceAt(28.5, 12)).toBe(25)
  })
  it('a failed load falls back to 25 m everywhere (review focus)', async () => {
    const dm = new Uint16Array(12); dm[5] = 3000
    setHeightfield(grid, dm)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(loadHeightfield('/world/missing.png', grid)).resolves.toBeUndefined()
    warn.mockRestore()
    expect(clearanceAt(12, 12)).toBe(25)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix app -- src/lib/__tests__/clearance.test.js`
Expected: FAIL — `Failed to resolve import "../clearance.js"`

- [ ] **Step 3: Write the implementation**

```js
// app/src/lib/clearance.js — how high the camera must stay: the pipeline's roof heightfield (max per 8 m cell,
// decimetres in R/G of heightfield.png) plus 25 m. Used by flights, free flight, and later the follow and venue cams.
export const CLEARANCE_M = 25
let field = null // { minX, minZ, cell, width, height, scale, dm: Uint16Array }

export function decodeHeightfield(rgba, { width, height }) {
  const dm = new Uint16Array(width * height)
  for (let k = 0; k < dm.length; k++) dm[k] = (rgba[k * 4] << 8) | rgba[k * 4 + 1]
  return dm
}

export function setHeightfield(grid, dm) {
  field = dm ? { ...grid, scale: grid.scale ?? 0.1, dm } : null
}

// Max of the four cells around (x, z): conservative within one cell of a façade.
export function roofHeightAt(x, z) {
  if (!field) return 0
  const fx = (x - field.minX) / field.cell - 0.5, fz = (z - field.minZ) / field.cell - 0.5
  const i0 = Math.floor(fx), j0 = Math.floor(fz)
  let m = 0
  for (let j = j0; j <= j0 + 1; j++) for (let i = i0; i <= i0 + 1; i++) {
    if (i < 0 || j < 0 || i >= field.width || j >= field.height) continue
    m = Math.max(m, field.dm[j * field.width + i])
  }
  return m * field.scale
}

export const clearanceAt = (x, z) => roofHeightAt(x, z) + CLEARANCE_M

export async function loadHeightfield(url, grid) {
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const c = document.createElement('canvas')
    c.width = grid.width; c.height = grid.height
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    setHeightfield(grid, decodeHeightfield(ctx.getImageData(0, 0, grid.width, grid.height).data, grid))
  } catch (e) {
    console.warn('heightfield unavailable — camera clearance falls back to 25 m', e)
    setHeightfield(grid, null)
  }
}
```

`app/src/world/Scene.jsx`:
- Add the imports `import { loadHeightfield, clearanceAt } from '../lib/clearance.js'` and `import { worldUrl } from '../lib/manifest.js'`.
- Inside `loadManifest().then((r) => { … })`, after `useStore.getState().setManifest(r.manifest)`, add:
  ```js
      if (r.manifest.heightfield) loadHeightfield(worldUrl(r.manifest.heightfield.file, r.manifest.version), r.manifest.heightfield)
  ```
- In the stats effect, change `{ window.__gl = gl; window.__store = useStore }` to `{ window.__gl = gl; window.__store = useStore; window.__clearanceAt = clearanceAt }`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/clearance.js app/src/lib/__tests__/clearance.test.js app/src/world/Scene.jsx
git commit -m "feat(app): camera clearance from the baked heightfield — clearanceAt(x, z) = roof + 25 m, 25 m fallback (G1/G2)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Flights and double-click never end — or pass — inside a building (G1)

**Files:**
- Modify: `app/src/lib/flight.js`
- Modify: `app/src/camera/AtlasRig.jsx` (the flight-request effect and the flight branch of `useFrame`)
- Test: `app/src/lib/__tests__/flight.test.js` (append)

**Interfaces:**
- Consumes: `clearanceAt` (Task 14).
- Produces:
  - `liftAboveRoofs(pose, clearance = clearanceAt) → pose` (raises `position[1]` only; keeps the target)
  - `flightLift(from, to, clearance = clearanceAt) → metres` (extra arc amplitude, sampled over t ∈ [0.1, 0.9], capped at 1,500)
  - `flyPose(from, to, t, extraLift = 0)` (existing signature plus an optional fourth argument)

- [ ] **Step 1: Write the failing test** (append to `app/src/lib/__tests__/flight.test.js`)

```js
import { beforeAll, afterAll } from 'vitest'
import { liftAboveRoofs, flightLift } from '../flight.js'
import { setHeightfield, clearanceAt } from '../clearance.js'
import { BOOKMARKS } from '../bookmarks.js'

// The 10 tallest landmarks in manifest v3 (x, z, top m) as 64 m square towers, plus a dense Loop: 6×6 towers, 40 m wide, 180 m tall, 20 m streets.
const TALL = [[-674, 366, 527], [394, -1865, 457], [115, -760, 423], [879, -578, 363], [522, -361, 346], [-572, 193, 307], [425, -376, 303], [-99, -1574, 296], [-657, 507, 293], [395, 1672, 281]]
const LOOP = []
for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) LOOP.push([-400 + i * 60, -100 + j * 60, 180])
const TOWERS = [...TALL.map(([x, z, top]) => ({ x, z, half: 32, top })), ...LOOP.map(([x, z, top]) => ({ x, z, half: 20, top }))]
const grid = { minX: -1600, minZ: -2800, cell: 8, width: 450, height: 750, scale: 0.1 }
function fixture() {
  const dm = new Uint16Array(grid.width * grid.height)
  for (const t of TOWERS) {
    const i0 = Math.floor((t.x - t.half - grid.minX) / grid.cell), i1 = Math.ceil((t.x + t.half - grid.minX) / grid.cell)
    const j0 = Math.floor((t.z - t.half - grid.minZ) / grid.cell), j1 = Math.ceil((t.z + t.half - grid.minZ) / grid.cell)
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = grid.minX + (i + 0.5) * grid.cell, cz = grid.minZ + (j + 0.5) * grid.cell
      if (Math.abs(cx - t.x) <= t.half && Math.abs(cz - t.z) <= t.half) dm[j * grid.width + i] = Math.max(dm[j * grid.width + i], t.top * 10)
    }
  }
  return dm
}
const inside = ([x, y, z]) => TOWERS.some((t) => Math.abs(x - t.x) <= t.half && Math.abs(z - t.z) <= t.half && y <= t.top)
const everyFrameClear = (from, to) => {
  const end = liftAboveRoofs(to), lift = flightLift(from, end)
  for (let s = 0; s <= 200; s++) expect(inside(liftAboveRoofs(flyPose(from, end, s / 200, lift)).position)).toBe(false)
  return lift
}

describe('flight clearance (G1)', () => {
  beforeAll(() => setHeightfield(grid, fixture()))
  afterAll(() => setHeightfield(grid, null))
  it('⌘K fly-to ends outside and above every one of the 10 tallest towers', () => {
    for (const [x, z, top] of TALL) {
      const end = liftAboveRoofs(poseForPlace({ x, z, top }))
      expect(inside(end.position)).toBe(false)
      expect(end.position[1]).toBeGreaterThanOrEqual(clearanceAt(end.position[0], end.position[2]))
    }
  })
  it('an end pose inside a tower is lifted to roof + 25 m; the target is kept', () => {
    const end = liftAboveRoofs({ position: [-674, 200, 366], target: [-674, 100, 300] })
    expect(end.position[0]).toBe(-674); expect(end.position[2]).toBe(366)
    expect(end.position[1]).toBeCloseTo(552, 6)
    expect(end.target).toEqual([-674, 100, 300])
  })
  it('no frame of a flight into the dense Loop, or to Willis, is inside a building', () => {
    everyFrameClear(BOOKMARKS.streeterville, { position: [-250, 90, 80], target: [-250, 0, 0] })
    everyFrameClear(BOOKMARKS.streeterville, poseForPlace({ x: -674, z: 366, top: 527 }))
  })
  it('the arc itself rises over a tower in the way (smooth, not only clamped)', () => {
    const from = { position: [-1100, 150, 366], target: [-1000, 100, 366] }, to = { position: [-250, 150, 366], target: [-150, 100, 366] }
    const lift = flightLift(from, to)
    expect(lift).toBeGreaterThan(0)
    for (let s = 10; s <= 90; s++) {
      const p = flyPose(from, to, s / 100, lift).position
      expect(p[1]).toBeGreaterThanOrEqual(clearanceAt(p[0], p[2]) - 1e-6)
    }
  })
  it('a flight that starts low between towers never enters one and does not balloon (review focus)', () => {
    const from = { position: [-370, 40, -70], target: [-370, 10, -200] } // a 20 m street in the Loop block
    expect(clearanceAt(-370, -70)).toBe(25)
    const lift = everyFrameClear(from, poseForPlace({ x: 879, z: -578, top: 363 }))
    expect(lift).toBeLessThanOrEqual(1500)
  })
  it('without a heightfield flights are unchanged', () => {
    setHeightfield(grid, null)
    expect(flightLift(A, B)).toBe(0)
    expect(liftAboveRoofs(A)).toEqual(A)
    setHeightfield(grid, fixture())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix app -- src/lib/__tests__/flight.test.js`
Expected: FAIL — `liftAboveRoofs is not a function`

- [ ] **Step 3: Write the implementation**

Replace `app/src/lib/flight.js` with:

```js
// app/src/lib/flight.js — cinematic fly-to: eased glide that arcs up over the city on long jumps,
// lifted over any roof in the way and never ending inside a building (G1).
import { MIN_ALT } from './cameraMath.js'
import { clearanceAt } from './clearance.js'

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const copy = (p) => ({ position: [...p.position], target: [...p.target] })
const MAX_EXTRA_LIFT = 1500

export function flightDuration(from, to) {
  const d = Math.max(dist(from.target, to.target), dist(from.position, to.position))
  return Math.min(4.5, Math.max(1.4, 1.4 + d / 2500))
}

export function flyPose(from, to, t, extraLift = 0) {
  if (t <= 0) return copy(from)
  if (t >= 1) return copy(to)
  const k = ease(t)
  const lerp = (a, b) => a.map((v, i) => v + (b[i] - v) * k)
  const lift = (Math.min(1400, 0.35 * dist(from.target, to.target)) + extraLift) * Math.sin(Math.PI * t)
  const position = lerp(from.position, to.position)
  position[1] += lift
  return { position, target: lerp(from.target, to.target) }
}

// Raise the camera (never the target) to the clearance over where it stands.
export function liftAboveRoofs(pose, clearance = clearanceAt) {
  const [x, y, z] = pose.position
  const minY = clearance(x, z)
  return y >= minY ? copy(pose) : { position: [x, minY, z], target: [...pose.target] }
}

// Extra arc height so the middle of the path clears the roofs under it. The ends (t < 0.1, t > 0.9) are
// left to liftAboveRoofs per frame: dividing by a near-zero sine there would balloon the arc.
export function flightLift(from, to, clearance = clearanceAt) {
  let need = 0
  for (let s = 10; s <= 90; s += 2) {
    const t = s / 100
    const p = flyPose(from, to, t).position
    const deficit = clearance(p[0], p[2]) - p[1]
    if (deficit > 0) need = Math.max(need, deficit / Math.sin(Math.PI * t))
  }
  return Math.min(need, MAX_EXTRA_LIFT)
}

export function poseForPlace({ x, z, top = 0 }) {
  const d = Math.max(420, top * 2.3)
  return {
    position: [x + d * 0.55, Math.max(MIN_ALT, top * 0.85 + 90), z + d * 0.65],
    target: [x, top * 0.5, z],
  }
}
```

In `app/src/camera/AtlasRig.jsx`:
- Replace the flight import with `import { flyPose, flightDuration, flightLift, liftAboveRoofs } from '../lib/flight.js'` and add `import { clearanceAt } from '../lib/clearance.js'`.
- In the "new flight request" effect, replace
  ```js
    const from = pose(ref.current)
    flightRun.current = { from, to: flight.to, t0: null, dur: flightDuration(from, flight.to) }
  ```
  with
  ```js
    const from = pose(ref.current)
    const to = liftAboveRoofs(flight.to, clearanceAt)
    flightRun.current = { from, to, t0: null, dur: flightDuration(from, to), lift: flightLift(from, to, clearanceAt) }
  ```
- In the `useFrame` flight branch, replace `const p = flyPose(f.from, f.to, t)` with `const p = liftAboveRoofs(flyPose(f.from, f.to, t, f.lift), clearanceAt)`.

(Double-click and the minimap both go through `startFlight`, so they are covered.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/flight.js app/src/lib/__tests__/flight.test.js app/src/camera/AtlasRig.jsx
git commit -m "feat(camera): ⌘K flights, views and double-click lift their arc and end pose above the roofs — never inside a tower (G1)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Free flight slides along towers and rises over them (G2)

**Files:**
- Modify: `app/src/lib/cameraMath.js` (append `slideMove`, `STEP_M`)
- Modify: `app/src/camera/AtlasRig.jsx` (glide move; end-of-frame clamp)
- Test: `app/src/lib/__tests__/cameraMath.test.js` (append)

**Interfaces:**
- Consumes: `clearanceAt` (Task 14).
- Produces:
  - `STEP_M = 12`
  - `slideMove(position: [x,y,z], delta: [dx,dy,dz], clearance: (x,z)=>number) → [dx,dy,dz]` (the applied move)

- [ ] **Step 1: Write the failing test** (append to `app/src/lib/__tests__/cameraMath.test.js`)

```js
import { slideMove, STEP_M } from '../cameraMath.js'

describe('free-flight clearance (G2)', () => {
  const open = () => 25
  const wallEast = (x) => (x > 5 ? 300 : 25) // a 275 m tower face at x = 5
  it('open ground: the move passes unchanged', () => {
    expect(slideMove([0, 100, 0], [10, 0, 0], open)).toEqual([10, 0, 0])
  })
  it('a diagonal move into a tower slides along its face', () => {
    expect(slideMove([0, 100, 0], [10, 0, 10], wallEast)).toEqual([0, 0, 10])
  })
  it('head-on into a tower: no horizontal motion, the camera rises instead of stopping', () => {
    const [dx, dy, dz] = slideMove([0, 100, 0], [10, 0, 0], wallEast)
    expect(dx).toBe(0); expect(dz).toBe(0)
    expect(dy).toBeGreaterThan(0); expect(dy).toBeLessThanOrEqual(20)
  })
  it('a small rise (≤ STEP_M) is climbed while moving', () => {
    expect(STEP_M).toBe(12)
    expect(slideMove([0, 100, 0], [10, 0, 0], () => 105)).toEqual([10, 5, 0])
  })
  it('holding climb over a tower keeps rising', () => {
    const [, dy] = slideMove([0, 100, 0], [10, 3, 0], wallEast)
    expect(dy).toBeGreaterThan(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix app -- src/lib/__tests__/cameraMath.test.js`
Expected: FAIL — `slideMove is not a function`

- [ ] **Step 3: Write the implementation**

Append to `app/src/lib/cameraMath.js`:

```js
// Free flight never enters a building. A move whose end is under the roof clearance slides along the free
// axis (x-only, then z-only); a small rise (≤ STEP_M) is climbed; head-on, the camera rises at up to twice
// its glide speed instead of stopping.
export const STEP_M = 12

export function slideMove([px, py, pz], [dx, dy, dz], clearance) {
  const y = py + dy
  const ok = (x, z) => clearance(x, z) <= y + STEP_M
  const lift = (x, z) => Math.max(0, clearance(x, z) - y)
  if (ok(px + dx, pz + dz)) return [dx, dy + lift(px + dx, pz + dz), dz]
  if (dx && ok(px + dx, pz)) return [dx, dy + lift(px + dx, pz), 0]
  if (dz && ok(px, pz + dz)) return [0, dy + lift(px, pz + dz), dz]
  const rise = Math.min(lift(px + dx, pz + dz), 2 * Math.hypot(dx, dz))
  return [0, dy + rise, 0]
}
```

In `app/src/camera/AtlasRig.jsx`:
- Change the cameraMath import to `import { clampCamera, glideVector, headingDeg, slideMove, MAX_DIST, WORLD_BOUNDS } from '../lib/cameraMath.js'`.
- In the glide block, replace
  ```js
      c.getTarget(tmpT); c.getPosition(tmpP)
      c.setLookAt(tmpP.x + dx * speed, tmpP.y + dy, tmpP.z + dz * speed, tmpT.x + dx * speed, Math.max(0, tmpT.y + dy), tmpT.z + dz * speed, false)
  ```
  with
  ```js
      c.getTarget(tmpT); c.getPosition(tmpP)
      const [mx, my, mz] = slideMove([tmpP.x, tmpP.y, tmpP.z], [dx * speed, dy, dz * speed], clearanceAt)
      c.setLookAt(tmpP.x + mx, tmpP.y + my, tmpP.z + mz, tmpT.x + mx, Math.max(0, tmpT.y + my), tmpT.z + mz, false)
  ```
- Replace the end-of-frame clamp
  ```js
    const cl = clampCamera(tmpP.toArray(), tmpT.toArray(), WORLD_BOUNDS)
    if (cl.clamped) c.setLookAt(...cl.position, ...cl.target, false)
  ```
  with
  ```js
    const cl = clampCamera(tmpP.toArray(), tmpT.toArray(), WORLD_BOUNDS)
    // drag, scroll and dock zoom can't push the camera into a tower either
    const floor = clearanceAt(cl.position[0], cl.position[2])
    if (cl.position[1] < floor) { cl.position[1] = floor; cl.clamped = true }
    if (cl.clamped) c.setLookAt(...cl.position, ...cl.target, false)
  ```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/cameraMath.js app/src/lib/__tests__/cameraMath.test.js app/src/camera/AtlasRig.jsx
git commit -m "feat(camera): free flight slides along towers and rises over them; drag and zoom can't enter a building (G2)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

(The manual pass at the Willis base is logged in Task 21 Step 9, once the capture script exists.)

---

### Task 17: Water palette (horizon, not grey) and the March 17 green river (B3, B9)

**Files:**
- Create: `app/src/lib/waterPalette.js`
- Test: `app/src/lib/__tests__/waterPalette.test.js`

**Interfaces:**
- Consumes: `paletteFor(elev)` (`app/src/lib/skyPalette.js`: `fog`, `hemiSky`, `water`, `sunColor`, `night`).
- Produces:
  - `waterPalette(elevDeg) → { deep, shallow, horizon, sky, foam, green: THREE.Color, sunColor: THREE.Color, night: number }`
  - `isGreenRiverDay(date = new Date()) → boolean` (March 17, Chicago date)

- [ ] **Step 1: Write the failing test**

```js
// app/src/lib/__tests__/waterPalette.test.js
import { describe, it, expect } from 'vitest'
import { waterPalette, isGreenRiverDay } from '../waterPalette.js'
import { paletteFor } from '../skyPalette.js'

const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b

describe('water palette (B3)', () => {
  it('the far lake fades to a horizon that is bluer than the grey haze', () => {
    for (const elev of [3, 10, 25, 60]) {
      const w = waterPalette(elev), fog = paletteFor(elev).fog
      expect(w.horizon.b - w.horizon.r).toBeGreaterThan(fog.b - fog.r)
      expect(w.horizon.equals(fog)).toBe(false)
    }
  })
  it('tracks the time of day: night water and horizon are dark, day is bright', () => {
    const day = waterPalette(25), night = waterPalette(-12)
    expect(lum(night.horizon)).toBeLessThan(lum(day.horizon) * 0.3)
    expect(lum(night.deep)).toBeLessThan(lum(day.deep))
    expect(night.night).toBe(1); expect(day.night).toBe(0)
  })
  it('shallow water near the shore is lighter than deep water by day', () => {
    const w = waterPalette(25)
    expect(lum(w.shallow)).toBeGreaterThan(lum(w.deep))
  })
})

describe('green river (B9)', () => {
  it('March 17 in Chicago, whatever the UTC date', () => {
    expect(isGreenRiverDay(new Date('2027-03-17T12:00:00-05:00'))).toBe(true)
    expect(isGreenRiverDay(new Date('2027-03-18T03:30:00Z'))).toBe(true) // 22:30 CDT on the 17th
    expect(isGreenRiverDay(new Date('2027-03-17T04:30:00Z'))).toBe(false) // 23:30 CDT on the 16th
    expect(isGreenRiverDay(new Date('2027-03-18T12:00:00-05:00'))).toBe(false)
    expect(isGreenRiverDay(new Date('2026-09-28T12:00:00-05:00'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix app -- src/lib/__tests__/waterPalette.test.js`
Expected: FAIL — `Failed to resolve import "../waterPalette.js"`

- [ ] **Step 3: Write the implementation**

```js
// app/src/lib/waterPalette.js — every water colour as a function of sun elevation (one hue shore → horizon),
// and the St. Patrick's Day green river.
import * as THREE from 'three'
import { paletteFor } from './skyPalette.js'

const SHALLOW = new THREE.Color('#3d7a7e')
const FOAM = new THREE.Color('#dfe8e6')
const GREEN = new THREE.Color('#1f9e5a')

export function waterPalette(elev) {
  const p = paletteFor(elev)
  return {
    deep: p.water.clone(),
    shallow: p.water.clone().lerp(SHALLOW, 0.45 * (1 - 0.7 * p.night)),
    horizon: p.fog.clone().lerp(p.hemiSky, 0.55), // the sky just above the water line: bluer than the haze
    sky: p.hemiSky.clone(),
    foam: FOAM.clone().multiplyScalar(0.25 + 0.75 * (1 - p.night)),
    green: GREEN.clone().multiplyScalar(0.3 + 0.7 * (1 - p.night)),
    sunColor: p.sunColor.clone(),
    night: p.night,
  }
}

export function isGreenRiverDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'numeric', day: 'numeric' }).formatToParts(date)
  const get = (t) => Number(parts.find((x) => x.type === t).value)
  return get('month') === 3 && get('day') === 17
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix app -- src/lib/__tests__/waterPalette.test.js`
Expected: PASS. If the "bluer than the haze" assertion fails at an elevation, raise the `hemiSky` blend weight in steps of 0.05 up to 0.8 and log a `Ruling:`.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/waterPalette.js app/src/lib/__tests__/waterPalette.test.js
git commit -m "feat(water): water palette with a blue horizon that tracks time of day; March 17 green-river date function (B3, B9)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: Mirrored camera and reflection texture matrix

**Files:**
- Create: `app/src/world/water/mirror.js`
- Test: `app/src/world/water/__tests__/mirror.test.js`

**Interfaces:**
- Produces:
  - `mirrorCamera(camera: THREE.PerspectiveCamera, planeY: number, out: THREE.PerspectiveCamera) → out`
  - `textureMatrixFor(mirror, out: THREE.Matrix4) → out` (world → projective reflection UV)
  - Invariant: a point on the plane samples the reflection at `(1 − u_screen, v_screen)`.

- [ ] **Step 1: Write the failing test**

```js
// app/src/world/water/__tests__/mirror.test.js
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { mirrorCamera, textureMatrixFor } from '../mirror.js'

describe('shared planar reflection math', () => {
  const cam = new THREE.PerspectiveCamera(42, 1.6, 5, 60000)
  cam.position.set(300, 250, 900); cam.lookAt(0, 0, 0); cam.updateMatrixWorld()
  const mirror = mirrorCamera(cam, 0, new THREE.PerspectiveCamera())
  it('the mirror camera sits below the water, reflected', () => {
    expect(mirror.position.x).toBeCloseTo(300, 9)
    expect(mirror.position.y).toBeCloseTo(-250, 9)
    expect(mirror.position.z).toBeCloseTo(900, 9)
    expect(mirror.projectionMatrix.equals(cam.projectionMatrix)).toBe(true)
  })
  it('a point on the water samples the reflection at the mirrored screen x, same screen y', () => {
    const m = textureMatrixFor(mirror, new THREE.Matrix4())
    for (const q of [[0, 0, 0], [120, 0, -300], [-80, 0, 200]]) {
      const v = new THREE.Vector4(...q, 1).applyMatrix4(m)
      const s = new THREE.Vector3(...q).project(cam)
      expect(v.x / v.w).toBeCloseTo(1 - (s.x * 0.5 + 0.5), 6)
      expect(v.y / v.w).toBeCloseTo(s.y * 0.5 + 0.5, 6)
    }
  })
  it('works for a water plane above zero', () => {
    const m2 = mirrorCamera(cam, 0.03, new THREE.PerspectiveCamera())
    expect(m2.position.y).toBeCloseTo(-249.94, 9)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix app -- src/world/water/__tests__/mirror.test.js`
Expected: FAIL — `Failed to resolve import "../mirror.js"`

- [ ] **Step 3: Write the implementation**

```js
// app/src/world/water/mirror.js — the camera mirrored in the water plane (Reflector-style), and the matrix
// that maps any world point on the water to its spot in the shared reflection texture.
import * as THREE from 'three'

const _p = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _t = new THREE.Vector3()

export function mirrorCamera(camera, planeY, out) {
  camera.updateMatrixWorld()
  _p.setFromMatrixPosition(camera.matrixWorld)
  camera.getWorldDirection(_f)
  _u.setFromMatrixColumn(camera.matrixWorld, 1) // the camera's real up axis
  out.position.set(_p.x, 2 * planeY - _p.y, _p.z)
  out.up.set(_u.x, -_u.y, _u.z)
  _t.copy(_p).add(_f)
  _t.y = 2 * planeY - _t.y
  out.lookAt(_t)
  out.projectionMatrix.copy(camera.projectionMatrix)
  out.projectionMatrixInverse.copy(camera.projectionMatrixInverse)
  out.updateMatrixWorld()
  return out
}

export function textureMatrixFor(mirror, out) {
  out.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
  out.multiply(mirror.projectionMatrix)
  out.multiply(mirror.matrixWorldInverse)
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix app -- src/world/water/__tests__/mirror.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/world/water/mirror.js app/src/world/water/__tests__/mirror.test.js
git commit -m "feat(water): mirrored camera + reflection texture matrix for one shared planar reflection" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: The `WaterSurface` material and the quality switch (B1, B3, B5, B6, B9, B10)

**Files:**
- Create: `app/src/world/materials/waterSurface.js`
- Modify: `app/src/lib/quality.js` (`reflection` per preset)
- Test: `app/src/world/materials/__tests__/waterSurface.test.js`; append to `app/src/lib/__tests__/quality.test.js`

**Interfaces:**
- Consumes: `worldUrl` (Task 13); the manifest `shore` entry (Task 11).
- Produces:
  - `REFLECT_LAYER = 2`, `WATER_PLANE_Y = 0.03`
  - `waterUniforms` (shared singleton): `uTime, uSize, uNormals, uReflection, uReflect, uTextureMatrix, uShore, uShoreOn, uShoreRect, uDeep, uShallow, uFoam, uHorizon, uSky, uGreenColor, uGreen, uNight, uSunDir, uSunColor, uFar`
  - `WATER_VERTEX`, `WATER_FRAGMENT` (strings)
  - `createWaterMaterial() → THREE.ShaderMaterial`, and `waterMaterial` (the one instance)
  - `loadWaterTextures(shore | null, version?)`
  - `QUALITY[q].reflection`: LOW 0, HIGH 0.5, ULTRA 0.75 (the fraction of drawing-buffer size; 0 = off)

- [ ] **Step 1: Write the failing tests**

```js
// app/src/world/materials/__tests__/waterSurface.test.js
import { describe, it, expect } from 'vitest'
import { createWaterMaterial, waterMaterial, waterUniforms, WATER_VERTEX, WATER_FRAGMENT, REFLECT_LAYER, WATER_PLANE_Y } from '../waterSurface.js'
import { createGroundMaterial } from '../groundShader.js'

describe('WaterSurface (B.2)', () => {
  it('one material program and one uniform set for the lake and every water tile', () => {
    expect(createWaterMaterial().uniforms).toBe(waterUniforms)
    expect(waterMaterial.uniforms).toBe(waterUniforms)
  })
  it('reads the per-vertex calm and samples the one shared reflection', () => {
    expect(WATER_VERTEX).toContain('attribute float _calm;')
    expect(WATER_VERTEX).toContain('vReflUv = uTextureMatrix * world;')
    expect(WATER_FRAGMENT).toContain('uniform sampler2D uReflection;')
    expect(WATER_FRAGMENT).toMatch(/mix\(uSky, texture2D\(uReflection, ruv\)\.rgb, uReflect\)/)
  })
  it('calm scales ripple amplitude and speed; colour and reflection are shared', () => {
    expect(WATER_FRAGMENT).toMatch(/float t = uTime \* mix\(0\.3, 1\.0, calm\);/)
    expect(WATER_FRAGMENT).toMatch(/float amp = 1\.5 \* mix\(0\.2, 1\.0, calm\);/)
  })
  it('the far water fades to the horizon colour, never the grey fog', () => {
    expect(WATER_FRAGMENT).toContain('col = mix(col, uHorizon, smoothstep(uFar.x, uFar.y, dist));')
    expect(WATER_FRAGMENT).not.toContain('fog_fragment')
  })
  it('shore foam and shallows from the baked texture; the river ignores it and turns green on March 17', () => {
    expect(WATER_FRAGMENT).toContain('uniform sampler2D uShore;')
    expect(WATER_FRAGMENT).toContain('shoreD = mix(shoreD, 1.0, isRiver);')
    expect(WATER_FRAGMENT).toContain('body = mix(body, uGreenColor, uGreen * isRiver);')
  })
  it('never pulled in front of the streets that bridge it', () => {
    expect(createWaterMaterial().polygonOffsetFactor).toBeGreaterThan(createGroundMaterial().polygonOffsetFactor)
  })
  it('the reflection layer and the mirror plane sit between the lake (0.02) and polygon water (0.04)', () => {
    expect(REFLECT_LAYER).toBe(2)
    expect(WATER_PLANE_Y).toBe(0.03)
  })
})
```

Append to `app/src/lib/__tests__/quality.test.js`:

```js
describe('water reflection by quality (B10)', () => {
  it('off at LOW, half resolution at HIGH', () => {
    expect(QUALITY.LOW.reflection).toBe(0)
    expect(QUALITY.HIGH.reflection).toBe(0.5)
    expect(QUALITY.ULTRA.reflection).toBeGreaterThanOrEqual(QUALITY.HIGH.reflection)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --prefix app -- src/world/materials/__tests__/waterSurface.test.js src/lib/__tests__/quality.test.js`
Expected: FAIL — `Failed to resolve import "../waterSurface.js"`; `expected undefined to be 0`

- [ ] **Step 3: Write the implementation**

`app/src/lib/quality.js`: replace `QUALITY` with

```js
export const QUALITY = {
  LOW: { dpr: 1, shadows: false, ao: false, bloom: true, shadowMap: 1024, fog: [1500, 9000], reflection: 0 },
  HIGH: { dpr: [1, 1.5], shadows: true, ao: true, bloom: true, shadowMap: 4096, fog: [2600, 17000], reflection: 0.5 },
  ULTRA: { dpr: [1, 2], shadows: true, ao: true, bloom: true, shadowMap: 8192, fog: [2600, 17000], reflection: 0.75 },
}
```

```js
// app/src/world/materials/waterSurface.js — the one water material (B.2): Lake Michigan, the river, harbours
// and lagoons. One shared planar reflection, a per-vertex calm factor, a baked shoreline, a horizon fade.
import * as THREE from 'three'
import { worldUrl } from '../../lib/manifest.js'

export const REFLECT_LAYER = 2 // what the mirrored camera renders: buildings, the elevated L, sky, stars, lights
export const WATER_PLANE_Y = 0.03 // mirror plane between the lake (0.02) and polygon water (0.04)

const px = (r, g, b) => { const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1); t.needsUpdate = true; return t }

export const waterUniforms = {
  uTime: { value: 0 },
  uSize: { value: 2.5 },
  uNormals: { value: px(128, 128, 255) },
  uReflection: { value: px(0, 0, 0) },
  uReflect: { value: 0 },
  uTextureMatrix: { value: new THREE.Matrix4() },
  uShore: { value: px(255, 255, 255) },
  uShoreOn: { value: 0 },
  uShoreRect: { value: new THREE.Vector4(0, 0, 1, 1) },
  uDeep: { value: new THREE.Color('#22586f') },
  uShallow: { value: new THREE.Color('#2f6c77') },
  uFoam: { value: new THREE.Color('#dfe8e6') },
  uHorizon: { value: new THREE.Color('#c3d6e8') },
  uSky: { value: new THREE.Color('#cfe1f5') },
  uGreenColor: { value: new THREE.Color('#1f9e5a') },
  uGreen: { value: 0 },
  uNight: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color('#ffffff') },
  uFar: { value: new THREE.Vector2(2600, 17000) },
}

export const WATER_VERTEX = /* glsl */ `
attribute float _calm;
uniform mat4 uTextureMatrix;
varying vec3 vWorld;
varying vec4 vReflUv;
varying float vCalm;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vCalm = _calm;
  vReflUv = uTextureMatrix * world;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const WATER_FRAGMENT = /* glsl */ `
uniform sampler2D uNormals;
uniform sampler2D uReflection;
uniform sampler2D uShore;
uniform float uTime;
uniform float uSize;
uniform float uReflect;
uniform float uShoreOn;
uniform float uGreen;
uniform float uNight;
uniform vec4 uShoreRect;
uniform vec2 uFar;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uHorizon;
uniform vec3 uSky;
uniform vec3 uGreenColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
varying vec3 vWorld;
varying vec4 vReflUv;
varying float vCalm;

vec3 waveNormal(vec2 p, float calm) {
  float t = uTime * mix(0.3, 1.0, calm);
  vec2 uv0 = p / 103.0 + vec2(t / 17.0, t / 29.0);
  vec2 uv1 = p / 107.0 - vec2(t / -19.0, t / 31.0);
  vec2 uv2 = p / vec2(8907.0, 9803.0) + vec2(t / 101.0, t / 97.0);
  vec2 uv3 = p / vec2(1091.0, 1027.0) - vec2(t / 109.0, t / -113.0);
  vec4 noise = texture2D(uNormals, uv0) + texture2D(uNormals, uv1) + texture2D(uNormals, uv2) + texture2D(uNormals, uv3);
  vec3 n = (noise * 0.5 - 1.0).xzy;
  float amp = 1.5 * mix(0.2, 1.0, calm);
  return normalize(n * vec3(amp, 1.0, amp));
}

void main() {
  float calm = clamp(vCalm, 0.0, 1.0);
  float isRiver = 1.0 - step(0.05, abs(vCalm - 0.6));
  vec3 toEye = cameraPosition - vWorld;
  float dist = length(toEye);
  vec3 V = toEye / dist;
  vec3 N = waveNormal(vWorld.xz * uSize, calm);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec2 ruv = vReflUv.xy / vReflUv.w + N.xz * (0.03 * calm + 0.005);
  vec3 refl = mix(uSky, texture2D(uReflection, ruv).rgb, uReflect);
  vec2 suv = (vWorld.xz - uShoreRect.xy) * uShoreRect.zw;
  float inBand = step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0) * uShoreOn;
  float shoreD = mix(1.0, texture2D(uShore, clamp(suv, 0.0, 1.0)).r, inBand);
  shoreD = mix(shoreD, 1.0, isRiver);
  vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 0.35, shoreD));
  body = mix(body, uGreenColor, uGreen * isRiver);
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 180.0) * (1.0 - uNight) * step(0.0, uSunDir.y);
  vec3 col = mix(body, refl, fres) + uSunColor * spec * 1.2;
  float foam = (1.0 - smoothstep(0.0, 0.04, shoreD)) * (0.35 + 0.35 * calm) * inBand;
  col = mix(col, uFoam, foam);
  col = mix(col, uHorizon, smoothstep(uFar.x, uFar.y, dist));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function createWaterMaterial() {
  return new THREE.ShaderMaterial({ uniforms: waterUniforms, vertexShader: WATER_VERTEX, fragmentShader: WATER_FRAGMENT, fog: false, lights: false })
}

export const waterMaterial = createWaterMaterial()

const loader = new THREE.TextureLoader()
let normalsRequested = false
export function loadWaterTextures(shore, version) {
  if (!normalsRequested) {
    normalsRequested = true
    loader.load('/textures/waternormals.jpg', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; waterUniforms.uNormals.value = t })
  }
  if (!shore) { waterUniforms.uShoreOn.value = 0; return }
  loader.load(worldUrl(shore.file, version), (t) => {
    t.flipY = false // image row 0 is the north edge (minZ)
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    t.needsUpdate = true
    waterUniforms.uShore.value = t
    waterUniforms.uShoreRect.value.set(shore.minX, shore.minZ, 1 / (shore.width * shore.cell), 1 / (shore.height * shore.cell))
    waterUniforms.uShoreOn.value = 1
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/world/materials/waterSurface.js app/src/world/materials/__tests__/waterSurface.test.js app/src/lib/quality.js app/src/lib/__tests__/quality.test.js
git commit -m "feat(water): WaterSurface — one material for lake, river, harbours and lagoons; calm-scaled ripples, shared reflection, shore foam, horizon fade, green river; reflection off at LOW" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 20: Rest signals, fixed-pose capture script, and the e2e settle (G5)

**Files:**
- Create: `app/src/lib/rest.js`, `app/scripts/capture.mjs`
- Modify: `app/src/camera/AtlasRig.jsx`, `app/src/world/SkyRig.jsx`, `app/src/world/TileStreamer.jsx`, `app/src/hud/LoadingScreen.jsx`, `app/e2e/hero-view.spec.js`
- Test: `app/src/lib/__tests__/rest.test.js`

**Interfaces:**
- Produces:
  - `createRestTracker({ frames = 20, eps = 1e-3 }) → { sample(values: number[]) → boolean }`
  - Window flags: `__camRest`, `__skyRest`, `__tilesIdle`, `__hudReady` (booleans).
  - The capture script, run from `app/` with the dev server running: `node scripts/capture.mjs <outDir> <pose>[@day|dusk|night]... [--perf] [--bookmarks]`
    - Env: `CAPTURE_DATE`, `CAPTURE_QUERY`.
    - Poses (local metres):
      - `streeterville-438` `{position:[1900,438,-1500],target:[150,60,-350]}`
      - `harbor` `{position:[600,160,900],target:[1400,0,200]}`
      - `shore` `{position:[250,40,-2200],target:[520,0,-2420]}`
      - `lake-east` `{position:[-3300,1200,-500],target:[2500,0,-500]}`
      - `lake-north` `{position:[1800,1200,5400],target:[1800,0,-400]}`
      - `lake-south` `{position:[1800,1200,-6200],target:[1800,0,-400]}`
      - `soldierfield-bowl` `{position:[930,95,2335],target:[930,0,2197]}`
      - `willis-base` `{position:[-674,120,560],target:[-674,80,366]}`
      - `lincoln-lagoon` `{position:[-200,160,-4000],target:[-470,0,-4273]}`
      - plus every bookmark by name (`streeterville`, `loop`, `river`, …).

- [ ] **Step 1: Write the failing test**

```js
// app/src/lib/__tests__/rest.test.js
import { describe, it, expect } from 'vitest'
import { createRestTracker } from '../rest.js'

describe('rest tracker (G5)', () => {
  it('settles after N consecutive still frames', () => {
    const r = createRestTracker({ frames: 3, eps: 0.01 })
    expect([r.sample([0, 0]), r.sample([0, 0]), r.sample([0, 0]), r.sample([0, 0])]).toEqual([false, false, false, true])
  })
  it('any movement beyond eps resets; jitter within eps does not', () => {
    const r = createRestTracker({ frames: 2, eps: 0.01 })
    r.sample([0]); r.sample([0.005]); expect(r.sample([0.009])).toBe(true)
    expect(r.sample([1])).toBe(false)
    expect(r.sample([1])).toBe(false)
    expect(r.sample([1])).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix app -- src/lib/__tests__/rest.test.js`
Expected: FAIL — `Failed to resolve import "../rest.js"`

- [ ] **Step 3: Write the implementation**

```js
// app/src/lib/rest.js — "settled" = the watched numbers stayed within eps for `frames` consecutive samples.
export function createRestTracker({ frames = 20, eps = 1e-3 } = {}) {
  let last = null, still = 0
  return {
    sample(values) {
      const moved = !last || values.length !== last.length || values.some((v, i) => Math.abs(v - last[i]) > eps)
      if (moved) { last = values.slice(); still = 0 } else still++
      return still >= frames
    },
  }
}
```

(The anchor `last` only moves when the change exceeds eps, so slow drift within eps per frame still reads as rest only if it stays within eps of the anchor.)

`app/src/camera/AtlasRig.jsx`:
- Add `import { createRestTracker } from '../lib/rest.js'` and, inside the component, `const camRest = useRef(createRestTracker({ frames: 20, eps: 1e-3 }))`.
- In `useFrame`:
  - In the intro branch, before each `return`, set `window.__camRest = false`.
  - In the flight branch, before `return`, set `window.__camRest = false`.
  - After the last `publishReadout(c, now)` of the free-flight path, add:
    ```js
        c.getTarget(tmpT); c.getPosition(tmpP)
        window.__camRest = camRest.current.sample([tmpP.x, tmpP.y, tmpP.z, tmpT.x, tmpT.y, tmpT.z])
    ```

`app/src/world/SkyRig.jsx`: add `import { createRestTracker } from '../lib/rest.js'` and `const skyRest = useRef(createRestTracker({ frames: 20, eps: 1e-5 }))`. At the end of `useFrame`, add `window.__skyRest = skyRest.current.sample(cur.current)`.

`app/src/world/TileStreamer.jsx`: directly after `shown.current = draw`, add:

```js
  window.__tilesIdle = draw.every(([id, lod]) => ready.current.has(`${id}:${lod}`))
```

`app/src/hud/LoadingScreen.jsx`: directly after the existing `useEffect` (before `if (gone) return null`), add:

```js
  useEffect(() => { window.__hudReady = gone }, [gone])
```

`app/e2e/hero-view.spec.js`: replace `await page.waitForTimeout(4000) // textures, sky tween, loading fade` with:

```js
    // settled, not a fixed sleep: camera and sun at rest, every planned tile drawn, loading screen gone (G5)
    await page.waitForFunction(() => window.__camRest === true && window.__skyRest === true && window.__tilesIdle === true && window.__hudReady === true, null, { timeout: 60_000 })
```

Create `app/scripts/capture.mjs`:

```js
// app/scripts/capture.mjs — evaluate-and-revert screenshots at fixed poses, perf readouts, bookmark clearance.
// Needs `npm run dev` running. Usage (from app/):
//   node scripts/capture.mjs <outDir> <pose>[@day|dusk|night] ... [--perf] [--bookmarks]
//   CAPTURE_DATE=2027-03-17T12:00:00-05:00  pins the calendar (default 2026-09-28 noon, like the e2e)
//   CAPTURE_QUERY='&reflect=0'               extra test-only URL params
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { BOOKMARKS } from '../src/lib/bookmarks.js'

export const POSES = {
  ...BOOKMARKS,
  'streeterville-438': { position: [1900, 438, -1500], target: [150, 60, -350] },
  harbor: { position: [600, 160, 900], target: [1400, 0, 200] },
  shore: { position: [250, 40, -2200], target: [520, 0, -2420] },
  'lake-east': { position: [-3300, 1200, -500], target: [2500, 0, -500] },
  'lake-north': { position: [1800, 1200, 5400], target: [1800, 0, -400] },
  'lake-south': { position: [1800, 1200, -6200], target: [1800, 0, -400] },
  'soldierfield-bowl': { position: [930, 95, 2335], target: [930, 0, 2197] },
  'willis-base': { position: [-674, 120, 560], target: [-674, 80, 366] },
  'lincoln-lagoon': { position: [-200, 160, -4000], target: [-470, 0, -4273] },
}

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const [outDir, ...specs] = args.filter((a) => !a.startsWith('--'))
mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
await page.clock.setFixedTime(new Date(process.env.CAPTURE_DATE ?? '2026-09-28T12:00:00-05:00'))
await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })

const rest = () => page.waitForFunction(() => window.__camRest && window.__skyRest && window.__tilesIdle && window.__hudReady && !window.__store.getState().flight, null, { timeout: 90_000 })
const measure = () => page.evaluate(() => new Promise((res) => {
  const gl = window.__gl
  gl.info.autoReset = false
  requestAnimationFrame(() => {
    gl.info.reset()
    requestAnimationFrame(() => {
      const one = { calls: gl.info.render.calls, triangles: gl.info.render.triangles }
      gl.info.autoReset = true
      let n = 0
      const t0 = performance.now()
      const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res({ ...one, fps: Math.round((n * 1000) / (performance.now() - t0)) }) }
      requestAnimationFrame(tick)
    })
  })
}))

for (const spec of specs) {
  const [name, time = 'day'] = spec.split('@')
  const pose = POSES[name]
  if (!pose) throw new Error(`unknown pose ${name}`)
  await page.goto(`http://localhost:5173/?stats&view=streeterville&time=${time}${process.env.CAPTURE_QUERY ?? ''}`)
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
  await page.evaluate((p) => window.__store.getState().startFlight(p, 'capture'), pose)
  await rest()
  await page.screenshot({ path: `${outDir}/${name}-${time}.png` })
  if (flags.has('--perf')) console.log(`${name}@${time}`, JSON.stringify(await measure()))
}
if (flags.has('--bookmarks')) {
  await page.goto('http://localhost:5173/?stats&view=streeterville&time=day')
  await page.waitForFunction(() => window.__worldReady === true && typeof window.__clearanceAt === 'function', null, { timeout: 90_000 })
  await page.waitForTimeout(1500) // heightfield decode
  const rows = await page.evaluate((B) => Object.entries(B).map(([k, b]) => [k, b.position[1], Math.round(window.__clearanceAt(b.position[0], b.position[2]))]), BOOKMARKS)
  for (const [k, y, c] of rows) console.log(`${k}: camera y ${y}, clearance ${c}${y < c ? '  ← LIFTED' : ''}`)
}
await browser.close()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --prefix app`
Expected: PASS

- [ ] **Step 5: Run e2e once to confirm the settle works (dev server + Playwright; nothing else heavy running)**

Run: `cd app && npx playwright test`
Expected: all 10 tests *reach the screenshot* with no timeout on the new `waitForFunction`. Screenshot diffs against the old baselines may fail because of world v4 content; baselines are regenerated in Task 22. Record the run time per test in the ledger (it should be shorter than the old fixed 4 s wait allows).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/rest.js app/src/lib/__tests__/rest.test.js app/scripts/capture.mjs app/src/camera/AtlasRig.jsx app/src/world/SkyRig.jsx app/src/world/TileStreamer.jsx app/src/hud/LoadingScreen.jsx app/e2e/hero-view.spec.js
git commit -m "test(e2e): wait for camera, sun, tiles and HUD to settle instead of a fixed 4 s; fixed-pose capture script (G5)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 21: One lake, one river — the unified water in the scene (B1, B2, B3, B4, B5, B6, B7, B8, B9, B10)

**Files:**
- Create: `app/src/world/WaterRig.jsx`
- Modify:
  - `app/src/world/Lake.jsx` (rewrite)
  - `app/src/world/TileContent.jsx` (water material, reflect layers)
  - `app/src/world/SkyRig.jsx` (reflect layers)
  - `app/src/world/Scene.jsx` (Lake + WaterRig)
  - `app/src/world/materials/groundMaterials.js` (remove `river`, `riverNormals`)
  - `app/src/hud/HelpOverlay.jsx` (help line)
- Test: `app/src/world/materials/__tests__/groundShader.test.js` (replace the river test); `app/src/hud/__tests__/help.test.jsx` (append)

**Interfaces:**
- Consumes:
  - `waterMaterial`, `waterUniforms`, `REFLECT_LAYER`, `WATER_PLANE_Y`, `loadWaterTextures` (Task 19).
  - `mirrorCamera`, `textureMatrixFor` (Task 18).
  - `waterPalette`, `isGreenRiverDay` (Task 17).
  - `QUALITY[q].reflection` (Task 19).
  - `worldUrl`, `disposeObject` (Task 13).
  - Manifest `lake`, `shore`, `version` (Task 11).
- Produces:
  - `WaterRig({ sunRef, shore, version })`. It renders the only reflection pass: `?reflect=0` (test-only) forces it off.
  - `Lake({ file, version })`.

- [ ] **Step 1: Capture BEFORE shots (dev server running, current HEAD)**

Run (from `app/`, with `npm run dev` running in the background):
```bash
node scripts/capture.mjs ../.superpowers/sdd/2026-09-29-v1-correctness-clearance-water/eval/before streeterville-438@day streeterville-438@dusk streeterville-438@night harbor@day harbor@dusk harbor@night shore@dusk lake-east@day lake-north@dusk lake-south@day river@night lincoln-lagoon@day soldierfield-bowl@day
```
Expected: 13 PNGs written, no timeout.

- [ ] **Step 2: Write the failing tests**

In `app/src/world/materials/__tests__/groundShader.test.js`:
- Replace the import line `import { groundMaterials } from '../groundMaterials.js'` with:
  ```js
  import { groundMaterials } from '../groundMaterials.js'
  import { waterMaterial } from '../waterSurface.js'
  ```
- Replace the whole test `it('the river is never pulled in front of the streets that bridge it', …)` with:

```js
  it('water is never pulled in front of the streets that bridge it', () => {
    expect(waterMaterial.polygonOffsetFactor).toBeGreaterThan(createGroundMaterial().polygonOffsetFactor)
  })
  it('there is one water material: the ground set no longer carries a river', () => {
    expect(groundMaterials(null).river).toBeUndefined()
  })
```

Append to `app/src/hud/__tests__/help.test.jsx`, inside the describe:

```js
  it('the help card says where water reflections are switched', () => {
    useStore.getState().setHelpOpen(true)
    render(<HelpOverlay />)
    expect(screen.getByText(/water reflections/i)).toBeInTheDocument()
  })
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test --prefix app -- src/world/materials/__tests__/groundShader.test.js src/hud/__tests__/help.test.jsx`
Expected: FAIL — `expected MeshStandardMaterial{…} to be undefined`; `Unable to find an element with the text: /water reflections/i`

- [ ] **Step 4: Write the implementation**

```jsx
// app/src/world/WaterRig.jsx — drives the one water material: colours from the sky, the green-river date,
// and the ONLY planar reflection pass (mirrored camera, REFLECT_LAYER only, no shadow re-render, ½ res at HIGH).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { QUALITY } from '../lib/quality.js'
import { waterPalette, isGreenRiverDay } from '../lib/waterPalette.js'
import { waterUniforms, REFLECT_LAYER, WATER_PLANE_Y, loadWaterTextures } from './materials/waterSurface.js'
import { mirrorCamera, textureMatrixFor } from './water/mirror.js'

const elevOf = (s) => (Math.asin(Math.max(-1, Math.min(1, s[1]))) * 180) / Math.PI

export default function WaterRig({ sunRef, shore, version }) {
  const { gl, scene, camera, size } = useThree()
  const forcedOff = useMemo(() => new URLSearchParams(window.location.search).get('reflect') === '0', []) // tests only
  const scale = forcedOff ? 0 : QUALITY[useStore((s) => s.quality)].reflection
  const rt = useMemo(() => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }), [])
  const mirror = useMemo(() => { const c = new THREE.PerspectiveCamera(); c.layers.set(REFLECT_LAYER); return c }, [])
  const green = useRef({ at: -Infinity })

  useEffect(() => { loadWaterTextures(shore, version) }, [shore, version])
  useEffect(() => {
    if (!scale) return
    const pr = gl.getPixelRatio()
    rt.setSize(Math.max(1, Math.floor(size.width * pr * scale)), Math.max(1, Math.floor(size.height * pr * scale)))
  }, [scale, size, gl, rt])
  useEffect(() => () => rt.dispose(), [rt])

  useFrame(({ clock }, dt) => {
    const u = waterUniforms, s = sunRef.current
    u.uTime.value += dt * 0.35
    if (s) {
      const p = waterPalette(elevOf(s))
      u.uDeep.value.copy(p.deep); u.uShallow.value.copy(p.shallow); u.uHorizon.value.copy(p.horizon); u.uSky.value.copy(p.sky)
      u.uFoam.value.copy(p.foam); u.uGreenColor.value.copy(p.green); u.uSunColor.value.copy(p.sunColor); u.uNight.value = p.night
      u.uSunDir.value.set(s[0], s[1], s[2])
    }
    if (scene.fog) u.uFar.value.set(scene.fog.near, scene.fog.far)
    if (clock.elapsedTime - green.current.at > 60) { green.current.at = clock.elapsedTime; u.uGreen.value = isGreenRiverDay() ? 1 : 0 }
    u.uReflect.value = scale ? 1 : 0
    if (!scale) return
    mirrorCamera(camera, WATER_PLANE_Y, mirror)
    textureMatrixFor(mirror, u.uTextureMatrix.value)
    const prev = gl.getRenderTarget(), autoShadow = gl.shadowMap.autoUpdate
    gl.shadowMap.autoUpdate = false // reuse this frame's shadow map; never render the shadow pass twice
    gl.setRenderTarget(rt)
    gl.clear()
    gl.render(scene, mirror)
    gl.setRenderTarget(prev)
    gl.shadowMap.autoUpdate = autoShadow
    u.uReflection.value = rt.texture
  })
  return null
}
```

Replace `app/src/world/Lake.jsx` with:

```jsx
// app/src/world/Lake.jsx — Lake Michigan: the pipeline's baked lake mesh (land and mapped water cut out,
// 120 × 160 km) in the one shared water material. Loaded imperatively: it never holds the loading screen.
import { useEffect, useState } from 'react'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { waterMaterial } from './materials/waterSurface.js'
import { worldUrl } from '../lib/manifest.js'
import { disposeObject } from './dispose.js'

export default function Lake({ file, version }) {
  const [scene, setScene] = useState(null)
  useEffect(() => {
    let alive = true, loaded = null
    new GLTFLoader().loadAsync(worldUrl(file, version)).then((g) => {
      loaded = g.scene
      g.scene.traverse((o) => { if (o.isMesh) { o.material = waterMaterial; o.receiveShadow = false; o.frustumCulled = false } })
      if (alive) setScene(g.scene); else disposeObject(g.scene)
    }).catch((e) => console.warn('lake failed', e))
    return () => { alive = false; disposeObject(loaded) }
  }, [file, version])
  return scene ? <primitive object={scene} /> : null
}
```

`app/src/world/TileContent.jsx`:
- Add `import { waterMaterial, REFLECT_LAYER } from './materials/waterSurface.js'`.
- Replace the four layer lines in the traverse:
  ```js
      if (layer === 'buildings') { o.material = buildingMaterial; o.castShadow = lod === 'lod0' }
      else if (layer === 'ground') o.material = groundMaterial
      else if (layer === 'water') o.material = mats.river
      else if (layer === 'elevated') { o.material = mats.elevated; o.castShadow = true }
  ```
  with
  ```js
      if (layer === 'buildings') { o.material = buildingMaterial; o.castShadow = lod === 'lod0'; o.layers.enable(REFLECT_LAYER) }
      else if (layer === 'ground') o.material = groundMaterial
      else if (layer === 'water') { o.material = waterMaterial; o.receiveShadow = false }
      else if (layer === 'elevated') { o.material = mats.elevated; o.castShadow = true; o.layers.enable(REFLECT_LAYER) }
  ```

`app/src/world/SkyRig.jsx`: add `import { REFLECT_LAYER } from './materials/waterSurface.js'` and, after the `applySkyGain` effect:

```js
  // the mirrored camera sees only REFLECT_LAYER: sky, stars and both lights must be on it
  useEffect(() => { for (const r of [sky, stars, hemi, light]) r.current?.layers.enable(REFLECT_LAYER) }, [])
```

`app/src/world/Scene.jsx`:
- Add `import WaterRig from './WaterRig.jsx'`.
- Replace `<SafeLoad><Suspense fallback={null}><Lake sunRef={sunRef} /></Suspense></SafeLoad>` with:
  ```jsx
      {manifest?.lake && <Lake file={manifest.lake} version={manifest.version} />}
      <WaterRig sunRef={sunRef} shore={manifest?.shore ?? null} version={manifest?.version} />
  ```
- Remove the now-unused `Suspense` from the React import only if no other use remains (keep `SafeLoad`, which the file still imports).

`app/src/world/materials/groundMaterials.js`: delete the `riverNormals()` function and the `river:` entry.

`app/src/hud/HelpOverlay.jsx`: in the `'Time and quality'` group, change `['Quality', 'button on the right if things feel slow']` to `['Quality', 'button on the right if things feel slow · Low also turns off water reflections']`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test --prefix app`
Expected: PASS (all suites)

- [ ] **Step 6: Capture AFTER shots and check the console**

Run (from `app/`, dev server running):
```bash
node scripts/capture.mjs ../.superpowers/sdd/2026-09-29-v1-correctness-clearance-water/eval/after streeterville-438@day streeterville-438@dusk streeterville-438@night harbor@day harbor@dusk harbor@night shore@dusk lake-east@day lake-north@dusk lake-south@day river@night lincoln-lagoon@day soldierfield-bowl@day
CAPTURE_DATE=2027-03-17T12:00:00-05:00 node scripts/capture.mjs ../.superpowers/sdd/2026-09-29-v1-correctness-clearance-water/eval/after river@day
```
Expected: 14 PNGs, no timeout. Open one pose in a browser devtools console once: no `THREE.WebGLProgram: Shader Error` lines.

- [ ] **Step 7: Evaluate and revert (read each before/after pair; one ledger line per check)**

| Check | Pose(s) | Pass when |
|---|---|---|
| B1 one water body | `harbor@dusk` (S1 screenshot 2) | harbour, lagoon and lake share colour, ripple scale and skyline reflection; no ripple-pattern seam |
| B3 no grey far lake | `streeterville-438@day/dusk/night` | one continuous hue shore → horizon, darker at night |
| B4 no lake edge | `lake-east@day`, `lake-north@dusk`, `lake-south@day` | no edge or void at 6 km distance in any direction |
| B5 calmer harbours | `harbor@day`, `lincoln-lagoon@day` | harbour/lagoon visibly calmer than the open lake, same colour |
| B6 shoreline | `shore@dusk` | soft foam and shallow tint at the revetment; no z-fighting and no pinholes at the land–lake edge |
| B7 breakwaters | `streeterville-438@day`, `harbor@day` | breakwater lines visible around Monroe/DuSable harbours |
| B8 night | `river@night`, `harbor@night` | lit windows and bridge lights streak in the river and lake |
| B9 green river | `river@day` with `CAPTURE_DATE` 2027-03-17 | river green, lake and harbours not |
| D1 | `soldierfield-bowl@day` | no tree on the field or in the stands |

For any unpleasing change:
- tune the uniform defaults or the palette mix once;
- if it is still unpleasing, revert that part in its own commit (`revert(water): …`);
- add a ledger line `Revert: <what> — <why>`.

A shader tweak must keep the Task 19 tests green.

- [ ] **Step 8: B2 root cause and B10 budget → ledger**

Add the ledger line: `B2: root cause — two materials (flat MeshStandard river with 40 m tiled normals vs three Water lake), two heights (0.04 vs −2 m), fog-graded far lake; fixed by one WaterSurface, lake mesh at 0.02 cut around polygon water at 0.04, horizon fade.`

Measure (dev server running, from `app/`):
```bash
node scripts/capture.mjs ../.superpowers/sdd/2026-09-29-v1-correctness-clearance-water/eval/perf streeterville@dusk loop@day --perf
CAPTURE_QUERY='&reflect=0' node scripts/capture.mjs ../.superpowers/sdd/2026-09-29-v1-correctness-clearance-water/eval/perf-noreflect streeterville@dusk loop@day --perf
```
Expected: lines like `streeterville@dusk {"calls":…,"triangles":…,"fps":…}`.

Log to the ledger: `B10: reflection pass +<Δcalls> calls, +<Δtris> tris, <Δfps> fps at wide Streeterville; +… at wide Loop.`

**If Δcalls > 250 at either pose**, apply this fallback in the same task:
- In `TileStreamer.jsx`, change the map to `draw.map(([id, lod, d]) => {` and pass `reflect={lod !== 'lod0' || d < 800}` to `TileContent`.
- In `TileContent.jsx`:
  - add `reflect = true` to the props;
  - in the buildings branch, replace `o.layers.enable(REFLECT_LAYER)` with `if (reflect) o.layers.enable(REFLECT_LAYER); else o.layers.disable(REFLECT_LAYER)`;
  - add `reflect` to the `useMemo` deps.

Re-measure, then log `Ruling: reflection limited to LOD1/blocks + LOD0 within 800 m — cost: far LOD0 towers reflect as their LOD1 shape.`

- [ ] **Step 9: G2 manual pass at the Willis base → ledger**

With the dev server running, open `http://localhost:5173/?stats&view=streeterville&time=day`. In the console, run `__store.getState().startFlight({ position: [-674, 120, 560], target: [-674, 80, 366] }, 'test')`. When the flight is done, hold ↑ for 5 s, then ←/→ along the south face.

Expected:
- the camera never shows the tower's interior;
- head-on, it rises;
- diagonally, it slides.

Log `G2: Willis base manual pass — rises head-on, slides along the face, altitude readout peaked at <n> m.`

- [ ] **Step 10: Commit**

```bash
git add app/src/world/WaterRig.jsx app/src/world/Lake.jsx app/src/world/TileContent.jsx app/src/world/SkyRig.jsx app/src/world/Scene.jsx app/src/world/materials/groundMaterials.js app/src/hud/HelpOverlay.jsx app/src/world/materials/__tests__/groundShader.test.js app/src/hud/__tests__/help.test.jsx
git commit -m "feat(water): one lake, one river — WaterSurface everywhere, shared half-res reflection, baked 120×160 km lake at y 0.02, shore foam, horizon fade, calm harbours, night reflections, green river (B1–B10)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 22: End-of-milestone checklist (master plan, V1)

**Files:**
- Modify: `app/e2e/hero-view.spec.js-snapshots/*.png` (regenerated baselines)
- Modify: `README.md`
- Create: 2–4 new `docs/screenshots/v1-*.png`
- Modify: `app/src/lib/bookmarks.js` (only if the bookmark check lifts a view)

**Interfaces:**
- Consumes: everything above.
- Produces: V1 shipped on `origin/main`.

- [ ] **Step 1: Both unit suites green**

Run: `npm test --prefix pipeline && npm test --prefix app`
Expected: both PASS. Record the counts in the ledger.

- [ ] **Step 2: World build; skyline assertion; byte-identical rebuild (H4)**

Run: `npm run build:world --prefix pipeline && git status --porcelain app/public/world`
Expected: the build logs `skyline: missing 0, wrong height 0`, `venue tree check: 0 trees inside any venue`, and `manifest written`. `git status` prints **nothing**: the rebuild is byte-identical to Task 11's committed output.

If files differ, stop condition: run `git diff --stat app/public/world`, find the nondeterministic source, fix it with a test in `pipeline/tests/manifest.test.js`, and rebuild.

- [ ] **Step 3: Bookmarks stay where they were designed (clearance must not lift a curated view)**

Run (dev server running, from `app/`): `node scripts/capture.mjs /tmp/v1-bm --bookmarks`
Expected: 13 lines `<name>: camera y …, clearance …`, none ending in `← LIFTED`.

For any lifted bookmark:
- raise its `position[1]` in `app/src/lib/bookmarks.js` to the printed clearance + 10 m;
- commit that alone (`fix(views): <name> bookmark clears the roofs`);
- add a ledger line.

- [ ] **Step 4: e2e — regenerate the intentionally changed baselines, then 3 consecutive green runs**

Water, lake extent and world v4 change every view, so all 10 baselines are regenerated.

Run: `cd app && npx playwright test --update-snapshots`
Expected: 10 passed; 10 snapshots written.

Open each new `app/e2e/hero-view.spec.js-snapshots/*.png`. Each view must show the unified water and no regressions (no missing tiles, no black lake). Then run three times:

Run: `cd app && npx playwright test && npx playwright test && npx playwright test`
Expected: `10 passed` ×3. Log `e2e 10/10 ×3` in the ledger.

- [ ] **Step 5: Perf check at the wide Streeterville, wide Loop and densest views**

Run (dev server running, from `app/`): `node scripts/capture.mjs ../.superpowers/sdd/2026-09-29-v1-correctness-clearance-water/eval/perf-final streeterville@dusk loop@day willis@day river@dusk --perf`
Expected: 4 JSON lines. Log them against budget: ≤ 900 calls, ≤ 4 M triangles, fps.

Calls above 900 at the wide shots were ~1,188 before V1; H11 (V8) owns the reduction. V1 must not add more than the B10 allowance measured in Task 21. Log any excess as `Budget: … (H11/V8)`.

- [ ] **Step 6: Evaluate-and-revert set, README gallery, roadmap, badges**

Run the day/dusk/night set (dev server running, from `app/`):
```bash
node scripts/capture.mjs ../.superpowers/sdd/2026-09-29-v1-correctness-clearance-water/eval/final harbor@dusk streeterville-438@day river@night soldierfield-bowl@day lake-east@day
```

Copy 2–4 chosen shots to **new** files:
- `docs/screenshots/v1-harbor-dusk.png`
- `docs/screenshots/v1-lake-horizon-day.png`
- `docs/screenshots/v1-river-night.png`
- optionally `docs/screenshots/v1-soldier-field-day.png`

Never overwrite an existing image; `git status docs/screenshots` must show only `??` new files.

In `README.md`:
- Under `## How it came together`, after the `### Phase 2.5 …` entry and before `### Next · Vision pass …`, add `### Vision pass V1 · One lake — *unified water, camera clearance, clean venues*`, with the new images and one caption line each. For example: "Monroe Harbor at dusk — harbour and lake now one water body with shared skyline reflections".
- In `## Roadmap`, change the Vision pass line to `- [ ] **Vision pass** — ✅ V1 unified lake & river, camera clearance · V2 true building colours · V3–V4 CTA lines & trains · V5 stadium game nights · V6 bridges & landmarks · V7–V8 controls, perf, gallery`.
- In the phase badge, change `phase-2.5_expanded_city` to `phase-vision_V1_one_lake`.

- [ ] **Step 7: Commit and push**

```bash
git add README.md docs/screenshots/v1-*.png app/e2e/hero-view.spec.js-snapshots
git commit -m "docs: V1 shipped — gallery (harbour, lake horizon, river night), roadmap, e2e baselines for world v4" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push origin main
```

Expected: the push succeeds. Close the dev server and browsers. The last ledger line reads `V1: complete (pushed <sha>)`.

---

## Rulings made while writing this plan

- Ruling: `_BLDG` is unique **per file**: tile-local in tiles, offset per tile in blocks, with `blocks/<bk>.json` mapping back. It is not a global id — cost if wrong: P4 picking needs one sidecar lookup for block hits.
- Ruling: the heightfield is decimetres in R (high) / G (low) of an 8-bit RGB PNG, because browsers decode PNGs through an 8-bit canvas. It is "16-bit" in content — cost if wrong: 0.1 m steps, max 6,553.5 m.
- Ruling: `loadHeightfield(url, grid)` takes the manifest grid as a second argument (the coordinator allowed "or equivalent") — cost if wrong: callers pass `manifest.heightfield` as well as the URL.
- Ruling: the shared reflection is sampled through a Reflector-style texture matrix. For points on the water this is the mirrored screen position, which is equivalent to the spec's "screen space" — cost if wrong: none.
- Ruling: the reflection pass renders only `REFLECT_LAYER` (buildings, elevated L, sky, stars, lights) and reuses the frame's shadow map. Trees, ground, props and columns don't reflect — cost if wrong: less clutter in reflections; halves the pass cost.
- Ruling: Lake Michigan is a pipeline-baked mesh (rect − land − mapped water) at y 0.02, not a plane under everything. The spec's 0.02 would otherwise sit above the land at 0 — cost if wrong: one more file; harbour calm changes abruptly at the harbour polygon edge.
- Ruling: land and lake use city-boundary outers only (enclave holes filled) — cost if wrong: enclaves ~10 km out of bounds read as land, which they are.
- Ruling: `building=yes` places of worship stay plain unless `sacred.json` overrides them — cost if wrong: real churches mapped as `building=yes` lose their steeples until an override is added.
- Ruling: every non-river water polygon (harbour, lagoon, pond, basin) gets calm 0.35 — cost if wrong: none visible.
- Ruling: the green river keys on March 17 (Chicago date), per the spec, not the Saturday parade dye day — cost if wrong: off by up to 6 days from the real event.
- Ruling: free-flight "slide": a blocked move slides along the free axis; a head-on move rises at up to 2× glide speed; steps ≤ 12 m are climbed — cost if wrong: none.
- Ruling: flight arc lift is sampled over t ∈ [0.1, 0.9] and capped at 1,500 m, plus a per-frame clamp to the clearance — cost if wrong: a mild upward pop in the last 10 % of a flight into a canyon.
- Ruling: the heightfield covers the tiles plus horizon blocks at 8 m, with no dilation. `roofHeightAt` takes the max of the 4 surrounding cells — cost if wrong: up to ~11 m of conservativeness near façades; curated street-level bookmarks are checked in Task 22.
- Ruling: breakwaters come from OSM `man_made=breakwater|groyne` and render as 6 m × 1.8 m concrete in the building layer. Revetment steps are deferred — cost if wrong: revetments read as flat edges.
- Ruling: tree-free venues are heroes with a `venue`/`stands` spec plus `unitedcenter`, `wintrust` and `buckingham` — cost if wrong: a future arena must be added to `TREE_FREE_HEROES`.
- Ruling: the shore band spans the shoreline −600 m to +1,600 m, and river water ignores the shore tint — cost if wrong: a pond crossing the band's west edge shows a tint step.
- Ruling: world files carry `?v=<manifest version>`; this also removes stale-cache trees as a D1 factor — cost if wrong: none.
- Ruling: e2e "rest" means camera + sun + tiles idle + loading screen gone, with no fixed sleep — cost if wrong: none.
- Ruling: D1 was not reproducible in the shipped data. The fix is a rounding-consistent filter, venue coverage that doesn't depend on `fieldRing`, a build gate and versioned URLs — cost if wrong: if the user's trees came from another source, the build gate names it on the next build.
