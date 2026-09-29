# V6 — Landmarks and Bridges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship backlog E1–E10:
- Buckingham Fountain in true detail, with its scheduled GPU water show;
- a true-shape Cloud Gate that mirrors the live sky and skyline, with people on its plaza;
- 32 named Chicago-type trunnion bascule bridges with tender houses, the DuSable bridge houses, night lights and a lift easter egg;
- the P1 civic landmarks, each registered for ⌘K and the VISIT beacon.

**Architecture:**
- Pipeline (build time):
  - Everything is procedural pipeline geometry, merged into the existing tile `buildings` layer. Colour comes from V2's per-vertex `_STYLE` palette, so no new draw calls are added there.
  - The only new tile layer is `leaves` (bascule leaves). Its vertex shader rotates each leaf about its trunnion from one float texture.
  - Bridges come from OSM movable ways, matched to a sourced `pipeline/data/bridges.json`. Their road/rail ribbons are cut over the span, so each crossing draws exactly one deck.
- App (runtime) adds a handful of single-draw-call systems:
  - fountain particles (`Points`);
  - the Cloud Gate mirror (a staggered cube camera);
  - plaza people (`InstancedMesh`);
  - bridge lights (`Points`).
- All of them are driven by pure, tested schedule and math functions.

**Tech Stack:**
- Node pipeline: earcut, gltf-transform, Vitest.
- App: Vite, React 19, React Three Fiber / three r186, zustand, Vitest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md` — Addendum B, §B.5 (binding), with B.1 standing rules. Also binding:
- backlog `docs/superpowers/backlog/2026-09-29-vision-backlog.md` (E1–E10);
- master plan `docs/superpowers/plans/2026-09-29-vision-master-plan.md`.

**Ledger:** `.superpowers/sdd/2026-09-29-v6-landmarks-bridges/progress.md`. This path is gitignored; it holds `Ruling:` lines, the perf log and reference-comparison notes. Working screenshots go in `.superpowers/sdd/2026-09-29-v6-landmarks-bridges/shots/`.

## Global Constraints

- No human in the loop. Decide, record a `Ruling:` line in the ledger, and continue. Coding waits for the user's "go ahead" (master plan).
- Budgets (B.1.6):
  - HIGH ≤ 900 draw calls per frame, including shadow and post passes, measured at the wide Streeterville and Loop poses.
  - ≤ 4 M triangles per frame; 60 fps on M-series; `public/world` ≤ 200 MB.
  - Every new system ships with a LOW-quality fallback.
- V6's own draw-call allowance (set by this plan):
  - ≤ 12 extra calls in total: `leaves` ≤ 8 (one per LOD0 tile containing a bridge), fountain particles 1, Cloud Gate 1, plaza people 1, bridge lights 1.
  - The cube camera renders at most one 128 px face per frame, on 6 of every 30 frames, and only within 1.5 km of the Bean at HIGH/ULTRA.
- Colour: use V2's per-vertex `_STYLE` index into the palette texture (`styles.json` + `style-palette.png`). V6 only **adds rows**; it never redefines the mechanism.
- Sourcing (B.1.1, backlog directive 8): every dimension, colour, schedule and position carries a `source` in pipeline data (`bridges.json`, `heroes.json`, `styles.json`) or a source comment beside the constant.
- Coordinates: local metres, origin State & Madison (41.88203 N, −87.62784 W), +X east, −Z north, +Y up (`shared/project.js`).
- Evaluate and revert (B.1.2):
  - Every visual change gets day, dusk and night screenshots at fixed poses, before and after.
  - Anything unpleasing is reverted in its own commit (`git revert --no-edit <sha>`), with a ledger line `Reverted: <what> — <why>`.
- README is history (B.1.3):
  - Never modify an existing image.
  - New gallery images are `docs/screenshots/v6-<subject>-<time>.png`, with time ∈ day|dusk|night.
  - `app/src/lib/galleryShots.js` refuses overwrites.
- Human-first (B.1.4): every feature has a button, a ⌘K entry, a help-card line and a hint-bar entry. URL parameters are for tests only.
- Live data degrades gracefully: the fountain and bridge schedules are local pure functions, with no network.
- RAM discipline:
  - Run one heavy process at a time: the world build, or dev server + Playwright, never both.
  - Close browsers when done.
- TDD: a failing test first for every pure function, pipeline builder and state machine; screenshot poses for everything visual.
- Commits end with the trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Push to `origin main` (AllStreets/Chicago-Open-World) at milestone end.
- No emojis anywhere (spec §2).
- New façade ids (shared shader, all ≥ 9 so they take the venue branch):
  - 24 `stone` (dressed stone or marble, colour from `_STYLE`)
  - 25 `grid` (open steel grid deck and lattice)
  - 26 `signal` (lamps and lenses, emissive)
  - 27 `face` (Crown Fountain LED faces)
  - 28 `bronze` (sculpture metal)
  - 12, 13 and 18 also honour `_STYLE` when it is set.

## Review Focus

These are the five inputs the spec implies but no feature test would naturally exercise — the ones most likely to bite a person. Each is pinned by a test in the task that owns the code.

1. **The Chicago clock on a UTC machine** (Task 11). At the edges of the fountain season, the operating hours and the 22:00 last show — e.g. `2026-10-15T03:15Z` is Oct 14 22:15 CDT — the show must follow Chicago time, never the host's time zone.
2. **One crossing, many OSM ways** (Tasks 4, 7). Upper and lower decks (DuSable), both carriageways, reversed way direction, and approach ways over the counterweight tail must yield exactly one bridge. No road ribbon may be left over the span: no double deck.
3. **A bridge entry that matches nothing** (Task 4). If OSM renames a street, the build must fail loudly naming the entry, unless the entry carries a `bearing`, as Lake Street does. It must never silently drop the bridge.
4. **Pressing B again, mid-lift or after the run** (Task 8). The lift restarts cleanly from the new press, the angles stay within [0°, 75°], and every leaf returns to 0 when the run ends.
5. **The Bean's cube camera at LOW or far away** (Task 14). It never renders a face at LOW or beyond 1.5 km, and the face schedule stays correct for huge frame counters. The mirror falls back to the scene environment.

## File Structure

**Pipeline (create)**
- `pipeline/lib/meshkit.js` — the shared mesh kit (moved out of `landmarks.js`):
  - `mesh`, `tri`, `quad`, `merge`, `tube`, `disc`, `slab`, `revolve`, `gridSurface`, `barrel`, `place`, `catmullRom`, `ringAround`;
  - 2D/3D vector helpers.
- `pipeline/lib/facadeIds.js` — `LANDMARK_FACADES` (the façade ids the shader knows), shared by landmarks, civic and bridges.
- `pipeline/lib/bridges.js` — bridge detection from OSM ways, ribbon cutting, bascule leaves, pits, tender and bridge houses, balustrades, lights, and the sidecar.
- `pipeline/lib/civic.js` — the P1 civic landmark builders (Crown Fountain, Lurie Garden, BP Bridge, Art Institute, the Picasso, the Flamingo, Cultural Center, Union Station, Mart river face, Navy Pier entrance and ballroom, Riverwalk, the Zoo Lion House, the Conservatory).
- `pipeline/lib/landmarkRuntime.js`:
  - `collectRuntime` — merges builders' runtime data (fountain emitters, Crown spouts, plazas, detached meshes) into `landmarks.json`;
  - `landmarkEntry` — the manifest landmark row with its beacon;
  - `validateLandmarkRegistry`.
- `pipeline/data/bridges.json` — 32 named bascule bridges in bounds, sourced.
- Tests:
  - `pipeline/tests/meshkit.test.js`
  - `pipeline/tests/bridges.test.js`
  - `pipeline/tests/bridgeParts.test.js`
  - `pipeline/tests/bridgeBuild.test.js`
  - `pipeline/tests/fountain.test.js`
  - `pipeline/tests/civic.test.js`
  - `pipeline/tests/landmarkRuntime.test.js`
  - `pipeline/tests/styles-v6.test.js`

**Pipeline (modify)**
- `pipeline/lib/landmarks.js`:
  - imports the kit;
  - new `fountain` (E1);
  - new `bean` (E3), which returns a detached mesh;
  - `seahorseUnit()`, `FOUNTAIN`, `BEAN`, `fountainEmitters`;
  - registers the `CIVIC` builders.
- `pipeline/lib/heroes.js` — `applyHero` also returns `detached` and `runtime`.
- `pipeline/build/build-world.js`:
  - bridges: detection, ribbon cuts, fixed parts into `buildings`, leaves into `leaves`, and `bridges.json`;
  - `landmarks.json` and the detached `.glb`s;
  - `match.parkOsmId`;
  - manifest `bridges` / `landmarkRuntime` / beacons.
- `pipeline/data/heroes.json` — sources, aliases and beacons for the V6 set; the new P1 entries.
- `pipeline/data/styles.json` (owned by V2) — V6 rows appended.
- `pipeline/tests/landmarks.test.js` — the bean test is updated for the true shape.

**App (create)**
- `app/src/lib/galleryShots.js` — gallery filenames with no overwrite.
- `app/src/lib/chicagoTime.js` — `chicagoClock(date)`.
- `app/src/bridges/lift.js`, `leafTexture.js`, `lights.js`, `BridgeLeaves.jsx`, `BridgeLights.jsx`.
- `app/src/landmarks/fountainSchedule.js`, `jets.js`, `FountainShow.jsx`, `crownFace.js`, `cubeFaces.js`, `CloudGate.jsx`, `plazaPeople.js`, `PlazaPeople.jsx`.
- `app/src/world/Landmarks.jsx` — loads `bridges.json` and `landmarks.json` and mounts the V6 runtime systems.
- `app/e2e/gallery.spec.js` — fixed-pose captures, run only when `GALLERY` is set.
- `app/e2e/v6-perf.spec.js` — draw calls, triangles and fps at the budget poses.
- Tests under `app/src/**/__tests__/` (named per task).

**App (modify)**
- `app/src/lib/bookmarks.js` and `app/src/lib/places.js` — V6 poses and view names.
- `app/src/world/materials/facadeMaterial.js`:
  - façades 24–28;
  - `uTime`, `uCrown`, `uCrownB`, `uLeafTex`;
  - the `USE_LEAF` vertex path;
  - `createFacadeMaterial({ leaf })`.
- `app/src/world/City.jsx` — `leafMaterial`.
- `app/src/world/TileContent.jsx` — the `leaves` layer.
- `app/src/world/Scene.jsx` — mounts `<Landmarks>`.
- `app/src/state/store.js` — `bridgeLift`, `fountainPreview`.
- `app/src/hud/CommandPalette.jsx` (exports `commands`), `HelpOverlay.jsx`, `HintBar.jsx`, `ControlDock.jsx`.
- `app/src/camera/AtlasRig.jsx` — keys B and J.
- `README.md` — the V6 gallery section (Task 20).

---

### Task 1: Preflight, V6 poses, gallery capture, and the E10 "before" shots

This task runs first because E10 requires the bridges to be captured before any bridge code changes.

**Files:**
- Create: `app/src/lib/galleryShots.js`, `app/src/lib/__tests__/galleryShots.test.js`, `app/src/lib/__tests__/v6Bookmarks.test.js`, `app/e2e/gallery.spec.js`
- Modify: `app/src/lib/bookmarks.js` (the `BOOKMARKS` object), `app/src/lib/places.js` (`VIEW_NAMES`)
- Output: `docs/screenshots/v6-bridges-before-day.png`, `…-dusk.png`, `…-night.png`

**Interfaces:**
- Consumes: `BOOKMARKS` (bookmarks.js), `VIEW_NAMES` (places.js), the `?view=`/`?time=` test params, `window.__worldReady`.
- Produces:
  - `galleryFile({ dir?: string, milestone: string, subject: string, time: 'day'|'dusk'|'night' }) → string`
  - `parseGallery(spec: string) → { view, subject, time }[]`
  - `refuseOverwrite(path: string, exists: (p) => boolean) → string` (it throws if the file exists)
  - The Playwright spec `e2e/gallery.spec.js`. It is driven by these env vars:
    - `GALLERY` (for example `river:bridges-before@day,…`)
    - `GALLERY_MILESTONE` (default `v6`)
    - `GALLERY_DIR` (default `../docs/screenshots`)
    - `GALLERY_CLOCK` (default `2026-09-28T12:05:00-05:00`, a Monday in the fountain season during the 12:00 show)
  - 19 new `BOOKMARKS` keys (listed in Step 5). Every later visual step uses them.

- [ ] **Step 1: Preflight — read what V1–V5 shipped and record the contract in the ledger**

Run these commands:
```bash
mkdir -p .superpowers/sdd/2026-09-29-v6-landmarks-bridges/shots
grep -n "export" pipeline/lib/styles.js 2>/dev/null; ls pipeline/data/styles.json
grep -n "_STYLE\|styleBase\|vStyle" app/src/world/materials/facadeMaterial.js | head
grep -n "appendBuilding\|asLayer\|bAcc" pipeline/build/build-world.js | head
grep -n "version:" pipeline/build/build-world.js
grep -n "GROUND_Y" pipeline/lib/ground.js
```
Expected: V2 has shipped `pipeline/data/styles.json`, a style resolver, a `_STYLE` attribute written by `appendBuilding`, and a GLSL palette lookup.

This plan uses these names:
- `styleIndex(key: string): number` in `pipeline/lib/styles.js` (it throws on an unknown key);
- `styles.json` rows `{ key, base: '#rrggbb', finish, source }`;
- `appendBuilding(dst, mesh, facade, seed, bldgIdx, style)`;
- GLSL varying `vStyle` and `vec3 styleBase(float style)`, declared **above** `venueAlbedo` in `FRAG_HEAD`.

Write the V2 names you actually find into the ledger, in this form:
```
Ruling: V2 contract mapping — styleIndex=<name>, appendBuilding style arg=<position>, GLSL=<varying>/<fn>; manifest version before V6=<n>, V6 writes <n+1>; GROUND_Y.roads=<value>. Cost if wrong: renames in Tasks 3, 7, 16–18.
```
Where a name differs, this plan's code uses V2's name (a mechanical rename).

> **Coordinator reconciliation (2026-09-29, after the V2 plan landed):**
> - V2 declares `uniform sampler2D uStylePal; varying float vStyle; vec4 styleTexel(int si, int col)` in `FRAG_HEAD`, and its palette has 7 columns with the base colour in column 0.
> - V6's `styleBase` is therefore a one-line helper that V6 adds right after V2's `styleTexel`:
>   `vec3 styleBase(float style) { return styleTexel(int(style + 0.5), 0).rgb; }`
> - `appendBuilding(dst, m, facade, seed, idx, style = 0)` matches V2 exactly.
> - `styleIndex` is V2's pipeline name. Where V6 wrote `sIdx(style)`, use the registry's `indexOf(key)`/`add(key, look)` from V2's `createStyleRegistry()`. If `styleBase` is declared below `venueAlbedo`, move V2's declaration up (no behaviour change) in Task 3.

- [ ] **Step 2: Write the failing tests**

`app/src/lib/__tests__/galleryShots.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { galleryFile, parseGallery, refuseOverwrite } from '../galleryShots.js'

describe('gallery shots', () => {
  it('names new gallery images v<N>-<subject>-<time>.png', () => {
    expect(galleryFile({ milestone: 'v6', subject: 'bridges-before', time: 'day' })).toBe('docs/screenshots/v6-bridges-before-day.png')
    expect(galleryFile({ dir: '/tmp/x', milestone: 'v6', subject: 'dusable', time: 'night' })).toBe('/tmp/x/v6-dusable-night.png')
  })
  it('rejects names that would not sort or read cleanly', () => {
    expect(() => galleryFile({ milestone: 'V6', subject: 'a', time: 'day' })).toThrow(/milestone/)
    expect(() => galleryFile({ milestone: 'v6', subject: 'Bridges Before', time: 'day' })).toThrow(/subject/)
    expect(() => galleryFile({ milestone: 'v6', subject: 'a', time: 'noon' })).toThrow(/time/)
  })
  it('parses view:subject@time lists', () => {
    expect(parseGallery('river:bridges-before@day, dusable:dusable-before@night')).toEqual([
      { view: 'river', subject: 'bridges-before', time: 'day' },
      { view: 'dusable', subject: 'dusable-before', time: 'night' },
    ])
    expect(() => parseGallery('river@day')).toThrow(/view:subject@time/)
  })
  it('never overwrites an existing README image', () => {
    expect(() => refuseOverwrite('docs/screenshots/phase2-loop-day.png', () => true)).toThrow(/already exists/)
    expect(refuseOverwrite('docs/screenshots/v6-new-day.png', () => false)).toBe('docs/screenshots/v6-new-day.png')
  })
})
```

`app/src/lib/__tests__/v6Bookmarks.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { BOOKMARKS } from '../bookmarks.js'
import { VIEW_NAMES } from '../places.js'

export const V6_VIEWS = ['bridges', 'dusable', 'southbranch', 'wells', 'buckingham', 'cloudgate', 'crownfountain', 'lurie', 'bpbridge', 'artinstitute', 'daleyplaza', 'federalplaza', 'culturalcenter', 'unionstation', 'martriver', 'navypierhead', 'ballroom', 'riverwalk', 'zoo']

describe('V6 poses', () => {
  it('every V6 pose exists, is named for ⌘K, looks down at its subject from close by', () => {
    for (const k of V6_VIEWS) {
      const b = BOOKMARKS[k]
      expect(b, k).toBeTruthy()
      expect(VIEW_NAMES[k], k).toBeTruthy()
      expect(b.position[1]).toBeGreaterThan(b.target[1])
      const d = Math.hypot(b.position[0] - b.target[0], b.position[2] - b.target[2])
      expect(d, k).toBeLessThan(700)
    }
  })
  it('the DuSable pose looks at the bridge where OSM puts it (287, −757)', () => {
    expect(BOOKMARKS.dusable.target[0]).toBe(287)
    expect(BOOKMARKS.dusable.target[2]).toBe(-757)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test --prefix app -- src/lib/__tests__/galleryShots.test.js src/lib/__tests__/v6Bookmarks.test.js`
Expected: FAIL. The output shows `Failed to load url ../galleryShots.js`, and `expected undefined to be truthy` for `bridges`.

- [ ] **Step 4: Implement `galleryShots.js`**

```js
// app/src/lib/galleryShots.js — README gallery filenames: new names only, never an overwrite (B.1.3).
export const GALLERY_TIMES = ['day', 'dusk', 'night']

export function galleryFile({ dir = 'docs/screenshots', milestone, subject, time }) {
  if (!/^v\d+$/.test(milestone ?? '')) throw new Error(`milestone must look like v6, got ${milestone}`)
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(subject ?? '')) throw new Error(`subject must be kebab-case, got ${subject}`)
  if (!GALLERY_TIMES.includes(time)) throw new Error(`time must be day, dusk or night, got ${time}`)
  return `${dir}/${milestone}-${subject}-${time}.png`
}

export function parseGallery(spec) {
  return spec.split(',').map((s) => s.trim()).filter(Boolean).map((item) => {
    const m = /^([a-z0-9]+):([a-z0-9-]+)@(day|dusk|night)$/.exec(item)
    if (!m) throw new Error(`gallery item must be view:subject@time, got ${item}`)
    return { view: m[1], subject: m[2], time: m[3] }
  })
}

export function refuseOverwrite(path, exists) {
  if (exists(path)) throw new Error(`${path} already exists — README images are history; pick a new subject`)
  return path
}
```

- [ ] **Step 5: Add the V6 poses and view names**

In `app/src/lib/bookmarks.js`, append these inside `BOOKMARKS`, after `willis`. Positions were verified from `pipeline/cache/world/osm-*.json` and `app/public/world/manifest.json`:
```js
  // ── V6 — landmarks and bridges (positions from OSM ways/buildings in pipeline/cache/world) ──
  bridges: { position: [180, 60, -540], target: [-420, 4, -612] },         // main stem looking west: Wabash → LaSalle
  dusable: { position: [385, 32, -680], target: [287, 5, -757] },          // DuSable Bridge, OSM centre (287, −757)
  southbranch: { position: [-760, 80, -160], target: [-850, 4, 330] },     // Randolph → Jackson bascules
  wells: { position: [-450, 35, -540], target: [-511, 6, -611] },          // Wells St double deck (L on top)
  buckingham: { position: [800, 55, 600], target: [711, 8, 693] },         // manifest (711, 692)
  cloudgate: { position: [398, 9, -46], target: [374, 5, -73] },           // manifest (374, −73)
  crownfountain: { position: [420, 26, 60], target: [340, 7, 60] },        // towers (339, 34) and (340, 86)
  lurie: { position: [575, 55, 150], target: [506, 1, 66] },
  bpbridge: { position: [650, 45, 10], target: [640, 3, -105] },
  artinstitute: { position: [262, 12, 300], target: [310, 4, 300] },       // Michigan Ave lions
  daleyplaza: { position: [-140, 30, -150], target: [-186, 8, -202] },     // the Picasso
  federalplaza: { position: [-120, 30, 250], target: [-167, 8, 303] },     // the Flamingo
  culturalcenter: { position: [330, 90, -300], target: [237, 30, -205] },
  unionstation: { position: [-930, 90, 300], target: [-1043, 20, 373] },
  martriver: { position: [-625, 45, -560], target: [-625, 40, -705] },
  navypierhead: { position: [1480, 50, -980], target: [1541, 14, -1078] }, // Family Pavilion / Headhouse
  ballroom: { position: [2250, 70, -960], target: [2361, 20, -1090] },     // Aon Grand Ballroom
  riverwalk: { position: [-250, 35, -650], target: [-450, 1, -592] },
  zoo: { position: [-380, 110, -4150], target: [-560, 5, -4500] },         // Lion House (−456, −4365), Conservatory (−598, −4706)
```
In `app/src/lib/places.js`, extend `VIEW_NAMES` with:
```js
  bridges: 'River bridges', dusable: 'DuSable Bridge', southbranch: 'South Branch bridges', wells: 'Wells Street Bridge',
  buckingham: 'Buckingham Fountain', cloudgate: 'Cloud Gate close-up', crownfountain: 'Crown Fountain', lurie: 'Lurie Garden',
  bpbridge: 'BP Bridge', artinstitute: 'Art Institute lions', daleyplaza: 'The Picasso, Daley Plaza', federalplaza: 'The Flamingo, Federal Plaza',
  culturalcenter: 'Cultural Center domes', unionstation: 'Union Station', martriver: 'Merchandise Mart from the river',
  navypierhead: 'Navy Pier entrance', ballroom: 'Navy Pier Grand Ballroom', riverwalk: 'Chicago Riverwalk', zoo: 'Lincoln Park Zoo & Conservatory',
```

- [ ] **Step 6: Create the capture spec**

`app/e2e/gallery.spec.js`:
```js
// app/e2e/gallery.spec.js — fixed-pose captures for the README gallery and the evaluate-and-revert ledger.
// Runs only when GALLERY is set, e.g. GALLERY="river:bridges-before@day,river:bridges-before@night".
import { test } from '@playwright/test'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { galleryFile, parseGallery, refuseOverwrite } from '../src/lib/galleryShots.js'

const items = process.env.GALLERY ? parseGallery(process.env.GALLERY) : []
const milestone = process.env.GALLERY_MILESTONE ?? 'v6'
const dir = process.env.GALLERY_DIR ? resolve(process.env.GALLERY_DIR) : resolve(process.cwd(), '..', 'docs', 'screenshots')
const clock = process.env.GALLERY_CLOCK ?? '2026-09-28T12:05:00-05:00' // Monday, in season, during the 12:00 fountain show

test.skip(items.length === 0, 'set GALLERY=view:subject@time,… to capture')
for (const it of items) {
  test(`gallery ${it.view} ${it.subject} @ ${it.time}`, async ({ page }) => {
    mkdirSync(dir, { recursive: true })
    const out = refuseOverwrite(galleryFile({ dir, milestone, subject: it.subject, time: it.time }), existsSync)
    await page.clock.setFixedTime(new Date(clock))
    await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
    await page.goto(`/?view=${it.view}&time=${it.time}`)
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
    await page.waitForTimeout(5000) // textures, sky tween, loading fade (V1's camera-rest wait replaces this if present)
    await page.screenshot({ path: out })
  })
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test --prefix app -- src/lib/__tests__/galleryShots.test.js src/lib/__tests__/v6Bookmarks.test.js src/lib/__tests__/places.test.js`
Expected: PASS (3 files).

- [ ] **Step 8: Capture E10 (README) and the working "before" set — before any bridge change**

The heavy process for this step is the dev server + Playwright. Run nothing else.
```bash
cd app
GALLERY="river:bridges-before@day,river:bridges-before@dusk,river:bridges-before@night" GALLERY_MILESTONE=v6 npx playwright test e2e/gallery.spec.js
GALLERY_DIR=../.superpowers/sdd/2026-09-29-v6-landmarks-bridges/shots GALLERY_MILESTONE=v6 GALLERY="bridges:bridges-before@day,bridges:bridges-before@night,dusable:dusable-before@day,dusable:dusable-before@dusk,dusable:dusable-before@night,southbranch:southbranch-before@day,wells:wells-before@dusk,buckingham:buckingham-before@day,buckingham:buckingham-before@night,cloudgate:cloudgate-before@day,cloudgate:cloudgate-before@dusk,crownfountain:crownfountain-before@day,lurie:lurie-before@day,bpbridge:bpbridge-before@day,artinstitute:artinstitute-before@day,daleyplaza:daleyplaza-before@day,federalplaza:federalplaza-before@day,culturalcenter:culturalcenter-before@night,unionstation:unionstation-before@day,martriver:martriver-before@dusk,navypierhead:navypierhead-before@day,ballroom:ballroom-before@dusk,riverwalk:riverwalk-before@day,zoo:zoo-before@day" npx playwright test e2e/gallery.spec.js
```
Expected:
- `3 passed` and then `24 passed`;
- `ls docs/screenshots/v6-bridges-before-*.png` lists three files.

Record this in the ledger:
```
Ruling: E10 file is docs/screenshots/v6-bridges-before-{day,dusk,night}.png (master-plan naming) instead of the backlog's vision-bridges-before.png. Cost if wrong: a rename.
```

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/galleryShots.js app/src/lib/__tests__/galleryShots.test.js app/src/lib/__tests__/v6Bookmarks.test.js app/src/lib/bookmarks.js app/src/lib/places.js app/e2e/gallery.spec.js docs/screenshots/v6-bridges-before-day.png docs/screenshots/v6-bridges-before-dusk.png docs/screenshots/v6-bridges-before-night.png
git commit -m "feat(v6): gallery capture that never overwrites, V6 poses and view names; E10 bridges-before shots" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Shared mesh kit, façade ids, and V6 style rows

**Files:**
- Create: `pipeline/lib/meshkit.js`, `pipeline/lib/facadeIds.js`, `pipeline/tests/meshkit.test.js`, `pipeline/tests/styles-v6.test.js`
- Modify:
  - `pipeline/lib/landmarks.js` — delete the local helpers (lines 11–55 today: `add2`…`ringAround`) and import them; re-export `LANDMARK_FACADES`;
  - `pipeline/data/styles.json` — append rows.

**Interfaces:**
- Consumes: V2's `styleIndex(key)` from `pipeline/lib/styles.js`, per the Task 1 ledger mapping.
- Produces (`meshkit.js`). Meshes are `{ positions:number[], normals:number[], uvs:number[] }`, non-indexed, in world metres:
  - `add2, sub2, mul2, dot2, len2, norm2, left(d), bearing(deg) → [x,z]`; `sub3, cross3, norm3, at3(p2, y)`
  - `mesh()`, `tri(out,a,b,c,want|null,ua?,ub?,uc?)`, `quad(out,a,b,c,d,want,[u0,v0,u1,v1]?)`, `merge(...meshes)`
  - `tube(out, a3, b3, r, sides=6, uvX=null)`, `disc(at2, r, y, sides=48)`, `ringAround(c2, r, n=24)`
  - `slab(out, c2, u2, L, W, y0, y1)` — an oriented box, L along `u2` and W across it
  - `revolve(at2, profile:[r,y][], { sides=48, lobes=0, depth=0 })` — a scalloped surface of revolution in absolute metres; the normal is the right-hand perpendicular of the profile's direction
  - `gridSurface(pt(i,j)→[x,y,z], S, T, sign=1, wrapT=true)` — normals = sign·(∂S × ∂T)
  - `barrel(c2, u2, L, W, y0, rise, n=12)` — a half-cylinder vault along u2, with end caps
  - `place(mesh, { at=[0,0], y=0, yawDeg=0, scale=1 })` — local +x → `bearing(yawDeg)`
  - `catmullRom(points2, step) → points2`
- Produces (`facadeIds.js`): `LANDMARK_FACADES = { paint:12, steel:13, wall:16, marquee:17, ivy:18, roofing:20, chrome:21, water:22, led:23, stone:24, grid:25, signal:26, face:27, bronze:28 }`.
- Produces: `V6_STYLE_KEYS` — the list in Step 6 — as rows in `styles.json`.

- [ ] **Step 1: Write the failing tests**

`pipeline/tests/meshkit.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { mesh, slab, revolve, gridSurface, place, barrel, catmullRom, bearing } from '../lib/meshkit.js'
import { LANDMARK_FACADES as F } from '../lib/facadeIds.js'

const verts = (m) => { const o = []; for (let i = 0; i < m.positions.length; i += 3) o.push(m.positions.slice(i, i + 3)); return o }
const norms = (m) => { const o = []; for (let i = 0; i < m.normals.length; i += 3) o.push(m.normals.slice(i, i + 3)); return o }

describe('meshkit', () => {
  it('slab: 12 outward triangles spanning L × W × height', () => {
    const m = slab(mesh(), [10, 5], [1, 0], 8, 4, 2, 5)
    expect(m.positions.length / 9).toBe(12)
    const p = verts(m)
    expect(Math.min(...p.map((q) => q[0]))).toBeCloseTo(6); expect(Math.max(...p.map((q) => q[0]))).toBeCloseTo(14)
    expect(Math.min(...p.map((q) => q[2]))).toBeCloseTo(3); expect(Math.max(...p.map((q) => q[2]))).toBeCloseTo(7)
    const n = norms(m)
    for (let i = 0; i < p.length; i++) {   // every normal points away from the box centre
      const d = [p[i][0] - 10, p[i][1] - 3.5, p[i][2] - 5]
      expect(n[i][0] * d[0] + n[i][1] * d[1] + n[i][2] * d[2]).toBeGreaterThan(0)
    }
  })
  it('revolve: a scalloped basin wall faces outward and its lobes pull the rim in', () => {
    const plain = revolve([0, 0], [[10, 0], [10, 2]], { sides: 32 })
    const shell = revolve([0, 0], [[10, 0], [10, 2]], { sides: 32, lobes: 8, depth: 0.1 })
    const r = (m) => verts(m).map((q) => Math.hypot(q[0], q[2]))
    expect(Math.min(...r(plain))).toBeCloseTo(10, 5)
    expect(Math.min(...r(shell))).toBeLessThan(9.5)
    const p = verts(plain), n = norms(plain)
    expect(p.every((q, i) => n[i][0] * q[0] + n[i][2] * q[2] > 0)).toBe(true)
    const water = revolve([0, 0], [[5, 1], [0, 1]], { sides: 16 })
    expect(norms(water).every((q) => q[1] > 0.99)).toBe(true)
  })
  it('gridSurface: sign flips the normals', () => {
    const pt = (i, j) => [i, 0, j]
    const up = gridSurface(pt, 2, 2, 1, false), down = gridSurface(pt, 2, 2, -1, false)
    expect(Math.sign(norms(up)[0][1])).toBe(-Math.sign(norms(down)[0][1]))
  })
  it('place: local +x follows the bearing; a 90° yaw points east', () => {
    const m = { positions: [1, 0, 0], normals: [1, 0, 0], uvs: [0, 0] }
    const p = place(m, { at: [100, 50], y: 2, yawDeg: 90 })
    expect(p.positions[0]).toBeCloseTo(101); expect(p.positions[1]).toBeCloseTo(2); expect(p.positions[2]).toBeCloseTo(50)
    expect(bearing(0)[1]).toBeCloseTo(-1)       // bearing 0 is north (−z)
  })
  it('barrel: a vault rising `rise` over y0 along u', () => {
    const p = verts(barrel([0, 0], [1, 0], 20, 10, 4, 6))
    expect(Math.max(...p.map((q) => q[1]))).toBeCloseTo(10, 1)
    expect(Math.max(...p.map((q) => q[0]))).toBeCloseTo(10, 5)
  })
  it('catmullRom passes through every control point', () => {
    const c = [[0, 0], [10, 5], [20, 0]], s = catmullRom(c, 1)
    for (const q of c) expect(s.some((p) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-9)).toBe(true)
  })
  it('façade ids match the shader', () => {
    expect(F).toMatchObject({ stone: 24, grid: 25, signal: 26, face: 27, bronze: 28, chrome: 21, water: 22, led: 23 })
  })
})
```

`pipeline/tests/styles-v6.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { styleIndex } from '../lib/styles.js'

export const V6_STYLE_KEYS = ['georgia-pink-marble', 'seahorse-bronze', 'chicago-bridge-steel', 'grid-deck-steel', 'sidewalk-concrete', 'pit-concrete',
  'tender-limestone', 'tender-glass', 'bedford-limestone', 'bedford-limestone-relief', 'lamp-post-black', 'lantern-warm', 'nav-red',
  'crown-glass-block', 'black-granite', 'lurie-hedge', 'lurie-dark-plate', 'lurie-light-plate', 'bp-deck-wood', 'gehry-stainless',
  'aic-lion-bronze', 'aic-plinth-granite', 'modern-wing-white', 'corten', 'calder-red', 'tiffany-glass', 'healy-millet-glass',
  'union-limestone', 'mart-limestone', 'navy-pier-brick', 'ballroom-dome', 'riverwalk-granite', 'conservatory-glass']

describe('V6 style rows', () => {
  const rows = JSON.parse(readFileSync(new URL('../data/styles.json', import.meta.url), 'utf8')).styles
  it('every V6 key has a sourced colour and a palette index', () => {
    for (const k of V6_STYLE_KEYS) {
      const r = rows.find((x) => x.key === k)
      expect(r, k).toBeTruthy()
      expect(r.base, k).toMatch(/^#[0-9a-f]{6}$/i)
      expect(r.source, k).toMatch(/\S{8,}/)
      expect(styleIndex(k), k).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --prefix pipeline -- tests/meshkit.test.js tests/styles-v6.test.js`
Expected: FAIL. The output shows `Failed to load url ../lib/meshkit.js`, and the style test reports `expected undefined to be truthy` for `georgia-pink-marble`.

- [ ] **Step 3: Implement `facadeIds.js` and `meshkit.js`**

`pipeline/lib/facadeIds.js`:
```js
// pipeline/lib/facadeIds.js — façade indices the shared shader draws (app/src/world/materials/facadeMaterial.js).
// 9+ take the shader's venue branch. 24–28 are V6: stone, open grid deck, signal lamps, LED faces, bronze.
export const LANDMARK_FACADES = { paint: 12, steel: 13, wall: 16, marquee: 17, ivy: 18, roofing: 20, chrome: 21, water: 22, led: 23, stone: 24, grid: 25, signal: 26, face: 27, bronze: 28 }
```

`pipeline/lib/meshkit.js`:
```js
// pipeline/lib/meshkit.js — the small mesh kit every procedural landmark and bridge builder shares.
// Meshes are raw, non-indexed { positions, normals, uvs } in world metres (+x east, −z north, +y up).
export const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]]
export const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]]
export const mul2 = (a, s) => [a[0] * s, a[1] * s]
export const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1]
export const len2 = (a) => Math.hypot(a[0], a[1])
export const norm2 = (a) => mul2(a, 1 / (len2(a) || 1))
export const left = (d) => [d[1], -d[0]]
export const bearing = (deg) => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)]
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const norm3 = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l) }
export const at3 = (p2, y) => [p2[0], y, p2[1]]

export const mesh = () => ({ positions: [], normals: [], uvs: [] })
// Push a triangle; when `want` is given the winding is flipped so the normal agrees with it.
export function tri(out, a, b, c, want, ua = [0, 0], ub = [0, 0], uc = [0, 0]) {
  const u = sub3(b, a), v = sub3(c, a)
  let n = cross3(u, v)
  const l = Math.hypot(...n)
  if (l < 1e-9) return
  if (want && n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; n = n.map((x) => -x) }
  for (const [p, t] of [[a, ua], [b, ub], [c, uc]]) { out.positions.push(...p); out.normals.push(n[0] / l || 0, n[1] / l || 0, n[2] / l || 0); out.uvs.push(...t) }
}
export function quad(out, a, b, c, d, want, [u0, v0, u1, v1] = [0, 0, 1, 1]) {
  tri(out, a, b, c, want, [u0, v0], [u1, v0], [u1, v1]); tri(out, a, c, d, want, [u0, v0], [u1, v1], [u0, v1])
  return out
}
export const merge = (...ms) => { const o = mesh(); for (const m of ms) for (const k of ['positions', 'normals', 'uvs']) o[k].push(...m[k]); return o }

// Cylinder between two 3D points; uvX pins the u coordinate (the wheel's LEDs read their angle from it).
export function tube(out, a, b, r, sides = 6, uvX = null) {
  const d = norm3(sub3(b, a)), h = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const e1 = norm3(cross3(d, h)), e2 = cross3(d, e1)
  const ring = (p) => Array.from({ length: sides }, (_, k) => {
    const t = (k / sides) * Math.PI * 2, o = [e1[0] * Math.cos(t) + e2[0] * Math.sin(t), e1[1] * Math.cos(t) + e2[1] * Math.sin(t), e1[2] * Math.cos(t) + e2[2] * Math.sin(t)]
    return { p: [p[0] + o[0] * r, p[1] + o[1] * r, p[2] + o[2] * r], o }
  })
  const A = ring(a), B = ring(b), len = Math.hypot(...sub3(b, a))
  for (let k = 0; k < sides; k++) {
    const k2 = (k + 1) % sides, want = A[k].o.map((x, i) => x + A[k2].o[i])
    const u0 = uvX ?? k / sides, u1 = uvX ?? (k + 1) / sides
    tri(out, A[k].p, A[k2].p, B[k2].p, want, [u0, 0], [u1, 0], [u1, len]); tri(out, A[k].p, B[k2].p, B[k].p, want, [u0, 0], [u1, len], [u0, len])
  }
  return out
}
export function disc(at, r, y, sides = 48) {
  const out = mesh()
  for (let k = 0; k < sides; k++) {
    const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2
    const p0 = [at[0] + r * Math.cos(a0), y, at[1] + r * Math.sin(a0)], p1 = [at[0] + r * Math.cos(a1), y, at[1] + r * Math.sin(a1)]
    tri(out, [at[0], y, at[1]], p0, p1, [0, 1, 0], [at[0], at[1]], [p0[0], p0[2]], [p1[0], p1[2]])
  }
  return out
}
export const ringAround = (c, r, n = 24) => Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos((i / n) * Math.PI * 2), c[1] + r * Math.sin((i / n) * Math.PI * 2)])

// Oriented box: centre c (x,z), axis u (unit x,z), length L along u, width W across, heights y0..y1. Walls get metre UVs.
export function slab(out, c, u, L, W, y0, y1) {
  const v = left(u), hl = L / 2, hw = W / 2
  const P = (a, b, y) => at3(add2(add2(c, mul2(u, a)), mul2(v, b)), y)
  const cs = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]]
  for (let i = 0; i < 4; i++) {
    const [a0, b0] = cs[i], [a1, b1] = cs[(i + 1) % 4], n = add2(mul2(u, (a0 + a1) / 2), mul2(v, (b0 + b1) / 2))
    quad(out, P(a0, b0, y0), P(a1, b1, y0), P(a1, b1, y1), P(a0, b0, y1), [n[0], 0, n[1]], [0, y0, Math.hypot(a1 - a0, b1 - b0), y1])
  }
  quad(out, P(-hl, -hw, y1), P(hl, -hw, y1), P(hl, hw, y1), P(-hl, hw, y1), [0, 1, 0], [0, 0, L, W])
  quad(out, P(-hl, -hw, y0), P(hl, -hw, y0), P(hl, hw, y0), P(-hl, hw, y0), [0, -1, 0], [0, 0, L, W])
  return out
}

// Surface of revolution from an absolute [radius, height] profile. The normal is the profile direction turned
// clockwise in the (r, y) plane: walking up an outer wall faces out, walking inward faces up.
// lobes/depth scallop the radius: r·(1 − depth·|sin(lobes·θ/2)|), the shell edge of Buckingham's basins.
export function revolve(at, profile, { sides = 48, lobes = 0, depth = 0 } = {}) {
  const out = mesh(), f = (a) => 1 - depth * Math.abs(Math.sin((lobes * a) / 2))
  const P = (r, y, a) => [at[0] + Math.cos(a) * r * f(a), y, at[1] + Math.sin(a) * r * f(a)]
  for (let j = 0; j < profile.length - 1; j++) {
    const [r0, y0] = profile[j], [r1, y1] = profile[j + 1], n = [y1 - y0, -(r1 - r0)]
    for (let k = 0; k < sides; k++) {
      const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2, am = (a0 + a1) / 2
      const want = [Math.cos(am) * n[0], n[1], Math.sin(am) * n[0]]
      const A = P(r0, y0, a0), B = P(r0, y0, a1), C = P(r1, y1, a1), D = P(r1, y1, a0)
      tri(out, A, B, C, want, [a0 * r0, y0], [a1 * r0, y0], [a1 * r1, y1]); tri(out, A, C, D, want, [a0 * r0, y0], [a1 * r1, y1], [a0 * r1, y1])
    }
  }
  return out
}

// Parametric patch pt(i, j) for i ∈ [0, S], j ∈ [0, T]; normals = sign · (∂/∂i × ∂/∂j), taken per quad from its diagonals.
export function gridSurface(pt, S, T, sign = 1, wrapT = true) {
  const out = mesh()
  for (let i = 0; i < S; i++) for (let j = 0; j < T; j++) {
    const j1 = wrapT ? (j + 1) % T : j + 1
    const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j1), d = pt(i, j1)
    const n = cross3(sub3(c, a), sub3(d, b)).map((x) => x * sign)
    tri(out, a, b, c, n, [i, j], [i + 1, j], [i + 1, j + 1]); tri(out, a, c, d, n, [i, j], [i + 1, j + 1], [i, j + 1])
  }
  return out
}

// Half-cylinder (elliptical) vault along u: base y0, crown y0 + rise, with end caps.
export function barrel(c, u, L, W, y0, rise, n = 12) {
  const out = mesh(), v = left(u)
  const P = (a, k) => { const t = (k / n) * Math.PI; return at3(add2(add2(c, mul2(u, a)), mul2(v, (Math.cos(t) * W) / 2)), y0 + Math.sin(t) * rise) }
  for (let k = 0; k < n; k++) {
    const mid = (k + 0.5) / n * Math.PI, want = [v[0] * Math.cos(mid), Math.sin(mid), v[1] * Math.cos(mid)]
    quad(out, P(-L / 2, k), P(L / 2, k), P(L / 2, k + 1), P(-L / 2, k + 1), want, [0, k, L, k + 1])
  }
  for (const s of [-1, 1]) for (let k = 0; k < n; k++) tri(out, at3(add2(c, mul2(u, (s * L) / 2)), y0), P((s * L) / 2, k), P((s * L) / 2, k + 1), [u[0] * s, 0, u[1] * s])
  return out
}

// Rotate a local mesh (x forward, y up, z right) so +x points along bearing(yawDeg), then move and scale it.
export function place(m, { at = [0, 0], y = 0, yawDeg = 0, scale = 1 } = {}) {
  const f = bearing(yawDeg), r = [-f[1], f[0]], out = mesh()
  for (let i = 0; i < m.positions.length; i += 3) {
    const x = m.positions[i], yy = m.positions[i + 1], z = m.positions[i + 2]
    out.positions.push(at[0] + (f[0] * x + r[0] * z) * scale, y + yy * scale, at[1] + (f[1] * x + r[1] * z) * scale)
    const nx = m.normals[i], ny = m.normals[i + 1], nz = m.normals[i + 2]
    out.normals.push(f[0] * nx + r[0] * nz, ny, f[1] * nx + r[1] * nz)
  }
  out.uvs.push(...m.uvs)
  return out
}

// Uniform Catmull–Rom resampling of a 2D polyline (~`step` metres apart), through every control point.
export function catmullRom(points, step) {
  const out = []
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)]
    const n = Math.max(1, Math.ceil(len2(sub2(p2, p1)) / step))
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)))
    }
  }
  out.push([...points[points.length - 1]])
  return out
}
```

In `pipeline/lib/landmarks.js`:
- Replace the helper block (from `export const LANDMARK_FACADES` through `const ringAround = …`) with:
```js
import { add2, mul2, left, bearing, sub3, at3, mesh, tri, merge, tube, disc, ringAround } from './meshkit.js'
import { LANDMARK_FACADES } from './facadeIds.js'
export { LANDMARK_FACADES }
const F = LANDMARK_FACADES
```
- Keep `hullOf` and `obOf`.
- Remove the now-unused `cross3`/`norm3` imports if your linter flags them.

- [ ] **Step 4: Append the V6 rows to `pipeline/data/styles.json`**

Add these to the `styles` array, in V2's row shape (adapt the field names per the Task 1 ledger). Each `source` is the page that fixes the colour, or "photo-matched" plus the reference photo page:
```json
{ "key": "georgia-pink-marble", "base": "#d8b4a6", "finish": "stone", "source": "https://en.wikipedia.org/wiki/Buckingham_Fountain (Georgia pink marble; photo-matched)" },
{ "key": "seahorse-bronze", "base": "#58705c", "finish": "metal", "source": "https://en.wikipedia.org/wiki/Buckingham_Fountain (bronze seahorses, verdigris patina; photo-matched)" },
{ "key": "chicago-bridge-steel", "base": "#5f6b72", "finish": "metal", "source": "https://www.chicagoloopbridges.com/ (CDOT bascule paint; photo-matched)" },
{ "key": "grid-deck-steel", "base": "#8b9095", "finish": "metal", "source": "https://www.chicagoloopbridges.com/ (open steel grid decks; photo-matched)" },
{ "key": "sidewalk-concrete", "base": "#b8b4aa", "finish": "concrete", "source": "photo-matched, Chicago bridge sidewalks" },
{ "key": "pit-concrete", "base": "#6e6c67", "finish": "concrete", "source": "https://en.wikipedia.org/wiki/Bascule_bridge (counterweight pits; photo-matched)" },
{ "key": "tender-limestone", "base": "#cdc3ad", "finish": "limestone", "source": "https://www.chicagoloopbridges.com/ (bridge-tender houses; photo-matched)" },
{ "key": "tender-glass", "base": "#3c4a55", "finish": "glass", "source": "https://www.chicagoloopbridges.com/ (post-war tender houses; photo-matched)" },
{ "key": "bedford-limestone", "base": "#d4cab4", "finish": "limestone", "source": "https://en.wikipedia.org/wiki/DuSable_Bridge (Bedford stone bridgehouses)" },
{ "key": "bedford-limestone-relief", "base": "#ddd3bd", "finish": "limestone", "source": "https://en.wikipedia.org/wiki/DuSable_Bridge (Fraser and Hering reliefs, 1928)" },
{ "key": "lamp-post-black", "base": "#202326", "finish": "metal", "source": "photo-matched, Chicago bridge lamp standards" },
{ "key": "lantern-warm", "base": "#ffd49a", "finish": "glass", "source": "photo-matched, sodium/LED warm lanterns on Chicago bridges" },
{ "key": "nav-red", "base": "#ff2a18", "finish": "glass", "source": "33 CFR 118 (drawbridge lighting: red lights mark the span)" },
{ "key": "crown-glass-block", "base": "#c9d3d1", "finish": "glass", "source": "https://en.wikipedia.org/wiki/Crown_Fountain (glass-brick towers)" },
{ "key": "black-granite", "base": "#1b1c1e", "finish": "granite", "source": "https://en.wikipedia.org/wiki/Crown_Fountain (black granite reflecting pool)" },
{ "key": "lurie-hedge", "base": "#2e4a26", "finish": "stone", "source": "https://en.wikipedia.org/wiki/Lurie_Garden (Shoulder Hedge)" },
{ "key": "lurie-dark-plate", "base": "#5a4a78", "finish": "stone", "source": "https://en.wikipedia.org/wiki/Lurie_Garden (dark plate: salvia; photo-matched)" },
{ "key": "lurie-light-plate", "base": "#c2ad6e", "finish": "stone", "source": "https://en.wikipedia.org/wiki/Lurie_Garden (light plate; photo-matched)" },
{ "key": "bp-deck-wood", "base": "#8a6a4a", "finish": "stone", "source": "https://en.wikipedia.org/wiki/BP_Pedestrian_Bridge (hardwood deck)" },
{ "key": "gehry-stainless", "base": "#c8cbcd", "finish": "metal", "source": "https://en.wikipedia.org/wiki/BP_Pedestrian_Bridge (brushed stainless steel)" },
{ "key": "aic-lion-bronze", "base": "#3e5a4b", "finish": "metal", "source": "https://en.wikipedia.org/wiki/Art_Institute_of_Chicago_Building (Kemeys bronze lions; photo-matched)" },
{ "key": "aic-plinth-granite", "base": "#8d8a86", "finish": "granite", "source": "photo-matched, Art Institute lion plinths" },
{ "key": "modern-wing-white", "base": "#e8eaea", "finish": "metal", "source": "https://en.wikipedia.org/wiki/Modern_Wing (aluminium 'flying carpet' canopy)" },
{ "key": "corten", "base": "#7b3d22", "finish": "metal", "source": "https://en.wikipedia.org/wiki/Chicago_Picasso (Cor-Ten steel)" },
{ "key": "calder-red", "base": "#c6331f", "finish": "paint", "source": "https://en.wikipedia.org/wiki/Flamingo_(sculpture) (vermilion 'Calder red')" },
{ "key": "tiffany-glass", "base": "#d9a441", "finish": "glass", "source": "https://en.wikipedia.org/wiki/Chicago_Cultural_Center (Tiffany dome, Preston Bradley Hall)" },
{ "key": "healy-millet-glass", "base": "#9fb7c4", "finish": "glass", "source": "https://en.wikipedia.org/wiki/Chicago_Cultural_Center (Healy & Millet dome, G.A.R. Hall)" },
{ "key": "union-limestone", "base": "#cdc2aa", "finish": "limestone", "source": "https://en.wikipedia.org/wiki/Chicago_Union_Station (Bedford limestone)" },
{ "key": "mart-limestone", "base": "#c8b79a", "finish": "limestone", "source": "https://en.wikipedia.org/wiki/Merchandise_Mart (limestone and terra cotta; photo-matched)" },
{ "key": "navy-pier-brick", "base": "#9f5a40", "finish": "stone", "source": "https://en.wikipedia.org/wiki/Navy_Pier (Headhouse brick; photo-matched)" },
{ "key": "ballroom-dome", "base": "#d9d3c6", "finish": "metal", "source": "https://en.wikipedia.org/wiki/Navy_Pier (Aon Grand Ballroom dome; photo-matched)" },
{ "key": "riverwalk-granite", "base": "#9b958d", "finish": "granite", "source": "https://en.wikipedia.org/wiki/Chicago_Riverwalk (granite paving; photo-matched)" },
{ "key": "conservatory-glass", "base": "#b8d0cc", "finish": "glass", "source": "https://en.wikipedia.org/wiki/Lincoln_Park_Conservatory (glass palm house)" }
```

- [ ] **Step 5: Run the tests to verify they pass, with no regressions**

Run: `npm test --prefix pipeline -- tests/meshkit.test.js tests/styles-v6.test.js tests/landmarks.test.js`
Expected: PASS. The existing landmark tests still pass unchanged, because only the helpers moved.

- [ ] **Step 6: Commit**

```bash
git add pipeline/lib/meshkit.js pipeline/lib/facadeIds.js pipeline/lib/landmarks.js pipeline/data/styles.json pipeline/tests/meshkit.test.js pipeline/tests/styles-v6.test.js
git commit -m "refactor(v6): shared mesh kit (slab, scalloped revolve, grid surfaces, barrel, place, Catmull-Rom), façade ids 24-28, sourced V6 style rows" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Shader — façades 24–28, the Crown face uniforms, styled paint/steel/planting

**Files:**
- Modify: `app/src/world/materials/facadeMaterial.js`
- Test: `app/src/world/materials/__tests__/facadeV6.test.js`

**Interfaces:**
- Consumes: V2's `vStyle` varying and `vec3 styleBase(float)` (Task 1 mapping).
- Produces:
  - `facadeUniforms.uTime: { value: number }` (seconds; set by `Landmarks.jsx`, Task 8)
  - `facadeUniforms.uCrown` and `uCrownB: { value: THREE.Vector4 }` — `x` face id, `y` pucker 0..1, `z` smile 0..1, `w` 1
  - façade semantics:
    - 24 stone = `styleBase` × ashlar joints
    - 25 grid = steel bars over a near-black gap
    - 26 signal = `styleBase`, emissive (0.25 by day, 3.75 at night)
    - 27 face = the procedural LED face, emissive; `vSeed < 0.5` reads `uCrown`, otherwise `uCrownB`
    - 28 bronze = `styleBase` with patina grain, metalness 0.85, roughness 0.35
    - 12, 13 and 18 use `styleBase` when `vStyle > 0.5`

- [ ] **Step 1: Write the failing test**

`app/src/world/materials/__tests__/facadeV6.test.js`:
```js
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { patchFacadeShader, facadeUniforms } from '../facadeMaterial.js'

const std = () => ({ vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} })

describe('V6 façade surfaces', () => {
  it('draws stone, grid deck, signal lamps, LED faces and bronze', () => {
    const s = patchFacadeShader(std())
    for (const n of [24, 25, 26, 27, 28]) expect(s.fragmentShader).toContain(`vi == ${n}`)
    expect(s.fragmentShader).toContain('vec3 crownFace(vec2 uv, vec4 c)')
    expect(s.fragmentShader).toContain('uniform vec4 uCrownB;')
  })
  it('wires the new uniforms to the shared objects', () => {
    const s = patchFacadeShader(std())
    expect(s.uniforms.uTime).toBe(facadeUniforms.uTime)
    expect(s.uniforms.uCrown).toBe(facadeUniforms.uCrown)
    expect(s.uniforms.uCrownB).toBe(facadeUniforms.uCrownB)
    expect(facadeUniforms.uCrown.value.w).toBe(1)
  })
  it('LED faces glow by day too, signal lamps mostly at night', () => {
    const s = patchFacadeShader(std())
    expect(s.fragmentShader).toMatch(/vi == 27\) totalEmissiveRadiance/)
    expect(s.fragmentShader).toMatch(/vi == 26\) totalEmissiveRadiance/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix app -- src/world/materials/__tests__/facadeV6.test.js`
Expected: FAIL — `expected '…' to contain 'vi == 24'`.

- [ ] **Step 3: Implement**

In `facadeUniforms`, add:
```js
  uTime: { value: 0 },
  uCrown: { value: new THREE.Vector4(0, 0, 0, 1) },
  uCrownB: { value: new THREE.Vector4(1, 0, 0, 1) },
```
In `FRAG_HEAD`, directly after the `owHash` line (V2's `styleBase` must already be declared above this point), add:
```glsl
uniform float uTime;
uniform vec4 uCrown;
uniform vec4 uCrownB;
// Crown Fountain LED face (façade 27): procedural, never a real person's likeness.
// c.x face id, c.y pucker 0..1, c.z smile 0..1.
vec3 crownFace(vec2 uv, vec4 c) {
  vec3 skin = mix(vec3(0.36, 0.22, 0.15), vec3(0.93, 0.76, 0.62), owHash(vec2(c.x, 1.7)));
  vec2 p = (uv - vec2(0.5, 0.55)) * vec2(1.0, 1.55);
  float head = step(length(p * vec2(1.0, 0.8)), 0.42);
  vec2 e = vec2(abs(p.x) - 0.15, p.y - 0.1);
  float eyes = step(length(e * vec2(1.0, 2.2)), 0.05);
  float mw = mix(0.16, 0.05, c.y) + 0.04 * c.z;
  vec2 m = vec2(p.x, p.y + 0.2 + 0.03 * c.z * (1.0 - clamp(p.x * p.x / (mw * mw), 0.0, 1.0)));
  float mouth = step(abs(m.x), mw) * step(abs(m.y), mix(0.02, 0.05, c.y));
  vec3 col = mix(vec3(0.02, 0.03, 0.05), skin * (0.9 + 0.1 * sin(uTime * 0.7 + c.x)), head);
  col = mix(col, vec3(0.05), eyes * head);
  return mix(col, vec3(0.35, 0.08, 0.08), mouth * head);
}
```
In `venueAlbedo`, add these branches at the top, before `if (vi == 9)`:
```glsl
  if (vi == 24) {   // dressed stone and marble: colour from _STYLE, ashlar joints, faint veining
    float joint = step(fract(wp.y / 0.9), 0.03) + step(fract(uv.x / 1.8), 0.015);
    float vein = smoothstep(0.55, 0.6, owHash(floor(uv * 3.0))) * 0.05;
    return styleBase(vStyle) * (0.92 + 0.12 * grain.r) * (1.0 - 0.14 * min(joint, 1.0)) + vein;
  }
  if (vi == 25) {   // open steel grid deck / lattice: bars over the dark gap below
    vec2 g = abs(fract(wp.xz / 0.12) - 0.5);
    return mix(vec3(0.05, 0.06, 0.07), styleBase(vStyle), step(0.36, max(g.x, g.y)));
  }
  if (vi == 26) return styleBase(vStyle);                          // lamp glass, lenses, lit skylights
  if (vi == 27) return crownFace(uv, s < 0.5 ? uCrown : uCrownB);  // Crown Fountain towers
  if (vi == 28) return styleBase(vStyle) * (0.85 + 0.3 * grain.g); // bronze, Cor-Ten, stainless
  if ((vi == 12 || vi == 13) && vStyle > 0.5) return styleBase(vStyle) * (0.94 + 0.08 * grain.r);
  if (vi == 18 && vStyle > 0.5) return mix(styleBase(vStyle) * 0.6, styleBase(vStyle), owHash(floor(vec2(uv.x, wp.y) * 3.0))) * (0.85 + 0.3 * grain.g);
```
In `FRAG_ROUGH`, append:
```glsl
if (isVenue && vi == 28) roughnessFactor = 0.35;
if (isVenue && vi == 25) roughnessFactor = 0.55;
if (isVenue && vi == 26) roughnessFactor = 0.2;
```
In `FRAG_METAL`, append:
```glsl
if (isVenue && vi == 28) metalnessFactor = 0.85;
if (isVenue && vi == 25) metalnessFactor = 0.6;
```
In `FRAG_EMISSIVE`, prepend these lines before `if (isVenue && uNight > 0.001) {`:
```glsl
if (isVenue && vi == 27) totalEmissiveRadiance += diffuseColor.rgb * (0.55 + 1.3 * uNight) * uLitBoost;
if (isVenue && vi == 26) totalEmissiveRadiance += diffuseColor.rgb * (0.25 + 3.5 * uNight) * uLitBoost;
```
Bump `customProgramCacheKey` by one (from `'facade-v7'`, or V2's key, to the next version).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --prefix app -- src/world/materials/__tests__/`
Expected: PASS (every file in the folder, the existing façade tests included).

- [ ] **Step 5: Commit**

```bash
git add app/src/world/materials/facadeMaterial.js app/src/world/materials/__tests__/facadeV6.test.js
git commit -m "feat(v6): shader surfaces for stone, grid decks, signal lamps, Crown Fountain faces and bronze, styled via _STYLE" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 4: Bridge data and detection — one crossing, one bridge, no double deck

**How detection relates to the road ribbons.**
- OSM maps each river crossing as one or more *road ways*: both carriageways, the upper and lower decks at DuSable and Lake Shore Drive, and the L tracks on Wells and Lake. They are tagged `bridge=movable` and/or `bridge:movable=bascule`. Today every such way is rendered as a flat ground ribbon (`GROUND_Y.roads`), and the double-deck ways (layer 1 *and* layer 2) are drawn on top of each other at the same height.
- V6 claims every movable way near a named entry in `bridges.json` into **one bridge**. Task 7 then cuts all claimed ribbons, plus any road ribbon that runs parallel through the span-and-tail rectangle, out of the ground and elevated layers. The leaf mesh draws the single visible deck at street level.
- Approach ribbons beyond the rectangle stay. Perpendicular streets (Wacker) are never cut.
- Lake Street has no road way in the OSM cache (the L's rail ways carry it), so its entry has a `bearing`.
- Rail-only bascules (St. Charles Air Line, Freeport and Blue Island subdivisions) and vertical-lift spans (`bridge:movable=lift`) are out of scope. Their ids are listed in `skipWays`.

**Files:**
- Create: `pipeline/data/bridges.json`, `pipeline/lib/bridges.js` (detection and cutting part), `pipeline/tests/bridges.test.js`

**Interfaces:**
- Consumes: `project` (`shared/project.js`), `roadHalfWidth` (`lib/ground.js`), meshkit vectors.
- Produces:
  - `isMovableBridge(tags) → boolean` — `bridge=movable`, or `bridge:movable=bascule`; `lift`/`swing` are excluded
  - `detectBridges(ways: {id, tags, points:[x,z][]}[], entries) → Bridge[]`, where `Bridge = { key, name, street, branch, year, leaf: 'deck-truss'|'through-truss'|'girder', decks: 1|2, houses: {count, style}, reliefs?, liftable, generic, centre:[x,z], axis:[ux,uz] (canonical: uz<0, or uz==0 && ux>0), span, width, wayIds:number[], railWayIds:number[], aliases:string[], source }`
  - `clipSegment(a, b, rect) → [t0, t1] | null` and `cutPolyline(points, rect) → points[][]`, with `rect = { c:[x,z], u:[ux,uz], hl, hw }`
  - Data: `bridges.json → { note, sources[], skipWays:number[], liftOrder:string[], bridges: Entry[] }`, where `Entry = { key, name, street, branch: 'main'|'south'|'north', year|null, at:{lat,lon}, bearing, radius?, leaf, decks, clearSpan, width, houses:{count, style}, reliefs?, liftable, aliases[], source }`

- [ ] **Step 1: Write the data file**

Write `pipeline/data/bridges.json`. Every centre is the mean of the claimed OSM way midpoints, computed from `pipeline/cache/world/osm-roads-*.json` / `osm-rail-*.json`, and bearings come from those ways:
```json
{
  "note": "Chicago River bascule bridges in the world bounds (V6, backlog E4–E7). Centres/bearings from OSM movable ways; names, years and types from the sources. clearSpan is trunnion-to-trunnion where published, otherwise the OSM movable-way length.",
  "sources": [
    "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River",
    "https://en.wikipedia.org/wiki/DuSable_Bridge",
    "https://www.chicagoloopbridges.com/",
    "OpenStreetMap (ODbL) ways tagged bridge=movable / bridge:movable=bascule"
  ],
  "skipWays": [56179943, 1324188966, 1324188967, 56229010, 56229012, 56651600, 56651602, 56651604, 56651606, 56651608],
  "liftOrder": ["lakeshore", "columbus", "dusable", "wabash", "state", "dearborn", "clark", "lasalle", "wells", "franklin-orleans", "kinzie", "grand", "ohio-feeder", "halsted-n", "division", "lake", "randolph", "washington", "madison", "monroe", "adams", "jackson", "vanburen", "congress", "harrison", "roosevelt", "eighteenth", "canal", "cermak", "halsted-s", "loomis", "ashland-s"],
  "bridges": [
    { "key": "franklin-orleans", "name": "Franklin–Orleans Street Bridge", "street": "Franklin / Orleans", "branch": "main", "year": 1920, "at": { "lat": 41.88737, "lon": -87.63582 }, "bearing": 146, "leaf": "deck-truss", "decks": 1, "clearSpan": 70, "width": 22, "houses": { "count": 2, "style": "beaux-arts" }, "liftable": true, "aliases": ["Franklin Street Bridge", "Orleans Street Bridge"], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "wells", "name": "Wells Street Bridge", "street": "Wells Street", "branch": "main", "year": 1922, "at": { "lat": 41.88753, "lon": -87.63399 }, "bearing": 179, "leaf": "through-truss", "decks": 2, "clearSpan": 82, "width": 21, "houses": { "count": 2, "style": "beaux-arts" }, "liftable": false, "aliases": ["Wells St Bridge"], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "lasalle", "name": "LaSalle Street Bridge", "street": "LaSalle Street", "branch": "main", "year": 1928, "at": { "lat": 41.88749, "lon": -87.63251 }, "bearing": 179, "leaf": "deck-truss", "decks": 1, "clearSpan": 69, "width": 30, "houses": { "count": 2, "style": "beaux-arts" }, "liftable": true, "aliases": ["La Salle Street Bridge"], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "clark", "name": "Clark Street Bridge", "street": "Clark Street", "branch": "main", "year": 1929, "at": { "lat": 41.88748, "lon": -87.63103 }, "bearing": 179, "leaf": "deck-truss", "decks": 1, "clearSpan": 70, "width": 22, "houses": { "count": 2, "style": "deco" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "dearborn", "name": "Dearborn Street Bridge", "street": "Dearborn Street", "branch": "main", "year": 1962, "at": { "lat": 41.8875, "lon": -87.62954 }, "bearing": 179, "leaf": "girder", "decks": 1, "clearSpan": 65, "width": 20, "houses": { "count": 2, "style": "modern" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "state", "name": "State Street Bridge", "street": "State Street", "branch": "main", "year": 1949, "at": { "lat": 41.88754, "lon": -87.62801 }, "bearing": 178, "leaf": "deck-truss", "decks": 1, "clearSpan": 69, "width": 27, "houses": { "count": 2, "style": "moderne" }, "liftable": true, "aliases": ["Bataan–Corregidor Memorial Bridge"], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "wabash", "name": "Wabash Avenue Bridge", "street": "Wabash Avenue", "branch": "main", "year": 1930, "at": { "lat": 41.88789, "lon": -87.62686 }, "bearing": 155, "leaf": "deck-truss", "decks": 1, "clearSpan": 75, "width": 22, "houses": { "count": 2, "style": "beaux-arts" }, "liftable": true, "aliases": ["Irv Kupcinet Bridge"], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "dusable", "name": "DuSable Bridge", "street": "Michigan Avenue", "branch": "main", "year": 1920, "at": { "lat": 41.88884, "lon": -87.62438 }, "bearing": 10, "leaf": "deck-truss", "decks": 2, "clearSpan": 78, "width": 28, "houses": { "count": 4, "style": "dusable" }, "reliefs": { "ne": "The Discoverers", "nw": "The Pioneers", "sw": "Defense", "se": "Regeneration" }, "liftable": true, "aliases": ["Michigan Avenue Bridge"], "source": "https://en.wikipedia.org/wiki/DuSable_Bridge" },
    { "key": "columbus", "name": "Columbus Drive Bridge", "street": "Columbus Drive", "branch": "main", "year": 1982, "at": { "lat": 41.88857, "lon": -87.62058 }, "bearing": 7, "leaf": "girder", "decks": 1, "clearSpan": 75, "width": 30, "houses": { "count": 2, "style": "modern" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "lakeshore", "name": "Outer Drive Bridge", "street": "Lake Shore Drive", "branch": "main", "year": 1937, "at": { "lat": 41.88843, "lon": -87.61409 }, "bearing": 179, "leaf": "deck-truss", "decks": 2, "clearSpan": 108, "width": 32, "houses": { "count": 4, "style": "moderne" }, "liftable": true, "aliases": ["Lake Shore Drive Bridge", "Link Bridge"], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "lake", "name": "Lake Street Bridge", "street": "Lake Street", "branch": "south", "year": 1916, "at": { "lat": 41.88573, "lon": -87.63772 }, "bearing": 90, "leaf": "through-truss", "decks": 2, "clearSpan": 64, "width": 22, "houses": { "count": 2, "style": "beaux-arts" }, "liftable": false, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "randolph", "name": "Randolph Street Bridge", "street": "Randolph Street", "branch": "south", "year": 1984, "at": { "lat": 41.88446, "lon": -87.63796 }, "bearing": 89, "leaf": "girder", "decks": 1, "clearSpan": 60, "width": 24, "houses": { "count": 2, "style": "modern" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "washington", "name": "Washington Boulevard Bridge", "street": "Washington Street", "branch": "south", "year": 1913, "at": { "lat": 41.8832, "lon": -87.6381 }, "bearing": 88, "leaf": "deck-truss", "decks": 1, "clearSpan": 56, "width": 22, "houses": { "count": 2, "style": "beaux-arts" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "madison", "name": "Madison Street Bridge", "street": "Madison Street", "branch": "south", "year": 1922, "at": { "lat": 41.8819, "lon": -87.63822 }, "bearing": 89, "leaf": "deck-truss", "decks": 1, "clearSpan": 62, "width": 24, "houses": { "count": 2, "style": "beaux-arts" }, "liftable": true, "aliases": ["Lyric Opera Bridge"], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "monroe", "name": "Monroe Street Bridge", "street": "Monroe Street", "branch": "south", "year": null, "at": { "lat": 41.88061, "lon": -87.63825 }, "bearing": 89, "leaf": "deck-truss", "decks": 1, "clearSpan": 56, "width": 22, "houses": { "count": 2, "style": "beaux-arts" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "adams", "name": "Adams Street Bridge", "street": "Adams Street", "branch": "south", "year": null, "at": { "lat": 41.87934, "lon": -87.63811 }, "bearing": 89, "leaf": "deck-truss", "decks": 1, "clearSpan": 56, "width": 22, "houses": { "count": 2, "style": "beaux-arts" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "jackson", "name": "Jackson Boulevard Bridge", "street": "Jackson Boulevard", "branch": "south", "year": 1915, "at": { "lat": 41.87807, "lon": -87.63772 }, "bearing": 89, "leaf": "deck-truss", "decks": 1, "clearSpan": 57, "width": 22, "houses": { "count": 2, "style": "beaux-arts" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "vanburen", "name": "Van Buren Street Bridge", "street": "Van Buren Street", "branch": "south", "year": 1956, "at": { "lat": 41.8768, "lon": -87.63741 }, "bearing": 89, "leaf": "girder", "decks": 1, "clearSpan": 60, "width": 20, "houses": { "count": 2, "style": "moderne" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "congress", "name": "Congress Parkway Bridge", "street": "Ida B. Wells Drive / Eisenhower Expressway", "branch": "south", "year": 1956, "at": { "lat": 41.87563, "lon": -87.6367 }, "bearing": 89, "leaf": "girder", "decks": 1, "clearSpan": 69, "width": 40, "houses": { "count": 2, "style": "moderne" }, "liftable": false, "aliases": ["Eisenhower Expressway bridge"], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "harrison", "name": "Harrison Street Bridge", "street": "Harrison Street", "branch": "south", "year": 1960, "at": { "lat": 41.87446, "lon": -87.63602 }, "bearing": 89, "leaf": "girder", "decks": 1, "clearSpan": 60, "width": 20, "houses": { "count": 2, "style": "modern" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "roosevelt", "name": "Roosevelt Road Bridge", "street": "Roosevelt Road", "branch": "south", "year": null, "at": { "lat": 41.86732, "lon": -87.63473 }, "bearing": 89, "leaf": "girder", "decks": 1, "clearSpan": 56, "width": 30, "houses": { "count": 2, "style": "modern" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "eighteenth", "name": "18th Street Bridge", "street": "18th Street", "branch": "south", "year": null, "at": { "lat": 41.85773, "lon": -87.63526 }, "bearing": 91, "leaf": "girder", "decks": 1, "clearSpan": 54, "width": 20, "houses": { "count": 2, "style": "modern" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "canal", "name": "Canal Street Bridge", "street": "Canal Street", "branch": "south", "year": null, "at": { "lat": 41.85474, "lon": -87.63871 }, "bearing": 172, "leaf": "deck-truss", "decks": 1, "clearSpan": 70, "width": 18, "houses": { "count": 2, "style": "moderne" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "cermak", "name": "Cermak Road Bridge", "street": "Cermak Road", "branch": "south", "year": null, "at": { "lat": 41.85276, "lon": -87.64047 }, "bearing": 86, "leaf": "through-truss", "decks": 1, "clearSpan": 64, "width": 14, "houses": { "count": 2, "style": "beaux-arts" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "halsted-s", "name": "South Halsted Street Bridge", "street": "Halsted Street", "branch": "south", "year": null, "at": { "lat": 41.84929, "lon": -87.64647 }, "bearing": 180, "leaf": "deck-truss", "decks": 1, "clearSpan": 62, "width": 18, "houses": { "count": 2, "style": "moderne" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "loomis", "name": "Loomis Street Bridge", "street": "Loomis Street", "branch": "south", "year": null, "at": { "lat": 41.84583, "lon": -87.66078 }, "bearing": 161, "leaf": "girder", "decks": 1, "clearSpan": 58, "width": 16, "houses": { "count": 2, "style": "modern" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "ashland-s", "name": "Ashland Avenue Bridge", "street": "Ashland Avenue", "branch": "south", "year": null, "at": { "lat": 41.84493, "lon": -87.66588 }, "bearing": 179, "leaf": "girder", "decks": 1, "clearSpan": 60, "width": 18, "houses": { "count": 2, "style": "modern" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "kinzie", "name": "Kinzie Street Bridge", "street": "Kinzie Street", "branch": "north", "year": 1909, "at": { "lat": 41.88908, "lon": -87.63949 }, "bearing": 84, "leaf": "through-truss", "decks": 1, "clearSpan": 40, "width": 12, "houses": { "count": 1, "style": "beaux-arts" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "grand", "name": "Grand Avenue Bridge", "street": "Grand Avenue", "branch": "north", "year": 1913, "at": { "lat": 41.89142, "lon": -87.64112 }, "bearing": 84, "leaf": "deck-truss", "decks": 1, "clearSpan": 52, "width": 18, "houses": { "count": 2, "style": "beaux-arts" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "ohio-feeder", "name": "Ohio Street Feeder Bridge", "street": "Ohio Street feeder (I-90/94 ramps)", "branch": "north", "year": null, "at": { "lat": 41.8925, "lon": -87.64204 }, "bearing": 89, "leaf": "girder", "decks": 1, "clearSpan": 70, "width": 26, "houses": { "count": 0, "style": "modern" }, "liftable": true, "aliases": [], "source": "OpenStreetMap ways 1013537658, 1013537660 (bridge:movable=bascule)" },
    { "key": "halsted-n", "name": "North Halsted Street Bridge", "street": "Halsted Street", "branch": "north", "year": null, "at": { "lat": 41.89792, "lon": -87.64783 }, "bearing": 178, "leaf": "deck-truss", "decks": 1, "clearSpan": 50, "width": 16, "houses": { "count": 2, "style": "moderne" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" },
    { "key": "division", "name": "Division Street Bridge", "street": "Division Street", "branch": "north", "year": null, "at": { "lat": 41.9035, "lon": -87.65741 }, "bearing": 89, "leaf": "deck-truss", "decks": 1, "clearSpan": 49, "width": 16, "houses": { "count": 2, "style": "moderne" }, "liftable": true, "aliases": [], "source": "https://en.wikipedia.org/wiki/List_of_crossings_of_the_Chicago_River" }
  ]
}
```

- [ ] **Step 2: Write the failing tests**

`pipeline/tests/bridges.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isMovableBridge, detectBridges, cutPolyline, clipSegment } from '../lib/bridges.js'
import { project, unproject } from '../../shared/project.js'

const data = JSON.parse(readFileSync(new URL('../data/bridges.json', import.meta.url), 'utf8'))
const ll = ([x, z]) => { const [lon, lat] = unproject(x, z); return { lat, lon } }
const entry = (o) => ({ key: 'e', name: 'E', leaf: 'deck-truss', decks: 1, houses: { count: 2, style: 'beaux-arts' }, liftable: true, aliases: [], source: 'x', ...o })
const way = (id, pts, tags = { highway: 'secondary', bridge: 'movable', 'bridge:movable': 'bascule' }) => ({ id, tags, points: pts })

describe('bridges.json', () => {
  const keys = data.bridges.map((b) => b.key)
  it('lists the named main-stem and south-branch bascules with sources', () => {
    expect(new Set(keys).size).toBe(keys.length)
    for (const k of ['franklin-orleans', 'wells', 'lasalle', 'clark', 'dearborn', 'state', 'wabash', 'dusable', 'columbus', 'lakeshore']) expect(keys).toContain(k)
    for (const k of ['lake', 'randolph', 'washington', 'madison', 'monroe', 'adams', 'jackson', 'vanburen']) expect(keys).toContain(k)
    expect(data.bridges.filter((b) => b.name).length).toBeGreaterThanOrEqual(10)
    for (const b of data.bridges) { expect(b.source, b.key).toMatch(/\S{8,}/); expect(typeof b.bearing, b.key).toBe('number') }
  })
  it('every tender-house bridge the backlog lists (E6) has a house', () => {
    for (const k of ['wabash', 'state', 'dearborn', 'clark', 'lasalle', 'wells', 'franklin-orleans', 'lake', 'randolph', 'washington', 'madison', 'monroe', 'adams', 'jackson', 'vanburen'])
      expect(data.bridges.find((b) => b.key === k).houses.count, k).toBeGreaterThanOrEqual(1)
  })
  it('the lift order only names known bridges', () => {
    for (const k of data.liftOrder) expect(keys).toContain(k)
  })
})

describe('isMovableBridge', () => {
  it('bascules yes; vertical lifts, swings and fixed bridges no', () => {
    expect(isMovableBridge({ bridge: 'movable', 'bridge:movable': 'bascule' })).toBe(true)
    expect(isMovableBridge({ bridge: 'movable' })).toBe(true)
    expect(isMovableBridge({ bridge: 'movable', 'bridge:movable': 'lift' })).toBe(false)
    expect(isMovableBridge({ bridge: 'yes' })).toBe(false)
  })
})

describe('detectBridges', () => {
  const C = [287, -757]
  // DuSable: upper deck (layer 2) and lower deck (layer 1), both directions
  const dusableWays = [
    way(1, [[290, -807], [273, -708]], { highway: 'secondary', bridge: 'movable', 'bridge:movable': 'bascule', layer: '2' }),
    way(2, [[283, -707], [301, -805]], { highway: 'secondary', bridge: 'movable', 'bridge:movable': 'bascule', layer: '2' }),
    way(3, [[281, -707], [298, -806]], { highway: 'tertiary', bridge: 'movable', 'bridge:movable': 'bascule', layer: '1' }),
    way(4, [[293, -807], [276, -708]], { highway: 'tertiary', bridge: 'movable', 'bridge:movable': 'bascule', layer: '1' }),
  ]
  it('claims upper and lower decks, both directions, as ONE bridge (no double deck)', () => {
    const [b, ...rest] = detectBridges(dusableWays, [entry({ key: 'dusable', at: ll(C), bearing: 10, clearSpan: 78, width: 28, decks: 2 })])
    expect(rest).toHaveLength(0)
    expect(b.wayIds.sort()).toEqual([1, 2, 3, 4])
    expect(Math.hypot(b.centre[0] - C[0], b.centre[1] - C[1])).toBeLessThan(3)
    expect(b.span).toBe(78)
  })
  it('reversed way order gives the same canonical axis', () => {
    const e = [entry({ key: 'x', at: ll([0, 0]) })]
    const a = detectBridges([way(1, [[0, 35], [0, -35]])], e)[0].axis
    const b = detectBridges([way(1, [[0, -35], [0, 35]])], e)[0].axis
    expect(a[0]).toBeCloseTo(b[0]); expect(a[1]).toBeCloseTo(b[1]); expect(a[1]).toBeLessThan(0)
  })
  it('Lake Street: only rail ways, axis from the bearing, rail ids kept for the elevated cut', () => {
    const rail = [way(9, [[-865, -407], [-775, -407]], { railway: 'subway', bridge: 'movable', 'bridge:movable': 'bascule' })]
    const [b] = detectBridges(rail, [entry({ key: 'lake', at: ll([-820, -411]), bearing: 90, decks: 2, leaf: 'through-truss' })])
    expect(b.railWayIds).toEqual([9])
    expect(Math.abs(b.axis[0])).toBeCloseTo(1, 3)
  })
  it('an entry that matches no way and has no bearing fails loudly, naming the entry', () => {
    expect(() => detectBridges([], [entry({ key: 'ghost', at: ll([5000, 5000]) })])).toThrow(/ghost/)
  })
  it('an unlisted movable way still becomes an unnamed bascule, never a flat ribbon', () => {
    const [b] = detectBridges([way(7, [[1000, 0], [1000, -60]], { highway: 'secondary', name: 'Nowhere St', bridge: 'movable' })], [])
    expect(b.generic).toBe(true)
    expect(b.name).toBe('Nowhere St')
    expect(b.houses.count).toBe(0)
  })
  it('the real entries resolve to their OSM centres', () => {
    const d = data.bridges.find((b) => b.key === 'dusable'), [x, z] = project(d.at.lon, d.at.lat)
    expect(Math.round(x)).toBe(287); expect(Math.round(z)).toBe(-757)
  })
})

describe('cutPolyline', () => {
  const rect = { c: [0, 0], u: [0, -1], hl: 40, hw: 10 }
  it('a road straight through the span loses exactly the inside part', () => {
    const pieces = cutPolyline([[0, 100], [0, -100]], rect)
    expect(pieces).toHaveLength(2)
    expect(pieces[0].at(-1)[1]).toBeCloseTo(40); expect(pieces[1][0][1]).toBeCloseTo(-40)
  })
  it('a road wholly outside is untouched; a road wholly inside vanishes', () => {
    expect(cutPolyline([[50, 0], [50, 10]], rect)).toEqual([[[50, 0], [50, 10]]])
    expect(cutPolyline([[0, 10], [0, -10]], rect)).toEqual([])
  })
  it('clipSegment returns the inside parameter interval', () => {
    const [t0, t1] = clipSegment([0, 100], [0, -100], rect)
    expect(t0).toBeCloseTo(0.3); expect(t1).toBeCloseTo(0.7)
    expect(clipSegment([50, 0], [50, 10], rect)).toBeNull()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test --prefix pipeline -- tests/bridges.test.js`
Expected: FAIL — `Failed to load url ../lib/bridges.js`.

- [ ] **Step 4: Implement the detection part of `pipeline/lib/bridges.js`**

```js
// pipeline/lib/bridges.js — Chicago's river bascules: OSM movable ways → named bridges (data/bridges.json),
// ribbon cuts so each crossing draws ONE deck, then trunnion leaves, pits, tender/bridge houses and lights.
import { project } from '../../shared/project.js'
import { roadHalfWidth } from './ground.js'
import { add2, sub2, mul2, dot2, len2, norm2, left, bearing } from './meshkit.js'

export const isMovableBridge = (tags = {}) => {
  const kind = tags['bridge:movable']
  if (kind) return kind === 'bascule'
  return tags.bridge === 'movable'
}

const mid = (pts) => mul2(add2(pts[0], pts[pts.length - 1]), 0.5)
export const lenOf = (pts) => pts.slice(1).reduce((s, p, i) => s + len2(sub2(p, pts[i])), 0)
const canonical = (a) => (a[1] > 1e-9 || (Math.abs(a[1]) <= 1e-9 && a[0] < 0) ? mul2(a, -1) : a)

function resolveBridge(e, c, ways) {
  const roads = ways.filter((w) => w.tags.highway)
  const longest = [...(roads.length ? roads : ways)].sort((a, b) => lenOf(b.points) - lenOf(a.points))[0]
  let axis
  if (e.bearing != null) axis = bearing(e.bearing)
  else if (longest) axis = norm2(sub2(longest.points.at(-1), longest.points[0]))
  else throw new Error(`bridge ${e.key} matched no OSM way and has no bearing — fix data/bridges.json`)
  const centre = ways.length ? mul2(ways.reduce((s, w) => add2(s, mid(w.points)), [0, 0]), 1 / ways.length) : c
  return {
    key: e.key, name: e.name ?? null, street: e.street ?? null, branch: e.branch ?? null, year: e.year ?? null,
    leaf: e.leaf ?? 'girder', decks: e.decks ?? 1, houses: e.houses ?? { count: 0, style: 'modern' }, reliefs: e.reliefs ?? null,
    liftable: e.liftable ?? true, generic: Boolean(e.generic), aliases: e.aliases ?? [], source: e.source ?? null,
    centre, axis: canonical(axis),
    span: e.clearSpan ?? Math.round(Math.max(30, ...ways.map((w) => lenOf(w.points)))),
    width: e.width ?? Math.max(12, roads.reduce((s, w) => s + 2 * (roadHalfWidth(w.tags) || 4), 0) + 6),
    wayIds: ways.map((w) => w.id), railWayIds: ways.filter((w) => w.tags.railway).map((w) => w.id),
  }
}

export function detectBridges(ways, entries) {
  const listed = new Set(entries.flatMap((e) => e.osmWays ?? []))
  const movable = ways.filter((w) => isMovableBridge(w.tags) || listed.has(w.id))
  const claimed = new Set(), out = []
  for (const e of entries) {
    const c = project(e.at.lon, e.at.lat), r = e.radius ?? 60
    const mine = movable.filter((w) => !claimed.has(w.id) && ((e.osmWays ?? []).includes(w.id) || len2(sub2(mid(w.points), c)) <= r))
    for (const w of mine) claimed.add(w.id)
    if (!mine.length && e.bearing == null) throw new Error(`bridge ${e.key} matched no OSM way and has no bearing — fix data/bridges.json`)
    out.push(resolveBridge(e, c, mine))
  }
  // Movable ways nobody listed become unnamed bascules, so no crossing is left as a flat ribbon.
  const rest = movable.filter((w) => !claimed.has(w.id))
  while (rest.length) {
    const seed = rest.shift(), group = [seed]
    for (let i = rest.length - 1; i >= 0; i--) if (len2(sub2(mid(rest[i].points), mid(seed.points))) < 45) group.push(...rest.splice(i, 1))
    const id = Math.min(...group.map((w) => w.id))
    out.push(resolveBridge({ key: `osm-${id}`, name: seed.tags.name ?? null, generic: true, leaf: 'girder', decks: 1, houses: { count: 0, style: 'modern' }, liftable: true }, mid(seed.points), group))
  }
  return out
}

// Liang–Barsky against an oriented rectangle { c, u, hl, hw }: the [t0, t1] of segment a→b inside it, or null.
export function clipSegment(a, b, { c, u, hl, hw }) {
  const v = left(u), da = sub2(a, c), d = sub2(b, a)
  const pa = [dot2(da, u), dot2(da, v)], pd = [dot2(d, u), dot2(d, v)]
  let t0 = 0, t1 = 1
  for (const [p, q] of [[-pd[0], pa[0] + hl], [pd[0], hl - pa[0]], [-pd[1], pa[1] + hw], [pd[1], hw - pa[1]]]) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return null; continue }
    const r = q / p
    if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r } else { if (r < t0) return null; if (r < t1) t1 = r }
  }
  return t1 - t0 > 1e-9 ? [t0, t1] : null
}

// The parts of a polyline outside the rectangle (pieces shorter than 0.5 m are dropped).
export function cutPolyline(points, rect) {
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  const pieces = []
  let cur = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], hit = clipSegment(a, b, rect)
    if (!hit) { if (!cur.length) cur.push(a); cur.push(b); continue }
    const [t0, t1] = hit
    if (t0 > 0) { if (!cur.length) cur.push(a); cur.push(lerp(a, b, t0)) }
    if (cur.length >= 2) pieces.push(cur)
    cur = t1 < 1 ? [lerp(a, b, t1), b] : []
  }
  if (cur.length >= 2) pieces.push(cur)
  return pieces.filter((p) => lenOf(p) >= 0.5)
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --prefix pipeline -- tests/bridges.test.js`
Expected: PASS (13 tests).

- [ ] **Step 6: Commit**

```bash
git add pipeline/data/bridges.json pipeline/lib/bridges.js pipeline/tests/bridges.test.js
git commit -m "feat(v6): 32 sourced Chicago River bascules; OSM movable ways claimed into one bridge per crossing; span cutting" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Chicago-type trunnion bascule leaves and counterweight pits (E4)

The world is flat: the river surface sits at street level (`GROUND_Y.water` 0.04 against `GROUND_Y.roads` 0.12). So each leaf keeps its deck at street level. Its trusses or girders and its counterweight hang **below** the water plane, hidden, until the leaf rises. When a leaf lifts, the full structure shows and the tail drops into an open pit.

**Files:**
- Modify: `pipeline/lib/bridges.js` (append the leaf part)
- Test: `pipeline/tests/bridgeParts.test.js`

**Interfaces:**
- Consumes: `Bridge` (Task 4); meshkit `mesh, slab, tube, at3, add2, mul2, left`; `LANDMARK_FACADES`.
- Produces:
  - `DECK = { sidewalkW: 3, slabT: 0.35, trunnionDrop: 1.2, gap: 0.04, tailFrac: 0.32 }`, `L_DECK_Y = 7.6` (the elevated L height in `build-world.js`)
  - `leafGeometry(b, deckY) → [{ leaf: 0|1, s: ±1, p2:[x,z] trunnion, d:[x,z] trunnion→tip, pivot:[x,y,z], k:[kx,0,kz] rotation axis (= d × up, so +angle lifts the tip), Lf, Lt }]`
  - `buildLeaves(b, deckY) → [{ leaf, pivot, k, meshes: Part[] }]`, where `Part = { mesh, facade, seed, style: string|null, part }`. Parts: `deck`, `sidewalk`, `railing`, `truss`|`girder`, `lower-deck` (double deck), `upper-deck` (L on through-truss), `counterweight`, `nav`.
  - `buildPits(b, deckY) → Part[]`

- [ ] **Step 1: Write the failing test**

`pipeline/tests/bridgeParts.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { leafGeometry, buildLeaves, buildPits, DECK, L_DECK_Y } from '../lib/bridges.js'
import { LANDMARK_FACADES as F } from '../lib/facadeIds.js'

const pts = (parts) => parts.flatMap((p) => { const o = []; for (let i = 0; i < p.mesh.positions.length; i += 3) o.push(p.mesh.positions.slice(i, i + 3)); return o })
const B = (o = {}) => ({ key: 'b', leaf: 'deck-truss', decks: 1, span: 70, width: 22, centre: [0, 0], axis: [0, -1], houses: { count: 2, style: 'beaux-arts' }, ...o })
const deckY = 0.14

describe('bascule leaves', () => {
  it('two split leaves pivot on trunnions at the river banks and meet mid-span', () => {
    const g = leafGeometry(B(), deckY)
    expect(g).toHaveLength(2)
    expect(g[0].p2[1]).toBeCloseTo(-35); expect(g[1].p2[1]).toBeCloseTo(35)
    for (const l of g) {
      expect(l.pivot[1]).toBeCloseTo(deckY - DECK.trunnionDrop)
      expect(l.k[1]).toBe(0)
      expect(l.k[0] * l.d[0] + l.k[2] * l.d[1]).toBeCloseTo(0)                // horizontal axis across the deck
      expect(l.k[0] * -l.d[1] + l.k[2] * l.d[0]).toBeGreaterThan(0)          // k = d × up (tip lifts for +angle)
    }
    const leaves = buildLeaves(B(), deckY)
    for (const lf of leaves) {
      const z = pts(lf.meshes.filter((p) => p.part === 'deck')).map((q) => q[2])
      expect(Math.min(...z.map(Math.abs))).toBeLessThan(0.1)                  // reaches the middle
    }
  })
  it('the deck is at street level, drawn once, as open grid steel', () => {
    for (const lf of buildLeaves(B(), deckY)) {
      const deck = lf.meshes.filter((p) => p.part === 'deck')
      expect(deck).toHaveLength(1)
      expect(deck[0].facade).toBe(F.grid)
      expect(Math.max(...pts(deck).map((q) => q[1]))).toBeCloseTo(deckY)
      expect(lf.meshes.every((p) => p.style === null || typeof p.style === 'string')).toBe(true)
    }
  })
  it('deck trusses hang below the deck; through trusses rise above it; girders are plate girders', () => {
    const below = pts(buildLeaves(B(), deckY)[0].meshes.filter((p) => p.part === 'truss'))
    expect(Math.min(...below.map((q) => q[1]))).toBeLessThan(deckY - 4)
    const above = pts(buildLeaves(B({ leaf: 'through-truss' }), deckY)[0].meshes.filter((p) => p.part === 'truss'))
    expect(Math.max(...above.map((q) => q[1]))).toBeGreaterThan(deckY + 5.5)
    expect(buildLeaves(B({ leaf: 'girder' }), deckY)[0].meshes.some((p) => p.part === 'girder')).toBe(true)
  })
  it('double decks: DuSable carries a lower deck; Wells/Lake carry the L on top at the elevated height', () => {
    expect(buildLeaves(B({ decks: 2 }), deckY)[0].meshes.some((p) => p.part === 'lower-deck')).toBe(true)
    const up = buildLeaves(B({ decks: 2, leaf: 'through-truss' }), deckY)[0].meshes.filter((p) => p.part === 'upper-deck')
    expect(Math.max(...pts(up).map((q) => q[1]))).toBeCloseTo(L_DECK_Y)
  })
  it('each leaf carries red navigation lenses at its tip and a counterweight behind the trunnion', () => {
    for (const lf of buildLeaves(B(), deckY)) {
      const nav = lf.meshes.filter((p) => p.part === 'nav')
      expect(nav[0].facade).toBe(F.signal); expect(nav[0].style).toBe('nav-red')
      expect(lf.meshes.some((p) => p.part === 'counterweight')).toBe(true)
    }
  })
  it('counterweight pits: one per bank, open, below street level', () => {
    const pits = buildPits(B(), deckY)
    expect(pits).toHaveLength(2)
    expect(Math.max(...pts(pits).map((q) => q[1]))).toBeLessThan(deckY)
    expect(Math.min(...pts(pits).map((q) => q[1]))).toBeLessThan(deckY - 8)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix pipeline -- tests/bridgeParts.test.js`
Expected: FAIL — `leafGeometry is not a function` (it is not exported yet).

- [ ] **Step 3: Implement (append to `pipeline/lib/bridges.js`)**

Extend the meshkit import to `import { add2, sub2, mul2, dot2, len2, norm2, left, bearing, at3, mesh, slab, tube } from './meshkit.js'`, and add `import { LANDMARK_FACADES as F } from './facadeIds.js'`. Then append:
```js
// ── Leaves ───────────────────────────────────────────────────────────────────
// Chicago-type trunnion bascule: each leaf turns about a fixed trunnion at the bank; a counterweight on the
// short tail behind the trunnion drops into a pit as the leaf rises (https://en.wikipedia.org/wiki/Bascule_bridge).
export const DECK = { sidewalkW: 3, slabT: 0.35, trunnionDrop: 1.2, gap: 0.04, tailFrac: 0.32 }
export const L_DECK_Y = 7.6 // build-world.js lays the elevated L ribbon at 7.6 m
const STEEL = 'chicago-bridge-steel'

export function leafGeometry(b, deckY) {
  return [1, -1].map((s, leaf) => {
    const p2 = add2(b.centre, mul2(b.axis, (s * b.span) / 2)), d = mul2(b.axis, -s)
    return { leaf, s, p2, d, pivot: [p2[0], deckY - DECK.trunnionDrop, p2[1]], k: [-d[1], 0, d[0]], Lf: b.span / 2 - DECK.gap, Lt: (DECK.tailFrac * b.span) / 2 }
  })
}

const frameOf = (g) => { const v = left(g.d); return (a, o = 0) => add2(add2(g.p2, mul2(g.d, a)), mul2(v, o)) }
const panels = (g, N = 8) => Array.from({ length: N + 1 }, (_, i) => -g.Lt + ((g.Lf + g.Lt) * i) / N)

function deckTrusses(b, g, deckY) {
  const out = mesh(), at = frameOf(g), W = b.width, top = deckY - DECK.slabT
  const offs = W > 26 ? [-(W / 2 - 2.5), -W / 6, W / 6, W / 2 - 2.5] : [-(W / 2 - 2.5), W / 2 - 2.5]
  const [d0, d1] = b.decks === 2 ? [7.5, 6.6] : [5.5, 1.8]
  const depth = (a) => (a <= 0 ? d0 : d0 + ((d1 - d0) * a) / g.Lf)
  const A = panels(g)
  for (const o of offs) for (let i = 0; i < A.length - 1; i++) {
    const T0 = at3(at(A[i], o), top), T1 = at3(at(A[i + 1], o), top)
    const B0 = at3(at(A[i], o), top - depth(A[i])), B1 = at3(at(A[i + 1], o), top - depth(A[i + 1]))
    tube(out, T0, T1, 0.25, 4); tube(out, B0, B1, 0.25, 4); tube(out, T0, B0, 0.18, 4)
    tube(out, i % 2 ? T0 : B0, i % 2 ? B1 : T1, 0.18, 4)   // Warren diagonals
  }
  return out
}

function throughTrusses(b, g, deckY) {
  const out = mesh(), at = frameOf(g), W = b.width, o = W / 2 - 0.6
  const H = b.decks === 2 ? L_DECK_Y - 0.4 - deckY : 6.0
  const height = (a) => (b.decks === 2 || a <= 0.2 * g.Lf ? H : H * (1 - (0.45 * (a - 0.2 * g.Lf)) / (0.8 * g.Lf)))
  const A = panels(g)
  for (const side of [-o, o]) for (let i = 0; i < A.length - 1; i++) {
    const B0 = at3(at(A[i], side), deckY), B1 = at3(at(A[i + 1], side), deckY)
    const T0 = at3(at(A[i], side), deckY + height(A[i])), T1 = at3(at(A[i + 1], side), deckY + height(A[i + 1]))
    tube(out, B0, B1, 0.25, 4); tube(out, T0, T1, 0.25, 4); tube(out, B0, T0, 0.18, 4)
    tube(out, i % 2 ? B0 : T0, i % 2 ? T1 : B1, 0.18, 4)
  }
  for (let i = 0; i < A.length; i += 2) tube(out, at3(at(A[i], -o), deckY + height(A[i])), at3(at(A[i], o), deckY + height(A[i])), 0.15, 4) // top struts
  return out
}

function girders(b, g, deckY) {
  const out = mesh(), at = frameOf(g), W = b.width, top = deckY - DECK.slabT
  const offs = W > 20 ? [-(W / 2 - 2), -W / 6, W / 6, W / 2 - 2] : [-(W / 2 - 2), W / 2 - 2]
  const depth = (a) => (a <= 0 ? 3.5 : 3.5 - (2.1 * a) / g.Lf)
  const A = panels(g)
  for (const o of offs) for (let i = 0; i < A.length - 1; i++) {
    const m = (A[i] + A[i + 1]) / 2
    slab(out, at(m, o), g.d, A[i + 1] - A[i], 0.6, top - depth(m), top)
  }
  return out
}

export function buildLeaves(b, deckY) {
  const W = b.width
  return leafGeometry(b, deckY).map((g) => {
    const at = frameOf(g), len = g.Lf + g.Lt, mid = (g.Lf - g.Lt) / 2, meshes = []
    const push = (m, facade, style, part) => meshes.push({ mesh: m, facade, seed: 0.5, style, part })
    push(slab(mesh(), at(mid), g.d, len, W - 2 * DECK.sidewalkW, deckY - DECK.slabT, deckY), F.grid, 'grid-deck-steel', 'deck')
    const walks = mesh(), rails = mesh()
    for (const o of [-1, 1]) {
      slab(walks, at(mid, o * (W / 2 - DECK.sidewalkW / 2)), g.d, len, DECK.sidewalkW, deckY - DECK.slabT, deckY + 0.15)
      slab(rails, at(mid, o * (W / 2 - 0.04)), g.d, len, 0.08, deckY + 0.15, deckY + 1.25)   // lattice railing
    }
    push(walks, F.stone, 'sidewalk-concrete', 'sidewalk')
    push(rails, F.grid, STEEL, 'railing')
    if (b.leaf === 'through-truss') push(throughTrusses(b, g, deckY), F.steel, STEEL, 'truss')
    else if (b.leaf === 'girder') push(girders(b, g, deckY), F.steel, STEEL, 'girder')
    else push(deckTrusses(b, g, deckY), F.steel, STEEL, 'truss')
    if (b.decks === 2 && b.leaf === 'through-truss') push(slab(mesh(), at(mid), g.d, len, 8, L_DECK_Y - 0.4, L_DECK_Y), F.steel, STEEL, 'upper-deck')
    else if (b.decks === 2) push(slab(mesh(), at(mid), g.d, len, W - 4, deckY - 6.3, deckY - 5.95), F.stone, 'sidewalk-concrete', 'lower-deck')
    push(slab(mesh(), at(-g.Lt / 2 - 0.5), g.d, Math.max(1, g.Lt - 1), W - 4, deckY - 9, deckY - 3), F.stone, 'pit-concrete', 'counterweight')
    const nav = mesh()
    for (const o of [-1, 1]) slab(nav, at(g.Lf - 0.3, o * (W / 2 - 0.3)), g.d, 0.35, 0.35, deckY + 1.0, deckY + 1.45)
    push(nav, F.signal, 'nav-red', 'nav')
    return { leaf: g.leaf, pivot: g.pivot, k: g.k, meshes }
  })
}

// Open pit behind each trunnion: the tail and counterweight swing down into it as the leaf rises.
export function buildPits(b, deckY) {
  return leafGeometry(b, deckY).map((g) => {
    const at = frameOf(g), m = mesh(), a0 = -g.Lt - 0.6, a1 = 0.4, L = a1 - a0, W = b.width, y0 = deckY - 9.4, y1 = deckY - 0.4
    slab(m, at((a0 + a1) / 2), g.d, L, W, y0, y0 + 0.4)                       // floor
    for (const o of [-1, 1]) slab(m, at((a0 + a1) / 2, o * (W / 2 - 0.25)), g.d, L, 0.5, y0, y1)
    slab(m, at(a0 + 0.25), g.d, 0.5, W, y0, y1)                               // back wall
    return { mesh: m, facade: F.stone, seed: 0.5, style: 'pit-concrete', part: 'pit' }
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --prefix pipeline -- tests/bridgeParts.test.js tests/bridges.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/bridges.js pipeline/tests/bridgeParts.test.js
git commit -m "feat(v6): Chicago-type trunnion bascule leaves (deck truss, through truss, girder), grid decks, double decks, counterweights and pits" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Tender houses, the DuSable bridge houses, balustrades, lanterns and navigation lights (E5, E6, E7 geometry)

**Files:**
- Modify: `pipeline/lib/bridges.js` (append)
- Test: `pipeline/tests/bridgeBuild.test.js`

**Interfaces:**
- Consumes: Tasks 4–5; `pyramid`, `drum` from `lib/crowns.js`.
- Produces:
  - `HOUSE_STYLES` (`'beaux-arts' | 'deco' | 'moderne' | 'modern' | 'dusable'`)
  - `houseSpots(b) → [{ at, s, side, facing:[x,z], corner: 'nw'|'ne'|'sw'|'se' }]`
  - `buildHouse(spot, styleKey, reliefName|null) → Part[]` (DuSable parts include `relief:<slug>`)
  - `buildBalustrades(b, deckY) → Part`
  - `lanternSpots(b, deckY) → [x,y,z][]`
  - `bridgeLights(b, deckY) → [{ p:[x,y,z], kind: 'lantern'|'nav'|'pier', leaf?: 0|1 }]`
  - `buildBridge(b, { deckY }) → { fixed: Part[], leaves: [{ leaf, pivot, k, meshes }], lights }`

- [ ] **Step 1: Write the failing test**

`pipeline/tests/bridgeBuild.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { buildBridge, houseSpots, bridgeLights } from '../lib/bridges.js'
import { LANDMARK_FACADES as F } from '../lib/facadeIds.js'

const pts = (parts) => parts.flatMap((p) => { const o = []; for (let i = 0; i < p.mesh.positions.length; i += 3) o.push(p.mesh.positions.slice(i, i + 3)); return o })
const B = (o = {}) => ({ key: 'b', name: 'B', leaf: 'deck-truss', decks: 1, span: 70, width: 22, centre: [0, 0], axis: [0, -1], houses: { count: 2, style: 'beaux-arts' }, generic: false, ...o })
const DUSABLE = B({ key: 'dusable', decks: 2, span: 78, width: 28, houses: { count: 4, style: 'dusable' }, reliefs: { ne: 'The Discoverers', nw: 'The Pioneers', sw: 'Defense', se: 'Regeneration' } })

describe('bridge houses', () => {
  it('two tender houses stand on opposite corners, on land, beside the roadway', () => {
    const s = houseSpots(B())
    expect(s).toHaveLength(2)
    expect(Math.sign(s[0].at[0])).toBe(-Math.sign(s[1].at[0]))
    expect(Math.sign(s[0].at[1])).toBe(-Math.sign(s[1].at[1]))
    for (const h of s) { expect(Math.abs(h.at[1])).toBeGreaterThan(35); expect(Math.abs(h.at[0])).toBeGreaterThan(11) }
  })
  it('DuSable: four limestone bridge houses, each with its named relief on the right corner', () => {
    const { fixed } = buildBridge(DUSABLE, { deckY: 0.14 })
    const reliefs = fixed.filter((p) => p.part.startsWith('relief:'))
    expect(reliefs.map((p) => p.part).sort()).toEqual(['relief:defense', 'relief:regeneration', 'relief:the-discoverers', 'relief:the-pioneers'])
    const ne = pts(reliefs.filter((p) => p.part === 'relief:the-discoverers'))
    expect(ne.every((q) => q[0] > 0 && q[2] < 0)).toBe(true)      // north-east: +x, −z
    expect(fixed.filter((p) => p.part === 'house' && p.style === 'bedford-limestone')).toHaveLength(4)
    expect(Math.max(...pts(fixed.filter((p) => p.part === 'house')).map((q) => q[1]))).toBeGreaterThan(12)
  })
  it('DuSable: stone balustrades and a double deck', () => {
    const r = buildBridge(DUSABLE, { deckY: 0.14 })
    expect(r.fixed.some((p) => p.part === 'balustrade')).toBe(true)
    expect(r.leaves[0].meshes.some((p) => p.part === 'lower-deck')).toBe(true)
  })
  it('generic OSM bascules get leaves and lights but no houses', () => {
    const r = buildBridge(B({ generic: true, houses: { count: 0, style: 'modern' } }), { deckY: 0.14 })
    expect(r.fixed.some((p) => p.part === 'house')).toBe(false)
    expect(r.leaves).toHaveLength(2)
  })
})

describe('bridge lights', () => {
  it('lanterns, a red nav light on each leaf tip edge, and pier lights', () => {
    const L = bridgeLights(B(), 0.14)
    expect(L.filter((l) => l.kind === 'lantern')).toHaveLength(4)
    expect(L.filter((l) => l.kind === 'nav' && l.leaf === 0)).toHaveLength(2)
    expect(L.filter((l) => l.kind === 'nav' && l.leaf === 1)).toHaveLength(2)
    expect(L.filter((l) => l.kind === 'pier')).toHaveLength(4)
  })
  it('DuSable has lamp standards along every balustrade', () => {
    expect(bridgeLights(DUSABLE, 0.14).filter((l) => l.kind === 'lantern').length).toBeGreaterThanOrEqual(12)
  })
  it('lantern glass is a signal surface', () => {
    const { fixed } = buildBridge(B(), { deckY: 0.14 })
    expect(fixed.filter((p) => p.part === 'lantern').every((p) => p.facade === F.signal && p.style === 'lantern-warm')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix pipeline -- tests/bridgeBuild.test.js`
Expected: FAIL — `buildBridge is not a function`.

- [ ] **Step 3: Implement (append to `pipeline/lib/bridges.js`)**

Add `import { drum, pyramid } from './crowns.js'` at the top. Then append:
```js
// ── Houses, balustrades, lanterns ────────────────────────────────────────────
// Tender houses stand on diagonal corners (the operating houses); DuSable has four Bedford-stone bridgehouses
// with Fraser's (north) and Hering's (south) 1928 reliefs (https://en.wikipedia.org/wiki/DuSable_Bridge).
export const HOUSE_STYLES = {
  'beaux-arts': { w: 6, dpt: 5, h: 6.5, roof: 'hip' },
  deco: { w: 6, dpt: 5, h: 7, roof: 'stepped' },
  moderne: { w: 7, dpt: 4.5, h: 6, roof: 'flat' },
  modern: { w: 7, dpt: 5, h: 5.5, roof: 'flat', glass: true },
  dusable: { w: 9.5, dpt: 9.5, h: 12.5, roof: 'attic' },
}
const cornerName = (p, c) => `${p[1] < c[1] ? 'n' : 's'}${p[0] < c[0] ? 'w' : 'e'}`
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')

export function houseSpots(b) {
  const st = HOUSE_STYLES[b.houses?.style] ?? HOUSE_STYLES.moderne, v = left(b.axis), n = b.houses?.count ?? 0
  const corners = n >= 4 ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : n === 2 ? [[1, 1], [-1, -1]] : n === 1 ? [[1, 1]] : []
  const tail = (DECK.tailFrac * b.span) / 2
  return corners.map(([s, side]) => {
    const along = b.span / 2 + (b.houses.style === 'dusable' ? st.dpt / 2 + 0.5 : tail * 0.6)
    const at = add2(add2(b.centre, mul2(b.axis, s * along)), mul2(v, side * (b.width / 2 + st.w / 2 + 0.6)))
    return { at, s, side, facing: mul2(v, -side), corner: cornerName(at, b.centre) }
  })
}

export function buildHouse(spot, styleKey, relief = null) {
  const st = HOUSE_STYLES[styleKey] ?? HOUSE_STYLES.moderne, u = spot.facing, out = []
  const push = (m, facade, style, part, seed = 0.5) => out.push({ mesh: m, facade, seed, style, part })
  const stone = styleKey === 'dusable' ? 'bedford-limestone' : 'tender-limestone'
  if (st.glass) push(slab(mesh(), spot.at, u, st.dpt, st.w, 0, st.h), F.wall, 'tender-glass', 'house', 0.35) // glass-steel band
  else push(slab(mesh(), spot.at, u, st.dpt, st.w, 0, st.h), F.stone, stone, 'house')
  const v = left(u), ring = (e) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, o]) => add2(add2(spot.at, mul2(u, a * (st.dpt / 2 + e))), mul2(v, o * (st.w / 2 + e))))
  if (st.roof === 'hip') push(pyramid({ ring: ring(0.4), base: st.h, top: st.h + 2.6 }), F.roofing, null, 'roof', 0.35) // verdigris copper
  if (st.roof === 'stepped') { const m = mesh(); slab(m, spot.at, u, st.dpt - 1, st.w - 1, st.h, st.h + 1); slab(m, spot.at, u, st.dpt - 2.4, st.w - 2.4, st.h + 1, st.h + 1.8); push(m, F.stone, stone, 'roof') }
  if (st.roof === 'flat') push(slab(mesh(), spot.at, u, st.dpt + 1, st.w + 1, st.h, st.h + 0.4), F.stone, stone, 'roof')
  if (st.roof === 'attic') {
    const m = mesh(); slab(m, spot.at, u, st.dpt + 1, st.w + 1, st.h, st.h + 0.9); slab(m, spot.at, u, st.dpt - 1, st.w - 1, st.h + 0.9, st.h + 2.5)
    push(m, F.stone, stone, 'roof')
  }
  if (relief) {   // bas-relief panel with five standing figures on the face toward the roadway
    const face = add2(spot.at, mul2(u, st.dpt / 2)), m = slab(mesh(), add2(face, mul2(u, 0.17)), u, 0.35, 6, 3, 10)
    for (let i = 0; i < 5; i++) {
      const o = -2.2 + 1.1 * i, p = add2(add2(face, mul2(u, 0.45)), mul2(v, o)), lean = 0.25 * Math.sin(i * 1.7)
      tube(m, at3(p, 3.6), at3(add2(p, mul2(v, lean)), 8.4), 0.42, 6)
      const head = drum({ at: add2(p, mul2(v, lean)), base: 8.4, top: 9.2, r: 0.38, sides: 8 })
      for (const k of ['positions', 'normals', 'uvs']) m[k].push(...head[k])
    }
    push(m, F.stone, 'bedford-limestone-relief', `relief:${slug(relief)}`)
  }
  return out
}

export function buildBalustrades(b, deckY) {
  const v = left(b.axis), out = mesh(), L = 16
  for (const s of [1, -1]) for (const side of [1, -1]) {
    const base = (a) => add2(add2(b.centre, mul2(b.axis, s * a)), mul2(v, side * (b.width / 2 - 0.3)))
    for (let a = b.span / 2; a <= b.span / 2 + L + 1e-6; a += 2.4) slab(out, base(a), b.axis, 0.45, 0.45, deckY, deckY + 1.1)
    slab(out, base(b.span / 2 + L / 2), b.axis, L, 0.55, deckY + 1.1, deckY + 1.35)
  }
  return { mesh: out, facade: F.stone, seed: 0.5, style: 'bedford-limestone', part: 'balustrade' }
}

export function lanternSpots(b, deckY) {
  const v = left(b.axis), out = []
  const along = b.houses?.style === 'dusable' ? [b.span / 2 + 2, b.span / 2 + 9, b.span / 2 + 16] : [b.span / 2 + 1]
  for (const s of [1, -1]) for (const side of [1, -1]) for (const a of along)
    out.push(at3(add2(add2(b.centre, mul2(b.axis, s * a)), mul2(v, side * (b.width / 2 - 0.3))), deckY + 5.6))
  return out
}

export function bridgeLights(b, deckY) {
  const out = lanternSpots(b, deckY).map((p) => ({ p, kind: 'lantern' }))
  for (const g of leafGeometry(b, deckY)) {
    const v = left(g.d)
    for (const o of [-1, 1]) {
      out.push({ p: at3(add2(add2(g.p2, mul2(g.d, g.Lf - 0.3)), mul2(v, o * (b.width / 2 - 0.3))), deckY + 1.25), kind: 'nav', leaf: g.leaf })
      out.push({ p: at3(add2(add2(g.p2, mul2(g.d, 0.6)), mul2(v, o * (b.width / 2 + 0.4))), deckY + 0.5), kind: 'pier' })
    }
  }
  return out
}

export function buildBridge(b, { deckY }) {
  const fixed = [...buildPits(b, deckY)]
  for (const spot of houseSpots(b)) fixed.push(...buildHouse(spot, b.houses.style, b.reliefs?.[spot.corner] ?? null))
  if (b.houses?.style === 'dusable') fixed.push(buildBalustrades(b, deckY))
  const posts = mesh(), glass = mesh()
  for (const p of lanternSpots(b, deckY)) {
    tube(posts, [p[0], deckY, p[2]], [p[0], p[1] - 0.4, p[2]], 0.12, 6)
    slab(glass, [p[0], p[2]], b.axis, 0.55, 0.55, p[1] - 0.4, p[1] + 0.3)
  }
  fixed.push({ mesh: posts, facade: F.steel, seed: 0.5, style: 'lamp-post-black', part: 'lamp-post' })
  fixed.push({ mesh: glass, facade: F.signal, seed: 0.5, style: 'lantern-warm', part: 'lantern' })
  return { fixed, leaves: buildLeaves(b, deckY), lights: bridgeLights(b, deckY) }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --prefix pipeline -- tests/bridgeBuild.test.js tests/bridgeParts.test.js tests/bridges.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/bridges.js pipeline/tests/bridgeBuild.test.js
git commit -m "feat(v6): tender houses by era, the four DuSable bridgehouses with their reliefs, balustrades, lanterns and navigation lights" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 7: Build integration — cut the ribbons, bake the bridges, write `bridges.json`

**Files:**
- Modify: `pipeline/lib/bridges.js` (append `spanRect`, `makeRibbonCutter`, `bridgeSidecar`), `pipeline/build/build-world.js`, `app/src/world/TileContent.jsx`
- Test: `pipeline/tests/bridgeWorld.test.js`

**Interfaces:**
- Consumes:
  - Tasks 4–6;
  - V2 `styleIndex(key)`;
  - V2 `appendBuilding(dst, mesh, facade, seed, bldgIdx, style)`, plus `bAcc()` and `asLayer()` with the STYLE extra;
  - `GROUND_Y.roads`.
- Produces:
  - `spanRect(b) → { c, u, hl, hw }` — the span plus both tails plus 0.6 m, and the width plus 1.5 m each side
  - `makeRibbonCutter(bridges) → (way: {id, points}) → points[][]`. It cuts claimed ways, and any way with a segment inside a rect that runs within ±37° of the bridge axis; perpendicular streets are kept.
  - `bridgeSidecar(bridges, built[], liftOrder) → { version: 1, bridges: [{ key, name, street, branch, year, liftable, centre, axis, span, leaves: number[], source }], leaves: [{ bridge, pivot:[x,y,z], k:[x,0,z] }], lights: [{ p, kind, leaf?: globalLeafId }], liftOrder: string[] (liftable only) }`
  - Tile GLB layer `leaves`, with an extra `_LEAF` = global leaf id + 1 (0 = none). LOD1 and the blocks carry the leaves as static building geometry.
  - `app/public/world/bridges.json`
  - Manifest: `bridges: 'bridges.json'`, and one `landmarks[]` row per named bridge: `key: 'bridge-<key>'`, `top: 8`, `beacon: [x, 14, z]`.

- [ ] **Step 1: Write the failing test**

`pipeline/tests/bridgeWorld.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { makeRibbonCutter, spanRect, bridgeSidecar, buildBridge } from '../lib/bridges.js'

const B = (o = {}) => ({ key: 'b', name: 'B', leaf: 'deck-truss', decks: 1, span: 70, width: 22, centre: [0, 0], axis: [0, -1], houses: { count: 2, style: 'beaux-arts' }, liftable: true, wayIds: [1], railWayIds: [], ...o })

describe('ribbon cutting — one deck per crossing', () => {
  const cut = makeRibbonCutter([B()])
  it('a claimed way loses everything over the span and tails', () => {
    const pieces = cut({ id: 1, points: [[0, 60], [0, -60]] })
    const r = spanRect(B())
    for (const p of pieces) for (const q of p) expect(Math.abs(q[1])).toBeGreaterThanOrEqual(r.hl - 1e-6)
  })
  it('an unclaimed approach running along the bridge is cut too (no ribbon over the tail pit)', () => {
    const pieces = cut({ id: 2, points: [[1, 80], [1, 30]] })
    expect(Math.min(...pieces.flat().map((q) => q[1]))).toBeGreaterThanOrEqual(spanRect(B()).hl - 1e-6)
  })
  it('a perpendicular street along the bank (Wacker) is never cut', () => {
    const w = [[-100, 40], [100, 40]]
    expect(cut({ id: 3, points: w })).toEqual([w])
  })
  it('ways far away are untouched', () => {
    expect(cut({ id: 4, points: [[500, 0], [500, 50]] })).toEqual([[[500, 0], [500, 50]]])
  })
})

describe('bridges sidecar', () => {
  it('numbers leaves globally, maps nav lights to them, and keeps only liftable bridges in the lift order', () => {
    const bs = [B({ key: 'a' }), B({ key: 'b', centre: [300, 0], liftable: false })]
    const s = bridgeSidecar(bs, bs.map((b) => buildBridge(b, { deckY: 0.14 })), ['b', 'a'])
    expect(s.leaves).toHaveLength(4)
    expect(s.bridges[1].leaves).toEqual([2, 3])
    expect(s.lights.filter((l) => l.kind === 'nav').map((l) => l.leaf).sort()).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
    expect(s.liftOrder).toEqual(['a'])
    expect(s.leaves[0].k[1]).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix pipeline -- tests/bridgeWorld.test.js`
Expected: FAIL — `makeRibbonCutter is not a function`.

- [ ] **Step 3: Implement the pure helpers (append to `bridges.js`)**

```js
// ── World integration ────────────────────────────────────────────────────────
export const spanRect = (b) => ({ c: b.centre, u: b.axis, hl: b.span / 2 + (DECK.tailFrac * b.span) / 2 + 0.6, hw: b.width / 2 + 1.5 })

function runsAlong(points, r) {
  for (let i = 0; i < points.length - 1; i++) {
    if (!clipSegment(points[i], points[i + 1], r)) continue
    if (Math.abs(dot2(norm2(sub2(points[i + 1], points[i])), r.u)) > 0.8) return true
  }
  return false
}

export function makeRibbonCutter(bridges) {
  const rects = bridges.map((b) => ({ r: spanRect(b), ids: new Set(b.wayIds) }))
  return (way) => {
    let lines = [way.points]
    for (const { r, ids } of rects) lines = lines.flatMap((l) => (ids.has(way.id) || runsAlong(l, r) ? cutPolyline(l, r) : [l]))
    return lines
  }
}

const r1 = (x) => Math.round(x * 10) / 10, r3 = (x) => Math.round(x * 1000) / 1000
export function bridgeSidecar(bridges, built, liftOrder) {
  const leaves = [], lights = [], out = []
  bridges.forEach((b, i) => {
    const ids = built[i].leaves.map((l) => { leaves.push({ bridge: b.key, pivot: l.pivot.map(r3), k: l.k.map(r3) }); return leaves.length - 1 })
    for (const L of built[i].lights) lights.push({ p: L.p.map(r1), kind: L.kind, ...(L.leaf != null ? { leaf: ids[L.leaf] } : {}) })
    out.push({ key: b.key, name: b.name, street: b.street ?? null, branch: b.branch ?? null, year: b.year ?? null, liftable: b.liftable, centre: b.centre.map(r1), axis: b.axis.map(r3), span: b.span, leaves: ids, source: b.source ?? null })
  })
  const ok = new Set(bridges.filter((b) => b.liftable).map((b) => b.key))
  return { version: 1, bridges: out, leaves, lights, liftOrder: liftOrder.filter((k) => ok.has(k)) }
}
```
The `leaf` field on nav lights is the builder-local 0|1, which the sidecar maps to the global id; the test expects this.

- [ ] **Step 4: Wire `build-world.js`**

(a) Imports:
```js
import { detectBridges, buildBridge, makeRibbonCutter, bridgeSidecar } from '../lib/bridges.js'
```
(add `import { styleIndex } from '../lib/styles.js'` if V2 has not already imported it)

(b) Right after `const rail = uniq(chunks('rail')).filter((e) => e.geometry)`:
```js
  // ── Bridges: OSM movable ways → named Chicago bascules; their ribbons give way to one leaf deck ──
  const bridgeData = loadJson(join(ROOT, 'data', 'bridges.json'))
  const skipWays = new Set(bridgeData.skipWays ?? [])
  const wayRecs = [...roads, ...rail].filter((e) => !skipWays.has(e.id)).map((e) => ({ id: e.id, tags: e.tags || {}, points: e.geometry.map((p) => project(p.lon, p.lat)) }))
  const bridges = detectBridges(wayRecs, bridgeData.bridges)
  const deckY = GROUND_Y.roads + 0.02
  const builtBridges = bridges.map((b) => buildBridge(b, { deckY }))
  const bridgeSide = bridgeSidecar(bridges, builtBridges, bridgeData.liftOrder)
  const cutRibbon = makeRibbonCutter(bridges)
  const sIdx = (k) => (k ? styleIndex(k) : 0)
  log(`bridges: ${bridges.length} (${bridges.filter((b) => !b.generic).length} named), leaves ${bridgeSide.leaves.length}`)
```
(c) In `tile(k)`'s initial object add `bridges: []`. After `for (const b of buildings) tile(tileKeyFor(b.centroid)).b.push(b)` add:
```js
  bridges.forEach((br, i) => tile(tileKeyFor(br.centre)).bridges.push({ br, built: builtBridges[i], leafIds: bridgeSide.bridges[i].leaves }))
```
(d) Replace the roads loop head so every ribbon goes through the cutter:
```js
  for (const e of roads) {
    const hw = roadHalfWidth(e.tags)
    for (const pts of cutRibbon({ id: e.id, points: e.geometry.map((p) => project(p.lon, p.lat)) }))
      for (const [k, lines] of splitLineByTiles(pts)) for (const l of lines) {
        const t = tile(k); append(t.roads, bufferPolyline(l, hw, GROUND_Y.roads)); append(t.roadsLod1, bufferPolyline(l, hw, GROUND_Y.roads))
        if (!['motorway', 'motorway_link', 'service'].includes(e.tags.highway)) append(t.walks, bufferPolyline(l, hw + 3, GROUND_Y.sidewalks))
      }
  }
```
(e) The rail loop does the same. Replace `const t = e.tags || {}, pts = e.geometry.map(...)` and the `for (const [k, lines] of splitLineByTiles(pts))` line with:
```js
    const t = e.tags || {}
    const elevated = isElevatedRail(t), grade = !(t.tunnel && t.tunnel !== 'no') && parseInt(t.layer ?? '0', 10) >= 0
    if (!elevated && !grade) continue
    for (const pts of cutRibbon({ id: e.id, points: e.geometry.map((p) => project(p.lon, p.lat)) })) for (const [k, lines] of splitLineByTiles(pts)) for (const l of lines) {
```
Keep the existing loop body. The body's closing braces gain one level.

(f) In the per-tile block, right after `t.b.forEach(...)`:
```js
    const LV = { ...bAcc(), leaf: [] }
    for (const { br, built, leafIds } of t.bridges) {
      const idx = meta.length
      meta.push({ id: `bridge:${br.key}`, name: br.name, address: null, stories: null, year: br.year ?? null, height: 0, hero: null, bridge: br.key })
      for (const m of built.fixed) { appendBuilding(L0, m.mesh, m.facade, m.seed, idx, sIdx(m.style)); appendBuilding(L1, m.mesh, m.facade, m.seed, idx, sIdx(m.style)) }
      built.leaves.forEach((lf, j) => {
        for (const m of lf.meshes) {
          appendBuilding(LV, m.mesh, m.facade, m.seed, idx, sIdx(m.style))
          for (let q = 0; q < m.mesh.positions.length / 3; q++) LV.leaf.push(leafIds[j] + 1)
          appendBuilding(L1, m.mesh, m.facade, m.seed, idx, sIdx(m.style)) // far tiles show the leaves closed
        }
      })
    }
```
In `hasContent`, add `|| LV.positions.length`. Change the LOD0 write to:
```js
    const asLeafLayer = (a) => { const l = asLayer(a); l.extra.LEAF = new Float32Array(a.leaf); return l }
    await writeTileGlb(join(OUT, 'tiles', `${key}.glb`), { buildings: asLayer(L0), leaves: LV.positions.length ? asLeafLayer(LV) : null, ground: ground0, water: waterM, elevated: t.elevated })
```
(g) After `log(\`tiles: ${tiles.length}\`)`:
```js
  writeFileSync(join(OUT, 'bridges.json'), JSON.stringify(bridgeSide))
```
(h) In the manifest object, add `bridges: 'bridges.json'`. Append the named bridges to `landmarks` (after the hero rows):
```js
      ...bridges.filter((b) => !b.generic).map((b) => ({ key: `bridge-${b.key}`, name: b.name, aliases: b.aliases, x: Math.round(b.centre[0]), z: Math.round(b.centre[1]), top: 8, beacon: [Math.round(b.centre[0]), 14, Math.round(b.centre[1])] })),
```
Set `version` to the value the Task 1 ledger line recorded (V5's version + 1).

(i) In `app/src/world/TileContent.jsx`, draw the new layer with the building material for now; Task 8 swaps in the leaf material:
```js
      if (layer === 'buildings' || layer === 'leaves') { o.material = buildingMaterial; o.castShadow = lod === 'lod0' && layer === 'buildings' }
```
This replaces the existing `if (layer === 'buildings') …` line.

- [ ] **Step 5: Run the tests, then build the world**

Run: `npm test --prefix pipeline`
Expected: PASS (all pipeline tests).

Run: `npm run build:world --prefix pipeline`. This is the only heavy process.
Expected: the log contains `bridges: 32 (32 named), leaves 64` and `skyline: missing 0`. `app/public/world/bridges.json` exists.
If a movable way was left unclaimed, the log shows more than 32 bridges and fewer named. In that case, add that way's id to the matching entry's `osmWays`, or to `skipWays` if it is rail-only, and record a `Ruling:` line.

- [ ] **Step 6: Visual — bascule structure (E4) and the DuSable close-up (E5), with evaluate-and-revert**

Run (dev server + Playwright only):
```bash
cd app && GALLERY_DIR=../.superpowers/sdd/2026-09-29-v6-landmarks-bridges/shots GALLERY_MILESTONE=v6 GALLERY="bridges:bridges-after@day,bridges:bridges-after@night,dusable:dusable-after@day,dusable:dusable-after@dusk,dusable:dusable-after@night,southbranch:southbranch-after@day,wells:wells-after@dusk" npx playwright test e2e/gallery.spec.js
```
Poses (local metres):
- `bridges`: camera (180, 60, −540) → target (−420, 4, −612)
- `dusable`: (385, 32, −680) → (287, 5, −757)
- `southbranch`: (−760, 80, −160) → (−850, 4, 330)
- `wells`: (−450, 35, −540) → (−511, 6, −611)

Compare each against its `*-before-*` shot from Task 1. Keep the change only if all of these hold:
- (a) each crossing shows ONE deck, with no flicker and no second ribbon;
- (b) the lattice railings and tender houses read at the `bridges` pose;
- (c) the DuSable pose shows four limestone houses, the reliefs facing the roadway, and balustrades;
- (d) no bridge part pokes above the water in the river (the under-deck structure is hidden);
- (e) the Wells L deck lines up with the elevated ribbon at both ends, with no gap over 1 m.

Log a reference comparison of the DuSable pose against https://en.wikipedia.org/wiki/DuSable_Bridge in the ledger.
If (a)–(e) fail after one fix attempt, run `git revert --no-edit <this task's feat sha>` as its own commit, rebuild, and add `Reverted: bascule integration — <why>` to the ledger.

- [ ] **Step 7: Commit (code only; the world build is committed in Task 20)**

```bash
git add pipeline/lib/bridges.js pipeline/build/build-world.js pipeline/tests/bridgeWorld.test.js app/src/world/TileContent.jsx
git commit -m "feat(v6): bridges in the world — ribbons cut over each span, fixed parts in buildings, leaves in their own layer, bridges.json sidecar and ⌘K rows" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: The lift easter egg — boat-run schedule, trunnion rotation in the shader, B key (E7)

The real schedule: Chicago's spring (April–June) and fall (September–November) boat runs raise the river bridges in sequence on Wednesdays and Saturdays. The model uses 09:30 on Wednesdays and 08:00 on Saturdays, Chicago time (source: https://www.chicagoloopbridges.com/, CDOT boat-run lifts).
- Spring runs go upriver from the lake (the `liftOrder`); fall runs go the reverse way.
- Pressing **B** plays a compressed demo lift at any time.
- Wells and Lake (they carry the L) and the fixed-in-place Congress span are not liftable.

**Files:**
- Create:
  - `app/src/lib/chicagoTime.js`, `app/src/lib/__tests__/chicagoTime.test.js`
  - `app/src/bridges/lift.js`, `app/src/bridges/leafTexture.js`, `app/src/bridges/BridgeLeaves.jsx`
  - `app/src/bridges/__tests__/lift.test.js`
  - `app/src/world/Landmarks.jsx`
  - `app/src/state/__tests__/v6store.test.js`, `app/src/hud/__tests__/v6controls.test.jsx`
- Modify:
  - `app/src/world/materials/facadeMaterial.js` (the `USE_LEAF` path, `uLeafTex`, `createFacadeMaterial({ leaf })`)
  - `app/src/world/City.jsx` (`leafMaterial`), `app/src/world/TileContent.jsx`, `app/src/world/Scene.jsx`
  - `app/src/state/store.js`
  - `app/src/hud/CommandPalette.jsx` (export `commands`), `HelpOverlay.jsx`, `HintBar.jsx`, `ControlDock.jsx`
  - `app/src/camera/AtlasRig.jsx`

**Interfaces:**
- Consumes: the `bridges.json` sidecar (Task 7); `facadeUniforms`.
- Produces:
  - `chicagoClock(date) → { year, month, day, hour, minute, second, weekday (0 = Sun) }`
  - `lift.js`:
    - `MAX_LIFT_DEG = 75`
    - `LIFT = { raiseS: 90, holdS: 240, lowerS: 90, staggerS: 150 }`, `LIFT_DEMO = { raiseS: 25, holdS: 30, lowerS: 25, staggerS: 6 }`
    - `BOAT_RUNS`
    - `runDuration(n, timing)`, `liftAngle(t, timing) → radians`, `liftPlan(order, elapsed, timing) → { [key]: radians }`
    - `boatRunAt(date, order) → { season, elapsed, order } | null`
    - `liftState({ now:ms, manualStart:ms|null, order }) → { source: 'manual'|'spring'|'fall'|'idle', done, angles }`
    - `rotateAboutAxis(p, pivot, k, a) → [x,y,z]`
  - `leafTexture.js`: `LEAF_TEX_MIN = 256`, `packLeaves(leaves, anglesByBridge, out?) → Float32Array` (8 floats per leaf: pivot.xyz, angle, k.xyz, 0)
  - `BridgeLeaves.jsx`: exports `liveLift = { angles }`, read by the Task 9 lights
  - Store: `bridgeLift: { startedAt:number, id:number } | null`, `startBridgeLift()`, `stopBridgeLift()`
  - `facadeUniforms.uLeafTex`; `createFacadeMaterial({ leaf: boolean })`; `leafMaterial` (City.jsx)
  - `commands()` exported from CommandPalette
  - `Landmarks.jsx({ manifest })`: loads `/world/${manifest.bridges}` and `/world/${manifest.landmarkRuntime}`, drives `uTime`, and mounts the V6 runtime children

- [ ] **Step 1: Write the failing tests**

`app/src/lib/__tests__/chicagoTime.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { chicagoClock } from '../chicagoTime.js'
describe('chicagoClock', () => {
  it('reads Chicago wall time whatever the host zone', () => {
    expect(chicagoClock(new Date('2026-09-28T17:05:30Z'))).toMatchObject({ month: 9, day: 28, hour: 12, minute: 5, second: 30, weekday: 1 })
    expect(chicagoClock(new Date('2026-01-15T05:00:00Z'))).toMatchObject({ month: 1, day: 14, hour: 23 })   // CST, UTC−6
    expect(chicagoClock(new Date('2026-07-04T05:00:00Z'))).toMatchObject({ month: 7, day: 4, hour: 0 })     // CDT, UTC−5
  })
})
```

`app/src/bridges/__tests__/lift.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { liftAngle, liftPlan, boatRunAt, liftState, runDuration, rotateAboutAxis, LIFT, LIFT_DEMO, MAX_LIFT_DEG } from '../lift.js'
import { packLeaves } from '../leafTexture.js'

const MAX = (MAX_LIFT_DEG * Math.PI) / 180
const order = ['lakeshore', 'columbus', 'dusable']

describe('leaf angle', () => {
  it('rises, holds at 75°, lowers, and rests at 0 before and after', () => {
    expect(liftAngle(-5)).toBe(0)
    expect(liftAngle(LIFT.raiseS / 2)).toBeCloseTo(MAX / 2)
    expect(liftAngle(LIFT.raiseS + 10)).toBeCloseTo(MAX)
    expect(liftAngle(LIFT.raiseS + LIFT.holdS + LIFT.lowerS + 1)).toBe(0)
    for (let t = -10; t < 500; t += 7) { const a = liftAngle(t); expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThanOrEqual(MAX + 1e-12) }
  })
  it('bridges lift in sequence, staggered', () => {
    const p = liftPlan(order, LIFT.raiseS, LIFT)
    expect(p.lakeshore).toBeCloseTo(MAX); expect(p.dusable).toBe(0)
  })
})

describe('boat runs (Chicago time)', () => {
  it('a spring Saturday at 08:05 runs upriver; a Monday never runs', () => {
    const r = boatRunAt(new Date('2026-05-02T13:05:00Z'), order)            // Sat May 2, 08:05 CDT
    expect(r.season).toBe('spring'); expect(r.order[0]).toBe('lakeshore'); expect(r.elapsed).toBe(300)
    expect(boatRunAt(new Date('2026-05-04T13:05:00Z'), order)).toBeNull()   // Monday
  })
  it('fall runs go back out to the lake; winter has none', () => {
    const r = boatRunAt(new Date('2026-10-07T14:35:00Z'), order)            // Wed Oct 7, 09:35 CDT
    expect(r.season).toBe('fall'); expect(r.order[0]).toBe('dusable')
    expect(boatRunAt(new Date('2026-01-07T15:35:00Z'), order)).toBeNull()
  })
})

describe('manual lift (B)', () => {
  it('pressing B again restarts from the new press; the run ends with every leaf down', () => {
    const t0 = 1_000_000
    const a = liftState({ now: t0 + 20_000, manualStart: t0, order })
    const b = liftState({ now: t0 + 20_000, manualStart: t0 + 19_000, order })    // pressed again 1 s ago
    expect(a.angles.lakeshore).toBeGreaterThan(b.angles.lakeshore)
    const end = liftState({ now: t0 + runDuration(order.length, LIFT_DEMO) * 1000 + 1, manualStart: t0, order })
    expect(end.done).toBe(true); expect(end.angles).toEqual({})
  })
  it('without a press the schedule decides', () => {
    expect(liftState({ now: Date.parse('2026-05-04T13:05:00Z'), manualStart: null, order }).source).toBe('idle')
  })
})

describe('trunnion rotation', () => {
  it('turning a tip 90° about k = d × up lifts it straight above the pivot, preserving length', () => {
    const pivot = [0, -1, 0], d = [0, 0, 1], k = [-d[2], 0, d[0]]
    const q = rotateAboutAxis([0, -1, 30], pivot, k, Math.PI / 2)
    expect(q[0]).toBeCloseTo(0); expect(q[1]).toBeCloseTo(29); expect(q[2]).toBeCloseTo(0)
  })
  it('packs pivot, angle and axis per leaf', () => {
    const f = packLeaves([{ bridge: 'x', pivot: [1, 2, 3], k: [0, 0, 1] }], { x: 0.5 })
    expect(Array.from(f.slice(0, 8))).toEqual([1, 2, 3, 0.5, 0, 0, 1, 0])
  })
})
```

`app/src/state/__tests__/v6store.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { useStore } from '../store.js'
describe('V6 store', () => {
  it('startBridgeLift twice restarts; stop clears', async () => {
    useStore.getState().startBridgeLift()
    const first = useStore.getState().bridgeLift
    await new Promise((r) => setTimeout(r, 5))
    useStore.getState().startBridgeLift()
    expect(useStore.getState().bridgeLift.startedAt).toBeGreaterThan(first.startedAt)
    useStore.getState().stopBridgeLift()
    expect(useStore.getState().bridgeLift).toBeNull()
  })
})
```

`app/src/hud/__tests__/v6controls.test.jsx`:
```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { commands } from '../CommandPalette.jsx'
import HelpOverlay from '../HelpOverlay.jsx'
import HintBar from '../HintBar.jsx'
import { useStore } from '../../state/store.js'

describe('V6 controls are discoverable', () => {
  it('⌘K, help card and hint bar offer the bridge lift', () => {
    expect(commands().some((c) => c.name === 'Raise the river bridges')).toBe(true)
    useStore.getState().setHelpOpen(true)
    render(<><HelpOverlay /><HintBar /></>)
    expect(screen.getByText(/raise the river bridges/i)).toBeInTheDocument()
    expect(screen.getByText('bridges')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --prefix app -- src/lib/__tests__/chicagoTime.test.js src/bridges src/state/__tests__/v6store.test.js src/hud/__tests__/v6controls.test.jsx`
Expected: FAIL — `Failed to load url ../chicagoTime.js`, `../lift.js`; `startBridgeLift is not a function`; `commands` is not exported.

- [ ] **Step 3: Implement the pure modules**

`app/src/lib/chicagoTime.js`:
```js
// app/src/lib/chicagoTime.js — Chicago wall-clock parts for any Date, independent of the host time zone.
const FMT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short' })
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
export function chicagoClock(date = new Date()) {
  const p = Object.fromEntries(FMT.formatToParts(date).map((x) => [x.type, x.value]))
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute, second: +p.second, weekday: WD[p.weekday] }
}
```

`app/src/bridges/lift.js`:
```js
// app/src/bridges/lift.js — Chicago's boat-run bridge lifts: schedule, leaf angles and the trunnion rotation.
import { chicagoClock } from '../lib/chicagoTime.js'

export const MAX_LIFT_DEG = 75
export const LIFT = { raiseS: 90, holdS: 240, lowerS: 90, staggerS: 150 }
export const LIFT_DEMO = { raiseS: 25, holdS: 30, lowerS: 25, staggerS: 6 }
// Spring runs bring sailboats in from the lake to the boatyards, fall runs take them back out.
export const BOAT_RUNS = { spring: [4, 5, 6], fall: [9, 10, 11], starts: { 3: [9, 30], 6: [8, 0] }, source: 'https://www.chicagoloopbridges.com/ (CDOT boat-run lift schedule)' }

export const runDuration = (n, T = LIFT) => Math.max(0, n - 1) * T.staggerS + T.raiseS + T.holdS + T.lowerS
const ease = (x) => x * x * (3 - 2 * x)
export function liftAngle(t, T = LIFT) {
  const max = (MAX_LIFT_DEG * Math.PI) / 180
  if (t <= 0) return 0
  if (t < T.raiseS) return max * ease(t / T.raiseS)
  if (t < T.raiseS + T.holdS) return max
  if (t < T.raiseS + T.holdS + T.lowerS) return max * (1 - ease((t - T.raiseS - T.holdS) / T.lowerS))
  return 0
}
export const liftPlan = (order, elapsed, T = LIFT) => Object.fromEntries(order.map((k, i) => [k, liftAngle(elapsed - i * T.staggerS, T)]))

export function boatRunAt(date, order) {
  const c = chicagoClock(date), start = BOAT_RUNS.starts[c.weekday]
  const season = BOAT_RUNS.spring.includes(c.month) ? 'spring' : BOAT_RUNS.fall.includes(c.month) ? 'fall' : null
  if (!season || !start) return null
  const elapsed = (c.hour - start[0]) * 3600 + (c.minute - start[1]) * 60 + c.second
  if (elapsed < 0 || elapsed > runDuration(order.length)) return null
  return { season, elapsed, order: season === 'spring' ? order : [...order].reverse() }
}

export function liftState({ now, manualStart = null, order }) {
  if (manualStart != null) {
    const elapsed = (now - manualStart) / 1000
    const done = elapsed > runDuration(order.length, LIFT_DEMO)
    return { source: 'manual', done, angles: done ? {} : liftPlan(order, elapsed, LIFT_DEMO) }
  }
  const run = boatRunAt(new Date(now), order)
  return { source: run ? run.season : 'idle', done: false, angles: run ? liftPlan(run.order, run.elapsed) : {} }
}

// Rodrigues rotation of p about the unit axis k through pivot (mirrors the USE_LEAF vertex shader).
export function rotateAboutAxis(p, pivot, k, a) {
  const v = [p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2]], c = Math.cos(a), s = Math.sin(a)
  const kxv = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]], kd = k[0] * v[0] + k[1] * v[1] + k[2] * v[2]
  return [0, 1, 2].map((i) => pivot[i] + v[i] * c + kxv[i] * s + k[i] * kd * (1 - c))
}
```

`app/src/bridges/leafTexture.js`:
```js
// app/src/bridges/leafTexture.js — one RGBA float texel pair per leaf: (pivot.xyz, angle), (k.xyz, 0).
export const LEAF_TEX_MIN = 256
export function packLeaves(leaves, anglesByBridge, out = new Float32Array(Math.max(LEAF_TEX_MIN, leaves.length) * 8)) {
  leaves.forEach((l, i) => out.set([l.pivot[0], l.pivot[1], l.pivot[2], anglesByBridge[l.bridge] ?? 0, l.k[0], l.k[1], l.k[2], 0], i * 8))
  return out
}
```

- [ ] **Step 4: Implement the shader path, the store, the component and the controls**

In `facadeMaterial.js`, add to `facadeUniforms`:
```js
  uLeafTex: { value: (() => { const t = new THREE.DataTexture(new Float32Array(256 * 8), 512, 1, THREE.RGBAFormat, THREE.FloatType); t.needsUpdate = true; return t })() },
```
Add these vertex chunks:
```js
const VERT_LEAF_HEAD = /* glsl */ `
#ifdef USE_LEAF
attribute float _leaf;
uniform sampler2D uLeafTex;
vec3 leafRotate(vec3 v, vec3 k, float a) { return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1.0 - cos(a)); }
#endif
`
const VERT_LEAF_NORMAL = /* glsl */ `
#ifdef USE_LEAF
int li = int(_leaf + 0.5) - 1;
vec4 lp = vec4(0.0), lk = vec4(0.0);
if (li >= 0) { lp = texelFetch(uLeafTex, ivec2(li * 2, 0), 0); lk = texelFetch(uLeafTex, ivec2(li * 2 + 1, 0), 0); objectNormal = leafRotate(objectNormal, lk.xyz, lp.w); }
#endif
`
const VERT_LEAF_POS = /* glsl */ `
#ifdef USE_LEAF
if (li >= 0) transformed = lp.xyz + leafRotate(transformed - lp.xyz, lk.xyz, lp.w);
#endif
`
```
In `patchFacadeShader`, after the existing `#include <common>` vertex replace, add:
```js
  v = v.replace(need(v, '#include <beginnormal_vertex>'), `#include <beginnormal_vertex>\n${VERT_LEAF_NORMAL}`)
  v = v.replace(need(v, '#include <begin_vertex>'), `#include <begin_vertex>\n${VERT_LEAF_POS}`)
```
Extend the `#include <common>` vertex injection to `${VERT_HEAD}${VERT_LEAF_HEAD}`. Replace `createFacadeMaterial` with:
```js
export function createFacadeMaterial({ leaf = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.86, metalness: 0.02 })
  if (leaf) m.defines = { USE_LEAF: '' }
  m.onBeforeCompile = patchFacadeShader
  const key = 'facade-v8' // the key string Task 3 set (V2's key + 1); only the -leaf suffix is new here
  m.customProgramCacheKey = () => (leaf ? `${key}-leaf` : key)
  return m
}
```
If Task 3 left a different key string, use that string for `key`. The `beginnormal_vertex` chunk precedes `begin_vertex` in three's standard vertex shader, so `li`, `lp` and `lk` are in scope for the position rotation.

In `City.jsx`, add `export const leafMaterial = createFacadeMaterial({ leaf: true })`.
In `TileContent.jsx`, import `leafMaterial` and replace the Task 7 line with:
```js
      if (layer === 'buildings') { o.material = buildingMaterial; o.castShadow = lod === 'lod0' }
      else if (layer === 'leaves') { o.material = leafMaterial; o.castShadow = false } // a raised leaf would cast its closed shadow
```

In `store.js`, add:
```js
  bridgeLift: null,
  startBridgeLift: () => set({ bridgeLift: { startedAt: Date.now(), id: Math.random() } }),
  stopBridgeLift: () => set({ bridgeLift: null }),
```

`app/src/bridges/BridgeLeaves.jsx`:
```jsx
// app/src/bridges/BridgeLeaves.jsx — drives every bascule leaf through one float texture (no extra draw calls).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'
import { useStore } from '../state/store.js'
import { liftState } from './lift.js'
import { packLeaves, LEAF_TEX_MIN } from './leafTexture.js'

export const liveLift = { angles: {} }

export default function BridgeLeaves({ sidecar }) {
  const tex = useMemo(() => {
    const n = Math.max(LEAF_TEX_MIN, sidecar.leaves.length)
    const t = new THREE.DataTexture(packLeaves(sidecar.leaves, {}), n * 2, 1, THREE.RGBAFormat, THREE.FloatType)
    t.needsUpdate = true
    return t
  }, [sidecar])
  useEffect(() => { const prev = facadeUniforms.uLeafTex.value; facadeUniforms.uLeafTex.value = tex; return () => { facadeUniforms.uLeafTex.value = prev; tex.dispose() } }, [tex])
  const acc = useRef(0), last = useRef('{}')
  useFrame((_, dt) => {
    acc.current += dt
    if (acc.current < 0.05) return
    acc.current = 0
    const lift = useStore.getState().bridgeLift
    const s = liftState({ now: Date.now(), manualStart: lift?.startedAt ?? null, order: sidecar.liftOrder })
    if (s.done) useStore.getState().stopBridgeLift()
    const key = JSON.stringify(s.angles)
    if (key === last.current) return
    last.current = key
    liveLift.angles = s.angles
    packLeaves(sidecar.leaves, s.angles, tex.image.data)
    tex.needsUpdate = true
  })
  return null
}
```

`app/src/world/Landmarks.jsx`:
```jsx
// app/src/world/Landmarks.jsx — V6 runtime: bridge leaves and lights, fountain show, Cloud Gate mirror, plaza people.
import { useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { facadeUniforms } from './materials/facadeMaterial.js'
import BridgeLeaves from '../bridges/BridgeLeaves.jsx'

const getJson = (file) => (file ? fetch(`/world/${file}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null))

export default function Landmarks({ manifest }) {
  const [bridges, setBridges] = useState(null)
  const [runtime, setRuntime] = useState(null)
  useEffect(() => { getJson(manifest.bridges).then(setBridges); getJson(manifest.landmarkRuntime).then(setRuntime) }, [manifest])
  useFrame(({ clock }) => { facadeUniforms.uTime.value = clock.elapsedTime })
  return (
    <>
      {bridges && <BridgeLeaves sidecar={bridges} />}
      {/* Tasks 9, 12, 14, 15, 16 add: BridgeLights, FountainShow, CloudGate, PlazaPeople, and the Crown face driver (they use `runtime`) */}
      {runtime && null}
    </>
  )
}
```
In `Scene.jsx`, import `Landmarks` and render `{manifest && <Landmarks manifest={manifest} />}` after `<TileStreamer …/>`.

Controls:
- `CommandPalette.jsx`: change `function commands()` to `export function commands()` and add:
```js
    { id: 'x:bridges', kind: 'command', name: 'Raise the river bridges', sub: 'B · a boat-run bridge lift', run: () => s.startBridgeLift() },
```
- `HelpOverlay.jsx`: add a group to `GROUPS`:
```js
  ['Landmarks', [['B', 'raise the river bridges (a boat-run lift)']]],
```
- `HintBar.jsx`: add `['B', 'bridges']` before `['?', 'help']`.
- `AtlasRig.jsx`, in the key-down chain: add `else if (e.code === 'KeyB') s.startBridgeLift()` before the `'?'` branch. Also add `'KeyB'` to the keys that do not cancel a flight: `['BracketLeft', 'BracketRight', 'KeyH', 'KeyB']`.
- `ControlDock.jsx`: import `RiShip2Line` and add a row before the last one:
```jsx
      <div className="dock-row">
        <Btn label="Raise the river bridges (B)" onClick={() => useStore.getState().startBridgeLift()} wide><RiShip2Line /><span>Bridges</span></Btn>
      </div>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --prefix app`
Expected: PASS (all app tests, including the existing hud and palette tests).

- [ ] **Step 6: Visual — the lift, with evaluate-and-revert**

Start `npm run dev --prefix app`. With the Playwright MCP, open `http://localhost:5173/?view=dusable&time=day`, wait for `window.__worldReady`, press `B`, wait 20 s and screenshot to `.superpowers/…/shots/v6-lift-dusable-day.png`. Then press `Escape`, go to `?view=bridges&time=dusk`, press `B`, wait 30 s and screenshot `v6-lift-bridges-dusk.png`.

Keep the change if all of these hold:
- the leaves rise about their bank ends, both halves together;
- the underside trusses show;
- the tail drops into a dark pit and does not poke up through the approach road;
- no leaf detaches from its trunnion;
- all leaves are down again after about 4 minutes.

Otherwise, after one fix attempt, revert (own commit) and record `Reverted: bridge lift — <why>`.
Close the browser.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/chicagoTime.js app/src/lib/__tests__/chicagoTime.test.js app/src/bridges app/src/world/Landmarks.jsx app/src/world/Scene.jsx app/src/world/City.jsx app/src/world/TileContent.jsx app/src/world/materials/facadeMaterial.js app/src/state/store.js app/src/state/__tests__/v6store.test.js app/src/hud app/src/camera/AtlasRig.jsx
git commit -m "feat(v6): bridge lift easter egg — CDOT boat-run schedule, trunnion rotation in the shader, B key, dock button, ⌘K and help" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Bridge lights at night — lanterns, red and green navigation lights (E7)

**Files:**
- Create: `app/src/bridges/lights.js`, `app/src/bridges/BridgeLights.jsx`, `app/src/bridges/__tests__/lights.test.js`
- Modify: `app/src/world/Landmarks.jsx`

**Interfaces:**
- Consumes: the sidecar `lights` and `leaves`; `liveLift.angles`; `rotateAboutAxis`; `facadeUniforms.uNight`.
- Produces:
  - `lightColour(kind, angle) → [r,g,b]`: lantern is warm; nav is red when closed and green once the leaf is above 60° (the span is open to boats); pier is always red
  - `lightPosition(light, leaves, anglesByBridge) → [x,y,z]`
  - `<BridgeLights sidecar />`: one `THREE.Points` draw, additive, faded by `uNight`

- [ ] **Step 1: Write the failing test**

`app/src/bridges/__tests__/lights.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { lightColour, lightPosition } from '../lights.js'
describe('bridge lights', () => {
  it('nav lights read red while the leaf is down and green once it is open to boats', () => {
    expect(lightColour('nav', 0)[0]).toBeGreaterThan(0.9)
    expect(lightColour('nav', (70 * Math.PI) / 180)[1]).toBeGreaterThan(0.9)
    expect(lightColour('pier', 1.2)[0]).toBeGreaterThan(0.9)
    const w = lightColour('lantern', 0); expect(w[0]).toBeGreaterThan(w[2])
  })
  it('a nav light rides its leaf; fixed lights stay put', () => {
    const leaves = [{ bridge: 'x', pivot: [0, -1, 0], k: [-1, 0, 0] }]
    const up = lightPosition({ p: [0, 1, 30], kind: 'nav', leaf: 0 }, leaves, { x: Math.PI / 2 })
    expect(up[1]).toBeGreaterThan(25)
    expect(lightPosition({ p: [5, 1, 5], kind: 'pier' }, leaves, { x: 1 })).toEqual([5, 1, 5])
  })
})
```
Here the leaf direction is d = (0, 0, 1), so k = d × up = (−1, 0, 0). A 90° turn lifts the tip.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix app -- src/bridges/__tests__/lights.test.js`
Expected: FAIL — `Failed to load url ../lights.js`.

- [ ] **Step 3: Implement**

`app/src/bridges/lights.js`:
```js
// app/src/bridges/lights.js — colours and positions of the river bridges' lanterns and navigation lights.
import { rotateAboutAxis } from './lift.js'
const OPEN = (60 * Math.PI) / 180
export function lightColour(kind, angle = 0) {
  if (kind === 'lantern') return [1.0, 0.83, 0.6]
  if (kind === 'nav' && angle > OPEN) return [0.2, 1.0, 0.45]
  return [1.0, 0.12, 0.08]
}
export function lightPosition(light, leaves, angles) {
  if (light.leaf == null) return light.p
  const l = leaves[light.leaf], a = angles[l.bridge] ?? 0
  return a ? rotateAboutAxis(light.p, l.pivot, l.k, a) : light.p
}
```

`app/src/bridges/BridgeLights.jsx`:
```jsx
// app/src/bridges/BridgeLights.jsx — every bridge lamp and nav light as one additive Points draw.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'
import { liveLift } from './BridgeLeaves.jsx'
import { lightColour, lightPosition } from './lights.js'

export default function BridgeLights({ sidecar }) {
  const { geo, mat } = useMemo(() => {
    const n = sidecar.lights.length, geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uNight: facadeUniforms.uNight },
      vertexShader: 'attribute vec3 aColor; varying vec3 vC; void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(900.0 / -mv.z, 2.0, 14.0); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uNight; varying vec3 vC; void main(){ float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(vC * a * uNight * 2.0, a * uNight); }',
    })
    return { geo, mat }
  }, [sidecar])
  const last = useRef(null)
  useFrame(() => {
    if (last.current === liveLift.angles) return
    last.current = liveLift.angles
    const pos = geo.attributes.position.array, col = geo.attributes.aColor.array
    sidecar.lights.forEach((L, i) => {
      const a = L.leaf != null ? liveLift.angles[sidecar.leaves[L.leaf].bridge] ?? 0 : 0
      pos.set(lightPosition(L, sidecar.leaves, liveLift.angles), i * 3); col.set(lightColour(L.kind, a), i * 3)
    })
    geo.attributes.position.needsUpdate = true; geo.attributes.aColor.needsUpdate = true
    geo.computeBoundingSphere()
  })
  return <points geometry={geo} material={mat} frustumCulled={false} />
}
```
In `Landmarks.jsx`, import it and render `{bridges && <BridgeLights sidecar={bridges} />}` next to `BridgeLeaves`. The lights fade by `uNight`, so they cost one draw at every quality level and stay on at LOW.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --prefix app -- src/bridges`
Expected: PASS.

- [ ] **Step 5: Visual — the night river, with evaluate-and-revert**

```bash
cd app && GALLERY_DIR=../.superpowers/sdd/2026-09-29-v6-landmarks-bridges/shots GALLERY="bridges:lights-after@night,dusable:lights-after@night,river:lights-after@night" npx playwright test e2e/gallery.spec.js
```
Poses:
- `bridges`: (180, 60, −540) → (−420, 4, −612)
- `dusable`: (385, 32, −680) → (287, 5, −757)
- `river`: (950, 140, −760) → (−700, 40, −560)

Keep the change if:
- every bridge shows warm lanterns and small red lights at mid-span;
- the lights reflect in the river (via V1's shared reflection);
- there is no day-time glow (at `@day` they must be invisible — add `bridges:lights-after@day` to the command and check).

Otherwise revert (own commit) and record a ledger line.

- [ ] **Step 6: Commit**

```bash
git add app/src/bridges/lights.js app/src/bridges/BridgeLights.jsx app/src/bridges/__tests__/lights.test.js app/src/world/Landmarks.jsx
git commit -m "feat(v6): bridge lanterns and red/green navigation lights at night, riding the leaves when they lift" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Buckingham Fountain in detail (E1) and the landmark runtime file

Sourced dimensions (https://en.wikipedia.org/wiki/Buckingham_Fountain):
- pool 280 ft (85 m);
- basins 103, 60 and 24 ft (31, 18 and 7.3 m);
- the upper-basin lip 25 ft (7.6 m) above the lower basin's water;
- central jet 150 ft (46 m);
- 193 jets;
- four pairs of bronze seahorses (Marcel Loyau) for the four states on Lake Michigan;
- Georgia pink marble.

**Files:**
- Modify: `pipeline/lib/landmarks.js` (replace `fountain`, add `FOUNTAIN`, `seahorseUnit`, `SEAHORSE_MOUTH`, `seahorseSpots`, `fountainEmitters`), `pipeline/lib/heroes.js`, `pipeline/build/build-world.js`
- Create: `pipeline/lib/landmarkRuntime.js` (`collectRuntime`), `pipeline/tests/fountain.test.js`, `pipeline/tests/landmarkRuntime.test.js`

**Interfaces:**
- Consumes: meshkit (`revolve`, `place`, `tube`, `slab`, `merge`, `bearing`, `norm3`, `ringAround`).
- Produces:
  - `FOUNTAIN` — the constants in Step 3
  - `seahorseUnit() → Mesh` (local frame: faces +x, base y = 0, ≤ 6k triangles). This is the unit Phase 3 may refine.
  - `SEAHORSE_MOUTH = [2.3, 1.68, 0]`
  - `seahorseSpots(c) → [{ at:[x,z], yawDeg }]` × 8
  - `fountainEmitters(c) → Emitter[]`, where `Emitter = { kind: 'centre'|'seahorse'|'ring'|'lower'|'crown', p:[x,y,z], dir:[x,y,z] unit, h: number (jet height above the nozzle for dir = up), floor: number (landing height), tower?: 0|1 }`
  - The landmark builder return contract gains `runtime?: object` and `detached?: [{ key, mesh, centre }]`. `applyHero` returns `{ …, detached, runtime }`.
  - `collectRuntime([{ key, runtime, detached }]) → { version: 1, plazas: Plaza[], detached: [{ key, file, centre }], fountain?, crown?, cloudgate? }`, where `Plaza = { key, c:[x,z], r, avoid: [{ c, r }] }`
  - Files `app/public/world/landmarks.json` and `app/public/world/landmarks/<key>.glb`; manifest `landmarkRuntime: 'landmarks.json'`

- [ ] **Step 1: Write the failing tests**

`pipeline/tests/fountain.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { buildLandmark, FOUNTAIN, seahorseUnit, SEAHORSE_MOUTH, fountainEmitters, LANDMARK_FACADES as F } from '../lib/landmarks.js'

const pts = (m) => { const o = []; for (let i = 0; i < m.positions.length; i += 3) o.push(m.positions.slice(i, i + 3)); return o }
const all = (ms) => ms.flatMap((x) => pts(x.mesh))
const fountain = () => buildLandmark({ id: 'f', polygons: [], centroid: [0, 0] }, { type: 'fountain' })

describe('Buckingham Fountain (E1)', () => {
  it('the 85 m pool and three basins of 31, 18 and 7.3 m', () => {
    const { meshes } = fountain()
    const pool = all(meshes.filter((m) => m.part === 'pool'))
    expect(Math.max(...pool.map((q) => Math.hypot(q[0], q[2])))).toBeCloseTo(42.5, 0)
    const basins = meshes.filter((m) => m.part === 'basin')
    expect(basins).toHaveLength(3)
    const diam = basins.map((b) => 2 * Math.max(...pts(b.mesh).map((q) => Math.hypot(q[0], q[2])))).sort((a, b) => b - a)
    for (const [got, want] of [[diam[0], 31.4], [diam[1], 18.3], [diam[2], 7.3]]) expect(Math.abs(got - want) / want).toBeLessThan(0.03)
  })
  it('the upper lip stands 7.6 m above the lower basin water, in pink marble with scalloped edges', () => {
    const { meshes } = fountain()
    const upper = meshes.filter((m) => m.part === 'basin').map((b) => Math.max(...pts(b.mesh).map((q) => q[1]))).sort((a, b) => b - a)[0]
    expect(upper - FOUNTAIN.basins[0].water).toBeCloseTo(7.6, 1)
    for (const m of meshes.filter((x) => ['basin', 'pedestal', 'rim', 'crown'].includes(x.part))) { expect(m.facade).toBe(F.stone); expect(m.style).toBe('georgia-pink-marble') }
    const rim = pts(meshes.filter((m) => m.part === 'basin')[0].mesh).filter((q) => Math.abs(q[1] - FOUNTAIN.basins[0].rim) < 0.01).map((q) => Math.hypot(q[0], q[2]))
    expect(Math.min(...rim)).toBeLessThan(0.96 * (FOUNTAIN.basins[0].r - 0.4))   // shell lobes pull the rim in
  })
  it('four pairs of bronze seahorses in the pool', () => {
    const horses = fountain().meshes.filter((m) => m.part === 'seahorse')
    expect(horses).toHaveLength(8)
    for (const h of horses) { expect(h.facade).toBe(F.bronze); expect(h.style).toBe('seahorse-bronze') }
  })
  it('the seahorse unit is a single ≤ 6k-triangle figure, ~4–5 m tall, facing +x, mouth where the jets start', () => {
    const u = seahorseUnit(), p = pts(u)
    expect(p.length / 3).toBeLessThanOrEqual(6000)
    const top = Math.max(...p.map((q) => q[1])); expect(top).toBeGreaterThan(3.5); expect(top).toBeLessThan(5.2)
    expect(p.some((q) => Math.hypot(q[0] - SEAHORSE_MOUTH[0], q[1] - SEAHORSE_MOUTH[1], q[2]) < 0.4)).toBe(true)
  })
  it('emitters: a 46 m centre jet, eight seahorse jets arcing inward, ring and lower-basin jets', () => {
    const e = fountainEmitters([0, 0])
    const c = e.filter((x) => x.kind === 'centre'); expect(c).toHaveLength(1)
    expect(c[0].p[1] + c[0].h).toBeCloseTo(46)
    const s = e.filter((x) => x.kind === 'seahorse'); expect(s).toHaveLength(8)
    for (const j of s) expect(j.dir[0] * j.p[0] + j.dir[2] * j.p[2]).toBeLessThan(0)
    expect(e.filter((x) => x.kind === 'ring')).toHaveLength(16)
    expect(e.filter((x) => x.kind === 'lower')).toHaveLength(24)
  })
  it('publishes its emitters and a plaza ring around the pool', () => {
    const r = fountain().runtime
    expect(r.fountain.emitters.length).toBe(49)
    expect(r.plazas[0].avoid[0].r).toBeGreaterThan(FOUNTAIN.poolR)
  })
})
```

`pipeline/tests/landmarkRuntime.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { collectRuntime } from '../lib/landmarkRuntime.js'
import { applyHero } from '../lib/heroes.js'

describe('landmark runtime', () => {
  it('merges runtime blocks, concatenates plazas, lists detached meshes', () => {
    const r = collectRuntime([
      { key: 'buckingham', runtime: { fountain: { emitters: [1] }, plazas: [{ key: 'b' }] } },
      { key: 'cloudgate', runtime: { cloudgate: { centre: [1, 2] }, plazas: [{ key: 'c' }] }, detached: [{ key: 'cloudgate', centre: [1, 2] }] },
    ])
    expect(r.fountain.emitters).toEqual([1]); expect(r.plazas.map((p) => p.key)).toEqual(['b', 'c'])
    expect(r.detached).toEqual([{ key: 'cloudgate', file: 'landmarks/cloudgate.glb', centre: [1, 2] }])
  })
  it('two landmarks claiming the same runtime block is a build error', () => {
    expect(() => collectRuntime([{ key: 'a', runtime: { fountain: {} } }, { key: 'b', runtime: { fountain: {} } }])).toThrow(/fountain.*b/)
  })
  it('applyHero passes runtime and detached through', () => {
    const b = { id: 'm', area: 1, centroid: [0, 0], height: 0, parts: null, polygons: [{ outer: [[1, 0], [0, 1], [-1, 0], [0, -1]], holes: [] }] }
    const r = applyHero(b, { crowns: [], landmark: { type: 'fountain' } })
    expect(r.runtime.fountain.emitters.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --prefix pipeline -- tests/fountain.test.js tests/landmarkRuntime.test.js`
Expected: FAIL — `FOUNTAIN` is undefined and `Failed to load url ../lib/landmarkRuntime.js`.

- [ ] **Step 3: Implement the fountain (replaces the old `fountain` in `landmarks.js`)**

Add `revolve, place, slab, norm3` to the meshkit import. Then:
```js
// ── Buckingham Fountain (1927) ───────────────────────────────────────────────
// https://en.wikipedia.org/wiki/Buckingham_Fountain — pool 280 ft (85 m); basins 103/60/24 ft (31/18/7.3 m);
// upper lip 25 ft (7.6 m) above the lower basin's water; centre jet 150 ft (46 m); 193 jets; Georgia pink marble;
// four pairs of bronze seahorses (Marcel Loyau) for Illinois, Wisconsin, Michigan and Indiana.
export const FOUNTAIN = {
  poolR: 42.5, poolWater: 0.35, poolRim: 0.6,
  basins: [
    { r: 15.7, base: 0, rim: 1.9, water: 1.6, lobes: 16 },
    { r: 9.15, base: 3.4, rim: 5.1, water: 4.8, lobes: 12 },
    { r: 3.66, base: 7.6, rim: 9.2, water: 8.95, lobes: 8 },
  ],
  crownTop: 10.6,
  seahorses: { ring: 20.5, bearings: [45, 135, 225, 315], gap: 3.2 },
  jets: { centre: 46, seahorse: 6, ring: 3.5, lower: 2.5 },
}
const MARBLE = 'georgia-pink-marble'
export const SEAHORSE_MOUTH = [2.3, 1.68, 0]

// One bronze seahorse rearing from a rock: S-curved body, arched neck, muzzle, coiled fishtail, webbed forefins, crest.
export function seahorseUnit() {
  const m = mesh()
  const spine = Array.from({ length: 15 }, (_, i) => { const t = i / 14; return [-2.2 + 3.4 * t, 1.0 + 2.6 * Math.sin(t * Math.PI * 0.85), 0] })
  const radius = (t) => 0.55 * Math.sin(Math.PI * Math.min(1, 0.15 + t)) + 0.12
  for (let i = 0; i < 14; i++) tube(m, spine[i], spine[i + 1], radius(i / 14), 8)
  tube(m, spine[14], SEAHORSE_MOUTH, 0.32, 8)
  let prev = spine[0]
  for (let k = 1; k <= 10; k++) {
    const a = k * 0.6, r = 0.9 * (1 - k / 12), p = [-2.2 - 0.6 * Math.sin(a), 1.0 - 0.36 * (1 - Math.cos(a)), r * Math.sin(a * 0.5)]
    tube(m, prev, p, 0.22 * (1 - k / 12) + 0.05, 6); prev = p
  }
  for (const z of [-0.45, 0.45]) {
    const hip = [spine[9][0], spine[9][1] - 0.2, z], hoof = [hip[0] + 1.0, hip[1] - 1.1, z * 1.4]
    tube(m, hip, hoof, 0.16, 6); slab(m, [hoof[0] + 0.2, hoof[2]], [1, 0], 0.7, 0.08, hoof[1] - 0.05, hoof[1] + 0.45)
  }
  for (let i = 6; i < 13; i++) slab(m, [spine[i][0], 0], [1, 0], 0.35, 0.06, spine[i][1] + radius(i / 14) * 0.8, spine[i][1] + radius(i / 14) + 0.35)
  const rock = revolve([0, 0], [[1.6, 0], [1.4, 0.7], [0.9, 1.1], [0, 1.2]], { sides: 10, lobes: 5, depth: 0.18 })
  return merge(rock, m)
}

export function seahorseSpots(c) {
  const S = FOUNTAIN.seahorses
  return S.bearings.flatMap((b) => {
    const out = bearing(b), side = left(out), pc = add2(c, mul2(out, S.ring))
    return [-1, 1].map((k) => ({ at: add2(pc, mul2(side, (k * S.gap) / 2)), yawDeg: b }))
  })
}

export function fountainEmitters(c) {
  const Fq = FOUNTAIN, [lo, md, up] = Fq.basins
  const e = [{ kind: 'centre', p: [c[0], Fq.crownTop, c[1]], dir: [0, 1, 0], h: Fq.jets.centre - Fq.crownTop, floor: up.water }]
  for (const s of seahorseSpots(c)) {
    const f = bearing(s.yawDeg)
    e.push({ kind: 'seahorse', p: [s.at[0] + f[0] * SEAHORSE_MOUTH[0], Fq.poolWater - 0.2 + SEAHORSE_MOUTH[1], s.at[1] + f[1] * SEAHORSE_MOUTH[0]], dir: norm3([-f[0] * 0.5, 0.87, -f[1] * 0.5]), h: Fq.jets.seahorse, floor: Fq.poolWater })
  }
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, r = up.r - 0.3; e.push({ kind: 'ring', p: [c[0] + Math.cos(a) * r, up.rim, c[1] + Math.sin(a) * r], dir: norm3([Math.cos(a) * 0.25, 1, Math.sin(a) * 0.25]), h: Fq.jets.ring, floor: md.water }) }
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, r = lo.r - 0.6; e.push({ kind: 'lower', p: [c[0] + Math.cos(a) * r, lo.rim, c[1] + Math.sin(a) * r], dir: norm3([Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35]), h: Fq.jets.lower, floor: Fq.poolWater }) }
  return e
}

function fountain(b) {
  const c = b.centroid, Fq = FOUNTAIN, meshes = []
  const push = (m, facade, style, part) => meshes.push({ mesh: m, facade, seed: 0.5, style, part })
  push(revolve(c, [[Fq.poolR + 0.6, 0], [Fq.poolR + 0.6, Fq.poolRim], [Fq.poolR, Fq.poolRim], [Fq.poolR, Fq.poolWater]], { sides: 96 }), F.stone, MARBLE, 'rim')
  push(revolve(c, [[Fq.poolR, Fq.poolWater], [0, Fq.poolWater]], { sides: 96 }), F.water, null, 'pool')
  for (const bs of Fq.basins) {
    const prof = [[bs.r * 0.3, bs.base], [bs.r * 0.92, bs.rim - 0.9], [bs.r, bs.rim], [bs.r - 0.4, bs.rim], [bs.r - 0.4, bs.water]]
    push(revolve(c, prof, { sides: 64, lobes: bs.lobes, depth: 0.05 }), F.stone, MARBLE, 'basin')
    push(revolve(c, [[bs.r - 0.4, bs.water], [0, bs.water]], { sides: 64, lobes: bs.lobes, depth: 0.05 }), F.water, null, 'basin-water')
  }
  push(revolve(c, [[2.4, Fq.basins[0].water], [1.6, 2.3], [1.4, Fq.basins[1].base]], { sides: 24 }), F.stone, MARBLE, 'pedestal')
  push(revolve(c, [[1.3, Fq.basins[1].water], [0.8, 5.6], [0.7, Fq.basins[2].base]], { sides: 24 }), F.stone, MARBLE, 'pedestal')
  push(revolve(c, [[0.9, Fq.basins[2].water], [0.5, 9.6], [0.7, 10.1], [0.25, Fq.crownTop], [0, Fq.crownTop]], { sides: 16 }), F.stone, MARBLE, 'crown')
  const unit = seahorseUnit()
  for (const s of seahorseSpots(c)) push(place(unit, { at: s.at, y: Fq.poolWater - 0.2, yawDeg: s.yawDeg }), F.bronze, 'seahorse-bronze', 'seahorse')
  return {
    replace: true, pieces: [], meshes, clear: [ringAround(c, 58)],
    runtime: { fountain: { centre: [c[0], c[1]], emitters: fountainEmitters(c) }, plazas: [{ key: 'buckingham', c: [c[0], c[1]], r: 62, avoid: [{ c: [c[0], c[1]], r: Fq.poolR + 1.2 }] }] },
  }
}
```

`pipeline/lib/landmarkRuntime.js`:
```js
// pipeline/lib/landmarkRuntime.js — what the app needs at runtime from the landmark builders (landmarks.json).
export function collectRuntime(entries) {
  const out = { version: 1, plazas: [], detached: [] }
  for (const { key, runtime, detached } of entries) {
    for (const [k, v] of Object.entries(runtime ?? {})) {
      if (k === 'plazas') out.plazas.push(...v)
      else if (out[k] !== undefined) throw new Error(`landmark runtime "${k}" defined twice (second by ${key})`)
      else out[k] = v
    }
    for (const d of detached ?? []) out.detached.push({ key: d.key, file: `landmarks/${d.key}.glb`, centre: d.centre })
  }
  return out
}
```

In `heroes.js`, inside the `if (spec.landmark)` block, add `detached = r.detached; runtime = r.runtime` (declare `let venueMeshes, clear, detached, runtime`). The return becomes `return { pieces, extraMeshes, venueMeshes, clear, detached, runtime }`.

In `build-world.js`:
- Import `collectRuntime` and `writeMeshGlb` (already imported).
- In the hero-apply loop, also keep `b.detached = r.detached; b.runtime = r.runtime`.
- After `log(\`heroes applied: …\`)` add:
```js
  const landmarkRuntime = collectRuntime(buildings.filter((b) => b.hero && (b.runtime || b.detached)).map((b) => ({ key: b.hero, runtime: b.runtime, detached: b.detached })))
  rmSync(join(OUT, 'landmarks'), { recursive: true, force: true })
  for (const b of buildings) for (const d of b.detached ?? []) await writeMeshGlb(join(OUT, 'landmarks', `${d.key}.glb`), d.mesh)
  writeFileSync(join(OUT, 'landmarks.json'), JSON.stringify(landmarkRuntime))
  log(`landmark runtime: ${Object.keys(landmarkRuntime).join(', ')}; plazas ${landmarkRuntime.plazas.length}`)
```
- Add `landmarkRuntime: 'landmarks.json'` to the manifest.
- `writeMeshGlb` creates its folder; if it does not, `mkdirSync(join(OUT, 'landmarks'), { recursive: true })` first.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --prefix pipeline -- tests/fountain.test.js tests/landmarkRuntime.test.js tests/landmarks.test.js tests/heroes.test.js`
Expected: PASS. The existing "wide pool … three stacked basins" and "clearings" tests still hold: the pool spans 85 m and the clear ring is 58 m.

- [ ] **Step 5: Build, then do the visual check with evaluate-and-revert**

Run `npm run build:world --prefix pipeline`. Expected log line: `landmark runtime: fountain; plazas 1`.
Then:
```bash
cd app && GALLERY_DIR=../.superpowers/sdd/2026-09-29-v6-landmarks-bridges/shots GALLERY="buckingham:buckingham-stone@day,buckingham:buckingham-stone@dusk,buckingham:buckingham-stone@night" npx playwright test e2e/gallery.spec.js
```
Pose `buckingham`: (800, 55, 600) → (711, 8, 693).

Compare with `buckingham-before-*` and with the reference photo at https://en.wikipedia.org/wiki/Buckingham_Fountain, and log the side-by-side in the ledger (E1 acceptance). Keep the change if:
- the three tiers read as pink marble with shell-scalloped rims;
- the tier proportions match the photo, with the upper basin clearly smaller and higher;
- eight seahorses read as figures in pairs at the diagonals.

Record this in the ledger:
```
Ruling: seahorses procedural (unit mesh ×8); Phase 3 may refine in Blender. Cost if wrong: less sculptural seahorses until P3.
```
If the change fails after one fix attempt, revert (own commit) and record a ledger line.

- [ ] **Step 6: Commit**

```bash
git add pipeline/lib/landmarks.js pipeline/lib/landmarkRuntime.js pipeline/lib/heroes.js pipeline/build/build-world.js pipeline/tests/fountain.test.js pipeline/tests/landmarkRuntime.test.js
git commit -m "feat(v6): Buckingham Fountain in detail — 85 m pool, scalloped pink-marble tiers at true size, eight bronze seahorses, jet emitters in landmarks.json" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: The fountain schedule (E2), a pure function of Chicago time

Source (https://en.wikipedia.org/wiki/Buckingham_Fountain, Chicago Park District):
- runs 8 am–11 pm, early May to mid-October;
- 20-minute water shows every hour on the hour, the last at 10 pm;
- after dusk, shows run with lights and music.

**Files:**
- Create: `app/src/landmarks/fountainSchedule.js`, `app/src/landmarks/__tests__/fountainSchedule.test.js`

**Interfaces:**
- Consumes: `chicagoClock` (Task 8).
- Produces:
  - `FOUNTAIN_SCHEDULE = { season: { from: [5, 1], to: [10, 15] }, open: 8, close: 23, showMinutes: 20, lastShowHour: 22, source }`
  - `fountainShow(date, { dark = false, previewStart = null } = {}) → { state: 'off'|'display'|'show', reason, levels: { centre, seahorse, ring, lower } (0..1 of each jet height), colour: [r,g,b]|null, minute? }`
  - `showLevels(minute) → levels` (the finale, minutes 17–20, puts the centre at 1.0, which is 46 m)
  - `showColour(minute) → [r,g,b]`

- [ ] **Step 1: Write the failing test**

`app/src/landmarks/__tests__/fountainSchedule.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { fountainShow, showLevels } from '../fountainSchedule.js'
const at = (iso, o) => fountainShow(new Date(iso), o)

describe('Buckingham schedule (Chicago time, any host zone)', () => {
  it('hourly 20-minute shows, steady display in between', () => {
    expect(at('2026-09-28T17:05:00Z').state).toBe('show')      // 12:05 CDT
    expect(at('2026-09-28T17:25:00Z').state).toBe('display')   // 12:25 CDT
  })
  it('opens at 8:00 with a show, last show at 22:00, off from 23:00', () => {
    expect(at('2026-05-01T12:59:00Z').state).toBe('off')       // 07:59
    expect(at('2026-05-01T13:00:00Z').state).toBe('show')      // 08:00
    expect(at('2026-10-15T03:15:00Z').state).toBe('show')      // Oct 14 22:15
    expect(at('2026-10-15T03:25:00Z').state).toBe('display')   // 22:25
    expect(at('2026-06-01T04:00:00Z').state).toBe('off')       // 23:00
  })
  it('season: early May to mid-October', () => {
    expect(at('2026-04-30T17:05:00Z').reason).toBe('season')
    expect(at('2026-10-15T17:05:00Z').state).toBe('show')      // Oct 15, last day
    expect(at('2026-10-16T17:05:00Z').reason).toBe('season')
  })
  it('after dark the show is coloured; by day it is plain water', () => {
    expect(at('2026-09-28T17:05:00Z', { dark: true }).colour).toHaveLength(3)
    expect(at('2026-09-28T17:05:00Z').colour).toBeNull()
  })
  it('the finale throws the full 46 m centre jet', () => {
    expect(showLevels(18).centre).toBe(1)
    expect(showLevels(5).centre).toBeLessThan(1)
  })
  it('J plays a 20-minute preview at any time or season', () => {
    const start = Date.parse('2026-01-10T08:00:00Z')
    expect(fountainShow(new Date(start + 60_000), { previewStart: start }).state).toBe('show')
    expect(fountainShow(new Date(start + 21 * 60_000), { previewStart: start }).state).toBe('off')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix app -- src/landmarks/__tests__/fountainSchedule.test.js`
Expected: FAIL — `Failed to load url ../fountainSchedule.js`.

- [ ] **Step 3: Implement**

`app/src/landmarks/fountainSchedule.js`:
```js
// app/src/landmarks/fountainSchedule.js — Buckingham Fountain's real schedule as a pure function of the date.
import { chicagoClock } from '../lib/chicagoTime.js'

export const FOUNTAIN_SCHEDULE = {
  season: { from: [5, 1], to: [10, 15] }, open: 8, close: 23, showMinutes: 20, lastShowHour: 22,
  source: 'https://en.wikipedia.org/wiki/Buckingham_Fountain (Chicago Park District: 8 am–11 pm, early May–mid-October, 20-min shows hourly, last at 10 pm, lights after dusk)',
}
const S = FOUNTAIN_SCHEDULE
const OFF = (reason) => ({ state: 'off', reason, levels: { centre: 0, seahorse: 0, ring: 0, lower: 0 }, colour: null })
const DISPLAY = { centre: 0.3, seahorse: 1, ring: 0.6, lower: 0.6 }
export const SHOW_COLOURS = [[1, 0.35, 0.6], [0.3, 0.6, 1], [0.4, 1, 0.6], [1, 0.8, 0.3], [0.8, 0.4, 1]]

export function showLevels(m) {
  const wave = 0.5 + 0.5 * Math.sin((m * Math.PI * 2) / 1.5)
  if (m < 2) return { centre: 0.3 + 0.35 * (m / 2), seahorse: 1, ring: 0.8, lower: 0.8 }
  if (m < 17) return { centre: 0.45 + 0.3 * wave, seahorse: 1, ring: 0.6 + 0.4 * wave, lower: 0.9 }
  return { centre: 1, seahorse: 1, ring: 1, lower: 1 }
}
export function showColour(m) {
  const x = m / 1.5, i = Math.floor(x) % SHOW_COLOURS.length, j = (i + 1) % SHOW_COLOURS.length, f = x - Math.floor(x)
  return SHOW_COLOURS[i].map((v, k) => v + (SHOW_COLOURS[j][k] - v) * f)
}
const show = (m, dark, reason) => ({ state: 'show', reason, minute: m, levels: showLevels(m), colour: dark ? showColour(m) : null })

export function fountainShow(date, { dark = false, previewStart = null } = {}) {
  if (previewStart != null) {
    const m = (date.getTime() - previewStart) / 60000
    if (m >= 0 && m < S.showMinutes) return show(m, dark, 'preview')
  }
  const c = chicagoClock(date), md = c.month * 100 + c.day
  if (md < S.season.from[0] * 100 + S.season.from[1] || md > S.season.to[0] * 100 + S.season.to[1]) return OFF('season')
  if (c.hour < S.open || c.hour >= S.close) return OFF('hours')
  if (c.hour <= S.lastShowHour && c.minute < S.showMinutes) return show(c.minute + c.second / 60, dark, 'show')
  return { state: 'display', reason: 'display', levels: DISPLAY, colour: null }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --prefix app -- src/landmarks/__tests__/fountainSchedule.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/landmarks/fountainSchedule.js app/src/landmarks/__tests__/fountainSchedule.test.js
git commit -m "feat(v6): Buckingham Fountain schedule — season, hours, hourly 20-minute shows, evening colours, 46 m finale; pure and Chicago-time" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: The water show — GPU particles, J key, LOW fallback (E2)

**Files:**
- Create: `app/src/landmarks/jets.js`, `app/src/landmarks/FountainShow.jsx`, `app/src/landmarks/__tests__/jets.test.js`
- Modify:
  - `app/src/world/Landmarks.jsx`
  - `app/src/state/store.js` (`fountainPreview`, `startFountainPreview`)
  - `app/src/hud/CommandPalette.jsx`, `HelpOverlay.jsx`, `HintBar.jsx`, `ControlDock.jsx`
  - `app/src/camera/AtlasRig.jsx`
  - `app/src/hud/__tests__/v6controls.test.jsx`

**Interfaces:**
- Consumes: `landmarks.json` `fountain.emitters` (Task 10) and `crown.spouts` (Task 16, optional); `fountainShow` (Task 11); `facadeUniforms.uNight`; the store `quality`.
- Produces:
  - `G = 9.81`, `KIND = { centre: 0, seahorse: 1, ring: 2, lower: 3, crown: 4 }`
  - `launchSpeed(h)`, `landingTime(e, level)`, `jetPoint(e, level, seed, t) → [x,y,z] | null` (the GLSL mirrors this exactly)
  - `PARTICLES = { centre: 7000, seahorse: 450, ring: 120, lower: 90, crown: 400 }`
  - `buildParticles(emitters) → { emitter: Float32Array, seed: Float32Array }`
  - `<FountainShow emitters crownLevels? />`: one `Points` draw at HIGH/ULTRA; at LOW, one translucent cone for the centre jet
  - Store: `fountainPreview: number|null`, `startFountainPreview()`

- [ ] **Step 1: Write the failing tests**

`app/src/landmarks/__tests__/jets.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { jetPoint, landingTime, launchSpeed, buildParticles, PARTICLES, G } from '../jets.js'

const centre = { kind: 'centre', p: [0, 10.6, 0], dir: [0, 1, 0], h: 35.4, floor: 8.95 }
describe('fountain jets', () => {
  it('launch speed reaches the jet height: the centre jet tops out at 46 m', () => {
    expect(launchSpeed(35.4) ** 2 / (2 * G)).toBeCloseTo(35.4)
    let top = 0
    for (let s = 0; s < 1; s += 0.001) top = Math.max(top, jetPoint(centre, 1, s, 0)[1])
    expect(top).toBeCloseTo(46, 0)
  })
  it('water lands on the basin below, and half-power jets are lower', () => {
    const T = landingTime(centre, 1)
    expect(jetPoint(centre, 1, 0.9999999, 0)[1]).toBeCloseTo(centre.floor, 0)
    expect(T).toBeGreaterThan(5)
    let half = 0
    for (let s = 0; s < 1; s += 0.001) half = Math.max(half, jetPoint(centre, 0.5, s, 0)[1])
    expect(half).toBeLessThan(30)
  })
  it('an idle jet emits nothing', () => {
    expect(jetPoint(centre, 0, 0.3, 1)).toBeNull()
  })
  it('particle buffers: counts per kind, seeds in [0, 1)', () => {
    const b = buildParticles([centre, { ...centre, kind: 'seahorse' }])
    expect(b.emitter.length).toBe(PARTICLES.centre + PARTICLES.seahorse)
    expect(Math.max(...b.seed)).toBeLessThan(1)
  })
})
```
Add this case inside the `describe` block of `app/src/hud/__tests__/v6controls.test.jsx`:
```jsx
  it('⌘K, help card and hint bar offer the fountain show', () => {
    expect(commands().some((c) => c.name === 'Buckingham Fountain water show')).toBe(true)
    useStore.getState().setHelpOpen(true)
    render(<><HelpOverlay /><HintBar /></>)
    expect(screen.getByText(/play the Buckingham Fountain water show/i)).toBeInTheDocument()
    expect(screen.getByText('fountain')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --prefix app -- src/landmarks/__tests__/jets.test.js src/hud/__tests__/v6controls.test.jsx`
Expected: FAIL — `Failed to load url ../jets.js`, and there is no `Buckingham Fountain water show` command yet.

- [ ] **Step 3: Implement `jets.js` and `FountainShow.jsx`**

`app/src/landmarks/jets.js`:
```js
// app/src/landmarks/jets.js — ballistic fountain jets (JS mirror of FountainShow's vertex shader).
export const G = 9.81
export const KIND = { centre: 0, seahorse: 1, ring: 2, lower: 3, crown: 4 }
export const PARTICLES = { centre: 7000, seahorse: 450, ring: 120, lower: 90, crown: 400 }
const fract = (x) => x - Math.floor(x)
export const launchSpeed = (h) => Math.sqrt(2 * G * Math.max(0, h))
export function landingTime(e, level) {
  const vy = launchSpeed(e.h * level) * e.dir[1]
  return (vy + Math.sqrt(vy * vy + 2 * G * Math.max(0, e.p[1] - e.floor))) / G
}
export function jetPoint(e, level, seed, t) {
  const h = e.h * level
  if (h < 0.05) return null
  const spread = e.kind === 'centre' ? 0.03 : 0.08
  const d = [e.dir[0] + (fract(seed * 7.13) - 0.5) * spread, e.dir[1], e.dir[2] + (fract(seed * 3.91) - 0.5) * spread]
  const l = Math.hypot(...d), v = launchSpeed(h), T = landingTime(e, level)
  const tau = fract(seed + t / T) * T
  return [e.p[0] + (d[0] / l) * v * tau, e.p[1] + (d[1] / l) * v * tau - 0.5 * G * tau * tau, e.p[2] + (d[2] / l) * v * tau]
}
export function buildParticles(emitters) {
  const n = emitters.reduce((s, e) => s + PARTICLES[e.kind], 0), emitter = new Float32Array(n), seed = new Float32Array(n)
  let k = 0
  emitters.forEach((e, i) => { for (let j = 0; j < PARTICLES[e.kind]; j++, k++) { emitter[k] = i; seed[k] = fract(Math.sin((k + 1) * 12.9898) * 43758.5453) } })
  return { emitter, seed }
}
```
The centre-jet test normalises the direction: `dir` is (0, 1, 0) with a ±1.5 % sideways jitter, so the apex stays within 0.5 m of 46.

`app/src/landmarks/FountainShow.jsx`:
```jsx
// app/src/landmarks/FountainShow.jsx — Buckingham's jets (and the Crown Fountain spouts) as one GPU Points draw.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'
import { fountainShow } from './fountainSchedule.js'
import { buildParticles, KIND } from './jets.js'

const VERT = /* glsl */ `
uniform float uTime; uniform vec4 uP[64]; uniform vec4 uD[64]; uniform float uFloor[64]; uniform vec4 uLevels; uniform vec2 uCrown; uniform float uPx;
attribute float aEmitter; attribute float aSeed; varying float vA;
const float G = 9.81;
void main() {
  int i = int(aEmitter + 0.5); vec4 P = uP[i], D = uD[i]; int kind = int(D.w + 0.5);
  float level = kind == 0 ? uLevels.x : kind == 1 ? uLevels.y : kind == 2 ? uLevels.z : kind == 3 ? uLevels.w : (kind == 4 ? uCrown.x : uCrown.y);
  float h = P.w * level;
  if (h < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float spread = kind == 0 ? 0.03 : 0.08;
  vec3 d = normalize(vec3(D.x + (fract(aSeed * 7.13) - 0.5) * spread, D.y, D.z + (fract(aSeed * 3.91) - 0.5) * spread));
  float v = sqrt(2.0 * G * h), vy = v * D.y;
  float T = (vy + sqrt(vy * vy + 2.0 * G * max(0.0, P.y - uFloor[i]))) / G;
  float ph = fract(aSeed + uTime / T), tau = ph * T;
  vec3 pos = P.xyz + d * v * tau - vec3(0.0, 0.5 * G * tau * tau, 0.0);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = clamp(0.35 * uPx / -mv.z, 1.0, 10.0);
  vA = (1.0 - smoothstep(0.85, 1.0, ph)) * 0.5;
  gl_Position = projectionMatrix * mv;
}`
const FRAG = /* glsl */ `
uniform vec3 uColour; uniform float uColourMix; uniform float uNight; varying float vA;
void main() {
  float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5)) * vA;
  vec3 water = vec3(0.85, 0.92, 1.0) * (0.55 + 0.45 * (1.0 - uNight));
  gl_FragColor = vec4(mix(water, uColour * (1.0 + uNight), uColourMix), a);
}`
const kindCode = (e) => (e.kind === 'crown' ? KIND.crown + (e.tower ?? 0) : KIND[e.kind])

export default function FountainShow({ emitters, crownLevels = null }) {
  const quality = useStore((s) => s.quality)
  const { geo, mat } = useMemo(() => {
    const b = buildParticles(emitters), geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.emitter.length * 3), 3))
    geo.setAttribute('aEmitter', new THREE.BufferAttribute(b.emitter, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(b.seed, 1))
    const pad = (arr, f) => Array.from({ length: 64 }, (_, i) => (emitters[i] ? f(emitters[i]) : arr))
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 }, uPx: { value: 800 }, uNight: facadeUniforms.uNight,
        uP: { value: pad(new THREE.Vector4(), (e) => new THREE.Vector4(e.p[0], e.p[1], e.p[2], e.h)) },
        uD: { value: pad(new THREE.Vector4(), (e) => new THREE.Vector4(e.dir[0], e.dir[1], e.dir[2], kindCode(e))) },
        uFloor: { value: pad(0, (e) => e.floor) },
        uLevels: { value: new THREE.Vector4() }, uCrown: { value: new THREE.Vector2() },
        uColour: { value: new THREE.Color(1, 1, 1) }, uColourMix: { value: 0 },
      },
    })
    return { geo, mat }
  }, [emitters])
  const cone = useRef(), centre = emitters.find((e) => e.kind === 'centre'), acc = useRef(1)
  const coneGeo = useMemo(() => new THREE.CylinderGeometry(0.15, 0.9, 1, 12, 1, true).translate(0, 0.5, 0), [])
  useFrame(({ clock, size, camera }, dt) => {
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uPx.value = size.height / (2 * Math.tan(((camera.fov ?? 50) * Math.PI) / 360))
    acc.current += dt
    if (acc.current < 0.5) return
    acc.current = 0
    const s = fountainShow(new Date(), { dark: facadeUniforms.uNight.value > 0.35, previewStart: useStore.getState().fountainPreview })
    const L = s.levels
    mat.uniforms.uLevels.value.set(L.centre, L.seahorse, L.ring, L.lower)
    if (crownLevels) mat.uniforms.uCrown.value.set(crownLevels.current[0], crownLevels.current[1])
    mat.uniforms.uColourMix.value = s.colour ? 0.75 : 0
    if (s.colour) mat.uniforms.uColour.value.setRGB(...s.colour)
    if (cone.current && centre) { cone.current.visible = L.centre > 0; cone.current.scale.set(1, Math.max(0.01, centre.h * L.centre), 1) }
  })
  if (quality === 'LOW') return centre ? (
    <mesh ref={cone} geometry={coneGeo} position={[centre.p[0], centre.p[1], centre.p[2]]}>
      <meshStandardMaterial color="#dfeaf2" transparent opacity={0.45} depthWrite={false} />
    </mesh>
  ) : null
  return <points geometry={geo} material={mat} frustumCulled={false} />
}
```

- [ ] **Step 4: Wire the component and the controls**

`Landmarks.jsx`: import `FountainShow`, and replace `{runtime && null}` with:
```jsx
      {runtime?.fountain && <FountainShow emitters={[...runtime.fountain.emitters, ...(runtime.crown?.spouts ?? [])]} crownLevels={crownLevels} />}
```
Also add `const crownLevels = useRef([0, 0])` (import `useRef`). Task 16 fills it.

In `store.js`:
```js
  fountainPreview: null,
  startFountainPreview: () => set({ fountainPreview: Date.now() }),
```
The controls:
- `CommandPalette.commands()`: add `{ id: 'x:fountain', kind: 'command', name: 'Buckingham Fountain water show', sub: 'J · play the 20-minute show now', run: () => s.startFountainPreview() }`.
- `HelpOverlay` Landmarks group: add `['J', 'play the Buckingham Fountain water show']`.
- `HintBar`: add `['J', 'fountain']`.
- `AtlasRig`: add `else if (e.code === 'KeyJ') s.startFountainPreview()`, and add `'KeyJ'` to the keys that don't cancel a flight.
- `ControlDock`: in the row added in Task 8, add `<Btn label="Fountain water show (J)" onClick={() => useStore.getState().startFountainPreview()} wide><RiDropLine /><span>Fountain</span></Btn>` (import `RiDropLine`).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --prefix app`
Expected: PASS.

- [ ] **Step 6: Visual — the show, with evaluate-and-revert**

The capture clock is 12:05 CDT on Monday 2026-09-28, which is in season and during the show.
```bash
cd app && GALLERY_DIR=../.superpowers/sdd/2026-09-29-v6-landmarks-bridges/shots GALLERY="buckingham:buckingham-show@day,buckingham:buckingham-show@dusk,buckingham:buckingham-show@night,museum:buckingham-show@day" npx playwright test e2e/gallery.spec.js
GALLERY_CLOCK=2026-12-01T12:05:00-06:00 GALLERY_DIR=../.superpowers/sdd/2026-09-29-v6-landmarks-bridges/shots GALLERY="buckingham:buckingham-winter@day" npx playwright test e2e/gallery.spec.js
```
Poses: `buckingham` (800, 55, 600) → (711, 8, 693); `museum` (900, 180, 2600) → (0, 80, 0).

Keep the change if:
- by day there is a tall white plume, with seahorse arcs falling into the pool;
- at night the plume is coloured;
- in winter (the December clock) there is no water at all;
- the plume reads without dominating the `museum` postcard.

Log E2 acceptance: show on, night colours, off out of season. If the change fails after one fix attempt, revert (own commit) and record a ledger line.

- [ ] **Step 7: Commit**

```bash
git add app/src/landmarks/jets.js app/src/landmarks/FountainShow.jsx app/src/landmarks/__tests__/jets.test.js app/src/world/Landmarks.jsx app/src/state/store.js app/src/hud app/src/camera/AtlasRig.jsx
git commit -m "feat(v6): Buckingham water show — GPU jets to 46 m, seahorse arcs, evening colours on the real schedule; J key, dock, ⌘K; LOW cone" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 13: Cloud Gate — the true omphalos shape, as a detached mesh (E3)

Source (https://en.wikipedia.org/wiki/Cloud_Gate):
- 33 × 66 × 42 ft (10 × 20 × 13 m);
- the omphalos arch is 12 ft (3.7 m) high, and its concave apex is 27 ft (8.2 m) above the ground;
- 168 polished type-304 stainless plates.

The Bean leaves the tile and becomes its own tiny `.glb`, so Task 14 can give it a live mirror. That adds one draw call.

**Files:**
- Modify: `pipeline/lib/landmarks.js` (replace `bean`, add `BEAN` and `beanMesh`), `pipeline/build/build-world.js` (count detached meshes in `venueTop`), `pipeline/tests/landmarks.test.js` (replace the Cloud Gate test)

**Interfaces:**
- Consumes: `gridSurface`, `left`, `add2`, `mul2`, `ringAround`; `collectRuntime` (Task 10).
- Produces:
  - `BEAN = { L: 20, W: 13, H: 10, arch: 3.7, omphalos: 8.2 }`
  - `beanMesh(c:[x,z], u:[x,z]) → Mesh` (world metres, outward normals, ~6 k triangles)
  - `bean(b)` returns:
    - `replace: true`, `pieces: []`, `meshes: []`;
    - `detached: [{ key: 'cloudgate', mesh, centre }]`;
    - `clear: [ringAround(c, 42)]`;
    - `runtime: { cloudgate: { centre, radius: 11 }, plazas: [{ key: 'cloudgate', c, r: 38, avoid: [{ c, r: 11 }] }] }`.

- [ ] **Step 1: Write the failing test (replace the old Cloud Gate test in `pipeline/tests/landmarks.test.js`)**

```js
  it('Cloud Gate: 20 × 13 × 10 m, a 3.7 m arch you can walk under, the omphalos apex at 8.2 m', () => {
    const r = buildLandmark(B(rect(-10, -6.4, 10, 6.4)), { type: 'bean' })
    expect(r.meshes).toHaveLength(0)
    const [d] = r.detached
    expect(d.key).toBe('cloudgate')
    const p = []; for (let i = 0; i < d.mesh.positions.length; i += 3) p.push([...d.mesh.positions.slice(i, i + 3), ...d.mesh.normals.slice(i, i + 3)])
    const [x0, x1] = ext(p, 0), [z0, z1] = ext(p, 2)
    expect(Math.max(x1 - x0, z1 - z0)).toBeCloseTo(20, 0)
    expect(Math.min(x1 - x0, z1 - z0)).toBeCloseTo(13, 0)
    expect(ext(p, 1)[1]).toBeCloseTo(10, 1)
    expect(ext(p, 1)[0]).toBeLessThan(0.3)                                                  // rests on its ends
    const apex = p.filter((q) => Math.hypot(q[0], q[2]) < 0.8 && q[1] < 9.5)
    expect(Math.min(...apex.map((q) => q[1]))).toBeCloseTo(8.2, 0)
    expect(apex.every((q) => q[4] < -0.5)).toBe(true)                                        // the cavity faces down
    const under = p.filter((q) => Math.hypot(q[0], q[2]) < 3 && q[1] < 9)
    expect(under.every((q) => q[1] > 3.5)).toBe(true)                                        // headroom under the arch
    const topV = p.filter((q) => Math.hypot(q[0], q[2]) < 0.8 && q[1] > 9.5)
    expect(topV.every((q) => q[4] > 0.9)).toBe(true)
    expect(r.runtime.plazas[0].avoid[0].r).toBe(11)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix pipeline -- tests/landmarks.test.js`
Expected: FAIL — `expected 1 to have a length of +0`: the old bean returns one chrome mesh.

- [ ] **Step 3: Implement (replace `bean` in `landmarks.js`; add `gridSurface` to the meshkit import)**

```js
// ── Cloud Gate (Anish Kapoor, 2006) ──────────────────────────────────────────
// https://en.wikipedia.org/wiki/Cloud_Gate — 10 × 20 × 13 m; the omphalos arch is 12 ft (3.7 m) high and its
// concave apex 27 ft (8.2 m) above the ground; polished type-304 stainless steel.
export const BEAN = { L: 20, W: 13, H: 10, arch: 3.7, omphalos: 8.2 }
export function beanMesh(c, u) {
  const v = left(u), HL = BEAN.L / 2, HW = BEAN.W / 2, S = 64, T = 48
  const top = (s) => BEAN.H * Math.pow(Math.max(0, 1 - s * s), 0.32)
  const mid = (s) => 0.45 * top(s)
  const width = (s) => HW * Math.pow(Math.max(0, 1 - s * s), 0.5)
  const under = (s, q) => {
    const arch = BEAN.arch * Math.max(0, 1 - (s / 0.78) ** 2) * (1 - 0.35 * q * q)
    const d = Math.hypot(s * HL, q * width(s))
    return Math.max(0, Math.min(top(s) - 1.2, arch + (BEAN.omphalos - BEAN.arch) * Math.exp(-((d / 2.6) ** 2))))
  }
  const pt = (i, j) => {
    const s = -1 + (2 * i) / S, t = (j / T) * Math.PI * 2, q = Math.cos(t), st = Math.sin(t)
    const y = st >= 0 ? mid(s) + (top(s) - mid(s)) * Math.pow(st, 0.7) : mid(s) + (under(s, q) - mid(s)) * Math.pow(-st, 0.7)
    const g = add2(add2(c, mul2(u, s * HL)), mul2(v, width(s) * q))
    return [g[0], y, g[1]]
  }
  return gridSurface(pt, S, T, -1)   // ∂s × ∂t points inward for this parameterisation; −1 turns it outward
}
function bean(b) {
  const { c, u } = obOf(b)
  return {
    replace: true, pieces: [], meshes: [],
    detached: [{ key: 'cloudgate', mesh: beanMesh(c, u), centre: [c[0], c[1]] }],
    clear: [ringAround(c, 42)], // Grainger Plaza: open granite around the sculpture
    runtime: { cloudgate: { centre: [c[0], c[1]], radius: 11 }, plazas: [{ key: 'cloudgate', c: [c[0], c[1]], r: 38, avoid: [{ c: [c[0], c[1]], r: 11 }] }] },
  }
}
```
In `build-world.js`'s hero loop, include detached meshes in `b.venueTop`, so the manifest `top` stays 10:
```js
b.venueTop = Math.max(b.venueTop, ...(r.detached ?? []).flatMap((d) => d.mesh.positions.filter((_, k) => k % 3 === 1)))
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --prefix pipeline -- tests/landmarks.test.js tests/landmarkRuntime.test.js`
Expected: PASS. The "clearings" test still sees one bean clearing.

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/landmarks.js pipeline/build/build-world.js pipeline/tests/landmarks.test.js
git commit -m "feat(v6): Cloud Gate's true shape — 20 × 13 × 10 m with the 3.7 m arch and 8.2 m omphalos, detached for its own mirror" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Cloud Gate's live mirror — a staggered low-res cube camera (E3)

**Files:**
- Create: `app/src/landmarks/cubeFaces.js`, `app/src/landmarks/CloudGate.jsx`, `app/src/landmarks/__tests__/cubeFaces.test.js`
- Modify: `app/src/world/Landmarks.jsx`

**Interfaces:**
- Consumes: `landmarks.json` `detached[]` (`{ key: 'cloudgate', file, centre }`); the store `quality`.
- Produces:
  - `CUBE = { size: 128, period: 30, near: 1, far: 3000, maxDist: 1500 }`
  - `cubeFaceFor(frame, period = 30) → 0..5 | -1` — one face on each of the first 6 frames of every 30-frame period
  - `cubeActive({ quality, camDist }) → boolean` — false at LOW and beyond 1.5 km
  - `<CloudGate file centre />` — one draw. MeshStandard, metalness 1, roughness 0.04. Its envMap is the cube render target when active; otherwise it uses `scene.environment`, the sky.

- [ ] **Step 1: Write the failing test**

`app/src/landmarks/__tests__/cubeFaces.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { cubeFaceFor, cubeActive, CUBE } from '../cubeFaces.js'
describe('Cloud Gate cube camera budget', () => {
  it('one face per frame for frames 0–5 of every 30, then idle', () => {
    expect([0, 1, 2, 3, 4, 5].map((f) => cubeFaceFor(f))).toEqual([0, 1, 2, 3, 4, 5])
    for (let f = 6; f < 30; f++) expect(cubeFaceFor(f)).toBe(-1)
    expect(cubeFaceFor(30)).toBe(0); expect(cubeFaceFor(65)).toBe(5)
  })
  it('stays correct for huge and negative frame counters', () => {
    const f = cubeFaceFor(Number.MAX_SAFE_INTEGER)
    expect(f >= -1 && f <= 5 && Number.isInteger(f)).toBe(true)
    expect(cubeFaceFor(-30)).toBe(0)
  })
  it('never renders at LOW or when the Bean is far away', () => {
    expect(cubeActive({ quality: 'LOW', camDist: 10 })).toBe(false)
    expect(cubeActive({ quality: 'HIGH', camDist: CUBE.maxDist + 1 })).toBe(false)
    expect(cubeActive({ quality: 'HIGH', camDist: 800 })).toBe(true)
    expect(cubeActive({ quality: 'ULTRA', camDist: 0 })).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix app -- src/landmarks/__tests__/cubeFaces.test.js`
Expected: FAIL — `Failed to load url ../cubeFaces.js`.

- [ ] **Step 3: Implement**

`app/src/landmarks/cubeFaces.js`:
```js
// app/src/landmarks/cubeFaces.js — Cloud Gate's mirror budget: a 128 px cube, one face per frame, refreshed every 30 frames.
export const CUBE = { size: 128, period: 30, near: 1, far: 3000, maxDist: 1500 }
export function cubeFaceFor(frame, period = CUBE.period) {
  const f = ((frame % period) + period) % period
  return f < 6 ? f : -1
}
export const cubeActive = ({ quality, camDist }) => quality !== 'LOW' && camDist <= CUBE.maxDist
```

`app/src/landmarks/CloudGate.jsx`:
```jsx
// app/src/landmarks/CloudGate.jsx — the Bean in polished steel, mirroring the live sky and skyline.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { CUBE, cubeFaceFor, cubeActive } from './cubeFaces.js'

export default function CloudGate({ file, centre }) {
  const { scene: glb } = useGLTF(`/world/${file}`, false, true)
  const quality = useStore((s) => s.quality)
  const { gl, scene, camera } = useThree()
  const rt = useMemo(() => new THREE.WebGLCubeRenderTarget(CUBE.size, { type: THREE.HalfFloatType }), [])
  const cubeCam = useMemo(() => new THREE.CubeCamera(CUBE.near, CUBE.far, rt), [rt])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2f4f6', metalness: 1, roughness: 0.04 }), [])
  const geo = useMemo(() => { let g = null; glb.traverse((o) => { if (o.isMesh && !g) g = o.geometry }); return g }, [glb])
  const bean = useRef(), frame = useRef(0), primed = useRef(false)
  useEffect(() => () => { rt.dispose(); mat.dispose() }, [rt, mat])
  useFrame(() => {
    const active = cubeActive({ quality, camDist: Math.hypot(camera.position.x - centre[0], camera.position.z - centre[1]) })
    const env = active ? rt.texture : null   // null → scene.environment (the sky) at LOW or far away
    if (mat.envMap !== env) { mat.envMap = env; mat.needsUpdate = true }
    if (!active || !bean.current) { primed.current = false; return }
    if (cubeCam.coordinateSystem !== gl.coordinateSystem) { cubeCam.coordinateSystem = gl.coordinateSystem; cubeCam.updateCoordinateSystem() }
    cubeCam.position.set(centre[0], 5, centre[1]); cubeCam.updateMatrixWorld(true)
    const faces = primed.current ? [cubeFaceFor(frame.current++)] : [0, 1, 2, 3, 4, 5]   // first sight: fill all six once
    primed.current = true
    if (faces[0] < 0) return
    const prev = gl.getRenderTarget(), xr = gl.xr.enabled
    gl.xr.enabled = false; bean.current.visible = false
    for (const f of faces) { gl.setRenderTarget(rt, f); gl.render(scene, cubeCam.children[f]) }
    gl.setRenderTarget(prev); gl.xr.enabled = xr; bean.current.visible = true
  })
  return geo ? <mesh ref={bean} geometry={geo} material={mat} castShadow receiveShadow /> : null
}
```
In `Landmarks.jsx`, import `CloudGate` and `Suspense`, then add:
```jsx
      {runtime?.detached?.filter((d) => d.key === 'cloudgate').map((d) => <Suspense key={d.key} fallback={null}><CloudGate file={d.file} centre={d.centre} /></Suspense>)}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --prefix app -- src/landmarks`
Expected: PASS.

- [ ] **Step 5: Build, then do the visual check with evaluate-and-revert**

Run `npm run build:world --prefix pipeline`. Then:
```bash
cd app && GALLERY_DIR=../.superpowers/sdd/2026-09-29-v6-landmarks-bridges/shots GALLERY="cloudgate:cloudgate-after@day,cloudgate:cloudgate-after@dusk,cloudgate:cloudgate-after@night" npx playwright test e2e/gallery.spec.js
```
Pose `cloudgate`: (398, 9, −46) → (374, 5, −73).

Compare with `cloudgate-before-*` and the reference photo at https://en.wikipedia.org/wiki/Cloud_Gate, and log the side-by-side (E3 acceptance). Keep the change if:
- the reflection shows the sky and recognizable towers (the Michigan Avenue street wall);
- the underside arch and its dimpled omphalos are visible from this pose;
- the edges show no black cube-seam flicker.

Also run `?view=cloudgate&stats` and check that `__gl.info.render.calls` does not spike by more than ~1 scene pass on the refresh frames.
If the mirror fails after one fix attempt, revert (own commit). The fallback keeps the new shape with the sky environment; record `Reverted: Cloud Gate cube mirror — <why>`.

- [ ] **Step 6: Commit**

```bash
git add app/src/landmarks/cubeFaces.js app/src/landmarks/CloudGate.jsx app/src/landmarks/__tests__/cubeFaces.test.js app/src/world/Landmarks.jsx
git commit -m "feat(v6): Cloud Gate mirrors the live sky and skyline — 128 px cube camera, one face per frame, every 30 frames, off at LOW or beyond 1.5 km" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: People on the plazas (E3, and the other plazas)

**Files:**
- Create: `app/src/landmarks/plazaPeople.js`, `app/src/landmarks/PlazaPeople.jsx`, `app/src/landmarks/__tests__/plazaPeople.test.js`
- Modify: `app/src/world/Landmarks.jsx`

**Interfaces:**
- Consumes: `landmarks.json` `plazas[]` (`{ key, c, r, avoid: [{ c, r }] }`); `chicagoClock`; the store `quality`.
- Produces:
  - `crowdDensity(hour) → people per 100 m²`
  - `plazaPeople(plazas, hour, { cap = 1200, seed = 1 }) → [{ x, z, yaw, shirt: 0..7, plaza }]` — deterministic
  - `<PlazaPeople plazas />` — one `InstancedMesh` (capsule figures); hidden at LOW and beyond 1.2 km from every plaza

- [ ] **Step 1: Write the failing test**

`app/src/landmarks/__tests__/plazaPeople.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { plazaPeople, crowdDensity } from '../plazaPeople.js'

const plazas = [
  { key: 'cloudgate', c: [374, -73], r: 38, avoid: [{ c: [374, -73], r: 11 }] },
  { key: 'buckingham', c: [711, 693], r: 62, avoid: [{ c: [711, 693], r: 43.7 }] },
]
describe('plaza people', () => {
  it('nobody stands inside a sculpture or in the fountain pool, nobody outside the plaza', () => {
    for (const p of plazaPeople(plazas, 14)) {
      const pl = plazas.find((x) => x.key === p.plaza)
      expect(Math.hypot(p.x - pl.c[0], p.z - pl.c[1])).toBeLessThanOrEqual(pl.r + 1e-9)
      for (const a of pl.avoid) expect(Math.hypot(p.x - a.c[0], p.z - a.c[1])).toBeGreaterThanOrEqual(a.r)
    }
  })
  it('busy by day, nearly empty at 3 am, identical on every call', () => {
    expect(plazaPeople(plazas, 14).length).toBeGreaterThan(5 * plazaPeople(plazas, 3).length)
    expect(plazaPeople(plazas, 14)).toEqual(plazaPeople(plazas, 14))
    expect(crowdDensity(14)).toBeGreaterThan(crowdDensity(20))
  })
  it('respects the instance cap', () => {
    expect(plazaPeople([{ key: 'big', c: [0, 0], r: 400, avoid: [] }], 14, { cap: 300 }).length).toBe(300)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix app -- src/landmarks/__tests__/plazaPeople.test.js`
Expected: FAIL — `Failed to load url ../plazaPeople.js`.

- [ ] **Step 3: Implement**

`app/src/landmarks/plazaPeople.js`:
```js
// app/src/landmarks/plazaPeople.js — deterministic crowds on Chicago's plazas, thinning out at night.
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
export const crowdDensity = (hour) => (hour < 6 ? 0.05 : hour < 10 ? 0.4 : hour < 18 ? 1.1 : hour < 23 ? 0.6 : 0.05)
export function plazaPeople(plazas, hour, { cap = 1200, seed = 1 } = {}) {
  const out = []
  plazas.forEach((p, pi) => {
    const n = Math.round(((Math.PI * p.r * p.r) / 100) * crowdDensity(hour))
    for (let i = 0, k = 0; k < n && i < n * 6 && out.length < cap; i++) {
      const a = hash(seed + pi * 1000 + i * 2.1) * Math.PI * 2, d = Math.sqrt(hash(seed + pi * 1000 + i * 3.7)) * p.r
      const x = p.c[0] + Math.cos(a) * d, z = p.c[1] + Math.sin(a) * d
      if ((p.avoid ?? []).some((o) => Math.hypot(x - o.c[0], z - o.c[1]) < o.r)) continue
      out.push({ x, z, yaw: hash(i * 9.1 + pi) * Math.PI * 2, shirt: Math.floor(hash(i * 5.3 + pi) * 8), plaza: p.key }); k++
    }
  })
  return out
}
```

`app/src/landmarks/PlazaPeople.jsx`:
```jsx
// app/src/landmarks/PlazaPeople.jsx — plaza crowds as one instanced draw; off at LOW or when far away.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { chicagoClock } from '../lib/chicagoTime.js'
import { plazaPeople } from './plazaPeople.js'

const SHIRTS = ['#2d4f8a', '#c23b30', '#e6e2d8', '#1f1f22', '#3f7a4a', '#d9a33a', '#7a4b8f', '#8fa8c8']
const CAP = 1200
export default function PlazaPeople({ plazas }) {
  const quality = useStore((s) => s.quality)
  const [hour, setHour] = useState(() => chicagoClock().hour)
  useEffect(() => { const id = setInterval(() => setHour(chicagoClock().hour), 60_000); return () => clearInterval(id) }, [])
  const people = useMemo(() => plazaPeople(plazas, hour, { cap: CAP }), [plazas, hour])
  const geo = useMemo(() => new THREE.CapsuleGeometry(0.23, 1.15, 3, 8), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.85 }), [])
  const ref = useRef()
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D(), c = new THREE.Color()
    people.forEach((p, i) => { o.position.set(p.x, 0.83, p.z); o.rotation.set(0, p.yaw, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, c.set(SHIRTS[p.shirt])) })
    m.count = people.length; m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [people, quality])
  useFrame(({ camera }) => {
    if (ref.current) ref.current.visible = plazas.some((p) => Math.hypot(camera.position.x - p.c[0], camera.position.z - p.c[1]) < 1200)
  })
  if (quality === 'LOW' || !people.length) return null
  return <instancedMesh ref={ref} args={[geo, mat, CAP]} frustumCulled={false} />
}
```
In `Landmarks.jsx`, add `{runtime?.plazas?.length > 0 && <PlazaPeople plazas={runtime.plazas} />}`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --prefix app -- src/landmarks`
Expected: PASS.

- [ ] **Step 5: Visual, with evaluate-and-revert**

```bash
cd app && GALLERY_DIR=../.superpowers/sdd/2026-09-29-v6-landmarks-bridges/shots GALLERY="cloudgate:people@day,buckingham:people@day" npx playwright test e2e/gallery.spec.js
```
Poses: `cloudgate` (398, 9, −46) → (374, 5, −73); `buckingham` (800, 55, 600) → (711, 8, 693).

Keep the change if the figures read as people at human scale (about 1.7 m against the 3.7 m arch), stand on the ground, and are not floating or clumped. Otherwise revert (own commit) and record a ledger line.

- [ ] **Step 6: Commit**

```bash
git add app/src/landmarks/plazaPeople.js app/src/landmarks/PlazaPeople.jsx app/src/landmarks/__tests__/plazaPeople.test.js app/src/world/Landmarks.jsx
git commit -m "feat(v6): people on the Bean's plaza and around Buckingham, by Chicago hour; one instanced draw, off at LOW" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 16: P1 landmarks A — Crown Fountain (with animated faces), Lurie Garden, BP Bridge, Art Institute lions and Modern Wing (E8)

**Files:**
- Create: `pipeline/lib/civic.js`, `pipeline/tests/civic.test.js`, `app/src/landmarks/crownFace.js`, `app/src/landmarks/__tests__/crownFace.test.js`
- Modify: `pipeline/lib/landmarks.js` (register `CIVIC`), `pipeline/data/heroes.json` (four entries), `app/src/world/Landmarks.jsx` (the Crown face driver)

**Interfaces:**
- Consumes:
  - meshkit;
  - `orientedBox`, `lathe`, `DOME` (`sacred.js`); `drum`, `pyramid` (`crowns.js`); `convexHull` (`venue.js`);
  - `facadeUniforms.uCrown`/`uCrownB`; `crownLevels` (Task 12).
- Produces:
  - `civic.js`: `export const CIVIC = { crownFountain, lurie, bpBridge, artInstitute }` (Tasks 17–18 extend it), `export function faceOf(b, f) → { c, face, side, o0, o1 }`, `export function lionFigure() → Mesh`, `CROWN = { towerW: 7.0, towerD: 4.9, towerH: 15.2, poolL: 71, poolW: 15 }`
  - `landmarks.js`: `const BUILDERS = { wheel, bean, fountain, theatreSign, museum, castellated, pavilion, ...CIVIC }`
  - Crown runtime: `runtime.crown = { towers: [[x,z],[x,z]], spouts: Emitter[] (kind 'crown', tower 0|1) }`, plus a plaza
  - `crownFace.js`: `CROWN_CYCLE`, `crownFace(tSec, { waterOn }) → { face: 0..999, phase: 'hold'|'pucker'|'spout'|'smile', pucker, smile, spout: 0|1 }`, `crownWaterOn(date) → boolean` (water runs May–October)

- [ ] **Step 1: Write the failing tests**

`pipeline/tests/civic.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { buildLandmark, LANDMARK_FACADES as F } from '../lib/landmarks.js'
import { unproject } from '../../shared/project.js'

export const ll = ([x, z]) => { const [lon, lat] = unproject(x, z); return { lat, lon } }
export const pts = (ms) => ms.flatMap((x) => { const o = []; for (let i = 0; i < x.mesh.positions.length; i += 3) o.push(x.mesh.positions.slice(i, i + 3)); return o })
export const ymax = (ms) => Math.max(...pts(ms).map((q) => q[1]))
export const synth = (c, r = 20) => ({ id: 's', polygons: [{ outer: Array.from({ length: 24 }, (_, i) => [c[0] + r * Math.cos((i / 24) * 2 * Math.PI), c[1] + r * Math.sin((i / 24) * 2 * Math.PI)]), holes: [] }], centroid: c, height: 0 })
export const box = (x0, z0, x1, z1, h) => ({ id: 'b', polygons: [{ outer: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], holes: [] }], centroid: [(x0 + x1) / 2, (z0 + z1) / 2], height: h })

describe('Crown Fountain', () => {
  const r = buildLandmark(synth([340, 60]), { type: 'crownFountain', towers: [ll([339.5, 34.5]), ll([340.5, 86])] })
  it('two 15.2 m glass-block towers across a 71 × 15 m black granite pool', () => {
    const towers = r.meshes.filter((m) => m.part === 'tower')
    expect(towers).toHaveLength(2); expect(ymax(towers)).toBeCloseTo(15.2)
    expect(towers.every((m) => m.facade === F.stone && m.style === 'crown-glass-block')).toBe(true)
    const zs = pts(r.meshes.filter((m) => m.part === 'pool')).map((q) => q[2])
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(71, 0)
  })
  it('an LED face on each tower, facing the pool, each with its own face uniform', () => {
    const s = r.meshes.filter((m) => m.part === 'screen')
    expect(s.map((m) => m.facade)).toEqual([F.face, F.face]); expect(s.map((m) => m.seed)).toEqual([0.25, 0.75])
    expect(Math.max(...s[0].mesh.uvs)).toBeCloseTo(1); expect(Math.min(...s[0].mesh.uvs)).toBeCloseTo(0)
    expect(s[0].mesh.normals[2]).toBeGreaterThan(0.9)   // the north tower's face looks south, down the pool
  })
  it('a spout from each mouth, and a plaza that keeps people out of the towers', () => {
    expect(r.runtime.crown.spouts.map((x) => x.tower)).toEqual([0, 1])
    expect(r.runtime.crown.spouts.every((x) => x.kind === 'crown')).toBe(true)
    expect(r.runtime.plazas[0].avoid).toHaveLength(2)
  })
})

describe('Lurie Garden', () => {
  const r = buildLandmark(synth([506, 66], 50), { type: 'lurie', L: 100, W: 100, bearing: 90 })
  it('a 15 ft (4.6 m) Shoulder Hedge, dark and light plates, and the seam boardwalk', () => {
    expect(ymax(r.meshes.filter((m) => m.part === 'hedge'))).toBeCloseTo(4.6)
    expect(r.meshes.filter((m) => m.part === 'planting').map((m) => m.style).sort()).toEqual(['lurie-dark-plate', 'lurie-light-plate'])
    expect(r.meshes.some((m) => m.part === 'seam')).toBe(true)
  })
})

describe('BP Bridge', () => {
  const path = [[572, -118], [600, -95], [630, -138], [660, -98], [692, -146], [722, -120]].map(ll)
  const r = buildLandmark(synth([645, -115]), { type: 'bpBridge', path, rise: 4.4 })
  it('a serpentine deck rising over Columbus Drive, clad in stainless steel', () => {
    const skin = r.meshes.filter((m) => m.part === 'skin')
    expect(skin[0].facade).toBe(F.bronze); expect(skin[0].style).toBe('gehry-stainless')
    expect(ymax(r.meshes)).toBeGreaterThan(6); expect(ymax(r.meshes)).toBeLessThan(6.8)
    const deck = pts(r.meshes.filter((m) => m.part === 'deck'))
    expect(deck.some((q) => Math.hypot(q[0] - 572, q[2] + 118) < 2.5)).toBe(true)
    expect(deck.some((q) => Math.hypot(q[0] - 722, q[2] + 120) < 2.5)).toBe(true)
  })
})

describe('Art Institute', () => {
  const r = buildLandmark(box(314, 151, 561, 397, 22), { type: 'artInstitute', facingBearing: 270, lions: [ll([308, 288]), ll([308, 312])], canopy: { at: ll([492, 206]), bearing: 90, L: 100, W: 110, y: 24 } })
  it('two bronze lions on plinths, looking west down Michigan Avenue', () => {
    const lions = r.meshes.filter((m) => m.part === 'lion')
    expect(lions).toHaveLength(2)
    for (const l of lions) { expect(l.facade).toBe(F.bronze); expect(Math.min(...pts([l]).map((q) => q[0]))).toBeLessThan(308 - 1.5) }
  })
  it('the Modern Wing "flying carpet" floats at its height', () => {
    const c = pts(r.meshes.filter((m) => m.part === 'modern-wing-canopy'))
    expect(Math.max(...c.map((q) => q[1]))).toBeCloseTo(24.35)
  })
})
```

`app/src/landmarks/__tests__/crownFace.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { crownFace, crownWaterOn } from '../crownFace.js'
describe('Crown Fountain face cycle (5 minutes per face)', () => {
  it('holds 4 min, puckers 15 s, spouts 30 s, smiles 15 s', () => {
    expect(crownFace(10).phase).toBe('hold')
    expect(crownFace(245).pucker).toBeCloseTo(1 / 3)
    expect(crownFace(260)).toMatchObject({ phase: 'spout', spout: 1 })
    expect(crownFace(290)).toMatchObject({ phase: 'smile', smile: 1 })
  })
  it('no water out of season, but the faces keep playing', () => {
    expect(crownFace(260, { waterOn: false })).toMatchObject({ phase: 'spout', spout: 0 })
    expect(crownWaterOn(new Date('2026-07-01T17:00:00Z'))).toBe(true)
    expect(crownWaterOn(new Date('2026-12-01T17:00:00Z'))).toBe(false)
  })
  it('a deterministic face per cycle, within the ~1,000 portraits', () => {
    const a = crownFace(10).face, b = crownFace(310).face
    expect(crownFace(20).face).toBe(a)
    expect(a).toBeGreaterThanOrEqual(0); expect(b).toBeLessThan(1000)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --prefix pipeline -- tests/civic.test.js` and `npm test --prefix app -- src/landmarks/__tests__/crownFace.test.js`
Expected: FAIL — `unknown landmark type: crownFountain`, and `Failed to load url ../crownFace.js`.

- [ ] **Step 3: Implement `pipeline/lib/civic.js` (first four builders)**

```js
// pipeline/lib/civic.js — the P1 civic landmarks (backlog E8): procedural, sourced, coloured through _STYLE.
import { project } from '../../shared/project.js'
import { convexHull } from './venue.js'
import { orientedBox, lathe, DOME } from './sacred.js'
import { drum, pyramid } from './crowns.js'
import { add2, sub2, mul2, dot2, norm2, left, bearing, at3, norm3, mesh, quad, merge, tube, slab, barrel, place, catmullRom, ringAround } from './meshkit.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'

const local = (p) => project(p.lon, p.lat)
const hullOf = (b) => convexHull(b.polygons.flatMap((p) => p.outer))
const obOf = (b) => orientedBox(hullOf(b))
const P = (m, facade, style, part, seed = 0.5) => ({ mesh: m, facade, seed, style, part })
const rectRing = (c, u, L, W) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, o]) => add2(add2(c, mul2(u, (a * L) / 2)), mul2(left(u), (o * W) / 2)))

// The face of a footprint looking along f: hull centre, how far out the face is, and its extent across (side).
export function faceOf(b, f) {
  const hull = hullOf(b), c = mul2(hull.reduce((s, p) => add2(s, p), [0, 0]), 1 / hull.length), side = left(f)
  const face = Math.max(...hull.map((p) => dot2(sub2(p, c), f)))
  const near = hull.filter((p) => dot2(sub2(p, c), f) > face - 10).map((p) => dot2(sub2(p, c), side))
  return { c, face, side, o0: Math.min(...near), o1: Math.max(...near) }
}

// ── Crown Fountain (Jaume Plensa, 2004) ─ https://en.wikipedia.org/wiki/Crown_Fountain
// Towers 50 × 23 × 16 ft (15.2 × 7.0 × 4.9 m) of glass brick with LED faces; black granite pool 48 × 232 ft (15 × 71 m).
export const CROWN = { towerW: 7.0, towerD: 4.9, towerH: 15.2, poolL: 71, poolW: 15 }
function crownFountain(b, spec) {
  const [t1, t2] = spec.towers.map(local), axis = norm2(sub2(t2, t1)), mid = mul2(add2(t1, t2), 0.5), meshes = [], spouts = []
  meshes.push(P(slab(mesh(), mid, axis, CROWN.poolL, CROWN.poolW, 0, 0.12), F.stone, 'black-granite', 'pool'))
  meshes.push(P(slab(mesh(), mid, axis, CROWN.poolL - 0.6, CROWN.poolW - 0.6, 0.12, 0.14), F.water, null, 'pool-water', 0.1))
  ;[t1, t2].forEach((t, i) => {
    const f = norm2(sub2(mid, t)), side = left(f)
    meshes.push(P(slab(mesh(), t, f, CROWN.towerD, CROWN.towerW, 0, CROWN.towerH), F.stone, 'crown-glass-block', 'tower'))
    const face = add2(t, mul2(f, CROWN.towerD / 2 + 0.03)), Q = (o, y) => at3(add2(face, mul2(side, o)), y)
    meshes.push(P(quad(mesh(), Q(-3.2, 0.6), Q(3.2, 0.6), Q(3.2, 14.6), Q(-3.2, 14.6), [f[0], 0, f[1]], [0, 0, 1, 1]), F.face, null, 'screen', i === 0 ? 0.25 : 0.75))
    spouts.push({ kind: 'crown', tower: i, p: at3(add2(face, mul2(f, 0.1)), 0.6 + 14 * 0.35), dir: norm3([f[0] * 0.95, 0.3, f[1] * 0.95]), h: 4, floor: 0.14 })
  })
  return {
    replace: true, pieces: [], meshes, clear: [rectRing(mid, axis, CROWN.poolL + 12, CROWN.poolW + 16)],
    runtime: { crown: { towers: [t1, t2], spouts }, plazas: [{ key: 'crownfountain', c: mid, r: 45, avoid: [{ c: t1, r: 5 }, { c: t2, r: 5 }] }] },
  }
}

// ── Lurie Garden (2004) ─ https://en.wikipedia.org/wiki/Lurie_Garden — the 15 ft Shoulder Hedge on the north and west,
// the dark and light plates of perennials, divided by the "seam" boardwalk.
function lurie(b, spec) {
  const c = b.centroid, u = bearing(spec.bearing ?? 90), v = left(u), L = spec.L ?? 100, W = spec.W ?? 100, seamA = -0.1 * L
  const at = (a, o) => add2(add2(c, mul2(u, a)), mul2(v, o))
  const hedge = mesh()
  slab(hedge, at(0, W / 2 - 1.5), u, L, 3, 0, 4.6)                       // north
  slab(hedge, at(-L / 2 + 1.5, -1.5), u, 3, W - 3, 0, 4.6)               // west
  const d0 = -L / 2 + 3, d1 = seamA - 1.5, l0 = seamA + 1.5, l1 = L / 2
  return {
    replace: true, pieces: [], clear: [rectRing(c, u, L, W)],
    meshes: [
      P(hedge, F.ivy, 'lurie-hedge', 'hedge'),
      P(slab(mesh(), at((d0 + d1) / 2, -1.5), u, d1 - d0, W - 3, 0, 0.45), F.ivy, 'lurie-dark-plate', 'planting'),
      P(slab(mesh(), at((l0 + l1) / 2, -1.5), u, l1 - l0, W - 3, 0, 0.45), F.ivy, 'lurie-light-plate', 'planting'),
      P(slab(mesh(), at(seamA, 0), u, 3, W, 0, 0.5), F.stone, 'bp-deck-wood', 'seam'),
    ],
  }
}

// ── BP Pedestrian Bridge (Frank Gehry, 2004) ─ https://en.wikipedia.org/wiki/BP_Pedestrian_Bridge — a 935 ft (285 m)
// serpentine footbridge over Columbus Drive, hardwood deck, brushed stainless steel side panels.
function bpBridge(b, spec) {
  const pts = catmullRom(spec.path.map(local), 2), n = pts.length, W = 3.4, rise = spec.rise ?? 4.4
  const deck = mesh(), skin = mesh(), piers = mesh(), y = (i) => 0.4 + rise * Math.sin((Math.PI * i) / (n - 1))
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i], c2 = pts[i + 1], s = left(norm2(sub2(c2, a))), A = (p, o, yy) => at3(add2(p, mul2(s, o)), yy)
    quad(deck, A(a, -W / 2, y(i)), A(c2, -W / 2, y(i + 1)), A(c2, W / 2, y(i + 1)), A(a, W / 2, y(i)), [0, 1, 0], [0, 0, 2, W])
    quad(deck, A(a, -W / 2, y(i) - 0.5), A(c2, -W / 2, y(i + 1) - 0.5), A(c2, W / 2, y(i + 1) - 0.5), A(a, W / 2, y(i) - 0.5), [0, -1, 0])
    for (const o of [-1, 1]) {
      const q = [A(a, (o * W) / 2, y(i) - 0.5), A(c2, (o * W) / 2, y(i + 1) - 0.5), A(c2, o * (W / 2 + 0.45), y(i + 1) + 1.9), A(a, o * (W / 2 + 0.45), y(i) + 1.9)]
      quad(skin, ...q, [s[0] * o, 0.3, s[1] * o]); quad(skin, ...q, [-s[0] * o, 0.3, -s[1] * o])   // outer and inner faces
    }
    if (i % 15 === 7 && y(i) > 1.2) tube(piers, at3(a, 0), at3(a, y(i) - 0.5), 0.5, 8)
  }
  return { replace: true, pieces: [], meshes: [P(deck, F.stone, 'bp-deck-wood', 'deck'), P(skin, F.bronze, 'gehry-stainless', 'skin'), P(piers, F.steel, 'gehry-stainless', 'pier')] }
}

// ── Art Institute of Chicago ─ https://en.wikipedia.org/wiki/Art_Institute_of_Chicago_Building (Edward Kemeys'
// bronze lions, 1894, flanking the Michigan Avenue steps); https://en.wikipedia.org/wiki/Modern_Wing (Renzo Piano, 2009).
export function lionFigure() {   // local: faces +x, stands on a 1.5 m plinth
  const m = mesh()
  tube(m, [-1.2, 2.3, 0], [0.9, 2.45, 0], 0.55, 8)
  tube(m, [1.2, 2.95, 0], [1.8, 2.75, 0], 0.36, 8)
  for (const [x, z] of [[0.8, 0.35], [0.8, -0.35], [-0.9, 0.35], [-0.9, -0.35]]) tube(m, [x, 1.5, z], [x, 2.25, z], 0.2, 6)
  tube(m, [-1.2, 2.4, 0], [-1.9, 1.9, 0.2], 0.1, 6)
  return merge(m, drum({ at: [1.0, 0], base: 2.0, top: 3.1, r: 0.72, sides: 10 }))   // mane
}
function artInstitute(b, spec) {
  const meshes = [], lion = lionFigure(), plinth = slab(mesh(), [0, 0], [1, 0], 3.9, 1.7, 0, 1.5)
  for (const l of spec.lions) {
    const at = local(l)
    meshes.push(P(place(plinth, { at, yawDeg: spec.facingBearing }), F.stone, 'aic-plinth-granite', 'plinth'))
    meshes.push(P(place(lion, { at, yawDeg: spec.facingBearing }), F.bronze, 'aic-lion-bronze', 'lion'))
  }
  const cv = spec.canopy, cc = local(cv.at), u = bearing(cv.bearing ?? 90), m = slab(mesh(), cc, u, cv.L, cv.W, cv.y, cv.y + 0.35)
  for (let k = 0; k < 40; k++) slab(m, add2(cc, mul2(left(u), -cv.W / 2 + (cv.W * (k + 0.5)) / 40)), u, cv.L, 0.12, cv.y - 0.9, cv.y)   // blades
  meshes.push(P(m, F.steel, 'modern-wing-white', 'modern-wing-canopy'))
  return { meshes }
}

export const CIVIC = { crownFountain, lurie, bpBridge, artInstitute }
```
The imports `pyramid`, `lathe`, `DOME`, `barrel` and `ringAround` are used by Tasks 17–18; keep them now so later tasks only append.

In `landmarks.js`, add `import { CIVIC } from './civic.js'` and change `BUILDERS` to `{ wheel, bean, fountain, theatreSign, museum, castellated, pavilion, ...CIVIC }`.

- [ ] **Step 4: Implement the Crown face cycle and its driver**

`app/src/landmarks/crownFace.js`:
```js
// app/src/landmarks/crownFace.js — Crown Fountain's 5-minute cycle per face: a 40 s clip at one-third speed
// forward and back for 4 min, then 15 s pucker, 30 s spout, 15 s smile; ~1,000 faces in random rotation;
// water runs May–October (https://en.wikipedia.org/wiki/Crown_Fountain).
import { chicagoClock } from '../lib/chicagoTime.js'
export const CROWN_CYCLE = { period: 300, holdS: 240, puckerS: 15, spoutS: 30, smileS: 15, faces: 1000 }
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
export function crownFace(tSec, { waterOn = true } = {}) {
  const C = CROWN_CYCLE, k = Math.floor(tSec / C.period), s = tSec - k * C.period, face = Math.floor(hash(k) * C.faces)
  if (s < C.holdS) return { face, phase: 'hold', pucker: 0, smile: 0, spout: 0 }
  if (s < C.holdS + C.puckerS) return { face, phase: 'pucker', pucker: (s - C.holdS) / C.puckerS, smile: 0, spout: 0 }
  if (s < C.holdS + C.puckerS + C.spoutS) return { face, phase: 'spout', pucker: 1, smile: 0, spout: waterOn ? 1 : 0 }
  return { face, phase: 'smile', pucker: 0, smile: 1, spout: 0 }
}
export const crownWaterOn = (date) => { const m = chicagoClock(date).month; return m >= 5 && m <= 10 }
```
In `Landmarks.jsx`, import `crownFace, crownWaterOn` and extend the `useFrame`:
```js
  useFrame(({ clock }) => {
    facadeUniforms.uTime.value = clock.elapsedTime
    const now = Date.now() / 1000, on = crownWaterOn(new Date())
    const a = crownFace(now, { waterOn: on }), b = crownFace(now + 150, { waterOn: on })   // the towers are out of step
    facadeUniforms.uCrown.value.set(a.face, a.pucker, a.smile, 1)
    facadeUniforms.uCrownB.value.set(b.face, b.pucker, b.smile, 1)
    crownLevels.current = [a.spout, b.spout]
  })
```
Move the `const crownLevels = useRef([0, 0])` declaration above this `useFrame`.

- [ ] **Step 5: Register the four landmarks in `pipeline/data/heroes.json`**

Append these to `heroes`:
```json
{ "key": "crownfountain", "name": "Crown Fountain", "match": { "synthetic": true, "lat": 41.88149, "lon": -87.62374, "radius": 40 }, "suppress": [126945440, 126945441], "crowns": [],
  "landmark": { "type": "crownFountain", "towers": [{ "lat": 41.88172, "lon": -87.62375 }, { "lat": 41.88126, "lon": -87.62374 }] },
  "aliases": ["Plensa fountain", "the faces fountain"], "beacon": { "lat": 41.88149, "lon": -87.62374, "y": 22 },
  "sources": ["https://en.wikipedia.org/wiki/Crown_Fountain", "OpenStreetMap ways 126945440, 126945441 (tower footprints)"] },
{ "key": "lurie", "name": "Lurie Garden", "match": { "synthetic": true, "lat": 41.88144, "lon": -87.62174, "radius": 50 }, "crowns": [],
  "landmark": { "type": "lurie", "L": 100, "W": 100, "bearing": 90 },
  "aliases": ["Millennium Park garden", "Shoulder Hedge"], "beacon": { "lat": 41.88144, "lon": -87.62174, "y": 12 },
  "sources": ["https://en.wikipedia.org/wiki/Lurie_Garden", "OpenStreetMap way 126945427"] },
{ "key": "bpbridge", "name": "BP Bridge", "match": { "synthetic": true, "lat": 41.88307, "lon": -87.62007, "radius": 20 }, "crowns": [],
  "landmark": { "type": "bpBridge", "rise": 4.4, "path": [{ "lat": 41.88309, "lon": -87.62095 }, { "lat": 41.88289, "lon": -87.62061 }, { "lat": 41.88327, "lon": -87.62025 }, { "lat": 41.88291, "lon": -87.61989 }, { "lat": 41.88334, "lon": -87.6195 }, { "lat": 41.88311, "lon": -87.61914 }] },
  "aliases": ["BP Pedestrian Bridge", "Gehry bridge"], "beacon": { "lat": 41.88307, "lon": -87.62007, "y": 14 },
  "sources": ["https://en.wikipedia.org/wiki/BP_Pedestrian_Bridge"] },
{ "key": "artinstitute", "name": "Art Institute of Chicago", "match": { "osmId": 1870546 }, "crowns": [],
  "landmark": { "type": "artInstitute", "facingBearing": 270, "lions": [{ "lat": 41.87944, "lon": -87.62413 }, { "lat": 41.87922, "lon": -87.62413 }], "canopy": { "at": { "lat": 41.88018, "lon": -87.62191 }, "bearing": 90, "L": 100, "W": 110, "y": 24 } },
  "aliases": ["Art Institute", "Art Institute lions", "Modern Wing", "AIC"], "beacon": { "lat": 41.87933, "lon": -87.62413, "y": 14 },
  "sources": ["https://en.wikipedia.org/wiki/Art_Institute_of_Chicago_Building", "https://en.wikipedia.org/wiki/Modern_Wing", "OpenStreetMap relation 1870546"] }
```
The BP path points were placed by hand between the Great Lawn's east edge (x ≈ 572) and Maggie Daley Park (x ≈ 722), because no footway is cached. Record this in the ledger:
```
Ruling: BP Bridge path hand-placed from the park edges; refine from an OSM footway fetch in Phase 3 if the visual check shows drift. Cost if wrong: the bridge lands a few metres off.
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test --prefix pipeline` and `npm test --prefix app -- src/landmarks`
Expected: PASS.

- [ ] **Step 7: Build, then do the visual check with evaluate-and-revert**

Run `npm run build:world --prefix pipeline`. Expected: `heroes applied` rises by 4, and `landmark runtime: fountain, cloudgate, crown`. Then:
```bash
cd app && GALLERY_DIR=../.superpowers/sdd/2026-09-29-v6-landmarks-bridges/shots GALLERY="crownfountain:crownfountain-after@day,crownfountain:crownfountain-after@night,lurie:lurie-after@day,bpbridge:bpbridge-after@day,artinstitute:artinstitute-after@day" npx playwright test e2e/gallery.spec.js
```
Poses:
- `crownfountain`: (420, 26, 60) → (340, 7, 60)
- `lurie`: (575, 55, 150) → (506, 1, 66)
- `bpbridge`: (650, 45, 10) → (640, 3, −105)
- `artinstitute`: (262, 12, 300) → (310, 4, 300)

Keep a landmark only if it passes its check:
- Crown faces are visible and glow at night, with no real likeness;
- the Lurie hedge sits on the north/west edges;
- the BP Bridge snakes and lands on both park edges;
- the lions flank the steps and face Michigan Avenue;
- the Modern Wing canopy sits above its roof, not inside it (tune `canopy.y` if needed).

Log a reference comparison per landmark in the ledger (E8 acceptance). Revert any single landmark that fails after one fix: remove its `heroes.json` entry in its own commit and record `Reverted: <landmark> — <why>`.

- [ ] **Step 8: Commit**

```bash
git add pipeline/lib/civic.js pipeline/lib/landmarks.js pipeline/data/heroes.json pipeline/tests/civic.test.js app/src/landmarks/crownFace.js app/src/landmarks/__tests__/crownFace.test.js app/src/world/Landmarks.jsx
git commit -m "feat(v6): Crown Fountain with animated faces and spouts, Lurie Garden, the BP Bridge, the Art Institute lions and Modern Wing canopy" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: P1 landmarks B — the Picasso, the Flamingo, Cultural Center domes, Union Station, the Merchandise Mart river face (E8)

**Files:**
- Modify: `pipeline/lib/civic.js` (append five builders and extend `CIVIC`), `pipeline/data/heroes.json` (four new entries; the existing `mart` entry gets a landmark), `pipeline/tests/civic.test.js` (append)

**Interfaces:**
- Consumes: Task 16's `civic.js` helpers (`P`, `local`, `obOf`, `faceOf`).
- Produces: builder types `picasso`, `flamingo`, `culturalCenter`, `unionStation`, `martRiverFace`, added to `CIVIC`.

- [ ] **Step 1: Write the failing tests (append to `pipeline/tests/civic.test.js`)**

```js
describe('the Picasso and the Flamingo', () => {
  it('the Picasso: 50 ft (15.2 m) of Cor-Ten on a granite plinth', () => {
    const r = buildLandmark(synth([-186, -202], 10), { type: 'picasso', heightM: 15.2, facingBearing: 180 })
    const s = r.meshes.filter((m) => m.part === 'sculpture')
    expect(s[0].facade).toBe(F.bronze); expect(s[0].style).toBe('corten')
    expect(ymax(s)).toBeCloseTo(15.2, 0)
  })
  it('the Flamingo: 53 ft (16.2 m) of arches in Calder red', () => {
    const r = buildLandmark(synth([-167, 303], 14), { type: 'flamingo', heightM: 16.2 })
    expect(r.meshes[0].facade).toBe(F.paint); expect(r.meshes[0].style).toBe('calder-red')
    expect(ymax(r.meshes)).toBeCloseTo(16.2, 0)
    expect(r.runtime.plazas[0].key).toBe('flamingo')
  })
})

describe('Cultural Center, Union Station, Merchandise Mart', () => {
  it('Cultural Center: the Tiffany (south) and Healy & Millet (north) skylights glow on the roof', () => {
    const r = buildLandmark(box(213, -262, 261, -149, 30), { type: 'culturalCenter', domes: [{ at: ll([237, -175]), r: 5.8, kind: 'tiffany' }, { at: ll([237, -235]), r: 6.1, kind: 'healy-millet' }] })
    const t = r.meshes.find((m) => m.part === 'dome:tiffany'), h = r.meshes.find((m) => m.part === 'dome:healy-millet')
    expect(t.facade).toBe(F.signal); expect(t.style).toBe('tiffany-glass'); expect(h.style).toBe('healy-millet-glass')
    expect(Math.min(...pts([t]).map((q) => q[1]))).toBeGreaterThanOrEqual(30)
    expect(Math.min(...pts([t]).map((q) => q[2]))).toBeGreaterThan(Math.min(...pts([h]).map((q) => q[2])))   // Tiffany is the southern one
  })
  it('Union Station: a Canal Street colonnade and the Great Hall vault', () => {
    const r = buildLandmark(box(-1091, 315, -995, 432, 30.4), { type: 'unionStation', facingBearing: 90, columns: 20, columnH: 16, hall: { L: 67, W: 30, rise: 8 } })
    const cols = pts(r.meshes.filter((m) => m.part === 'column'))
    expect(Math.min(...cols.map((q) => q[0]))).toBeGreaterThan(-995)                // in front of the east (Canal St) face
    expect(r.meshes.find((m) => m.part === 'great-hall').style).toBe('conservatory-glass')
  })
  it('Mart: limestone piers march along the river (south) face', () => {
    const r = buildLandmark(box(-100, -20, 100, 20, 104), { type: 'martRiverFace', facingBearing: 180, pierEvery: 6.1, pierTop: 78 })
    const piers = pts(r.meshes.filter((m) => m.part === 'pier'))
    expect(piers.every((q) => q[2] >= 19.9)).toBe(true)
    expect(Math.max(...piers.map((q) => q[1]))).toBeCloseTo(78)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --prefix pipeline -- tests/civic.test.js`
Expected: FAIL — `unknown landmark type: picasso`.

- [ ] **Step 3: Implement (append to `civic.js`, before `CIVIC`; then extend `CIVIC`)**

```js
// ── The Picasso (1967) ─ https://en.wikipedia.org/wiki/Chicago_Picasso — 50 ft (15.2 m), 162 short tons of Cor-Ten.
function picasso(b, spec) {
  const c = b.centroid, f = bearing(spec.facingBearing ?? 180), s = left(f), H = spec.heightM ?? 15.2, m = mesh(), base = slab(mesh(), c, f, 9, 6, 0, 0.6)
  const Q = (a, o, y) => at3(add2(add2(c, mul2(f, a)), mul2(s, o)), y)
  for (const o of [-1, 1]) slab(m, add2(c, mul2(s, o * 2.2)), f, 1.2, 0.6, 0.6, 4.5)             // legs
  slab(m, add2(c, mul2(f, 0.3)), f, 0.4, 2.4, 4, H - 1.6)                                          // the long face
  for (const o of [-1, 1]) for (let i = 0; i < 6; i++) {                                           // swept "wings"
    const y0 = 4 + i * 1.8, y1 = y0 + 1.8, sw = (y) => 2.2 + 1.8 * Math.sin(((y - 4) / (H - 4)) * Math.PI)
    const q = [Q(-0.3, o * 0.5, y0), Q(-3.5, o * sw(y0), y0), Q(-3.5, o * sw(y1), y1), Q(-0.3, o * 0.5, y1)]
    quad(m, ...q, [s[0] * o, 0, s[1] * o]); quad(m, ...q, [-s[0] * o, 0, -s[1] * o])
  }
  let prev = null
  for (let k = 0; k <= 16; k++) { const t = (k / 16) * Math.PI * 2, q = Q(0.1, Math.cos(t) * 2.8, H - 4.32 + Math.sin(t) * 4.1); if (prev) tube(m, prev, q, 0.22, 5); prev = q }  // head ring
  for (let i = 0; i < 10; i++) { const y = 5.5 + i * 0.85; tube(m, Q(-0.2, 0, y), Q(-3.4, (i % 2 ? 1 : -1) * 2.6, y + 0.4), 0.06, 4) }  // rods
  return { replace: true, pieces: [], clear: [ringAround(c, 12)], meshes: [P(m, F.bronze, 'corten', 'sculpture'), P(base, F.stone, 'aic-plinth-granite', 'plinth')],
    runtime: { plazas: [{ key: 'picasso', c: [c[0], c[1]], r: 30, avoid: [{ c: [c[0], c[1]], r: 7 }] }] } }
}

// ── Flamingo (Alexander Calder, 1974) ─ https://en.wikipedia.org/wiki/Flamingo_(sculpture) — 53 ft (16.2 m), vermilion.
function flamingo(b, spec) {
  const c = b.centroid, H = spec.heightM ?? 16.2, m = mesh(), Pt = (dx, dz) => [c[0] + dx, c[1] + dz]
  const arch = (a0, a1, h, n = 14) => {
    let prev = null
    for (let i = 0; i <= n; i++) { const t = i / n, q = at3(add2(mul2(a0, 1 - t), mul2(a1, t)), h * Math.sin(Math.PI * t)); if (prev) tube(m, prev, q, 0.9 - 0.5 * Math.sin(Math.PI * t) + 0.1, 6); prev = q }
  }
  arch(Pt(-9, -2), Pt(8, 3), H - 0.5); arch(Pt(-2, 7), Pt(3, -8), 0.7 * H); arch(Pt(4, 6), Pt(9, -1), 0.4 * H)
  return { replace: true, pieces: [], clear: [ringAround(c, 16)], meshes: [P(m, F.paint, 'calder-red', 'flamingo')],
    runtime: { plazas: [{ key: 'flamingo', c: [c[0], c[1]], r: 32, avoid: [{ c: [c[0], c[1]], r: 10 }] }] } }
}

// ── Chicago Cultural Center ─ https://en.wikipedia.org/wiki/Chicago_Cultural_Center — the Tiffany dome (38 ft) over
// Preston Bradley Hall (Washington St side) and the Healy & Millet dome (40 ft) over the G.A.R. Hall (Randolph side).
// Both sit under protective skylights, so from outside they read as glazed roof lanterns that glow at night.
function culturalCenter(b, spec) {
  const { u } = obOf(b), top = b.height, meshes = []
  for (const d of spec.domes) {
    const at = local(d.at), r = d.r, ring = rectRing(at, u, 2 * r + 1.6, 2 * r + 1.6)
    meshes.push(P(slab(mesh(), at, u, 2 * r + 1.6, 2 * r + 1.6, top, top + 1.2), F.stone, 'tender-limestone', 'skylight-curb'))
    meshes.push(P(pyramid({ ring, base: top + 1.2, top: top + 1.2 + 0.45 * r }), F.signal, d.kind === 'tiffany' ? 'tiffany-glass' : 'healy-millet-glass', `dome:${d.kind}`))
  }
  return { meshes }
}

// ── Chicago Union Station (1925) ─ https://en.wikipedia.org/wiki/Chicago_Union_Station — the Canal Street colonnade
// and the barrel-vaulted skylight of the Great Hall (219 ft long, 115 ft high inside).
function unionStation(b, spec) {
  const f = bearing(spec.facingBearing ?? 90), { c, face, side, o0, o1 } = faceOf(b, f), H = spec.columnH ?? 16, n = spec.columns ?? 20
  const span = o1 - o0 - 6, front = add2(c, mul2(f, face + 2.2)), mid = (o0 + o1) / 2, hall = spec.hall ?? { L: 67, W: 30, rise: 8 }
  const cols = merge(...Array.from({ length: n }, (_, i) => drum({ at: add2(front, mul2(side, mid - span / 2 + (span * i) / (n - 1))), base: 0, top: H, r: 0.95, sides: 12 })))
  const ent = slab(mesh(), add2(front, mul2(side, mid)), f, 3.4, span + 2.4, H, H + 2.2)
  return { meshes: [P(cols, F.stone, 'union-limestone', 'column'), P(ent, F.stone, 'union-limestone', 'entablature'), P(barrel(c, side, hall.L, hall.W, b.height - 4, hall.rise), F.wall, 'conservatory-glass', 'great-hall', 0.35)] }
}

// ── Merchandise Mart (1930) ─ https://en.wikipedia.org/wiki/Merchandise_Mart — the river façade's limestone piers
// and corner towers above the main block.
function martRiverFace(b, spec) {
  const f = bearing(spec.facingBearing ?? 180), { c, face, side, o0, o1 } = faceOf(b, f), top = spec.pierTop ?? 78, every = spec.pierEvery ?? 6.1
  const piers = mesh(), towers = mesh(), n = Math.max(1, Math.floor((o1 - o0) / every))
  for (let i = 0; i <= n; i++) slab(piers, add2(add2(c, mul2(f, face + 0.45)), mul2(side, o0 + ((o1 - o0) * i) / n)), f, 0.9, 1.1, 0, top)
  for (const o of [o0 + 4, o1 - 4]) slab(towers, add2(add2(c, mul2(f, face - 4)), mul2(side, o)), f, 8, 8, top, top + 9)
  return { meshes: [P(piers, F.stone, 'mart-limestone', 'pier'), P(towers, F.stone, 'mart-limestone', 'corner-tower')] }
}
```
Change `CIVIC` to:
```js
export const CIVIC = { crownFountain, lurie, bpBridge, artInstitute, picasso, flamingo, culturalCenter, unionStation, martRiverFace }
```

- [ ] **Step 4: Register them in `heroes.json`**

Append:
```json
{ "key": "picasso", "name": "The Picasso", "match": { "synthetic": true, "lat": 41.88385, "lon": -87.63008, "radius": 10 }, "crowns": [],
  "landmark": { "type": "picasso", "heightM": 15.2, "facingBearing": 180 },
  "aliases": ["Chicago Picasso", "Daley Plaza"], "beacon": { "lat": 41.88385, "lon": -87.63008, "y": 22 }, "sources": ["https://en.wikipedia.org/wiki/Chicago_Picasso"] },
{ "key": "flamingo", "name": "Flamingo", "match": { "synthetic": true, "lat": 41.8793, "lon": -87.62985, "radius": 14 }, "crowns": [],
  "landmark": { "type": "flamingo", "heightM": 16.2 },
  "aliases": ["Calder Flamingo", "Federal Plaza"], "beacon": { "lat": 41.8793, "lon": -87.62985, "y": 23 }, "sources": ["https://en.wikipedia.org/wiki/Flamingo_(sculpture)"] },
{ "key": "culturalcenter", "name": "Chicago Cultural Center", "match": { "osmId": 15899437 }, "heightM": 30, "crowns": [],
  "landmark": { "type": "culturalCenter", "domes": [{ "at": { "lat": 41.88361, "lon": -87.62498 }, "r": 5.8, "kind": "tiffany" }, { "at": { "lat": 41.88415, "lon": -87.62498 }, "r": 6.1, "kind": "healy-millet" }] },
  "aliases": ["Cultural Center", "Tiffany dome", "Preston Bradley Hall"], "beacon": { "lat": 41.88388, "lon": -87.62498, "y": 40 },
  "sources": ["https://en.wikipedia.org/wiki/Chicago_Cultural_Center", "OpenStreetMap relation 15899437"] },
{ "key": "unionstation", "name": "Union Station", "match": { "osmId": 203442440 }, "crowns": [],
  "landmark": { "type": "unionStation", "facingBearing": 90, "columns": 20, "columnH": 16, "hall": { "L": 67, "W": 30, "rise": 8 } },
  "aliases": ["Chicago Union Station", "Great Hall", "Amtrak"], "beacon": { "lat": 41.87867, "lon": -87.63983, "y": 40 },
  "sources": ["https://en.wikipedia.org/wiki/Chicago_Union_Station", "OpenStreetMap way 203442440"] }
```
In the existing `mart` entry, add:
```json
"landmark": { "type": "martRiverFace", "facingBearing": 180, "pierEvery": 6.1, "pierTop": 78 },
"beacon": { "lat": 41.88807, "lon": -87.63537, "y": 110 },
"sources": ["https://en.wikipedia.org/wiki/Merchandise_Mart", "OpenStreetMap way 28293211"]
```
Record these rulings in the ledger:
```
Ruling: Cultural Center heightM 30 (OSM has only 5 levels; the rooms are double-height). Cost if wrong: skylights a few metres off; the visual check tunes it.
Ruling: the Cultural Center domes are shown as their protective glazed skylights, which glow at night — the Tiffany glass itself is interior. Cost if wrong: less literal "dome" from outside.
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --prefix pipeline`
Expected: PASS.

- [ ] **Step 6: Build, then do the visual check with evaluate-and-revert**

Run `npm run build:world --prefix pipeline`, then:
```bash
cd app && GALLERY_DIR=../.superpowers/sdd/2026-09-29-v6-landmarks-bridges/shots GALLERY="daleyplaza:picasso-after@day,federalplaza:flamingo-after@day,culturalcenter:culturalcenter-after@night,unionstation:unionstation-after@day,martriver:martriver-after@dusk" npx playwright test e2e/gallery.spec.js
```
Poses:
- `daleyplaza`: (−140, 30, −150) → (−186, 8, −202)
- `federalplaza`: (−120, 30, 250) → (−167, 8, 303)
- `culturalcenter`: (330, 90, −300) → (237, 30, −205)
- `unionstation`: (−930, 90, 300) → (−1043, 20, 373)
- `martriver`: (−625, 45, −560) → (−625, 40, −705)

Check each against its Wikipedia photo, and log the comparison per landmark. Keep a landmark if:
- the Picasso reads as the rusty "head with wings" in front of the Daley Center;
- the Flamingo reads as red arches, not a tangle;
- the two Cultural Center skylights glow gold and blue-grey at night;
- the Union Station columns stand free of the façade;
- the Mart's piers read as vertical ribs along the river.

Revert a failing landmark in its own commit (drop its heroes entry, or for the Mart, remove its `landmark` block) and record a ledger line.

- [ ] **Step 7: Commit**

```bash
git add pipeline/lib/civic.js pipeline/data/heroes.json pipeline/tests/civic.test.js
git commit -m "feat(v6): the Picasso, Calder's Flamingo, Cultural Center skylight domes, Union Station colonnade and Great Hall, the Mart's river piers" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: P1 landmarks C — Navy Pier entrance and Grand Ballroom, the Riverwalk, Lincoln Park Zoo and Conservatory (E8)

**Files:**
- Modify: `pipeline/lib/civic.js` (append five builders, extend `CIVIC`, add `earcut` and `pointInRing` imports), `pipeline/build/build-world.js` (`osmPolys` keeps `id`; hero `match.parkOsmId`), `pipeline/data/heroes.json` (five entries), `pipeline/tests/civic.test.js` (append)

**Interfaces:**
- Consumes: Tasks 16–17; `earcut`; `pointInRing` (`geom.js`).
- Produces:
  - builder types `headhouse`, `ballroom`, `riverwalk`, `lionHouse`, `glasshouse`
  - hero match `{ parkOsmId: number }`, which turns an OSM park polygon into a landmark footprint (the Riverwalk)
  - `osmPolys()` items gain `id`

- [ ] **Step 1: Write the failing tests (append to `pipeline/tests/civic.test.js`)**

```js
describe('Navy Pier, the Riverwalk, the Zoo and Conservatory', () => {
  it('Navy Pier Headhouse: twin brick towers with tiled roofs flank the west entrance', () => {
    const r = buildLandmark(box(1500, -1110, 1600, -1045, 18), { type: 'headhouse', facingBearing: 270, towerH: 30 })
    const towers = r.meshes.filter((m) => m.part === 'tower')
    expect(towers).toHaveLength(2); expect(towers[0].style).toBe('navy-pier-brick')
    expect(ymax(r.meshes.filter((m) => m.part === 'tower-roof'))).toBeCloseTo(36)
    expect(Math.max(...pts(towers).map((q) => q[0]))).toBeLessThan(1512)   // at the west end
  })
  it('Grand Ballroom: the 100 ft (30.5 m) dome with a lantern', () => {
    const r = buildLandmark(box(2329, -1120, 2393, -1060, 14), { type: 'ballroom', domeR: 15.2 })
    const dome = pts(r.meshes.filter((m) => m.part === 'dome'))
    expect(Math.max(...dome.map((q) => q[1]))).toBeCloseTo(14 + 3 + 15.2, 0)
    expect(r.meshes.some((m) => m.part === 'lantern')).toBe(true)
  })
  it('Riverwalk: granite paving, railings only along the river, the River Theater steps', () => {
    const b = { id: 'p', polygons: [{ outer: [[0, 0], [100, 0], [100, 20], [0, 20]], holes: [] }], centroid: [50, 10], height: 0 }
    const r = buildLandmark(b, { type: 'riverwalk', riverFacing: [[0, -1]], theater: { at: ll([40, 8]), bearing: 180, w: 20, steps: 5 } })
    const rail = pts(r.meshes.filter((m) => m.part === 'railing'))
    expect(rail.length).toBeGreaterThan(0)
    expect(rail.every((q) => Math.abs(q[2]) < 0.2)).toBe(true)          // only the north (river) edge
    expect(ymax(r.meshes.filter((m) => m.part === 'river-theater'))).toBeCloseTo(0.16 + 0.45 * 5)
  })
  it('Lion House: a hipped tile roof; Conservatory: the 50 ft glass palm house and vaulted wings', () => {
    const lh = buildLandmark(box(-489, -4377, -423, -4352, 11), { type: 'lionHouse', roofRise: 5 })
    expect(ymax(lh.meshes)).toBeCloseTo(16)
    const gh = buildLandmark(box(-643, -4770, -553, -4642, 10), { type: 'glasshouse', domeR: 9 })
    expect(gh.replace).toBe(true)
    expect(ymax(gh.meshes.filter((m) => m.part === 'palm-dome'))).toBeCloseTo(15)
    expect(gh.meshes.filter((m) => m.part === 'wing-vault')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --prefix pipeline -- tests/civic.test.js`
Expected: FAIL — `unknown landmark type: headhouse`.

- [ ] **Step 3: Implement (append to `civic.js`, before `CIVIC`)**

Add `import earcut from 'earcut'` and `import { pointInRing } from './geom.js'`; add `tri` and `len2` to the meshkit import.
```js
// ── Navy Pier (1916) ─ https://en.wikipedia.org/wiki/Navy_Pier — the Headhouse's twin towers at the entrance,
// and the Aon Grand Ballroom's 100 ft (30.5 m) dome at the east end.
function headhouse(b, spec) {
  const f = bearing(spec.facingBearing ?? 270), { c, face, side, o0, o1 } = faceOf(b, f), H = spec.towerH ?? 30, out = []
  for (const o of [o0 + 4, o1 - 4]) {
    const at = add2(add2(c, mul2(f, face - 3.5)), mul2(side, o))
    out.push(P(slab(mesh(), at, f, 7, 7, 0, H), F.stone, 'navy-pier-brick', 'tower'))
    out.push(P(pyramid({ ring: rectRing(at, f, 7.8, 7.8), base: H, top: H + 6 }), F.roofing, null, 'tower-roof', 0.85))   // terracotta tile
  }
  out.push(P(slab(mesh(), add2(add2(c, mul2(f, face + 0.5)), mul2(side, (o0 + o1) / 2)), f, 1, Math.max(4, o1 - o0 - 16), 6, 14), F.stone, 'navy-pier-brick', 'gateway'))
  return { meshes: out, runtime: { plazas: [{ key: 'navypier', c: add2(c, mul2(f, face + 25)), r: 22, avoid: [] }] } }
}
function ballroom(b, spec) {
  const { c } = obOf(b), top = b.height, r = spec.domeR ?? 15.2
  return { meshes: [
    P(drum({ at: c, base: top - 0.5, top: top + 3, r: r * 1.04, sides: 32 }), F.stone, 'navy-pier-brick', 'drum'),
    P(lathe(c, top + 3, r, DOME, 32), F.stone, 'ballroom-dome', 'dome'),
    P(drum({ at: c, base: top + 3 + r * 0.97, top: top + 3 + r + 2.5, r: r * 0.12, sides: 12 }), F.stone, 'ballroom-dome', 'lantern'),
  ] }
}

// ── Chicago Riverwalk ─ https://en.wikipedia.org/wiki/Chicago_Riverwalk — granite walk along the south bank with
// its "rooms"; the River Theater's seating steps. (The flat world cannot show its drop below Wacker Drive.)
function riverwalk(b, spec) {
  const ring = b.polygons[0].outer, y = spec.y ?? 0.16, meshes = [], flat = ring.flat(), t = earcut(flat, undefined, 2), pave = mesh()
  for (let i = 0; i < t.length; i += 3) {
    const v = [t[i], t[i + 1], t[i + 2]]
    tri(pave, ...v.map((k) => [flat[2 * k], y, flat[2 * k + 1]]), [0, 1, 0], ...v.map((k) => [flat[2 * k], flat[2 * k + 1]]))
  }
  meshes.push(P(pave, F.stone, 'riverwalk-granite', 'paving'))
  const rail = mesh(), facing = (spec.riverFacing ?? [[0, -1]]).map(norm2)
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c2 = ring[(i + 1) % ring.length], e = sub2(c2, a), L = len2(e)
    if (L < 1) continue
    let n = norm2(left(e))
    if (pointInRing(add2(mul2(add2(a, c2), 0.5), mul2(n, 0.5)), ring)) n = mul2(n, -1)   // point out of the walk
    if (!facing.some((d) => dot2(n, d) > 0.7)) continue
    const k = Math.max(1, Math.round(L / 3))
    for (let j = 0; j <= k; j++) { const p = add2(a, mul2(e, j / k)); tube(rail, at3(p, y), at3(p, y + 1.1), 0.05, 4) }
    tube(rail, at3(a, y + 1.1), at3(c2, y + 1.1), 0.05, 4)
  }
  meshes.push(P(rail, F.steel, 'lamp-post-black', 'railing'))
  if (spec.theater) {
    const at = local(spec.theater.at), f = bearing(spec.theater.bearing ?? 180), steps = mesh()
    for (let k = 0; k < (spec.theater.steps ?? 5); k++) slab(steps, add2(at, mul2(f, k * 1.2)), f, 1.2, spec.theater.w ?? 30, y, y + 0.45 * (k + 1))
    meshes.push(P(steps, F.stone, 'riverwalk-granite', 'river-theater'))
  }
  return { replace: true, pieces: [], meshes }
}

// ── Lincoln Park Zoo ─ https://en.wikipedia.org/wiki/Lincoln_Park_Zoo — the Kovler Lion House (1912), brick under a
// hipped tile roof. Lincoln Park Conservatory (1895) ─ https://en.wikipedia.org/wiki/Lincoln_Park_Conservatory —
// the glass Palm House dome (50 ft) and its vaulted wings.
function lionHouse(b, spec) {
  const { c, u, L, W } = obOf(b)
  return { meshes: [P(pyramid({ ring: rectRing(c, u, L + 1.2, W + 1.2), base: b.height, top: b.height + (spec.roofRise ?? 5) }), F.roofing, null, 'roof', 0.85)] }
}
function glasshouse(b, spec) {
  const { c, u, L, W } = obOf(b), r = spec.domeR ?? 9, glass = (m, part) => P(m, F.wall, 'conservatory-glass', part, 0.35)
  const meshes = [glass(drum({ at: c, base: 0, top: 6, r, sides: 24 }), 'palm-house'), glass(lathe(c, 6, r, DOME, 24), 'palm-dome')]
  const wingL = Math.max(6, (L - 2 * r) / 2), wingW = Math.min(W, 14)
  for (const s of [-1, 1]) {
    const at = add2(c, mul2(u, s * (r + wingL / 2)))
    meshes.push(glass(slab(mesh(), at, u, wingL, wingW, 0, 4), 'wing'), glass(barrel(at, u, wingL, wingW, 4, 5), 'wing-vault'))
  }
  return { replace: true, pieces: [], meshes }
}
```
Change `CIVIC` to:
```js
export const CIVIC = { crownFountain, lurie, bpBridge, artInstitute, picasso, flamingo, culturalCenter, unionStation, martRiverFace, headhouse, ballroom, riverwalk, lionHouse, glasshouse }
```
In the lion-house test the roof top is `b.height + roofRise` = 11 + 5 = 16. In the headhouse test the west face is x = 1500 and the towers sit 3.5 m inside it (their max x ≈ 1507), so `< 1512` holds.

- [ ] **Step 4: `build-world.js` — let a park polygon be a landmark footprint**

(a) In `osmPolys`, keep the id: add `id: el.id` to both `out.push({ … })` objects.

(b) Move `const greens = osmPolys(uniq(chunks('parks')))` from the "Ground sources" block to just before `// ── Heroes + pieces`. Delete the original line; `parks`, `beaches` and `pitches` keep deriving from `greens` where they are.

(c) After the synthetic-hero loop, add:
```js
  // landmarks OSM maps as parks (the Riverwalk) get their park polygon as a footprint
  for (const h of heroes.filter((x) => x.match.parkOsmId)) {
    const p = greens.find((g) => g.id === h.match.parkOsmId)
    if (!p) throw new Error(`hero park not found in OSM data: ${h.name} (${h.match.parkOsmId})`)
    const b = { id: `p-${h.key}`, osmId: null, source: 'park', tags: {}, name: h.name, address: null, stories: null, year: null, polygons: [{ outer: p.outer, holes: p.holes }], area: Math.abs(signedArea(p.outer)), centroid: ringCentroid(p.outer), bbox: p.bbox, height: 0, heightSource: 'default', parts: null }
    buildings.push(b); heroFor.set(b, h)
  }
```
Change the next loop's filter to `heroes.filter((x) => !x.match.synthetic && !x.match.parkOsmId)`.

- [ ] **Step 5: Register them in `heroes.json`**

Append:
```json
{ "key": "navypier", "name": "Navy Pier", "match": { "osmId": 752899916 }, "heightM": 18, "crowns": [],
  "landmark": { "type": "headhouse", "facingBearing": 270, "towerH": 30 },
  "aliases": ["Navy Pier entrance", "Headhouse", "Family Pavilion"], "beacon": { "lat": 41.89174, "lon": -87.60953, "y": 44 },
  "sources": ["https://en.wikipedia.org/wiki/Navy_Pier", "OpenStreetMap way 752899916"] },
{ "key": "grandballroom", "name": "Aon Grand Ballroom", "match": { "osmId": 151989533 }, "heightM": 14, "crowns": [],
  "landmark": { "type": "ballroom", "domeR": 15.2 },
  "aliases": ["Grand Ballroom", "Navy Pier ballroom", "Navy Pier dome"], "beacon": { "lat": 41.8918, "lon": -87.6006, "y": 42 },
  "sources": ["https://en.wikipedia.org/wiki/Navy_Pier", "OpenStreetMap way 151989533"] },
{ "key": "riverwalk", "name": "Chicago Riverwalk", "match": { "parkOsmId": 504093803 }, "crowns": [],
  "landmark": { "type": "riverwalk", "riverFacing": [[0, -1], [-1, 0]], "theater": { "at": { "lat": 41.88712, "lon": -87.63182 }, "bearing": 180, "w": 30, "steps": 5 } },
  "aliases": ["Riverwalk", "River Theater"], "beacon": { "lat": 41.88712, "lon": -87.63182, "y": 10 },
  "sources": ["https://en.wikipedia.org/wiki/Chicago_Riverwalk", "OpenStreetMap way 504093803"] },
{ "key": "lincolnparkzoo", "name": "Lincoln Park Zoo", "match": { "osmId": 210686223 }, "heightM": 11, "facade": "prewar-brick", "crowns": [],
  "landmark": { "type": "lionHouse", "roofRise": 5 },
  "aliases": ["zoo", "Kovler Lion House", "Lion House"], "beacon": { "lat": 41.9211, "lon": -87.6333, "y": 24 },
  "sources": ["https://en.wikipedia.org/wiki/Lincoln_Park_Zoo", "OpenStreetMap way 210686223"] },
{ "key": "conservatory", "name": "Lincoln Park Conservatory", "match": { "osmId": 23986733 }, "crowns": [],
  "landmark": { "type": "glasshouse", "domeR": 9 },
  "aliases": ["Conservatory", "palm house"], "beacon": { "lat": 41.9243, "lon": -87.6357, "y": 24 },
  "sources": ["https://en.wikipedia.org/wiki/Lincoln_Park_Conservatory", "OpenStreetMap way 23986733"] }
```
Ballroom beacon: the OSM footprint centre is (2361, −1090), which unprojects to 41.8918, −87.6006. Conservatory beacon: the centre (−598, −4706) unprojects to 41.9243, −87.6357.

Record these rulings in the ledger:
```
Ruling: Navy Pier's "entrance building" is the Family Pavilion footprint (OSM 752899916), with the Headhouse towers at 30 m. Cost if wrong: tower height is off by a few metres.
Ruling: the Riverwalk's level change below Wacker cannot be shown in a flat world; the River Theater steps rise away from the water as seating. Cost if wrong: the steps read inverted relative to reality.
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test --prefix pipeline`
Expected: PASS.

- [ ] **Step 7: Build, then do the visual check with evaluate-and-revert**

Run `npm run build:world --prefix pipeline`. Expected: `heroes applied` rises by 5 and nothing throws. Then:
```bash
cd app && GALLERY_DIR=../.superpowers/sdd/2026-09-29-v6-landmarks-bridges/shots GALLERY="navypierhead:navypier-after@day,ballroom:ballroom-after@dusk,navypier:navypier-after@night,riverwalk:riverwalk-after@day,zoo:zoo-after@day" npx playwright test e2e/gallery.spec.js
```
Poses:
- `navypierhead`: (1480, 50, −980) → (1541, 14, −1078)
- `ballroom`: (2250, 70, −960) → (2361, 20, −1090)
- `navypier`: (2700, 320, −500) → (1074, 150, −874)
- `riverwalk`: (−250, 35, −650) → (−450, 1, −592)
- `zoo`: (−380, 110, −4150) → (−560, 5, −4500)

Compare each with its reference photo and log it. Keep a landmark if:
- the twin towers frame the pier entrance;
- the ballroom dome reads from across the harbour at dusk;
- the Riverwalk shows a continuous railing only on the water side;
- the Conservatory reads as a glass palm house among the trees.

Revert failures individually in their own commits, with ledger lines.

- [ ] **Step 8: Commit**

```bash
git add pipeline/lib/civic.js pipeline/build/build-world.js pipeline/data/heroes.json pipeline/tests/civic.test.js
git commit -m "feat(v6): Navy Pier Headhouse towers and Grand Ballroom dome, the Riverwalk with its River Theater, Lincoln Park Zoo's Lion House and the Conservatory" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 19: Landmark registry — sources, ⌘K aliases and VISIT beacon anchors (E9)

**Files:**
- Modify:
  - `pipeline/lib/landmarkRuntime.js` (add `V6_LANDMARKS`, `landmarkEntry`, `validateLandmarkRegistry`)
  - `pipeline/build/build-world.js` (validate the registry and write manifest rows through `landmarkEntry`)
  - `pipeline/data/heroes.json` (`sources` + `beacon` on `buckingham` and `cloudgate`)
  - `pipeline/tests/landmarkRuntime.test.js` (append)
- Create: `app/src/lib/__tests__/landmarkSearch.test.js`

**Interfaces:**
- Consumes: `heroes.json`; `project`; `buildPlaces` and `searchPlaces` (`places.js`).
- Produces:
  - `V6_LANDMARKS` — the 16 keys in Step 1
  - `landmarkEntry(b, hero) → { key, name, aliases, x, z, top, beacon: [x, y, z] }` — the beacon is `hero.beacon` (lat/lon/y) or `[centroid, top + 6]`
  - `validateLandmarkRegistry(heroes, keys = V6_LANDMARKS) → true`. It throws one error listing every key that lacks a hero, an alias, an https source or a beacon.
  - Manifest `landmarks[]` rows gain `beacon` (Phase 4's VISIT lens consumes it).

- [ ] **Step 1: Write the failing tests**

Append to `pipeline/tests/landmarkRuntime.test.js`:
```js
import { readFileSync } from 'node:fs'
import { landmarkEntry, validateLandmarkRegistry, V6_LANDMARKS } from '../lib/landmarkRuntime.js'

describe('landmark registry (E9)', () => {
  const heroes = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes
  it('every V6 landmark is registered with an alias, a source and a beacon', () => {
    expect(V6_LANDMARKS).toHaveLength(16)
    expect(validateLandmarkRegistry(heroes)).toBe(true)
  })
  it('a missing source or beacon is named in the error', () => {
    const broken = heroes.map((h) => (h.key === 'picasso' ? { ...h, sources: [], beacon: undefined } : h))
    expect(() => validateLandmarkRegistry(broken)).toThrow(/picasso: no https source[\s\S]*picasso: no VISIT beacon/)
  })
  it('manifest rows carry the beacon anchor', () => {
    const b = { centroid: [100, 200], pieces: [{ top: 30 }], venueTop: 0, extraMeshes: [] }
    expect(landmarkEntry(b, { key: 'k', name: 'K', aliases: ['k2'] })).toEqual({ key: 'k', name: 'K', aliases: ['k2'], x: 100, z: 200, top: 30, beacon: [100, 36, 200] })
    const withBeacon = landmarkEntry(b, { key: 'k', name: 'K', beacon: { lat: 41.88203, lon: -87.62784, y: 50 } })
    expect(withBeacon.beacon).toEqual([0, 50, 0])
  })
})
```

`app/src/lib/__tests__/landmarkSearch.test.js`:
```js
import { describe, it, expect } from 'vitest'
import heroesData from '../../../../pipeline/data/heroes.json'
import { buildPlaces, searchPlaces } from '../places.js'

const V6 = ['buckingham', 'cloudgate', 'navypier', 'grandballroom', 'riverwalk', 'artinstitute', 'crownfountain', 'lurie', 'bpbridge', 'picasso', 'flamingo', 'culturalcenter', 'unionstation', 'mart', 'lincolnparkzoo', 'conservatory']
const heroes = heroesData.heroes.filter((h) => V6.includes(h.key))
const manifest = {
  landmarks: [
    ...heroes.map((h, i) => ({ key: h.key, name: h.name, aliases: h.aliases, x: i * 100, z: 0, top: 20 })),
    { key: 'bridge-dusable', name: 'DuSable Bridge', aliases: ['Michigan Avenue Bridge'], x: 287, z: -757, top: 8 },
  ],
  tallest: [],
}
const places = buildPlaces(manifest, {})

describe('⌘K finds every V6 landmark (E9)', () => {
  it('by its name, first', () => {
    expect(heroes).toHaveLength(16)
    for (const h of heroes) expect(searchPlaces(h.name.toLowerCase(), places)[0].name, h.name).toBe(h.name)
  })
  it('by each alias, in the top three', () => {
    for (const h of heroes) for (const a of h.aliases) expect(searchPlaces(a.toLowerCase(), places).slice(0, 3).map((p) => p.name), a).toContain(h.name)
  })
  it('bridges by their old names too', () => {
    expect(searchPlaces('michigan avenue bridge', places)[0].name).toBe('DuSable Bridge')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --prefix pipeline -- tests/landmarkRuntime.test.js` and `npm test --prefix app -- src/lib/__tests__/landmarkSearch.test.js`
Expected: FAIL — `landmarkEntry is not a function`. The app test fails on the `buckingham`/`cloudgate` rows only if their names or aliases are not found; otherwise it may already pass. The pipeline failure is the gate.

- [ ] **Step 3: Implement (append to `landmarkRuntime.js`)**

```js
import { project } from '../../shared/project.js'

export const V6_LANDMARKS = ['buckingham', 'cloudgate', 'navypier', 'grandballroom', 'riverwalk', 'artinstitute', 'crownfountain', 'lurie', 'bpbridge', 'picasso', 'flamingo', 'culturalcenter', 'unionstation', 'mart', 'lincolnparkzoo', 'conservatory']

export function landmarkEntry(b, hero) {
  const ys = [b.venueTop ?? 0, ...b.pieces.map((p) => p.top)]
  for (const m of b.extraMeshes ?? []) for (let i = 1; i < m.positions.length; i += 3) ys.push(m.positions[i])
  const top = Math.round(ys.reduce((a, y) => Math.max(a, y), 0))
  const [bx, bz] = hero.beacon ? project(hero.beacon.lon, hero.beacon.lat) : b.centroid
  const r = (x) => Math.round(x) + 0 // + 0 turns −0 into 0
  return { key: hero.key, name: hero.name, aliases: hero.aliases ?? [], x: r(b.centroid[0]), z: r(b.centroid[1]), top, beacon: [r(bx), r(hero.beacon?.y ?? top + 6), r(bz)] }
}

export function validateLandmarkRegistry(heroes, keys = V6_LANDMARKS) {
  const problems = []
  for (const k of keys) {
    const h = heroes.find((x) => x.key === k)
    if (!h) { problems.push(`${k}: missing from heroes.json`); continue }
    if (!h.aliases?.length) problems.push(`${k}: no ⌘K alias`)
    if (!(h.sources ?? []).some((s) => /^https:\/\//.test(s))) problems.push(`${k}: no https source`)
    if (!h.beacon || typeof h.beacon.lat !== 'number') problems.push(`${k}: no VISIT beacon anchor`)
  }
  if (problems.length) throw new Error(`landmark registry:\n  ${problems.join('\n  ')}`)
  return true
}
```
In `heroes.json`, add these to the existing entries:
- `buckingham`: `"beacon": { "lat": 41.8758, "lon": -87.61928, "y": 56 }`, `"sources": ["https://en.wikipedia.org/wiki/Buckingham_Fountain"]`
- `cloudgate`: `"beacon": { "lat": 41.88266, "lon": -87.62336, "y": 18 }`, `"sources": ["https://en.wikipedia.org/wiki/Cloud_Gate", "OpenStreetMap way 137060274"]` — the manifest position (374, −73) unprojects to this lat/lon.

In `build-world.js`:
- After loading `heroes`, call `validateLandmarkRegistry(heroes)`.
- Replace the inline hero row in the manifest `landmarks:` array with `...buildings.filter((b) => b.hero).map((b) => landmarkEntry(b, heroes.find((h) => h.key === b.hero)))`, keeping Task 7's bridge rows after it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --prefix pipeline` and `npm test --prefix app`
Expected: PASS. If an alias collides and fails the top-3 check, change that alias in `heroes.json` (not the search code) and record a `Ruling:` line.

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/landmarkRuntime.js pipeline/build/build-world.js pipeline/data/heroes.json pipeline/tests/landmarkRuntime.test.js app/src/lib/__tests__/landmarkSearch.test.js
git commit -m "feat(v6): landmark registry — every V6 landmark sourced, searchable by name and nickname, with a VISIT beacon anchor in the manifest" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 20: End of milestone — suites, build, e2e, perf, gallery, README, push

**Files:**
- Create: `app/e2e/v6-perf.spec.js`
- Modify: `README.md` (gallery section, roadmap, badges), `app/e2e/hero-view.spec.js-snapshots/*` (only the baselines V6 intentionally changes)
- Output: `docs/screenshots/v6-*.png` (new names only), `app/public/world/**`

**Interfaces:**
- Consumes: everything above; the `?stats` hook (`window.__gl`).
- Produces:
  - perf lines in the ledger: `PERF <view> calls=… tris=…M fps=…`
  - the README "V6 · Landmarks and bridges" gallery block

- [ ] **Step 1: Both unit suites green**

Run: `npm test --prefix pipeline` and then `npm test --prefix app`
Expected: PASS, both.

- [ ] **Step 2: Final world build**

Run: `npm run build:world --prefix pipeline`
Expected:
- `bridges: 32 (32 named), leaves 64`;
- `landmark runtime: fountain, cloudgate, crown; plazas 6` (Buckingham, Cloud Gate, Crown Fountain, the Picasso, the Flamingo, Navy Pier);
- `skyline: missing 0, wrong height 0`;
- no registry error;
- `du -sh app/public/world` ≤ 200 MB. Record the size in the ledger.

- [ ] **Step 3: Write the perf probe**

`app/e2e/v6-perf.spec.js`:
```js
// app/e2e/v6-perf.spec.js — draw calls, triangles and fps (averaged over 60 frames) at the budget poses.
import { test } from '@playwright/test'
const VIEWS = ['streeterville', 'loop', 'bridges', 'dusable', 'buckingham', 'cloudgate', 'crownfountain']
for (const v of VIEWS) {
  test(`perf ${v}`, async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
    await page.goto(`/?view=${v}&time=dusk&stats`)
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
    await page.waitForTimeout(6000)
    const r = await page.evaluate(() => new Promise((res) => {
      const gl = window.__gl; gl.info.autoReset = false; gl.info.reset()
      let n = 0; const t0 = performance.now()
      const tick = () => { if (++n < 60) { requestAnimationFrame(tick); return } const { calls, triangles } = gl.info.render; gl.info.autoReset = true; res({ calls: calls / n, triangles: triangles / n, fps: (n * 1000) / (performance.now() - t0) }) }
      requestAnimationFrame(tick)
    }))
    console.log(`PERF ${v} calls=${r.calls.toFixed(0)} tris=${(r.triangles / 1e6).toFixed(2)}M fps=${r.fps.toFixed(0)}`)
  })
}
```
Run: `cd app && npx playwright test e2e/v6-perf.spec.js --reporter=line`
Expected:
- every `PERF` line shows calls ≤ 900 and tris ≤ 4.00 M;
- at `streeterville` and `loop`, calls are no more than 12 above the pre-V6 figure in the V5 ledger.

Copy the lines into the ledger. If a budget is exceeded, apply the LOW-safe mitigations in this order, and record each as a `Ruling:`:
1. drop plaza people to 600;
2. halve the fountain particles;
3. raise the Cloud Gate cube period to 60.

- [ ] **Step 4: e2e — regenerate only what V6 changed, then 3 green runs**

Run: `cd app && npx playwright test e2e/hero-view.spec.js --update-snapshots -g "river|museum|loop|navypier|streeterville"`
Review each updated baseline image. The only changes should be:
- bridges on the river;
- the fountain and plume at Museum Campus;
- the Bean, Crown Fountain and Pritzker area in the Loop;
- the Navy Pier towers and dome;
- the lakeshore bridge.

Record any other difference in the ledger and fix it before continuing.
Then run `npx playwright test e2e/hero-view.spec.js` three times in a row. Expected: `10 passed` each time.

- [ ] **Step 5: Gallery images (new names only) and the README**

```bash
cd app && GALLERY_MILESTONE=v6 GALLERY="river:bridges-after@day,river:bridges-after@dusk,river:bridges-after@night,dusable:dusable@dusk,buckingham:buckingham@night,cloudgate:cloudgate@day,crownfountain:crownfountain@night" npx playwright test e2e/gallery.spec.js
```
Expected: `7 passed`. `galleryShots.js` refuses to overwrite any existing file.

In `README.md`, after the last gallery section, append:
```html
### V6 · Landmarks and bridges — *bascules, Buckingham, the Bean, the civic icons*

<table>
<tr>
<td width="50%"><img src="docs/screenshots/v6-bridges-before-dusk.png" alt="V6 — the river bridges before the detail work" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v6-bridges-after-dusk.png" alt="V6 — the river bridges as Chicago-type trunnion bascules" width="100%"/></td>
</tr>
<tr>
<td><em>Before: the river bridges were flat road ribbons over the water.</em></td>
<td><em>After: 32 named bascules — grid decks, lattice railings, tender houses, lanterns and navigation lights.</em></td>
</tr>
<tr>
<td><img src="docs/screenshots/v6-dusable-dusk.png" alt="V6 — the DuSable Bridge with its four bridgehouses" width="100%"/></td>
<td><img src="docs/screenshots/v6-buckingham-night.png" alt="V6 — Buckingham Fountain's evening water show" width="100%"/></td>
</tr>
<tr>
<td><em>The DuSable Bridge: four Bedford-stone bridgehouses with their 1928 reliefs, balustrades and a double deck.</em></td>
<td><em>Buckingham Fountain in pink marble with eight bronze seahorses; the 46 m jet plays on the real hourly schedule, lit in colour after dusk.</em></td>
</tr>
<tr>
<td><img src="docs/screenshots/v6-cloudgate-day.png" alt="V6 — Cloud Gate mirroring the skyline" width="100%"/></td>
<td><img src="docs/screenshots/v6-crownfountain-night.png" alt="V6 — Crown Fountain's faces at night" width="100%"/></td>
</tr>
<tr>
<td><em>Cloud Gate at its true 20 × 13 × 10 m shape, mirroring the live sky and Michigan Avenue.</em></td>
<td><em>Crown Fountain's faces pucker and spout on their five-minute cycle.</em></td>
</tr>
</table>
```
Also update the README:
- the Roadmap: mark V6 done;
- the Controls table: add `B — raise the river bridges` and `J — Buckingham water show`;
- the `landmarks` badge count: set it to the new `manifest.landmarks.length`, read with `node -e "console.log(require('./app/public/world/manifest.json').landmarks.length)"`.

- [ ] **Step 6: Final evaluate-and-revert pass**

Open the seven gallery images next to the Task 1 `*-before-*` shots. For any image that looks worse than before, revert the responsible task commit, re-run Steps 2–5 for it, and record `Reverted:` in the ledger. Never replace an image that is already committed; a re-shot gets a new subject name (for example `dusable-v2`).

- [ ] **Step 7: Commit and push**

```bash
git add app/public/world app/e2e/v6-perf.spec.js app/e2e/hero-view.spec.js-snapshots docs/screenshots/v6-*.png README.md
git commit -m "feat(v6): landmarks and bridges — world build, baselines, perf log, README gallery" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push origin main
```
Expected: the push succeeds to AllStreets/Chicago-Open-World `main`. Record the pushed SHA in the ledger.

---

## Rulings made while writing this plan

- Ruling: the Michigan Avenue (DuSable) bridge is at (287, −757), from OSM ways 748858713/4 and 48785128/133751333, not the brief's ≈ (150, −520). All poses use the OSM value. Cost if wrong: none; the OSM data is authoritative here.
- Ruling: B.5's "~27 m tiered form" is the pre-V6 builder's 27.4 m lower basin. V6 uses the sourced 31 m lower basin, with the upper lip 7.6 m above the lower water. Cost if wrong: one number in `FOUNTAIN`.
- Ruling: shows run on the hour from 08:00 through 22:00 (the last at 10 pm), for 20 minutes each, in a season of May 1–Oct 15 ("early May–mid-October"). Cost if wrong: a show a few days or an hour off at the edges.
- Ruling: the world is flat, so decks stay at street level and trusses, girders and counterweights hang hidden beneath the water plane until a leaf lifts. Cost if wrong: no under-bridge clearance in river-level close-ups.
- Ruling: bridge detection claims every OSM movable way (bascule) near a `bridges.json` entry. All claimed ribbons, plus parallel approaches over the tail, are cut, so each crossing draws exactly one deck. Cost if wrong: a stray ribbon, caught by the Task 7 visual and tests.
- Ruling: the St. Charles Air Line, Freeport and Blue Island rail bascules and the Amtrak vertical lift are out of scope (`skipWays`, and `lift` is excluded). Cost if wrong: four rail crossings stay flat ribbons until Phase 3.
- Ruling: leaves live in one new tile layer, `leaves` (≤ 8 extra draw calls), rotated in the vertex shader from a float texture. Raised leaves cast no shadow. Cost if wrong: a missing shadow during the easter egg.
- Ruling: Wells, Lake (the L on top) and Congress (fixed in place) never lift, because V3's track and glow meshes would float. Cost if wrong: two real boat-run lifts are not shown.
- Ruling: the boat-run schedule is spring (Apr–Jun) and fall (Sep–Nov), Wednesdays 09:30 and Saturdays 08:00, bridges staggered 150 s. B plays a compressed 4-minute demo. Cost if wrong: scheduled lifts start at slightly wrong times.
- Ruling: DuSable relief corners are NE "The Discoverers" and NW "The Pioneers" (Fraser; sourced), and SW "Defense", SE "Regeneration" (Hering). The south pair's corners are unverified. Cost if wrong: two relief panels swapped.
- Ruling: seahorse pairs sit on the pool diagonals (45°, 135°, 225°, 315°), facing out, with jets arcing inward. Cost if wrong: the pairs are rotated 45°.
- Ruling: 49 modelled emitters stand in for Buckingham's 193 jets (centre, 8 seahorses, 16 upper ring, 24 lower ring). Cost if wrong: less jet density up close.
- Ruling: Cloud Gate becomes a detached `.glb` with its own cube-camera mirror (+1 draw; one 128 px face per frame on 6 of every 30 frames, only at HIGH/ULTRA within 1.5 km). Cost if wrong: a small periodic render cost, measured in Task 20.
- Ruling: Crown Fountain faces are procedural (no real likeness) and driven by the sourced 5-minute cycle. Cost if wrong: less photographic faces.
- Ruling: the Cultural Center "domes" are shown as their glowing protective skylights; the Tiffany glass is interior. Cost if wrong: less literal from outside.
- Ruling: the Riverwalk's drop below Wacker cannot show in a flat world; the River Theater steps rise away from the water. Cost if wrong: the steps read inverted.
- Ruling: the BP Bridge path is hand-placed between the park edges (no footway in the cache). Cost if wrong: it lands a few metres off; Phase 3 can refetch.
- Ruling: `_STYLE` names follow the V2 contract, as recorded in the Task 1 ledger mapping (`styleIndex`, `styleBase`, `vStyle`, the `appendBuilding` style argument). This plan's code uses those assumed names. Cost if wrong: a mechanical rename in Tasks 3, 7 and 16–18.
- Ruling: the E10 image is `docs/screenshots/v6-bridges-before-{day,dusk,night}.png` (master-plan naming), not `vision-bridges-before.png`. Cost if wrong: a rename.
- Ruling: the world build output (`app/public/world`) is committed once, in Task 20; intermediate builds stay local. Cost if wrong: intermediate commits can't be rendered without a rebuild.
