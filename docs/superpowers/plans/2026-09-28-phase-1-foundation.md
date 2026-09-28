# Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first explorable, data-accurate 3D Chicago core (Ring 0) in the browser — real footprints and heights, land, lake, river, physical sky with time-of-day presets, an Atlas fly/orbit camera, and the CHI ATLAS HUD shell — ending in a committed "wow" screenshot.

**Architecture:** A Node build-time pipeline (`pipeline/`) fetches City of Chicago footprints + OSM heights/building-parts/water, projects them to local metres around State & Madison, extrudes and classifies buildings, and writes one `.glb` per 500 m tile plus a manifest into `app/public/world/`. A Vite + React 19 + React Three Fiber app (`app/`) streams those tiles, renders sky/sun/water, drives an Atlas camera, and overlays a DOM HUD ported from CHI. Pure math (projection, grid addresses, sun, camera clamps) lives in small tested modules; the projection is shared by both packages from `shared/`.

**Tech Stack:** Node 22 (ESM), Vitest 5, earcut 3, @gltf-transform/core 4 · Vite 8, React 19, three 0.186, @react-three/fiber 9, @react-three/drei 10, zustand 5, suncalc 2, react-icons 5, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md` (Phase 1 = §13 item 1; implements §3, §3.1, §4.1–4.2 for Ring 0, §5 sky/light/water basics, §6 FLY/ORBIT, §8 HUD shell subset, §11 loading screen)

## Global Constraints

- Coordinate system: local metres, origin **State & Madison (41.88203 N, −87.62784 W)**, +X east, −Z north, +Y up. One implementation in `shared/project.js`; both packages import it.
- Design tokens copied verbatim from CHI (`--bg #030509`, `--accent #45d8ff`, `--red #ff3b53`, Michroma / Archivo / IBM Plex Mono, glass `.hud-panel` blur 18px). **No emojis anywhere.** Icons: `react-icons/ri` only.
- Floor height constant **3.8 m**; height clamp **450 m**; drop footprints **< 12 m²**; simplify tolerance **0.3 m**.
- Tile size **500 m × 500 m**; tile key format `"{tx}_{tz}"` where `tx = floor(x/500)`, `tz = floor(z/500)`.
- Ring 0 bbox (lat/lon): **S 41.8650, W −87.6450, N 41.9000, E −87.6050**.
- Camera: min altitude **30 m**, max distance **3000 m**.
- Time presets: `LIVE | DAWN | DAY | DUSK | NIGHT`; default `LIVE` (real Chicago solar time).
- Overpass requests must send a `User-Agent` header (CHI learned Overpass 403s without it).
- Generated world files (`app/public/world/`) are committed (small in Phase 1); raw fetch cache (`pipeline/cache/`) is gitignored.
- Push to `origin main` (https://github.com/AllStreets/Chicago-Open-World.git) after each task's commit.

### Spec deviations (deliberate, Phase 1)

- `year_built` is present on `syp8-uezg` directly, so the `vmwt-djju` join (spec §4.1) is dropped.
- OSM `building:part` (212 parts with heights in Ring 0) replaces city footprints where present — gives real setbacks (Willis's tubes) before heroes exist. Additive to spec.
- Meshopt compression and LOD1 (spec §4.2 step 8) are deferred to Phase 6 (streaming); Phase 1 tiles are uncompressed `.glb`.
- Façade material is flat vertex color per family (atlas shader is Phase 2).

## Review Focus

- **Footprints that are MultiPolygons with holes or multiple parts** (courtyard buildings, Merchandise Mart) → every part extrudes; holes are not capped by the roof. Pinned in Task 3 (`extrudeBuilding` hole test) and Task 4 (`normalizeFootprint` multipart test).
- **Missing / zero / garbage heights** (`stories: "0"`, empty, OSM `height: "124 m"` or `"~30"`) → sensible fallback, never NaN or 0-height buildings. Pinned in Task 3 (`parseHeightTag`, `resolveHeight` tests).
- **Camera driven below roofs / under the ground or out to space** by scroll, WASD, or arrow keys → clamped to ≥ 30 m altitude and ≤ 3000 m distance. Pinned in Task 7 (`clampCamera` tests).
- **Grid readout at off-grid positions** (over the lake, far west, exactly on origin) → readout never throws and shows something sensible (`LAKE MICHIGAN` east of shore line, nearest named street otherwise). Pinned in Task 6 (`crossStreets` tests).
- **Tile or manifest fetch failure** → app still renders sky, land, lake and the HUD; loading screen completes and shows an error chip instead of hanging. Pinned in Task 8 (`loadManifest` failure test).

---

## File Structure

```
Chicago_open_world/
├─ package.json                 root scripts (fetch, build:world, dev, test)
├─ shared/
│  └─ project.js                ORIGIN, project(), unproject(), metresPerDegree()
├─ pipeline/
│  ├─ package.json
│  ├─ vitest.config.js
│  ├─ lib/
│  │  ├─ geom.js                signedArea, ensureCCW, simplifyRing, pointInRing, ringBBox, ringCentroid
│  │  ├─ height.js              FLOOR_M, parseHeightTag, resolveHeight
│  │  ├─ classify.js            FACADE_FAMILIES, FACADE_COLORS, classifyFacade
│  │  ├─ extrude.js             extrudeBuilding → {positions, normals, uvs}
│  │  ├─ multipolygon.js        assembleRings
│  │  ├─ buildings.js           normalizeFootprint, attachOsmHeights, applyBuildingParts, hashSeed
│  │  ├─ tiles.js               TILE_SIZE, tileKeyFor, tileBounds, groupByTile
│  │  ├─ sources.js             RING0_BBOX, footprintsUrl, cityBoundaryUrl, overpassQuery
│  │  └─ glb.js                 writeMeshGlb
│  ├─ fetch/fetch-all.js        network → pipeline/cache/*.json
│  ├─ build/build-world.js      cache → app/public/world/*
│  └─ tests/*.test.js
└─ app/
   ├─ package.json, vite.config.js, index.html, playwright.config.js
   ├─ public/textures/waternormals.jpg
   ├─ public/world/             generated: manifest.json, tiles/*.glb, tiles/*.json, ground/*.glb
   ├─ e2e/hero-view.spec.js
   └─ src/
      ├─ main.jsx, App.jsx
      ├─ styles/global.css       CHI tokens + HUD primitives
      ├─ state/store.js          zustand store
      ├─ lib/grid.js             Chicago address grid ↔ world, crossStreets
      ├─ lib/sun.js              sunForPreset
      ├─ lib/cameraMath.js       clampCamera, glideVector
      ├─ lib/bookmarks.js        BOOKMARKS, bookmarkFromUrl
      ├─ lib/manifest.js         loadManifest
      ├─ world/Scene.jsx, City.jsx, Ground.jsx, SkyRig.jsx, Lake.jsx
      ├─ camera/AtlasRig.jsx
      └─ hud/Hud.jsx, Hud.css, HudClock.jsx, WordmarkBlock.jsx, ControlPills.jsx, HintBar.jsx, LoadingScreen.jsx
```

---

### Task 1: Repo scaffold + shared projection

**Files:**
- Create: `package.json`, `shared/project.js`, `pipeline/package.json`, `pipeline/vitest.config.js`, `pipeline/tests/project.test.js`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `ORIGIN = { lat: 41.88203, lon: -87.62784 }`; `metresPerDegree(latDeg) → { mLat, mLon }`; `project(lon, lat) → [x, z]`; `unproject(x, z) → [lon, lat]`.

- [ ] **Step 1: Root + pipeline package files**

`package.json`:
```json
{
  "name": "chi-atlas-open-world",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "fetch": "npm run fetch --prefix pipeline",
    "build:world": "npm run build:world --prefix pipeline",
    "dev": "npm run dev --prefix app",
    "build": "npm run build --prefix app",
    "test": "npm test --prefix pipeline && npm test --prefix app"
  }
}
```

`pipeline/package.json`:
```json
{
  "name": "chi-atlas-pipeline",
  "private": true,
  "type": "module",
  "scripts": {
    "fetch": "node fetch/fetch-all.js",
    "build:world": "node build/build-world.js",
    "test": "vitest run"
  }
}
```
Then: `cd pipeline && npm i earcut@3 @gltf-transform/core@4 && npm i -D vitest@5`

`pipeline/vitest.config.js`:
```js
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['tests/**/*.test.js'] } })
```

Append to `.gitignore`: `test-results/`, `playwright-report/`.

- [ ] **Step 2: Write failing test** `pipeline/tests/project.test.js`
```js
import { describe, it, expect } from 'vitest'
import { ORIGIN, project, unproject, metresPerDegree } from '../../shared/project.js'

describe('project', () => {
  it('maps origin to 0,0', () => {
    const [x, z] = project(ORIGIN.lon, ORIGIN.lat)
    expect(x).toBeCloseTo(0, 6)
    expect(z).toBeCloseTo(0, 6)
  })
  it('north is -Z and east is +X', () => {
    const [, zN] = project(ORIGIN.lon, ORIGIN.lat + 0.01)
    const [xE] = project(ORIGIN.lon + 0.01, ORIGIN.lat)
    expect(zN).toBeLessThan(0)
    expect(xE).toBeGreaterThan(0)
  })
  it('one mile north (Chicago Ave, 800 N) is ~1609 m', () => {
    const { mLat } = metresPerDegree(ORIGIN.lat)
    const [, z] = project(ORIGIN.lon, ORIGIN.lat + 1609.344 / mLat)
    expect(z).toBeCloseTo(-1609.344, 3)
  })
  it('round-trips within 1 mm across Ring 0', () => {
    for (const [lon, lat] of [[-87.645, 41.865], [-87.605, 41.9], [-87.6359, 41.879]]) {
      const [x, z] = project(lon, lat)
      const [lon2, lat2] = unproject(x, z)
      const [x2, z2] = project(lon2, lat2)
      expect(Math.hypot(x2 - x, z2 - z)).toBeLessThan(0.001)
    }
  })
  it('Willis Tower lands ~680 m west, ~250 m south of origin', () => {
    const [x, z] = project(-87.6359, 41.8789)
    expect(x).toBeGreaterThan(-720); expect(x).toBeLessThan(-640)
    expect(z).toBeGreaterThan(300); expect(z).toBeLessThan(380)
  })
})
```

- [ ] **Step 3: Run** `cd pipeline && npx vitest run tests/project.test.js` — Expected: FAIL (cannot find module `shared/project.js`).

- [ ] **Step 4: Implement** `shared/project.js`
```js
// shared/project.js — the one projection shared by pipeline and app.
// Local tangent plane in metres around State & Madison (the zero point of
// Chicago's address grid). +X east, -Z north, +Y up.
export const ORIGIN = { lat: 41.88203, lon: -87.62784 }

export function metresPerDegree(latDeg) {
  const φ = (latDeg * Math.PI) / 180
  const mLat = 111132.954 - 559.822 * Math.cos(2 * φ) + 1.175 * Math.cos(4 * φ)
  const mLon = 111412.84 * Math.cos(φ) - 93.5 * Math.cos(3 * φ)
  return { mLat, mLon }
}

const { mLat, mLon } = metresPerDegree(ORIGIN.lat)

export function project(lon, lat) {
  return [(lon - ORIGIN.lon) * mLon, -(lat - ORIGIN.lat) * mLat]
}

export function unproject(x, z) {
  return [ORIGIN.lon + x / mLon, ORIGIN.lat - z / mLat]
}
```

- [ ] **Step 5: Run** the test — Expected: 5 passed. (Willis check: Δlon −0.00806° × ~83,000 m ≈ −669 m; Δlat −0.00313° × ~111,050 ≈ +348 m south.)

- [ ] **Step 6: Commit + push**
```bash
git add package.json .gitignore shared pipeline/package.json pipeline/package-lock.json pipeline/vitest.config.js pipeline/tests/project.test.js
git commit -m "feat(pipeline): scaffold + shared State&Madison projection"
git push origin main
```

---

### Task 2: Geometry primitives + multipolygon ring assembly

**Files:**
- Create: `pipeline/lib/geom.js`, `pipeline/lib/multipolygon.js`, `pipeline/tests/geom.test.js`, `pipeline/tests/multipolygon.test.js`

**Interfaces:**
- Rings are arrays of `[x, z]` (world metres), **not closed** (first point ≠ last).
- Produces: `signedArea(ring) → number` (positive = CCW on the map, i.e. in the `(x, -z)` plane); `ensureCCW(ring) → ring`; `ensureCW(ring) → ring`; `simplifyRing(ring, tol) → ring`; `pointInRing([x,z], ring) → boolean`; `ringBBox(ring) → {minX,minZ,maxX,maxZ}`; `ringCentroid(ring) → [x,z]`; `openRing(coords) → ring` (drops duplicate closing point).
- Produces: `assembleRings(ways: Array<Array<[a,b]>>) → Array<Array<[a,b]>>` — joins open way segments by shared endpoints into closed (open-form) rings; drops unclosable fragments.

- [ ] **Step 1: Failing tests** `pipeline/tests/geom.test.js`
```js
import { describe, it, expect } from 'vitest'
import { signedArea, ensureCCW, ensureCW, simplifyRing, pointInRing, ringBBox, ringCentroid, openRing } from '../lib/geom.js'

// A 10x10 square, CCW on the map: east then north (north = -z)
const sqCCW = [[0, 0], [10, 0], [10, -10], [0, -10]]

describe('geom', () => {
  it('signedArea is +100 for a map-CCW square and -100 reversed', () => {
    expect(signedArea(sqCCW)).toBeCloseTo(100)
    expect(signedArea([...sqCCW].reverse())).toBeCloseTo(-100)
  })
  it('ensureCCW / ensureCW orient rings', () => {
    expect(signedArea(ensureCCW([...sqCCW].reverse()))).toBeGreaterThan(0)
    expect(signedArea(ensureCW(sqCCW))).toBeLessThan(0)
  })
  it('openRing drops a duplicated closing point', () => {
    expect(openRing([[0, 0], [1, 0], [1, 1], [0, 0]])).toHaveLength(3)
    expect(openRing([[0, 0], [1, 0], [1, 1]])).toHaveLength(3)
  })
  it('simplifyRing removes collinear points but keeps corners', () => {
    const noisy = [[0, 0], [5, 0.1], [10, 0], [10, -10], [0, -10]]
    expect(simplifyRing(noisy, 0.3)).toHaveLength(4)
  })
  it('simplifyRing never returns fewer than 3 points', () => {
    expect(simplifyRing([[0, 0], [0.1, 0], [0.2, 0.05]], 5).length).toBeGreaterThanOrEqual(3)
  })
  it('pointInRing', () => {
    expect(pointInRing([5, -5], sqCCW)).toBe(true)
    expect(pointInRing([15, -5], sqCCW)).toBe(false)
  })
  it('bbox and centroid', () => {
    expect(ringBBox(sqCCW)).toEqual({ minX: 0, minZ: -10, maxX: 10, maxZ: 0 })
    const [cx, cz] = ringCentroid(sqCCW)
    expect(cx).toBeCloseTo(5); expect(cz).toBeCloseTo(-5)
  })
})
```

`pipeline/tests/multipolygon.test.js`
```js
import { describe, it, expect } from 'vitest'
import { assembleRings } from '../lib/multipolygon.js'

describe('assembleRings', () => {
  it('joins two open halves (one reversed) into one ring', () => {
    const a = [[0, 0], [10, 0], [10, 10]]
    const b = [[0, 0], [0, 10], [10, 10]] // shares both endpoints, opposite direction
    const rings = assembleRings([a, b])
    expect(rings).toHaveLength(1)
    expect(rings[0]).toHaveLength(4)
  })
  it('keeps already-closed ways as their own ring', () => {
    const closed = [[0, 0], [1, 0], [1, 1], [0, 0]]
    expect(assembleRings([closed])).toEqual([[[0, 0], [1, 0], [1, 1]]])
  })
  it('drops fragments that never close', () => {
    expect(assembleRings([[[0, 0], [1, 0]], [[5, 5], [6, 6]]])).toEqual([])
  })
})
```

- [ ] **Step 2: Run** `npx vitest run tests/geom.test.js tests/multipolygon.test.js` — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement** `pipeline/lib/geom.js`
```js
// pipeline/lib/geom.js — 2D ring helpers in world metres [x, z].
// Orientation is judged on the map plane (x, -z): positive area = CCW.

export function openRing(coords) {
  const n = coords.length
  if (n > 1 && coords[0][0] === coords[n - 1][0] && coords[0][1] === coords[n - 1][1]) {
    return coords.slice(0, -1)
  }
  return coords.slice()
}

export function signedArea(ring) {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i]
    const [x2, z2] = ring[(i + 1) % ring.length]
    a += x1 * -z2 - x2 * -z1
  }
  return a / 2
}

export const ensureCCW = (ring) => (signedArea(ring) < 0 ? [...ring].reverse() : ring)
export const ensureCW = (ring) => (signedArea(ring) > 0 ? [...ring].reverse() : ring)

function perpDist([px, pz], [ax, az], [bx, bz]) {
  const dx = bx - ax, dz = bz - az
  const len2 = dx * dx + dz * dz
  if (len2 === 0) return Math.hypot(px - ax, pz - az)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2))
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}

function dp(points, tol) {
  if (points.length < 3) return points
  let maxD = 0, idx = 0
  const last = points.length - 1
  for (let i = 1; i < last; i++) {
    const d = perpDist(points[i], points[0], points[last])
    if (d > maxD) { maxD = d; idx = i }
  }
  if (maxD <= tol) return [points[0], points[last]]
  return [...dp(points.slice(0, idx + 1), tol).slice(0, -1), ...dp(points.slice(idx), tol)]
}

// Douglas-Peucker on a closed ring: split at the point farthest from ring[0].
export function simplifyRing(ring, tol) {
  if (ring.length <= 3) return ring
  let far = 1, farD = 0
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1])
    if (d > farD) { farD = d; far = i }
  }
  const a = dp(ring.slice(0, far + 1), tol)
  const b = dp([...ring.slice(far), ring[0]], tol)
  const out = [...a.slice(0, -1), ...b.slice(0, -1)]
  return out.length >= 3 ? out : ring
}

export function pointInRing([px, pz], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j]
    if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

export function ringBBox(ring) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity
  for (const [x, z] of ring) {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
  }
  return { minX, minZ, maxX, maxZ }
}

export function ringCentroid(ring) {
  let a = 0, cx = 0, cz = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i], [x2, z2] = ring[(i + 1) % ring.length]
    const f = x1 * z2 - x2 * z1
    a += f; cx += (x1 + x2) * f; cz += (z1 + z2) * f
  }
  if (Math.abs(a) < 1e-9) {
    const n = ring.length
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n]
  }
  return [cx / (3 * a), cz / (3 * a)]
}
```

`pipeline/lib/multipolygon.js`
```js
// pipeline/lib/multipolygon.js — stitch OSM multipolygon member ways into rings.
import { openRing } from './geom.js'

const same = (p, q) => p[0] === q[0] && p[1] === q[1]

export function assembleRings(ways) {
  const rings = []
  const pool = []
  for (const w of ways) {
    if (w.length >= 4 && same(w[0], w[w.length - 1])) rings.push(openRing(w))
    else if (w.length >= 2) pool.push(w.slice())
  }
  while (pool.length) {
    let cur = pool.shift()
    let grew = true
    while (!same(cur[0], cur[cur.length - 1]) && grew) {
      grew = false
      const end = cur[cur.length - 1]
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i]
        if (same(w[0], end)) cur = cur.concat(w.slice(1))
        else if (same(w[w.length - 1], end)) cur = cur.concat(w.slice(0, -1).reverse())
        else continue
        pool.splice(i, 1); grew = true; break
      }
    }
    if (cur.length >= 4 && same(cur[0], cur[cur.length - 1])) rings.push(openRing(cur))
  }
  return rings
}
```

- [ ] **Step 4: Run** tests — Expected: all pass.
- [ ] **Step 5: Commit + push** `git add pipeline/lib/geom.js pipeline/lib/multipolygon.js pipeline/tests && git commit -m "feat(pipeline): ring geometry + multipolygon assembly" && git push origin main`

---

### Task 3: Heights, façade classification, extrusion

**Files:**
- Create: `pipeline/lib/height.js`, `pipeline/lib/classify.js`, `pipeline/lib/extrude.js`, tests `height.test.js`, `classify.test.js`, `extrude.test.js`

**Interfaces:**
- Produces: `FLOOR_M = 3.8`, `MAX_HEIGHT_M = 450`; `parseHeightTag(str) → number | null`; `resolveHeight({ osmHeight, osmLevels, stories }) → number` (metres, > 0).
- Produces: `FACADE_FAMILIES` (8 names, index = id), `FACADE_COLORS` (8 `[r,g,b]` 0–1 linear-ish sRGB), `classifyFacade({ height, year, area }) → 0..7`.
- Produces: `extrudeBuilding({ outer, holes = [], base = 0, top }) → { positions: number[], normals: number[], uvs: number[] }` — non-indexed triangles; wall UV `u` = metres along perimeter, `v` = metres above ground; roof UV = `(x, z)`.

- [ ] **Step 1: Failing tests**

`pipeline/tests/height.test.js`
```js
import { describe, it, expect } from 'vitest'
import { parseHeightTag, resolveHeight, FLOOR_M } from '../lib/height.js'

describe('height', () => {
  it('parses plain, unit-suffixed, approximate and feet tags', () => {
    expect(parseHeightTag('124')).toBe(124)
    expect(parseHeightTag('124 m')).toBe(124)
    expect(parseHeightTag('~30')).toBe(30)
    expect(parseHeightTag("100'")).toBeCloseTo(30.48)
    expect(parseHeightTag('100 ft')).toBeCloseTo(30.48)
  })
  it('rejects garbage', () => {
    for (const bad of [undefined, null, '', 'tall', '-5', '0']) expect(parseHeightTag(bad)).toBeNull()
  })
  it('prefers OSM height, then OSM levels, then city stories, then a default', () => {
    expect(resolveHeight({ osmHeight: '124', stories: '30' })).toBe(124)
    expect(resolveHeight({ osmLevels: '10', stories: '30' })).toBeCloseTo(10 * FLOOR_M)
    expect(resolveHeight({ stories: '110' })).toBeCloseTo(110 * FLOOR_M)
    expect(resolveHeight({ stories: '0' })).toBe(10)
    expect(resolveHeight({})).toBe(10)
  })
  it('clamps to 450 m', () => {
    expect(resolveHeight({ osmHeight: '9000' })).toBe(450)
  })
})
```

`pipeline/tests/classify.test.js`
```js
import { describe, it, expect } from 'vitest'
import { classifyFacade, FACADE_FAMILIES, FACADE_COLORS } from '../lib/classify.js'
const id = (n) => FACADE_FAMILIES.indexOf(n)

describe('classifyFacade', () => {
  it('has 8 families with colors', () => {
    expect(FACADE_FAMILIES).toHaveLength(8)
    expect(FACADE_COLORS).toHaveLength(8)
  })
  it('modern tall towers are curtain glass', () => {
    expect(classifyFacade({ height: 300, year: 1974, area: 4000 })).toBe(id('curtain-glass'))
  })
  it('prewar tall is loop limestone; 1925-1940 tall is art deco', () => {
    expect(classifyFacade({ height: 80, year: 1905, area: 2000 })).toBe(id('loop-limestone'))
    expect(classifyFacade({ height: 120, year: 1930, area: 2000 })).toBe(id('art-deco'))
  })
  it('mid-rise 1880-1930 is river-north loft; small residential is three-flat', () => {
    expect(classifyFacade({ height: 25, year: 1900, area: 900 })).toBe(id('river-north-loft'))
    expect(classifyFacade({ height: 11, year: 1910, area: 200 })).toBe(id('three-flat-brick'))
  })
  it('big low boxes are industrial; unknown year mid-rise is precast', () => {
    expect(classifyFacade({ height: 12, year: 0, area: 6000 })).toBe(id('industrial'))
    expect(classifyFacade({ height: 45, year: 0, area: 1500 })).toBe(id('precast-concrete'))
  })
})
```

`pipeline/tests/extrude.test.js`
```js
import { describe, it, expect } from 'vitest'
import { extrudeBuilding } from '../lib/extrude.js'

const sq = [[0, 0], [10, 0], [10, -10], [0, -10]] // map-CCW

function faces(m) {
  const out = []
  for (let i = 0; i < m.positions.length; i += 9) {
    const p = m.positions.slice(i, i + 9)
    const n = m.normals.slice(i, i + 3)
    const ux = p[3] - p[0], uy = p[4] - p[1], uz = p[5] - p[2]
    const vx = p[6] - p[0], vy = p[7] - p[1], vz = p[8] - p[2]
    const c = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]
    out.push({ p, n, c })
  }
  return out
}

describe('extrudeBuilding', () => {
  it('makes 4 walls (8 tris) + roof (2 tris) for a square', () => {
    const m = extrudeBuilding({ outer: sq, top: 20 })
    expect(m.positions.length / 9).toBe(10)
    expect(m.uvs.length / 2).toBe(m.positions.length / 3)
  })
  it('every triangle winds front-facing along its normal', () => {
    for (const f of faces(extrudeBuilding({ outer: [...sq].reverse(), top: 20 }))) {
      const dot = f.c[0] * f.n[0] + f.c[1] * f.n[1] + f.c[2] * f.n[2]
      expect(dot).toBeGreaterThan(0)
    }
  })
  it('south wall faces +Z', () => {
    const f = faces(extrudeBuilding({ outer: sq, top: 20 }))
    const south = f.find((t) => t.p[2] === 0 && t.p[5] === 0 && t.p[8] === 0)
    expect(south.n).toEqual([0, 0, 1])
  })
  it('respects base height (building parts)', () => {
    const m = extrudeBuilding({ outer: sq, base: 100, top: 120 })
    const ys = m.positions.filter((_, i) => i % 3 === 1)
    expect(Math.min(...ys)).toBe(100)
    expect(Math.max(...ys)).toBe(120)
  })
  it('does not cap holes: roof area equals outer minus hole', () => {
    const hole = [[4, -4], [6, -4], [6, -6], [4, -6]]
    const m = extrudeBuilding({ outer: sq, holes: [hole], top: 10 })
    let roofArea = 0
    for (const f of faces(m)) if (f.n[1] === 1) roofArea += Math.abs(f.c[1]) / 2
    expect(roofArea).toBeCloseTo(96)
  })
  it('wall uv v equals height in metres', () => {
    const m = extrudeBuilding({ outer: sq, top: 20 })
    const vs = m.uvs.filter((_, i) => i % 2 === 1)
    expect(Math.max(...vs)).toBe(20)
  })
})
```

- [ ] **Step 2: Run** — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

`pipeline/lib/height.js`
```js
// pipeline/lib/height.js — metres for a building from OSM tags or city stories.
export const FLOOR_M = 3.8
export const MAX_HEIGHT_M = 450
const DEFAULT_M = 10

export function parseHeightTag(v) {
  if (v === undefined || v === null) return null
  const s = String(v).trim().replace(/^~/, '')
  const m = s.match(/^(\d+(?:\.\d+)?)\s*('|ft|feet)?\s*(m)?$/i)
  if (!m) return null
  let n = parseFloat(m[1])
  if (m[2]) n *= 0.3048
  return n > 0 ? n : null
}

const positiveInt = (v) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function resolveHeight({ osmHeight, osmLevels, stories } = {}) {
  const h = parseHeightTag(osmHeight)
    ?? (positiveInt(osmLevels) && positiveInt(osmLevels) * FLOOR_M)
    ?? (positiveInt(stories) && positiveInt(stories) * FLOOR_M)
    ?? DEFAULT_M
  return Math.min(h, MAX_HEIGHT_M)
}
```

`pipeline/lib/classify.js`
```js
// pipeline/lib/classify.js — pick one of 8 façade families per building.
export const FACADE_FAMILIES = [
  'loop-limestone', 'art-deco', 'prewar-brick', 'curtain-glass',
  'precast-concrete', 'river-north-loft', 'three-flat-brick', 'industrial',
]

// Phase 1 flat colors (Phase 2 replaces with texture atlas layers).
export const FACADE_COLORS = [
  [0.74, 0.69, 0.60], // loop-limestone
  [0.66, 0.60, 0.51], // art-deco
  [0.55, 0.36, 0.28], // prewar-brick
  [0.36, 0.45, 0.53], // curtain-glass
  [0.62, 0.61, 0.58], // precast-concrete
  [0.50, 0.31, 0.24], // river-north-loft
  [0.56, 0.38, 0.29], // three-flat-brick
  [0.44, 0.42, 0.39], // industrial
]

const F = Object.fromEntries(FACADE_FAMILIES.map((n, i) => [n, i]))

export function classifyFacade({ height, year, area }) {
  const known = year > 1800
  if (height >= 60 && (!known || year >= 1960)) return F['curtain-glass']
  if (height >= 40 && known && year >= 1925 && year < 1960) return F['art-deco']
  if (height >= 40 && known && year < 1925) return F['loop-limestone']
  if (height < 20 && area >= 4000) return F['industrial']
  if (height < 15 && area < 600) return F['three-flat-brick']
  if (known && year >= 1880 && year <= 1930) return F['river-north-loft']
  if (known && year < 1960) return F['prewar-brick']
  return F['precast-concrete']
}
```

`pipeline/lib/extrude.js`
```js
// pipeline/lib/extrude.js — footprint → wall + roof triangles (non-indexed).
import earcut from 'earcut'
import { ensureCCW, ensureCW } from './geom.js'

function pushWalls(ring, base, top, out) {
  let u = 0
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]
    const [bx, bz] = ring[(i + 1) % ring.length]
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 1e-6) continue
    // Outward normal for a map-CCW ring (see spec §3.1 axes): (dn, 0, dx) with dn = -(bz-az)
    const nx = -(bz - az) / len || 0, nz = (bx - ax) / len || 0 // `|| 0` avoids -0
    const a0 = [ax, base, az], b0 = [bx, base, bz], a1 = [ax, top, az], b1 = [bx, top, bz]
    const uvA0 = [u, base], uvB0 = [u + len, base], uvA1 = [u, top], uvB1 = [u + len, top]
    for (const [p, t] of [[a0, uvA0], [b0, uvB0], [a1, uvA1], [b0, uvB0], [b1, uvB1], [a1, uvA1]]) {
      out.positions.push(...p); out.normals.push(nx, 0, nz); out.uvs.push(...t)
    }
    u += len
  }
}

function pushRoof(outer, holes, top, out) {
  const flat = [], holeIdx = []
  for (const [x, z] of outer) flat.push(x, z)
  for (const h of holes) { holeIdx.push(flat.length / 2); for (const [x, z] of h) flat.push(x, z) }
  const tris = earcut(flat, holeIdx.length ? holeIdx : undefined, 2)
  for (let i = 0; i < tris.length; i += 3) {
    let [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]]
    const ax = flat[a * 2], az = flat[a * 2 + 1]
    const bx = flat[b * 2], bz = flat[b * 2 + 1]
    const cx = flat[c * 2], cz = flat[c * 2 + 1]
    // y-component of (b-a)x(c-a) must be positive for an upward-facing tri
    if ((bz - az) * (cx - ax) - (bx - ax) * (cz - az) < 0) [b, c] = [c, b]
    for (const k of [a, b, c]) {
      const x = flat[k * 2], z = flat[k * 2 + 1]
      out.positions.push(x, top, z); out.normals.push(0, 1, 0); out.uvs.push(x, z)
    }
  }
}

export function extrudeBuilding({ outer, holes = [], base = 0, top }) {
  const out = { positions: [], normals: [], uvs: [] }
  const o = ensureCCW(outer)
  // Holes wind CW on the map so their wall normals point into the courtyard.
  const hs = holes.map(ensureCW)
  pushWalls(o, base, top, out)
  for (const h of hs) pushWalls(h, base, top, out)
  pushRoof(o, hs, top, out)
  return out
}
```

- [ ] **Step 4: Run** `npx vitest run` — Expected: all pass. If "south wall faces +Z" fails, the sign in `nx/nz` is wrong — fix there, do not change the test.
- [ ] **Step 5: Commit + push** `git add pipeline && git commit -m "feat(pipeline): height resolution, façade classes, extrusion" && git push origin main`

---

### Task 4: Building normalization, OSM joins, tiling

**Files:**
- Create: `pipeline/lib/buildings.js`, `pipeline/lib/tiles.js`, tests `buildings.test.js`, `tiles.test.js`

**Interfaces:**
- Consumes: `project` (Task 1); `openRing, simplifyRing, signedArea, pointInRing, ringBBox, ringCentroid` (Task 2); `resolveHeight` (Task 3); `classifyFacade` (Task 3).
- Produces:
  - `hashSeed(str) → number in [0,1)` (FNV-1a).
  - `normalizeFootprint(row) → Building | null` where `row` is a Socrata JSON row and
    `Building = { id: string, name: string|null, address: string|null, stories: number|null, year: number|null, polygons: Array<{outer: ring, holes: ring[]}>, area: number, centroid: [x,z], bbox, height: number, parts: null | Array<{outer, holes, base, top}> }`. Returns `null` if total area < 12 m² or `bldg_statu` is not `ACTIVE`.
  - `attachOsmHeights(buildings, osmBuildings)` — `osmBuildings: Array<{center:[x,z], tags}>`; mutates `height` of the containing building using `resolveHeight({osmHeight, osmLevels, stories})`.
  - `applyBuildingParts(buildings, osmParts)` — `osmParts: Array<{outer, holes, center:[x,z], tags}>`; sets `building.parts` for buildings containing ≥ 1 part center; each part `base = parseHeightTag(min_height) ?? 0`, `top = resolveHeight({osmHeight: height, osmLevels: building:levels})`; if ground-level parts cover < 80% of building area, the footprint stays as a podium with `building.height = min(building.height, min(part tops))`; otherwise `building.height = 0` (footprint not emitted).
  - `TILE_SIZE = 500`; `tileKeyFor([x,z]) → "tx_tz"`; `tileBounds(key) → {minX,minZ,maxX,maxZ}`; `groupByTile(buildings) → Map<key, Building[]>` (by centroid).

- [ ] **Step 1: Failing tests**

`pipeline/tests/buildings.test.js`
```js
import { describe, it, expect } from 'vitest'
import { normalizeFootprint, attachOsmHeights, applyBuildingParts, hashSeed } from '../lib/buildings.js'
import { unproject } from '../../shared/project.js'

// Build a Socrata-like MultiPolygon from world-metre rings.
const ll = (ring) => [...ring, ring[0]].map(([x, z]) => unproject(x, z))
const row = (polys, extra = {}) => ({
  bldg_id: '1', bldg_statu: 'ACTIVE', stories: '10', year_built: '1920',
  bldg_name1: 'TEST BLDG', f_add1: '100', t_add1: '120', pre_dir1: 'N', st_name1: 'STATE', st_type1: 'ST',
  the_geom: { type: 'MultiPolygon', coordinates: polys.map((rings) => rings.map(ll)) },
  ...extra,
})
const sq = (x, z, s) => [[x, z], [x + s, z], [x + s, z - s], [x, z - s]]

describe('normalizeFootprint', () => {
  it('parses metadata, height, area and centroid', () => {
    const b = normalizeFootprint(row([[sq(0, 0, 20)]]))
    expect(b.id).toBe('1')
    expect(b.name).toBe('Test Bldg')
    expect(b.address).toBe('100 N State St')
    expect(b.year).toBe(1920)
    expect(b.height).toBeCloseTo(38)
    expect(b.area).toBeCloseTo(400, 0)
    expect(b.centroid[0]).toBeCloseTo(10, 0)
  })
  it('keeps every part of a multipart footprint and its holes', () => {
    const b = normalizeFootprint(row([[sq(0, 0, 20), sq(5, -5, 5)], [sq(100, 0, 10)]]))
    expect(b.polygons).toHaveLength(2)
    expect(b.polygons[0].holes).toHaveLength(1)
    expect(b.area).toBeCloseTo(400 - 25 + 100, 0)
  })
  it('drops tiny and inactive footprints', () => {
    expect(normalizeFootprint(row([[sq(0, 0, 3)]]))).toBeNull()
    expect(normalizeFootprint(row([[sq(0, 0, 20)]], { bldg_statu: 'DEMOLISHED' }))).toBeNull()
  })
  it('treats year 0 and missing names as null', () => {
    const b = normalizeFootprint(row([[sq(0, 0, 20)]], { year_built: '0', bldg_name1: '' }))
    expect(b.year).toBeNull(); expect(b.name).toBeNull()
  })
})

describe('OSM joins', () => {
  it('attachOsmHeights overrides height for the containing building only', () => {
    const a = normalizeFootprint(row([[sq(0, 0, 20)]]))
    const b = normalizeFootprint(row([[sq(100, 0, 20)]], { bldg_id: '2' }))
    attachOsmHeights([a, b], [{ center: [10, -10], tags: { height: '124' } }])
    expect(a.height).toBe(124)
    expect(b.height).toBeCloseTo(38)
  })
  it('applyBuildingParts replaces a fully covered footprint', () => {
    const a = normalizeFootprint(row([[sq(0, 0, 20)]]))
    applyBuildingParts([a], [
      { outer: sq(0, 0, 20), holes: [], center: [10, -10], tags: { height: '200' } },
      { outer: sq(5, -5, 10), holes: [], center: [10, -10], tags: { height: '300', min_height: '200' } },
    ])
    expect(a.parts).toHaveLength(2)
    expect(a.parts[1]).toMatchObject({ base: 200, top: 300 })
    expect(a.height).toBe(0)
  })
  it('keeps a podium (never taller than itself) when parts cover < 80% of the footprint', () => {
    const a = normalizeFootprint(row([[sq(0, 0, 20)]]))
    applyBuildingParts([a], [{ outer: sq(0, 0, 5), holes: [], center: [2, -2], tags: { height: '90' } }])
    expect(a.parts).toHaveLength(1)
    expect(a.height).toBeCloseTo(38)
  })
})

describe('hashSeed', () => {
  it('is deterministic and in [0,1)', () => {
    expect(hashSeed('358897')).toBe(hashSeed('358897'))
    expect(hashSeed('a')).not.toBe(hashSeed('b'))
    expect(hashSeed('x')).toBeGreaterThanOrEqual(0); expect(hashSeed('x')).toBeLessThan(1)
  })
})
```

`pipeline/tests/tiles.test.js`
```js
import { describe, it, expect } from 'vitest'
import { TILE_SIZE, tileKeyFor, tileBounds, groupByTile } from '../lib/tiles.js'

describe('tiles', () => {
  it('keys by floor division, including negatives', () => {
    expect(tileKeyFor([0, 0])).toBe('0_0')
    expect(tileKeyFor([499.9, 0])).toBe('0_0')
    expect(tileKeyFor([500, 0])).toBe('1_0')
    expect(tileKeyFor([-0.1, -0.1])).toBe('-1_-1')
  })
  it('bounds partition space with no gaps', () => {
    expect(tileBounds('-1_2')).toEqual({ minX: -500, maxX: 0, minZ: 1000, maxZ: 1500 })
    expect(tileBounds('0_0').minX).toBe(tileBounds('-1_0').maxX)
    expect(TILE_SIZE).toBe(500)
  })
  it('groups buildings by centroid', () => {
    const g = groupByTile([{ centroid: [10, 10] }, { centroid: [20, 20] }, { centroid: [-10, 10] }])
    expect(g.get('0_0')).toHaveLength(2)
    expect(g.get('-1_0')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement**

`pipeline/lib/tiles.js`
```js
// pipeline/lib/tiles.js — 500 m world tiles.
export const TILE_SIZE = 500
export const tileKeyFor = ([x, z]) => `${Math.floor(x / TILE_SIZE)}_${Math.floor(z / TILE_SIZE)}`
export function tileBounds(key) {
  const [tx, tz] = key.split('_').map(Number)
  return { minX: tx * TILE_SIZE, maxX: (tx + 1) * TILE_SIZE, minZ: tz * TILE_SIZE, maxZ: (tz + 1) * TILE_SIZE }
}
export function groupByTile(buildings) {
  const m = new Map()
  for (const b of buildings) {
    const k = tileKeyFor(b.centroid)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(b)
  }
  return m
}
```

`pipeline/lib/buildings.js`
```js
// pipeline/lib/buildings.js — Socrata footprint rows → Building records, plus OSM joins.
import { project } from '../../shared/project.js'
import { openRing, simplifyRing, signedArea, pointInRing, ringBBox, ringCentroid } from './geom.js'
import { resolveHeight, parseHeightTag } from './height.js'

const MIN_AREA = 12
const SIMPLIFY_M = 0.3

export function hashSeed(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0) / 4294967296
}

const title = (s) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
const clean = (s) => (s && s.trim() ? s.trim() : null)

function toRing(lonlat) {
  return simplifyRing(openRing(lonlat.map(([lon, lat]) => project(lon, lat))), SIMPLIFY_M)
}

export function normalizeFootprint(r) {
  if (r.bldg_statu && r.bldg_statu !== 'ACTIVE') return null
  const g = r.the_geom
  if (!g || !g.coordinates) return null
  const polysLL = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  const polygons = polysLL.map(([outer, ...holes]) => ({ outer: toRing(outer), holes: holes.map(toRing) }))
  const area = polygons.reduce((s, p) =>
    s + Math.abs(signedArea(p.outer)) - p.holes.reduce((t, h) => t + Math.abs(signedArea(h)), 0), 0)
  if (area < MIN_AREA) return null
  const main = polygons.reduce((a, b) => (Math.abs(signedArea(b.outer)) > Math.abs(signedArea(a.outer)) ? b : a))
  const allPts = polygons.flatMap((p) => p.outer)
  const num = parseInt(r.f_add1, 10)
  const street = [r.pre_dir1, clean(r.st_name1) && title(r.st_name1), clean(r.st_type1) && title(r.st_type1)].filter(Boolean).join(' ')
  const year = parseInt(r.year_built, 10)
  const stories = parseInt(r.stories, 10)
  return {
    id: String(r.bldg_id),
    name: clean(r.bldg_name1) ? title(r.bldg_name1.trim()) : null,
    address: num > 0 && street ? `${num} ${street}` : null,
    stories: stories > 0 ? stories : null,
    year: year > 1800 ? year : null,
    polygons,
    area,
    centroid: ringCentroid(main.outer),
    bbox: ringBBox(allPts),
    height: resolveHeight({ stories: r.stories }),
    parts: null,
  }
}

function containing(buildings, pt) {
  for (const b of buildings) {
    const { minX, minZ, maxX, maxZ } = b.bbox
    if (pt[0] < minX || pt[0] > maxX || pt[1] < minZ || pt[1] > maxZ) continue
    if (b.polygons.some((p) => pointInRing(pt, p.outer))) return b
  }
  return null
}

export function attachOsmHeights(buildings, osmBuildings) {
  for (const o of osmBuildings) {
    const b = containing(buildings, o.center)
    if (!b) continue
    b.height = resolveHeight({ osmHeight: o.tags.height, osmLevels: o.tags['building:levels'], stories: b.stories })
  }
}

export function applyBuildingParts(buildings, osmParts) {
  const byBuilding = new Map()
  for (const p of osmParts) {
    const b = containing(buildings, p.center)
    if (!b) continue
    if (!byBuilding.has(b)) byBuilding.set(b, [])
    byBuilding.get(b).push({
      outer: p.outer,
      holes: p.holes,
      base: parseHeightTag(p.tags.min_height) ?? 0,
      top: resolveHeight({ osmHeight: p.tags.height, osmLevels: p.tags['building:levels'] }),
    })
  }
  for (const [b, parts] of byBuilding) {
    b.parts = parts
    const covered = parts.filter((p) => p.base === 0)
      .reduce((s, p) => s + Math.abs(signedArea(p.outer)), 0)
    b.height = covered / b.area >= 0.8 ? 0 : Math.min(b.height, ...parts.map((p) => p.top))
  }
}
```

- [ ] **Step 4: Run** — Expected: all pass.
- [ ] **Step 5: Commit + push** `git commit -am "feat(pipeline): footprint normalization, OSM height/part joins, tiling" && git push origin main` (add new files first with `git add pipeline`).

---

### Task 5: Fetch + build scripts → world files

**Files:**
- Create: `pipeline/lib/sources.js`, `pipeline/lib/glb.js`, `pipeline/fetch/fetch-all.js`, `pipeline/build/build-world.js`, `pipeline/tests/sources.test.js`, `pipeline/tests/glb.test.js`
- Generated: `app/public/world/manifest.json`, `app/public/world/tiles/*.glb|.json`, `app/public/world/ground/land.glb`, `app/public/world/ground/river.glb`

**Interfaces:**
- Produces: `RING0_BBOX = { s: 41.8650, w: -87.6450, n: 41.9000, e: -87.6050 }`; `footprintsUrl(bbox, offset, limit) → string`; `cityBoundaryUrl() → string`; `overpassQuery(kind, bbox) → string` for `kind ∈ 'buildings' | 'parts' | 'water'`.
- Produces: `writeMeshGlb(path, { positions, normals, uvs?, colors?, extra?: { [name]: Float32Array } }) → Promise<void>` — extra attributes are written as glTF `_NAME` (three loads them lowercased as `_name`).
- Manifest schema (consumed by app Task 8):
```json
{ "version": 1, "generatedAt": "ISO", "origin": {"lat":41.88203,"lon":-87.62784}, "tileSize": 500,
  "sources": [{"name":"City of Chicago Building Footprints","id":"syp8-uezg","fetchedAt":"ISO"}, ...],
  "tiles": [{"key":"-2_0","ring":0,"file":"tiles/-2_0.glb","meta":"tiles/-2_0.json","buildings":123,"maxHeight":418.0}],
  "ground": {"land":"ground/land.glb","river":"ground/river.glb"} }
```
- Tile glb attributes: `POSITION`, `NORMAL`, `TEXCOORD_0`, `COLOR_0` (façade color), `_FACADE`, `_HEIGHT` (building top m), `_BLDG` (index into sidecar), `_SEED`.
- Tile sidecar JSON: `{ "buildings": [{ "id", "name", "address", "stories", "year", "height" }] }` (array index = `_BLDG`).

- [ ] **Step 1: Failing tests**

`pipeline/tests/sources.test.js`
```js
import { describe, it, expect } from 'vitest'
import { RING0_BBOX, footprintsUrl, cityBoundaryUrl, overpassQuery } from '../lib/sources.js'

describe('sources', () => {
  it('builds a paged Socrata within_box URL', () => {
    const u = new URL(footprintsUrl(RING0_BBOX, 2000, 1000))
    expect(u.hostname).toBe('data.cityofchicago.org')
    expect(u.pathname).toBe('/resource/syp8-uezg.json')
    expect(u.searchParams.get('$where')).toBe('within_box(the_geom,41.9,-87.645,41.865,-87.605)')
    expect(u.searchParams.get('$offset')).toBe('2000')
    expect(u.searchParams.get('$order')).toBe('bldg_id')
  })
  it('city boundary is geojson', () => {
    expect(cityBoundaryUrl()).toMatch(/qqq8-j68g\.geojson$/)
  })
  it('overpass queries use (s,w,n,e) and out geom', () => {
    const q = overpassQuery('parts', RING0_BBOX)
    expect(q).toContain('(41.865,-87.645,41.9,-87.605)')
    expect(q).toContain('building:part')
    expect(q).toContain('out geom')
    expect(() => overpassQuery('nope', RING0_BBOX)).toThrow()
  })
})
```

`pipeline/tests/glb.test.js`
```js
import { describe, it, expect } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { writeMeshGlb } from '../lib/glb.js'

describe('writeMeshGlb', () => {
  it('writes a readable glb with custom attributes', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'glb-')), 't.glb')
    await writeMeshGlb(path, {
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
      uvs: [0, 0, 1, 0, 0, 1], colors: [1, 0, 0, 1, 0, 0, 1, 0, 0],
      extra: { FACADE: new Float32Array([3, 3, 3]) },
    })
    expect(readFileSync(path).subarray(0, 4).toString()).toBe('glTF')
    const doc = await new NodeIO().read(path)
    const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0]
    expect(prim.getAttribute('_FACADE').getArray()[0]).toBe(3)
    expect(prim.getAttribute('COLOR_0')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement `sources.js` and `glb.js`**

`pipeline/lib/sources.js`
```js
// pipeline/lib/sources.js — every external URL/query the pipeline uses.
export const RING0_BBOX = { s: 41.8650, w: -87.6450, n: 41.9000, e: -87.6050 }
export const USER_AGENT = 'chi-atlas-open-world/0.1 (github.com/AllStreets/Chicago-Open-World)'

export function footprintsUrl({ s, w, n, e }, offset, limit) {
  const u = new URL('https://data.cityofchicago.org/resource/syp8-uezg.json')
  u.searchParams.set('$where', `within_box(the_geom,${n},${w},${s},${e})`)
  u.searchParams.set('$order', 'bldg_id')
  u.searchParams.set('$limit', String(limit))
  u.searchParams.set('$offset', String(offset))
  return u.toString()
}

export const cityBoundaryUrl = () => 'https://data.cityofchicago.org/resource/qqq8-j68g.geojson'

const FILTERS = {
  buildings: ['way["building"]["height"]', 'way["building"]["building:levels"]'],
  parts: ['way["building:part"]', 'relation["building:part"]'],
  water: ['relation["water"="river"]', 'way["water"="river"]', 'way["waterway"="canal"]["area"]', 'way["water"="canal"]', 'way["water"="harbour"]', 'relation["water"="harbour"]'],
}

export function overpassQuery(kind, { s, w, n, e }) {
  const f = FILTERS[kind]
  if (!f) throw new Error(`unknown overpass kind: ${kind}`)
  const bb = `(${s},${w},${n},${e})`
  return `[out:json][timeout:120];(${f.map((x) => x + bb + ';').join('')});out geom;`
}
```

`pipeline/lib/glb.js`
```js
// pipeline/lib/glb.js — one-mesh glb writer (Phase 1: uncompressed).
import { Document, NodeIO } from '@gltf-transform/core'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export async function writeMeshGlb(path, { positions, normals, uvs, colors, extra = {} }) {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const acc = (arr, type) => doc.createAccessor().setType(type).setArray(arr instanceof Float32Array ? arr : new Float32Array(arr)).setBuffer(buffer)
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc(positions, 'VEC3'))
    .setAttribute('NORMAL', acc(normals, 'VEC3'))
  if (uvs) prim.setAttribute('TEXCOORD_0', acc(uvs, 'VEC2'))
  if (colors) prim.setAttribute('COLOR_0', acc(colors, 'VEC3'))
  for (const [name, arr] of Object.entries(extra)) prim.setAttribute(`_${name}`, acc(arr, 'SCALAR'))
  const mesh = doc.createMesh('mesh').addPrimitive(prim)
  doc.createScene().addChild(doc.createNode('node').setMesh(mesh))
  mkdirSync(dirname(path), { recursive: true })
  await new NodeIO().write(path, doc)
}
```

- [ ] **Step 4: Run** tests — Expected: pass.

- [ ] **Step 5: Implement `fetch/fetch-all.js`** (network script; verified by running it)
```js
// pipeline/fetch/fetch-all.js — download raw sources into pipeline/cache/.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RING0_BBOX, USER_AGENT, footprintsUrl, cityBoundaryUrl, overpassQuery } from '../lib/sources.js'

const CACHE = join(dirname(fileURLToPath(import.meta.url)), '..', 'cache')
mkdirSync(CACHE, { recursive: true })
const save = (name, data) => {
  writeFileSync(join(CACHE, name), JSON.stringify({ fetchedAt: new Date().toISOString(), data }))
  console.log(`  ✓ ${name}`)
}

async function getJson(url, init = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...(init.headers || {}) } })
    if (res.ok) return res.json()
    console.warn(`  ! ${res.status} on attempt ${attempt}`)
    await new Promise((r) => setTimeout(r, 4000 * attempt))
  }
  throw new Error(`failed: ${url.slice(0, 120)}`)
}

async function footprints() {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const page = await getJson(footprintsUrl(RING0_BBOX, offset, 1000))
    rows.push(...page)
    if (page.length < 1000) break
  }
  save('footprints.json', rows)
}

async function overpass(kind) {
  const body = new URLSearchParams({ data: overpassQuery(kind, RING0_BBOX) })
  save(`osm-${kind}.json`, await getJson('https://overpass-api.de/api/interpreter', { method: 'POST', body }))
}

console.log('Fetching Ring 0 sources…')
await footprints()
save('city-boundary.json', await getJson(cityBoundaryUrl()))
for (const k of ['buildings', 'parts', 'water']) await overpass(k)
console.log('Done.')
```

- [ ] **Step 6: Run** `npm run fetch` from repo root. Expected: five `✓` lines; `pipeline/cache/footprints.json` contains ~2,500 rows (`node -e "console.log(JSON.parse(require('fs').readFileSync('pipeline/cache/footprints.json')).data.length)"`).

- [ ] **Step 7: Implement `build/build-world.js`**
```js
// pipeline/build/build-world.js — cache → app/public/world (tiles, ground, manifest).
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import earcut from 'earcut'
import { project, ORIGIN } from '../../shared/project.js'
import { openRing, ringCentroid, simplifyRing } from '../lib/geom.js'
import { assembleRings } from '../lib/multipolygon.js'
import { normalizeFootprint, attachOsmHeights, applyBuildingParts, hashSeed } from '../lib/buildings.js'
import { classifyFacade, FACADE_COLORS } from '../lib/classify.js'
import { extrudeBuilding } from '../lib/extrude.js'
import { groupByTile, TILE_SIZE } from '../lib/tiles.js'
import { writeMeshGlb } from '../lib/glb.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'cache')
const OUT = join(ROOT, '..', 'app', 'public', 'world')
const load = (n) => JSON.parse(readFileSync(join(CACHE, n), 'utf8'))

const toXZ = (pts) => openRing(pts.map((p) => project(p.lon, p.lat)))

function osmPolys(elements) {
  const out = []
  for (const el of elements) {
    if (el.type === 'way' && el.geometry) {
      out.push({ outer: toXZ(el.geometry), holes: [], tags: el.tags || {} })
    } else if (el.type === 'relation' && el.members) {
      const ways = (role) => el.members.filter((m) => m.role === role && m.geometry)
        .map((m) => m.geometry.map((p) => project(p.lon, p.lat)))
      const outers = assembleRings(ways('outer'))
      const inners = assembleRings(ways('inner'))
      for (const o of outers) out.push({ outer: o, holes: inners, tags: el.tags || {} })
    }
  }
  return out.filter((p) => p.outer.length >= 3)
}

function flatMesh(polys, y) {
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

async function main() {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(join(OUT, 'tiles'), { recursive: true })

  const fp = load('footprints.json')
  const buildings = fp.data.map(normalizeFootprint).filter(Boolean)
  console.log(`buildings: ${buildings.length}`)

  const osmB = load('osm-buildings.json')
  attachOsmHeights(buildings, osmB.data.elements.filter((e) => e.geometry).map((e) => ({
    center: ringCentroid(toXZ(e.geometry)), tags: e.tags || {},
  })))
  const parts = osmPolys(load('osm-parts.json').data.elements).map((p) => ({ ...p, center: ringCentroid(p.outer) }))
  applyBuildingParts(buildings, parts)
  console.log(`osm parts: ${parts.length}, buildings with parts: ${buildings.filter((b) => b.parts).length}`)

  const tiles = []
  for (const [key, list] of groupByTile(buildings)) {
    const pos = [], nor = [], uv = [], col = [], fac = [], hgt = [], idx = [], seed = []
    const meta = []
    list.forEach((b, i) => {
      const top = Math.max(b.height, ...(b.parts || []).map((p) => p.top))
      const family = classifyFacade({ height: top, year: b.year ?? 0, area: b.area })
      const s = hashSeed(b.id)
      const pieces = []
      if (b.height > 0) for (const p of b.polygons) pieces.push({ outer: p.outer, holes: p.holes, base: 0, top: b.height })
      for (const p of b.parts || []) if (p.top > p.base) pieces.push(p)
      for (const piece of pieces) {
        const m = extrudeBuilding(piece)
        const n = m.positions.length / 3
        pos.push(...m.positions); nor.push(...m.normals); uv.push(...m.uvs)
        for (let v = 0; v < n; v++) { col.push(...FACADE_COLORS[family]); fac.push(family); hgt.push(top); idx.push(i); seed.push(s) }
      }
      meta.push({ id: b.id, name: b.name, address: b.address, stories: b.stories, year: b.year, height: Math.round(top * 10) / 10 })
    })
    if (!pos.length) continue
    await writeMeshGlb(join(OUT, 'tiles', `${key}.glb`), {
      positions: pos, normals: nor, uvs: uv, colors: col,
      extra: { FACADE: new Float32Array(fac), HEIGHT: new Float32Array(hgt), BLDG: new Float32Array(idx), SEED: new Float32Array(seed) },
    })
    writeFileSync(join(OUT, 'tiles', `${key}.json`), JSON.stringify({ buildings: meta }))
    tiles.push({ key, ring: 0, file: `tiles/${key}.glb`, meta: `tiles/${key}.json`, buildings: list.length, maxHeight: Math.max(...meta.map((m) => m.height)) })
  }
  console.log(`tiles: ${tiles.length}`)

  // Ground: land = city boundary (outer rings only, simplified 2 m); river/harbour = OSM water.
  const city = load('city-boundary.json').data
  const land = city.features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates))
    .map(([outer, ...holes]) => ({
      outer: simplifyRing(openRing(outer.map(([lon, lat]) => project(lon, lat))), 2),
      holes: holes.map((h) => simplifyRing(openRing(h.map(([lon, lat]) => project(lon, lat))), 2)),
    }))
  mkdirSync(join(OUT, 'ground'), { recursive: true })
  await writeMeshGlb(join(OUT, 'ground', 'land.glb'), flatMesh(land, 0))
  const water = osmPolys(load('osm-water.json').data.elements)
  await writeMeshGlb(join(OUT, 'ground', 'river.glb'), flatMesh(water, 0.15))
  console.log(`land polys: ${land.length}, water polys: ${water.length}`)

  const src = (name, id, file) => ({ name, id, fetchedAt: load(file).fetchedAt })
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({
    version: 1, generatedAt: new Date().toISOString(), origin: ORIGIN, tileSize: TILE_SIZE,
    sources: [
      src('City of Chicago Building Footprints', 'syp8-uezg', 'footprints.json'),
      src('City of Chicago Boundary', 'qqq8-j68g', 'city-boundary.json'),
      src('OpenStreetMap (ODbL) heights, parts, water', 'overpass', 'osm-parts.json'),
    ],
    tiles, ground: { land: 'ground/land.glb', river: 'ground/river.glb' },
  }, null, 2))
  console.log('manifest written')
}

await main()
```

- [ ] **Step 7b: Run** `npm run build:world`. Expected output: `buildings: ~2400`, `osm parts: ~200`, `tiles: ~70`, a land and water count, `manifest written`. Check size: `du -sh app/public/world` — expected < 25 MB. Spot-check: `node -e "const m=require('./app/public/world/manifest.json');console.log(Math.max(...m.tiles.map(t=>t.maxHeight)))"` → between 400 and 450 (Willis / Trump).

- [ ] **Step 8: Commit + push**
```bash
git add pipeline app/public/world
git commit -m "feat(pipeline): fetch Ring 0 sources and build world tiles + ground"
git push origin main
```

---

### Task 6: App scaffold, CHI design system, store, grid + sun math

**Files:**
- Create: `app/package.json`, `app/vite.config.js`, `app/index.html`, `app/src/main.jsx`, `app/src/App.jsx` (placeholder `<div className="app" />`, replaced in Task 8), `app/src/test-setup.js`, `app/src/styles/global.css`, `app/src/state/store.js`, `app/src/lib/grid.js`, `app/src/lib/sun.js`, tests in `app/src/**/__tests__/`

**Interfaces:**
- Produces `useStore` (zustand) with state `{ timePreset: 'LIVE'|'DAWN'|'DAY'|'DUSK'|'NIGHT', cameraMode: 'FLY'|'ORBIT', readout: { streets: string, altitude: number, heading: number }, load: { total: number, done: number, keys: string[], error: string|null, ready: boolean } }` and actions `setTimePreset(p)`, `setCameraMode(m)`, `setReadout(r)`, `setLoadTotal(n)`, `markLoaded(key: string)` (idempotent per key — React StrictMode runs effects twice), `setLoadError(msg)`.
- Produces `M_PER_NUMBER = 1609.344 / 800`; `worldToGrid(x, z) → { ns: number, ew: number }` (signed: +N, +E); `crossStreets(x, z) → string` e.g. `'MICHIGAN & OHIO'`; returns `'LAKE MICHIGAN'` when `ew > 700` (east of Lake Shore Drive ~ 600 E at the Loop).
- Produces `sunForPreset(preset, now: Date) → { date: Date, altitude: rad, azimuth: rad, direction: [x,y,z] unit, night: 0..1 }`.

- [ ] **Step 1: Scaffold**

`app/package.json`
```json
{
  "name": "chi-atlas-open-world-app",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "e2e": "playwright test"
  }
}
```
Then: `cd app && npm i react@19 react-dom@19 three@0.186 @react-three/fiber@9 @react-three/drei@10 zustand@5 suncalc@2 react-icons@5 && npm i -D vite@8 @vitejs/plugin-react@6 vitest@5 jsdom @testing-library/react @testing-library/jest-dom @playwright/test@1.63`

`app/vite.config.js`
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.js'], include: ['src/**/*.test.{js,jsx}'] },
})
```

`app/src/test-setup.js`: `import '@testing-library/jest-dom/vitest'`

`app/index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#030509" />
    <meta name="description" content="CHI ATLAS · Open World — an explorable 3D Chicago for visiting, living and working." />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Michroma&family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
    <title>CHI ATLAS · Open World — Chicago at Full Scale</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

`app/src/main.jsx`
```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
```

`app/src/styles/global.css` — copy CHI's `frontend/src/styles/global.css` from `:root` through the `@keyframes hud-rise` block **verbatim** (tokens, reset, body gradient, film grain, `::selection`, scrollbars, `.hud-panel`, `.hud-label`, `.hud-title`, `.hud-pill`, `.hud-kbd`, `.hud-chip`, `@keyframes hud-pulse`, `.hud-corners`, `@keyframes hud-rise`), then append:
```css
/* Open World: the canvas owns the viewport */
html, body, #root { overflow: hidden; }
.app { position: fixed; inset: 0; }
.app canvas { display: block; }
```
Command: `sed -n '1,/^@keyframes hud-rise/p' ../../chi/frontend/src/styles/global.css` and then copy the closing lines of that keyframe; verify the file ends with the appended block.

- [ ] **Step 2: Failing tests**

`app/src/lib/__tests__/grid.test.js`
```js
import { describe, it, expect } from 'vitest'
import { worldToGrid, crossStreets, M_PER_NUMBER } from '../grid.js'

describe('grid', () => {
  it('800 address numbers is one mile', () => {
    expect(M_PER_NUMBER * 800).toBeCloseTo(1609.344)
  })
  it('origin is State & Madison', () => {
    expect(worldToGrid(0, 0)).toEqual({ ns: 0, ew: 0 })
    expect(crossStreets(0, 0)).toBe('STATE & MADISON')
  })
  it('Michigan & Ohio', () => {
    expect(crossStreets(100 * M_PER_NUMBER, -600 * M_PER_NUMBER)).toBe('MICHIGAN & OHIO')
  })
  it('Wacker & Adams (Willis Tower) resolves west side', () => {
    expect(crossStreets(-360 * M_PER_NUMBER, 200 * M_PER_NUMBER)).toBe('WACKER & ADAMS')
  })
  it('snaps to the nearest named street', () => {
    expect(crossStreets(-130 * M_PER_NUMBER, -810 * M_PER_NUMBER)).toBe('LASALLE & CHICAGO')
  })
  it('over the lake reads LAKE MICHIGAN; never throws far away', () => {
    expect(crossStreets(900 * M_PER_NUMBER, 0)).toBe('LAKE MICHIGAN')
    expect(() => crossStreets(-50000, 50000)).not.toThrow()
    expect(crossStreets(-50000, 50000)).toMatch(/&/)
  })
})
```

`app/src/lib/__tests__/sun.test.js`
```js
import { describe, it, expect } from 'vitest'
import { sunForPreset } from '../sun.js'

const june = new Date('2026-06-21T17:00:00Z') // noon CDT
describe('sunForPreset', () => {
  it('DAY sun is high and in the southern sky (+Z)', () => {
    const s = sunForPreset('DAY', june)
    expect(s.altitude).toBeGreaterThan(0.8)
    expect(s.direction[2]).toBeGreaterThan(0)
    expect(s.night).toBe(0)
  })
  it('DUSK sun sits low in the west (-X)', () => {
    const s = sunForPreset('DUSK', june)
    expect(s.altitude).toBeLessThan(0.1)
    expect(s.direction[0]).toBeLessThan(0)
  })
  it('NIGHT is below the horizon with night=1', () => {
    const s = sunForPreset('NIGHT', june)
    expect(s.altitude).toBeLessThan(0)
    expect(s.night).toBe(1)
  })
  it('DAWN rises in the east (+X)', () => {
    expect(sunForPreset('DAWN', june).direction[0]).toBeGreaterThan(0)
  })
  it('LIVE uses the given time; direction is unit length', () => {
    const s = sunForPreset('LIVE', june)
    expect(s.date).toEqual(june)
    expect(Math.hypot(...s.direction)).toBeCloseTo(1)
  })
})
```

`app/src/state/__tests__/store.test.js`
```js
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store.js'

describe('store', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('defaults to LIVE time and FLY camera', () => {
    expect(useStore.getState().timePreset).toBe('LIVE')
    expect(useStore.getState().cameraMode).toBe('FLY')
  })
  it('tracks load progress to ready', () => {
    const s = useStore.getState()
    s.setLoadTotal(2); s.markLoaded('a'); s.markLoaded('a')
    expect(useStore.getState().load).toMatchObject({ done: 1, ready: false })
    s.markLoaded('b')
    expect(useStore.getState().load).toMatchObject({ done: 2, ready: true })
  })
  it('an error still resolves ready so the app never hangs', () => {
    useStore.getState().setLoadTotal(3)
    useStore.getState().setLoadError('manifest 404')
    expect(useStore.getState().load).toMatchObject({ ready: true, error: 'manifest 404' })
  })
})
```

- [ ] **Step 3: Run** `cd app && npx vitest run` — Expected: FAIL (modules missing).

- [ ] **Step 4: Implement**

`app/src/state/store.js`
```js
import { create } from 'zustand'

export const useStore = create((set) => ({
  timePreset: 'LIVE',
  cameraMode: 'FLY',
  readout: { streets: 'STATE & MADISON', altitude: 0, heading: 0 },
  load: { total: 0, done: 0, keys: [], error: null, ready: false },
  setTimePreset: (timePreset) => set({ timePreset }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setReadout: (readout) => set({ readout }),
  setLoadTotal: (total) => set((s) => ({ load: { ...s.load, total, ready: total === 0 } })),
  markLoaded: (key) => set((s) => {
    if (s.load.keys.includes(key)) return {}
    const keys = [...s.load.keys, key]
    return { load: { ...s.load, keys, done: keys.length, ready: keys.length >= s.load.total } }
  }),
  setLoadError: (error) => set((s) => ({ load: { ...s.load, error, ready: true } })),
}))
```

`app/src/lib/grid.js`
```js
// app/src/lib/grid.js — Chicago's address grid ↔ world metres.
// 800 address numbers = 1 mile. Origin: State (0 E/W) & Madison (0 N/S).
export const M_PER_NUMBER = 1609.344 / 800

// Signed address numbers: +E / -W for north-south streets, +N / -S for east-west streets.
const NS_STREETS = [ // streets that run north-south, keyed by E/W number
  [-1200, 'RACINE'], [-1000, 'MORGAN'], [-800, 'HALSTED'], [-600, 'JEFFERSON'], [-500, 'CANAL'],
  [-400, 'RIVERSIDE'], [-360, 'WACKER'], [-300, 'FRANKLIN'], [-200, 'WELLS'], [-140, 'LASALLE'],
  [-100, 'CLARK'], [-36, 'DEARBORN'], [0, 'STATE'], [45, 'WABASH'], [100, 'MICHIGAN'],
  [200, 'COLUMBUS'], [300, 'MCCLURG'], [400, 'LAKE SHORE'], [600, 'LAKE SHORE'],
]
const EW_STREETS = [ // streets that run east-west, keyed by N/S number
  [-1600, '16TH'], [-1200, 'ROOSEVELT'], [-800, 'POLK'], [-600, 'HARRISON'], [-500, 'CONGRESS'],
  [-400, 'VAN BUREN'], [-300, 'JACKSON'], [-200, 'ADAMS'], [-100, 'MONROE'], [0, 'MADISON'],
  [100, 'WASHINGTON'], [150, 'RANDOLPH'], [200, 'LAKE'], [300, 'WACKER'], [400, 'KINZIE'],
  [430, 'HUBBARD'], [500, 'ILLINOIS'], [530, 'GRAND'], [600, 'OHIO'], [628, 'ONTARIO'],
  [660, 'ERIE'], [700, 'HURON'], [732, 'SUPERIOR'], [800, 'CHICAGO'], [860, 'CHESTNUT'],
  [900, 'DELAWARE'], [932, 'WALTON'], [1000, 'OAK'], [1200, 'DIVISION'], [1600, 'NORTH'],
  [2000, 'ARMITAGE'], [2400, 'FULLERTON'],
]
const LAKE_EW = 700

export function worldToGrid(x, z) {
  return { ns: Math.round(-z / M_PER_NUMBER) || 0, ew: Math.round(x / M_PER_NUMBER) || 0 }
}

const nearest = (table, n) => table.reduce((best, row) => (Math.abs(row[0] - n) < Math.abs(best[0] - n) ? row : best))[1]

export function crossStreets(x, z) {
  const { ns, ew } = worldToGrid(x, z)
  if (ew > LAKE_EW) return 'LAKE MICHIGAN'
  return `${nearest(NS_STREETS, ew)} & ${nearest(EW_STREETS, ns)}`
}
```

`app/src/lib/sun.js`
```js
// app/src/lib/sun.js — real Chicago sun for a time preset.
import SunCalc from 'suncalc'
import { ORIGIN } from '../../../shared/project.js'

const MIN = 60 * 1000

function presetDate(preset, now) {
  const t = SunCalc.getTimes(now, ORIGIN.lat, ORIGIN.lon)
  switch (preset) {
    case 'DAWN': return new Date(t.sunrise.getTime() + 20 * MIN)
    case 'DAY': return new Date(t.solarNoon.getTime() - 90 * MIN)
    case 'DUSK': return new Date(t.sunset.getTime() - 12 * MIN)
    case 'NIGHT': return new Date(t.sunset.getTime() + 120 * MIN)
    default: return now
  }
}

export function sunForPreset(preset, now = new Date()) {
  const date = presetDate(preset, now)
  const { altitude, azimuth } = SunCalc.getPosition(date, ORIGIN.lat, ORIGIN.lon)
  // suncalc azimuth: 0 = south, +π/2 = west. World: +X east, +Z south.
  const c = Math.cos(altitude)
  const direction = [-Math.sin(azimuth) * c, Math.sin(altitude), Math.cos(azimuth) * c]
  // night: 0 above 6° altitude, 1 below -4°
  const deg = (altitude * 180) / Math.PI
  const night = Math.min(1, Math.max(0, (6 - deg) / 10))
  return { date, altitude, azimuth, direction, night }
}
```

- [ ] **Step 5: Run** `npx vitest run` — Expected: all pass. (If `WACKER & ADAMS` fails because Wacker at −360 ties with another row, adjust only the table value per real grid: Wacker Dr runs at ~360 W in the Loop.)
- [ ] **Step 6: Commit + push** `git add app && git commit -m "feat(app): scaffold, CHI design system, store, grid + sun math" && git push origin main`

---

### Task 7: Atlas camera rig

**Files:**
- Create: `app/src/lib/cameraMath.js`, `app/src/lib/bookmarks.js`, `app/src/camera/AtlasRig.jsx`, `app/src/lib/__tests__/cameraMath.test.js`, `app/src/lib/__tests__/bookmarks.test.js`

**Interfaces:**
- Consumes: `useStore` (`cameraMode`, `setReadout`), `crossStreets`.
- Produces: `MIN_ALT = 30`, `MAX_DIST = 3000`; `clampCamera(position: [x,y,z], target: [x,y,z]) → { position, target }` (altitude ≥ 30, target y ≥ 0, horizontal distance of target from origin ≤ 3000, camera–target distance ≤ 3000); `glideVector(keys: Set<string>, azimuth: rad) → [dx, dz]` unit-or-zero in world XZ (W/ArrowUp forward, S/ArrowDown back handled as pitch — see below, A/D strafe).
  - Key map: `KeyW` forward, `KeyS` back, `KeyA` left, `KeyD` right. `ArrowUp`/`ArrowDown` = pitch (CHI parity), `ArrowLeft`/`ArrowRight` = rotate.
- Produces: `BOOKMARKS = { streeterville, loop, river, museum }` each `{ position: [x,y,z], target: [x,y,z] }`; `bookmarkFromUrl(search: string) → bookmark` (default `streeterville`).
- `<AtlasRig />` — R3F component: drei `CameraControls`, keyboard glide in `useFrame`, ORBIT auto-rotates 4°/s, writes readout to store at ~5 Hz, applies bookmark from URL on mount.

- [ ] **Step 1: Failing tests**

`app/src/lib/__tests__/cameraMath.test.js`
```js
import { describe, it, expect } from 'vitest'
import { clampCamera, glideVector, MIN_ALT, MAX_DIST } from '../cameraMath.js'

describe('clampCamera', () => {
  it('lifts the camera to minimum altitude', () => {
    expect(clampCamera([0, -50, 0], [0, 0, -10]).position[1]).toBe(MIN_ALT)
  })
  it('keeps the target on or above ground', () => {
    expect(clampCamera([0, 200, 0], [0, -20, -10]).target[1]).toBe(0)
  })
  it('limits camera-target distance', () => {
    const { position, target } = clampCamera([0, 9000, 0], [0, 0, 0])
    expect(Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2])).toBeCloseTo(MAX_DIST)
  })
  it('limits how far the target wanders from the origin', () => {
    const { target } = clampCamera([10000, 200, 0], [9000, 0, 0])
    expect(Math.hypot(target[0], target[2])).toBeCloseTo(MAX_DIST)
  })
  it('passes a valid pose through unchanged', () => {
    expect(clampCamera([100, 200, 300], [0, 0, 0])).toEqual({ position: [100, 200, 300], target: [0, 0, 0] })
  })
})

describe('glideVector', () => {
  it('W moves toward where the camera looks (azimuth 0 = looking north, -Z)', () => {
    const [dx, dz] = glideVector(new Set(['KeyW']), 0)
    expect(dx).toBeCloseTo(0); expect(dz).toBeCloseTo(-1)
  })
  it('D strafes right (east when looking north)', () => {
    const [dx] = glideVector(new Set(['KeyD']), 0)
    expect(dx).toBeCloseTo(1)
  })
  it('diagonal is normalized; no keys is zero', () => {
    const v = glideVector(new Set(['KeyW', 'KeyD']), 0)
    expect(Math.hypot(...v)).toBeCloseTo(1)
    expect(glideVector(new Set(), 0)).toEqual([0, 0])
  })
})
```

`app/src/lib/__tests__/bookmarks.test.js`
```js
import { describe, it, expect } from 'vitest'
import { BOOKMARKS, bookmarkFromUrl } from '../bookmarks.js'

describe('bookmarks', () => {
  it('defaults to streeterville', () => {
    expect(bookmarkFromUrl('')).toBe(BOOKMARKS.streeterville)
    expect(bookmarkFromUrl('?view=nope')).toBe(BOOKMARKS.streeterville)
  })
  it('reads ?view=', () => {
    expect(bookmarkFromUrl('?view=loop')).toBe(BOOKMARKS.loop)
  })
  it('every bookmark is above minimum altitude', () => {
    for (const b of Object.values(BOOKMARKS)) expect(b.position[1]).toBeGreaterThanOrEqual(30)
  })
})
```

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement**

`app/src/lib/cameraMath.js`
```js
// app/src/lib/cameraMath.js — pure camera limits + keyboard glide.
export const MIN_ALT = 30
export const MAX_DIST = 3000

export function clampCamera(position, target) {
  let [tx, ty, tz] = target
  ty = Math.max(0, ty)
  const tr = Math.hypot(tx, tz)
  if (tr > MAX_DIST) { tx *= MAX_DIST / tr; tz *= MAX_DIST / tr }
  let [px, py, pz] = position
  // move the camera with the target if the target was pulled in
  px += tx - target[0]; pz += tz - target[2]
  let dx = px - tx, dy = py - ty, dz = pz - tz
  const d = Math.hypot(dx, dy, dz)
  if (d > MAX_DIST) { const k = MAX_DIST / d; dx *= k; dy *= k; dz *= k }
  px = tx + dx; py = ty + dy; pz = tz + dz
  py = Math.max(MIN_ALT, py)
  return { position: [px, py, pz], target: [tx, ty, tz] }
}

// azimuth: camera heading, 0 = looking north (-Z), +π/2 = looking west (camera-controls convention).
export function glideVector(keys, azimuth) {
  let f = 0, r = 0
  if (keys.has('KeyW')) f += 1
  if (keys.has('KeyS')) f -= 1
  if (keys.has('KeyD')) r += 1
  if (keys.has('KeyA')) r -= 1
  if (!f && !r) return [0, 0]
  const len = Math.hypot(f, r)
  f /= len; r /= len
  const fx = -Math.sin(azimuth), fz = -Math.cos(azimuth) // forward
  const rx = Math.cos(azimuth), rz = -Math.sin(azimuth)  // right
  return [f * fx + r * rx, f * fz + r * rz]
}
```

`app/src/lib/bookmarks.js`
```js
// app/src/lib/bookmarks.js — named camera poses (also used by Playwright baselines).
export const BOOKMARKS = {
  // From over the lake east of Streeterville looking SW at the skyline
  streeterville: { position: [1900, 320, -1500], target: [150, 60, -350] },
  // From above Willis looking NE across the Loop
  loop: { position: [-1100, 520, 900], target: [150, 40, -500] },
  // Down the main river canyon from the east
  river: { position: [900, 90, -560], target: [-600, 30, -520] },
  // Museum Campus looking back north at the skyline
  museum: { position: [900, 180, 2600], target: [0, 80, 0] },
}

export function bookmarkFromUrl(search) {
  const v = new URLSearchParams(search).get('view')
  return BOOKMARKS[v] ?? BOOKMARKS.streeterville
}
```

`app/src/camera/AtlasRig.jsx`
```jsx
// app/src/camera/AtlasRig.jsx — FLY / ORBIT camera over the city.
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { clampCamera, glideVector, MAX_DIST } from '../lib/cameraMath.js'
import { bookmarkFromUrl } from '../lib/bookmarks.js'
import { crossStreets } from '../lib/grid.js'

const GLIDE_MPS = 140
const BOOST = 3
const ORBIT_RAD_PER_S = (4 * Math.PI) / 180
const ROTATE_RAD_PER_S = 1.2
const tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3()

export default function AtlasRig() {
  const ref = useRef()
  const keys = useRef(new Set())
  const lastReadout = useRef(0)
  const mode = useStore((s) => s.cameraMode)
  const setReadout = useStore((s) => s.setReadout)
  const setCameraMode = useStore((s) => s.setCameraMode)

  useEffect(() => {
    const b = bookmarkFromUrl(window.location.search)
    ref.current?.setLookAt(...b.position, ...b.target, false)
  }, [])

  useEffect(() => {
    const typing = (e) => ['INPUT', 'TEXTAREA'].includes(e.target?.tagName)
    const down = (e) => { if (!typing(e)) keys.current.add(e.code) }
    const up = (e) => keys.current.delete(e.code)
    const blur = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) }
  }, [])

  useFrame((state, dt) => {
    const c = ref.current
    if (!c) return
    const k = keys.current
    const boost = k.has('ShiftLeft') || k.has('ShiftRight') ? BOOST : 1
    const [dx, dz] = glideVector(k, c.azimuthAngle)
    const anyInput = dx || dz || k.has('ArrowUp') || k.has('ArrowDown') || k.has('ArrowLeft') || k.has('ArrowRight')
    if (anyInput && mode === 'ORBIT') setCameraMode('FLY')
    if (dx || dz) {
      const alt = c.camera.position.y
      const speed = GLIDE_MPS * boost * Math.max(0.5, alt / 250) * dt
      c.getTarget(tmpT); c.getPosition(tmpP)
      c.setLookAt(tmpP.x + dx * speed, tmpP.y, tmpP.z + dz * speed, tmpT.x + dx * speed, tmpT.y, tmpT.z + dz * speed, false)
    }
    if (k.has('ArrowUp')) c.rotate(0, -ROTATE_RAD_PER_S * 0.5 * dt, false)
    if (k.has('ArrowDown')) c.rotate(0, ROTATE_RAD_PER_S * 0.5 * dt, false)
    if (k.has('ArrowLeft')) c.rotate(ROTATE_RAD_PER_S * dt, 0, false)
    if (k.has('ArrowRight')) c.rotate(-ROTATE_RAD_PER_S * dt, 0, false)
    if (mode === 'ORBIT') c.rotate(ORBIT_RAD_PER_S * dt, 0, false)

    c.getTarget(tmpT); c.getPosition(tmpP)
    const cl = clampCamera(tmpP.toArray(), tmpT.toArray())
    if (cl.position.some((v, i) => v !== tmpP.getComponent(i)) || cl.target.some((v, i) => v !== tmpT.getComponent(i))) {
      c.setLookAt(...cl.position, ...cl.target, false)
    }

    const t = state.clock.elapsedTime
    if (t - lastReadout.current > 0.2) {
      lastReadout.current = t
      const heading = ((-c.azimuthAngle * 180) / Math.PI + 360 * 10) % 360
      setReadout({ streets: crossStreets(tmpT.x, tmpT.z), altitude: Math.round(tmpP.y), heading: Math.round(heading) })
    }
  })

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={60}
      maxDistance={MAX_DIST}
      maxPolarAngle={Math.PI * 0.47}
      dollyToCursor
      smoothTime={0.35}
      draggingSmoothTime={0.15}
    />
  )
}
```

- [ ] **Step 4: Run** `npx vitest run` — Expected: all pass.
- [ ] **Step 5: Commit + push** `git add app/src && git commit -m "feat(app): atlas camera rig with clamps, glide and bookmarks" && git push origin main`

---

### Task 8: World scene — city tiles, ground, lake, sky

**Files:**
- Create: `app/src/lib/manifest.js`, `app/src/lib/__tests__/manifest.test.js`, `app/src/world/Scene.jsx`, `app/src/world/City.jsx`, `app/src/world/Ground.jsx`, `app/src/world/Lake.jsx`, `app/src/world/SkyRig.jsx`, `app/public/textures/waternormals.jpg`
- Modify: `app/src/App.jsx`

**Interfaces:**
- Consumes: manifest schema (Task 5), `useStore` load actions + `timePreset` (Task 6), `sunForPreset` (Task 6), `AtlasRig` (Task 7).
- Produces: `loadManifest(fetchImpl = fetch) → Promise<{ ok: true, manifest } | { ok: false, error: string }>` (never throws).
- `<Scene />` — everything inside `<Canvas>`; sets `window.__worldReady = true` once `load.ready` (used by Playwright).

- [ ] **Step 1: Failing test** `app/src/lib/__tests__/manifest.test.js`
```js
import { describe, it, expect } from 'vitest'
import { loadManifest } from '../manifest.js'

const res = (ok, body, status = 200) => async () => ({ ok, status, json: async () => body })

describe('loadManifest', () => {
  it('returns the manifest on success', async () => {
    const r = await loadManifest(res(true, { version: 1, tiles: [], ground: {} }))
    expect(r).toEqual({ ok: true, manifest: { version: 1, tiles: [], ground: {} } })
  })
  it('reports HTTP errors without throwing', async () => {
    expect(await loadManifest(res(false, null, 404))).toEqual({ ok: false, error: 'manifest HTTP 404' })
  })
  it('reports network errors and bad shapes without throwing', async () => {
    expect((await loadManifest(async () => { throw new Error('offline') })).ok).toBe(false)
    expect((await loadManifest(res(true, { nope: 1 }))).error).toBe('manifest malformed')
  })
})
```

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement `manifest.js`**
```js
// app/src/lib/manifest.js — never-throwing world manifest loader.
export async function loadManifest(fetchImpl = fetch) {
  try {
    const r = await fetchImpl('/world/manifest.json')
    if (!r.ok) return { ok: false, error: `manifest HTTP ${r.status}` }
    const m = await r.json()
    if (!m || !Array.isArray(m.tiles) || !m.ground) return { ok: false, error: 'manifest malformed' }
    return { ok: true, manifest: m }
  } catch (e) {
    return { ok: false, error: `manifest ${e.message}` }
  }
}
```

- [ ] **Step 4: Run** — Expected: pass.

- [ ] **Step 5: Water normals texture**
`curl -L -o app/public/textures/waternormals.jpg https://raw.githubusercontent.com/mrdoob/three.js/r176/examples/textures/waternormals.jpg` (MIT, three.js examples). Verify: `file app/public/textures/waternormals.jpg` → JPEG image data.

- [ ] **Step 6: Implement the scene components**

`app/src/world/City.jsx`
```jsx
// app/src/world/City.jsx — loads every manifest tile; one shared material.
import { Suspense, useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../state/store.js'

export const buildingMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05 })

function Tile({ file }) {
  const { scene } = useGLTF(`/world/${file}`, false, false)
  const markLoaded = useStore((s) => s.markLoaded)
  const obj = useMemo(() => {
    scene.traverse((o) => {
      if (o.isMesh) { o.material = buildingMaterial; o.castShadow = true; o.receiveShadow = true }
    })
    return scene
  }, [scene])
  useEffect(() => { markLoaded(file) }, [markLoaded, file])
  return <primitive object={obj} />
}

export default function City({ tiles }) {
  return tiles.map((t) => (
    <Suspense key={t.key} fallback={null}>
      <Tile file={t.file} />
    </Suspense>
  ))
}
```

`app/src/world/Ground.jsx`
```jsx
// app/src/world/Ground.jsx — land (city boundary) + river/harbour water.
import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../state/store.js'

const landMat = new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.95 })
const riverMat = new THREE.MeshStandardMaterial({ color: '#16353b', roughness: 0.18, metalness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 })

function Flat({ file, material }) {
  const { scene } = useGLTF(`/world/${file}`, false, false)
  const markLoaded = useStore((s) => s.markLoaded)
  const obj = useMemo(() => {
    scene.traverse((o) => { if (o.isMesh) { o.material = material; o.receiveShadow = true } })
    return scene
  }, [scene, material])
  useEffect(() => { markLoaded(file) }, [markLoaded, file])
  return <primitive object={obj} />
}

export default function Ground({ ground }) {
  return (
    <>
      <Flat file={ground.land} material={landMat} />
      <Flat file={ground.river} material={riverMat} />
    </>
  )
}
```

`app/src/world/Lake.jsx`
```jsx
// app/src/world/Lake.jsx — Lake Michigan: a large reflective water plane under the land.
import { useMemo, useRef } from 'react'
import { extend, useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { Water } from 'three/examples/jsm/objects/Water.js'

extend({ Water })

export default function Lake({ sunDirection }) {
  const ref = useRef()
  const normals = useLoader(THREE.TextureLoader, '/textures/waternormals.jpg')
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping
  const geom = useMemo(() => new THREE.PlaneGeometry(40000, 40000), [])
  const config = useMemo(() => ({
    textureWidth: 1024, textureHeight: 1024, waterNormals: normals,
    sunDirection: new THREE.Vector3(...sunDirection), sunColor: 0xffffff,
    waterColor: 0x0b2733, distortionScale: 2.2, fog: true,
  }), [normals]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const w = ref.current
    if (!w) return
    w.material.uniforms.time.value += dt * 0.35
    w.material.uniforms.sunDirection.value.set(...sunDirection)
  })
  return <water ref={ref} args={[geom, config]} rotation-x={-Math.PI / 2} position={[0, -0.6, 0]} />
}
```

`app/src/world/SkyRig.jsx`
```jsx
// app/src/world/SkyRig.jsx — physical sky, sun light with shadows over Ring 0, fog.
import { useMemo } from 'react'
import { Sky } from '@react-three/drei'
import * as THREE from 'three'

const DAY_FOG = new THREE.Color('#b9c6d2'), NIGHT_FOG = new THREE.Color('#05080f')

export default function SkyRig({ sun }) {
  const [x, y, z] = sun.direction
  const sunPos = useMemo(() => [x * 5000, y * 5000, z * 5000], [x, y, z])
  const fog = useMemo(() => DAY_FOG.clone().lerp(NIGHT_FOG, sun.night), [sun.night])
  const sunI = Math.max(0, y) * 3.2 * (1 - sun.night * 0.9)
  return (
    <>
      <Sky sunPosition={sunPos} turbidity={6} rayleigh={1.6} mieCoefficient={0.006} mieDirectionalG={0.86} distance={45000} />
      <fog attach="fog" args={[fog, 900, 9000]} />
      <color attach="background" args={[fog]} />
      <hemisphereLight args={['#cfe3ff', '#2b2a28', 0.55 - sun.night * 0.4]} />
      <directionalLight
        position={sunPos}
        intensity={sunI}
        color={y < 0.2 ? '#ffb27a' : '#fff4e6'}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
        shadow-camera-left={-2200}
        shadow-camera-right={2200}
        shadow-camera-top={2200}
        shadow-camera-bottom={-2200}
        shadow-camera-near={100}
        shadow-camera-far={12000}
      />
    </>
  )
}
```

`app/src/world/Scene.jsx`
```jsx
// app/src/world/Scene.jsx — the whole 3D world.
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store.js'
import { loadManifest } from '../lib/manifest.js'
import { sunForPreset } from '../lib/sun.js'
import City from './City.jsx'
import Ground from './Ground.jsx'
import Lake from './Lake.jsx'
import SkyRig from './SkyRig.jsx'
import AtlasRig from '../camera/AtlasRig.jsx'

export default function Scene() {
  const [manifest, setManifest] = useState(null)
  const preset = useStore((s) => s.timePreset)
  const ready = useStore((s) => s.load.ready)
  const [now, setNow] = useState(() => new Date())
  const sun = useMemo(() => sunForPreset(preset, now), [preset, now])

  useEffect(() => {
    if (preset !== 'LIVE') return
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [preset])

  useEffect(() => {
    const { setLoadTotal, setLoadError } = useStore.getState()
    loadManifest().then((r) => {
      if (!r.ok) { setLoadError(r.error); return }
      setLoadTotal(r.manifest.tiles.length + 2)
      setManifest(r.manifest)
    })
  }, [])

  useEffect(() => { if (ready) window.__worldReady = true }, [ready])

  return (
    <>
      <SkyRig sun={sun} />
      <Lake sunDirection={sun.direction} />
      {manifest && <Ground ground={manifest.ground} />}
      {manifest && <City tiles={manifest.tiles} />}
      <AtlasRig />
    </>
  )
}
```

`app/src/App.jsx`
```jsx
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Scene from './world/Scene.jsx'

export default function App() {
  return (
    <div className="app">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 42, near: 5, far: 60000, position: [1900, 320, -1500] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9, preserveDrawingBuffer: true }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
```

- [ ] **Step 7: Run it and look.** `npm run dev` (root). Open `http://localhost:5173/?view=streeterville` with Playwright MCP, wait 5 s, screenshot. Expected: skyline of extruded buildings on grey land, lake to the east, river cutting through, sky with sun. Check against real Chicago: Willis visibly tallest west of the river, Trump tower at the river bend, Aon near the park, and no buildings standing in the lake. Fix any orientation error (mirrored city = sign error in `shared/project.js` usage) before committing. Also check `?view=loop`, `?view=river`, `?view=museum`.
- [ ] **Step 8: Run** `cd app && npx vitest run` — Expected: all pass.
- [ ] **Step 9: Commit + push** `git add app && git commit -m "feat(app): world scene — tiles, land, river, lake, physical sky" && git push origin main`

---

### Task 9: HUD shell

**Files:**
- Create: `app/src/hud/Hud.jsx`, `Hud.css`, `HudClock.jsx`, `WordmarkBlock.jsx`, `ControlPills.jsx`, `HintBar.jsx`, `LoadingScreen.jsx`, `app/src/hud/__tests__/hud.test.jsx`
- Modify: `app/src/App.jsx` (render `<Hud />` after the Canvas)

**Interfaces:**
- Consumes: `useStore` (`readout`, `timePreset`, `setTimePreset`, `cameraMode`, `setCameraMode`, `load`).
- Produces: `<Hud />` DOM overlay; keyboard: `O` toggles ORBIT/FLY, `1–5` select LIVE/DAWN/DAY/DUSK/NIGHT.

- [ ] **Step 1: Failing test** `app/src/hud/__tests__/hud.test.jsx`
```jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Hud from '../Hud.jsx'
import { useStore } from '../../state/store.js'

describe('Hud', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))

  it('shows wordmark and the live camera readout', () => {
    useStore.setState({ readout: { streets: 'MICHIGAN & OHIO', altitude: 240, heading: 312 } })
    const { container } = render(<Hud />)
    expect(container.querySelector('.wm-logo')).toHaveTextContent('CHI ATLAS')
    expect(container.querySelector('.wm-sub')).toHaveTextContent('OPEN WORLD')
    expect(screen.getByText(/MICHIGAN & OHIO/)).toBeInTheDocument()
    expect(screen.getByText(/240 M ALT/)).toBeInTheDocument()
  })
  it('time pills set the preset; the active one is marked', () => {
    render(<Hud />)
    fireEvent.click(screen.getByRole('button', { name: 'DUSK' }))
    expect(useStore.getState().timePreset).toBe('DUSK')
    expect(screen.getByRole('button', { name: 'DUSK' })).toHaveClass('active')
  })
  it('number keys pick presets and O toggles orbit', () => {
    render(<Hud />)
    fireEvent.keyDown(window, { code: 'Digit5' })
    expect(useStore.getState().timePreset).toBe('NIGHT')
    fireEvent.keyDown(window, { code: 'KeyO' })
    expect(useStore.getState().cameraMode).toBe('ORBIT')
  })
  it('loading screen shows progress, then an error chip instead of hanging', () => {
    useStore.getState().setLoadTotal(4)
    useStore.getState().markLoaded('t1')
    const { rerender } = render(<Hud />)
    expect(screen.getByText(/25%/)).toBeInTheDocument()
    useStore.getState().setLoadError('manifest HTTP 404')
    rerender(<Hud />)
    expect(screen.getByText(/WORLD DATA UNAVAILABLE/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement**

`app/src/hud/HudClock.jsx` — **copy CHI's `frontend/src/components/hud/HudClock.jsx` verbatim**, changing only the header comment path to `app/src/hud/HudClock.jsx`.

`app/src/hud/WordmarkBlock.jsx`
```jsx
import { useStore } from '../state/store.js'
import HudClock from './HudClock.jsx'

export default function WordmarkBlock() {
  const r = useStore((s) => s.readout)
  return (
    <div className="hud-panel hud-wordmark">
      <div className="wm-row">
        <span className="wm-logo">CHI ATLAS</span>
        <span className="wm-sub">OPEN WORLD</span>
      </div>
      <div className="wm-readout">{r.streets} · {r.altitude} M ALT · HDG {String(r.heading).padStart(3, '0')}°</div>
      <div className="wm-clock"><HudClock /></div>
    </div>
  )
}
```

`app/src/hud/ControlPills.jsx`
```jsx
import { useEffect } from 'react'
import { useStore } from '../state/store.js'

const TIMES = ['LIVE', 'DAWN', 'DAY', 'DUSK', 'NIGHT']
const MODES = ['FLY', 'ORBIT']

export default function ControlPills() {
  const time = useStore((s) => s.timePreset)
  const setTime = useStore((s) => s.setTimePreset)
  const mode = useStore((s) => s.cameraMode)
  const setMode = useStore((s) => s.setCameraMode)

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 }[e.code]
      if (n !== undefined) setTime(TIMES[n])
      if (e.code === 'KeyO') setMode(useStore.getState().cameraMode === 'ORBIT' ? 'FLY' : 'ORBIT')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setTime, setMode])

  return (
    <div className="hud-controls">
      <div className="pill-row">
        {MODES.map((m) => (
          <button key={m} type="button" className={`hud-pill ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>{m}</button>
        ))}
      </div>
      <div className="pill-row small">
        {TIMES.map((t) => (
          <button key={t} type="button" className={`hud-pill ${time === t ? 'active' : ''}`} onClick={() => setTime(t)}>{t}</button>
        ))}
      </div>
    </div>
  )
}
```

`app/src/hud/HintBar.jsx`
```jsx
const HINTS = [['Drag', 'rotate'], ['Scroll', 'zoom'], ['WASD', 'glide'], ['↑↓', 'pitch'], ['Shift', 'boost'], ['O', 'orbit'], ['1–5', 'time']]

export default function HintBar() {
  return (
    <div className="hud-hints">
      {HINTS.map(([k, label]) => (
        <span key={k}><span className="hud-kbd">{k}</span> {label}</span>
      ))}
    </div>
  )
}
```

`app/src/hud/LoadingScreen.jsx`
```jsx
import { useEffect, useState } from 'react'
import { useStore } from '../state/store.js'

export default function LoadingScreen() {
  const { total, done, error, ready } = useStore((s) => s.load)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (!ready || error) return
    const id = setTimeout(() => setGone(true), 900)
    return () => clearTimeout(id)
  }, [ready, error])
  if (gone) return null
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className={`hud-loading ${ready && !error ? 'fading' : ''}`}>
      <div className="load-mark">CHI ATLAS</div>
      <div className="load-sub">THE CITY, AT FULL SCALE</div>
      {error ? (
        <button type="button" className="hud-chip load-error" onClick={() => setGone(true)}>WORLD DATA UNAVAILABLE · {error} · CONTINUE</button>
      ) : (
        <>
          <div className="load-bar"><span style={{ width: `${pct}%` }} /></div>
          <div className="load-pct">{pct}% · {done}/{total} WORLD FILES</div>
        </>
      )}
    </div>
  )
}
```

`app/src/hud/Hud.jsx`
```jsx
import './Hud.css'
import WordmarkBlock from './WordmarkBlock.jsx'
import ControlPills from './ControlPills.jsx'
import HintBar from './HintBar.jsx'
import LoadingScreen from './LoadingScreen.jsx'

export default function Hud() {
  return (
    <div className="hud-root">
      <div className="hud-vignette" />
      <WordmarkBlock />
      <ControlPills />
      <HintBar />
      <LoadingScreen />
    </div>
  )
}
```

`app/src/hud/Hud.css`
```css
.hud-root { position: fixed; inset: 0; pointer-events: none; z-index: 10; }
.hud-root > * { pointer-events: auto; }
.hud-root > .hud-vignette { pointer-events: none; position: absolute; inset: 0;
  background: radial-gradient(ellipse at center, transparent 55%, rgba(3, 5, 9, 0.55) 100%); }

.hud-wordmark { position: absolute; top: 16px; left: 16px; padding: 14px 18px 12px; min-width: 260px; animation: hud-rise 0.6s ease both; }
.wm-row { display: flex; align-items: baseline; gap: 12px; }
.wm-logo { font-family: var(--font-display); font-size: 15px; letter-spacing: 0.24em; color: var(--text);
  text-shadow: 0 0 18px rgba(var(--accent-rgb), 0.5); }
.wm-logo::first-letter { color: var(--accent); }
.wm-sub { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.32em; color: var(--text-faint); }
.wm-readout { margin-top: 8px; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; color: var(--accent); }
.wm-clock { margin-top: 6px; font-size: 18px; color: var(--text); }

.hud-controls { position: absolute; top: 16px; right: 16px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; animation: hud-rise 0.6s 0.1s ease both; }
.pill-row { display: flex; gap: 6px; }
.pill-row.small .hud-pill { font-size: 10px; padding: 4px 11px; }

.hud-hints { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 16px; padding: 7px 16px; border-radius: 999px;
  border: 1px solid var(--border); background: var(--panel);
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  font-size: 10.5px; color: var(--text-faint); white-space: nowrap; }
.hud-hints span { display: inline-flex; align-items: center; gap: 6px; }

.hud-loading { position: absolute; inset: 0; z-index: 50; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  background: radial-gradient(900px 600px at 50% 40%, rgba(var(--accent-rgb), 0.07), transparent 60%), var(--bg);
  transition: opacity 0.9s ease; }
.hud-loading.fading { opacity: 0; pointer-events: none; }
.load-mark { font-family: var(--font-display); font-size: 34px; letter-spacing: 0.34em; color: var(--text); text-shadow: 0 0 28px rgba(var(--accent-rgb), 0.45); }
.load-sub { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.4em; color: var(--text-faint); }
.load-bar { width: 260px; height: 2px; background: var(--border); border-radius: 2px; overflow: hidden; margin-top: 18px; }
.load-bar span { display: block; height: 100%; background: var(--accent); box-shadow: 0 0 12px rgba(var(--accent-rgb), 0.9); transition: width 0.3s ease; }
.load-pct { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.2em; color: var(--text-muted); }
.load-error { cursor: pointer; color: var(--red); border-color: rgba(var(--red-rgb), 0.4); }

@media (max-width: 720px) {
  .hud-hints { display: none; }
  .hud-wordmark { min-width: 0; }
}
```

Modify `app/src/App.jsx`: import `Hud from './hud/Hud.jsx'` and render `<Hud />` right after `</Canvas>` inside `.app`.

- [ ] **Step 4: Run** `npx vitest run` — Expected: all pass.
- [ ] **Step 5: Visual check** in the browser (Playwright MCP): loading bar fills then fades; wordmark top-left reads e.g. `MICHIGAN & ONTARIO · 320 M ALT · HDG 2xx°` and changes as you fly; DUSK pill turns cyan and the sky goes golden; NIGHT darkens; `O` orbits.
- [ ] **Step 6: Commit + push** `git add app && git commit -m "feat(app): CHI HUD shell — wordmark, readout, pills, hints, loading" && git push origin main`

---

### Task 10: Hero-view baseline + README

**Files:**
- Create: `app/playwright.config.js`, `app/e2e/hero-view.spec.js`, `README.md`, `docs/screenshots/phase1-streeterville-dusk.png`

**Interfaces:**
- Consumes: `window.__worldReady` (Task 8), bookmarks + `?view=` (Task 7).
- Produces: `?time=dawn|day|dusk|night|live` URL param.

- [ ] **Step 0: `?time=` param** — in `app/src/world/Scene.jsx`, replace the manifest effect's first line so it reads:
```jsx
  useEffect(() => {
    const { setLoadTotal, setLoadError, setTimePreset } = useStore.getState()
    const t = new URLSearchParams(window.location.search).get('time')?.toUpperCase()
    if (['LIVE', 'DAWN', 'DAY', 'DUSK', 'NIGHT'].includes(t)) setTimePreset(t)
    loadManifest().then((r) => {
```
(the rest of the effect is unchanged). Verify manually: `/?time=night` opens dark.

- [ ] **Step 1: Playwright config**
```js
// app/playwright.config.js
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: { baseURL: 'http://localhost:5173', viewport: { width: 1600, height: 1000 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: { command: 'npm run dev', port: 5173, reuseExistingServer: true, timeout: 60_000 },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.03 } },
})
```

- [ ] **Step 2: Spec** `app/e2e/hero-view.spec.js`
```js
import { test, expect } from '@playwright/test'

for (const [view, time] of [['streeterville', 'dusk'], ['loop', 'day'], ['river', 'dusk'], ['museum', 'day']]) {
  test(`${view} @ ${time}`, async ({ page }) => {
    await page.goto(`/?view=${view}&time=${time}`)
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
    await page.waitForTimeout(2500) // camera smoothing + loading fade
    await expect(page).toHaveScreenshot(`${view}-${time}.png`, { mask: [page.locator('.wm-clock')] })
  })
}
```

- [ ] **Step 3: Generate baselines** `cd app && npx playwright install chromium && npx playwright test --update-snapshots`. Expected: 4 PNGs in `app/e2e/hero-view.spec.js-snapshots/`. **Open every PNG and review it** — the city must be correctly oriented, the lake east, and the skyline recognizable. Then run `npx playwright test` — Expected: 4 passed.

- [ ] **Step 4: Portfolio screenshot** — copy the Streeterville dusk baseline to `docs/screenshots/phase1-streeterville-dusk.png`.

- [ ] **Step 5: README.md** — CHI-style (dark badges, HUD voice): title `CHI ATLAS · OPEN WORLD`, tagline, the Phase 1 screenshot, "What this is" (3 short paragraphs), Quickstart (`npm run fetch`, `npm run build:world`, `npm run dev`), controls table (matches HintBar), data sources + licenses (City of Chicago data portal terms; OSM ODbL attribution "© OpenStreetMap contributors"), roadmap (spec §13 phases, Phase 1 ticked), MIT © 2026 Connor Evans. No emojis.

- [ ] **Step 6: Full verification** — `npm test` at root (pipeline + app) all green; `npm run build` succeeds; `du -sh app/dist` reported in the commit message body.

- [ ] **Step 7: Commit + push**
```bash
git add app/playwright.config.js app/e2e README.md docs/screenshots app/src/world/Scene.jsx
git commit -m "feat: Phase 1 foundation — hero-view baselines, README"
git push origin main
```
