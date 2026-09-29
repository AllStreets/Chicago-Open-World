# V5 — Stadiums and Sports Life Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chicago's five venues come alive, covering backlog D2–D15 (D1, the Soldier Field trees, ships in V1):
- **Roofs:** real arena roofs.
- **Fields:** canvas-painted fields in true colours and dimensions.
- **Night:** floodlit nights.
- **Schedule:** game days driven by a build-time ESPN schedule.
- **People:** crowds, players and a ball.
- **Boards and flags:** score boards and the Cubs W flag.
- **Arenas:** lit arena game nights.
- **Sound:** synthesised positional cheers.
- **Controls:** a Games button, ⌘K entry and venue card that a non-coder can use.

**Architecture:**
- **Pipeline.** It keeps building venues into the shared building layer, with three changes:
  - `venue.js` emits one field surface per open-air venue, in its local field frame (façade 24, with the venue slot carried in `_SEED`);
  - it emits seat anchors, board faces and a flag pole into a new world-level sidecar (`venues.json` plus packed Int16 `venues/*.bin`);
  - two new crown primitives shape the arena roofs.
- **App: pure modules in `app/src/sports/`.**
  - `gameState` computes each venue's state from `schedules.json`, or from a simulated calendar.
  - `fieldMarks` builds the field drawings, which are painted into a `DataArrayTexture` sampled by the façade shader, so fields add zero draw calls.
  - A spatial `uVenueLight[8]` uniform dims or lights each venue by game state.
- **App: small R3F components.** One instanced draw call each for the crowd, the players and the ball, with scoreboards, the W flag and cheers alongside.

**Tech Stack:**
- Node 22 ESM pipeline: earcut, polygon-clipping, vitest.
- Vite 8, React 19, @react-three/fiber 9, three 0.186, zustand 5, vitest 5 with jsdom, Playwright 1.63.
- Public ESPN site API: build time only.
- WebAudio.

**Spec:** `docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md`, Addendum B.4 (binding), with B.1 standing rules. Items come from `docs/superpowers/backlog/2026-09-29-vision-backlog.md` (D2–D15); ordering from `docs/superpowers/plans/2026-09-29-vision-master-plan.md` (V5).

## Global Constraints

- **Start and mode:**
  - Coding starts only after the user's explicit "go ahead".
  - No human in the loop: decide, and record `Ruling:` lines in the ledger `docs/superpowers/ledgers/v5-stadiums-sports-life.md`.
- **Realism:** geometry, colours and materials are faithful and sourced. Every value in pipeline data carries a `source`.
- **Evaluate and revert (B.1.2):**
  - Every colour, material or glow change is screenshotted before and after at fixed poses (day, dusk, night).
  - A change that looks unpleasing is reverted in its own commit, with a ledger line.
- **README is history:**
  - Existing images are never modified.
  - New gallery images are `docs/screenshots/v5-<subject>-<time>.png`.
- **Human-first:**
  - Every feature has a button, a ⌘K entry and a help-card line.
  - URL parameters (`?pose=`, `?sports=`, `?stats`) are for tests only.
- **Live data degrades gracefully:**
  - A simulated fallback, and a `LIVE` / `SIMULATED` chip.
  - No error UI.
  - The app never calls ESPN; the build-time fetch is cached in `schedules.json`. Live scores are Phase 5, through the CHI ATLAS API.
- **Budgets (B.1.6):**
  - HIGH: ≤ 900 draw calls per frame (shadow and post passes included) at the wide Streeterville and Loop poses; ≤ 4 M triangles per frame; 60 fps on M-series; `app/public/world` ≤ 200 MB.
  - Crowds and players: ≤ 3 calls per venue.
  - Every new system has a LOW fallback.
- **B.4 specifics:**
  - The field texture stays on one draw call per venue (here: zero added) and works at LOW.
  - Crowds and players are culled beyond 1.5 km and disabled at LOW.
  - Cheers are off by default, behind the Sound button shared with the train rumble (`soundOn` from `app/src/audio/soundStore.js`, defined in V4; never redefine it).
- **Official colours (sourced, used verbatim):**
  - Bears navy `#0B162A`, orange `#C83803`.
  - Cubs blue `#0E3386`, red `#CC3433`.
  - White Sox black `#27251F`, silver `#C4CED4`.
  - Bulls red `#CE1141`; Blackhawks red `#CF0A2C`.
  - Fire red `#FF0000`, sky blue `#7CCDEF`.
  - Sky blue `#418FDE`, yellow `#FFCD00`.
- **Local coordinates:** metres, origin State & Madison, +X east, −Z north, +Y up (`shared/project.js`).
- **Process:**
  - RAM discipline: one heavy process at a time (world build, or dev server plus Playwright, never both).
  - Close browsers when done.
  - Push to `origin main` (AllStreets/Chicago-Open-World) at the end of the milestone.
  - End every commit message with the session's attribution trailer.
- **TDD:** a failing test first for every pure function, pipeline builder and state machine. Visual work uses the fixed poses in `app/e2e/v5-shots.json`.

## Review Focus

These five inputs are implied by the spec, but a happy-path test would miss them. Each is pinned to a test in the task that owns the code:

1. **A Cubs night game near midnight, on a DST-change date, viewed from another time zone.** Expected: the W flag day is the Chicago calendar date of the game, whatever the host time zone, and it never leaks into the next Chicago date.
   - Pinned in Task 9, `winDay follows the Chicago date across DST and host time zones`, run under `TZ=Asia/Tokyo` and `TZ=America/Los_Angeles`.
2. **A postponed or cancelled game in `schedules.json`.** Expected: the venue stays `idle` (dark, empty); no crowd and no W/L flag.
   - Pinned in Task 9, `postponed and cancelled games never light a venue`.
3. **A missing, malformed, empty or months-old `schedules.json`.** Expected: the app silently uses the simulated calendar, the chip reads `SIMULATED`, and no error is shown.
   - Pinned in Task 12, `falls back to the simulated calendar on 404, bad JSON, empty or stale data`.
4. **Two games sharing a venue or a day:** a doubleheader, Bulls and Blackhawks at the United Center, Bears and Fire at Soldier Field, or a Crosstown game listed by both teams. Expected: `live` beats `pregame` beats `postgame`; the Crosstown game appears once and still counts for the Cubs' W.
   - Pinned in Task 8, `merges a Crosstown game listed by both teams`.
   - Pinned in Task 9, `live beats pregame beats postgame at a shared venue`.
5. **A visitor who never touches Sound.** Expected: no `AudioContext` is created, and nothing plays, until `soundOn` becomes true; turning it off suspends the audio.
   - Pinned in Task 19, `creates no AudioContext until enabled and suspends on disable`.

---

## File Structure

**Pipeline** (Node, `pipeline/`):

| File | Responsibility |
|---|---|
| `pipeline/lib/geom.js` (modify) | + `distToRing(p, ring)` |
| `pipeline/lib/crowns.js` (modify) | + `vault`, `stepdome` roof primitives |
| `pipeline/lib/heroes.js` (modify) | register the new crowns; default crown `ring`; pass `sports.slot` / `capacity` to venues |
| `pipeline/lib/venue.js` (modify) | façade 24 `field` surface in the field frame; seat anchors; rim light rows; board faces and flag pole; the `venue` info entry |
| `pipeline/lib/sportsSites.js` (create) | deterministic `shuffled`; `encodeAnchors`; `plazaAnchors`; `venueRecord` |
| `pipeline/lib/schedules.js` (create) | ESPN URLs, event parsing, merge, `fetchAllSchedules` |
| `pipeline/fetch/fetch-schedules.js` (create) | CLI: ESPN → `pipeline/data/schedules.json` and `app/public/world/schedules.json` |
| `pipeline/build/build-world.js` (modify) | writes `venues.json` and `venues/*.bin`; copies `schedules.json`; manifest keys |
| `pipeline/data/heroes.json` (modify) | arena crowns; `sports` blocks; Soldier and Rate rim lights; Rate towers |
| `shared/teams.js` (create) | the seven teams: ESPN ids, colours, home venues; venue-name map |

**App, pure modules** (React app, `app/src/`):

| File | Responsibility |
|---|---|
| `app/src/lib/bookmarks.js` (modify) | test-only `?pose=` |
| `app/src/sports/chicagoTime.js` | Chicago wall-clock dates and times (DST, host-TZ independent) |
| `app/src/sports/gameState.js` | `gameState`, `gameWindow`, `nextGame`, `resultDay` |
| `app/src/sports/simSchedule.js` | deterministic simulated calendar |
| `app/src/sports/venueStates.js` | `computeStates`, `overrideStates`, `parseOverride`, `lightLevel`, `isStale` |
| `app/src/sports/sportsStore.js` | zustand store (`cardVenue`, board overrides, swells); `loadSchedule`, `loadVenues` |
| `app/src/state/store.js` (modify) | `gamesOpen`, `setGamesOpen` (the V7 contract) |
| `app/src/sports/anchors.js` | `decodeAnchors`, `frameToWorld`, `fieldFans`, `fetchAnchors` |
| `app/src/sports/fieldMarks.js` | field drawings as ops in frame metres (football, soccer, Wrigley, Sox) |
| `app/src/sports/paintField.js` | runs the ops on a 2D context |
| `app/src/sports/fieldTexture.js` | `buildFieldArray`, `layoutFor`, `fieldSport` |
| `app/src/sports/crowd.js` | shirts, densities, visibility, celebration, home team |
| `app/src/sports/formations.js` | player formations, ball arc, kit colours |
| `app/src/sports/scoreboard.js` | board lines, simulated running score, period label, board drawing; the Phase 5 hook `setScoreboard` |
| `app/src/sports/winFlag.js` | `flagKind`, `drawFlag` |
| `app/src/sports/tonight.js` | `tonightsGame`, `stateLabel`, `gameLabel`, `dataChip` |
| `app/src/sports/venueFocus.js` | `venueFocusPose(venue)` (the V7 contract; V7 adds clearance) |
| `app/src/sports/palette.js` | `gamePlaces({ venues, states, nowMs })` (the V7 contract), `goToVenue` |
| `app/src/audio/cheerMath.js` | pure: attenuation, murmur, swell times and envelope |
| `app/src/audio/cheers.js` | WebAudio engine (lazy `AudioContext`); the Phase 5 hook `cheer(venueKey, strength)` |
| `app/src/world/materials/facadeMaterial.js` (modify) | field texture array; venue light levels; lit fascia; colonnade uplight |

**App, components:**

| File | Responsibility |
|---|---|
| `app/src/sports/SportsClock.jsx` | loads data; recomputes states every 15 s; sets venue lights |
| `app/src/sports/SportsLife.jsx` | per venue: culling group, crowd, players, ball, boards, flag; field textures |
| `app/src/sports/FieldTextures.jsx` | builds and swaps the field texture array |
| `app/src/sports/Crowd.jsx` | instanced impostors (seats, plaza, field fans) |
| `app/src/sports/Players.jsx` | instanced capsule players, and `Ball` |
| `app/src/sports/Scoreboard.jsx` | canvas score texture on each board |
| `app/src/sports/WinFlag.jsx` | the waving W/L flag |
| `app/src/sports/Cheers.jsx` | drives the cheers engine from camera, states and `soundOn` |
| `app/src/hud/GamesPanel.jsx` | the Games panel |
| `app/src/hud/VenueCard.jsx` | the venue card |
| `app/src/hud/Sports.css` | styles for the panel and card |
| `app/src/hud/ControlDock.jsx`, `CommandPalette.jsx`, `HelpOverlay.jsx`, `HintBar.jsx`, `Hud.jsx`, `app/src/lib/places.js`, `app/src/world/Scene.jsx`, `app/src/camera/AtlasRig.jsx` (modify) | wiring |

**Contracts with other plans:**
- **Consumed:**
  - V4's `useSoundStore` (`soundOn`, `setSoundOn`, in `app/src/audio/soundStore.js`; never redefined here);
  - V1's `clearanceAt`, applied by V7 around `venueFocusPose`;
  - V1's D1 tree-free venue hulls, which rely on `venueMeshes[].fieldRing` (still emitted).
- **Produced:**
  - for V7: `gamesOpen` / `setGamesOpen`, `venueFocusPose`, `gamePlaces`;
  - for Phase 5: `gameState`, `schedules.json`, `setScoreboard`, `cheer`.
- **V2 `_STYLE`:** venues keep their façade-index and `_SEED` styling; V5 adds no `_STYLE` rows.

**e2e and docs:**

| File | Responsibility |
|---|---|
| `app/e2e/v5-shots.json` | the evaluation poses |
| `app/e2e/v5-capture.spec.js` | before/after shots (`V5_CAPTURE=1`) |
| `app/e2e/v5-perf.spec.js` | the perf check (`V5_PERF=1`) |
| `app/e2e/hero-view.spec.js` (modify) | pins `sports=idle` |
| `docs/superpowers/ledgers/v5-stadiums-sports-life.md` | the ledger |
| `.gitignore` (modify) | ignores `docs/superpowers/ledgers/v5-shots/` |
| `README.md` (modify) | gallery, roadmap |

**Tests:**
- Pipeline: `pipeline/tests/{geom,crowns,heroes,venue,sportsSites,schedules,teams,heroes-data}.test.js`.
- App: `app/src/sports/__tests__/*.test.js`, `app/src/audio/__tests__/*.test.js`, `app/src/world/materials/__tests__/facadeMaterial.test.js`, `app/src/lib/__tests__/bookmarks.test.js`, `app/src/hud/__tests__/{palette,sports,help}.test.jsx`.

**Venue slots** (field-texture layer and light-uniform index), used everywhere:

| Slot | Venue |
|---|---|
| 0 | `soldierfield` |
| 1 | `wrigleyfield` |
| 2 | `ratefield` |
| 3 | `unitedcenter` |
| 4 | `wintrust` |

**Screenshot poses:** `[px, py, pz, tx, ty, tz]` in local metres, taken from the venues' manifest positions:

| Venue | Position |
|---|---|
| Wrigley | (−2292, −7339); home plate (−2325, −7319) |
| Soldier Field | (928, 2187) |
| Rate Field | (−494, 5786); home plate (−533, 5750) |
| United Center | (−3842, 147) |
| Wintrust | **(538, 3150)**: the manifest value, not the prompt's (−560, 3200) |

---

### Task 1: Evaluation harness (test-only pose, capture spec, ledger)

**Files:**
- Modify: `app/src/lib/bookmarks.js` (`bookmarkFromUrl`)
- Modify: `app/src/camera/AtlasRig.jsx:46` (a `?pose=` visit skips the intro, like `?view=`)
- Create: `app/e2e/v5-shots.json`, `app/e2e/v5-capture.spec.js`
- Create: `docs/superpowers/ledgers/v5-stadiums-sports-life.md`
- Modify: `.gitignore`
- Test: `app/src/lib/__tests__/bookmarks.test.js`

**Interfaces:**
- Consumes: `BOOKMARKS`, `bookmarkFromUrl(search)` (existing).
- Produces:
  - `poseFromParam(value: string|null) → { position:[x,y,z], target:[x,y,z] } | null`;
  - `bookmarkFromUrl(search)` honours `?pose=px,py,pz,tx,ty,tz` before `?view=`;
  - `app/e2e/v5-shots.json`: an array of `{ name, pose:[6], times:string[], sports?:string, quality?:'LOW'|'HIGH' }`;
  - the capture command `V5_CAPTURE=1 V5_TAG=<before|after> V5_ONLY=<names,comma> npx playwright test e2e/v5-capture.spec.js` (run from `app/`), which writes `docs/superpowers/ledgers/v5-shots/<tag>/<name>-<time>.png`.

- [ ] **Step 1: Write the failing test.** Append to `app/src/lib/__tests__/bookmarks.test.js`:

```js
import { poseFromParam } from '../bookmarks.js'

describe('test-only ?pose=', () => {
  it('parses six finite numbers into a pose', () => {
    expect(poseFromParam('928,300,2460,928,10,2187')).toEqual({ position: [928, 300, 2460], target: [928, 10, 2187] })
  })
  it('rejects anything else', () => {
    for (const bad of [null, '', '1,2,3', '1,2,3,4,5,x', '1,2,3,4,5,6,7']) expect(poseFromParam(bad)).toBeNull()
  })
  it('wins over ?view= in bookmarkFromUrl', () => {
    expect(bookmarkFromUrl('?view=loop&pose=1,2,3,4,5,6')).toEqual({ position: [1, 2, 3], target: [4, 5, 6] })
    expect(bookmarkFromUrl('?view=loop')).toBe(BOOKMARKS.loop)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**
Run: `cd app && npx vitest run src/lib/__tests__/bookmarks.test.js`
Expected: FAIL — `does not provide an export named 'poseFromParam'`

- [ ] **Step 3: Implement.** Replace `bookmarkFromUrl` in `app/src/lib/bookmarks.js` with:

```js
// Test-only: ?pose=px,py,pz,tx,ty,tz (local metres) for evaluation screenshots. People use ⌘K and views.
export function poseFromParam(value) {
  if (!value) return null
  const n = value.split(',').map(Number)
  if (n.length !== 6 || n.some((x) => !Number.isFinite(x))) return null
  return { position: n.slice(0, 3), target: n.slice(3) }
}

export function bookmarkFromUrl(search) {
  const params = new URLSearchParams(search)
  return poseFromParam(params.get('pose')) ?? BOOKMARKS[params.get('view')] ?? BOOKMARKS.streeterville
}
```

In `app/src/camera/AtlasRig.jsx`, change the intro condition line to:

```js
    const playIntro = !params.has('view') && !params.has('pose') && !reduced && !useStore.getState().introDone
```

Create `app/e2e/v5-shots.json`:

```json
[
  { "name": "uc-aerial", "pose": [-3600, 260, 420, -3842, 20, 147], "times": ["day", "dusk", "night"] },
  { "name": "uc-aerial-game", "pose": [-3600, 260, 420, -3842, 20, 147], "times": ["night"], "sports": "pregame" },
  { "name": "uc-plaza", "pose": [-3700, 60, 300, -3842, 10, 147], "times": ["night"], "sports": "pregame" },
  { "name": "wintrust-aerial", "pose": [760, 220, 3380, 538, 15, 3150], "times": ["day", "dusk", "night"] },
  { "name": "wintrust-aerial-game", "pose": [760, 220, 3380, 538, 15, 3150], "times": ["night"], "sports": "pregame" },
  { "name": "soldier-aerial", "pose": [1180, 300, 2460, 928, 10, 2187], "times": ["day", "dusk", "night"] },
  { "name": "soldier-aerial-game", "pose": [1180, 300, 2460, 928, 10, 2187], "times": ["night"], "sports": "live" },
  { "name": "soldier-top", "pose": [930, 520, 2205, 928, 0, 2187], "times": ["day"] },
  { "name": "soldier-top-low", "pose": [930, 520, 2205, 928, 0, 2187], "times": ["day"], "quality": "LOW" },
  { "name": "soldier-top-soccer", "pose": [930, 520, 2205, 928, 0, 2187], "times": ["day"], "sports": "live:fire" },
  { "name": "soldier-bowl", "pose": [850, 60, 2187, 960, 5, 2187], "times": ["day", "night"], "sports": "live" },
  { "name": "wrigley-aerial", "pose": [-2452, 140, -7192, -2292, 5, -7339], "times": ["day", "dusk", "night"] },
  { "name": "wrigley-aerial-game", "pose": [-2452, 140, -7192, -2292, 5, -7339], "times": ["night"], "sports": "live" },
  { "name": "wrigley-top", "pose": [-2290, 480, -7325, -2292, 0, -7339], "times": ["day"] },
  { "name": "wrigley-bowl", "pose": [-2297, 25, -7347, -2332, 12, -7312], "times": ["day", "night"], "sports": "live" },
  { "name": "wrigley-board-win", "pose": [-2311, 45, -7333, -2219, 25, -7425], "times": ["day"], "sports": "win" },
  { "name": "wrigley-board-loss", "pose": [-2311, 45, -7333, -2219, 25, -7425], "times": ["day"], "sports": "loss" },
  { "name": "wrigley-field-win", "pose": [-2380, 70, -7260, -2270, 5, -7370], "times": ["day"], "sports": "win" },
  { "name": "rate-aerial", "pose": [-660, 140, 5623, -494, 5, 5786], "times": ["day", "dusk", "night"] },
  { "name": "rate-aerial-game", "pose": [-660, 140, 5623, -494, 5, 5786], "times": ["night"], "sports": "live" },
  { "name": "rate-top", "pose": [-490, 480, 5775, -494, 0, 5786], "times": ["day"] },
  { "name": "rate-from-loop", "pose": [-300, 320, 600, -494, 30, 5786], "times": ["night"], "sports": "live" },
  { "name": "loop-wide", "pose": [-1100, 520, 900, 150, 40, -500], "times": ["day", "night"] },
  { "name": "streeterville-wide", "pose": [1900, 320, -1500, 150, 60, -350], "times": ["dusk", "night"] }
]
```

Create `app/e2e/v5-capture.spec.js`:

```js
// app/e2e/v5-capture.spec.js — evaluate-and-revert shots for V5. Runs only with V5_CAPTURE=1.
// V5_TAG=before|after picks the folder; V5_ONLY=name,name limits the shots.
import { test } from '@playwright/test'
import { readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = JSON.parse(readFileSync(join(HERE, 'v5-shots.json'), 'utf8'))
const TAG = process.env.V5_TAG ?? 'before'
const ONLY = process.env.V5_ONLY ? process.env.V5_ONLY.split(',') : null
const OUT = join(HERE, '..', '..', 'docs', 'superpowers', 'ledgers', 'v5-shots', TAG)

test.skip(!process.env.V5_CAPTURE, 'set V5_CAPTURE=1 to take V5 evaluation shots')

for (const s of SHOTS.filter((x) => !ONLY || ONLY.includes(x.name))) {
  for (const time of s.times) {
    test(`${s.name} @ ${time}`, async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-09-28T12:00:00-05:00'))
      await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
      const q = new URLSearchParams({ pose: s.pose.join(','), time, stats: '1', sports: s.sports ?? 'idle' })
      await page.goto(`/?${q}`)
      await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
      if (s.quality) await page.evaluate((qq) => window.__store.getState().setQuality(qq), s.quality)
      await page.waitForTimeout(5000) // textures, sky tween, field painting, loading fade
      mkdirSync(OUT, { recursive: true })
      await page.screenshot({ path: join(OUT, `${s.name}-${time}.png`) })
    })
  }
}
```

Create `docs/superpowers/ledgers/v5-stadiums-sports-life.md`:

```markdown
# V5 ledger — Stadiums and sports life

Plan: `docs/superpowers/plans/2026-09-29-v5-stadiums-sports-life.md`. Shots: `docs/superpowers/ledgers/v5-shots/<before|after>/` (git-ignored working evidence).

## Rulings

## Evaluate and revert (one line per visual step: Keep | Revert — item — shots — reason)

## Perf (pose — calls — triangles — fps — quality — sports)
```

Append to `.gitignore`:

```
docs/superpowers/ledgers/v5-shots/
```

- [ ] **Step 4: Run the tests to verify they pass.**
Run: `cd app && npx vitest run src/lib/__tests__/bookmarks.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Smoke-test the harness.** Close any other heavy process first.
Run: `cd app && V5_CAPTURE=1 V5_TAG=before V5_ONLY=soldier-aerial npx playwright test e2e/v5-capture.spec.js`
Expected: `3 passed`, and three PNGs appear in `docs/superpowers/ledgers/v5-shots/before/`. Open `soldier-aerial-day.png`: Soldier Field should be centred and seen from the south-east. If it isn't, fix the pose in `v5-shots.json` and add a `Ruling:` line.

- [ ] **Step 6: Commit.**

```bash
git add app/src/lib/bookmarks.js app/src/lib/__tests__/bookmarks.test.js app/src/camera/AtlasRig.jsx app/e2e/v5-shots.json app/e2e/v5-capture.spec.js docs/superpowers/ledgers/v5-stadiums-sports-life.md .gitignore
git commit -m "test(v5): evaluation harness — test-only ?pose=, capture spec, V5 ledger"
```

---

### Task 2: Crown primitives `vault` and `stepdome`

**Files:**
- Modify: `pipeline/lib/geom.js` (add `distToRing`)
- Modify: `pipeline/lib/crowns.js`
- Test: `pipeline/tests/geom.test.js`, `pipeline/tests/crowns.test.js`

**Interfaces:**
- Consumes: `insetRing(ring, d)` from `pipeline/lib/roofs.js`, and `ringBBox`, `ringCentroid`, `pointInRing` from `geom.js`.
- Produces:
  - `distToRing(p:[x,z], ring:[x,z][]) → number`, the distance to the nearest ring edge;
  - `vault({ ring, base, rise, axis=[0,-1], step=4 }) → { positions, normals, uvs }`: a barrel roof. Its ridge runs along `axis` through the centroid, with height `base + rise·(1 − (s/half)²)`, where `s` is the across-axis offset. It has gable walls down to `base`;
  - `stepdome({ ring, base, steps=[{inset, rise}], domeRise, step=4 }) → mesh`: flat ledges and vertical steps, then a dome over the innermost ring, with height `top + domeRise·(1 − (1 − d/D)²)`, where `d` is the distance to that ring's edge and `D` its maximum.

- [ ] **Step 1: Write the failing tests.** Append to `pipeline/tests/geom.test.js`:

```js
import { distToRing } from '../lib/geom.js'
describe('distToRing', () => {
  const sq = [[0, 0], [10, 0], [10, -10], [0, -10]]
  it('is the distance to the nearest edge, inside or out', () => {
    expect(distToRing([5, -5], sq)).toBeCloseTo(5)
    expect(distToRing([1, -5], sq)).toBeCloseTo(1)
    expect(distToRing([13, 4], sq)).toBeCloseTo(5)
  })
})
```

Append to `pipeline/tests/crowns.test.js`. The `ys`, `sq` and `frontFacing` helpers already exist at the top of the file.

```js
import { vault, stepdome } from '../lib/crowns.js'
const rectR = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
const tops = (m) => { const o = []; for (let i = 0; i < m.positions.length; i += 3) if (m.normals[i + 1] > 0.5) o.push([m.positions[i], m.positions[i + 1], m.positions[i + 2]]); return o }

describe('arena roofs', () => {
  it('vault: ridge along the axis at base + rise, eaves at base, closed gables, outward-facing', () => {
    const m = vault({ ring: rectR(0, 0, 96, -128), base: 25, rise: 5.5, axis: [0, -1] })
    expect(Math.max(...ys(m))).toBeCloseTo(30.5, 1)
    expect(Math.min(...ys(m))).toBeCloseTo(25, 5)
    const t = tops(m)
    const nearRidge = t.filter((p) => Math.abs(p[0] - 48) < 0.01)
    expect(nearRidge.length).toBeGreaterThan(10)
    for (const p of nearRidge) expect(p[1]).toBeCloseTo(30.5, 5)            // constant along the ridge
    for (const p of t.filter((q) => q[0] < 0.01 || q[0] > 95.99)) expect(p[1]).toBeCloseTo(25, 5) // eaves
    for (const [x, , z] of t) { expect(x).toBeGreaterThanOrEqual(-1e-6); expect(x).toBeLessThanOrEqual(96 + 1e-6); expect(z).toBeLessThanOrEqual(1e-6); expect(z).toBeGreaterThanOrEqual(-128 - 1e-6) }
    expect(frontFacing(m)).toBe(true)
  })
  it('stepdome: a ledge at base, a stepped wall, then a dome to base + steps + domeRise', () => {
    const m = stepdome({ ring: rectR(0, 0, 164, -124), base: 30, steps: [{ inset: 7, rise: 2.5 }], domeRise: 6.5 })
    expect(Math.max(...ys(m))).toBeGreaterThan(30 + 2.5 + 6.5 * 0.95)
    expect(Math.max(...ys(m))).toBeLessThanOrEqual(39 + 1e-6)
    expect(tops(m).some((p) => Math.abs(p[1] - 30) < 1e-6 && p[0] < 5)).toBe(true)     // the ledge ring at the wall top
    expect(m.normals.some((n, i) => i % 3 === 1 && Math.abs(n) < 0.05)).toBe(true)       // vertical step walls
    const dome = tops(m).filter((p) => p[1] > 32.5 + 1e-6)
    for (const [x, , z] of dome) { expect(x).toBeGreaterThan(7 - 1e-6); expect(x).toBeLessThan(157 + 1e-6); expect(z).toBeLessThan(-7 + 1e-6); expect(z).toBeGreaterThan(-117 - 1e-6) }
    expect(frontFacing(m)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.**
Run: `cd pipeline && npx vitest run tests/geom.test.js tests/crowns.test.js`
Expected: FAIL — `does not provide an export named 'distToRing'` and `'vault'`

- [ ] **Step 3: Implement.** Append to `pipeline/lib/geom.js`:

```js
// Distance from p to the nearest edge of ring (inside or outside).
export function distToRing(p, ring) {
  let best = Infinity
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]
    const ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez || 1
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ez) / l2))
    best = Math.min(best, Math.hypot(p[0] - (a[0] + ex * t), p[1] - (a[1] + ez * t)))
  }
  return best
}
```

In `pipeline/lib/crowns.js`, change the imports to:

```js
import earcut from 'earcut'
import { ringCentroid, ringBBox, pointInRing, distToRing } from './geom.js'
import { insetRing } from './roofs.js'
```

Then append:

```js
// ── arena roofs (V5, D2) ─────────────────────────────────────────────────────
function densify(ring, step) {
  const out = []
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step))
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
  }
  return out
}
// Interior grid aligned on the centroid, so a ridge or dome crown through the centroid gets vertices.
function interior(ring, step) {
  const bb = ringBBox(ring), [cx, cz] = ringCentroid(ring), pts = []
  const x0 = cx - Math.floor((cx - bb.minX) / step) * step, z0 = cz - Math.floor((cz - bb.minZ) / step) * step
  for (let x = x0; x < bb.maxX; x += step)
    for (let z = z0; z < bb.maxZ; z += step)
      if (pointInRing([x, z], ring) && distToRing([x, z], ring) > step * 0.35) pts.push([x, z])
  return pts
}
// Curved top over `ring`, lifted by h(p): the edge densified every `step` m plus interior Steiner points
// (earcut treats a one-vertex hole as a Steiner point). Returns the densified edge.
function liftedTop(out, ring, h, step) {
  const edge = densify(ring, step), flat = edge.flat(), holes = []
  for (const p of interior(ring, step)) { holes.push(flat.length / 2); flat.push(p[0], p[1]) }
  const t = earcut(flat, holes.length ? holes : undefined, 2)
  const [cx, cz] = ringCentroid(ring)
  const P = (k) => [flat[k * 2], h([flat[k * 2], flat[k * 2 + 1]]), flat[k * 2 + 1]]
  for (let i = 0; i < t.length; i += 3) tri(out, P(t[i]), P(t[i + 1]), P(t[i + 2]), [cx, -1e5, cz], (q) => [q[0], q[2]])
  return edge
}
// Walls from `base` up to h(p) around a densified edge (skipped where the roof meets the eave).
function skirt(out, edge, base, h) {
  const [cx, cz] = ringCentroid(edge), c = [cx, base, cz]
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i], b = edge[(i + 1) % edge.length], ha = h(a), hb = h(b)
    if (ha - base < 1e-3 && hb - base < 1e-3) continue
    tri(out, [a[0], base, a[1]], [b[0], base, b[1]], [a[0], ha, a[1]], c)
    tri(out, [b[0], base, b[1]], [b[0], hb, b[1]], [a[0], ha, a[1]], c)
  }
}
// Flat annulus between an outer ring and an inner ring at height y.
function ledge(out, outer, inner, y) {
  const flat = [...outer.flat(), ...inner.flat()]
  const t = earcut(flat, [outer.length], 2)
  const [cx, cz] = ringCentroid(outer)
  const P = (k) => [flat[k * 2], y, flat[k * 2 + 1]]
  for (let i = 0; i < t.length; i += 3) tri(out, P(t[i]), P(t[i + 1]), P(t[i + 2]), [cx, -1e5, cz], (q) => [q[0], q[2]])
}

// Barrel vault (Wintrust Arena): the ridge runs along `axis` through the centroid.
export function vault({ ring, base, rise, axis = [0, -1], step = 4 }) {
  const out = mesh()
  const l = Math.hypot(axis[0], axis[1]) || 1, perp = [-axis[1] / l, axis[0] / l]
  const [cx, cz] = ringCentroid(ring)
  const across = (p) => (p[0] - cx) * perp[0] + (p[1] - cz) * perp[1]
  const half = Math.max(...ring.map((p) => Math.abs(across(p)))) || 1
  const h = (p) => base + rise * Math.max(0, 1 - (across(p) / half) ** 2)
  const edge = liftedTop(out, ring, h, step)
  skirt(out, edge, base, h)
  return out
}

// Stepped dome (United Center): ledge + vertical step per entry in `steps`, then a dome over the last ring.
export function stepdome({ ring, base, steps = [], domeRise, step = 4 }) {
  const out = mesh()
  let r = ring, y = base
  for (const s of steps) {
    const inner = insetRing(r, s.inset)
    ledge(out, r, inner, y)
    const top = y + s.rise
    skirt(out, densify(inner, step), y, () => top)
    r = inner; y = top
  }
  const D = Math.max(1e-6, ...interior(r, step).map((p) => distToRing(p, r)))
  const h = (p) => y + domeRise * (1 - (1 - Math.min(1, distToRing(p, r) / D)) ** 2)
  liftedTop(out, r, h, step)
  return out
}
```

- [ ] **Step 4: Run the tests to verify they pass.**
Run: `cd pipeline && npx vitest run tests/geom.test.js tests/crowns.test.js`
Expected: PASS (all crowns and geom tests, the new ones included)

- [ ] **Step 5: Commit.**

```bash
git add pipeline/lib/geom.js pipeline/lib/crowns.js pipeline/tests/geom.test.js pipeline/tests/crowns.test.js
git commit -m "feat(pipeline): vault and stepdome crown primitives for arena roofs (D2)"
```

---

### Task 3: Arena roofs on the United Center and Wintrust Arena

**Files:**
- Modify: `pipeline/lib/heroes.js:3,15,60-64`
- Modify: `pipeline/data/heroes.json` (the `unitedcenter` and `wintrust` entries)
- Test: `pipeline/tests/heroes.test.js`

**Interfaces:**
- Consumes: `vault`, `stepdome` (Task 2).
- Produces:
  - `CROWNS` gains `vault` and `stepdome`;
  - a crown without `ring` or `scale` receives `ring = main.outer`;
  - `heroes.json` crowns `{ type: 'stepdome', base, steps, domeRise, step, source }` and `{ type: 'vault', base, rise, axis, step, source }`.

- [ ] **Step 1: Capture the "before" shots** (no code changed yet):
Run: `cd app && V5_CAPTURE=1 V5_TAG=before V5_ONLY=uc-aerial,wintrust-aerial npx playwright test e2e/v5-capture.spec.js`
Expected: `6 passed`

- [ ] **Step 2: Write the failing tests.** Append inside `describe('heroes', …)` in `pipeline/tests/heroes.test.js`:

```js
  it('vault and stepdome crowns default to the footprint ring', () => {
    const { extraMeshes } = applyHero(bldg(), { crowns: [{ type: 'vault', base: 100, rise: 5, axis: [0, -1] }] })
    const y = extraMeshes[0].positions.filter((_, i) => i % 3 === 1)
    expect(Math.max(...y)).toBeCloseTo(105, 5)
    expect(Math.min(...y)).toBeCloseTo(100, 5)
    const s = applyHero(bldg(), { crowns: [{ type: 'stepdome', base: 100, steps: [{ inset: 2, rise: 1 }], domeRise: 3 }] })
    expect(Math.max(...s.extraMeshes[0].positions.filter((_, i) => i % 3 === 1))).toBeGreaterThan(103.8)
  })
  it('the arena heroes carry sourced vault / stepdome roofs', async () => {
    const { readFileSync } = await import('node:fs')
    const H = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes
    const uc = H.find((h) => h.key === 'unitedcenter'), wt = H.find((h) => h.key === 'wintrust')
    expect(uc.crowns[0]).toMatchObject({ type: 'stepdome', base: 30 })
    expect(wt.crowns[0]).toMatchObject({ type: 'vault', base: 25 })
    for (const c of [uc.crowns[0], wt.crowns[0]]) expect(c.source).toMatch(/\w/)
  })
```

- [ ] **Step 3: Run the tests to verify they fail.**
Run: `cd pipeline && npx vitest run tests/heroes.test.js`
Expected: FAIL — `CROWNS[c.type] is not a function` and `expected undefined to match object`

- [ ] **Step 4: Implement.** In `pipeline/lib/heroes.js`:

```js
import { spire, antenna, pyramid, drum, sloped, vault, stepdome } from './crowns.js'
```
```js
const CROWNS = { spire, antenna, pyramid, drum, sloped, vault, stepdome }
```

In the `extraMeshes` map, change the return line to:

```js
    return CROWNS[c.type]({ ...c, at, ring: c.ring ?? ring ?? main.outer })
```

In `pipeline/data/heroes.json`:
- In the `unitedcenter` entry, replace `"crowns": []` with:

```json
      "crowns": [
        {
          "type": "stepdome",
          "base": 30,
          "steps": [{ "inset": 7, "rise": 2.5 }],
          "domeRise": 6.5,
          "step": 5,
          "source": "Footprint 165 × 124 m and 8 levels from OSM way 205221993; stepped perimeter roof and low central dome (crown ≈ 39 m) estimated from aerial imagery — logged in the V5 ledger"
        }
      ],
```

- In the `wintrust` entry, replace `"crowns": []` with:

```json
      "crowns": [
        {
          "type": "vault",
          "base": 25,
          "rise": 5.5,
          "axis": [0, -1],
          "step": 4,
          "source": "Footprint 95 × 127 m from OSM way 381265570; curved roof spanning east–west with its ridge north–south (crown ≈ 30.5 m) estimated from aerial imagery — logged in the V5 ledger"
        }
      ],
```

- [ ] **Step 5: Run the tests to verify they pass.**
Run: `cd pipeline && npx vitest run tests/heroes.test.js tests/crowns.test.js`
Expected: PASS

- [ ] **Step 6: Rebuild the world.** Stop the dev server first (RAM discipline).
Run: `cd pipeline && npm run build:world`
Expected: the build ends with `manifest written`; the skyline assertion passes; `heroes applied: 41` (the same count as before).

- [ ] **Step 7: Commit.**

```bash
git add pipeline/lib/heroes.js pipeline/data/heroes.json pipeline/tests/heroes.test.js app/public/world
git commit -m "feat(world): United Center stepped dome and Wintrust vaulted roof (D2)"
```

- [ ] **Step 8: Capture "after" and evaluate or revert.**
Run: `cd app && V5_CAPTURE=1 V5_TAG=after V5_ONLY=uc-aerial,wintrust-aerial npx playwright test e2e/v5-capture.spec.js`
Expected: `6 passed`

Compare each `before/<shot>` with `after/<shot>` (day, dusk, night) and against aerial reference photos of both arenas (Google Maps satellite and 3D view).
- **Keep** if all three hold:
  - the United Center reads as a flat perimeter ring stepping up to a low dome;
  - Wintrust reads as one gentle barrel spanning east–west;
  - no z-fighting where the crown meets the wall top, and no roof panel shading darker than the wall at dusk.
- **Otherwise** run `git revert --no-edit HEAD`.

Either way, add one ledger line under *Evaluate and revert*, for example `Keep — D2 — uc-aerial, wintrust-aerial ×3 — stepped dome and vault read correctly from 400 m`. Commit the ledger:

```bash
git add docs/superpowers/ledgers/v5-stadiums-sports-life.md && git commit -m "docs(v5): ledger — D2 arena roofs evaluated"
```

---

### Task 4: One field surface per venue, in its local field frame (pipeline side of D3)

**Files:**
- Modify: `pipeline/lib/venue.js`:
  - lines 1–26: header, imports, `VENUE_FACADES`;
  - lines 121–134: delete `surfaceField`;
  - lines 256–292: replace the field section;
  - lines 305–317: record the board faces;
  - line 366: the `venue` info entry.
- Modify: `pipeline/lib/heroes.js:36-40` (pass `sports.slot` / `capacity`)
- Modify: `pipeline/data/heroes.json` (`sports` blocks on the five venue heroes)
- Modify: `app/src/world/materials/facadeMaterial.js` (interim: façade 24 draws as turf and glows under lights)
- Test: `pipeline/tests/venue.test.js`, `pipeline/tests/heroes-data.test.js` (create), `app/src/world/materials/__tests__/facadeMaterial.test.js`

**Interfaces:**
- Consumes: `buildVenue(outline, spec)`, `insetRing`, and `flatMP(mp, y, o, axis)` (internal; its uv is `[dot(p−o, axis), dot(p−o, left(axis))]`, with `left([x,z]) = [z, −x]`).
- Produces:
  - `VENUE_FACADES.field = 24`;
  - `FIELD_SLOTS = 8`;
  - `fieldSeed(slot) → (slot + 0.5) / 8`;
  - `FIELD_EXTENT = { football: {u0:-75,u1:75,v0:-37.5,v1:37.5}, baseball: {u0:-24,u1:132,v0:-96,v1:96} }`;
  - `buildVenue` returns one `{ part:'field', field:true, facade:24, seed:fieldSeed(slot) }` mesh with uvs in field-frame metres;
  - the last entry `{ mesh: empty, facade: 24, seed: 0, fieldRing, venue: { frame, seats, boards, flagPole } }`, where:
    - `frame = { origin:[x,z], axis:[ax,az], u0,u1,v0,v1, ring:[u,v][], grassRing?:[u,v][] }`;
    - `boards = [{ center:[x,y,z], normal:[nx,nz], w, h, style }]`;
    - `flagPole = [x, yTop, z] | null`;
    - `seats = []` (filled in Task 5).
  - `heroes.json` gains `sports: { kind: 'football'|'baseball'|'arena', slot, teams: string[], capacity, source }`.
- Frame convention: **u** runs along `axis`. For football, that is from the field centre toward the north goal. For baseball, it is from home plate toward centre field. **v** points to the left of u, seen from above; for baseball, +v is the left-field side.

- [ ] **Step 1: Capture the "before" shots** for every open-air venue. They serve Tasks 4–7 and 13.
Run: `cd app && V5_CAPTURE=1 V5_TAG=pre-fields V5_ONLY=soldier-aerial,soldier-top,wrigley-aerial,wrigley-top,rate-aerial,rate-top,rate-from-loop npx playwright test e2e/v5-capture.spec.js`
Expected: `13 passed`

- [ ] **Step 2: Write the failing tests.** In `pipeline/tests/venue.test.js`:
- change the import line to `import { buildVenue, VENUE_FACADES as F, STYLE, fieldSeed } from '../lib/venue.js'`;
- delete the four `it` blocks named:
  - `produces seats, turf, clay, paint, steel, lamp, screen, wall, marquee and ivy`,
  - `field surfaces tile the field exactly once (no overlaps, no gaps)`,
  - `puts the pitcher’s mound 18.4 m from home toward centre field`,
  - `paints yard lines and navy end zones on the turf` (the mound and yard-line checks move to `fieldMarks` in Task 13);
- add, inside `describe('buildVenue — baseball', …)`:

```js
  it('produces seats, the field, steel, lamps, screens, walls, the marquee and ivy', () => {
    for (const k of ['seats', 'field', 'steel', 'lamp', 'screen', 'wall', 'marquee', 'ivy']) expect(byFacade(meshes, F[k]).length, k).toBeGreaterThan(0)
    for (const k of ['turf', 'clay', 'paint']) expect(byFacade(meshes, F[k]).length, k).toBe(0)
  })
  it('the field is one surface covering the field ring exactly once', () => {
    const field = meshes.filter((m) => m.field)
    expect(field).toHaveLength(1)
    expect(field[0]).toMatchObject({ facade: 24, seed: fieldSeed(0), part: 'field' })
    const ring = meshes.find((m) => m.fieldRing).fieldRing
    const r = triArea(field[0].mesh) / polyArea(ring)
    expect(r).toBeGreaterThan(0.995); expect(r).toBeLessThan(1.005)
  })
  it('field uvs are local metres from home plate: u toward centre field, v toward left field', () => {
    const f = meshes.find((m) => m.part === 'field').mesh, L = [d[1], -d[0]]
    for (let i = 0, k = 0; i < f.positions.length; i += 3, k += 2) {
      const px = f.positions[i] - 38, pz = f.positions[i + 2] + 38
      expect(f.uvs[k]).toBeCloseTo(px * d[0] + pz * d[1], 3)
      expect(f.uvs[k + 1]).toBeCloseTo(px * L[0] + pz * L[1], 3)
    }
  })
  it('emits the venue frame with its ring and a grass ring 4.6 m inside it', () => {
    const v = meshes.find((m) => m.venue).venue
    expect(v.frame.origin).toEqual([38, -38])
    expect(v.frame).toMatchObject({ u0: -24, u1: 132, v0: -96, v1: 96 })
    expect(v.frame.ring).toHaveLength(192)
    for (const [u, w] of v.frame.ring) { expect(u).toBeGreaterThan(-24); expect(u).toBeLessThan(132); expect(Math.abs(w)).toBeLessThan(96) }
    expect(polyArea(v.frame.grassRing)).toBeLessThan(polyArea(v.frame.ring))
  })
  it('emits each board face and the flag pole for the sidecar', () => {
    const v = meshes.find((m) => m.venue).venue
    expect(v.boards).toHaveLength(1)
    const b = v.boards[0]
    expect(b).toMatchObject({ style: 'manual', w: 23, h: 8.5 })
    expect(b.normal[0] * (38 - b.center[0]) + b.normal[1] * (-38 - b.center[2])).toBeGreaterThan(0) // faces home plate
    expect(v.flagPole[1]).toBeGreaterThan(b.center[1] + b.h / 2 + 5)
  })
```

Inside `describe('buildVenue — football', …)`:

```js
  it('the football frame is centred on the field, ±75 × ±37.5 m, with no grass ring', () => {
    const v = meshes.find((m) => m.venue).venue
    expect(v.frame.origin).toEqual([110, -180])
    expect(v.frame).toMatchObject({ u0: -75, u1: 75, v0: -37.5, v1: 37.5 })
    expect(v.frame.grassRing).toBeUndefined()
    for (const [u, w] of v.frame.ring) { expect(Math.abs(u)).toBeLessThan(75); expect(Math.abs(w)).toBeLessThan(37.5) }
  })
```

In `describe('venue heroes + defaults', …)`:

```js
  it('applyHero passes the sports slot and capacity to the venue', () => {
    const b = { id: 'v', area: 190 * 190, centroid: [95, -95], height: 24, parts: null, polygons: [{ outer: OUT, holes: [] }] }
    const r = applyHero(b, { crowns: [], venue: { ...BASEBALL, home: undefined, homeLocal: [38, -38] }, sports: { kind: 'baseball', slot: 2, capacity: 1000 } })
    expect(r.venueMeshes.find((m) => m.field).seed).toBe(fieldSeed(2))
  })
```

Create `pipeline/tests/heroes-data.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const H = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes
const S = H.filter((h) => h.sports)

describe('heroes.json sports venues', () => {
  it('five venues with unique slots 0–4 and sourced capacities', () => {
    expect(S.map((h) => [h.key, h.sports.slot]).sort((a, b) => a[1] - b[1])).toEqual([['soldierfield', 0], ['wrigleyfield', 1], ['ratefield', 2], ['unitedcenter', 3], ['wintrust', 4]])
    for (const h of S) { expect(h.sports.capacity).toBeGreaterThan(5000); expect(h.sports.source).toMatch(/\w/); expect(h.sports.teams.length).toBeGreaterThan(0) }
  })
  it('open-air venues are exactly those with a venue builder spec', () => {
    for (const h of S) expect(Boolean(h.venue)).toBe(h.sports.kind !== 'arena')
  })
})
```

Append to `app/src/world/materials/__tests__/facadeMaterial.test.js`:

```js
describe('field surfaces (façade 24)', () => {
  it('draw and glow like turf', () => {
    const f = patchFacadeShader(std()).fragmentShader
    expect(f).toContain('vi == 24')
    expect(f).toMatch(/\(vi >= 10 && vi <= 12\) \|\| vi == 24/)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail.**
Run: `cd pipeline && npx vitest run tests/venue.test.js tests/heroes-data.test.js && cd ../app && npx vitest run src/world/materials/__tests__/facadeMaterial.test.js`
Expected: FAIL — `does not provide an export named 'fieldSeed'` (pipeline) and `expected … to contain 'vi == 24'` (app)

- [ ] **Step 4: Implement the pipeline.** In `pipeline/lib/venue.js`:
- delete the `import polygonClipping from 'polygon-clipping'` line;
- delete the `strip` helper and the whole `surfaceField` function;
- change the constants:

```js
export const VENUE_FACADES = { seats: 9, turf: 10, clay: 11, paint: 12, steel: 13, lamp: 14, screen: 15, wall: 16, marquee: 17, ivy: 18, arena: 16, sacred: 19, roofing: 20, field: 24 }
// Façade 24 is a painted field: the app samples layer `slot` of a canvas-painted texture array (app/src/sports/fieldTexture.js).
export const FIELD_SLOTS = 8
export const fieldSeed = (slot) => (slot + 0.5) / FIELD_SLOTS
// Field-frame extents in metres. Football: u from the field centre toward the north goal (±75 covers
// the 109.7 m field plus the margins); baseball: u from home plate toward centre field, v toward left field.
export const FIELD_EXTENT = { football: { u0: -75, u1: 75, v0: -37.5, v1: 37.5 }, baseball: { u0: -24, u1: 132, v0: -96, v1: 96 } }
const toFrame = (o, axis) => (p) => { const q = sub(p, o); return [+dot(q, axis).toFixed(2), +dot(q, left(axis)).toFixed(2)] }
```

Replace everything from `// ── field ──` through `out.push({ mesh: mesh(), facade: F.turf, seed: 0, fieldRing })` with:

```js
  // ── field: one surface in the local field frame; the app paints the markings (D3) ──
  const fieldRing = B.fieldRing
  const origin = baseball ? spec.home : spec.center, fAxis = norm(baseball ? spec.cf : spec.axis)
  out.push({ mesh: flatMP([[[...fieldRing, fieldRing[0]]]], FIELD_Y, origin, fAxis), facade: F.field, seed: fieldSeed(spec.slot ?? 0), field: true, part: 'field' })
  const uv = toFrame(origin, fAxis)
  const frame = { origin: origin.map((v) => +v.toFixed(2)), axis: fAxis.map((v) => +v.toFixed(5)), ...FIELD_EXTENT[baseball ? 'baseball' : 'football'], ring: fieldRing.map(uv) }
  if (baseball) frame.grassRing = insetRing(fieldRing, 4.6).map(uv)
  const boardInfo = []
  let flagPole = null
  const seats = []
```

In the scoreboard loop, after `put(bx.rest, …)`, add:

```js
    const fwd = mul(d, -1)
    boardInfo.push({ center: [+(at[0] + fwd[0] * 1.25).toFixed(2), +(base + sb.h / 2).toFixed(2), +(at[1] + fwd[1] * 1.25).toFixed(2)], normal: fwd.map((v) => +v.toFixed(4)), w: sb.w, h: sb.h, style: sb.style ?? 'video' })
```

Inside `if (sb.style === 'manual') { … }`, after the flag-pole `spire`, add:

```js
      flagPole = [+at[0].toFixed(2), +(base + sb.h + 11).toFixed(2), +at[1].toFixed(2)]
```

Replace the final `return out` with:

```js
  out.push({ mesh: mesh(), facade: F.field, seed: 0, fieldRing, venue: { frame, seats, boards: boardInfo, flagPole } })
  return out
```

In `pipeline/lib/heroes.js`, change the venue call to:

```js
    const venueMeshes = buildVenue(convexHull(b.polygons.flatMap((p) => p.outer)), { ...resolveVenue(spec.venue), slot: spec.sports?.slot ?? 0, capacity: spec.sports?.capacity })
```

In `pipeline/data/heroes.json`, add a `"sports"` key as a sibling of `"crowns"` in each of the five entries:

```json
      "sports": { "kind": "football", "slot": 0, "teams": ["bears", "fire"], "capacity": 61500, "source": "Soldier Field seating capacity 61,500 (Chicago Park District; Wikipedia 'Soldier Field')" },
```
```json
      "sports": { "kind": "baseball", "slot": 1, "teams": ["cubs"], "capacity": 41649, "source": "Wrigley Field capacity 41,649 (MLB.com Cubs ballpark information)" },
```
```json
      "sports": { "kind": "baseball", "slot": 2, "teams": ["whitesox"], "capacity": 40615, "source": "Rate Field capacity 40,615 (MLB.com White Sox ballpark information)" },
```
```json
      "sports": { "kind": "arena", "slot": 3, "teams": ["bulls", "blackhawks"], "capacity": 20917, "source": "United Center capacity 20,917 basketball / 19,717 hockey (unitedcenter.com)" },
```
```json
      "sports": { "kind": "arena", "slot": 4, "teams": ["sky"], "capacity": 10387, "source": "Wintrust Arena capacity 10,387 (wintrustarena.com)" },
```

The `wintrust` entry keeps `"aliases": ["DePaul arena", "Sky"]`. `heroes.js` ignores `sports` everywhere except the venue call above.

- [ ] **Step 5: Implement the interim shader.** Until Task 11, façade 24 draws as turf. In `app/src/world/materials/facadeMaterial.js`, inside `venueAlbedo`, add before `if (vi == 10) {`:

```glsl
  if (vi == 24) return mix(vec3(0.16, 0.38, 0.12), vec3(0.2, 0.45, 0.15), 0.5) * (0.9 + 0.2 * grain.g); // painted field (Task 11 samples the texture)
```

In `FRAG_EMISSIVE`, change `if (vi >= 10 && vi <= 12)` to `if ((vi >= 10 && vi <= 12) || vi == 24)`.

- [ ] **Step 6: Run the tests to verify they pass.**
Run: `cd pipeline && npx vitest run tests/venue.test.js tests/heroes-data.test.js tests/heroes.test.js && cd ../app && npx vitest run src/world/materials/__tests__/facadeMaterial.test.js`
Expected: PASS

- [ ] **Step 7: Commit.** No world rebuild yet; Task 7 rebuilds once, for Tasks 4–7.

```bash
git add pipeline/lib/venue.js pipeline/lib/heroes.js pipeline/data/heroes.json pipeline/tests/venue.test.js pipeline/tests/heroes-data.test.js app/src/world/materials/facadeMaterial.js app/src/world/materials/__tests__/facadeMaterial.test.js
git commit -m "feat(pipeline): one field surface per venue in its field frame; venue sidecar info; sports blocks (D3)"
```

---

### Task 5: Seat anchors from the bowl

**Files:**
- Create: `pipeline/lib/sportsSites.js` (`shuffled`)
- Modify: `pipeline/lib/venue.js` (`bowl` collects anchors; `buildVenue` shuffles and caps them)
- Test: `pipeline/tests/sportsSites.test.js` (create), `pipeline/tests/venue.test.js`

**Interfaces:**
- Consumes: the `bowl` internals `P[k][j]`, `u0[j]`, `du[j]`, `inward`; `spec.slot`, `spec.capacity`.
- Produces:
  - `shuffled(list, seed=1) → list`: a deterministic Fisher–Yates with mulberry32; any prefix is a uniform sample;
  - `venue.seats: [x, y, z, yaw][]`:
    - seats on the two seating slopes, 0.85 m rows × 0.55 m seats, with aisles (6 % every 17 m) skipped;
    - `y` is the seat surface + 0.05;
    - `yaw = atan2(inward.x, inward.z)`, so `(sin yaw, cos yaw)` faces the field;
    - shuffled with seed `slot + 1` and capped at `capacity`.

- [ ] **Step 1: Write the failing tests.** Create `pipeline/tests/sportsSites.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { shuffled } from '../lib/sportsSites.js'

describe('shuffled', () => {
  const list = Array.from({ length: 500 }, (_, i) => i)
  it('is a deterministic permutation', () => {
    const a = shuffled(list, 3)
    expect([...a].sort((x, y) => x - y)).toEqual(list)
    expect(shuffled(list, 3)).toEqual(a)
    expect(shuffled(list, 4)).not.toEqual(a)
    expect(a).not.toEqual(list)
  })
})
```

Append to `pipeline/tests/venue.test.js`:

```js
describe('buildVenue — seat anchors', () => {
  const meshes = buildVenue(OUT, BASEBALL)
  const all = meshes.find((m) => m.venue).venue.seats
  const ring = meshes.find((m) => m.fieldRing).fieldRing
  const cen = [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length]
  const quadShares = (pts) => { const q = [0, 0, 0, 0]; for (const [x, , z] of pts) q[(x > cen[0] ? 1 : 0) + (z > cen[1] ? 2 : 0)]++; return q.map((n) => n / pts.length) }
  it('puts seats on the stands, inside the footprint, facing the field', () => {
    expect(all.length).toBeGreaterThan(5000)
    let facing = 0
    for (const [x, y, z, yaw] of all) {
      expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(190); expect(z).toBeLessThan(0); expect(z).toBeGreaterThan(-190)
      expect(y).toBeGreaterThan(3.4); expect(y).toBeLessThan(27.5)
      if (Math.sin(yaw) * (cen[0] - x) + Math.cos(yaw) * (cen[1] - z) > 0) facing++
    }
    expect(facing / all.length).toBeGreaterThan(0.97)
  })
  it('a capacity keeps a uniform, deterministic subset', () => {
    const cap = Math.floor(all.length / 4)
    const sub = buildVenue(OUT, { ...BASEBALL, capacity: cap }).find((m) => m.venue).venue.seats
    expect(sub).toHaveLength(cap)
    expect(buildVenue(OUT, { ...BASEBALL, capacity: cap }).find((m) => m.venue).venue.seats).toEqual(sub)
    const a = quadShares(all), b = quadShares(sub)
    for (let i = 0; i < 4; i++) expect(Math.abs(a[i] - b[i])).toBeLessThan(0.03)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.**
Run: `cd pipeline && npx vitest run tests/sportsSites.test.js tests/venue.test.js`
Expected: FAIL — `Failed to load url ../lib/sportsSites.js` and `expected 0 to be greater than 5000`

- [ ] **Step 3: Implement.** Create `pipeline/lib/sportsSites.js`:

```js
// pipeline/lib/sportsSites.js — the V5 venues sidecar: seeded shuffles, packed anchors, plaza anchors, records.

// Seeded Fisher–Yates (mulberry32). Any prefix is a uniform sample, so the app shows density d
// by drawing the first d·N anchors.
export function shuffled(list, seed = 1) {
  let s = Math.imul(seed | 0, 2654435761) >>> 0 || 1
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
```

In `pipeline/lib/venue.js`:
- add `import { shuffled } from './sportsSites.js'` to the imports;
- add these helpers above `bowl`:

```js
const ROW_D = 0.85, SEAT_W = 0.55, AISLE_EVERY = 17
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
// One seating slope between rays k and k2 (profile points j → j+1): rows every 0.85 m, seats every 0.55 m.
function seatRow(out, a0, a1, b0, b1, u0, du, inward) {
  const rows = Math.floor(Math.hypot(a1[0] - a0[0], a1[2] - a0[2]) / ROW_D)
  const yaw = +Math.atan2(inward[0], inward[1]).toFixed(3)
  for (let r = 0; r < rows; r++) {
    const t = (r + 0.5) / rows, A = lerp3(a0, a1, t), Bq = lerp3(b0, b1, t)
    const n = Math.floor(Math.hypot(Bq[0] - A[0], Bq[2] - A[2]) / SEAT_W)
    for (let s = 0; s < n; s++) {
      const f = (s + 0.5) / n
      if (((u0 + f * du) / AISLE_EVERY) % 1 < 0.06) continue // aisle, as painted by the seat shader
      const p = lerp3(A, Bq, f)
      out.push([+p[0].toFixed(2), +(p[1] + 0.05).toFixed(2), +p[2].toFixed(2), yaw])
    }
  }
}
```

In `bowl`:
- declare `const anchors = []` next to `const seats = mesh(), …`;
- after the line `seg(rail, 4, toC)`, add:

```js
    for (const j of [1, 3]) seatRow(anchors, P[k][j], P[k][j + 1], P[k2][j], P[k2][j + 1], u0[j], du[j], inward)
```

- change the return to `return { rows, fieldRing, seats, front, riser, rail, ext, roof, anchors }`.

In `buildVenue`, replace `const seats = []` (from Task 4) with:

```js
  const seats = shuffled(B.anchors, (spec.slot ?? 0) + 1).slice(0, spec.capacity ?? Infinity)
```

- [ ] **Step 4: Run the tests to verify they pass.**
Run: `cd pipeline && npx vitest run tests/sportsSites.test.js tests/venue.test.js`
Expected: PASS

- [ ] **Step 5: Commit.**

```bash
git add pipeline/lib/sportsSites.js pipeline/lib/venue.js pipeline/tests/sportsSites.test.js pipeline/tests/venue.test.js
git commit -m "feat(pipeline): seat anchors on every bowl, shuffled and capped at real capacity (D8)"
```

---

### Task 6: Soldier Field rim light rows and brighter Rate Field lights (D4, D5)

**Files:**
- Modify: `pipeline/lib/venue.js` (the `rimLights` loop after the light towers)
- Modify: `pipeline/data/heroes.json` (`soldierfield.venue.rimLights`; `ratefield.venue.rimLights`; `ratefield.venue.lights[*].h` 14 → 20)
- Test: `pipeline/tests/venue.test.js`, `pipeline/tests/heroes-data.test.js`

**Interfaces:**
- Consumes: `rot`, `rayHits`, `fitInside`, `rimAt`, `roofAt`, `box`, `spire`.
- Produces: the spec key `rimLights: [{ from, to, every, w, h, lift }]`, with angles in degrees from the venue's reference axis. Each fixture is a lamp box (façade 14, `part: 'lamp'`) on a short strut above the rim, facing the field.

- [ ] **Step 1: Write the failing tests.** Append to `pipeline/tests/venue.test.js`:

```js
describe('buildVenue — rim light rows', () => {
  const OUTF = rect(0, 0, 220, -360)
  const spec = {
    kind: 'football', center: [110, -180], axis: [0, -1], outerInset: 12, rim: [[-180, 28], [-90, 40], [0, 28], [90, 52], [180, 28]],
    rimLights: [{ from: 62, to: 118, every: 4, w: 7, h: 2.6, lift: 2.5 }, { from: -118, to: -62, every: 4, w: 7, h: 2.6, lift: 2.5 }],
  }
  const lamps = buildVenue(OUTF, spec).filter((m) => m.facade === F.lamp)
  it('mounts one lamp per step along both long rims, above the rim, inside the footprint', () => {
    expect(lamps).toHaveLength(30)
    for (const l of lamps) {
      expect(Math.min(...ys(l.mesh))).toBeGreaterThan(28 + 1.2 + 2.5 - 1e-6)
      for (const [x, z] of xz(l.mesh)) { expect(x).toBeGreaterThan(-0.5); expect(x).toBeLessThan(220.5); expect(z).toBeLessThan(0.5); expect(z).toBeGreaterThan(-360.5) }
    }
    expect(lamps.some((l) => xz(l.mesh)[0][0] < 110)).toBe(true)
    expect(lamps.some((l) => xz(l.mesh)[0][0] > 110)).toBe(true)
  })
})
```

Append to `pipeline/tests/heroes-data.test.js`:

```js
describe('stadium night lights', () => {
  const sf = H.find((h) => h.key === 'soldierfield').venue, rf = H.find((h) => h.key === 'ratefield').venue
  it('Soldier Field has rim light rows on both long sides', () => {
    expect(sf.rimLights.some((r) => r.from > 0)).toBe(true)
    expect(sf.rimLights.some((r) => r.to < 0)).toBe(true)
  })
  it('Rate Field has rim rows on the upper-deck roof and towers at least 20 m', () => {
    expect(rf.rimLights.length).toBe(2)
    for (const l of rf.lights) expect(l.h).toBeGreaterThanOrEqual(20)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.**
Run: `cd pipeline && npx vitest run tests/venue.test.js tests/heroes-data.test.js`
Expected: FAIL — `expected [] to have a length of 30` and `Cannot read properties of undefined (reading 'some')`

- [ ] **Step 3: Implement.** In `pipeline/lib/venue.js`, after the `// ── light towers ──` loop, add:

```js
  // ── rim light rows (Soldier Field's canopy edges, Rate Field's upper-deck roof) ──
  for (const R of spec.rimLights || []) {
    for (let a = R.from; a <= R.to + 1e-6; a += R.every) {
      const d = rot(ref, a)
      const r = Math.max(...rayHits(outer, center, d))
      const at = fitInside(outer, center, d, r - 1.2, R.w, 1.0)
      const rimTop = rimAt(at) + 1.2 + (roofAt(at) ? (spec.roofRise ?? 6) : 0)
      const base = rimTop + (R.lift ?? 2)
      const head = box(at, mul(d, -1), R.w, 1.0, base, base + R.h)
      put(head.front, F.lamp, S.lamp.flood, { part: 'lamp' })
      put(head.rest, F.steel, S.steel[spec.steel ?? 'gray'], { part: 'light' })
      put(spire({ at, base: rimTop, top: base, r0: 0.25, r1: 0.25, sides: 6 }), F.steel, S.steel[spec.steel ?? 'gray'], { part: 'light' })
    }
  }
```

In `pipeline/data/heroes.json`, `soldierfield.venue`, add after `"logo": "orange",`:

```json
        "rimLights": [
          { "from": 62, "to": 118, "every": 4, "w": 7, "h": 2.6, "lift": 2.5 },
          { "from": -118, "to": -62, "every": 4, "w": 7, "h": 2.6, "lift": 2.5 }
        ],
        "rimLightsSource": "Light banks run along the east and west upper-deck canopy edges (2003 renovation); spacing from aerial imagery",
```

In `ratefield.venue`:
- change every `"h": 14` inside `"lights"` to `"h": 20`;
- add after `"steel": "navy",`:

```json
        "rimLights": [
          { "from": 62, "to": 170, "every": 9, "w": 8, "h": 3, "lift": 2 },
          { "from": -170, "to": -62, "every": 9, "w": 8, "h": 3, "lift": 2 }
        ],
        "rimLightsSource": "Rate Field's floodlight banks sit on the upper-deck roof around the bowl; towers raised to read from the Loop (D5), per aerial imagery",
```

- [ ] **Step 4: Run the tests to verify they pass.**
Run: `cd pipeline && npx vitest run tests/venue.test.js tests/heroes-data.test.js`
Expected: PASS

- [ ] **Step 5: Commit.**

```bash
git add pipeline/lib/venue.js pipeline/data/heroes.json pipeline/tests/venue.test.js pipeline/tests/heroes-data.test.js
git commit -m "feat(pipeline): Soldier Field rim light rows; Rate Field roof rows and taller towers (D4, D5)"
```

---

### Task 7: The venues sidecar and the world build

**Files:**
- Modify: `pipeline/lib/sportsSites.js` (add `encodeAnchors`, `plazaAnchors`, `venueRecord`)
- Modify: `pipeline/build/build-world.js`:
  - imports;
  - a new block after the tree filter (after the `log(\`parks ${parks.length}…\`)` line);
  - manifest keys.
- Test: `pipeline/tests/sportsSites.test.js`

**Interfaces:**
- Consumes: `buildings[].venueMeshes[].venue` (Tasks 4–5), `heroes[].sports`, `inBuilding(p)` (existing in `build-world.js`), `convexHull`.
- Produces:
  - `encodeAnchors(anchors:[x,y,z,yaw][], center:[x,z]) → Buffer`: Int16 ×4 per anchor (`dx·10, y·10, dz·10, yaw·10000`); it throws if a value is out of range;
  - `plazaAnchors(hull, { from=5, to=24, step=1.6, max=1200, seed=1 }, isFree) → [x, 0.1, z, yaw][]`, facing the hull centroid;
  - `venueRecord(hero, hull, info) → { key, name, kind, slot, teams, capacity, center:[x,z], radius, frame, boards, flagPole, seats, seatCount, plaza, plazaCount }`.
  - The world files:
    - `app/public/world/venues.json` = `{ version: 1, venues: VenueRecord[] }`;
    - `app/public/world/venues/<key>.seats.bin`;
    - `app/public/world/venues/<key>.plaza.bin` (arenas);
    - `app/public/world/schedules.json` (copied when `pipeline/data/schedules.json` exists).
  - The manifest gains `venues: 'venues.json'` and `schedules: 'schedules.json' | null`.

- [ ] **Step 1: Write the failing tests.** Append to `pipeline/tests/sportsSites.test.js`:

```js
import { encodeAnchors, plazaAnchors, venueRecord } from '../lib/sportsSites.js'
import { pointInRing, distToRing } from '../lib/geom.js'

describe('encodeAnchors', () => {
  it('packs Int16 decimetres around the venue centre and yaw in 1e-4 rad', () => {
    const buf = encodeAnchors([[105.26, 12.34, -207.5, 1.5708], [80, 0.1, -180, -3.1416]], [100, -200])
    const a = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2)
    expect([...a]).toEqual([53, 123, -75, 15708, -200, 1, 200, -31416])
  })
  it('refuses anchors more than 3.2 km from the centre', () => {
    expect(() => encodeAnchors([[4000, 0, 0, 0]], [0, 0])).toThrow(/out of Int16 range/)
  })
})

describe('plazaAnchors', () => {
  const hull = [[0, 0], [100, 0], [100, -80], [0, -80]]
  const pts = plazaAnchors(hull, { seed: 5 }, (p) => p[0] < 50)
  it('rings the arena between 5 and 24 m out, on free ground, facing it', () => {
    expect(pts.length).toBeGreaterThan(200)
    expect(pts.length).toBeLessThanOrEqual(1200)
    for (const [x, y, z, yaw] of pts) {
      expect(pointInRing([x, z], hull)).toBe(false)
      const d = distToRing([x, z], hull)
      expect(d).toBeGreaterThanOrEqual(5); expect(d).toBeLessThanOrEqual(24)
      expect(x).toBeLessThan(50)
      expect(y).toBe(0.1)
      expect(Math.sin(yaw) * (50 - x) + Math.cos(yaw) * (-40 - z)).toBeGreaterThan(0)
    }
    expect(plazaAnchors(hull, { seed: 5 }, (p) => p[0] < 50)).toEqual(pts)
  })
})

describe('venueRecord', () => {
  const hull = [[0, 0], [200, 0], [200, -200], [0, -200]]
  it('open-air: frame, boards, seat file; radius covers the hull', () => {
    const r = venueRecord({ key: 'wrigleyfield', name: 'Wrigley Field', sports: { kind: 'baseball', slot: 1, teams: ['cubs'], capacity: 41649 } }, hull,
      { frame: { origin: [38, -38] }, boards: [{ w: 23 }], flagPole: [1, 2, 3], seats: [[1, 2, 3, 0], [4, 5, 6, 0]] })
    expect(r).toMatchObject({ key: 'wrigleyfield', kind: 'baseball', slot: 1, center: [100, -100], seats: 'venues/wrigleyfield.seats.bin', seatCount: 2, plaza: null, flagPole: [1, 2, 3] })
    expect(r.radius).toBeGreaterThan(Math.hypot(100, 100))
  })
  it('arena: no frame, no seats', () => {
    const r = venueRecord({ key: 'unitedcenter', name: 'United Center', sports: { kind: 'arena', slot: 3, teams: ['bulls', 'blackhawks'], capacity: 20917 } }, hull, undefined)
    expect(r).toMatchObject({ frame: null, boards: [], seats: null, seatCount: 0 })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.**
Run: `cd pipeline && npx vitest run tests/sportsSites.test.js`
Expected: FAIL — `does not provide an export named 'encodeAnchors'`

- [ ] **Step 3: Implement.** Append to `pipeline/lib/sportsSites.js`:

```js
import { pointInRing, ringBBox, ringCentroid, distToRing } from './geom.js'

// Int16 ×4 per anchor: dx·10, y·10, dz·10 (decimetres around the venue centre), yaw·10000.
export function encodeAnchors(anchors, center) {
  const a = new Int16Array(anchors.length * 4)
  anchors.forEach(([x, y, z, yaw], i) => {
    const q = [Math.round((x - center[0]) * 10), Math.round(y * 10), Math.round((z - center[1]) * 10), Math.round(yaw * 10000)]
    if (q.some((v) => v < -32768 || v > 32767)) throw new Error(`anchor ${i} out of Int16 range (${x}, ${y}, ${z}) around ${center}`)
    a.set(q, i * 4)
  })
  return Buffer.from(a.buffer)
}

const frac = (x) => x - Math.floor(x)
// Standing fans on the plaza around an arena: a jittered grid between `from` and `to` metres outside
// the hull, on free ground only, each facing the arena.
export function plazaAnchors(hull, { from = 5, to = 24, step = 1.6, max = 1200, seed = 1 } = {}, isFree = () => true) {
  const [cx, cz] = ringCentroid(hull), bb = ringBBox(hull), pts = []
  let k = 0
  for (let x = bb.minX - to; x <= bb.maxX + to; x += step) {
    for (let z = bb.minZ - to; z <= bb.maxZ + to; z += step) {
      k++
      const p = [x + (frac(k * 0.618034) - 0.5) * step * 0.6, z + (frac(k * 0.414214) - 0.5) * step * 0.6]
      if (pointInRing(p, hull)) continue
      const d = distToRing(p, hull)
      if (d < from || d > to || !isFree(p)) continue
      pts.push([+p[0].toFixed(2), 0.1, +p[1].toFixed(2), +Math.atan2(cx - p[0], cz - p[1]).toFixed(3)])
    }
  }
  return shuffled(pts, seed).slice(0, max)
}

export function venueRecord(hero, hull, info) {
  const s = hero.sports
  const center = ringCentroid(hull).map((v) => +v.toFixed(1))
  const radius = Math.round(Math.max(...hull.map((p) => Math.hypot(p[0] - center[0], p[1] - center[1]))) + 20)
  return {
    key: hero.key, name: hero.name, kind: s.kind, slot: s.slot, teams: s.teams, capacity: s.capacity, center, radius,
    frame: info?.frame ?? null, boards: info?.boards ?? [], flagPole: info?.flagPole ?? null,
    seats: info ? `venues/${hero.key}.seats.bin` : null, seatCount: info?.seats?.length ?? 0,
    plaza: null, plazaCount: 0,
  }
}
```

Move the new `import` line to the top of the file, next to the others.

In `pipeline/build/build-world.js`:
- add `copyFileSync` to the `node:fs` import;
- add `import { venueRecord, encodeAnchors, plazaAnchors } from '../lib/sportsSites.js'`;
- after the line `log(\`parks ${parks.length}, water ${water.length}, …\`)`, insert:

```js
  // ── Sports venues sidecar (V5): field frames, boards, seat and plaza anchors ─
  rmSync(join(OUT, 'venues'), { recursive: true, force: true })
  mkdirSync(join(OUT, 'venues'), { recursive: true })
  const venueList = []
  for (const b of buildings) {
    const h = b.hero && heroes.find((x) => x.key === b.hero)
    if (!h?.sports) continue
    const hull = convexHull(b.polygons.flatMap((p) => p.outer))
    const info = b.venueMeshes?.find((v) => v.venue)?.venue
    const rec = venueRecord(h, hull, info)
    if (info) {
      if (info.seats.length < 10000) throw new Error(`venue ${h.key}: only ${info.seats.length} seat anchors`)
      writeFileSync(join(OUT, rec.seats), encodeAnchors(info.seats, rec.center))
    }
    if (h.sports.kind === 'arena') {
      const plaza = plazaAnchors(hull, { seed: h.sports.slot + 11 }, (p) => !inBuilding(p))
      rec.plaza = `venues/${h.key}.plaza.bin`; rec.plazaCount = plaza.length
      writeFileSync(join(OUT, rec.plaza), encodeAnchors(plaza, rec.center))
    }
    venueList.push(rec)
  }
  if (venueList.length !== heroes.filter((x) => x.sports).length) throw new Error(`venue sidecar: ${venueList.length} venues for ${heroes.filter((x) => x.sports).length} sports heroes`)
  writeFileSync(join(OUT, 'venues.json'), JSON.stringify({ version: 1, venues: venueList }))
  const schedSrc = join(ROOT, 'data', 'schedules.json')
  if (existsSync(schedSrc)) copyFileSync(schedSrc, join(OUT, 'schedules.json'))
  log(`venues sidecar: ${venueList.map((v) => `${v.key} ${v.seatCount} seats${v.plaza ? ` ${v.plazaCount} plaza` : ''}`).join(', ')}`)
```

In the manifest object, after `minimap: {…},`, add:

```js
    venues: 'venues.json', schedules: existsSync(join(ROOT, 'data', 'schedules.json')) ? 'schedules.json' : null,
```

- [ ] **Step 4: Run the tests to verify they pass.**
Run: `cd pipeline && npm test`
Expected: PASS (the whole pipeline suite)

- [ ] **Step 5: Rebuild the world.** The dev server must be stopped.
Run: `cd pipeline && npm run build:world && du -sh ../app/public/world`
Expected:
- a `venues sidecar:` line listing `soldierfield`, `wrigleyfield`, `ratefield` with more than 10,000 seats each, and `unitedcenter` and `wintrust` with `0 seats` and more than 200 `plaza`;
- then `manifest written`;
- `du` reports ≤ 200 MB.

Fields render as plain turf until Task 13: that is expected, and not evaluated here.

- [ ] **Step 6: Commit.**

```bash
git add pipeline/lib/sportsSites.js pipeline/build/build-world.js pipeline/tests/sportsSites.test.js app/public/world
git commit -m "feat(world): venues sidecar — frames, boards, flag pole, seat and plaza anchors (D8, D14)"
```

- [ ] **Step 7: Capture "after" for D4/D5 and evaluate or revert.** The lamps are still lit at night whatever the game state, because every venue reads as level 1 until Task 12.
Run: `cd app && V5_CAPTURE=1 V5_TAG=after-lights V5_ONLY=soldier-aerial,rate-aerial,rate-from-loop npx playwright test e2e/v5-capture.spec.js`
Expected: `7 passed`

Compare with `pre-fields/`.
- **Keep** if all three hold:
  - `soldier-aerial-night`: two bright lamp rows crown the east and west rims, as Wrigley's towers do at `wrigley-aerial-night`;
  - `rate-from-loop-night`: Rate Field reads as a distinct lit bowl on the south horizon;
  - by day the fixtures read as thin steel, not blocks.
- **Otherwise** revert only the lights. Run `git revert --no-edit $(git log --format=%H -1 --grep='rim light rows')`, then `cd pipeline && npm run build:world`, then `git add app/public/world && git commit -m "revert(world): rebuild without the V5 rim lights"`. Record the reasons in the ledger.

Add a ledger line and commit:

```bash
git add docs/superpowers/ledgers/v5-stadiums-sports-life.md && git commit -m "docs(v5): ledger — D4/D5 lamp rows evaluated"
```

---

### Task 8: Build-time ESPN schedules → `schedules.json` (D7)

**Files:**
- Create: `shared/teams.js`
- Create: `pipeline/lib/schedules.js`
- Create: `pipeline/fetch/fetch-schedules.js`
- Modify: `pipeline/package.json` (script `"schedules": "node fetch/fetch-schedules.js"`)
- Create (generated): `pipeline/data/schedules.json`, `app/public/world/schedules.json`
- Test: `pipeline/tests/teams.test.js`, `pipeline/tests/schedules.test.js`

**Interfaces:**
- Produces:
  - `TEAMS: { key, name, full, sport, league, espnId, abbr, colors:[primary, secondary], home }[]`;
  - `VENUE_BY_NAME: Record<string, venueKey>`;
  - `teamByKey(key) → Team|null`;
  - `ESPN = 'https://site.api.espn.com/apis/site/v2/sports'`;
  - `SEASON_TYPES`;
  - `scheduleUrls(team) → string[]`;
  - `scoreOf(any) → number|null`;
  - `parseEvent(event, team) → Game|null`;
  - `mergeGames(Game[][]) → Game[]`, sorted by start;
  - `fetchAllSchedules(fetchImpl, { teams, timeoutMs, log }) → Promise<{ games, failures }>`.
- The `Game` shape, used by every later task:

```js
{ id, teams: string[], results: { [teamKey]: 'W'|'L'|'T' }, sport, league, start /* ISO UTC */, venue /* venue key | null */,
  venueName, status /* ESPN status name */, state /* 'pre'|'in'|'post' */, detail,
  home: { abbr, name, score: number|null, winner: boolean|null }, away: { … }, chicagoHome: boolean, attendance: number|null, simulated?: true }
```

- The schedules file: `{ version: 1, generatedAt, source: 'espn', urls: string[], games: Game[] }`.
- **The exact public ESPN schedule URLs.** These IDs were verified against `…/teams/<abbr>`. The sibling app's `112`, `145` and `1617` are *not* ESPN IDs.
  - Cubs (MLB 16):
    - `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/16/schedule?seasontype=2`
    - `…/baseball/mlb/teams/16/schedule?seasontype=3`
  - White Sox (MLB 4):
    - `…/baseball/mlb/teams/4/schedule?seasontype=2`
    - `…/baseball/mlb/teams/4/schedule?seasontype=3`
  - Bears (NFL 3): `…/football/nfl/teams/3/schedule?seasontype=1`, `?seasontype=2`, `?seasontype=3`
  - Bulls (NBA 4): `…/basketball/nba/teams/4/schedule?seasontype=1`, `=2`, `=3`. Without the parameter, the NBA returns only the preseason.
  - Blackhawks (NHL 4): `…/hockey/nhl/teams/4/schedule?seasontype=1`, `=2`, `=3`
  - Fire (MLS 182): `…/soccer/usa.1/teams/182/schedule`. MLS takes no seasontype, and `teams/chi` in `usa.1` resolves to Chile.
  - Sky (WNBA 19): `…/basketball/wnba/teams/19/schedule?seasontype=1`, `=2`, `=3`

- [ ] **Step 1: Write the failing tests.** Create `pipeline/tests/teams.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { TEAMS, VENUE_BY_NAME, teamByKey } from '../../shared/teams.js'

describe('shared/teams.js', () => {
  it('lists the seven Chicago teams with ESPN ids, sourced colours and home venues', () => {
    expect(TEAMS.map((t) => [t.key, t.league, t.espnId, t.home])).toEqual([
      ['cubs', 'mlb', 16, 'wrigleyfield'], ['whitesox', 'mlb', 4, 'ratefield'], ['bears', 'nfl', 3, 'soldierfield'],
      ['bulls', 'nba', 4, 'unitedcenter'], ['blackhawks', 'nhl', 4, 'unitedcenter'], ['fire', 'usa.1', 182, 'soldierfield'], ['sky', 'wnba', 19, 'wintrust'],
    ])
    for (const t of TEAMS) for (const c of t.colors) expect(c).toMatch(/^#[0-9A-F]{6}$/)
    expect(teamByKey('bears').colors).toEqual(['#0B162A', '#C83803'])
    expect(teamByKey('nope')).toBeNull()
  })
  it('maps ESPN venue names, old and new, to venue keys', () => {
    expect(VENUE_BY_NAME['Guaranteed Rate Field']).toBe('ratefield')
    expect(VENUE_BY_NAME['Rate Field']).toBe('ratefield')
    expect(VENUE_BY_NAME['Wintrust Arena']).toBe('wintrust')
  })
})
```

Create `pipeline/tests/schedules.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { scheduleUrls, parseEvent, mergeGames, scoreOf, fetchAllSchedules } from '../lib/schedules.js'
import { TEAMS, teamByKey } from '../../shared/teams.js'

const side = (id, abbr, score, winner) => ({ team: { id, abbreviation: abbr, displayName: abbr }, score, winner })
const ev = (id, date, venue, home, away, st = {}) => ({
  id, date,
  competitions: [{
    venue: { fullName: venue }, attendance: st.attendance ?? 0,
    status: { type: { name: st.name ?? 'STATUS_FINAL', state: st.state ?? 'post', completed: st.completed ?? true, shortDetail: st.detail ?? 'Final' } },
    competitors: [{ homeAway: 'home', ...home }, { homeAway: 'away', ...away }],
  }],
})
const cubsWin = ev('1', '2026-06-05T18:20Z', 'Wrigley Field', side('16', 'CHC', { value: 5, displayValue: '5' }, true), side('21', 'NYM', { value: 3, displayValue: '3' }, false), { attendance: 38012 })
const crosstown = ev('2', '2026-06-20T18:10Z', 'Wrigley Field', side('16', 'CHC', { value: 2 }, false), side('4', 'CHW', { value: 7 }, true))
const postponed = ev('3', '2026-06-21T18:10Z', 'Wrigley Field', side('16', 'CHC'), side('21', 'NYM'), { name: 'STATUS_POSTPONED', state: 'post', completed: false, detail: 'Postponed' })
const upcoming = ev('4', '2026-09-30T00:05Z', 'Tropicana Field', side('30', 'TB'), side('16', 'CHC'), { name: 'STATUS_SCHEDULED', state: 'pre', completed: false, detail: '9/29 - 7:05 PM EDT' })

describe('schedules', () => {
  it('builds the exact public ESPN schedule URLs', () => {
    const E = 'https://site.api.espn.com/apis/site/v2/sports'
    expect(TEAMS.flatMap(scheduleUrls)).toEqual([
      `${E}/baseball/mlb/teams/16/schedule?seasontype=2`, `${E}/baseball/mlb/teams/16/schedule?seasontype=3`,
      `${E}/baseball/mlb/teams/4/schedule?seasontype=2`, `${E}/baseball/mlb/teams/4/schedule?seasontype=3`,
      `${E}/football/nfl/teams/3/schedule?seasontype=1`, `${E}/football/nfl/teams/3/schedule?seasontype=2`, `${E}/football/nfl/teams/3/schedule?seasontype=3`,
      `${E}/basketball/nba/teams/4/schedule?seasontype=1`, `${E}/basketball/nba/teams/4/schedule?seasontype=2`, `${E}/basketball/nba/teams/4/schedule?seasontype=3`,
      `${E}/hockey/nhl/teams/4/schedule?seasontype=1`, `${E}/hockey/nhl/teams/4/schedule?seasontype=2`, `${E}/hockey/nhl/teams/4/schedule?seasontype=3`,
      `${E}/soccer/usa.1/teams/182/schedule`,
      `${E}/basketball/wnba/teams/19/schedule?seasontype=1`, `${E}/basketball/wnba/teams/19/schedule?seasontype=2`, `${E}/basketball/wnba/teams/19/schedule?seasontype=3`,
    ])
  })
  it('reads scores in every ESPN shape', () => {
    expect(scoreOf({ value: 2, displayValue: '2', $ref: 'x' })).toBe(2)
    expect(scoreOf({ displayValue: '4' })).toBe(4)
    expect(scoreOf('3')).toBe(3)
    expect(scoreOf(undefined)).toBeNull()
    expect(scoreOf({})).toBeNull()
  })
  it('parses a Cubs home win at Wrigley', () => {
    expect(parseEvent(cubsWin, teamByKey('cubs'))).toMatchObject({
      id: '1', teams: ['cubs'], results: { cubs: 'W' }, sport: 'baseball', league: 'mlb', start: '2026-06-05T18:20:00.000Z',
      venue: 'wrigleyfield', state: 'post', home: { abbr: 'CHC', score: 5, winner: true }, away: { abbr: 'NYM', score: 3 }, chicagoHome: true, attendance: 38012,
    })
  })
  it('an upcoming away game has no venue of ours and no scores', () => {
    expect(parseEvent(upcoming, teamByKey('cubs'))).toMatchObject({ venue: null, state: 'pre', home: { score: null }, away: { score: null }, results: {}, chicagoHome: false })
  })
  it('a postponed game keeps its status and has no result', () => {
    expect(parseEvent(postponed, teamByKey('cubs'))).toMatchObject({ status: 'STATUS_POSTPONED', results: {} })
  })
  it('rejects events without competitors', () => {
    expect(parseEvent({ id: '9', date: '2026-01-01T00:00Z', competitions: [{}] }, teamByKey('cubs'))).toBeNull()
  })
  it('merges a Crosstown game listed by both teams', () => {
    const merged = mergeGames([[parseEvent(crosstown, teamByKey('cubs'))], [parseEvent(crosstown, teamByKey('whitesox'))], [parseEvent(cubsWin, teamByKey('cubs'))]])
    expect(merged).toHaveLength(2)
    expect(merged[1]).toMatchObject({ id: '2', teams: ['cubs', 'whitesox'], results: { cubs: 'L', whitesox: 'W' } })
    expect(merged[0].start < merged[1].start).toBe(true)
  })
  it('fetchAllSchedules keeps going when requests fail', async () => {
    const fake = async (url) => (url.includes('/teams/16/') ? { ok: true, json: async () => ({ events: [cubsWin, upcoming] }) } : { ok: false, status: 500 })
    const { games, failures } = await fetchAllSchedules(fake)
    expect(games.map((g) => g.id)).toEqual(['1', '4'])
    expect(failures).toHaveLength(15)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.**
Run: `cd pipeline && npx vitest run tests/teams.test.js tests/schedules.test.js`
Expected: FAIL — `Failed to load url ../../shared/teams.js`

- [ ] **Step 3: Implement.** Create `shared/teams.js`:

```js
// shared/teams.js — Chicago's seven major teams (pipeline + app): ESPN site-API ids, sourced colours, home venues.
// Colours: official brand guides as published by each club (Bears #0B162A/#C83803, Cubs #0E3386/#CC3433,
// White Sox #27251F/#C4CED4, Bulls #CE1141, Blackhawks #CF0A2C, Sky #418FDE/#FFCD00); Fire from ESPN's team API
// (color 7ccdef, alternateColor ff0000), with red first because it is the home kit and the fans' colour.
export const TEAMS = [
  { key: 'cubs', name: 'Cubs', full: 'Chicago Cubs', sport: 'baseball', league: 'mlb', espnId: 16, abbr: 'CHC', colors: ['#0E3386', '#CC3433'], home: 'wrigleyfield' },
  { key: 'whitesox', name: 'White Sox', full: 'Chicago White Sox', sport: 'baseball', league: 'mlb', espnId: 4, abbr: 'CHW', colors: ['#27251F', '#C4CED4'], home: 'ratefield' },
  { key: 'bears', name: 'Bears', full: 'Chicago Bears', sport: 'football', league: 'nfl', espnId: 3, abbr: 'CHI', colors: ['#0B162A', '#C83803'], home: 'soldierfield' },
  { key: 'bulls', name: 'Bulls', full: 'Chicago Bulls', sport: 'basketball', league: 'nba', espnId: 4, abbr: 'CHI', colors: ['#CE1141', '#000000'], home: 'unitedcenter' },
  { key: 'blackhawks', name: 'Blackhawks', full: 'Chicago Blackhawks', sport: 'hockey', league: 'nhl', espnId: 4, abbr: 'CHI', colors: ['#CF0A2C', '#000000'], home: 'unitedcenter' },
  { key: 'fire', name: 'Fire', full: 'Chicago Fire FC', sport: 'soccer', league: 'usa.1', espnId: 182, abbr: 'CHI', colors: ['#FF0000', '#7CCDEF'], home: 'soldierfield' },
  { key: 'sky', name: 'Sky', full: 'Chicago Sky', sport: 'basketball', league: 'wnba', espnId: 19, abbr: 'CHI', colors: ['#418FDE', '#FFCD00'], home: 'wintrust' },
]
// ESPN `competitions[0].venue.fullName` → our venue key. The venue decides where a game happens, not the team:
// the White Sox have played home games at Wrigley and the Sky at the United Center.
export const VENUE_BY_NAME = {
  'Wrigley Field': 'wrigleyfield', 'Rate Field': 'ratefield', 'Guaranteed Rate Field': 'ratefield',
  'Soldier Field': 'soldierfield', 'United Center': 'unitedcenter', 'Wintrust Arena': 'wintrust',
}
export const teamByKey = (key) => TEAMS.find((t) => t.key === key) ?? null
```

Create `pipeline/lib/schedules.js`:

```js
// pipeline/lib/schedules.js — the public ESPN site API → Game records (build time only; the app never calls ESPN).
import { TEAMS, VENUE_BY_NAME } from '../../shared/teams.js'

export const ESPN = 'https://site.api.espn.com/apis/site/v2/sports'
// 1 preseason, 2 regular season, 3 postseason. MLB spring training is in Arizona (skipped); MLS takes no parameter.
export const SEASON_TYPES = { mlb: [2, 3], nfl: [1, 2, 3], nba: [1, 2, 3], nhl: [1, 2, 3], wnba: [1, 2, 3], 'usa.1': [null] }

export function scheduleUrls(team) {
  const base = `${ESPN}/${team.sport}/${team.league}/teams/${team.espnId}/schedule`
  return SEASON_TYPES[team.league].map((st) => (st == null ? base : `${base}?seasontype=${st}`))
}

export function scoreOf(s) {
  if (s == null) return null
  const v = typeof s === 'object' ? (s.value ?? (s.displayValue != null ? Number(s.displayValue) : NaN)) : Number(s)
  return Number.isFinite(v) ? v : null
}

const VOID = new Set(['STATUS_POSTPONED', 'STATUS_CANCELED', 'STATUS_CANCELLED', 'STATUS_FORFEIT'])

export function parseEvent(e, team) {
  const c = e?.competitions?.[0]
  const home = c?.competitors?.find((x) => x.homeAway === 'home'), away = c?.competitors?.find((x) => x.homeAway === 'away')
  if (!e?.date || !home || !away) return null
  const st = c.status?.type ?? {}
  const pre = (st.state ?? 'pre') === 'pre'
  const side = (x) => ({ abbr: x.team?.abbreviation ?? '?', name: x.team?.displayName ?? '?', score: pre ? null : scoreOf(x.score), winner: typeof x.winner === 'boolean' ? x.winner : null })
  const ours = String(home.team?.id) === String(team.espnId) ? home : away
  const theirs = ours === home ? away : home
  const results = {}
  if (st.state === 'post' && st.completed !== false && !VOID.has(st.name)) {
    const us = scoreOf(ours.score), them = scoreOf(theirs.score)
    const r = ours.winner === true ? 'W' : theirs.winner === true ? 'L' : us != null && them != null ? (us > them ? 'W' : us < them ? 'L' : 'T') : null
    if (r) results[team.key] = r
  }
  return {
    id: String(e.id), teams: [team.key], results, sport: team.sport, league: team.league,
    start: new Date(e.date).toISOString(), venue: VENUE_BY_NAME[c.venue?.fullName] ?? null, venueName: c.venue?.fullName ?? '',
    status: st.name ?? 'STATUS_SCHEDULED', state: st.state ?? 'pre', detail: st.shortDetail ?? '',
    home: side(home), away: side(away), chicagoHome: ours === home, attendance: c.attendance || null,
  }
}

// One record per league:id; a game listed by two Chicago teams (Crosstown) keeps both teams and results.
export function mergeGames(lists) {
  const byId = new Map()
  for (const g of lists.flat()) {
    if (!g) continue
    const k = `${g.league}:${g.id}`, cur = byId.get(k)
    if (!cur) { byId.set(k, { ...g, teams: [...g.teams], results: { ...g.results } }); continue }
    for (const t of g.teams) if (!cur.teams.includes(t)) cur.teams.push(t)
    Object.assign(cur.results, g.results)
  }
  return [...byId.values()].sort((a, b) => a.start.localeCompare(b.start))
}

export async function fetchAllSchedules(fetchImpl, { teams = TEAMS, timeoutMs = 10000, log = () => {} } = {}) {
  const lists = [], failures = []
  for (const team of teams) {
    for (const url of scheduleUrls(team)) {
      try {
        const r = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'chi-atlas-open-world (build)' } })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const events = (await r.json())?.events ?? []
        lists.push(events.map((e) => parseEvent(e, team)))
        log(`  ✓ ${team.key} ${url.split('?')[1] ?? 'season'}: ${events.length}`)
      } catch (err) {
        failures.push({ team: team.key, url, error: String(err?.message ?? err) })
      }
    }
  }
  return { games: mergeGames(lists), failures }
}
```

Create `pipeline/fetch/fetch-schedules.js`:

```js
// pipeline/fetch/fetch-schedules.js — ESPN public schedules → pipeline/data/schedules.json + app/public/world/schedules.json.
// Run: npm run schedules. Keeps the previous file when nothing could be fetched.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEAMS } from '../../shared/teams.js'
import { fetchAllSchedules, scheduleUrls } from '../lib/schedules.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'data', 'schedules.json')
const PUB = join(ROOT, '..', 'app', 'public', 'world', 'schedules.json')

const { games, failures } = await fetchAllSchedules(fetch, { log: console.log })
for (const f of failures) console.warn(`  ! ${f.team} ${f.url}: ${f.error}`)
if (!games.length) { console.warn('no games fetched — keeping the previous schedules.json'); process.exit(0) }
const doc = { version: 1, generatedAt: new Date().toISOString(), source: 'espn', urls: TEAMS.flatMap(scheduleUrls), games }
writeFileSync(DATA, JSON.stringify(doc))
mkdirSync(dirname(PUB), { recursive: true })
writeFileSync(PUB, JSON.stringify(doc))
console.log(`schedules: ${games.length} games, ${games.filter((g) => g.venue).length} at our venues, ${failures.length} failed requests`)
```

In `pipeline/package.json` `"scripts"`, add `"schedules": "node fetch/fetch-schedules.js",`.

- [ ] **Step 4: Run the tests to verify they pass.**
Run: `cd pipeline && npx vitest run tests/teams.test.js tests/schedules.test.js`
Expected: PASS (9 tests)

- [ ] **Step 5: Fetch the real schedules.**
Run: `cd pipeline && npm run schedules`
Expected:
- 17 `✓` lines;
- then a line like `schedules: 4xx games, 2xx at our venues, 0 failed requests` (the counts depend on the date).
- If ESPN refuses some requests, the `!` lines name them and the file is still written. Add a ledger `Ruling:` with the failed URLs.

- [ ] **Step 6: Commit.**

```bash
git add shared/teams.js pipeline/lib/schedules.js pipeline/fetch/fetch-schedules.js pipeline/package.json pipeline/tests/teams.test.js pipeline/tests/schedules.test.js pipeline/data/schedules.json app/public/world/schedules.json
git commit -m "feat(pipeline): build-time ESPN schedules and results for the seven Chicago teams (D7)"
```

---

### Task 9: Chicago time and the game-state machine (D6)

**Files:**
- Create: `app/src/sports/chicagoTime.js`, `app/src/sports/gameState.js`
- Test: `app/src/sports/__tests__/chicagoTime.test.js`, `app/src/sports/__tests__/gameState.test.js`

**Interfaces:**
- Consumes: the `Game` shape (Task 8).
- Produces:
  - `chicagoParts(ms) → { year, month, day, hour, minute, second, weekday }`;
  - `chicagoDate(ms) → 'YYYY-MM-DD'`;
  - `offsetMinutes(ms) → −300 | −360`;
  - `chicagoToUtc(date:'YYYY-MM-DD', hour, minute=0) → ms`;
  - `addDays(date, n) → 'YYYY-MM-DD'`;
  - `weekday(date) → 0 (Sun) … 6`;
  - `formatChicago(ms) → 'Tue 7:05 PM'`;
  - `SPORT_MINUTES = { baseball:180, football:195, basketball:150, hockey:160, soccer:115 }`;
  - `PREGAME_MIN = 120`, `POSTGAME_MIN = 60`;
  - `isVoid(game) → boolean`;
  - `gameWindow(game) → { open, start, end, close }` (ms);
  - `gameState(venueKey, nowMs, games) → { state: 'idle'|'pregame'|'live'|'postgame', game: Game|null, winDay: boolean, lossDay: boolean }`;
  - `resultDay(teamKey, nowMs, games) → 'W'|'L'|null`: the latest finished game that Chicago date decides;
  - `nextGame(venueKey, nowMs, games) → Game|null`.

- [ ] **Step 1: Write the failing tests.** Create `app/src/sports/__tests__/chicagoTime.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { chicagoDate, chicagoParts, chicagoToUtc, offsetMinutes, addDays, weekday, formatChicago } from '../chicagoTime.js'

const T = (iso) => Date.parse(iso)
describe('chicagoTime (independent of the host time zone)', () => {
  it('Chicago dates roll over at Chicago midnight', () => {
    expect(chicagoDate(T('2026-04-05T04:30:00Z'))).toBe('2026-04-04') // 23:30 CDT
    expect(chicagoDate(T('2026-04-05T05:30:00Z'))).toBe('2026-04-05') // 00:30 CDT
    expect(chicagoDate(T('2026-01-10T05:30:00Z'))).toBe('2026-01-09') // 23:30 CST
  })
  it('offset is −5 h in summer and −6 h in winter', () => {
    expect(offsetMinutes(T('2026-07-01T12:00:00Z'))).toBe(-300)
    expect(offsetMinutes(T('2026-01-01T12:00:00Z'))).toBe(-360)
  })
  it('converts Chicago wall time to UTC across both DST changes', () => {
    expect(chicagoToUtc('2026-03-07', 12)).toBe(T('2026-03-07T18:00:00Z'))
    expect(chicagoToUtc('2026-03-08', 12)).toBe(T('2026-03-08T17:00:00Z'))
    expect(chicagoToUtc('2026-10-31', 12)).toBe(T('2026-10-31T17:00:00Z'))
    expect(chicagoToUtc('2026-11-01', 12)).toBe(T('2026-11-01T18:00:00Z'))
    expect(chicagoToUtc('2026-07-04', 19, 5)).toBe(T('2026-07-05T00:05:00Z'))
  })
  it('parts, days and weekdays', () => {
    expect(chicagoParts(T('2026-07-05T00:05:00Z'))).toMatchObject({ year: 2026, month: 7, day: 4, hour: 19, minute: 5 })
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(weekday('2026-09-27')).toBe(0)
    expect(formatChicago(T('2026-07-05T00:05:00Z'))).toBe('Sat 7:05 PM')
  })
})
```

Create `app/src/sports/__tests__/gameState.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { gameState, gameWindow, nextGame, resultDay, isVoid } from '../gameState.js'

const T = (iso) => Date.parse(iso)
const G = (o) => ({ id: o.id ?? o.start, teams: ['cubs'], results: {}, sport: 'baseball', league: 'mlb', venue: 'wrigleyfield', status: 'STATUS_SCHEDULED', state: 'pre', home: {}, away: {}, ...o })
const at = (venue, iso, games) => gameState(venue, T(iso), games)

describe('gameState', () => {
  const night = G({ start: '2026-07-10T00:05:00Z' }) // Thu 9 Jul, 19:05 CDT
  it('idle → pregame (2 h before) → live → postgame (1 h) → idle', () => {
    expect(at('wrigleyfield', '2026-07-09T21:30:00Z', [night]).state).toBe('idle')
    expect(at('wrigleyfield', '2026-07-09T23:00:00Z', [night]).state).toBe('pregame')
    expect(at('wrigleyfield', '2026-07-10T01:00:00Z', [night])).toMatchObject({ state: 'live', game: night })
    expect(at('wrigleyfield', '2026-07-10T03:30:00Z', [night]).state).toBe('postgame')
    expect(at('wrigleyfield', '2026-07-10T04:30:00Z', [night])).toMatchObject({ state: 'idle', game: null })
    expect(at('ratefield', '2026-07-10T01:00:00Z', [night]).state).toBe('idle')
  })
  it('each sport has its own length', () => {
    const bears = G({ teams: ['bears'], sport: 'football', venue: 'soldierfield', start: '2026-10-04T17:00:00Z' })
    expect(gameWindow(bears).end - gameWindow(bears).start).toBe(195 * 60000)
    expect(at('soldierfield', '2026-10-04T20:10:00Z', [bears]).state).toBe('live')
    expect(at('soldierfield', '2026-10-04T20:20:00Z', [bears]).state).toBe('postgame')
  })
  it('postponed and cancelled games never light a venue', () => {
    for (const status of ['STATUS_POSTPONED', 'STATUS_CANCELED']) {
      const g = { ...night, status, state: 'post', results: { cubs: 'W' } }
      expect(isVoid(g)).toBe(true)
      expect(at('wrigleyfield', '2026-07-10T01:00:00Z', [g])).toMatchObject({ state: 'idle', winDay: false })
      expect(at('wrigleyfield', '2026-07-10T04:00:00Z', [g]).winDay).toBe(false)
      expect(nextGame('wrigleyfield', T('2026-07-09T12:00:00Z'), [g])).toBeNull()
    }
  })
  it('live beats pregame beats postgame at a shared venue', () => {
    const g1 = G({ start: '2026-07-11T18:20:00Z' }), g2 = G({ start: '2026-07-11T23:40:00Z' })
    expect(at('wrigleyfield', '2026-07-11T21:30:00Z', [g1, g2])).toMatchObject({ state: 'postgame', game: g1 })
    expect(at('wrigleyfield', '2026-07-11T22:00:00Z', [g1, g2])).toMatchObject({ state: 'pregame', game: g2 })
    expect(at('wrigleyfield', '2026-07-11T23:50:00Z', [g1, g2])).toMatchObject({ state: 'live', game: g2 })
    const bulls = G({ teams: ['bulls'], sport: 'basketball', venue: 'unitedcenter', start: '2026-11-03T01:00:00Z' })
    const hawks = G({ teams: ['blackhawks'], sport: 'hockey', venue: 'unitedcenter', start: '2026-11-04T01:30:00Z' })
    expect(at('unitedcenter', '2026-11-03T02:00:00Z', [bulls, hawks]).game).toBe(bulls)
    expect(at('unitedcenter', '2026-11-04T02:00:00Z', [bulls, hawks]).game).toBe(hawks)
  })
  it('nextGame is the earliest future game at the venue', () => {
    const a = G({ start: '2026-07-12T18:20:00Z' }), b = G({ start: '2026-07-13T00:05:00Z' })
    expect(nextGame('wrigleyfield', T('2026-07-11T00:00:00Z'), [b, a])).toBe(a)
    expect(nextGame('wrigleyfield', T('2026-07-14T00:00:00Z'), [a, b])).toBeNull()
  })
})

describe('Cubs W / L days', () => {
  const away = G({ venue: null, start: '2026-04-04T23:10:00Z', results: { cubs: 'W' } }) // Sat 4 Apr, 18:10 CDT, away
  it('winDay follows the Chicago date across DST and host time zones', () => {
    expect(at('wrigleyfield', '2026-04-05T01:00:00Z', [away]).winDay).toBe(false) // still playing
    expect(at('wrigleyfield', '2026-04-05T03:00:00Z', [away]).winDay).toBe(true)  // 22:00 CDT
    expect(at('wrigleyfield', '2026-04-05T04:59:00Z', [away]).winDay).toBe(true)  // 23:59 CDT
    expect(at('wrigleyfield', '2026-04-05T05:01:00Z', [away]).winDay).toBe(false) // 00:01 CDT, next date
    const spring = G({ start: '2026-03-08T18:05:00Z', results: { cubs: 'W' } })     // DST starts that morning
    expect(resultDay('cubs', T('2026-03-09T04:59:00Z'), [spring])).toBe('W')
    expect(resultDay('cubs', T('2026-03-09T05:01:00Z'), [spring])).toBeNull()
    const fall = G({ start: '2026-11-01T19:00:00Z', results: { cubs: 'W' } })       // DST ends that morning (CST, −6 h)
    expect(resultDay('cubs', T('2026-11-02T05:59:00Z'), [fall])).toBe('W')
    expect(resultDay('cubs', T('2026-11-02T06:01:00Z'), [fall])).toBeNull()
  })
  it('a loss is an L day, and the latest finished game of a doubleheader decides', () => {
    const g1 = G({ start: '2026-07-11T18:20:00Z', results: { cubs: 'W' } }), g2 = G({ start: '2026-07-11T23:40:00Z', results: { cubs: 'L' } })
    expect(at('wrigleyfield', '2026-07-11T22:00:00Z', [g1, g2])).toMatchObject({ winDay: true, lossDay: false })
    expect(at('wrigleyfield', '2026-07-12T03:00:00Z', [g1, g2])).toMatchObject({ winDay: false, lossDay: true })
  })
  it('a Crosstown win counts for the Cubs', () => {
    const x = G({ teams: ['cubs', 'whitesox'], results: { cubs: 'W', whitesox: 'L' }, start: '2026-06-20T18:10:00Z' })
    expect(at('ratefield', '2026-06-20T22:00:00Z', [x]).winDay).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.**
Run: `cd app && npx vitest run src/sports/__tests__/chicagoTime.test.js src/sports/__tests__/gameState.test.js`
Expected: FAIL — `Failed to load url ../chicagoTime.js`

- [ ] **Step 3: Implement.** Create `app/src/sports/chicagoTime.js`:

```js
// app/src/sports/chicagoTime.js — Chicago wall-clock dates and times, DST-aware, independent of the host time zone.
const TZ = 'America/Chicago'
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' })
const short = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: '2-digit' })

export function chicagoParts(ms) {
  const p = {}
  for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second, weekday: p.weekday }
}
const pad = (n) => String(n).padStart(2, '0')
export function chicagoDate(ms) { const p = chicagoParts(ms); return `${p.year}-${pad(p.month)}-${pad(p.day)}` }
export function offsetMinutes(ms) {
  const p = chicagoParts(ms)
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000) / 60000)
}
// Wall time in Chicago → UTC ms. Two passes settle the offset on DST-change days.
export function chicagoToUtc(date, hour, minute = 0) {
  const [y, m, d] = date.split('-').map(Number)
  const wall = Date.UTC(y, m - 1, d, hour, minute)
  const first = wall - offsetMinutes(wall) * 60000
  return wall - offsetMinutes(first) * 60000
}
export function addDays(date, n) { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10) }
export function weekday(date) { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() }
export const formatChicago = (ms) => short.format(new Date(ms)).replace(/ /g, ' ').replace(',', '')
```

Create `app/src/sports/gameState.js`:

```js
// app/src/sports/gameState.js — a venue's state at an instant: idle | pregame | live | postgame, plus the Cubs
// W / L day (the Chicago date of a finished Cubs game). Pure: (venue, time, schedule) → state.
import { chicagoDate } from './chicagoTime.js'

export const SPORT_MINUTES = { baseball: 180, football: 195, basketball: 150, hockey: 160, soccer: 115 }
export const PREGAME_MIN = 120
export const POSTGAME_MIN = 60
const VOID = new Set(['STATUS_POSTPONED', 'STATUS_CANCELED', 'STATUS_CANCELLED', 'STATUS_FORFEIT'])
export const isVoid = (g) => VOID.has(g?.status)

export function gameWindow(g) {
  const start = Date.parse(g.start), dur = (SPORT_MINUTES[g.sport] ?? 150) * 60000
  return { open: start - PREGAME_MIN * 60000, start, end: start + dur, close: start + dur + POSTGAME_MIN * 60000 }
}

const RANK = { live: 3, pregame: 2, postgame: 1 }
export function gameState(venueKey, nowMs, games) {
  let best = null
  for (const g of games) {
    if (g.venue !== venueKey || isVoid(g)) continue
    const w = gameWindow(g)
    if (nowMs < w.open || nowMs >= w.close) continue
    const state = nowMs < w.start ? 'pregame' : nowMs < w.end ? 'live' : 'postgame'
    if (!best || RANK[state] > RANK[best.state]) best = { state, game: g }
  }
  const day = resultDay('cubs', nowMs, games)
  return { state: best?.state ?? 'idle', game: best?.game ?? null, winDay: day === 'W', lossDay: day === 'L' }
}

// The result of the team's latest game that finished today (Chicago date of its start), else null.
export function resultDay(teamKey, nowMs, games) {
  const today = chicagoDate(nowMs)
  let latest = null
  for (const g of games) {
    if (!g.teams?.includes(teamKey) || isVoid(g)) continue
    const r = g.results?.[teamKey]
    if (r !== 'W' && r !== 'L') continue
    const w = gameWindow(g)
    if (nowMs < w.end || chicagoDate(w.start) !== today) continue
    if (!latest || w.start > latest.start) latest = { start: w.start, r }
  }
  return latest?.r ?? null
}

export function nextGame(venueKey, nowMs, games) {
  let best = null, bestT = Infinity
  for (const g of games) {
    if (g.venue !== venueKey || isVoid(g)) continue
    const t = Date.parse(g.start)
    if (t > nowMs && t < bestT) { best = g; bestT = t }
  }
  return best
}
```

- [ ] **Step 4: Run the tests to verify they pass, in three host time zones.**
Run: `cd app && npx vitest run src/sports/__tests__/chicagoTime.test.js src/sports/__tests__/gameState.test.js && TZ=Asia/Tokyo npx vitest run src/sports/__tests__/ && TZ=America/Los_Angeles npx vitest run src/sports/__tests__/`
Expected: PASS three times (the same test count each time)

- [ ] **Step 5: Commit.**

```bash
git add app/src/sports/chicagoTime.js app/src/sports/gameState.js app/src/sports/__tests__/chicagoTime.test.js app/src/sports/__tests__/gameState.test.js
git commit -m "feat(sports): Chicago-time game-state machine with W/L days, DST-safe (D6, D11)"
```

---

### Task 10: Simulated calendar (the D7 fallback)

**Files:**
- Create: `app/src/sports/simSchedule.js`
- Test: `app/src/sports/__tests__/simSchedule.test.js`

**Interfaces:**
- Consumes: `TEAMS` (`shared/teams.js`); `chicagoToUtc`, `addDays`, `weekday`, `chicagoParts` (Task 9).
- Produces:
  - `hashFrac(str) → [0, 1)` (FNV-1a);
  - `simulatedGames(year) → Game[]`: typical home dates for all seven teams, deterministic, with `simulated: true` and final scores that are revealed only after each game ends (by `gameState` and the scoreboard).

- [ ] **Step 1: Write the failing test.** Create `app/src/sports/__tests__/simSchedule.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { simulatedGames } from '../simSchedule.js'
import { chicagoDate, chicagoParts } from '../chicagoTime.js'

describe('simulatedGames', () => {
  const g = simulatedGames(2026)
  const of = (k) => g.filter((x) => x.teams[0] === k)
  it('is deterministic and covers all seven teams with plausible home counts', () => {
    expect(simulatedGames(2026)).toEqual(g)
    expect(of('cubs').length).toBeGreaterThan(55); expect(of('cubs').length).toBeLessThan(90)
    expect(of('bears').length).toBeGreaterThanOrEqual(6); expect(of('bears').length).toBeLessThanOrEqual(10)
    for (const k of ['whitesox', 'bulls', 'blackhawks', 'fire', 'sky']) expect(of(k).length).toBeGreaterThan(5)
    for (const x of g) expect(x.simulated).toBe(true)
  })
  it('never books two games at one venue on one Chicago date', () => {
    const seen = new Set()
    for (const x of g) { const k = `${x.venue}:${chicagoDate(Date.parse(x.start))}`; expect(seen.has(k), k).toBe(false); seen.add(k) }
  })
  it('keeps Chicago wall-clock start times through DST', () => {
    const jan = of('bulls').find((x) => x.start.startsWith('2026-01'))
    expect(chicagoParts(Date.parse(jan.start)).hour).toBe(19)
    expect(new Date(jan.start).getUTCHours()).toBe(1)
    const jul = of('cubs').find((x) => chicagoDate(Date.parse(x.start)).startsWith('2026-07') && chicagoParts(Date.parse(x.start)).hour === 19)
    expect(jul.start).toMatch(/T00:05:00\.000Z$/)
  })
  it('results agree with the scores', () => {
    for (const x of g) {
      const r = x.results[x.teams[0]]
      expect(r).toBe(x.home.score > x.away.score ? 'W' : x.home.score < x.away.score ? 'L' : 'T')
      if (x.sport !== 'soccer') expect(r).not.toBe('T')
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**
Run: `cd app && npx vitest run src/sports/__tests__/simSchedule.test.js`
Expected: FAIL — `Failed to load url ../simSchedule.js`

- [ ] **Step 3: Implement.** Create `app/src/sports/simSchedule.js`:

```js
// app/src/sports/simSchedule.js — the simulated calendar: typical home dates and times for Chicago's seven
// teams (backlog default 6). Deterministic; results are fixed but only revealed after each game ends.
import { TEAMS } from '../../../shared/teams.js'
import { chicagoToUtc, addDays, weekday } from './chicagoTime.js'

export function hashFrac(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}
const OPP = {
  mlb: ['MIL', 'STL', 'CIN', 'PIT', 'LAD', 'NYM', 'SF', 'ATL', 'DET', 'MIN'],
  nfl: ['GB', 'DET', 'MIN', 'DAL', 'NYG', 'SEA', 'TB', 'LAR'],
  nba: ['MIL', 'DET', 'CLE', 'IND', 'BOS', 'NYK', 'LAL', 'MIA'],
  nhl: ['DET', 'STL', 'MIN', 'NSH', 'COL', 'DAL', 'WPG', 'TOR'],
  wnba: ['IND', 'NY', 'LV', 'CON', 'ATL', 'MIN', 'SEA', 'WSH'],
  'usa.1': ['CLB', 'CIN', 'NE', 'NYC', 'ORL', 'MIA', 'TOR', 'MTL'],
}
const RANGE = { mlb: [0, 9], nfl: [3, 38], nba: [88, 124], wnba: [68, 98], nhl: [0, 6], 'usa.1': [0, 4] }
const within = (md, a, b) => md >= a && md <= b
const weekend = (dow) => dow === 0 || dow === 6
// (month-day, weekday, day-of-year) → [hour, minute] of a home game, or null.
const RULES = {
  cubs: (md, dow, doy) => (within(md, '04-01', '09-27') && dow !== 1 && Math.floor(doy / 3) % 2 === 0 ? (weekend(dow) ? [13, 20] : [19, 5]) : null),
  whitesox: (md, dow, doy) => (within(md, '04-01', '09-27') && dow !== 1 && Math.floor(doy / 3) % 2 === 1 ? (weekend(dow) ? [13, 10] : [18, 40]) : null),
  bears: (md, dow, doy) => (within(md, '09-13', '12-31') && dow === 0 && Math.floor(doy / 7) % 2 === 0 ? [12, 0] : null),
  fire: (md, dow, doy) => (within(md, '03-01', '10-31') && dow === 6 && Math.floor(doy / 7) % 2 === 1 ? [19, 30] : null),
  bulls: (md, dow, doy) => ((md <= '04-12' || md >= '10-20') && doy % 3 === 0 ? [19, 0] : null),
  blackhawks: (md, dow, doy) => ((md <= '04-12' || md >= '10-20') && doy % 3 === 1 ? [19, 30] : null),
  sky: (md, dow, doy) => (within(md, '05-15', '09-15') && (dow === 2 || dow === 5) && Math.floor(doy / 7) % 2 === 0 ? [19, 0] : null),
}

export function simulatedGames(year) {
  const games = []
  let date = `${year}-01-01`
  for (let doy = 0; date.startsWith(`${year}-`); doy++, date = addDays(date, 1)) {
    const md = date.slice(5), dow = weekday(date)
    for (const t of TEAMS) {
      const hm = RULES[t.key](md, dow, doy)
      if (!hm) continue
      const id = `sim-${t.key}-${date}`
      const opp = OPP[t.league][Math.floor(hashFrac(id) * OPP[t.league].length)]
      const [lo, hi] = RANGE[t.league]
      let us = lo + Math.floor(hashFrac(`${id}:h`) * (hi - lo + 1))
      const them = lo + Math.floor(hashFrac(`${id}:a`) * (hi - lo + 1))
      if (us === them && t.sport !== 'soccer') us += 1
      games.push({
        id, teams: [t.key], results: { [t.key]: us > them ? 'W' : us < them ? 'L' : 'T' }, sport: t.sport, league: t.league,
        start: new Date(chicagoToUtc(date, hm[0], hm[1])).toISOString(), venue: t.home, venueName: '',
        status: 'STATUS_SCHEDULED', state: 'pre', detail: '',
        home: { abbr: t.abbr, name: t.full, score: us, winner: us > them }, away: { abbr: opp, name: opp, score: them, winner: them > us },
        chicagoHome: true, attendance: null, simulated: true,
      })
    }
  }
  return games
}
```

- [ ] **Step 4: Run the test to verify it passes.**
Run: `cd app && npx vitest run src/sports/__tests__/simSchedule.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit.**

```bash
git add app/src/sports/simSchedule.js app/src/sports/__tests__/simSchedule.test.js
git commit -m "feat(sports): deterministic simulated home calendar for all seven teams (D7 fallback)"
```

---

### Task 11: Façade shader — field texture array, per-venue light level, lit fascia and colonnade uplight

**Files:**
- Modify: `app/src/world/materials/facadeMaterial.js`
- Test: `app/src/world/materials/__tests__/facadeMaterial.test.js`

**Interfaces:**
- Consumes: façade 24 plus the `fieldSeed(slot)` seed (Task 4); the field uv in frame metres; `FIELD_EXTENT`.
- Produces:
  - `facadeUniforms.uFieldTex` (a `DataArrayTexture`, sRGB; the default is 1×1×8 turf green);
  - `facadeUniforms.uFieldFrame` (`Vector4[8]` = `(u0, v1, 1/(u1−u0), 1/(v1−v0))`; zero = unpainted);
  - `facadeUniforms.uVenueLight` (`Vector4[8]` = `(x, z, radius, level)`; zero radius = unregistered);
  - `setFieldFrames(entries: { slot, frame }[])`;
  - `setVenueLights(entries: { slot, center:[x,z], radius, level }[])`. Both reset every slot first.
  - GLSL `venueLevel(vec2 p) → float`: −1 outside every registered venue; else the level.
  - Legacy venue light terms use `lvL = lv < 0 ? 1 : lv`, so the look is unchanged until the sports clock runs. Architectural light (the arena fascia, glass concourses, limestone uplight) uses `lvA = max(lv, 0)`, so only registered venues glow.
  - Texel mapping: `s = (u − u0)/(u1 − u0)`, `t = (v1 − v)/(v1 − v0)`. Row 0 of each layer is the frame's `v1` edge, which is canvas row 0.
  - `customProgramCacheKey` becomes `'facade-v8'`.

- [ ] **Step 1: Write the failing tests.** Append to `app/src/world/materials/__tests__/facadeMaterial.test.js`:

```js
import { setFieldFrames, setVenueLights } from '../facadeMaterial.js'

describe('venue uniforms (V5)', () => {
  it('samples the painted field layer and gates venue light by position', () => {
    const s = patchFacadeShader(std())
    expect(s.fragmentShader).toContain('uniform sampler2DArray uFieldTex;')
    expect(s.fragmentShader).toContain('float venueLevel(vec2 p)')
    expect(s.fragmentShader).toContain('textureGrad(uFieldTex')
    for (const u of ['uFieldTex', 'uFieldFrame', 'uVenueLight']) expect(s.uniforms[u]).toBe(facadeUniforms[u])
  })
  it('setFieldFrames packs (u0, v1, 1/width, 1/height) per slot and clears the rest', () => {
    setFieldFrames([{ slot: 1, frame: { u0: -24, u1: 132, v0: -96, v1: 96 } }])
    const v = facadeUniforms.uFieldFrame.value
    expect([v[1].x, v[1].y, v[1].z, v[1].w]).toEqual([-24, 96, 1 / 156, 1 / 192])
    expect(v[0].z).toBe(0)
    setFieldFrames([])
    expect(v[1].z).toBe(0)
  })
  it('setVenueLights registers (x, z, radius, level) per slot and clears the rest', () => {
    setVenueLights([{ slot: 3, center: [-3842, 147], radius: 130, level: 0.5 }])
    const v = facadeUniforms.uVenueLight.value
    expect([v[3].x, v[3].y, v[3].z, v[3].w]).toEqual([-3842, 147, 130, 0.2])
    setVenueLights([])
    expect(v[3].z).toBe(0)
  })
  it('keeps derivatives out of branches (the uv gradient is taken before the venue branch)', () => {
    const f = patchFacadeShader(std()).fragmentShader
    const body = f.slice(f.indexOf('void main()'))
    expect(body.indexOf('vec4 uvGrad = vec4(dFdx(vMUv), dFdy(vMUv));')).toBeGreaterThan(0)
    expect(body.indexOf('vec4 uvGrad')).toBeLessThan(body.indexOf('if (isVenue)'))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.**
Run: `cd app && npx vitest run src/world/materials/__tests__/facadeMaterial.test.js`
Expected: FAIL — `does not provide an export named 'setFieldFrames'`

- [ ] **Step 3: Implement.** In `app/src/world/materials/facadeMaterial.js`:

Above `facadeUniforms`, add:

```js
const FIELD_LAYERS = 8
const turfArray = () => {
  const d = new Uint8Array(4 * FIELD_LAYERS)
  for (let i = 0; i < FIELD_LAYERS; i++) d.set([74, 132, 52, 255], i * 4)
  const t = new THREE.DataArrayTexture(d, 1, 1, FIELD_LAYERS); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t
}
const vec4s = () => Array.from({ length: FIELD_LAYERS }, () => new THREE.Vector4(0, 0, 0, 0))
```

Inside the `facadeUniforms` object, add:

```js
  uFieldTex: { value: turfArray() },
  uFieldFrame: { value: vec4s() },
  uVenueLight: { value: vec4s() },
```

Below the object, add:

```js
// Painted fields (V5): layer `slot` of uFieldTex covers the frame u0…u1 × v0…v1 (metres).
export function setFieldFrames(entries) {
  for (const v of facadeUniforms.uFieldFrame.value) v.set(0, 0, 0, 0)
  for (const { slot, frame: f } of entries) facadeUniforms.uFieldFrame.value[slot].set(f.u0, f.v1, 1 / (f.u1 - f.u0), 1 / (f.v1 - f.v0))
}
// Per-venue light level (game state): inside radius of a registered venue the floodlights, field glow and
// fascia use `level`; elsewhere venue surfaces keep their legacy always-lit look.
export function setVenueLights(entries) {
  for (const v of facadeUniforms.uVenueLight.value) v.set(0, 0, 0, 0)
  for (const e of entries) facadeUniforms.uVenueLight.value[e.slot].set(e.center[0], e.center[1], e.radius, e.level)
}
```

In `FRAG_HEAD`, after `varying vec2 vMUv;`, add:

```glsl
uniform sampler2DArray uFieldTex;
uniform vec4 uFieldFrame[8];
uniform vec4 uVenueLight[8];
// −1 outside every registered venue (legacy look), else that venue's light level 0…1 (set by the sports clock).
float venueLevel(vec2 p) {
  for (int i = 0; i < 8; i++) { vec4 v = uVenueLight[i]; if (v.z > 0.0 && distance(p, v.xy) < v.z) return v.w; }
  return -1.0;
}
```

Change the `venueAlbedo` signature to end with `…, float fwRow, float fwAisle, vec4 uvGrad) {`. Replace the interim `if (vi == 24) …` line from Task 4 with:

```glsl
  if (vi == 24) {   // painted field: layer `slot` of the canvas-painted texture array, in field-frame metres
    int slot = clamp(int(s * 8.0), 0, 7);
    vec4 fr = uFieldFrame[slot];
    if (fr.z <= 0.0) return mix(vec3(0.16, 0.38, 0.12), vec3(0.2, 0.45, 0.15), 0.5) * (0.9 + 0.2 * grain.g);
    vec2 sc = vec2(fr.z, -fr.w);
    vec2 st = clamp(vec2((uv.x - fr.x) * fr.z, (fr.y - uv.y) * fr.w), 0.0, 1.0);
    return textureGrad(uFieldTex, vec3(st, float(slot)), uvGrad.xy * sc, uvGrad.zw * sc).rgb * (0.94 + 0.12 * grain.g);
  }
```

In `FRAG_MAP`:
- replace `float fwRow = fwidth(vWPos.y / 0.42), fwAisle = fwidth(vMUv.x / 17.0) * 17.0;   // before any branch` with:

```glsl
float fwRow = fwidth(vWPos.y / 0.42), fwAisle = fwidth(vMUv.x / 17.0) * 17.0;   // before any branch
vec4 uvGrad = vec4(dFdx(vMUv), dFdy(vMUv));
```

- change the `venueAlbedo(…)` call to pass `, uvGrad` as the last argument.

In `FRAG_EMISSIVE`, replace the first four lines of the venue block — from `if (isVenue && uNight > 0.001) {` through the `vi == 9 || vi == 18` line — with:

```glsl
float lv = venueLevel(vWPos.xz);
float lvL = lv < 0.0 ? 1.0 : lv;   // legacy venue light, until the sports clock registers the venue
float lvA = max(lv, 0.0);          // architectural light: registered venues only
if (isVenue && uNight > 0.001) {
  if (vi == 14) totalEmissiveRadiance += vec3(1.0, 0.96, 0.88) * 3.2 * uNight * uLitBoost * lvL;
  // under the floodlights: the field and stands glow as if lit for a night game
  if ((vi >= 10 && vi <= 12) || vi == 24) totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.98, 0.92) * 0.85 * uNight * lvL;
  if (vi == 9 || vi == 18) totalEmissiveRadiance += diffuseColor.rgb * 0.35 * uNight * (0.3 + 0.7 * lvL);
  if (vi == 16 && vWNormal.y < 0.6 && lvA > 0.0) {
    float y = vWPos.y;
    if (vSeed >= 0.575) {            // arena fascia (D14): uplit brick podium, cream band, glowing glass ribbon
      float mull = step(fract(vMUv.x / 2.4), 0.06);
      vec3 glow = y < 11.0 ? diffuseColor.rgb * vec3(1.0, 0.82, 0.6) * 1.1 : y < 13.0 ? diffuseColor.rgb * 0.6 : vec3(1.0, 0.86, 0.62) * 0.55 * (1.0 - mull);
      totalEmissiveRadiance += glow * lvA * uNight * uLitBoost;
    } else if (vSeed >= 0.275 && vSeed < 0.425) {   // glass and steel: lit concourse glass (Wintrust, Soldier Field risers)
      float band = step(fract(y / 4.5), 0.28), mull = step(fract(vMUv.x / 2.0), 0.05);
      totalEmissiveRadiance += vec3(1.0, 0.9, 0.72) * 0.45 * (1.0 - band) * (1.0 - mull) * lvA * uNight * uLitBoost;
    } else if (vSeed >= 0.125 && vSeed < 0.275) {   // limestone colonnade uplight (D4), strongest at the base
      totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.9, 0.74) * 0.7 * (1.0 - 0.6 * smoothstep(0.0, 22.0, y)) * lvA * uNight;
    }
  }
```

Leave the rest of that block unchanged. In `createFacadeMaterial`, change the cache key to `'facade-v8'`.

- [ ] **Step 4: Run the tests to verify they pass.**
Run: `cd app && npx vitest run src/world/materials/__tests__/`
Expected: PASS, including the existing `takes screen-space derivatives only in uniform control flow` test

- [ ] **Step 5: Commit.** Nothing visible changes yet: no venue is registered and every frame is unpainted. The visuals are evaluated in Tasks 12 and 13.

```bash
git add app/src/world/materials/facadeMaterial.js app/src/world/materials/__tests__/facadeMaterial.test.js
git commit -m "feat(shader): painted-field texture array and per-venue light level; lit arena fascia and colonnade uplight (D3, D4, D14)"
```

---

### Task 12: Venue states, the sports store and the sports clock (D6, D7)

**Files:**
- Create: `app/src/sports/venueStates.js`, `app/src/sports/sportsStore.js`, `app/src/sports/SportsClock.jsx`
- Modify: `app/src/state/store.js` (add `gamesOpen`, `setGamesOpen`; this is the V7 contract)
- Modify: `app/src/world/Scene.jsx` (mount `<SportsClock />`)
- Modify: `app/e2e/hero-view.spec.js` (pin `&sports=idle`, so baselines never depend on the calendar)
- Test: `app/src/sports/__tests__/venueStates.test.js`, `app/src/sports/__tests__/sportsStore.test.js`, `app/src/state/__tests__/store.test.js`

**Interfaces:**
- Consumes:
  - `gameState`, `nextGame`, `gameWindow`, `SPORT_MINUTES` (Task 9);
  - `simulatedGames` (Task 10);
  - `setVenueLights` (Task 11);
  - `teamByKey`;
  - the `venues.json` records (Task 7).
- Produces:
  - `VenueState = { state, game, winDay, lossDay, next }`;
  - `computeStates(venues, nowMs, games) → Record<venueKey, VenueState>`;
  - `parseOverride(q) → { mode, team } | null`: test-only, for `?sports=idle|pregame|live|postgame|win|loss[:teamKey]`;
  - `overrideStates(venues, override, nowMs) → Record<venueKey, VenueState>`, with synthetic simulated games;
  - `LIGHT = { idle: 0.5, pregame: 1, live: 1, postgame: 0.7 }` and `lightLevel(state) → number`;
  - `STALE_DAYS = 45` and `isStale(generatedAt, nowMs) → boolean`;
  - `useSports`, a zustand store:
    - `{ games, source: 'LIVE'|'SIMULATED', generatedAt, venues, states, override, cardVenue, boardOverrides, swells }`;
    - setters `setData(obj)`, `setVenues(v)`, `setStates(s)`, `setOverride(o)`, `openCard(key|null)`, `setBoardOverride(key, lines|null)`, `pushSwell(key, strength)`;
  - `loadSchedule(fetchImpl=fetch, nowMs=Date.now()) → Promise<{ games, source, generatedAt }>` (never throws);
  - `loadVenues(fetchImpl=fetch) → Promise<VenueRecord[]>` (never throws);
  - `useStore` gains `gamesOpen: false` and `setGamesOpen(bool)`.

- [ ] **Step 1: Write the failing tests.** Create `app/src/sports/__tests__/venueStates.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { computeStates, overrideStates, parseOverride, lightLevel, isStale } from '../venueStates.js'

const V = [
  { key: 'wrigleyfield', slot: 1, kind: 'baseball', teams: ['cubs'], center: [-2292, -7339], radius: 180 },
  { key: 'unitedcenter', slot: 3, kind: 'arena', teams: ['bulls', 'blackhawks'], center: [-3842, 147], radius: 130 },
  { key: 'soldierfield', slot: 0, kind: 'football', teams: ['bears', 'fire'], center: [928, 2187], radius: 220 },
]
const T = (iso) => Date.parse(iso)

describe('venue states', () => {
  it('computes every venue, with its next game', () => {
    const g = { id: 'a', teams: ['cubs'], results: {}, sport: 'baseball', venue: 'wrigleyfield', start: '2026-07-10T00:05:00Z', status: 'STATUS_SCHEDULED' }
    const s = computeStates(V, T('2026-07-09T12:00:00Z'), [g])
    expect(Object.keys(s)).toEqual(['wrigleyfield', 'unitedcenter', 'soldierfield'])
    expect(s.wrigleyfield).toMatchObject({ state: 'idle', next: g })
    expect(computeStates(V, T('2026-07-10T01:00:00Z'), [g]).wrigleyfield.state).toBe('live')
  })
  it('parses the test-only ?sports= override', () => {
    expect(parseOverride('live')).toEqual({ mode: 'live', team: null })
    expect(parseOverride('live:fire')).toEqual({ mode: 'live', team: 'fire' })
    expect(parseOverride('party')).toBeNull()
    expect(parseOverride(null)).toBeNull()
  })
  it('override puts every venue in one state with a synthetic simulated game', () => {
    const now = T('2026-09-28T17:00:00Z')
    const live = overrideStates(V, { mode: 'live', team: null }, now)
    expect(live.wrigleyfield).toMatchObject({ state: 'live', winDay: false })
    expect(live.wrigleyfield.game).toMatchObject({ teams: ['cubs'], sport: 'baseball', venue: 'wrigleyfield', simulated: true })
    expect(live.unitedcenter.game.sport).toBe('basketball')
    expect(overrideStates(V, { mode: 'live', team: 'fire' }, now).soldierfield.game).toMatchObject({ teams: ['fire'], sport: 'soccer' })
    expect(overrideStates(V, { mode: 'win', team: null }, now).wrigleyfield).toMatchObject({ state: 'postgame', winDay: true, lossDay: false })
    expect(overrideStates(V, { mode: 'loss', team: null }, now).wrigleyfield).toMatchObject({ state: 'postgame', winDay: false, lossDay: true })
    expect(overrideStates(V, { mode: 'idle', team: null }, now).wrigleyfield).toMatchObject({ state: 'idle', game: null })
  })
  it('light levels: dim when idle, full for the game, easing after', () => {
    expect(lightLevel('idle')).toBe(0.5); expect(lightLevel('live')).toBe(1); expect(lightLevel('pregame')).toBe(1); expect(lightLevel('postgame')).toBe(0.7)
    expect(lightLevel(undefined)).toBe(0.5)
  })
  it('a schedule older than 45 days, or undated, is stale', () => {
    const now = T('2026-09-29T12:00:00Z')
    expect(isStale('2026-09-20T00:00:00Z', now)).toBe(false)
    expect(isStale('2026-08-01T00:00:00Z', now)).toBe(true)
    expect(isStale(undefined, now)).toBe(true)
  })
})
```

Create `app/src/sports/__tests__/sportsStore.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { loadSchedule, loadVenues, useSports } from '../sportsStore.js'

const now = Date.parse('2026-09-29T12:00:00Z')
const ok = (body) => async () => ({ ok: true, json: async () => body })
const game = { id: '1', teams: ['cubs'], results: {}, sport: 'baseball', venue: 'wrigleyfield', start: '2026-09-30T00:05:00Z' }

describe('loadSchedule', () => {
  it('uses fresh ESPN data as LIVE', async () => {
    const r = await loadSchedule(ok({ generatedAt: '2026-09-28T00:00:00Z', games: [game] }), now)
    expect(r).toMatchObject({ source: 'LIVE', generatedAt: '2026-09-28T00:00:00Z' })
    expect(r.games).toEqual([game])
  })
  it('falls back to the simulated calendar on 404, bad JSON, empty or stale data', async () => {
    const cases = [
      async () => ({ ok: false, status: 404 }),
      async () => ({ ok: true, json: async () => { throw new SyntaxError('Unexpected token <') } }),
      async () => { throw new TypeError('Failed to fetch') },
      ok({ generatedAt: '2026-09-28T00:00:00Z', games: [] }),
      ok({ generatedAt: '2026-06-01T00:00:00Z', games: [game] }),
      ok(null),
    ]
    for (const f of cases) {
      const r = await loadSchedule(f, now)
      expect(r.source).toBe('SIMULATED')
      expect(r.games.length).toBeGreaterThan(300)
      expect(r.games.every((g) => g.simulated)).toBe(true)
    }
  })
})

describe('loadVenues', () => {
  it('returns the venues, or [] on any failure', async () => {
    expect(await loadVenues(ok({ version: 1, venues: [{ key: 'wrigleyfield' }] }))).toEqual([{ key: 'wrigleyfield' }])
    expect(await loadVenues(async () => ({ ok: false }))).toEqual([])
    expect(await loadVenues(async () => { throw new Error('x') })).toEqual([])
  })
})

describe('useSports', () => {
  it('starts simulated and empty, with no card open', () => {
    expect(useSports.getInitialState()).toMatchObject({ source: 'SIMULATED', games: [], venues: [], cardVenue: null })
  })
})
```

Append to `app/src/state/__tests__/store.test.js`:

```js
describe('games panel flag (V7 contract)', () => {
  it('gamesOpen starts false and setGamesOpen toggles it', () => {
    useStore.setState(useStore.getInitialState())
    expect(useStore.getState().gamesOpen).toBe(false)
    useStore.getState().setGamesOpen(true)
    expect(useStore.getState().gamesOpen).toBe(true)
  })
})
```

(If `useStore` is not yet imported in that file, add `import { useStore } from '../store.js'`.)

- [ ] **Step 2: Run the tests to verify they fail.**
Run: `cd app && npx vitest run src/sports/__tests__/venueStates.test.js src/sports/__tests__/sportsStore.test.js src/state/__tests__/store.test.js`
Expected: FAIL — `Failed to load url ../venueStates.js`, and `expected undefined to be false`

- [ ] **Step 3: Implement.** Create `app/src/sports/venueStates.js`:

```js
// app/src/sports/venueStates.js — every venue's state now; the test-only override; light levels; staleness.
import { gameState, nextGame, SPORT_MINUTES } from './gameState.js'
import { teamByKey } from '../../../shared/teams.js'

export function computeStates(venues, nowMs, games) {
  const out = {}
  for (const v of venues) out[v.key] = { ...gameState(v.key, nowMs, games), next: nextGame(v.key, nowMs, games) }
  return out
}

export const LIGHT = { idle: 0.5, pregame: 1, live: 1, postgame: 0.7 }
export const lightLevel = (state) => LIGHT[state] ?? LIGHT.idle

export const STALE_DAYS = 45
export function isStale(generatedAt, nowMs) {
  const t = Date.parse(generatedAt ?? '')
  return !Number.isFinite(t) || nowMs - t > STALE_DAYS * 86400000
}

const MODES = ['idle', 'pregame', 'live', 'postgame', 'win', 'loss']
// Test-only: ?sports=<mode>[:<teamKey>] (screenshots, e2e). People never need it.
export function parseOverride(q) {
  if (!q) return null
  const [mode, team = null] = String(q).split(':')
  return MODES.includes(mode) ? { mode, team } : null
}

export function overrideStates(venues, { mode, team }, nowMs) {
  const out = {}
  for (const v of venues) {
    if (mode === 'idle') { out[v.key] = { state: 'idle', game: null, winDay: false, lossDay: false, next: null }; continue }
    const t = teamByKey(team && v.teams.includes(team) ? team : v.teams[0])
    const dur = SPORT_MINUTES[t.sport] * 60000
    const start = mode === 'live' ? nowMs - 0.45 * dur : mode === 'pregame' ? nowMs + 3600000 : nowMs - dur - 1200000
    const won = mode !== 'loss'
    const [us, them] = t.sport === 'basketball' ? (won ? [104, 97] : [95, 108]) : t.sport === 'football' ? (won ? [24, 17] : [13, 27]) : won ? [5, 3] : [2, 6]
    const game = {
      id: `override-${v.key}`, teams: [t.key], results: { [t.key]: won ? 'W' : 'L' }, sport: t.sport, league: t.league,
      start: new Date(start).toISOString(), venue: v.key, venueName: v.name ?? '', status: 'STATUS_SCHEDULED', state: 'pre', detail: '',
      home: { abbr: t.abbr, name: t.full, score: us, winner: won }, away: { abbr: 'VIS', name: 'Visitors', score: them, winner: !won },
      chicagoHome: true, attendance: null, simulated: true,
    }
    const state = mode === 'win' || mode === 'loss' ? 'postgame' : mode
    const cubsDay = v.teams.includes('cubs') || mode === 'win' || mode === 'loss'
    out[v.key] = { state, game, winDay: mode === 'win' && cubsDay, lossDay: mode === 'loss' && cubsDay, next: null }
  }
  return out
}
```

Create `app/src/sports/sportsStore.js`:

```js
// app/src/sports/sportsStore.js — schedule, venues and per-venue states; loaders that never throw.
import { create } from 'zustand'
import { simulatedGames } from './simSchedule.js'
import { chicagoParts } from './chicagoTime.js'
import { isStale } from './venueStates.js'

export const useSports = create((set) => ({
  games: [], source: 'SIMULATED', generatedAt: null, venues: [], states: {}, override: null,
  cardVenue: null, boardOverrides: {}, swells: {},
  setData: (d) => set(d),
  setVenues: (venues) => set({ venues }),
  setStates: (states) => set({ states }),
  setOverride: (override) => set({ override }),
  openCard: (cardVenue) => set({ cardVenue }),
  setBoardOverride: (key, lines) => set((s) => ({ boardOverrides: { ...s.boardOverrides, [key]: lines } })),
  pushSwell: (key, strength = 1) => set((s) => ({ swells: { ...s.swells, [key]: { at: Date.now(), strength } } })),
}))

function simulated(nowMs) {
  const y = chicagoParts(nowMs).year
  return { games: [...simulatedGames(y - 1), ...simulatedGames(y), ...simulatedGames(y + 1)], source: 'SIMULATED', generatedAt: null }
}

// The ESPN schedule built with the world (LIVE provenance) when present and fresh; otherwise the simulated calendar.
export async function loadSchedule(fetchImpl = fetch, nowMs = Date.now()) {
  try {
    const r = await fetchImpl('/world/schedules.json')
    if (!r.ok) return simulated(nowMs)
    const j = await r.json()
    if (!Array.isArray(j?.games) || !j.games.length || isStale(j.generatedAt, nowMs)) return simulated(nowMs)
    return { games: j.games, source: 'LIVE', generatedAt: j.generatedAt }
  } catch {
    return simulated(nowMs)
  }
}

export async function loadVenues(fetchImpl = fetch) {
  try {
    const r = await fetchImpl('/world/venues.json')
    if (!r.ok) return []
    const j = await r.json()
    return Array.isArray(j?.venues) ? j.venues : []
  } catch {
    return []
  }
}
```

Create `app/src/sports/SportsClock.jsx`:

```jsx
// app/src/sports/SportsClock.jsx — loads the schedule and venues, recomputes every venue's state every 15 s,
// and hands each venue's light level to the façade shader.
import { useEffect } from 'react'
import { useSports, loadSchedule, loadVenues } from './sportsStore.js'
import { computeStates, overrideStates, parseOverride, lightLevel } from './venueStates.js'
import { setVenueLights } from '../world/materials/facadeMaterial.js'

export function tick(nowMs = Date.now()) {
  const s = useSports.getState()
  const states = s.override ? overrideStates(s.venues, s.override, nowMs) : computeStates(s.venues, nowMs, s.games)
  s.setStates(states)
  setVenueLights(s.venues.map((v) => ({ slot: v.slot, center: v.center, radius: v.radius, level: lightLevel(states[v.key]?.state) })))
}

export default function SportsClock() {
  useEffect(() => {
    let alive = true
    const params = new URLSearchParams(window.location.search)
    useSports.getState().setOverride(parseOverride(params.get('sports'))) // test-only
    if (params.has('stats')) window.__sports = useSports
    Promise.all([loadSchedule(), loadVenues()]).then(([sched, venues]) => {
      if (!alive) return
      useSports.getState().setData(sched)
      useSports.getState().setVenues(venues)
      tick()
    })
    const id = setInterval(() => tick(), 15000)
    return () => { alive = false; clearInterval(id) }
  }, [])
  return null
}
```

In `app/src/state/store.js`, after `setHelpOpen`, add:

```js
  gamesOpen: false,
  setGamesOpen: (gamesOpen) => set({ gamesOpen }),
```

In `app/src/world/Scene.jsx`, import `SportsClock from '../sports/SportsClock.jsx'` and render `<SportsClock />` after `<PerfWatch />`.

In `app/e2e/hero-view.spec.js`, change `await page.goto(\`/?view=${view}&time=${time}\`)` to `await page.goto(\`/?view=${view}&time=${time}&sports=idle\`)`.

- [ ] **Step 4: Run the tests to verify they pass.**
Run: `cd app && npx vitest run src/sports/__tests__/ src/state/__tests__/`
Expected: PASS

- [ ] **Step 5: Commit.**

```bash
git add app/src/sports/venueStates.js app/src/sports/sportsStore.js app/src/sports/SportsClock.jsx app/src/sports/__tests__/venueStates.test.js app/src/sports/__tests__/sportsStore.test.js app/src/state/store.js app/src/state/__tests__/store.test.js app/src/world/Scene.jsx app/e2e/hero-view.spec.js
git commit -m "feat(sports): venue states every 15 s, simulated fallback, venue light levels, gamesOpen flag (D6, D7)"
```

- [ ] **Step 6: Capture and evaluate the night game-state lighting (D4, D5, D6, D14).**
Run: `cd app && V5_CAPTURE=1 V5_TAG=after-state V5_ONLY=soldier-aerial,soldier-aerial-game,wrigley-aerial,wrigley-aerial-game,rate-aerial-game,rate-from-loop,uc-aerial,uc-aerial-game,wintrust-aerial,wintrust-aerial-game npx playwright test e2e/v5-capture.spec.js`
Expected: `20 passed`

Compare each `…-night` idle shot with its `…-game` shot, and both with `after-lights/` and `pre-fields/`.
- **Keep** if all four hold:
  - game nights are unmistakably lit: lamps, field, stands, Soldier Field's colonnade uplight, and the arena fascia glowing warm, with Wintrust's glass bands lit;
  - idle nights show the venue dim but readable (the field faintly visible, lamps dark);
  - `rate-from-loop-night` still shows Rate Field lit;
  - day and dusk shots are unchanged.
- **If the arena fascia or colonnade glow looks garish** (a flat orange slab, or bloom halos wider than the building), halve the relevant coefficient (1.1 → 0.55; 0.45 → 0.25; 0.7 → 0.35) in a commit `fix(shader): soften venue glow`, and re-capture.
- **If it is still unpleasing**, revert Task 11's fascia and uplight lines with `git revert` of that commit, then re-apply the field-texture half in a new commit.

Record `Keep`/`Revert` lines for D4, D5, D6 and D14 in the ledger, then commit:

```bash
git add docs/superpowers/ledgers/v5-stadiums-sports-life.md && git commit -m "docs(v5): ledger — game-state lighting evaluated"
```

---

### Task 13: Painted fields — marks, painter, texture array (D3)

**Files:**
- Create: `app/src/sports/fieldMarks.js`, `app/src/sports/paintField.js`, `app/src/sports/fieldTexture.js`, `app/src/sports/FieldTextures.jsx`
- Create: `app/src/sports/SportsLife.jsx` (for now it mounts `FieldTextures`; later tasks add the per-venue life)
- Modify: `app/src/world/Scene.jsx` (mount `<SportsLife />`)
- Test: `app/src/sports/__tests__/fieldMarks.test.js`, `app/src/sports/__tests__/paintField.test.js`, `app/src/sports/__tests__/fieldTexture.test.js`

**Interfaces:**
- Consumes: `venue.frame` (Task 7); `setFieldFrames`, `facadeUniforms.uFieldTex` (Task 11); `useSports` (Task 12); `useStore.quality`.
- Produces:
  - `FIELD_COLORS`;
  - `fieldMarks(layout: 'football'|'soccer'|'baseball-wrigley'|'baseball-sox', frame) → Op[]`, where `Op` is one of:
    - `{op:'fill', color}`;
    - `{op:'poly', pts, color}`;
    - `{op:'line', pts, width, color, closed?}`;
    - `{op:'text', text, at, size, angle, color, stroke?, strokeWidth?, maxWidth?}`;
    - `{op:'clip', pts}` / `{op:'unclip'}`.
    All coordinates are frame metres. `angle` is the reading direction in radians from +u toward +v.
  - `MIN_LINE_PX = 1.5`;
  - `toPx(frame, W, H, [u, v]) → [x, y]`;
  - `paintField(ctx, ops, frame, W, H)`;
  - `FIELD_TEX = { LOW:[1024,512], HIGH:[2048,1024], ULTRA:[2048,1024] }`;
  - `layoutFor(venueKey, sport) → layout`;
  - `fieldSport(venueState, nowMs) → sport|null`: the current game's sport, or the next game's if it starts within 36 h;
  - `buildFieldArray(entries: {slot, frame, layout}[], quality, makeCanvas?) → THREE.DataArrayTexture`.
- Dimensions:
  - NFL Rule 1:
    - the field is 120 × 53⅓ yd;
    - lines are 4 in wide, and the goal line 8 in;
    - hash marks are 70 ft 9 in from each sideline;
    - numbers are 6 ft tall, with their tops 9 yd from the sideline;
    - the border is 6 ft.
  - IFAB Law 1 (Soldier Field for the Fire):
    - the pitch is 105 × 68 m;
    - the circle radius is 9.15 m;
    - the penalty area is 16.5 × 40.32 m;
    - the goal area is 5.5 × 18.32 m;
    - the penalty spot is 11 m from goal.
  - MLB Rules 2.01–2.03:
    - bases are 90 ft apart (27.432 m) and 15 in square;
    - the mound is 60 ft 6 in from home (18.44 m), 18 ft across;
    - the home circle is 26 ft across;
    - the grass arc is 95 ft from the mound;
    - the batter's box is 4 × 6 ft, 6 in from the plate;
    - the catcher's box is 43 in × 8 ft;
    - on-deck circles are 5 ft across;
    - the warning track is 15 ft (4.6 m).

- [ ] **Step 1: Write the failing tests.** Create `app/src/sports/__tests__/fieldMarks.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { fieldMarks, FIELD_COLORS as C } from '../fieldMarks.js'

const FB = { u0: -75, u1: 75, v0: -37.5, v1: 37.5, ring: [], origin: [0, 0], axis: [0, -1] }
const sq = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]
const BB = { u0: -24, u1: 132, v0: -96, v1: 96, origin: [0, 0], axis: [0.707, -0.707], ring: sq(-18, -85, 122, 85), grassRing: sq(-13, -80, 117, 80) }
const pts = (ops) => ops.flatMap((o) => o.pts ?? (o.at ? [o.at] : []))
const texts = (ops) => ops.filter((o) => o.op === 'text')

describe('fieldMarks', () => {
  it('football: 21 yard lines sideline to sideline, navy end zones, BEARS north and CHICAGO south', () => {
    const ops = fieldMarks('football', FB)
    const yard = ops.filter((o) => o.op === 'line' && o.pts.length === 2 && o.pts[0][0] === o.pts[1][0] && Math.abs(o.pts[0][1] - o.pts[1][1]) > 40)
    expect(yard).toHaveLength(21)
    expect(yard.filter((o) => o.width > 0.2)).toHaveLength(2) // goal lines are 8 in
    const zones = ops.filter((o) => o.op === 'poly' && o.color === C.bearsNavy)
    expect(zones).toHaveLength(2)
    expect(Math.max(...zones.flatMap((z) => z.pts.map((p) => Math.abs(p[0]))))).toBeCloseTo(54.864, 2)
    const bears = texts(ops).find((t) => t.text === 'BEARS'), chicago = texts(ops).find((t) => t.text === 'CHICAGO')
    expect(bears.at[0]).toBeGreaterThan(45.7); expect(bears.angle).toBeCloseTo(-Math.PI / 2)
    expect(chicago.at[0]).toBeLessThan(-45.7); expect(chicago.angle).toBeCloseTo(Math.PI / 2)
    expect(bears.stroke).toBe(C.bearsOrange)
  })
  it('football: 18 yard numbers, 6 ft tall, centred 10 yd in from each sideline, reading toward the sideline', () => {
    const nums = texts(fieldMarks('football', FB)).filter((t) => /^\d0$/.test(t.text))
    expect(nums).toHaveLength(18)
    expect(nums.filter((t) => t.text === '50')).toHaveLength(2)
    for (const n of nums) { expect(n.size).toBeCloseTo(1.8288, 4); expect(Math.abs(n.at[1])).toBeCloseTo(15.24, 2); expect(n.angle).toBeCloseTo(n.at[1] > 0 ? 0 : Math.PI) }
  })
  it('football: a midfield C in Bears orange', () => {
    const c = fieldMarks('football', FB).filter((o) => o.op === 'poly' && o.color === C.bearsOrange)
    expect(c).toHaveLength(1)
    for (const [u, v] of c[0].pts) expect(Math.hypot(u, v)).toBeLessThan(4.7)
  })
  it('soccer: 105 × 68 m touchlines, a 9.15 m centre circle', () => {
    const ops = fieldMarks('soccer', FB)
    const lines = ops.filter((o) => o.op === 'line')
    const outer = lines.find((o) => o.closed && Math.max(...o.pts.map((p) => p[0])) === 52.5)
    expect(Math.max(...outer.pts.map((p) => p[1]))).toBe(34)
    const circle = lines.find((o) => o.closed && o.pts.every((p) => Math.abs(Math.hypot(p[0], p[1]) - 9.15) < 1e-9))
    expect(circle).toBeTruthy()
  })
  it('baseball: the mound, bases and foul lines at MLB distances', () => {
    const ops = fieldMarks('baseball-wrigley', BB)
    const mound = ops.find((o) => o.part === 'mound')
    const mc = mound.pts.reduce((s, p) => [s[0] + p[0] / mound.pts.length, s[1] + p[1] / mound.pts.length], [0, 0])
    expect(mc[0]).toBeCloseTo(18.44, 1); expect(mc[1]).toBeCloseTo(0, 1)
    const bases = ops.filter((o) => o.part === 'base').map((o) => o.pts.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]))
    expect(bases).toHaveLength(3)
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05
    expect(bases.some((b) => near(b, [19.397, -19.397]))).toBe(true) // first base, right-field side
    expect(bases.some((b) => near(b, [38.795, 0]))).toBe(true)
    expect(bases.some((b) => near(b, [19.397, 19.397]))).toBe(true)
    const foul = ops.filter((o) => o.part === 'foul')
    expect(foul).toHaveLength(2)
    for (const f of foul) expect(Math.abs(Math.atan2(f.pts[1][1], f.pts[1][0]))).toBeCloseTo(Math.PI / 4, 3)
  })
  it('Wrigley on-deck circles are Cubs blue; Rate Field is black and silver, with SOX behind the plate', () => {
    expect(fieldMarks('baseball-wrigley', BB).filter((o) => o.part === 'ondeck').map((o) => o.color)).toEqual([C.cubsBlue, C.cubsBlue])
    const sox = fieldMarks('baseball-sox', BB)
    expect(sox.filter((o) => o.part === 'ondeck').map((o) => o.color)).toEqual([C.soxBlack, C.soxBlack])
    const t = texts(sox).find((x) => x.text === 'SOX')
    expect(t).toMatchObject({ color: C.soxBlack, stroke: C.soxSilver })
    expect(t.at[0]).toBeLessThan(-5)
  })
  it('every placed mark and every word lies inside its frame (mowing patterns are clipped, so they may overhang)', () => {
    for (const [layout, f] of [['football', FB], ['soccer', FB], ['baseball-wrigley', BB], ['baseball-sox', BB]]) {
      const placed = fieldMarks(layout, f).filter((o) => o.part || o.op === 'text' || (layout !== 'football' && o.op === 'line'))
      for (const [u, v] of pts(placed)) { expect(u, layout).toBeGreaterThan(f.u0); expect(u, layout).toBeLessThan(f.u1); expect(Math.abs(v), layout).toBeLessThan(f.v1) }
    }
  })
})
```

Create `app/src/sports/__tests__/paintField.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { paintField, toPx, MIN_LINE_PX } from '../paintField.js'

const recorder = () => {
  const calls = []
  const ctx = new Proxy({}, { get: (_, k) => (...a) => calls.push([k, ...a]), set: (_, k, v) => { calls.push([`=${String(k)}`, v]); return true } })
  return { ctx, calls }
}
const F = { u0: -75, u1: 75, v0: -37.5, v1: 37.5 }

describe('paintField', () => {
  it('maps (u0, v1) to the top-left pixel and (u1, v0) to the bottom-right', () => {
    expect(toPx(F, 2048, 1024, [-75, 37.5])).toEqual([0, 0])
    expect(toPx(F, 2048, 1024, [75, -37.5])).toEqual([2048, 1024])
  })
  it('lines are never thinner than 1.5 px; clip saves, unclip restores', () => {
    const { ctx, calls } = recorder()
    paintField(ctx, [{ op: 'clip', pts: [[0, 0], [1, 0], [1, 1]] }, { op: 'line', pts: [[0, 0], [0, 10]], width: 0.05, color: '#fff' }, { op: 'unclip' }], F, 2048, 1024)
    expect(calls.find((c) => c[0] === '=lineWidth')[1]).toBe(MIN_LINE_PX)
    expect(calls.map((c) => c[0])).toEqual(expect.arrayContaining(['save', 'clip', 'stroke', 'restore']))
  })
  it('text is rotated so its reading direction follows the frame angle', () => {
    const { ctx, calls } = recorder()
    paintField(ctx, [{ op: 'text', text: 'BEARS', at: [50.3, 0], size: 6.4, angle: -Math.PI / 2, color: '#fff', stroke: '#C83803', strokeWidth: 0.35 }], F, 2048, 1024)
    expect(calls.find((c) => c[0] === 'rotate')[1]).toBeCloseTo(Math.PI / 2)
    expect(calls.some((c) => c[0] === 'strokeText' && c[1] === 'BEARS')).toBe(true)
    expect(calls.some((c) => c[0] === 'fillText' && c[1] === 'BEARS')).toBe(true)
  })
})
```

Create `app/src/sports/__tests__/fieldTexture.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildFieldArray, layoutFor, fieldSport, FIELD_TEX } from '../fieldTexture.js'

const fakeCanvas = (fill) => (W, H) => ({ getContext: () => new Proxy({ getImageData: () => ({ data: new Uint8ClampedArray(W * H * 4).fill(fill) }) }, { get: (t, k) => t[k] ?? (() => {}), set: () => true }) })
const F = { u0: -75, u1: 75, v0: -37.5, v1: 37.5, ring: [], origin: [0, 0], axis: [0, -1] }

describe('fieldTexture', () => {
  it('stacks one layer per slot, sized by quality', () => {
    const tex = buildFieldArray([{ slot: 0, frame: F, layout: 'football' }, { slot: 2, frame: F, layout: 'soccer' }], 'LOW', fakeCanvas(9))
    const [W, H] = FIELD_TEX.LOW
    expect([tex.image.width, tex.image.height, tex.image.depth]).toEqual([W, H, 3])
    expect(tex.image.data[0]).toBe(9)
    expect(tex.image.data[2 * W * H * 4]).toBe(9)
    expect(tex.image.data[W * H * 4]).toBe(0) // slot 1 unused
  })
  it('chooses the layout by venue and sport', () => {
    expect(layoutFor('wrigleyfield', 'baseball')).toBe('baseball-wrigley')
    expect(layoutFor('ratefield', 'baseball')).toBe('baseball-sox')
    expect(layoutFor('soldierfield', 'soccer')).toBe('soccer')
    expect(layoutFor('soldierfield', 'football')).toBe('football')
    expect(layoutFor('soldierfield', null)).toBe('football')
  })
  it('paints for the game in progress, or the next one within 36 h', () => {
    const now = Date.parse('2026-06-06T12:00:00Z')
    expect(fieldSport({ game: { sport: 'soccer' } }, now)).toBe('soccer')
    expect(fieldSport({ game: null, next: { sport: 'soccer', start: '2026-06-07T00:30:00Z' } }, now)).toBe('soccer')
    expect(fieldSport({ game: null, next: { sport: 'soccer', start: '2026-06-09T00:30:00Z' } }, now)).toBeNull()
    expect(fieldSport(undefined, now)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.**
Run: `cd app && npx vitest run src/sports/__tests__/fieldMarks.test.js src/sports/__tests__/paintField.test.js src/sports/__tests__/fieldTexture.test.js`
Expected: FAIL — `Failed to load url ../fieldMarks.js` (and the same for the others)

- [ ] **Step 3: Implement.** Create `app/src/sports/fieldMarks.js`:

```js
// app/src/sports/fieldMarks.js — every field as drawing ops in its local frame (metres).
// Frame: u along the venue axis (football/soccer: centre → north goal; baseball: home → centre field), v to its
// left seen from above (baseball: +v is the left-field side). Angles: radians from +u toward +v.
// Dimensions: NFL Rule 1, IFAB Law 1, MLB Official Rules 2.01–2.03. Colours: club brand guides (see shared/teams.js);
// grass, clay and track sampled from aerial photographs and kept or reverted per the V5 ledger.
export const FIELD_COLORS = {
  grassA: '#4f8f37', grassB: '#44802f', grassBase: '#4a8834', chalk: '#f2f2ec',
  wrigleyClay: '#9a5a3c', soxClay: '#8c573d', track: '#7b4e37',
  bearsNavy: '#0B162A', bearsOrange: '#C83803', cubsBlue: '#0E3386', cubsRed: '#CC3433', soxBlack: '#27251F', soxSilver: '#C4CED4',
}
const C = FIELD_COLORS
const YD = 0.9144
const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]
const circ = (c, r, n = 48) => Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos((i / n) * 2 * Math.PI), c[1] + r * Math.sin((i / n) * 2 * Math.PI)])
const arc = (c, r, a0, a1, n = 32) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)] })
const polar = (r, deg) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)]
const ringArc = (c, r0, r1, a0, a1, n = 40) => [...arc(c, r1, a0, a1, n), ...arc(c, r0, a1, a0, n)]

function football() {
  const H = 50 * YD, E = 10 * YD, W = 24.384, B = 1.8288
  const ops = [{ op: 'fill', color: C.grassBase }]
  for (let i = 0; i < 20; i++) { const u = -H + i * 5 * YD; ops.push({ op: 'poly', pts: rect(u, -W, u + 5 * YD, W), color: i % 2 ? C.grassB : C.grassA }) }
  for (const s of [1, -1]) ops.push({ op: 'poly', pts: rect(s * H, -W, s * (H + E), W), color: C.bearsNavy })
  // 6-ft white border outside the sidelines and end lines
  ops.push({ op: 'poly', pts: rect(-H - E - B, W, H + E + B, W + B), color: C.chalk }, { op: 'poly', pts: rect(-H - E - B, -W - B, H + E + B, -W), color: C.chalk },
    { op: 'poly', pts: rect(H + E, -W, H + E + B, W), color: C.chalk }, { op: 'poly', pts: rect(-H - E - B, -W, -H - E, W), color: C.chalk })
  for (let i = 0; i <= 20; i++) { const u = -H + i * 5 * YD; ops.push({ op: 'line', pts: [[u, -W], [u, W]], width: i % 20 === 0 ? 0.2032 : 0.1016, color: C.chalk }) }
  // one-yard marks: hash marks 70 ft 9 in from each sideline, and sideline ticks
  for (let y = 1; y < 100; y++) {
    if (y % 5 === 0) continue
    const u = -H + y * YD
    for (const s of [1, -1]) {
      const hv = s * (W - 21.5646)
      ops.push({ op: 'line', pts: [[u, hv - 0.305], [u, hv + 0.305]], width: 0.1016, color: C.chalk }, { op: 'line', pts: [[u, s * (W - 0.1524)], [u, s * (W - 0.762)]], width: 0.1016, color: C.chalk })
    }
  }
  // yard numbers: tops 9 yd from the sideline, read by someone standing mid-field and facing that sideline
  for (let k = 1; k <= 9; k++) {
    const u = -H + k * 10 * YD, n = String(10 * Math.min(k, 10 - k))
    for (const s of [1, -1]) ops.push({ op: 'text', text: n, at: [u, s * (W - 10 * YD)], size: 1.8288, angle: s > 0 ? 0 : Math.PI, color: C.chalk })
  }
  // midfield "C": navy keyline, orange letter, opening toward −u (reads upright from the west, +v, sideline)
  const gap = 0.75
  ops.push({ op: 'poly', pts: ringArc([0, 0], 2.44, 4.87, -(Math.PI - gap + 0.12), Math.PI - gap + 0.12), color: C.bearsNavy })
  ops.push({ op: 'poly', pts: ringArc([0, 0], 2.74, 4.57, -(Math.PI - gap), Math.PI - gap), color: C.bearsOrange })
  // end-zone wordmarks, across the field, baseline toward the goal line (readable from midfield)
  const word = { size: 6.4, color: '#ffffff', stroke: C.bearsOrange, strokeWidth: 0.35, maxWidth: 2 * W - 6 }
  ops.push({ op: 'text', text: 'BEARS', at: [H + E / 2, 0], angle: -Math.PI / 2, ...word })
  ops.push({ op: 'text', text: 'CHICAGO', at: [-(H + E / 2), 0], angle: Math.PI / 2, ...word })
  return ops
}

function soccer() {
  const L = 52.5, Wd = 34, w = 0.12
  const ops = [{ op: 'fill', color: C.grassBase }]
  for (let i = 0; i < 20; i++) { const u = -L + i * 5.25; ops.push({ op: 'poly', pts: rect(u, -Wd, u + 5.25, Wd), color: i % 2 ? C.grassB : C.grassA }) }
  const line = (pts, closed = false) => ops.push({ op: 'line', pts, width: w, color: C.chalk, closed })
  line(rect(-L, -Wd, L, Wd), true)
  line([[0, -Wd], [0, Wd]])
  line(circ([0, 0], 9.15, 64), true)
  ops.push({ op: 'poly', pts: circ([0, 0], 0.11, 12), color: C.chalk })
  const a = Math.acos(5.5 / 9.15)
  const corner = { '1,1': [Math.PI, 1.5 * Math.PI], '1,-1': [0.5 * Math.PI, Math.PI], '-1,1': [-0.5 * Math.PI, 0], '-1,-1': [0, 0.5 * Math.PI] }
  for (const s of [1, -1]) {
    line(rect(s * L, -20.16, s * (L - 16.5), 20.16), true)
    line(rect(s * L, -9.16, s * (L - 5.5), 9.16), true)
    const spot = [s * (L - 11), 0]
    ops.push({ op: 'poly', pts: circ(spot, 0.11, 12), color: C.chalk })
    line(s > 0 ? arc(spot, 9.15, Math.PI - a, Math.PI + a) : arc(spot, 9.15, -a, a))
    for (const t of [1, -1]) line(arc([s * L, t * Wd], 1, ...corner[`${s},${t}`], 8))
  }
  return ops
}

function baseball(frame, style) {
  const BASE = 27.432, MOUND = 18.44
  const clay = style === 'sox' ? C.soxClay : C.wrigleyClay
  const lf = polar(1, 45), rf = polar(1, -45)
  const along = (d, r) => [d[0] * r, d[1] * r]
  const grass = frame.grassRing ?? frame.ring
  const ops = [{ op: 'fill', color: C.track }, { op: 'poly', pts: grass, color: C.grassBase }, { op: 'clip', pts: grass }]
  if (style === 'wrigley') {
    // Wrigley's crosshatch: 15-ft squares aligned with the foul lines
    const s = 4.572, P = (p, q) => [lf[0] * p + rf[0] * q, lf[1] * p + rf[1] * q]
    for (let i = -3; i < 36; i++) for (let j = -3; j < 36; j++) if (Math.abs(i + j) % 2 === 0) ops.push({ op: 'poly', pts: [P(i * s, j * s), P((i + 1) * s, j * s), P((i + 1) * s, (j + 1) * s), P(i * s, (j + 1) * s)], color: C.grassB })
  } else {
    for (let k = 0; k < 30; k += 2) { const u = frame.u0 + k * 5.2; ops.push({ op: 'poly', pts: rect(u, frame.v0, u + 5.2, frame.v1), color: C.grassB }) }
  }
  ops.push({ op: 'unclip' })
  // skinned infield: the 95-ft arc round the mound, between the foul lines extended 3 ft behind home
  const apex = [-4.24, 0]
  ops.push({ op: 'clip', pts: [apex, [apex[0] + lf[0] * 260, lf[1] * 260], [apex[0] + 368, 0], [apex[0] + rf[0] * 260, rf[1] * 260]] })
  ops.push({ op: 'poly', pts: circ([MOUND, 0], 28.956, 96), color: clay, part: 'infield' })
  ops.push({ op: 'unclip' })
  const home = [0, 0], first = along(rf, BASE), second = [BASE * Math.SQRT2, 0], third = along(lf, BASE)
  const cen = [(home[0] + first[0] + second[0] + third[0]) / 4, 0]
  const shrink = (p) => [cen[0] + (p[0] - cen[0]) * 0.84, cen[1] + (p[1] - cen[1]) * 0.84]
  ops.push({ op: 'poly', pts: [home, first, second, third].map(shrink), color: style === 'wrigley' ? C.grassA : C.grassBase, part: 'infield-grass' })
  ops.push({ op: 'poly', pts: circ([MOUND, 0], 2.743, 32), color: clay, part: 'mound' })
  ops.push({ op: 'poly', pts: circ(home, 3.962, 40), color: clay, part: 'home' })
  for (const b of [first, second, third]) ops.push({ op: 'poly', pts: circ(b, 3.0, 24), color: clay, part: 'basecut' })
  // chalk: foul lines to the wall, bases (15 in, square to the lines), rubber, plate, boxes
  for (const d of [lf, rf]) ops.push({ op: 'line', pts: [[0, 0], along(d, 130)], width: 0.1016, color: C.chalk, part: 'foul' })
  const bq = (c) => [0, 1, 2, 3].map((i) => [c[0] + 0.269 * Math.cos((i * Math.PI) / 2), c[1] + 0.269 * Math.sin((i * Math.PI) / 2)])
  for (const b of [first, second, third]) ops.push({ op: 'poly', pts: bq(b), color: C.chalk, part: 'base' })
  ops.push({ op: 'poly', pts: rect(MOUND - 0.076, -0.305, MOUND + 0.076, 0.305), color: C.chalk, part: 'rubber' })
  ops.push({ op: 'poly', pts: [[0, 0], [0.2159, 0.2159], [0.4318, 0.2159], [0.4318, -0.2159], [0.2159, -0.2159]], color: C.chalk, part: 'plate' })
  for (const s of [1, -1]) ops.push({ op: 'line', pts: rect(0.2159 - 0.9144, s * 0.368, 0.2159 + 0.9144, s * (0.368 + 1.2192)), width: 0.0762, color: C.chalk, closed: true, part: 'box' })
  ops.push({ op: 'line', pts: [[-0.699, 0.546], [-2.438, 0.546], [-2.438, -0.546], [-0.699, -0.546]], width: 0.0762, color: C.chalk, part: 'catcher' })
  // on-deck circles, 5 ft across, between home and each dugout
  const deck = style === 'sox' ? [C.soxBlack, C.soxSilver] : [C.cubsBlue, C.chalk]
  for (const a of [120, -120]) {
    const c = polar(11.28, a)
    ops.push({ op: 'poly', pts: circ(c, 0.762, 24), color: deck[0], part: 'ondeck' })
    ops.push({ op: 'line', pts: circ(c, 0.762, 24), width: 0.08, color: deck[1], closed: true })
  }
  if (style === 'sox') ops.push({ op: 'text', text: 'SOX', at: [-10.5, 0], size: 3.2, angle: Math.PI / 2, color: C.soxBlack, stroke: C.soxSilver, strokeWidth: 0.25 })
  return ops
}

export function fieldMarks(layout, frame) {
  if (layout === 'football') return football()
  if (layout === 'soccer') return soccer()
  if (layout === 'baseball-wrigley') return baseball(frame, 'wrigley')
  if (layout === 'baseball-sox') return baseball(frame, 'sox')
  return [{ op: 'fill', color: C.grassBase }]
}
```

Create `app/src/sports/paintField.js`:

```js
// app/src/sports/paintField.js — runs fieldMarks ops on a 2D canvas context. Canvas row 0 is the frame's v1 edge
// (the shader samples t = (v1 − v)/(v1 − v0)), so the painted field is not mirrored seen from above.
export const MIN_LINE_PX = 1.5
const scale = (f, W, H) => [W / (f.u1 - f.u0), H / (f.v1 - f.v0)]
export function toPx(f, W, H, [u, v]) { const [sx, sy] = scale(f, W, H); return [(u - f.u0) * sx, (f.v1 - v) * sy] }
function trace(ctx, f, W, H, pts, closed) {
  ctx.beginPath()
  pts.forEach((p, i) => { const [x, y] = toPx(f, W, H, p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) })
  if (closed) ctx.closePath()
}

export function paintField(ctx, ops, f, W, H) {
  const [sx, sy] = scale(f, W, H), s = Math.sqrt(sx * sy)
  for (const o of ops) {
    if (o.op === 'fill') { ctx.fillStyle = o.color; ctx.fillRect(0, 0, W, H) }
    else if (o.op === 'poly') { ctx.fillStyle = o.color; trace(ctx, f, W, H, o.pts, true); ctx.fill() }
    else if (o.op === 'line') {
      ctx.strokeStyle = o.color; ctx.lineWidth = Math.max(o.width * Math.min(sx, sy), MIN_LINE_PX); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'
      trace(ctx, f, W, H, o.pts, !!o.closed); ctx.stroke()
    }
    else if (o.op === 'clip') { ctx.save(); trace(ctx, f, W, H, o.pts, true); ctx.clip() }
    else if (o.op === 'unclip') ctx.restore()
    else if (o.op === 'text') {
      const [x, y] = toPx(f, W, H, o.at)
      ctx.save(); ctx.translate(x, y)
      ctx.rotate(Math.atan2(-Math.sin(o.angle) * sy, Math.cos(o.angle) * sx))
      ctx.font = `900 ${(o.size * s).toFixed(1)}px "Arial Black", "Helvetica Neue", Arial, sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const mw = o.maxWidth ? o.maxWidth * s : undefined
      if (o.stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeWidth * s * 2; if (mw) ctx.strokeText(o.text, 0, 0, mw); else ctx.strokeText(o.text, 0, 0) }
      ctx.fillStyle = o.color
      if (mw) ctx.fillText(o.text, 0, 0, mw); else ctx.fillText(o.text, 0, 0)
      ctx.restore()
    }
  }
}
```

Create `app/src/sports/fieldTexture.js`:

```js
// app/src/sports/fieldTexture.js — paints every open-air venue into one sRGB DataArrayTexture (layer = slot).
import * as THREE from 'three'
import { fieldMarks } from './fieldMarks.js'
import { paintField } from './paintField.js'

export const FIELD_TEX = { LOW: [1024, 512], HIGH: [2048, 1024], ULTRA: [2048, 1024] }

export function layoutFor(venueKey, sport) {
  if (venueKey === 'wrigleyfield') return 'baseball-wrigley'
  if (venueKey === 'ratefield') return 'baseball-sox'
  return sport === 'soccer' ? 'soccer' : 'football'
}

// Soldier Field is repainted for the Fire when their game is on, or starts within 36 h.
export function fieldSport(st, nowMs) {
  if (st?.game) return st.game.sport
  if (st?.next && Date.parse(st.next.start) - nowMs < 36 * 3600000) return st.next.sport
  return null
}

const domCanvas = (W, H) => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c }

export function buildFieldArray(entries, quality, makeCanvas = domCanvas) {
  const [W, H] = FIELD_TEX[quality] ?? FIELD_TEX.HIGH
  const depth = Math.max(1, ...entries.map((e) => e.slot + 1))
  const data = new Uint8Array(W * H * 4 * depth)
  for (const e of entries) {
    const ctx = makeCanvas(W, H).getContext('2d', { willReadFrequently: true })
    paintField(ctx, fieldMarks(e.layout, e.frame), e.frame, W, H)
    data.set(ctx.getImageData(0, 0, W, H).data, e.slot * W * H * 4)
  }
  const tex = new THREE.DataArrayTexture(data, W, H, depth)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}
```

Create `app/src/sports/FieldTextures.jsx`:

```jsx
// app/src/sports/FieldTextures.jsx — repaints the field array when venues, the layout or the quality change.
import { useEffect } from 'react'
import { useSports } from './sportsStore.js'
import { useStore } from '../state/store.js'
import { buildFieldArray, layoutFor, fieldSport } from './fieldTexture.js'
import { facadeUniforms, setFieldFrames } from '../world/materials/facadeMaterial.js'

export default function FieldTextures() {
  const venues = useSports((s) => s.venues)
  const states = useSports((s) => s.states)
  const quality = useStore((s) => s.quality)
  const entries = venues.filter((v) => v.frame).map((v) => ({ slot: v.slot, frame: v.frame, layout: layoutFor(v.key, fieldSport(states[v.key], Date.now())) }))
  const key = `${quality}|${entries.map((e) => `${e.slot}:${e.layout}`).join(',')}`
  useEffect(() => {
    if (!entries.length) return
    const old = facadeUniforms.uFieldTex.value
    facadeUniforms.uFieldTex.value = buildFieldArray(entries, quality)
    setFieldFrames(entries)
    old.dispose?.()
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
```

Create `app/src/sports/SportsLife.jsx`:

```jsx
// app/src/sports/SportsLife.jsx — everything alive at the venues. Task 14 adds the per-venue life.
import FieldTextures from './FieldTextures.jsx'

export default function SportsLife() {
  return <FieldTextures />
}
```

In `app/src/world/Scene.jsx`, import `SportsLife from '../sports/SportsLife.jsx'` and render `<SportsLife />` after `<SportsClock />`.

- [ ] **Step 4: Run the tests to verify they pass.**
Run: `cd app && npx vitest run src/sports/__tests__/`
Expected: PASS

- [ ] **Step 5: Commit.**

```bash
git add app/src/sports/fieldMarks.js app/src/sports/paintField.js app/src/sports/fieldTexture.js app/src/sports/FieldTextures.jsx app/src/sports/SportsLife.jsx app/src/sports/__tests__/fieldMarks.test.js app/src/sports/__tests__/paintField.test.js app/src/sports/__tests__/fieldTexture.test.js app/src/world/Scene.jsx
git commit -m "feat(sports): canvas-painted fields in true colours and dimensions — Bears, Fire, Wrigley, Sox (D3)"
```

- [ ] **Step 6: Capture and evaluate the fields, or revert.**
Run: `cd app && V5_CAPTURE=1 V5_TAG=after-fields V5_ONLY=soldier-top,soldier-top-low,soldier-top-soccer,soldier-aerial,wrigley-top,wrigley-aerial,rate-top,rate-aerial npx playwright test e2e/v5-capture.spec.js`
Expected: `14 passed`

Compare with `pre-fields/` and with satellite photos of each venue.
- **Keep** if all six hold:
  - Soldier Field: yard numbers and BEARS/CHICAGO read correctly, **not mirrored**; the end zones are navy; the C sits at midfield; the stripes run across the field.
  - `soldier-top-soccer` shows the soccer pitch.
  - Wrigley: the crosshatch shows in the outfield; the clay arc and bases sit correctly; the foul lines run to the corners.
  - Rate Field: stripes, black on-deck circles and SOX behind the plate.
  - LOW is still legible at 520 m.
  - Dusk and night are not noticeably brighter than the turf they replace.
- **If text is mirrored,** negate `angle` handling in `paintField` (`ctx.rotate(Math.atan2(Math.sin(o.angle) * sy, Math.cos(o.angle) * sx))` plus `ctx.scale(1, -1)`), re-run Step 4, and re-capture.
- **If BEARS/CHICAGO are on the wrong ends** compared with a current photo, swap the two `text` values. Log it as a `Ruling:`.
- **Colours unpleasing** (grass too saturated or dark): adjust `FIELD_COLORS.grass*` in a separate commit, or `git revert --no-edit HEAD`.

Record ledger lines, then commit:

```bash
git add docs/superpowers/ledgers/v5-stadiums-sports-life.md && git commit -m "docs(v5): ledger — D3 painted fields evaluated"
```

---

### Task 14: Crowds in the stands, with culling and LOW (D8, D15)

**Files:**
- Create: `app/src/sports/crowd.js`, `app/src/sports/anchors.js`, `app/src/sports/Crowd.jsx`
- Modify: `app/src/sports/SportsLife.jsx` (the per-venue `VenueLife` with its culling group)
- Test: `app/src/sports/__tests__/crowd.test.js`, `app/src/sports/__tests__/anchors.test.js`

**Interfaces:**
- Consumes: `venues.json` records (`seats`, `seatCount`, `center`, `radius`, `capacity`, `frame`); `VenueState` (Task 12); `teamByKey`; `lightLevel`; `facadeUniforms.uNight`.
- Produces:
  - from `crowd.js`:
    - `NEUTRALS`;
    - `shirtColors(n, home:[p,s], away:[p,s]|null, seed) → string[]` (weights: home primary .42, home secondary .18, away .10/.04, neutrals .26);
    - `DENSITY = { idle:0, pregame:.35, live:.92, postgame:.3 }`;
    - `crowdDensity(state, game, capacity) → 0…1` (live uses attendance/capacity, clamped to .3–1, when known);
    - `PLAZA_DENSITY` and `plazaDensity(state)`;
    - `LIFE_RANGE_M = 1500`;
    - `lifeVisible(camPos:[x,y,z], center:[x,z], quality, range=1500) → boolean`;
    - `shownCount(total, density) → int`;
    - `flagMask(n, share=.25, seed=7) → Float32Array`;
    - `homeTeamFor(venue, st) → Team`;
    - `celebration(venueKey, st) → { wave, fans, minDensity }`.
  - from `anchors.js`:
    - `decodeAnchors(ArrayBuffer, center) → Float32Array(n·4: x,y,z,yaw)`;
    - `frameToWorld(frame, u, v) → [x, z]`;
    - `fieldFans(frame, kind, n, seed) → Float32Array(n·4)`;
    - `fetchAnchors(path, center, fetchImpl=fetch) → Promise<Float32Array>` (cached; resolves to an empty array on failure).
  - `<Crowd anchors split seatCount fanCount shirts flags wave cheer level standing center radius />`: **one** draw call. Seat instance `i` is shown when `i < seatCount`; field-fan instance `j` (after `split`) is shown when `j − split < fanCount`.

- [ ] **Step 1: Write the failing tests.** Create `app/src/sports/__tests__/crowd.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { shirtColors, crowdDensity, plazaDensity, lifeVisible, shownCount, flagMask, homeTeamFor, celebration } from '../crowd.js'

describe('crowd', () => {
  it('shirts are weighted to the home team, deterministic', () => {
    const s = shirtColors(20000, ['#0E3386', '#CC3433'], ['#9A9CA0', '#F2F2F0'], 1)
    const share = (c) => s.filter((x) => x === c).length / s.length
    expect(share('#0E3386')).toBeGreaterThan(0.40); expect(share('#0E3386')).toBeLessThan(0.44)
    expect(share('#CC3433')).toBeGreaterThan(0.16); expect(share('#CC3433')).toBeLessThan(0.20)
    expect(shirtColors(20000, ['#0E3386', '#CC3433'], ['#9A9CA0', '#F2F2F0'], 1)).toEqual(s)
  })
  it('density follows the game state, and attendance when known', () => {
    expect(crowdDensity('idle', null, 41649)).toBe(0)
    expect(crowdDensity('pregame', null, 41649)).toBe(0.35)
    expect(crowdDensity('live', { attendance: null }, 41649)).toBe(0.92)
    expect(crowdDensity('live', { attendance: 20824 }, 41649)).toBeCloseTo(0.5, 2)
    expect(crowdDensity('live', { attendance: 5000 }, 41649)).toBe(0.3)
    expect(plazaDensity('pregame')).toBe(0.8); expect(plazaDensity('idle')).toBe(0)
  })
  it('life is culled beyond 1.5 km and off at LOW', () => {
    expect(lifeVisible([0, 100, 1400], [0, 0], 'HIGH')).toBe(true)
    expect(lifeVisible([0, 100, 1600], [0, 0], 'HIGH')).toBe(false)
    expect(lifeVisible([0, 100, 10], [0, 0], 'LOW')).toBe(false)
  })
  it('shows a clamped prefix; a quarter of fans carry flags', () => {
    expect(shownCount(1000, 0.35)).toBe(350); expect(shownCount(1000, 2)).toBe(1000); expect(shownCount(1000, -1)).toBe(0)
    const m = flagMask(8000)
    const share = m.reduce((s, x) => s + x, 0) / m.length
    expect(share).toBeGreaterThan(0.23); expect(share).toBeLessThan(0.27)
  })
  it('the home side is the game’s Chicago team, else the venue’s first team', () => {
    const uc = { key: 'unitedcenter', teams: ['bulls', 'blackhawks'] }
    expect(homeTeamFor(uc, { game: { teams: ['blackhawks'] } }).key).toBe('blackhawks')
    expect(homeTeamFor(uc, { game: null, next: { teams: ['blackhawks'] } }).key).toBe('blackhawks')
    expect(homeTeamFor(uc, undefined).key).toBe('bulls')
  })
  it('a Cubs W day fills Wrigley with flag-waving fans, stands and field', () => {
    expect(celebration('wrigleyfield', { winDay: true })).toEqual({ wave: 1, fans: 160, minDensity: 0.15 })
    expect(celebration('wrigleyfield', { winDay: false, lossDay: true })).toEqual({ wave: 0, fans: 0, minDensity: 0 })
    expect(celebration('ratefield', { winDay: true })).toEqual({ wave: 0, fans: 0, minDensity: 0 })
  })
})
```

Create `app/src/sports/__tests__/anchors.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { decodeAnchors, frameToWorld, fieldFans } from '../anchors.js'

describe('anchors', () => {
  it('decodes the pipeline’s Int16 packing', () => {
    const a = decodeAnchors(new Int16Array([53, 123, -75, 15708, -200, 1, 200, -31416]).buffer, [100, -200])
    expect([...a].map((v) => +v.toFixed(4))).toEqual([105.3, 12.3, -207.5, 1.5708, 80, 0.1, -180, -3.1416])
  })
  it('frame → world: u along the axis, v to its left seen from above', () => {
    const f = { origin: [10, 20], axis: [0, -1] } // axis north
    expect(frameToWorld(f, 5, 0)).toEqual([10, 15])
    expect(frameToWorld(f, 0, 3)).toEqual([7, 20]) // left of north is west (−x)
  })
  it('field fans stand on the field, deterministic', () => {
    const f = { origin: [0, 0], axis: [1, 0] }
    const a = fieldFans(f, 'baseball', 160, 3)
    expect(a.length).toBe(640)
    for (let i = 0; i < 160; i++) { expect(a[i * 4]).toBeGreaterThanOrEqual(8); expect(a[i * 4]).toBeLessThanOrEqual(60); expect(Math.abs(a[i * 4 + 2])).toBeLessThanOrEqual(22); expect(a[i * 4 + 1]).toBeCloseTo(0.3) }
    expect([...fieldFans(f, 'baseball', 160, 3)]).toEqual([...a])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.**
Run: `cd app && npx vitest run src/sports/__tests__/crowd.test.js src/sports/__tests__/anchors.test.js`
Expected: FAIL — `Failed to load url ../crowd.js`

- [ ] **Step 3: Implement.** Create `app/src/sports/crowd.js`:

```js
// app/src/sports/crowd.js — who is in the stands: shirts, how full, when drawn.
import { teamByKey } from '../../../shared/teams.js'

export function rng(seed = 1) {
  let s = Math.imul(seed | 0, 2654435761) >>> 0 || 1
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
export const NEUTRALS = [['#F2F2F0', 0.1], ['#8B8D90', 0.06], ['#1E1F22', 0.05], ['#3D5A80', 0.05]]
export function shirtColors(n, home, away, seed = 1) {
  const table = [[home[0], 0.42], [home[1], 0.18], [away?.[0] ?? '#8B8D90', 0.1], [away?.[1] ?? '#F2F2F0', 0.04], ...NEUTRALS]
  const r = rng(seed), out = new Array(n)
  for (let i = 0; i < n; i++) { let x = r(), k = 0; while (k < table.length - 1 && x >= table[k][1]) { x -= table[k][1]; k++ } out[i] = table[k][0] }
  return out
}
export const DENSITY = { idle: 0, pregame: 0.35, live: 0.92, postgame: 0.3 }
export function crowdDensity(state, game, capacity) {
  if (state === 'live' && game?.attendance && capacity) return Math.min(1, Math.max(0.3, game.attendance / capacity))
  return DENSITY[state] ?? 0
}
export const PLAZA_DENSITY = { idle: 0, pregame: 0.8, live: 0.08, postgame: 0.9 }
export const plazaDensity = (state) => PLAZA_DENSITY[state] ?? 0
export const LIFE_RANGE_M = 1500
export function lifeVisible(cam, center, quality, range = LIFE_RANGE_M) {
  if (quality === 'LOW') return false
  return Math.hypot(cam[0] - center[0], cam[2] - center[1]) <= range
}
export const shownCount = (total, density) => Math.max(0, Math.min(total, Math.floor(total * density)))
export function flagMask(n, share = 0.25, seed = 7) { const r = rng(seed), m = new Float32Array(n); for (let i = 0; i < n; i++) m[i] = r() < share ? 1 : 0; return m }
export function homeTeamFor(venue, st) {
  const k = st?.game?.teams?.find((t) => venue.teams.includes(t)) ?? st?.next?.teams?.find((t) => venue.teams.includes(t)) ?? venue.teams[0]
  return teamByKey(k)
}
// After a Cubs win the whole day is a celebration at Wrigley: W flags in the stands and fans on the field.
export function celebration(venueKey, st) {
  return venueKey === 'wrigleyfield' && st?.winDay ? { wave: 1, fans: 160, minDensity: 0.15 } : { wave: 0, fans: 0, minDensity: 0 }
}
```

`homeTeamFor` checks `includes` against the venue's own teams, so `{ game: { teams: ['blackhawks'] } }` passes the test.

Create `app/src/sports/anchors.js`:

```js
// app/src/sports/anchors.js — packed seat/plaza anchors, field-frame ↔ world, fans on the field.
import { rng } from './crowd.js'

export function decodeAnchors(buffer, center) {
  const a = new Int16Array(buffer), n = a.length / 4, out = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    out[i * 4] = center[0] + a[i * 4] / 10; out[i * 4 + 1] = a[i * 4 + 1] / 10
    out[i * 4 + 2] = center[1] + a[i * 4 + 2] / 10; out[i * 4 + 3] = a[i * 4 + 3] / 10000
  }
  return out
}
export function frameToWorld(frame, u, v) {
  const [ax, az] = frame.axis, L = [az, -ax]
  return [frame.origin[0] + ax * u + L[0] * v, frame.origin[1] + az * u + L[1] * v]
}
const FAN_AREA = { baseball: [8, 60, 22], football: [-30, 30, 18] } // u from, u to, |v| max
export function fieldFans(frame, kind, n, seed = 3) {
  const [u0, u1, vm] = FAN_AREA[kind] ?? FAN_AREA.football, r = rng(seed), out = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    const [x, z] = frameToWorld(frame, u0 + r() * (u1 - u0), (r() * 2 - 1) * vm)
    out.set([x, 0.3, z, r() * Math.PI * 2], i * 4)
  }
  return out
}
const cache = new Map()
export function fetchAnchors(path, center, fetchImpl = fetch) {
  if (!cache.has(path)) cache.set(path, fetchImpl(`/world/${path}`).then((r) => (r.ok ? r.arrayBuffer() : new ArrayBuffer(0))).then((b) => decodeAnchors(b, center)).catch(() => new Float32Array(0)))
  return cache.get(path)
}
```

Create `app/src/sports/Crowd.jsx`:

```jsx
// app/src/sports/Crowd.jsx — one instanced draw call: camera-facing fan impostors with W flags when waving.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec4 aAnchor;
attribute vec3 aShirt;
attribute float aFlag;
attribute float aIdx;
attribute float aPart;
uniform float uTime, uWave, uCheer, uSplit, uSeats, uFans;
varying vec2 vUv; varying vec3 vShirt; varying float vPart, vSkin;
void main() {
  bool shown = aIdx < uSplit ? aIdx < uSeats : aIdx - uSplit < uFans;
  if (!shown || (aPart > 0.5 && aFlag * uWave < 0.5)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vUv = uv; vShirt = aShirt; vPart = aPart;
  float ph = fract(sin(dot(aAnchor.xz, vec2(12.9898, 78.233))) * 43758.5453);
  vSkin = ph;
  vec3 toCam = cameraPosition - aAnchor.xyz; toCam.y = 0.0;
  vec3 right = normalize(vec3(-toCam.z, 0.0, toCam.x) + vec3(1e-5));
  float bob = 0.03 * sin(uTime * (1.1 + ph) + ph * 40.0) + uCheer * 0.35 * step(0.4, ph);
  vec3 p = position;
  if (aPart > 0.5) p.x += 0.12 * sin(uTime * 5.0 + ph * 30.0) * (p.y - 1.3);
  vec3 world = aAnchor.xyz + right * p.x + vec3(0.0, p.y + bob, 0.0);
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`
const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uNight, uLevel;
varying vec2 vUv; varying vec3 vShirt; varying float vPart, vSkin;
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  vec3 c;
  if (vPart > 0.5) {                       // the W flag: Cubs blue W on white, stick on the left
    if (vUv.x < 0.06) c = vec3(0.35, 0.3, 0.25);
    else {
      vec2 q = vec2((vUv.x - 0.06) / 0.94, vUv.y);
      float w = min(min(seg(q, vec2(0.12, 0.85), vec2(0.3, 0.15)), seg(q, vec2(0.3, 0.15), vec2(0.5, 0.62))), min(seg(q, vec2(0.5, 0.62), vec2(0.7, 0.15)), seg(q, vec2(0.7, 0.15), vec2(0.88, 0.85))));
      c = mix(vec3(0.0048, 0.034, 0.24), vec3(0.9), step(0.075, w));
    }
  } else {                                 // a seated fan: head and shoulders (quad is 0.56 × 1.2 m)
    vec2 m = vec2((vUv.x - 0.5) * 0.56, vUv.y * 1.2);
    bool head = length(m - vec2(0.0, 1.03)) < 0.11;
    bool body = m.y < 0.92 && abs(m.x) < 0.23 - 0.05 * (m.y / 0.92);
    if (!head && !body) discard;
    c = head ? mix(vec3(0.1, 0.04, 0.02), vec3(0.83, 0.53, 0.35), vSkin) : vShirt;
  }
  c *= mix(0.95, 0.18 + 0.8 * uLevel, uNight);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`

function baseGeometry(standing) {
  const pos = [], uv = [], part = []
  const quad = (x0, y0, x1, y1, p) => { pos.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0); uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); for (let i = 0; i < 6; i++) part.push(p) }
  const lift = standing ? 0.55 : 0
  quad(-0.28, lift, 0.28, lift + 1.2, 0)
  quad(0.18, lift + 1.35, 0.93, lift + 1.85, 1)
  const g = new THREE.InstancedBufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1))
  return g
}

export default function Crowd({ anchors, split, seatCount, fanCount = 0, shirts, flags, wave = 0, cheer = 0, level = 1, standing = false, center, radius }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uWave: { value: 0 }, uCheer: { value: 0 }, uNight: { value: 0 }, uLevel: { value: 1 }, uSplit: { value: 0 }, uSeats: { value: 0 }, uFans: { value: 0 } }]),
  }), [])
  const geo = useMemo(() => {
    const n = anchors.length / 4, g = baseGeometry(standing)
    const sh = new Float32Array(n * 3), idx = new Float32Array(n), col = new THREE.Color()
    for (let i = 0; i < n; i++) { col.set(shirts[i % shirts.length]); sh[i * 3] = col.r; sh[i * 3 + 1] = col.g; sh[i * 3 + 2] = col.b; idx[i] = i }
    g.setAttribute('aAnchor', new THREE.InstancedBufferAttribute(anchors, 4))
    g.setAttribute('aShirt', new THREE.InstancedBufferAttribute(sh, 3))
    g.setAttribute('aFlag', new THREE.InstancedBufferAttribute(flags.length === n ? flags : new Float32Array(n), 1))
    g.setAttribute('aIdx', new THREE.InstancedBufferAttribute(idx, 1))
    g.instanceCount = n
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(center[0], 20, center[1]), radius)
    return g
  }, [anchors, shirts, flags, standing, center, radius])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame((st) => {
    const u = mat.uniforms
    u.uTime.value = st.clock.elapsedTime; u.uWave.value = wave; u.uCheer.value = cheer; u.uLevel.value = level
    u.uNight.value = facadeUniforms.uNight.value; u.uSplit.value = split; u.uSeats.value = seatCount; u.uFans.value = fanCount
  })
  return <mesh geometry={geo} material={mat} visible={seatCount + fanCount > 0} castShadow={false} receiveShadow={false} />
}
```

Replace `app/src/sports/SportsLife.jsx` with:

```jsx
// app/src/sports/SportsLife.jsx — everything alive at the venues. Crowds and players sit in a group culled
// beyond 1.5 km and dropped at LOW; fields paint at every quality.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import FieldTextures from './FieldTextures.jsx'
import Crowd from './Crowd.jsx'
import { useSports } from './sportsStore.js'
import { useStore } from '../state/store.js'
import { lightLevel } from './venueStates.js'
import { shirtColors, crowdDensity, lifeVisible, shownCount, flagMask, homeTeamFor, celebration } from './crowd.js'
import { fetchAnchors, fieldFans } from './anchors.js'

const MOUNT_M = 3000

function SeatCrowd({ venue, st, cheer = 0 }) {
  const [seats, setSeats] = useState(null)
  useEffect(() => { let alive = true; fetchAnchors(venue.seats, venue.center).then((a) => alive && setSeats(a)); return () => { alive = false } }, [venue])
  const home = homeTeamFor(venue, st)
  const party = celebration(venue.key, st)
  const anchors = useMemo(() => {
    if (!seats) return null
    const fans = fieldFans(venue.frame, venue.kind === 'baseball' ? 'baseball' : 'football', 160, venue.slot + 3)
    const all = new Float32Array(seats.length + fans.length); all.set(seats); all.set(fans, seats.length)
    return all
  }, [seats, venue])
  const shirts = useMemo(() => (anchors ? shirtColors(anchors.length / 4, home.colors, null, venue.slot + 1) : []), [anchors, home, venue])
  const flags = useMemo(() => (anchors ? flagMask(anchors.length / 4) : new Float32Array(0)), [anchors])
  if (!anchors?.length) return null
  const split = seats.length / 4
  const density = Math.max(crowdDensity(st?.state ?? 'idle', st?.game, venue.capacity), party.minDensity)
  return <Crowd anchors={anchors} split={split} seatCount={shownCount(split, density)} fanCount={party.fans} shirts={shirts} flags={flags}
    wave={party.wave} cheer={cheer} level={lightLevel(st?.state)} center={venue.center} radius={venue.radius} />
}

function VenueLife({ venue }) {
  const st = useSports((s) => s.states[venue.key])
  const quality = useStore((s) => s.quality)
  const group = useRef()
  useFrame(({ camera }) => { if (group.current) group.current.visible = lifeVisible([camera.position.x, camera.position.y, camera.position.z], venue.center, quality) })
  return (
    <group ref={group}>
      {quality !== 'LOW' && venue.seats && <SeatCrowd venue={venue} st={st} />}
    </group>
  )
}

export default function SportsLife() {
  const venues = useSports((s) => s.venues)
  const readout = useStore((s) => s.readout)
  const near = venues.filter((v) => readout.x !== undefined && Math.hypot(readout.x - v.center[0], readout.z - v.center[1]) < MOUNT_M)
  return (
    <>
      <FieldTextures />
      {near.map((v) => <VenueLife key={v.key} venue={v} />)}
    </>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass.**
Run: `cd app && npx vitest run src/sports/__tests__/`
Expected: PASS

- [ ] **Step 5: Commit.**

```bash
git add app/src/sports/crowd.js app/src/sports/anchors.js app/src/sports/Crowd.jsx app/src/sports/SportsLife.jsx app/src/sports/__tests__/crowd.test.js app/src/sports/__tests__/anchors.test.js
git commit -m "feat(sports): instanced crowds on seat anchors — team shirts, idle motion, density by state; culled at 1.5 km, off at LOW (D8, D15)"
```

- [ ] **Step 6: Capture and evaluate, or revert.**
Run: `cd app && V5_CAPTURE=1 V5_TAG=after-crowd V5_ONLY=wrigley-bowl,soldier-bowl,wrigley-aerial,wrigley-aerial-game npx playwright test e2e/v5-capture.spec.js`
Expected: `7 passed`

- **Keep** if all four hold:
  - `wrigley-bowl` (live) shows full stands of blue and red shirts with visible heads and no floating figures;
  - the night shot shows the crowd lit, not black;
  - idle (`wrigley-aerial`) stands are empty and game shots are full, which is the D6 difference;
  - at the 140 m aerial the crowd reads as texture, not noise or moiré.
- **If figures float or sink,** adjust the `y + 0.05` offset in `seatRow` (pipeline) or the quad `lift` in a commit, rebuilding the world if needed.
- **Otherwise** run `git revert --no-edit HEAD`.

Check the draw calls quickly: `?stats` at `wrigley-bowl` with `sports=live` against `sports=idle`, `window.__gl.info.render.calls`. The difference must be ≤ 1 (the crowd).

Record a ledger line, then commit:

```bash
git add docs/superpowers/ledgers/v5-stadiums-sports-life.md && git commit -m "docs(v5): ledger — D8 crowds evaluated"
```

---

### Task 15: Players in formation, and the ball arc (D9)

**Files:**
- Create: `app/src/sports/formations.js`, `app/src/sports/Players.jsx`
- Modify: `app/src/sports/SportsLife.jsx` (add `<Players>` and `<Ball>` inside the culled group when `state === 'live'`)
- Test: `app/src/sports/__tests__/formations.test.js`

**Interfaces:**
- Consumes: `frameToWorld` (Task 14), `homeTeamFor`, `venue.frame`, `VenueState`.
- Produces:
  - `HALF_INNING_S = 720`, `PLAY_S = 35`;
  - `formation(sport, tSec) → { u, v, side: 'home'|'away'|'official', role }[]`:
    - baseball: 9 fielders, a batter, 0–3 runners and 4 umpires;
    - football: 22 players and 5 officials;
    - soccer: 22 players and a referee;
  - `ballAt(sport, tSec) → [u, y, v]`;
  - `uniformColors(sport, homeTeam) → { home, away, official }`;
  - `<Players frame sport colors />` and `<Ball frame sport />`: one instanced call and one mesh call.
  - Time is `Date.now() / 1000`, so the Playwright fixed clock gives static, repeatable frames.

- [ ] **Step 1: Write the failing test.** Create `app/src/sports/__tests__/formations.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { formation, ballAt, uniformColors, HALF_INNING_S } from '../formations.js'

const count = (f, side) => f.filter((p) => p.side === side).length
describe('formations', () => {
  it('baseball: nine fielders on defence, a batter and runners on offence, four umpires', () => {
    for (const t of [0, 100, 400, HALF_INNING_S + 5]) {
      const f = formation('baseball', t), def = t < HALF_INNING_S ? 'home' : 'away', off = def === 'home' ? 'away' : 'home'
      expect(count(f, def)).toBe(9)
      expect(count(f, off)).toBeGreaterThanOrEqual(1); expect(count(f, off)).toBeLessThanOrEqual(4)
      expect(count(f, 'official')).toBe(4)
      const p = f.find((x) => x.role === 'P'); expect(p.u).toBeCloseTo(18.44); expect(p.v).toBeCloseTo(0)
    }
  })
  it('football: 11 v 11 inside the field, with officials', () => {
    for (const t of [0, 10, 150, 301]) {
      const f = formation('football', t)
      expect(count(f, 'home')).toBe(11); expect(count(f, 'away')).toBe(11); expect(count(f, 'official')).toBe(5)
      for (const p of f.filter((x) => x.side !== 'official')) { expect(Math.abs(p.u)).toBeLessThanOrEqual(54.864); expect(Math.abs(p.v)).toBeLessThanOrEqual(24.384) }
    }
  })
  it('soccer: 11 v 11 inside the pitch, one referee', () => {
    const f = formation('soccer', 77)
    expect(count(f, 'home')).toBe(11); expect(count(f, 'away')).toBe(11); expect(count(f, 'official')).toBe(1)
    for (const p of f) { expect(Math.abs(p.u)).toBeLessThanOrEqual(52.5); expect(Math.abs(p.v)).toBeLessThanOrEqual(34) }
  })
  it('the ball: a pitch to the plate, fly balls to about 31 m, a 12 m pass apex', () => {
    const mid = ballAt('baseball', 22 * 1 + 0.225)          // a normal pitch, halfway
    expect(mid[0]).toBeGreaterThan(8); expect(mid[0]).toBeLessThan(10); expect(mid[1]).toBeGreaterThan(1.2); expect(mid[1]).toBeLessThan(1.5)
    const fly = ballAt('baseball', 0.45 + 2)                  // cycle 0 is a fly ball; halfway up
    expect(fly[1]).toBeCloseTo(31, 0)
    const pass = ballAt('football', 10.5)                     // halfway through the pass window
    expect(pass[1]).toBeCloseTo(14, 0)
    expect(ballAt('basketball', 3)).toBeNull()
  })
  it('kits: baseball home whites and road greys; Bears navy at home; officials apart', () => {
    expect(uniformColors('baseball', { colors: ['#0E3386', '#CC3433'] })).toEqual({ home: '#F4F4F0', away: '#9A9CA0', official: '#1F2530' })
    expect(uniformColors('football', { colors: ['#0B162A', '#C83803'] }).home).toBe('#0B162A')
    expect(uniformColors('soccer', { colors: ['#FF0000', '#7CCDEF'] }).home).toBe('#FF0000')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**
Run: `cd app && npx vitest run src/sports/__tests__/formations.test.js`
Expected: FAIL — `Failed to load url ../formations.js`

- [ ] **Step 3: Implement.** Create `app/src/sports/formations.js`:

```js
// app/src/sports/formations.js — who stands where, in field-frame metres (see fieldMarks.js for the frame).
export const HALF_INNING_S = 720
export const PLAY_S = 35
const NFL_HALF = 54.864, NFL_W = 24.384
const polar = (r, deg) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)]
const h01 = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x) }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))

const FIELDERS = [['P', 18.44, 0], ['C', -1.3, 0], ['1B', 29, -38], ['2B', 40, -14], ['SS', 40, 14], ['3B', 29, 38], ['LF', 88, 28], ['CF', 97, 0], ['RF', 88, -28]]
const BASES = [[27.432, -45], [38.795, 0], [27.432, 45]]
function baseball(t) {
  const half = Math.floor(t / HALF_INNING_S), def = half % 2 === 0 ? 'home' : 'away', off = def === 'home' ? 'away' : 'home'
  const out = FIELDERS.map(([role, r, deg], i) => {
    const [u, v] = role === 'C' ? [r, 0] : polar(r, deg), still = role === 'P' || role === 'C'
    return { u: u + (still ? 0 : 0.4 * Math.sin(t * 0.7 + i * 1.9)), v: v + (still ? 0 : 0.4 * Math.sin(t * 0.6 + i * 2.3)), side: def, role }
  })
  out.push({ u: 0.2, v: 0.95, side: off, role: 'B' })
  const ab = Math.floor(t / 150)
  BASES.forEach(([r, deg], i) => { if (h01(ab * 3 + i + half * 17) < 0.3) { const [u, v] = polar(r, deg); out.push({ u: u - 1.2, v, side: off, role: `R${i + 1}` }) } })
  for (const [r, deg] of [[-2.4, 0], [31, -52], [44, 10], [31, 52]]) { const [u, v] = r < 0 ? [r, 0] : polar(r, deg); out.push({ u, v, side: 'official', role: 'U' }) }
  return out
}

function footballState(t) {
  const series = Math.floor(t / 300), dir = series % 2 === 0 ? 1 : -1
  const k = t % PLAY_S, run = k > 8 && k < 14 ? (k - 8) / 6 : k >= 14 ? 1 - Math.min(1, (k - 14) / 6) : 0
  return { dir, offence: series % 2 === 0 ? 'home' : 'away', los: dir * (-30 + ((t % 300) / 300) * 55), run }
}
const O = [['C', -0.6, 0], ['LG', -0.6, 1.3], ['RG', -0.6, -1.3], ['LT', -0.6, 2.6], ['RT', -0.6, -2.6], ['TE', -0.6, 3.9], ['WR', -0.6, 16], ['WR', -0.6, -16], ['QB', -1.5, 0], ['FB', -4.5, 0], ['RB', -7, 0]]
const D = [['DT', 1, 0.7], ['DT', 1, -0.7], ['DE', 1, 3.2], ['DE', 1, -3.2], ['MLB', 5, 0], ['OLB', 5, 4.5], ['OLB', 5, -4.5], ['CB', 7, 16], ['CB', 7, -16], ['S', 12, 6], ['S', 12, -6]]
const MOVE = { WR: 14, QB: -5, CB: 12, S: 6 }
function football(t) {
  const { dir, offence, los, run } = footballState(t), defence = offence === 'home' ? 'away' : 'home'
  const at = (a, v, role, side) => ({ u: clamp(los + dir * (a + (MOVE[role] ?? 1.2) * run), -NFL_HALF, NFL_HALF), v: clamp(v, -NFL_W, NFL_W), side, role })
  return [
    ...O.map(([role, a, v]) => at(a, v, role, offence)), ...D.map(([role, a, v]) => at(a, v, role, defence)),
    { u: clamp(los - dir * 12, -NFL_HALF, NFL_HALF), v: 3, side: 'official', role: 'R' }, { u: clamp(los + dir * 6, -NFL_HALF, NFL_HALF), v: 0, side: 'official', role: 'U' },
    { u: los, v: NFL_W + 1, side: 'official', role: 'HL' }, { u: los, v: -NFL_W - 1, side: 'official', role: 'LJ' }, { u: clamp(los + dir * 22, -NFL_HALF, NFL_HALF), v: 0, side: 'official', role: 'BJ' },
  ]
}

const F442 = [['GK', -48, 0], ['D', -35, 8], ['D', -35, -8], ['D', -33, 22], ['D', -33, -22], ['M', -18, 8], ['M', -18, -8], ['M', -16, 24], ['M', -16, -24], ['F', -4, 7], ['F', -4, -7]]
function soccer(t) {
  const drift = 8 * Math.sin(t / 40)
  const place = (s, side) => F442.map(([role, u, v], i) => ({ u: clamp(s * (u + (role === 'GK' ? 0 : drift)), -52.5, 52.5), v: clamp(v + 1.5 * Math.sin(t / 7 + i), -34, 34), side, role }))
  return [...place(1, 'home'), ...place(-1, 'away'), { u: clamp(20 * Math.sin(t / 25), -52.5, 52.5), v: 5, side: 'official', role: 'REF' }]
}

export function formation(sport, t) {
  if (sport === 'baseball') return baseball(t)
  if (sport === 'football') return football(t)
  if (sport === 'soccer') return soccer(t)
  return []
}

export function ballAt(sport, t) {
  if (sport === 'baseball') {
    const k = t % 22, n = Math.floor(t / 22)
    if (k < 0.45) { const f = k / 0.45; return [17.5 * (1 - f) + 0.3 * f, 1.9 - 1.0 * f, 0.1] }
    if (n % 5 === 0 && k < 4.45) { const f = (k - 0.45) / 4, [eu, ev] = polar(82, 22); return [eu * f, 1 + 4 * 30 * f * (1 - f), ev * f] }
    return [18.0, 1.5, 0.35]
  }
  if (sport === 'football') {
    const k = t % PLAY_S
    if (k > 9 && k < 12) {
      const qb = formation('football', t - k + 9).find((p) => p.role === 'QB'), wr = formation('football', t - k + 12).find((p) => p.role === 'WR')
      const f = (k - 9) / 3
      return [qb.u + (wr.u - qb.u) * f, 2 + 4 * 12 * f * (1 - f), qb.v + (wr.v - qb.v) * f]
    }
    const { los } = footballState(t)
    return [los, 0.15, 0]
  }
  if (sport === 'soccer') {
    const k = t % 4, n = Math.floor(t / 4), f = k / 4, pl = formation('soccer', n * 4)
    const a = pl[Math.floor(h01(n) * 22)], b = pl[Math.floor(h01(n + 0.5) * 22)]
    return [a.u + (b.u - a.u) * f, 0.11 + 4 * 3 * f * (1 - f), a.v + (b.v - a.v) * f]
  }
  return null
}

// Kits: MLB home whites and road greys; NFL/MLS home teams in their colour (the Bears wear navy at home).
export function uniformColors(sport, homeTeam) {
  if (sport === 'baseball') return { home: '#F4F4F0', away: '#9A9CA0', official: '#1F2530' }
  if (sport === 'soccer') return { home: homeTeam?.colors?.[0] ?? '#FF0000', away: '#F4F4F0', official: '#F2D21B' }
  return { home: homeTeam?.colors?.[0] ?? '#0B162A', away: '#F4F4F0', official: '#E6E6E6' }
}
```

Check against the test before running: cycle 1 at `22 + 0.225` has `n = 1`, so it is a normal pitch. At `f = 0.5`: `u = 8.9`, `y = 1.4`. At `t = 2.45`, `n = 0` is a fly ball with `f = 0.5`: `y = 1 + 30 = 31`. The pass at `t = 10.5`: `f = 0.5`, so `y = 2 + 12 = 14`.

Create `app/src/sports/Players.jsx`:

```jsx
// app/src/sports/Players.jsx — one instanced draw call for the players, one mesh for the ball.
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { formation, ballAt } from './formations.js'
import { frameToWorld } from './anchors.js'

const MAX = 32
const capsule = new THREE.CapsuleGeometry(0.32, 1.15, 2, 6).translate(0, 0.9, 0)
const playerMat = new THREE.MeshStandardMaterial({ roughness: 0.75 })
const ballGeo = new THREE.SphereGeometry(0.22, 10, 8) // ~2× true size so the arc reads from the stands
const ballMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.3 })
const FIELD_Y = 0.22

export default function Players({ frame, sport, colors }) {
  const ref = useRef()
  const m = useMemo(() => new THREE.Matrix4(), []), c = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const list = formation(sport, Date.now() / 1000).slice(0, MAX)
    list.forEach((p, i) => {
      const [x, z] = frameToWorld(frame, p.u, p.v)
      mesh.setMatrixAt(i, m.makeTranslation(x, FIELD_Y, z))
      mesh.setColorAt(i, c.set(colors[p.side]))
    })
    mesh.count = list.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[capsule, playerMat, MAX]} frustumCulled={false} castShadow={false} receiveShadow={false} />
}

export function Ball({ frame, sport }) {
  const ref = useRef()
  useFrame(() => {
    const b = ballAt(sport, Date.now() / 1000)
    if (!ref.current) return
    ref.current.visible = !!b
    if (b) { const [x, z] = frameToWorld(frame, b[0], b[2]); ref.current.position.set(x, FIELD_Y + b[1], z) }
  })
  return <mesh ref={ref} geometry={ballGeo} material={ballMat} castShadow={false} />
}
```

In `app/src/sports/SportsLife.jsx`:
- import `Players, { Ball } from './Players.jsx'` and `{ uniformColors } from './formations.js'`;
- inside `VenueLife`'s `<group>`, after the `SeatCrowd` line, add:

```jsx
      {quality !== 'LOW' && venue.frame && st?.state === 'live' && st.game && (
        <>
          <Players frame={venue.frame} sport={st.game.sport} colors={uniformColors(st.game.sport, homeTeamFor(venue, st))} />
          <Ball frame={venue.frame} sport={st.game.sport} />
        </>
      )}
```

- [ ] **Step 4: Run the test to verify it passes.**
Run: `cd app && npx vitest run src/sports/__tests__/formations.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit.**

```bash
git add app/src/sports/formations.js app/src/sports/Players.jsx app/src/sports/SportsLife.jsx app/src/sports/__tests__/formations.test.js
git commit -m "feat(sports): players in real formations with a ball arc during live games (D9)"
```

- [ ] **Step 6: Capture and evaluate, or revert.**
Run: `cd app && V5_CAPTURE=1 V5_TAG=after-players V5_ONLY=wrigley-bowl,soldier-bowl,soldier-top-soccer npx playwright test e2e/v5-capture.spec.js`
Expected: `5 passed`

- **Keep** if all three hold:
  - the fielders sit at their positions in white and grey (Wrigley); the Bears' navy and the visitors' white line up at the line of scrimmage;
  - the Fire in red play a 4-4-2 on the soccer lines;
  - the figures sit on the grass, neither floating nor sunk.
- **Otherwise** run `git revert --no-edit HEAD`.

Add a ledger line and commit:

```bash
git add docs/superpowers/ledgers/v5-stadiums-sports-life.md && git commit -m "docs(v5): ledger — D9 players evaluated"
```

---

### Task 16: Scoreboards show the score (D13), and the Phase 5 `setScoreboard` hook

**Files:**
- Create: `app/src/sports/scoreboard.js`, `app/src/sports/Scoreboard.jsx`
- Modify: `app/src/sports/SportsLife.jsx` (boards are drawn within 3 km at every quality, outside the culled group)
- Test: `app/src/sports/__tests__/scoreboard.test.js`

**Interfaces:**
- Consumes: `gameWindow` (Task 9); `hashFrac` (Task 10); `formatChicago`; `venue.boards[]`; `useSports.boardOverrides`, `setBoardOverride`.
- Produces:
  - `simScore(game, nowMs) → { home, away } | null`: monotone, and equal to the finals at the end;
  - `ordinal(n) → '1st'…`;
  - `periodLabel(game, nowMs, state) → string`;
  - `boardLines(venue, st, nowMs, override?) → { title, rows: [{abbr, score|null}] (away first), status }`;
  - `drawBoard(ctx, lines, style: 'manual'|'video', W, H)`;
  - `setScoreboard(venueKey, { home, away, status })`: the Phase 5 hook, which overrides the numbers until it is cleared with `null`;
  - `<Scoreboard board lines />`: one draw call per board, redrawn only when the text changes.
- Score rules:
  - real ESPN numbers are shown when the data has them;
  - a simulated game shows its simulated running score while live, and its final after;
  - a real game in progress without a feed shows `–` (live scores are Phase 5).

- [ ] **Step 1: Write the failing test.** Create `app/src/sports/__tests__/scoreboard.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { simScore, periodLabel, boardLines, drawBoard, ordinal, setScoreboard } from '../scoreboard.js'
import { useSports } from '../sportsStore.js'

const T = (iso) => Date.parse(iso)
const sim = { id: 's1', sport: 'baseball', start: '2026-07-10T00:05:00Z', simulated: true, home: { abbr: 'CHC', score: 6 }, away: { abbr: 'MIL', score: 2 } }
const real = { id: 'r1', sport: 'baseball', start: '2026-06-05T18:20:00Z', home: { abbr: 'CHC', score: 5 }, away: { abbr: 'NYM', score: 3 } }
const realLive = { ...real, id: 'r2', home: { abbr: 'CHC', score: null }, away: { abbr: 'NYM', score: null } }
const W = { key: 'wrigleyfield', name: 'Wrigley Field' }

describe('scoreboard', () => {
  it('the simulated score only ever rises and ends at the final', () => {
    let prev = { home: 0, away: 0 }
    for (let m = 0; m <= 180; m += 5) {
      const s = simScore(sim, T('2026-07-10T00:05:00Z') + m * 60000)
      expect(s.home).toBeGreaterThanOrEqual(prev.home); expect(s.away).toBeGreaterThanOrEqual(prev.away); prev = s
    }
    expect(simScore(sim, T('2026-07-10T03:05:00Z'))).toEqual({ home: 6, away: 2 })
    expect(simScore(realLive, T('2026-06-05T19:00:00Z'))).toBeNull()
  })
  it('periods: innings, quarters, periods, minutes; FINAL after', () => {
    const at = (min, g = sim) => periodLabel(g, T(g.start) + min * 60000, 'live')
    expect(at(1)).toBe('TOP 1ST'); expect(at(95)).toBe('BOT 5TH')
    expect(at(100, { ...sim, sport: 'football' })).toBe('Q3')
    expect(at(10, { ...sim, sport: 'hockey' })).toBe('P1')
    expect(at(60, { ...sim, sport: 'soccer' })).toBe("50'")
    expect(periodLabel(sim, 0, 'postgame')).toBe('FINAL')
    expect(ordinal(2)).toBe('2nd'); expect(ordinal(3)).toBe('3rd'); expect(ordinal(11)).toBe('11th')
  })
  it('the board shows the data: real finals, simulated running score, a dash when unknown', () => {
    expect(boardLines(W, { state: 'postgame', game: real }, T('2026-06-05T22:00:00Z')).rows).toEqual([{ abbr: 'NYM', score: 3 }, { abbr: 'CHC', score: 5 }])
    expect(boardLines(W, { state: 'live', game: realLive }, T('2026-06-05T19:00:00Z')).rows).toEqual([{ abbr: 'NYM', score: null }, { abbr: 'CHC', score: null }])
    const mid = boardLines(W, { state: 'live', game: sim }, T('2026-07-10T01:35:00Z'))
    expect(mid.rows[1].score).toBe(simScore(sim, T('2026-07-10T01:35:00Z')).home)
    const idle = boardLines(W, { state: 'idle', game: null, next: sim }, T('2026-07-09T12:00:00Z'))
    expect(idle).toMatchObject({ title: 'WRIGLEY FIELD', rows: [] })
    expect(idle.status).toBe('NEXT MIL · THU 7:05 PM')
  })
  it('setScoreboard (Phase 5) overrides the numbers until cleared', () => {
    setScoreboard('wrigleyfield', { home: 9, away: 1, status: 'BOT 8TH' })
    const lines = boardLines(W, { state: 'live', game: realLive }, T('2026-06-05T19:00:00Z'), useSports.getState().boardOverrides.wrigleyfield)
    expect(lines).toMatchObject({ rows: [{ abbr: 'NYM', score: 1 }, { abbr: 'CHC', score: 9 }], status: 'BOT 8TH' })
    setScoreboard('wrigleyfield', null)
    expect(useSports.getState().boardOverrides.wrigleyfield).toBeNull()
  })
  it('draws abbreviations, scores and a dash', () => {
    const calls = []
    const ctx = new Proxy({}, { get: (_, k) => (...a) => calls.push([k, ...a]), set: () => true })
    drawBoard(ctx, { title: 'WRIGLEY FIELD', rows: [{ abbr: 'NYM', score: 3 }, { abbr: 'CHC', score: null }], status: 'FINAL' }, 'manual', 1024, 512)
    const txt = calls.filter((c) => c[0] === 'fillText').map((c) => c[1])
    expect(txt).toEqual(expect.arrayContaining(['NYM', '3', 'CHC', '–', 'FINAL']))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**
Run: `cd app && npx vitest run src/sports/__tests__/scoreboard.test.js`
Expected: FAIL — `Failed to load url ../scoreboard.js`

- [ ] **Step 3: Implement.** Create `app/src/sports/scoreboard.js`:

```js
// app/src/sports/scoreboard.js — what each board says, and how it is drawn (a 1024 × 512 canvas).
import { gameWindow } from './gameState.js'
import { hashFrac } from './simSchedule.js'
import { formatChicago } from './chicagoTime.js'
import { useSports } from './sportsStore.js'

const frac = (g, nowMs) => { const w = gameWindow(g); return Math.max(0, Math.min(1, (nowMs - w.start) / (w.end - w.start))) }

// Each run/point of the final arrives at a fixed, hashed moment, so the score only rises.
export function simScore(game, nowMs) {
  if (game?.home?.score == null || game?.away?.score == null) return null
  const f = frac(game, nowMs)
  const upTo = (total, salt) => { let s = 0; for (let i = 0; i < total; i++) if (hashFrac(`${game.id}:${salt}:${i}`) < f) s++; return s }
  if (f >= 1) return { home: game.home.score, away: game.away.score }
  return { home: upTo(game.home.score, 'h'), away: upTo(game.away.score, 'a') }
}

export const ordinal = (n) => { const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'; return `${n}${s}` }

export function periodLabel(game, nowMs, state) {
  if (state === 'postgame') return 'FINAL'
  if (state === 'pregame') return `STARTS ${formatChicago(Date.parse(game.start)).toUpperCase()}`
  if (state !== 'live') return ''
  const f = frac(game, nowMs)
  if (game.sport === 'baseball') { const h = Math.min(17, Math.floor(f * 18)); return `${h % 2 ? 'BOT' : 'TOP'} ${ordinal(Math.floor(h / 2) + 1).toUpperCase()}` }
  if (game.sport === 'football' || game.sport === 'basketball') return `Q${Math.min(4, Math.floor(f * 4) + 1)}`
  if (game.sport === 'hockey') return `P${Math.min(3, Math.floor(f * 3) + 1)}`
  if (game.sport === 'soccer') return `${Math.min(90, Math.floor(f * 97))}'`
  return 'LIVE'
}

export function boardLines(venue, st, nowMs, override = null) {
  const title = venue.name.toUpperCase(), g = st?.game
  if (!g || !st || st.state === 'idle') {
    const n = st?.next
    return { title, rows: [], status: n ? `NEXT ${n.chicagoHome === false ? n.home.abbr : n.away.abbr} · ${formatChicago(Date.parse(n.start)).toUpperCase()}` : 'WELCOME' }
  }
  let score = null
  if (override) score = { home: override.home, away: override.away }
  else if (g.simulated) score = st.state === 'live' ? simScore(g, nowMs) : st.state === 'postgame' ? { home: g.home.score, away: g.away.score } : null
  else if (g.home.score != null && g.away.score != null) score = { home: g.home.score, away: g.away.score }
  return { title, rows: [{ abbr: g.away.abbr, score: score?.away ?? null }, { abbr: g.home.abbr, score: score?.home ?? null }], status: override?.status ?? periodLabel(g, nowMs, st.state) }
}

// Phase 5 hook: live numbers from the CHI API replace the board's numbers until cleared with null.
export function setScoreboard(venueKey, lines) { useSports.getState().setBoardOverride(venueKey, lines) }

export function drawBoard(ctx, lines, style, W, H) {
  const manual = style === 'manual'
  ctx.fillStyle = manual ? '#1F4D33' : '#050608'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = manual ? '#F2F2EC' : '#FFB347'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(H * 0.1)}px "Helvetica Neue", Arial, sans-serif`; ctx.textAlign = 'center'
  ctx.fillText(lines.title, W / 2, H * 0.1)
  ctx.font = `800 ${Math.round(H * 0.22)}px "Helvetica Neue", Arial, sans-serif`
  lines.rows.forEach((r, i) => {
    const y = H * (0.34 + i * 0.28)
    ctx.fillStyle = manual ? '#F2F2EC' : '#FFFFFF'; ctx.textAlign = 'left'; ctx.fillText(r.abbr, W * 0.08, y)
    ctx.textAlign = 'right'; ctx.fillText(r.score == null ? '–' : String(r.score), W * 0.92, y)
  })
  ctx.fillStyle = manual ? '#F2F2EC' : '#FFB347'; ctx.textAlign = 'center'
  ctx.font = `700 ${Math.round(H * 0.12)}px "Helvetica Neue", Arial, sans-serif`
  ctx.fillText(lines.status, W / 2, lines.rows.length ? H * 0.9 : H * 0.55)
}
```

Check against the test before running. `periodLabel` at 95 of 180 min: `f = 0.528`, `h = 9`, which gives `BOT 5TH`. Football at 100 of 195 min: `f = 0.513`, which gives `Q3`. Soccer at 60 of 115 min: `f × 97 = 50.6`, which gives `50'`. The idle `next` is a home game (`chicagoHome` undefined → not `false`), so the opponent is the away abbreviation, `MIL`. `formatChicago(2026-07-10T00:05Z)` is `Thu 7:05 PM`, upper-cased.

Create `app/src/sports/Scoreboard.jsx`:

```jsx
// app/src/sports/Scoreboard.jsx — a canvas texture on the board face; redrawn only when its text changes.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { drawBoard } from './scoreboard.js'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'

export default function Scoreboard({ board, lines }) {
  const canvas = useMemo(() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 512; return c }, [])
  const tex = useMemo(() => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t }, [canvas])
  const manual = board.style === 'manual'
  const mat = useMemo(() => (manual
    ? new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.9 })
    : new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })), [manual, tex])
  const key = JSON.stringify(lines)
  useEffect(() => { drawBoard(canvas.getContext('2d'), lines, board.style, 1024, 512); tex.needsUpdate = true }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { tex.dispose(); mat.dispose() }, [tex, mat])
  useFrame(() => { if (manual) mat.emissiveIntensity = 0.35 * facadeUniforms.uNight.value })
  const [w, h] = manual ? [board.w * 0.55, board.h * 0.6] : [board.w * 0.9, board.h * 0.84]
  return (
    <mesh position={[board.center[0] + board.normal[0] * 0.03, board.center[1], board.center[2] + board.normal[1] * 0.03]} rotation={[0, Math.atan2(board.normal[0], board.normal[1]), 0]} material={mat} castShadow={false}>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}
```

In `app/src/sports/SportsLife.jsx`:
- import `Scoreboard from './Scoreboard.jsx'` and `{ boardLines } from './scoreboard.js'`;
- change `VenueLife` to return a fragment: the existing `<group>…</group>`, followed by:

```jsx
      <Boards venue={venue} st={st} />
```

- add:

```jsx
const BOARD_RANGE_M = 3000
function Boards({ venue, st }) {
  const override = useSports((s) => s.boardOverrides[venue.key])
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(id) }, [])
  const group = useRef()
  useFrame(({ camera }) => { if (group.current) group.current.visible = lifeVisible([camera.position.x, 0, camera.position.z], venue.center, 'HIGH', BOARD_RANGE_M) })
  if (!venue.boards?.length) return null
  const lines = boardLines(venue, st, now, override)
  return <group ref={group}>{venue.boards.map((b, i) => <Scoreboard key={i} board={b} lines={lines} />)}</group>
}
```

- [ ] **Step 4: Run the test to verify it passes.**
Run: `cd app && npx vitest run src/sports/__tests__/scoreboard.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit.**

```bash
git add app/src/sports/scoreboard.js app/src/sports/Scoreboard.jsx app/src/sports/SportsLife.jsx app/src/sports/__tests__/scoreboard.test.js
git commit -m "feat(sports): scoreboards show the score from the data; setScoreboard hook for Phase 5 (D13)"
```

- [ ] **Step 6: Capture and evaluate, or revert.**
Run: `cd app && V5_CAPTURE=1 V5_TAG=after-boards V5_ONLY=wrigley-board-win,soldier-bowl,rate-aerial-game npx playwright test e2e/v5-capture.spec.js`
Expected: `4 passed`

- **Keep** if all three hold:
  - Wrigley's green board shows `VIS`/`CHC` with `3`/`5` and `FINAL` (the `win` override), readable from home plate and white on green;
  - the video boards show amber and white on black;
  - there is no z-fighting with the board box.
- **Otherwise** run `git revert --no-edit HEAD`.

Add a ledger line and commit:

```bash
git add docs/superpowers/ledgers/v5-stadiums-sports-life.md && git commit -m "docs(v5): ledger — D13 scoreboards evaluated"
```

---

### Task 17: The Cubs W flag, and flag-waving fans (D11)

**Files:**
- Create: `app/src/sports/winFlag.js`, `app/src/sports/WinFlag.jsx`
- Modify: `app/src/sports/SportsLife.jsx` (the flag over Wrigley's scoreboard, visible within 3 km)
- Test: `app/src/sports/__tests__/winFlag.test.js`

**Interfaces:**
- Consumes: `VenueState.winDay` / `lossDay` (Task 9); `venue.flagPole`, `venue.boards[0].normal`; `celebration` (Task 14, already wired, so the fans wave).
- Produces:
  - `flagKind(st) → 'W'|'L'|null`;
  - `FLAG_COLORS = { blue: '#0E3386', white: '#FFFFFF' }`;
  - `drawFlag(ctx, kind, W, H)`: W is a blue W on white; L is a white L on blue;
  - `<WinFlag pole normal kind />`: a 4.6 × 2.9 m cloth that waves in the vertex shader. One draw call, only on W and L days.

- [ ] **Step 1: Write the failing test.** Create `app/src/sports/__tests__/winFlag.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { flagKind, drawFlag, FLAG_COLORS } from '../winFlag.js'

describe('the W flag', () => {
  it('flies on W days, the L flag on L days, nothing otherwise', () => {
    expect(flagKind({ winDay: true, lossDay: false })).toBe('W')
    expect(flagKind({ winDay: false, lossDay: true })).toBe('L')
    expect(flagKind({ winDay: false, lossDay: false })).toBeNull()
    expect(flagKind(undefined)).toBeNull()
  })
  it('W is a blue W on white; L is a white L on blue', () => {
    const run = (kind) => { const calls = []; drawFlag(new Proxy({}, { get: (_, k) => (...a) => calls.push([k, ...a]), set: (_, k, v) => { calls.push([`=${String(k)}`, v]); return true } }), kind, 512, 320); return calls }
    const w = run('W')
    expect(w.filter((c) => c[0] === '=fillStyle').map((c) => c[1])).toEqual([FLAG_COLORS.white, FLAG_COLORS.blue])
    expect(w.find((c) => c[0] === 'fillText')[1]).toBe('W')
    const l = run('L')
    expect(l.filter((c) => c[0] === '=fillStyle').map((c) => c[1])).toEqual([FLAG_COLORS.blue, FLAG_COLORS.white])
    expect(l.find((c) => c[0] === 'fillText')[1]).toBe('L')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**
Run: `cd app && npx vitest run src/sports/__tests__/winFlag.test.js`
Expected: FAIL — `Failed to load url ../winFlag.js`

- [ ] **Step 3: Implement.** Create `app/src/sports/winFlag.js`:

```js
// app/src/sports/winFlag.js — the flag over Wrigley's scoreboard: white with a blue W after a win,
// blue with a white L after a loss (a Wrigley tradition since 1937).
export const FLAG_COLORS = { blue: '#0E3386', white: '#FFFFFF' }
export const flagKind = (st) => (st?.winDay ? 'W' : st?.lossDay ? 'L' : null)
export function drawFlag(ctx, kind, W, H) {
  const [bg, fg] = kind === 'W' ? [FLAG_COLORS.white, FLAG_COLORS.blue] : [FLAG_COLORS.blue, FLAG_COLORS.white]
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `900 ${Math.round(H * 0.82)}px "Helvetica Neue", Arial, sans-serif`
  ctx.fillText(kind, W / 2, H * 0.53)
}
```

Create `app/src/sports/WinFlag.jsx`:

```jsx
// app/src/sports/WinFlag.jsx — the W (or L) flag on the scoreboard mast, waving; faces the field.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { drawFlag } from './winFlag.js'

const FW = 4.6, FH = 2.9
export default function WinFlag({ pole, normal, kind }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 320
    drawFlag(c.getContext('2d'), kind, 512, 320)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  }, [kind])
  const uTime = useMemo(() => ({ value: 0 }), [])
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85 })
    m.onBeforeCompile = (s) => {
      s.uniforms.uTime = uTime
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat k = position.x / 4.6; transformed.z += sin(position.x * 1.4 - uTime * 3.2) * 0.25 * k; transformed.y -= 0.15 * k * k;')
    }
    return m
  }, [tex, uTime])
  const geo = useMemo(() => new THREE.PlaneGeometry(FW, FH, 16, 6).translate(FW / 2, -FH / 2, 0), [])
  useEffect(() => () => { tex.dispose(); mat.dispose() }, [tex, mat])
  useFrame((st) => { uTime.value = st.clock.elapsedTime })
  return <mesh geometry={geo} material={mat} position={[pole[0], pole[1] - 0.3, pole[2]]} rotation={[0, Math.atan2(normal[0], normal[1]), 0]} castShadow={false} />
}
```

In `app/src/sports/SportsLife.jsx`:
- import `WinFlag from './WinFlag.jsx'` and `{ flagKind } from './winFlag.js'`;
- inside `Boards`, before the `return`, add `const kind = venue.flagPole ? flagKind(st) : null`;
- change the returned group to also render `{kind && <WinFlag pole={venue.flagPole} normal={venue.boards[0].normal} kind={kind} />}`.

- [ ] **Step 4: Run the test to verify it passes.**
Run: `cd app && npx vitest run src/sports/__tests__/winFlag.test.js src/sports/__tests__/crowd.test.js`
Expected: PASS

- [ ] **Step 5: Commit.**

```bash
git add app/src/sports/winFlag.js app/src/sports/WinFlag.jsx app/src/sports/SportsLife.jsx app/src/sports/__tests__/winFlag.test.js
git commit -m "feat(sports): the W flag flies over Wrigley after a Cubs win (L after a loss); fans wave W flags (D11)"
```

- [ ] **Step 6: Capture and evaluate, or revert.**
Run: `cd app && V5_CAPTURE=1 V5_TAG=after-flag V5_ONLY=wrigley-board-win,wrigley-board-loss,wrigley-field-win,wrigley-bowl npx playwright test e2e/v5-capture.spec.js`
Expected: `5 passed`

- **Keep** if all three hold:
  - the W flag reads from home plate on the centre mast, above the board, waving and not clipping the board;
  - the fans on the field and a quarter of the stands wave small W flags;
  - the loss shot shows the blue L and no waving; `wrigley-bowl` (live, not a W day) shows no flags.
- **Otherwise** run `git revert --no-edit HEAD`.

Add a ledger line and commit:

```bash
git add docs/superpowers/ledgers/v5-stadiums-sports-life.md && git commit -m "docs(v5): ledger — D11 W flag evaluated"
```

---

### Task 18: Arena game nights — plaza crowds (D14)

**Files:**
- Modify: `app/src/sports/crowd.js` (add `plazaCount`)
- Modify: `app/src/sports/SportsLife.jsx` (the `PlazaCrowd` inside the culled group)
- Test: `app/src/sports/__tests__/crowd.test.js`

**Interfaces:**
- Consumes: `venue.plaza`, `venue.plazaCount` (Task 7); `plazaDensity`, `homeTeamFor`, `shirtColors`, `fetchAnchors`; `<Crowd standing />`. The lit fascia already comes from Task 11 via `uVenueLight`.
- Produces: `plazaCount(venue, st) → int`.
- The Michael Jordan statue is not modelled: it stands inside the United Center atrium (moved there in 2017). This is a ledger `Ruling:`.

- [ ] **Step 1: Write the failing test.** Append to `app/src/sports/__tests__/crowd.test.js`:

```js
import { plazaCount } from '../crowd.js'
describe('arena plaza', () => {
  const uc = { key: 'unitedcenter', teams: ['bulls', 'blackhawks'], plazaCount: 1000 }
  it('fills before and after a game, empties during it and when idle', () => {
    expect(plazaCount(uc, { state: 'pregame' })).toBe(800)
    expect(plazaCount(uc, { state: 'live' })).toBe(80)
    expect(plazaCount(uc, { state: 'postgame' })).toBe(900)
    expect(plazaCount(uc, { state: 'idle' })).toBe(0)
    expect(plazaCount(uc, undefined)).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**
Run: `cd app && npx vitest run src/sports/__tests__/crowd.test.js`
Expected: FAIL — `does not provide an export named 'plazaCount'`

- [ ] **Step 3: Implement.** Append to `app/src/sports/crowd.js`:

```js
export const plazaCount = (venue, st) => shownCount(venue.plazaCount ?? 0, plazaDensity(st?.state ?? 'idle'))
```

In `app/src/sports/SportsLife.jsx`, import `plazaCount`, then add:

```jsx
function PlazaCrowd({ venue, st }) {
  const [anchors, setAnchors] = useState(null)
  useEffect(() => { let alive = true; fetchAnchors(venue.plaza, venue.center).then((a) => alive && setAnchors(a)); return () => { alive = false } }, [venue])
  const home = homeTeamFor(venue, st)
  const shirts = useMemo(() => (anchors ? shirtColors(anchors.length / 4, home.colors, null, venue.slot + 21) : []), [anchors, home, venue])
  const flags = useMemo(() => new Float32Array(anchors ? anchors.length / 4 : 0), [anchors])
  if (!anchors?.length) return null
  const n = anchors.length / 4
  return <Crowd anchors={anchors} split={n} seatCount={plazaCount(venue, st)} shirts={shirts} flags={flags} standing level={lightLevel(st?.state)} center={venue.center} radius={venue.radius + 30} />
}
```

Inside `VenueLife`'s `<group>`, add `{quality !== 'LOW' && venue.plaza && <PlazaCrowd venue={venue} st={st} />}`.

- [ ] **Step 4: Run the test to verify it passes.**
Run: `cd app && npx vitest run src/sports/__tests__/crowd.test.js`
Expected: PASS

- [ ] **Step 5: Commit.**

```bash
git add app/src/sports/crowd.js app/src/sports/SportsLife.jsx app/src/sports/__tests__/crowd.test.js
git commit -m "feat(sports): arena game nights — crowds on the United Center and Wintrust plazas (D14)"
```

- [ ] **Step 6: Capture and evaluate, or revert.**
Run: `cd app && V5_CAPTURE=1 V5_TAG=after-plaza V5_ONLY=uc-plaza,uc-aerial-game,wintrust-aerial-game npx playwright test e2e/v5-capture.spec.js`
Expected: `3 passed`

- **Keep** if all three hold:
  - the lit fascia plus a standing crowd in red (Bulls) reads as a game night;
  - no fans stand inside buildings or on the arena roof;
  - the crowd thins with distance without shimmering.
- **Otherwise** run `git revert --no-edit HEAD`.

Add a ledger line, plus the `Ruling:` on the Jordan statue, and commit:

```bash
git add docs/superpowers/ledgers/v5-stadiums-sports-life.md && git commit -m "docs(v5): ledger — D14 arena nights evaluated"
```

---

### Task 19: Cheers — positional synthesised crowd audio, off by default (D10), and the Phase 5 `cheer` hook

**Files:**
- Create: `app/src/audio/cheerMath.js`, `app/src/audio/cheers.js`, `app/src/sports/Cheers.jsx`
- Modify: `app/src/sports/Crowd.jsx` (`cheer` may be a function read each frame)
- Modify: `app/src/sports/SportsLife.jsx` (mount `<Cheers />`; pass the live swell to `SeatCrowd`)
- Test: `app/src/audio/__tests__/cheerMath.test.js`, `app/src/audio/__tests__/cheers.test.js`

**Interfaces:**
- Consumes:
  - `useSoundStore` from `app/src/audio/soundStore.js`, with `soundOn: boolean` and `setSoundOn(bool)`. **This is defined by the V4 plan: import it, never redefine it.** Before Step 1, run `grep -n "export" app/src/audio/soundStore.js`. If the export names differ, change only the import line in `Cheers.jsx` and add a `Ruling:`.
  - `useSports.states`, `venues`, `swells`, `pushSwell` (Task 12).
- Produces:
  - `CHEER = { refDistance: 80, maxDistance: 1500, rolloff: 1.1 }`;
  - `MURMUR`, `murmurLevel(state)`;
  - `distanceGain(d)`: the WebAudio `inverse` model, 0 at or beyond 1.5 km;
  - `cheerTimes(seed, t0, t1) → number[]` (s);
  - `lastCheer(seed, t) → number`;
  - `swellEnvelope(dt) → 0…1` (0.4 s attack, 1.6 s decay);
  - `swellNow(state, seed, nowSec, pushed) → 0…1`;
  - `createCheers(AudioCtor?) → { created, enable(), disable(), setListener(pos, fwd), setVenue(key, pos, murmur, swell), dispose() }`: no `AudioContext` exists until `enable()`;
  - `cheer(venueKey, strength = 1)`: the Phase 5 hook. It pushes a swell, so the crowd stands up; it is audible only while `soundOn`.

- [ ] **Step 1: Write the failing tests.** Create `app/src/audio/__tests__/cheerMath.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { distanceGain, murmurLevel, cheerTimes, lastCheer, swellEnvelope, swellNow } from '../cheerMath.js'

describe('cheer math', () => {
  it('attenuates like the inverse model and falls silent at 1.5 km', () => {
    expect(distanceGain(0)).toBe(1); expect(distanceGain(80)).toBe(1)
    expect(distanceGain(500)).toBeCloseTo(80 / (80 + 1.1 * 420), 6)
    expect(distanceGain(1500)).toBe(0)
    expect(distanceGain(900)).toBeLessThan(distanceGain(400))
  })
  it('the murmur follows the game state', () => {
    expect(murmurLevel('idle')).toBe(0); expect(murmurLevel('live')).toBe(0.28); expect(murmurLevel(undefined)).toBe(0)
  })
  it('simulated swells: deterministic, roughly every 1–4 minutes', () => {
    const a = cheerTimes(2, 0, 3600)
    expect(cheerTimes(2, 0, 3600)).toEqual(a)
    expect(a.length).toBeGreaterThan(10); expect(a.length).toBeLessThan(40)
    for (const t of a) { expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThan(3600) }
    expect(lastCheer(2, a[3] + 1)).toBe(a[3])
  })
  it('the swell rises in 0.4 s and decays over a few seconds', () => {
    expect(swellEnvelope(-1)).toBe(0); expect(swellEnvelope(0.2)).toBeCloseTo(0.5)
    expect(swellEnvelope(0.4)).toBe(1); expect(swellEnvelope(2)).toBeCloseTo(Math.exp(-1))
    expect(swellEnvelope(-Infinity)).toBe(0)
  })
  it('swellNow: simulated swells only while live; a pushed cheer at any time', () => {
    const t = cheerTimes(2, 0, 3600)[0] + 0.4
    expect(swellNow('live', 2, t, null)).toBeCloseTo(1)
    expect(swellNow('idle', 2, t, null)).toBe(0)
    expect(swellNow('idle', 2, 1000, { at: 999600, strength: 0.5 })).toBeCloseTo(0.5)
  })
})
```

Create `app/src/audio/__tests__/cheers.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { createCheers, cheer } from '../cheers.js'
import { useSports } from '../../sports/sportsStore.js'

let made = 0
class Param { constructor(v = 0) { this.value = v } setTargetAtTime(v) { this.value = v } }
class Node { constructor(kind) { this.kind = kind } connect(n) { return n } }
class FakeCtx {
  constructor() {
    made++; this.sampleRate = 8000; this.currentTime = 0; this.state = 'suspended'; this.suspends = 0; this.nodes = []
    this.destination = new Node('dest')
    this.listener = Object.fromEntries(['positionX', 'positionY', 'positionZ', 'forwardX', 'forwardY', 'forwardZ', 'upX', 'upY', 'upZ'].map((k) => [k, new Param()]))
  }
  track(n) { this.nodes.push(n); return n }
  createGain() { const n = new Node('gain'); n.gain = new Param(1); return this.track(n) }
  createBuffer(_c, n) { const d = new Float32Array(n); return { getChannelData: () => d } }
  createBufferSource() { const n = new Node('src'); n.start = () => { n.started = true }; n.stop = () => {}; return this.track(n) }
  createBiquadFilter() { const n = new Node('filter'); n.frequency = new Param(); n.Q = new Param(); return this.track(n) }
  createPanner() { const n = new Node('panner'); n.positionX = new Param(); n.positionY = new Param(); n.positionZ = new Param(); return this.track(n) }
  resume() { this.state = 'running'; return Promise.resolve() }
  suspend() { this.suspends++; this.state = 'suspended'; return Promise.resolve() }
  close() {}
}

describe('cheers engine', () => {
  beforeEach(() => { made = 0 })
  it('creates no AudioContext until enabled and suspends on disable', async () => {
    const c = createCheers(FakeCtx)
    c.setListener([0, 10, 0], [0, 0, -1]); c.setVenue('wrigleyfield', [0, 15, 0], 0.28, 1)
    expect(made).toBe(0); expect(c.created).toBe(false)
    await c.enable()
    expect(made).toBe(1)
    c.disable()
    expect(c.created).toBe(true)
  })
  it('a live venue gets a looping, positional voice with the inverse distance model', async () => {
    const c = createCheers(FakeCtx); await c.enable()
    c.setVenue('unitedcenter', [0, 15, 0], 0, 0)       // idle: no voice
    c.setVenue('wrigleyfield', [-2292, 15, -7339], 0.28, 0)
    const ctx = c._ctx
    const p = ctx.nodes.filter((n) => n.kind === 'panner')
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({ distanceModel: 'inverse', refDistance: 80, maxDistance: 1500, rolloffFactor: 1.1, panningModel: 'equalpower' })
    expect(p[0].positionX.value).toBe(-2292)
    expect(ctx.nodes.find((n) => n.kind === 'src')).toMatchObject({ loop: true, started: true })
    c.disable(); expect(ctx.suspends).toBe(1)
  })
  it('cheer() (Phase 5) pushes a swell for the venue', () => {
    cheer('soldierfield', 0.8)
    expect(useSports.getState().swells.soldierfield).toMatchObject({ strength: 0.8 })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.**
Run: `cd app && npx vitest run src/audio/__tests__/cheerMath.test.js src/audio/__tests__/cheers.test.js`
Expected: FAIL — `Failed to load url ../cheerMath.js`

- [ ] **Step 3: Implement.** Create `app/src/audio/cheerMath.js`:

```js
// app/src/audio/cheerMath.js — pure numbers for the crowd sound: attenuation, murmur, swell timing and shape.
export const CHEER = { refDistance: 80, maxDistance: 1500, rolloff: 1.1 }
export const MURMUR = { idle: 0, pregame: 0.12, live: 0.28, postgame: 0.16 }
export const murmurLevel = (state) => MURMUR[state] ?? 0
export function distanceGain(d) {
  if (d >= CHEER.maxDistance) return 0
  const r = CHEER.refDistance
  return r / (r + CHEER.rolloff * (Math.max(d, r) - r))
}
const h = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x) }
// Simulated scoring swells: in each minute, a 40 % chance of one at a hashed second.
export function cheerTimes(seed, t0, t1) {
  const out = []
  for (let m = Math.floor(t0 / 60); m <= Math.floor(t1 / 60); m++) {
    if (h(seed, m) >= 0.4) continue
    const t = m * 60 + h(seed + 0.5, m) * 60
    if (t >= t0 && t < t1) out.push(t)
  }
  return out
}
export function lastCheer(seed, t) { const c = cheerTimes(seed, t - 600, t + 1e-6); return c.length ? c[c.length - 1] : -Infinity }
export function swellEnvelope(dt) {
  if (!Number.isFinite(dt) || dt < 0) return 0
  return dt < 0.4 ? dt / 0.4 : Math.exp(-(dt - 0.4) / 1.6)
}
export function swellNow(state, seed, nowSec, pushed) {
  const sim = state === 'live' ? swellEnvelope(nowSec - lastCheer(seed, nowSec)) : 0
  const live = pushed ? swellEnvelope(nowSec - pushed.at / 1000) * Math.min(1, pushed.strength ?? 1) : 0
  return Math.max(sim, live)
}
```

Create `app/src/audio/cheers.js`:

```js
// app/src/audio/cheers.js — crowd murmur and cheers, synthesised from shaped noise (no audio assets), one
// positional voice per venue. Nothing is created until enable() — called only when the Sound button is on.
import { CHEER } from './cheerMath.js'
import { useSports } from '../sports/sportsStore.js'

// Phase 5 hook: a scoring event at a venue. The crowd stands; it is heard only while soundOn.
export function cheer(venueKey, strength = 1) { useSports.getState().pushSwell(venueKey, strength) }

export function createCheers(AudioCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext) {
  let ctx = null, master = null, buffer = null
  const voices = new Map()
  const setPos = (n, [x, y, z]) => { if (n.positionX) { n.positionX.value = x; n.positionY.value = y; n.positionZ.value = z } else n.setPosition?.(x, y, z) }
  function ensure() {
    if (ctx || !AudioCtor) return
    ctx = new AudioCtor()
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination)
    const n = ctx.sampleRate * 4
    buffer = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = buffer.getChannelData(0)
    let b = 0
    for (let i = 0; i < n; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6 * (0.7 + 0.3 * Math.sin((i / ctx.sampleRate) * 2.1)) }
  }
  function voice(key) {
    if (voices.has(key)) return voices.get(key)
    const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 950; filter.Q.value = 0.6
    const gain = ctx.createGain(); gain.gain.value = 0
    const panner = ctx.createPanner()
    Object.assign(panner, { panningModel: 'equalpower', distanceModel: 'inverse', refDistance: CHEER.refDistance, maxDistance: CHEER.maxDistance, rolloffFactor: CHEER.rolloff })
    src.connect(filter).connect(gain).connect(panner).connect(master)
    src.start()
    const v = { src, filter, gain, panner, last: -1 }
    voices.set(key, v)
    return v
  }
  return {
    get created() { return !!ctx },
    get _ctx() { return ctx }, // tests only
    enable() { ensure(); return ctx?.resume?.() },
    disable() { return ctx?.suspend?.() },
    setListener(pos, fwd) {
      if (!ctx) return
      const L = ctx.listener
      if (L.positionX) { setPos(L, pos); L.forwardX.value = fwd[0]; L.forwardY.value = fwd[1]; L.forwardZ.value = fwd[2]; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0 }
      else { L.setPosition?.(...pos); L.setOrientation?.(fwd[0], fwd[1], fwd[2], 0, 1, 0) }
    },
    setVenue(key, pos, murmur, swell) {
      if (!ctx || (murmur <= 0 && swell <= 0 && !voices.has(key))) return
      const v = voice(key)
      setPos(v.panner, pos)
      const level = Math.min(1.2, murmur + swell * 0.9)
      if (Math.abs(level - v.last) > 0.005) {
        v.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.25)
        v.filter.frequency.setTargetAtTime(950 + 500 * swell, ctx.currentTime, 0.25)
        v.last = level
      }
    },
    dispose() { for (const v of voices.values()) { try { v.src.stop() } catch { /* already stopped */ } } voices.clear(); ctx?.close?.(); ctx = null },
  }
}
```

Create `app/src/sports/Cheers.jsx`:

```jsx
// app/src/sports/Cheers.jsx — drives the cheers engine: listener = camera, one voice per venue near a game.
// Silent (no AudioContext at all) until the shared Sound button turns soundOn on.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useSoundStore } from '../audio/soundStore.js' // V4 — shared with the train rumble
import { createCheers } from '../audio/cheers.js'
import { CHEER, murmurLevel, swellNow } from '../audio/cheerMath.js'
import { useSports } from './sportsStore.js'

const fwd = new THREE.Vector3()
export default function Cheers() {
  const soundOn = useSoundStore((s) => s.soundOn)
  const cheers = useMemo(() => createCheers(), [])
  useEffect(() => { if (soundOn) cheers.enable(); else cheers.disable() }, [soundOn, cheers])
  useEffect(() => () => cheers.dispose(), [cheers])
  useFrame(({ camera }) => {
    if (!soundOn) return
    camera.getWorldDirection(fwd)
    cheers.setListener([camera.position.x, camera.position.y, camera.position.z], [fwd.x, fwd.y, fwd.z])
    const { venues, states, swells } = useSports.getState(), t = Date.now() / 1000
    for (const v of venues) {
      const st = states[v.key], near = Math.hypot(camera.position.x - v.center[0], camera.position.z - v.center[1]) < CHEER.maxDistance
      cheers.setVenue(v.key, [v.center[0], 15, v.center[1]], near ? murmurLevel(st?.state) : 0, near ? swellNow(st?.state, v.slot + 1, t, swells[v.key]) : 0)
    }
  })
  return null
}
```

In `app/src/sports/Crowd.jsx`, change `u.uCheer.value = cheer` to:

```js
    u.uCheer.value = typeof cheer === 'function' ? cheer() : cheer
```

In `app/src/sports/SportsLife.jsx`:
- import `Cheers from './Cheers.jsx'` and `{ swellNow } from '../audio/cheerMath.js'`;
- render `<Cheers />` next to `<FieldTextures />`;
- in `SeatCrowd`, pass:

```jsx
    cheer={() => swellNow(useSports.getState().states[venue.key]?.state, venue.slot + 1, Date.now() / 1000, useSports.getState().swells[venue.key])}
```

in place of `cheer={cheer}`, and drop the `cheer` prop from `SeatCrowd`'s signature.

- [ ] **Step 4: Run the tests to verify they pass.**
Run: `cd app && npx vitest run src/audio/__tests__/ src/sports/__tests__/`
Expected: PASS

- [ ] **Step 5: Commit.**

```bash
git add app/src/audio/cheerMath.js app/src/audio/cheers.js app/src/sports/Cheers.jsx app/src/sports/Crowd.jsx app/src/sports/SportsLife.jsx app/src/audio/__tests__/cheerMath.test.js app/src/audio/__tests__/cheers.test.js
git commit -m "feat(audio): positional synthesised crowd cheers behind the shared Sound button; cheer() hook for Phase 5 (D10)"
```

- [ ] **Step 6: Check it by ear, and log it.** Run `npm run dev --prefix app`, open `/?pose=-2297,25,-7347,-2332,12,-7312&sports=live`, then:
  - with Sound off (the default): silence, and `new AudioContext` never appears in the Performance → Web Audio panel;
  - turn Sound on (the V4 dock button): a murmur, with swells about every 1–4 min, and the stands bob with each swell;
  - press ⌘K "Soldier Field" and fly away past 1.5 km: silence.

Record `Keep — D10 — by ear — …` in the ledger, stop the dev server, and commit the ledger.

---

### Task 20: The sports HUD — Games button, ⌘K "Go to tonight's game", venue card (D12)

**Files:**
- Create: `app/src/sports/venueFocus.js` (the V7 contract), `app/src/sports/tonight.js`, `app/src/sports/palette.js` (the V7 contract)
- Create: `app/src/hud/GamesPanel.jsx`, `app/src/hud/VenueCard.jsx`, `app/src/hud/Sports.css`
- Modify: `app/src/hud/ControlDock.jsx`, `app/src/hud/CommandPalette.jsx`, `app/src/lib/places.js` (`bonus.game`), `app/src/hud/HelpOverlay.jsx`, `app/src/hud/HintBar.jsx`, `app/src/hud/Hud.jsx`
- Test: `app/src/sports/__tests__/tonight.test.js`, `app/src/hud/__tests__/sports.test.jsx` (create), `app/src/hud/__tests__/palette.test.jsx`, `app/src/hud/__tests__/help.test.jsx`

**Interfaces:**
- Consumes: `useSports`; `useStore.startFlight(pose, label)`, `gamesOpen`, `setGamesOpen` (Task 12); `boardLines` (Task 16); `formatChicago`; `chicagoDate`.
- Produces:
  - `venueFocusPose(venue) → { position, target }`, the V7 contract (V7 wraps it with `clearanceAt`):
    - baseball: 150 m behind home plate, 105 m up, looking 60 m toward centre field;
    - football: 190 m off the west (+v) sideline, 120 m up;
    - arenas: 230/270 m off, 190 m up.
  - `tonightsGame(venues, states, nowMs) → { venue, game, state: 'live'|'pregame'|'postgame'|'later'|'upcoming' } | null`;
  - `stateLabel(st) → string`;
  - `gameLabel(game) → 'MIL @ CHC'`;
  - `dataChip(st, source) → 'LIVE'|'SIMULATED'`;
  - `goToVenue(venue)`: flies to the venue focus pose and opens its card;
  - `gamePlaces({ venues, states, nowMs }) → Place[]`, the V7 contract (kind `'game'`):
    - `g:tonight` "Go to tonight's game";
    - `g:panel` "Show games & scores";
    - `g:<venueKey>` "Games at <venue>".

- [ ] **Step 1: Write the failing tests.** Create `app/src/sports/__tests__/tonight.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { tonightsGame, stateLabel, gameLabel, dataChip } from '../tonight.js'
import { venueFocusPose } from '../venueFocus.js'
import { gamePlaces } from '../palette.js'
import { useStore } from '../../state/store.js'
import { useSports } from '../sportsStore.js'

const W = { key: 'wrigleyfield', name: 'Wrigley Field', kind: 'baseball', teams: ['cubs'], center: [-2292, -7339], frame: { origin: [-2325, -7319], axis: [0.70711, -0.70711] } }
const U = { key: 'unitedcenter', name: 'United Center', kind: 'arena', teams: ['bulls', 'blackhawks'], center: [-3842, 147], frame: null }
const S = { key: 'soldierfield', name: 'Soldier Field', kind: 'football', teams: ['bears', 'fire'], center: [928, 2187], frame: { origin: [929, 2196], axis: [-0.07324, -0.99731] } }
const g = (o) => ({ id: 'x', sport: 'baseball', start: '2026-07-10T00:05:00Z', home: { abbr: 'CHC' }, away: { abbr: 'MIL' }, teams: ['cubs'], ...o })
const now = Date.parse('2026-07-09T18:00:00Z') // Thu 13:00 CDT

describe('tonight', () => {
  it('prefers a live game, then pregame, then later today, then the next one', () => {
    expect(tonightsGame([W, U], { wrigleyfield: { state: 'pregame', game: g() }, unitedcenter: { state: 'live', game: g({ sport: 'basketball' }) } }, now)).toMatchObject({ venue: U, state: 'live' })
    expect(tonightsGame([W, U], { wrigleyfield: { state: 'idle', game: null, next: g() }, unitedcenter: { state: 'idle', game: null, next: g({ start: '2026-07-12T00:00:00Z' }) } }, now)).toMatchObject({ venue: W, state: 'later' })
    expect(tonightsGame([U], { unitedcenter: { state: 'idle', game: null, next: g({ start: '2026-07-12T00:00:00Z' }) } }, now)).toMatchObject({ state: 'upcoming' })
    expect(tonightsGame([W], { wrigleyfield: { state: 'idle', game: null, next: null } }, now)).toBeNull()
  })
  it('labels', () => {
    expect(stateLabel({ state: 'live' })).toBe('LIVE'); expect(stateLabel({ state: 'postgame' })).toBe('FINAL')
    expect(stateLabel({ state: 'idle', next: g() })).toBe('NEXT THU 7:05 PM'); expect(stateLabel(undefined)).toBe('NO GAMES')
    expect(gameLabel(g())).toBe('MIL @ CHC')
    expect(dataChip({ game: g({ simulated: true }) }, 'LIVE')).toBe('SIMULATED'); expect(dataChip({ game: g() }, 'LIVE')).toBe('LIVE')
  })
  it('venue focus: above the rim, looking into the bowl', () => {
    const b = venueFocusPose(W), f = venueFocusPose(S), a = venueFocusPose(U)
    expect(b.position[1]).toBeGreaterThanOrEqual(90)
    expect((b.position[0] - W.frame.origin[0]) * W.frame.axis[0] + (b.position[2] - W.frame.origin[1]) * W.frame.axis[1]).toBeLessThan(-100) // behind home plate
    expect(Math.hypot(b.target[0] - W.center[0], b.target[2] - W.center[1])).toBeLessThan(80)
    expect(f.position[0]).toBeLessThan(S.frame.origin[0] - 150) // off the west sideline
    expect(a.position[1]).toBeGreaterThanOrEqual(150)
  })
})

describe('gamePlaces', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useSports.setState(useSports.getInitialState()) })
  it('offers tonight’s game first, the panel, and one entry per venue', () => {
    const p = gamePlaces({ venues: [W, U], states: { wrigleyfield: { state: 'pregame', game: g() }, unitedcenter: { state: 'idle' } }, nowMs: now })
    expect(p.map((x) => x.id)).toEqual(['g:tonight', 'g:panel', 'g:wrigleyfield', 'g:unitedcenter'])
    expect(p[0]).toMatchObject({ kind: 'game', name: "Go to tonight's game" })
    expect(p[0].sub).toContain('MIL @ CHC')
    expect(p[2].aliases).toEqual(['Cubs'])
    p[0].run()
    expect(useStore.getState().flight.to).toEqual(venueFocusPose(W))
    expect(useSports.getState().cardVenue).toBe('wrigleyfield')
  })
  it('with no game anywhere, "tonight" opens the games panel', () => {
    const p = gamePlaces({ venues: [], states: {}, nowMs: now })
    p[0].run()
    expect(useStore.getState().gamesOpen).toBe(true)
  })
})
```

Create `app/src/hud/__tests__/sports.test.jsx`:

```jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ControlDock from '../ControlDock.jsx'
import GamesPanel from '../GamesPanel.jsx'
import VenueCard from '../VenueCard.jsx'
import { useStore } from '../../state/store.js'
import { useSports } from '../../sports/sportsStore.js'

const W = { key: 'wrigleyfield', name: 'Wrigley Field', kind: 'baseball', teams: ['cubs'], center: [-2292, -7339], frame: { origin: [-2325, -7319], axis: [0.70711, -0.70711] }, boards: [] }
const game = { id: 'x', sport: 'baseball', start: '2026-06-05T18:20:00Z', teams: ['cubs'], home: { abbr: 'CHC', score: 5 }, away: { abbr: 'NYM', score: 3 } }

describe('sports HUD', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState()); useSports.setState(useSports.getInitialState())
    useSports.setState({ venues: [W], states: { wrigleyfield: { state: 'postgame', game, next: null } }, source: 'LIVE', generatedAt: '2026-06-06T00:00:00Z' })
  })
  it('the Games button opens the panel; a row flies to the venue and opens its card', () => {
    render(<><ControlDock /><GamesPanel /></>)
    fireEvent.click(screen.getByRole('button', { name: /Games/ }))
    expect(useStore.getState().gamesOpen).toBe(true)
    expect(screen.getByRole('dialog', { name: 'Games' })).toHaveTextContent('Wrigley Field')
    expect(screen.getByRole('dialog', { name: 'Games' })).toHaveTextContent('FINAL')
    fireEvent.click(screen.getByRole('button', { name: /Wrigley Field/ }))
    expect(useStore.getState().flight.label).toBe('Wrigley Field')
    expect(useSports.getState().cardVenue).toBe('wrigleyfield')
    expect(useStore.getState().gamesOpen).toBe(false)
  })
  it('the venue card shows the score, the state and the data chip; Escape closes it', () => {
    useSports.setState({ cardVenue: 'wrigleyfield' })
    render(<VenueCard />)
    const card = screen.getByRole('dialog', { name: 'Wrigley Field' })
    expect(card).toHaveTextContent('NYM'); expect(card).toHaveTextContent('3'); expect(card).toHaveTextContent('CHC'); expect(card).toHaveTextContent('5')
    expect(card).toHaveTextContent('FINAL'); expect(card).toHaveTextContent('LIVE')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useSports.getState().cardVenue).toBeNull()
  })
})
```

Append to `app/src/hud/__tests__/palette.test.jsx`, inside the `describe`:

```jsx
  it('"tonight" finds tonight’s game; Enter flies there and opens the venue card', async () => {
    const { useSports } = await import('../../sports/sportsStore.js')
    const W = { key: 'wrigleyfield', name: 'Wrigley Field', kind: 'baseball', teams: ['cubs'], center: [-2292, -7339], frame: { origin: [-2325, -7319], axis: [0.70711, -0.70711] } }
    useSports.setState({ venues: [W], states: { wrigleyfield: { state: 'live', game: { id: 'x', sport: 'baseball', start: '2026-06-05T18:20:00Z', home: { abbr: 'CHC' }, away: { abbr: 'NYM' } } } } })
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tonight' } })
    expect(screen.getAllByRole('option')[0]).toHaveTextContent("Go to tonight's game")
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(useStore.getState().flight.label).toBe('Wrigley Field')
    expect(useSports.getState().cardVenue).toBe('wrigleyfield')
  })
```

Append to `app/src/hud/__tests__/help.test.jsx` (reuse that file's existing render helper and imports):

```jsx
describe('help: games', () => {
  it('explains the Games button and ⌘K "tonight"', () => {
    useStore.setState({ helpOpen: true })
    render(<HelpOverlay />)
    expect(screen.getByRole('dialog', { name: 'Controls' })).toHaveTextContent(/tonight/)
    expect(screen.getByRole('dialog', { name: 'Controls' })).toHaveTextContent(/Games/)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.**
Run: `cd app && npx vitest run src/sports/__tests__/tonight.test.js src/hud/__tests__/`
Expected: FAIL — `Failed to load url ../tonight.js` and `../GamesPanel.jsx`

- [ ] **Step 3: Implement.** Create `app/src/sports/venueFocus.js`:

```js
// app/src/sports/venueFocus.js — the camera pose that shows a venue's game (V7 wraps it with clearanceAt).
export function venueFocusPose(venue) {
  const [cx, cz] = venue.center
  const f = venue.frame
  if (f && venue.kind === 'baseball') {
    const [o, a] = [f.origin, f.axis]
    return { position: [o[0] - a[0] * 150, 105, o[1] - a[1] * 150], target: [o[0] + a[0] * 60, 5, o[1] + a[1] * 60] }
  }
  if (f) {
    const L = [f.axis[1], -f.axis[0]]
    return { position: [f.origin[0] + L[0] * 190, 120, f.origin[1] + L[1] * 190], target: [f.origin[0], 5, f.origin[1]] }
  }
  return { position: [cx + 230, 190, cz + 270], target: [cx, 15, cz] }
}
```

Check the Soldier Field axis before running: `[−0.073, −0.997]` gives `L = [−0.997, 0.073]`, so the camera sits about 190 m west. That is the west sideline, and it passes the test.

Create `app/src/sports/tonight.js`:

```js
// app/src/sports/tonight.js — "tonight's game", and the words the HUD uses for a venue's state.
import { chicagoDate, formatChicago } from './chicagoTime.js'

const RANK = { live: 3, pregame: 2, postgame: 1 }
export function tonightsGame(venues, states, nowMs) {
  let best = null
  for (const v of venues) {
    const st = states[v.key]
    if (st?.game && RANK[st.state] && (!best || RANK[st.state] > RANK[best.state])) best = { venue: v, game: st.game, state: st.state }
  }
  if (best) return best
  const today = chicagoDate(nowMs)
  let soon = null
  for (const v of venues) {
    const n = states[v.key]?.next
    if (!n) continue
    const t = Date.parse(n.start)
    if (!soon || t < soon.t) soon = { t, venue: v, game: n, state: chicagoDate(t) === today ? 'later' : 'upcoming' }
  }
  return soon && { venue: soon.venue, game: soon.game, state: soon.state }
}
export function stateLabel(st) {
  if (st?.state === 'live') return 'LIVE'
  if (st?.state === 'pregame') return 'STARTS SOON'
  if (st?.state === 'postgame') return 'FINAL'
  return st?.next ? `NEXT ${formatChicago(Date.parse(st.next.start)).toUpperCase()}` : 'NO GAMES'
}
export const gameLabel = (g) => `${g.away.abbr} @ ${g.home.abbr}`
export const dataChip = (st, source) => ((st?.game ?? st?.next)?.simulated ? 'SIMULATED' : source)
```

Create `app/src/sports/palette.js`:

```js
// app/src/sports/palette.js — the Games group in ⌘K (V7 contract: gamePlaces).
import { useStore } from '../state/store.js'
import { useSports } from './sportsStore.js'
import { teamByKey } from '../../../shared/teams.js'
import { venueFocusPose } from './venueFocus.js'
import { tonightsGame, stateLabel, gameLabel } from './tonight.js'
import { formatChicago } from './chicagoTime.js'

export function goToVenue(venue) {
  useStore.getState().startFlight(venueFocusPose(venue), venue.name)
  useSports.getState().openCard(venue.key)
}
const openPanel = () => useStore.getState().setGamesOpen(true)

export function gamePlaces({ venues, states, nowMs }) {
  const t = tonightsGame(venues, states, nowMs)
  const sub = t ? `${gameLabel(t.game)} · ${t.venue.name} · ${t.state === 'live' ? 'LIVE' : formatChicago(Date.parse(t.game.start))}` : 'No game scheduled — opens the games list'
  return [
    { id: 'g:tonight', kind: 'game', name: "Go to tonight's game", aliases: ['tonight', 'game', 'games', 'score', 'scores'], sub, run: () => (t ? goToVenue(t.venue) : openPanel()) },
    { id: 'g:panel', kind: 'game', name: 'Show games & scores', aliases: ['games', 'scores', 'schedule'], sub: 'Games', run: openPanel },
    ...venues.map((v) => ({ id: `g:${v.key}`, kind: 'game', name: `Games at ${v.name}`, aliases: v.teams.map((k) => teamByKey(k)?.name ?? k), sub: stateLabel(states[v.key]), run: () => goToVenue(v) })),
  ]
}
```

Create `app/src/hud/Sports.css`:

```css
.games { position: absolute; right: 224px; bottom: 228px; width: 300px; max-height: 60vh; overflow: auto; padding: 10px; animation: hud-rise 0.3s ease both; }
.games-head, .vc-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.games-head .dock-btn, .vc-head .dock-btn { flex: 0 0 32px; margin-left: auto; }
.games ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.games-row { width: 100%; display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; text-align: left; padding: 8px; border-radius: var(--r-sm); border: 1px solid var(--border); background: transparent; color: var(--text); cursor: pointer; }
.games-row:hover { border-color: var(--border-strong); background: rgba(var(--accent-rgb), 0.08); }
.games-sub { grid-column: 1 / -1; color: var(--text-dim, #9aa); font-family: var(--font-mono); font-size: 11px; }
.chip { font-family: var(--font-mono); font-size: 10px; padding: 2px 6px; border-radius: 999px; border: 1px solid var(--border); }
.chip-live { color: #ff5d5d; border-color: #ff5d5d; }
.chip-simulated { color: #ffb347; border-color: #ffb347; }
.venue-card { position: absolute; left: 16px; bottom: 120px; width: 280px; padding: 12px; animation: hud-rise 0.3s ease both; }
.vc-score { display: flex; flex-direction: column; gap: 4px; font-family: var(--font-mono); font-size: 20px; }
.vc-row { display: flex; justify-content: space-between; }
.vc-status, .vc-next, .vc-foot { margin: 6px 0 0; font-size: 12px; }
.vc-foot { color: var(--text-dim, #9aa); font-size: 11px; }
```

Create `app/src/hud/GamesPanel.jsx`:

```jsx
// app/src/hud/GamesPanel.jsx — every venue: its state, the matchup, and a one-click flight there.
import './Sports.css'
import { useEffect } from 'react'
import { RiCloseLine } from 'react-icons/ri'
import { useStore } from '../state/store.js'
import { useSports } from '../sports/sportsStore.js'
import { stateLabel, gameLabel, dataChip } from '../sports/tonight.js'
import { goToVenue } from '../sports/palette.js'

const ORDER = { live: 0, pregame: 1, postgame: 2, idle: 3 }
export default function GamesPanel() {
  const open = useStore((s) => s.gamesOpen)
  const venues = useSports((s) => s.venues), states = useSports((s) => s.states), source = useSports((s) => s.source)
  useEffect(() => {
    if (!open) return
    const k = (e) => { if (e.key === 'Escape') useStore.getState().setGamesOpen(false) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])
  if (!open) return null
  const rows = [...venues].sort((a, b) => (ORDER[states[a.key]?.state] ?? 3) - (ORDER[states[b.key]?.state] ?? 3))
  const close = () => useStore.getState().setGamesOpen(false)
  return (
    <div className="hud-panel games" role="dialog" aria-label="Games">
      <div className="games-head">
        <span className="hud-label">Games</span>
        <button type="button" className="dock-btn" aria-label="Close games" onClick={close}><RiCloseLine /></button>
      </div>
      {rows.length === 0 && <p className="games-sub">Venues are still loading…</p>}
      <ul>
        {rows.map((v) => {
          const st = states[v.key], g = st?.game ?? st?.next, chip = dataChip(st, source)
          return (
            <li key={v.key}>
              <button type="button" className="games-row" onClick={() => { close(); goToVenue(v) }}>
                <span>{v.name}</span>
                <span className={`chip chip-${st?.state ?? 'idle'}`}>{stateLabel(st)}</span>
                {g && <span className="games-sub">{gameLabel(g)} · <span className={`chip chip-${chip.toLowerCase()}`}>{chip}</span></span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

Create `app/src/hud/VenueCard.jsx`:

```jsx
// app/src/hud/VenueCard.jsx — the venue's score, state and next game. Esc or × closes it.
import './Sports.css'
import { useEffect } from 'react'
import { RiCloseLine } from 'react-icons/ri'
import { useSports } from '../sports/sportsStore.js'
import { boardLines } from '../sports/scoreboard.js'
import { stateLabel, gameLabel, dataChip } from '../sports/tonight.js'
import { formatChicago } from '../sports/chicagoTime.js'

export default function VenueCard() {
  const key = useSports((s) => s.cardVenue)
  const venue = useSports((s) => s.venues.find((v) => v.key === s.cardVenue))
  const st = useSports((s) => s.states[s.cardVenue])
  const source = useSports((s) => s.source), generatedAt = useSports((s) => s.generatedAt)
  const override = useSports((s) => s.boardOverrides[s.cardVenue])
  useEffect(() => {
    if (!key) return
    const k = (e) => { if (e.key === 'Escape') useSports.getState().openCard(null) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [key])
  if (!venue) return null
  const lines = boardLines(venue, st, Date.now(), override)
  const chip = dataChip(st, source)
  return (
    <div className="hud-panel venue-card" role="dialog" aria-label={venue.name}>
      <div className="vc-head">
        <span className="hud-title">{venue.name}</span>
        <span className={`chip chip-${st?.state ?? 'idle'}`}>{stateLabel(st)}</span>
        <button type="button" className="dock-btn" aria-label="Close" onClick={() => useSports.getState().openCard(null)}><RiCloseLine /></button>
      </div>
      {lines.rows.length > 0 && (
        <div className="vc-score">{lines.rows.map((r) => <div key={r.abbr} className="vc-row"><span>{r.abbr}</span><span>{r.score ?? '–'}</span></div>)}</div>
      )}
      <p className="vc-status">{lines.status}</p>
      {st?.next && <p className="vc-next">Next: {gameLabel(st.next)} · {formatChicago(Date.parse(st.next.start))}</p>}
      <p className="vc-foot"><span className={`chip chip-${chip.toLowerCase()}`}>{chip}</span> {chip === 'LIVE' ? `ESPN schedule as of ${generatedAt?.slice(0, 10)}` : 'Simulated schedule — typical home dates'}</p>
    </div>
  )
}
```

In `app/src/hud/ControlDock.jsx`:
- add `RiTrophyLine` to the `react-icons/ri` import;
- add `import { useSports } from '../sports/sportsStore.js'`;
- read `const live = useSports((s) => Object.values(s.states).some((x) => x?.state === 'live'))`;
- add a row before the last `dock-row`:

```jsx
      <div className="dock-row">
        <Btn label="Games — tonight's game and scores" onClick={() => useStore.getState().setGamesOpen(!useStore.getState().gamesOpen)} wide>
          <RiTrophyLine /><span>Games</span>{live && <span className="chip chip-live">LIVE</span>}
        </Btn>
      </div>
```

In `app/src/hud/CommandPalette.jsx`:
- add `RiTrophyLine` to the icon import;
- `import { useSports } from '../sports/sportsStore.js'` and `import { gamePlaces } from '../sports/palette.js'`;
- set `ICON.game = RiTrophyLine`, `SECTION.game = 'Games'`, and `const ORDER = ['game', 'landmark', 'neighborhood', 'view', 'command']`;
- in the component:

```jsx
  const venues = useSports((s) => s.venues)
  const sportStates = useSports((s) => s.states)
  const all = useMemo(() => [...gamePlaces({ venues, states: sportStates, nowMs: Date.now() }), ...buildPlaces(manifest, BOOKMARKS), ...commands()], [manifest, venues, sportStates])
```

- change the empty-query branch of `found` to:

```jsx
    const found = q.trim() ? searchPlaces(q, all) : [...all.filter((p) => p.id === 'g:tonight'), ...searchPlaces('', all.filter((p) => p.kind !== 'command' && p.kind !== 'game')), ...all.filter((p) => p.kind === 'command').slice(0, 5)]
```

In `app/src/lib/places.js`, change the bonus map to `const bonus = { landmark: 2, view: 1, neighborhood: 0, command: 1, game: 2 }`.

In `app/src/hud/HelpOverlay.jsx`, add a group after `'Search and fly'`:

```js
  ['Games', [['Games', "button on the right — tonight's game, live state, scores and the next game"], ['⌘K', 'type “tonight” to fly to tonight’s game'], ['Sound', 'button — hear the crowd near a live game (off until you turn it on)']]],
```

In `app/src/hud/HintBar.jsx`, insert `['⌘K tonight', 'game']` before `['?', 'help']`.

In `app/src/hud/Hud.jsx`, import `GamesPanel` and `VenueCard`, and render them after `<FlightChip />`.

- [ ] **Step 4: Run the tests to verify they pass.**
Run: `cd app && npm test`
Expected: PASS (the whole app suite, the existing palette, help and HUD tests included)

- [ ] **Step 5: Commit.**

```bash
git add app/src/sports/venueFocus.js app/src/sports/tonight.js app/src/sports/palette.js app/src/hud/GamesPanel.jsx app/src/hud/VenueCard.jsx app/src/hud/Sports.css app/src/hud/ControlDock.jsx app/src/hud/CommandPalette.jsx app/src/lib/places.js app/src/hud/HelpOverlay.jsx app/src/hud/HintBar.jsx app/src/hud/Hud.jsx app/src/sports/__tests__/tonight.test.js app/src/hud/__tests__/sports.test.jsx app/src/hud/__tests__/palette.test.jsx app/src/hud/__tests__/help.test.jsx
git commit -m "feat(hud): Games button and panel, ⌘K “Go to tonight's game”, venue card with score and next game (D12)"
```

- [ ] **Step 6: Walk it as a non-coder.** Run `npm run dev --prefix app`, open `/` with no parameters, and check each step:
  1. Click **Games**: the panel lists five venues with states.
  2. Click a row: the camera flies there and the card shows the score or next game, with a `LIVE`/`SIMULATED` chip.
  3. Press `Esc`: the card closes.
  4. Press ⌘K, type `tonight`, then Enter: the camera flies to the game.
  5. Press `?`: the help card shows the Games lines.

Take `docs/superpowers/ledgers/v5-shots/after-hud/games-panel.png` by hand, and record it in the ledger. Stop the dev server and commit the ledger.

---

### Task 21: Perf check, e2e, README gallery, push (D15 and the end of the milestone)

**Files:**
- Create: `app/e2e/v5-perf.spec.js`
- Modify: `app/e2e/hero-view.spec.js-snapshots/*` (only the views V5 changed), `README.md`, `docs/screenshots/v5-*.png` (new files only), the ledger
- Test: the perf spec itself

**Interfaces:**
- Consumes: `?pose=`, `?sports=`, `?stats` (`window.__gl`, `window.__store`).
- Produces: ledger lines `PERF <pose> <quality> <sports>: <calls> calls, <tris> tris, <fps> fps`, and assertions against the B.1.6 budgets.

- [ ] **Step 1: Write the perf spec.** Create `app/e2e/v5-perf.spec.js`:

```js
// app/e2e/v5-perf.spec.js — V5 perf check (B.1.6, D15). Run: V5_PERF=1 npx playwright test e2e/v5-perf.spec.js
import { test, expect } from '@playwright/test'

test.skip(!process.env.V5_PERF, 'set V5_PERF=1 to run the V5 perf check')
test.describe.configure({ mode: 'serial' })

const POSES = {
  streeterville: '1900,320,-1500,150,60,-350', loop: '-1100,520,900,150,40,-500', wabash: '150,55,-80,140,6,-440',
  'wrigley-bowl': '-2297,25,-7347,-2332,12,-7312', 'soldier-bowl': '850,60,2187,960,5,2187', 'rate-aerial': '-660,140,5623,-494,5,5786',
}
async function measure(page, { pose, time = 'night', sports = 'idle', quality = 'HIGH' }) {
  await page.clock.setFixedTime(new Date('2026-09-28T12:00:00-05:00'))
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto(`/?pose=${POSES[pose]}&time=${time}&sports=${sports}&stats=1`)
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
  await page.evaluate((q) => window.__store.getState().setQuality(q), quality)
  await page.waitForTimeout(6000)
  const r = await page.evaluate(() => new Promise((resolve) => {
    // Sum every render() of every pass (main, shadow, post) by hooking info.reset, whatever autoReset is.
    const info = window.__gl.info, orig = info.reset.bind(info), acc = { calls: 0, triangles: 0 }
    orig()
    info.reset = () => { acc.calls += info.render.calls; acc.triangles += info.render.triangles; orig() }
    let frames = 0
    const t0 = performance.now()
    const step = () => {
      if (++frames < 120) { requestAnimationFrame(step); return }
      info.reset = orig
      resolve({ calls: Math.round((acc.calls + info.render.calls) / frames), triangles: Math.round((acc.triangles + info.render.triangles) / frames), fps: +(frames / ((performance.now() - t0) / 1000)).toFixed(1) })
    }
    requestAnimationFrame(step)
  }))
  console.log(`PERF ${pose} ${quality} ${sports}: ${r.calls} calls, ${r.triangles} tris, ${r.fps} fps`)
  return r
}

test('wide poses stay within budget with every venue live', async ({ page }) => {
  for (const pose of ['streeterville', 'loop', 'wabash']) {
    for (const sports of ['idle', 'live']) {
      const r = await measure(page, { pose, sports })
      expect(r.calls, `${pose} ${sports}`).toBeLessThanOrEqual(900)
      expect(r.triangles, `${pose} ${sports}`).toBeLessThanOrEqual(4_000_000)
    }
  }
})

test('a live game adds at most 3 calls per venue (crowd, players, ball); none at LOW', async ({ page }) => {
  for (const pose of ['wrigley-bowl', 'soldier-bowl']) {
    const idle = await measure(page, { pose, sports: 'idle' }), live = await measure(page, { pose, sports: 'live' })
    expect(live.calls - idle.calls, pose).toBeLessThanOrEqual(3)
    const idleLow = await measure(page, { pose, sports: 'idle', quality: 'LOW' }), liveLow = await measure(page, { pose, sports: 'live', quality: 'LOW' })
    expect(liveLow.calls - idleLow.calls, `${pose} LOW`).toBe(0)
  }
})

test('crowds and players are culled beyond 1.5 km', async ({ page }) => {
  const idle = await measure(page, { pose: 'rate-aerial', sports: 'idle' }) // ~230 m from Rate Field
  const far = await measure(page, { pose: 'loop', sports: 'live' }), farIdle = await measure(page, { pose: 'loop', sports: 'idle' })
  expect(far.calls - farIdle.calls).toBeLessThanOrEqual(1) // at most one scoreboard within 3 km of the Loop pose
  expect(idle.calls).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run the perf check.** Close every other heavy process first.
Run: `cd app && V5_PERF=1 npx playwright test e2e/v5-perf.spec.js --reporter=line`
Expected: `3 passed`, with the `PERF …` lines printed.

Copy every `PERF` line into the ledger's *Perf* section.
- **If a wide pose exceeds 900 calls,** it is a V5 regression only when the `live` minus `idle` delta exceeds the scoreboard count. Record the numbers and a `Ruling:`; the budget enforcement over the whole scene is V8 (H11).
- **If a bowl delta exceeds 3,** find the extra mesh (`window.__gl.info` per component), fix it, and re-run.

- [ ] **Step 3: Run the full unit suites.**
Run: `npm test --prefix pipeline && npm test --prefix app && (cd app && TZ=Asia/Tokyo npx vitest run src/sports src/audio)`
Expected: all PASS

- [ ] **Step 4: Refresh the schedule and rebuild the world.** This is the end-of-milestone checklist item 2. The dev server must be stopped.
Run: `cd pipeline && npm run schedules && npm run build:world && du -sh ../app/public/world`
Expected: `schedules: … games`; the skyline assertion passes; `venues sidecar: …`; `manifest written`; ≤ 200 MB.

- [ ] **Step 5: Run the e2e tests, and regenerate only the baselines V5 changed.**
Run: `cd app && npx playwright test e2e/hero-view.spec.js --reporter=line`
Expected: failures only for views that show a venue (`wrigleyville @ day`, `museum @ day`, where Soldier Field is in frame). Open each diff. If the only change is the stadium (fields, roofs, lights), update just those:

Run: `cd app && npx playwright test e2e/hero-view.spec.js --update-snapshots -g "wrigleyville @ day|museum @ day"`

Then run `npx playwright test e2e/hero-view.spec.js` three times in a row.
Expected: `10 passed` each time. Any other failure is a regression: fix it, don't re-baseline it.

- [ ] **Step 6: README gallery.** New files only; never modify an existing image:

```bash
cp docs/superpowers/ledgers/v5-shots/after-state/soldier-aerial-game-night.png docs/screenshots/v5-soldier-field-night.png
cp docs/superpowers/ledgers/v5-shots/after-fields/wrigley-top-day.png docs/screenshots/v5-wrigley-field-day.png
cp docs/superpowers/ledgers/v5-shots/after-flag/wrigley-board-win-day.png docs/screenshots/v5-w-flag-day.png
cp docs/superpowers/ledgers/v5-shots/after-plaza/uc-plaza-night.png docs/screenshots/v5-united-center-night.png
```

Skip any image whose step was reverted, and pick another kept shot instead. Append to the README's "How it came together" gallery, after the V4 entries, one line per image:
- `v5-soldier-field-night.png` — *V5 · Soldier Field on a game night: rim floodlights, painted Bears end zones, a full bowl.*
- `v5-wrigley-field-day.png` — *V5 · Wrigley from above: crosshatched outfield, clay arc and chalk at MLB dimensions.*
- `v5-w-flag-day.png` — *V5 · After a Cubs win the W flies over the scoreboard.*
- `v5-united-center-night.png` — *V5 · United Center game night: lit fascia and the plaza crowd.*

In the roadmap, mark V5 done. Add "Games" to the controls table: `Games` button / ⌘K "tonight" — tonight's game, scores, next game.

- [ ] **Step 7: Commit and push.**

```bash
git add app/e2e/v5-perf.spec.js app/e2e/hero-view.spec.js-snapshots README.md docs/screenshots/v5-*.png docs/superpowers/ledgers/v5-stadiums-sports-life.md pipeline/data/schedules.json app/public/world
git commit -m "chore(v5): perf check, refreshed schedule and world, e2e baselines for changed venues, README gallery"
git push origin main
```

Expected: the push succeeds to AllStreets/Chicago-Open-World.

---

## Rulings made while writing this plan

Each ruling states its cost if it proves wrong.

**Data and positions**
- **Wintrust Arena position.** It is at (538, 3150), per `manifest.json`, not (−560, 3200). *Cost if wrong:* none; the poses read the manifest.
- **ESPN team IDs.** The IDs were verified live against `site.api.espn.com/…/teams/<abbr>`: Cubs 16, Sox 4, Bears 3, Bulls 4, Hawks 4, Fire 182, Sky 19. The sibling app's `112`, `145` and `1617` are not ESPN IDs. *Cost:* the wrong teams' schedules.
- **Season types.** They are fetched per league: NBA/NHL/NFL/WNBA 1–3, MLB 2–3, MLS none. ESPN's default is the preseason for the NBA. *Cost:* a missing regular season.
- **Where a game happens.** The venue is taken from the ESPN venue name, not from the team: the Sox have played at Wrigley, and the Sky at the UC. *Cost:* a game shown at the wrong venue.
- **Crosstown games.** They are merged by `league:id` into `teams[]` plus `results{}`. *Cost:* a Cubs W missed, or a double venue state.
- **Schedule freshness.** Build-time ESPN data reads `LIVE`; generated data reads `SIMULATED`. Data older than 45 days, or missing, falls back to simulated. A real game in progress without a feed shows `–` until Phase 5. *Cost:* chip semantics.
- **Phase 5 field names.** The schedule's games use `venue` and `results`, not the Phase 5 table's assumed `venueKey` / `result`. Phase 5 refreshes against V5 at its start. *Cost:* a one-line rename in P5.

**Rendering and budgets**
- **Fields are sampled inside the shared façade shader.** They use a `DataArrayTexture` layer chosen by `_SEED` slot, so they add 0 draw calls. *Cost:* field shading is tied to the façade shader.
- **Per-venue light.** Light comes through a spatial `uVenueLight[8]` uniform, with no new vertex attribute. It is 0.5 on an idle night (architectural lighting, so every stadium stays readable at night like Wrigley, per the user) and 1.0 for a game. *Coordinator override:* the writer proposed 0.2. *Cost:* the game-versus-idle contrast is subtler.
- **The sidecar.** It is one world-level `venues.json` plus Int16 `.bin` anchors, not a per-tile JSON. Player spots come from the field frame in the app. *Cost:* a small deviation from the master-plan wording.
- **Draw calls per venue.** Crowd plus players plus ball is exactly 3 calls per open-air venue; field fans ride the crowd call. Scoreboards (1 per board) and the W flag (1) sit outside the "≤ 3". *Cost:* up to 4 more calls near the venues.
- **The ball.** It is drawn at about 2× true size so its arc reads. *Cost:* a large ball close up.
- **Evaluation shots.** They live in the git-ignored `docs/superpowers/ledgers/v5-shots/`, and only README picks are committed. *Cost:* the shots are not in history.

**Field designs**
- **End zones.** BEARS is north and CHICAGO south, readable from midfield. Yard numbers read from mid-field facing the sideline. Verify against a photo in Task 13. *Cost:* a one-line swap.
- **Soldier Field for the Fire.** It is painted with soccer lines while a Fire game is current or within 36 h. *Cost:* football lines on some Fire days.

**Roofs and lights**
- **Arena roofs.**
  - United Center: a stepdome, base 30 m, a 7 m step of +2.5 m, dome +6.5 m.
  - Wintrust: a vault, 25 m + 5.5 m, ridge north–south.
  - Both come from OSM footprints and aerial imagery.
  - *Cost:* ±3 m of roof height.
- **Rate Field (D5).** It gets rim light rows on the upper-deck roof, and its towers are raised from 14 to 20 m. *Cost:* over-lit if the real towers are shorter.

**Game days**
- **The W flag.** It flies after any Cubs win, home or away, for the rest of that Chicago date. The latest game of a doubleheader decides. The L flag flies on losses. Wrigley holds a celebration crowd on W days. *Cost:* fans at Wrigley on away-win days.

**Controls and sound**
- **Contracts adopted from V7.**
  - `gamesOpen` / `setGamesOpen` live in `useStore`;
  - `venueFocusPose(venue)` is in `app/src/sports/venueFocus.js`; it does not apply clearance, which V7 wraps with `clearanceAt`;
  - `gamePlaces({ venues, states, nowMs })` is in `app/src/sports/palette.js`.
  - *Cost:* V7 adapter lines only.
- **Phase 5 hooks.** V5 ships `setScoreboard(venueKey, { home, away, status })` in `scoreboard.js` and `cheer(venueKey, strength)` in `audio/cheers.js`. *Cost:* none.
- **Audio context.** V5 creates its own lazy `AudioContext` and shares only `soundOn` / `setSoundOn` from V4's `useSoundStore`. *Cost:* a second AudioContext.
- **Keyboard.** There is no new keyboard shortcut for Games: a button plus ⌘K is enough, and V7 consolidates the dock. *Cost:* none.
- **The Jordan statue.** It is skipped: it has stood inside the United Center atrium since 2017. *Cost:* a missing easter egg.
