# Phase 5 — Alive: Live CTA, Live Scores, Weather and Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Later-phase plan (master-plan ruling, 2026-09-29).** This plan is written at task, interface and test level. Code-level implementation steps are completed at phase start, because they depend on what V1–V8 and Phases 3–4 actually shipped. Every task carries a **Refresh at phase start** note. Do that refresh first, edit this plan in place, then execute.

**Goal:** Make the city breathe:
- the CHI ATLAS API hookup, with a health probe and an honest `LIVE CTA` / `SIMULATED` chip;
- live L trains snapped onto V3's track paths, with V4's simulator as the fallback;
- live scores driving V5's stadium game state, scoreboards, cheers and W-flag days;
- weather states: overcast, rain, snow and lake fog;
- Scan, the holographic sweep over the city that the lens overlays live in.

**Architecture:**
- **Transport.** `services/chiApi.js` grows from Phase 4's `chiGet` into a small runtime with a boot probe (`/api/health`, 2 s), per-feed schedulers (interval, exponential backoff, paused while the tab is hidden) and per-feed status in the store. Every consumer reads a source interface, so live and simulated data are interchangeable.
- **Trains.** Live CTA trains go through a tracker that snaps each report onto V3 path arc length and interpolates forward-only between polls. The renderer asks one `trainsAt(tMs)` and never knows the source.
- **Sports.** Live games overlay V5's build-time schedule, so `gameState` stays a pure function.
- **Weather and Scan.** Both are uniform-driven on the shared façade and ground materials (no mesh swaps), plus at most one particle draw call.

**Tech Stack:** React 19, R3F 9, drei 10, zustand 5, three 0.186, Vitest 5 + RTL, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md`: §7 Scan, §8 HUD (chip, SCAN toggle), §10 Live data, §5 Weather, §11 (reduced motion), §12 (visual pose "Scan over LIVE"), Addendum B.1.5 (graceful live data), B.3 Motion (live snaps onto the same path; the simulator is the fallback), B.4 Game state. Backlog: I-5.1–I-5.5, C11, C12 (fallback), C16 (live arrivals), C19 (deferred), D6, D7, D11, D13, D10. Master plan: the P5 row.

## Refresh at phase start (2026-09-30) — what actually shipped, and the rulings that follow

The upstream table below was written before V1–V8 and Phases 3–4 landed. Checked against `main` at `2863a52`:

- `chiGet` / `chiBase` are in `app/src/services/chiApi.js` as assumed. CHI still serves `/api/health` → `{ status: 'ok' }` (`~/Downloads/chi/backend/server.js`). The P4 pollers live in `transit/lineAlerts.js` (`useLineAlerts`, 5 min) and `world/livePlaces.js` (`loadLivePlaces`, once per VISIT session).
- `transit.json` is V3's routes + services shape, not `lines[].paths[]`: `routes[] { id, line, path: [[x, y, z]], stops: [{ station, name, s }] }`, `services[] { id, line, routes[], inbound }`, `lines[].service` (stock, headways, vmax). Stations carry `{ id, name, operator, lines, x, y, z, grade, osm }` and **no CTA `mapId`**.
- V4's simulator is `createSim(transit).trainsAt(ms)` → `{ id, rn, line, service, destination, sHead, speed, head: { p, dir }, cars, nextStop }` (via `getSim()`), and `arrivalsAt(stationId, ms)` already returns CHI's arrivals shape. `Trains.jsx` calls `sim.trainsAt` and `publishTrains`.
- V5: `gameState(venueKey, nowMs, games)` with games `{ id, teams, results, sport, start (ISO), venue, home: { abbr, score }, away, state, status }`; `setScoreboard` (scoreboard.js) and `cheer` (audio/cheers.js) exist as Phase 5 hooks.
- Weather already has a home: the SUNNY / SNOW views (`lib/atmosphere.js` `overcast`, `snow`, `ice`, `fogScale`), eased in `SkyRig`'s `atmosphereNow`, with `SeasonRig` drawing the falling snow and settling it on roofs (`facadeUniforms.uSnow`, `groundUniforms.uSnow`, `waterUniforms.uIce`).
- Keys: **X is the Fireworks key** (P4/V8 user request), and the dock is a full 3 × 2 grid of six feature buttons (user: no dead space).
- The deployed site (`chicago-open-world.vercel.app`) has `VITE_CHI_API_URL` unset, so production runs simulated; CHI's backend needs secrets, so it is not started here — every live path is verified against mocked CHI payloads.

Ruling: Scan toggles on **V** (for "vision"; X is Fireworks, S is move-back). It gets a SCAN pill, ⌘K, a help line and a hint; it does **not** take a dock slot — the dock stays a full 3 × 2 grid (user: no dead space). Cost if wrong: one keymap line.
Ruling: weather reuses the SNOW view's systems instead of new ones: live weather feeds the same eased atmosphere (`overcast`, `snow`, `fogScale`, `sunScale`) that SkyRig already applies and SeasonRig already draws; rain adds one streak-particle draw beside SeasonRig's snow, and wind drifts both. No new façade uniforms for snow (`uSnow` exists). Cost if wrong: weather looks like the SNOW view's palette.
Ruling: weather only shapes the sky in the LIVE time view and in the Weather menu's manual choices; the DAY / SUNNY / SNOW looks keep their own designed weather. Cost if wrong: none — a choice from the Weather menu always applies.
Ruling: no `mapId` on V3 stations, so live station arrivals come from the live train feed itself (each CTA train reports its `nextStation` and `arrTime`); `parseArrivals` and the `/api/cta/arrivals` path stay for stations that gain a `mapId`. Offline, the card keeps V4's scheduled arrivals, labelled "scheduled". Cost if wrong: live mode lists only the next train per approaching run, not the full board.
Ruling: live trains snap onto V3 **services** (a line + direction, joined routes), so a live train is drawn exactly like a simulated one — same object shape, same instanced renderer, 0 extra draw calls. Cost if wrong: none.
Ruling: with no `VITE_CHI_API_URL` the probe answers `offline` at once and never re-probes (there is nothing to probe); with a URL it re-probes every 60 s while offline. Cost if wrong: none.
Ruling: the live chip keeps its place in the wordmark block and opens a plain-words "Data sources" popover; there is no other error UI. Cost if wrong: none.
Ruling: Phase 6 (the wider city) is deferred by the user ("I don't think we need to do the rest of the city — we can save that for later"); Phase 5 does not depend on it. Cost if wrong: none.

## Global Constraints

- **Live data (B.1.5).**
  - Every feed has a simulated or scheduled fallback. The chip reads `LIVE CTA` or `SIMULATED`.
  - **No error UI beyond the chip.**
  - At runtime every feed goes through the CHI ATLAS API. The app never calls CTA, ESPN or OpenWeather directly.
- **Base URL:** `VITE_CHI_API_URL`. When it is unset, the app runs fully simulated (see Rulings). CHI's CORS allows `FRONTEND_URL` and any `*.vercel.app` origin (`~/Downloads/chi/backend/server.js`). A non-Vercel host needs its origin added to CHI's `FRONTEND_URL`, which is the only permitted CHI edit (§14).
- **CHI endpoints consumed (verified against `~/Downloads/chi/backend`):**
  - `GET /api/health` → `{ status: 'ok' }`
  - `GET /api/cta/trains` → `{ trains: [{ rn, lat, lon, heading, line: 'Red'|'Blue'|'Brn'|'G'|'Org'|'P'|'Pink'|'Y', nextStation, predTime, arrTime }] }`, or 502 `{ error }`
  - `GET /api/cta/arrivals?mapid=<id>` → `{ arrivals: [{ station, line, destination, arrTime, isApproaching, isDelayed }] }`. `arrTime` is CTA local time with no offset (`YYYY-MM-DDTHH:mm:ss`, America/Chicago).
  - `GET /api/cta/alerts` → `{ alerts: [{ id, headline, impact, affected[] }] }` (Phase 4 parser)
  - `GET /api/weather` → `{ temp, tempF, dailyHighF, dailyLowF, feelsLike, feelsLikeF, humidity, windMph, wind: { speed, deg }, visibility (miles), description, icon (OpenWeather code, e.g. '10d'), city }`, or 503 when CHI has no key
  - `GET /api/sports` → `[{ name, sport, league, id, color, today: [Game], upcoming: [Game], error }]`, where `Game = { id, date, name, venue, status, state: 'pre'|'in'|'post', homeTeam, awayTeam, homeScore, awayScore }`. The teams are Cubs, White Sox, Bears, Bulls, Blackhawks and Fire. **The Sky are not in CHI**, so they stay scheduled.
  - `GET /api/places?type=…` (Phase 4, unchanged)
- **Poll cadence:** CTA trains 30 s; alerts 5 min; weather 10 min; sports 60 s from 90 min before first pitch or kickoff until 60 min after a final, otherwise 10 min (CHI caches 90 s); places on lens entry only.
- **Budgets (B.1.6):**
  - HIGH ≤ 900 draw calls at the wide Streeterville and Loop poses.
  - Weather adds ≤ 1 draw call, and Scan overlays ≤ 2. Live trains add 0, because they reuse V4's instanced renderer.
  - ≤ 4 M triangles; 60 fps on M-series.
  - LOW keeps 25 % of the particles and no Scan grid animation.
- **Human-first (B.1.4).** Scan has a **SCAN** pill (top right, per spec §8), a dock button, a ⌘K entry, a key and a help and hint line. Weather has a **Weather** pill menu, ⌘K entries and a help line. The chip opens a plain-words "Data sources" popover.
- **Keys:** Scan = **X** (see Rulings; `S` is taken by WASD movement). No other new single keys.
- **Reduced motion (§11):** no sweep, a 0.4 s cross-fade instead; no lightning flashes; slower particles.
- **Evaluate and revert (B.1.2):** day, dusk and night screenshots before and after for every weather state and for Scan.
- **README gallery only appends:** `docs/screenshots/p5-<subject>-<time>.png`.
- Ledger: `.superpowers/sdd/2026-09-29-phase-5-alive/progress.md`. Push at the end of the phase and after each task.

## Review Focus

1. **The API flapping (live → offline → live) or the laptop sleeping for an hour.** Trains must not teleport in a burst, pile up, or fly backwards when feeds resume. The chip must settle within one poll. This is pinned in Task 1 (the backoff and resume tests) and Task 2 (the tracker drops trains older than 90 s and teleports rather than sweeping on jumps over 1,500 m).
2. **A live train report that does not fit any track** (GPS noise, a train on a line segment not in V3's data, or a heading of 0 for a stopped train). It must be dropped or snapped sensibly, never drawn floating off the structure. This is pinned in Task 2 (> 60 m returns `null`; a heading-0 tie-break by nearest path).
3. **Timezones in arrivals and games.** CTA `arrTime` has no offset, and ESPN dates are UTC. A viewer outside Chicago must still see "3 min", not "−297 min". This is pinned in Task 2 (`minutesUntil` with a fixed `now` and the America/Chicago offset, across DST) and Task 3 (the game date is compared in Chicago local date).
4. **Weather with an unknown icon code, missing fields, or CHI returning 503 (no key).** This must fall back to clear, with the chip still honest, and must never throw inside `useFrame`. This is pinned in Task 4 (`weatherFromChi(null)`, an unknown icon, a missing visibility).
5. **Toggling Scan rapidly (X X X) or while a flight or tour runs.** The sweep must reverse smoothly from wherever it is, never jump or strobe, and never leave the city half-scanned. This is pinned in Task 5 (the re-toggle mid-sweep continuity test).

---

## Upstream contracts assumed (verify at phase start)

| Symbol | From | Assumed shape | Refresh check |
|---|---|---|---|
| `chiGet(path, opts)` | P4 | never throws; returns `null` on failure | `app/src/services/chiApi.js` |
| `CHI_LINE`, `alertsToLinePulses` | P4 | as the P4 plan | `app/src/lib/nearestTransit.js`, `alerts.js` |
| `transit.json` | V3 | `lines[].paths[] { id, dir, points [[x,z]] }`, `stations[] { id, mapId, name, x, z, lines }` | `jq` sample |
| Simulator | V4 | `app/src/transit/sim.js` exports `trainsAt(tMs, transit) → [{ id, lineId, pathId, s, dir, cars, speed, dwellStationId }]` | read `sim.js` exports |
| Train renderer | V4 | consumes `trainsAt`, and places cars by sampling the path at `s` minus the car offsets | read V4's renderer |
| Station and train card | V4 (C16) | shows arrivals from the sim; this plan adds live | read V4's card |
| `gameState` | V5 | `app/src/sports/gameState.js`: `gameState(venueKey, nowMs, schedule) → { state: 'idle'|'pregame'|'live'|'postgame', winDay, game }`; `schedules.json` `{ games: [{ id, venueKey, start, home, away, result? }] }` | read V5 |
| Scoreboard texture, cheers | V5 (D13, D10) | `setScoreboard(venueKey, { home, away, status })`; `cheer(venueKey, strength)` gated by `soundStore.soundOn` (V4) | read V5 |
| Façade material | Phase 2 + V2 | `facadeUniforms` + `patchFacadeShader` in `world/materials/facadeMaterial.js` | read the file |
| Ground material | Phase 2 | `groundUniforms`, `patchGroundShader` | read `groundShader.js` |
| Shore distance texture | V1 (B6) | `water/shore.png`, 4 m/px over the lake band, with its bounds in the manifest | `jq '.water'` manifest |
| Subway ghost lines | V3 (C5) | ghost line mesh hidden by default; `setSubwayGhost(on)` or equivalent | read V3 |
| Scan-able lens overlays | P4 | `Isochrones`, `NeighborhoodZones`, `Beacons`, `neighborhoods.json` with `feel` and `rent` | read P4 |

---

## File Structure

```
app/src/
  services/chiApi.js              (modify) probeHealth, createFeed, nextDelay, FEEDS
  services/feeds.js               (create) wires every feed to the store at boot (one place to read the cadence)
  state/store.js                  (modify) apiStatus, feeds{}, setFeed; weatherMode, weather; scan, scanStartedAt, scanMetric
  hud/LiveChip.jsx, LiveChip.css  (create) chip + "Data sources" popover
  hud/WordmarkBlock.jsx           (modify) mount LiveChip
  transit/liveTrains.js           (create) snapToTrack, createLiveTracker
  transit/trainSource.js          (create) pickTrains({ feeds, tracker, sim, tMs })
  transit/arrivals.js             (create) parseArrivals, minutesUntil, chicagoOffsetMinutes
  sports/liveScores.js            (create) VENUE_KEYS, parseChiSports, overlayLive, scoreEvents, sportsInterval
  sports/gameState.js             (modify, V5 file) prefer game.live when present
  weather/weatherState.js         (create) weatherFromChi, weatherVisuals, tweenWeather, wrapParticle
  world/Weather.jsx               (create) one particle InstancedMesh; drives uniforms
  world/materials/facadeMaterial.js (modify) uWet, uSnow, uScan*, scan shading chunk
  world/materials/groundShader.js (modify) uWet, uSnow, uScan grid
  world/SkyRig.jsx                (modify) overcast desaturation, scan sky fade, lake fog density
  scan/scanMath.js                (create) SCAN_SECONDS, scanRadiusAt, scanBlend, scanUniformsAt, landmarkHeat, columnHeights
  scan/ScanController.jsx         (create) key X, uniforms per frame, overlay switching
  scan/ScanOverlays.jsx           (create) VISIT heat plane, LIVE light columns
  hud/ControlPills.jsx            (modify) SCAN pill, Weather pill menu
  hud/ControlDock.jsx             (modify) Scan button
  hud/CommandPalette.jsx          (modify) Scan, Weather, Data commands
  hud/HelpOverlay.jsx, HintBar.jsx (modify)
  hud/panels/LivePanel.jsx        (modify) Scan metric selector
  */__tests__/*.test.js(x)        (create per task)
app/e2e/scan-live.spec.js         (create) spec §12 pose "Scan over LIVE"
```

---

### Task 1: CHI API hookup — health probe, feed scheduler, `LIVE`/`SIMULATED` chip (I-5.1)

**Files:**
- Modify: `app/src/services/chiApi.js`, `app/src/state/store.js`, `app/src/hud/WordmarkBlock.jsx`, `app/src/hud/CommandPalette.jsx`
- Create: `app/src/services/feeds.js`, `app/src/hud/LiveChip.jsx`, `app/src/hud/LiveChip.css`
- Test: `app/src/services/__tests__/chiApi.test.js` (append), `app/src/services/__tests__/feeds.test.js`, `app/src/hud/__tests__/liveChip.test.jsx`

**Interfaces:**
- Consumes: `chiGet`, `chiBase` (P4).
- Produces:
  - `async probeHealth({ base = chiBase(), fetchImpl = fetch, timeoutMs = 2000 } = {}) → 'live' | 'offline'`. It is `'live'` only when `/api/health` returns 2xx with `status === 'ok'`.
  - `nextDelay(intervalMs, failures) → ms`, which is `min(intervalMs × 2^failures, 5 × 60_000)`
  - `createFeed({ name, path, intervalMs, parse = (j) => j, onData, onStatus, get = chiGet, schedule = setTimeout, cancel = clearTimeout, isHidden = () => document.hidden }) → { start(), stop(), refresh() }`:
    - On success it calls `onData(parse(json))` and `onStatus('LIVE')`, and resets the failure count.
    - On `null` or a parse throw it calls `onStatus('SIMULATED')`, and the next delay uses the backoff.
    - While hidden it does not fetch; on `visibilitychange` to visible it calls `refresh()`.
  - `FEEDS = { cta: { path: '/api/cta/trains', intervalMs: 30_000 }, alerts: { path: '/api/cta/alerts', intervalMs: 300_000 }, weather: { path: '/api/weather', intervalMs: 600_000 }, sports: { path: '/api/sports', intervalMs: 600_000 } }`
  - Store: `apiStatus: 'unknown'|'live'|'offline'`; `feeds: { cta, alerts, weather, sports, places }`, each `'LIVE'|'SIMULATED'` (initially `'SIMULATED'`); `setFeed(name, status)`; `setApiStatus(s)`.
  - `startFeeds(store) → stop()` (in `feeds.js`). Boot: `probeHealth` → `setApiStatus`. When `'offline'`, it re-probes every 60 s, and starts the feeds on success. It migrates P4's alert and places pollers onto `createFeed`.
  - `<LiveChip/>`:
    - `.hud-chip.live` reading `LIVE CTA` when `feeds.cta === 'LIVE'`, otherwise `.hud-chip` reading `SIMULATED`.
    - Clicking it opens a popover listing each feed in plain words, e.g. "Trains — live from CTA Train Tracker, updated 12 s ago" or "Weather — simulated (clear sky)".
    - It has a **Try live again** button that calls `refresh()` on every feed.
  - ⌘K: `Data: try live again`, `Data: show sources`.

- [ ] **Step 1: Write the failing tests**

```js
// append to app/src/services/__tests__/chiApi.test.js
import { probeHealth, nextDelay } from '../chiApi.js'
describe('probeHealth', () => {
  it('live only for 2xx with status ok', async () => {
    expect(await probeHealth({ base: 'b', fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ status: 'ok' }) }) })).toBe('live')
    expect(await probeHealth({ base: 'b', fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ status: 'down' }) }) })).toBe('offline')
    expect(await probeHealth({ base: 'b', fetchImpl: async () => { throw new TypeError('CORS') } })).toBe('offline')
    expect(await probeHealth({ base: '' })).toBe('offline')
  })
  it('backoff doubles and caps at 5 minutes', () => {
    expect(nextDelay(30_000, 0)).toBe(30_000); expect(nextDelay(30_000, 2)).toBe(120_000); expect(nextDelay(30_000, 10)).toBe(300_000)
  })
})
```

```js
// app/src/services/__tests__/feeds.test.js
import { describe, it, expect, vi } from 'vitest'
import { createFeed } from '../chiApi.js'

function harness(responses, hidden = false) {
  const timers = []
  const statuses = [], data = []
  let i = 0
  const feed = createFeed({
    name: 'cta', path: '/api/cta/trains', intervalMs: 30_000,
    get: vi.fn(async () => responses[Math.min(i++, responses.length - 1)]),
    onData: (d) => data.push(d), onStatus: (s) => statuses.push(s),
    schedule: (fn, ms) => { timers.push({ fn, ms }); return timers.length }, cancel: () => {}, isHidden: () => hidden,
  })
  return { feed, timers, statuses, data }
}
describe('createFeed', () => {
  it('reports LIVE with data, then SIMULATED with backoff on failure, then LIVE again', async () => {
    const h = harness([{ trains: [] }, null, null, { trains: [1] }])
    await h.feed.refresh(); expect(h.statuses.at(-1)).toBe('LIVE'); expect(h.timers.at(-1).ms).toBe(30_000)
    await h.feed.refresh(); expect(h.statuses.at(-1)).toBe('SIMULATED'); expect(h.timers.at(-1).ms).toBe(60_000)
    await h.feed.refresh(); expect(h.timers.at(-1).ms).toBe(120_000)
    await h.feed.refresh(); expect(h.statuses.at(-1)).toBe('LIVE'); expect(h.timers.at(-1).ms).toBe(30_000)
    expect(h.data).toEqual([{ trains: [] }, { trains: [1] }])
  })
  it('does not fetch while the tab is hidden', async () => {
    const h = harness([{ trains: [] }], true)
    await h.feed.refresh(); expect(h.data).toEqual([])
  })
  it('a parse error counts as a failure, not a crash', async () => {
    const statuses = []
    const feed = createFeed({ name: 'w', path: '/x', intervalMs: 1000, get: async () => ({}), parse: () => { throw new Error('bad') }, onData: () => {}, onStatus: (s) => statuses.push(s), schedule: () => 0, cancel: () => {}, isHidden: () => false })
    await feed.refresh(); expect(statuses).toEqual(['SIMULATED'])
  })
})
```

```jsx
// app/src/hud/__tests__/liveChip.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LiveChip from '../LiveChip.jsx'
import { useStore } from '../../state/store.js'

describe('LIVE / SIMULATED chip', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('reads SIMULATED by default and LIVE CTA when the CTA feed is live', () => {
    const { rerender } = render(<LiveChip />)
    expect(screen.getByText('SIMULATED')).toBeInTheDocument()
    useStore.getState().setFeed('cta', 'LIVE'); rerender(<LiveChip />)
    expect(screen.getByText('LIVE CTA')).toBeInTheDocument()
  })
  it('opens a plain-words data sources popover with a retry button', () => {
    render(<LiveChip />)
    fireEvent.click(screen.getByRole('button', { name: /data sources/i }))
    expect(screen.getByText(/Trains/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try live again/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify they fail.** Run `npm test --prefix app -- src/services src/hud/__tests__/liveChip.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. Remove P4's ad-hoc pollers in favour of `startFeeds`.
- [ ] **Step 4: Run the tests to verify they pass.** Run the manual check (one heavy process): the dev app with CHI's backend running locally on `:3001` (`VITE_CHI_API_URL=http://localhost:3001`), then with it stopped. The chip must flip within one poll each way. Log both.
- [ ] **Step 5: Commit and push.** `git commit -m "feat(p5): CHI API probe, feed scheduler, LIVE/SIMULATED chip (I-5.1)"`

**Acceptance:**
- Per spec §10: a 2 s probe, the chip, and no error UI.
- Offline, every feed reads SIMULATED and the app is fully usable.

**Refresh at phase start:**
- Confirm CHI's production origin and whether this app deploys on `*.vercel.app`. If it does not, add its origin to CHI's `FRONTEND_URL` (the only permitted CHI edit).
- Check whether CHI still serves `/api/health`.
- Check the P4 pollers' actual locations.

---

### Task 2: Live CTA trains on the V3 paths, sim fallback, live arrivals (I-5.2, C11, C16)

**Files:**
- Create: `app/src/transit/liveTrains.js`, `app/src/transit/trainSource.js`, `app/src/transit/arrivals.js`
- Modify: V4's train renderer (call `pickTrains` instead of `sim.trainsAt`), V4's station and train card (live arrivals and a "live" tag), `app/src/services/feeds.js` (cta feed → `tracker.ingest`)
- Test: `app/src/transit/__tests__/liveTrains.test.js`, `app/src/transit/__tests__/trainSource.test.js`, `app/src/transit/__tests__/arrivals.test.js`

**Interfaces:**
- Consumes: `CHI_LINE` (P4); `transit.json` paths (V3); `project` (`shared/project.js`); V4 `trainsAt(tMs, transit)`; `feeds.cta`.
- Produces:
  - `snapToTrack({ lat, lon, heading, lineId }, paths: { id, lineId, points: [x, z][] }[], project) → { pathId, s, errM } | null`. It chooses among the paths of `lineId` whose local tangent bearing is within 90° of `heading`. When `heading` is not finite, or 0 for a stopped train, it takes the nearest path. It returns `null` when `errM > 60`.
  - `createLiveTracker({ paths, maxSpeed = 25, teleportM = 1500, staleMs = 90_000, project }) → { ingest(trains: ChiTrain[], tMs), trainsAt(tMs) → LiveTrain[] , size() }`:
    - `LiveTrain = { id: 'rn:<rn>', lineId, pathId, s, dir: +1, speed, live: true, nextStation }`.
    - `ingest` snaps each report and estimates speed from the previous snap on the same path, `clamp(Δs/Δt, 0, maxSpeed)`. A different path, or `|Δs| > teleportM`, teleports.
    - `trainsAt` advances `s` forward only, by `speed × (t − tLast)`, capped at the next report's plausible reach (`speed × 45 s`). It drops trains unseen for `staleMs`.
  - `pickTrains({ ctaStatus, tracker, simTrainsAt, tMs }) → Train[]`:
    - CTA lines come from `tracker.trainsAt` when `ctaStatus === 'LIVE' && tracker.size() > 0`, otherwise from the sim.
    - Metra always comes from the sim (it has no live feed).
    - Live and sim trains for the same CTA line are never mixed.
  - `chicagoOffsetMinutes(dateMs) → number` (−300 in CDT, −360 in CST), via `Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', timeZoneName: 'shortOffset' })`
  - `minutesUntil(arrTime: 'YYYY-MM-DDTHH:mm:ss', nowMs) → integer` (≥ 0; "Due" is shown at 0)
  - `parseArrivals(json, nowMs) → [{ lineId, destination, minutes, isApproaching, isDelayed }]`, sorted by minutes, ignoring malformed rows.
  - V4's card: when `feeds.cta === 'LIVE'`, it fetches `/api/cta/arrivals?mapid=<station.mapId>` through `chiGet` on open and every 30 s while open; otherwise it shows the sim arrivals, labelled "scheduled".

- [ ] **Step 1: Write the failing tests**

```js
// app/src/transit/__tests__/liveTrains.test.js
import { describe, it, expect } from 'vitest'
import { snapToTrack, createLiveTracker } from '../liveTrains.js'

// Flat-earth test projection: 1e-5° ≈ 1 m
const project = (lon, lat) => [lon * 1e5, -lat * 1e5]
const unproj = (x, z) => ({ lon: x / 1e5, lat: -z / 1e5 })
const paths = [
  { id: 'red-n', lineId: 'red', points: [[0, 0], [0, -5000]] },   // northbound: bearing 0°
  { id: 'red-s', lineId: 'red', points: [[8, -5000], [8, 0]] },   // southbound: bearing 180°
  { id: 'blue-0', lineId: 'blue', points: [[-3000, 0], [-3000, -5000]] },
]
const at = (x, z, heading, lineId = 'red') => ({ ...unproj(x, z), heading, lineId })

describe('snapToTrack', () => {
  it('snaps onto the path matching the heading, with arc length', () => {
    const n = snapToTrack(at(3, -1000, 2), paths, project); expect(n.pathId).toBe('red-n'); expect(n.s).toBeCloseTo(1000, 0)
    const s = snapToTrack(at(5, -1000, 181), paths, project); expect(s.pathId).toBe('red-s'); expect(s.s).toBeCloseTo(4000, 0)
  })
  it('rejects reports more than 60 m from any path of the line', () => {
    expect(snapToTrack(at(200, -1000, 0), paths, project)).toBeNull()
  })
  it('never snaps a Red train onto the Blue line', () => {
    expect(snapToTrack(at(-3000, -1000, 0), paths, project)).toBeNull()
  })
  it('heading 0 or NaN falls back to the nearest path', () => {
    expect(snapToTrack(at(7, -1000, NaN), paths, project).pathId).toBe('red-s')
  })
})

describe('live tracker', () => {
  const trains = (z, rn = '801', heading = 0) => [{ rn, ...unproj(0, z), heading, line: 'Red', nextStation: 'Belmont' }]
  it('interpolates forward between polls at the estimated speed', () => {
    const t = createLiveTracker({ paths, project })
    t.ingest(trains(-1000), 0); t.ingest(trains(-1300), 30_000)
    const mid = t.trainsAt(45_000)[0]
    expect(mid.speed).toBeCloseTo(10, 1); expect(mid.s).toBeCloseTo(1450, 0); expect(mid.lineId).toBe('red')
  })
  it('never moves backwards on a small negative GPS jitter', () => {
    const t = createLiveTracker({ paths, project })
    t.ingest(trains(-1000), 0); t.ingest(trains(-990), 30_000)
    expect(t.trainsAt(40_000)[0].s).toBeGreaterThanOrEqual(1000 - 1e-6)
  })
  it('teleports on a jump over 1,500 m instead of sweeping', () => {
    const t = createLiveTracker({ paths, project })
    t.ingest(trains(-500), 0); t.ingest(trains(-3500), 30_000)
    expect(t.trainsAt(30_000)[0].s).toBeCloseTo(3500, 0); expect(t.trainsAt(30_000)[0].speed).toBe(0)
  })
  it('drops trains unseen for 90 s', () => {
    const t = createLiveTracker({ paths, project })
    t.ingest(trains(-1000), 0); expect(t.trainsAt(91_000)).toHaveLength(0)
  })
})
```

```js
// app/src/transit/__tests__/trainSource.test.js
import { describe, it, expect } from 'vitest'
import { pickTrains } from '../trainSource.js'

const sim = () => [{ id: 's1', lineId: 'red', s: 1 }, { id: 's2', lineId: 'metra-upn', s: 2 }]
const tracker = (n) => ({ size: () => n, trainsAt: () => (n ? [{ id: 'rn:801', lineId: 'red', s: 5, live: true }] : []) })
describe('pickTrains', () => {
  it('uses live CTA trains plus simulated Metra when the CTA feed is live', () => {
    const r = pickTrains({ ctaStatus: 'LIVE', tracker: tracker(1), simTrainsAt: sim, tMs: 0 })
    expect(r.map((t) => t.id).sort()).toEqual(['rn:801', 's2'])
  })
  it('falls back to the simulator when the feed is simulated or empty', () => {
    expect(pickTrains({ ctaStatus: 'SIMULATED', tracker: tracker(1), simTrainsAt: sim, tMs: 0 }).map((t) => t.id)).toEqual(['s1', 's2'])
    expect(pickTrains({ ctaStatus: 'LIVE', tracker: tracker(0), simTrainsAt: sim, tMs: 0 }).map((t) => t.id)).toEqual(['s1', 's2'])
  })
})
```

```js
// app/src/transit/__tests__/arrivals.test.js
import { describe, it, expect } from 'vitest'
import { minutesUntil, parseArrivals, chicagoOffsetMinutes } from '../arrivals.js'

describe('arrivals', () => {
  it('knows Chicago is UTC−5 in summer and UTC−6 in winter', () => {
    expect(chicagoOffsetMinutes(Date.UTC(2026, 6, 1))).toBe(-300)
    expect(chicagoOffsetMinutes(Date.UTC(2026, 0, 15))).toBe(-360)
  })
  it('reads CTA local times correctly for a viewer in any timezone', () => {
    const now = Date.UTC(2026, 8, 29, 19, 0, 0) // 14:00 CDT
    expect(minutesUntil('2026-09-29T14:03:00', now)).toBe(3)
    expect(minutesUntil('2026-09-29T13:59:00', now)).toBe(0)
  })
  it('parses, maps lines and sorts; ignores malformed rows', () => {
    const now = Date.UTC(2026, 8, 29, 19, 0, 0)
    const r = parseArrivals({ arrivals: [
      { station: 'Grand', line: 'Red', destination: 'Howard', arrTime: '2026-09-29T14:07:00', isApproaching: false, isDelayed: false },
      { station: 'Grand', line: 'Red', destination: '95th/Dan Ryan', arrTime: '2026-09-29T14:02:00', isApproaching: true, isDelayed: false },
      { station: 'Grand', line: 'Nope' },
    ] }, now)
    expect(r.map((a) => a.minutes)).toEqual([2, 7]); expect(r[0].lineId).toBe('red')
    expect(parseArrivals(null, now)).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify they fail.** Run `npm test --prefix app -- src/transit`. Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. Car count per live train uses V4's per-line typical consist (the feed has no consist size).
- [ ] **Step 4: Run the tests to verify they pass.** Manual live check against CHI (local backend with `CTA_API_KEY`): compare 10 trains against the CTA Train Tracker map within one poll. Log the matches and any rejections (`errM`).
- [ ] **Step 5: Perf check.** Train draw calls are unchanged (≤ 8, B.3), and `trainsAt` costs ≤ 0.3 ms per frame with ~120 live trains.
- [ ] **Step 6: Commit and push.** `git commit -m "feat(p5): live CTA trains snapped to track, sim fallback, live arrivals (C11)"`

**Acceptance:**
- With the API live, the chip reads `LIVE CTA` and train positions match the tracker within one poll (C11).
- Offline, trains still run and the chip reads `SIMULATED` (C12).
- Station cards show live arrivals (C16).

**Refresh at phase start:**
- Read V4's `sim.js` and renderer signatures, and the train object shape (fields, whether `dir` is signed or a path id).
- Check whether V3 paths carry `lineId` and a per-path direction.
- Check whether V3 stations carry the CTA `mapId`.
- Check whether the follow cam (V4) keys on train `id`: live ids are `rn:<rn>`, so the follow must survive a live/sim switch by falling back to the nearest train on the same line.

---

### Task 3: Live sports into V5 game state (I-5.5: D6, D7, D11, D13)

**Files:**
- Create: `app/src/sports/liveScores.js`
- Modify: `app/src/sports/gameState.js` (V5; prefer `game.live`), `app/src/services/feeds.js` (the sports feed with an adaptive interval), the V5 scoreboard and cheer hooks
- Test: `app/src/sports/__tests__/liveScores.test.js`, `app/src/sports/__tests__/gameState.test.js` (append)

**Interfaces:**
- Consumes: V5 `gameState`, `schedules.json`, `setScoreboard`, `cheer`, `soundStore.soundOn` (V4).
- Produces:
  - `VENUE_KEYS = { 'Wrigley Field': 'wrigleyfield', 'Rate Field': 'ratefield', 'Guaranteed Rate Field': 'ratefield', 'Soldier Field': 'soldierfield', 'United Center': 'unitedcenter', 'Wintrust Arena': 'wintrust' }`. Unknown venues (away games, SeatGeek Stadium) map to `null`.
  - `parseChiSports(json) → [{ team, league, games: LiveGame[] }]`:
    - `LiveGame = { id, venueKey|null, startMs, state: 'pre'|'in'|'post', status, homeTeam, awayTeam, homeScore: number|null, awayScore: number|null }`.
    - It tolerates `error` fields, missing arrays and string scores ("3" → 3).
  - `overlayLive(schedule, liveGames) → schedule`. It is a copy in which each game matching by ESPN id, or by venue + start within 3 h, gains `live: { state, homeScore, awayScore, status }`. Home games at in-bounds venues with no schedule match are appended.
  - V5 `gameState` change: when `game.live` exists, `'in'` → `live`; `'post'` → `postgame` for 60 min after the last update, then `idle`; `'pre'` → V5's own time window.
  - `cubsWonOn(liveGames, chicagoDate: 'YYYY-MM-DD') → boolean`: a Cubs game in state `post` on that Chicago-local date where the Cubs' score is greater (home or away). This feeds `winDay` (D11) along with V5's build-time results.
  - `scoreEvents(prevGames, nextGames) → [{ venueKey, side: 'home'|'away', delta }]`. This fires the cheers (D10), only when the Sound button is on.
  - `sportsInterval(liveGames, nowMs) → ms`: 60 000 from 90 min before any in-bounds start until 60 min after its final, otherwise 600 000.

- [ ] **Step 1: Write the failing tests**

```js
// app/src/sports/__tests__/liveScores.test.js
import { describe, it, expect } from 'vitest'
import { parseChiSports, overlayLive, cubsWonOn, scoreEvents, sportsInterval, VENUE_KEYS } from '../liveScores.js'

const chi = [
  { name: 'Cubs', league: 'mlb', today: [{ id: '401', date: '2026-09-29T18:05Z', venue: 'Wrigley Field', status: 'Final', state: 'post', homeTeam: 'Chicago Cubs', awayTeam: 'St. Louis Cardinals', homeScore: '5', awayScore: '3' }], upcoming: [] },
  { name: 'White Sox', league: 'mlb', today: [{ id: '402', date: '2026-09-29T23:10Z', venue: 'Rate Field', status: 'Top 3rd', state: 'in', homeTeam: 'Chicago White Sox', awayTeam: 'Detroit Tigers', homeScore: '1', awayScore: '0' }], upcoming: [] },
  { name: 'Bears', league: 'nfl', today: [], upcoming: [], error: 'ESPN 500' },
]
describe('live sports', () => {
  const teams = parseChiSports(chi)
  const games = teams.flatMap((t) => t.games)
  it('parses games, maps venues and numeric scores, tolerates errors', () => {
    expect(games).toHaveLength(2)
    expect(games[0]).toMatchObject({ venueKey: 'wrigleyfield', state: 'post', homeScore: 5, awayScore: 3 })
    expect(VENUE_KEYS['Guaranteed Rate Field']).toBe('ratefield')
    expect(parseChiSports(null)).toEqual([])
  })
  it('a Cubs win that Chicago date raises winDay; a loss does not', () => {
    expect(cubsWonOn(games, '2026-09-29')).toBe(true)
    const loss = games.map((g) => (g.id === '401' ? { ...g, homeScore: 2 } : g))
    expect(cubsWonOn(loss, '2026-09-29')).toBe(false)
  })
  it('overlays live state onto the build-time schedule by id', () => {
    const schedule = { games: [{ id: '402', venueKey: 'ratefield', start: '2026-09-29T23:10:00Z', home: 'White Sox', away: 'Tigers' }] }
    const s = overlayLive(schedule, games)
    expect(s.games.find((g) => g.id === '402').live).toMatchObject({ state: 'in', homeScore: 1 })
    expect(schedule.games[0].live).toBeUndefined() // pure: input untouched
  })
  it('detects scoring events for cheers', () => {
    const next = games.map((g) => (g.id === '402' ? { ...g, homeScore: 3 } : g))
    expect(scoreEvents(games, next)).toEqual([{ venueKey: 'ratefield', side: 'home', delta: 2 }])
  })
  it('polls fast around games and slowly otherwise', () => {
    expect(sportsInterval(games, Date.parse('2026-09-29T23:30Z'))).toBe(60_000)
    expect(sportsInterval(games, Date.parse('2026-09-29T09:00Z'))).toBe(600_000)
  })
})
```

```js
// append to app/src/sports/__tests__/gameState.test.js (V5 file)
import { gameState } from '../gameState.js'
it('live overlay wins over the clock', () => {
  const schedule = { games: [{ id: 'g', venueKey: 'ratefield', start: '2026-09-29T23:10:00Z', live: { state: 'in', homeScore: 1, awayScore: 0, status: 'Top 3rd' } }] }
  expect(gameState('ratefield', Date.parse('2026-09-29T20:00Z'), schedule).state).toBe('live')
})
```

- [ ] **Step 2: Run to verify they fail.** Run `npm test --prefix app -- src/sports`. Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. The venue card (D12) shows "LIVE · Top 3rd · 1–0" when live, and "Scheduled 6:10 PM" otherwise.
- [ ] **Step 4: Run the tests to verify they pass.** Manual check on a real game day, or a recorded CHI payload served by a local mock (`app/e2e/fixtures/sports.json`): the scoreboard texture shows the score, and the W flag flies after a Cubs win.
- [ ] **Step 5: Commit and push.** `git commit -m "feat(p5): live scores drive stadium game state, scoreboards, cheers, W flag (I-5.5)"`

**Acceptance:**
- D6/D7/D11/D13 are driven by live data when the sports feed is LIVE, and by V5's schedule otherwise.
- The Sky stay scheduled.

**Refresh at phase start:**
- Read V5's `gameState` signature and schedule shape (the id field, whether `start` is ISO).
- Check how V5 exposes the scoreboard and cheer hooks.
- Check whether CHI added the Sky to `TEAMS`.

---

### Task 4: Weather — overcast, rain, snow, lake fog (I-5.3)

**Files:**
- Create: `app/src/weather/weatherState.js`, `app/src/world/Weather.jsx`
- Modify: `app/src/world/materials/facadeMaterial.js` (`uWet`, `uSnow`), `app/src/world/materials/groundShader.js` (`uWet`, `uSnow`), `app/src/world/SkyRig.jsx` (overcast, fog, lake fog), `app/src/hud/ControlPills.jsx` (the Weather pill menu), `app/src/hud/CommandPalette.jsx`, `app/src/hud/HelpOverlay.jsx`, `app/src/state/store.js` (`weatherMode`, `weather`)
- Test: `app/src/weather/__tests__/weatherState.test.js`, `app/src/hud/__tests__/weatherPill.test.jsx`

**Interfaces:**
- Produces:
  - `weatherFromChi(w) → { kind: 'clear'|'overcast'|'rain'|'snow'|'fog', intensity: 0..1, windDeg, windMps, source: 'live'|'default' }`. OpenWeather icon prefix:
    - `01`/`02` → clear.
    - `03` → overcast 0.5; `04` → overcast 0.9.
    - `09`/`10` → rain, graded by description: light 0.35, moderate 0.6, heavy or extreme 0.9; "shower" adds 0.1.
    - `11` → rain 1.0.
    - `13` → snow: light 0.35, heavy 0.9, otherwise 0.6.
    - `50` → fog, by visibility: ≤ 0.5 mi 1.0, ≤ 2 mi 0.7, else 0.4.
    - Any clear or overcast with visibility ≤ 1 mi becomes fog 0.6.
    - `null`, unknown or malformed input gives `{ kind: 'clear', intensity: 0, source: 'default' }`.
  - `weatherVisuals({ kind, intensity }, quality) → { sunScale, skyDesat, shadowOpacity, fogScale, lakeFog, wet, snowCover, particles: { kind: 'none'|'rain'|'snow', count, fallMps } }`. It is pure. LOW gives `count × 0.25`.
  - `tweenWeather(a, b, t) → visuals`, a linear blend with `t ∈ [0, 1]` over 8 s.
  - `wrapParticle([x, y, z], [cx, cy, cz], half) → [x, y, z]`, which wraps into a `2·half` box around the camera.
  - Store: `weatherMode: 'LIVE'|'CLEAR'|'OVERCAST'|'RAIN'|'SNOW'|'FOG'` (default `'LIVE'`); `weather` (the effective state; in LIVE mode it comes from the feed, otherwise it is the manual choice at intensity 0.7).
  - `<Weather/>`: one `InstancedMesh` (a streak quad for rain, a disc for snow) inside a 400 m box around the camera. The count comes from the visuals (HIGH rain 6,000, snow 4,000). It is hidden when `count === 0`.
  - Shaders:
    - `uWet` lowers roughness and darkens albedo, stronger on roofs and ground.
    - `uSnow` whitens where `normal.y > 0.7`, scaled by `snowCover`.
    - Lake fog raises fog density over water by sampling V1's `shore.png` distance: density × (1 + `lakeFog` × 3) beyond 100 m offshore.
  - Controls: a **Weather** pill with a menu (Live, Clear, Overcast, Rain, Snow, Lake fog); ⌘K `Weather: …` for each; help line "Weather — follows Chicago live; choose a sky from the Weather button".

- [ ] **Step 1: Write the failing tests**

```js
// app/src/weather/__tests__/weatherState.test.js
import { describe, it, expect } from 'vitest'
import { weatherFromChi, weatherVisuals, tweenWeather, wrapParticle } from '../weatherState.js'

const w = (icon, description = '', visibility = 10) => ({ icon, description, visibility, wind: { speed: 4, deg: 270 } })
describe('weatherFromChi', () => {
  it.each([
    [w('01d'), 'clear'], [w('02n'), 'clear'], [w('03d'), 'overcast'], [w('04d'), 'overcast'],
    [w('10d', 'light rain'), 'rain'], [w('09d', 'shower rain'), 'rain'], [w('11d', 'thunderstorm'), 'rain'],
    [w('13d', 'snow'), 'snow'], [w('50d', 'mist', 1.5), 'fog'],
  ])('%o → %s', (input, kind) => expect(weatherFromChi(input).kind).toBe(kind))
  it('grades intensity from the description', () => {
    expect(weatherFromChi(w('10d', 'light rain')).intensity).toBeCloseTo(0.35)
    expect(weatherFromChi(w('10d', 'heavy intensity rain')).intensity).toBeCloseTo(0.9)
    expect(weatherFromChi(w('11d', 'thunderstorm')).intensity).toBe(1)
  })
  it('low visibility turns an overcast day into lake fog', () => {
    expect(weatherFromChi(w('04d', 'overcast clouds', 0.8))).toMatchObject({ kind: 'fog', intensity: 0.6 })
  })
  it('null, unknown icons and missing fields fall back to a clear default', () => {
    expect(weatherFromChi(null)).toMatchObject({ kind: 'clear', source: 'default' })
    expect(weatherFromChi({ icon: '99x' })).toMatchObject({ kind: 'clear' })
    expect(weatherFromChi({})).toMatchObject({ kind: 'clear' })
  })
})

describe('weatherVisuals', () => {
  it('clear has no particles and full sun', () => {
    const v = weatherVisuals({ kind: 'clear', intensity: 0 }, 'HIGH'); expect(v.particles.count).toBe(0); expect(v.sunScale).toBe(1)
  })
  it('rain wets surfaces and spawns rain; LOW keeps a quarter of the particles', () => {
    const hi = weatherVisuals({ kind: 'rain', intensity: 1 }, 'HIGH'), lo = weatherVisuals({ kind: 'rain', intensity: 1 }, 'LOW')
    expect(hi.wet).toBeGreaterThan(0.5); expect(hi.particles.kind).toBe('rain'); expect(lo.particles.count).toBe(Math.round(hi.particles.count * 0.25))
  })
  it('snow covers roofs; fog thickens the lake; overcast softens shadows', () => {
    expect(weatherVisuals({ kind: 'snow', intensity: 0.6 }, 'HIGH').snowCover).toBeGreaterThan(0)
    expect(weatherVisuals({ kind: 'fog', intensity: 1 }, 'HIGH').lakeFog).toBeGreaterThan(0.5)
    expect(weatherVisuals({ kind: 'overcast', intensity: 0.9 }, 'HIGH').shadowOpacity).toBeLessThan(0.5)
  })
  it('tween blends numerically and ends exactly on the target', () => {
    const a = weatherVisuals({ kind: 'clear', intensity: 0 }, 'HIGH'), b = weatherVisuals({ kind: 'rain', intensity: 1 }, 'HIGH')
    expect(tweenWeather(a, b, 1)).toEqual(b); expect(tweenWeather(a, b, 0.5).wet).toBeCloseTo(b.wet / 2)
  })
  it('particles wrap around the camera box', () => {
    expect(wrapParticle([250, 10, 0], [0, 0, 0], 200)).toEqual([-150, 10, 0])
  })
})
```

```jsx
// app/src/hud/__tests__/weatherPill.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ControlPills from '../ControlPills.jsx'
import { useStore } from '../../state/store.js'

describe('Weather pill', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('a non-coder can pick rain and go back to live', () => {
    render(<ControlPills />)
    fireEvent.click(screen.getByRole('button', { name: /weather/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rain' }))
    expect(useStore.getState().weatherMode).toBe('RAIN')
    fireEvent.click(screen.getByRole('button', { name: /weather/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /live/i }))
    expect(useStore.getState().weatherMode).toBe('LIVE')
  })
})
```

- [ ] **Step 2: Run to verify they fail.** Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. The river's March 17 green tint (B9) must be untouched by `uWet`; add a regression assertion to V1's date test if it lives nearby.
- [ ] **Step 4: Run the tests to verify they pass.** Evaluate and revert every state (clear, overcast, rain, snow, fog) at the wide Streeterville and river poses, day and night: 10 shots per state. Log keep or revert and the perf delta (≤ 1 draw call, ≤ 1 ms at HIGH).
- [ ] **Step 5: Commit and push.** `git commit -m "feat(p5): weather — overcast, rain, snow, lake fog (I-5.3)"`

**Acceptance:**
- Each state is visible (spec §5 Weather) and driven live when the weather feed is LIVE.
- Each state can also be chosen from the button and ⌘K.
- Reduced motion slows the particles and removes flashes.

**Refresh at phase start:**
- Read the V1 water shader (does the lake fog belong in `WaterSurface` or the global fog?).
- Read V2's façade shader state (whether `_STYLE` materials respond to `uWet` sensibly: glass should gain reflection, granite should darken).
- Check the shore texture's name and bounds.
- Check whether the pill row at 1280×800 has room (V7).

---

### Task 5: Scan holographic mode (I-5.4)

**Files:**
- Create: `app/src/scan/scanMath.js`, `app/src/scan/ScanController.jsx`, `app/src/scan/ScanOverlays.jsx`
- Modify: `app/src/world/materials/facadeMaterial.js` (`uScan`, `uScanOrigin`, `uScanRadius`, `uScanMode`, the scan shading chunk), `app/src/world/materials/groundShader.js` (the scan grid), `app/src/world/SkyRig.jsx` (sky → `--bg`), `app/src/hud/ControlPills.jsx` (SCAN pill), `app/src/hud/ControlDock.jsx` (Scan button), `app/src/hud/CommandPalette.jsx` (`Scan mode`), `app/src/hud/HelpOverlay.jsx`, `app/src/hud/HintBar.jsx` (`X scan`), `app/src/hud/panels/LivePanel.jsx` (metric selector), `app/src/state/store.js` (`scan`, `scanChangedAt`, `toggleScan`, `scanMetric`, `setScanMetric`)
- Create: `app/e2e/scan-live.spec.js`
- Test: `app/src/scan/__tests__/scanMath.test.js`, `app/src/scan/__tests__/scanKeys.test.jsx`

**Interfaces:**
- Produces:
  - `SCAN_SECONDS = 1.2`; `SCAN_MAX_R = 9000`
  - `scanRadiusAt(tSec, maxR = SCAN_MAX_R) → metres` (ease-out cubic, reaching `maxR` at 1.2 s)
  - `scanBlend(distM, radiusM, band = 80) → 0..1` (1 well behind the front, 0 ahead, smoothstep across the band)
  - `scanUniformsAt({ on, changedAt, now, origin, reducedMotion = false, prevRadius = 0 }) → { uScanMode: 0|1, uScanRadius, uScanOrigin: [x, z], uScan: 0..1 }`. Times are in ms.
    - `uScanMode` 1 means sweeping into Scan and 0 means sweeping back.
    - A re-toggle mid-sweep starts the new front at `prevRadius` (the radius the old front had reached, which ScanController keeps), so the change is continuous.
    - With reduced motion, the radius is infinite and `uScan` cross-fades over 0.4 s.
  - `landmarkHeat(points: [x, z][], bounds, cell = 100, sigmaM = 400) → { cols, rows, data: Float32Array }`, normalised to max 1, for the VISIT scan overlay.
  - `columnHeights(zones, metric: 'rent'|'transit'|'nightlife'|'green') → Map<zoneId, 0..1>`, where rent uses the best-sourced figure and zones without it get 0 and are flagged.
  - Scan shading (façade): massing `#030509`, cyan (`--accent`) crease edges from `fwidth(normal)`, floor lines every 3.8 m, and a fresnel rim. Sky → `--bg`. The ground grid is 100 m, cyan at 12 % alpha.
  - Overlays in Scan:
    - VISIT: the heat plane (1 call).
    - LIVE: light columns per zone (1 instanced call), with the metric picked in LivePanel.
    - WORK: the P4 isochrones.
    - Transit: V3's subway ghost lines are shown.
  - Controls: key **X**; SCAN pill (`aria-pressed`); a dock button; ⌘K `Scan mode` / `Leave Scan`; hint `X scan`. It is ignored while typing or while the palette is open.

- [ ] **Step 1: Write the failing tests**

```js
// app/src/scan/__tests__/scanMath.test.js
import { describe, it, expect } from 'vitest'
import { SCAN_SECONDS, scanRadiusAt, scanBlend, scanUniformsAt, landmarkHeat, columnHeights } from '../scanMath.js'

describe('scan sweep', () => {
  it('radius grows monotonically and reaches max at 1.2 s', () => {
    let last = -1
    for (let t = 0; t <= SCAN_SECONDS; t += 0.05) { const r = scanRadiusAt(t, 9000); expect(r).toBeGreaterThanOrEqual(last); last = r }
    expect(scanRadiusAt(SCAN_SECONDS, 9000)).toBe(9000); expect(scanRadiusAt(5, 9000)).toBe(9000)
  })
  it('blend is 1 behind the front and 0 ahead of it', () => {
    expect(scanBlend(100, 1000)).toBe(1); expect(scanBlend(2000, 1000)).toBe(0)
    const mid = scanBlend(1000, 1000); expect(mid).toBeGreaterThan(0); expect(mid).toBeLessThan(1)
  })
  it('toggling back mid-sweep continues from the current radius (no jump)', () => {
    const a = scanUniformsAt({ on: true, changedAt: 0, now: 600, origin: [0, 0] })
    const b = scanUniformsAt({ on: false, changedAt: 600, now: 600, origin: [0, 0], prevRadius: a.uScanRadius })
    expect(b.uScanMode).toBe(0); expect(Math.abs(b.uScanRadius - a.uScanRadius)).toBeLessThan(1)
  })
  it('reduced motion cross-fades without a sweep', () => {
    const u = scanUniformsAt({ on: true, changedAt: 0, now: 200, origin: [0, 0], reducedMotion: true })
    expect(u.uScanRadius).toBe(Infinity); expect(u.uScan).toBeCloseTo(0.5, 1)
  })
})

describe('scan overlays', () => {
  it('landmark heat peaks where landmarks cluster and is normalised', () => {
    const h = landmarkHeat([[0, 0], [50, 0], [0, 50], [3000, 3000]], { minX: -1000, maxX: 4000, minZ: -1000, maxZ: 4000 }, 100)
    expect(Math.max(...h.data)).toBeCloseTo(1)
    const idx = (x, z) => Math.floor((z + 1000) / 100) * h.cols + Math.floor((x + 1000) / 100)
    expect(h.data[idx(0, 0)]).toBeGreaterThan(h.data[idx(3000, 3000)])
  })
  it('column heights normalise per metric and treat missing data as 0', () => {
    const zones = [{ id: 'a', feel: { transit: 9, nightlife: 2, green: 5 }, rent: { oneBr: 3000 } }, { id: 'b', feel: { transit: 3, nightlife: 8, green: 9 }, rent: null }]
    expect(columnHeights(zones, 'transit').get('a')).toBe(1)
    expect(columnHeights(zones, 'rent').get('b')).toBe(0)
  })
})
```

```jsx
// app/src/scan/__tests__/scanKeys.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ControlPills from '../../hud/ControlPills.jsx'
import { useStore } from '../../state/store.js'
import { installScanKeys } from '../ScanController.jsx'

describe('Scan controls', () => {
  let uninstall
  beforeEach(() => { useStore.setState(useStore.getInitialState()); uninstall?.(); uninstall = installScanKeys() })
  it('X toggles Scan; S still moves (never toggles Scan)', () => {
    fireEvent.keyDown(window, { code: 'KeyX', key: 'x' }); expect(useStore.getState().scan).toBe(true)
    fireEvent.keyDown(window, { code: 'KeyS', key: 's' }); expect(useStore.getState().scan).toBe(true)
    fireEvent.keyDown(window, { code: 'KeyX', key: 'x' }); expect(useStore.getState().scan).toBe(false)
  })
  it('ignored while typing in the palette', () => {
    useStore.getState().setPaletteOpen(true)
    fireEvent.keyDown(window, { code: 'KeyX', key: 'x' }); expect(useStore.getState().scan).toBe(false)
  })
  it('the SCAN pill toggles and reports its state', () => {
    render(<ControlPills />)
    const pill = screen.getByRole('button', { name: /scan/i })
    fireEvent.click(pill); expect(pill).toHaveAttribute('aria-pressed', 'true')
  })
})
```

```js
// app/e2e/scan-live.spec.js — spec §12 visual pose "Scan over LIVE"
import { test, expect } from '@playwright/test'
import { waitForCameraRest } from './helpers.js' // G5 helper (refresh: actual name)
test('Scan over LIVE', async ({ page }) => {
  await page.goto('/?view=lincolnpark&time=DUSK')
  await page.waitForFunction(() => window.__worldReady === true)
  await page.getByRole('button', { name: /live/i }).click()
  await page.keyboard.press('x')
  await page.waitForTimeout(1500) // sweep is 1.2 s
  await waitForCameraRest(page)
  await expect(page).toHaveScreenshot('scan-over-live.png', { maxDiffPixelRatio: 0.02 })
})
```

- [ ] **Step 2: Run to verify they fail.** Run `npm test --prefix app -- src/scan`. Expected: FAIL.
- [ ] **Step 3: Implement to the Interfaces block.** Write the code at phase start. The single uniform set lives on the shared façade material, so there are no mesh swaps (§7). The V3 glow and V4 train materials read `uScan` to dim to a ghost cyan.
- [ ] **Step 4: Run the tests to verify they pass.** Run e2e and generate the new `scan-over-live.png` baseline (3 consecutive green runs). Evaluate and revert Scan at the Streeterville, Loop and Lincoln Park poses, day and night. Perf: ≤ 2 extra draw calls in Scan and ≤ 1 ms shader cost at HIGH.
- [ ] **Step 5: Commit and push.** `git commit -m "feat(p5): Scan holographic mode — X, SCAN pill, lens overlays (I-5.4)"`

**Acceptance:**
- Per spec §7: a 1.2 s sweep from the camera, with near-black massing and cyan edges, the sky fading to `--bg` and ground grid lines.
- Lens overlays take over in Scan.
- There is a human-first button (pill and dock), ⌘K and a key.

**Refresh at phase start:**
- Read the final façade shader after V2, P3 and Task 4 (where to inject the scan term relative to `_STYLE`, `uWet` and `uNight`).
- Read V3's subway ghost API.
- Check that X is still free in V7's keymap.
- Check the G5 e2e helper's name.

---

### Task 6: Phase close — help, hints, perf, gallery, push

**Files:**
- Modify: `app/src/hud/HelpOverlay.jsx`, `app/src/hud/HintBar.jsx`, `README.md`, `docs/screenshots/p5-*.png` (append only)
- Test: `app/src/hud/__tests__/help.test.jsx` (append)

**Interfaces:**
- Produces:
  - Help group **Live city**:
    - "Chip (top left) — LIVE CTA when real trains are shown; click for data sources";
    - "X or the SCAN button — holographic Scan";
    - "Weather button — live Chicago weather or pick a sky".
  - The hint bar gains `X scan`.

- [ ] **Step 1: Write the failing test**

```jsx
// append to app/src/hud/__tests__/help.test.jsx
it('help card explains the live chip, Scan and Weather', () => {
  useStore.getState().setHelpOpen(true)
  render(<HelpOverlay />)
  for (const t of [/LIVE CTA/i, /Scan/i, /Weather/i]) expect(screen.getAllByText(t).length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run it to fail, update the copy, then run it to pass.**
- [ ] **Step 3: Run the end-of-phase checklist.**
- [ ] **Step 4: README.** Append `p5-live-trains-night.png`, `p5-rain-river-dusk.png`, `p5-snow-loop-day.png`, `p5-scan-over-live.png` and `p5-lake-fog-streeterville.png`, with captions. Tick Phase 5 in the roadmap.
- [ ] **Step 5: Commit and push.** `git commit -m "feat(p5): Alive complete — help, gallery, perf log"`, then `git push origin main`.

**Acceptance:**
- I-5.1–I-5.5 and C11 are ticked.
- C19 is recorded as deferred (below).
- Budgets are logged.

**Refresh at phase start:** check V7's help grouping and the dock slot count.

---

## Deferred: CTA buses (C19)

**Status:** recorded, not scheduled. The backlog priority is low. It re-enters as a candidate when Phase 5 closes under budget, or in a later polish phase.

**What CHI offers today (`~/Downloads/chi/backend/routes/cta.js`):**
- `GET /api/cta/buses?routes=22,36,…` → `{ buses: [{ id, route, lat, lon, heading, destination }], error? }`. With no `CTA_BUS_KEY` it returns `{ buses: [], error: 'CTA_BUS_KEY not set' }`.
- `GET /api/cta/bus-routes` → `{ routes: [{ id, name, color }] }`
- Both need `CTA_BUS_KEY` configured in CHI.

**Proposed shape when it is scheduled:**
- `transit/liveBuses.js`: `snapBusToRoad({ lat, lon, heading }, roadIndex) → { x, z, yaw } | null`, which snaps to the nearest OSM road centreline within 25 m.
- Buses render as one `InstancedMesh`: a sourced 12.2 m New Flyer XD40 silhouette, ≤ 1.5 k triangles, ≤ 1 draw call.
- Toggle: a "Buses" row in V3's Transit legend, plus ⌘K `Show buses`.
- The chip popover gains a "Buses" feed line. There is no simulated fallback, because hundreds of routes are out of scope, so offline shows no buses and says so in the popover.
- Budget: ≤ 1 draw call, ≤ 400 instances, culled beyond 2 km.

**Gate test (to be added when it is scheduled; not run in Phase 5):**

```js
// app/src/transit/__tests__/liveBuses.test.js
import { describe, it, expect } from 'vitest'
import { snapBusToRoad } from '../liveBuses.js'
const roads = { near: () => [{ a: [0, 0], b: [0, -1000] }] }
const unproj = (x, z) => ({ lon: x / 1e5, lat: -z / 1e5 })
describe('bus snapping', () => {
  it('snaps within 25 m of a road and faces along it', () => {
    const r = snapBusToRoad({ ...unproj(10, -500), heading: 0 }, roads, (lon, lat) => [lon * 1e5, -lat * 1e5])
    expect(r.x).toBeCloseTo(0); expect(r.z).toBeCloseTo(-500)
  })
  it('drops buses far from any road', () => {
    expect(snapBusToRoad({ ...unproj(100, -500), heading: 0 }, roads, (lon, lat) => [lon * 1e5, -lat * 1e5])).toBeNull()
  })
})
```

**Acceptance when scheduled:**
- With CHI live and a key configured, buses on the downtown routes appear on their streets within one poll.
- The Transit legend toggles them.
- Draw calls stay +≤ 1.

---

## End-of-phase checklist

1. `npm test --prefix pipeline` and `npm test --prefix app` are green.
2. The world build is unchanged (this phase is app-only), and the skyline assertion passes.
3. e2e: the new `scan-over-live.png` baseline; 3 consecutive green runs with `VITE_CHI_API_URL` unset (fully simulated, deterministic).
4. A live smoke run with the CHI backend local: the chip flips to LIVE CTA, and the trains, weather and sports feeds are all LIVE. Log it.
5. Perf at the wide Streeterville and Loop poses, in each weather state and in Scan: ≤ 900 draw calls, ≤ 4 M triangles, 60 fps.
6. Evaluate-and-revert lines for all five weather states and for Scan.
7. Push.

## Rulings made while writing this plan

- Ruling: Scan toggles on **X**, not S. S is WASD "move back" (Phase 2.5 controls), and rebinding movement would break the familiar-controls rule. Spec §7's "S" is superseded, and Scan also gets a SCAN pill, a dock button and ⌘K. Cost if wrong: one keymap line and three copy strings change.
- Ruling: with `VITE_CHI_API_URL` unset, the app runs fully simulated rather than guessing a production origin. CHI's deployment docs set no fixed public API host, and the SPA and API share an origin there. Cost if wrong: production shows SIMULATED until the variable is set at deploy.
- Ruling: live and simulated trains are never mixed on the same CTA line. The source switches per feed, and Metra is always simulated. Cost if wrong: during a partial CTA outage, a line with no live trains shows none (honest) instead of sim trains.
- Ruling: live trains move forward only, and teleport on jumps over 1,500 m or a path change. This follows CHI's `trainAnimState` behaviour. Cost if wrong: a rare reversing train pauses rather than backing up.
- Ruling: the Chicago Sky stay on V5's build-time schedule, because CHI's `/api/sports` does not include them. Cost if wrong: Sky scores are not live at Wintrust until CHI adds the team (a CHI change, out of scope).
- Ruling: weather has no single-letter key (the button menu plus ⌘K), and manual weather choices override live until "Live" is chosen again. Cost if wrong: none.
- Ruling: CTA buses (C19) are deferred, with an interface sketch and a gate test recorded here. Cost if wrong: no buses in the city until scheduled.
