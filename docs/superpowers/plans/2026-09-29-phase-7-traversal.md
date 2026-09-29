# Phase 7 — Traversal: Glide and Ride-a-Train Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Later-phase plan (master-plan ruling, 2026-09-29).** This plan is written at task, interface and test level. Code-level implementation steps are completed at phase start, because they depend on what V1–V8 and Phases 3–6 actually shipped (especially V1's clearance, V4's follow cam and train poses, Phase 5's live trains, and Phase 6's ring bounds). Every task carries a **Refresh at phase start** note. Do that refresh first, edit this plan in place, then execute.

**Goal:** Add a second way to move through Chicago, and a third:
- **Glide:** a playable hang-glider over the Loop, with a button and the key G, that never passes through a building;
- **Ride a train:** board an L train at a station, ride in the cab or at a window, and get off at any stop.

**Architecture:**
- **Modes.** Both are new camera modes (`GLIDE`, `RIDE`) in the existing store. Each is driven by a pure, tested state module (`traversal/glide.js`, `traversal/ride.js`) and a thin rig component that writes the camera pose each frame.
- **Glide.** Energy-based flight (dive to gain speed, climb to trade it away). It reads V1's `clearanceAt` both ahead and underneath, so it lifts and slides instead of colliding.
- **Ride.** A state machine over V4's train objects (or Phase 5's live trains through `pickTrains`), and V4's follow-cam pose sampling. Alighting flies the camera back to a clearance-safe station overview.

Neither mode adds world content beyond one glider mesh (1 draw call).

**Tech Stack:** React 19, R3F 9, drei 10, zustand 5, three 0.186, Vitest 5 + RTL, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md`: §1 ("Traversal mode (glide/swing) is a later phase, toggled as a second mode"), §6 Camera (limits: min altitude 30 m, soft bounds), §11 (reduced motion), §14 (street-level walking is out of scope), Addendum B.3 Controls (follow a train, exit on any key), B.7 (clearance: height + 25 m; follow-train uses the same clearance), B.1.4 (human-first). Backlog: I-7.1, I-7.2, C15, G1, G6. Master plan: the P7 row.

## Global Constraints

- **Human-first (B.1.4).** Glide has a **Glide** dock button, the key **G**, ⌘K `Glide over the city` / `Stop gliding`, a help-card group and an on-screen glide HUD that states its own controls. Ride has a **Ride from here** button on every station card, **Ride this train** on every train card, ⌘K `Ride the <line> from <station>`, and a ride HUD with **Get off at next stop**, **Cab / Window** and **Stop riding** buttons. URL parameters are for tests only.
- **Familiar keys.**
  - Glide: ↑/W = nose down (faster), ↓/S = nose up (climb), ←/→ and A/D = bank and turn, Shift = boost, G or Esc = land.
  - Ride: Enter = get off at the next stop, V = cab or window, Esc = stop riding.
  - These keys are active only in their mode. Any other key in RIDE does nothing (a deliberate exception to "follow exits on any key", because a ride is chosen).
- **Clearance (B.7, G1, G6).** No camera or glider pose is ever inside a building.
  - Glide keeps ≥ 12 m above `clearanceAt(x, z)`, looks 1.5 s ahead, and lifts or slides, never stops dead.
  - Ride cameras sit on the train (exempt from the 30 m `MIN_ALT`, like V4's follow cam).
  - Every exit pose is lifted to `max(MIN_ALT, clearanceAt + 25)`.
- **Bounds.** Glide stays inside the union of built rings (Phase 6 `clampToRings`), banking back gently near the edge.
- **Budgets (B.1.6):** +1 draw call (the glider), and 0 for ride; ≤ 900 at HIGH; glide physics ≤ 0.1 ms per frame. At LOW the glider has no trail.
- **Reduced motion (§11):** no camera roll in glide (the horizon stays level), no FOV kick, and instant cuts instead of the boarding fly-in.
- **Realism with a restrained neon accent:** the glider is a sourced hang-glider silhouette (≈ 10 m span) in dark fabric, with a thin cyan leading-edge light that is subtle by day and glows at night.
- **README gallery only appends:** `docs/screenshots/p7-<subject>-<time>.png`.
- Ledger: `.superpowers/sdd/2026-09-29-phase-7-traversal/progress.md`. Push after each task and at the end of the phase.

## Review Focus

1. **Gliding straight at Willis Tower at full speed, or diving into the Loop canyon.** The glider must lift or slide along the façade, never clip through or stop dead, and never be pushed underground. This is pinned in Task 2 (the look-ahead lift and hard-floor tests over a synthetic 440 m block).
2. **Frame hitches** (a tab switch, a 2 s GC pause) producing a huge `dt`. Glide must not tunnel through a building or launch to space. This is pinned in Task 2 (`dt` is clamped and sub-stepped; one 2 s step equals twenty 0.1 s steps within tolerance and stays above clearance).
3. **The boarded train vanishing mid-ride** (a live feed drop, a Phase 6 edge despawn, or a live/sim source switch). The rider must be set down gracefully at the last station passed, with a plain message, and never left staring at empty track. This is pinned in Task 4 (the `TRAIN_LOST` transition test).
4. **Waiting at a station where no train will come** (owl hours, a line not running, a Metra station off-peak, offline with a line the sim does not run). The waiting HUD must say so within a bounded time and offer another line or Cancel. This is pinned in Task 4 (the waiting timeout test and the "no service" check at boarding).
5. **Mode collisions.** Pressing G while riding, ⌘K while gliding, starting a tour while riding, or Scan (X) while gliding must each resolve to one clear mode, with no stuck camera and no double rig writing the camera. This is pinned in Task 1 (the `enterMode` arbitration tests).

---

## Upstream contracts assumed (verify at phase start)

| Symbol | From | Assumed shape | Refresh check |
|---|---|---|---|
| `clearanceAt(x, z) → metres` | V1 (G1) | maximum roof height near (x, z), from `heightfield.png` (8 m cells) | `grep -rn "export function clearanceAt" app/src` |
| `MIN_ALT = 30` | Phase 2.5 | `cameraMath.js` | unchanged? |
| `clampToRings([x, z], rects, margin)`, `boundsFromManifest` | P6 | `cameraMath.js` | read P6 |
| Train objects | V4 / P5 | `{ id, lineId, pathId, s, dir, speed, cars, dwellStationId|null, live? }` from `pickTrains` (P5) or `trainsAt` (V4) | read `trainSource.js`, `sim.js` |
| `trainPose(train, transit, carIndex = 0) → { position: [x, y, z], forward: [x, y, z] }` | V4 (follow cam) | the pose of a car on its path | read V4's follow cam |
| Follow mode | V4 (C15) | `cameraMode === 'FOLLOW'`, `follow: { trainId }`, exits on any key | read V4's rig |
| Station and train cards | V4 (C16) + P5 | `selection.kind === 'station'|'train'` | read the card component |
| `transit.json` stations and paths | V3 | `stations[] { id, name, x, z, y, lines }`, `lines[].paths[] { id, dir, points }` plus terminus names | `jq` |
| Dock, help, ⌘K groups | V7 | final layout | read V7 |
| Tours, Scan | P4, P5 | `cameraMode 'TOUR'`, `scan` | read the store |

---

## File Structure

```
app/src/
  traversal/modes.js            (create) enterMode(store, mode, payload) arbitration; MODE_EXIT_POSE
  traversal/glide.js            (create) GLIDE consts, createGlider, glideStep, chasePose
  traversal/ride.js             (create) stationStops, stopsAhead, nextArrival, rideReducer, ridePose, alightPose, serviceAt
  camera/GlideRig.jsx           (create) keyboard → input; glideStep per frame (sub-stepped); camera from chasePose
  camera/RideRig.jsx            (create) rideReducer on TICK; camera from ridePose; fly-out on alight
  camera/AtlasRig.jsx           (modify) yield control in GLIDE/RIDE (no clamp, no key handling)
  world/GliderAvatar.jsx        (create) one mesh, cyan leading-edge light (uNight-scaled)
  hud/GlideHud.jsx              (create) speed · altitude · boost meter · "G or Esc to land"
  hud/RideHud.jsx               (create) waiting / riding / alighting states with buttons
  hud/cards/...                 (modify V4 cards) "Ride from here" (line × direction), "Ride this train"
  hud/ControlDock.jsx           (modify) Glide button
  hud/CommandPalette.jsx        (modify) Glide / Ride commands
  hud/HelpOverlay.jsx, HintBar.jsx (modify) "Glide & ride" group; mode-specific hints
  state/store.js                (modify) cameraMode += 'GLIDE' | 'RIDE'; ride; glideHud
  */__tests__/*.test.js(x)      (create per task)
app/e2e/traversal.spec.js       (create) glide over the Loop; board at Merchandise Mart, alight at Chicago
```

---

### Task 1: Traversal modes, arbitration and controls shell

**Files:**
- Create: `app/src/traversal/modes.js`
- Modify: `app/src/state/store.js`, `app/src/camera/AtlasRig.jsx`, `app/src/hud/ControlDock.jsx`, `app/src/hud/CommandPalette.jsx`, `app/src/hud/HelpOverlay.jsx`, `app/src/hud/HintBar.jsx`
- Test: `app/src/traversal/__tests__/modes.test.js`, `app/src/hud/__tests__/traversalControls.test.jsx`

**Interfaces:**
- Produces:
  - `cameraMode` values: `'FLY'|'ORBIT'|'TOUR'|'FOLLOW'|'GLIDE'|'RIDE'`
  - `enterMode(mode, payload?) → void` (store action):
    - **One mode at a time.** Entering GLIDE or RIDE ends TOUR (keeping its resume chip, P4), FOLLOW and any flight, and closes the palette.
    - **Glide and ride are exclusive.** Pressing G while riding does nothing and shows the hint "Get off the train first (Esc)".
    - **Scan (X) is allowed in both.** It is a render state, not a camera mode.
    - Entering FLY from GLIDE or RIDE calls `MODE_EXIT_POSE` so the camera lands safely.
  - `MODE_EXIT_POSE(currentPose, clearanceAt) → { position, target }`: it lifts to `max(MIN_ALT, clearanceAt(x, z) + 25)` and looks ahead along the current heading.
  - Keys: G toggles GLIDE (ignored while typing or with the palette open). The dock gets a **Glide** button with `aria-pressed`. ⌘K gets `Glide over the city` and `Stop gliding`.
  - Help group **Glide & ride**:
    - "G or the Glide button — hang-glide over the city";
    - "↑ dive, ↓ climb, ← → turn, Shift boost, G or Esc to land";
    - "Station card — Ride from here; Enter gets off at the next stop; V switches cab / window".

- [ ] **Step 1: Write the failing tests**

```js
// app/src/traversal/__tests__/modes.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../../state/store.js'
import { MODE_EXIT_POSE } from '../modes.js'

describe('mode arbitration', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('entering GLIDE ends a tour and a flight and closes the palette', () => {
    const s = useStore.getState()
    s.setTour({ id: 'river', t: 12, playing: true }); s.startFlight({ position: [0, 300, 0], target: [0, 0, 0] }); s.setPaletteOpen(true)
    s.enterMode('GLIDE')
    const n = useStore.getState()
    expect(n.cameraMode).toBe('GLIDE'); expect(n.tour?.playing ?? false).toBe(false); expect(n.flight).toBeNull(); expect(n.paletteOpen).toBe(false)
  })
  it('GLIDE is refused while riding, with a hint', () => {
    const s = useStore.getState()
    s.enterMode('RIDE', { stationId: 'merch', lineId: 'brown', pathId: 'brown-s' })
    s.enterMode('GLIDE')
    expect(useStore.getState().cameraMode).toBe('RIDE'); expect(useStore.getState().hint).toMatch(/get off the train first/i)
  })
  it('Scan can be toggled while gliding without leaving GLIDE', () => {
    const s = useStore.getState(); s.enterMode('GLIDE'); s.toggleScan()
    expect(useStore.getState().cameraMode).toBe('GLIDE'); expect(useStore.getState().scan).toBe(true)
  })
  it('exit pose is lifted above clearance and MIN_ALT', () => {
    const p = MODE_EXIT_POSE({ position: [0, 12, 0], target: [0, 12, -100] }, () => 440)
    expect(p.position[1]).toBeGreaterThanOrEqual(465)
    const q = MODE_EXIT_POSE({ position: [0, 12, 0], target: [0, 12, -100] }, () => 0)
    expect(q.position[1]).toBeGreaterThanOrEqual(30)
  })
})
```

```jsx
// app/src/hud/__tests__/traversalControls.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ControlDock from '../ControlDock.jsx'
import { useStore } from '../../state/store.js'
import { installTraversalKeys } from '../../traversal/modes.js'

describe('glide controls', () => {
  let off
  beforeEach(() => { useStore.setState(useStore.getInitialState()); off?.(); off = installTraversalKeys() })
  it('the Glide dock button and the G key both toggle GLIDE', () => {
    render(<ControlDock />)
    fireEvent.click(screen.getByRole('button', { name: /glide/i })); expect(useStore.getState().cameraMode).toBe('GLIDE')
    fireEvent.keyDown(window, { code: 'KeyG', key: 'g' }); expect(useStore.getState().cameraMode).toBe('FLY')
  })
  it('G is ignored while the palette is open', () => {
    useStore.getState().setPaletteOpen(true)
    fireEvent.keyDown(window, { code: 'KeyG', key: 'g' }); expect(useStore.getState().cameraMode).toBe('FLY')
  })
})
```

- [ ] **Step 2: Run to verify they fail.** Run `npm test --prefix app -- src/traversal src/hud/__tests__/traversalControls.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. Add `hint` and `setHint` (a transient string, auto-cleared after 3 s) if V7 has no equivalent.
- [ ] **Step 4: Run the tests to verify they pass.** Commit. `git commit -m "feat(p7): traversal modes, arbitration, Glide button and G key"`

**Acceptance:**
- One mode at a time.
- Every mode switch lands the camera at a safe pose.
- A non-coder can start and stop gliding with a button.

**Refresh at phase start:**
- Read V4's `FOLLOW` implementation and V7's keymap (G, V and Enter must be free outside their modes).
- Check whether V7 added a transient hint or toast primitive (reuse it).

---

### Task 2: Glide physics — pure, clearance-safe (I-7.1)

**Files:**
- Create: `app/src/traversal/glide.js`
- Test: `app/src/traversal/__tests__/glide.test.js`

**Interfaces:**
- Produces:
  - `GLIDE = { MIN_V: 18, MAX_V: 75, V_TRIM: 32, DRAG: 0.08, G: 9.81, CLEAR_M: 12, LOOKAHEAD_S: 1.5, MAX_BANK: 0.7, PITCH_DOWN: -0.44, PITCH_UP: 0.35, PITCH_NEUTRAL: -0.05, PITCH_RATE: 1.2, BOOST_A: 6, BOOST_DRAIN: 0.2, BOOST_RECHARGE: 0.1, MAX_ALT: 1500, MAX_DT: 0.1 }`. Speeds are m/s and angles are rad.
  - `createGlider({ position: [x, y, z], heading: rad, speed = 35 }) → Glider`, where `Glider = { pos: [x, y, z], heading, pitch, bank, speed, boost: 1 }`. The heading follows camera-controls' azimuth convention (0 = north, −Z).
  - `glideStep(g, input: { pitch: -1..1, turn: -1..1, boost: boolean }, dt, env: { clearanceAt(x, z), clamp?([x, z]) → [x, z] }) → Glider`:
    - It is pure and deterministic, and sub-steps internally at ≤ `MAX_DT`.
    - Speed: `dv/dt = −G·sin(pitch) − DRAG·(v − V_TRIM) + (boost ? BOOST_A : 0)`, clamped to `[MIN_V, MAX_V]`.
    - Boost drains at 0.2/s while held and recharges at 0.1/s.
    - Stall: below `MIN_V + 2`, the pitch target is forced to `PITCH_DOWN / 2`.
    - Turn rate is `G·tan(bank)/v`.
    - Look-ahead: when `y < clearanceAt(ahead) + CLEAR_M + 10`, the pitch target becomes `PITCH_UP`.
    - Hard floor: `y ≥ clearanceAt(x, z) + CLEAR_M`. Vertical motion into the floor is removed and horizontal motion kept (slide).
    - `y ≤ MAX_ALT`.
    - `env.clamp` keeps the position in the built world. Near the edge, the heading turns toward the inside.
  - `chasePose(g, { back = 18, up = 5, reducedMotion = false }) → { position, target, roll }`, where `roll = reducedMotion ? 0 : g.bank × 0.5`.

- [ ] **Step 1: Write the failing test**

```js
// app/src/traversal/__tests__/glide.test.js
import { describe, it, expect } from 'vitest'
import { GLIDE, createGlider, glideStep, chasePose } from '../glide.js'

const flat = { clearanceAt: () => 0 }
// A 440 m tower occupying x ∈ [-40, 40], z ∈ [-1040, -960] (north of the start)
const tower = { clearanceAt: (x, z) => (Math.abs(x) <= 40 && z >= -1040 && z <= -960 ? 440 : 0) }
const run = (g, input, seconds, env, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) g = glideStep(g, input, dt, env); return g }
const none = { pitch: 0, turn: 0, boost: false }

describe('glide physics', () => {
  it('neutral flight sinks gently (0.5–3 m/s) at a steady trim speed', () => {
    const g0 = createGlider({ position: [0, 800, 0], heading: 0, speed: 35 })
    const g = run(g0, none, 20, flat)
    const sink = (g0.pos[1] - g.pos[1]) / 20
    expect(sink).toBeGreaterThan(0.5); expect(sink).toBeLessThan(3)
    expect(g.speed).toBeGreaterThan(30); expect(g.speed).toBeLessThan(45)
  })
  it('diving gains speed; climbing trades it away', () => {
    const g0 = createGlider({ position: [0, 900, 0], heading: 0, speed: 35 })
    expect(run(g0, { ...none, pitch: 1 }, 5, flat).speed).toBeGreaterThan(45)
    expect(run(g0, { ...none, pitch: -1 }, 5, flat).speed).toBeLessThan(30)
  })
  it('speed stays within [MIN_V, MAX_V]', () => {
    const g0 = createGlider({ position: [0, 1400, 0], heading: 0, speed: 35 })
    for (const p of [1, -1]) { const g = run(g0, { ...none, pitch: p, boost: p > 0 }, 30, flat); expect(g.speed).toBeGreaterThanOrEqual(GLIDE.MIN_V); expect(g.speed).toBeLessThanOrEqual(GLIDE.MAX_V) }
  })
  it('flying straight at a 440 m tower never goes inside it', () => {
    let g = createGlider({ position: [0, 300, 0], heading: 0, speed: 60 })
    for (let t = 0; t < 30; t += 1 / 60) {
      g = glideStep(g, { ...none, pitch: 1 }, 1 / 60, tower)
      expect(g.pos[1]).toBeGreaterThanOrEqual(tower.clearanceAt(g.pos[0], g.pos[2]) + GLIDE.CLEAR_M - 1e-6)
    }
  })
  it('a 2 s hitch equals 20 × 0.1 s steps and stays above clearance (no tunnelling)', () => {
    const g0 = createGlider({ position: [0, 460, -900], heading: 0, speed: 60 })
    const big = glideStep(g0, none, 2, tower)
    let small = g0; for (let i = 0; i < 20; i++) small = glideStep(small, none, 0.1, tower)
    for (let k = 0; k < 3; k++) expect(big.pos[k]).toBeCloseTo(small.pos[k], 3)
    expect(big.pos[1]).toBeGreaterThanOrEqual(440 + GLIDE.CLEAR_M - 1e-6)
  })
  it('banking turns the glider', () => {
    const g = run(createGlider({ position: [0, 800, 0], heading: 0, speed: 35 }), { ...none, turn: 1 }, 5, flat)
    expect(Math.abs(g.heading)).toBeGreaterThan(0.3)
  })
  it('boost is limited by its meter', () => {
    const g = run(createGlider({ position: [0, 800, 0], heading: 0, speed: 35 }), { ...none, boost: true }, 10, flat)
    expect(g.boost).toBe(0)
  })
  it('the world clamp keeps the glider inside the built rings', () => {
    const clamp = ([x, z]) => [Math.max(-1000, Math.min(1000, x)), Math.max(-1000, Math.min(1000, z))]
    const g = run(createGlider({ position: [900, 800, 0], heading: -Math.PI / 2, speed: 50 }), none, 20, { ...flat, clamp })
    expect(Math.abs(g.pos[0])).toBeLessThanOrEqual(1000); expect(Math.abs(g.pos[2])).toBeLessThanOrEqual(1000)
  })
  it('reduced motion keeps the horizon level', () => {
    const g = { ...createGlider({ position: [0, 500, 0], heading: 0 }), bank: 0.6 }
    expect(chasePose(g, { reducedMotion: true }).roll).toBe(0); expect(chasePose(g).roll).toBeCloseTo(0.3)
  })
})
```

- [ ] **Step 2: Run to verify it fails.** Run `npm test --prefix app -- src/traversal/__tests__/glide.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. Tune the constants only within the test bounds, and record any change in the ledger.
- [ ] **Step 4: Run the tests to verify they pass.** Commit. `git commit -m "feat(p7): glide physics — energy flight, look-ahead lift, hard floor (I-7.1)"`

**Acceptance:** all eight properties hold, including no tunnelling under a hitch.

**Refresh at phase start:**
- Confirm `clearanceAt`'s semantics: roof height only, or roof + margin already? `CLEAR_M` must not double-count V1's 25 m.
- Confirm the azimuth convention in `cameraMath.glideVector`.

---

### Task 3: Glide rig, avatar and HUD — playable over the Loop (I-7.1)

**Files:**
- Create: `app/src/camera/GlideRig.jsx`, `app/src/world/GliderAvatar.jsx`, `app/src/hud/GlideHud.jsx`
- Modify: `app/src/world/Scene.jsx`, `app/src/hud/Hud.jsx`, `app/src/camera/AtlasRig.jsx` (disable CameraControls input in GLIDE)
- Create: `app/e2e/traversal.spec.js` (the glide part)
- Test: `app/src/hud/__tests__/glideHud.test.jsx`, `app/src/camera/__tests__/glideInput.test.js`

**Interfaces:**
- Consumes: `glideStep`, `chasePose`, `createGlider` (Task 2); `clearanceAt` (V1); `clampToRings`, `boundsFromManifest` (P6); `enterMode`, `MODE_EXIT_POSE` (Task 1); `keyIntent` codes (`controls.js`).
- Produces:
  - `glideInput(keys: Set<string>) → { pitch, turn, boost }`: ArrowUp or KeyW → pitch +1 (nose down); ArrowDown or KeyS → −1; ArrowLeft or KeyA → turn −1; ArrowRight or KeyD → +1; either Shift → boost.
  - `<GlideRig/>`:
    - on entry, it creates the glider from the current camera: position lifted to ≥ clearance + 60, heading = camera azimuth, speed 35;
    - each frame, it steps with `min(dt, 0.25)` (`glideStep` sub-steps) and writes the camera from `chasePose`;
    - it publishes `glideHud: { speedKmh, altM, boost }` at 10 Hz;
    - on exit, it calls `MODE_EXIT_POSE`.
  - `<GliderAvatar/>`: one mesh (≈ 10 m span hang glider with a pilot silhouette, ≤ 3 k triangles). Its cyan leading-edge emissive is scaled by `uNight` (≤ 15 % by day, B.1.1), and it has no trail at LOW.
  - `<GlideHud/>`: "142 km/h · 380 m", a boost meter, and "G or Esc to land" as a button that exits.

- [ ] **Step 1: Write the failing tests**

```js
// app/src/camera/__tests__/glideInput.test.js
import { describe, it, expect } from 'vitest'
import { glideInput } from '../GlideRig.jsx'
describe('glide input', () => {
  it('maps familiar keys', () => {
    expect(glideInput(new Set(['ArrowUp']))).toEqual({ pitch: 1, turn: 0, boost: false })
    expect(glideInput(new Set(['KeyS', 'KeyD', 'ShiftLeft']))).toEqual({ pitch: -1, turn: 1, boost: true })
    expect(glideInput(new Set(['ArrowLeft', 'ArrowRight']))).toEqual({ pitch: 0, turn: 0, boost: false })
  })
})
```

```jsx
// app/src/hud/__tests__/glideHud.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GlideHud from '../GlideHud.jsx'
import { useStore } from '../../state/store.js'

describe('glide HUD', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useStore.getState().enterMode('GLIDE'); useStore.setState({ glideHud: { speedKmh: 142, altM: 380, boost: 0.6 } }) })
  it('shows speed and altitude and lands with its button', () => {
    render(<GlideHud />)
    expect(screen.getByText(/142 km\/h/)).toBeInTheDocument(); expect(screen.getByText(/380 m/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /land/i }))
    expect(useStore.getState().cameraMode).toBe('FLY')
  })
})
```

```js
// app/e2e/traversal.spec.js — glide part
import { test, expect } from '@playwright/test'
test('a playable glide over the Loop', async ({ page }) => {
  await page.goto('/?view=loop&stats')
  await page.waitForFunction(() => window.__worldReady === true)
  await page.getByRole('button', { name: /glide/i }).click()
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(3000); await page.keyboard.up('ArrowUp')
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(2000); await page.keyboard.up('ArrowLeft')
  const s = await page.evaluate(() => window.__store.getState())
  expect(s.cameraMode).toBe('GLIDE'); expect(s.glideHud.speedKmh).toBeGreaterThan(60)
  await expect(page).toHaveScreenshot('glide-loop.png', { maxDiffPixelRatio: 0.03 })
  await page.keyboard.press('g')
  expect(await page.evaluate(() => window.__store.getState().cameraMode)).toBe('FLY')
})
```

- [ ] **Step 2: Run to verify they fail.** Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start.
- [ ] **Step 4: Run the tests and e2e.** Then do a manual playtest (one heavy process): 5 minutes over the Loop, River and lakefront, deliberately flying into Willis, Trump and the Aon. Log any clip. Evaluate and revert the avatar (day and night).
- [ ] **Step 5: Perf.** +1 draw call, and glide logic ≤ 0.1 ms per frame. Commit and push. `git commit -m "feat(p7): playable glide over the Loop — rig, avatar, HUD (I-7.1)"`

**Acceptance:**
- Per I-7.1, a playable glide over the Loop, with a button and a key.
- It never passes through a building.
- Landing returns to FLY at a safe pose.

**Refresh at phase start:**
- Check how AtlasRig exposes the camera and its controls (the CameraControls ref) so GlideRig can take over without fighting it; V4's FOLLOW solved the same problem, so reuse its pattern.
- Check the `?stats` debug hooks (`__store`, `__gl`) still exist.

---

### Task 4: Ride a train — board, ride, alight (I-7.2, C15, G6)

**Files:**
- Create: `app/src/traversal/ride.js`, `app/src/camera/RideRig.jsx`, `app/src/hud/RideHud.jsx`
- Modify: V4's station and train cards (**Ride from here** with one button per line × direction; **Ride this train**), `app/src/hud/CommandPalette.jsx` (`Ride the <line> from <station>` rows when the query contains "ride"), `app/src/world/Scene.jsx`, `app/src/hud/Hud.jsx`
- Test: `app/src/traversal/__tests__/ride.test.js`, `app/src/hud/__tests__/rideHud.test.jsx`, `app/e2e/traversal.spec.js` (append the ride part)

**Interfaces:**
- Consumes: `pickTrains` (P5) or `trainsAt` (V4); `trainPose` (V4); `transit.json`; `MODE_EXIT_POSE`, `enterMode` (Task 1); `clearanceAt` (V1); `startFlight`.
- Produces:
  - `stationStops(transit) → Map<stationId, [{ pathId, lineId, s }]>`: each station projected onto each path of each line it serves (≤ 40 m off-path, else skipped).
  - `stopsAhead(train, stops) → [{ stationId, s, etaS }]`: the stops on `train.pathId` with `s > train.s`, ascending; `etaS = (s − train.s) / max(train.speed, 8)`.
  - `serviceAt({ stationId, lineId, pathId }, trains) → boolean`: whether any train is currently on that line and path.
  - `nextArrival({ stationId, lineId, pathId }, trains, stops) → { trainId, etaS } | null`: the approaching train with the smallest ETA.
  - `rideReducer(state, event) → state`, where:
    - `state = { phase: 'idle'|'waiting'|'riding'|'alighting', stationId?, lineId?, pathId?, trainId?, view: 'cab'|'window', alightAt?: stationId, lastPassed?: stationId, missedTicks?: number, since: tMs, message?: string }`. Every riding TICK updates `lastPassed`.
    - `event` is one of `BOARD_REQUEST { stationId, lineId, pathId, tMs }`, `BOARD_TRAIN { trainId, tMs }`, `TICK { trains, stops, tMs }`, `REQUEST_ALIGHT { stationId: 'next'|id, trains, stops }`, `TOGGLE_VIEW`, `CANCEL`.
    - The HUD never calls the reducer directly. Enter and the button set `ride.alightRequested = true` in the store, and `RideRig` turns that into `REQUEST_ALIGHT` on its next TICK. The store's `ride` also carries `next: { name, etaS }` for the HUD.
  - Transitions:
    - **waiting → riding** when a matching train is dwelling at the station (`dwellStationId === stationId`, or `|s − stop.s| < 15` with speed < 1).
    - **waiting → idle** with the message "No <line> trains toward <terminus> right now" after 15 min, or immediately when `!serviceAt` on the first TICK.
    - **riding → alighting** when the train dwells at `alightAt`.
    - **riding → alighting at the last passed stop** with the message "The train left the map — you got off at <station>" when the train disappears (`TRAIN_LOST`: absent from `trains` on 2 consecutive TICKs).
    - **alighting → idle** after the fly-out.
    - **CANCEL** goes from any phase to idle.
  - `ridePose(train, view, trainPose) → { position, target }`:
    - cab: the lead car front, 2.8 m above the rail, looking forward 60 m;
    - window: the second car's right side, 2.2 m up, looking out perpendicular, with a slight forward bias.
  - `alightPose(station, clearanceAt) → { position, target }`: a station overview lifted by `MODE_EXIT_POSE` rules.
  - `<RideRig/>` dispatches `TICK` at 10 Hz, writes the camera each frame from `ridePose` (exempt from `MIN_ALT`), and on alight calls `startFlight(alightPose)`.
  - `<RideHud/>`:
    - waiting: "Waiting for a Brown Line train toward the Loop — about 3 min", plus **Cancel**;
    - riding: a line swatch, "Next: Chicago · 1 min", **Get off at next stop** (Enter), **Cab / Window** (V) and **Stop riding** (Esc);
    - alighting: "Arriving at Chicago".

- [ ] **Step 1: Write the failing tests**

```js
// app/src/traversal/__tests__/ride.test.js
import { describe, it, expect } from 'vitest'
import { stationStops, stopsAhead, nextArrival, serviceAt, rideReducer } from '../ride.js'

const transit = {
  lines: [{ id: 'brown', kind: 'cta', paths: [{ id: 'brown-s', dir: 'S', points: [[0, -3000], [0, 0]] }] }],
  stations: [{ id: 'chicago', name: 'Chicago', x: 5, z: -2000, lines: ['brown'] }, { id: 'merch', name: 'Merchandise Mart', x: -3, z: -1000, lines: ['brown'] }, { id: 'far', name: 'Far', x: 900, z: 0, lines: ['brown'] }],
}
const stops = stationStops(transit)
const train = (o) => ({ id: 't1', lineId: 'brown', pathId: 'brown-s', s: 500, speed: 12, dwellStationId: null, ...o })
const idle = { phase: 'idle', view: 'cab', since: 0 }

describe('ride helpers', () => {
  it('projects stations onto paths and skips far ones', () => {
    expect(stops.get('chicago')[0].s).toBeCloseTo(1000, 0); expect(stops.get('merch')[0].s).toBeCloseTo(2000, 0); expect(stops.has('far')).toBe(false)
  })
  it('lists stops ahead with ETAs', () => {
    expect(stopsAhead(train({ s: 1200 }), stops).map((x) => x.stationId)).toEqual(['merch'])
  })
  it('finds the next approaching train and reports service', () => {
    const trains = [train({ id: 'a', s: 100 }), train({ id: 'b', s: 1500 }), train({ id: 'c', s: 1900 })]
    expect(nextArrival({ stationId: 'merch', lineId: 'brown', pathId: 'brown-s' }, trains, stops).trainId).toBe('c')
    expect(serviceAt({ stationId: 'merch', lineId: 'brown', pathId: 'brown-s' }, [])).toBe(false)
  })
})

describe('rideReducer', () => {
  const board = rideReducer(idle, { type: 'BOARD_REQUEST', stationId: 'chicago', lineId: 'brown', pathId: 'brown-s', tMs: 0 })
  it('boards when a train dwells at the station', () => {
    expect(board.phase).toBe('waiting')
    const r = rideReducer(board, { type: 'TICK', trains: [train({ s: 1000, speed: 0, dwellStationId: 'chicago' })], stops, tMs: 60_000 })
    expect(r.phase).toBe('riding'); expect(r.trainId).toBe('t1')
  })
  it('gives up with a plain message when no service or after 15 min', () => {
    expect(rideReducer(board, { type: 'TICK', trains: [], stops, tMs: 1000 })).toMatchObject({ phase: 'idle', message: expect.stringMatching(/No Brown Line trains/i) })
    const w = rideReducer(board, { type: 'TICK', trains: [train({ s: 100 })], stops, tMs: 1000 })
    expect(rideReducer(w, { type: 'TICK', trains: [train({ s: 100 })], stops, tMs: 15 * 60_000 + 1 }).phase).toBe('idle')
  })
  it('gets off at the next stop on request', () => {
    let r = { phase: 'riding', trainId: 't1', view: 'cab', since: 0 }
    r = rideReducer(r, { type: 'REQUEST_ALIGHT', stationId: 'next', trains: [train({ s: 1200 })], stops })
    expect(r.alightAt).toBe('merch')
    r = rideReducer(r, { type: 'TICK', trains: [train({ s: 2000, speed: 0, dwellStationId: 'merch' })], stops, tMs: 5000 })
    expect(r.phase).toBe('alighting'); expect(r.stationId).toBe('merch')
  })
  it('sets the rider down at the last passed stop if the train vanishes', () => {
    let r = { phase: 'riding', trainId: 't1', view: 'cab', since: 0, lastPassed: 'chicago' }
    r = rideReducer(r, { type: 'TICK', trains: [], stops, tMs: 1000 })
    r = rideReducer(r, { type: 'TICK', trains: [], stops, tMs: 1100 })
    expect(r).toMatchObject({ phase: 'alighting', stationId: 'chicago', message: expect.stringMatching(/left the map|got off/i) })
  })
  it('cancel always returns to idle; V toggles the view', () => {
    expect(rideReducer({ phase: 'riding', trainId: 't1', view: 'cab' }, { type: 'CANCEL' }).phase).toBe('idle')
    expect(rideReducer({ phase: 'riding', trainId: 't1', view: 'cab' }, { type: 'TOGGLE_VIEW' }).view).toBe('window')
  })
  it('can hop straight onto a selected train mid-route', () => {
    expect(rideReducer(idle, { type: 'BOARD_TRAIN', trainId: 't1', tMs: 0 })).toMatchObject({ phase: 'riding', trainId: 't1' })
  })
})
```

```jsx
// app/src/hud/__tests__/rideHud.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RideHud from '../RideHud.jsx'
import { useStore } from '../../state/store.js'

describe('ride HUD', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useStore.getState().enterMode('RIDE', { stationId: 'merch', lineId: 'brown', pathId: 'brown-s' }) })
  it('riding shows the next stop and plain buttons; Enter requests the next stop; Esc stops riding', () => {
    useStore.setState({ ride: { phase: 'riding', trainId: 't1', view: 'cab', lineId: 'brown', next: { name: 'Chicago', etaS: 60 } } })
    render(<RideHud />)
    expect(screen.getByText(/Next: Chicago/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /get off at next stop/i })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' }); expect(useStore.getState().ride.alightRequested).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' }); expect(useStore.getState().cameraMode).toBe('FLY')
  })
})
```

```js
// append to app/e2e/traversal.spec.js — ride part (simulated trains; VITE_CHI_API_URL unset)
test('board at Merchandise Mart and get off at Chicago', async ({ page }) => {
  await page.goto('/?view=river')
  await page.waitForFunction(() => window.__worldReady === true)
  await page.getByRole('button', { name: /search/i }).click()
  await page.keyboard.type('Ride the Brown Line from Merchandise Mart'); await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__store.getState().ride?.phase === 'riding', null, { timeout: 20 * 60_000 / 20 }) // tests run the sim clock ×20 (refresh: V4 test clock hook)
  await page.getByRole('button', { name: /get off at next stop/i }).click()
  await page.waitForFunction(() => window.__store.getState().cameraMode === 'FLY', null, { timeout: 120_000 })
  const s = await page.evaluate(() => window.__store.getState())
  expect(s.readout.altitude).toBeGreaterThanOrEqual(30)
})
```

- [ ] **Step 2: Run to verify they fail.** Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. The ⌘K ride rows are generated only when the query includes "ride", so 150+ stations × lines never flood the default list.
- [ ] **Step 4: Run the unit tests and e2e.** Then do a manual ride (one heavy process): Brown around the Loop in both views, live (CHI local) and simulated. Force a live→sim switch mid-ride (stop the backend) to check `TRAIN_LOST` handling. Log it.
- [ ] **Step 5: Evaluate and revert** the cab and window views (day, night, and rain if P5 shipped it). Commit and push. `git commit -m "feat(p7): ride a train — board, cab/window, get off at any stop (I-7.2)"`

**Acceptance:**
- Per I-7.2, board and alight at stations, from the station card, the train card and ⌘K.
- Riding works with live and simulated trains.
- Every exit lands the camera at a safe pose.

**Refresh at phase start:**
- Read V4's train object and `trainPose`, and whether a test clock hook exists for e2e (the ×20 sim time).
- Read P5's `pickTrains` and whether live train ids survive the source switch (they do not: `rn:` versus sim ids, hence `TRAIN_LOST`).
- Check whether V3 station data already carries per-path arc positions (if so, `stationStops` reuses them).

---

### Task 5: Phase close — help, hints, gallery, push

**Files:**
- Modify: `app/src/hud/HelpOverlay.jsx`, `app/src/hud/HintBar.jsx` (mode-specific hints: in GLIDE "↑ dive · ↓ climb · ← → turn · Shift boost · G land"; in RIDE "Enter next stop · V view · Esc stop riding"), `README.md`, `docs/screenshots/p7-*.png` (append only)
- Test: `app/src/hud/__tests__/help.test.jsx` (append), `app/src/hud/__tests__/hud.test.jsx` (append)

**Interfaces:**
- Produces: `hintsFor(cameraMode) → [key, label][]`, exported from `HintBar.jsx`.

- [ ] **Step 1: Write the failing tests**

```jsx
// append to app/src/hud/__tests__/hud.test.jsx
import { hintsFor } from '../HintBar.jsx'
it('the hint bar switches to glide and ride controls in those modes', () => {
  expect(hintsFor('GLIDE').map(([k]) => k)).toEqual(expect.arrayContaining(['↑', '↓', 'G']))
  expect(hintsFor('RIDE').map(([k]) => k)).toEqual(expect.arrayContaining(['Enter', 'V', 'Esc']))
  expect(hintsFor('FLY').map(([k]) => k)).toContain('⌘K')
})
```

```jsx
// append to app/src/hud/__tests__/help.test.jsx
it('help card explains gliding and riding in plain words', () => {
  useStore.getState().setHelpOpen(true)
  render(<HelpOverlay />)
  expect(screen.getByText(/Glide & ride/i)).toBeInTheDocument()
  expect(screen.getByText(/Ride from here/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run them to fail, implement, then run them to pass.**
- [ ] **Step 3: Run the end-of-phase checklist.**
- [ ] **Step 4: README.** Append `p7-glide-over-the-loop-dusk.png`, `p7-ride-brown-line-cab-day.png` and `p7-ride-window-night.png`, with captions, and tick Phase 7.
- [ ] **Step 5: Commit and push.** `git commit -m "feat(p7): traversal complete — help, hints, gallery"`, then `git push origin main`.

**Acceptance:** I-7.1 and I-7.2 are ticked, and budgets are logged.

**Refresh at phase start:** check V7's hint-bar implementation (whether it is already mode-aware).

---

## End-of-phase checklist

1. `npm test --prefix pipeline` and `npm test --prefix app` are green.
2. There is no world rebuild (this is an app-only phase), and the existing e2e baselines are unchanged.
3. e2e `traversal.spec.js`: 3 consecutive green runs, simulated (deterministic).
4. Perf at the wide Streeterville and Loop poses while gliding and while riding: ≤ 900 draw calls, ≤ 4 M triangles, 60 fps.
5. The manual clip-hunt log (glide into the 10 tallest heroes) is in the ledger with zero penetrations.
6. Evaluate-and-revert lines for the avatar, the cab view and the window view.
7. Push.

## Rulings made while writing this plan

- Ruling: traversal is **glide only**. Swing (spec §1's "glide/swing") is deferred, because swinging needs anchor physics on façades and street-level readability, which §14 puts out of scope. Cost if wrong: no Spider-Man-style swinging this phase.
- Ruling: the glider is a sourced hang-glider silhouette with a thin cyan leading edge, not a character or superhero. Realism with a restrained neon accent (B.1.1). Cost if wrong: less playful; the model is a single swap.
- Ruling: glide steering is ↑ = dive and ↓ = climb (flight-sim convention, and consistent with ↑ = forward in FLY). Cost if wrong: some players expect inverted pitch; an "Invert pitch" help-card toggle can be added in one line.
- Ruling: the glide and ride cameras are exempt from `MIN_ALT` (as V4's follow cam is) but never from clearance. Every exit lifts to `max(MIN_ALT, clearance + 25)`. Cost if wrong: none; street-level walking stays out of scope (§14).
- Ruling: in RIDE, stray keys do nothing (only Enter, V and Esc act), unlike FOLLOW's exit on any key, because a ride is an explicit choice. Cost if wrong: a user expecting any key to exit must press Esc or the button, and both are on screen.
- Ruling: if a boarded train disappears (live feed drop, source switch or edge despawn), the rider is set down at the last station passed, with a plain message, rather than silently re-attached to another train. Cost if wrong: an occasional early exit during feed flaps.
- Ruling: ⌘K ride rows appear only when the query contains "ride", so they never flood the default palette. Cost if wrong: discoverability relies on the station card button and the help card, both present.
