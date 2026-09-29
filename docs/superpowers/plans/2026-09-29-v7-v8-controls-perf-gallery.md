# V7 · Controls Integration and V8 · Performance, Gallery, Final Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- **V7:** fold every control that V3–V6 added (Transit, Sound and Games dock buttons; the ⌘K Transit, Games and Landmarks groups; help-card and hint-bar lines) into one HUD system. It must fit every window size, and follow-train and venue focus must respect camera clearance (backlog G3, G6).
- **V8:** bring the complete scene to ≤ 900 draw calls at wide shots. Finish the README gallery (with a bridges caption), roadmap and badges. Then run one fresh whole-pass review with a single fix pass (H11, A10, A13).

**Architecture:**
- **V7:**
  - One registry, `app/src/hud/featureControls.js`, lists each city-life feature: its label, key, icon, help line, hint and its on/off adapter.
  - The dock row, keyboard hook, ⌘K commands, help card and hint bar are all rendered from it, so a control can never exist in one place and be missing in another.
  - Panels that V3–V6 placed around the screen move into one scrollable left column (`.hud-left-stack`).
  - The hint bar keeps only the hints that fit between the side columns (`fitHints`).
  - Follow-train and venue-focus poses pass through `ensureClear` on V1's `clearanceAt`.
- **V8:**
  - An exact per-frame draw probe (`gl.info.autoReset = false`, reset once per frame after the composer) drives a perf chip and an e2e budget test.
  - Two levers cut calls:
    - per-tile instanced props (trees, roof props, L bents, and any per-tile instancing V3–V6 added) become pooled `InstancedMesh`es, one per kind per 2 km block;
    - LOD1 tiles are batched into 1 km quads (pipeline format change, manifest v7).
  - A third, conditional lever caps LOD0 tiles at HIGH.

**Tech Stack:**
- App: React 19, React Three Fiber 9, three 0.186, `@react-three/postprocessing` 3 / `postprocessing` 6, zustand 5, react-icons/ri, Vitest 5 + RTL (jsdom).
- e2e: Playwright 1.63 (Chrome, Metal).
- Pipeline: Node 22 (`@gltf-transform` 4.5 + meshopt).

**Spec:** `docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md`: Addendum B.1 (budgets, human-first, README rules), B.3 (transit controls), B.4 (sports controls), B.7 (camera clearance) and Addendum A.5 (streaming). The master plan `docs/superpowers/plans/2026-09-29-vision-master-plan.md` is binding. Backlog: `docs/superpowers/backlog/2026-09-29-vision-backlog.md` (G3, G6, H11, A10, A13).

## Global Constraints

- **No human in the loop.** Record every decision as a `Ruling:` line with its cost if wrong, in the ledger `.superpowers/sdd/2026-09-29-v7-v8-controls-perf-gallery/progress.md`.
- **RAM discipline:**
  - One heavy process at a time: the world build, or the dev server + Playwright, never both.
  - Close browsers when done.
- **Budgets (B.1.6):**
  - HIGH: ≤ 900 draw calls per frame, counting the shadow and post passes. Measured at the wide Streeterville, wide Loop and densest poses.
  - ≤ 4 M triangles per frame, 60 fps target on M-series.
  - `app/public/world` ≤ 200 MB.
  - Every new system keeps a LOW fallback.
- **Measure draw calls exactly** with `gl.info.autoReset = false` over one frame. `EffectComposer` renders several passes, and three resets `renderer.info` on every `render()` while `autoReset` is on.
- **Responsive HUD:**
  - `app/src/lib/hudScale.js` stays the scaling rule (design 1280×800, min 0.55, compact below a 1150 layout width).
  - Verify at 1440×900, 1280×720, 1024×640, 800×600 and 600×900 with nothing cut off and nothing overlapping.
- **Human-first (A11 + memory rule):**
  - Every feature has a button, a ⌘K entry, a help-card line and (space permitting) a hint.
  - URL parameters are for tests only.
- **README is history:**
  - Never modify an existing image in `docs/screenshots/`.
  - New images are `docs/screenshots/v<N>-<subject>-<time>.png`.
  - Keep the current layout and hero.
- **Evaluate and revert** for every visual change (fixed poses, day/dusk/night); reverts get their own commit and a ledger line.
- **TDD:** a failing test first for every pure function and state machine.
- **Commit trailer on every commit:** `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Push `origin main` at the end of V7 and at the end of V8.**

## Review Focus

1. **Typing in the ⌘K search field (or any input) must never toggle Transit, Games or Sound.** Otherwise the letters `t`, `g` and `m` in "Clark/Lake", "games" or "Museum" would flip features. **Pinned:** Task 3, test `typing in an input never toggles a feature`.
2. **Two listeners on the same key.** A leftover V3–V6 handler plus the registry hook would toggle twice per press, which a person sees as "the button does nothing". **Pinned:** Task 3, test `one key press toggles exactly once in the full HUD`.
3. **A tile unloading while its pooled instances sit in the middle of a block pool.** The swap-remove must keep every *other* tile's trees and props exactly where they were. A block with more instances than the pool holds must drop the extras without throwing. **Pinned:** Task 11, tests `removal keeps other tiles' instances intact` and `overflow drops extras and reports them`.
4. **A cached v6 manifest with no `quads`.** Streaming must fall back to per-tile LOD1 splitting, with no holes and no crash. **Pinned:** Task 12, test `falls back to LOD1 tiles when the manifest has no quads`.
5. **Turning the perf chip off.** It must restore `gl.info.autoReset = true`, or three's counters grow without bound and every later reading is wrong. **Pinned:** Task 9, test `stop() restores autoReset`.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `app/src/hud/featureControls.js` | create | The feature registry (Transit, Games, Sound): label, key, icon, help, hint, `use()`, `isOn()`, `toggle()` |
| `app/src/hud/useFeatureKeys.js` | create | `featureForKey(event)` plus the one keydown hook for all features |
| `app/src/lib/paletteSources.js` | create | Every feature's ⌘K entries in one place: `featurePlaces(state)`, `featureCommands()` |
| `app/src/lib/hints.js` | create | `ALL_HINTS`, `hintWidth`, `hintMaxWidth`, `fitHints` |
| `app/src/lib/poseClearance.js` | create | `ensureClear(pose, clearanceAt, margin)`, `clearedFollowPose`, `clearedVenuePose` |
| `app/src/hud/ControlDock.jsx` / `.css` | modify | Feature row rendered from the registry |
| `app/src/hud/CommandPalette.jsx` | modify | Groups Landmarks → Transit → Games → Neighborhoods → Views → Commands; feature sources |
| `app/src/lib/places.js` | modify | `searchPlaces` shows transit and game entries on an empty query; tie bonuses |
| `app/src/hud/HelpOverlay.jsx` | modify | "City life" group from the registry, plus the follow and click lines |
| `app/src/hud/HintBar.jsx` | modify | `fitHints` by layout width |
| `app/src/hud/Hud.jsx` / `Hud.css` | modify | `useFeatureKeys()`, `.hud-left-stack`, perf chip, hint width |
| `app/e2e/hud-layout.spec.js` | create | Five window sizes: nothing off-screen, nothing overlapping, no clipped dock labels |
| `app/src/lib/drawProbe.js` | create | `createDrawProbe(info)`: exact calls and triangles per frame |
| `app/src/lib/drawCensus.js` | create | `censusScene(scene, camera)`: visible draw objects by category |
| `app/src/world/PerfProbe.jsx` | create | `useFrame` at priority 1000 (after the composer): samples, publishes `perf`, `window.__perf`, `window.__census` |
| `app/src/hud/PerfOverlay.jsx` | create | Perf chip (`812 DRAW · 2.1M TRIS · 60 FPS`) |
| `app/src/lib/perfPoses.js` | create (or reuse V1's) | `PERF_POSES`: wideStreeterville, wideLoop, densest |
| `app/e2e/perf.spec.js` | create | Budget test: ≤ 900 calls, ≤ 4 M triangles at the three poses |
| `app/src/world/instancePool.js` | create | `createInstancePool`: add/remove with swap-remove compaction, overflow count |
| `app/src/world/pools.js` | create | Pools per (kind, 2 km block); subscribe/snapshot for React; empty-pool release |
| `app/src/world/InstancePools.jsx` | create | Renders every pool mesh |
| `app/src/world/Trees.jsx`, `RoofProps.jsx`, `ElevatedL.jsx`, `TileContent.jsx`, `TileStreamer.jsx`, `Scene.jsx` | modify | Register into pools; quad ids; mount probe and pools |
| `pipeline/lib/tilepack.js` | modify | `QUAD_TILES = 2`, `quadKeyFor` |
| `pipeline/build/build-world.js` | modify | Writes `quads/<qk>.glb`; tiles get `quad`; manifest v7 |
| `app/src/lib/tilePlan.js` | modify | `planWorld` block → quad → tile hierarchy with fallback; `makeBoundsOf` |
| `README.md` | modify | Gallery ("V7 · Controls", "Vision pass complete" with the bridges caption), roadmap, badges |

---

## Milestone V7 — Controls integration and help

### Task 0: Pre-flight — map what V3–V6 shipped

**Files:**
- Create: `.superpowers/sdd/2026-09-29-v7-v8-controls-perf-gallery/progress.md` (ledger, gitignored)

**Interfaces:**
- Consumes: the V3–V6 code on `main`.
- Produces: the **name map** that Tasks 1–7 use. The code in this plan uses the contract names below, which come from Addendum B and the coordinator's fixed interfaces (`clearanceAt`, the `_STYLE` palette, `soundStore.soundOn`). Where the shipped name differs, change **only** the adapter line or import named in the "Used in" column, and record a `Ruling:`.

| Concept | Contract name used in this plan | Used in |
|---|---|---|
| Transit on/off (C13) | `useStore` → `transitOn`, `setTransitOn(bool)` | `featureControls.js` transit adapter |
| Sound on/off (C18/D10) | `useSoundStore` from `app/src/audio/soundStore.js` → `soundOn`, `setSoundOn(bool)` | `featureControls.js` sound adapter |
| Games panel (D12) | `useStore` → `gamesOpen`, `setGamesOpen(bool)` | `featureControls.js` games adapter |
| Transit ⌘K entries (C14) | `transitPlaces(state)` from `app/src/transit/palette.js` | `paletteSources.js` |
| Games ⌘K entries (D12) | `gamePlaces(state)` from `app/src/sports/palette.js` | `paletteSources.js` |
| Follow-train pose (C15) | `followPose(...)` from `app/src/transit/followCam.js` | `poseClearance.js` |
| Venue focus pose (V5) | `venueFocusPose(...)` from `app/src/sports/venueFocus.js` | `poseClearance.js` |
| Clearance (G1) | `clearanceAt(x, z)` from `app/src/lib/clearance.js` | `poseClearance.js`, Task 7 test mock path |
| Side panels (C13 legend, C16 train/station card, D12 venue card) | whatever components V3–V5 mounted in `Hud.jsx` | Task 6 move into `.hud-left-stack` |

- [ ] **Step 1: Scan.**

Run:
```bash
cd /Users/connorevans/Downloads/Chicago_open_world/app/src && \
grep -rn "transitOn\|setTransitOn\|soundOn\|setSoundOn\|gamesOpen\|setGamesOpen" --include=*.js --include=*.jsx . | grep -v __tests__ | head -40; \
grep -rln "export function .*Places\|export const .*Places" . | head; \
grep -rn "export function followPose\|export function venueFocusPose\|export function clearanceAt\|export const clearanceAt" . | head; \
grep -rn "KeyT\|KeyG\|KeyM\|'t'\|'g'\|'m'" --include=*.jsx --include=*.js . | grep -v __tests__ | head; \
sed -n 1,60p hud/Hud.jsx; ls ../e2e lib; git -C .. log --oneline -30
```
Expected: every row of the table above resolves to a real file and name.

- [ ] **Step 2: Record the map.**

Write the ledger with one line per table row: `name map: <concept> = <file>:<export or field>`. Add one `Ruling:` line for each deviation from the contract name, with cost if wrong "one adapter line to change".

Also record:
- which V3–V6 components render dock buttons, keyboard handlers or panels (they are consolidated in Tasks 2, 3 and 6);
- `BASE_SHA`, the commit before V1 started. Take it from `.superpowers/sdd/2026-09-29-vision-master-plan/progress.md` if V1 recorded it. Otherwise use `git log -1 --format=%H -- docs/superpowers/backlog/2026-09-29-vision-backlog.md`.

- [ ] **Step 3: Note the "before" HUD capture.**

The V7 "before" HUD shots are taken in Task 6 · Step 2. They run on the pre-consolidation layout, because the spec's screenshot happens before its assertions. Ledger: `V7 T0: name map recorded; before-v7 shots scheduled for Task 6 · Step 2`.

---

### Task 1: The feature-control registry (G3)

**Files:**
- Create: `app/src/hud/featureControls.js`
- Test: `app/src/hud/__tests__/featureControls.test.js`

**Interfaces:**
- Consumes: the store fields from the Task 0 map.
- Produces: `FEATURE_CONTROLS: Array<FeatureControl>` and `featureById(id): FeatureControl | undefined`, where a FeatureControl is:
  ```
  {
    id, label, key /* KeyboardEvent.code */, keyLabel, icon, iconOff?, help, hint,
    use(): boolean   /* React hook */,
    isOn(): boolean,
    toggle(): void
  }
  ```

- [ ] **Step 1: Write the failing test.**

```js
// app/src/hud/__tests__/featureControls.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { FEATURE_CONTROLS, featureById } from '../featureControls.js'
import { useStore } from '../../state/store.js'
import { useSoundStore } from '../../audio/soundStore.js'

describe('feature controls registry', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useSoundStore.setState(useSoundStore.getInitialState()) })
  it('lists Transit, Games and Sound with unique keys and every path filled in', () => {
    expect(FEATURE_CONTROLS.map((c) => c.id)).toEqual(['transit', 'games', 'sound'])
    expect(new Set(FEATURE_CONTROLS.map((c) => c.key)).size).toBe(3)
    for (const c of FEATURE_CONTROLS) {
      expect(c.label).toMatch(/^[A-Z][a-z]+$/)
      expect(c.keyLabel).toHaveLength(1)
      expect(c.help.length).toBeGreaterThan(10)
      expect(c.hint.length).toBeGreaterThan(2)
      expect(typeof c.icon).toBe('function')
    }
  })
  it('toggle flips the real state and isOn reads it', () => {
    for (const c of FEATURE_CONTROLS) {
      const before = c.isOn()
      c.toggle()
      expect(c.isOn()).toBe(!before)
      c.toggle()
      expect(c.isOn()).toBe(before)
    }
  })
  it('sound starts off (browsers block autoplay; nobody is surprised by noise)', () => {
    expect(featureById('sound').isOn()).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app -- featureControls`
Expected: FAIL with the module `../featureControls.js` not found.

- [ ] **Step 3: Write the implementation.**

```js
// app/src/hud/featureControls.js — every city-life feature and every way to reach it (backlog G3).
// The dock row, the keyboard, ⌘K, the help card and the hint bar all read this list, so a control can never be added
// in one place and forgotten in another. The three adapters (isOn/toggle/use) are the only lines naming V3–V5 state.
import { RiTrainLine, RiBaseballLine, RiVolumeUpLine, RiVolumeMuteLine } from 'react-icons/ri'
import { useStore } from '../state/store.js'
import { useSoundStore } from '../audio/soundStore.js'

const storeFlag = (field, setter) => ({
  use: () => useStore((s) => Boolean(s[field])),
  isOn: () => Boolean(useStore.getState()[field]),
  toggle: () => { const s = useStore.getState(); s[setter](!s[field]) },
})

export const FEATURE_CONTROLS = [
  { id: 'transit', label: 'Transit', key: 'KeyT', keyLabel: 'T', icon: RiTrainLine, hint: 'transit',
    help: 'show or hide the L and Metra lines, their glow and the trains', ...storeFlag('transitOn', 'setTransitOn') },
  { id: 'games', label: 'Games', key: 'KeyG', keyLabel: 'G', icon: RiBaseballLine, hint: 'games',
    help: "today's games — scores, and a flight to the ballpark", ...storeFlag('gamesOpen', 'setGamesOpen') },
  { id: 'sound', label: 'Sound', key: 'KeyM', keyLabel: 'M', icon: RiVolumeUpLine, iconOff: RiVolumeMuteLine, hint: 'sound',
    help: 'crowd cheers and passing trains — off until you turn it on',
    use: () => useSoundStore((s) => Boolean(s.soundOn)),
    isOn: () => Boolean(useSoundStore.getState().soundOn),
    toggle: () => { const s = useSoundStore.getState(); s.setSoundOn(!s.soundOn) } },
]

export const featureById = (id) => FEATURE_CONTROLS.find((c) => c.id === id)
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app -- featureControls`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add app/src/hud/featureControls.js app/src/hud/__tests__/featureControls.test.js
git commit -m "feat(hud): one registry for Transit, Games and Sound controls (G3)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Dock feature row (replaces the scattered V3–V5 buttons)

**Files:**
- Modify: `app/src/hud/ControlDock.jsx`, `app/src/hud/ControlDock.css`
- Modify: every V3–V5 file that Task 0 recorded as rendering its own Transit, Sound or Games button. Delete those buttons, since the registry row replaces them.
- Test: `app/src/hud/__tests__/hud.test.jsx` (append)

**Interfaces:**
- Consumes: `FEATURE_CONTROLS` (Task 1).
- Produces: `.dock-row.features` with one `button.dock-btn.feature` per control. Each button has `aria-pressed` set to the state and `aria-label` set to `"<Label> (<Key>)"`.

- [ ] **Step 1: Write the failing test (append to `hud.test.jsx`).**

```js
import { FEATURE_CONTROLS } from '../featureControls.js'
describe('dock feature row (G3)', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('has exactly one button per feature anywhere in the HUD, pressed state tracks the feature', () => {
    render(<Hud />)
    for (const c of FEATURE_CONTROLS) {
      const btns = screen.getAllByRole('button', { name: new RegExp(`^${c.label} \\(${c.keyLabel}\\)$`) })
      expect(btns).toHaveLength(1)
      const was = c.isOn()
      expect(btns[0]).toHaveAttribute('aria-pressed', String(was))
      fireEvent.click(btns[0])
      expect(c.isOn()).toBe(!was)
      expect(screen.getByRole('button', { name: new RegExp(`^${c.label} \\(`) })).toHaveAttribute('aria-pressed', String(!was))
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app -- hud`
Expected: FAIL. Either `Unable to find role="button" and name /^Transit \(T\)$/`, or (if V3 left its own button) `expected length 1, got 2` once the row is added. The second failure is fixed by deleting the V3–V5 buttons.

- [ ] **Step 3: Implement.**

In `ControlDock.jsx`, add:
```jsx
import { FEATURE_CONTROLS } from './featureControls.js'

function FeatureBtn({ c }) {
  const on = c.use()
  const Icon = !on && c.iconOff ? c.iconOff : c.icon
  return (
    <button type="button" className={`dock-btn feature${on ? ' on' : ''}`} aria-pressed={on}
      aria-label={`${c.label} (${c.keyLabel})`} title={`${c.label} (${c.keyLabel}) — ${c.help}`} onClick={c.toggle}>
      <Icon /><span>{c.label}</span>
    </button>
  )
}
```
Then render this as the first row after the Search button:
```jsx
      <div className="dock-row features" role="group" aria-label="City life">
        {FEATURE_CONTROLS.map((c) => <FeatureBtn key={c.id} c={c} />)}
      </div>
```

Append to `ControlDock.css`:
```css
.dock-row.features .dock-btn { flex-direction: column; height: 40px; gap: 2px; font-size: 9px; letter-spacing: 0.06em; padding: 0 2px; }
.dock-row.features .dock-btn svg { font-size: 15px; }
.dock-btn.feature.on { color: var(--accent); border-color: rgba(var(--accent-rgb), 0.45); background: rgba(var(--accent-rgb), 0.1); }
```

Delete the per-feature buttons that V3–V5 added (from the Task 0 list), keeping their state and logic.

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app`
Expected: PASS (all). Any V3–V5 test that clicked the deleted button is updated to click `getByRole('button', { name: /^Transit \(T\)$/ })` (or Games/Sound), which is the same behaviour through the new path.

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add -A app/src
git commit -m "feat(hud): Transit, Games and Sound live in one dock row with pressed state (G3)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: One keyboard path for all features

**Files:**
- Create: `app/src/hud/useFeatureKeys.js`
- Modify: `app/src/hud/Hud.jsx` (call `useFeatureKeys()`)
- Modify: the V3–V5 files with their own T/G/M (or other) feature key handlers, from Task 0. Delete those handlers.
- Test: `app/src/hud/__tests__/featureKeys.test.jsx`

**Interfaces:**
- Consumes: `FEATURE_CONTROLS`.
- Produces:
  - `featureForKey(e: KeyboardEvent): FeatureControl | null`. It returns `null` for modifier chords, for typing targets (`INPUT`, `TEXTAREA`, `contenteditable`) and while the palette is open.
  - `useFeatureKeys(): void`.

- [ ] **Step 1: Write the failing test.**

```jsx
// app/src/hud/__tests__/featureKeys.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import Hud from '../Hud.jsx'
import { featureForKey } from '../useFeatureKeys.js'
import { featureById } from '../featureControls.js'
import { useStore } from '../../state/store.js'

describe('feature keys', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('maps T, G, M by physical key; ignores chords', () => {
    expect(featureForKey({ code: 'KeyT', target: document.body }).id).toBe('transit')
    expect(featureForKey({ code: 'KeyG', target: document.body }).id).toBe('games')
    expect(featureForKey({ code: 'KeyM', target: document.body }).id).toBe('sound')
    expect(featureForKey({ code: 'KeyT', metaKey: true, target: document.body })).toBeNull()
    expect(featureForKey({ code: 'KeyX', target: document.body })).toBeNull()
  })
  it('typing in an input never toggles a feature', () => {
    const input = document.createElement('input')
    expect(featureForKey({ code: 'KeyT', target: input })).toBeNull()
    const ta = document.createElement('textarea')
    expect(featureForKey({ code: 'KeyG', target: ta })).toBeNull()
    const div = document.createElement('div'); div.contentEditable = 'true'
    expect(featureForKey({ code: 'KeyM', target: div })).toBeNull()
    useStore.setState({ paletteOpen: true })
    expect(featureForKey({ code: 'KeyT', target: document.body })).toBeNull()
  })
  it('one key press toggles exactly once in the full HUD', () => {
    render(<Hud />)
    const t = featureById('transit'), was = t.isOn()
    fireEvent.keyDown(window, { code: 'KeyT', key: 't' })
    expect(t.isOn()).toBe(!was)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app -- featureKeys`
Expected: FAIL with the module `../useFeatureKeys.js` not found.

- [ ] **Step 3: Implement.**

```js
// app/src/hud/useFeatureKeys.js — T / G / M toggle Transit, Games and Sound; never while typing or searching.
import { useEffect } from 'react'
import { FEATURE_CONTROLS } from './featureControls.js'
import { useStore } from '../state/store.js'

export function featureForKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  const t = e.target
  if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable || t.contentEditable === 'true')) return null
  if (useStore.getState().paletteOpen) return null
  return FEATURE_CONTROLS.find((c) => c.key === e.code) ?? null
}

export function useFeatureKeys() {
  useEffect(() => {
    const on = (e) => { if (e.repeat) return; const c = featureForKey(e); if (c) c.toggle() }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
}
```

In `Hud.jsx`, add `import { useFeatureKeys } from './useFeatureKeys.js'` and call `useFeatureKeys()` as the first line of `Hud()`. Delete the per-feature key handlers that V3–V5 added (Task 0 list).

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app`
Expected: PASS (all). If the "exactly once" test fails with `expected true to be false`, a second listener survives. Remove it and re-run.

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add -A app/src
git commit -m "feat(hud): one keyboard path — T transit, G games, M sound; never while typing (G3)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: ⌘K groups — Landmarks, Transit, Games

**Files:**
- Create: `app/src/lib/paletteSources.js`
- Modify: `app/src/hud/CommandPalette.jsx`, `app/src/lib/places.js`
- Test: `app/src/hud/__tests__/palette.test.jsx` (append), `app/src/lib/__tests__/places.test.js` (append)

**Interfaces:**
- Consumes:
  - `transitPlaces(state)` and `gamePlaces(state)` (Task 0 map). Each returns `{ id, name, sub, pose?, run?, aliases? }[]`.
  - `FEATURE_CONTROLS`.
- Produces:
  - `featurePlaces(state): Place[]`: transit entries forced to `kind: 'transit'`, games to `kind: 'game'`.
  - `featureCommands(): Place[]`: one `"<Label>: on / off"` command per feature.
  - The palette's section order: Landmarks, Transit, Games, Neighborhoods, Views, Commands.

- [ ] **Step 1: Write the failing tests.**

Append to `app/src/hud/__tests__/palette.test.jsx`:
```jsx
import { vi } from 'vitest'
vi.mock('../../lib/paletteSources.js', () => ({
  featurePlaces: () => [
    { id: 'st:clark', kind: 'transit', name: 'Clark/Lake', sub: 'Station · Blue Brown Green Orange Pink Purple', pose: { position: [0, 120, 300], target: [0, 10, 0] } },
    { id: 'g:cubs', kind: 'game', name: "Go to tonight's game", sub: 'Cubs · Wrigley Field', pose: { position: [-2000, 200, -7000], target: [-2279, 10, -7372] } },
  ],
  featureCommands: () => [{ id: 'f:transit', kind: 'command', name: 'Transit: on / off', sub: 'T', run: () => {} }],
}))
describe('⌘K groups (G3)', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useStore.setState({ manifest }) })
  it('empty query shows Landmarks, then Transit, then Games', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const heads = [...document.querySelectorAll('.cmdk-section')].map((e) => e.textContent)
    expect(heads.slice(0, 3)).toEqual(['Landmarks', 'Transit', 'Games'])
  })
  it('stations, games and feature toggles are searchable', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'clark' } })
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Clark/Lake')
    fireEvent.change(input, { target: { value: 'tonight' } })
    expect(screen.getAllByRole('option')[0]).toHaveTextContent("Go to tonight's game")
    fireEvent.change(input, { target: { value: 'transit' } })
    expect(screen.getAllByRole('option').map((o) => o.textContent).join()).toMatch(/Transit: on \/ off/)
  })
})
```

Append to `app/src/lib/__tests__/places.test.js`:
```js
describe('searchPlaces with feature entries', () => {
  it('an empty query lists transit and game entries too', async () => {
    const { searchPlaces } = await import('../places.js')
    const P = [{ id: 'a', kind: 'view', name: 'V' }, { id: 'b', kind: 'transit', name: 'Clark/Lake' }, { id: 'c', kind: 'game', name: 'Game' }]
    expect(searchPlaces('', P).map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app -- palette places`
Expected: FAIL. The mocked module path does not exist yet, and `searchPlaces('')` omits transit and game.

- [ ] **Step 3: Implement.**

```js
// app/src/lib/paletteSources.js — every feature's ⌘K entries in one place (G3). V3/V4 transit and V5 games feed in here;
// V6 landmarks arrive through manifest.landmarks (kind 'landmark').
import { transitPlaces } from '../transit/palette.js'
import { gamePlaces } from '../sports/palette.js'
import { FEATURE_CONTROLS } from '../hud/featureControls.js'

export function featurePlaces(state) {
  return [
    ...transitPlaces(state).map((p) => ({ ...p, kind: 'transit' })),
    ...gamePlaces(state).map((p) => ({ ...p, kind: 'game' })),
  ]
}

export function featureCommands() {
  return FEATURE_CONTROLS.map((c) => ({ id: `f:${c.id}`, kind: 'command', name: `${c.label}: on / off`, sub: `${c.keyLabel} · ${c.help}`, run: c.toggle }))
}
```

In `CommandPalette.jsx`:
- Imports: add `import { RiTrainLine, RiBaseballLine } from 'react-icons/ri'` (alongside the existing ri imports) and `import { featurePlaces, featureCommands } from '../lib/paletteSources.js'`.
- Replace the constants:
  ```js
  const ICON = { landmark: RiBuilding2Line, transit: RiTrainLine, game: RiBaseballLine, neighborhood: RiMapPin2Line, view: RiCameraLensLine, command: RiCommandLine, time: RiSunLine }
  const SECTION = { landmark: 'Landmarks', transit: 'Transit', game: 'Games', neighborhood: 'Neighborhoods', view: 'Views', command: 'Commands' }
  const ORDER = ['landmark', 'transit', 'game', 'neighborhood', 'view', 'command']
  ```
- In `commands()`, append `...featureCommands()` to the returned array, and remove any per-feature toggle commands V3–V5 added there (Task 0).
- Replace `const all = useMemo(…)` with:
  ```js
  // read the feature state when the palette opens; subscribing to the whole store would re-render on every camera move
  const all = useMemo(() => [...buildPlaces(manifest, BOOKMARKS), ...featurePlaces(useStore.getState()), ...commands()], [manifest, open])
  ```

In `app/src/lib/places.js` → `searchPlaces`:
- Change the empty-query branch to:
  ```js
  if (!q) return [...places.filter((p) => p.kind === 'view'), ...places.filter((p) => p.kind === 'landmark').slice(0, 8), ...places.filter((p) => p.kind === 'transit').slice(0, 5), ...places.filter((p) => p.kind === 'game').slice(0, 3), ...places.filter((p) => p.kind === 'neighborhood').slice(0, 6)]
  ```
- Change the bonus map to `{ landmark: 2, transit: 1.5, game: 1.5, view: 1, neighborhood: 0, command: 1 }`.

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app`
Expected: PASS (all).

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add -A app/src
git commit -m "feat(hud): ⌘K groups Landmarks, Transit, Games; feature on/off commands from the registry (G3)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Help card and hint bar from the registry

**Files:**
- Create: `app/src/lib/hints.js`
- Modify: `app/src/hud/HelpOverlay.jsx`, `app/src/hud/HintBar.jsx`, `app/src/hud/Hud.jsx` (pass `layoutW`), `app/src/hud/Hud.css`
- Test: `app/src/lib/__tests__/hints.test.js`, `app/src/hud/__tests__/help.test.jsx` (append)

**Interfaces:**
- Consumes: `FEATURE_CONTROLS`, `hudScale`.
- Produces:
  - `ALL_HINTS: { k: string, label: string, p: 1|2|3 }[]` in display order.
  - `hintWidth(h): number` (estimated px at the design scale).
  - `hintMaxWidth(layoutW): number`: the space between the 228 px side columns.
  - `fitHints(hints, maxW)`: keeps hints by priority (then order) while they fit, and renders them in display order.
  - `<HintBar layoutW={number} />`.
  - A help-card group titled `City life`.

**Ruling (recorded in the ledger):**
- At narrow layouts the hint bar keeps the priority-1 hints (move, fly there, search, help), the feature keys (T, G, M) and then views.
- "Shift+arrows turn" and "R / F up/down" drop out first. They stay on the help card.
- Cost if wrong: two expert shortcuts are one click away instead of always visible.

- [ ] **Step 1: Write the failing tests.**

```js
// app/src/lib/__tests__/hints.test.js
import { describe, it, expect } from 'vitest'
import { ALL_HINTS, hintWidth, hintMaxWidth, fitHints } from '../hints.js'

const total = (hs) => 32 + hs.reduce((s, h) => s + hintWidth(h), 0)
describe('hint bar fitting', () => {
  it('every feature key has a hint', () => {
    for (const k of ['T', 'G', 'M']) expect(ALL_HINTS.some((h) => h.k === k)).toBe(true)
  })
  it('never exceeds the space between the side columns', () => {
    for (const w of [1091, 1280, 1422, 1440, 1600]) expect(total(fitHints(ALL_HINTS, hintMaxWidth(w)))).toBeLessThanOrEqual(hintMaxWidth(w))
  })
  it('keeps the essentials and the feature keys at the tightest non-compact layout (1280)', () => {
    const keys = fitHints(ALL_HINTS, hintMaxWidth(1280)).map((h) => h.k)
    for (const k of ['↑↓←→', 'Double-click', '⌘K', '?', 'T', 'G', 'M']) expect(keys).toContain(k)
  })
  it('keeps display order', () => {
    const kept = fitHints(ALL_HINTS, 5000)
    expect(kept).toEqual(ALL_HINTS)
  })
})
```

Append to `help.test.jsx`:
```jsx
import { FEATURE_CONTROLS } from '../featureControls.js'
it('help lists every city-life control with its key and button', () => {
  useStore.getState().setHelpOpen(true)
  render(<HelpOverlay />)
  expect(screen.getByText(/City life/i)).toBeInTheDocument()
  for (const c of FEATURE_CONTROLS) expect(screen.getByText(new RegExp(`${c.label} button`))).toBeInTheDocument()
  expect(screen.getByText(/Follow a train/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app -- hints help`
Expected: FAIL. The module `../hints.js` is not found, and `Unable to find an element with the text: /City life/i`.

- [ ] **Step 3: Implement.**

```js
// app/src/lib/hints.js — which key hints fit the bottom bar between the left stack and the dock/minimap column.
import { FEATURE_CONTROLS } from '../hud/featureControls.js'

const BASE = [
  { k: '↑↓←→', label: 'move', p: 1 }, { k: 'Shift+arrows', label: 'turn', p: 3 }, { k: 'R / F', label: 'up / down', p: 3 },
  { k: 'Double-click', label: 'fly there', p: 1 }, { k: '⌘K', label: 'search', p: 1 },
]
const TAIL = [{ k: '[ ]', label: 'views', p: 2 }, { k: '?', label: 'help', p: 1 }]
export const ALL_HINTS = [...BASE, ...FEATURE_CONTROLS.map((c) => ({ k: c.keyLabel, label: c.hint, p: 2 })), ...TAIL]

// px at design scale: kbd chip (padding + ~7.5 px per glyph), gap, label (~6.2 px per char), item gap
export const hintWidth = ({ k, label }) => 14 + k.length * 7.5 + 6 + label.length * 6.2 + 16
const SIDE = 196 + 16 + 16 // dock/minimap column (and the same margin on the left)
export const hintMaxWidth = (layoutW) => layoutW - 2 * SIDE

export function fitHints(hints, maxW) {
  const order = hints.map((h, i) => i).sort((a, b) => hints[a].p - hints[b].p || a - b)
  const keep = new Set()
  let w = 32 // bar padding
  for (const i of order) {
    const hw = hintWidth(hints[i])
    if (w + hw > maxW) continue
    keep.add(i); w += hw
  }
  return hints.filter((_, i) => keep.has(i))
}
```

Replace `HintBar.jsx`:
```jsx
import { ALL_HINTS, fitHints, hintMaxWidth } from '../lib/hints.js'

export default function HintBar({ layoutW = 1280 }) {
  return (
    <div className="hud-hints" style={{ maxWidth: hintMaxWidth(layoutW) }}>
      {fitHints(ALL_HINTS, hintMaxWidth(layoutW)).map(({ k, label }) => (
        <span key={k}><span className="hud-kbd">{k}</span> {label}</span>
      ))}
    </div>
  )
}
```

In `Hud.jsx`, change `<HintBar />` to `<HintBar layoutW={size[0] / scale} />`. In `Hud.css`, add `overflow: hidden;` to `.hud-hints`.

In `HelpOverlay.jsx`:
- Add `import { FEATURE_CONTROLS } from './featureControls.js'`.
- Add a group after "Search and fly":
  ```js
  ['City life', [
    ...FEATURE_CONTROLS.map((c) => [c.keyLabel, `${c.label} button — ${c.help}`]),
    ['Click', 'a train, a station or a ballpark for its card'],
    ['⌘K', '“Follow a train” — Follow a train rides along; any key stops'],
  ]],
  ```
- Remove any per-feature help rows V3–V5 added elsewhere in `GROUPS` (Task 0).

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app`
Expected: PASS (all).

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add -A app/src
git commit -m "feat(hud): help card 'City life' and a hint bar that fits between the side columns (G3)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Responsive HUD — one left stack, verified at five window sizes

**Files:**
- Create: `app/e2e/hud-layout.spec.js`
- Modify: `app/src/hud/Hud.jsx`, `app/src/hud/Hud.css`. Mount the V3–V5 side panels (line legend, train/station card, venue/games card; Task 0 list) inside `<div className="hud-left-stack">`.
- Test: `app/src/hud/__tests__/hud.test.jsx` (append)

**Interfaces:**
- Consumes: the panels from V3–V5 and `hudScale` / `hudCompact`.
- Produces:
  - `.hud-left-stack`: `top: 148px`, `left: 16px`, `bottom: 64px`, width 300 px, scrolls when full, and passes pointer events through between cards.
  - An e2e check at 1440×900, 1280×720, 1024×640, 800×600 and 600×900.

- [ ] **Step 1: Write the failing tests.**

Append to `hud.test.jsx`:
```jsx
it('side panels live in one left stack under the wordmark', () => {
  const { container } = render(<Hud />)
  const stack = container.querySelector('.hud-left-stack')
  expect(stack).not.toBeNull()
  // every panel V3–V5 mounted (Task 0 list) is a child of the stack, never a direct child of .hud-root
  for (const sel of ['.line-legend', '.train-card', '.venue-card', '.games-panel']) {
    const el = container.querySelector(sel)
    if (el) expect(stack.contains(el)).toBe(true)
  }
})
```
In this selector list, use the real class names of the V3–V5 panels from the Task 0 map. Record them in the ledger.

```js
// app/e2e/hud-layout.spec.js — the HUD at five window sizes: nothing off-screen, nothing overlapping, no clipped dock labels.
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const SIZES = [[1440, 900], [1280, 720], [1024, 640], [800, 600], [600, 900]]
const REGIONS = ['.hud-wordmark', '.hud-controls', '.dock', '.mm', '.hud-hints', '.hud-left-stack', '.perf-chip', '.flight-chip']
const LABEL = process.env.EVAL_LABEL

for (const [w, h] of SIZES) {
  test(`HUD fits at ${w}×${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await page.clock.setFixedTime(new Date('2026-09-28T12:00:00-05:00'))
    await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
    await page.goto('/?view=streeterville&time=day&stats=1')
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
    await page.keyboard.press('t') // transit on: legend shows
    await page.keyboard.press('g') // games panel open
    await page.waitForTimeout(1200)
    if (LABEL) { mkdirSync(`../.superpowers/sdd/2026-09-29-v7-v8-controls-perf-gallery/shots/${LABEL}`, { recursive: true }); await page.screenshot({ path: `../.superpowers/sdd/2026-09-29-v7-v8-controls-perf-gallery/shots/${LABEL}/hud-${w}x${h}.png` }) }
    const boxes = await page.evaluate((sels) => sels.flatMap((s) => [...document.querySelectorAll(s)]
      .filter((e) => getComputedStyle(e).display !== 'none' && e.getClientRects().length && (s !== '.hud-left-stack' || e.children.length))
      .map((e) => { const r = e.getBoundingClientRect(); return { s, x: r.left, y: r.top, r: r.right, b: r.bottom } })), REGIONS)
    for (const b of boxes) {
      expect.soft(b.x, `${b.s} left edge`).toBeGreaterThanOrEqual(0)
      expect.soft(b.y, `${b.s} top edge`).toBeGreaterThanOrEqual(0)
      expect.soft(b.r, `${b.s} right edge`).toBeLessThanOrEqual(w + 0.5)
      expect.soft(b.b, `${b.s} bottom edge`).toBeLessThanOrEqual(h + 0.5)
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i], B = boxes[j]
      const overlap = A.x < B.r - 1 && B.x < A.r - 1 && A.y < B.b - 1 && B.y < A.b - 1
      expect.soft(overlap, `${A.s} overlaps ${B.s}`).toBe(false)
    }
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.dock-btn span:not(.hud-kbd):not(.dock-compass)')].filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.textContent))
    expect(clipped).toEqual([])
    // the help card and palette also fit
    await page.keyboard.press('Shift+Slash')
    const help = await page.locator('.help').boundingBox()
    expect(help.y).toBeGreaterThanOrEqual(0); expect(help.y + help.height).toBeLessThanOrEqual(h + 0.5)
  })
}
```

- [ ] **Step 2: Run the tests to verify they fail** (dev server + Playwright only).

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app -- hud`
Expected: FAIL. `.hud-left-stack` is null.

Run: `cd /Users/connorevans/Downloads/Chicago_open_world/app && EVAL_LABEL=before-v7 npx playwright test e2e/hud-layout.spec.js --workers=1`
Expected: 5 "before" PNGs in `shots/before-v7/` (the screenshot is taken before the assertions). FAIL at one or more sizes, for example `.hud-hints overlaps .mm` at 800×600 or `.train-card overlaps .dock` at 1280×720. Record the failures in the ledger.

- [ ] **Step 3: Implement.**

In `Hud.jsx`, directly after `<WordmarkBlock />`, add:
```jsx
      <div className="hud-left-stack">
        {/* V3 line legend, V4 train/station card, V5 venue/games card — moved here from their own corners (Task 0 list) */}
      </div>
```
Move each panel's element from wherever it is mounted into this div, in the order legend, games panel, then cards.

Append to `Hud.css`:
```css
.hud-root > .hud-left-stack { position: absolute; top: 148px; left: 16px; bottom: 64px; width: 300px; display: flex; flex-direction: column; gap: 10px;
  overflow-y: auto; pointer-events: none; scrollbar-width: thin; }
.hud-left-stack > * { pointer-events: auto; position: static !important; inset: auto !important; width: 100% !important; max-width: 100%; flex-shrink: 0; }
.hud-root[data-compact="true"] .hud-left-stack { bottom: 16px; }
.cmdk { max-height: calc(100% - 32px); }
```

If the e2e still reports an overlap, fix it with CSS only and rerun. Never shrink below `MIN_SCALE`. Record each change as a `Ruling:` line. The expected levers, in order:
1. `.hud-left-stack` `bottom`;
2. the `.hud-hints` side margin (`hintMaxWidth` `SIDE`);
3. `.dock` `bottom` (it must stay above `.mm`: `bottom ≥ 16 + 216 + 12`).

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app`
Expected: PASS.

Run: `cd /Users/connorevans/Downloads/Chicago_open_world/app && npx playwright test e2e/hud-layout.spec.js --workers=1`
Expected: 5 passed.

Run: `cd /Users/connorevans/Downloads/Chicago_open_world/app && EVAL_LABEL=after-v7 npx playwright test e2e/hud-layout.spec.js --workers=1`
Expected: 5 PNGs `shots/after-v7/hud-<w>x<h>.png`.

Evaluate them against `before-v7` with the Read tool. Keep the change when the dock row, left stack and hint bar read tidy and legible at every size. Revert a CSS change that makes text unreadable at 600×900 (its own commit). Ledger: `V7 layout: KEEP|REVERT — reason`.

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add -A app/src app/e2e/hud-layout.spec.js
git commit -m "feat(hud): one scrollable left stack for legend and cards; HUD verified at 1440×900, 1280×720, 1024×640, 800×600, 600×900" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Follow-train and venue focus respect clearance (G6)

**Files:**
- Create: `app/src/lib/poseClearance.js`
- Modify: the call sites Task 0 found for `followPose` (V4 follow mode) and `venueFocusPose` (V5 venue focus). They call `clearedFollowPose` / `clearedVenuePose` instead.
- Test: `app/src/lib/__tests__/poseClearance.test.js`. It joins V1's G1 test set in `app/src/lib/__tests__/`, as the acceptance says.

**Interfaces:**
- Consumes:
  - `clearanceAt(x, z): number` (V1 · G1: max roof height under the point, metres);
  - `followPose(...args): { position, target }` (V4);
  - `venueFocusPose(...args): { position, target }` (V5).
- Produces:
  - `CLEAR_M = 25` (spec B.7: height + 25 m);
  - `ensureClear(pose, clearance = clearanceAt, margin = CLEAR_M): { position, target }` (a new object; the input is untouched);
  - `clearedFollowPose(...args)` and `clearedVenuePose(...args)` (same args as the V4/V5 functions).

**Ruling:** the wrappers stay even if V4 and V5 already apply clearance. `ensureClear` is idempotent, so this costs one `clearanceAt` lookup per frame. Cost if wrong: none.

- [ ] **Step 1: Write the failing test.**

```js
// app/src/lib/__tests__/poseClearance.test.js — G6: follow-train and venue focus never end inside a building.
import { describe, it, expect, vi } from 'vitest'
vi.mock('../clearance.js', () => ({ clearanceAt: (x, z) => (Math.abs(x) < 100 && Math.abs(z) < 100 ? 300 : 20) }))
vi.mock('../../transit/followCam.js', () => ({ followPose: (x, z) => ({ position: [x, 12, z], target: [x + 30, 8, z] }) }))
vi.mock('../../sports/venueFocus.js', () => ({ venueFocusPose: () => ({ position: [50, 60, -40], target: [0, 10, 0] }) }))
import { CLEAR_M, ensureClear, clearedFollowPose, clearedVenuePose } from '../poseClearance.js'

describe('pose clearance (G6)', () => {
  it('lifts a camera that would sit inside a tower to roof + 25 m, target untouched', () => {
    const p = { position: [0, 50, 0], target: [10, 40, 10] }
    const out = ensureClear(p, (x, z) => 300)
    expect(out.position).toEqual([0, 300 + CLEAR_M, 0])
    expect(out.target).toEqual([10, 40, 10])
    expect(p.position[1]).toBe(50) // input not mutated
  })
  it('leaves a clear pose alone (idempotent)', () => {
    const p = { position: [500, 400, 500], target: [0, 0, 0] }
    expect(ensureClear(p, () => 20)).toEqual(p)
    expect(ensureClear(ensureClear(p, () => 380), () => 380)).toEqual(ensureClear(p, () => 380))
  })
  it('follow-train pose over the dense Loop clears the roofs', () => {
    const out = clearedFollowPose(0, 0)
    expect(out.position[1]).toBeGreaterThanOrEqual(300 + CLEAR_M)
  })
  it('follow-train pose over low roofs still clears them by 25 m', () => {
    expect(clearedFollowPose(1000, 1000).position[1]).toBeGreaterThanOrEqual(20 + CLEAR_M)
  })
  it('venue focus inside a tall neighbour is lifted', () => {
    expect(clearedVenuePose().position[1]).toBeGreaterThanOrEqual(300 + CLEAR_M)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app -- poseClearance`
Expected: FAIL with the module `../poseClearance.js` not found.

- [ ] **Step 3: Implement.**

```js
// app/src/lib/poseClearance.js — every scripted camera pose clears the roofs below it (spec B.7, backlog G6).
import { clearanceAt } from './clearance.js'
import { followPose } from '../transit/followCam.js'
import { venueFocusPose } from '../sports/venueFocus.js'

export const CLEAR_M = 25

export function ensureClear(pose, clearance = clearanceAt, margin = CLEAR_M) {
  const [x, y, z] = pose.position
  const floor = clearance(x, z) + margin
  return { position: [x, Math.max(y, floor), z], target: [...pose.target] }
}

export const clearedFollowPose = (...args) => ensureClear(followPose(...args))
export const clearedVenuePose = (...args) => ensureClear(venueFocusPose(...args))
```

At each call site from Task 0, replace `followPose(` with `clearedFollowPose(` and `venueFocusPose(` with `clearedVenuePose(`, importing from `../lib/poseClearance.js` (adjust the relative path).

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app`
Expected: PASS (all, including V1's G1 set and V4/V5's follow and venue tests).

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add -A app/src
git commit -m "feat(camera): follow-train and venue focus clear the roofs by 25 m (G6)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: V7 end-of-milestone checklist (master plan)

**Files:**
- Modify: `README.md`
- Create: `docs/screenshots/v7-hud-1440x900-day.png`, `docs/screenshots/v7-hud-800x600-day.png`, `docs/screenshots/v7-help-card-day.png` (new files only)
- Modify: `app/e2e/hero-view.spec.js-snapshots/*` (all 10, since the dock gained a row)

**Interfaces:**
- Consumes: Tasks 0–7.
- Produces: V7 pushed.

- [ ] **Step 1: Run both unit suites green.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline && npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app`
Expected: both PASS.

- [ ] **Step 2: Run the world build; the skyline assertion must pass.**

Run: `npm run build:world --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline 2>&1 | tail -3 && git -C /Users/connorevans/Downloads/Chicago_open_world status --short app/public/world | head`
Expected: exit 0, and no world changes (V7 is HUD only).

- [ ] **Step 3: e2e.**

The dock is in every hero-view shot, so all 10 baselines change intentionally. Run `cd /Users/connorevans/Downloads/Chicago_open_world/app && npx playwright test e2e/hero-view.spec.js --update-snapshots`.

Then run `npx playwright test` three times in a row (hero-view + hud-layout; the eval spec skips).
Expected: 3 consecutive all-green runs.

- [ ] **Step 4: Perf check.**

Run `perf.spec.js` if it exists yet. It arrives in Task 10, so for V7 use V2's `drawCallsPerFrame` at the three perf poses from `app/e2e/helpers.js` / V1.

Ledger: `V7 perf: <pose> calls=<n> tris=<t> fps=<f>`.
Expected: calls within ±5 of the V6 ledger values (HUD only).

- [ ] **Step 5: README.**

Copy new images with `cp -n`:
- `shots/after-v7/hud-1440x900.png` → `docs/screenshots/v7-hud-1440x900-day.png`
- `shots/after-v7/hud-800x600.png` → `docs/screenshots/v7-hud-800x600-day.png`

For the help card, capture it with Playwright at 1440×900 after pressing `?`, into `docs/screenshots/v7-help-card-day.png`.

Verify with `git status --short docs/screenshots | grep -v '^??' && echo STOP || echo ok`. Expected: `ok`.

Append a gallery section after the latest vision-pass section:
```markdown
### Vision pass · V7 · Controls — *every feature one click, one key, one search away*

<table>
<tr>
<td width="50%"><img src="docs/screenshots/v7-hud-1440x900-day.png" alt="V7 — the HUD at 1440×900 with Transit, Games and Sound in the dock" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v7-help-card-day.png" alt="V7 — the help card with the City life controls" width="100%"/></td>
</tr>
<tr>
<td><em>Transit, Games and Sound join the dock; legends and cards stack on the left, clear of the minimap.</em></td>
<td><em>The help card lists every control in plain words — T, G and M, following a train, clicking a ballpark.</em></td>
</tr>
</table>
```

In the Controls table, add rows: `` | `T` · `G` · `M` | Transit · Games · Sound on/off (also dock buttons and ⌘K) | `` and `` | ⌘K "Follow a … train" | ride along with a train — any key stops | ``.

Change the phase badge to `phase-vision_pass_V7-45d8ff`.

- [ ] **Step 6: Commit and push.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add README.md docs/screenshots/v7-*.png app/e2e/hero-view.spec.js-snapshots
git commit -m "docs: V7 controls — gallery, controls table, badge; e2e baselines with the new dock row" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push origin main
```
Ledger: `V7: done, pushed <sha>`.

---

## Milestone V8 — Performance, gallery, final review

### Task 9: Exact draw probe and the perf chip (human-first)

**Files:**
- Create: `app/src/lib/drawProbe.js`, `app/src/lib/drawCensus.js`, `app/src/world/PerfProbe.jsx`, `app/src/hud/PerfOverlay.jsx`
- Modify:
  - `app/src/state/store.js` (`perfOn`, `setPerfOn`, `perf`, `setPerf`);
  - `app/src/world/Scene.jsx` (mount `<PerfProbe />`; `?stats` turns `perfOn` on);
  - `app/src/hud/Hud.jsx` (mount `<PerfOverlay />`);
  - `app/src/hud/Hud.css`;
  - `app/src/hud/CommandPalette.jsx` (command);
  - `app/src/hud/HelpOverlay.jsx` (line).
- Test: `app/src/lib/__tests__/drawProbe.test.js`, `app/src/lib/__tests__/drawCensus.test.js`, `app/src/hud/__tests__/perfOverlay.test.jsx`

**Interfaces:**
- Produces:
  - `createDrawProbe(info, window = 60)`: returns
    ```
    {
      start(): void, stop(): void,
      frame(): { calls, triangles },
      tick(dt): void,
      stats(): { calls, maxCalls, triangles, fps, frames }
    }
    ```
  - `categoryOf(object3d): string` and `censusScene(scene, camera): Record<string, number>`.
  - Store fields: `perfOn: boolean`, `setPerfOn(b)`, `perf: Stats | null`, `setPerf(s)`.
  - `window.__perf`: the latest stats, while `perfOn` is set.
  - `window.__census()`: available with `?stats`.
  - A ⌘K command `Performance stats: on / off`, and a help line.

- [ ] **Step 1: Write the failing tests.**

```js
// app/src/lib/__tests__/drawProbe.test.js
import { describe, it, expect } from 'vitest'
import { createDrawProbe } from '../drawProbe.js'
const fakeInfo = () => ({ autoReset: true, render: { calls: 0, triangles: 0 }, reset() { this.render.calls = 0; this.render.triangles = 0 } })

describe('draw probe', () => {
  it('counts every pass of a frame (composer passes accumulate while autoReset is off)', () => {
    const info = fakeInfo(), p = createDrawProbe(info)
    p.start()
    expect(info.autoReset).toBe(false)
    info.render.calls += 700; info.render.triangles += 2e6   // scene + shadow pass
    info.render.calls += 6; info.render.triangles += 12      // post passes
    expect(p.frame()).toEqual({ calls: 706, triangles: 2000012 })
    expect(info.render.calls).toBe(0)                         // reset once per frame
  })
  it('stats: average and max calls over the window, fps from frame times', () => {
    const info = fakeInfo(), p = createDrawProbe(info, 3)
    p.start()
    for (const c of [100, 200, 300, 400]) { info.render.calls = c; p.frame(); p.tick(1 / 50) }
    expect(p.stats()).toMatchObject({ calls: 300, maxCalls: 400, frames: 3, fps: 50 })
  })
  it('stop() restores autoReset', () => {
    const info = fakeInfo(), p = createDrawProbe(info)
    p.start(); p.stop()
    expect(info.autoReset).toBe(true)
  })
})
```

```js
// app/src/lib/__tests__/drawCensus.test.js
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { censusScene, categoryOf } from '../drawCensus.js'

describe('draw census', () => {
  it('counts visible objects in the frustum by layer or kind', () => {
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(60, 1, 1, 1000); cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0); cam.updateMatrixWorld()
    const box = new THREE.BoxGeometry(1, 1, 1), mat = new THREE.MeshBasicMaterial()
    const a = new THREE.Mesh(box, mat); a.name = 'buildings'
    const b = new THREE.Mesh(box, mat); b.name = 'buildings'; b.position.set(0, 0, 50) // behind the camera
    const c = new THREE.Mesh(box, mat); c.userData.kind = 'canopy'
    const d = new THREE.Mesh(box, mat); d.name = 'water'; d.visible = false
    scene.add(a, b, c, d); scene.updateMatrixWorld()
    expect(censusScene(scene, cam)).toEqual({ buildings: 1, canopy: 1 })
    expect(categoryOf(c)).toBe('canopy')
  })
})
```

```jsx
// app/src/hud/__tests__/perfOverlay.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PerfOverlay from '../PerfOverlay.jsx'
import CommandPalette from '../CommandPalette.jsx'
import { useStore } from '../../state/store.js'

describe('perf chip', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('hidden by default; shows draw calls, triangles and fps when on', () => {
    const { rerender, container } = render(<PerfOverlay />)
    expect(container.firstChild).toBeNull()
    useStore.setState({ perfOn: true, perf: { calls: 812, maxCalls: 830, triangles: 2_140_000, fps: 60, frames: 60 } })
    rerender(<PerfOverlay />)
    expect(screen.getByRole('status')).toHaveTextContent('812 DRAW · 2.1M TRIS · 60 FPS')
  })
  it('⌘K "performance" turns it on (human-first; no URL needed)', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'performance' } })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(useStore.getState().perfOn).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app -- drawProbe drawCensus perfOverlay`
Expected: FAIL. The modules are not found.

- [ ] **Step 3: Implement.**

```js
// app/src/lib/drawProbe.js — exact draw calls per frame. EffectComposer renders several passes and three resets
// renderer.info on each render() while autoReset is on, so the probe turns autoReset off and resets once per frame,
// after the composer (PerfProbe runs at useFrame priority 1000).
export function createDrawProbe(info, window = 60) {
  const calls = [], tris = [], dts = []
  const push = (a, v) => { a.push(v); if (a.length > window) a.shift() }
  const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)
  return {
    start() { info.autoReset = false; info.reset() },
    stop() { info.autoReset = true },
    frame() {
      const c = info.render.calls, t = info.render.triangles
      info.reset()
      push(calls, c); push(tris, t)
      return { calls: c, triangles: t }
    },
    tick(dt) { push(dts, dt) },
    stats() {
      const mdt = avg(dts)
      return { calls: Math.round(avg(calls)), maxCalls: Math.max(0, ...calls), triangles: Math.round(avg(tris)), fps: mdt ? Math.round(1 / mdt) : 0, frames: calls.length }
    },
  }
}
```

```js
// app/src/lib/drawCensus.js — which kinds of objects are drawn from here (main pass, frustum-culled): where the calls go.
import * as THREE from 'three'

const frustum = new THREE.Frustum(), m = new THREE.Matrix4(), sphere = new THREE.Sphere()
export const categoryOf = (o) => o.userData?.kind || o.name || o.parent?.name || o.type

export function censusScene(scene, camera) {
  camera.updateMatrixWorld()
  m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  frustum.setFromProjectionMatrix(m)
  const out = {}
  scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isLine && !o.isPoints) return
    if (o.frustumCulled) {
      const bs = o.isInstancedMesh ? (o.boundingSphere ?? (o.computeBoundingSphere(), o.boundingSphere)) : (o.geometry.boundingSphere ?? (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere))
      if (!frustum.intersectsSphere(sphere.copy(bs).applyMatrix4(o.matrixWorld))) return
    }
    const k = categoryOf(o)
    out[k] = (out[k] ?? 0) + 1
  })
  return out
}
```

```jsx
// app/src/world/PerfProbe.jsx — samples draw calls after the composer's passes; publishes to the HUD and to e2e.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '../state/store.js'
import { createDrawProbe } from '../lib/drawProbe.js'
import { censusScene } from '../lib/drawCensus.js'

export default function PerfProbe() {
  const { gl, scene, camera } = useThree()
  const on = useStore((s) => s.perfOn)
  const probe = useMemo(() => createDrawProbe(gl.info), [gl])
  const since = useRef(0)
  useEffect(() => {
    if (!on) return undefined
    probe.start()
    if (new URLSearchParams(window.location.search).has('stats')) window.__census = () => censusScene(scene, camera)
    return () => { probe.stop(); window.__perf = undefined }
  }, [on, probe, scene, camera])
  // priority 1000: after EffectComposer (priority 1) has rendered every pass of this frame
  useFrame((_, dt) => {
    if (!on) return
    probe.frame(); probe.tick(dt)
    since.current += dt
    if (since.current < 0.5) return
    since.current = 0
    const s = probe.stats()
    window.__perf = s
    useStore.getState().setPerf(s)
  }, 1000)
  return null
}
```

```jsx
// app/src/hud/PerfOverlay.jsx — the perf chip (⌘K "Performance stats").
import { useStore } from '../state/store.js'

export default function PerfOverlay() {
  const on = useStore((s) => s.perfOn)
  const p = useStore((s) => s.perf)
  if (!on) return null
  return (
    <div className="hud-chip perf-chip" role="status" aria-label="Performance">
      {p ? `${p.calls} DRAW · ${(p.triangles / 1e6).toFixed(1)}M TRIS · ${p.fps} FPS` : 'MEASURING…'}
    </div>
  )
}
```

The remaining edits:
- `store.js`: add `perfOn: false, setPerfOn: (perfOn) => set({ perfOn }), perf: null, setPerf: (perf) => set({ perf }),`.
- `Scene.jsx`: import `PerfProbe` and render `<PerfProbe />` after `<PerfWatch />`. In the existing `?stats` effect, add `useStore.getState().setPerfOn(true)`.
- `Hud.jsx`: import `PerfOverlay` and render `<PerfOverlay />` after `<FlightChip />`.
- `Hud.css`: add `.perf-chip { position: absolute; top: 96px; right: 16px; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; }`.
- `CommandPalette.jsx`, in `commands()`: add `{ id: 'c:perf', kind: 'command', name: 'Performance stats: on / off', sub: 'Draw calls, triangles, frame rate', run: () => s.setPerfOn(!useStore.getState().perfOn) },`.
- `HelpOverlay.jsx`, in the "Time and quality" rows: add `['Stats', '⌘K “performance” shows draw calls and frame rate']`.
- `app/e2e/hud-layout.spec.js` already includes `.perf-chip` among its regions, and `?stats=1` shows it.

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app`
Expected: PASS (all).

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add -A app/src
git commit -m "feat(perf): exact per-frame draw probe after the composer, draw census, ⌘K perf chip (H11)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: The budget test (fails first) and the census

**Files:**
- Create (or reuse V1's): `app/src/lib/perfPoses.js`
- Create: `app/e2e/perf.spec.js`
- Modify: `app/e2e/helpers.js` (add the perf poses to `EVAL_POSES`)

**Interfaces:**
- Consumes: `gotoPose` (V2 helper), `window.__perf`, `window.__census`.
- Produces: `PERF_POSES = { wideStreeterville, wideLoop, densest }`, each `{ position, target }`.

If V1 (or V2 · Task 10) already fixed these poses, import them instead and record a `Ruling:`.

- [ ] **Step 1: Write the poses and the failing e2e.**

```js
// app/src/lib/perfPoses.js — the three poses the draw-call budget is measured at (spec B.1.6).
export const PERF_POSES = {
  // from far out over the lake: Streeterville, Navy Pier and the whole north lakefront in frame
  wideStreeterville: { position: [4200, 900, -2600], target: [0, 60, -600] },
  // from the south-west, high: the Loop, the river and the lake behind
  wideLoop: { position: [-3600, 1100, 2600], target: [0, 60, -300] },
  // the densest view (= BOOKMARKS.loop): above Willis looking NE across the Loop
  densest: { position: [-1100, 520, 900], target: [150, 40, -500] },
}
```

In `app/e2e/helpers.js`, add `import { PERF_POSES } from '../src/lib/perfPoses.js'` and merge it: `Object.assign(EVAL_POSES, PERF_POSES)`.

```js
// app/e2e/perf.spec.js — the HIGH budget: ≤ 900 draw calls, ≤ 4 M triangles per frame at the wide and dense poses (H11).
import { test, expect } from '@playwright/test'
import { PERF_POSES } from '../src/lib/perfPoses.js'
import { gotoPose } from './helpers.js'

test.use({ viewport: { width: 1440, height: 900 } })
for (const [name, pose] of Object.entries(PERF_POSES)) {
  test(`budget at ${name}`, async ({ page }) => {
    await gotoPose(page, pose, 'dusk')
    await page.waitForFunction(() => window.__perf?.frames >= 60, null, { timeout: 30_000 })
    const s = await page.evaluate(() => window.__perf)
    const census = await page.evaluate(() => window.__census?.())
    console.log(`PERF ${name} calls=${s.calls} max=${s.maxCalls} tris=${s.triangles} fps=${s.fps} census=${JSON.stringify(census)}`)
    expect(s.maxCalls).toBeLessThanOrEqual(900)
    expect(s.triangles).toBeLessThanOrEqual(4_000_000)
  })
}
```

- [ ] **Step 2: Run the test to verify it fails** (dev server + Playwright only).

Run: `cd /Users/connorevans/Downloads/Chicago_open_world/app && npx playwright test e2e/perf.spec.js --workers=1 2>&1 | tee ../.superpowers/sdd/2026-09-29-v7-v8-controls-perf-gallery/perf-before.log | grep -E "PERF|passed|failed"`
Expected: FAIL at `wideStreeterville` and/or `wideLoop` with `maxCalls` > 900. The Phase 2.5 ledger measured about 1,188 before V3–V6 added transit, stadium life and landmarks.

Ledger: the three `PERF` lines, plus the census's top five categories per pose.

- [ ] **Step 3: Capture the "before" pictures for evaluate-and-revert.**

Run: `cd /Users/connorevans/Downloads/Chicago_open_world/app && EVAL_MILESTONE=2026-09-29-v7-v8-controls-perf-gallery EVAL_LABEL=before-v8 EVAL_POSES=wideStreeterville,wideLoop,densest npx playwright test e2e/eval-looks.spec.js --workers=1`
Expected: 9 PNGs in `shots/before-v8/`.

- [ ] **Step 4: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add app/src/lib/perfPoses.js app/e2e/perf.spec.js app/e2e/helpers.js
git commit -m "test(perf): draw-call and triangle budget at the wide Streeterville, wide Loop and densest poses (H11, failing)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Lever A — pooled instancing per 2 km block

**Files:**
- Create: `app/src/world/instancePool.js`, `app/src/world/pools.js`, `app/src/world/InstancePools.jsx`
- Modify:
  - `app/src/world/Trees.jsx`, `RoofProps.jsx`, `ElevatedL.jsx` (register into pools instead of owning an `InstancedMesh`);
  - any per-tile instanced component V3–V6 added whose census count grows with the number of LOD0 tiles (same pattern);
  - `app/src/world/TileContent.jsx` (pass `block`);
  - `app/src/world/TileStreamer.jsx` (pass `block={t?.block}`);
  - `app/src/world/Scene.jsx` (mount `<InstancePools />`).
- Test: `app/src/world/__tests__/instancePool.test.js`

**Interfaces:**
- Produces:
  - `createInstancePool(geometry, material, capacity, { color = false } = {})` returns:
    ```
    {
      mesh: InstancedMesh,
      add(matrices: Matrix4[], colors?: Color[]): number /* handle */,
      remove(handle): void,
      size: number,
      dropped: number
    }
    ```
  - `POOL_KINDS: { trunk, canopy, tower, hvac, penthouse, bent }`, each `{ cap, castShadow, color? }`.
  - `getPool(kind, block, geometry, material)`, `subscribePools(fn)`, `poolsSnapshot(): Pool[]`, `releaseEmpty(): void`.
  - `<Trees trees block />`, `<RoofProps props block />`, `<ElevatedL columns block />`. These render nothing themselves; they register into pools.

**Ruling:**
- Pools are per 2 km block, not global, so frustum culling still drops whole off-screen blocks and the shadow pass only draws blocks in the light's box.
- About 36 LOD0 tiles × up to 9 instanced calls (6 main + 3 shadow) become about 6 blocks × 9.
- Cost if wrong: a slightly larger bounding sphere per pool draws a few more off-screen instances (triangles, not calls).

- [ ] **Step 1: Write the failing test.**

```js
// app/src/world/__tests__/instancePool.test.js
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createInstancePool } from '../instancePool.js'

const at = (x) => new THREE.Matrix4().makeTranslation(x, 0, 0)
const xs = (pool) => Array.from({ length: pool.size }, (_, i) => { const m = new THREE.Matrix4(); pool.mesh.getMatrixAt(i, m); return m.elements[12] })
const pool = (cap = 16, opts) => createInstancePool(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), cap, opts)

describe('instance pool', () => {
  it('adds tiles into one mesh and draws only the used slots', () => {
    const p = pool()
    p.add([at(1), at(2)]); p.add([at(10), at(11), at(12)])
    expect(p.size).toBe(5); expect(p.mesh.count).toBe(5)
    expect(xs(p).sort((a, b) => a - b)).toEqual([1, 2, 10, 11, 12])
  })
  it("removal keeps other tiles' instances intact", () => {
    const p = pool()
    const a = p.add([at(1), at(2)]), b = p.add([at(10), at(11), at(12)]), c = p.add([at(20)])
    p.remove(a)
    expect(xs(p).sort((u, v) => u - v)).toEqual([10, 11, 12, 20])
    p.remove(c)
    expect(xs(p).sort((u, v) => u - v)).toEqual([10, 11, 12])
    const d = p.add([at(30)])
    p.remove(b)
    expect(xs(p)).toEqual([30])
    p.remove(d); p.remove(d) // double remove is a no-op
    expect(p.size).toBe(0)
  })
  it('colours travel with their instance when slots move', () => {
    const p = pool(8, { color: true })
    const a = p.add([at(1)], [new THREE.Color('#ff0000')])
    p.add([at(2)], [new THREE.Color('#00ff00')])
    p.remove(a)
    const c = new THREE.Color(); p.mesh.getColorAt(0, c)
    expect([c.r, c.g, c.b].map((v) => Math.round(v))).toEqual([0, 1, 0])
  })
  it('overflow drops extras and reports them', () => {
    const p = pool(3)
    const h = p.add([at(1), at(2), at(3), at(4), at(5)])
    expect(p.size).toBe(3); expect(p.dropped).toBe(2)
    p.remove(h)
    expect(p.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app -- instancePool`
Expected: FAIL with the module `../instancePool.js` not found.

- [ ] **Step 3: Implement.**

```js
// app/src/world/instancePool.js — many tiles' instances in one InstancedMesh; tiles come and go (H11 draw-call budget).
import * as THREE from 'three'

export function createInstancePool(geometry, material, capacity, { color = false } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, capacity)
  mesh.count = 0
  mesh.frustumCulled = true
  if (color) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3)
  const owner = []           // slot → handle
  const slots = new Map()    // handle → slots
  const m = new THREE.Matrix4(), c = new THREE.Color()
  let next = 1, dropped = 0
  const dirty = () => {
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }
  return {
    mesh,
    add(matrices, colors) {
      const h = next++, mine = []
      matrices.forEach((mat, i) => {
        if (mesh.count >= capacity) { dropped++; return }
        const s = mesh.count++
        mesh.setMatrixAt(s, mat)
        if (colors && mesh.instanceColor) mesh.setColorAt(s, colors[i])
        owner[s] = h; mine.push(s)
      })
      slots.set(h, mine)
      dirty()
      return h
    },
    remove(h) {
      const mine = slots.get(h)
      if (!mine) return
      // highest slot first: any slot above the one being filled that belongs to h is already gone
      for (const s of [...mine].sort((a, b) => b - a)) {
        const last = --mesh.count
        if (s !== last) {
          mesh.getMatrixAt(last, m); mesh.setMatrixAt(s, m)
          if (mesh.instanceColor) { mesh.getColorAt(last, c); mesh.setColorAt(s, c) }
          const moved = owner[last]
          owner[s] = moved
          const list = slots.get(moved); list[list.indexOf(last)] = s
        }
        owner[last] = undefined
      }
      slots.delete(h)
      dirty()
    },
    get size() { return mesh.count },
    get dropped() { return dropped },
  }
}
```

```js
// app/src/world/pools.js — one pool per (kind, 2 km block); React renders whatever pools exist.
import { createInstancePool } from './instancePool.js'

export const POOL_KINDS = {
  trunk: { cap: 12000, castShadow: false },
  canopy: { cap: 12000, castShadow: true, color: true },
  tower: { cap: 1024, castShadow: true },
  hvac: { cap: 4096, castShadow: false },
  penthouse: { cap: 1024, castShadow: false },
  bent: { cap: 2048, castShadow: true },
}
const pools = new Map()
const listeners = new Set()
let snapshot = []
const emit = () => { snapshot = [...pools.values()]; listeners.forEach((f) => f()) }

export function getPool(kind, block, geometry, material) {
  const k = `${kind}@${block ?? 'none'}`
  let p = pools.get(k)
  if (!p) {
    const spec = POOL_KINDS[kind]
    p = createInstancePool(geometry, material, spec.cap, { color: Boolean(spec.color) })
    p.mesh.castShadow = spec.castShadow; p.mesh.receiveShadow = true
    p.mesh.userData.kind = kind; p.key = k
    pools.set(k, p); emit()
  }
  return p
}
export const subscribePools = (f) => { listeners.add(f); return () => listeners.delete(f) }
export const poolsSnapshot = () => snapshot
export function releaseEmpty() {
  let changed = false
  for (const [k, p] of pools) if (p.size === 0) { p.mesh.dispose(); pools.delete(k); changed = true }
  if (changed) emit()
}
```

```jsx
// app/src/world/InstancePools.jsx — draws every pooled InstancedMesh (trees, roof props, L bents, …).
import { useEffect, useSyncExternalStore } from 'react'
import { subscribePools, poolsSnapshot, releaseEmpty } from './pools.js'

export default function InstancePools() {
  const list = useSyncExternalStore(subscribePools, poolsSnapshot)
  useEffect(() => { const id = setInterval(releaseEmpty, 10_000); return () => clearInterval(id) }, [])
  return list.map((p) => <primitive key={p.key} object={p.mesh} />)
}
```

Rewrite `Trees.jsx`. It keeps its geometry, materials and palette logic, and swaps the two instanced meshes for pool registration:
```jsx
// app/src/world/Trees.jsx — seasonal trees, registered into the block's pooled canopy + trunk meshes.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { treePalette, chicagoMonth } from '../lib/seasons.js'
import { getPool } from './pools.js'

const canopyGeo = new THREE.IcosahedronGeometry(1, 0) // 20 tris: ~29k trees stay within budget
canopyGeo.scale(3.5, 3.9, 3.5).translate(0, 7.5, 0)
const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 5.5, 5, 1, true).translate(0, 2.75, 0)
const canopyMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true })
const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a3b2f', roughness: 1 })
const UP = new THREE.Vector3(0, 1, 0)

export default function Trees({ trees, block }) {
  const pal = useMemo(() => treePalette(chicagoMonth()), [])
  useEffect(() => {
    if (!trees?.length) return undefined
    const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3()
    const zero = new THREE.Matrix4().makeScale(0, 0, 0)
    const trunks = [], crowns = [], colours = []
    trees.forEach(([x, z, sc, v], i) => {
      q.setFromAxisAngle(UP, v * 1.7 + i)
      const m = new THREE.Matrix4().compose(p.set(x, 0, z), q, s.set(sc, sc * (0.9 + v * 0.08), sc))
      trunks.push(m); crowns.push(pal.bare ? zero : m)
      colours.push(new THREE.Color(pal.canopy[(i * 7 + v) % pal.canopy.length]))
    })
    const trunk = getPool('trunk', block, trunkGeo, trunkMat), canopy = getPool('canopy', block, canopyGeo, canopyMat)
    const ht = trunk.add(trunks), hc = canopy.add(crowns, colours)
    return () => { trunk.remove(ht); canopy.remove(hc) }
  }, [trees, pal, block])
  return null
}
```

Apply the same pattern to the other instanced components:
- **`RoofProps.jsx`:** keep `GEOS`, `MATS` and the matrix compose code. Kinds `0 → 'tower'`, `1 → 'hvac'`, `2 → 'penthouse'`. In one `useEffect` over `[props, block]`, build a `Matrix4[]` per kind, `add` it to `getPool(kind, block, GEOS[t], MATS[t])`, `remove` it on cleanup, and `return null`.
- **`ElevatedL.jsx`:** the kind is `'bent'`. Build the same composed matrices with `bentGeo` and `steel`, or V3's replacement geometry if V3 rewrote it.
- **Per-tile instancing from V3–V6:** add a `POOL_KINDS` entry with `cap` equal to the census max per block × 1.5, then register the same way.

Wiring:
- `TileContent.jsx`: accept a `block` prop and pass `block={block}` to `<Trees>`, `<RoofProps>` and `<ElevatedL>`.
- `TileStreamer.jsx`: pass `block={t?.block}` to `<TileContent>`.
- `Scene.jsx`: render `<InstancePools />` right after `<TileStreamer … />`.

- [ ] **Step 4: Run the tests to verify they pass, then measure.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app`
Expected: PASS (all).

Run: `cd /Users/connorevans/Downloads/Chicago_open_world/app && npx playwright test e2e/perf.spec.js --workers=1 2>&1 | tee ../.superpowers/sdd/2026-09-29-v7-v8-controls-perf-gallery/perf-lever-a.log | grep -E "PERF|passed|failed"`
Expected: calls drop at every pose relative to `perf-before.log`. Record the three `PERF` lines in the ledger.

Then run: `cd /Users/connorevans/Downloads/Chicago_open_world/app && EVAL_MILESTONE=2026-09-29-v7-v8-controls-perf-gallery EVAL_LABEL=after-lever-a EVAL_POSES=wideStreeterville,wideLoop,densest npx playwright test e2e/eval-looks.spec.js --workers=1`

Compare with `before-v8` using the Read tool. Trees, roof props and bents must look the same, with none missing at tile edges and no flicker. If trees vanish (overflow), raise that kind's `cap` once and record the ruling. If they still vanish, revert the kind that fails in its own commit.

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add -A app/src
git commit -m "perf: trees, roof props and L bents pooled per 2 km block — one call per kind per block, not per tile (H11)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Lever B — LOD1 batched into 1 km quads (pipeline + streaming, manifest v7)

**Skip condition:** if `perf-lever-a.log` shows `maxCalls ≤ 850` at all three poses (50 of headroom for V3–V6 animation peaks), skip this task. Record `Ruling: quads not needed — Lever A reached <n> — cost if wrong: less headroom for Phase 6 rings`.

**Files:**
- Modify: `pipeline/lib/tilepack.js` (`QUAD_TILES`, `quadKeyFor`), `pipeline/build/build-world.js`, `app/src/lib/tilePlan.js` (`planWorld`, `makeBoundsOf`), `app/src/world/TileStreamer.jsx`
- Test: `pipeline/tests/tilepack.test.js` (append), `app/src/lib/__tests__/planWorld.test.js` (append)

**Interfaces:**
- Produces:
  - `QUAD_TILES = 2`, `quadKeyFor(tileKey): string`.
  - Manifest `version: 7`, `quads: [{ key, block, file: 'quads/<k>.glb', bounds }]`, and `tiles[i].quad`.
  - Plan ids gain `q:<key>` with LOD `'quad'`.
  - `makeBoundsOf(manifest): (id) => bounds` for `t:` / `q:` / `b:` ids.

**Ruling:** quads are the one tile-format change of V8 (manifest v7). A block touching LOD0 tiles splits into four 1 km quads, and only quads containing a LOD0 tile split into 500 m tiles. Cost if wrong: `public/world` grows by one extra copy of the LOD1 content (checked against 200 MB in Step 4).

- [ ] **Step 1: Write the failing tests.**

Append to `pipeline/tests/tilepack.test.js`:
```js
describe('quads', () => {
  it('quadKeyFor groups 2×2 tiles into 1 km quads, floor for negatives', async () => {
    const { quadKeyFor, QUAD_TILES } = await import('../lib/tilepack.js')
    expect(QUAD_TILES).toBe(2)
    expect(quadKeyFor('0_0')).toBe('0_0'); expect(quadKeyFor('1_1')).toBe('0_0'); expect(quadKeyFor('3_-2')).toBe('1_-1'); expect(quadKeyFor('-1_-1')).toBe('-1_-1')
  })
})
```

Append to `app/src/lib/__tests__/planWorld.test.js`:
```js
import { planWorld, makeBoundsOf } from '../tilePlan.js'
function world({ quads = true } = {}) {
  const tiles = [], qs = [], blocks = []
  for (let bx = 0; bx < 2; bx++) blocks.push({ key: `${bx}_0`, bounds: { minX: bx * 2000, maxX: bx * 2000 + 2000, minZ: 0, maxZ: 2000 } })
  for (let qx = 0; qx < 4; qx++) for (let qz = 0; qz < 2; qz++) qs.push({ key: `${qx}_${qz}`, block: `${Math.floor(qx / 2)}_0`, file: `quads/${qx}_${qz}.glb`, bounds: { minX: qx * 1000, maxX: qx * 1000 + 1000, minZ: qz * 1000, maxZ: qz * 1000 + 1000 } })
  for (let tx = 0; tx < 8; tx++) for (let tz = 0; tz < 4; tz++) tiles.push({ key: `${tx}_${tz}`, block: `${Math.floor(tx / 4)}_0`, quad: `${Math.floor(tx / 2)}_${Math.floor(tz / 2)}`, bounds: { minX: tx * 500, maxX: tx * 500 + 500, minZ: tz * 500, maxZ: tz * 500 + 500 } })
  return quads ? { tiles, quads: qs, blocks } : { tiles, blocks }
}
describe('planWorld with quads', () => {
  it('splits only the quads that hold LOD0 tiles; other quads of a touched block draw whole', () => {
    // target 1.2 km west of the world: only tiles 0_1 and 0_2 are within LOD0 range
    expect(Object.fromEntries(planWorld([-1200, 1000], world(), new Map()))).toEqual({
      't:0_1': 'lod0', 't:0_2': 'lod0',
      't:0_0': 'lod1', 't:1_0': 'lod1', 't:1_1': 'lod1', 't:0_3': 'lod1', 't:1_2': 'lod1', 't:1_3': 'lod1',
      'q:1_0': 'quad', 'q:1_1': 'quad',
      'b:1_0': 'block',
    })
  })
  it('falls back to LOD1 tiles when the manifest has no quads', () => {
    const plan = planWorld([-1200, 1000], world({ quads: false }), new Map())
    expect([...plan.values()].filter((v) => v === 'lod1')).toHaveLength(14)
    expect(plan.get('b:1_0')).toBe('block')
    expect([...plan.keys()].some((k) => k.startsWith('q:'))).toBe(false)
  })
  it('makeBoundsOf resolves tile, quad and block ids', () => {
    const b = makeBoundsOf(world())
    expect(b('t:1_1').minX).toBe(500); expect(b('q:1_0').minX).toBe(1000); expect(b('b:1_0').minX).toBe(2000)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline -- tilepack && npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app -- planWorld`
Expected: FAIL with `quadKeyFor is not a function` and `makeBoundsOf is not a function`. The first planWorld case gets 16 tile entries instead of quads.

- [ ] **Step 3: Implement.**

`pipeline/lib/tilepack.js`, appended:
```js
// 1 km quads (2×2 tiles): LOD1 batched between 500 m tiles and 2 km blocks (V8 draw-call budget).
export const QUAD_TILES = 2
export const quadKeyFor = (tileKey) => tileKey.split('_').map((n) => Math.floor(Number(n) / QUAD_TILES)).join('_')
```

`pipeline/build/build-world.js`:
1. Import `quadKeyFor` and `QUAD_TILES` from `../lib/tilepack.js`.
2. Before the tile loop, add `const quads = new Map()`.
3. In the tile loop, right after the block accumulation, **mirror the block accumulation exactly as it stands** (including any `_CALM` water or `_BLDG` renumbering V1–V6 added there), keyed by `const qk = quadKeyFor(key)`:
   ```js
   if (!quads.has(qk)) quads.set(qk, { b: bAcc(), g: { ...acc(), extra: { LAYER: [] } }, w: acc(), block: bk })
   const Q = quads.get(qk)
   appendLayer(Q.b, L1)
   for (const k of ['positions', 'normals', 'uvs']) { for (const v of ground1[k]) Q.g[k].push(v); for (const v of waterM[k]) Q.w[k].push(v) }
   for (const v of ground1.extra.LAYER) Q.g.extra.LAYER.push(v)
   ```
   Also add `quad: qk` to the `tiles.push({ … })` entry.
4. After the blocks are written:
   ```js
   rmSync(join(OUT, 'quads'), { recursive: true, force: true })
   const quadList = []
   for (const [qk, Q] of quads) {
     const [qx, qz] = qk.split('_').map(Number), size = TILE_SIZE * QUAD_TILES
     await writeTileGlb(join(OUT, 'quads', `${qk}.glb`), { buildings: asLayer(Q.b), ground: { ...Q.g, extra: { LAYER: new Float32Array(Q.g.extra.LAYER) } }, water: Q.w })
     quadList.push({ key: qk, block: Q.block, file: `quads/${qk}.glb`, bounds: { minX: qx * size, maxX: (qx + 1) * size, minZ: qz * size, maxZ: (qz + 1) * size } })
   }
   log(`quads: ${quadList.length}`)
   ```
5. Manifest: set `version: 7` and add `quads: quadList` next to `blocks`.

`app/src/lib/tilePlan.js`: replace `planWorld` and add `makeBoundsOf`:
```js
export function makeBoundsOf(manifest) {
  const m = new Map()
  for (const t of manifest.tiles) m.set(`t:${t.key}`, t.bounds)
  for (const q of manifest.quads ?? []) m.set(`q:${q.key}`, q.bounds)
  for (const b of manifest.blocks ?? []) m.set(`b:${b.key}`, b.bounds)
  return (id) => m.get(id)
}

// Whole-world plan: LOD0 tiles near the camera. A 2 km block holding LOD0 tiles splits into 1 km quads; a quad
// holding LOD0 tiles splits into LOD1 tiles; everything else in range draws as one quad or block.
// Worlds without quads (manifest < 7) split touched blocks straight into LOD1 tiles, as before.
export function planWorld(target, manifest, current) {
  const curTiles = new Map([...current].filter(([k]) => k.startsWith('t:')).map(([k, v]) => [k.slice(2), v]))
  const near = planTiles(target, manifest.tiles, curTiles)
  const plan = new Map()
  const lod0Blocks = new Set(), lod0Quads = new Set()
  const byKey = new Map(manifest.tiles.map((t) => [t.key, t]))
  for (const [k, lod] of near) if (lod === 'lod0') { plan.set(`t:${k}`, 'lod0'); lod0Blocks.add(byKey.get(k).block); lod0Quads.add(byKey.get(k).quad) }
  const quadsByBlock = new Map()
  for (const q of manifest.quads ?? []) { if (!quadsByBlock.has(q.block)) quadsByBlock.set(q.block, []); quadsByBlock.get(q.block).push(q) }
  const lod1Tiles = (pred) => { for (const t of manifest.tiles) if (pred(t) && !plan.has(`t:${t.key}`)) plan.set(`t:${t.key}`, 'lod1') }
  for (const b of manifest.blocks ?? []) {
    const [cx, cz] = centre(b.bounds)
    const was = current.has(`b:${b.key}`)
    if (Math.hypot(cx - target[0], cz - target[1]) > LOD1_M * (was ? HYST : 1) + 1000) continue
    if (!lod0Blocks.has(b.key)) { plan.set(`b:${b.key}`, 'block'); continue }
    const qs = quadsByBlock.get(b.key)
    if (!qs) { lod1Tiles((t) => t.block === b.key); continue }
    for (const q of qs) {
      if (lod0Quads.has(q.key)) lod1Tiles((t) => t.quad === q.key)
      else plan.set(`q:${q.key}`, 'quad')
    }
  }
  return plan
}
```

`app/src/world/TileStreamer.jsx`:
1. Import `makeBoundsOf`.
2. Replace both local `boundsOf` definitions (the one inside the first-plan block and the one in the render body) with `const boundsOf = makeBoundsOf(manifest)`, memoised with `useMemo(() => makeBoundsOf(manifest), [manifest])` at the top of the component.
3. Add `const quads = new Map((manifest.quads ?? []).map((q) => [`q:${q.key}`, q]))`.
4. In the render map:
   ```js
   const t = tiles.get(id), q = quads.get(id), b = blocks.get(id)
   const file = b ? b.file : q ? q.file : lod === 'lod0' ? t.lod0 : t.lod1
   ```

- [ ] **Step 4: Run the tests, build, and measure.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline && npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app`
Expected: PASS (all). The earlier planWorld cases use fixtures without quads and still pass through the fallback.

Run: `npm run build:world --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline 2>&1 | grep -E "quads:|manifest written" && du -sh /Users/connorevans/Downloads/Chicago_open_world/app/public/world`
Expected: a `quads: <n>` line, and a size ≤ 200 MB.

If the size is over 200 MB, revert this task (its own commit) and record `Ruling: quads exceed the size budget (<size>) — rely on Levers A + C`.

Then run the perf spec and the eval capture (dev server + Playwright only):
```bash
cd /Users/connorevans/Downloads/Chicago_open_world/app && npx playwright test e2e/perf.spec.js --workers=1 2>&1 | tee ../.superpowers/sdd/2026-09-29-v7-v8-controls-perf-gallery/perf-lever-b.log | grep -E "PERF|passed|failed"
EVAL_MILESTONE=2026-09-29-v7-v8-controls-perf-gallery EVAL_LABEL=after-lever-b EVAL_POSES=wideStreeterville,wideLoop,densest npx playwright test e2e/eval-looks.spec.js --workers=1
```
Compare the pictures with `after-lever-a`. They should match: same LOD1 geometry, with no holes at quad edges while flying. Ledger: the three `PERF` lines and KEEP/REVERT.

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add pipeline/lib/tilepack.js pipeline/tests/tilepack.test.js pipeline/build/build-world.js app/src/lib/tilePlan.js app/src/lib/__tests__/planWorld.test.js app/src/world/TileStreamer.jsx
git commit -m "perf: LOD1 batched into 1 km quads — touched blocks split into quads before tiles; manifest v7 (H11)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git add app/public/world
git commit -m "build: world v7 with LOD1 quads" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Lever C (conditional) — cap LOD0 tiles by quality

**Skip condition:** if the latest perf log shows `maxCalls ≤ 900` at all three poses, skip this task and record `Ruling: Lever C not needed`.

**Files:**
- Modify: `app/src/lib/tilePlan.js` (`planTiles(target, tiles, current, maxLod0 = MAX_LOD0)`, `planWorld(target, manifest, current, maxLod0 = MAX_LOD0)`), `app/src/lib/quality.js` (`maxLod0` per preset), `app/src/world/TileStreamer.jsx` (pass `QUALITY[quality].maxLod0`)
- Test: `app/src/lib/__tests__/tilePlan.test.js` (append), `app/src/lib/__tests__/quality.test.js` (append)

**Interfaces:**
- Produces:
  - `QUALITY.LOW.maxLod0 = 16`, `QUALITY.HIGH.maxLod0 = 28`, `QUALITY.ULTRA.maxLod0 = 36`.
  - `planTiles(…, maxLod0)` never returns more than `maxLod0` LOD0 tiles.

- [ ] **Step 1: Write the failing tests.**

Append to `tilePlan.test.js`:
```js
it('caps LOD0 tiles at maxLod0, nearest first', async () => {
  const { planTiles } = await import('../tilePlan.js')
  const tiles = Array.from({ length: 100 }, (_, i) => ({ key: `${i % 10}_${Math.floor(i / 10)}`, bounds: { minX: (i % 10) * 100, maxX: (i % 10) * 100 + 100, minZ: Math.floor(i / 10) * 100, maxZ: Math.floor(i / 10) * 100 + 100 } }))
  const plan = planTiles([500, 500], tiles, new Map(), 28)
  expect([...plan.values()].filter((v) => v === 'lod0')).toHaveLength(28)
})
```

Append to `quality.test.js`:
```js
it('each quality caps LOD0 tiles (HIGH within the 900-call budget)', async () => {
  const { QUALITY } = await import('../quality.js')
  expect([QUALITY.LOW.maxLod0, QUALITY.HIGH.maxLod0, QUALITY.ULTRA.maxLod0]).toEqual([16, 28, 36])
})
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app -- tilePlan quality`
Expected: FAIL. The cap test gets 36 (the old fixed `MAX_LOD0`), and `maxLod0` is undefined.

- [ ] **Step 3: Implement.**
- In `planTiles`, add a 4th parameter `maxLod0 = MAX_LOD0` and use it in place of `MAX_LOD0` inside the function.
- `planWorld` takes and forwards the same parameter.
- In `quality.js`, add `maxLod0: 16` to LOW, `maxLod0: 28` to HIGH and `maxLod0: 36` to ULTRA.
- In `TileStreamer.jsx`, read `const quality = useStore((s) => s.quality)` and call `planWorld([readout.x, readout.z], manifest, cur, QUALITY[quality].maxLod0)`. Import `QUALITY`, and add `quality` to the effect's dependency list.

- [ ] **Step 4: Run the tests to verify they pass, then measure.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app` → PASS.

Run: `cd /Users/connorevans/Downloads/Chicago_open_world/app && npx playwright test e2e/perf.spec.js --workers=1 2>&1 | tee ../.superpowers/sdd/2026-09-29-v7-v8-controls-perf-gallery/perf-lever-c.log | grep -E "PERF|passed|failed"`
Expected: 3 passed.

Evaluate a `densest` shot (`EVAL_LABEL=after-lever-c EVAL_POSES=densest`). Near-field detail must be unchanged: LOD0 still covers the foreground.

If HIGH still exceeds 900, lower `HIGH.maxLod0` to 24 once and record a `Ruling:`. If it is still over, stop and report: this is executing-plans stop condition 2 (a repeated verification failure).

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add -A app/src
git commit -m "perf: LOD0 tile cap per quality (LOW 16, HIGH 28, ULTRA 36) (H11)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: README — bridges caption (A10), gallery, roadmap and badges (A13)

**Files:**
- Modify: `README.md`
- Create (new files only): `docs/screenshots/v8-bridges-dusk.png`, `docs/screenshots/v8-wide-streeterville-dusk.png`, `docs/screenshots/v8-loop-night.png`

**Interfaces:**
- Consumes:
  - V6's bridges "before" image (backlog E10). Find it with `ls docs/screenshots | grep -i bridge`.
  - The eval shots.

- [ ] **Step 1: Capture the three new images** (dev server + Playwright only).

Run: `cd /Users/connorevans/Downloads/Chicago_open_world/app && EVAL_MILESTONE=2026-09-29-v7-v8-controls-perf-gallery EVAL_LABEL=gallery EVAL_POSES=river,wideStreeterville,loop EVAL_TIMES=dusk,night npx playwright test e2e/eval-looks.spec.js --workers=1`

Then copy them, refusing to overwrite:
```bash
cd /Users/connorevans/Downloads/Chicago_open_world
S=.superpowers/sdd/2026-09-29-v7-v8-controls-perf-gallery/shots/gallery
cp -n $S/river-dusk.png docs/screenshots/v8-bridges-dusk.png
cp -n $S/wideStreeterville-dusk.png docs/screenshots/v8-wide-streeterville-dusk.png
cp -n $S/loop-night.png docs/screenshots/v8-loop-night.png
git status --short docs/screenshots | grep -v '^??' && echo "EXISTING IMAGE CHANGED — STOP" || echo ok
```
Expected: `ok`.

- [ ] **Step 2: Write the gallery section.**

Append after the last vision-pass section. `<V6 bridges image>` is the file found above; if V6 left none, use the Phase 2.5 `phase2-river-day.png`, since it is the image the user was reacting to.

```markdown
### Vision pass · complete — *the bridges, the budget, the whole city at once*

<table>
<tr>
<td width="50%"><img src="docs/screenshots/<V6 bridges image>" alt="The river bridges before the detail work" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v8-bridges-dusk.png" alt="V8 — the detailed bascule bridges at dusk" width="100%"/></td>
</tr>
<tr>
<td><em>"The bridges are starting to look good" — the moment in the build log that started the bridge work.</em></td>
<td><em>The Chicago-type bascule bridges down the river canyon at dusk: trunnion leaves, tender houses, lanterns.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v8-wide-streeterville-dusk.png" alt="V8 — the wide Streeterville view at dusk" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v8-loop-night.png" alt="V8 — the Loop at night" width="100%"/></td>
</tr>
<tr>
<td><em>The widest view of the lakefront — under 900 draw calls with every tree, prop and train pooled per 2 km block.</em></td>
<td><em>The Loop at night: lit crowns, glowing L lines, trains and ballparks in one frame.</em></td>
</tr>
</table>
```

Also replace the "### Next · Vision pass" paragraph with a one-line pointer: `The vision pass is complete — see the sections above; Phase 3 (Blender hero refinement) is next.` The images above it are unchanged.

- [ ] **Step 3: Roadmap and badges (A13).**

Roadmap: change `- [ ] **Vision pass** — …` to:
```
- [x] **Vision pass** — one lake & river, CTA and Metra in true colours with a restrained glow and running trains, stadium game nights & crowds, detailed bridges & landmarks, true building colours, camera clearance, ≤ 900 draw calls
```

Badges:
- `phase` becomes `phase-vision_pass_complete-45d8ff`;
- the landmarks count becomes the number from `node -e "console.log(require('./app/public/world/manifest.json').landmarks.length)"`;
- add `<img alt="draw calls" src="https://img.shields.io/badge/draw_calls-≤900-ff3b53?style=for-the-badge&labelColor=030509"/>` after the skyline badge.

Also check that every roadmap and "What this is" claim matches what shipped (V1–V8 ledgers). Fix any wording that over-claims.

- [ ] **Step 4: Verify no existing image changed.**

Run: `cd /Users/connorevans/Downloads/Chicago_open_world && git diff --stat -- docs/screenshots | tail -1; git log --format=%H -1 -- docs/screenshots >/dev/null; git diff --name-status HEAD -- docs/screenshots | grep -v '^A' || echo "only additions"`
Expected: `only additions`.

- [ ] **Step 5: Commit.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add README.md docs/screenshots/v8-*.png
git commit -m "docs: vision pass complete — bridges caption, final gallery, roadmap and badges (A10, A13)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Final whole-pass review (fresh opus reviewer) and one fix pass

**Files:**
- Create: `.superpowers/sdd/2026-09-29-v7-v8-controls-perf-gallery/final-review.md` (reviewer output, gitignored)
- Modify: only the files named by accepted findings.

**Interfaces:**
- Consumes: `BASE_SHA` (Task 0), `HEAD`.
- Produces: fixed Critical/Important findings, each with a test and a `fix(review):` commit, plus rulings for anything declined.

- [ ] **Step 1: Prepare the diff.**

Run:
```bash
cd /Users/connorevans/Downloads/Chicago_open_world && BASE=<BASE_SHA from the ledger> && \
git diff --stat $BASE..HEAD -- . ':!app/public/world' ':!app/e2e/*-snapshots' ':!docs/screenshots' | tail -3 && \
git diff $BASE..HEAD -- . ':!app/public/world' ':!app/e2e/*-snapshots' ':!docs/screenshots' > .superpowers/sdd/2026-09-29-v7-v8-controls-perf-gallery/vision-pass.diff
```
Expected: a diff file with the V1–V8 source, tests and docs changes, without binaries.

- [ ] **Step 2: Dispatch a fresh reviewer.**

Use the Agent tool with `subagent_type: "feature-dev:code-reviewer"` and `model: "opus"`, and this prompt (fill in the SHA):

> Review the complete CHI ATLAS · OPEN WORLD vision pass (milestones V1–V8), repo `/Users/connorevans/Downloads/Chicago_open_world`, diff `.superpowers/sdd/2026-09-29-v7-v8-controls-perf-gallery/vision-pass.diff` (`<BASE_SHA>..HEAD`, binaries excluded).
>
> **Binding requirements:** spec Addendum B (`docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md`), the backlog (`docs/superpowers/backlog/2026-09-29-vision-backlog.md`) and the master plan (`docs/superpowers/plans/2026-09-29-vision-master-plan.md`).
>
> **Check:**
> - correctness bugs;
> - resource leaks (geometry, textures, pools, listeners, `gl.info.autoReset`);
> - budget risks (draw calls, triangles, `public/world` size);
> - LOW-quality fallbacks for every new system;
> - human-first controls (button + ⌘K + help line for every feature; URL params test-only);
> - graceful live-data fallbacks (`LIVE`/`SIMULATED` chip, no error UI);
> - README image rule (no existing image modified);
> - that every backlog ID assigned to V1–V8 is actually delivered or has a logged ruling.
>
> **Do not run** the dev server, builds or browsers. Reading files and running `npm test --prefix app` and `npm test --prefix pipeline` is fine.
>
> **Output:** a numbered list of findings, each with severity (Critical / Important / Minor), `file:line`, the problem, and a concrete fix. End with a one-line verdict.

Save the reply verbatim to `final-review.md`.

- [ ] **Step 3: Triage.**

For each finding, write a ledger line: `review #<n> <severity>: ACCEPT | DECLINE — reason`.
- Accept every Critical.
- Accept an Important unless it contradicts the spec.
- Record Minors as deferred, with the phase that will handle them.

Declines need a `Ruling:` with cost if wrong. Use superpowers:receiving-code-review: verify each claim against the code before accepting it.

- [ ] **Step 4: One fix pass.**

For each accepted finding, in severity order:
1. Write a failing test that reproduces it (in the owning module's `__tests__` or `pipeline/tests`).
2. Run it and see it fail.
3. Fix it.
4. Run it and see it pass.
5. Commit alone: `git commit -m "fix(review): <finding summary> (#<n>)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"`.

There is no second review round (the master plan says "single fix pass").

- [ ] **Step 5: Full verification after the fixes.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline && npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app`
Expected: both PASS.

Ledger: `V8 review: <a> accepted and fixed, <d> declined, <m> minors deferred`.

---

### Task 16: V8 end-of-milestone checklist (master plan) and push

**Files:**
- Modify: `app/e2e/hero-view.spec.js-snapshots/*` (only if Levers A/B/C or review fixes changed a view intentionally)

**Interfaces:**
- Consumes: everything above.
- Produces: the vision pass on `origin/main`.

- [ ] **Step 1: Run both unit suites green.**

Run: `npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline && npm test --prefix /Users/connorevans/Downloads/Chicago_open_world/app`
Expected: both PASS.

- [ ] **Step 2: Run the world build; the skyline assertion must pass.**

Run: `npm run build:world --prefix /Users/connorevans/Downloads/Chicago_open_world/pipeline 2>&1 | tail -3 && git -C /Users/connorevans/Downloads/Chicago_open_world status --short app/public/world | head -3 && du -sh /Users/connorevans/Downloads/Chicago_open_world/app/public/world`
Expected: exit 0, no unexpected world diff (the build is deterministic), and a size ≤ 200 MB.

- [ ] **Step 3: e2e — regenerate only the baselines V8 intentionally changed, then get 3 consecutive green runs.**

The pooled instances and quads should be pixel-equivalent. Regenerate a baseline only if its diff is explained in the ledger (for example, the HIGH LOD0 cap changing distant detail). Run `cd /Users/connorevans/Downloads/Chicago_open_world/app && npx playwright test -g "<explained views>" --update-snapshots` only for those.

Then run `npx playwright test` three times in a row. This covers hero-view, hud-layout and perf; eval is skipped.
Expected: 3 consecutive all-green runs, with `perf.spec.js` green at all three poses.

- [ ] **Step 4: Perf log against budget.**

Ledger, from the last run's `PERF` lines: `V8 perf: <pose> calls=<avg>/<max> tris=<t> fps=<f>` for wideStreeterville, wideLoop and densest.
Expected: max calls ≤ 900, triangles ≤ 4 M, and fps ≥ 45 at the densest pose at 1440×900 (the Phase 2.5 floor). If fps is below 45, record a `Ruling:` (cost: auto-downgrade to LOW sooner on slower machines).

- [ ] **Step 5: Evaluate-and-revert audit.**

Check that the ledger has a KEEP or REVERT line for Lever A, B (or its skip ruling) and C (or its skip ruling), and for the V7 layout. Check that every revert has its own commit: `git log --oneline | grep -i revert`.

- [ ] **Step 6: Commit and push.**

```bash
cd /Users/connorevans/Downloads/Chicago_open_world
git add -A app/e2e/hero-view.spec.js-snapshots
git diff --cached --quiet || git commit -m "test(e2e): baselines for intentional V8 view changes" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push origin main
```
Expected: the push succeeds. Ledger: `V8: done, pushed <sha>. Vision pass complete.` Also append the same line to `.superpowers/sdd/2026-09-29-vision-master-plan/progress.md`.

---

## Rulings made while writing this plan

1. **The feature registry is the single source for dock, keys, ⌘K, help and hints.** V3–V5's own buttons and handlers are deleted, not kept alongside it. Cost if wrong: V3–V5 tests that clicked the old buttons need their selectors updated (Task 2 · Step 4).
2. **Keys T / G / M** for Transit, Games and Sound. If V3–V5 shipped other keys, the shipped keys win and the registry is updated. Cost if wrong: one registry line.
3. **Side panels stack in one left column** instead of a right-side card. The right column is already dock + minimap + pills. Cost if wrong: cards sit farther from the minimap.
4. **The hint bar drops "turn" and "up/down" first at narrow layouts.** Both stay on the help card. Cost if wrong: two expert keys are less visible.
5. **Pools per 2 km block, not global.** This keeps frustum and shadow culling. Cost if wrong: slightly more calls than a global pool (≤ 6 blocks × kinds).
6. **LOD1 quads are V8's one tile-format change (manifest v7)**, and only if Lever A is not enough. Cost if wrong: `public/world` grows by one LOD1 copy.
7. **The perf chip is reachable from ⌘K and the help card**, and on by default only with `?stats` (tests). Cost if wrong: none.
8. **The final review uses `feature-dev:code-reviewer` on opus** over the V1–V8 source diff without binaries, followed by exactly one fix pass. Cost if wrong: a finding that needs a second round waits for Phase 3.
