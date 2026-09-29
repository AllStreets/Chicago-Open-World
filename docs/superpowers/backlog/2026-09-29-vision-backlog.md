# CHI ATLAS · OPEN WORLD — Vision Backlog (2026-09-29)

**Sources**
- **S1**: the user's message of 2026-09-29 (primary source): building colours, lake, transit, stadiums, landmarks, README gallery, and process.
- **S2**: requests from earlier sessions that are still open or partly open. These are the Phase 2.5 review minors, camera follow-ups, the draw-call budget, Addendum A phase revisions, the places layer, and the standing rules held in memory.
- **Coordinator corrections (2026-09-29)**:
  - Camera drift in a fresh profile was not a bug; the user was interacting with the test browser. It stays only as a low-priority e2e settle check (G5).
  - River bridges now render again, so the regression is fixed. Only *detailed* bridges are new work (E4–E7).

**Mode:** no human in the loop. Build until the vision is realized. **Coding waits for the user's explicit "go ahead".** Until then, only writing happens: this backlog, the master plan, per-feature plans, the spec update, and commits of those docs.

Origin tags: `[S1]`, `[S2]`, `[derived]` (needed to deliver an S1/S2 item).

---

## Standing directives (apply to every item)

1. **Realism first, with a tasteful neon accent.** Aim for faithful geometry, colours and materials. Add a subtle neon glow in each official line colour along the tracks, readable from street level, bird's-eye and every angle in between. The glow must never read as cartoonish, and it stays restrained by day and blooms at night.
2. **Try it; revert what looks bad.** Before-and-after screenshots at fixed poses are required for every colour, material or glow change. A change that looks visually unpleasing is removed, and the removal is noted in the ledger.
3. **README images are history.** Never replace or overwrite an existing README image. New screenshots are *added* to a progressive gallery (phase 1 → 2 → 2.5 → …), so readers see the evolution. Keep the current README layout and hero.
4. **Human-first controls.** Every feature gets a visible, non-coder control path: a button, key, ⌘K entry, hint-bar text or help-card line. URL params are never the only path.
5. **Push after each phase or major task** to `AllStreets/Chicago-Open-World` `main`.
6. **RAM discipline.** Nothing heavy runs (dev server, builds, Playwright, pipeline) until the user says go. After that, this project is the only heavy process.
7. **Budgets.** At most 900 draw calls on wide shots (current ~1,188), at most 4 M triangles per frame, 60 fps target on M-series at HIGH. New features ship with instancing or merging plus a LOW-quality fallback.
8. **Accuracy is sourced.** Colours, car models, line routes, schedules and landmark dimensions each cite a source in the pipeline data (`heroes.json`, `transit.json` and similar).
9. **Graceful live data.** Every live feed (CTA, sports) has an offline or simulated fallback and a `LIVE` / `SIMULATED` chip. The app never shows error UI beyond the chip.

---

## A. Process & docs

- [ ] **A1** `[S1]` — Write this backlog. Acceptance: the file exists, and every S1 clause is mapped in the traceability table.
- [ ] **A2** `[S1]` — Write the master plan, `docs/superpowers/plans/2026-09-29-vision-master-plan.md`. It orders sections B–I into phases or milestones with dependencies, and marks each milestone's push point. Acceptance: every backlog ID appears in exactly one milestone.
- [ ] **A3** `[S1]` — Write one implementation plan per feature area: water, transit, stadiums & sports life, landmarks & bridges, building colours, camera, review minors. Acceptance: a plan file per area in `docs/superpowers/plans/`, each with tasks, files, tests and screenshot poses.
- [ ] **A4** `[S1]` `[S2]` — Write the revised later-phase plans (3 heroes, 4 guide, 5 alive, 6 rings, 7 traversal) against Addendum A and this backlog. Acceptance: five plan files exist, each referencing the section I IDs.
- [ ] **A5** `[S1]` — Update the spec with Addendum B, "Vision pass": unified water, transit, sports life, landmark detail, true building colours, the README gallery rule and the ≤ 900 budget. It also reconciles §5 "L tracks" and §10 trains with section C. Acceptance: the addendum is merged into the spec, and §13 phasing is updated.
- [ ] **A6** `[S1]` — Commit and push the backlog, plans and spec (docs only). Acceptance: the commit is on `origin/main`, and no code changed.
- [ ] **A7** `[S1]` — Stop and wait for the user's explicit "go ahead" before any coding, build, test or browser run. Acceptance: no code commits before the go-ahead message.
- [ ] **A8** `[S1]` — README progressive gallery: add a "How it came together" section showing phase 1 → 2 → 2.5 → vision pass in order, starting with the initial phase-1 images (`phase1-*.png`, which are currently unused in the README). Acceptance: the phase-1 images appear first, all existing images are unchanged, and new images are appended with a date or phase caption.
- [ ] **A9** `[S1]` — Never overwrite a README image file. New shots use new filenames (for example `phase3-*.png` or `vision-*.png`). Acceptance: `git log` shows no modification of any existing `docs/screenshots/*.png`.
- [ ] **A10** `[S1]` — Record S1 feedback in the README story: the note "bridges are starting to look good" is logged as a milestone caption in the gallery. Acceptance: the gallery contains a bridges image with a caption.
- [ ] **A11** `[S2]` — Push after each phase or major task (memory rule). Acceptance: each milestone in A2 ends with a push step.
- [ ] **A12** `[derived]` — Keep the ledger at `.superpowers/sdd/<vision-pass>/progress.md` with rulings, including evaluate-and-revert decisions (F10) and the ambiguity defaults below. Acceptance: the ledger exists and every revert is logged.
- [ ] **A13** `[derived]` — Update the README roadmap and badges as each milestone lands, without touching images. Acceptance: roadmap checkboxes match the shipped work.

## B. Water & lake

- [ ] **B1** `[S1]` — Unify the water look. River, harbors, lagoons and other OSM water polygons currently use the flat `river` material with a tiled normal map, while Lake Michigan uses the reflective `Water` shader in `Lake.jsx`. Make them visually continuous with a shared reflective shader: same colour ramp and normals, with reflections of the skyline. Acceptance: in the dusk lakefront-park pose (S1 screenshot 2), the harbor or lagoon polygon and the lake read as one water body, with no ripple-pattern seam.
- [ ] **B2** `[S1]` — Explain and fix "why is the water different". Document the root cause in the ledger: two materials, the y-offset between the polygon water and the lake plane at y −2, and the different normal scale. Acceptance: the ledger entry exists, and B1 is verified at 3 poses.
- [ ] **B3** `[S1]` — Fix the grey far-lake colour mismatch in S1 screenshot 1 (Streeterville from ~438 m). The far lake plane reads grey against blue harbor water; tune the fog and horizon blend, distance colour and reflection falloff. Acceptance: at the 438 m Streeterville pose, the lake has one continuous hue from shore to horizon, and it tracks time of day.
- [ ] **B4** `[S1]` — Extend the lake coverage east (and north and south along the shore) so the lake reaches the horizon from every in-bounds camera pose and altitude up to the max distance. Acceptance: no visible lake edge or void at the max camera distance (6 km) in any direction.
- [ ] **B5** `[S1]` — Harbors inside the breakwaters (Monroe, DuSable, Burnham, 31st St) and the lagoons (Lincoln Park, Northerly Island) use the unified water with a calmer ripple. Acceptance: harbors are visibly calmer than the open lake but share its colour and reflections.
- [ ] **B6** `[derived]` — Shoreline transition: add a soft foam or depth tint where the lake meets the revetments, beaches and breakwaters, and hide the seam between the polygon water and the lake plane (z-fighting and height). Acceptance: no z-fighting or hard seam in close-up shore poses.
- [ ] **B7** `[derived]` — Breakwaters and revetment steps get visible geometry, so the harbors read correctly. Acceptance: breakwater lines are visible from the Streeterville pose.
- [ ] **B8** `[derived]` — Night water: lit windows, bridge lights and track glow reflect in the river and lake. Acceptance: the night river pose shows reflected light streaks.
- [ ] **B9** `[derived]` — Keep the river-turns-green easter egg (March 17, spec §5) working with the unified shader. Acceptance: a unit test on the date → tint switch.
- [ ] **B10** `[derived]` — Water performance stays within budget: reflections at most once per frame, and a LOW quality mode without reflections. Acceptance: the draw-call and frame-time delta from water is logged and within budget.

## C. Transit

- [ ] **C1** `[S1]` — Transit data build: CTA L routes (Red, Blue, Brown, Green, Orange, Pink, Purple, Yellow if in bounds) and Metra lines (UP-N, UP-NW, UP-W, MD-N, MD-W, BNSF, RI, SWS, HC, ME, NCS) with elevated, embankment, at-grade and subway classification. Emit `transit.json` plus a per-tile track geometry. Acceptance: the pipeline test checks each line's presence and its segment counts inside the bounds.
- [ ] **C2** `[S1]` — Recolour the rail lines to official colours. CTA: Red #c60c30, Blue #00a1de, Brown #62361b, Green #009b3a, Orange #f9461c, Pink #e27ea6, Purple #522398, Yellow #f9e300. Metra uses its brand blue, with per-line accents if sourced. Shared trackage (the Loop, the Purple/Brown/Red corridor) shows the stacked colours of the lines that run on it. Acceptance: the Loop from above shows the multi-colour ribbon, and a colour test checks the hex values.
- [ ] **C3** `[S1]` — Neon line-colour glow on the tracks: an emissive strip or edge glow per line colour, visible from street, bird's-eye and oblique views. It is subtle by day and blooms at night, and the glow width is distance-compensated so it stays readable when far. Acceptance: screenshots at street, 150 m and 1,000 m, day and night, all show readable line colours, and the pass/fail against directive 1 is logged.
- [ ] **C4** `[S1]` — Update the rail structure itself (`ElevatedL.jsx`): accurate steel bents and girders, ties and running rails, third rail, a walkway, and the Loop elevated box junctions (Tower 18). The colour treatment is realistic steel plus the line-colour accent. Acceptance: a street-level Wells/Lake pose shows rails and girders, not a flat ribbon.
- [ ] **C5** `[S1]` — Embankment and at-grade segments (Metra embankments, Green Line south, Red Line Dan Ryan median) and subway portals (for example the Red at North/Clybourn area if in bounds, and the Blue portals). Subway segments are hidden underground, and an optional ghosted glow line can show them in Scan. Acceptance: no floating track or track through buildings.
- [ ] **C6** `[S1]` — Accurate CTA train replicas: the 5000-series (Red, Green, Pink, Purple, Yellow, Orange/Brown as operated) and the 7000-series (Blue, Brown as operated), with the correct car length (~14.6 m), stainless body, the line-colour destination sign, windows, and 2–8 car consists per line. Acceptance: a close-up side-by-side with a reference photo is logged, and the car count per line is sourced.
- [ ] **C7** `[S1]` — Metra train replicas: bi-level gallery cars with MP36/F40PH/F59PHI or SD70MACH locomotives, in push-pull consists. Acceptance: a close-up comparison is logged.
- [ ] **C8** `[S1]` — Animate trains along the track geometry, with acceleration and deceleration, dwell at stations, correct direction per track, and car-to-car articulation around curves. Trains are instanced (one draw call per car type). Acceptance: trains visibly run the Loop and stop at stations, with no more than 4 draw calls added.
- [ ] **C9** `[S1]` — Train lights: headlights, interior window glow and a line-colour sign at night, plus a soft glow reflected on the track. Acceptance: the night pose shows lit trains.
- [ ] **C10** `[S1]` — Stations: platforms, canopies and stairs for the elevated stations in bounds (Loop stations, Merchandise Mart, Chicago/Franklin, Clark/Division is subway, Fullerton, Belmont, Addison, and others), with line-colour signage. Acceptance: the stations list comes from CTA station data, and each station has geometry at the correct location.
- [ ] **C11** `[S1]` — Live train positions via the CTA Train Tracker API (`ttpositions`, as used by the sibling `~/Downloads/chi/backend/routes/cta.js` `/api/cta/trains`) through the CHI ATLAS API. Poll every 30 s and interpolate along the geometry (as in CHI's `trainAnimState.js`). Acceptance: with the API live, the chip reads `LIVE CTA`, and train positions match the tracker within one poll.
- [ ] **C12** `[S1]` — Schedule or simulated fallback: GTFS-based or headway-based simulated trains per line (spec §10 `simulator.js`), including Metra, which has no live feed in CHI today (use GTFS scheduled times). Acceptance: offline, trains still run and the chip reads `SIMULATED`.
- [ ] **C13** `[S1]` — Transit HUD: a TRANSIT toggle button in the dock, a line legend with colour swatches (each line toggleable), a hint-bar entry and a help-card line. Acceptance: a non-coder can turn trains or the glow on and off with a button.
- [ ] **C14** `[S1]` — ⌘K transit entries: "Go to <station>", "Follow a <line> train", "Show <line> line". Acceptance: the palette test covers the entries.
- [ ] **C15** `[S1]` — Follow-train camera: ride along with, or chase, a selected train, and exit with any key. Acceptance: the follow mode works from ⌘K and from clicking a train.
- [ ] **C16** `[S1]` — Train and station info card: the line, run number, next stop and arrivals (CTA `/arrivals`). Acceptance: clicking a train or station opens the context panel.
- [ ] **C17** `[S1]` — Integrate transit with later features:
  - WORK commute lines brighten by usefulness (I-4.x);
  - LIVE neighborhood "nearest L lines";
  - VISIT landmark "nearest L stop";
  - service alerts (CTA `/alerts`) shown as line pulses.

  Acceptance: each integration item is listed in the phase 4 and 5 plans with its own test.
- [ ] **C18** `[derived]` — Track and train audio (optional): the rumble of a passing train, attenuated by distance, muted by default, with a sound toggle in the dock (shared with D12). Acceptance: the sound toggle exists and is off by default.
- [ ] **C19** `[derived]` — CTA buses (optional, low priority): the Bus Tracker is already used by CHI. Acceptance: a deferred item is recorded in the phase 5 plan.
- [ ] **C20** `[derived]` — Perf: all tracks, glow, trains and stations fit within the ≤ 900 draw-call budget. Acceptance: a perf log for the Loop wide shot.

## D. Stadiums & sports life

- [ ] **D1** `[S1]` — Remove the trees on the Soldier Field field. Root-cause it: park-scatter trees from the Burnham Park polygon, or a gap in the venue-hull tree removal in `venue.js` or the build. Acceptance: zero trees inside any venue hull (Soldier Field, Wrigley, Rate Field, and the arenas), plus a pipeline test on the venue hulls.
- [ ] **D2** `[S1]` — Proper arena roofs: the United Center gets a curved or stepped roof with its fascia, and Wintrust Arena gets a gently curved roof with its glass-steel walls. Both replace the extruded boxes. Acceptance: aerial shots show recognizable roofs, compared with a reference and logged.
- [ ] **D3** `[S1]` — Correct field colours and markings on the open-air stadiums:
  - Soldier Field: green turf, Bears "C" at midfield, navy and orange end zones with "BEARS"/"CHICAGO" lettering, yard numbers;
  - Wrigley: grass, infield clay, the ivy wall, the green manual scoreboard;
  - Rate Field: grass, infield, White Sox black and silver accents.

  Acceptance: aerial and in-bowl shots are logged against references.
- [ ] **D4** `[S1]` — Soldier Field is visible at night: restore its floodlights (the `lights` entry was removed in `heroes.json`) as rim-mounted light rows, with a lit field and a colonnade uplight. Acceptance: the NIGHT preset shows Soldier Field lit, like Wrigley.
- [ ] **D5** `[S1]` — Rate Field is visible at night: verify and fix its light towers, field glow and bowl lighting. Acceptance: the NIGHT preset shows Rate Field lit and readable from the Loop.
- [ ] **D6** `[S1]` — Idle vs game-day states: on game days or at game times, lights are on and the stands are full. When no game is on, lights are off at night (or low), the stands are empty and the field is a groundskeeping green. Acceptance: a state machine with a unit test, plus a visible difference between the two states.
- [ ] **D7** `[S1]` — Live schedule and score data from ESPN scoreboard and schedule endpoints (as in the sibling `chi/backend/routes/sports.js`) via the CHI ATLAS API: Cubs, White Sox, Bears, Bulls, Blackhawks, Fire, Sky. Acceptance: the game state per venue is derived from the feed, and there is a simulated fallback.
- [ ] **D8** `[S1]` — Crowds in the stands: instanced low-poly or impostor fans, with team-colour-weighted shirts, subtle idle motion, and density by attendance. Acceptance: in-bowl shots show a crowd, with at most 3 added draw calls per venue.
- [ ] **D9** `[S1]` — A game in progress: simple animated players in the correct formations (9 fielders plus a batter and runners for baseball, 22 players for football) with team colours, and a ball arc. Acceptance: when D6 is "game", motion is visible on the field.
- [ ] **D10** `[S1]` — Cheers: crowd audio that swells on scoring events from the live data (or randomly when simulated), positional and distance-attenuated, and off by default via the sound toggle. Acceptance: the audio plays near the venue only when enabled.
- [ ] **D11** `[S1]` — Cubs win days: after a Cubs win, the "W" flag flies (white flag with a blue W) over Wrigley's scoreboard, and fans on the field wave W flags. Acceptance: with a simulated Cubs win, the flag is visible; on a loss, no W flag (optionally the blue "L" flag).
- [ ] **D12** `[derived]` — Sports HUD: a "Games" entry in ⌘K ("Go to tonight's game") and a venue card with the score, inning or quarter and the next game. Acceptance: a non-coder can find the live game via a button or ⌘K.
- [ ] **D13** `[derived]` — Venue scoreboards show the live score (the Wrigley manual board, the Rate Field and Soldier Field video boards) as a texture. Acceptance: the score on the board matches the data.
- [ ] **D14** `[derived]` — The United Center and Wintrust show a game-night exterior (lit fascia, crowds on the plaza, the Michael Jordan statue as a small detail). Acceptance: the night game state shows a lit arena.
- [ ] **D15** `[derived]` — Perf and LOW mode: crowds and players are culled beyond ~1.5 km and disabled on LOW. Acceptance: a perf log.

## E. Landmarks & bridges

- [ ] **E1** `[S1]` — Buckingham Fountain in detail:
  - pink Georgia marble, three tiered basins, the lower pool;
  - four pairs of bronze seahorses;
  - an accurate ~85 m pool diameter and the ~27 m tiered geometry.

  Acceptance: a close-up side-by-side with a reference is logged.
- [ ] **E2** `[S1]` — Buckingham Fountain water show: a particle or mesh water plume (the central jet up to ~46 m in the real show) and seahorse jets, animated on the real schedule (hourly shows, roughly May–October, ~8 am–11 pm), with evening colour lighting. Acceptance: at a show time the jet animates, at night it is lit in colours, and it is off out of season.
- [ ] **E3** `[S1]` — A better Cloud Gate (the Bean): a correct shape (the omphalos underside arch, ~20 × 13 × 10 m), mirror-polished steel reflecting the live sky and skyline (env map or cube camera), and the plaza with people. Acceptance: a reference comparison, and the reflection shows the skyline.
- [ ] **E4** `[S1]` — Detailed movable bridges: Chicago-type trunnion bascule leaves (split leaves, counterweight pits, steel truss or girder leaves, open grid decks) for the main-stem and south-branch river bridges in bounds. Acceptance: at least 10 named bridges are modelled, and a close-up river pose shows the bascule structure.
- [ ] **E5** `[S1]` — The Michigan Avenue (DuSable) Bridge in detail: the four bridge houses with their relief sculptures, the double-deck structure and the balustrades. Acceptance: a close-up is logged against a reference.
- [ ] **E6** `[S1]` — Bridge-tender houses on the other bascule bridges (Wabash, State, Dearborn, Clark, LaSalle, Wells, Franklin/Orleans, Lake, Randolph, Washington, Madison, Monroe, Adams, Jackson, Van Buren). Acceptance: each listed bridge has a tender house where one exists.
- [ ] **E7** `[derived]` — Bridge lights at night (the lanterns and the red and green navigation lights) and an optional bridge-lift animation, on a scheduled boat-run easter egg. Acceptance: the night river pose shows the bridge lights.
- [ ] **E8** `[S1]` — Other major public landmarks. Candidate list (P1 first):
  - **P1:** Navy Pier (the entrance building, the Grand Ballroom dome), Chicago Riverwalk, the Art Institute (the Michigan Ave lions and Modern Wing), Crown Fountain (with animated face screens), Lurie Garden, the BP Bridge, the Picasso (Daley Plaza), Calder's Flamingo, Chicago Cultural Center (the Tiffany dome), Union Station, the Merchandise Mart river façade, the Lincoln Park Zoo and Conservatory, and the Museum of Science & Industry (if in bounds, at 41.790 it is **out of bounds**, so defer to I-6).
  - **P2:** Maggie Daley Park (the ribbon), Nature Boardwalk, the Chicago Board of Trade Ceres statue, Rookery, Monadnock, Marquette, Carbide & Carbon, the Palmer House, Old St. Patrick's, Holy Name Cathedral, the Newberry Library, Lincoln Park's statues, North Avenue Beach house, Oak Street Beach, Northerly Island pavilion, Soldier Field's Doric colonnade detail, the Chicago Harbor Lighthouse, 12th St Beach, Ping Tom Park's pagoda, the Chinatown Gate, and Pilsen murals.

  Acceptance: the P1 set is shipped, each with a reference comparison. P2 is scheduled in the phase 3 plan.
- [ ] **E9** `[derived]` — Landmark registry: each new landmark gets a `heroes.json` entry with sources, a ⌘K alias and a beacon (for the VISIT lens). Acceptance: the ⌘K test finds each landmark by name.
- [ ] **E10** `[S1]` — Bridges "are starting to look good": capture the current state for the gallery before the detail work (see A10). Acceptance: `vision-bridges-before.png` is added.

## F. Building colours & materials

- [ ] **F1** `[S1]` — Per-landmark true colours and material descriptors in `heroes.json` (base colour, glass tint, mullion colour, spandrel colour, roughness/metalness, source URL). Acceptance: every hero has a sourced colour block.
- [ ] **F2** `[S1]` — Willis Tower: black anodized aluminium with bronze-tinted glass, and white antennas. Acceptance: a reference comparison at the Loop pose.
- [ ] **F3** `[S1]` — Aon Center: white (the Mount Airy granite recladding), with narrow vertical windows. Acceptance: a reference comparison.
- [ ] **F4** `[S1]` — Trump Tower: silver or blue-grey reflective glass with brushed-steel mullions. Acceptance: a reference comparison.
- [ ] **F5** `[S1]` — Wrigley Building: white glazed terra cotta (graded whites), the clock tower, and night floodlighting. Acceptance: a reference comparison, and night floodlighting is visible.
- [ ] **F6** `[S1]` — Tribune Tower: Indiana limestone and its Gothic crown with buttresses (links to I-3). Acceptance: a reference comparison.
- [ ] **F7** `[S1]` — The remaining heroes:
  - 875 N Michigan: black, with the white antennas and X-braces;
  - St. Regis: blue-green glass;
  - Franklin Center: red granite;
  - Two Prudential: grey granite and its spire;
  - 311 S Wacker: pink granite and a lit crown;
  - Chase: blue-grey granite;
  - Aqua: white slabs and blue-green glass;
  - Marina City: white concrete;
  - Lake Point: bronze glass;
  - Merchandise Mart: buff limestone and brick;
  - CBOT: grey limestone and Ceres;
  - 150 N Michigan: diamond glass;
  - Water Tower Place: white marble;
  - 900 N Michigan: limestone;
  - NEMA, One Chicago, Salesforce, 110 N Wacker, 1000M, 400 LSD: their sourced glass tints.

  Acceptance: all 41 heroes are coloured and sourced.
- [ ] **F8** `[S1]` — "Similar materials": per-hero material presets (polished granite, terra cotta, limestone, anodized metal, reflective or low-e glass), implemented as parameters of the shared façade material, not new materials, so draw calls stay flat. Acceptance: the draw-call count does not increase.
- [ ] **F9** `[derived]` — Crown night lighting where it is iconic (the 311 S Wacker crown, the Wrigley floodlights, Willis antenna beacons, and the Aon and Hancock-style coloured crowns if sourced). Acceptance: the night skyline shows the signature crowns.
- [ ] **F10** `[S1]` — Evaluate-and-revert step: for each F item, take day, dusk and night screenshots at fixed poses before and after the change, then keep or revert according to directive 2, and log the decision. Acceptance: the ledger lists a keep or revert for every F item, and each revert is committed separately.
- [ ] **F11** `[derived]` — Non-hero notable buildings (optional): extend colours via OSM `building:colour` or `building:material` tags where present. Acceptance: tags are consumed with a fallback, and the change is evaluated per F10.

## G. Camera & controls

- [ ] **G1** `[S2]` — Camera collision and clearance: flights (⌘K fly-to, views) and double-click focus must never end with the camera inside a building. Clamp to a minimum clearance above roof heights, sampled along the path and at the end pose. Acceptance: a test flies to the 10 tallest heroes and the dense Loop, and no end pose is inside a building bounding box.
- [ ] **G2** `[S2]` — Free-flight clearance: arrows, WASD or drag cannot push the camera through tall buildings; slide along the surface or rise instead. Acceptance: a manual pass at the Willis base, logged.
- [ ] **G3** `[S1]` `[derived]` — New controls for new features:
  - dock buttons: Transit (C13), Sound (C18/D10), Games (D12);
  - ⌘K groups: Transit, Games, Landmarks;
  - hint-bar and help-card updates.

  Acceptance: the help card lists every new control, and each has a button path.
- [ ] **G4** `[S2]` — ⌘K closes the palette while its input has focus. Ctrl+K on Windows/Linux opens the palette instead of the browser search (call `preventDefault`). Acceptance: a unit or e2e test for both keys.
- [ ] **G5** `[S2]` (low priority; downgraded per the coordinator) — Verify that e2e poses are settled before capture (wait for camera rest instead of a fixed 4 s). This is *not* a drift bug. Acceptance: the e2e helper waits on the camera's rest event.
- [ ] **G6** `[derived]` — Follow-train mode (C15) and venue focus respect G1 clearance. Acceptance: covered by the G1 test set.

## H. Carried-over review minors (Phase 2.5)

- [ ] **H1** `[S2]` — LOD1 and block roofs cover courtyards (`holes: []`); carry the holes through. Acceptance: a courtyard building at LOD1 shows its open courtyard.
- [ ] **H2** `[S2]` — Road buffers notch at tile seams; carry the miter over tile boundaries. Acceptance: no notch at a known seam pose, plus a pipeline test.
- [ ] **H3** `[S2]` — Hero matching by numeric OSM id ignores the way/relation type; match on type plus id. Acceptance: a test with a colliding way and relation id.
- [ ] **H4** `[S2]` — Pipeline non-determinism: sort the `readdirSync` output and make `generatedAt` optional or fixed. Acceptance: two builds give byte-identical output.
- [ ] **H5** `[S2]` — `sacred.js` reshapes `building=yes` storefront congregations against the ruling; leave them alone. Acceptance: a test shows a storefront church keeps its extrusion.
- [ ] **H6** `[S2]` — Trees inside courtyards are removed because the in-building test ignores holes; respect the holes. Acceptance: a test with a courtyard polygon.
- [ ] **H7** `[S2]` — `_BLDG` ids repeat inside blocks; make them unique (needed for picking). Acceptance: a uniqueness test per tile.
- [ ] **H8** `[S2]` — (Duplicate of G4.) ⌘K focus and Ctrl+K on Windows are tracked under G4.
- [ ] **H9** `[S2]` — The `bowl()` `rI` clamp can go negative on tiny hulls; clamp it to at least 0 or a minimum. Acceptance: a unit test with a tiny hull.
- [ ] **H10** `[S2]` — `Land.jsx` never disposes its geometry; dispose it on unmount. Acceptance: code review, plus no leak in a remount test.
- [ ] **H11** `[S2]` — Draw-call budget ≤ 900: wide shots measure ~1,188. Optimise with merging, instancing and LOD1 material batching. Acceptance: the perf overlay shows ≤ 900 at the wide Streeterville and Loop poses.

## I. Later phases (revised per Addendum A and this backlog)

**Phase 3 — Heroes refinement**
- [ ] **I-3.1** `[S2]` — Aqua's undulating balconies (waves). Acceptance: reference comparison.
- [ ] **I-3.2** `[S2]` — Marina City's petal balconies and the parking spiral. Acceptance: reference comparison.
- [ ] **I-3.3** `[S2]` — Crowns: 900 N Michigan (four pavilions), CBOT (pyramid and Ceres), Tribune (Gothic buttresses). Acceptance: reference comparisons.
- [ ] **I-3.4** `[derived]` — Decide between Blender MCP and procedural for each hero; refine only, never recreate. Acceptance: the plan lists the method per hero.
- [ ] **I-3.5** `[S1]` — The P2 landmarks from E8. Acceptance: scheduled and shipped.

**Phase 4 — Guide lenses**
- [ ] **I-4.1** `[S2]` — Places/POI layer: bars, restaurants, venues "and everything" (CHI API places + OSM amenities), shown as rooftop-anchored pins. Acceptance: the VISIT lens shows the pins, and the pins can be filtered.
- [ ] **I-4.2** `[S2]` — The VISIT lens: beacons, landmark cards, 3 tours (spec §9). Acceptance: per spec.
- [ ] **I-4.3** `[S2]` — The LIVE lens: neighborhood zones, profile cards, feel scores. Acceptance: per spec.
- [ ] **I-4.4** `[S2]` — The WORK lens: commute model and isochrones; L lines brighten by usefulness (uses C2/C3). Acceptance: per spec, plus the Wrigleyville → Loop test.
- [ ] **I-4.5** `[S1]` — Transit integration in the lenses (C17). Acceptance: nearest-L data in each card.
- [ ] **I-4.6** `[derived]` — Hover tooltips and building cards, which need H7 unique ids. Acceptance: hovering shows the name, address, stories and year.

**Phase 5 — Alive**
- [ ] **I-5.1** `[S2]` — CHI ATLAS API hookup, health probe, `LIVE`/`SIMULATED` chip. Acceptance: per spec §10.
- [ ] **I-5.2** `[S1]` `[S2]` — Live L trains: C11 and C12 here, or pulled forward.
- [ ] **I-5.3** `[S2]` — Weather: overcast, rain, snow and lake fog from the live feed. Acceptance: each state is visible.
- [ ] **I-5.4** `[S2]` — Scan holographic mode (`S`). Acceptance: per spec §7, plus a human-first button.
- [ ] **I-5.5** `[S1]` — Live sports state: D6, D7, D11 and D13.

**Phase 6 — Further rings**
- [ ] **I-6.1** `[S2]` — Stream beyond the current bounds (south to the MSI/Hyde Park, north to Evanston, west). Acceptance: new rings load within budget.
- [ ] **I-6.2** `[derived]` — Extend the transit, lake (B4) and landmarks (MSI) into the new rings. Acceptance: continuity at the ring edges.
- [ ] **I-6.3** `[derived]` — Auto-quality and LOD tuning for the larger world. Acceptance: perf logs.

**Phase 7 — Traversal**
- [ ] **I-7.1** `[S2]` — Glide/traversal character mode, with a button and a key. Acceptance: a playable glide over the Loop.
- [ ] **I-7.2** `[derived]` — Ride-a-train as traversal (builds on C15). Acceptance: board and alight at stations.

---

## Traceability (S1 clause → IDs)

| # | S1 clause | IDs |
|---|---|---|
| 1 | "this is really starting to look amazing" | context; A8 (gallery) |
| 2 | "get the major buildings' colors right" | F1–F7, F9 |
| 3 | "maybe similar materials at least possibly try" | F8, F11 |
| 4 | "if it looks visually unpleasing we remove it" | F10, directive 2 |
| 5 | [screenshot 1: far lake grey vs blue harbor] | B3, B1 |
| 6 | "extend out the lake coverage" | B4 |
| 7 | "update the rail" | C4, C5 |
| 8 | "animate perfect replicas of the trains" | C6, C7, C8, C9 |
| 9 | "update the rail lines themselves to the colors of the lines" | C1, C2 |
| 10 | "start integrating transit amongst our other later features" | C11–C17, I-4.4, I-4.5, I-5.2 |
| 11 | "bring this to life" | C8, D6–D11, E2, I-5 |
| 12 | "toe the line between making this as realistic as possible" | directive 1, C4, C6, F-series |
| 13 | "slight neon glows of the colors of the lines on the tracks" | C3 |
| 14 | "visible in an attractive way from any angle or view street, birds eye" | C3 |
| 15 | "now there are trees in soldier field" | D1 |
| 16 | "replace the roofs properly of the arenas" | D2 |
| 17 | "fields of the corresponding sports must be visible on the open air stadiums… with the right colors" | D3 |
| 18 | "loop in games happening" | D7, D9 |
| 19 | "people in the stands" | D8 |
| 20 | "cheers" | D10 |
| 21 | "people waving W flags on the field on days the cubs win" | D11 |
| 22 | "a game happening during games or when they are not happening" | D6 |
| 23 | "soldier field should also be visible at night like wrigley" | D4 |
| 24 | "and so should the white sox stadium" | D5 |
| 25 | "add major public landmarks as well" | E8, E9 |
| 26 | "buckingham fountain in detail" | E1, E2 |
| 27 | "the bridges in detail" | E4, E5, E6, E7 |
| 28 | "and other things of course" | E8 (P1/P2), I-3.5 |
| 29 | "don't update the image in the readme… see the evolution" | A9, directive 3 |
| 30 | [screenshot 2: two water looks side by side] | B1, B5, B6 |
| 31 | "why is the water different here?" | B2 |
| 32 | "SUBAGENT… TO DO LIST… SO NOTHING GETS LOST" | A1 |
| 33 | "then fix and do everything else" | A2–A7, all sections |
| 34 | "I do not need to be a human in the loop anymore just build until my vision is realized" | header mode; A2, A12 |
| 35 | "buckingham fountain as well as the bean need to be better" | E1, E2, E3 |
| 36 | "write the plan for all of this after the subagent puts it together" | A2 |
| 37 | "write the plan for each of the individual tasks we have discussed coming later" | A3, A4 |
| 38 | "then write the spec" | A5 |
| 39 | "then commit" | A6 |
| 40 | "go through with all of it but do not do the coding until I say go ahead" | A7, directive 6 |
| 41 | "just write for a while while I finish another ram intensive project" | directive 6, A7 |
| 42 | "then let this be the only thing running" | directive 6 |
| 43 | "I actually love where the current Read me is" | A8 (keep the layout) |
| 44 | "initial images and like a progressive, almost gallery of how this has come together" | A8, A13 |
| 45 | "and pull from the" (truncated) | A8 (default: pull from `docs/screenshots/phase1-*` and git history; see Q1) |
| 46 | "the bridges are starting to look good" | A10, E10 |

---

## Open questions / ambiguities (defaults chosen; no human in the loop)

1. **"and pull from the…" is truncated.** Default: pull the early images from `docs/screenshots/phase1-*.png` and from older README revisions in git history, and build the gallery chronologically.
2. **"Perfect replicas" versus budget.** Default: an accurate silhouette, proportions, livery and consist at about 2–5k tris per car, with an LOD impostor at distance. "Perfect" means recognizable at street level, not CAD-accurate interiors.
3. **Metra colours.** Metra has no per-line colour tradition on track. Default: a uniform Metra blue (#005596-ish, from a sourced brand value) with a subtle glow, dimmer than the CTA glow.
4. **Live data route.** Default: all live feeds go through the CHI ATLAS API (it adds CORS and hides keys); the app never calls the CTA or ESPN directly. The feeds are CTA `/api/cta/trains`, `/arrivals`, `/alerts` and sports `/api/sports`.
5. **"W flags on the field."** Real fans wave W flags in the stands and on the concourses after a win. Default: after a Cubs win, the W flag flies over the scoreboard and fans in the stands and on the field wave flags for the rest of that day (Chicago time).
6. **Game-day with no live data.** Default: a simulated schedule (typical home dates) drives D6, and the chip reads `SIMULATED`.
7. **Audio (cheers, trains).** Default: off until the user enables it with the Sound button, because browsers block autoplay and people should not be surprised by sound.
8. **Scope of "major public landmarks."** Default: ship the E8 P1 set in the vision pass, and schedule P2 in Phase 3. Anything outside the bounds (MSI) waits for Phase 6.
9. **The order of transit versus Phase 5.** Default: static tracks, colours, glow and simulated trains ship in the vision pass; the live CTA feed ships with the Phase 5 API hookup unless the hookup is trivial.
10. **Neon glow by day.** Default: at most ~15 % intensity by day, full at dusk and night, with a user toggle.
11. **Camera drift.** Per the coordinator, this is not a bug; it is kept only as the G5 e2e settle check.
12. **Bridges hidden.** Per the coordinator, this is already fixed; only detail work remains (E4–E7).
