# Phase 4 — Guide Lenses, Places and Transit Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Later-phase plan (master-plan ruling, 2026-09-29).** This plan is written at task, interface and test level. Code-level implementation steps are completed at phase start, because they depend on what V1–V8 and Phase 3 actually shipped. Every task carries a **Refresh at phase start** note. Do that refresh first, edit this plan in place, then execute.

**Goal:** Turn the city into a guide. It gets hover tooltips and building cards; a places layer (bars, restaurants, venues and everything else) as rooftop-anchored pins with filters; and the three lenses. VISIT has beacons, landmark cards and three tours. LIVE has neighbourhood zones, profiles and feel scores. WORK has the commute model, isochrones and L lines that brighten by usefulness. Transit is woven through every card, as nearest-L data and alert pulses on the lines.

**Architecture:**
- **State.** One zustand store gains `lens`, `selection`, `office`, `poiCats`, `placesOn` and `tour`. The HUD (DOM) and the world (R3F) both subscribe to it.
- **Build time.** The pipeline adds OSM amenities (per-tile sidecar `pois`, anchored to the roof of their containing building) and neighbourhood zones with feel scores (`neighborhoods.json`).
- **Runtime.** Everything is pure libraries under `app/src/lib/` plus thin components. The CHI ATLAS API is used opportunistically through `chiGet`, which returns `null` on any failure. Phase 5 adds the probe, the status chip and the polling scheduler.
- **Picking.** Picking reads V1's unique `_BLDG` through `three-mesh-bvh` raycasts on LOD0 and LOD1 tiles.
- **Draw calls.** Each lens adds at most 4 draw calls, and labels are one DOM layer.

**Tech Stack:** React 19, R3F 9, drei 10, zustand 5, three 0.186, Vitest 5 + RTL. New dependency: `three-mesh-bvh` (pinned exact version at phase start). Pipeline: Overpass (cached), City of Chicago Socrata `y6yq-dbs2` (neighbourhood boundaries) and `igwz-8jzy` (community areas).

**Spec:** `docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md`: §8 HUD (the lens rail, the context panel, hover, ⌘K), §9 Lenses, §6 DIVE and TOUR, §12 Testing (commute model), Addendum B.1 (standing rules) and B.3 (transit controls). Backlog: I-4.1–I-4.6, C17, H7. Master plan: the P4 row.

## Global Constraints

- **Human-first (B.1.4).** Every feature has a visible button, a ⌘K entry and a help-card line. Lenses have **no single-letter keys**, because W is taken by movement. They are reached by lens-rail buttons and ⌘K. URL parameters are for tests only.
- **Budgets (B.1.6).**
  - HIGH ≤ 900 draw calls per frame at the wide Streeterville and Loop poses; this phase adds ≤ 4 at any moment.
  - ≤ 4 M triangles; 60 fps on M-series.
  - Every overlay has a LOW fallback: fewer pins, no zone glow animation, isochrone shells without animation.
- **Live data (B.1.5).**
  - All runtime calls go through the CHI ATLAS API (`VITE_CHI_API_URL`).
  - A failed call returns `null` and the feature quietly uses its build-time or simulated data.
  - No error UI.
- **CHI endpoints used (verified against `~/Downloads/chi/backend`):**
  - `GET /api/places?type=all|nightlife_all|restaurants|bars|cafes|…` → `{ places: [{ id, name, amenity, categories[], rating, price, neighborhood, address, lat, lon, distance, url }] }`. OSM-backed, ≤ 150 per call, cached 6 h server-side.
  - `GET /api/cta/stations` → `{ stations: [{ mapId, name, lines: ['Red','Blue','Brn','G','Org','P','Pink','Y'], lat, lon }] }`
  - `GET /api/cta/alerts` → `{ alerts: [{ id, headline, impact, affected: string[] }] }`
  - `GET /api/neighborhoods` → `[{ id, name, tagline, vibe[], walkScore, transitScore, avgRent, commute, topSpots[], description }]` (14 hoods, several outside the bounds)
  - `GET /api/neighborhoods/boundaries` → GeoJSON FeatureCollection (the official `y6yq-dbs2` polygons, with a hard-coded fallback)
  - `GET /api/finance/rents` → `[{ neighborhood, avgRent, trend, yoy }]` (static, indicative)
  - CHI has **no jobs endpoint**. WORK does not depend on one (see Rulings).
- **Line ids.** The app uses `red, blue, brown, green, orange, pink, purple, yellow` (V3). CHI codes `Red, Blue, Brn, G, Org, Pink, P, Y` map through `CHI_LINE` (Task 2).
- **Commute model (spec §9, verbatim):** `walk(origin → nearest station, 80 m/min) + ride(along line geometry, 30 km/h avg, +4 min per transfer, ≤ 1 transfer) + walk(station → destination)`; also a straight walk if shorter. Label: `ESTIMATE · simplified transit model`.
- Design: CHI tokens and HUD primitives only (`.hud-panel`, `.hud-pill`, `.hud-chip`, `.hud-kbd`); Remix icons; **no emojis**.
- **README gallery only appends:** `docs/screenshots/p4-<subject>-<time>.png`.
- Ledger: `.superpowers/sdd/2026-09-29-phase-4-guide-lenses/progress.md`. Push to `origin main` after each task that changes the world build, and at the end of the phase.

## Review Focus

1. **Hovering over non-building surfaces, or while dragging or flying.** Water, roads, blocks and LOD1-only far tiles must show no tooltip and must not throw. Hover is suppressed during a drag, a flight or a tour, so it never flickers. This is pinned in Task 3 (`bldgIndexFromHit` returns `null` for meshes with no `_bldg`; the `Picker` suppression test).
2. **POIs with no name, duplicate OSM nodes and ways for the same venue, or a POI inside a courtyard hole.** A reasonable person expects one pin per venue, never an unnamed pin, and a courtyard café anchored at ground level, not on the roof. This is pinned in Task 4 (unnamed returns `null`, dedupe by name + 25 m, the hole-aware anchor test).
3. **Setting an office in the lake, outside the world, or on a spot with no station within walking distance.** The commute must fall back to a walking estimate, or say "No L within walking distance", and never produce NaN or Infinity minutes. This is pinned in Task 8 (the `commuteMinutes` edge-case tests).
4. **The CHI API being slow, CORS-blocked or returning an unexpected shape.** Each lens must render from build-time data within the same frame budget, with no error UI and no unhandled promise rejection. This is pinned in Task 1 (`chiGet` timeout, non-JSON and malformed tests) and Task 5 (`mergeLivePlaces` with malformed input).
5. **Many labels crowding one spot (the Loop at 1 km altitude).** Labels must not overlap into an unreadable pile, and the nearest or most important must win. This is pinned in Task 6 (the `beaconLayout` collision and priority tests; the same function lays out pin and zone labels).

---

## Upstream contracts assumed (verify at phase start)

| Symbol | From | Assumed shape | Refresh check |
|---|---|---|---|
| `_BLDG` unique per tile file, LOD0 and LOD1 sharing indices with the sidecar `buildings[]` | V1 (H7) | glTF attribute `_BLDG` → three attribute `_bldg` (lowercase, as `_LAYER` → `_layer` today) | `grep -rn "_bldg\|_BLDG" app/src pipeline/build` |
| Tile sidecar `tiles/<key>.json` | 2.5 + V1–V6 | `{ buildings: [{ id, name, address, stories, year, height, hero }], trees, props, columns, … }` | `jq 'keys' app/public/world/tiles/<any>.json` |
| `transit.json` | V3 | `{ lines: [{ id, name, color, kind: 'cta'|'metra', paths: [{ id, dir, points: [[x,z]…] }], stations: [stationId…] }], stations: [{ id, mapId, name, x, z, y, lines: [lineId…] }] }` | `jq '.lines[0] | keys, .stations[0]' app/public/world/transit.json` |
| Line glow material with per-line controls | V3 (C3) | per-line index `LINE_INDEX[lineId]`, one ribbon material per tile set; this plan adds `uLineGain[16]` and `uLinePulse[16]` if they are missing | `grep -rn "uNight\|LINE_INDEX" app/src/transit` |
| Station and train cards (C16) | V4 | `selection.kind === 'station' | 'train'` renders in V4's panel | read V4's card component |
| `clearanceAt(x, z) → metres` | V1 (G1) | maximum roof height near (x, z); flights add their margin | `grep -rn "clearanceAt" app/src` |
| `startFlight(pose, label)` | Phase 2 | exists in `store.js` | unchanged |
| Manifest `landmarks[]` with `beacon` | 2.5 + V6 + P3 | `{ key, name, aliases, x, z, top, beacon?: [x, y, z] }` | `jq '.landmarks[0]'` |
| Keys already taken | Phases 1–2.5, V3–V7 | arrows, WASD, Shift, Q/E, R/F, PgUp/PgDn, +/−, N, O, H, [ ], ?, /, 1–5, Esc, ⌘K/Ctrl+K, plus whatever V3–V7 added (T? M? P?) | read `HelpOverlay.jsx` GROUPS after V7 |

---

## File Structure

```
pipeline/
  lib/sources.js                  (modify) overpass kind 'pois'
  lib/pois.js                     (create) POI_CATEGORIES, poiCategory(tags), poiRecord(el), dedupePois(list), anchorPoi(poi, index)
  lib/feel.js                     (create) feelScores(zones) → 0–10 walk/transit/nightlife/green/quiet
  fetch/fetch-pois.js             (create) chunked Overpass fetch → cache/world/osm-pois-*.json
  build/build-world.js            (modify) per-tile sidecar `pois`, public/world/pois-index.json
  build/build-neighborhoods.js    (create) boundaries + curated profiles + feel → public/world/neighborhoods.json
  data/neighborhoods.curated.json (create) ~20 zones: character, vibe, rents with source+asOf, CHI ids
  tests/pois.test.js, tests/feel.test.js, tests/neighborhoods.test.js (create)
app/src/
  services/chiApi.js              (create) chiBase(), chiGet(path, opts)
  state/store.js                  (modify) lens, selection, office, poiCats, placesOn, tour
  lib/picking.js                  (create) bldgIndexFromHit, buildingInfo, tooltipLines
  lib/nearestTransit.js           (create) CHI_LINE, nearestStations, linesNear, WALK_M_PER_MIN
  lib/alerts.js                   (create) alertsToLinePulses, SEVERITY
  lib/poiFilter.js                (create) filterPois, mergeLivePlaces
  lib/labels.js                   (create) beaconLayout (used by beacons, pins, zones)
  lib/tour.js                     (create) tourDuration, tourAt
  lib/neighborhoods.js            (create) zoneAt, rentRangeLabel, scoreBars
  lib/commute.js                  (create) buildCommuteGraph, commuteMinutes, stationMinutesTo, isochroneGrid, lineUsefulness, rankZones
  lib/grid.js                     (modify) parseGridAddress(query) → { x, z, label } | null
  transit/lineEmphasis.js         (create) setLineGain, setLinePulse, resetLineEmphasis (drives V3 glow uniforms)
  data/landmarks.js               (create) CHI's 32 curated landmarks (name, category, lat, lon, desc, tip)
  data/tours.json                 (create) 3 tours
  world/Picker.jsx                (create) hover/click raycast (three-mesh-bvh), throttled
  world/PoiPins.jsx               (create) one InstancedMesh of billboard pins
  world/Beacons.jsx               (create) one InstancedMesh of light pillars
  world/NeighborhoodZones.jsx     (create) one merged glow mesh
  world/Isochrones.jsx            (create) one ground overlay (DataTexture of minutes)
  world/WorldLabels.jsx           (create) one DOM label layer, positioned per frame
  camera/TourPlayer.jsx           (create)
  hud/LensRail.jsx, hud/LensRail.css (create) left-edge VISIT / LIVE / WORK
  hud/ContextPanel.jsx, hud/ContextPanel.css (create) right slide-in panel host
  hud/BuildingTooltip.jsx         (create)
  hud/cards/BuildingCard.jsx, LandmarkCard.jsx, PoiCard.jsx, NeighborhoodCard.jsx, NearestL.jsx (create)
  hud/panels/VisitPanel.jsx, LivePanel.jsx, WorkPanel.jsx, PoiFilters.jsx (create)
  hud/TourBar.jsx                 (create)
  hud/CommandPalette.jsx          (modify) Lens, Places, Tours, Office commands; address rows
  hud/ControlDock.jsx             (modify) Places toggle
  hud/HelpOverlay.jsx, hud/HintBar.jsx (modify) Guide group
  hud/Hud.jsx                     (modify) mount LensRail, ContextPanel, BuildingTooltip, TourBar
  world/Scene.jsx                 (modify) mount Picker, PoiPins, Beacons, NeighborhoodZones, Isochrones, WorldLabels, TourPlayer
  */__tests__/*.test.js(x)        (create per task)
```

---

### Task 1: Lens state, lens rail, context panel shell and `chiGet`

**Files:**
- Create: `app/src/services/chiApi.js`, `app/src/hud/LensRail.jsx`, `app/src/hud/LensRail.css`, `app/src/hud/ContextPanel.jsx`, `app/src/hud/ContextPanel.css`
- Modify: `app/src/state/store.js`, `app/src/hud/Hud.jsx`, `app/src/hud/CommandPalette.jsx`, `app/src/hud/HelpOverlay.jsx`
- Test: `app/src/services/__tests__/chiApi.test.js`, `app/src/hud/__tests__/lens.test.jsx`, `app/src/state/__tests__/store.test.js` (append)

**Interfaces:**
- Produces:
  - Store: `lens: null | 'VISIT' | 'LIVE' | 'WORK'`; `setLens(l)` (setting the active lens again turns it off); `selection: null | { kind: 'building'|'landmark'|'poi'|'neighborhood'|'station'|'train'|'office', id: string, data?: object }`; `select(sel)`; `clearSelection()`; `office: null | { x, z, label }`; `setOffice(o)`; `poiCats: string[]` (default all); `setPoiCats(c)`; `placesOn: boolean` (default `false`; VISIT turns pins on regardless); `setPlacesOn(b)`; `tour: null | { id, t: number, playing: boolean }`; `setTour(t)`.
  - `chiBase(env = import.meta.env) → string` returns `VITE_CHI_API_URL`, or `''` when unset. An empty base means "no API", so every call returns `null` immediately.
  - `async chiGet(path, { timeoutMs = 4000, fetchImpl = fetch, base = chiBase() } = {}) → any | null`. It never throws. It returns `null` on an empty base, a timeout, a non-2xx status, a network or CORS error, or a non-JSON body.
  - `<LensRail/>`: three vertical buttons with an `aria-pressed` cyan tick.
  - `<ContextPanel/>`: renders the card for `selection`, or the lens panel when `selection` is null and a lens is active; it has a close button, and Esc clears the selection.
  - ⌘K commands: `Lens: Visit`, `Lens: Live`, `Lens: Work`, `Close lens`.
  - Help group **Guide**: "Lens rail (left) — Visit, Live, Work"; "Hover a building for its name and year; click for its card"; "Esc — close the card".

- [ ] **Step 1: Write the failing tests**

```js
// app/src/services/__tests__/chiApi.test.js
import { describe, it, expect, vi } from 'vitest'
import { chiGet, chiBase } from '../chiApi.js'

const ok = (body) => vi.fn(async () => ({ ok: true, status: 200, json: async () => body }))
describe('chiGet', () => {
  it('returns parsed JSON on success', async () => {
    expect(await chiGet('/api/cta/alerts', { base: 'https://chi.example', fetchImpl: ok({ alerts: [] }) })).toEqual({ alerts: [] })
  })
  it('returns null with no base configured, without calling fetch', async () => {
    const f = ok({}); expect(await chiGet('/api/x', { base: '', fetchImpl: f })).toBeNull(); expect(f).not.toHaveBeenCalled()
  })
  it('returns null on non-2xx', async () => {
    expect(await chiGet('/api/x', { base: 'b', fetchImpl: async () => ({ ok: false, status: 502, json: async () => ({}) }) })).toBeNull()
  })
  it('returns null on network/CORS TypeError', async () => {
    expect(await chiGet('/api/x', { base: 'b', fetchImpl: async () => { throw new TypeError('Failed to fetch') } })).toBeNull()
  })
  it('returns null on a non-JSON body', async () => {
    expect(await chiGet('/api/x', { base: 'b', fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x') } }) })).toBeNull()
  })
  it('returns null after the timeout', async () => {
    vi.useFakeTimers()
    const p = chiGet('/api/x', { base: 'b', timeoutMs: 50, fetchImpl: (_u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))) })
    vi.advanceTimersByTime(60)
    expect(await p).toBeNull()
    vi.useRealTimers()
  })
  it('chiBase reads VITE_CHI_API_URL and strips a trailing slash', () => {
    expect(chiBase({ VITE_CHI_API_URL: 'https://chi.example/' })).toBe('https://chi.example')
    expect(chiBase({})).toBe('')
  })
})
```

```jsx
// app/src/hud/__tests__/lens.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LensRail from '../LensRail.jsx'
import ContextPanel from '../ContextPanel.jsx'
import { useStore } from '../../state/store.js'

describe('lens rail + context panel', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('buttons switch lens and toggle off when pressed again', () => {
    render(<LensRail />)
    fireEvent.click(screen.getByRole('button', { name: /visit/i }))
    expect(useStore.getState().lens).toBe('VISIT')
    expect(screen.getByRole('button', { name: /visit/i })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /visit/i }))
    expect(useStore.getState().lens).toBeNull()
  })
  it('panel shows a selection card and closes on Esc and on the close button', () => {
    useStore.getState().select({ kind: 'building', id: '0_0:12', data: { name: 'Rookery', address: '209 S LaSalle', stories: 12, year: 1888 } })
    render(<ContextPanel />)
    expect(screen.getByText('Rookery')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useStore.getState().selection).toBeNull()
  })
})
```

```js
// append to app/src/state/__tests__/store.test.js
it('lens, selection and office transitions', () => {
  const s = useStore.getState()
  s.setLens('WORK'); expect(useStore.getState().lens).toBe('WORK')
  s.setLens('WORK'); expect(useStore.getState().lens).toBeNull()
  s.select({ kind: 'poi', id: 'n1' }); expect(useStore.getState().selection.id).toBe('n1')
  s.clearSelection(); expect(useStore.getState().selection).toBeNull()
  s.setOffice({ x: -700, z: 400, label: '233 S WACKER' }); expect(useStore.getState().office.label).toBe('233 S WACKER')
})
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npm test --prefix app -- src/services src/hud/__tests__/lens.test.jsx src/state`. Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. Palette: add a **Guide** section in `ORDER` and `SECTION`. Help: add the **Guide** group.
- [ ] **Step 4: Run the tests to verify they pass.** Then run the whole app suite.
- [ ] **Step 5: Commit.** `git commit -m "feat(p4): lens state, lens rail, context panel shell, chiGet"`

**Acceptance:**
- A non-coder can open each lens from the rail or ⌘K and close it.
- `chiGet` never throws.

**Refresh at phase start:**
- Read V7's final dock and help layout, so the lens rail does not collide with any left-edge element V7 placed.
- Check whether V4 already introduced a `selection` in the store for train and station cards. If it did, adopt its shape and extend `kind`.
- Confirm the CHI production origin, and whether this app will deploy on `*.vercel.app` (CHI's CORS allows that pattern and `FRONTEND_URL`).

---

### Task 2: Transit integration library — nearest L, alerts to line pulses, line emphasis (I-4.5, C17)

**Files:**
- Create: `app/src/lib/nearestTransit.js`, `app/src/lib/alerts.js`, `app/src/transit/lineEmphasis.js`, `app/src/hud/cards/NearestL.jsx`
- Modify: the V3 glow material file (add `uLineGain` and `uLinePulse`, if missing), and V3's legend component (alert marker + headline tooltip)
- Test: `app/src/lib/__tests__/nearestTransit.test.js`, `app/src/lib/__tests__/alerts.test.js`, `app/src/transit/__tests__/lineEmphasis.test.js`

**Interfaces:**
- Consumes: `transit.json` stations `{ id, name, x, z, lines }` (V3).
- Produces:
  - `WALK_M_PER_MIN = 80`
  - `CHI_LINE = { Red: 'red', Blue: 'blue', Brn: 'brown', G: 'green', Org: 'orange', Pink: 'pink', P: 'purple', Y: 'yellow' }`
  - `nearestStations(x, z, stations, { k = 3, maxM = 1600, kind = 'cta' } = {}) → [{ station, distM, walkMin, lines: string[] }]`, sorted by distance and limited to `maxM`.
  - `linesNear(x, z, stations, maxM = 800) → string[]`: the unique line ids, ordered by the nearest station that serves each line.
  - `SEVERITY = { 'Significant Delays': 1, 'Minor Delays': 0.6, 'Service Change': 0.5, 'Planned Reroute': 0.4, 'Planned Work': 0.3, 'Added Service': 0, 'Elevator Status': 0, 'Special Note': 0.1 }`
  - `alertsToLinePulses(alerts) → Map<lineId, { severity: number, headlines: string[] }>`. It parses `affected[]` entries matching `/^(Red|Blue|Brown|Green|Orange|Pink|Purple|Yellow) Line/i`, takes the max severity per line, ignores bus routes and severity 0, and tolerates `null` and malformed input.
  - `setLineGain(lineId, gain 0..2)`, `setLinePulse(lineId, severity 0..1)`, `resetLineEmphasis()`, `lineEmphasisState() → { gain: Float32Array(16), pulse: Float32Array(16) }`. The glow shader reads `gain × (1 + pulse × 0.5 × (0.5 + 0.5 sin(2π · 0.6 · t)))`, and LOW disables the pulse animation (steady +20 %).
  - `<NearestL x z/>`: "Nearest L: Grand (Red) · 4 min walk", with line swatches; "No L within walking distance" when empty.
  - Alerts are polled from `/api/cta/alerts` through `chiGet` every 5 min while the Transit legend or any lens is visible. When the result is `null`, no pulses are set. Phase 5 migrates this to its feed scheduler.

- [ ] **Step 1: Write the failing tests**

```js
// app/src/lib/__tests__/nearestTransit.test.js
import { describe, it, expect } from 'vitest'
import { nearestStations, linesNear, CHI_LINE, WALK_M_PER_MIN } from '../nearestTransit.js'

const stations = [
  { id: 'grand-red', name: 'Grand', x: 0, z: -1450, lines: ['red'] },
  { id: 'chicago-red', name: 'Chicago', x: 0, z: -1600, lines: ['red'] },
  { id: 'merch', name: 'Merchandise Mart', x: -500, z: -800, lines: ['brown', 'purple'] },
  { id: 'far', name: 'Far', x: 9000, z: 9000, lines: ['blue'] },
]
describe('nearest L', () => {
  it('returns the k nearest within walking range with walk minutes at 80 m/min', () => {
    const r = nearestStations(0, -1300, stations, { k: 2 })
    expect(r.map((s) => s.station.id)).toEqual(['grand-red', 'chicago-red'])
    expect(r[0].walkMin).toBeCloseTo(150 / WALK_M_PER_MIN, 5)
  })
  it('returns [] when nothing is within range (never NaN)', () => {
    expect(nearestStations(20000, 20000, stations)).toEqual([])
  })
  it('linesNear lists each line once, nearest first', () => {
    expect(linesNear(-400, -900, stations, 1000)).toEqual(['brown', 'purple', 'red'])
  })
  it('maps CHI line codes to app ids', () => {
    expect(['Red', 'Blue', 'Brn', 'G', 'Org', 'Pink', 'P', 'Y'].map((c) => CHI_LINE[c])).toEqual(['red', 'blue', 'brown', 'green', 'orange', 'pink', 'purple', 'yellow'])
  })
})
```

```js
// app/src/lib/__tests__/alerts.test.js
import { describe, it, expect } from 'vitest'
import { alertsToLinePulses } from '../alerts.js'

describe('alerts → line pulses', () => {
  it('takes the max severity per line and keeps headlines', () => {
    const m = alertsToLinePulses({ alerts: [
      { id: '1', headline: 'Red Line delays', impact: 'Significant Delays', affected: ['Red Line'] },
      { id: '2', headline: 'Red Line work', impact: 'Planned Work', affected: ['Red Line', 'Purple Line'] },
    ] })
    expect(m.get('red').severity).toBe(1)
    expect(m.get('red').headlines).toEqual(['Red Line delays', 'Red Line work'])
    expect(m.get('purple').severity).toBeCloseTo(0.3)
  })
  it('ignores bus routes and zero-severity impacts', () => {
    const m = alertsToLinePulses({ alerts: [
      { id: '3', headline: 'Bus reroute', impact: 'Service Change', affected: ['#22 Clark'] },
      { id: '4', headline: 'Elevator out', impact: 'Elevator Status', affected: ['Blue Line'] },
    ] })
    expect(m.size).toBe(0)
  })
  it('tolerates null and malformed payloads', () => {
    expect(alertsToLinePulses(null).size).toBe(0)
    expect(alertsToLinePulses({ alerts: 'nope' }).size).toBe(0)
    expect(alertsToLinePulses({ alerts: [{ impact: 'Minor Delays' }] }).size).toBe(0)
  })
})
```

```js
// app/src/transit/__tests__/lineEmphasis.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { setLineGain, setLinePulse, resetLineEmphasis, lineEmphasisState } from '../lineEmphasis.js'
import { LINE_INDEX } from '../lines.js' // V3's line index table (refresh: actual path)

describe('line emphasis', () => {
  beforeEach(resetLineEmphasis)
  it('defaults to gain 1 and pulse 0', () => {
    const s = lineEmphasisState()
    expect(s.gain[LINE_INDEX.red]).toBe(1); expect(s.pulse[LINE_INDEX.red]).toBe(0)
  })
  it('clamps gain to 0..2 and pulse to 0..1', () => {
    setLineGain('red', 5); setLinePulse('blue', -1)
    expect(lineEmphasisState().gain[LINE_INDEX.red]).toBe(2)
    expect(lineEmphasisState().pulse[LINE_INDEX.blue]).toBe(0)
  })
  it('ignores unknown line ids', () => {
    expect(() => setLineGain('teal', 1.5)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run to verify they fail.** Run `npm test --prefix app -- src/lib/__tests__/nearestTransit.test.js src/lib/__tests__/alerts.test.js src/transit`. Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. Add the two uniform arrays to V3's glow material through its existing patch hook, and add the alert marker (Remix `RiAlertLine`) and the headline to V3's legend rows.
- [ ] **Step 4: Run the tests to verify they pass.** Then evaluate and revert on the pulse look: take a night shot of the Loop with a fixture alert on Red (URL test param `?alerts=fixture`, tests only). It must read as "attention", never as an alarm strobe.
- [ ] **Step 5: Commit.** `git commit -m "feat(p4): nearest-L, CTA alerts as line pulses, line emphasis (C17)"`

**Acceptance:**
- C17's "alerts as line pulses" and "nearest L" libraries are tested.
- The legend shows the alert headline on hover and focus.
- Pulses are absent when offline.

**Refresh at phase start:**
- Read V3's actual line-index table and glow material (names and uniform limits).
- Read V3's legend component.
- Confirm the CTA alert `impact` strings in a live `/api/cta/alerts` sample; update `SEVERITY` if CTA uses others.

---

### Task 3: Hover tooltips and building cards (I-4.6, needs H7)

**Files:**
- Create: `app/src/lib/picking.js`, `app/src/world/Picker.jsx`, `app/src/hud/BuildingTooltip.jsx`, `app/src/hud/cards/BuildingCard.jsx`
- Modify: `app/package.json` (+ `three-mesh-bvh`, exact version), `app/src/world/TileContent.jsx` (expose the tile key and sidecar on `buildings` meshes: `mesh.userData = { tileId, lod, meta }`), `app/src/world/Scene.jsx`, `app/src/hud/Hud.jsx`
- Test: `app/src/lib/__tests__/picking.test.js`, `app/src/hud/__tests__/tooltip.test.jsx`

**Interfaces:**
- Consumes: V1's unique `_bldg` per tile; sidecar `buildings[i] = { id, name, address, stories, year, height, hero }`; `nearestStations` (Task 2).
- Produces:
  - `bldgIndexFromHit(hit) → number | null`. It reads `hit.object.geometry.attributes._bldg` at `hit.face.a`, and returns `null` when the attribute is missing, the object is not a `buildings` layer, or the object is a 2 km block (`userData.lod === 'block'`).
  - `buildingInfo(meta, idx) → { id, name: string|null, address: string|null, stories: number|null, storiesEstimated: boolean, year: number|null, heightM: number, hero: string|null } | null`. When `stories` is missing it estimates `round(height / 3.8)` and sets `storiesEstimated: true`.
  - `tooltipLines(info) → string[]`. It returns 1–3 lines: the name, or "Unnamed building"; the address when present; then `"12 stories · 1888"`, `"~12 stories (est.)"` or `"… · year unknown"`.
  - `<Picker/>` raycasts at ≤ 10 Hz on `pointermove` against the `buildings` meshes of LOD0 and LOD1 tiles only, building the BVH lazily per mesh on its first hover. It suppresses hover while a pointer button is down, `flight` is set, `tour.playing` is true, or `paletteOpen` is true. A click selects `{ kind: 'building', id: '<tileId>:<idx>', data: info }`, or `{ kind: 'landmark' }` when `info.hero` is set.
  - `<BuildingTooltip/>` follows the pointer, offset 14 px, using `.hud-panel` compact.
  - `<BuildingCard/>` shows the name, address, stories, year, height and nearest L, plus a **Fly here** button that calls `startFlight(poseForPlace)` with clearance.

- [ ] **Step 1: Write the failing tests**

```js
// app/src/lib/__tests__/picking.test.js
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { bldgIndexFromHit, buildingInfo, tooltipLines } from '../picking.js'

const mesh = (withAttr = true, lod = 'lod0') => {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0, 3, 0, 0, 2, 1, 0], 3))
  if (withAttr) g.setAttribute('_bldg', new THREE.Float32BufferAttribute([4, 4, 4, 7, 7, 7], 1))
  const m = new THREE.Mesh(g); m.name = 'buildings'; m.userData = { tileId: '0_0', lod }
  return m
}
describe('picking', () => {
  it('reads _bldg from the hit face', () => {
    expect(bldgIndexFromHit({ object: mesh(), face: { a: 3 } })).toBe(7)
  })
  it('returns null for meshes without _bldg, for non-building layers and for blocks', () => {
    expect(bldgIndexFromHit({ object: mesh(false), face: { a: 0 } })).toBeNull()
    const water = mesh(); water.name = 'water'
    expect(bldgIndexFromHit({ object: water, face: { a: 0 } })).toBeNull()
    expect(bldgIndexFromHit({ object: mesh(true, 'block'), face: { a: 0 } })).toBeNull()
    expect(bldgIndexFromHit(null)).toBeNull()
  })
  it('estimates stories from height when missing', () => {
    const info = buildingInfo({ buildings: [{ id: 'w1', name: null, address: null, stories: null, year: null, height: 45.6 }] }, 0)
    expect(info.stories).toBe(12); expect(info.storiesEstimated).toBe(true)
  })
  it('tooltip lines read like plain English', () => {
    expect(tooltipLines({ name: 'The Rookery', address: '209 S LaSalle St', stories: 12, storiesEstimated: false, year: 1888 }))
      .toEqual(['The Rookery', '209 S LaSalle St', '12 stories · 1888'])
    expect(tooltipLines({ name: null, address: null, stories: 12, storiesEstimated: true, year: null }))
      .toEqual(['Unnamed building', '~12 stories (est.) · year unknown'])
  })
  it('buildingInfo returns null for an out-of-range index', () => {
    expect(buildingInfo({ buildings: [] }, 3)).toBeNull()
  })
})
```

```jsx
// app/src/hud/__tests__/tooltip.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import BuildingTooltip from '../BuildingTooltip.jsx'
import { useStore } from '../../state/store.js'

describe('building tooltip', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('renders the hovered building and hides when hover clears', () => {
    useStore.setState({ hover: { x: 100, y: 100, lines: ['The Rookery', '209 S LaSalle St', '12 stories · 1888'] } })
    const { rerender } = render(<BuildingTooltip />)
    expect(screen.getByText('The Rookery')).toBeInTheDocument()
    useStore.setState({ hover: null }); rerender(<BuildingTooltip />)
    expect(screen.queryByText('The Rookery')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify they fail.** Run `npm test --prefix app -- src/lib/__tests__/picking.test.js src/hud/__tests__/tooltip.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. Add `hover: null | { x, y, lines }` and `setHover` to the store.
- [ ] **Step 4: Run the tests to verify they pass.** Then run a manual dev pass (one heavy process). Hover the Rookery, Willis, a three-flat in Pilsen, the river and a far block. Check the frame time with the hover active (≤ 1 ms added at 10 Hz). Log it.
- [ ] **Step 5: e2e check.** Add `app/e2e/hover.spec.js`: at `?view=loop`, move the mouse to a known pixel and wait for camera rest (G5 helper). Assert that `.building-tooltip` contains a non-empty name.
- [ ] **Step 6: Commit.** `git commit -m "feat(p4): hover tooltips and building cards (I-4.6)"`

**Acceptance:**
- Hovering shows the name, address, stories and year.
- A click opens the card with the nearest L.
- No tooltip appears on water, roads or blocks.

**Refresh at phase start:**
- Confirm the lowercase attribute name (`_bldg`) after V1.
- Check whether LOD1 files share `_bldg` indices with the sidecar.
- Check whether V2 added `_style` (it is not needed here).
- Pin the `three-mesh-bvh` version compatible with three 0.186.
- Read the G5 camera-rest e2e helper's name.

---

### Task 4: Places pipeline — OSM amenities anchored to roofs (I-4.1 data)

**Files:**
- Create: `pipeline/lib/pois.js`, `pipeline/fetch/fetch-pois.js`
- Modify: `pipeline/lib/sources.js` (the `pois` overpass kind), `pipeline/build/build-world.js` (sidecar `pois`, `public/world/pois-index.json`, manifest `pois: { index, count, categories }`)
- Test: `pipeline/tests/pois.test.js`

**Interfaces:**
- Produces:
  - Overpass kind `pois`: `node|way[name][amenity~"^(restaurant|fast_food|food_court|bar|pub|biergarten|nightclub|cafe|ice_cream|theatre|cinema|arts_centre|music_venue|events_venue|library|marketplace|pharmacy|bank|hospital|clinic|post_office|community_centre)$"]`, plus `[name][tourism~"^(museum|gallery|attraction|hotel|viewpoint)$"]`, `[name][shop]` and `[name][leisure~"^(park|playground|sports_centre|fitness_centre|marina)$"]`. The fetch is chunked by `chunkBBox`, and the output is `out center tags;`.
  - `POI_CATEGORIES = [{ id: 'food', label: 'Food', icon: 'RiRestaurantLine' }, { id: 'drinks', label: 'Bars', icon: 'RiGoblet2Line' }, { id: 'coffee', label: 'Coffee', icon: 'RiCupLine' }, { id: 'nightlife', label: 'Nightlife', icon: 'RiMoonLine' }, { id: 'venues', label: 'Venues', icon: 'RiMusic2Line' }, { id: 'culture', label: 'Culture', icon: 'RiBankLine' }, { id: 'shops', label: 'Shops', icon: 'RiShoppingBag3Line' }, { id: 'outdoors', label: 'Outdoors', icon: 'RiLeafLine' }, { id: 'hotels', label: 'Hotels', icon: 'RiHotelLine' }, { id: 'services', label: 'Services', icon: 'RiFirstAidKitLine' }]`
  - `poiCategory(tags) → categoryId | null`. It is `null` when the item is unnamed or unmapped.
  - `poiRecord(el) → { id: 'n123'|'w456', name, cat, lon, lat, tags: { cuisine?, opening_hours?, website?, 'addr:*'? } } | null`
  - `dedupePois(list) → list`: the same normalised name within 25 m keeps one record, preferring the way (building) over the node.
  - `anchorPoi(p: { x, z }, index: { query(x, z) → building[] }) → { x, y, z, bldg: number | -1 }`:
    - Inside a footprint that is not in a hole, the pin sits at roof top + 4 m.
    - Within 3 m of a footprint edge, it snaps to that building.
    - Otherwise it sits at ground + 6 m.
  - Sidecar `pois: [{ id, n, c, x, y, z, b, a?, t? }]`, where `c` is the category index, `b` the `_bldg` index or −1, `a` the address and `t` the compact tags.
  - `pois-index.json`: `[[id, name, catIdx, x, z, tileKey], …]` for ⌘K.

- [ ] **Step 1: Write the failing test**

```js
// pipeline/tests/pois.test.js
import { describe, it, expect } from 'vitest'
import { poiCategory, poiRecord, dedupePois, anchorPoi, POI_CATEGORIES } from '../lib/pois.js'

describe('POI categories', () => {
  it.each([
    [{ name: 'Au Cheval', amenity: 'restaurant' }, 'food'],
    [{ name: 'The Aviary', amenity: 'bar' }, 'drinks'],
    [{ name: 'Metro', amenity: 'nightclub' }, 'nightlife'],
    [{ name: 'Intelligentsia', amenity: 'cafe' }, 'coffee'],
    [{ name: 'Chicago Theatre', amenity: 'theatre' }, 'venues'],
    [{ name: 'Green Mill', amenity: 'music_venue' }, 'venues'],
    [{ name: 'Art Institute', tourism: 'museum' }, 'culture'],
    [{ name: 'Target', shop: 'department_store' }, 'shops'],
    [{ name: 'Palmisano Park', leisure: 'park' }, 'outdoors'],
    [{ name: 'Palmer House', tourism: 'hotel' }, 'hotels'],
    [{ name: 'Walgreens', amenity: 'pharmacy' }, 'services'],
  ])('%o → %s', (tags, cat) => expect(poiCategory(tags)).toBe(cat))
  it('unnamed or unmapped tags are dropped', () => {
    expect(poiCategory({ amenity: 'bar' })).toBeNull()
    expect(poiCategory({ name: 'Bench', amenity: 'bench' })).toBeNull()
  })
  it('every category has a Remix icon name and a label', () => {
    for (const c of POI_CATEGORIES) { expect(c.icon).toMatch(/^Ri/); expect(c.label.length).toBeGreaterThan(2) }
  })
})

describe('POI records', () => {
  it('uses the way centre for ways and keeps compact tags', () => {
    const r = poiRecord({ type: 'way', id: 9, center: { lat: 41.88, lon: -87.63 }, tags: { name: 'X', amenity: 'cafe', cuisine: 'coffee_shop', opening_hours: 'Mo-Fr 07:00-18:00' } })
    expect(r).toMatchObject({ id: 'w9', name: 'X', cat: 'coffee', lat: 41.88 }); expect(r.tags.opening_hours).toBeDefined()
  })
  it('dedupes the same venue mapped as node and way, keeping the way', () => {
    const list = dedupePois([
      { id: 'n1', name: 'Au Cheval', x: 0, z: 0 }, { id: 'w2', name: 'Au  Cheval ', x: 10, z: 5 }, { id: 'n3', name: 'Au Cheval', x: 400, z: 0 },
    ])
    expect(list.map((p) => p.id).sort()).toEqual(['n3', 'w2'])
  })
})

describe('anchorPoi', () => {
  const square = { outer: [[-10, -10], [10, -10], [10, 10], [-10, 10]], holes: [[[-3, -3], [3, -3], [3, 3], [-3, 3]]], top: 40, bldg: 5 }
  const index = { query: () => [square] }
  it('inside a footprint → roof + 4 m, carries the building index', () => {
    expect(anchorPoi({ x: 7, z: 7 }, index)).toEqual({ x: 7, y: 44, z: 7, bldg: 5 })
  })
  it('inside a courtyard hole → ground + 6 m, no building', () => {
    expect(anchorPoi({ x: 0, z: 0 }, index)).toEqual({ x: 0, y: 6, z: 0, bldg: -1 })
  })
  it('entrance node 2 m outside the wall snaps to the building', () => {
    expect(anchorPoi({ x: 12, z: 0 }, index).bldg).toBe(5)
  })
  it('in the open → ground + 6 m', () => {
    expect(anchorPoi({ x: 50, z: 50 }, { query: () => [] })).toEqual({ x: 50, y: 6, z: 50, bldg: -1 })
  })
})
```

- [ ] **Step 2: Run to verify it fails.** Run `npm test --prefix pipeline -- tests/pois.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start.
- [ ] **Step 4: Fetch (heavy; alone).** Run `npm run --prefix pipeline fetch:pois`: chunked Overpass requests at ≤ 1 request per 5 s, across 3 mirrors (as CHI's `yelp.js` does), cached. Log the POI count per category in the ledger.
- [ ] **Step 5: World build.** Check the sidecar size delta (≤ +8 MB in total) and the `pois-index.json` size (≤ 1.5 MB raw).
- [ ] **Step 6: Run the tests, commit and push.** `git commit -m "feat(p4): OSM places pipeline, rooftop-anchored (I-4.1 data)"`, then `git push origin main`.

**Acceptance:**
- Every in-bounds named amenity in the 10 categories is present once, with a correct anchor.
- The size budget is met.

**Refresh at phase start:**
- Check whether V1's H6 hole-aware point-in-building helper exists (reuse it).
- Check whether the build has a building spatial index to reuse (`buildGridIndex`).
- Check the current Overpass rate-limit etiquette.

---

### Task 5: Places pins, filters, cards and live merge (I-4.1 app)

**Files:**
- Create: `app/src/lib/poiFilter.js`, `app/src/world/PoiPins.jsx`, `app/src/hud/panels/PoiFilters.jsx`, `app/src/hud/cards/PoiCard.jsx`, `app/public/world/poi-icons.png` (a generated atlas of the 10 Remix glyphs, rendered at build time by `pipeline/build/build-poi-atlas.js`)
- Modify: `app/src/world/TileContent.jsx` (hand the LOD0 sidecar `pois` to a store-level registry `registerTilePois(tileId, pois)` / `unregisterTilePois(tileId)`), `app/src/hud/ControlDock.jsx` (**Places** toggle), `app/src/hud/CommandPalette.jsx` (`Show places`, `Hide places`, `Show only: Bars`, … for each category; and POI search rows from `pois-index.json`, kind `place`)
- Test: `app/src/lib/__tests__/poiFilter.test.js`, `app/src/hud/__tests__/poiFilters.test.jsx`, `app/src/hud/__tests__/palette.test.jsx` (append)

**Interfaces:**
- Consumes: sidecar `pois` (Task 4), `chiGet` (Task 1), `nearestStations` (Task 2), `beaconLayout` (Task 6, for labels).
- Produces:
  - `MAX_PINS = { LOW: 800, HIGH: 3000, ULTRA: 4000 }`
  - `filterPois(pois, { cats: string[], target: [x, z], max }) → pois`: the selected categories, sorted by distance to the camera target and truncated to `max`.
  - `mergeLivePlaces(tilePois, livePlaces, { project, anchor }) → pois`. It adds CHI places not already present, matched by OSM numeric id or by normalised name within 40 m, and anchored with `anchor`. It ignores any live item with no name or lat/lon, or that lies outside the world. Live items get `live: true`.
  - `<PoiPins/>`: one `InstancedMesh` (a camera-facing quad; the `iconIndex` instance attribute samples `poi-icons.png`). Pins scale with distance, so they stay 18–28 px. Hover highlights, and a click selects `{ kind: 'poi' }`. It renders when `lens === 'VISIT' || placesOn`.
  - `<PoiFilters/>`: a chip row, one `.hud-pill` per category, with **All** and **None**.
  - `<PoiCard/>`: the name, category, address, cuisine, hours (raw OSM `opening_hours` string), website as text with a link beside it, nearest L and **Fly here**.
  - Live places: on VISIT entry, `chiGet('/api/places?type=all')` and `chiGet('/api/places?type=nightlife_all')` are fetched once per session and merged.

- [ ] **Step 1: Write the failing tests**

```js
// app/src/lib/__tests__/poiFilter.test.js
import { describe, it, expect } from 'vitest'
import { filterPois, mergeLivePlaces, MAX_PINS } from '../poiFilter.js'

const pois = [
  { id: 'n1', n: 'Bar A', c: 1, x: 0, y: 30, z: 0, b: 3 },
  { id: 'n2', n: 'Cafe B', c: 2, x: 100, y: 6, z: 0, b: -1 },
  { id: 'w3', n: 'Bar C', c: 1, x: 50, y: 20, z: 0, b: 4 },
]
const CATS = ['food', 'drinks', 'coffee']
describe('filterPois', () => {
  it('keeps selected categories, nearest first, truncated', () => {
    expect(filterPois(pois, { cats: ['drinks'], target: [60, 0], max: 1, catIds: CATS }).map((p) => p.id)).toEqual(['w3'])
  })
  it('an empty category selection shows nothing', () => {
    expect(filterPois(pois, { cats: [], target: [0, 0], max: 10, catIds: CATS })).toEqual([])
  })
  it('pin caps shrink on LOW', () => { expect(MAX_PINS.LOW).toBeLessThan(MAX_PINS.HIGH) })
})

describe('mergeLivePlaces', () => {
  const project = (lon, lat) => [(lon + 87.62784) * 82900, -(lat - 41.88203) * 111100]
  const anchor = ({ x, z }) => ({ x, y: 6, z, bldg: -1 })
  it('adds new live places and skips ones already present by id or name+distance', () => {
    const live = { places: [
      { id: '1', name: 'Bar A', lat: 41.88203, lon: -87.62784 },
      { id: '777', name: 'New Spot', lat: 41.8830, lon: -87.6280 },
    ] }
    const out = mergeLivePlaces(pois, live, { project, anchor })
    expect(out.filter((p) => p.n === 'Bar A')).toHaveLength(1)
    expect(out.find((p) => p.n === 'New Spot')).toMatchObject({ live: true })
  })
  it('ignores malformed payloads and items without coordinates', () => {
    expect(mergeLivePlaces(pois, null, { project, anchor })).toHaveLength(3)
    expect(mergeLivePlaces(pois, { places: [{ name: 'X' }, { lat: 1 }] }, { project, anchor })).toHaveLength(3)
  })
})
```

```jsx
// app/src/hud/__tests__/poiFilters.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PoiFilters from '../panels/PoiFilters.jsx'
import { useStore } from '../../state/store.js'

describe('POI filter chips', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('toggles a category and supports All / None', () => {
    render(<PoiFilters />)
    fireEvent.click(screen.getByRole('button', { name: 'None' }))
    expect(useStore.getState().poiCats).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Bars' }))
    expect(useStore.getState().poiCats).toEqual(['drinks'])
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(useStore.getState().poiCats.length).toBe(10)
  })
})
```

```jsx
// append to app/src/hud/__tests__/palette.test.jsx
it('offers place filters and finds a named place', async () => {
  const { buildPlaceRows } = await import('../../lib/poiFilter.js')
  const rows = buildPlaceRows([['n1', 'Green Mill Cocktail Lounge', 4, -2600, -9000, 't']], ['food', 'drinks', 'coffee', 'nightlife', 'venues'])
  expect(rows[0]).toMatchObject({ kind: 'place', name: 'Green Mill Cocktail Lounge', sub: 'Venues' })
})
```

- [ ] **Step 2: Run to verify they fail.** Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. `buildPlaceRows(index, catIds) → palette rows` lives in `poiFilter.js`.
- [ ] **Step 4: Run the tests to verify they pass.** Perf: Loop at 400 m with all categories: draw calls +1, frame time +≤ 0.5 ms. Evaluate and revert the pin look (day and night). Pins take a restrained cyan rim, not neon blobs.
- [ ] **Step 5: Commit and push.** `git commit -m "feat(p4): places pins, filters, cards, live merge (I-4.1)"`

**Acceptance:**
- VISIT shows rooftop pins.
- The chips filter them.
- The dock **Places** button works outside VISIT.
- ⌘K finds places by name.
- It works offline with build-time data.

**Refresh at phase start:**
- Check V7's dock layout for a free slot for **Places**.
- Decide whether `poi-icons.png` joins an existing atlas (V3/V4 may have made icon atlases).
- Check whether CHI's `/api/places` shape is unchanged.

---

### Task 6: VISIT lens — beacons, landmark cards, three tours (I-4.2)

**Files:**
- Create: `app/src/data/landmarks.js`, `app/src/data/tours.json`, `app/src/lib/labels.js`, `app/src/lib/tour.js`, `app/src/world/Beacons.jsx`, `app/src/world/WorldLabels.jsx`, `app/src/camera/TourPlayer.jsx`, `app/src/hud/TourBar.jsx`, `app/src/hud/cards/LandmarkCard.jsx`, `app/src/hud/panels/VisitPanel.jsx`
- Modify: `app/src/hud/CommandPalette.jsx` (**Tour** group: `Tour: Architecture on the River`, `Tour: Museum Campus & the Lakefront`, `Tour: A Night in River North`), `app/src/camera/AtlasRig.jsx` (`cameraMode === 'TOUR'` hands control to TourPlayer, and movement keys exit to FLY), `HelpOverlay.jsx`, `HintBar.jsx` (the tour hints only while touring)
- Test: `app/src/lib/__tests__/labels.test.js`, `app/src/lib/__tests__/tour.test.js`, `app/src/data/__tests__/landmarks.test.js`, `app/src/hud/__tests__/tourbar.test.jsx`

**Interfaces:**
- Consumes: the manifest `landmarks[]`, `nearestStations`, `flightDuration` and `flyPose` (`flight.js`), `clearanceAt` (V1), `startFlight`.
- Produces:
  - `LANDMARKS: { id, name, category: 'icon'|'architecture'|'culture'|'nature'|'hidden', lat, lon, desc, tip, heroKey? }[]`. There are 32 entries, copied from CHI `frontend/src/data/landmarks.js` with attribution in the file header.
  - `inWorld(lm, bbox) → boolean`. Out-of-world entries are listed in the VISIT panel under "Beyond the map — coming in Phase 6", with no beacon.
  - `CATEGORY_COLOR = { icon: 'var(--accent)', architecture: '#e8eef9', culture: '#b89cff', nature: '#5fd49a', hidden: '#ffb35c' }`. The final values are subject to evaluate-and-revert.
  - `beaconLayout(items: { id, x, y, z, priority }[], { toScreen: (x, y, z) → { sx, sy, depth, visible }, width, height, maxLabels = 16, fadeNear = 2000, fadeFar = 6000, box = { w: 140, h: 22 } }) → { id, sx, sy, alpha, labelled: boolean }[]`. Alpha is 1 at ≤ fadeNear and 0 at ≥ fadeFar. Labels are greedy by priority, then depth; overlapping boxes are culled. Pins (Task 5) and zones (Task 7) use the same function.
  - `<Beacons/>`: one `InstancedMesh` of thin additive light pillars (≈ 2 m × 180 m, category-coloured, ≤ 15 % intensity by day, full at night per B.1.1). A click triggers DIVE (`startFlight(poseForPlace)`) plus `select({ kind: 'landmark' })`.
  - `<LandmarkCard/>`: the name, category, desc, tip, nearest L stop (C17), **Save** (per-viewer `localStorage` list, guarded by try/catch) and **Fly here**.
  - `tours.json`: `[{ id, name, time?: 'DUSK'|'NIGHT'|null, stops: [{ landmark?: heroKey, lat?, lon?, title, text, dwell: seconds, pose?: { position, target } }] }]`. Stops without `pose` get `poseForPlace` of the landmark, lifted by `clearanceAt`.
    - **Architecture on the River:** wrigleybldg, tribune, trump, marina1, mart, 110wacker, willis.
    - **Museum Campus & the Lakefront:** buckingham, fieldmuseum, shedd, adler, soldierfield, northerlyisland, twelfthbeach.
    - **A Night in River North** (`time: 'NIGHT'`): mart (Art on the Mart), marina1, wrigleybldg, hancock, centennialwheel, chicagotheatre.
  - `tourDuration(tour, poses) → seconds`
  - `tourAt(tour, poses, tSec) → { stopIndex, phase: 'fly'|'dwell', pose, card: { title, text }, progress: 0..1, done: boolean }`. The fly legs use `flightDuration`, and the dwell holds the pose.
  - `<TourBar/>`: **Pause/Play**, **Previous**, **Next**, **Exit** buttons and a scrubber. Keys: Space pauses, `,` and `.` step between stops, Esc exits. Any movement key exits to FLY (consistent with flights). After a movement-key exit, a **Resume tour** chip stays visible for 10 s and restarts at the same stop.

- [ ] **Step 1: Write the failing tests**

```js
// app/src/lib/__tests__/labels.test.js
import { describe, it, expect } from 'vitest'
import { beaconLayout } from '../labels.js'

const toScreen = (x, y, z) => ({ sx: x, sy: y, depth: z, visible: true })
describe('beaconLayout', () => {
  it('fades with distance', () => {
    const r = beaconLayout([{ id: 'a', x: 10, y: 10, z: 1000, priority: 1 }, { id: 'b', x: 500, y: 10, z: 7000, priority: 1 }], { toScreen, width: 1280, height: 800 })
    expect(r.find((b) => b.id === 'a').alpha).toBe(1); expect(r.find((b) => b.id === 'b').alpha).toBe(0)
  })
  it('culls overlapping labels, keeping the higher priority then the nearer', () => {
    const r = beaconLayout([
      { id: 'far', x: 100, y: 100, z: 1500, priority: 1 }, { id: 'near', x: 110, y: 105, z: 500, priority: 1 }, { id: 'vip', x: 120, y: 100, z: 1800, priority: 5 },
    ], { toScreen, width: 1280, height: 800 })
    expect(r.filter((b) => b.labelled).map((b) => b.id)).toEqual(['vip'])
  })
  it('never labels more than maxLabels', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: `i${i}`, x: (i % 10) * 200, y: Math.floor(i / 10) * 60, z: 100, priority: 1 }))
    expect(beaconLayout(items, { toScreen, width: 2000, height: 400, maxLabels: 16 }).filter((b) => b.labelled).length).toBeLessThanOrEqual(16)
  })
  it('skips items behind the camera', () => {
    const r = beaconLayout([{ id: 'x', x: 0, y: 0, z: 10, priority: 1 }], { toScreen: () => ({ visible: false }), width: 10, height: 10 })
    expect(r[0].labelled).toBe(false); expect(r[0].alpha).toBe(0)
  })
})
```

```js
// app/src/lib/__tests__/tour.test.js
import { describe, it, expect } from 'vitest'
import { tourAt, tourDuration } from '../tour.js'

const tour = { id: 't', name: 'T', stops: [{ title: 'A', text: 'a', dwell: 5 }, { title: 'B', text: 'b', dwell: 5 }] }
const poses = [{ position: [0, 300, 0], target: [0, 0, 0] }, { position: [2000, 300, 0], target: [2000, 0, 0] }]
describe('tour playback', () => {
  it('starts dwelling on stop 0 with its card', () => {
    const s = tourAt(tour, poses, 0); expect(s.stopIndex).toBe(0); expect(s.phase).toBe('dwell'); expect(s.card.title).toBe('A')
  })
  it('flies between stops, then dwells, and finishes', () => {
    const total = tourDuration(tour, poses)
    const mid = tourAt(tour, poses, 5 + 0.5); expect(mid.phase).toBe('fly'); expect(mid.stopIndex).toBe(1)
    expect(tourAt(tour, poses, total - 0.01).card.title).toBe('B')
    expect(tourAt(tour, poses, total + 1).done).toBe(true)
  })
  it('progress rises monotonically', () => {
    let last = -1
    for (let t = 0; t < tourDuration(tour, poses); t += 0.25) { const p = tourAt(tour, poses, t).progress; expect(p).toBeGreaterThanOrEqual(last); last = p }
  })
})
```

```js
// app/src/data/__tests__/landmarks.test.js
import { describe, it, expect } from 'vitest'
import { LANDMARKS, inWorld } from '../landmarks.js'
import tours from '../tours.json'

const BBOX = { s: 41.826, w: -87.695, n: 41.952, e: -87.595 }
describe('VISIT data', () => {
  it('has CHI\'s 32 landmarks with desc, tip and category', () => {
    expect(LANDMARKS).toHaveLength(32)
    for (const l of LANDMARKS) { expect(l.desc.length).toBeGreaterThan(20); expect(l.tip.length).toBeGreaterThan(10) }
  })
  it('flags out-of-world landmarks (MSI, Hyde Park) instead of dropping them', () => {
    expect(inWorld(LANDMARKS.find((l) => /Science & Industry/.test(l.name)), BBOX)).toBe(false)
    expect(inWorld(LANDMARKS.find((l) => l.name === 'Navy Pier'), BBOX)).toBe(true)
  })
  it('ships exactly three tours, each with ≥ 5 stops and card text', () => {
    expect(tours.map((t) => t.name)).toEqual(['Architecture on the River', 'Museum Campus & the Lakefront', 'A Night in River North'])
    for (const t of tours) { expect(t.stops.length).toBeGreaterThanOrEqual(5); for (const s of t.stops) expect(s.text.length).toBeGreaterThan(20) }
  })
})
```

```jsx
// app/src/hud/__tests__/tourbar.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TourBar from '../TourBar.jsx'
import { useStore } from '../../state/store.js'

describe('tour bar', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useStore.getState().setTour({ id: 'river', t: 0, playing: true }) })
  it('pauses with the button and with Space, and exits with Esc', () => {
    render(<TourBar />)
    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    expect(useStore.getState().tour.playing).toBe(false)
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    expect(useStore.getState().tour.playing).toBe(true)
    fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' })
    expect(useStore.getState().tour).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify they fail.** Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. Tour card text: write 2–3 sentence cards per stop in the CHI data voice, drawing on CHI's landmark `desc`/`tip` where the stop matches.
- [ ] **Step 4: Run the tests to verify they pass.** Play all three tours end to end in the dev app (one heavy process). Log that every end pose respects clearance (G1).
- [ ] **Step 5: Evaluate and revert** the beacon pillars (day, dusk, night), then commit and push. `git commit -m "feat(p4): VISIT lens — beacons, landmark cards, three tours (I-4.2)"`

**Acceptance:**
- Per spec §9 VISIT, the beacons are distance-faded and collision-culled.
- A click on a beacon dives and opens the card with the nearest L.
- The three tours are playable from ⌘K and the VISIT panel, with pause, scrub and exit.

**Refresh at phase start:**
- Check which landmarks V6 and P3 added (tour stops can use `northerlyisland`, `twelfthbeach`, `natureboardwalk`).
- Check whether V6 added `beacon` anchors to the manifest.
- Check V7's keymap for Space, `,` and `.` collisions.

---

### Task 7: LIVE lens — neighbourhood zones, profiles, feel scores (I-4.3)

**Files:**
- Create: `pipeline/build/build-neighborhoods.js`, `pipeline/lib/feel.js`, `pipeline/data/neighborhoods.curated.json`, `app/src/lib/neighborhoods.js`, `app/src/world/NeighborhoodZones.jsx`, `app/src/hud/cards/NeighborhoodCard.jsx`, `app/src/hud/panels/LivePanel.jsx`
- Modify: `app/src/lib/places.js` (the ⌘K neighbourhood rows open the LIVE card as well as flying)
- Test: `pipeline/tests/feel.test.js`, `pipeline/tests/neighborhoods.test.js`, `app/src/lib/__tests__/neighborhoods.test.js`

**Interfaces:**
- Produces:
  - Boundaries: City `y6yq-dbs2` (`pri_neigh` polygons; the same source CHI uses), clipped to the world bbox, keeping ~20 zones with ≥ 60 % of their area in bounds. Community areas `igwz-8jzy` are used only to attach the official community-area name and number.
  - `neighborhoods.curated.json`: `[{ id, name, pri_neigh, chiId?, character, vibe: string[], rent: { studio?, oneBr?, twoBr?, source, asOf }, sources: [{ label, url, asOf }] }]`. It is seeded from CHI `NEIGHBORHOODS` (tagline, vibe, description) and CHI `RENT_DATA`, which is labelled "indicative, CHI ATLAS".
  - `feelScores(zones: { id, areaKm2, poiCounts: { [cat]: n }, stationCount, lineCount, parkShare: 0..1, majorRoadKmPerKm2 }[]) → { [id]: { walk, transit, nightlife, green, quiet } }`. It gives 0–10 at one decimal, rank-normalised across zones:
    - `walk` ∝ POI density of food, coffee, shops and services;
    - `transit` ∝ stations + 0.5 × lines;
    - `nightlife` ∝ drinks and nightlife density;
    - `green` ∝ `parkShare`;
    - `quiet` ∝ −(nightlife density + major-road density).
  - `neighborhoods.json`: `{ zones: [{ id, name, ring: [[x, z]…], label: [x, z], areaKm2, character, vibe, rent, feel, lines: string[], sources }], generatedFrom: [...] }`. The `label` is an interior point (a pole-of-inaccessibility approximation), and `lines` comes from `linesNear` of the label with an 800 m buffer (C17).
  - `zoneAt(x, z, zones) → zone | null`
  - `rentRangeLabel(rent) → string`:
    - all three sizes: `"Studio $1.6k · 1BR $2.1k · 2BR $3.0k"`;
    - only one known: `"1BR ≈ $2.4k (indicative)"`;
    - none: `"Rent data unavailable"`.
  - `<NeighborhoodZones/>`: one merged mesh of boundary glow ribbons (a soft 40 m inner falloff, additive, 1 draw call). The selected zone is brightened by a `uSelected` uniform. Labels go through `beaconLayout`.
  - `<NeighborhoodCard/>`: the character, vibe tags, rent label, nearest L lines (swatches), five score bars with numbers, and the sources with dates.

- [ ] **Step 1: Write the failing tests**

```js
// pipeline/tests/feel.test.js
import { describe, it, expect } from 'vitest'
import { feelScores } from '../lib/feel.js'

const zone = (id, o = {}) => ({ id, areaKm2: 1, poiCounts: { food: 10, coffee: 5, shops: 10, services: 5, drinks: 5, nightlife: 1 }, stationCount: 1, lineCount: 1, parkShare: 0.1, majorRoadKmPerKm2: 3, ...o })
describe('feelScores', () => {
  const zones = [zone('a'), zone('b', { stationCount: 4, lineCount: 5 }), zone('c', { poiCounts: { drinks: 60, nightlife: 20 }, majorRoadKmPerKm2: 8 }), zone('d', { parkShare: 0.6 })]
  const s = feelScores(zones)
  it('every zone gets all five scores in 0–10', () => {
    for (const id of ['a', 'b', 'c', 'd']) for (const k of ['walk', 'transit', 'nightlife', 'green', 'quiet']) {
      expect(s[id][k]).toBeGreaterThanOrEqual(0); expect(s[id][k]).toBeLessThanOrEqual(10)
    }
  })
  it('more stations and lines → higher transit', () => { expect(s.b.transit).toBeGreaterThan(s.a.transit) })
  it('nightlife-heavy, road-heavy zones are the least quiet', () => {
    expect(s.c.nightlife).toBe(10); expect(s.c.quiet).toBe(Math.min(...Object.values(s).map((z) => z.quiet)))
  })
  it('park share drives green', () => { expect(s.d.green).toBe(10) })
  it('is deterministic', () => { expect(feelScores(zones)).toEqual(s) })
})
```

```js
// pipeline/tests/neighborhoods.test.js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const curated = JSON.parse(readFileSync(new URL('../data/neighborhoods.curated.json', import.meta.url), 'utf8'))
describe('curated neighbourhoods', () => {
  it('~20 zones, each with character, vibe and at least one source', () => {
    expect(curated.length).toBeGreaterThanOrEqual(18); expect(curated.length).toBeLessThanOrEqual(24)
    for (const z of curated) {
      expect(z.character.length).toBeGreaterThan(20); expect(z.vibe.length).toBeGreaterThanOrEqual(2)
      expect(z.sources.length).toBeGreaterThanOrEqual(1)
      for (const s of z.sources) { expect(s.url).toMatch(/^https?:\/\//); expect(s.asOf).toMatch(/^\d{4}-\d{2}/) }
    }
  })
  it('every rent figure carries its own source and date', () => {
    for (const z of curated) if (z.rent && (z.rent.studio || z.rent.oneBr || z.rent.twoBr)) { expect(z.rent.source).toBeTruthy(); expect(z.rent.asOf).toBeTruthy() }
  })
})
```

```js
// app/src/lib/__tests__/neighborhoods.test.js
import { describe, it, expect } from 'vitest'
import { zoneAt, rentRangeLabel } from '../neighborhoods.js'

const zones = [{ id: 'loop', ring: [[0, 0], [100, 0], [100, 100], [0, 100]] }, { id: 'west', ring: [[-100, 0], [0, 0], [0, 100], [-100, 100]] }]
describe('neighbourhood helpers', () => {
  it('finds the zone under a point, or null', () => {
    expect(zoneAt(50, 50, zones).id).toBe('loop'); expect(zoneAt(-50, 50, zones).id).toBe('west'); expect(zoneAt(500, 500, zones)).toBeNull()
  })
  it('formats rent ranges honestly', () => {
    expect(rentRangeLabel({ studio: 1600, oneBr: 2100, twoBr: 3000 })).toBe('Studio $1.6k · 1BR $2.1k · 2BR $3.0k')
    expect(rentRangeLabel({ oneBr: 2400 })).toBe('1BR ≈ $2.4k (indicative)')
    expect(rentRangeLabel(null)).toBe('Rent data unavailable')
  })
})
```

- [ ] **Step 2: Run to verify they fail.** Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. Write the curated profiles in the CHI data voice. Where CHI covers a zone, start from its tagline and description; otherwise write fresh from sourced facts.
- [ ] **Step 4: Build the neighbourhoods** (`node pipeline/build/build-neighborhoods.js`; network is cached), then run the tests to verify they pass.
- [ ] **Step 5: Evaluate and revert** the zone glow (day and night, Lincoln Park and West Loop poses). Glows are soft ground light, never flat paint. Then commit and push. `git commit -m "feat(p4): LIVE lens — zones, profiles, feel scores (I-4.3)"`

**Acceptance:**
- Per spec §9 LIVE: ~20 zones with names.
- The profile card shows rent, lines and five scores.
- Every figure carries a source and date.

**Refresh at phase start:**
- Confirm the `y6yq-dbs2` field names (`pri_neigh`, `the_geom`).
- Check CHI's neighbourhood list for additions.
- Check whether a public rent-median source (by zip or community area) is reachable at build time, to replace CHI's indicative numbers.

---

### Task 8: WORK lens — commute model, isochrones, L lines by usefulness (I-4.4, C17)

**Files:**
- Create: `app/src/lib/commute.js`, `app/src/world/Isochrones.jsx`, `app/src/hud/panels/WorkPanel.jsx`
- Modify: `app/src/lib/grid.js` (`parseGridAddress`), `app/src/hud/CommandPalette.jsx` (typed addresses produce **Set office at …** and **Fly to …** rows), `app/src/world/Picker.jsx` (in WORK with "Set office" armed, a click sets the office)
- Test: `app/src/lib/__tests__/commute.test.js`, `app/src/lib/__tests__/grid.test.js` (append), `app/src/hud/__tests__/work.test.jsx`

**Interfaces:**
- Consumes: `transit.json` (CTA lines only; Metra excluded, see Rulings), `nearestStations`, `setLineGain` (Task 2), neighbourhood zones (Task 7).
- Produces:
  - `WALK = 80` m/min; `RIDE = 500` m/min (30 km/h); `TRANSFER_MIN = 4`; `MAX_WALK_M = 1600`
  - `buildCommuteGraph(transit) → { stations: Map<id, { id, x, z, lines }>, lines: Map<lineId, { stationIds: string[], s: Map<stationId, arcMetres> }> }`. Stations ≤ 200 m apart that serve different lines count as one transfer point (plus the walk minutes).
  - `commuteMinutes([ox, oz], [dx, dz], graph) → { minutes: number, mode: 'walk'|'transit', legs: [{ type: 'walk'|'ride'|'transfer', lineId?, from?, to?, minutes }], lines: string[], transfers: 0|1 }`. It always returns a finite `minutes`, falling back to the straight walk.
  - `stationMinutesTo([dx, dz], graph) → Map<stationId, minutes>` (the reverse search, used by the grid)
  - `isochroneGrid([dx, dz], graph, bounds, cell = 150) → { cols, rows, minX, minZ, cell, minutes: Float32Array }`
  - `lineUsefulness([dx, dz], graph, origins: [x, z][]) → Map<lineId, 0..1>`: the share of origins whose best route rides that line, normalised so the max is 1.
  - `rankZones([dx, dz], graph, zones) → [{ zone, minutes, lines, transfers }]`, ascending.
  - `parseGridAddress("233 S Wacker") → { x, z, label: '233 S WACKER' } | null`. It supports N/S/E/W numbers on the NS_STREETS/EW_STREETS tables; anything else returns `null`.
  - `<Isochrones/>`: one ground quad over the world bounds sampling a `DataTexture` of minutes. Shells at 15, 30 and 45 min go cyan → red, with an animated outward pulse (static on LOW or with reduced motion).
  - `<WorkPanel/>`: the **Set office** button (arms a click on the world), the office label, the label `ESTIMATE · simplified transit model`, and the ranked zones (each row opens the LIVE card). On office set, it calls `setLineGain(line, 0.6 + 0.8 × usefulness)`, and `resetLineEmphasis()` on lens exit.

- [ ] **Step 1: Write the failing tests**

```js
// app/src/lib/__tests__/commute.test.js
import { describe, it, expect } from 'vitest'
import { project } from '../../../../shared/project.js'
import { buildCommuteGraph, commuteMinutes, isochroneGrid, lineUsefulness, stationMinutesTo } from '../commute.js'

// Fixture: Red Line (Addison → Jackson) and Blue Line (Damen → Jackson), station coordinates from CTA's L-stops dataset (approx.)
const st = (id, name, lat, lon, lines) => { const [x, z] = project(lon, lat); return { id, name, x, z, lines } }
const stations = [
  st('addison-red', 'Addison', 41.947428, -87.653626, ['red']), st('belmont-red', 'Belmont', 41.939751, -87.65338, ['red']),
  st('fullerton', 'Fullerton', 41.925051, -87.652866, ['red']), st('northclybourn', 'North/Clybourn', 41.910655, -87.649177, ['red']),
  st('clarkdivision', 'Clark/Division', 41.90392, -87.631412, ['red']), st('chicago-red', 'Chicago', 41.896671, -87.628176, ['red']),
  st('grand-red', 'Grand', 41.891665, -87.628021, ['red']), st('lake-red', 'Lake', 41.884809, -87.627813, ['red']),
  st('monroe-red', 'Monroe', 41.880745, -87.627696, ['red']), st('jackson-red', 'Jackson', 41.878153, -87.627596, ['red']),
  st('damen-blue', 'Damen', 41.909744, -87.677437, ['blue']), st('division-blue', 'Division', 41.903355, -87.666496, ['blue']),
  st('chicago-blue', 'Chicago', 41.896075, -87.655214, ['blue']), st('grand-blue', 'Grand', 41.891189, -87.647578, ['blue']),
  st('clarklake', 'Clark/Lake', 41.885737, -87.630886, ['blue']), st('washington-blue', 'Washington', 41.883164, -87.62944, ['blue']),
  st('monroe-blue', 'Monroe', 41.880703, -87.629378, ['blue']), st('jackson-blue', 'Jackson', 41.878183, -87.629296, ['blue']),
]
const line = (id, ids) => ({ id, kind: 'cta', stations: ids, paths: [{ id: `${id}-0`, points: ids.map((s) => { const x = stations.find((q) => q.id === s); return [x.x, x.z] }) }] })
const transit = { stations, lines: [
  line('red', ['addison-red', 'belmont-red', 'fullerton', 'northclybourn', 'clarkdivision', 'chicago-red', 'grand-red', 'lake-red', 'monroe-red', 'jackson-red']),
  line('blue', ['damen-blue', 'division-blue', 'chicago-blue', 'grand-blue', 'clarklake', 'washington-blue', 'monroe-blue', 'jackson-blue']),
] }
const graph = buildCommuteGraph(transit)
const at = (lat, lon) => project(lon, lat)

describe('commute model (spec §9)', () => {
  it('Wrigleyville → Loop rides the Red Line with no transfer, 15–30 min', () => {
    const r = commuteMinutes(at(41.9474, -87.6563), at(41.8818, -87.6298), graph)
    expect(r.mode).toBe('transit'); expect(r.lines).toEqual(['red']); expect(r.transfers).toBe(0)
    expect(r.minutes).toBeGreaterThanOrEqual(15); expect(r.minutes).toBeLessThanOrEqual(30)
  })
  it('a short hop walks (Streeterville → Mag Mile)', () => {
    const r = commuteMinutes(at(41.8927, -87.6197), at(41.8953, -87.6242), graph)
    expect(r.mode).toBe('walk'); expect(r.minutes).toBeLessThan(15)
  })
  it('Wicker Park → Clark/Division uses at most one transfer (Blue ↔ Red at Jackson)', () => {
    const r = commuteMinutes(at(41.9088, -87.6776), at(41.9040, -87.6300), graph)
    expect(r.transfers).toBeLessThanOrEqual(1); expect(Number.isFinite(r.minutes)).toBe(true)
  })
  it('an office in the lake or beyond any station still returns a finite walking estimate', () => {
    const r = commuteMinutes(at(41.9474, -87.6563), at(41.88, -87.55), graph)
    expect(Number.isFinite(r.minutes)).toBe(true); expect(r.minutes).toBeGreaterThan(0)
  })
  it('transfer costs +4 min', () => {
    const r = commuteMinutes(at(41.9088, -87.6776), at(41.9040, -87.6300), graph)
    if (r.transfers === 1) expect(r.legs.find((l) => l.type === 'transfer').minutes).toBeGreaterThanOrEqual(4)
  })
})

describe('isochrones and usefulness', () => {
  const dest = at(41.8818, -87.6298)
  it('the destination cell is ~0 min and every cell is finite', () => {
    const g = isochroneGrid(dest, graph, { minX: dest[0] - 3000, maxX: dest[0] + 3000, minZ: dest[1] - 3000, maxZ: dest[1] + 3000 }, 150)
    const c = Math.floor((dest[0] - g.minX) / g.cell), r = Math.floor((dest[1] - g.minZ) / g.cell)
    expect(g.minutes[r * g.cols + c]).toBeLessThan(2)
    expect([...g.minutes].every(Number.isFinite)).toBe(true)
  })
  it('stations on the destination line are reachable faster than stations on the other line at similar distance', () => {
    const m = stationMinutesTo(dest, graph)
    expect(m.get('addison-red')).toBeLessThan(m.get('damen-blue') + 15)
  })
  it('with a Loop office and north-side origins, Red is the most useful line', () => {
    const u = lineUsefulness(dest, graph, [at(41.9474, -87.6563), at(41.9400, -87.6530), at(41.9214, -87.6513)])
    expect(u.get('red')).toBe(1); expect(u.get('blue') ?? 0).toBeLessThan(1)
  })
})
```

```js
// append to app/src/lib/__tests__/grid.test.js
import { parseGridAddress, M_PER_NUMBER } from '../grid.js'
it('parses grid addresses into world metres', () => {
  const r = parseGridAddress('233 S Wacker')
  expect(r.label).toBe('233 S WACKER'); expect(r.z).toBeCloseTo(233 * M_PER_NUMBER, 0); expect(r.x).toBeCloseTo(-360 * M_PER_NUMBER, 0)
  expect(parseGridAddress('800 N Michigan').z).toBeCloseTo(-800 * M_PER_NUMBER, 0)
  expect(parseGridAddress('pizza')).toBeNull()
})
```

```jsx
// app/src/hud/__tests__/work.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WorkPanel from '../panels/WorkPanel.jsx'
import { useStore } from '../../state/store.js'

describe('WORK panel', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useStore.getState().setLens('WORK') })
  it('arms "Set office" and always shows the estimate label', () => {
    render(<WorkPanel />)
    expect(screen.getByText('ESTIMATE · simplified transit model')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /set office/i }))
    expect(useStore.getState().officeArmed).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify they fail.** Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. Add `officeArmed` and `setOfficeArmed` to the store. The isochrone grid is computed on the main thread, memoised per office. It must stay ≤ 30 ms for the full world at 150 m (log it); if it is over, move it to a Web Worker.
- [ ] **Step 4: Run the tests to verify they pass.** Evaluate and revert the isochrone shells and the line brightening (the Loop at 1.5 km, day and night).
- [ ] **Step 5: Commit and push.** `git commit -m "feat(p4): WORK lens — commute model, isochrones, useful lines brighten (I-4.4)"`

**Acceptance:**
- Per spec §9 WORK and §12, the Wrigleyville → Loop test passes via Red.
- The office can be set by button-then-click or by ⌘K address.
- Lines brighten by usefulness and reset on exit.

**Refresh at phase start:**
- Read the actual `transit.json` station and line ordering from V3 (whether a line lists stations per branch, and how the Loop direction is encoded).
- Replace the fixture's `transit` shape with V3's, keeping the same coordinates.
- Confirm that `project` is still exported from `shared/project.js`.

---

### Task 9: Phase close — controls audit, perf, gallery, push

**Files:**
- Modify: `app/src/hud/HelpOverlay.jsx`, `app/src/hud/HintBar.jsx`, `README.md`, `docs/screenshots/p4-*.png` (append only)
- Test: `app/src/hud/__tests__/help.test.jsx` (append)

**Interfaces:**
- Consumes: everything above.
- Produces: the help card's **Guide** group lists the lens rail, hover and click cards, Places plus the filters, Tours (Space, `,`/`.`, Esc), and Set office. The hint bar gains `Hover — building info`.

- [ ] **Step 1: Write the failing test**

```jsx
// append to app/src/hud/__tests__/help.test.jsx
it('help card documents every Phase 4 control in plain words', () => {
  useStore.getState().setHelpOpen(true)
  render(<HelpOverlay />)
  for (const t of [/lens rail/i, /hover a building/i, /places/i, /tour/i, /set office/i]) expect(screen.getByText(t)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails.** Then update the help and hint copy, and run it to pass.
- [ ] **Step 3: Run the end-of-phase checklist** (below).
- [ ] **Step 4: README.** Append `p4-visit-beacons-dusk.png`, `p4-live-zones-night.png`, `p4-work-isochrones-day.png` and `p4-hover-card.png` to "How it came together", with captions. Tick Phase 4 in the roadmap.
- [ ] **Step 5: Commit and push.** `git commit -m "feat(p4): guide lenses complete — help, gallery, perf log"`, then `git push origin main`.

**Acceptance:**
- I-4.1–I-4.6 are ticked, and C17's four integrations each have a test: nearest-L in the building, landmark and POI cards (Task 2 and Task 3); LIVE lines (Task 7); WORK brightening (Task 8); alert pulses (Task 2).

**Refresh at phase start:** check V7's final help-card group names, and fold the **Guide** group into the existing layout without overflowing at 1280×800.

---

## End-of-phase checklist

1. `npm test --prefix pipeline` and `npm test --prefix app` are green.
2. The world build passes (skyline assertion) with the `pois` sidecars and `neighborhoods.json`.
3. e2e: new `hover.spec.js`, plus a `lens.spec.js` pose "Scan over LIVE", which moves to P5 and is recorded here as a LIVE-without-scan baseline. Get 3 consecutive green runs.
4. Perf at the wide Streeterville and Loop poses, each lens on, pins on: ≤ 900 draw calls, ≤ 4 M triangles, 60 fps. Log each lens's delta.
5. Evaluate-and-revert lines for pins, beacons, zones, isochrones and line emphasis.
6. Push.

## Rulings made while writing this plan

- Ruling: places come from a build-time OSM amenity fetch (every named amenity in 10 categories), with CHI `/api/places` merged live when reachable. CHI's endpoint is itself OSM-backed and capped at 150, so it cannot be the primary source for "everything". Cost if wrong: new venues appear only after a rebuild, unless CHI is live.
- Ruling: Phase 4 introduces only `chiGet`, which never throws. Phase 5 owns the health probe, the `LIVE`/`SIMULATED` chip and the scheduler. Cost if wrong: Phase 4's two direct pollers (alerts, places) migrate once in Phase 5 Task 1.
- Ruling: picking is a CPU raycast with `three-mesh-bvh` (lazy BVH per tile mesh), not a GPU ID pass, because a GPU pass would re-draw every tile and threaten the 900-call budget. Cost if wrong: +1 dependency and a ~10–30 ms BVH build on the first hover per tile.
- Ruling: lenses have no single-letter keys (W is movement). They are reached by the lens-rail buttons and ⌘K. Cost if wrong: power users take one extra step.
- Ruling: the commute model uses CTA L lines only. Metra is excluded, because its headways make a fixed 30 km/h plus walk model misleading. Cost if wrong: some Metra-served commutes (South Loop to West Loop via Union Station) are overestimated. The label says ESTIMATE.
- Ruling: rent figures show only what is sourced. CHI's single `avgRent` is shown as "1BR ≈ … (indicative)", never spread across studio or 2BR. Cost if wrong: sparse rent rows until a public median source is added.
- Ruling: the WORK lens does not use a jobs feed, because CHI has none (`/api/finance/indicators` is static city-wide indicators). Cost if wrong: none for the spec; a future jobs layer needs a new source.
- Ruling: CHI landmarks outside the world bounds (MSI, Hyde Park, Robie House, Garfield Park Conservatory and others) are listed as "Beyond the map", with no beacon, until Phase 6. Cost if wrong: none.
- Ruling: tour playback yields to any movement key (exit to FLY), the same as flights. Space, `,`, `.` and Esc are tour-only keys. Cost if wrong: a stray arrow key ends a tour, but the Resume button restores it at the same stop.
