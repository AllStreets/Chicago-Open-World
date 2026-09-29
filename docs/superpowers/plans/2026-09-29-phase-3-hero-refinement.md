# Phase 3 — Hero Refinement and P2 Landmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Later-phase plan (master-plan ruling, 2026-09-29).** This plan is written at task, interface and test level. Code-level implementation steps are completed at phase start, because they depend on what V1–V8 actually shipped. Every task carries a **Refresh at phase start** note. Do that refresh first, edit this plan in place, then execute. Do not start before V8 has been pushed.

**Goal:** Give the recognisable towers their sculptural signatures, which are Aqua's waves, Marina City's petals and parking spiral, and the crowns of 900 N Michigan, CBOT (with Ceres) and Tribune. Then add the E8 P2 landmark set. Everything refines the Phase 2.5 procedural heroes and never recreates them.

**Architecture:** Heroes stay pipeline-built and merged into each tile's `buildings` layer, carrying the V2 `_STYLE` palette row, so draw calls do not change. New sculptural detail comes from one of two sources. Parametric forms get new pure builders in `pipeline/lib/`. Figurative forms get Blender scripts in `pipeline/heroes/scripts/`, run headless (`blender -b -P`) or through Blender MCP, then exported to `.glb` and baked into tiles by `loadBlenderMesh`. A per-hero decision table (`pipeline/data/hero-methods.json`), with a tested rule function, records which source each hero uses.

**Tech Stack:** Node pipeline (earcut, @gltf-transform 4.5, meshoptimizer, Vitest 5), Blender 5.2 (headless CLI; MCP optional), app unchanged apart from the ⌘K and beacon data.

**Spec:** `docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md`: §4.3 Heroes, Addendum A.4, Addendum B.5 (E8 P2 → Phase 3) and B.6 (`look` / `_STYLE`). Backlog: `docs/superpowers/backlog/2026-09-29-vision-backlog.md`, items I-3.1–I-3.5, E8 P2, F6, F7. Master plan: `docs/superpowers/plans/2026-09-29-vision-master-plan.md` (P3 row).

## Global Constraints

- Refine, never recreate. Each hero keeps its `heroes.json` key, match, height, `look` block and skyline validation (±8 %, Addendum A.3). The build must keep passing `assertSkyline`.
- Draw calls: +0. All new geometry is merged into the tile `buildings` layer, and LOD1 keeps the silhouette only. HIGH stays ≤ 900 draw calls per frame, including the shadow and post passes, at the wide Streeterville and Loop poses (B.1).
- Triangles: ≤ 60 k per refined hero at LOD0 and ≤ 8 k at LOD1. The whole-frame total stays ≤ 4 M (B.1).
- `public/world` stays ≤ 200 MB (B.1). Phase 3 may add at most 12 MB.
- Blender is never a build requirement. Every Blender-sourced mesh has a procedural fallback, and the build succeeds with no `.glb` present (§4.3, "the skyline is never missing a building").
- Blender scripts are checked in under `pipeline/heroes/scripts/`, and their exports go to `pipeline/heroes/out/`. Exports are committed only when ≤ 2 MB each.
- Every dimension, colour and material carries a `source` URL in `heroes.json` (backlog directive 8).
- Evaluate and revert (B.1.2): take day, dusk and night screenshots before and after at fixed poses. Anything unpleasing is reverted in its own commit, with a ledger line.
- README gallery only appends: new images go to `docs/screenshots/p3-<subject>-<time>.png`, and no existing image is touched (B.1.3).
- Human-first (B.1.4): every new landmark gets a ⌘K entry (via `aliases`), a VISIT beacon anchor and a help-card mention under "Search and fly".
- Ledger: `.superpowers/sdd/2026-09-29-phase-3-hero-refinement/progress.md`, with `Ruling:` lines.
- Push to `origin main` (AllStreets/Chicago-Open-World) at the end of the phase and after each task that changes the world build.
- RAM discipline: one heavy process at a time (a world build, or Blender, or dev server + Playwright).

## Review Focus

1. **Blender absent or failing mid-build.** A fresh clone with no Blender, or an export that is corrupt or zero-byte, must still build a complete skyline using procedural fallbacks, and log one line per fallback. This is pinned in Task 1 (`loadBlenderMesh` returns `null` on missing or corrupt files) and Task 5 (CBOT falls back to `ceresFallback`).
2. **A refined hero that grows past its skyline height or tile.** Balcony slabs or buttresses that push the top beyond ±8 %, or geometry that crosses into a neighbouring tile, must fail the build or the tests, not ship. This is pinned in Task 2 and Task 3 (top-height tests) and Task 4 (crown bounds tests).
3. **Inward-facing or degenerate triangles in new builders.** These render black or vanish under the shared façade material's backface rules. This is pinned in every builder test through the shared `frontFacing` helper (copied into each test file).
4. **P2 landmark coordinates off by a block, or outside the world.** A beacon floating in the lake or on the wrong street is a trust-breaker. This is pinned in Task 7: each entry is in bounds unless flagged `offshore`, and within 60 m of its OSM match when matched.
5. **Figurative Blender meshes exceeding the budget at close range.** For example, statues at 200 k triangles on a crowded Loop shot. This is pinned in Task 5, Task 6 and Task 9 (triangle ceilings asserted on the loaded or fallback mesh).

---

## Upstream contracts assumed (verify at phase start)

| Symbol | From | Assumed shape | Refresh check |
|---|---|---|---|
| `_STYLE` vertex attribute + `styles.json` + `style-palette.png` | V2 | per-vertex style row index, 0 = none; `heroes.json` `look` block `{ base, glass, mullion, spandrel, finish, crownLight? }` | `grep -n "_STYLE\|look" pipeline/lib/*.js pipeline/data/heroes.json` |
| `appendBuilding(acc, mesh, facade, seed, bldgIndex, style?)` | V1/V2 build | appends a mesh with `_FACADE`, `_SEED`, `_BLDG`, `_STYLE` | read `pipeline/build/build-world.js` |
| `_BLDG` unique per tile | V1 (H7) | integer per building, unique within the tile file | V1 uniqueness test exists |
| Seahorse builder | V6 (E1) | `pipeline/lib/landmarks.js` fountain builder emits 8 seahorses from one procedural unit mesh | ledger V6: "seahorses procedural" |
| Rolling stock builders | V4 (C6/C7) | `pipeline/lib/rollingstock.js` → `trains.glb` with four models `cta5000`, `cta7000`, `metraBilevel`, `metraLoco` | ledger V4, `ls app/public/world/trains.glb` |
| Façade id table | Phase 2.5/V5/V6 | `LANDMARK_FACADES` in `landmarks.js`: 21 chrome, 22 water, 23 led; V5/V6 may have added more | `grep -n "FACADES" pipeline/lib/*.js`; take the next free ids for murals |
| Manifest `landmarks[]` | 2.5 + V6 | `{ key, name, aliases, x, z, top }`, and V6 may add `beacon` | `jq '.landmarks[0]' app/public/world/manifest.json` |

---

## File Structure

```
pipeline/
  data/hero-methods.json        (create) per-hero method table: procedural | blender | keep, criteria, reason
  data/heroes.json              (modify) sourced params for aqua, marina1/2, 900michigan, cbot, tribune; P2 entries
  lib/heroMethod.js             (create) chooseMethod(criteria) — the tested decision rule
  lib/blenderMesh.js            (create) loadBlenderMesh(path, placement) → raw mesh | null
  lib/aqua.js                   (create) AQUA params, aquaOffset(floor, t), aquaSlabs(ring, opts)
  lib/marina.js                 (create) MARINA params, petalRing(), marinaTower()
  lib/crowns.js                 (modify) + pavilion(), gothicCrown()
  lib/heroes.js                 (modify) dispatch spec.sculpt → aqua | marina | ceres; CROWNS + pavilion, gothicCrown
  lib/p2landmarks.js            (create) builders: lighthouse, beachHouse, pagoda, gate, boardwalkArches, ribbonRink, canopy, muralQuads
  lib/statues.js                (create) plinth(), statueFallback(kind) procedural lathe figures
  heroes/scripts/_export.py     (create) shared Blender helpers: clear scene, apply transforms, decimate to budget, export glb (+Y up, metres)
  heroes/scripts/ceres.py       (create) CBOT Ceres (John Storrs, faceless Art Deco figure)
  heroes/scripts/seahorse.py    (create, conditional) Buckingham seahorse unit
  heroes/scripts/cta5000.py     (create, conditional) CTA 5000-series car
  heroes/scripts/cta7000.py     (create, conditional) CTA 7000-series car
  heroes/scripts/metra_bilevel.py, metra_loco.py (create, conditional)
  heroes/scripts/statue_lincoln.py, statue_grant.py, statue_goethe.py (create)
  heroes/out/*.glb              (generated) Blender exports, ≤ 2 MB each
  heroes/README.md              NOT created — usage lives in the plan and the script headers
  tests/heroMethod.test.js      (create)
  tests/blenderMesh.test.js     (create)
  tests/aqua.test.js            (create)
  tests/marina.test.js          (create)
  tests/crowns.test.js          (modify) + pavilion, gothicCrown
  tests/p2landmarks.test.js     (create)
  tests/statues.test.js         (create)
  tests/heroesP2.test.js        (create) registry validation
app/src/
  hud/HelpOverlay.jsx           (modify) "Search and fly" line mentions landmarks by nickname
  hud/__tests__/palette.test.jsx (modify) P2 aliases searchable
docs/screenshots/p3-*.png       (append only)
```

---

## Hero method table (I-3.4)

The rule is in `pipeline/lib/heroMethod.js`, and the table lives in `pipeline/data/hero-methods.json`. **Refine** means Phase 3 work is scheduled. **Keep** means the Phase 2.5 or V-milestone result stands, and the method is recorded in case of later work.

**Criteria (evaluated in this order):**
1. **Figurative or organic.** Human or animal figures, or free-form sculpture with no closed-form generator, use Blender.
2. **Parametric.** A form fully described by a few sourced measurements repeated per floor, bay or lobe uses procedural.
3. **Budget.** If the best procedural estimate is over 40 k triangles and a decimated sculpt would read better, use Blender. Otherwise use procedural.
4. **Repeated unit.** An identical object shown ≥ 4 times (seahorses, cars) is built once, by either method, and merged or instanced.
5. **Availability.** When Blender is unavailable, the Blender row falls back to its procedural stand-in, and the ledger records it.

| Key | Name | Phase 3 action | Method | Reason |
|---|---|---|---|---|
| aqua | Aqua | **Refine (I-3.1)**: undulating balcony slabs | procedural | Per-floor slab outline = footprint + smooth offset field; parametric |
| marina1, marina2 | Marina City | **Refine (I-3.2)**: 16 petal balconies per floor, open parking spiral | procedural | Lobed ring × 40 floors + helix; parametric |
| 900michigan | 900 North Michigan | **Refine (I-3.3)**: four corner pavilions with pyramidal lanterns | procedural | Four identical boxes + pyramids |
| cbot | Chicago Board of Trade | **Refine (I-3.3)**: steep pyramid roof + Ceres statue | procedural roof + **blender** Ceres | Statue is figurative |
| tribune | Tribune Tower | **Refine (I-3.3)**: octagonal Gothic crown, 8 flying buttresses, pinnacles | procedural | Arcs and pinnacles are parametric sweeps |
| buckingham | Buckingham Fountain | **Refine (conditional)**: seahorse unit | blender (if V6 shipped procedural) | Figurative animal, repeated ×8 |
| trains.glb models | CTA 5000/7000, Metra bi-level + loco | **Refine (conditional)**: body detail | blender (if V4 shipped procedural) | Curved car ends, recesses; repeated unit |
| willis, trump, stregis, aon, hancock, franklin, twopru, onechicago, 311wacker, nema, chase, watertower, 400lsd, salesforce, 110wacker, 1000m, lakepoint, wrigleybldg, mart, crain | towers | Keep | procedural | Tiers + crown primitives already match; colours are V2's |
| unitedcenter, soldierfield, wrigleyfield, ratefield, wintrust | venues | Keep (V5), except the Soldier Field colonnade detail in Task 8 | procedural | `buildVenue` owns them |
| centennialwheel, cloudgate, pritzker, chicagotheatre, adler, shedd, fieldmuseum, historicwatertower, crownhall | civic icons | Keep (Phase 2.5/V6) | procedural | Already built by `landmarks.js` |
| V6 P1 set (Navy Pier, Riverwalk, Art Institute, Crown Fountain, Lurie, BP Bridge, Picasso, Flamingo, Cultural Center, Union Station, Mart river face, Zoo & Conservatory) | P1 landmarks | Keep (V6) | per V6 | V6 owns them; Picasso and Flamingo may move to Blender here only if V6 logged them as weak |
| P2 set (Task 7 list) | P2 landmarks | **Build (I-3.5)** | procedural, except the three Lincoln Park statues (blender) | See Tasks 7–10 |

---

### Task 1: Method rule, Blender harness and mesh loader (I-3.4)

**Files:**
- Create: `pipeline/lib/heroMethod.js`, `pipeline/data/hero-methods.json`, `pipeline/lib/blenderMesh.js`, `pipeline/heroes/scripts/_export.py`
- Test: `pipeline/tests/heroMethod.test.js`, `pipeline/tests/blenderMesh.test.js`

**Interfaces:**
- Produces:
  - `chooseMethod({ figurative: boolean, parametric: boolean, procTrisEstimate: number, blenderAvailable?: boolean = true }) → 'procedural' | 'blender'`
  - `METHOD_TRI_LIMIT = 40000`
  - `hero-methods.json`: `{ methods: [{ key: string, action: 'refine'|'keep'|'build', method: 'procedural'|'blender'|'mixed', criteria: { figurative, parametric, procTrisEstimate }, reason: string }] }`
  - `async loadBlenderMesh(path: string, { at: [x, z], baseY = 0, rotationDeg = 0, scale = 1, maxTris = 60000 }) → { positions: number[], normals: number[], uvs: number[] } | null` returns `null` (never throws) when the file is missing, unreadable, has zero triangles or exceeds `maxTris`. It applies scale, then rotation about +Y (compass degrees, clockwise from north), then translation.
  - `_export.py` exposes `export_glb(obj_names, out_path, max_tris)`, which applies all transforms, triangulates, decimates to `max_tris`, and writes metres with +Y up.

- [ ] **Step 1: Write the failing tests**

```js
// pipeline/tests/heroMethod.test.js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { chooseMethod, METHOD_TRI_LIMIT } from '../lib/heroMethod.js'

const table = JSON.parse(readFileSync(new URL('../data/hero-methods.json', import.meta.url), 'utf8'))
const heroes = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes

describe('chooseMethod', () => {
  it('figurative work goes to Blender', () => {
    expect(chooseMethod({ figurative: true, parametric: false, procTrisEstimate: 5000 })).toBe('blender')
  })
  it('parametric forms stay procedural', () => {
    expect(chooseMethod({ figurative: false, parametric: true, procTrisEstimate: 30000 })).toBe('procedural')
  })
  it('non-parametric and over budget goes to Blender', () => {
    expect(chooseMethod({ figurative: false, parametric: false, procTrisEstimate: METHOD_TRI_LIMIT + 1 })).toBe('blender')
  })
  it('falls back to procedural when Blender is unavailable', () => {
    expect(chooseMethod({ figurative: true, parametric: false, procTrisEstimate: 0, blenderAvailable: false })).toBe('procedural')
  })
})

describe('hero-methods.json', () => {
  it('lists every hero key exactly once', () => {
    const listed = table.methods.map((m) => m.key)
    expect(new Set(listed).size).toBe(listed.length)
    for (const h of heroes) expect(listed).toContain(h.key)
  })
  it('every row agrees with the rule (mixed rows excepted) and gives a reason', () => {
    for (const m of table.methods) {
      expect(m.reason.length).toBeGreaterThan(10)
      if (m.method !== 'mixed') expect(chooseMethod(m.criteria)).toBe(m.method)
    }
  })
})
```

```js
// pipeline/tests/blenderMesh.test.js
import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Document, NodeIO } from '@gltf-transform/core'
import { loadBlenderMesh } from '../lib/blenderMesh.js'

let dir, cubeGlb
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'blendermesh-'))
  const doc = new Document(), buf = doc.createBuffer()
  // one triangle, 1 m tall, at the origin
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
  const nrm = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1])
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nrm).setBuffer(buf))
  doc.createScene().addChild(doc.createNode('tri').setMesh(doc.createMesh('tri').addPrimitive(prim)))
  cubeGlb = join(dir, 'tri.glb')
  await new NodeIO().write(cubeGlb, doc)
})

describe('loadBlenderMesh', () => {
  it('returns null for a missing file instead of throwing', async () => {
    expect(await loadBlenderMesh(join(dir, 'nope.glb'), { at: [0, 0] })).toBeNull()
  })
  it('returns null for a corrupt file', async () => {
    const bad = join(dir, 'bad.glb'); writeFileSync(bad, 'not a glb')
    expect(await loadBlenderMesh(bad, { at: [0, 0] })).toBeNull()
  })
  it('places, scales and rotates into world metres', async () => {
    const m = await loadBlenderMesh(cubeGlb, { at: [100, -50], baseY: 20, scale: 2, rotationDeg: 90 })
    const ys = m.positions.filter((_, i) => i % 3 === 1)
    expect(Math.min(...ys)).toBeCloseTo(20); expect(Math.max(...ys)).toBeCloseTo(22)
    // local +X (east) rotated 90° clockwise from north becomes +Z (south)
    expect(m.positions[3]).toBeCloseTo(100); expect(m.positions[5]).toBeCloseTo(-50 + 2)
  })
  it('refuses meshes over the triangle ceiling', async () => {
    expect(await loadBlenderMesh(cubeGlb, { at: [0, 0], maxTris: 0 })).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npm test --prefix pipeline -- tests/heroMethod.test.js tests/blenderMesh.test.js`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start, per the master-plan ruling. Fill `hero-methods.json` from the table above.
- [ ] **Step 4: Blender availability probe.** Run `blender --version` (headless). If it is missing, record `Ruling: Blender unavailable — all blender rows use procedural fallbacks` in the ledger and continue. Blender MCP is optional; configure it only if an interactive sculpt iteration is needed.
- [ ] **Step 5: Run the tests to verify they pass.** Same command. Expected: PASS.
- [ ] **Step 6: Commit.** `git add pipeline/lib/heroMethod.js pipeline/lib/blenderMesh.js pipeline/data/hero-methods.json pipeline/heroes/scripts/_export.py pipeline/tests/heroMethod.test.js pipeline/tests/blenderMesh.test.js && git commit -m "feat(p3): hero method rule, method table, Blender mesh loader"`

**Acceptance:**
- The method table covers every hero key.
- The rule test and the table agree.
- A missing or corrupt export never breaks a build.

**Refresh at phase start:**
- Re-list the hero keys, since V6 added the P1 landmarks.
- Check whether V4 and V6 logged the seahorses and rolling stock as procedural, which decides the conditional rows.
- Check whether `blender` is on PATH and whether Blender MCP is configured.
- Check that the `@gltf-transform/core` API is unchanged.

---

### Task 2: Aqua's waves (I-3.1)

**Files:**
- Create: `pipeline/lib/aqua.js`
- Modify: `pipeline/lib/heroes.js` (`spec.sculpt === 'aqua'` → append `aquaSlabs` to `extraMeshes`), `pipeline/data/heroes.json` (`aqua.sculpt`, `aqua.sculptParams` with `source`)
- Test: `pipeline/tests/aqua.test.js`

**Interfaces:**
- Consumes: `applyHero(b, spec)` (heroes.js), the main footprint ring `main.outer`.
- Produces:
  - `AQUA = { floors: 82, heightM: 261.8, podiumM: number, minDepth: number, maxDepth: number, thickness: 0.25 }`. The values come from `heroes.json` `aqua.sculptParams`, sourced from Studio Gang and Wikipedia. Balconies project up to about 3.7 m (12 ft).
  - `aquaOffset(floor: number, t: number, seed = 1) → number`. This is the balcony depth in metres at `floor` (0-based above the podium) and perimeter fraction `t ∈ [0, 1)`. It is smooth and deterministic, and it clamps to `minDepth` in "pool" regions.
  - `aquaSlabs(ring: [x, z][], { floors, floorH, baseY, samples = 96, thickness, seed }) → { positions, normals, uvs }`. This gives one closed slab per floor, whose outline is the ring pushed outward along the vertex normals by `aquaOffset`.

- [ ] **Step 1: Write the failing test**

```js
// pipeline/tests/aqua.test.js
import { describe, it, expect } from 'vitest'
import { AQUA, aquaOffset, aquaSlabs } from '../lib/aqua.js'

const rect = [[-30, -20], [30, -20], [30, 20], [-30, 20]]
const ys = (m) => m.positions.filter((_, i) => i % 3 === 1)
const tris = (m) => m.positions.length / 9
function frontFacing(m, center) {
  for (let i = 0; i < m.positions.length; i += 9) {
    const p = m.positions.slice(i, i + 9), n = m.normals.slice(i, i + 3)
    const u = [p[3] - p[0], p[4] - p[1], p[5] - p[2]], v = [p[6] - p[0], p[7] - p[1], p[8] - p[2]]
    const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    if (c[0] * n[0] + c[1] * n[1] + c[2] * n[2] <= 0) return false
  }
  return true
}

describe('Aqua waves', () => {
  it('balcony depth stays within the sourced range', () => {
    for (let f = 0; f < AQUA.floors; f++) for (let t = 0; t < 1; t += 0.01) {
      const d = aquaOffset(f, t)
      expect(d).toBeGreaterThanOrEqual(AQUA.minDepth - 1e-9)
      expect(d).toBeLessThanOrEqual(AQUA.maxDepth + 1e-9)
    }
  })
  it('neighbouring floors differ by at most 0.6 m, so the waves read as smooth', () => {
    for (let f = 1; f < AQUA.floors; f++) for (let t = 0; t < 1; t += 0.02)
      expect(Math.abs(aquaOffset(f, t) - aquaOffset(f - 1, t))).toBeLessThanOrEqual(0.6)
  })
  it('has flush "pools" covering 8–35 % of the façade', () => {
    let flush = 0, n = 0
    for (let f = 0; f < AQUA.floors; f++) for (let t = 0; t < 1; t += 0.01, n++) if (aquaOffset(f, t) <= AQUA.minDepth + 0.05) flush++
    expect(flush / n).toBeGreaterThan(0.08); expect(flush / n).toBeLessThan(0.35)
  })
  it('is deterministic', () => {
    expect(aquaOffset(40, 0.37)).toBe(aquaOffset(40, 0.37))
  })
  it('one slab per floor, between the podium and the roof, within budget, facing out', () => {
    const floorH = (AQUA.heightM - AQUA.podiumM) / AQUA.floors
    const m = aquaSlabs(rect, { floors: AQUA.floors, floorH, baseY: AQUA.podiumM, thickness: AQUA.thickness })
    expect(Math.min(...ys(m))).toBeGreaterThanOrEqual(AQUA.podiumM - 0.01)
    expect(Math.max(...ys(m))).toBeLessThanOrEqual(AQUA.heightM + 0.01)
    const levels = new Set(ys(m).map((y) => Math.round((y - AQUA.podiumM) / floorH)))
    expect(levels.size).toBeGreaterThanOrEqual(AQUA.floors)
    expect(tris(m)).toBeLessThanOrEqual(60000)
    expect(frontFacing(m)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.** Run `npm test --prefix pipeline -- tests/aqua.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. Wire `sculpt: 'aqua'` in `applyHero`. LOD1 keeps the plain extrusion, because `extraMeshes` go to L1 only when `keepsShapeAtDistance`. Pass a `lod0Only` flag so the slabs are skipped at LOD1.
- [ ] **Step 4: Run the test to verify it passes.** Then run the full pipeline suite: `npm test --prefix pipeline`.
- [ ] **Step 5: World build, then evaluate and revert.** Take screenshots at `?view=streeterville` plus a new pose, Aqua from Lakeshore East at ~150 m (add it to `BOOKMARKS` as test-only `aqua`), for day, dusk and night. Keep or revert, and log the result.
- [ ] **Step 6: Commit and push.** `git commit -m "feat(p3): Aqua undulating balconies (I-3.1)"`, then `git push origin main`.

**Acceptance:**
- A reference comparison against a sourced photo is logged in the ledger.
- The skyline assertion still passes.
- Draw calls are unchanged at the wide poses.

**Refresh at phase start:**
- Confirm Aqua's podium height and floor count from the source.
- Confirm `heroes.js` still returns `extraMeshes`, and how V2 attaches `_STYLE` to them, so the slabs take the white slab colour and not the glass.
- Check whether an LOD0-only flag already exists (V6 may have added one).

---

### Task 3: Marina City petals and parking spiral (I-3.2)

**Files:**
- Create: `pipeline/lib/marina.js`
- Modify: `pipeline/lib/heroes.js` (`sculpt: 'marina'` replaces the pieces with the tower build), `pipeline/data/heroes.json` (`marina1`, `marina2` `sculptParams` + `source`)
- Test: `pipeline/tests/marina.test.js`

**Interfaces:**
- Produces:
  - `MARINA = { heightM: 179, floors: 65, parkingLevels: 19, aptFrom: 21, aptTo: 60, petals: 16 }`. The sourced values live in `heroes.json`, with the radii taken from the OSM footprint at build time.
  - `petalRing(center: [x, z], rCore: number, rPetal: number, petals = 16, samplesPerPetal = 12) → [x, z][]`. This is a scalloped outline whose lobe tips are at `rPetal` and whose valleys are at `rCore`.
  - `marinaTower(center, { heightM, rCore, rPetal, floorH, parkingLevels, aptFrom, aptTo, petals }) → { core: Mesh, slabs: Mesh, ramp: Mesh, rampCentreline: [x, y, z][] }`. Here `Mesh = { positions, normals, uvs }`. The parking levels are an open helical ramp, one turn per level, around the core. The apartment floors have scalloped slabs with a recessed glass line.

- [ ] **Step 1: Write the failing test**

```js
// pipeline/tests/marina.test.js
import { describe, it, expect } from 'vitest'
import { MARINA, petalRing, marinaTower } from '../lib/marina.js'

const radius = (c) => ([x, z]) => Math.hypot(x - c[0], z - c[1])
const ys = (m) => m.positions.filter((_, i) => i % 3 === 1)
const tris = (m) => m.positions.length / 9

describe('Marina City', () => {
  it('petal ring has exactly 16 lobes reaching rPetal, with valleys at rCore', () => {
    const c = [10, -5], ring = petalRing(c, 14, 17.5, 16)
    const r = ring.map(radius(c))
    let peaks = 0
    for (let i = 0; i < r.length; i++) if (r[i] > r[(i - 1 + r.length) % r.length] && r[i] >= r[(i + 1) % r.length]) peaks++
    expect(peaks).toBe(16)
    expect(Math.max(...r)).toBeCloseTo(17.5, 1); expect(Math.min(...r)).toBeCloseTo(14, 1)
  })
  it('parking ramp rises monotonically, one turn per parking level', () => {
    const t = marinaTower([0, 0], { heightM: 179, rCore: 9, rPetal: 17.5, floorH: 179 / 65, parkingLevels: 19, aptFrom: 21, aptTo: 60, petals: 16 })
    const cl = t.rampCentreline
    for (let i = 1; i < cl.length; i++) expect(cl[i][1]).toBeGreaterThanOrEqual(cl[i - 1][1])
    let turns = 0
    for (let i = 1; i < cl.length; i++) {
      const a0 = Math.atan2(cl[i - 1][2], cl[i - 1][0]), a1 = Math.atan2(cl[i][2], cl[i][0])
      let d = a1 - a0; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI
      turns += d / (2 * Math.PI)
    }
    expect(Math.round(Math.abs(turns))).toBe(19)
  })
  it('40 petal slabs (floors 21–60), top at heightM, within 50 k tris', () => {
    const floorH = 179 / 65
    const t = marinaTower([0, 0], { heightM: 179, rCore: 9, rPetal: 17.5, floorH, parkingLevels: 19, aptFrom: 21, aptTo: 60, petals: 16 })
    const levels = new Set(ys(t.slabs).map((y) => Math.round(y / floorH)))
    expect([...levels].filter((l) => l >= 21 && l <= 61).length).toBeGreaterThanOrEqual(40)
    expect(Math.max(...ys(t.core))).toBeCloseTo(179, 0)
    expect(tris(t.core) + tris(t.slabs) + tris(t.ramp)).toBeLessThanOrEqual(50000)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.** Run `npm test --prefix pipeline -- tests/marina.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. `rCore` and `rPetal` come from the OSM footprint (the inscribed and circumscribed radii of the hull), unless `sculptParams` overrides them.
- [ ] **Step 4: Run the test to verify it passes.** Then run the full pipeline suite.
- [ ] **Step 5: World build, then evaluate and revert.** Poses: `?view=river`, plus a new test-only bookmark `marina`, looking at the corn cobs from the Wabash bridge at ~60 m. Take day, dusk and night.
- [ ] **Step 6: Commit and push.** `git commit -m "feat(p3): Marina City petals and parking spiral (I-3.2)"`

**Acceptance:**
- The river-level reference comparison is logged, and both towers read as the corn cobs at 500 m.
- The LOD1 silhouette is unchanged.

**Refresh at phase start:**
- Verify the floor split from the source (parking 1–19, laundry and storage 20, apartments 21–60, roof deck).
- Check that the two OSM ids still match.
- Check whether V2's `look` gives separate rows for concrete and glass (the slab and the recess).

---

### Task 4: Crowns — 900 N Michigan, CBOT, Tribune (I-3.3, F6)

**Files:**
- Modify: `pipeline/lib/crowns.js` (+ `pavilion`, `gothicCrown`), `pipeline/lib/heroes.js` (register them in `CROWNS`), `pipeline/data/heroes.json` (the `crowns` arrays for `900michigan`, `cbot` and `tribune`, with `source`)
- Test: `pipeline/tests/crowns.test.js` (append)

**Interfaces:**
- Consumes: the existing `frustum`, `pyramid`, `spire`, `drum` and `tri` from `crowns.js`.
- Produces:
  - `pavilion({ at: [x, z], base, top, w, d, roofH, bearingDeg = 0 }) → Mesh`. This is a box `w × d` from `base` to `top`, capped by a four-sided pyramid of height `roofH`. 900 N Michigan uses four of them, one per corner, per the sourced drawings.
  - `gothicCrown({ at: [x, z], base, top, rLantern, rPier, piers = 8, pierH, pinnacleH }) → { lantern: Mesh, piers: Mesh, buttresses: Mesh, pinnacles: Mesh, arcs: { from: [x, y, z], to: [x, y, z] }[] }`. It has an octagonal lantern, `piers` corner piers at radius `rPier`, and one flying-buttress arc per pier running from the pier top to the lantern wall. The arcs are swept tubes.
  - The CBOT roof uses the existing `pyramid({ ring, base, top })` with a `scale` ring. The Ceres statue comes in Task 5.

- [ ] **Step 1: Write the failing tests (append to crowns.test.js)**

```js
import { pavilion, gothicCrown } from '../lib/crowns.js'

describe('Phase 3 crowns', () => {
  it('pavilion: box body then pyramid cap, outward faces', () => {
    const m = pavilion({ at: [0, 0], base: 240, top: 252, w: 9, d: 9, roofH: 13 })
    expect(Math.min(...ys(m))).toBe(240); expect(Math.max(...ys(m))).toBeCloseTo(265)
    expect(frontFacing(m)).toBe(true)
  })
  it('gothicCrown: 8 buttress arcs from pier tops to the lantern wall', () => {
    const g = gothicCrown({ at: [0, 0], base: 118, top: 141, rLantern: 8, rPier: 14, piers: 8, pierH: 12, pinnacleH: 6 })
    expect(g.arcs).toHaveLength(8)
    for (const a of g.arcs) {
      expect(Math.hypot(a.from[0], a.from[2])).toBeCloseTo(14, 0)
      expect(Math.hypot(a.to[0], a.to[2])).toBeCloseTo(8, 0)
      expect(a.to[1]).toBeGreaterThan(a.from[1])
    }
    for (const part of ['lantern', 'piers', 'buttresses', 'pinnacles']) expect(frontFacing(g[part])).toBe(true)
    const all = ['lantern', 'piers', 'buttresses', 'pinnacles'].reduce((n, k) => n + g[k].positions.length / 9, 0)
    expect(all).toBeLessThanOrEqual(20000)
    expect(Math.max(...ys(g.lantern), ...ys(g.pinnacles))).toBeLessThanOrEqual(141 + 0.01)
  })
})
```

- [ ] **Step 2: Run to verify it fails.** Run `npm test --prefix pipeline -- tests/crowns.test.js`. Expected: FAIL (the new exports are missing).
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start, then update the three `heroes.json` entries with sourced dimensions.
- [ ] **Step 4: Run the tests to verify they pass, then run the full suite.** A world build must keep the three heroes within ±8 % of `skyline.json`.
- [ ] **Step 5: Evaluate and revert.** Poses: Mag Mile at ~200 m (900 N Michigan and Tribune), and LaSalle Street canyon looking south at ~120 m (CBOT). Take day, dusk and night. The 900 N Michigan lanterns take V2's `crownLight` at night, if sourced.
- [ ] **Step 6: Commit and push.** `git commit -m "feat(p3): 900 N Michigan pavilions, CBOT pyramid, Tribune Gothic crown (I-3.3)"`

**Acceptance:**
- Three reference comparisons are logged.
- The Tribune crown shows its buttresses at 150 m.

**Refresh at phase start:**
- Re-read V2's `look` rows for the Tribune limestone (F6) and the CBOT grey limestone.
- Confirm the sourced heights: Tribune 141 m; CBOT roof versus top of statue per `skyline.json`; 900 N Michigan 265 m.
- Confirm the `crowns[].type` dispatch in `heroes.js` is unchanged.

---

### Task 5: Ceres statue via Blender, with procedural fallback (I-3.3)

**Files:**
- Create: `pipeline/heroes/scripts/ceres.py`, `pipeline/lib/statues.js`
- Modify: `pipeline/lib/heroes.js` (`spec.statue` → `loadBlenderMesh` or `statueFallback`), `pipeline/data/heroes.json` (`cbot.statue = { file: 'heroes/out/ceres.glb', kind: 'ceres', heightM, topM, source }`)
- Test: `pipeline/tests/statues.test.js`

**Interfaces:**
- Consumes: `loadBlenderMesh` (Task 1).
- Produces:
  - `plinth({ at, base, w, h }) → Mesh`
  - `statueFallback(kind: 'ceres'|'lincoln'|'grant'|'goethe'|'seahorse', { at, base, heightM }) → Mesh`. This is a low-poly lathe-and-box figure that reads correctly as a silhouette at ≥ 80 m. It has ≤ 3 k triangles.
  - `async statueMesh(spec, { at, base }) → { mesh: Mesh, source: 'blender'|'fallback' }`. It tries the `.glb` first and uses the fallback otherwise. It logs `statue <kind>: fallback` once.
  - `ceres.py` builds a faceless Art Deco figure 9.4 m tall (per source) holding a wheat sheaf, decimated to ≤ 12 k triangles, and exports it with `_export.export_glb`.

- [ ] **Step 1: Write the failing test**

```js
// pipeline/tests/statues.test.js
import { describe, it, expect } from 'vitest'
import { statueFallback, statueMesh, plinth } from '../lib/statues.js'
const ys = (m) => m.positions.filter((_, i) => i % 3 === 1)

describe('statues', () => {
  for (const kind of ['ceres', 'lincoln', 'grant', 'goethe', 'seahorse']) {
    it(`${kind} fallback has the requested height and ≤ 3 k tris`, () => {
      const m = statueFallback(kind, { at: [0, 0], base: 100, heightM: 9.4 })
      expect(Math.min(...ys(m))).toBeCloseTo(100, 1)
      expect(Math.max(...ys(m))).toBeCloseTo(109.4, 0)
      expect(m.positions.length / 9).toBeLessThanOrEqual(3000)
    })
  }
  it('uses the fallback when the Blender export is absent', async () => {
    const r = await statueMesh({ kind: 'ceres', file: 'heroes/out/__missing__.glb', heightM: 9.4 }, { at: [0, 0], base: 175 })
    expect(r.source).toBe('fallback')
    expect(Math.max(...ys(r.mesh))).toBeCloseTo(184.4, 0)
  })
  it('plinth is a closed box', () => {
    const m = plinth({ at: [0, 0], base: 0, w: 3, h: 2 })
    expect(m.positions.length / 9).toBe(12)
  })
})
```

- [ ] **Step 2: Run to verify it fails.** Run `npm test --prefix pipeline -- tests/statues.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement `statues.js`.** Write the code at phase start.
- [ ] **Step 4: Run Blender (single heavy process).** Run `blender -b -P pipeline/heroes/scripts/ceres.py -- --out pipeline/heroes/out/ceres.glb`. This is skipped when Blender is unavailable (Task 1 ruling).
- [ ] **Step 5: Run the tests to verify they pass.** Then do a world build, and confirm the CBOT top matches `cbot.statue.topM` within 1 m.
- [ ] **Step 6: Evaluate and revert.** At the LaSalle canyon pose, Ceres must read as a figure and not a blob at 120 m; otherwise keep the fallback. Commit: `git commit -m "feat(p3): CBOT Ceres (Blender, with procedural fallback)"`

**Acceptance:**
- Ceres is present in both the Blender and no-Blender builds.
- The ledger records which source shipped.

**Refresh at phase start:**
- Confirm the statue height and the top height (CBOT total height per `skyline.json`).
- Confirm the Blender 5.2 Python API names used by `_export.py` (decimate modifier, glTF exporter operator arguments).

---

### Task 6: Blender refinement of seahorses and rolling stock (conditional)

Run this only for the items the V4 or V6 ledger records as "procedural". If neither applies, record `Ruling: Task 6 skipped — V4/V6 shipped final models` and move on.

**Files:**
- Create: `pipeline/heroes/scripts/seahorse.py`, `cta5000.py`, `cta7000.py`, `metra_bilevel.py`, `metra_loco.py`
- Modify: `pipeline/lib/landmarks.js` (the fountain seahorse unit: prefer `heroes/out/seahorse.glb`), `pipeline/lib/rollingstock.js` (each model: prefer `heroes/out/<model>.glb`)
- Create: `pipeline/lib/swapModel.js`
- Test: `pipeline/tests/swapModel.test.js`

**Interfaces:**
- Consumes: V4 `rollingStockModels() → { [name]: { mesh, lengthM, bogies: [number, number], impostor } }` (assumed); V6 `seahorseUnit() → Mesh` (assumed).
- Produces: `swapModel(procedural: { mesh, lengthM, bogies? }, blender: Mesh | null, { minTris, maxTris, tolerance = 0.02 }) → { mesh, lengthM, bogies?, source: 'blender'|'procedural' }`. It uses the Blender mesh only if its bounding-box length is within ±2 % of `lengthM` and its triangle count is within `[minTris, maxTris]`; otherwise it returns the procedural model unchanged. Bogie anchors and the impostor are always kept from the procedural model, so V4 articulation and LOD are untouched.

- [ ] **Step 1: Write the failing test**

```js
// pipeline/tests/swapModel.test.js
import { describe, it, expect } from 'vitest'
import { swapModel } from '../lib/swapModel.js'

const boxMesh = (len, tris) => {
  const positions = []
  for (let i = 0; i < tris; i++) positions.push(0, 0, 0, len, 0, 0, 0, 3, 0)
  return { positions, normals: positions.map(() => 0), uvs: [] }
}
const proc = { mesh: boxMesh(14.6, 2000), lengthM: 14.6, bogies: [2.5, 12.1] }

describe('swapModel', () => {
  it('takes the Blender mesh when its length and triangle count fit', () => {
    const r = swapModel(proc, boxMesh(14.62, 4000), { minTris: 2000, maxTris: 5000 })
    expect(r.source).toBe('blender'); expect(r.bogies).toEqual([2.5, 12.1])
  })
  it('keeps procedural when the length is off by more than 2 %', () => {
    expect(swapModel(proc, boxMesh(16, 4000), { minTris: 2000, maxTris: 5000 }).source).toBe('procedural')
  })
  it('keeps procedural when over the triangle budget or missing', () => {
    expect(swapModel(proc, boxMesh(14.6, 9000), { minTris: 2000, maxTris: 5000 }).source).toBe('procedural')
    expect(swapModel(proc, null, { minTris: 2000, maxTris: 5000 }).source).toBe('procedural')
  })
})
```

- [ ] **Step 2: Run to verify it fails.** Run `npm test --prefix pipeline -- tests/swapModel.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement `swapModel.js` and wire it in.** Write the code at phase start.
- [ ] **Step 4: Run Blender for each conditional script, one at a time.** Car budgets are 2–5 k triangles (B.3). The seahorse unit budget is ≤ 6 k triangles.
- [ ] **Step 5: Run the tests to verify they pass.** Then do a world build and run the app e2e. Close-up comparisons against the reference photos are logged per model. Keep only the improvements (evaluate and revert).
- [ ] **Step 6: Commit and push.** `git commit -m "feat(p3): Blender-refined seahorses and rolling stock where they improve on procedural"`

**Acceptance:**
- Per-model keep or revert lines are in the ledger.
- Train draw calls are unchanged: at most 8, with lights (B.3).

**Refresh at phase start:**
- Read V4's `rollingstock.js` and V6's fountain builder for the actual export names.
- Check whether the bogie anchors live in the model or in `sim.js`.

---

### Task 7: P2 landmark registry (I-3.5, E8 P2, E9)

**Files:**
- Modify: `pipeline/data/heroes.json` (add the P2 entries)
- Test: `pipeline/tests/heroesP2.test.js`

**Interfaces:**
- Produces: a `heroes.json` entry per P2 key: `{ key, name, aliases: string[], match: { osmId, osmType: 'way'|'relation' } | { synthetic: true, lat, lon, radius }, landmark: { type: <builder> } | crowns | look, source: string (URL), beacon?: { lat, lon, y }, offshore?: true, p2: true }`.
- The **P2 keys** and their starting coordinates are below. They are approximate and must be pinned to OSM ids at phase start.

| key | name | lat, lon (approx.) | builder / treatment |
|---|---|---|---|
| maggiedaley | Maggie Daley Park (skating ribbon) | 41.8826, −87.6186 | `ribbonRink` |
| natureboardwalk | Nature Boardwalk (South Pond pavilion) | 41.9180, −87.6340 | `boardwalkArches` |
| rookery | The Rookery | 41.8786, −87.6322 | look (red granite, brick) + corner turret crowns |
| monadnock | Monadnock Building | 41.8778, −87.6297 | look (dark brick) + flared-parapet crown (`sloped` ring) |
| marquette | Marquette Building | 41.8795, −87.6295 | look (terra cotta) + cornice |
| carbidecarbon | Carbide & Carbon Building | 41.8864, −87.6247 | look (black granite, green terra cotta, gold leaf) + gold spire crown |
| palmerhouse | Palmer House | 41.8807, −87.6268 | look (limestone, brick) |
| oldstpats | Old St. Patrick's Church | 41.8793, −87.6446 | two towers with onion and Romanesque tops (`drum` + `spire` crowns); keep `sacred.js` shaping (H5) |
| holyname | Holy Name Cathedral | 41.8960, −87.6278 | spire crown + look (limestone) |
| newberry | Newberry Library | 41.8998, −87.6311 | look (granite, Romanesque) |
| lincolnstatues | Lincoln Park statues: Standing Lincoln, Grant equestrian, Goethe | 41.9117, −87.6317 · 41.9160, −87.6310 · 41.9281, −87.6365 | Blender statues + `plinth` (Task 9) |
| northavebeach | North Avenue Beach House | 41.9146, −87.6242 | `beachHouse` (ship form, portholes, masts) |
| oakstbeach | Oak Street Beach | 41.9030, −87.6240 | concession + curved seawall walk (`beachHouse` small) |
| northerlyisland | Northerly Island pavilion (Huntington Bank Pavilion) | 41.8636, −87.6100 | `canopy` (tensile tent) |
| soldiercolonnade | Soldier Field Doric colonnades | venue `soldierfield` | extend V5 `buildVenue` colonnade: fluted Doric column rows |
| harborlighthouse | Chicago Harbor Lighthouse | 41.8894, −87.5910 | `lighthouse` (`offshore: true`, on the breakwater) |
| twelfthbeach | 12th Street Beach | 41.8641, −87.6078 | `beachHouse` small |
| pingtom | Ping Tom Park pagoda | 41.8570, −87.6340 | `pagoda` (4-tier, green tile, red columns) |
| chinatowngate | Chinatown Gate | 41.8529, −87.6320 | `gate` (paifang spanning Wentworth) |
| pilsenmurals | Pilsen murals (18th Street) | 41.8577, −87.6600 | `muralQuads` (Task 10) |

- [ ] **Step 1: Write the failing test**

```js
// pipeline/tests/heroesP2.test.js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { WORLD_BBOX } from '../lib/sources.js'

const heroes = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes
const P2 = ['maggiedaley', 'natureboardwalk', 'rookery', 'monadnock', 'marquette', 'carbidecarbon', 'palmerhouse', 'oldstpats', 'holyname', 'newberry', 'lincolnstatues', 'northavebeach', 'oakstbeach', 'northerlyisland', 'soldiercolonnade', 'harborlighthouse', 'twelfthbeach', 'pingtom', 'chinatowngate', 'pilsenmurals']
const inBox = (lat, lon) => lat >= WORLD_BBOX.s && lat <= WORLD_BBOX.n && lon >= WORLD_BBOX.w && lon <= WORLD_BBOX.e

describe('P2 landmark registry', () => {
  it('has every P2 key exactly once', () => {
    for (const k of P2) expect(heroes.filter((h) => h.key === k)).toHaveLength(1)
  })
  it('every entry cites a source and has a ⌘K alias', () => {
    for (const k of P2) {
      const h = heroes.find((x) => x.key === k)
      expect(h.source).toMatch(/^https?:\/\//)
      expect(h.aliases?.length ?? 0).toBeGreaterThanOrEqual(1)
    }
  })
  it('synthetic entries are inside the world unless flagged offshore', () => {
    for (const k of P2) {
      const h = heroes.find((x) => x.key === k)
      if (!h.match?.synthetic) continue
      if (h.offshore) { expect(h.match.lon).toBeGreaterThan(WORLD_BBOX.e - 0.01); continue }
      expect(inBox(h.match.lat, h.match.lon)).toBe(true)
    }
  })
  it('OSM matches carry the element type (H3)', () => {
    for (const k of P2) {
      const h = heroes.find((x) => x.key === k)
      if (h.match?.osmId) expect(['way', 'relation']).toContain(h.match.osmType)
    }
  })
})
```

- [ ] **Step 2: Run to verify it fails.** Run `npm test --prefix pipeline -- tests/heroesP2.test.js`. Expected: FAIL (keys missing).
- [ ] **Step 3: Pin each entry to its OSM id from the cached Overpass data.** Search the `name` tags in `pipeline/cache/world`. Where OSM has the building, use `osmId` + `osmType`; otherwise use `synthetic`. Record any coordinate that moved more than 60 m from the table above as a ledger line.
- [ ] **Step 4: Run the test to verify it passes.**
- [ ] **Step 5: Commit.** `git commit -m "feat(p3): P2 landmark registry with sources and aliases (I-3.5)"`

**Acceptance:**
- All 20 P2 keys are registered and sourced.
- The ⌘K aliases are present.

**Refresh at phase start:**
- Re-check E8 P2 against the V6 ledger: an item V6 already shipped moves out of this list.
- Check whether V1's H3 fix named the field `osmType` or something else.
- Decide whether the lighthouse, which is east of the bbox, is covered by the V1 lake or needs its own synthetic breakwater tile.

---

### Task 8: P2 builders — buildings, lakefront and park structures (I-3.5)

**Files:**
- Create: `pipeline/lib/p2landmarks.js`
- Modify: `pipeline/lib/landmarks.js` (dispatch the new `landmark.type` values), `pipeline/lib/venue.js` (the Doric colonnade option; coordinate with V5's tests)
- Test: `pipeline/tests/p2landmarks.test.js`

**Interfaces:**
- Consumes: `lathe`, `orientedBox`, `DOME` (sacred.js); `box`, `convexHull` (venue.js); `spire`, `drum`, `pyramid` (crowns.js).
- Produces (each returns `{ meshes: [{ mesh, facade, seed, part }], clear?: boolean }`, the `buildLandmark` contract):
  - `lighthouse({ at, base = 0 }, spec)`: a white conical tower, a red lantern roof and a gallery ring. Height per source (≈ 14 m above the breakwater).
  - `beachHouse(b, { style: 'ship'|'small' })`: the ship style (North Avenue) has a long hull deck, porthole rows as `led` facade quads and two mast towers.
  - `pagoda({ at, tiers: 4, baseW, tierH })`: stacked hipped roofs with upturned eaves.
  - `gate({ at, spanM, heightM, bearingDeg })`: a paifang with two columns, a lintel and a tiled roof.
  - `boardwalkArches({ at, count, spanM, heightM })`: laminated-wood rib arches (the Studio Gang pavilion).
  - `ribbonRink(pathLatLon[], widthM)`: a flat looping ribbon mesh at ground + 0.05 m, with the V2 `_STYLE` ice row.
  - `canopy({ at, w, d, peakH, masts })`: a tensile tent surface.
  - `doricColonnade({ from, to, columns, r, h })`: fluted column rows. `venue.js` calls it when `spec.colonnade` is set.

- [ ] **Step 1: Write the failing test**

```js
// pipeline/tests/p2landmarks.test.js
import { describe, it, expect } from 'vitest'
import { lighthouse, beachHouse, pagoda, gate, boardwalkArches, ribbonRink, canopy, doricColonnade } from '../lib/p2landmarks.js'

const allYs = (r) => r.meshes.flatMap(({ mesh }) => mesh.positions.filter((_, i) => i % 3 === 1))
const tris = (r) => r.meshes.reduce((n, { mesh }) => n + mesh.positions.length / 9, 0)
const square = (s) => ({ polygons: [{ outer: [[-s, -s], [s, -s], [s, s], [-s, s]], holes: [] }], centroid: [0, 0], area: 4 * s * s })

describe('P2 builders', () => {
  it('lighthouse is ~14 m tall above its base and has a lantern part', () => {
    const r = lighthouse({ at: [0, 0], base: 2 }, {})
    expect(Math.max(...allYs(r)) - 2).toBeGreaterThan(12); expect(Math.max(...allYs(r)) - 2).toBeLessThan(18)
    expect(r.meshes.some((m) => m.part === 'lantern')).toBe(true)
  })
  it('pagoda has the requested number of roof tiers', () => {
    const r = pagoda({ at: [0, 0], tiers: 4, baseW: 10, tierH: 3 })
    expect(r.meshes.filter((m) => m.part === 'roof')).toHaveLength(4)
  })
  it('gate spans the street and stays under its height', () => {
    const r = gate({ at: [0, 0], spanM: 16, heightM: 12, bearingDeg: 0 })
    const xs = r.meshes.flatMap(({ mesh }) => mesh.positions.filter((_, i) => i % 3 === 0))
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(16)
    expect(Math.max(...allYs(r))).toBeLessThanOrEqual(12.01)
  })
  it('ribbon rink lies flat on the ground', () => {
    const r = ribbonRink([[0, 0], [30, 0], [30, 30], [0, 30], [0, 0]], 4)
    for (const y of allYs(r)) expect(y).toBeCloseTo(0.05, 2)
  })
  it('every builder stays under 15 k tris', () => {
    for (const r of [lighthouse({ at: [0, 0], base: 0 }, {}), beachHouse(square(20), { style: 'ship' }), pagoda({ at: [0, 0], tiers: 4, baseW: 10, tierH: 3 }),
      gate({ at: [0, 0], spanM: 16, heightM: 12, bearingDeg: 0 }), boardwalkArches({ at: [0, 0], count: 9, spanM: 12, heightM: 8 }),
      canopy({ at: [0, 0], w: 60, d: 50, peakH: 22, masts: 4 }), doricColonnade({ from: [0, 0], to: [80, 0], columns: 16, r: 1.1, h: 14 })])
      expect(tris(r)).toBeLessThan(15000)
  })
  it('doric colonnade places exactly the requested number of columns', () => {
    const r = doricColonnade({ from: [0, 0], to: [80, 0], columns: 16, r: 1.1, h: 14 })
    expect(r.meshes.filter((m) => m.part === 'column')).toHaveLength(16)
  })
})
```

- [ ] **Step 2: Run to verify it fails.** Run `npm test --prefix pipeline -- tests/p2landmarks.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. The building-type P2s (Rookery, Monadnock, Marquette, Carbide & Carbon, Palmer House, Old St. Pat's, Holy Name, Newberry) need only `look` rows and `crowns` in `heroes.json`, with no new builder.
- [ ] **Step 4: Run the tests to verify they pass.** Then run the full pipeline suite, including V5's venue tests, since the colonnade touches `venue.js`.
- [ ] **Step 5: World build, then evaluate and revert per landmark.** Take one day and one night shot per landmark at a new test-only bookmark, and log keep or revert.
- [ ] **Step 6: Commit and push.** `git commit -m "feat(p3): P2 lakefront, park and building landmarks (I-3.5)"`

**Acceptance:**
- Each P2 structure is visible at its bookmark, with a reference comparison logged.
- Draw calls are unchanged.

**Refresh at phase start:**
- Read `buildLandmark`'s current return contract (V6 may have changed `part` or `facade` handling).
- Check whether V5's `buildVenue` already models the colonnade.
- Pick facade ids for the new materials (wood, green tile) from the free range, or express them as `_STYLE` rows on existing facades. Prefer `_STYLE`.

---

### Task 9: Lincoln Park statues (I-3.5)

**Files:**
- Create: `pipeline/heroes/scripts/statue_lincoln.py`, `statue_grant.py`, `statue_goethe.py`
- Modify: `pipeline/lib/landmarks.js` (`landmark.type: 'statues'` → a `plinth` + `statueMesh` per item)
- Test: `pipeline/tests/statues.test.js` (append)

**Interfaces:**
- Consumes: `statueMesh`, `plinth` (Task 5).
- Produces: `landmark: { type: 'statues', items: [{ kind: 'lincoln'|'grant'|'goethe', lat, lon, heightM, plinthH, bearingDeg, file, source }] }`. The Grant equestrian is on a tall arched plinth (≈ 11 m total per source).

- [ ] **Step 1: Write the failing test (append)**

```js
import { buildLandmark } from '../lib/landmarks.js'
it('statues landmark places one plinth + figure per item, within 30 k tris total', async () => {
  const b = { polygons: [{ outer: [[-5, -5], [5, -5], [5, 5], [-5, 5]], holes: [] }], centroid: [0, 0], area: 100, height: 0 }
  const r = await buildLandmark(b, { type: 'statues', items: [
    { kind: 'lincoln', local: [0, 0], heightM: 3.7, plinthH: 2, bearingDeg: 0, file: 'heroes/out/__missing__.glb' },
    { kind: 'grant', local: [40, 0], heightM: 5, plinthH: 6, bearingDeg: 90, file: 'heroes/out/__missing__.glb' },
  ] })
  expect(r.meshes.filter((m) => m.part === 'plinth')).toHaveLength(2)
  expect(r.meshes.filter((m) => m.part === 'figure')).toHaveLength(2)
  expect(r.meshes.reduce((n, { mesh }) => n + mesh.positions.length / 9, 0)).toBeLessThanOrEqual(30000)
})
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL. The existing `buildLandmark` may be synchronous; the refresh decides whether statues pre-load their meshes before the build loop, which keeps `buildLandmark` synchronous. In that case, adjust this test to pass pre-loaded meshes.
- [ ] **Step 3: Implement the code, and run Blender for the three scripts (≤ 12 k triangles each).**
- [ ] **Step 4: Run the tests to verify they pass.** Then do a world build and evaluate and revert at a Lincoln Park ~80 m bookmark.
- [ ] **Step 5: Commit and push.** `git commit -m "feat(p3): Lincoln Park statues"`

**Acceptance:**
- All three statues appear in both the Blender and fallback builds.
- A reference comparison is logged.

**Refresh at phase start:**
- Check whether `buildLandmark` is sync or async. If it is sync, pre-load the Blender meshes in `build-world.js` before the tile loop, and pass them in through `spec`.

---

### Task 10: Pilsen murals and P2 integration close-out (I-3.5)

**Files:**
- Modify: `pipeline/lib/p2landmarks.js` (`muralQuads`), `pipeline/textures/` (4 generated mural layers appended to the façade albedo array; prompts in `pipeline/textures/prompts.md`), `app/src/world/materials/facadeMaterial.js` (the layer count, if the array is sized statically)
- Modify: `app/src/hud/HelpOverlay.jsx`, `app/src/hud/__tests__/palette.test.jsx`
- Test: `pipeline/tests/p2landmarks.test.js` (append), `app/src/hud/__tests__/palette.test.jsx` (append)

**Interfaces:**
- Produces:
  - `muralQuads(walls: { a: [x, z], b: [x, z], base, top, layer: 0..3 }[]) → { meshes: [{ mesh, facade: MURAL_FACADE0 + layer, seed, part: 'mural' }] }`. Each quad is offset 0.05 m off its wall, facing outward. Its UVs span 0..1 per quad, and the shader uses the facade id to pick an unrepeated mural layer.
  - `MURAL_FACADE0`: the first free facade id (see the refresh note).
  - The mural art is original, abstract, generated in the style of Pilsen's colour palette. It never reproduces a copyrighted mural (ruling).

- [ ] **Step 1: Write the failing tests**

```js
// append to pipeline/tests/p2landmarks.test.js
import { muralQuads, MURAL_FACADE0 } from '../lib/p2landmarks.js'
it('mural quads sit just off the wall and use one of four mural layers', () => {
  const r = muralQuads([{ a: [0, 0], b: [20, 0], base: 0.5, top: 9, layer: 2 }])
  expect(r.meshes).toHaveLength(1)
  expect(r.meshes[0].facade).toBe(MURAL_FACADE0 + 2)
  const zs = r.meshes[0].mesh.positions.filter((_, i) => i % 3 === 2)
  for (const z of zs) expect(Math.abs(z)).toBeCloseTo(0.05, 2)
})
```

```jsx
// append to app/src/hud/__tests__/palette.test.jsx
it('finds P2 landmarks by the names people use', async () => {
  const { buildPlaces, searchPlaces } = await import('../../lib/places.js')
  const manifest = { landmarks: [
    { key: 'pingtom', name: 'Ping Tom Memorial Park', aliases: ['pagoda', 'Ping Tom'], x: 0, z: 3500, top: 12 },
    { key: 'harborlighthouse', name: 'Chicago Harbor Lighthouse', aliases: ['lighthouse'], x: 3000, z: -800, top: 15 },
    { key: 'carbidecarbon', name: 'Carbide & Carbon Building', aliases: ['Hard Rock Hotel', 'St. Jane'], x: 250, z: -500, top: 153 },
  ], tallest: [] }
  const places = buildPlaces(manifest, {})
  expect(searchPlaces('pagoda', places)[0].name).toBe('Ping Tom Memorial Park')
  expect(searchPlaces('lighthouse', places)[0].name).toBe('Chicago Harbor Lighthouse')
  expect(searchPlaces('carbide', places)[0].name).toBe('Carbide & Carbon Building')
})
```

- [ ] **Step 2: Run to verify they fail.** Run `npm test --prefix pipeline -- tests/p2landmarks.test.js` and `npm test --prefix app -- src/hud/__tests__/palette.test.jsx`. Expected: the pipeline test FAILS; the app test may already PASS, because aliases flow through `buildPlaces`. That is acceptable, since it guards the data.
- [ ] **Step 3: Implement the murals.** Write the code at phase start. Generate the 4 mural layers (texture pipeline), and update the help-card line under "Search and fly" to read: "⌘K — find any landmark by name or nickname: the Bean, the pagoda, the lighthouse".
- [ ] **Step 4: Run both suites.** Then do a world build, run e2e, and take the perf check at the wide Streeterville and Loop poses. Log draw calls, triangles and fps against B.1.
- [ ] **Step 5: README gallery.** Append 3–4 `docs/screenshots/p3-*.png` shots (Aqua, Marina, Tribune crown at dusk, Ping Tom) with captions under "How it came together". Update the roadmap checkbox for Phase 3.
- [ ] **Step 6: Commit and push (end of phase).** `git commit -m "feat(p3): Pilsen murals, P2 search, gallery — Phase 3 complete"`, then `git push origin main`.

**Acceptance:**
- I-3.1 through I-3.5 are all ticked in the backlog.
- Budgets are logged.
- 20 P2 landmarks are searchable in ⌘K.

**Refresh at phase start:**
- Find the façade texture-array layer count and the free facade ids after V5 and V6.
- Check whether the texture pipeline (`pipeline/textures/process.js`) can append layers without regenerating the existing ones.
- List the e2e baselines that must be regenerated.

---

## End-of-phase checklist

1. `npm test --prefix pipeline` and `npm test --prefix app` are green.
2. The world build passes the skyline assertion, with and without `pipeline/heroes/out/*.glb` (rename the directory temporarily for the second run).
3. e2e: regenerate only the baselines this phase intended to change, then get 3 consecutive green runs.
4. Perf check: ≤ 900 draw calls, ≤ 4 M triangles and 60 fps at the wide Streeterville and Loop poses; `public/world` ≤ 200 MB.
5. The ledger has a keep or revert line for every visual task.
6. Push.

## Rulings made while writing this plan

- Ruling: Blender runs headless (`blender -b -P`) for reproducible builds. Blender MCP is used only for interactive iteration and is never required. Cost if wrong: slower sculpt iteration without MCP.
- Ruling: Blender output is baked into tile `buildings` meshes at build time, not streamed as separate hero `.glb` files. Cost if wrong: a hero cannot be hot-swapped at runtime, but draw calls stay flat.
- Ruling: every Blender item has a procedural fallback, and the build never fails for lack of Blender. Cost if wrong: a figurative item may ship as a silhouette-grade stand-in.
- Ruling: Pilsen murals are original generated art in texture-array layers, not reproductions. Cost if wrong: less literal accuracy, but no copyright risk.
- Ruling: the Chicago Harbor Lighthouse ships as an `offshore` synthetic landmark east of the bbox. Cost if wrong: it may need its own breakwater geometry if V1's lake does not cover it.
- Ruling: Task 6 (the Blender refinement of seahorses and rolling stock) is conditional on the V4 and V6 ledgers. Cost if wrong: a model V4 or V6 already perfected gets re-evaluated for nothing (one evaluate-and-revert cycle).
