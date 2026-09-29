# CHI ATLAS · OPEN WORLD — Design Spec (2026-09-28)

A browser-native, explorable 3D Chicago that doubles as a city guide for people
deciding where to **visit, live, or work**. Sibling product to
[CHI ATLAS](../../../../chi) — same HUD design language, same data voice — but the
map is replaced by a full game-quality city built with Three.js (React Three
Fiber), Blender (via MCP), and image generation.

**North star:** it must be *beautiful* first, recognizably *Chicago* second, and
*useful* third — and never trade the first two away for the third. It is a
portfolio piece that showcases UI and design craft.

Reference quality bar: the browser Spider-Man-style NYC demo (dense, readable
towers with textured façades, parks, shadows, minimap with compass strip).

---

## 1. Decisions (locked during brainstorming)

| Topic | Decision |
|---|---|
| Core experience | **Cinematic atlas camera first** (fly / orbit / dive / tour). Traversal mode (glide/swing) is a **later phase**, toggled as a second mode. |
| Geographic scope | **Core + inner neighborhoods, built in rings.** Ring 0 (core) = Loop, River North, Streeterville, lakefront to Museum Campus (~4 km², full detail). Ring 1 = north to Lincoln Park/Wrigleyville, west to West Loop/Wicker Park, south to Chinatown/Pilsen (~40 km², lighter detail). Tile system extends city-wide later without rewrite. |
| Visual style | **Game-real** city (textured façades, lit windows, physical sky, water reflections, time of day) plus a **Scan mode** that sweeps the city into holographic CHI-style massing for data overlays. |
| Live data | **Consume CHI's deployed API** (CTA trains, weather, places) with **graceful fallback** to simulation when unreachable. Separate repo. |
| Guide model | **Three lenses — VISIT, LIVE, WORK** — all in v1. WORK uses a simplified commute model (not a routing engine). |
| Stack | **Vite + React 19 + React Three Fiber + drei + postprocessing.** Build-time Node data pipeline → compressed `.glb` tiles. Blender MCP for hero towers. Image gen for façade atlases. |

Confirmed assumptions:
- Geometry comes from real public data; recognizability comes from hand-built hero towers.
- Façades use generated **tiling** textures, not per-building photo textures.
- CHI's landmarks, CTA line geometry, and neighborhood content are reused as world content.
- Blender MCP is **not yet configured** in the environment (Blender 5.2 is installed). Setup is a prerequisite of Phase 3 only.

---

## 2. Brand

- Name: **CHI ATLAS · OPEN WORLD**
- Wordmark: `CHI ATLAS` in Michroma, wide tracking, cyan tick accent; sub-mark `OPEN WORLD`.
- Tagline: `THE CITY, AT FULL SCALE`
- `<title>`: `CHI ATLAS · Open World — Chicago at Full Scale`

### Design tokens (copied verbatim from CHI `frontend/src/styles/global.css`)

```css
--bg: #030509;  --bg-elev: #070c16;  --surface: #0a111f;
--panel: rgba(9, 14, 26, 0.72);
--border: rgba(148, 187, 255, 0.13);  --border-strong: rgba(148, 187, 255, 0.28);
--text: #e8eef9;  --text-muted: #7e8aa3;  --text-faint: #4e5a72;
--accent: #45d8ff;  --accent-rgb: 69, 216, 255;
--red: #ff3b53;     --red-rgb: 255, 59, 83;
--font-display: 'Michroma';  --font-ui: 'Archivo';  --font-mono: 'IBM Plex Mono';
--r-sm: 8px; --r-md: 12px; --r-lg: 16px;
```

HUD primitives ported unchanged: `.hud-panel` (glass + blur 18px + top light line),
`.hud-label`, `.hud-title`, `.hud-pill(.active)`, `.hud-kbd`, `.hud-chip(.live)`,
`.hud-corners`, film grain (`body::after` SVG noise), thin scrollbars, cyan
`::selection`, `hud-rise` entrance. Icons: Remix (`react-icons/ri`). **No emojis anywhere.**

---

## 3. Architecture

```
Chicago_open_world/
├─ pipeline/                 build-time Node scripts (never shipped)
│  ├─ fetch/                 raw data → pipeline/cache/*.geojson
│  ├─ build/                 project → extrude → classify → props → tile → .glb
│  ├─ heroes/                Blender MCP scripts, heroes.json, exported .glb
│  ├─ textures/              generated façade atlases + night-window masks
│  └─ tests/                 Vitest
├─ app/                      Vite + React 19 + R3F
│  ├─ src/world/             City, TileStreamer, Heroes, Lake, River, Parks,
│  │                         Tracks, Trains, Beacons, Sky, Weather, PostFX
│  ├─ src/camera/            AtlasRig (fly/orbit/dive), TourPlayer, IntroFlight
│  ├─ src/hud/               WordmarkBlock, CommandPalette, HudClock, ModePills,
│  │                         LensRail, ContextPanel, IntelFeed, Minimap, HintBar,
│  │                         LoadingScreen
│  ├─ src/lenses/            visit/, live/, work/ (overlays + panel content)
│  ├─ src/scan/              ScanController, scan materials, data columns
│  ├─ src/data/              landmarks.js, ctaRoutes.js, neighborhoods.json,
│  │                         tours.json (seeded from CHI)
│  ├─ src/state/             zustand store (lens, mode, time, selection, quality)
│  ├─ src/services/          chiApi.js (probe, CTA, weather, places), simulator.js
│  └─ public/world/          manifest.json, tiles/*.glb, tiles/*.json, heroes/*.glb,
│                            textures/*.ktx2
└─ docs/superpowers/         specs + plans
```

State: a single **zustand** store (`lens`, `cameraMode`, `timeOfDay`, `scan`,
`selection`, `quality`, `apiStatus`). HUD (DOM) and world (R3F) both subscribe;
no prop drilling across the canvas boundary.

### 3.1 Coordinate system

- Local tangent-plane metres, origin at **State & Madison** (41.88203 N, −87.62784 W) — the zero point of Chicago's address grid.
- +X = east, −Z = north, +Y = up.
- Equirectangular projection around origin is sufficient at this scale (error < 1 m within 10 km); implemented once in `pipeline/lib/project.js` and shared with the app (`app/src/lib/project.js` re-exports) so pipeline and runtime agree exactly.
- Consequence: Chicago grid addresses map to world space — 800 address numbers = 1 mile, so 100 numbers ≈ 201 m (e.g. `800 N` ≈ Z −1,609 m; `1200 W` ≈ X −2,414 m). This powers the cross-street readout and ⌘K address search (approximate; diagonal streets and non-grid areas fall back to nearest named building).

---

## 4. World pipeline

### 4.1 Sources

| Data | Source | Notes |
|---|---|---|
| Building footprints + stories + name + address | City of Chicago `syp8-uezg` (Building Footprints) | fields used: `the_geom`, `bldg_id`, `stories`/`no_stories`, `bldg_name1`, `t_add1`, `pre_dir1`, `st_name1`, `bldg_sq_fo` |
| Year built | City of Chicago `vmwt-djju` (buildings) | joined on `bldg_id` |
| Heights (m) where tagged | OpenStreetMap via Overpass (`building`, `height`, `building:levels`, `roof:shape`) | OSM `height` overrides `stories × 3.8 m` when present |
| Roads, rail, water, parks, shoreline | OpenStreetMap via Overpass | roads by class for widths; `railway=subway/light_rail` for L |
| CTA L geometry + colors | CHI `ctaRoutes.js` (then refined from OSM rail) | |
| Landmarks | CHI `landmarks.js` (32 entries) | |

Fetch scripts cache raw responses to `pipeline/cache/` (gitignored) and are
re-runnable; builds run from cache so iteration is offline.

### 4.2 Build steps

1. **Project** all geometry to local metres (§3.1).
2. **Clean**: drop footprints < 12 m², fix winding (CCW outer), simplify with 0.3 m tolerance.
3. **Height**: OSM `height` → else `stories × 3.8 m` → else class default (1-story garage 4 m, residential 10 m). Clamp to 450 m.
4. **Classify façade family** (8 families) from height, year built, and area:
   `loop-limestone` (pre-1940, > 40 m, Ring 0), `art-deco`, `prewar-brick`, `curtain-glass` (post-1960, > 60 m), `precast-concrete`, `river-north-loft` (brick, 1880–1930, 15–40 m), `three-flat-brick` (< 15 m residential), `industrial`.
5. **Extrude** walls + flat roof; generate world-space façade UVs (u = perimeter metres, v = height metres) so window grids align across buildings.
6. **Roof props**: instanced water towers (prewar, 15–60 m), HVAC boxes and parapets (all > 20 m), helipads/spires only via heroes.
7. **Hero exclusion**: remove footprints whose `bldg_id` is listed in `heroes.json`.
8. **Tile**: 500 m × 500 m grid. Each tile → one merged mesh, vertex attributes: `position`, `normal`, `uv`, `facade` (u8), `height` (f32), `bldgIndex` (u16), `seed` (f32). LOD1 = roofs only + no props, 50% simplified. Output meshopt-compressed `.glb` + sidecar `tile_x_z.json` (`bldgIndex → {id, name, address, stories, year}`).
9. **Horizon**: single low-poly mesh of everything outside the loaded rings.
10. **Manifest**: `public/world/manifest.json` lists tiles (bounds, ring, LOD files, byte sizes), heroes, textures, and dataset versions/dates.

Ring 0 ≈ 16 tiles; Ring 1 ≈ 150 tiles.

### 4.3 Heroes

`pipeline/heroes/heroes.json` entries: `{ key, name, bldgIds[], origin [lat,lon], rotationDeg, heightM, file }`.

v1 hero list (priority order): Willis Tower, John Hancock Center (875 N Michigan), Trump International, Aon Center, Marina City (×2), St. Regis Chicago, Tribune Tower, Wrigley Building, Merchandise Mart, Chicago Board of Trade, 311 S Wacker, Two Prudential Plaza (Crain), Lake Point Tower, Aqua, Water Tower, Navy Pier + Centennial Wheel, Cloud Gate, Buckingham Fountain, Wrigley Field.

- Modelled in Blender via MCP as **Python scripts checked into `pipeline/heroes/scripts/`** (reproducible; MCP executes them), exported to `.glb` with the same façade shader conventions (material IDs + UVs in metres).
- Until a hero `.glb` exists, the build **keeps** its data footprint (exclusion only applies when the file exists) — the skyline is never missing a building.

### 4.4 Textures

- Image generation produces 8 seamless façade tiles (1024², one per family) + matching normal/roughness hints and a **night-window emissive mask** per family.
- Packed into a 2D texture array, compressed to KTX2 (Basis) via `toktx`/`gltf-transform`.
- Ground: asphalt, sidewalk, park grass, water normal maps — generated or CC0.
- Generation prompts are saved in `pipeline/textures/prompts.md` for reproducibility.

---

## 5. Rendering

- **Façade material**: `MeshStandardMaterial` extended via `onBeforeCompile`, shared by all tiles.
  - Samples texture-array layer by `facade` attribute using world-space UVs.
  - Procedural window grid (floor height 3.8 m, bay width per family) modulates roughness/metalness (glass reflective).
  - Night lighting: per-window hash from `seed` + window coords → lit fraction 20–60% by family, warm (2700K) / cool (4500K) mix; intensity driven by `uNight` (0–1) from sun elevation.
- **Sky & light**: physical sky (drei `Sky`) with sun from real Chicago solar position (`suncalc`) at the chosen time. Directional sun + CSM shadows (3 cascades, Ring 0 only), hemisphere fill, exponential height fog thicker toward the lake.
- **Time of day**: presets DAWN / DAY / DUSK / NIGHT; default = live Chicago solar time. Transitions tween sun angle, sky, fog, `uNight` over 2 s.
- **Weather** (from live data): overcast (sky desaturate, soft shadows), rain (streak particles + wet roughness), snow (particles + roof whitening), lake fog (fog density ↑ near shoreline).
- **Water**: Lake Michigan + Chicago River planes with reflective water shader (drei `MeshReflectorMaterial` for river; planar-reflection-lite + normal maps for lake). Easter egg: river turns green on March 17.
- **Ground**: baked street grid mesh (widths by OSM class), sidewalks, parks with instanced trees (Grant, Millennium, Maggie Daley, Lincoln Park, Northerly Island), beaches.
- **L tracks**: extruded elevated structures along rail geometry (girders instanced); the Loop elevated box fully modelled; subway segments hidden.
- **PostFX** (`@react-three/postprocessing`): N8AO → selective Bloom (windows, beacons, trains, tracks at night) → ACES tone map → vignette → film grain.
- **Quality**: LOW (no shadows, no AO, Ring 0 only, DPR 1) / HIGH (default) / ULTRA (larger shadow maps, DPR 2, Ring 1 at LOD0). Auto-downgrade if average frame time > 25 ms for 3 s.
- **Budgets**: < 300 draw calls, < 1.5 M triangles on screen at HIGH, initial download < 25 MB for Ring 0 + UI. Targets: 60 fps on M-series Mac (Ring 0, HIGH); 30+ fps mid-range laptop (LOW).

---

## 6. Camera — Atlas Rig

- **FLY** (default): drag rotate, scroll zoom (toward cursor), WASD/arrows glide, Shift boost, ↑/↓ pitch (matching CHI's arrow-key pitch).
- **ORBIT**: slow auto-orbit around current target; any input returns to FLY.
- **DIVE**: triggered by picking a landmark/building/neighborhood — eased swoop from current altitude to a framing shot (~120 m altitude, 35° pitch) with a subtle FOV kick.
- **TOUR**: spline path playback with timed narration cards; pausable, scrubbable.
- **Intro flight**: loads over the lake east of Navy Pier at dusk-lite, pushes west toward the skyline, settles on the Streeterville hero view (~6 s, skippable with any key).
- Limits: min altitude 30 m above terrain/roofs (collision against tile bounding heights), max 3 km, soft bounds at Ring 1 edge.

---

## 7. Scan mode (`S`)

- 1.2 s sweep: an expanding ring shader from the camera; behind the front, building material cross-fades to **scan material** (near-black `#030509` massing with cyan edge lines via a world-space edge/fresnel term), sky fades to `--bg`, ground grid lines appear.
- In Scan, lens overlays take over (§9). Press `S` again to sweep back.
- Implemented as a uniform `uScan` (0–1) + `uScanOrigin` / `uScanRadius` in the shared façade material — no mesh swaps.

---

## 8. HUD layout

| Region | Content |
|---|---|
| Top-left | Wordmark block: `CHI ATLAS` / `OPEN WORLD`, live CT mono clock, camera readout (`MICHIGAN & OHIO · 240 M ALT · HDG 312°`), `LIVE CTA` / `SIMULATED` chip |
| Top-center | ⌘K search pill |
| Top-right | Mode pills FLY / ORBIT / TOUR · Time pills DAWN / DAY / DUSK / NIGHT · SCAN toggle · quality menu |
| Left edge | **Lens rail** — slim vertical VISIT / LIVE / WORK with cyan active tick (replaces CHI sidebar) |
| Right | **Context panel** (glass, slides in): landmark card / building card / neighborhood profile / commute results; in VISIT with no selection → IntelFeed |
| Bottom-right | **Minimap**: north-up option or heading-up (default); compass strip across the top (`N · · · E · · ·`) like the reference; rendered from a 2D footprint raster in CHI palette; player cone; click to fly |
| Bottom-center | Hint bar: `Drag rotate · Scroll zoom · WASD glide · S scan · ⌘K search` |
| Hover | Building tooltip: name (if any), address, stories, year |

**⌘K palette** (ported from CHI `CommandPalette.jsx`): groups **Go** (landmarks, neighborhoods, L stations, heroes, addresses via grid math), **Tour**, **Lens**, **Time**, **Toggle** (scan, quality). Selecting a place triggers DIVE.

---

## 9. Lenses

### VISIT
- Landmark **beacons**: thin light pillars + labels (distance-faded, collision-culled) for CHI's 32 landmarks, colored by category.
- Click → DIVE + landmark card (desc, tip, category, nearest L stop, save).
- **Tours** (v1: 3): *Architecture on the River*, *Museum Campus & the Lakefront*, *A Night in River North*. Defined in `tours.json` as waypoint lists (camera pos, look-at, card text, dwell s).
- Food & nightlife pins from CHI API when live (rooftop-anchored billboards), hidden when not.
- Scan overlay: landmark density heat on ground.

### LIVE
- ~20 inner-ring neighborhood zones (official boundaries from City `igwz-8jzy` community areas / CHI's neighborhood polygons) as soft ground glows with floating names.
- Profile card: character, vibe tags, rent range (studio / 1BR / 2BR), nearest L lines, **feel scores** 0–10 (walk, transit, nightlife, green space, quiet), data sources + dates.
- Scan overlay: neighborhoods rise as light columns; metric selector (rent, transit, nightlife, green).
- Data: `neighborhoods.json` curated, seeded from CHI neighborhood content + public rent medians; every figure carries a source.

### WORK
- Set office by clicking the world, or ⌘K address search.
- **Commute model (v1)**: `walk(origin → nearest station, 80 m/min) + ride(along line geometry, 30 km/h avg, +4 min per transfer, ≤ 1 transfer) + walk(station → destination)`; also straight walk if shorter. Computed per neighborhood centroid and on a 150 m ground grid.
- Visual: animated isochrone shells (15 / 30 / 45 min) on the ground, colored cyan → red; L lines brighten by usefulness.
- Panel: ranked neighborhoods by commute time, each linking to its LIVE profile.
- Explicit label: `ESTIMATE · simplified transit model`.

---

## 10. Live data

`services/chiApi.js`:
- Base URL from `VITE_CHI_API_URL` (default: CHI production origin). CHI must add this app's origin to `FRONTEND_URL` CORS.
- Boot: probe `GET /api/health` (2 s timeout) → `apiStatus = live | offline`.
- Live: CTA positions every 30 s (trains interpolated along track geometry, as CHI's `trainAnimState.js`); weather every 10 min; places on lens entry (cached in memory).
- Offline: `simulator.js` spawns trains per line at typical headways moving along geometry; weather = clear; chip reads `SIMULATED`. No error UI beyond the chip.
- Trains render as instanced 3D cars on the elevated tracks with line-colored emissive roofs.

---

## 11. Reliability & loading

- **Loading screen**: CHI-styled, real progress (manifest → Ring 0 tiles → textures → heroes), city-name typographic moment, then intro flight.
- Tile load failure → retry ×2 → horizon mesh covers the hole; logged to console.
- Hero load failure → keep data extrusion (pipeline ships both when hero exists: extrusion stored as hidden fallback).
- WebGL context loss → pause, restore, rebuild materials.
- No WebGL2 → static poster render + fully working HUD panels (guide still usable).
- `prefers-reduced-motion` → no intro flight, instant transitions, no scan sweep (cross-fade).

---

## 12. Testing

- **Pipeline (Vitest)**: projection round-trip; 5 known landmarks within 5 m of true position; CCW winding; tile bounds partition with no gaps/overlaps; height fallback order; hero exclusion only when file exists; manifest schema.
- **App (Vitest + RTL)**: store transitions; ⌘K search/grid-address parsing; commute model (known cases, e.g. Wrigleyville → Loop via Red); HUD components render + keyboard shortcuts.
- **Visual (Playwright)**: 5 fixed camera bookmarks (Streeterville hero, Loop from Willis, River canyon, Museum Campus from lake, Scan over LIVE) screenshotted at HIGH; manually reviewed on change; committed as baselines.
- **Perf check**: dev overlay (draw calls, tris, frame ms) + a scripted benchmark flight.

---

## 13. Phasing

1. **Foundation** — scaffold (Vite/R3F/zustand), CHI design-system port, pipeline fetch + build for Ring 0, extruded city with flat materials, sky, lake/river, AtlasRig, basic HUD shell. *Deliverable: first "wow" screenshot.*
2. **Beauty pass** — façade atlases (image gen), window/night shader, PostFX, time-of-day, roof props, ground/parks/tracks, intro flight, minimap.
3. **Heroes** — configure Blender MCP; model + export heroes in priority order; swap in.
4. **Guide** — lenses (VISIT/LIVE/WORK), context panel, ⌘K, tours, hover tooltips.
5. **Alive** — CHI API hookup, 3D trains, weather, Scan mode.
6. **Neighborhood ring** — Ring 1 tiles, streaming, LOD, auto-quality.
7. *(Later)* **Traversal mode** — glide/swing character mode.

Each phase gets its own implementation plan.

## 14. Out of scope (v1)

Street-level walking, interiors, real routing isochrones (GTFS/OSRM), user accounts,
Ring 2+ (full city), mobile-first layout (desktop-first; mobile gets LOW quality +
simplified HUD), editing CHI's codebase beyond the CORS origin entry.

---

## Addendum A — Phase 2.5: Expanded city & accurate skyline (approved 2026-09-28)

Inserted between Phase 2 and Phase 3 at the user's request. **All later phase plans must be revised against this addendum.**

### A.1 Findings that drive it
- City of Chicago Building Footprints (`syp8-uezg`) were last edited **2015-08-06** — every tower completed since (St. Regis 2020, 400 Lake Shore North 2026 (#15, 259 m), NEMA, One Chicago, Salesforce, 110 N Wacker, 1000M, BMO Tower, One Bennett Park…) is absent.
- OpenStreetMap is current (St. Regis with tier parts, 400 Lake Shore North at 267 m).

### A.2 Scope
- **World bounds (lat/lon):** S **41.826** (35th St — Chinatown, Pilsen, Bridgeport, Bronzeville, Guaranteed Rate Field), N **41.952** (Addison — Wrigleyville, Lakeview, Lincoln Park), W **−87.695** (Western Ave — West Loop/Fulton Market, United Center, West Town, Ukrainian Village, Wicker Park, Bucktown), E **−87.595** (lakefront incl. Navy Pier). ≈ 110 km²; ~107k buildings.
- The Phase 1 "Ring 0" core keeps its name for the hi-detail downtown; the expanded area replaces "Ring 1" (§A.2 supersedes §1 scope row).

### A.3 Data
- **OSM is the primary building source** (ways + multipolygon relations tagged `building`, plus `building:part`). City footprints **enrich** OSM buildings (stories, year built, address) by spatial join; City-only buildings (no OSM match) are dropped.
- Height order: OSM `height` → OSM `building:levels` × 3.8 → City stories × 3.8 → type default (`house` 8, `garage` 4, `apartments` 12, `commercial` 8, `industrial|warehouse` 10, `church` 16, else 9).
- **`pipeline/data/skyline.json`**: the 50 tallest completed buildings (name, lat, lon, height m, floors, year) parsed from the current Wikipedia "List of tallest buildings in Chicago" wikitext; the build **validates** every entry inside the bounds is present with top height within ±8 % and fails otherwise.

### A.4 Recognizable landmarks (procedural hero specs)
`pipeline/data/heroes.json` — 25 towers + 3 stadiums, each keyed by OSM id (or coordinate) with: height/roof override, façade family + glass tint, and crown primitives: **spire, antenna, pyramid, drum, sloped (diamond), taper**, plus optional tier (setback) list. List: Willis, Trump, St. Regis, Aon, 875 N Michigan, Franklin Center, Two Prudential, One Chicago East, 311 S Wacker, NEMA, 900 N Michigan, Chase Tower, Water Tower Place, Aqua, 400 Lake Shore North, Salesforce, 110 N Wacker, 1000M, Marina City (×2), Lake Point Tower, Wrigley Building, Tribune Tower, Merchandise Mart, Chicago Board of Trade, 150 N Michigan; stadiums Wrigley Field, Soldier Field, United Center.
Phase 3 (Blender) now **refines** these (sculptural detail) instead of creating them.

### A.5 Streaming & budgets (pulled forward from Phase 6)
- 500 m tiles, each ONE `.glb` holding named meshes per layer (`buildings`, `parapets`, `roads`, `sidewalks`, `parks`, `beaches`, `rail`, `elevated`, `water`) — polygons clipped to the tile — plus `lod1` (simplified buildings, roads, parks, water). Trees, roof props and L columns are stored per tile in the tile sidecar JSON.
- meshopt compression (EXT_meshopt_compression, quantized positions); custom attributes preserved.
- App streams tiles by distance from the camera target: LOD0 ≤ 1.6 km, LOD1 ≤ 7 km, hysteresis 15 %; unloads (disposes) LOD0 beyond 2.2 km.
- Shadow camera follows the camera target (snapped to 50 m).
- Budgets: first load < 60 MB; total `public/world` < 200 MB; HIGH ≤ 300 draw calls & ≤ 4 M triangles/frame incl. shadow pass on M-series; 60 fps target.
- Camera: target clamped to the world bounds rectangle; max camera–target distance 6 km.

---

## Addendum B — Vision pass: water, transit, sports life, landmark detail, true colours (approved 2026-09-29)

Requested 2026-09-29 after Phase 2.5. The exhaustive item list, with a clause-by-clause trace of the request, is `docs/superpowers/backlog/2026-09-29-vision-backlog.md`; its IDs (B1…I-7.2) are cited below. Execution order and push points: `docs/superpowers/plans/2026-09-29-vision-master-plan.md`.

**Mode.** No human in the loop: the executor decides and records rulings. Coding starts only after the user's explicit "go ahead". This addendum supersedes §5 *Water*, §5 *L tracks*, §5 *Budgets*, §10 *Trains* and §13 where they conflict.

### B.1 Standing rules
1. **Realism with a restrained neon accent.**
   - Geometry, colours and materials are faithful and sourced (every value carries a `source` in pipeline data).
   - Transit lines add a glow in their official colour: at most ~15 % by day, full at dusk and night. It must stay legible from street level, bird's-eye and every angle in between, and never look cartoonish.
2. **Evaluate and revert.** Every colour, material or glow change is screenshotted before and after at fixed poses (day, dusk, night). A change that looks unpleasing is reverted in its own commit, with a ledger line.
3. **README is history.**
   - Existing images are never modified.
   - New shots get new filenames.
   - A "How it came together" gallery runs chronologically from Phase 1.
4. **Human-first.** Every feature has a button, a ⌘K entry and a help-card line. URL parameters are for tests only.
5. **Live data degrades gracefully.**
   - Every feed has a simulated or scheduled fallback and a `LIVE` / `SIMULATED` chip.
   - No error UI.
   - At runtime, all feeds go through the CHI ATLAS API. Build-time fetches are allowed and cached.
6. **Budgets** (supersede §5 and A.5):
   - HIGH: ≤ 900 draw calls per frame, including the shadow and post passes, measured at the wide Streeterville and Loop poses.
   - ≤ 4 M triangles per frame; 60 fps on M-series; ≤ 200 MB `public/world`.
   - Every new system ships with a LOW-quality fallback.
   - Additions per system: transit ≤ 12 calls, crowds and players ≤ 3 per venue, water ≤ 2 (one shared reflection pass).

### B.2 Water (backlog B1–B10)
- **One water material** (`WaterSurface`) covers everything:
  - the Lake Michigan plane;
  - every OSM water polygon: river, harbours, lagoons.
- **Shared reflection:** a single planar-reflection render per frame (mirror about y = 0, ½ resolution at HIGH, off at LOW). Every water mesh samples it in screen space, so the lake and harbour reflect the same skyline.
- **Calm factor:** the pipeline writes a per-vertex `_CALM` value (river 0.6, harbour or lagoon 0.35, open lake 1.0). It scales normal-map amplitude and speed; colour and reflection are shared.
- **Seams and levels:**
  - The lake plane moves to y = 0.02, just under the polygon water at 0.04.
  - Land keeps its constant depth nudge.
  - A shoreline tint (foam and depth) comes from a distance-to-shore texture baked by the pipeline (`water/shore.png`, 4 m/px over the lake band).
- **Extent:** the lake plane grows to 120 km east–west and 160 km north–south, centred on the shoreline. Its far colour blends into the sky's horizon colour, so it has no grey band and no edge at a 6 km camera distance.
- **Other effects:**
  - Night reflections come free from the shared reflection pass: lit windows, bridge lights, track glow.
  - The river still turns green on March 17, driven by a date function tested in isolation.

### B.3 Transit (C1–C20)
- **Data (build time)**, `pipeline/build/build-transit.js` → `app/public/world/transit.json` plus per-tile track meshes:
  - Lines come from OSM `route=subway|light_rail|train` relations inside the bounds: CTA Red, Blue, Brown, Green, Orange, Pink, Purple, and the Metra lines.
  - Each line has an ordered centreline per direction and track, a `grade` per segment (`elevated | embankment | at_grade | subway`), and a station list (CTA/OSM stations with platforms).
- **Colours (official, tested):** Red #c60c30, Blue #00a1de, Brown #62361b, Green #009b3a, Orange #f9461c, Pink #e27ea6, Purple #522398, Yellow #f9e300. Metra is a single blue at a dimmer glow.
  - Shared trackage (the Loop, the north-side corridor) shows each line's colour as side-by-side strips.
- **Structure:**
  - Elevated sections get instanced steel bents and girders, merged ties, running rails and third rail, and the Loop junction boxes.
  - Embankments get retaining walls and a ballast top.
  - Subway sections draw nothing, except a ghosted line in Scan.
  - Stations get platforms, canopies, stairs and colour signage, generated from station data.
- **Glow:**
  - One ribbon mesh per tile, carrying a line-colour attribute.
  - Additive blending with selective bloom.
  - Width is compensated with distance in the vertex shader, with a screen-space minimum of ~2 px, so the line reads from any altitude.
  - Day/night intensity is driven by `uNight`.
- **Rolling stock:**
  - Procedural builders in the pipeline (`lib/rollingstock.js`) emit `trains.glb` with four models: CTA 5000-series, CTA 7000-series, Metra bi-level coach, Metra locomotive.
  - Each has an accurate outline, 14.6 m CTA cars, and livery with the line-colour sign; 2–5k triangles per car, plus a box impostor for LOD.
  - Rendering: one instanced mesh per model, so at most 8 calls with lights.
- **Motion:** `app/src/transit/sim.js`. It is deterministic from wall-clock time and headways per line and time of day:
  - arc-length motion with acceleration and braking;
  - station dwell;
  - each car's two bogies sampled on the path, so cars articulate round curves;
  - direction per track.
  Live CTA positions (Phase 5) snap onto the same path, and the simulator is the fallback.
- **Night:** headlights, window glow, lit signs, and glow spill on the track.
- **Controls:**
  - A Transit dock button toggles trains, glow and the legend.
  - The line legend lets each line be switched off.
  - ⌘K offers "Go to <station>", "Show <line>" and "Follow a <line> train"; the follow camera exits on any key.
  - Clicking a train or station opens a card with line, run, next stop and arrivals (arrivals are live in Phase 5).

### B.4 Stadiums and sports life (D1–D15)
- **Fixes:**
  - No trees inside any venue hull (root-cause Soldier Field).
  - Arena roofs: United Center stepped and domed, Wintrust vaulted. These are new crown primitives, `vault` and `stepdome`.
  - Floodlit night views for Soldier Field and Rate Field, matching Wrigley.
- **Fields:**
  - Each venue gets a canvas-generated field texture in its local field frame, with sourced colours:
    - Soldier Field: turf stripes, yard numbers, navy and orange end zones with "CHICAGO" / "BEARS" wordmarks, and a midfield mark.
    - Wrigley: grass pattern, clay, chalk.
    - Rate Field: black and silver accents.
  - It replaces the flat paint layers, stays on one draw call per venue, and works at LOW.
- **Game state:** `app/src/sports/gameState.js` is a pure function of (venue, time, schedule) returning `idle | pregame | live | postgame`, plus `winDay` (a Cubs win that Chicago date).
  - The schedule and past results are fetched at build time from ESPN's public schedule JSON into `schedules.json`, with a simulated calendar as fallback.
  - Live scores arrive in Phase 5 through the CHI API.
- **Life:**
  - **Crowds:** instanced camera-facing impostors on seat anchors emitted by the venue builder, shirts weighted by team colours, slight idle motion, density by state.
  - **Players:** instanced capsule figures in sport formations, with a ball arc.
  - **Scoreboards:** show the score as a texture.
  - **Cubs win day:** the W flag flies over the Wrigley scoreboard and fans wave W flags.
  - **Arena game nights:** lit fascia and a plaza crowd.
  - **Cheers:** positional WebAudio synthesised from shaped noise (no audio assets), off by default behind a Sound button shared with the train rumble.
  - Crowds and players are culled beyond 1.5 km and disabled at LOW.

### B.5 Landmarks and bridges (E1–E10)
- **Buckingham Fountain:**
  - Pink marble tiers with scalloped basins, the correct 85 m pool, and the ~27 m tiered form.
  - Four pairs of bronze seahorses (procedural lathe and tube sculpture, or Blender).
  - A GPU-particle water show on the real schedule: hourly shows, May–October, ~8 am–11 pm, with coloured light in the evening.
- **Cloud Gate:** the true omphalos shape (~20 × 13 × 10 m), with a low-resolution cube-camera environment refreshed every ~30 frames, so it mirrors the sky and skyline.
- **Bridges** (`pipeline/lib/bridges.js` + `data/bridges.json`, named and sourced):
  - Chicago-type trunnion bascule leaves (truss or girder, open grid deck).
  - Tender houses; the four DuSable (Michigan Avenue) bridge houses; lanterns and navigation lights.
  - An optional lift animation as an easter egg.
- **P1 landmarks:** Navy Pier (entrance building, Grand Ballroom dome), Riverwalk, Art Institute (lions, Modern Wing), Crown Fountain (animated face screens), Lurie Garden, BP Bridge, the Picasso, the Flamingo, Cultural Center dome, Union Station, the Merchandise Mart river face, and the Lincoln Park Zoo and Conservatory.
  - Each gets a `heroes.json` entry with sources, a ⌘K alias and a VISIT beacon anchor.
  - The P2 landmarks move to Phase 3; the Museum of Science & Industry moves to Phase 6, since it is out of bounds.

### B.6 True building colours and materials (F1–F11)
- **Data:** `heroes.json` gains a sourced `look` block: `{ base, glass, mullion, spandrel, finish: granite|limestone|terracotta|metal|glass|concrete, crownLight? }`.
- **How it renders, with no new materials:**
  - A per-vertex `_STYLE` index (0 = none) selects a row in a small style palette DataTexture, which the shared façade shader reads.
  - Draw calls do not change.
- **Targets:** Willis black with bronze glass; Aon white granite; Trump silver glass; Wrigley Building white terra cotta, floodlit; Tribune limestone; and the rest of the 41 heroes per the backlog.
  - Non-hero buildings may use the OSM `building:colour` and `building:material` tags, subject to evaluate-and-revert.

### B.7 Camera (G1–G6)
- **Clearance:** the pipeline bakes `heightfield.png` (max roof height per 8 m cell, 16-bit). Flights lift their path and end pose, and free flight clamps the camera to height + 25 m by sliding, not stopping. Follow-train and venue focus use the same clearance.
- **Keys:** ⌘K and Ctrl+K close the palette from its input, and Ctrl+K never falls through to the browser.
- **e2e:** tests wait for the camera to come to rest instead of a fixed 4 s.

### B.8 Carried review items (H1–H11)
The Phase 2.5 deferred minors are scheduled in milestone 1. The draw-call budget in B.1 is enforced by a perf check at the end of every milestone.

### B.9 Phasing (supersedes §13 from here on)
The vision pass runs as milestones V1–V8 (see the master plan):
- **V1:** correctness, camera clearance and water
- **V2:** colours and materials
- **V3:** static transit
- **V4:** trains
- **V5:** stadiums
- **V6:** landmarks and bridges
- **V7:** controls integration and help
- **V8:** performance, gallery and review

Then the revised phases:
- **Phase 3:** hero refinement plus the P2 landmarks.
- **Phase 4:** guide lenses, with places/POIs (bars, restaurants, venues) and transit integration.
- **Phase 5:** Alive, adding live CTA, live scores, weather and Scan.
- **Phase 6:** further rings, including the Museum of Science & Industry.
- **Phase 7:** traversal, including riding a train.
