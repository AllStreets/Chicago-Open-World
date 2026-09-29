# Phase 6 — Further Rings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Later-phase plan (master-plan ruling, 2026-09-29).** This plan is written at task, interface and test level. Code-level implementation steps are completed at phase start, because they depend on what V1–V8 and Phases 3–5 actually shipped, and above all on how much of the 200 MB `public/world` budget is left. Every task carries a **Refresh at phase start** note. Do that refresh first, edit this plan in place, then execute.

**Goal:** Stream the city beyond the Addison → 35th and Western → lake rectangle:
- south to Hyde Park and the Museum of Science & Industry;
- north through Uptown and Rogers Park to Evanston;
- west to Cicero Avenue.

Transit, the lake and landmarks (MSI first) continue seamlessly across the ring edges. The pipeline builds each ring within explicit memory and time budgets. Auto-quality and LOD are retuned, so the larger world still holds 60 fps at HIGH.

**Architecture:**
- **Rings.** The world becomes a set of named rings (`core`, `r1`, `r2s`, `r2n`, `r3n`, `r2w`), each a lat/lon rectangle with a detail class (`full`, `light`, `far`).
- **Build.** The pipeline builds one ring at a time from chunked, cached Overpass data, owning exactly the tiles whose centres fall in the ring. The manifest is merged idempotently. Light rings skip roof props and parapets, simplify footprints harder, and rely on 2 km blocks for far detail instead of per-tile LOD1 files.
- **Camera.** The camera clamp becomes the union of the ring rectangles, and the minimap covers the union.
- **Streaming.** Tile planning takes per-quality limits. Auto-quality gains hysteresis and treats the user's choice as a ceiling.
- **Order.** Rings ship in priority order (r2s → r2n → r3n → r2w), and only while the size budget holds.

**Tech Stack:** Node pipeline (Overpass, gltf-transform + meshopt, sharp, Vitest 5), app (R3F, zustand, Vitest, Playwright). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md`: §1 (rings, "tile system extends city-wide later without rewrite"), §5 Quality (auto-downgrade), §6 Limits, §14 (Ring 2+ was out of v1 scope; this phase is its sanctioned follow-up), Addendum A.2 and A.5 (streaming and budgets), Addendum B.1.6 (budgets: ≤ 200 MB `public/world`, ≤ 900 draw calls), B.2 (lake extent), B.3 (transit data), B.5 (MSI deferred to Phase 6). Backlog: I-6.1–I-6.3, E8 (MSI), B4. Master plan: the P6 row.

## Global Constraints

- **`public/world` stays ≤ 200 MB (B.1.6). This is binding, and it is not raised by this phase.** A ring that does not fit after compaction is deferred and recorded, never shipped over budget.
- First load stays < 60 MB (A.5). New rings never load at boot; they stream on demand.
- **HIGH:** ≤ 900 draw calls (including the shadow and post passes) and ≤ 4 M triangles per frame, at the existing wide poses plus three new ones (Hyde Park and MSI, Evanston lakefront, Garfield Park). 60 fps on M-series.
- **LOW:** ≤ 450 draw calls and ≤ 1.5 M triangles at the same poses, 30+ fps on a mid-range laptop (§5).
- **Streaming (A.5 baseline):** LOD0 ≤ 1.6 km, LOD1 ≤ 7 km, hysteresis 15 %, LOD0 disposed beyond 2.2 km. This phase makes these per-quality (Task 6).
- **Pipeline budgets (new, Task 3):**
  - peak RSS ≤ 4 GB per ring build (`node --max-old-space-size=3584`);
  - wall time ≤ 20 min per ring build on an M-series Mac;
  - fetch ≤ 1 Overpass request per 5 s, chunks ≤ 0.02° × 0.02°, 3 mirrors, resumable per chunk;
  - fetch wall time ≤ 45 min per ring.
- **Determinism (H4):** two builds of the same ring from the same cache are byte-identical.
- **RAM discipline:** fetch, build and the dev server never run at the same time.
- The skyline validation (`skyline.json`, ±8 %) still passes, and any top-50 entry now inside the union bounds must be present.
- **Human-first:** new areas are reachable by ⌘K (neighbourhoods, landmarks, views), the minimap click, and `[ ]` views; the help card mentions the new areas.
- **README gallery only appends:** `docs/screenshots/p6-<subject>-<time>.png`.
- Ledger: `.superpowers/sdd/2026-09-29-phase-6-further-rings/progress.md`. **Push after each ring lands**, and at the end of the phase.

## Review Focus

1. **Seams between rings** (Western Ave, 35th St, Addison): roads, rail, the lake shoreline and parks must be continuous, with no double buildings or gaps where two rings meet. This is pinned in Task 2 (every tile key has exactly one owner ring) and Task 4 (the line continuity gap test across seams).
2. **Flying fast from the Loop to Evanston** (a minimap click at max distance): blocks and LOD1 must appear before LOD0, memory must stay bounded, and there must never be a hole to the horizon. This is pinned in Task 6 (the plan-limits and eviction tests) and the Evanston e2e pose.
3. **A ring build killed halfway** (out of memory, Ctrl+C) and re-run. The manifest must not end up with duplicate or orphaned tiles, and the re-run must resume from the cached chunks. This is pinned in Task 3 (`mergeManifest` idempotence, and ring outputs written to a temp dir then swapped).
4. **The camera clamp in an L-shaped world.** The camera must not be able to park over an unbuilt corner (for example, north-west of Western and Addison if r2w ships but r2n does not), and pushing against the edge must slide, not stick. This is pinned in Task 2 (`clampToRings` tests).
5. **Auto-quality oscillating** on a machine that sits right at the threshold (HIGH ↔ LOW every 6 s), or overriding a user who chose ULTRA deliberately. This is pinned in Task 6 (the hysteresis and ceiling tests).

---

## Upstream contracts assumed (verify at phase start)

| Symbol | From | Assumed shape | Refresh check |
|---|---|---|---|
| `WORLD_BBOX`, `RING0_BBOX`, `chunkBBox`, `overpassQuery` | 2.5 | `pipeline/lib/sources.js` | unchanged? |
| World build | 2.5 + V1–V6 + P3 + P4 | `pipeline/build/build-world.js` builds the whole bbox in one pass | read the current build; note every per-tile output (glb, lod1, sidecar incl. `pois`, transit and style layers) |
| Transit build | V3 | `pipeline/build/build-transit.js` → `transit.json` + per-tile track meshes, bbox-driven | read it |
| Lake and shore | V1 | lake plane 120 × 160 km centred on the shoreline; `water/shore.png` 4 m/px over the lake band | manifest `water` block |
| Heightfield | V1 | `heightfield.png`, 8 m cells, 16-bit, over the world bbox | manifest bounds |
| Neighbourhoods, places | P4 | `neighborhoods.json` (~20 zones), `pois` sidecars, `pois-index.json` | sizes |
| `planWorld(target, manifest, current)`, `LOD0_M`, `LOD1_M`, `HYST`, `MAX_LOD0` | 2.5 | `app/src/lib/tilePlan.js` | unchanged? |
| `nextQuality(avgMs, q)`, `createPerfMeter` | 2.5 | `quality.js`, `perfMeter.js` | unchanged? |
| `WORLD_BOUNDS` | 2.5 | constant in `cameraMath.js` | becomes manifest-driven |
| Budget headroom | V8 | `public/world` measured at the end of V8 (it was 152 MB after Phase 2.5, before V1–V6 and P3–P5 additions) | `du -sh app/public/world` |

---

## Ring definitions (I-6.1)

| Ring | Bounds (S, N, W, E) | Why | Detail class | Est. land km² | Priority |
|---|---|---|---|---|---|
| core | 41.8650, 41.9000, −87.6450, −87.6050 | Phase 1 downtown | full | 12 | built |
| r1 | 41.826, 41.952, −87.695, −87.595 | Addendum A world | full | ~95 | built |
| **r2s** | 41.780, 41.826, −87.695, −87.570 | Bronzeville → Kenwood → Hyde Park, **MSI** (41.7906, −87.5832), UChicago, Robie House, Jackson Park north | light (full within 400 m of MSI) | ~45 | 1 |
| **r2n** | 41.952, 42.023, −87.745, −87.630 | Lakeview north, Uptown, Andersonville, Edgewater, Rogers Park to Howard; Montrose Harbor | light | ~55 | 2 |
| **r3n** | 42.023, 42.065, −87.735, −87.665 | **Evanston**: downtown, Northwestern lakefill, Grosse Point Lighthouse | light | ~25 | 3 |
| **r2w** | 41.826, 41.952, −87.745, −87.695 | Western → **Cicero**: Logan Square, Humboldt Park, Garfield Park Conservatory, Little Village north | light | ~58 | 4 |

- Union bbox: S 41.780, N 42.065, W −87.745, E −87.570.
- Ring edges share exact lat/lon lines with their neighbours.
- **Size estimate.** Measured density after Phase 2.5 is ≈ 1.4 MB/km² (full). The light target is ≤ 0.6 MB/km², so the four rings together are ≈ 110 MB at light density. Task 1 compaction frees headroom first; the rings then ship in priority order until the budget is reached.

---

## File Structure

```
pipeline/
  lib/rings.js                  (create) RINGS, ringOf(lat, lon), ringOwnsTile(key, ring), unionBBox(), ringChunks(ring)
  lib/budget.js                 (create) measureWorld(dir) → { totalMB, byLayer, byRing }, estimateRingMB(ring, density), assertBudget()
  lib/manifestMerge.js          (create) mergeManifest(prev, ringOut) — idempotent, sorted
  lib/sidecarCompact.js         (create) compactSidecar(json) / expandSidecar(json) — columnar arrays
  lib/sources.js                (modify) WORLD_BBOX → unionBBox(); chunk plan per ring
  fetch/fetch-ring.js           (create) resumable, rate-limited, mirror-rotating Overpass fetch per ring
  build/build-world.js          (modify) --ring <key>; detail classes; temp-dir + atomic swap; RSS sampling
  build/build-transit.js        (modify, V3 file) union bbox; clipped line ends flagged `terminusAtEdge`
  build/audit-world.js          (create) prints the size table; fails over budget
  data/heroes.json              (modify) msi, robiehouse, rockefellerchapel, garfieldconservatory, grossepointlighthouse (+ obamacenter if completed in OSM)
  tests/rings.test.js, tests/budget.test.js, tests/manifestMerge.test.js, tests/sidecarCompact.test.js, tests/ringHeroes.test.js (create)
app/src/
  lib/cameraMath.js             (modify) boundsFromManifest(manifest) → rects; clampToRings(x, z, rects) (slide, not stick)
  lib/tilePlan.js               (modify) planWorld(target, manifest, current, limits)
  lib/quality.js                (modify) QUALITY[q].stream = { lod0M, lod1M, maxLod0 }; autoQuality(state, sample)
  lib/grid.js                   (modify) north/south/west street tables; Evanston → "EVANSTON" fallback
  lib/places.js                 (modify) new neighbourhoods; VIEW_NAMES hydepark, evanston, garfieldpark
  lib/bookmarks.js, lib/views.js (modify) three new views
  lib/manifest.js               (modify) expandSidecar on load
  world/TileStreamer.jsx        (modify) per-quality limits; LRU eviction
  world/PerfWatch.jsx           (modify) autoQuality with ceiling
  hud/Minimap.jsx               (modify) union bounds; 4096 px image
  */__tests__/*.test.js         (append/create per task)
app/e2e/rings.spec.js           (create) Hyde Park/MSI, Evanston lakefront, Garfield Park poses
```

---

### Task 1: Size and memory audit, then compaction for headroom

**Files:**
- Create: `pipeline/lib/budget.js`, `pipeline/lib/sidecarCompact.js`, `pipeline/build/audit-world.js`
- Modify: `pipeline/build/build-world.js` (write compact sidecars), `app/src/lib/manifest.js` + `app/src/world/TileContent.jsx` (`expandSidecar` on fetch)
- Test: `pipeline/tests/budget.test.js`, `pipeline/tests/sidecarCompact.test.js`, `app/src/lib/__tests__/manifest.test.js` (append)

**Interfaces:**
- Produces:
  - `measureWorld(dir) → { totalMB, byLayer: { tiles_lod0, tiles_lod1, sidecars, blocks, ground, textures, other }, byRing: { [ring]: MB } }`
  - `estimateRingMB(areaKm2, densityMBperKm2) → MB`
  - `assertBudget(totalMB, limitMB = 200)`, which throws `Error('public/world 213.4 MB > 200 MB budget')`.
  - `compactSidecar(json) → json` and `expandSidecar(json) → json`. They are exact inverses for every sidecar key. Arrays of objects (`buildings`, `pois`) become columnar arrays with a `_cols` header, and numbers are quantised only where their meaning allows it (x and z to 0.1 m, which matches the current `toFixed(1)`).
  - `audit-world.js` prints the table, writes it to the ledger, and exits 1 when over budget.

- [ ] **Step 1: Write the failing tests**

```js
// pipeline/tests/sidecarCompact.test.js
import { describe, it, expect } from 'vitest'
import { compactSidecar, expandSidecar } from '../lib/sidecarCompact.js'

const side = {
  buildings: [{ id: 'w1', name: 'Rookery', address: '209 S LaSalle', stories: 12, year: 1888, height: 55.2, hero: null }, { id: 'w2', name: null, address: null, stories: null, year: null, height: 9, hero: null }],
  trees: [[1.5, -2.3, 1.1, 2]], props: [], columns: [[0.5, 0.5, 1.571]],
  pois: [{ id: 'n1', n: 'Au Cheval', c: 0, x: 10.1, y: 30, z: -5.2, b: 0 }],
}
describe('sidecar compaction', () => {
  it('round-trips exactly', () => { expect(expandSidecar(compactSidecar(side))).toEqual(side) })
  it('is at least 30 % smaller as JSON for a realistic tile', () => {
    const big = { ...side, buildings: Array.from({ length: 500 }, (_, i) => ({ id: `w${i}`, name: i % 7 ? null : `B${i}`, address: null, stories: 3, year: 1905, height: 11.4, hero: null })) }
    expect(JSON.stringify(compactSidecar(big)).length).toBeLessThan(0.7 * JSON.stringify(big).length)
  })
  it('passes unknown keys through untouched (forward compatible)', () => {
    expect(expandSidecar(compactSidecar({ ...side, stations: [{ id: 's' }] })).stations).toEqual([{ id: 's' }])
  })
})
```

```js
// pipeline/tests/budget.test.js
import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { measureWorld, estimateRingMB, assertBudget } from '../lib/budget.js'

describe('world budget', () => {
  it('measures by layer', () => {
    const d = mkdtempSync(join(tmpdir(), 'world-')); mkdirSync(join(d, 'tiles')); mkdirSync(join(d, 'blocks'))
    writeFileSync(join(d, 'tiles', '0_0.glb'), Buffer.alloc(1024 * 1024)); writeFileSync(join(d, 'tiles', '0_0.lod1.glb'), Buffer.alloc(512 * 1024))
    writeFileSync(join(d, 'tiles', '0_0.json'), Buffer.alloc(256 * 1024)); writeFileSync(join(d, 'blocks', '0_0.glb'), Buffer.alloc(1024 * 1024))
    const m = measureWorld(d)
    expect(m.byLayer.tiles_lod0).toBeCloseTo(1, 2); expect(m.byLayer.tiles_lod1).toBeCloseTo(0.5, 2)
    expect(m.byLayer.sidecars).toBeCloseTo(0.25, 2); expect(m.totalMB).toBeCloseTo(2.75, 2)
  })
  it('estimates and enforces', () => {
    expect(estimateRingMB(45, 0.6)).toBeCloseTo(27)
    expect(() => assertBudget(213.4)).toThrow(/213.4 MB > 200 MB/); expect(() => assertBudget(199.9)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run to verify they fail.** Run `npm test --prefix pipeline -- tests/sidecarCompact.test.js tests/budget.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. Then run `node pipeline/build/audit-world.js` against the current world, and log the table.
- [ ] **Step 4: Compaction pass.** Apply, in order, only what the audit shows is worth it, measuring after each:
  - (a) compact sidecars;
  - (b) meshopt `level: 'high'` with position quantisation checked against the V1 heightfield (roof error ≤ 0.1 m);
  - (c) drop LOD1 files for tiles whose block is never split (the planner never requests them; verify with `planWorld` over a 250 m grid of targets);
  - (d) a lower tree cap for `light` rings only.
  Stop when the headroom is ≥ 70 MB, or when the remaining options cost visible quality (evaluate and revert on the e2e baselines).
- [ ] **Step 5: Run the tests, rebuild the world, run e2e (baselines unchanged within threshold), then commit and push.** `git commit -m "perf(p6): world size audit + compaction for ring headroom"`

**Acceptance:**
- The ledger has the before and after size table.
- The e2e baselines are unchanged.
- The headroom figure is recorded, and it decides how many rings ship.

**Refresh at phase start:**
- Measure the real `public/world` size after V8 and P3–P5.
- List every sidecar key present now (V3 stations, V5 seat anchors and P4 pois may all be there).
- Check whether `(c)` is still valid under the current `planWorld`.

---

### Task 2: Ring model, union bounds and the camera clamp (I-6.1)

**Files:**
- Create: `pipeline/lib/rings.js`
- Modify: `pipeline/lib/sources.js` (`WORLD_BBOX` = the union of built rings; an exported `builtRings()` read from `pipeline/data/rings-built.json`), `app/src/lib/cameraMath.js` (`boundsFromManifest`, `clampToRings`), `app/src/camera/AtlasRig.jsx` (use manifest bounds)
- Test: `pipeline/tests/rings.test.js`, `app/src/lib/__tests__/cameraMath.test.js` (append)

**Interfaces:**
- Produces:
  - `RINGS: { key, bbox: { s, n, w, e }, detail: 'full'|'light'|'far', priority }[]` (the table above)
  - `ringOf(lat, lon) → key | null`
  - `ringOwnsTile(tileKey, ringKey) → boolean`. The owner is decided by the tile centre (unprojected) through `ringOf`, and ties on exact edges go to the south or west ring (half-open intervals `[s, n)`, `[w, e)`).
  - `unionBBox(keys) → { s, n, w, e }`
  - Manifest: `rings: [{ key, rect: { minX, maxX, minZ, maxZ }, detail }]` (projected)
  - `boundsFromManifest(manifest) → rect[]`. It falls back to `[WORLD_BOUNDS]` when `rings` is absent.
  - `clampToRings([x, z], rects, margin = 200) → [x, z]`. If the point is inside any rect shrunk by `margin`, it is unchanged; otherwise it moves to the nearest point on the union, so pushing along an edge slides.

- [ ] **Step 1: Write the failing tests**

```js
// pipeline/tests/rings.test.js
import { describe, it, expect } from 'vitest'
import { RINGS, ringOf, ringOwnsTile, unionBBox } from '../lib/rings.js'
import { tileBounds } from '../lib/tiles.js'
import { unproject } from '../../shared/project.js'

const overlap = (a, b) => a.s < b.n && a.n > b.s && a.w < b.e && a.e > b.w
describe('rings', () => {
  it('rings other than core never overlap each other', () => {
    const rs = RINGS.filter((r) => r.key !== 'core')
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) expect(overlap(rs[i].bbox, rs[j].bbox)).toBe(false)
  })
  it.each([
    ['Museum of Science & Industry', 41.7906, -87.5832, 'r2s'], ['Robie House', 41.7897, -87.5960, 'r2s'],
    ['Grosse Point Lighthouse', 42.0638, -87.6790, 'r3n'], ['Garfield Park Conservatory', 41.8863, -87.7173, 'r2w'],
    ['Montrose Harbor', 41.9630, -87.6380, 'r2n'], ['Willis Tower', 41.8789, -87.6359, 'r1'],
  ])('%s is in %s', (_n, lat, lon, key) => expect(ringOf(lat, lon)).toBe(key))
  it('every tile in the union is owned by exactly one ring', () => {
    const keys = ['0_0', '-10_11', '5_16', '-14_-20', '2_-30']
    for (const k of keys) {
      const b = tileBounds(k), [lon, lat] = unproject((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2)
      const owners = RINGS.filter((r) => r.key !== 'core' && ringOwnsTile(k, r.key))
      expect(owners.length).toBe(ringOf(lat, lon) ? 1 : 0)
    }
  })
  it('the union spans Hyde Park to Evanston, Cicero to the lake', () => {
    expect(unionBBox(RINGS.map((r) => r.key))).toEqual({ s: 41.780, n: 42.065, w: -87.745, e: -87.570 })
  })
})
```

```js
// append to app/src/lib/__tests__/cameraMath.test.js
import { clampToRings, boundsFromManifest, WORLD_BOUNDS } from '../cameraMath.js'
describe('ring clamp', () => {
  const rects = [{ minX: 0, maxX: 1000, minZ: 0, maxZ: 1000 }, { minX: 0, maxX: 500, minZ: -800, maxZ: 0 }] // L-shape
  it('leaves interior points alone', () => { expect(clampToRings([400, 400], rects, 0)).toEqual([400, 400]) })
  it('pulls a point in the missing corner back to the nearest edge', () => {
    const [x, z] = clampToRings([900, -400], rects, 0); expect(x).toBe(500); expect(z).toBe(-400)
  })
  it('slides along an edge rather than sticking', () => {
    expect(clampToRings([1200, 300], rects, 0)).toEqual([1000, 300])
    expect(clampToRings([1200, 700], rects, 0)).toEqual([1000, 700])
  })
  it('falls back to the Phase 2.5 rectangle without ring data', () => {
    expect(boundsFromManifest({})).toEqual([WORLD_BOUNDS])
  })
})
```

- [ ] **Step 2: Run to verify they fail.** Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. `unproject` must exist in `shared/project.js` (it does: `unproject(x, z)`).
- [ ] **Step 4: Run the tests to verify they pass.** Then commit. `git commit -m "feat(p6): ring model, union bounds, L-shaped camera clamp"`

**Acceptance:**
- The rings partition the new area, and each landmark is in its intended ring.
- The camera clamp slides along the union edge.

**Refresh at phase start:**
- Adjust the ring list to the headroom measured in Task 1. Drop the lowest-priority rings from `RINGS`' build list, not from the model, so the geometry stays documented.
- Check the Evanston shoreline longitude from OSM coastline data (it is ~−87.67 at 42.05).
- Check whether the Obama Presidential Center is tagged as completed in OSM (it would join r2s's landmarks).

---

### Task 3: Ring-incremental fetch and build within memory and time budgets (I-6.1)

**Files:**
- Create: `pipeline/fetch/fetch-ring.js`, `pipeline/lib/manifestMerge.js`
- Modify: `pipeline/build/build-world.js` (`--ring`, detail classes, temp dir + atomic swap, RSS sampling, horizon regenerated outside the union), `pipeline/package.json` scripts (`fetch:ring`, `build:ring`)
- Test: `pipeline/tests/manifestMerge.test.js`, `pipeline/tests/rings.test.js` (append `ringChunks`)

**Interfaces:**
- Produces:
  - `ringChunks(ring, maxDeg = 0.02) → bbox[]`: it covers the ring bbox plus a 0.01° (≈ 1 km) margin, so buildings and roads crossing the seam are complete.
  - `fetch-ring.js --ring <key> [--kinds allbuildings,parts,roads,rail,water,parks,trees,stadiums,pois]`:
    - one cache file per chunk and kind, `cache/world/osm-<kind>-<ring>-<i>.json`, skipped if present;
    - ≤ 1 request per 5 s;
    - it rotates `overpass-api.de`, `overpass.kumi.systems` and `maps.mail.ru` on 429 or 5xx, with exponential backoff up to 5 min;
    - it logs its progress, and stops with a clear message after 45 min (resume by re-running).
  - `build-world.js --ring <key>`:
    - it loads only the chunks of that ring;
    - it builds only the tiles where `ringOwnsTile`;
    - light rings get no roof props and no parapets, footprint simplification of 1.0 m, a tree cap of 800 per tile, and no per-tile LOD1 file (the blocks serve it);
    - a `full` island within 400 m of any hero in the ring;
    - it writes to `public/world/.ring-<key>.tmp/`, then renames atomically and merges the manifest;
    - it samples `process.memoryUsage().rss` every 5 s, logs the peak, and fails at > 4 GB;
    - it logs the wall time.
  - `mergeManifest(prev, ringOut) → manifest`:
    - it replaces all tiles and blocks previously owned by `ringOut.ring`;
    - it keeps the others;
    - it sorts tiles and blocks by key, and dedupes landmarks by key;
    - it updates `rings[]`, `bbox` (union) and `sources`.
    - Merging the same ring twice gives the same result.

- [ ] **Step 1: Write the failing tests**

```js
// pipeline/tests/manifestMerge.test.js
import { describe, it, expect } from 'vitest'
import { mergeManifest } from '../lib/manifestMerge.js'

const base = { version: 7, rings: [{ key: 'r1' }], tiles: [{ key: '0_0', ring: 'r1' }, { key: '1_0', ring: 'r1' }], blocks: [{ key: '0_0', ring: 'r1' }], landmarks: [{ key: 'willis' }] }
const r2s = { ring: 'r2s', rect: { minX: 0, maxX: 1, minZ: 0, maxZ: 1 }, detail: 'light', tiles: [{ key: '3_9', ring: 'r2s' }, { key: '2_9', ring: 'r2s' }], blocks: [{ key: '0_2', ring: 'r2s' }], landmarks: [{ key: 'msi' }] }
describe('mergeManifest', () => {
  it('adds the ring, sorted, and keeps other rings', () => {
    const m = mergeManifest(base, r2s)
    expect(m.tiles.map((t) => t.key)).toEqual(['0_0', '1_0', '2_9', '3_9'])
    expect(m.rings.map((r) => r.key)).toEqual(['r1', 'r2s'])
    expect(m.landmarks.map((l) => l.key).sort()).toEqual(['msi', 'willis'])
  })
  it('is idempotent: merging the same ring twice changes nothing', () => {
    const once = mergeManifest(base, r2s)
    expect(mergeManifest(once, r2s)).toEqual(once)
  })
  it('a rebuilt ring replaces its old tiles (no orphans)', () => {
    const once = mergeManifest(base, r2s)
    const again = mergeManifest(once, { ...r2s, tiles: [{ key: '3_9', ring: 'r2s' }] })
    expect(again.tiles.filter((t) => t.ring === 'r2s').map((t) => t.key)).toEqual(['3_9'])
  })
})
```

```js
// append to pipeline/tests/rings.test.js
import { ringChunks } from '../lib/rings.js'
it('chunks cover the ring plus a 1 km margin, each ≤ 0.02°', () => {
  const ring = RINGS.find((r) => r.key === 'r2s')
  const cs = ringChunks(ring, 0.02)
  for (const c of cs) { expect(c.n - c.s).toBeLessThanOrEqual(0.02 + 1e-9); expect(c.e - c.w).toBeLessThanOrEqual(0.02 + 1e-9) }
  expect(Math.min(...cs.map((c) => c.s))).toBeCloseTo(ring.bbox.s - 0.01, 6)
  expect(Math.max(...cs.map((c) => c.n))).toBeCloseTo(ring.bbox.n + 0.01, 6)
})
```

- [ ] **Step 2: Run to verify they fail.** Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start.
- [ ] **Step 4: Dry run on r1** (already built): `npm run --prefix pipeline build:ring -- --ring r1`. The output must be byte-identical to the current world for r1 tiles (H4). Log the peak RSS and wall time.
- [ ] **Step 5: Run the tests to verify they pass.** Then commit. `git commit -m "feat(p6): ring-incremental fetch/build with memory, time and rate budgets"`

**Acceptance:**
- An r1 rebuild through the ring path is identical to the current world.
- The budgets are logged.
- A killed build leaves the live world untouched.

**Refresh at phase start:**
- Re-read `build-world.js` after V1–V6, P3 and P4. Every per-tile output (transit layer, `_STYLE`, V5 venue anchors, `pois`) must be produced by the ring path too.
- Measure the Phase 2.5 build's peak RSS, to confirm the 4 GB ceiling is realistic.

---

### Task 4: Build the rings in priority order; extend transit and the lake (I-6.1, I-6.2, B4)

**Files:**
- Modify: `pipeline/build/build-transit.js` (V3: union bbox; `terminusAtEdge` on clipped line ends), V4 `app/src/transit/sim.js` (despawn and respawn at `terminusAtEdge` ends), the V1 lake/shore build (shore band over the union shoreline), `pipeline/data/rings-built.json`
- Test: `pipeline/tests/transitRings.test.js`, `app/src/transit/__tests__/sim.test.js` (append)

**Interfaces:**
- Consumes: `RINGS`, `build:ring`, V3 `transit.json`, V4 `trainsAt`.
- Produces:
  - `transit.json` lines extended to the union:
    - Red to Howard; Purple to the Evanston bound (Linden, at 42.073, is just outside, so it is clipped with `terminusAtEdge: true`);
    - Yellow clipped at the west bound; Green to Garfield and Cottage Grove;
    - Blue and Pink west to Cicero; Metra Electric through Hyde Park; UP-N through Evanston.
  - `maxGap(points) → metres` (the largest distance between consecutive points), exported from `build-transit.js` helpers.
  - The sim spawns trains at `terminusAtEdge` ends as if they arrived from off-map, and despawns them when they leave, so no train visibly pops mid-track.
  - `rings-built.json`: `[{ key, builtAt, sizeMB, peakRssMB, wallS }]`, used by `sources.js` `builtRings()`.

- [ ] **Step 1: Write the failing tests**

```js
// pipeline/tests/transitRings.test.js
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { maxGap } from '../build/build-transit.js'

const path = new URL('../../app/public/world/transit.json', import.meta.url)
const transit = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
describe.skipIf(!transit)('transit across ring seams', () => {
  it('no line has a gap over 50 m (seams stitched)', () => {
    for (const l of transit.lines) for (const p of l.paths) expect(maxGap(p.points)).toBeLessThanOrEqual(50)
  })
  it('Red reaches Howard and Purple reaches the Evanston edge', () => {
    const names = (id) => transit.lines.find((l) => l.id === id).stations.map((s) => transit.stations.find((x) => x.id === s)?.name)
    expect(names('red')).toContain('Howard')
    expect(transit.lines.find((l) => l.id === 'purple').paths.some((p) => p.terminusAtEdge)).toBe(true)
  })
})
describe('maxGap', () => {
  it('measures the largest step', () => { expect(maxGap([[0, 0], [30, 40], [30, 41]])).toBe(50) })
})
```

```js
// append to app/src/transit/__tests__/sim.test.js (V4 file)
it('trains on a clipped line enter and leave at the map edge instead of reversing mid-track', () => {
  const transit = { lines: [{ id: 'purple', kind: 'cta', paths: [{ id: 'p-n', points: [[0, 0], [0, -2000]], terminusAtEdge: 'end' }] }], stations: [] }
  const seen = new Set()
  for (let t = 0; t < 3_600_000; t += 10_000) for (const tr of trainsAt(t, transit)) { seen.add(tr.id); expect(tr.s).toBeGreaterThanOrEqual(0); expect(tr.s).toBeLessThanOrEqual(2000) }
  expect(seen.size).toBeGreaterThan(1) // new trains keep arriving from off-map
})
```

- [ ] **Step 2: Run to verify they fail.** Expected: FAIL.
- [ ] **Step 3: Build the rings in priority order (one heavy process at a time).** For each ring in r2s → r2n → r3n → r2w:
  1. `fetch:ring`;
  2. `build:ring`;
  3. rebuild transit and the shore;
  4. `audit-world` (stop if over budget: revert that ring's output from the temp dir and record `Ruling: <ring> deferred — <MB> over budget`);
  5. run the tests;
  6. commit and **push** (`git commit -m "feat(p6): ring <key> — <area names>"`).
- [ ] **Step 4: Seam review per ring.** Take screenshots at each seam midpoint (Western and Addison, 35th and the lake, Howard and Sheridan, Cicero and North), day only. Log continuity of roads, rail, parks and the shoreline.

**Acceptance:**
- Each shipped ring loads within budget.
- Transit and the lake continue at the seams (I-6.2).
- Deferred rings are recorded with their measured cost.

**Refresh at phase start:**
- Confirm V3's transit build accepts a bbox parameter.
- Confirm V4's sim spawn logic (where to add `terminusAtEdge`).
- Confirm V1's shore texture can grow its band (its size budget is ≤ 4 MB).

---

### Task 5: Landmarks and places in the new rings, MSI first (I-6.2, E8)

**Files:**
- Modify: `pipeline/data/heroes.json` (`msi`, `robiehouse`, `rockefellerchapel`, `garfieldconservatory`, `grossepointlighthouse`, and `obamacenter` if completed in OSM), `pipeline/lib/landmarks.js` (the `museum` builder reused with MSI parameters: central dome, four caryatid porches, a long neoclassical block), `app/src/lib/places.js` (new neighbourhoods, views), `app/src/lib/bookmarks.js`, `app/src/lib/views.js`, `app/src/lib/grid.js`, `app/src/data/landmarks.js` (clear the "Beyond the map" flag automatically through `inWorld`), P4 `neighborhoods.curated.json` (add zones for the shipped rings)
- Test: `pipeline/tests/ringHeroes.test.js`, `app/src/lib/__tests__/places.test.js` (append), `app/src/lib/__tests__/grid.test.js` (append)

**Interfaces:**
- Produces:
  - `heroes.json` entries with `source`, an `anchor: { lat, lon }` (required even when matched by OSM id; used for the ring checks and beacons), aliases (MSI: `['MSI', 'Museum of Science and Industry', 'Science and Industry', 'Palace of Fine Arts']`), `look` rows (V2) and ring tags.
  - `NEIGHBORHOODS` added per shipped ring:
    - r2s: Hyde Park, Kenwood, Woodlawn (north), Oakland;
    - r2n: Uptown, Andersonville, Edgewater, Rogers Park, Ravenswood;
    - r3n: Evanston;
    - r2w: Logan Square, Humboldt Park, Garfield Park, Avondale.
  - `VIEW_NAMES` gains `hydepark: 'Hyde Park & the Museum of Science and Industry'`, `evanston: 'Evanston lakefront'` and `garfieldpark: 'Garfield Park Conservatory'`, each added to `VIEW_ORDER` only when its ring is built.
  - `grid.js` street tables gain:
    - EW: 39th/Pershing −3900, 47th −4700, 51st −5100, 55th/Garfield −5500, 59th −5900, Lawrence 4800, Foster 5200, Devon 6400, Howard 7600;
    - NS: California −2800, Kedzie −3200, Pulaski −4000, Cicero −4800.
  - `crossStreets` returns `'EVANSTON'` north of Howard (Evanston has its own address grid).

- [ ] **Step 1: Write the failing tests**

```js
// pipeline/tests/ringHeroes.test.js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ringOf } from '../lib/rings.js'

const heroes = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes
describe('ring landmarks', () => {
  it.each([['msi', 'r2s'], ['robiehouse', 'r2s'], ['rockefellerchapel', 'r2s'], ['grossepointlighthouse', 'r3n'], ['garfieldconservatory', 'r2w']])('%s sits in %s with a source and aliases', (key, ring) => {
    const h = heroes.find((x) => x.key === key)
    expect(h).toBeTruthy(); expect(h.source).toMatch(/^https?:/); expect(h.aliases.length).toBeGreaterThan(0)
    const { lat, lon } = h.match.synthetic ? h.match : h.anchor
    expect(ringOf(lat, lon)).toBe(ring)
  })
  it('MSI can be found by the names people use', () => {
    const msi = heroes.find((x) => x.key === 'msi')
    for (const a of ['MSI', 'Museum of Science and Industry']) expect(msi.aliases.concat(msi.name)).toContain(a)
  })
})
```

```js
// append to app/src/lib/__tests__/grid.test.js
import { crossStreets, M_PER_NUMBER } from '../grid.js'
it('names cross streets in the new rings and says EVANSTON north of Howard', () => {
  // north is −Z: 1600 N (North Ave) is z = −1600·M; 5500 S (55th/Garfield) is z = +5500·M
  expect(crossStreets(-4800 * M_PER_NUMBER, -1600 * M_PER_NUMBER)).toBe('CICERO & NORTH')
  expect(crossStreets(0, 5500 * M_PER_NUMBER)).toMatch(/& 55TH|& GARFIELD/)
  expect(crossStreets(-1000 * M_PER_NUMBER, -8600 * M_PER_NUMBER)).toBe('EVANSTON')
})
```

- [ ] **Step 2: Run to verify they fail.** Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. The MSI geometry is sourced (length ≈ 250 m, dome) and reviewed against a reference; the method is procedural via the museum builder (see the P3 method rule).
- [ ] **Step 4: Rebuild the affected rings, run the tests, and evaluate and revert at the `hydepark` view** (day, dusk, night). Commit and push. `git commit -m "feat(p6): MSI and ring landmarks, neighbourhoods, views, street names (I-6.2)"`

**Acceptance:**
- MSI is present, sourced, searchable and has a beacon.
- CHI landmarks now inside the world lose their "Beyond the map" flag.
- The minimap and ⌘K reach every new area.

**Refresh at phase start:**
- Update the list to the rings that actually shipped.
- Check P3's method table for new rows.
- Check whether P4's zone builder needs the new rings' `y6yq-dbs2` rows.

---

### Task 6: Streaming, LOD and auto-quality tuning (I-6.3)

**Files:**
- Modify: `app/src/lib/quality.js`, `app/src/lib/tilePlan.js`, `app/src/world/TileStreamer.jsx`, `app/src/world/PerfWatch.jsx`, `app/src/hud/Minimap.jsx`, the pipeline minimap render (4096 px over the union)
- Create: `app/e2e/rings.spec.js`
- Test: `app/src/lib/__tests__/quality.test.js` (append), `app/src/lib/__tests__/planWorld.test.js` (append)

**Interfaces:**
- Produces:
  - `QUALITY[q].stream`: LOW `{ lod0M: 1000, lod1M: 4500, maxLod0: 16 }`; HIGH `{ lod0M: 1600, lod1M: 7000, maxLod0: 36 }`; ULTRA `{ lod0M: 2000, lod1M: 8000, maxLod0: 48 }`. The ULTRA values are subject to the perf log.
  - `planWorld(target, manifest, current, limits = QUALITY.HIGH.stream)`. `planTiles` uses `limits` instead of constants; the defaults keep today's behaviour.
  - `autoQuality({ current, ceiling, slowStreak, fastForS, coolDownS }, sample: 'slow'|'ok'|'fast', dtS) → { next, state }`. Here `dtS` is the window length in seconds, and the returned `state` carries the updated `current`.
    - it steps down on two consecutive 'slow' windows (the existing `createPerfMeter` semantics);
    - it steps up one level only after 20 s of 'fast' (avg ≤ 12 ms), and never above `ceiling`;
    - after a step down it waits 30 s before any step up (no ping-pong).
  - `ceiling` is the last quality the user chose manually (dock, ⌘K). The default ceiling is HIGH.
  - `TileStreamer` evicts least-recently-planned LOD0 tiles when the count exceeds `maxLod0 × 1.25`, and disposes geometry through the existing `release()`.
  - Minimap: the union bounds, 4096 px, ≤ 4 MB PNG; unbuilt areas render as muted land with no buildings.

- [ ] **Step 1: Write the failing tests**

```js
// append to app/src/lib/__tests__/quality.test.js
import { autoQuality, QUALITY } from '../quality.js'
describe('auto-quality', () => {
  const s0 = { current: 'HIGH', ceiling: 'HIGH', slowStreak: 0, fastForS: 0, coolDownS: 0 }
  it('steps down on sustained slowness', () => {
    let r = autoQuality(s0, 'slow', 3); r = autoQuality(r.state, 'slow', 3); expect(r.next).toBe('LOW')
  })
  it('steps back up only after 20 s fast, and never above the user ceiling', () => {
    let st = { ...s0, current: 'LOW', coolDownS: 0 }
    for (let i = 0; i < 6; i++) st = autoQuality(st, 'fast', 3).state
    expect(st.current).toBe('LOW')
    for (let i = 0; i < 2; i++) st = autoQuality(st, 'fast', 3).state
    expect(st.current).toBe('HIGH')
    for (let i = 0; i < 20; i++) st = autoQuality(st, 'fast', 3).state
    expect(st.current).toBe('HIGH') // ceiling HIGH: never ULTRA on its own
  })
  it('waits 30 s after a downgrade before upgrading (no ping-pong)', () => {
    let r = autoQuality(s0, 'slow', 3); r = autoQuality(r.state, 'slow', 3)
    let st = r.state
    for (let i = 0; i < 9; i++) st = autoQuality(st, 'fast', 3).state
    expect(st.current).toBe('LOW')
  })
  it('stream limits shrink on LOW', () => {
    expect(QUALITY.LOW.stream.maxLod0).toBeLessThan(QUALITY.HIGH.stream.maxLod0)
  })
})
```

```js
// append to app/src/lib/__tests__/planWorld.test.js
import { planWorld } from '../tilePlan.js'
import { QUALITY } from '../quality.js'
it('respects per-quality LOD0 limits', () => {
  const tiles = Array.from({ length: 100 }, (_, i) => ({ key: `${i % 10}_${Math.floor(i / 10)}`, block: '0_0', bounds: { minX: (i % 10) * 500, maxX: (i % 10) * 500 + 500, minZ: Math.floor(i / 10) * 500, maxZ: Math.floor(i / 10) * 500 + 500 } }))
  const manifest = { tiles, blocks: [{ key: '0_0', bounds: { minX: 0, maxX: 5000, minZ: 0, maxZ: 5000 } }] }
  const lod0 = (q) => [...planWorld([2500, 2500], manifest, new Map(), QUALITY[q].stream).values()].filter((v) => v === 'lod0').length
  expect(lod0('LOW')).toBeLessThanOrEqual(16); expect(lod0('HIGH')).toBeLessThanOrEqual(36); expect(lod0('LOW')).toBeLessThan(lod0('HIGH'))
})
```

```js
// app/e2e/rings.spec.js
import { test, expect } from '@playwright/test'
import { waitForCameraRest } from './helpers.js' // G5 helper (refresh: actual name)
for (const view of ['hydepark', 'evanston', 'garfieldpark']) {
  test(`ring pose: ${view}`, async ({ page }) => {
    await page.goto(`/?view=${view}`)
    await page.waitForFunction(() => window.__worldReady === true)
    await waitForCameraRest(page)
    await expect(page).toHaveScreenshot(`ring-${view}.png`, { maxDiffPixelRatio: 0.02 })
  })
}
test('minimap flight from the Loop to Evanston never shows a hole', async ({ page }) => {
  await page.goto('/?view=loop&stats')
  await page.waitForFunction(() => window.__worldReady === true)
  await page.getByRole('button', { name: /search/i }).click()
  await page.keyboard.type('Evanston'); await page.keyboard.press('Enter')
  await waitForCameraRest(page)
  const drawCalls = await page.evaluate(() => window.__gl.info.render.calls)
  expect(drawCalls).toBeLessThanOrEqual(900)
})
```

- [ ] **Step 2: Run to verify they fail.** Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. The dock and ⌘K quality commands set the `ceiling`.
- [ ] **Step 4: Perf logs (one heavy process).** At the Streeterville, Loop, Hyde Park, Evanston and Garfield Park poses, and during a scripted Loop → Evanston → Hyde Park flight, log draw calls, triangles, fps and JS heap at LOW, HIGH and ULTRA.
- [ ] **Step 5: Run the tests and e2e** (the new baselines; 3 consecutive green runs). Commit and push. `git commit -m "perf(p6): per-quality streaming, hysteretic auto-quality with user ceiling, union minimap (I-6.3)"`

**Acceptance:**
- The perf logs meet the budgets at every pose.
- Auto-quality never oscillates, and never overrides the user upward.
- A fast Loop → Evanston flight shows no holes.

**Refresh at phase start:**
- Read `PerfWatch.jsx` and `createPerfMeter` after V8 (V8 may have changed the thresholds).
- Check whether V8 introduced LOD1 material batching that changes the draw-call math.

---

### Task 7: Phase close — help, README, push

**Files:**
- Modify: `app/src/hud/HelpOverlay.jsx` ("Search and fly": "The map now reaches Hyde Park, Evanston and Cicero — try ⌘K 'Evanston'", listing only the shipped rings), `README.md` (gallery + roadmap), `docs/screenshots/p6-*.png` (append only)
- Test: `app/src/hud/__tests__/help.test.jsx` (append)

**Interfaces:**
- Produces: the help copy generated from the shipped rings (`manifest.rings`), so it never promises an unbuilt area.

- [ ] **Step 1: Write the failing test**

```jsx
// append to app/src/hud/__tests__/help.test.jsx
it('help names only the areas that were actually built', () => {
  useStore.setState({ manifest: { rings: [{ key: 'r1' }, { key: 'r2s' }] } })
  useStore.getState().setHelpOpen(true)
  render(<HelpOverlay />)
  expect(screen.getByText(/Hyde Park/)).toBeInTheDocument()
  expect(screen.queryByText(/Evanston/)).toBeNull()
})
```

- [ ] **Step 2: Run it to fail, implement, then run it to pass.**
- [ ] **Step 3: Run the end-of-phase checklist.**
- [ ] **Step 4: README.** Append `p6-msi-dusk.png`, `p6-evanston-lakefront-day.png`, `p6-whole-city-from-the-lake-night.png`, with captions, and tick Phase 6.
- [ ] **Step 5: Commit and push.** `git commit -m "feat(p6): further rings complete — help, gallery, perf and size logs"`, then `git push origin main`.

**Acceptance:**
- I-6.1–I-6.3 are ticked.
- The shipped and deferred rings are listed in the ledger and README roadmap with their measured sizes.

**Refresh at phase start:** none beyond the shipped-ring list.

---

## End-of-phase checklist

1. `npm test --prefix pipeline` and `npm test --prefix app` are green.
2. Each shipped ring's build passes: skyline assertion, determinism (two builds identical), peak RSS ≤ 4 GB, wall ≤ 20 min.
3. `audit-world.js` shows `public/world` ≤ 200 MB and first load < 60 MB.
4. e2e: 3 consecutive green runs, including `rings.spec.js`.
5. Perf at all five poses and the scripted flight, at LOW, HIGH and ULTRA, is logged against budget.
6. Push (after every ring, and at the end).

## Rulings made while writing this plan

- Ruling: the 200 MB `public/world` budget stays binding. Rings ship in priority order (r2s Hyde Park/MSI → r2n north side → r3n Evanston → r2w west to Cicero), and any ring that does not fit is deferred with its measured cost. Cost if wrong: Evanston or the west side may not ship this phase.
- Ruling: the new rings use a `light` detail class (no roof props or parapets, 1 m simplification, trees capped, blocks instead of per-tile LOD1), with `full` islands around heroes. This follows spec §1's "lighter detail" for outer rings. Cost if wrong: outer neighbourhoods look plainer up close than the core.
- Ruling: the north bound is 42.065, which covers downtown Evanston, the Northwestern lakefill and Grosse Point Lighthouse. Linden (Wilmette) and the Bahá'í Temple stay outside. The west bound is Cicero (−87.745). Cost if wrong: the Purple Line's last stop is off-map (trains enter and leave at the edge).
- Ruling: ring builds write to a temp dir and swap atomically, with an idempotent manifest merge, so a killed build never corrupts the live world. Cost if wrong: ~2× the disk during a build.
- Ruling: auto-quality treats the user's manual choice as a ceiling, and upgrades only after 20 s of fast frames with a 30 s cool-down. Cost if wrong: a machine that recovers stays at the lower quality slightly longer.
- Ruling: the camera clamps to the union of the built ring rectangles (L-shapes allowed), sliding along the edges. Cost if wrong: none; the minimap shows the unbuilt corners as muted land.
