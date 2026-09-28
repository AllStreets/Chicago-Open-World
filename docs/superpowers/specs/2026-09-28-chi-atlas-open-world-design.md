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
