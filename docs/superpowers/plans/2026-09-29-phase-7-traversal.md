# Phase 7 — Ride the City: L Trains, Buses, Walks and the Glide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Reworked 2026-09-30 at the user's direction.** The original Phase 7 plan was a glide plus a board-at-a-station train ride. The user asked for more ("instead of just gliding let's make it about rides around the city on certain bus routes or L routes as well as the planned glide but also walking routes to see things from streetview and for potential VR incorporation later"). This plan replaces it. Phase 6 (the wider city) is deferred by the user, so nothing here depends on its ring bounds.

**Goal:** a second way to be in Chicago — **Ride** — with four kinds of ride, all reachable by a person who never touches code:
1. **L train rides** — every CTA line and direction, riding a real V4 train consist along V3's track: the camera in the front window (cab), alongside, or chasing; stops announced; nearby landmarks and places named; pause, speed ×1/×2/×4, skip to the next or previous stop. Through the subway tubes once the ground fork's tunnels are in the scene.
2. **Bus rides** — CTA routes on the major arterials (Michigan Ave, Clark, Chicago Ave, Halsted, State, Madison, Broadway, Lake Shore Drive's #146), from OpenStreetMap `route=bus` relations, with a CTA bus you ride in.
3. **Walks** — street-view walks at 1.7 m eye height: the Riverwalk, the Magnificent Mile, the Lakefront Trail from Grant Park to the Museum Campus, Fulton Market's restaurant row, and Lincoln Park's paths. Mouse look, the places you pass named, the nearest tiles at full detail, never through a wall.
4. **Glide** — the planned hang-glider over the city: energy-based flight that never passes through a building.

**Architecture:**
- **One generic engine for every path ride** (`ride/rideRun.js`, pure): a *ride definition* (a path, its stops, a speed profile, an optional vehicle) and a *run* (its own clock, paused or not, a speed multiplier). L rides reuse V4's own services and speed profiles (`sim.services[i].path / stops / profile`), so the ride train accelerates, brakes and dwells exactly like the simulated trains; buses and walks get a profile from V4's `buildProfile` with their own limits. Because the run has its own clock, pause, speed and skip-to-stop are exact.
- **The vehicle** — an L ride's train is a V4 consist (`consistFor` + `carPoses`) added to the instanced train renderer's list for the frame (0 extra draw calls); simulated trains of the same service close to it step aside (hidden) so two trains never overlap. A bus ride draws one CTA bus (1 draw call, only during a bus ride). Walks have no vehicle. The glider is one mesh.
- **The camera** — `AtlasRig` hands the camera to the ride each frame (as it does for the V4 follow cam and the P4 tours): CameraControls input is switched off, its polar limit is lifted so you can look at the horizon from the street, and the pose comes from `ridePose` (cab / side / chase / eye). Mouse drag looks around (yaw ±150°, pitch ±60°) without leaving the ride.
- **Data** — `app/public/world/rides.json`, built by `pipeline/build/build-rides.js` from cached OSM bus relations (`pipeline/fetch/fetch-rides.js`) and curated walk routes (`pipeline/data/walks.curated.json`), every walk sample checked against the OSM building footprints. When the ground fork's `walk-graph.json` is in the manifest, walk legs on the off-street network are re-routed over it at runtime (shortest path between the curated waypoints).

**Tech Stack:** React 19, R3F 9, drei 10, zustand 5, three 0.186, Vitest 5 + RTL, Playwright. No new dependencies.

## Global Constraints

- **Human-first (B.1.4).** Ride has a **Ride the city** dock button (a full-width row under Search: the 3 × 2 feature grid keeps no dead space), the key **L**, ⌘K rows (`Ride: Brown Line toward Kimball`, `Bus: #146 …`, `Walk: The Riverwalk`, `Glide over the city`), a Ride panel listing every ride in plain words, and a help-card group. During a ride a bar at the bottom states its own controls and has buttons for each. URL parameters are for tests only (`?ride=<id>`).
- **Keys.**
  - Any path ride: **Space** pause / resume, **.** next stop, **,** previous stop, **>** faster, **<** slower, **C** change the view (cab → side → chase; walks have one eye view), drag to look around.
  - Glide: ↑/W nose down (faster), ↓/S nose up, ←/→ and A/D bank and turn, Shift boost.
  - **Exit:** Esc, the bar's **Stop** button, or L — and for path rides any movement key (arrows, WASD, Q/E, R/F, +/−) also takes the camera back, exactly like the follow cam and the tours. In the glide the arrows steer, so only Esc, L and the button land it.
  - Free keys verified against the keymap: L, C, `<`, `>` (Shift+, Shift+.) are unused outside a ride; Space, `,` and `.` are the tour keys and mean the same here.
- **Clearance (B.7, G1, G6).** No camera is ever inside a building:
  - L and bus cameras sit on the vehicle (exempt from the 30 m `MIN_ALT`, as V4's follow cam is); the side and chase views use V4's clearance-safe `followPose`.
  - A walk path is checked at build time: every 2 m sample lies outside every OSM building footprint (the build fails otherwise).
  - The glide keeps ≥ 12 m above `clearanceAt` and looks 1.5 s ahead.
  - Every exit flies to a pose lifted to `max(120 m, clearanceAt + 25)`.
- **Underground.** On subway stretches the cab rides at track depth inside the tunnel when the ground fork's tubes (`scene` object `tunnels`) exist; until they do, the cab rides 3 m above the street over the subway and the bar says "above the subway". Side and chase views are never used underground (the cab is).
- **Budgets (B.1.6):** L ride +0 draw calls; bus ride +1; glide +1; walks +0; ≤ 900 at HIGH; ride logic ≤ 0.2 ms per frame; **60 fps at street level** (HIGH, M-series).
- **Reduced motion (§11):** no camera roll in the glide; the view changes cut instead of easing.
- **README gallery only appends:** `docs/screenshots/p7-<subject>-<time>.png`.
- Ledger: `.superpowers/sdd/2026-09-29-phase-7-traversal/progress.md`.

## Review Focus

1. **Riding into the ground fork's tunnels before they merge** — the camera must never sit underground looking at the underside of the city. Pinned in Task 1 (`ridePose` underground with and without tunnels).
2. **A ride train colliding with a simulated train on the same track.** Pinned in Task 2 (`hideNearRide`).
3. **Walks through walls** — pinned in Task 4 (the build-time footprint check and its test on a synthetic block).
4. **Mode collisions** — starting a tour, a flight or a follow during a ride, or a ride during a tour, must end the other cleanly with one camera owner. Pinned in Task 2 (store arbitration tests).
5. **Huge `dt`** (a tab switch) must not launch the glider through a tower or jump a ride past its last stop without stopping. Pinned in Tasks 1 and 5.

## Upstream contracts (verified 2026-09-30 against `main` 2863a52 + this branch)

| Symbol | From | Shape |
|---|---|---|
| `getSim().services[]` | V4 | `{ id, line, inbound, spec, path: makePath(pts), stops: [{ station, name, s }], profile, to }` |
| `sAt(profile, tau)`, `tauAtS(profile, s)`, `buildProfile(path, stopS, { vmax, accel, brake, dwellS, limitAt })` | V4 `transit/profile.js` | seconds ↔ arc length |
| `consistFor(spec, period, inbound)`, `carPoses(path, sHead, consist, dims)` | V4 `transit/consist.js` | the cars of a train |
| `followPose(head, dir, view, clearance, len)` | V4 `transit/followCam.js` | clearance-safe chase / side camera |
| `trainsNow()` | P5 `transit/liveStore.js` | the frame's trains (live CTA or simulated) |
| `clearanceAt(x, z)` | V1 `lib/clearance.js` | roof height near a point |
| `walk-graph.json` | ground fork (pending merge) | `{ nodes: [x0, z0, …], edges: [a, b, surface, lengthM, k, x, z × k, …] }` |
| Tunnels | ground fork (pending merge) | scene object named `tunnels`, tubes along the route paths |

## File Structure

```
pipeline/
  fetch/fetch-rides.js            (create) Overpass: CTA route=bus relations with geometry → cache/world/osm-bus-routes.json
  lib/rides.js                    (create) chainWays, clipToBox, busRide, walkSamplesClear, walkRide
  data/walks.curated.json         (create) the five walks: waypoints, blurbs, sources
  build/build-rides.js            (create) → app/public/world/rides.json (buses + walks), footprint-checked
  tests/rides.test.js             (create)
app/src/
  ride/rideRun.js                 (create) pure engine: createRun, stepRun, runState, skipStop, setSpeed, ridePose, exitPose
  ride/rideCatalog.js             (create) lRides(sim, transit), busRides(json), walkRides(json, graph), RIDE_KINDS
  ride/walkGraph.js               (create) parseWalkGraph, routeOnGraph (Dijkstra between waypoints)
  ride/rideSession.js             (create) the running ride (module state): start, stop, frame(dt), hud snapshot, look offsets
  ride/glide.js                   (create) GLIDE, createGlider, glideStep, chasePose, glideInput
  ride/RideVehicles.jsx           (create) the bus mesh and the glider mesh (only while riding)
  ride/useRideKeys.js             (create) Space , . < > C and drag-to-look
  hud/RidePanel.jsx, RideBar.jsx, Ride.css (create) the chooser and the in-ride bar
  hud/ControlDock.jsx             (modify) "Ride the city" row
  hud/featureControls.js          (modify) Ride (L)
  lib/paletteSources.js           (modify) rideCommands()
  camera/AtlasRig.jsx             (modify) hand the camera to the ride; exits
  transit/Trains.jsx, liveStore.js (modify) the ride train in the frame's list; nearby same-service trains hidden
  state/store.js                  (modify) ride, rideHud, ridePanelOpen, startRide, stopRide, setRide
app/e2e/ride.spec.js              (create) L cab ride, bus ride, walk, glide — screenshots and fps at street level
```

---

### Task 1: The ride engine — pure, tested (I-7.2)

**Interfaces:**
- `createRun(def, { fromStop = 0 } = {}) → { tau, paused: false, speed: 1 }` — starts dwelling at stop `fromStop`.
- `stepRun(def, run, dt) → run` — pure; `dt` clamped to 0.25 s; a paused run is unchanged; speed ∈ {1, 2, 4}; the run ends at the last stop (`done: true`).
- `runState(def, run) → { s, head: { p, dir }, next, prev, etaS, dwelling, progress }`.
- `skipStop(def, run, ±1) → run` — to the next (or previous) stop, arriving.
- `ridePose(def, state, view, look, { underground, tunnels, clearance }) → { position, target }`:
  - cab: 1.2 m behind the head, 2.7 m above the rail (L) / 2.4 m above the road (bus), looking 80 m along the path; eye (walks): 1.7 m above the path;
  - side / chase: V4's `followPose`, never underground;
  - underground without tunnels: 3 m above the street over the line.
  - `look = { yaw, pitch }` turns the view from the travel direction.
- `exitPose(pose, clearance) → { position, target }` — lifted to `max(120, clearanceAt + 25)`, looking ahead and down.

**Tests:** `app/src/ride/__tests__/rideRun.test.js` — a straight 2 km path with stops at 0 / 1000 / 2000 m:
- starts dwelling at the first stop, accelerates, dwells at the second, ends done at the third;
- pause freezes; ×4 covers ~4× the distance; a 10 s hitch steps ≤ 0.25 s;
- `skipStop(+1)` lands at the next stop dwelling, `skipStop(-1)` at the previous;
- cab pose sits above the rail and looks forward; walk eye at 1.7 m; yaw 90° looks sideways;
- underground: inside the tube with tunnels, 3 m above the street without; side view falls back to the cab underground;
- the exit pose is ≥ 120 m and above clearance + 25.

### Task 2: Ride mode — catalog, store, camera, vehicles, controls (I-7.2, C15, G6)

**Interfaces:**
- `lRides(sim, transit) → def[]` — one per CTA service (line × direction × branch): `{ id: 'l:<svc>', kind: 'L', name: 'Brown Line toward Kimball', line, colour, path, stops, profile, spec, inbound }`.
- Store: `ride: null | { id, kind, name, view, paused, speed }`, `ridePanelOpen`, `rideHud` (5 Hz snapshot), `startRide(id)` (ends tour, flight, follow; closes the palette and panel), `stopRide()`, `setRide(patch)`.
- `trainsNow()` gains the ride train (id `ride`) and hides same-service trains within −250…+400 m of it (`hideNearRide`).
- AtlasRig: while `ride` is set, the ride session owns the camera; Esc / L / movement keys (not in the glide) stop it and fly to `exitPose`.
- Controls: L (feature registry → help, hints, ⌘K), the dock row, the Ride panel (L trains grouped by line, buses, walks, glide), the in-ride bar: name, "Next: Clark/Lake · 1 min", "Nearby: The Chicago Theatre, Lake & State", buttons ⏸ / ⏭ / ⏮ / ×1 ×2 ×4 / View / Stop.

**Tests:** `ride/__tests__/rideCatalog.test.js`, `hud/__tests__/ridePanel.test.jsx` (L opens the panel; picking a ride starts it; the bar's buttons pause, skip, change speed and stop; Esc stops; movement keys stop a path ride but steer the glide), `transit/__tests__/rideTrain.test.js`.

### Task 3: Buses (I-7.2b)

- Ruling: bus routes come from OpenStreetMap `route=bus` relations (network CTA), fetched once by `fetch-rides.js` and cached, not from CHI (`/api/cta/bus-routes` needs `CTA_BUS_KEY` and gives no geometry). The relation's ways are chained in member order (flipping where needed), clipped to the world box (the longest piece kept), and its `stop`/`platform` members become the stops (named; ≤ 25 m from the route, else dropped).
- Routes: 146 Inner Drive/Michigan Express, 151 Sheridan, 22 Clark, 36 Broadway, 66 Chicago, 8 Halsted, 29 State, 20 Madison (one direction each, toward or through downtown).
- Profile: vmax 40 km/h, accel 1.0, brake 1.3 m/s², dwell 12 s.
- **Tests:** `pipeline/tests/rides.test.js` — chaining reversed ways, clipping, stop snapping.

### Task 4: Walks (I-7.2c)

- The five walks are curated waypoint lists (`walks.curated.json`, each with a blurb and a source), sampled every 2 m and rejected if any sample is inside a building footprint (OSM `allbuildings` cache).
- At runtime, legs flagged `graph: true` (park paths, the Riverwalk, the Lakefront Trail) are re-routed over `walk-graph.json` when the manifest lists it (`routeOnGraph`, Dijkstra; a leg whose ends are > 40 m from the graph, or with no path, keeps its straight line).
- Speed 1.4 m/s (×2 brisk, ×4 jog); stops are the named sights along the way (the bar names each as you reach it).
- Callouts: the three nearest landmarks and places within 250 m, by name, refreshed as you walk.
- Near tiles: the tile plan centres on the walker (the readout's x/z), so the ground and façades around you are LOD0 (pinned by a test on `planWorld`).
- **Tests:** `ride/__tests__/walkGraph.test.js` (routing on a small graph, fallback), `pipeline/tests/rides.test.js` (a walk crossing a synthetic building fails the check).

### Task 5: The glide (I-7.1)

The original Task 2/3 interfaces carry over (energy flight, look-ahead lift, hard floor, sub-stepping), with G → **L** for the key (G is Games) and "Ride panel → Glide" as the button:
- `GLIDE = { MIN_V: 18, MAX_V: 75, V_TRIM: 32, DRAG: 0.08, G: 9.81, CLEAR_M: 12, LOOKAHEAD_S: 1.5, MAX_BANK: 0.7, PITCH_DOWN: -0.44, PITCH_UP: 0.35, PITCH_NEUTRAL: -0.05, PITCH_RATE: 1.2, BOOST_A: 6, BOOST_DRAIN: 0.2, BOOST_RECHARGE: 0.1, MAX_ALT: 1500, MAX_DT: 0.1 }`
- `createGlider`, `glideStep` (pure, sub-stepped), `chasePose`, `glideInput(keys)`.
- The world clamp is the built bbox (Phase 6 is deferred).
- **Tests:** the original eight glide properties (`ride/__tests__/glide.test.js`).

### Task 6: Phase close

- e2e `app/e2e/ride.spec.js`: an L cab ride (Brown Line into the Loop), a bus ride (#146 on Michigan Ave), the Riverwalk, the glide — each a screenshot I look at, plus fps ≥ 55 at street level on HIGH.
- Help card group **Ride the city**; hints in-ride; README gallery `p7-*.png`; roadmap: Phase 7 reworked.
- Gate (one worker): hero-view, hud-layout, perf, hover, tour, ride.

## Future: VR (not in this phase)

The ride modes were shaped so a WebXR headset can use them later without new content:
- **Session:** three's `WebXRManager` (`gl.xr.enabled = true`, an `XRButton`), `local-floor` reference space. A ride becomes the XR camera's *rig* (a `Group` the headset camera sits in): `ridePose` places the rig, the headset adds the head pose on top. The 2D HUD becomes a small in-world panel on the vehicle's dashboard (walks: a wrist panel).
- **Comfort:** the head is never rotated by the app — only by the user's head. Turning is **snap turn** (30° steps on the thumbstick), never smooth yaw. A **vignette** (a black ring that tightens with angular and linear acceleration) during the L's curves and stops, the bus's turns and every glide manoeuvre. Rides start and stop with ease-in/out already (V4 profile); add a 0.3 s fade at skip-to-stop instead of a cut. The glide is offered only as "seated" with a horizon-locked cockpit frame; banking rolls the world's horizon line, not the head.
- **Scale and height:** eye height comes from the headset in `local-floor`; the cab's 2.7 m and the walk's 1.7 m become the rig's floor offset (rail + 1.1 m floor; ground).
- **Performance:** 72–90 fps per eye halves the budget — VR rides would run the LOW tile plan with LOD0 radius 600 m, no shadows beyond 300 m, no rain particles, fixed foveation (`gl.xr.setFoveation(1)`), and the bloom pass off.
- **Input:** controllers' trigger = pause, thumbstick left/right = snap turn, A/B = next/previous stop; hand-tracking pinch on the dashboard panel.
- **What would change:** `AtlasRig` hands the pose to the XR rig instead of CameraControls; `PostFX` gains an XR path (EffectComposer does not render to XR layers — bloom off or a custom pass); HUD components get 3D twins. Nothing in the pipeline or `rides.json` changes.

## Rulings made while rewriting this plan

- Ruling: the user's "traversal mode" is **Ride**, with four kinds (L, bus, walk, glide) behind one button, one key (L) and one panel, instead of a GLIDE camera mode plus a board-at-a-station train ride. Cost if wrong: one menu to split.
- Ruling: an L ride runs **its own train on V4's track and timetable physics** (the service's own speed profile and consist), not by attaching to a simulated train, because the user asked for pause, speed and skip-to-stop and a shared train cannot pause. Simulated trains of the same service near the ride train step aside. Cost if wrong: during a ride, your train is not one of the city's scheduled runs.
- Ruling: rides are CTA L only (Metra rides later). Cost if wrong: Metra's 11 lines have no ride yet.
- Ruling: the glide key is **L → Glide** (the original G is Games since V5); the glide is listed in the Ride panel and ⌘K `Glide over the city`. Cost if wrong: one more keystroke.
- Ruling: path rides exit on any movement key (like the follow cam and tours), not only Esc, because the user's controls promise "any arrow takes back the camera". The glide is the exception (arrows steer). Cost if wrong: an accidental arrow press ends a ride; L restarts it from the panel.
- Ruling: walks follow curated waypoints validated against OSM footprints at build time; the ground fork's walk graph re-routes their off-street legs at runtime once merged. Street sidewalks are not in that graph, so the Mag Mile and Fulton Market stay curated. Cost if wrong: a walk corner cuts across a plaza.
- Ruling: VR is a written section only (above) — not implemented. Cost if wrong: none.
- Ruling: Ride does not take a slot in the 3 × 2 feature grid (no dead space); it is a full-width dock row under Search. Cost if wrong: one row of the dock.
