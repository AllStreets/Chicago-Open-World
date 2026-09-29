# Phase 2 — Beauty Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Phase 1 massing model into a beautiful, game-quality Chicago: textured façades with lit windows at night, a living sky that follows real Chicago time (with smooth DAWN/DAY/DUSK/NIGHT overrides and stars), reflective glass and water, parks with seasonal trees, roads and sidewalks, the elevated L, rooftop water towers, post-processing, a minimap and an intro flight — plus the two landmark corrections the user asked for (Willis antennas at full 527 m, Hancock's tapered obelisk).

**Architecture:** The pipeline gains three new outputs — shaped heroes (taper + antenna reseating), processed texture sets (generated with the Z-Image image-generation tool, cropped to whole window bays, made seamless, window masks derived from luminance), and ground layers (parks, roads, sidewalks, rail, trees, roof props, minimap raster). The app replaces the flat vertex-color material with one shared façade shader (`MeshStandardMaterial.onBeforeCompile`) sampling `DataArrayTexture`s, drives all lighting from one `paletteFor(sunElevation)` function tweened every frame, and composes the frame with `@react-three/postprocessing`.

**Tech Stack:** as Phase 1, plus sharp 0.35 (pipeline image processing), @react-three/postprocessing 3.1 + postprocessing 6.39, Z-Image-Turbo image generation (MCP tool `gr1_z_image_turbo_generate`).

**Spec:** `docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md` (Phase 2 = §13 item 2; implements §4.2 steps 4–6, §4.4, §5 in full, §6 intro flight, §8 minimap). User additions this phase (2026-09-28): Willis antennas at real height; Hancock tapered; sky follows real time on load with manual override "like CHI ATLAS"; buildings, parks and features "incredible".

## Global Constraints

- All Phase 1 Global Constraints still apply (projection, tokens, no emojis, Remix icons, tile size, camera limits, push after every task).
- `MAX_HEIGHT_M` becomes **530** (Willis antennas are 527 m). Spec §4.2 step 3 said 450 — amended at the user's request.
- Floor height stays **3.8 m**; façade texture tiles must map whole floors: `tileH = floors × 3.8`.
- Façade families (index order is fixed and shared with Phase 1 `_FACADE`): `0 loop-limestone, 1 art-deco, 2 prewar-brick, 3 curtain-glass, 4 precast-concrete, 5 river-north-loft, 6 three-flat-brick, 7 industrial`.
- Time presets: `LIVE | DAWN | DAY | DUSK | NIGHT`; **default LIVE = real Chicago time at load**; preset changes tween over **2.5 s**; LIVE re-evaluates every 60 s.
- Quality presets: `LOW | HIGH | ULTRA`, default `HIGH`; auto-downgrade one step when the 3 s rolling average frame time exceeds **25 ms**.
- Budgets: < 300 draw calls, < 1.5 M triangles at HIGH, `app/public` < 40 MB.
- Texture prompts are saved verbatim in `pipeline/textures/prompts.md`; raw generated images are committed under `pipeline/textures/raw/`.
- `prefers-reduced-motion`: no intro flight; time-of-day changes are instant.

## Review Focus

- **A building with parts where the taper would push antennas off the roof** (Hancock's two 457 m masts have no `min_height`) → antennas start at the shaft top and move inward with the taper; nothing pokes through a sloped wall. Pinned in Task 1 (`shapePieces` antenna test).
- **Texture array fails to load or a single texture 404s** → buildings still render (flat fallback color), no black meshes, no crash. Pinned in Task 3 (`loadLayerArray` fallback test).
- **Night at high latitude in winter vs summer** (sun far below horizon, or barely below at 10 pm in June) → palette never produces NaN/negative intensities and night is fully dark at ≤ −12°. Pinned in Task 4 (`paletteFor` sweep test).
- **Very long session in LIVE mode crossing sunset** → sky moves continuously with no jump when LIVE ticks. Pinned in Task 4 (`stepSun` continuity test).
- **Minimap click far outside the world** → fly target clamped into camera limits (≤ 3000 m), never NaN. Pinned in Task 10 (`mapToWorld` clamp test).

---

## File Structure

```
pipeline/
  lib/shapes.js            HERO_SHAPES, shapePieces(building) → pieces with taper / reseated antennas
  lib/extrude.js           (modify) taper support
  lib/height.js            (modify) MAX_HEIGHT_M = 530
  lib/ribbon.js            bufferPolyline(points, halfWidth) → {positions, normals, uvs}
  lib/ground.js            ROAD_WIDTHS, roadHalfWidth(tags), isElevatedRail(tags), scatterInPolygon(ring, spacing, seed)
  lib/props.js             roofProps(building, pieces) → prop tuples
  lib/minimap.js           minimapSvg(layers, bounds, size) → string
  lib/sources.js           (modify) overpass kinds parks | roads | trees | rail
  textures/prompts.md      verbatim generation prompts
  textures/raw/*.webp      generated source images (committed)
  textures/textures.config.json   crop rects, bays, floors, bay widths, thresholds
  textures/process.js      raw → app/public/textures/{facades,ground}/*
  textures/seamless.js     makeSeamless(), windowMaskFromLuma()
  build/build-world.js     (modify) shapes, ground layers, props, trees, minimap, manifest v2
app/src/
  world/materials/facadeMaterial.js   createFacadeMaterial(textures), patchFacadeShader(shader), facadeUniforms
  world/materials/textureArray.js     packLayers(), loadLayerArray(urls, size)
  world/materials/groundMaterials.js  grass / asphalt / sidewalk / concrete / rail / steel / sand
  lib/skyPalette.js        paletteFor(elevDeg)
  lib/sunTween.js          stepSun(current, target, dt, tau)
  lib/quality.js           QUALITY, nextQuality(avgMs, current)
  lib/seasons.js           treePalette(month)
  lib/introPath.js         introPose(t)
  lib/minimapMath.js       worldToMap, mapToWorld, compassOffset
  world/SkyRig.jsx         (rewrite) tweened sun, palette-driven lights/fog/stars/env
  world/PostFX.jsx         AO, bloom, tone map, SMAA, vignette
  world/Ground.jsx         (rewrite) land, river, parks, roads, sidewalks, rail
  world/Trees.jsx          instanced seasonal trees
  world/RoofProps.jsx      instanced water towers + HVAC
  world/ElevatedL.jsx      elevated structure + instanced columns
  camera/AtlasRig.jsx      (modify) intro flight, flyTo requests
  hud/Minimap.jsx, Minimap.css
  hud/ControlPills.jsx     (modify) quality pill
  state/store.js           (modify) quality, flyTo, intro
```

---

### Task 1: Landmark shaping — Willis antennas to 527 m, Hancock taper

**Files:**
- Modify: `pipeline/lib/height.js`, `pipeline/lib/extrude.js`, `pipeline/build/build-world.js`, `pipeline/tests/height.test.js`
- Create: `pipeline/lib/shapes.js`, `pipeline/tests/shapes.test.js`, extend `pipeline/tests/extrude.test.js`

**Interfaces:**
- Produces: `MAX_HEIGHT_M = 530`.
- Produces: `extrudeBuilding({ outer, holes, base, top, taper? })` where `taper = { center: [x,z], shaftTop: number, topScale: number }`; ring scale at height y is `s(y) = 1 − (1 − topScale) · clamp(y / shaftTop, 0, 1)`; wall normals come from the actual (tilted) quad.
- Produces: `HERO_SHAPES = { '331204': { name: 'John Hancock Center', topScale: 0.62 } }`; `shapePieces(building) → Array<{ outer, holes, base, top, taper? }>` — the single source of pieces for a building (footprint pieces + OSM parts), used by `build-world.js` instead of its inline piece list.
  - Antenna rule for shaped buildings: a part with area < 3% of the building area and `top > shaftTop` is an antenna → `base = shaftTop · 0.98`, translated toward `center` by `(1 − topScale)` of its offset, no taper.
  - `shaftTop` = max `top` of non-antenna pieces.

- [ ] **Step 1: Failing tests**

In `pipeline/tests/height.test.js` change the clamp test to:
```js
  it('clamps to 530 m (Willis antennas are 527 m)', () => {
    expect(resolveHeight({ osmHeight: '527' })).toBe(527)
    expect(resolveHeight({ osmHeight: '9000' })).toBe(530)
  })
```

Append to `pipeline/tests/extrude.test.js`:
```js
describe('extrudeBuilding taper', () => {
  const taper = { center: [5, -5], shaftTop: 100, topScale: 0.5 }
  it('scales the top ring about the center', () => {
    const m = extrudeBuilding({ outer: sq, top: 100, taper })
    const top = []
    for (let i = 0; i < m.positions.length; i += 3) if (m.positions[i + 1] === 100) top.push([m.positions[i], m.positions[i + 2]])
    const xs = top.map((p) => p[0])
    expect(Math.min(...xs)).toBeCloseTo(2.5); expect(Math.max(...xs)).toBeCloseTo(7.5)
  })
  it('tilted walls stay front-facing and lean inward (normal.y > 0)', () => {
    for (const f of faces(extrudeBuilding({ outer: sq, top: 100, taper }))) {
      expect(f.c[0] * f.n[0] + f.c[1] * f.n[1] + f.c[2] * f.n[2]).toBeGreaterThan(0)
      if (f.n[1] !== 1) expect(f.n[1]).toBeGreaterThan(0)
    }
  })
  it('a piece between base and top uses s(base) and s(top)', () => {
    const m = extrudeBuilding({ outer: sq, base: 50, top: 100, taper })
    const bottom = []
    for (let i = 0; i < m.positions.length; i += 3) if (m.positions[i + 1] === 50) bottom.push(m.positions[i])
    expect(Math.min(...bottom)).toBeCloseTo(5 - 5 * 0.75)
  })
})
```

`pipeline/tests/shapes.test.js`
```js
import { describe, it, expect } from 'vitest'
import { shapePieces, HERO_SHAPES } from '../lib/shapes.js'

const sq = (x, z, s) => [[x, z], [x + s, z], [x + s, z - s], [x, z - s]]
const bldg = (id, extra = {}) => ({
  id, area: 80 * 50, centroid: [40, -25], height: 0,
  polygons: [{ outer: sq(0, 0, 80), holes: [] }],
  parts: null, ...extra,
})

describe('shapePieces', () => {
  it('plain buildings: one piece per polygon at building height', () => {
    const p = shapePieces(bldg('1', { height: 30 }))
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({ base: 0, top: 30 })
    expect(p[0].taper).toBeUndefined()
  })
  it('keeps parts, skips zero-height footprint', () => {
    const p = shapePieces(bldg('1', { parts: [{ outer: sq(0, 0, 80), holes: [], base: 0, top: 200 }] }))
    expect(p).toHaveLength(1)
    expect(p[0].top).toBe(200)
  })
  it('Hancock: body tapers, antennas reseat on the shaft top and move inward', () => {
    expect(HERO_SHAPES['331204'].topScale).toBeCloseTo(0.62)
    const body = { outer: sq(0, 0, 80), holes: [], base: 0, top: 337 }
    const mast = { outer: sq(70, -5, 2), holes: [], base: 0, top: 457 } // near the east edge
    const p = shapePieces(bldg('331204', { parts: [body, mast] }))
    const b = p.find((x) => x.top === 337)
    const a = p.find((x) => x.top === 457)
    expect(b.taper).toMatchObject({ shaftTop: 337, topScale: 0.62 })
    expect(a.taper).toBeUndefined()
    expect(a.base).toBeCloseTo(337 * 0.98)
    const ax = a.outer.reduce((s, q) => s + q[0], 0) / a.outer.length
    expect(ax).toBeLessThan(71) // pulled toward center x=40
    expect(ax).toBeCloseTo(40 + (71 - 40) * 0.62, 0)
  })
})
```

- [ ] **Step 2: Run** `cd pipeline && npx vitest run` — Expected: FAIL (clamp 450 ≠ 530; taper not implemented; shapes.js missing).

- [ ] **Step 3: Implement**

`pipeline/lib/height.js`: `export const MAX_HEIGHT_M = 530`.

`pipeline/lib/extrude.js` — replace `pushWalls`, `pushRoof` and `extrudeBuilding` with:
```js
function scaler(taper) {
  if (!taper) return () => (p) => p
  const { center: [cx, cz], shaftTop, topScale } = taper
  return (y) => {
    const s = 1 - (1 - topScale) * Math.min(1, Math.max(0, y / shaftTop))
    return ([x, z]) => [cx + (x - cx) * s, cz + (z - cz) * s]
  }
}

function pushWalls(ring, base, top, at, out) {
  const lo = at(base), hi = at(top)
  let u = 0
  for (let i = 0; i < ring.length; i++) {
    const A = ring[i], B = ring[(i + 1) % ring.length]
    const len = Math.hypot(B[0] - A[0], B[1] - A[1])
    if (len < 1e-6) continue
    const [ax0, az0] = lo(A), [bx0, bz0] = lo(B), [ax1, az1] = hi(A), [bx1, bz1] = hi(B)
    const a0 = [ax0, base, az0], b0 = [bx0, base, bz0], a1 = [ax1, top, az1], b1 = [bx1, top, bz1]
    // normal from the real (possibly tilted) quad: (b0 - a0) x (a1 - a0)
    const ux = b0[0] - a0[0], uy = 0, uz = b0[2] - a0[2]
    const vx = a1[0] - a0[0], vy = top - base, vz = a1[2] - a0[2]
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const nl = Math.hypot(nx, ny, nz) || 1
    nx = nx / nl || 0; ny = ny / nl || 0; nz = nz / nl || 0 // `|| 0` avoids -0
    const uvA0 = [u, base], uvB0 = [u + len, base], uvA1 = [u, top], uvB1 = [u + len, top]
    for (const [p, t] of [[a0, uvA0], [b0, uvB0], [a1, uvA1], [b0, uvB0], [b1, uvB1], [a1, uvA1]]) {
      out.positions.push(...p); out.normals.push(nx, ny, nz); out.uvs.push(...t)
    }
    u += len
  }
}

function pushRoof(outer, holes, top, at, out) {
  const tr = at(top)
  const flat = [], holeIdx = []
  for (const p of outer) flat.push(...tr(p))
  for (const h of holes) { holeIdx.push(flat.length / 2); for (const p of h) flat.push(...tr(p)) }
  const tris = earcut(flat, holeIdx.length ? holeIdx : undefined, 2)
  for (let i = 0; i < tris.length; i += 3) {
    let [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]]
    const ax = flat[a * 2], az = flat[a * 2 + 1]
    const bx = flat[b * 2], bz = flat[b * 2 + 1]
    const cx = flat[c * 2], cz = flat[c * 2 + 1]
    if ((bz - az) * (cx - ax) - (bx - ax) * (cz - az) < 0) [b, c] = [c, b]
    for (const k of [a, b, c]) {
      const x = flat[k * 2], z = flat[k * 2 + 1]
      out.positions.push(x, top, z); out.normals.push(0, 1, 0); out.uvs.push(x, z)
    }
  }
}

export function extrudeBuilding({ outer, holes = [], base = 0, top, taper }) {
  const out = { positions: [], normals: [], uvs: [] }
  const at = scaler(taper)
  const o = ensureCCW(outer)
  const hs = holes.map(ensureCW)
  pushWalls(o, base, top, at, out)
  for (const h of hs) pushWalls(h, base, top, at, out)
  pushRoof(o, hs, top, at, out)
  return out
}
```

`pipeline/lib/shapes.js`
```js
// pipeline/lib/shapes.js — per-landmark geometry corrections before heroes exist.
import { signedArea, ringCentroid } from './geom.js'

export const HERO_SHAPES = {
  // 875 N Michigan: ~80 x 50 m at the base, ~50 x 31 m at the roof.
  '331204': { name: 'John Hancock Center', topScale: 0.62 },
}

const areaOf = (p) => Math.abs(signedArea(p.outer))

export function shapePieces(b) {
  const pieces = []
  if (b.height > 0) for (const p of b.polygons) pieces.push({ outer: p.outer, holes: p.holes, base: 0, top: b.height })
  for (const p of b.parts || []) if (p.top > p.base) pieces.push({ ...p })
  const shape = HERO_SHAPES[b.id]
  if (!shape) return pieces

  const isAntenna = (p) => areaOf(p) < 0.03 * b.area
  const body = pieces.filter((p) => !isAntenna(p))
  if (!body.length) return pieces
  const shaftTop = Math.max(...body.map((p) => p.top))
  const center = b.centroid
  const taper = { center, shaftTop, topScale: shape.topScale }
  return pieces.map((p) => {
    if (!isAntenna(p) || p.top <= shaftTop) return { ...p, taper }
    const [px, pz] = ringCentroid(p.outer)
    const dx = (center[0] - px) * (1 - shape.topScale), dz = (center[1] - pz) * (1 - shape.topScale)
    const move = (r) => r.map(([x, z]) => [x + dx, z + dz])
    return { outer: move(p.outer), holes: p.holes.map(move), base: shaftTop * 0.98, top: p.top }
  })
}
```

`pipeline/build/build-world.js` — import `shapePieces` from `../lib/shapes.js` and replace the three lines that build `pieces` inside the tile loop with `const pieces = shapePieces(b)`.

- [ ] **Step 4: Run** `npx vitest run` (pipeline) — Expected: all pass (the Phase 1 "south wall faces +Z" test must still pass with the new normal math).
- [ ] **Step 5: Rebuild** `npm run build:world` then view `?view=loop&time=day` and a new check pose near Hancock (`/?view=hancock`, bookmark added in Task 9 — for now fly there). Expected: Willis antennas clearly taller than Trump's spire; Hancock visibly tapered with masts on its roof.
- [ ] **Step 6: Commit + push** `feat(pipeline): Willis antennas to 527 m, tapered Hancock`

---

### Task 2: Generated texture sets

**Files:**
- Create: `pipeline/textures/prompts.md`, `pipeline/textures/raw/*.webp`, `pipeline/textures/textures.config.json`, `pipeline/textures/seamless.js`, `pipeline/textures/process.js`, `pipeline/tests/seamless.test.js`
- Generated: `app/public/textures/facades/{family}.jpg`, `{family}-win.png`, `facades.json`; `app/public/textures/ground/{grass,asphalt,sidewalk,concrete,gravel,sand}.jpg`
- Modify: `pipeline/package.json` (script `textures`), root `package.json` (script `textures`)

**Interfaces:**
- Produces: `makeSeamless(data: Uint8Array, w, h, ch, border) → Uint8Array`; `windowMaskFromLuma(luma: Uint8Array, lo, hi) → Uint8Array` (dark → 255).
- Produces `app/public/textures/facades/facades.json`:
  `[{ "family": "loop-limestone", "index": 0, "albedo": "facades/loop-limestone.jpg", "win": "facades/loop-limestone-win.png", "tileW": 18.0, "tileH": 15.2, "bays": 4, "floors": 4 }, …]` in family index order.

- [ ] **Step 1: Failing test** `pipeline/tests/seamless.test.js`
```js
import { describe, it, expect } from 'vitest'
import { makeSeamless, windowMaskFromLuma } from '../textures/seamless.js'

function gradient(w, h) {
  const d = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[y * w + x] = Math.round((x / (w - 1)) * 200)
  return d
}

describe('makeSeamless', () => {
  it('wraps horizontally without a seam', () => {
    const w = 64, h = 16
    const out = makeSeamless(gradient(w, h), w, h, 1, 16)
    for (let y = 0; y < h; y++) expect(Math.abs(out[y * w] - out[y * w + w - 1])).toBeLessThan(12)
  })
  it('leaves the center untouched', () => {
    const w = 64, h = 64, src = gradient(w, h)
    const out = makeSeamless(src, w, h, 1, 8)
    expect(out[32 * w + 32]).toBe(src[32 * w + 32])
  })
})

describe('windowMaskFromLuma', () => {
  it('dark pixels become window (255), bright become wall (0), smooth between', () => {
    const m = windowMaskFromLuma(new Uint8Array([10, 70, 90, 200]), 60, 100)
    expect(m[0]).toBe(255); expect(m[3]).toBe(0)
    expect(m[1]).toBeGreaterThan(m[2])
  })
})
```

- [ ] **Step 2: Run** — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `pipeline/textures/seamless.js`**
```js
// pipeline/textures/seamless.js — tileable textures + window masks.
const smooth = (t) => t * t * (3 - 2 * t)

export function makeSeamless(data, w, h, ch, border) {
  const out = new Uint8Array(data.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x), ey = Math.min(y, h - 1 - y)
      const m = smooth(Math.max(0, 1 - Math.min(ex, ey) / border))
      const sx = (x + (w >> 1)) % w, sy = (y + (h >> 1)) % h
      for (let c = 0; c < ch; c++) {
        const a = data[(y * w + x) * ch + c], b = data[(sy * w + sx) * ch + c]
        out[(y * w + x) * ch + c] = Math.round(a + (b - a) * m)
      }
    }
  }
  return out
}

export function windowMaskFromLuma(luma, lo, hi) {
  const out = new Uint8Array(luma.length)
  for (let i = 0; i < luma.length; i++) {
    const t = Math.min(1, Math.max(0, (hi - luma[i]) / (hi - lo)))
    out[i] = Math.round(smooth(t) * 255)
  }
  return out
}
```
Run the test — Expected: pass.

- [ ] **Step 4: Generate the images.** For each prompt below call the image tool with `resolution: "1024x1024 ( 1:1 )"`, `random_seed: false`, `seed: 42` (try seeds 7, 1234 if a result has perspective, people, sky or text), then download the returned Image URL to `pipeline/textures/raw/<name>.webp` with `curl -L -o`. Save every prompt verbatim with its seed in `pipeline/textures/prompts.md`.

Shared façade suffix (append to each façade prompt): `perfectly straight-on orthographic elevation, no perspective, evenly lit overcast daylight, seamless tileable texture, photographic, no sky, no street, no people, no text`.

| name | prompt (prefix) |
|---|---|
| loop-limestone | `Chicago prewar limestone office tower facade, repeating grid of identical rectangular windows 4 columns by 4 floors, beige Indiana limestone piers and spandrels, dark glass windows with thin mullions,` |
| art-deco | `Chicago 1930 art deco skyscraper facade, pale limestone with strong vertical piers and recessed dark spandrels, repeating grid of tall narrow windows 4 columns by 4 floors,` |
| prewar-brick | `Chicago 1910s red-brown brick commercial building facade, repeating grid of double-hung windows with stone sills and lintels, 4 columns by 4 floors,` |
| curtain-glass | `modern Chicago skyscraper curtain wall, blue-grey reflective glass panels with thin dark aluminium mullions, regular grid 6 columns by 4 floors,` |
| precast-concrete | `1970s precast concrete office building facade, light grey concrete panels with deep-set dark windows, repeating grid 4 columns by 4 floors,` |
| river-north-loft | `River North Chicago brick warehouse loft facade, dark red brick with arched windows, black steel window frames, repeating grid 4 columns by 3 floors,` |
| three-flat-brick | `Chicago greystone and brick three-flat residential facade, tan brick with limestone trim, repeating grid of paired windows 3 columns by 3 floors,` |
| industrial | `Chicago industrial building facade, weathered tan brick with large multi-pane steel factory windows, repeating grid 4 columns by 2 floors,` |

Ground (suffix: `top-down orthographic, evenly lit, seamless tileable texture, photographic, no objects, no shadows, no text`):

| name | prompt (prefix) |
|---|---|
| grass | `lush mown park lawn grass, subtle variation, Chicago Grant Park,` |
| asphalt | `dark grey city street asphalt, fine aggregate, subtle cracks and tar patches,` |
| sidewalk | `light grey concrete sidewalk slabs, square expansion joints every 1.5 metres,` |
| concrete | `pale weathered concrete plaza and parking lot surface,` |
| gravel | `flat commercial rooftop, light grey gravel ballast and tar membrane,` |
| sand | `fine pale beach sand, Lake Michigan beach,` |

- [ ] **Step 5: Measure each façade and write `pipeline/textures/textures.config.json`.** Open each raw façade image (Read tool) and pick a crop rectangle whose edges fall on the repeat period — whole window bays horizontally and whole floors vertically (e.g. from one pier's left edge to the same edge N bays later). Record:
```json
{
  "facades": {
    "loop-limestone": { "raw": "loop-limestone.webp", "crop": [52, 30, 810, 850], "bays": 4, "floors": 4, "bayWidthM": 4.5, "lo": 70, "hi": 120, "allGlass": false },
    "curtain-glass":  { "raw": "curtain-glass.webp",  "crop": [0, 0, 1024, 1024], "bays": 6, "floors": 4, "bayWidthM": 3.0, "lo": 0, "hi": 1, "allGlass": true }
  },
  "ground": { "grass": { "raw": "grass.webp", "sizeM": 16 }, "asphalt": { "raw": "asphalt.webp", "sizeM": 12 }, "sidewalk": { "raw": "sidewalk.webp", "sizeM": 6 }, "concrete": { "raw": "concrete.webp", "sizeM": 20 }, "gravel": { "raw": "gravel.webp", "sizeM": 12 }, "sand": { "raw": "sand.webp", "sizeM": 10 } }
}
```
(all 8 façade families required; values above are the shape — the real numbers come from measuring the generated images. `lo`/`hi` are grey levels where windows vs. wall separate; check by viewing the produced `-win.png`.)

- [ ] **Step 6: Implement `pipeline/textures/process.js`**
```js
// pipeline/textures/process.js — raw generated images → app textures.
import sharp from 'sharp'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeSeamless, windowMaskFromLuma } from './seamless.js'
import { FACADE_FAMILIES } from '../lib/classify.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const RAW = join(HERE, 'raw')
const OUT = join(HERE, '..', '..', 'app', 'public', 'textures')
const FLOOR_M = 3.8
const SIZE = 1024
const cfg = JSON.parse(readFileSync(join(HERE, 'textures.config.json'), 'utf8'))
mkdirSync(join(OUT, 'facades'), { recursive: true })
mkdirSync(join(OUT, 'ground'), { recursive: true })

const facades = []
for (const [index, family] of FACADE_FAMILIES.entries()) {
  const c = cfg.facades[family]
  if (!c) throw new Error(`textures.config.json missing façade ${family}`)
  const [left, top, width, height] = c.crop
  const base = sharp(join(RAW, c.raw)).extract({ left, top, width, height }).resize(SIZE, SIZE, { fit: 'fill' })
  const { data } = await base.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const rgb = makeSeamless(data, SIZE, SIZE, 3, 24)
  await sharp(Buffer.from(rgb), { raw: { width: SIZE, height: SIZE, channels: 3 } }).jpeg({ quality: 88 }).toFile(join(OUT, 'facades', `${family}.jpg`))
  let mask
  if (c.allGlass) mask = new Uint8Array(SIZE * SIZE).fill(215)
  else {
    const { data: luma } = await base.clone().greyscale().blur(1.2).raw().toBuffer({ resolveWithObject: true })
    mask = windowMaskFromLuma(luma, c.lo, c.hi)
  }
  await sharp(Buffer.from(makeSeamless(mask, SIZE, SIZE, 1, 24)), { raw: { width: SIZE, height: SIZE, channels: 1 } }).png().toFile(join(OUT, 'facades', `${family}-win.png`))
  facades.push({ family, index, albedo: `facades/${family}.jpg`, win: `facades/${family}-win.png`,
    tileW: c.bays * c.bayWidthM, tileH: c.floors * FLOOR_M, bays: c.bays, floors: c.floors })
  console.log(`  ✓ ${family}`)
}
writeFileSync(join(OUT, 'facades', 'facades.json'), JSON.stringify(facades, null, 2))

const ground = {}
for (const [name, c] of Object.entries(cfg.ground)) {
  const { data } = await sharp(join(RAW, c.raw)).resize(SIZE, SIZE, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  await sharp(Buffer.from(makeSeamless(data, SIZE, SIZE, 3, 64)), { raw: { width: SIZE, height: SIZE, channels: 3 } }).jpeg({ quality: 85 }).toFile(join(OUT, 'ground', `${name}.jpg`))
  ground[name] = { file: `ground/${name}.jpg`, sizeM: c.sizeM }
  console.log(`  ✓ ${name}`)
}
writeFileSync(join(OUT, 'ground', 'ground.json'), JSON.stringify(ground, null, 2))
```
`cd pipeline && npm i sharp@0.35`; add script `"textures": "node textures/process.js"` to `pipeline/package.json` and `"textures": "npm run textures --prefix pipeline"` to the root.

- [ ] **Step 7: Run** `npm run textures`. Expected: 14 `✓` lines. **View every output** (albedo + mask): windows must read as windows in the mask (white), walls black; the albedo must tile — check by making a 2×2 preview: `node -e "require('sharp')('app/public/textures/facades/loop-limestone.jpg').resize(512,512).toBuffer().then(b=>require('sharp')({create:{width:1024,height:1024,channels:3,background:'#000'}}).composite([{input:b,top:0,left:0},{input:b,top:0,left:512},{input:b,top:512,left:0},{input:b,top:512,left:512}]).png().toFile('/tmp/tile.png'))"` (run from `pipeline/`; save into the scratchpad instead of /tmp) and Read it. Re-crop (Step 5) until seams are invisible.
- [ ] **Step 8: Commit + push** `feat(textures): generated façade + ground texture sets`

---

### Task 3: Façade shader — textures, glass, lit windows

**Files:**
- Create: `app/src/world/materials/textureArray.js`, `app/src/world/materials/facadeMaterial.js`, `app/src/world/materials/__tests__/textureArray.test.js`, `app/src/world/materials/__tests__/facadeMaterial.test.js`
- Modify: `app/src/world/City.jsx`

**Interfaces:**
- Consumes: `facades.json` (Task 2), tile attributes `_facade`, `_seed` (Phase 1; three lowercases custom glTF attributes), `uv` = world metres (Phase 1).
- Produces: `packLayers(layers: Uint8ClampedArray[], size) → Uint8Array` (RGBA, flips rows so v=0 is the bottom); `loadLayerArray(urls, size, { srgb }) → Promise<THREE.DataArrayTexture>` (a failed image becomes a mid-grey layer, never rejects).
- Produces: `facadeUniforms` (shared object: `uAlbedo, uWin, uRoof, uTile (Vector4[8]: tileW, tileH, bays, floors), uNight (0–1), uLitBoost`); `patchFacadeShader(shader) → shader` (throws if a required three.js chunk marker is missing); `createFacadeMaterial() → THREE.MeshStandardMaterial`; `loadFacadeTextures() → Promise<void>` fills `facadeUniforms`.

- [ ] **Step 1: Failing tests**

`app/src/world/materials/__tests__/textureArray.test.js`
```js
import { describe, it, expect } from 'vitest'
import { packLayers } from '../textureArray.js'

describe('packLayers', () => {
  it('packs N layers of size² RGBA and flips rows (v=0 at the bottom)', () => {
    const size = 2
    // layer 0: top row red, bottom row blue
    const l0 = new Uint8ClampedArray([255,0,0,255, 255,0,0,255, 0,0,255,255, 0,0,255,255])
    const out = packLayers([l0, l0], size)
    expect(out).toHaveLength(2 * size * size * 4)
    expect([...out.slice(0, 4)]).toEqual([0, 0, 255, 255]) // first stored row = bottom (blue)
    expect([...out.slice(16, 20)]).toEqual([0, 0, 255, 255]) // layer 1 starts after layer 0
  })
})
```

`app/src/world/materials/__tests__/facadeMaterial.test.js`
```js
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { patchFacadeShader, facadeUniforms } from '../facadeMaterial.js'

const std = () => ({
  vertexShader: THREE.ShaderLib.standard.vertexShader,
  fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  uniforms: {},
})

describe('patchFacadeShader', () => {
  it('injects attributes, varyings and uniforms into the standard shader', () => {
    const s = patchFacadeShader(std())
    expect(s.vertexShader).toContain('attribute float _facade;')
    expect(s.vertexShader).toContain('vFacade = _facade;')
    expect(s.fragmentShader).toContain('uniform sampler2DArray uAlbedo;')
    expect(s.fragmentShader).toContain('totalEmissiveRadiance +=')
    expect(s.uniforms.uNight).toBe(facadeUniforms.uNight)
  })
  it('fails loudly when three.js changes a chunk name', () => {
    const broken = std(); broken.fragmentShader = broken.fragmentShader.replace('#include <emissivemap_fragment>', '')
    expect(() => patchFacadeShader(broken)).toThrow(/emissivemap_fragment/)
  })
  it('has one tile descriptor per façade family', () => {
    expect(facadeUniforms.uTile.value).toHaveLength(8)
  })
})
```

- [ ] **Step 2: Run** `cd app && npx vitest run src/world` — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `textureArray.js`**
```js
// app/src/world/materials/textureArray.js — N images → one DataArrayTexture.
import * as THREE from 'three'

export function packLayers(layers, size) {
  const row = size * 4
  const out = new Uint8Array(layers.length * size * row)
  layers.forEach((px, l) => {
    const base = l * size * row
    for (let y = 0; y < size; y++) out.set(px.subarray((size - 1 - y) * row, (size - y) * row), base + y * row)
  })
  return out
}

function loadImagePixels(url, size) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const grey = () => resolve(new Uint8ClampedArray(size * size * 4).fill(128))
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = size
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, size, size)
      resolve(g.getImageData(0, 0, size, size).data)
    }
    img.onerror = () => { console.warn(`texture failed: ${url}`); grey() }
    img.src = url
  })
}

export async function loadLayerArray(urls, size, { srgb = true } = {}) {
  const layers = await Promise.all(urls.map((u) => loadImagePixels(u, size)))
  const tex = new THREE.DataArrayTexture(packLayers(layers, size), size, size, layers.length)
  tex.format = THREE.RGBAFormat
  tex.type = THREE.UnsignedByteType
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 8
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}
```

- [ ] **Step 4: Implement `facadeMaterial.js`**
```js
// app/src/world/materials/facadeMaterial.js — one shader for every building.
import * as THREE from 'three'
import { loadLayerArray } from './textureArray.js'

export const facadeUniforms = {
  uAlbedo: { value: null },
  uWin: { value: null },
  uRoof: { value: null },
  uTile: { value: Array.from({ length: 8 }, () => new THREE.Vector4(18, 15.2, 4, 4)) },
  uNight: { value: 0 },
  uLitBoost: { value: 1 },
  uReady: { value: 0 },
}

const need = (src, marker) => {
  if (!src.includes(marker)) throw new Error(`facade shader: missing ${marker}`)
  return marker
}

const VERT_HEAD = /* glsl */ `
attribute float _facade;
attribute float _seed;
varying float vFacade;
varying float vSeed;
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec2 vMUv;
`
const VERT_BODY = /* glsl */ `
vFacade = _facade;
vSeed = _seed;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNormal = normalize(mat3(modelMatrix) * objectNormal);
vMUv = uv;
`
const FRAG_HEAD = /* glsl */ `
uniform sampler2DArray uAlbedo;
uniform sampler2DArray uWin;
uniform sampler2D uRoof;
uniform vec4 uTile[8];
uniform float uNight;
uniform float uLitBoost;
uniform float uReady;
varying float vFacade;
varying float vSeed;
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec2 vMUv;
float owHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`
const FRAG_MAP = /* glsl */ `
int fi = int(vFacade + 0.5);
vec4 T = uTile[fi];
bool isRoof = vWNormal.y > 0.6;
vec2 tuv = vMUv / T.xy;
vec2 gx = dFdx(tuv), gy = dFdy(tuv);
vec3 st = vec3(fract(tuv.x), 1.0 - fract(tuv.y), float(fi));
vec3 wallAlb = textureGrad(uAlbedo, st, gx, gy).rgb;
float win = textureGrad(uWin, st, gx, gy).r;
vec3 roofAlb = texture(uRoof, vWPos.xz / 12.0).rgb * 0.85;
vec3 alb = isRoof ? roofAlb : wallAlb;
win = isRoof ? 0.0 : win;
alb = mix(vec3(0.62, 0.6, 0.57), alb, uReady);
win *= uReady;
alb *= mix(0.55, 1.0, smoothstep(0.0, 14.0, vWPos.y));   // ground contact
alb *= 0.88 + 0.24 * vSeed;                              // per-building variation
diffuseColor.rgb *= alb;
`
const FRAG_ROUGH = /* glsl */ `
roughnessFactor = mix(roughnessFactor, 0.06, win * 0.95);
`
const FRAG_METAL = /* glsl */ `
metalnessFactor = mix(metalnessFactor, 0.9, win * 0.85);
`
const FRAG_EMISSIVE = /* glsl */ `
if (!isRoof && uNight > 0.001) {
  vec2 cell = floor(tuv * T.zw);
  float h = owHash(cell + vec2(vSeed * 173.0, vSeed * 91.0));
  float lit = step(h, 0.16 + 0.42 * uNight);
  vec3 warm = vec3(1.0, 0.70, 0.40), cool = vec3(0.72, 0.84, 1.0);
  vec3 wc = mix(warm, cool, step(0.72, owHash(cell.yx + vSeed * 7.0)));
  float flicker = 0.7 + 0.6 * owHash(cell * 1.7 + 3.1);
  totalEmissiveRadiance += wc * win * lit * uNight * flicker * 2.2 * uLitBoost;
}
`

export function patchFacadeShader(shader) {
  let v = shader.vertexShader, f = shader.fragmentShader
  v = v.replace(need(v, '#include <common>'), `#include <common>\n${VERT_HEAD}`)
  v = v.replace(need(v, '#include <worldpos_vertex>'), `#include <worldpos_vertex>\n${VERT_BODY}`)
  f = f.replace(need(f, '#include <common>'), `#include <common>\n${FRAG_HEAD}`)
  f = f.replace(need(f, '#include <map_fragment>'), `#include <map_fragment>\n${FRAG_MAP}`)
  f = f.replace(need(f, '#include <roughnessmap_fragment>'), `#include <roughnessmap_fragment>\n${FRAG_ROUGH}`)
  f = f.replace(need(f, '#include <metalnessmap_fragment>'), `#include <metalnessmap_fragment>\n${FRAG_METAL}`)
  f = f.replace(need(f, '#include <emissivemap_fragment>'), `#include <emissivemap_fragment>\n${FRAG_EMISSIVE}`)
  shader.vertexShader = v
  shader.fragmentShader = f
  Object.assign(shader.uniforms, facadeUniforms)
  return shader
}

export function createFacadeMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.86, metalness: 0.02 })
  m.onBeforeCompile = patchFacadeShader
  m.customProgramCacheKey = () => 'facade-v1'
  return m
}

export async function loadFacadeTextures() {
  const res = await fetch('/textures/facades/facades.json').catch(() => null)
  const list = res && res.ok ? await res.json() : null
  if (!list) { console.warn('facades.json missing — flat façades'); return }
  const size = 1024
  const [alb, win] = await Promise.all([
    loadLayerArray(list.map((f) => `/textures/${f.albedo}`), size),
    loadLayerArray(list.map((f) => `/textures/${f.win}`), size, { srgb: false }),
  ])
  const roof = await new THREE.TextureLoader().loadAsync('/textures/ground/gravel.jpg').catch(() => null)
  if (roof) { roof.wrapS = roof.wrapT = THREE.RepeatWrapping; roof.colorSpace = THREE.SRGBColorSpace; roof.anisotropy = 8 }
  facadeUniforms.uAlbedo.value = alb
  facadeUniforms.uWin.value = win
  facadeUniforms.uRoof.value = roof ?? new THREE.DataTexture(new Uint8Array([150, 150, 150, 255]), 1, 1)
  list.forEach((f) => facadeUniforms.uTile.value[f.index].set(f.tileW, f.tileH, f.bays, f.floors))
  facadeUniforms.uReady.value = 1
}
```
Note: the sampler uniforms must hold a valid texture before first render; initialise `uAlbedo`/`uWin` with a 1×1×8 `DataArrayTexture` of grey and `uRoof` with a 1×1 `DataTexture` at module load (add this below `facadeUniforms`):
```js
const greyArray = () => { const t = new THREE.DataArrayTexture(new Uint8Array(4 * 8).fill(150), 1, 1, 8); t.needsUpdate = true; return t }
facadeUniforms.uAlbedo.value = greyArray()
facadeUniforms.uWin.value = greyArray()
facadeUniforms.uRoof.value = (() => { const t = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255]), 1, 1); t.needsUpdate = true; return t })()
```

- [ ] **Step 5: Run** tests — Expected: pass.

- [ ] **Step 6: Use it in `City.jsx`**: replace `buildingMaterial` with `export const buildingMaterial = createFacadeMaterial()`; in `City` add `useEffect(() => { loadFacadeTextures() }, [])`. The tile vertex colors are no longer used (material has `vertexColors: false`).

- [ ] **Step 7: Visual check** (dev server, Playwright MCP, take two screenshots per view — the first after navigation can be blank): `?view=loop&time=day` — limestone Loop, glass towers reflecting sky, brick in River North; `?view=streeterville&time=night` — lit windows (warm/cool mix, ~20–60% lit), no stripes/seams on walls, no shimmering moiré at distance (if moiré: raise anisotropy or bias `textureGrad` by multiplying gradients by 1.5). Compare against real Chicago photos mentally: Loop masonry should read warm grey-beige, not orange.
- [ ] **Step 8: Commit + push** `feat(app): façade shader — textures, glass, lit windows`

---

### Task 4: Living sky — real time, smooth presets, night stars, sky reflections

**Files:**
- Create: `app/src/lib/skyPalette.js`, `app/src/lib/sunTween.js`, tests for both
- Rewrite: `app/src/world/SkyRig.jsx`; Modify: `app/src/world/Scene.jsx`, `app/src/world/Lake.jsx`, `app/src/hud/ControlPills.jsx`

**Interfaces:**
- Produces `paletteFor(elevDeg) → { fog: THREE.Color, skyTint: THREE.Color, hemiSky: THREE.Color, hemiGround: THREE.Color, hemiIntensity, sunColor: THREE.Color, sunIntensity, night (0–1), stars (0–1), exposure, water: THREE.Color }` — piecewise-linear between keyframes at elevations `[-18, -8, -2, 3, 10, 25, 60]`.
- Produces `stepSun(current: [x,y,z], target: [x,y,z], dt, tau = 0.8) → [x,y,z]` unit vector, exponential approach (2.5 s ≈ 3 τ).
- `SkyRig` props: `{ target: sunState }` where `sunState = sunForPreset(...)`; it owns all per-frame lighting: sky uniforms, sun light, hemisphere, fog, background, `facadeUniforms.uNight`, stars, and exposes the smoothed sun direction via `sunRef` for the lake.
- The LIVE pill label shows the real Chicago time's phase (`LIVE · DUSK`) using `phaseFor(elevDeg)` exported from `skyPalette.js` (`'NIGHT' | 'DAWN' | 'DAY' | 'DUSK'`, dawn vs dusk by azimuth east/west).

- [ ] **Step 1: Failing tests**

`app/src/lib/__tests__/skyPalette.test.js`
```js
import { describe, it, expect } from 'vitest'
import { paletteFor, phaseFor } from '../skyPalette.js'

describe('paletteFor', () => {
  it('is fully night at -18° and fully day at 60°', () => {
    expect(paletteFor(-18).night).toBe(1); expect(paletteFor(-18).stars).toBe(1)
    expect(paletteFor(60).night).toBe(0); expect(paletteFor(60).stars).toBe(0)
  })
  it('never returns NaN or negative values across -90..90', () => {
    for (let e = -90; e <= 90; e += 0.5) {
      const p = paletteFor(e)
      for (const k of ['hemiIntensity', 'sunIntensity', 'night', 'stars', 'exposure']) {
        expect(Number.isFinite(p[k])).toBe(true); expect(p[k]).toBeGreaterThanOrEqual(0)
      }
      expect(Number.isFinite(p.fog.r + p.fog.g + p.fog.b)).toBe(true)
    }
  })
  it('sun light is warm near the horizon and white at noon', () => {
    const low = paletteFor(3).sunColor, high = paletteFor(60).sunColor
    expect(low.r - low.b).toBeGreaterThan(high.r - high.b)
  })
  it('night gets darker monotonically below the horizon', () => {
    expect(paletteFor(-10).hemiIntensity).toBeLessThanOrEqual(paletteFor(-2).hemiIntensity)
  })
})

describe('phaseFor', () => {
  it('names the phase from elevation and east/west', () => {
    expect(phaseFor(-15, 0)).toBe('NIGHT')
    expect(phaseFor(4, 1)).toBe('DAWN')   // sun in the east (+x)
    expect(phaseFor(4, -1)).toBe('DUSK')  // sun in the west
    expect(phaseFor(40, 1)).toBe('DAY')
  })
})
```

`app/src/lib/__tests__/sunTween.test.js`
```js
import { describe, it, expect } from 'vitest'
import { stepSun } from '../sunTween.js'

const len = (v) => Math.hypot(...v)
describe('stepSun', () => {
  it('stays unit length and moves toward the target', () => {
    const a = [1, 0, 0], b = [0, 1, 0]
    const s = stepSun(a, b, 0.1)
    expect(len(s)).toBeCloseTo(1)
    expect(s[1]).toBeGreaterThan(0)
  })
  it('converges within 2.5 s (small steps are continuous)', () => {
    let s = [1, 0, 0]
    let maxJump = 0
    for (let i = 0; i < 150; i++) {
      const n = stepSun(s, [0, 1, 0], 1 / 60)
      maxJump = Math.max(maxJump, Math.hypot(n[0] - s[0], n[1] - s[1], n[2] - s[2]))
      s = n
    }
    expect(s[1]).toBeGreaterThan(0.95)
    expect(maxJump).toBeLessThan(0.05)
  })
  it('handles opposite vectors without NaN', () => {
    const s = stepSun([1, 0, 0], [-1, 0, 0], 0.1)
    expect(s.every(Number.isFinite)).toBe(true)
  })
})
```

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement**

`app/src/lib/sunTween.js`
```js
// app/src/lib/sunTween.js — smooth sun direction changes (presets tween ~2.5 s).
export function stepSun(cur, tgt, dt, tau = 0.8) {
  const k = 1 - Math.exp(-dt / tau)
  let x = cur[0] + (tgt[0] - cur[0]) * k
  let y = cur[1] + (tgt[1] - cur[1]) * k
  let z = cur[2] + (tgt[2] - cur[2]) * k
  let l = Math.hypot(x, y, z)
  if (l < 1e-4) { x = cur[0] * 0.7 + 0.3 * -cur[2]; y = cur[1] + 0.3; z = cur[2] * 0.7 + 0.3 * cur[0]; l = Math.hypot(x, y, z) }
  return [x / l, y / l, z / l]
}
```

`app/src/lib/skyPalette.js`
```js
// app/src/lib/skyPalette.js — every lighting value as a function of sun elevation.
import * as THREE from 'three'

const C = (h) => new THREE.Color(h)
// elev, fog, hemiSky, hemiGround, hemiI, sunColor, sunI, night, stars, exposure, water
const KEYS = [
  [-18, C('#04070e'), C('#0b1426'), C('#05070b'), 0.18, C('#8fa6d6'), 0.00, 1.0, 1.0, 1.05, C('#050d16')],
  [-8,  C('#0b1224'), C('#1a2544'), C('#0a0b10'), 0.26, C('#8fa6d6'), 0.00, 0.9, 0.7, 1.00, C('#081624')],
  [-2,  C('#3a3450'), C('#5a5f8c'), C('#1d1a1c'), 0.45, C('#ff8a5c'), 0.15, 0.55, 0.15, 0.95, C('#132437')],
  [3,   C('#e0a27c'), C('#8fa4cc'), C('#3a302a'), 0.80, C('#ff9a5a'), 1.40, 0.15, 0.0, 0.95, C('#1d3a4d')],
  [10,  C('#d8c2ae'), C('#a9c1e0'), C('#4a4238'), 0.95, C('#ffd2a0'), 2.40, 0.0, 0.0, 0.92, C('#1f4a5c')],
  [25,  C('#bccbd8'), C('#c3d7ee'), C('#58524a'), 1.05, C('#fff0dc'), 3.00, 0.0, 0.0, 0.90, C('#21536a')],
  [60,  C('#b4c6d6'), C('#cfe1f5'), C('#5e5850'), 1.10, C('#fff7ee'), 3.30, 0.0, 0.0, 0.88, C('#22586f')],
]

export function paletteFor(elev) {
  const e = Math.min(60, Math.max(-18, Number.isFinite(elev) ? elev : -18))
  let i = 0
  while (i < KEYS.length - 2 && e > KEYS[i + 1][0]) i++
  const a = KEYS[i], b = KEYS[i + 1]
  const t = (e - a[0]) / (b[0] - a[0])
  const col = (k) => a[k].clone().lerp(b[k], t)
  const num = (k) => a[k] + (b[k] - a[k]) * t
  return {
    fog: col(1), skyTint: col(2), hemiSky: col(2), hemiGround: col(3), hemiIntensity: num(4),
    sunColor: col(5), sunIntensity: num(6), night: num(7), stars: num(8), exposure: num(9), water: col(10),
  }
}

export function phaseFor(elevDeg, dirX) {
  if (elevDeg < -6) return 'NIGHT'
  if (elevDeg < 12) return dirX >= 0 ? 'DAWN' : 'DUSK'
  return 'DAY'
}
```

`app/src/world/SkyRig.jsx` (rewrite)
```jsx
// app/src/world/SkyRig.jsx — the living sky: tweened sun, palette-driven light, stars, sky reflections.
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Sky, Stars, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { paletteFor } from '../lib/skyPalette.js'
import { stepSun } from '../lib/sunTween.js'
import { facadeUniforms } from './materials/facadeMaterial.js'

const DIST = 5000

export default function SkyRig({ target, sunRef, instant = false }) {
  const { scene, gl } = useThree()
  const sky = useRef(), light = useRef(), hemi = useRef(), stars = useRef()
  const cur = useRef(target.direction.slice())
  if (!sunRef.current) sunRef.current = cur.current
  const envSun = useMemo(() => target.direction.map((v) => v * DIST), [target])

  useFrame(({ camera }, dt) => {
    cur.current = instant ? target.direction.slice() : stepSun(cur.current, target.direction, Math.min(dt, 0.1))
    sunRef.current = cur.current
    const [x, y, z] = cur.current
    const elev = (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI
    const p = paletteFor(elev)
    sky.current?.material.uniforms.sunPosition.value.set(x * DIST, y * DIST, z * DIST)
    if (light.current) {
      light.current.position.set(x * DIST, Math.max(y, 0.02) * DIST, z * DIST)
      light.current.color.copy(p.sunColor)
      light.current.intensity = p.sunIntensity
    }
    if (hemi.current) { hemi.current.color.copy(p.hemiSky); hemi.current.groundColor.copy(p.hemiGround); hemi.current.intensity = p.hemiIntensity }
    if (scene.fog) scene.fog.color.copy(p.fog)
    gl.toneMappingExposure = p.exposure
    facadeUniforms.uNight.value = p.night
    if (stars.current) { stars.current.position.copy(camera.position); stars.current.material.opacity = p.stars; stars.current.visible = p.stars > 0.01 }
    if (sky.current) sky.current.visible = p.night < 0.98
  })

  return (
    <>
      <Sky ref={sky} sunPosition={envSun} turbidity={5.5} rayleigh={1.4} mieCoefficient={0.005} mieDirectionalG={0.86} distance={45000} />
      <Stars ref={stars} radius={20000} depth={2000} count={6000} factor={120} saturation={0} fade speed={0.3} />
      <fog attach="fog" args={['#b4c6d6', 1200, 11000]} />
      <color attach="background" args={['#04070e']} />
      <hemisphereLight ref={hemi} args={['#cfe1f5', '#5e5850', 1]} />
      <directionalLight
        ref={light}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
        shadow-camera-left={-2400}
        shadow-camera-right={2400}
        shadow-camera-top={2400}
        shadow-camera-bottom={-2400}
        shadow-camera-near={100}
        shadow-camera-far={12000}
      />
      {/* Sky-lit reflections for glass + river; re-captured when the preset target changes */}
      <Environment key={envSun.join(',')} frames={1} resolution={128} background={false}>
        <Sky sunPosition={envSun} turbidity={5.5} rayleigh={1.4} mieCoefficient={0.005} mieDirectionalG={0.86} />
        <mesh scale={100}><sphereGeometry args={[1, 16, 8]} /><meshBasicMaterial color={paletteFor(target.altitude * 57.2958).fog} side={THREE.BackSide} transparent opacity={target.altitude < 0 ? 0.92 : 0} /></mesh>
      </Environment>
    </>
  )
}
```
(Stars material: drei's `Stars` uses a ShaderMaterial; set `transparent` via `stars.current.material.transparent = true` once on mount — do it in a `useEffect`.)

`Scene.jsx`: hold `const sunRef = useRef(null)`; pass `<SkyRig target={sun} sunRef={sunRef} instant={reducedMotion} />` where `reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches`; pass `sunRef` to `<Lake sunRef={sunRef} />`.

`Lake.jsx`: read `sunRef.current` each frame for `sunDirection`, and set `waterColor` from `paletteFor(elev).water` so the lake goes navy at night and teal at noon.

`ControlPills.jsx`: the LIVE pill text becomes `LIVE · ${phase}` where `phase = phaseFor(elevDeg, direction[0])` of the live sun (compute with `sunForPreset('LIVE', new Date())` on a 60 s interval).

- [ ] **Step 4: Run** tests — Expected: pass (update the Hud test's `getByRole('button', { name: 'DUSK' })` usages still match — the LIVE pill name changes but DUSK does not).
- [ ] **Step 5: Visual check**: load with no `?time` — sky matches the real current Chicago time; click DAWN → DAY → DUSK → NIGHT and watch the 2.5 s transitions (screenshot mid-transition once); NIGHT shows stars, navy fog, lit windows; DAY glass reflects sky.
- [ ] **Step 6: Commit + push** `feat(app): living sky — real time, tweened presets, stars, sky reflections`

---

### Task 5: Post-processing + quality presets

**Files:**
- Create: `app/src/lib/quality.js`, `app/src/lib/__tests__/quality.test.js`, `app/src/world/PostFX.jsx`, `app/src/world/PerfWatch.jsx`
- Modify: `app/src/state/store.js` (+ test), `app/src/App.jsx`, `app/src/world/Scene.jsx`, `app/src/hud/ControlPills.jsx`, `app/src/hud/HintBar.jsx`

**Interfaces:**
- Produces `QUALITY = { LOW: {dpr:1, shadows:false, ao:false, bloom:true, shadowMap:1024}, HIGH: {dpr:[1,1.5], shadows:true, ao:true, bloom:true, shadowMap:4096}, ULTRA: {dpr:[1,2], shadows:true, ao:true, bloom:true, shadowMap:8192} }`; `nextQuality(avgMs, current) → 'LOW'|'HIGH'|'ULTRA'` (downgrade one step if avgMs > 25; never upgrades).
- Store adds `quality: 'HIGH'`, `setQuality(q)`.
- `Q` key cycles LOW → HIGH → ULTRA → LOW; quality pill row in ControlPills; hint `Q quality`.

- [ ] **Step 1: Failing tests** `app/src/lib/__tests__/quality.test.js`
```js
import { describe, it, expect } from 'vitest'
import { QUALITY, nextQuality } from '../quality.js'

describe('quality', () => {
  it('has three presets with increasing cost', () => {
    expect(Object.keys(QUALITY)).toEqual(['LOW', 'HIGH', 'ULTRA'])
    expect(QUALITY.LOW.shadows).toBe(false)
    expect(QUALITY.ULTRA.shadowMap).toBeGreaterThan(QUALITY.HIGH.shadowMap)
  })
  it('downgrades one step when slow, never upgrades', () => {
    expect(nextQuality(40, 'ULTRA')).toBe('HIGH')
    expect(nextQuality(40, 'HIGH')).toBe('LOW')
    expect(nextQuality(40, 'LOW')).toBe('LOW')
    expect(nextQuality(10, 'LOW')).toBe('LOW')
  })
})
```
Append to `app/src/state/__tests__/store.test.js`:
```js
  it('quality defaults to HIGH and can be set', () => {
    expect(useStore.getState().quality).toBe('HIGH')
    useStore.getState().setQuality('LOW')
    expect(useStore.getState().quality).toBe('LOW')
  })
```
Append to `app/src/hud/__tests__/hud.test.jsx`:
```jsx
  it('Q cycles quality', () => {
    render(<Hud />)
    fireEvent.keyDown(window, { code: 'KeyQ' })
    expect(useStore.getState().quality).toBe('ULTRA')
  })
```

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement**

`app/src/lib/quality.js`
```js
export const QUALITY = {
  LOW: { dpr: 1, shadows: false, ao: false, bloom: true, shadowMap: 1024 },
  HIGH: { dpr: [1, 1.5], shadows: true, ao: true, bloom: true, shadowMap: 4096 },
  ULTRA: { dpr: [1, 2], shadows: true, ao: true, bloom: true, shadowMap: 8192 },
}
const ORDER = ['LOW', 'HIGH', 'ULTRA']
export const nextQuality = (avgMs, q) => (avgMs > 25 ? ORDER[Math.max(0, ORDER.indexOf(q) - 1)] : q)
export const cycleQuality = (q) => ORDER[(ORDER.indexOf(q) + 1) % ORDER.length]
```
Store: add `quality: 'HIGH', setQuality: (quality) => set({ quality })`.

ControlPills: add a third row `LOW / HIGH / ULTRA` (class `small`), and in the key handler `if (e.code === 'KeyQ') setQuality(cycleQuality(useStore.getState().quality))`. HintBar: add `['Q', 'quality']`.

`app/src/world/PostFX.jsx`
```jsx
import { EffectComposer, N8AO, Bloom, ToneMapping, SMAA, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useStore } from '../state/store.js'
import { QUALITY } from '../lib/quality.js'

export default function PostFX() {
  const q = QUALITY[useStore((s) => s.quality)]
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {q.ao ? <N8AO halfRes aoRadius={18} distanceFalloff={0.6} intensity={2.2} quality="medium" /> : <></>}
      <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.85} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
      <Vignette offset={0.28} darkness={0.55} />
    </EffectComposer>
  )
}
```
`PerfWatch.jsx`: `useFrame` accumulates frame times over 3 s windows; if `nextQuality(avg, q) !== q` call `setQuality` and `console.info('quality auto-downgraded to', …)`; stop watching after the first 30 s of the session.

`App.jsx`: `dpr={QUALITY[quality].dpr}`, `shadows={QUALITY[quality].shadows}`, `gl={{ antialias: false, toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}`. `Scene.jsx`: render `<PostFX />` and `<PerfWatch />` last; `SkyRig` reads `QUALITY[quality].shadowMap` for `shadow-mapSize`. Since ToneMapping moves into the composer, `gl.toneMappingExposure` no longer applies: `SkyRig` instead scales `light.intensity` and `hemi.intensity` by `p.exposure`.

- [ ] **Step 4: Run** tests — Expected: pass.
- [ ] **Step 5: Visual check**: DAY — contact shadows at building bases (AO), crisp edges; NIGHT — windows bloom softly without washing out; toggle Q through all three; check no console errors.
- [ ] **Step 6: Commit + push** `feat(app): post-processing and quality presets`

---

### Task 6: Ground data — parks, roads, sidewalks, rail, trees

**Files:**
- Create: `pipeline/lib/ribbon.js`, `pipeline/lib/ground.js`, `pipeline/tests/ribbon.test.js`, `pipeline/tests/ground.test.js`
- Modify: `pipeline/lib/sources.js` (+ test), `pipeline/fetch/fetch-all.js`, `pipeline/build/build-world.js`
- Generated: `app/public/world/ground/{parks,beaches,roads,sidewalks,rail,elevated}.glb`, `app/public/world/trees.json`, `app/public/world/columns.json`

**Interfaces:**
- Produces `bufferPolyline(points: [x,z][], halfWidth, y = 0) → { positions, normals, uvs }` — flat quad strip with mitered joins (miter capped at 2× halfWidth), uv = (along-metres, across-metres).
- Produces `ROAD_WIDTHS` (metres, full width): `motorway 22, trunk 18, primary 16, secondary 14, tertiary 12, unclassified 10, residential 9, service 5, *_link 8`; `roadHalfWidth(tags) → number | 0` (0 = skip: tunnels, `layer < 0`, unknown classes); `isElevatedRail(tags) → boolean` (`railway ∈ {subway, light_rail}` and (`bridge` present and ≠ `no`, or `layer ≥ 1`)); `scatterInPolygon(ring, spacing, seed) → [x,z][]` (jittered grid, deterministic, all inside the ring).
- Overpass kinds added: `parks`: `way["leisure"~"^(park|garden|playground|pitch)$"]`, `relation["leisure"="park"]`, `way["landuse"~"^(grass|recreation_ground|village_green)$"]`, `way["natural"="beach"]`; `roads`: `way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|motorway_link|trunk_link|primary_link|secondary_link)$"]`; `trees`: `node["natural"="tree"]`; `rail`: `way["railway"~"^(subway|light_rail|rail)$"]`.
- Manifest `ground` gains `parks, beaches, roads, sidewalks, rail, elevated` (glb paths) and top-level `trees: "trees.json"`, `columns: "columns.json"`. `trees.json` = `{ "trees": [[x, z, scale, variant], ...] }` rounded to 0.1 m; `columns.json` = `{ "columns": [[x, z, rotY], ...] }` (every 18 m along elevated rail).

- [ ] **Step 1: Failing tests**

`pipeline/tests/ribbon.test.js`
```js
import { describe, it, expect } from 'vitest'
import { bufferPolyline } from '../lib/ribbon.js'

describe('bufferPolyline', () => {
  it('straight segment → 2 up-facing tris of the right width', () => {
    const m = bufferPolyline([[0, 0], [10, 0]], 2, 0.05)
    expect(m.positions.length / 9).toBe(2)
    const zs = m.positions.filter((_, i) => i % 3 === 2)
    expect(Math.min(...zs)).toBeCloseTo(-2); expect(Math.max(...zs)).toBeCloseTo(2)
    const ys = m.positions.filter((_, i) => i % 3 === 1)
    expect(new Set(ys)).toEqual(new Set([0.05]))
    for (let i = 0; i < m.normals.length; i += 3) expect(m.normals[i + 1]).toBe(1)
  })
  it('front faces point up (winding)', () => {
    const m = bufferPolyline([[0, 0], [10, 0], [10, -10]], 1)
    for (let i = 0; i < m.positions.length; i += 9) {
      const p = m.positions.slice(i, i + 9)
      const cy = (p[5] - p[2]) * (p[6] - p[0]) - (p[3] - p[0]) * (p[8] - p[2])
      expect(cy).toBeGreaterThan(0)
    }
  })
  it('caps extreme miters and ignores duplicate points', () => {
    const m = bufferPolyline([[0, 0], [10, 0], [10, 0], [0, 0.01]], 1)
    const xs = m.positions.filter((_, i) => i % 3 === 0)
    expect(Math.max(...xs)).toBeLessThan(13)
    expect(m.positions.every(Number.isFinite)).toBe(true)
  })
})
```

`pipeline/tests/ground.test.js`
```js
import { describe, it, expect } from 'vitest'
import { roadHalfWidth, isElevatedRail, scatterInPolygon } from '../lib/ground.js'
import { pointInRing } from '../lib/geom.js'

describe('ground rules', () => {
  it('road widths by class; tunnels and lower levels skipped', () => {
    expect(roadHalfWidth({ highway: 'primary' })).toBe(8)
    expect(roadHalfWidth({ highway: 'residential' })).toBe(4.5)
    expect(roadHalfWidth({ highway: 'primary', tunnel: 'yes' })).toBe(0)
    expect(roadHalfWidth({ highway: 'primary', layer: '-1' })).toBe(0)
    expect(roadHalfWidth({ highway: 'footway' })).toBe(0)
  })
  it('elevated L detection', () => {
    expect(isElevatedRail({ railway: 'subway', bridge: 'yes' })).toBe(true)
    expect(isElevatedRail({ railway: 'subway', layer: '2' })).toBe(true)
    expect(isElevatedRail({ railway: 'subway', tunnel: 'yes', layer: '-2' })).toBe(false)
    expect(isElevatedRail({ railway: 'rail', bridge: 'yes' })).toBe(false)
  })
  it('scatter is deterministic and inside the polygon', () => {
    const ring = [[0, 0], [100, 0], [100, -60], [0, -60]]
    const a = scatterInPolygon(ring, 12, 5), b = scatterInPolygon(ring, 12, 5)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(20)
    expect(a.every((p) => pointInRing(p, ring))).toBe(true)
  })
})
```
Extend `sources.test.js`: `expect(overpassQuery('trees', RING0_BBOX)).toContain('node["natural"="tree"]')`, and `'rail'` contains `railway`.

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement**

`pipeline/lib/ribbon.js`
```js
// pipeline/lib/ribbon.js — polyline → flat mitered ribbon (non-indexed tris, facing up).
export function bufferPolyline(points, hw, y = 0) {
  const pts = points.filter((p, i) => i === 0 || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 1e-3)
  const out = { positions: [], normals: [], uvs: [] }
  if (pts.length < 2) return out
  const L = [], R = [], along = [0]
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)]
    const d0 = i > 0 ? norm(sub(pts[i], prev)) : norm(sub(next, pts[i]))
    const d1 = i < pts.length - 1 ? norm(sub(next, pts[i])) : d0
    let t = norm([d0[0] + d1[0], d0[1] + d1[1]])
    if (!Number.isFinite(t[0]) || Math.hypot(...t) < 1e-6) t = d1
    const n = [-t[1], t[0]] // left normal in (x,z) — the side the map sees as left when walking the line
    const cos = n[0] * -d1[1] + n[1] * d1[0]
    const m = Math.min(2, 1 / Math.max(0.5, Math.abs(cos)))
    L.push([pts[i][0] + n[0] * hw * m, pts[i][1] + n[1] * hw * m])
    R.push([pts[i][0] - n[0] * hw * m, pts[i][1] - n[1] * hw * m])
    if (i > 0) along.push(along[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  }
  const push = (p, u, v) => { out.positions.push(p[0], y, p[1]); out.normals.push(0, 1, 0); out.uvs.push(u, v) }
  for (let i = 0; i < pts.length - 1; i++) {
    const tri = (a, ua, va, b, ub, vb, c, uc, vc) => {
      const cy = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1])
      if (cy >= 0) { push(a, ua, va); push(b, ub, vb); push(c, uc, vc) } else { push(a, ua, va); push(c, uc, vc); push(b, ub, vb) }
    }
    tri(L[i], along[i], hw, R[i], along[i], -hw, L[i + 1], along[i + 1], hw)
    tri(R[i], along[i], -hw, R[i + 1], along[i + 1], -hw, L[i + 1], along[i + 1], hw)
  }
  return out
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const norm = (v) => { const l = Math.hypot(v[0], v[1]); return l ? [v[0] / l, v[1] / l] : [NaN, NaN] }
```

`pipeline/lib/ground.js`
```js
// pipeline/lib/ground.js — rules for roads, rail and tree scatter.
import { pointInRing, ringBBox } from './geom.js'
import { hashSeed } from './buildings.js'

export const ROAD_WIDTHS = {
  motorway: 22, trunk: 18, primary: 16, secondary: 14, tertiary: 12, unclassified: 10,
  residential: 9, service: 5, motorway_link: 8, trunk_link: 8, primary_link: 8, secondary_link: 8,
}

export function roadHalfWidth(tags) {
  if (tags.tunnel && tags.tunnel !== 'no') return 0
  if (parseInt(tags.layer ?? '0', 10) < 0) return 0
  const w = ROAD_WIDTHS[tags.highway]
  return w ? w / 2 : 0
}

export function isElevatedRail(tags) {
  if (!['subway', 'light_rail'].includes(tags.railway)) return false
  if (tags.tunnel && tags.tunnel !== 'no') return false
  return (tags.bridge && tags.bridge !== 'no') || parseInt(tags.layer ?? '0', 10) >= 1
}

export function scatterInPolygon(ring, spacing, seed) {
  const { minX, minZ, maxX, maxZ } = ringBBox(ring)
  const out = []
  for (let x = minX + spacing / 2; x < maxX; x += spacing) {
    for (let z = minZ + spacing / 2; z < maxZ; z += spacing) {
      const h = hashSeed(`${seed}:${Math.round(x)}:${Math.round(z)}`)
      const h2 = hashSeed(`${seed}:${Math.round(z)}:${Math.round(x)}`)
      const p = [x + (h - 0.5) * spacing * 0.8, z + (h2 - 0.5) * spacing * 0.8]
      if (pointInRing(p, ring)) out.push(p)
    }
  }
  return out
}
```

`sources.js` `FILTERS` add:
```js
  parks: ['way["leisure"~"^(park|garden|playground|pitch)$"]', 'relation["leisure"="park"]', 'way["landuse"~"^(grass|recreation_ground|village_green)$"]', 'way["natural"="beach"]'],
  roads: ['way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|motorway_link|trunk_link|primary_link|secondary_link)$"]'],
  trees: ['node["natural"="tree"]'],
  rail: ['way["railway"~"^(subway|light_rail|rail)$"]'],
```
and in `overpassQuery`, trees use `out;` (nodes have lat/lon) — change the tail to ``return `…;(${…});${kind === 'trees' ? 'out;' : 'out geom;'}` ``. `fetch-all.js`: loop over `['buildings', 'parts', 'water', 'parks', 'roads', 'trees', 'rail']`.

`build-world.js` additions (after the water block):
```js
  // Parks & beaches
  const greens = osmPolys(load('osm-parks.json').data.elements)
  const beaches = greens.filter((p) => p.tags.natural === 'beach')
  const parks = greens.filter((p) => p.tags.natural !== 'beach')
  await writeMeshGlb(join(OUT, 'ground', 'parks.glb'), flatMesh(parks, 0.08))
  await writeMeshGlb(join(OUT, 'ground', 'beaches.glb'), flatMesh(beaches, 0.07))

  // Roads + sidewalks (sidewalk = road + 3 m each side, drawn below)
  const merge = (ms) => ({ positions: ms.flatMap((m) => m.positions), normals: ms.flatMap((m) => m.normals), uvs: ms.flatMap((m) => m.uvs) })
  const roadWays = load('osm-roads.json').data.elements.filter((e) => e.geometry)
  const roadMeshes = [], walkMeshes = []
  for (const e of roadWays) {
    const hw = roadHalfWidth(e.tags || {})
    if (!hw) continue
    const pts = e.geometry.map((p) => project(p.lon, p.lat))
    roadMeshes.push(bufferPolyline(pts, hw, 0.12))
    if (!['motorway', 'motorway_link', 'service'].includes(e.tags.highway)) walkMeshes.push(bufferPolyline(pts, hw + 3, 0.1))
  }
  await writeMeshGlb(join(OUT, 'ground', 'roads.glb'), merge(roadMeshes))
  await writeMeshGlb(join(OUT, 'ground', 'sidewalks.glb'), merge(walkMeshes))

  // Rail: elevated L structure deck + columns; at-grade rail ballast
  const railWays = load('osm-rail.json').data.elements.filter((e) => e.geometry)
  const deck = [], grade = [], columns = []
  for (const e of railWays) {
    const pts = e.geometry.map((p) => project(p.lon, p.lat))
    const t = e.tags || {}
    if (isElevatedRail(t)) {
      deck.push(bufferPolyline(pts, 3.6, 7.6))
      let acc = 0
      for (let i = 1; i < pts.length; i++) {
        const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        const rot = Math.atan2(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        for (let d = (18 - acc) % 18; d < seg; d += 18) {
          const k = d / seg
          columns.push([+(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k).toFixed(1), +(pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k).toFixed(1), +rot.toFixed(3)])
        }
        acc = (acc + seg) % 18
      }
    } else if (!(t.tunnel && t.tunnel !== 'no') && parseInt(t.layer ?? '0', 10) >= 0) grade.push(bufferPolyline(pts, t.railway === 'rail' ? 2.4 : 1.8, 0.09))
  }
  await writeMeshGlb(join(OUT, 'ground', 'elevated.glb'), merge(deck))
  await writeMeshGlb(join(OUT, 'ground', 'rail.glb'), merge(grade))
  writeFileSync(join(OUT, 'columns.json'), JSON.stringify({ columns }))

  // Trees: mapped street trees + scatter inside parks (not pitches/playgrounds)
  const trees = load('osm-trees.json').data.elements.map((n) => project(n.lon, n.lat))
  for (const p of parks) if (!['pitch', 'playground'].includes(p.tags.leisure)) trees.push(...scatterInPolygon(p.outer, 15, p.outer.length))
  writeFileSync(join(OUT, 'trees.json'), JSON.stringify({ trees: trees.map(([x, z]) => {
    const h = hashSeed(`${Math.round(x)}:${Math.round(z)}`)
    return [+x.toFixed(1), +z.toFixed(1), +(0.8 + h * 0.6).toFixed(2), Math.floor(h * 4)]
  }) }))
  console.log(`parks ${parks.length}, beaches ${beaches.length}, roads ${roadMeshes.length}, elevated segments ${deck.length}, columns ${columns.length}, trees ${trees.length}`)
```
Manifest: `ground: { land, river, parks: 'ground/parks.glb', beaches: 'ground/beaches.glb', roads: 'ground/roads.glb', sidewalks: 'ground/sidewalks.glb', rail: 'ground/rail.glb', elevated: 'ground/elevated.glb' }, trees: 'trees.json', columns: 'columns.json'`, `version: 2`.

`writeMeshGlb` must tolerate an empty mesh (0 positions): if `positions.length === 0`, write a single degenerate triangle at y = −100 so the file loads — add that guard to `lib/glb.js` with a test in `glb.test.js`:
```js
  it('writes a loadable file for an empty mesh', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'glb-')), 'e.glb')
    await writeMeshGlb(path, { positions: [], normals: [], uvs: [] })
    const doc = await new NodeIO().read(path)
    expect(doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getCount()).toBe(3)
  })
```

- [ ] **Step 4: Run** tests — Expected: pass. Then `npm run fetch && npm run build:world`. Expected log: parks ≈ 70, elevated segments > 20 (the Loop L), columns > 300, trees > 12,000. If elevated segments = 0, inspect `osm-rail.json` tags for the Loop (Wells/Lake/Wabash/Van Buren) and extend `isElevatedRail` (record a ruling) — the Loop must be elevated.
- [ ] **Step 5: Commit + push** `feat(pipeline): parks, roads, sidewalks, rail, elevated L, trees`

---

### Task 7: Ground rendering — materials, parks, roads, the L, seasonal trees

**Files:**
- Create: `app/src/world/materials/groundMaterials.js`, `app/src/lib/seasons.js`, `app/src/lib/__tests__/seasons.test.js`, `app/src/world/Trees.jsx`, `app/src/world/ElevatedL.jsx`
- Modify: `app/src/world/Ground.jsx`, `app/src/world/Scene.jsx`

**Interfaces:**
- Consumes: manifest v2 ground paths, `trees.json`, `columns.json`, `ground.json` (Task 2).
- Produces `treePalette(month: 1–12) → { canopy: string[] (hex), bare: boolean, density: number }`: Dec–Mar bare; Apr–May light greens; Jun–Aug deep greens; Sep 85% green + 15% gold; Oct oranges/reds/gold; Nov 40% bare browns.
- Produces `groundMaterials(groundJson) → { land, river, parks, beaches, roads, sidewalks, rail, elevated }` — `MeshStandardMaterial`s with textures repeating by world metres (uv = world xz for flat meshes, along/across metres for ribbons): `texture.repeat = 1 / sizeM`.

- [ ] **Step 1: Failing test** `app/src/lib/__tests__/seasons.test.js`
```js
import { describe, it, expect } from 'vitest'
import { treePalette, chicagoMonth } from '../seasons.js'

describe('treePalette', () => {
  it('winter is bare, summer is green, October is orange', () => {
    expect(treePalette(1).bare).toBe(true)
    expect(treePalette(7).bare).toBe(false)
    expect(treePalette(7).canopy.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true)
    const oct = treePalette(10).canopy
    expect(oct.some((c) => parseInt(c.slice(1, 3), 16) > 0xb0)).toBe(true) // warm reds/oranges
  })
  it('covers every month', () => {
    for (let m = 1; m <= 12; m++) expect(treePalette(m).canopy.length).toBeGreaterThan(0)
  })
  it('chicagoMonth reads the America/Chicago calendar month', () => {
    expect(chicagoMonth(new Date('2026-10-01T03:00:00Z'))).toBe(9) // still Sep 30 in Chicago
  })
})
```
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement**

`app/src/lib/seasons.js`
```js
// app/src/lib/seasons.js — Chicago's trees follow the real calendar.
const P = {
  bare: ['#5b4a3c', '#6a5646', '#4d3f34'],
  spring: ['#9bc46a', '#86b85a', '#a9cf78', '#7fae52'],
  summer: ['#3f6d33', '#4a7a3a', '#365f2d', '#557f40'],
  sept: ['#4a7a3a', '#3f6d33', '#557f40', '#6d8a3a', '#c9a23a'],
  oct: ['#c8702a', '#d9922f', '#b5452a', '#e0b23a', '#8f6b2c', '#6d8a3a'],
  nov: ['#8f6b2c', '#6e5238', '#a0612a', '#5b4a3c'],
}
export function treePalette(month) {
  if ([12, 1, 2, 3].includes(month)) return { canopy: P.bare, bare: true, density: 0 }
  if ([4, 5].includes(month)) return { canopy: P.spring, bare: false, density: 0.85 }
  if ([6, 7, 8].includes(month)) return { canopy: P.summer, bare: false, density: 1 }
  if (month === 9) return { canopy: P.sept, bare: false, density: 1 }
  if (month === 10) return { canopy: P.oct, bare: false, density: 0.9 }
  return { canopy: P.nov, bare: false, density: 0.5 }
}
export function chicagoMonth(date = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'numeric' }).format(date))
}
```

`app/src/world/materials/groundMaterials.js`
```js
// app/src/world/materials/groundMaterials.js — textured, world-scaled ground surfaces.
import * as THREE from 'three'

const loader = new THREE.TextureLoader()
function tex(g, name) {
  const e = g?.[name]
  if (!e) return null
  const t = loader.load(`/textures/${e.file}`)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / e.sizeM, 1 / e.sizeM)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, ...o })

export function groundMaterials(g) {
  return {
    land: mat({ map: tex(g, 'concrete'), color: '#b9b4ab' }),
    river: mat({ color: '#1f4652', roughness: 0.08, metalness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }),
    parks: mat({ map: tex(g, 'grass'), color: '#d6e8c4', polygonOffset: true, polygonOffsetFactor: -3 }),
    beaches: mat({ map: tex(g, 'sand'), color: '#fff7e6', polygonOffset: true, polygonOffsetFactor: -3 }),
    sidewalks: mat({ map: tex(g, 'sidewalk'), color: '#d8d6d0', polygonOffset: true, polygonOffsetFactor: -4 }),
    roads: mat({ map: tex(g, 'asphalt'), color: '#8a8a8a', roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -6 }),
    rail: mat({ map: tex(g, 'gravel'), color: '#6b6258', polygonOffset: true, polygonOffsetFactor: -5 }),
    elevated: mat({ color: '#2f3a33', roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }),
  }
}
```

`Ground.jsx` (rewrite): fetch `/textures/ground/ground.json` (fallback `{}`), build `groundMaterials`, render every manifest ground layer through the existing `SafeLoad` + `Suspense` + `Flat` pattern (`Flat` gains `castShadow` for `elevated`). Draw order is handled by `polygonOffset` and y offsets from Task 6.

`app/src/world/Trees.jsx`
```jsx
// app/src/world/Trees.jsx — instanced seasonal trees (canopy + trunk).
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { treePalette, chicagoMonth } from '../lib/seasons.js'

const canopyGeo = new THREE.IcosahedronGeometry(1, 1)
canopyGeo.scale(3.2, 3.6, 3.2).translate(0, 7.5, 0)
const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 5.5, 6, 1, true).translate(0, 2.75, 0)
const canopyMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true })
const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a3b2f', roughness: 1 })

export default function Trees({ file, onLoaded }) {
  const [trees, setTrees] = useState(null)
  const canopy = useRef(), trunk = useRef()
  const pal = useMemo(() => treePalette(chicagoMonth()), [])
  useEffect(() => {
    fetch(`/world/${file}`).then((r) => r.json()).then((j) => setTrees(j.trees)).catch(() => setTrees([])).finally(onLoaded)
  }, [file, onLoaded])
  useEffect(() => {
    if (!trees?.length) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color()
    trees.forEach(([x, z, sc, v], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), v * 1.7)
      m.compose(p.set(x, 0, z), q, s.set(sc, sc * (0.9 + v * 0.08), sc))
      trunk.current.setMatrixAt(i, m)
      canopy.current.setMatrixAt(i, pal.bare ? m.clone().scale(new THREE.Vector3(0, 0, 0)) : m)
      canopy.current.setColorAt(i, c.set(pal.canopy[(i * 7 + v) % pal.canopy.length]))
    })
    for (const r of [canopy, trunk]) { r.current.instanceMatrix.needsUpdate = true; r.current.computeBoundingSphere() }
    if (canopy.current.instanceColor) canopy.current.instanceColor.needsUpdate = true
  }, [trees, pal])
  if (!trees?.length) return null
  return (
    <>
      <instancedMesh ref={trunk} args={[trunkGeo, trunkMat, trees.length]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={canopy} args={[canopyGeo, canopyMat, trees.length]} castShadow receiveShadow frustumCulled={false} />
    </>
  )
}
```

`app/src/world/ElevatedL.jsx`: fetch `columns.json`; one `instancedMesh` of a merged steel bent (two 0.5 m square posts 5.5 m apart + cross beam at 7 m, built with `BufferGeometryUtils.mergeGeometries` from three `BoxGeometry`s), material `groundMaterials().elevated`, rotation from `rotY`, `castShadow`.

`Scene.jsx`: render `<Trees file={manifest.trees} onLoaded={…markLoaded('trees')} />` and `<ElevatedL file={manifest.columns} … />` when the manifest has them; `setLoadTotal` counts every ground layer + trees + columns.

- [ ] **Step 4: Run** tests — Expected: pass.
- [ ] **Step 5: Visual check** `?view=museum&time=day` — Grant Park green with trees (September gold flecks today), roads with asphalt and sidewalks, beaches sand; `?view=loop&time=day` — the Loop L structure visible over Wabash/Lake/Wells/Van Buren; no z-fighting flicker (if roads flicker against sidewalks, increase polygonOffset separation).
- [ ] **Step 6: Commit + push** `feat(app): parks, roads, sidewalks, elevated L, seasonal trees`

---

### Task 8: Rooftop props — water towers, HVAC, mechanical penthouses

**Files:**
- Create: `pipeline/lib/props.js`, `pipeline/tests/props.test.js`, `app/src/world/RoofProps.jsx`
- Modify: `pipeline/build/build-world.js`, `app/src/world/Scene.jsx`

**Interfaces:**
- Produces `roofProps(building, pieces) → Array<[type, x, y, z, rotY, sx, sy, sz]>` with `type ∈ {0 water-tower, 1 hvac, 2 penthouse}`; deterministic from `hashSeed(building.id)`; every prop's (x, z) is inside the roof ring of the piece it sits on; `y` = that piece's top.
  - water tower: `year < 1950`, `15 ≤ top ≤ 70`, area > 250 m², 55% chance, 1 tower.
  - hvac: `top > 20`: `min(6, floor(area / 400))` boxes (2–5 m).
  - penthouse: `top > 60`, no parts, not a shaped hero: one box at the centroid, footprint 30% of bbox, 5 m tall.
- Output `app/public/world/props.json`: `{ "props": [[type, x, y, z, rot, sx, sy, sz], …] }` (1 decimal). Manifest `props: "props.json"`.

- [ ] **Step 1: Failing test** `pipeline/tests/props.test.js`
```js
import { describe, it, expect } from 'vitest'
import { roofProps } from '../lib/props.js'
import { pointInRing } from '../lib/geom.js'

const sq = (x, z, s) => [[x, z], [x + s, z], [x + s, z - s], [x, z - s]]
const mk = (o) => ({ id: 'x1', year: 1920, area: 900, centroid: [15, -15], height: 40, parts: null, polygons: [{ outer: sq(0, 0, 30), holes: [] }], ...o })

describe('roofProps', () => {
  it('is deterministic', () => {
    const b = mk({})
    const pieces = [{ outer: sq(0, 0, 30), holes: [], base: 0, top: 40 }]
    expect(roofProps(b, pieces)).toEqual(roofProps(b, pieces))
  })
  it('props sit on the roof, inside the ring', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      const b = mk({ id })
      const pieces = [{ outer: sq(0, 0, 30), holes: [], base: 0, top: 40 }]
      for (const [, x, y, z] of roofProps(b, pieces)) {
        expect(y).toBe(40)
        expect(pointInRing([x, z], pieces[0].outer)).toBe(true)
      }
    }
  })
  it('no water towers on modern towers; penthouse on tall plain towers', () => {
    const b = mk({ year: 1990, height: 150, area: 2500, polygons: [{ outer: sq(0, 0, 50), holes: [] }] })
    const out = roofProps(b, [{ outer: sq(0, 0, 50), holes: [], base: 0, top: 150 }])
    expect(out.some((p) => p[0] === 0)).toBe(false)
    expect(out.some((p) => p[0] === 2)).toBe(true)
  })
  it('low buildings get nothing', () => {
    expect(roofProps(mk({ height: 10 }), [{ outer: sq(0, 0, 30), holes: [], base: 0, top: 10 }])).toEqual([])
  })
})
```
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement `pipeline/lib/props.js`**
```js
// pipeline/lib/props.js — rooftop clutter that makes a skyline read as Chicago.
import { pointInRing, ringBBox, ringCentroid, signedArea } from './geom.js'
import { hashSeed } from './buildings.js'
import { HERO_SHAPES } from './shapes.js'

const r1 = (n) => Math.round(n * 10) / 10

export function roofProps(b, pieces) {
  const roof = pieces.filter((p) => !p.taper).reduce((a, p) => (!a || p.top > a.top ? p : a), null)
  if (!roof || roof.top <= 15) return []
  const area = Math.abs(signedArea(roof.outer))
  const bb = ringBBox(roof.outer)
  const rnd = (k) => hashSeed(`${b.id}:${k}`)
  const inside = (x, z, pad) => [[0, 0], [pad, 0], [-pad, 0], [0, pad], [0, -pad]].every(([dx, dz]) => pointInRing([x + dx, z + dz], roof.outer))
  const pick = (k, pad) => {
    for (let t = 0; t < 12; t++) {
      const x = bb.minX + (bb.maxX - bb.minX) * rnd(`${k}x${t}`), z = bb.minZ + (bb.maxZ - bb.minZ) * rnd(`${k}z${t}`)
      if (inside(x, z, pad)) return [x, z]
    }
    return null
  }
  const out = []
  const y = roof.top
  if (b.year && b.year < 1950 && roof.top >= 15 && roof.top <= 70 && area > 250 && rnd('wt') < 0.55) {
    const p = pick('wt', 3); if (p) out.push([0, r1(p[0]), r1(y), r1(p[1]), r1(rnd('wtr') * 6.28), 1, 1, 1])
  }
  if (roof.top > 20) {
    const n = Math.min(6, Math.floor(area / 400))
    for (let i = 0; i < n; i++) {
      const s = 2 + rnd(`h${i}`) * 3, p = pick(`h${i}`, s / 2 + 0.5)
      if (p) out.push([1, r1(p[0]), r1(y), r1(p[1]), 0, r1(s), r1(1.2 + rnd(`hh${i}`) * 1.8), r1(s * (0.6 + rnd(`hw${i}`) * 0.6))])
    }
  }
  if (roof.top > 60 && !b.parts && !HERO_SHAPES[b.id]) {
    const [cx, cz] = ringCentroid(roof.outer)
    if (pointInRing([cx, cz], roof.outer)) out.push([2, r1(cx), r1(y), r1(cz), 0, r1((bb.maxX - bb.minX) * 0.3), 5, r1((bb.maxZ - bb.minZ) * 0.3)])
  }
  return out
}
```
`build-world.js`: inside the tile loop, after `const pieces = shapePieces(b)`, `allProps.push(...roofProps(b, pieces))`; after the loop write `props.json`; manifest `props: 'props.json'`.

`app/src/world/RoofProps.jsx`: fetch `props.json`; three `instancedMesh`es:
  - water tower geometry (merged): tank `CylinderGeometry(2.1, 2.1, 4.2, 14)` at y 5.1, roof `ConeGeometry(2.3, 1.4, 14)` at y 7.9, four legs `BoxGeometry(0.2, 3, 0.2)` at (±1.4, 1.5, ±1.4); material `#6b4a33` roughness 1 (weathered cedar).
  - hvac `BoxGeometry(1,1,1)` translated up 0.5, material `#9aa0a3` metalness 0.4.
  - penthouse `BoxGeometry(1,1,1)` translated up 0.5, uses `createFacadeMaterial()`? No — plain `#4b5563` roughness 0.8 (keeps the façade shader free of prop cases).
  Compose each instance matrix from (x, y, z), rotY, scale (sx, sy, sz); `castShadow receiveShadow`.

- [ ] **Step 4: Run** tests; rebuild world — Expected: pass; log count of props (> 1,500).
- [ ] **Step 5: Visual check** `?view=river&time=day` — water towers on River North lofts, HVAC on flat roofs, penthouses on towers.
- [ ] **Step 6: Commit + push** `feat: rooftop water towers, HVAC and penthouses`

---

### Task 9: Intro flight + new bookmarks

**Files:**
- Create: `app/src/lib/introPath.js`, `app/src/lib/__tests__/introPath.test.js`
- Modify: `app/src/lib/bookmarks.js` (+ test), `app/src/camera/AtlasRig.jsx`, `app/src/state/store.js`

**Interfaces:**
- Produces `INTRO_SECONDS = 7`; `introPose(t) → { position: [x,y,z], target: [x,y,z] }` for `t ∈ [0,1]` (clamped), eased `easeInOutCubic`; `introPose(1)` equals `BOOKMARKS.streeterville`.
- Bookmarks add `hancock: { position: [900, 420, -1500], target: [395, 200, -1865] }` and `willis: { position: [-200, 380, 900], target: [-669, 260, 348] }`.
- Store adds `introDone: boolean`, `finishIntro()`.
- AtlasRig: when `window.location.search` has no `view`, `prefers-reduced-motion` is off and `load.ready` is true, play the intro; any keydown / pointerdown / wheel calls `finishIntro()` and snaps to the end pose; during the intro user input to CameraControls is disabled (`enabled={introDone}`).

- [ ] **Step 1: Failing test** `app/src/lib/__tests__/introPath.test.js`
```js
import { describe, it, expect } from 'vitest'
import { introPose, INTRO_SECONDS } from '../introPath.js'
import { BOOKMARKS } from '../bookmarks.js'

describe('introPose', () => {
  it('ends exactly on the Streeterville bookmark', () => {
    const e = introPose(1)
    e.position.forEach((v, i) => expect(v).toBeCloseTo(BOOKMARKS.streeterville.position[i]))
    e.target.forEach((v, i) => expect(v).toBeCloseTo(BOOKMARKS.streeterville.target[i]))
  })
  it('starts far out over the lake and descends', () => {
    const s = introPose(0)
    expect(s.position[0]).toBeGreaterThan(3500)
    expect(s.position[1]).toBeGreaterThan(introPose(1).position[1])
  })
  it('clamps t and never leaves min altitude', () => {
    expect(introPose(-1)).toEqual(introPose(0))
    expect(introPose(2)).toEqual(introPose(1))
    for (let t = 0; t <= 1; t += 0.05) expect(introPose(t).position[1]).toBeGreaterThanOrEqual(30)
    expect(INTRO_SECONDS).toBe(7)
  })
})
```
Add to `bookmarks.test.js`: `expect(bookmarkFromUrl('?view=hancock')).toBe(BOOKMARKS.hancock)` and `willis`.

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement `introPath.js`**
```js
// app/src/lib/introPath.js — the cinematic push-in from Lake Michigan at load.
import { BOOKMARKS } from './bookmarks.js'

export const INTRO_SECONDS = 7
const P = [[5200, 900, 600], [3400, 620, -700], BOOKMARKS.streeterville.position]
const T = [[0, 120, -300], [250, 90, -350], BOOKMARKS.streeterville.target]
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const bez = (pts, t) => pts[0].map((_, i) => (1 - t) ** 2 * pts[0][i] + 2 * (1 - t) * t * pts[1][i] + t ** 2 * pts[2][i])

export function introPose(t) {
  const k = ease(Math.min(1, Math.max(0, t)))
  return { position: bez(P, k), target: bez(T, k) }
}
```
AtlasRig: add `introStart = useRef(null)`; in `useFrame`, if intro is active: `introStart.current ??= state.clock.elapsedTime`, `const p = introPose((t - introStart)/INTRO_SECONDS)`, `c.setLookAt(...p.position, ...p.target, false)`, and `finishIntro()` at t ≥ 1; skip the glide/clamp code while active. Listeners for skip are registered once and removed on finish. Store: `introDone: false, finishIntro: () => set({ introDone: true })`. When a `?view=` is present or reduced motion, call `finishIntro()` on mount.

- [ ] **Step 4: Run** tests — Expected: pass (also the store test file: add `expect(useStore.getState().introDone).toBe(false)` → `finishIntro()` → true).
- [ ] **Step 5: Visual check**: open `/` fresh — loading fades, camera sweeps in from the lake over 7 s; pressing a key mid-flight snaps to the end; `/?view=loop` has no intro.
- [ ] **Step 6: Commit + push** `feat(app): cinematic intro flight + Hancock/Willis bookmarks`

---

### Task 10: Minimap with compass strip

**Files:**
- Create: `pipeline/lib/minimap.js`, `pipeline/tests/minimap.test.js`, `app/src/lib/minimapMath.js`, `app/src/lib/__tests__/minimapMath.test.js`, `app/src/hud/Minimap.jsx`, `app/src/hud/Minimap.css`, `app/src/hud/__tests__/minimap.test.jsx`
- Modify: `pipeline/build/build-world.js`, `app/src/hud/Hud.jsx`, `app/src/state/store.js`, `app/src/camera/AtlasRig.jsx`

**Interfaces:**
- Produces (pipeline) `minimapSvg({ land, water, parks, roads, buildings }, bounds, size) → string` — each layer is an array of rings (world [x,z]); colors: bg `#030509` (lake), land `#0a111f`, water `#0b2433`, parks `#0f2a22`, roads `#1a2940` (stroke 1.5 px), buildings `#243650`. Output `app/public/world/minimap.png` (1024²) + manifest `minimap: { file: 'minimap.png', bounds: {minX, minZ, maxX, maxZ} }` where bounds = Ring 0 world bbox ± 400 m, made square.
- Produces (app) `worldToMap([x,z], bounds, size) → [px, py]`; `mapToWorld([px,py], bounds, size) → [x,z]` clamped to the camera limit radius (3000 m from origin); `compassOffset(headingDeg, stripPx) → px` (0 ≤ result < stripPx).
- Store adds `flyTo: null | { x, z, id }`, `requestFlyTo(x, z)`. AtlasRig consumes `flyTo` (smooth `setLookAt` keeping the current offset vector, `true` for transition) and clears it.
- `<Minimap />` bottom-right: 196 px square glass panel (`.hud-panel`), compass strip across the top reading `N · · · E · · · S · · · W · · ·` scrolled by heading (N under the center tick when heading 0), map image rotated heading-up around the player, player as a cyan cone at center, click → `requestFlyTo`.

- [ ] **Step 1: Failing tests**

`pipeline/tests/minimap.test.js`
```js
import { describe, it, expect } from 'vitest'
import { minimapSvg } from '../lib/minimap.js'

describe('minimapSvg', () => {
  it('draws each layer as paths inside a square svg', () => {
    const ring = [[0, 0], [100, 0], [100, -100], [0, -100]]
    const svg = minimapSvg({ land: [ring], water: [], parks: [ring], roads: [[[0, 0], [100, 0]]], buildings: [ring, ring] }, { minX: -200, minZ: -200, maxX: 200, maxZ: 200 }, 512)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('width="512"')
    expect((svg.match(/<path/g) || []).length).toBe(5)
    expect(svg).toContain('#243650')
  })
})
```

`app/src/lib/__tests__/minimapMath.test.js`
```js
import { describe, it, expect } from 'vitest'
import { worldToMap, mapToWorld, compassOffset } from '../minimapMath.js'

const B = { minX: -2000, minZ: -2000, maxX: 2000, maxZ: 2000 }
describe('minimap math', () => {
  it('maps the world square onto the image', () => {
    expect(worldToMap([-2000, -2000], B, 1000)).toEqual([0, 0])
    expect(worldToMap([2000, 2000], B, 1000)).toEqual([1000, 1000])
  })
  it('mapToWorld inverts worldToMap', () => {
    const [x, z] = mapToWorld(worldToMap([123, -456], B, 1000), B, 1000)
    expect(x).toBeCloseTo(123); expect(z).toBeCloseTo(-456)
  })
  it('clamps far clicks to the camera radius and never returns NaN', () => {
    const [x, z] = mapToWorld([1e9, 1e9], { minX: -9e6, minZ: -9e6, maxX: 9e6, maxZ: 9e6 }, 1000)
    expect(Math.hypot(x, z)).toBeLessThanOrEqual(3000 + 1e-6)
    expect(mapToWorld([NaN, 5], B, 1000).every(Number.isFinite)).toBe(true)
  })
  it('compass offset wraps', () => {
    expect(compassOffset(0, 360)).toBe(0)
    expect(compassOffset(90, 360)).toBe(90)
    expect(compassOffset(-90, 360)).toBe(270)
    expect(compassOffset(720, 360)).toBe(0)
  })
})
```

`app/src/hud/__tests__/minimap.test.jsx`
```jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import Minimap from '../Minimap.jsx'
import { useStore } from '../../state/store.js'

const manifest = { minimap: { file: 'minimap.png', bounds: { minX: -2000, minZ: -2000, maxX: 2000, maxZ: 2000 } } }

describe('Minimap', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('renders the compass strip and map image', () => {
    const { container, getByText } = render(<Minimap manifest={manifest} />)
    expect(container.querySelector('img.mm-map')).toBeTruthy()
    expect(getByText('N')).toBeTruthy()
  })
  it('click requests a fly-to', () => {
    const { container } = render(<Minimap manifest={manifest} />)
    fireEvent.click(container.querySelector('.mm-view'), { clientX: 10, clientY: 10 })
    expect(useStore.getState().flyTo).not.toBeNull()
  })
  it('renders nothing without a minimap in the manifest', () => {
    const { container } = render(<Minimap manifest={{}} />)
    expect(container.innerHTML).toBe('')
  })
})
```

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement**

`pipeline/lib/minimap.js`
```js
// pipeline/lib/minimap.js — the CHI-palette 2D city for the HUD minimap.
const COLORS = { land: '#0a111f', water: '#0b2433', parks: '#0f2a22', buildings: '#243650', roads: '#1a2940' }

export function minimapSvg(layers, b, size) {
  const sx = size / (b.maxX - b.minX), sz = size / (b.maxZ - b.minZ)
  const pt = ([x, z]) => `${((x - b.minX) * sx).toFixed(1)},${((z - b.minZ) * sz).toFixed(1)}`
  const poly = (rings) => rings.map((r) => `M${r.map(pt).join('L')}Z`).join('')
  const line = (lines) => lines.map((l) => `M${l.map(pt).join('L')}`).join('')
  const paths = []
  for (const k of ['land', 'water', 'parks']) if (layers[k]?.length) paths.push(`<path d="${poly(layers[k])}" fill="${COLORS[k]}"/>`)
  if (layers.roads?.length) paths.push(`<path d="${line(layers.roads)}" fill="none" stroke="${COLORS.roads}" stroke-width="1.5" stroke-linecap="round"/>`)
  for (const r of layers.buildings || []) paths.push(`<path d="${poly([r])}" fill="${COLORS.buildings}"/>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#030509"/>${paths.join('')}</svg>`
}
```
One `<path>` per building ring keeps each path string short for sharp's SVG renderer (land 1 + parks 1 + roads 1 + buildings 2 = the 5 paths the test expects).

`build-world.js`: collect `land` outers, `water` outers, `parks` outers, road polylines (projected), and every building's polygon outers into `minimapSvg(...)`, bounds = Ring 0 world bbox (project the RING0_BBOX corners) ± 400 m squared up, then `await sharp(Buffer.from(svg)).png().toFile(join(OUT, 'minimap.png'))` (add `sharp` import). Manifest `minimap: { file: 'minimap.png', bounds }`.

`app/src/lib/minimapMath.js`
```js
import { MAX_DIST } from './cameraMath.js'
export const worldToMap = ([x, z], b, size) => [((x - b.minX) / (b.maxX - b.minX)) * size, ((z - b.minZ) / (b.maxZ - b.minZ)) * size]
export function mapToWorld([px, py], b, size) {
  let x = b.minX + ((Number.isFinite(px) ? px : size / 2) / size) * (b.maxX - b.minX)
  let z = b.minZ + ((Number.isFinite(py) ? py : size / 2) / size) * (b.maxZ - b.minZ)
  const r = Math.hypot(x, z)
  if (r > MAX_DIST) { x *= MAX_DIST / r; z *= MAX_DIST / r }
  return [x, z]
}
export const compassOffset = (heading, strip) => ((((heading / 360) * strip) % strip) + strip) % strip
```

`app/src/hud/Minimap.jsx`
```jsx
import './Minimap.css'
import { useStore } from '../state/store.js'
import { worldToMap, mapToWorld, compassOffset } from '../lib/minimapMath.js'

const VIEW = 196          // on-screen px
const ZOOM = 2.2          // map px per on-screen px at 1024 image size
const STRIP = 360         // strip px per 360°
const LABELS = ['N', 'E', 'S', 'W']

export default function Minimap({ manifest }) {
  const r = useStore((s) => s.readout)
  const requestFlyTo = useStore((s) => s.requestFlyTo)
  const mm = manifest?.minimap
  if (!mm) return null
  const size = 1024
  const [px, py] = worldToMap([r.x ?? 0, r.z ?? 0], mm.bounds, size)
  const scale = 1 / ZOOM
  const onClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = (e.clientX - rect.left - VIEW / 2) * ZOOM, dy = (e.clientY - rect.top - VIEW / 2) * ZOOM
    const h = (r.heading * Math.PI) / 180 // undo heading-up rotation
    const ux = dx * Math.cos(h) - dy * Math.sin(h), uy = dx * Math.sin(h) + dy * Math.cos(h)
    const [x, z] = mapToWorld([px + ux, py + uy], mm.bounds, size)
    requestFlyTo(x, z)
  }
  const off = compassOffset(r.heading, STRIP)
  return (
    <div className="hud-panel mm">
      <div className="mm-compass">
        <div className="mm-strip" style={{ transform: `translateX(${-off - STRIP + VIEW / 2}px)` }}>
          {[0, 1, 2].flatMap((rep) => LABELS.map((l, i) => (
            <span key={`${rep}${l}`} className={l === 'N' ? 'mm-n' : ''} style={{ left: rep * STRIP + i * (STRIP / 4) }}>{l}</span>
          )))}
        </div>
        <i className="mm-tick" />
      </div>
      <div className="mm-view" onClick={onClick}>
        <img className="mm-map" src={`/world/${mm.file}`} alt="" draggable={false}
          style={{ transform: `translate(${VIEW / 2}px, ${VIEW / 2}px) rotate(${-r.heading}deg) scale(${scale}) translate(${-px}px, ${-py}px)` }} />
        <i className="mm-player" />
      </div>
    </div>
  )
}
```
`readout` gains `x, z` (camera target) — AtlasRig adds them to `setReadout`. Store: `flyTo: null, requestFlyTo: (x, z) => set({ flyTo: { x, z, id: Date.now() } }), clearFlyTo: () => set({ flyTo: null })`.

`app/src/hud/Minimap.css`
```css
.mm { position: absolute; right: 16px; bottom: 16px; width: 196px; padding: 0; overflow: hidden; animation: hud-rise 0.6s 0.2s ease both; }
.mm-compass { position: relative; height: 20px; overflow: hidden; border-bottom: 1px solid var(--border);
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.2em; color: var(--text-muted);
  background: repeating-linear-gradient(90deg, transparent 0 17px, var(--border) 17px 18px); }
.mm-strip { position: absolute; top: 4px; left: 0; width: 1080px; height: 12px; }
.mm-strip span { position: absolute; transform: translateX(-50%); }
.mm-strip .mm-n { color: var(--red); }
.mm-tick { position: absolute; left: 50%; bottom: 0; width: 1px; height: 6px; background: var(--accent); }
.mm-view { position: relative; width: 196px; height: 196px; overflow: hidden; cursor: crosshair; }
.mm-map { position: absolute; left: 0; top: 0; width: 1024px; height: 1024px; transform-origin: 0 0; opacity: 0.95; image-rendering: auto; }
.mm-player { position: absolute; left: 50%; top: 50%; width: 0; height: 0; transform: translate(-50%, -70%);
  border-left: 7px solid transparent; border-right: 7px solid transparent; border-bottom: 14px solid var(--accent);
  filter: drop-shadow(0 0 6px rgba(var(--accent-rgb), 0.9)); }
```
`Hud.jsx` renders `<Minimap manifest={manifest} />` — Scene stores the manifest into the zustand store (`setManifest`) so the HUD can read it: add `manifest: null, setManifest` to the store and call it in `Scene`'s load effect. Move the hint bar left of the minimap on narrow screens (already hidden < 720 px).

AtlasRig: `const flyTo = useStore((s) => s.flyTo)`; `useEffect(() => { if (!flyTo || !ref.current) return; const c = ref.current; c.getTarget(tmpT); c.getPosition(tmpP); const off = tmpP.clone().sub(tmpT); c.setLookAt(flyTo.x + off.x, tmpP.y, flyTo.z + off.z, flyTo.x, tmpT.y, flyTo.z, true); useStore.getState().clearFlyTo() }, [flyTo])`.

- [ ] **Step 4: Run** all tests — Expected: pass. Rebuild world (writes `minimap.png`); view it with Read — it should read as the Loop/River North/Streeterville plan in CHI colors.
- [ ] **Step 5: Visual check**: minimap bottom-right rotates with heading, compass strip scrolls (N red), click Navy Pier on the minimap → camera glides there.
- [ ] **Step 6: Commit + push** `feat: HUD minimap with compass strip and click-to-fly`

---

### Task 11: Water and atmosphere polish

**Files:**
- Modify: `app/src/world/Lake.jsx`, `app/src/world/materials/groundMaterials.js`, `app/src/world/SkyRig.jsx`

**Interfaces:**
- Consumes: `paletteFor` (Task 4), `sunRef` (Task 4), scene environment (Task 4).
- No new public interfaces (visual tuning task); the verification is visual + the full test suite.

- [ ] **Step 1:** Lake: `distortionScale` 1.6, `size` 2.5, `alpha` 0.96; per frame set `material.uniforms.waterColor` from `paletteFor(elev).water` and `sunColor` from `paletteFor(elev).sunColor`; at night (night > 0.5) reduce `distortionScale` to 0.8 so city light reflections read as long streaks.
- [ ] **Step 2:** River: confirm the Task 7 river material (metalness 0.9, roughness 0.08) reflects the environment; add a subtle normal map from `/textures/waternormals.jpg` (repeat 1/40 m, `normalScale` 0.35) animated by offsetting `normalMap.offset` in a `useFrame` in `Ground.jsx`.
- [ ] **Step 3:** Fog: fog distances from quality — LOW `[900, 7000]`, HIGH/ULTRA `[1200, 11000]`; dawn/dusk fog tinted by palette (already); verify the horizon line between lake plane and sky dome is invisible at DAY (if a seam shows, raise the Sky `distance` or push fog far distance under the sky horizon).
- [ ] **Step 4: Visual check** all four presets from `?view=streeterville` and `?view=museum`: dusk — warm sun glint on the lake; night — navy lake with window reflections; day — teal lake, reflective river canyon.
- [ ] **Step 5: Run** `npm test` — Expected: all pass.
- [ ] **Step 6: Commit + push** `feat(app): water and atmosphere polish`

---

### Task 12: Baselines, performance check, README

**Files:**
- Modify: `app/e2e/hero-view.spec.js`, snapshots, `README.md`, `docs/screenshots/*`

- [ ] **Step 1:** Extend the e2e matrix to `[['streeterville','dusk'], ['loop','day'], ['river','dusk'], ['museum','day'], ['streeterville','night'], ['hancock','dusk'], ['willis','day']]`. The spec must also mask `.mm` (the minimap) only if its rendering is nondeterministic — try without first. The intro does not run because `?view=` is present.
- [ ] **Step 2:** `npx playwright test --update-snapshots`, then **Read every PNG**: textures crisp, windows lit at night, Hancock tapered with masts on the roof, Willis antennas above Trump's spire, parks green-gold with trees, the Loop L visible, minimap readable. Fix anything off before continuing. Then `npx playwright test` — Expected: 7 passed.
- [ ] **Step 3: Performance check** — in the dev server run `window.__perf = true` via Playwright evaluate and read `renderer.info` from a `?stats` flag: add to `Scene.jsx` `useThree(({ gl }) => gl)` exposure `window.__gl = gl` when `?stats` is present; evaluate `({ calls: __gl.info.render.calls, tris: __gl.info.render.triangles })` at `?view=loop&time=day&stats`. Expected: calls < 300, triangles < 1.5 M at HIGH. If over, lower tree canopy detail (`IcosahedronGeometry(1, 0)`) and record a ruling.
- [ ] **Step 4:** Capture unmasked portfolio shots (as in Phase 1, scratchpad script): streeterville-dusk, streeterville-night, loop-day, museum-day, hancock-dusk → `docs/screenshots/phase2-*.png`. README: hero image → `phase2-streeterville-night.png` (or whichever reads best), gallery grid of the rest, roadmap ticks Phase 2, badges (`real_buildings`, add `generated_textures-14`), controls table adds `Q` quality and minimap click.
- [ ] **Step 5:** `npm test` (all green), `npm run build` (succeeds), `du -sh app/public` (< 40 MB) — report numbers in the commit body.
- [ ] **Step 6: Commit + push** `feat: Phase 2 beauty pass — baselines, screenshots, README`
