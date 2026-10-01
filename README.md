<div align="center">

# CHI ATLAS · OPEN WORLD

**THE CITY, AT FULL SCALE**

<img alt="phase" src="https://img.shields.io/badge/phase-4_guide_complete-45d8ff?style=for-the-badge&labelColor=030509"/>
<img alt="buildings" src="https://img.shields.io/badge/real_buildings-105,971-ff3b53?style=for-the-badge&labelColor=030509"/>
<img alt="landmarks" src="https://img.shields.io/badge/landmarks-107-45d8ff?style=for-the-badge&labelColor=030509"/>
<img alt="draw calls" src="https://img.shields.io/badge/draw_calls-≤900-ff3b53?style=for-the-badge&labelColor=030509"/>
<img alt="skyline" src="https://img.shields.io/badge/top_50_skyline-verified-ff3b53?style=for-the-badge&labelColor=030509"/>
<a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-45d8ff?style=for-the-badge&labelColor=030509"/></a>
<br/>
<img alt="stack" src="https://img.shields.io/badge/stack-React_19_·_Three.js_·_R3F-6b7382?style=flat-square&labelColor=030509"/>
<img alt="data" src="https://img.shields.io/badge/data-City_of_Chicago_·_OpenStreetMap-6b7382?style=flat-square&labelColor=030509"/>
<img alt="tests" src="https://img.shields.io/badge/tests-Vitest_·_Playwright-6b7382?style=flat-square&labelColor=030509"/>

</div>

---

<p align="center">
  <img src="docs/screenshots/phase2-streeterville-dusk.png" alt="Dusk over Streeterville — Willis and Trump against an amber horizon, windows coming on" width="100%"/>
</p>

<p align="center"><em>Dusk over Streeterville. Real footprints at real heights, generated façades, windows lighting up floor by floor as the real Chicago sun goes down.</em></p>

---

## What this is

**An explorable, game-quality Chicago that runs in your browser** — and a new way to plan
a visit, a move, or a job in a city. Fly it like a drone, orbit a tower, drop down the river canyon.

It is the sibling of [CHI ATLAS](https://github.com/AllStreets/chi) — same mission-control HUD
(near-black glass, electric cyan, Chicago red, Michroma / Archivo / IBM Plex Mono) — but the map is
replaced by a full 3D city built from public data, and, in later phases, hand-modelled Blender
landmarks, generated façade textures, live L trains and three guide lenses: **VISIT · LIVE · WORK**.

The world is projected into metres around **State & Madison** — the zero point of Chicago's address
grid — so the HUD always knows which corner you are over.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/phase2-streeterville-night.png" alt="Streeterville at night" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/phase2-hancock-dusk.png" alt="The tapered Hancock at dusk" width="100%"/></td>
</tr>
<tr>
<td><em>Night — offices light whole floors at a time; the lake carries the reflections.</em></td>
<td><em>875 N Michigan, tapered like the real obelisk, masts on the roof.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/phase2-museum-day.png" alt="Grant Park and the skyline from Museum Campus" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/phase2-river-day.png" alt="The Chicago River canyon" width="100%"/></td>
</tr>
<tr>
<td><em>Grant Park in September — the trees follow the real calendar.</em></td>
<td><em>Down the river canyon to Trump Tower, the Riverwalk lined with trees.</em></td>
</tr>
</table>

### The expanded city (Phase 2.5)

<table>
<tr>
<td width="50%"><img src="docs/screenshots/phase25-wrigley-night.png" alt="Wrigley Field lit for a night game" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/phase25-soldier-field.png" alt="Soldier Field inside its colonnades" width="100%"/></td>
</tr>
<tr>
<td><em>Wrigley under the lights — ivy, the hand-turned scoreboard, the grandstand roof.</em></td>
<td><em>Soldier Field — the bowl rising out of its limestone colonnades.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/phase25-ukrainian-village.png" alt="Onion domes in Ukrainian Village" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/phase25-st-mary-dusk.png" alt="St. Mary of the Angels at dusk" width="100%"/></td>
</tr>
<tr>
<td><em>Ukrainian Village — Orthodox cathedrals get their onion domes.</em></td>
<td><em>St. Mary of the Angels, dome and twin towers, stained glass coming on at dusk.</em></td>
</tr>
</table>

- **The whole north–south spine** — Addison (Wrigleyville) to 35th Street, Western Avenue to the lake: 110 km², 105,971 buildings from OpenStreetMap, enriched with City of Chicago data, streamed in 500 m tiles and 2 km far blocks with meshopt compression.
- **A skyline you can check** — the top 50 towers are validated against a curated list on every build (St. Regis, One Chicago, NEMA, 400 Lake Shore included); 41 landmarks are hand-specified — setbacks, crowns, spires, tints.
- **Stadiums** — Wrigley, Rate Field and Soldier Field are built as real venues: raked two-tier bowls, surfaced fields (infield clay, mound, foul lines, yard lines, end zones), light towers, scoreboards, the Wrigley marquee and ivy, Soldier Field's colonnades — and they light up for a night game.
- **Sacred buildings** — about 220 churches, cathedrals, synagogues, temples and a mosque get gabled naves, steepled towers facing the street, onion domes or a dome and minaret, and lancet windows that glow like stained glass at night.
- **Civic icons** — the Centennial Wheel (with its LED rim), Cloud Gate in mirror steel, Buckingham Fountain, Pritzker Pavilion's steel headdress and trellis, the Chicago Theatre sign, the Adler and Shedd domes, the Field Museum's porticos, the 1869 Water Tower.
- **No edge of the world** — beyond the detailed area, 50,000 simple buildings on Chicago's real street grid carry the city to the horizon, with suburbs beyond the city limits.
- **Human controls** — ⌘K search with fly-over flights, arrow keys, on-screen control dock, views you can step through, help card; the whole HUD scales together on any window size.

### The beauty pass

- **Façades** — eight Chicago façade families (Loop limestone, art deco, prewar brick, curtain glass, precast, River North loft, three-flat, industrial) generated with Z-Image, cropped to whole window bays by autocorrelation and made seamless. Glass reflects the live sky; every tower gets its own tint.
- **Night** — windows light by office floor, warm and cool, per-building occupancy; bloom, a navy sky with stars, amber street light on the roads.
- **Sky** — follows real Chicago time on load (`LIVE · DUSK`), with DAWN / DAY / DUSK / NIGHT overrides that tween over 2.5 s.
- **Rooftops** — parapets, gravel / tar / white-membrane / green roofs, 120 water towers on prewar lofts, 2,440 HVAC units, 329 mechanical penthouses.
- **Ground** — parks, beaches, Lake Shore Drive and the street grid with sidewalks, the elevated Loop L on steel bents, and 28,862 trees coloured by the current month.
- **Landmarks** — Willis's antennas at their real 527 m; Hancock tapered with its masts reseated on the roof.
- **HUD** — heading-up minimap with a compass strip and click-to-fly, a cinematic intro flight from the lake, LOW / HIGH / ULTRA quality with auto-downgrade.

---

## How it came together

A progressive gallery, oldest first. Each phase adds its own shots; when a building is rebuilt, the images that feature it are re-taken at the same pose so the gallery stays true, and the originals move to [Evolution](#evolution) — so you can still watch the city grow from flat boxes to a living place.

### Phase 1 · Foundation — *real footprints, real heights, flat colour*

<table>
<tr>
<td width="33%"><img src="docs/screenshots/phase1-streeterville-dusk.png" alt="Phase 1 — Streeterville at dusk, flat-shaded" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/phase1-loop-day.png" alt="Phase 1 — the Loop by day" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/phase1-museum-day.png" alt="Phase 1 — Museum Campus" width="100%"/></td>
</tr>
<tr>
<td><em>The first frame: City of Chicago footprints extruded to their heights, a physical sky, the lake.</em></td>
<td><em>The Loop — every building present, none of them dressed yet.</em></td>
<td><em>Museum Campus and the skyline from the lake.</em></td>
</tr>
</table>

### Phase 2 · Beauty pass — *façades, light, seasons*

<table>
<tr>
<td width="50%"><img src="docs/screenshots/phase2-loop-day.png" alt="Phase 2 — the Loop by day with generated façades" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/phase2-streeterville-dusk.png" alt="Phase 2 — Streeterville at dusk" width="100%"/></td>
</tr>
<tr>
<td><em>Generated façade families, glass that reflects the sky, rooftops with water towers.</em></td>
<td><em>The same dusk pose as Phase 1 — windows now light floor by floor.</em></td>
</tr>
</table>

### Phase 2.5 · Expanded city — *Wrigleyville to 35th Street, a verified skyline*

<table>
<tr>
<td width="50%"><img src="docs/screenshots/phase25-wrigleyville.png" alt="Phase 2.5 — Wrigleyville and the North Side" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/phase25-centennial-wheel.png" alt="Phase 2.5 — the Centennial Wheel" width="100%"/></td>
</tr>
<tr>
<td><em>From the Loop to the neighbourhoods: 105,971 buildings, Wrigley built as a real ballpark.</em></td>
<td><em>Civic icons arrive — the Centennial Wheel with its LED rim, the Bean, Buckingham Fountain.</em></td>
</tr>
</table>

### Vision pass V1 · One lake — *unified water, camera clearance, clean venues*

<table>
<tr>
<td width="33%"><img src="docs/screenshots/v1-harbor-dusk.png" alt="V1 — Monroe Harbor at dusk, harbour and lake one water body" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v1-lake-horizon-day.png" alt="V1 — the lake runs to the horizon" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v1-river-night.png" alt="V1 — the river at night, windows reflected" width="100%"/></td>
</tr>
<tr>
<td><em>Monroe Harbor at dusk — harbour, breakwater and lake are now one body of water sharing the skyline's reflection.</em></td>
<td><em>No edge of the lake: 120 × 160 km of water fading into a horizon that tracks the time of day.</em></td>
<td><em>The river canyon at night — lit windows streak across the water.</em></td>
</tr>
</table>

### Vision pass V2 · True colours — *every landmark in its real material*

<table>
<tr>
<td width="33%"><img src="docs/screenshots/v2-willis-loop-day.png" alt="V2 — Willis Tower in black aluminium and bronze glass, 311 S Wacker in pink granite" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v2-wrigley-building-night.png" alt="V2 — the Wrigley Building floodlit at night" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v2-westloop-day.png" alt="V2 — West Loop brick lofts coloured from OpenStreetMap tags" width="100%"/></td>
</tr>
<tr>
<td><em>Willis in black aluminium and bronze glass; 311 South Wacker in pink Texas granite; Aon in white Mount Airy granite — 41 landmarks, each colour sourced.</em></td>
<td><em>The Wrigley Building floodlit in warm white, as it has been since 1921 — its Giralda clock tower now carved in full, four clock faces lit; Tribune's crown lit above.</em></td>
<td><em>Ordinary buildings too: 464 mapped brick lofts, dark towers and concrete blocks take their OpenStreetMap colours.</em></td>
</tr>
</table>

### Vision pass V3 · Transit — *the L and Metra in their true colours*

<table>
<tr>
<td width="33%"><img src="docs/screenshots/v3-transit-loop-night.png" alt="V3 — the Loop at night, each line glowing in its CTA colour" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v3-transit-tower18-day.png" alt="V3 — Tower 18 at Lake and Wells from the street" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v3-transit-northside-dusk.png" alt="V3 — the Red and Purple corridor at Fullerton at dusk" width="100%"/></td>
</tr>
<tr>
<td><em>The Loop's corner at Tower 12 at night — Pink, Orange, Green and Brown share the track, each glowing in its official CTA colour.</em></td>
<td><em>The L as steel: bents, plate girders, ties and rails, and the Tower 18 junction at Lake &amp; Wells.</em></td>
<td><em>Every CTA and Metra line from OpenStreetMap — the glow stays a tint by day and blooms at night.</em></td>
</tr>
</table>

### Vision pass · V4 trains — *the L and Metra running on time*

<table>
<tr>
<td width="33%"><img src="docs/screenshots/v4-trains-loop-night.png" alt="V4 — riding a Brown Line train round the Loop at night" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v4-trains-chase-dusk.png" alt="V4 — riding behind a Red Line train at dusk" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v4-trains-metra-day.png" alt="V4 — a Metra MP36 leading a push-pull train of gallery cars" width="100%"/></td>
</tr>
<tr>
<td><em>5000- and 7000-series cars on real headways — accelerating, braking, dwelling at stations, held to 30 mph round the Loop.</em></td>
<td><em>Follow any train from ⌘K or its card; the camera stays above the roofs and lets go on Esc or a movement key (M, X and the other toggles keep following).</em></td>
<td><em>Metra gallery cars and an MP36 in push-pull; everything is simulated from the clock until the live CTA feed arrives.</em></td>
</tr>
</table>

### Vision pass · V5 stadiums — *game nights, crowds and the W*

<table>
<tr>
<td width="50%"><img src="docs/screenshots/v5-soldier-field-night.png" alt="V5 — Soldier Field on a game night" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v5-wrigley-field-day.png" alt="V5 — Wrigley Field from above" width="100%"/></td>
</tr>
<tr>
<td><em>Soldier Field on a game night: rim floodlights, painted Bears end zones, a full bowl and the teams at the line.</em></td>
<td><em>Wrigley from above: crosshatched outfield, clay arc and chalk at MLB dimensions — and the rooftop clubs' steel bleachers across Waveland and Sheffield.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v5-w-flag-day.png" alt="V5 — the W flag over Wrigley's scoreboard" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/sports-united-center-plaza-night.png" alt="United Center game night, the Bulls ribbon round the roof" width="100%"/></td>
</tr>
<tr>
<td><em>After a Cubs win the W flies over the scoreboard, the board reads FINAL, and the fans wave W flags — on the rooftops across Sheffield too.</em></td>
<td><em>United Center game night: lit fascia, a stepped grey dome and, round the parapet, the scrolling Bulls ribbon with the game (a guide display, not a real fixture).</em></td>
</tr>
</table>

Game days come from the real ESPN schedules of all seven Chicago teams. A copy is built with the world, and on the live site our own cached `/api/schedule` function refreshes it every 10 minutes (every minute around a game), so new games, reschedules, results and live scores arrive without a redeploy. The browser never calls ESPN; our own cached /api/schedule does. Without either, the city falls back to a simulated calendar and says so; the game card and the Games panel say where the schedule came from and how old it is.

### Sports pass · *the Bulls board and Play a game*

The United Center now carries the same game information as the open-air boards, in Bulls colours: a four-faced LED board on a mast at the roof centre and a ribbon that scrolls round the parapet (Blackhawks colours on a Blackhawks game night). And any card for Wrigley, Rate Field or Soldier Field has **▶ Play a game** (also `Y` and ⌘K): a 90-second game — the crowd fills, the lights come up, the teams take the field, the board and the marquee tick through the innings, and the crowd stands for every home score. A real live game always wins: during one the button is hidden and the card says "Live now — this is the real game".

<table>
<tr>
<td width="50%"><img src="docs/screenshots/sports-united-center-day.png" alt="United Center by day — the Bulls board on the roof showing the next game" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/sports-united-center-night.png" alt="United Center at night — the Bulls board showing a live score" width="100%"/></td>
</tr>
<tr>
<td colspan="2"><em>United Center — the Bulls board on the roof, showing the same next game and live score as the other venues (a guide display, not a real fixture). By day the next game; at night a game in progress, its score round the parapet too.</em></td>
</tr>
</table>

<table>
<tr>
<td width="50%"><img src="docs/screenshots/sports-showcase-wrigley-day.png" alt="Play a game at Wrigley — mid-game, the card's Stop button" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/sports-showcase-rate-field-day.png" alt="Play a game at Rate Field — a full bowl, the board mid-game" width="100%"/></td>
</tr>
<tr>
<td><em>Wrigley mid-game: a full bowl, both teams on the field, the board and the card on the same inning — ■ Stop the game (or <code>Esc</code>) hands back the real ballpark.</em></td>
<td><em>Rate Field: the White Sox at home, the video board counting the runs as they come.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/sports-showcase-soldier-field-day.png" alt="Play a game at Soldier Field — the Bears mid-game" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/sports-wrigley-w-final-day.png" alt="The W flies over Wrigley's scoreboard at the final" width="100%"/></td>
</tr>
<tr>
<td><em>Soldier Field: the Bears in navy at the line of scrimmage under a full bowl (⌘K also plays a Fire match).</em></td>
<td><em>The final at Wrigley: FINAL on the board, the W up the mast and the fans waving W flags — then the ballpark goes back to its real day.</em></td>
</tr>
</table>

### Vision pass · V6 landmarks and bridges — *bascules, Buckingham, the Bean, the civic icons*

<table>
<tr>
<td width="50%"><img src="docs/screenshots/v6-bridges-before-dusk.png" alt="V6 — the river bridges before the detail work" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v6-bridges-after-dusk.png" alt="V6 — the river bridges as Chicago-type trunnion bascules" width="100%"/></td>
</tr>
<tr>
<td><em>Before: the river bridges were flat road ribbons over the water.</em></td>
<td><em>After: 32 named bascules — grid decks, lattice railings, tender houses, lanterns and navigation lights (press B to raise them).</em></td>
</tr>
<tr>
<td><img src="docs/screenshots/v6-south-branch-bascules-day.png" alt="V6 — the run of bascule bridges up the South Branch" width="100%"/></td>
<td><img src="docs/screenshots/v6-dusable-dusk.png" alt="V6 — the DuSable Bridge with its four bridgehouses" width="100%"/></td>
</tr>
<tr>
<td><em>Up the South Branch: one bascule per street, each with its tender houses, no double decks.</em></td>
<td><em>The DuSable Bridge: four Bedford-stone bridgehouses, balustrades, lanterns and red channel lights.</em></td>
</tr>
<tr>
<td><img src="docs/screenshots/v6-buckingham-night.png" alt="V6 — Buckingham Fountain's evening water show" width="100%"/></td>
<td><img src="docs/screenshots/v6-cloudgate-day.png" alt="V6 — Cloud Gate mirroring the skyline" width="100%"/></td>
</tr>
<tr>
<td><em>Buckingham Fountain in pink marble with eight bronze seahorses; the 46 m jet plays on the real schedule (press J for a show now).</em></td>
<td><em>Cloud Gate at its true 20 × 13 × 10 m shape, mirroring the live sky and the skyline, with people on the plaza.</em></td>
</tr>
<tr>
<td><img src="docs/screenshots/v6-crownfountain-night.png" alt="V6 — Crown Fountain's faces at night" width="100%"/></td>
<td><img src="docs/screenshots/v6-picasso-day.png" alt="V6 — the Chicago Picasso in Daley Plaza" width="100%"/></td>
</tr>
<tr>
<td><em>Crown Fountain's LED faces pucker and spout on their cycle. Also new: Lurie Garden, the BP Bridge, the Art Institute lions, the Flamingo, the Cultural Center domes, Union Station, Navy Pier's Headhouse and Ballroom, the Riverwalk and the Zoo.</em></td>
<td><em>The Chicago Picasso in Daley Plaza — 50 ft of rust-red Cor-Ten steel on its granite base, under the Daley Center's dark glass.</em></td>
</tr>
</table>

### Vision pass · V7 · Controls — *every feature one click, one key, one search away*

<table>
<tr>
<td width="50%"><img src="docs/screenshots/v7-hud-1440x900-day.png" alt="V7 — the HUD at 1440×900 with Transit, Games, Sound, Bridges and Fountain in the dock" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v7-help-card-day.png" alt="V7 — the help card with the City life controls" width="100%"/></td>
</tr>
<tr>
<td><em>Transit, Games, Sound, Bridges and Fountain share one dock row; legends and cards stack on the left, clear of the minimap, from 600 px to 1440 px wide.</em></td>
<td><em>The help card lists every control in plain words — T, G, M, B and J, following a train, clicking a ballpark.</em></td>
</tr>
</table>

### Vision pass · complete — *the bridges, the budget, the whole city at once*

<table>
<tr>
<td width="50%"><img src="docs/screenshots/v6-bridges-before-dusk.png" alt="The river bridges before the detail work" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v8-bridges-dusk.png" alt="V8 — the detailed bascule bridges down the river at dusk" width="100%"/></td>
</tr>
<tr>
<td><em>"The bridges are starting to look good" — the moment in the build log that started the bridge work.</em></td>
<td><em>The Chicago-type bascules down the river canyon at dusk: trunnion leaves, tender houses, lanterns — one deck per crossing.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v8-bridge-lift-dusk.png" alt="V8 — the DuSable Bridge raised during a boat-run lift" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v8-wide-streeterville-dusk.png" alt="V8 — the wide Streeterville view at dusk" width="100%"/></td>
</tr>
<tr>
<td><em>Press B: the boat-run lift raises bridge after bridge to its own music, with gate bells and flashing gates.</em></td>
<td><em>The widest lakefront view — about 580 draw calls and 3.3 M triangles, well inside the 900-call budget.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v8-loop-night.png" alt="V8 — the Loop at night" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v8-riverwalk-night.png" alt="V8 — the main branch and the Riverwalk at night" width="100%"/></td>
</tr>
<tr>
<td><em>The Loop at night: lit crowns, glowing L lines, trains and ballparks in one frame.</em></td>
<td><em>The Riverwalk at night: lamps along the promenade, Wacker's traffic, and the canyon's windows broken up on the water.</em></td>
</tr>
</table>

The vision pass is complete — see the sections above.

### Phase 3 · Heroes

The recognisable towers got their sculptural signatures, and twenty more landmarks joined the map — figures modelled in Blender (headless, from checked-in scripts), everything else parametric, and every Blender piece backed by a procedural stand-in so the city builds without it.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/p3-marina-day.png" alt="Phase 3 — Marina City's petal balconies and parking spiral" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p3-cbot-day.png" alt="Phase 3 — the Board of Trade's pyramid and Ceres" width="100%"/></td>
</tr>
<tr>
<td><em>Marina City: sixteen petal balconies a floor over forty apartment floors, nineteen parking levels as one open spiral ramp.</em></td>
<td><em>The Board of Trade closes LaSalle Street: its steep pyramid, and John Storrs' faceless aluminium Ceres at 184 m.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/p3-seahorses-day.png" alt="Phase 3 — Buckingham Fountain's rearing sea horses" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p3-lighthouse-dusk.png" alt="Phase 3 — the Chicago Harbor Lighthouse on its breakwater at dusk" width="100%"/></td>
</tr>
<tr>
<td><em>Buckingham's eight sea horses, re-posed to rear from their rocks, spouting from the mouth.</em></td>
<td><em>The Chicago Harbor Light on the outer breakwater, lamp lit at dusk — search "lighthouse" to fly there.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/p3-tribune-dusk.png" alt="Phase 3 — the Tribune Tower's Gothic crown at dusk" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p3-pingtom-day.png" alt="Phase 3 — the Ping Tom Park pagoda on the river" width="100%"/></td>
</tr>
<tr>
<td><em>The Tribune's octagonal Gothic crown with its eight flying buttresses and pinnacles, over a shaft of limestone pier ribs.</em></td>
<td><em>Ping Tom Park's pagoda on the South Branch — one of twenty P2 landmarks, from the Rookery to the Chinatown Gate and the Pilsen murals.</em></td>
</tr>
</table>

### Phase 4 · Guide — *Visit, Live, Work*

The city became a guide: hover any building for its name and year, click for its card with the nearest L; 6,900 places pinned on the roofs they belong to; and three lenses — VISIT (landmark beacons, CHI ATLAS's curated picks, three guided tours), LIVE (22 neighbourhoods with character, rent and five feel scores) and WORK (set your office, or type an address, and see how far the L gets you).

<table>
<tr>
<td width="50%"><img src="docs/screenshots/p4-visit-beacons-dusk.png" alt="Phase 4 — the Visit lens at dusk: tours, places and landmark beacons" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p4-live-zones-night.png" alt="Phase 4 — the Live lens at night: neighbourhood zones and names" width="100%"/></td>
</tr>
<tr>
<td><em>VISIT at dusk: three guided tours, place filters and the curated landmarks, their labels never overlapping.</em></td>
<td><em>LIVE at night: 22 official neighbourhood boundaries as soft ground light — click one for its profile.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/p4-work-isochrones-day.png" alt="Phase 4 — the Work lens: commute shells from an office at 333 N Green" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p4-hover-card-day.png" alt="Phase 4 — hovering a Loop building and its card" width="100%"/></td>
</tr>
<tr>
<td><em>WORK from an office at 333 N Green: 15, 30 and 45-minute shells and every neighbourhood ranked by commute.</em></td>
<td><em>Hover a building for its name and year; click for its card — address, floors and the nearest L.</em></td>
</tr>
</table>

### Fireworks, snow and a sunny day

Navy Pier's summer fireworks, fired from the barge off the pier's south side on the real schedule (Wednesdays at 9, Saturdays at 10) or any time with `X` — the camera flies to the harbour view, the bursts light the towers and shimmer on the lake, and with Sound on each boom arrives late by the speed of sound. Two new views: a clear midsummer day and a snowy Christmas Eve, with the lake frozen along the shore.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/p4-fireworks-finale-night.png" alt="The Navy Pier fireworks finale over the lake" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p4-fireworks-streeterville-night.png" alt="Navy Pier fireworks seen from over Streeterville" width="100%"/></td>
</tr>
<tr>
<td><em>The finale barrage from Monroe Harbor: chrysanthemums, peonies and willows over the barge, reflected in the lake.</em></td>
<td><em>Mid-show from above Streeterville — a ring shell over the pier and the Centennial Wheel.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/p4-snow-christmas-dusk.png" alt="A snowy Christmas Eve dusk over Chicago with the lake frozen" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p4-sunny-summer-day.png" alt="A clear sunny summer day over Chicago" width="100%"/></td>
</tr>
<tr>
<td><em>Press 7: Christmas Eve at dusk — snow falling, roofs and parks white, the harbour frozen, windows coming on.</em></td>
<td><em>Press 6: a clear midsummer afternoon.</em></td>
</tr>
</table>

### Icons, offices and places — *Flexport's building, the Tribune and Wrigley gone all out, Lincoln Park's stone*

Flexport Chicago's office at 333 North Green and BCG's tower across the street, modelled from photographs; the Tribune, the Wrigley Building, Carbide &amp; Carbon, the Water Tower and Willis carved to a new level of detail; the Wrigley marquee and the rooftop clubs; Lincoln Park's stone structures; and places that read at a glance — deep matte pins with a small card for each.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/p4-north-green-pair-day.png" alt="333 and 360 North Green — Flexport Chicago and BCG Chicago" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p4-wrigley-building-clock.png" alt="The Wrigley Building's clock tower" width="100%"/></td>
</tr>
<tr>
<td><em>333 North Green (Flexport Chicago, the thin blue line is their floor) in its black grid over the kinetic wall; 360 North Green (BCG) on its V-truss transfer level.</em></td>
<td><em>The Wrigley Building's Giralda tower: four 6 m clock faces, the arcaded belfry, the octagons, the cupola and its gilded finial.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/p4-carbide-carbon-night.png" alt="Carbide &amp; Carbon's gold crown at night" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p4-water-tower.png" alt="The Chicago Water Tower" width="100%"/></td>
</tr>
<tr>
<td><em>Carbide &amp; Carbon: black granite, dark green terra cotta with gold-tipped piers, two setbacks into the floodlit gold-leaf tower.</em></td>
<td><em>The Water Tower, Wilde's "castellated monstrosity with pepper boxes stuck all over it" — turrets, battlements, lancets and the lantern.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/p4-wrigley-marquee-night.png" alt="The Wrigley Field marquee at night" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p4-wrigley-rooftops-night.png" alt="The rooftop clubs full on a game night" width="100%"/></td>
</tr>
<tr>
<td><em>The red marquee at Clark &amp; Addison — WRIGLEY FIELD / HOME OF / CHICAGO CUBS over its message board, lit at night.</em></td>
<td><em>Sixteen rooftop clubs across Waveland and Sheffield: steel bleachers facing home plate, full on game nights, each a place with its website.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v10-lily-pool-day.png" alt="The Alfred Caldwell Lily Pool" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p4-place-popup-day.png" alt="A place card beside its pin" width="100%"/></td>
</tr>
<tr>
<td><em>Lincoln Park's stone: Caldwell's Lily Pool between stratified limestone ledges, with the Chess Pavilion, the Couch Tomb and the Waveland Clock Tower.</em></td>
<td><em>Click a pin: today's hours, the address and the website (or a web search), in a card that follows the pin.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/p4-chess-pavilion-day.png" alt="The Chess Pavilion at North Avenue Beach" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p4-chess-pavilion-king.png" alt="The carved king on the Chess Pavilion's end wall" width="100%"/></td>
</tr>
<tr>
<td><em>The Chess Pavilion (Webster, 1957): a thin concrete canopy cantilevered off slender columns, open on both long sides over two rows of stone chess tables and their stools.</em></td>
<td><em>Gilbertson's carving on the limestone end walls: a giant king in relief here and a knight at the far end, with the freestanding king and queen at the corners.</em></td>
</tr>
</table>

### River icons — *the river's buildings to the Tribune and Wrigley standard*

Forty-four buildings and structures along the main stem and both branches, each with sourced heights, setbacks, crowns, façade rhythm, materials and night lighting: Trump, St. Regis, 333 W Wacker, AMA Plaza, 35 E Wacker, London Guarantee, Mather, Reid Murdoch, the Merchandise Mart, the Civic Opera, the Old Post Office, 150 N Riverside, River Point, 110 N Wacker, the Wolf Point towers, Boeing, Riverside Plaza, Union Station, River City, 333 N Michigan, 300 N LaSalle, NBC Tower, the Salt Shed, Montgomery Ward, the Wacker Drive wall and its hotels, three railroad bridges, the Harbor Lock, Centennial Fountain and the Ping Tom boathouse. Every one is in ⌘K and on its hover card.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/v9-river-mouth-day.png" alt="The river mouth by day" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-mouth-night.png" alt="The river mouth at night" width="100%"/></td>
</tr>
<tr>
<td colspan="2"><em>The mouth: the Harbor Lock's 600 × 80 ft chamber, its sector gates and the zinc control house, with Lake Point and the Streeterville wall behind.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v9-river-dusable-day.png" alt="DuSable Bridge by day" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-dusable-night.png" alt="DuSable Bridge at night" width="100%"/></td>
</tr>
<tr>
<td colspan="2"><em>At DuSable: the Wrigley Building and the Tribune with London Guarantee's tholos and 333 N Michigan across the bridge; Trump's stainless fins and setbacks behind.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v9-river-marina-trump-day.png" alt="Marina City, AMA Plaza and Trump" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-marina-trump-night.png" alt="Marina City and Trump at night" width="100%"/></td>
</tr>
<tr>
<td colspan="2"><em>Marina City's corn cobs, Mies's black AMA Plaza on its 5 ft module, Trump's three setbacks and Reid Murdoch's clock down the river.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v9-river-clark-lasalle-day.png" alt="Clark to LaSalle" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-clark-lasalle-night.png" alt="Clark to LaSalle at night" width="100%"/></td>
</tr>
<tr>
<td colspan="2"><em>Reid Murdoch's red-brick clock tower, 300 N LaSalle's stepped stainless crown and the Wacker wall: 77 W's pediment, Leo Burnett, 225 W's lanterns.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v9-river-wolf-point-day.png" alt="Wolf Point" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-wolf-point-night.png" alt="Wolf Point at night" width="100%"/></td>
</tr>
<tr>
<td colspan="2"><em>The forks: Wolf Point West, East and Salesforce, River Point's parabolic arch, 333 W Wacker's green bow and the Merchandise Mart.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v9-river-opera-day.png" alt="The Civic Opera" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-opera-night.png" alt="The Civic Opera at night" width="100%"/></td>
</tr>
<tr>
<td colspan="2"><em>The South Branch: the Civic Opera's armchair and Wacker portico, Riverside Plaza, 150 N Riverside on its 12 m core, 110 N Wacker on its tridents.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v9-river-post-office-day.png" alt="The Old Post Office" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-post-office-night.png" alt="The Old Post Office at night" width="100%"/></td>
</tr>
<tr>
<td colspan="2"><em>The Old Post Office straddling the Eisenhower, its roof park on top, Union Station's light court and Great Hall vault beyond.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v9-river-salt-shed-day.png" alt="The Salt Shed by day" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-salt-shed-night.png" alt="The Salt Shed at night" width="100%"/></td>
</tr>
<tr>
<td colspan="2"><em>The North Branch: the Salt Shed's steep gable on buttressed walls and MORTON SALT across the roof, lit after dark.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v9-art-on-the-mart-night.png" alt="Art on theMART" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-35-east-wacker-night.png" alt="35 East Wacker at night" width="100%"/></td>
</tr>
<tr>
<td><em>Art on theMART: 556 × 165 ft of light on the Mart's river façade, Thursday to Sunday on the 2026 schedule (the art here is procedural, not a real piece).</em></td>
<td><em>35 East Wacker's belvedere and corner tempietti floodlit gold over Mather Tower's gilded cupola.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v9-canal-street-lift-day.png" alt="Canal Street railroad lift bridge" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-centennial-fountain-day.png" alt="Centennial Fountain" width="100%"/></td>
</tr>
<tr>
<td><em>The Canal Street lift bridge between its 185 ft towers; the St. Charles Air Line and the raised Kinzie Street bascule are in too.</em></td>
<td><em>Centennial Fountain's granite steps and its 80 ft arc, five minutes at the top of each hour, May to September.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v9-77-west-wacker-night.png" alt="77 West Wacker at night" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-salt-shed-night.png" alt="The Salt Shed sign at night" width="100%"/></td>
</tr>
<tr>
<td><em>77 West Wacker's glazed temple pediment, floodlit.</em></td>
<td><em>MORTON SALT on the Salt Shed's roof, facing the Kennedy.</em></td>
</tr>
</table>

### Lincoln Park — *the whole park to the Tribune and Wrigley standard*

Every building, monument and landmark in Lincoln Park from North Avenue to Irving Park, each from its OSM outline with sourced heights, materials and lighting (and what is read from photographs marked approximate): the zoo's houses from the 1912 Lion House to Penguin Cove and the red barns of Farm-in-the-Zoo, Café Brauer and the Nature Boardwalk, the Conservatory's four glass houses and the Bates Fountain, the History and Nature Museums, North Pond, Theater on the Lake, the Elks Memorial, the beach house, the Passerelle, the driving range, and the monuments — Lincoln's exedra, Grant's arch, Schiller, Andersen, Franklin, the gilded Hamilton, Altgeld, A Signal of Peace and Kwanusila. The ponds, lagoons and harbours show as water. Every site is on its hover card and in ⌘K, and the VISIT lens has a tour: *Lincoln Park, South to North*.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/v10-lp-north-avenue-beach-day.png" alt="North Avenue Beach by day" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-north-avenue-beach-night.png" alt="North Avenue Beach at night" width="100%"/></td>
</tr>
<tr>
<td><em>The North Avenue Beach House as the ocean liner it was built to be: portholes, the blue-railed decks, the Castaways canopy and two red-banded funnels; the Chess Pavilion beyond.</em></td>
<td><em>At night the portholes glow along the hull.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v10-lp-zoo-mall-day.png" alt="The zoo by day" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-zoo-mall-night.png" alt="The zoo at night" width="100%"/></td>
</tr>
<tr>
<td><em>Lincoln Park Zoo: the Kovler Lion House's tile roof, ridge monitor and great arched door, the Primate House portico, the Small Mammal–Reptile House dome, the carousel, the sea lions' pool.</em></td>
<td><em>The zoo after dark: closed, unlit, the way it is.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v10-lp-south-pond-day.png" alt="South Pond by day" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-south-pond-night.png" alt="South Pond at night" width="100%"/></td>
</tr>
<tr>
<td><em>Café Brauer's Prairie School brick and green tile curving round South Pond, the boardwalk loop and its prairie edge, the honeycomb pavilion across the water.</em></td>
<td><em>Café Brauer's windows lit for an evening event over the pond.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v10-lp-conservatory-day.png" alt="The Conservatory by day" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-conservatory-night.png" alt="The Conservatory at night" width="100%"/></td>
</tr>
<tr>
<td><em>The Conservatory's four glass houses — the 50 ft Palm House over the formal garden's hedged beds and the Bates Fountain.</em></td>
<td><em>The glass houses dark after closing; the garden in shadow.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v10-lp-theater-on-the-lake-day.png" alt="Fullerton by day" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-theater-on-the-lake-night.png" alt="Fullerton at night" width="100%"/></td>
</tr>
<tr>
<td><em>Theater on the Lake's brick arches under its tile roofs at Fullerton, North Pond and the Nature Museum beyond.</em></td>
<td><em>Fullerton at night.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v10-lp-belmont-waveland-day.png" alt="Diversey to Waveland by day" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-belmont-waveland-night.png" alt="Diversey to Waveland at night" width="100%"/></td>
</tr>
<tr>
<td><em>From Diversey to Waveland: the harbours show as water now, the driving range's nets, the Elks rotunda, Kwanusila and the Waveland clock tower at the park's north edge.</em></td>
<td><em>The north end of the park at night.</em></td>
</tr>
</table>

### Phase 5 · Alive — *live trains, live scores, weather and Scan*

The city reads the CHI ATLAS API when it can and never shows an error when it can't: real CTA trains snapped onto the track (with the timetable simulator as the fallback), live scores driving the stadiums, the scoreboards and the W flag, and the real Chicago sky — overcast, rain, snow or lake fog, carried by the wind. The chip at the top left says honestly which: LIVE CTA or SIMULATED, with the data sources one click away. Press `V` for Scan, the holographic city.

**Live data, today.** Sports schedules and live scores refresh on the live site through our own cached `/api/schedule` (ESPN, cached by Vercel's CDN, so ESPN sees about one request per 10 minutes however many people visit); the browser never calls ESPN; our own cached /api/schedule does. Live CTA trains, alerts and weather still wait for the CHI ATLAS link, which is parked, so the live site shows them simulated.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/p5-live-trains-dusk.png" alt="Phase 5 — a live Brown Line train on Lake Street with the data sources open" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p5-scan-over-live.png" alt="Phase 5 — Scan over the Live lens at dusk" width="100%"/></td>
</tr>
<tr>
<td><em>LIVE CTA: a Brown Line run on Lake Street, placed from Train Tracker (here a stand-in CHI server), and the plain-words data sources.</em></td>
<td><em>Scan (`V`) over the Live lens: dark glass and cyan floor lines, a light column over each neighbourhood — here, transit.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/p5-rain-river-dusk.png" alt="Phase 5 — rain over the river at dusk" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p5-snow-loop-day.png" alt="Phase 5 — snow falling over the Loop by day" width="100%"/></td>
</tr>
<tr>
<td><em>Rain down the river at dusk — a grey deck that hides the setting sun, thinner light and streaks slanting with the wind.</em></td>
<td><em>Snow from the Weather button on an ordinary day: the SNOW view's flakes and white roofs, drifting with the wind.</em></td>
</tr>
</table>

### Phase 7 · Ride the city — *the L, the bus, the street and the sky*

A second way to be in Chicago (`L`, the Ride button or ⌘K): ride any L line from the front window, alongside or behind the train — through the subway tubes — with every stop announced and what's nearby named; ride eight CTA bus routes up the big avenues; walk the Riverwalk, the Magnificent Mile, the Lakefront Trail, Fulton Market and Lincoln Park at eye height (every walk checked never to pass through a building); or hang-glide over the city. Space pauses, `.` and `,` skip stops, `>` and `<` change speed, `K` changes the view, drag looks around, Esc gets off.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/p7-l-cab-day.png" alt="Phase 7 — the Brown Line's front window on the Loop elevated" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p7-bus-146-day.png" alt="Phase 7 — riding the #146 bus up State Street" width="100%"/></td>
</tr>
<tr>
<td><em>The Brown Line from the front window, round the Loop on Wells Street toward Quincy.</em></td>
<td><em>The #146 up State Street, under the trees, the next stop and the Monadnock named as you pass.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/p7-riverwalk-dusk.png" alt="Phase 7 — walking by the river at Wells Street at dusk" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p7-glide-dusk.png" alt="Phase 7 — hang-gliding over Streeterville at dusk" width="100%"/></td>
</tr>
<tr>
<td><em>A street-level walk by the river at dusk, a Brown Line train crossing the Wells Street bridge.</em></td>
<td><em>The glide: dive for speed, climb to trade it away — it banks round the towers, never through them.</em></td>
</tr>
</table>

## Quickstart

```bash
git clone https://github.com/AllStreets/Chicago-Open-World.git
cd Chicago-Open-World
npm install --prefix pipeline && npm install --prefix app

npm run fetch          # download footprints, boundary and OSM data (cached)
npm run textures       # process generated façades + procedural ground textures
npm run build:world    # build tiles + ground into app/public/world
npm run dev            # http://localhost:5173
```

The generated world is committed, so `npm run dev` works straight after install.

**Deploy.** Vercel project `chicago-open-world` (Root Directory `app`, settings in [`app/vercel.json`](app/vercel.json)): every push to `main` deploys production at **https://chicago-open-world.vercel.app**, other branches get preview URLs. Only the app is built — the committed world in `app/public/world` ships as static files; the pipeline never runs on Vercel.
Everything is reachable with the keyboard, the mouse and the on-screen dock — `?view=` / `?time=` URL parameters exist only for tests and screenshots.

## Controls

| Input | Action |
|---|---|
| `⌘K` / `Ctrl+K` / `/` | search any landmark, neighbourhood or view — Enter flies you there |
| `↑` `↓` `←` `→` or `W` `A` `S` `D` | glide over the city (`Shift` for faster) |
| `Shift` + arrows | turn and tilt (`Q` / `E` turn too) |
| `R` / `F` or `Page Up` / `Page Down` | rise and descend |
| Scroll or `+` / `−` | zoom toward the cursor |
| Drag | turn and tilt |
| Double-click | fly to that spot |
| `[` / `]` | previous / next view |
| `H` · `N` · `O` | home · face north · slow orbit |
| `1`–`7` | LIVE · DAWN · DAY · DUSK · NIGHT · SUNNY (a clear summer day) · SNOW (a snowy Christmas, the lake frozen) |
| `T` · Transit button | CTA and Metra lines on/off; the legend switches single lines |
| Click a train / station | its card — run, next stop, arrivals; "Follow this train" rides along (Esc or a move key stops; K changes the view) |
| `⌘K` "Follow a … train" · "Go to …" · "Show … Line" | transit from the search |
| `M` · ⌘K "Sound" | music for the fountain and bridge shows, crowd cheers, passing trains and your ride (the L's rumble and door chime, a bus engine, the glider's wind, the city on a walk) — off until you turn it on; a green speaker (on) or a red one with a slash (off) shows in the middle of the screen for a second, then fades |
| `G` · Games button · `⌘K` "tonight" | tonight's game, scores and the next game at every venue |
| `Y` · ▶ Play a game (a ballpark's card) | a 90-second game at Wrigley, Rate Field or Soldier Field — the card's ballpark, else the nearest; `Y` again or `Esc` stops it (⌘K "Play a Cubs game", "Play a Fire match", "Stop the game"); a real live game always wins |
| `B` · Bridges button | raise the river bridges — a boat-run lift with gate bells, flashers and music; press again and they come down within seconds |
| `J` · Fountain button | Buckingham Fountain water show — jets dance to music, lit in colour after dusk; press again to stop any show |
| `X` · Fireworks button | Navy Pier fireworks — flies you to the harbour view; press again to stop (real shows: Wed 9 pm, Sat 10 pm in summer) |
| `P` · Places button | pins for restaurants, bars, venues and more — click one for its card and website |
| `L` · Ride button | ride the city — an L line, a CTA bus, a street-level walk or the glide; `Space` pauses, `.` `,` next or previous stop, `>` `<` faster or slower, `K` view, drag to look, `Esc` gets off. `M`, `X` and the other toggles never end a ride, a tour or a train follow |
| `V` · SCAN button | holographic Scan; in the Live lens, light columns for transit, nightlife, green space or rent |
| Weather button | follows Chicago live, or pick clear, overcast, rain, snow or lake fog (also ⌘K "Weather") |
| LIVE CTA / SIMULATED chip | click for the data sources and "Try live again" |
| `?` · `Esc` | help card · close / stop a flight |
| `⌘K` "performance" | draw calls, triangles and frame rate (a diagnostic chip) |
| Control dock & minimap | the same moves as buttons; click the minimap to fly |

<table>
<tr>
<td width="50%"><img src="docs/screenshots/c-sound-on.png" alt="M — a bare green speaker with waves in the middle of the screen: sound on" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/c-sound-off.png" alt="M again — a bare red speaker with a slash: sound off" width="100%"/></td>
</tr>
<tr>
<td><em>`M` — sound on: a green speaker, held a second, then fading.</em></td>
<td><em>`M` again — sound off: the same speaker in red, struck through.</em></td>
</tr>
</table>

## Under the hood

```
shared/project.js     one projection, used by pipeline and app
pipeline/             build-time Node — fetch → project → extrude → classify → tile → .glb
app/                  Vite · React 19 · React Three Fiber · zustand
  src/world/          city tiles, land, river, Lake Michigan, physical sky
  src/camera/         Atlas camera rig
  src/hud/            CHI ATLAS HUD — wordmark, readout, pills, hints, loading
```

```bash
npm test                          # pipeline + app unit tests (Vitest)
npm run e2e --prefix app          # hero-view screenshot baselines (Playwright)
```

## Data

- **City of Chicago Data Portal** — Building Footprints (`syp8-uezg`), City Boundary (`qqq8-j68g`).
- **OpenStreetMap** — building heights, `building:part` setbacks, water, parks, roads, rail, street trees.
  © OpenStreetMap contributors, available under the [ODbL](https://www.openstreetmap.org/copyright).
- **ESPN public site API** — team schedules and scoreboards, fetched at build time (`npm run schedules`) and by the cached `/api/schedule` function (`app/api/schedule.js`). The browser never calls ESPN; our own cached /api/schedule does.

## Roadmap

- [x] **1 · Foundation** — real footprints and heights, land, river, lake, sky, Atlas camera, HUD shell
- [x] **2 · Beauty pass** — generated façades, lit windows, living sky, rooftops, parks & trees, the L, post-processing, minimap, intro flight
- [x] **2.5 · Expanded city** — Wrigleyville → 35th St, verified top-50 skyline, 41 landmarks, stadiums, sacred buildings, civic icons, horizon fill, streaming, human-first controls
- [x] **Vision pass** — one lake & river, CTA and Metra in true colours with a restrained glow and running trains, stadium game nights & crowds, detailed bridges & landmarks with music-and-light shows, true building colours, camera clearance, ≤ 900 draw calls
- [x] **3 · Heroes** — Aqua's waves, Marina City's petals and spiral, the 900 N Michigan / CBOT / Tribune / Carbide crowns, Blender Ceres, sea horses and Lincoln Park statues, 20 P2 landmarks
- [x] **4 · Guide** — VISIT / LIVE / WORK lenses: places, tours, neighbourhood profiles, commute estimates; hover cards; Navy Pier fireworks; snow and sunny views
- [x] **5 · Alive** — live L trains, scores and weather via the CHI ATLAS API (simulated whenever it isn't there), the LIVE / SIMULATED chip, Scan mode
- [ ] **6 · Further rings** — streaming the rest of the city (deferred by the user, for later)
- [x] **7 · Ride the city** — reworked from "glide mode": L train rides, CTA bus rides, street-level walks and the glide; a written plan for VR later

Design spec: [docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md](docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md)

## Evolution

It wasn't made right in one attempt. Here are the same places through each pass, first and roughest on the left, newest on the right. When a building is rebuilt, its README images are re-taken, and the earlier frames are kept in [docs/screenshots/evolution](docs/screenshots/evolution).

**The city** — Streeterville at dusk, from flat colour to today

<table>
<tr>
<td width="20%"><img src="docs/screenshots/phase1-streeterville-dusk.png" alt="Phase 1 — flat-shaded Streeterville" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/phase2-streeterville-dusk.png" alt="Phase 2 — façades and lit windows" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/phase25-wrigleyville.png" alt="Phase 2.5 — the expanded city" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/v8-wide-streeterville-dusk.png" alt="Vision pass — the wide lakefront" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/evolution/today-streeterville-dusk.png" alt="Today — Streeterville at dusk" width="100%"/></td>
</tr>
<tr>
<td><sub>Phase 1 · Sep 28<br/>extruded footprints, flat colour</sub></td>
<td><sub>Phase 2 · Sep 28<br/>façades, windows, sky</sub></td>
<td><sub>Phase 2.5 · Sep 28<br/>Wrigleyville to 35th St</sub></td>
<td><sub>Vision pass · Sep 29<br/>one lake, true colours</sub></td>
<td><sub>Today · Sep 30<br/>traffic, crowns, paving</sub></td>
</tr>
</table>

**Down the river, the same pose** — before and after the river icons

<table>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/v9-river-mouth-before-day.png" alt="The mouth before the river icons" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-mouth-day.png" alt="The mouth with the river icons" width="100%"/></td>
</tr>
<tr>
<td><sub>The mouth · Oct 1, before<br/>OSM massing, generic façades</sub></td>
<td><sub>The mouth · Oct 1, after<br/>sourced crowns, rhythm and materials</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/v9-river-dusable-before-day.png" alt="DuSable before the river icons" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-dusable-day.png" alt="DuSable with the river icons" width="100%"/></td>
</tr>
<tr>
<td><sub>DuSable · Oct 1, before<br/>OSM massing, generic façades</sub></td>
<td><sub>DuSable · Oct 1, after<br/>sourced crowns, rhythm and materials</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/v9-river-clarklasalle-before-day.png" alt="Clark to LaSalle before the river icons" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-clark-lasalle-day.png" alt="Clark to LaSalle with the river icons" width="100%"/></td>
</tr>
<tr>
<td><sub>Clark to LaSalle · Oct 1, before<br/>OSM massing, generic façades</sub></td>
<td><sub>Clark to LaSalle · Oct 1, after<br/>sourced crowns, rhythm and materials</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/v9-river-wolfpoint-before-day.png" alt="Wolf Point before the river icons" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-wolf-point-day.png" alt="Wolf Point with the river icons" width="100%"/></td>
</tr>
<tr>
<td><sub>Wolf Point · Oct 1, before<br/>OSM massing, generic façades</sub></td>
<td><sub>Wolf Point · Oct 1, after<br/>sourced crowns, rhythm and materials</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/v9-river-opera-before-day.png" alt="The Civic Opera before the river icons" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-opera-day.png" alt="The Civic Opera with the river icons" width="100%"/></td>
</tr>
<tr>
<td><sub>The Civic Opera · Oct 1, before<br/>OSM massing, generic façades</sub></td>
<td><sub>The Civic Opera · Oct 1, after<br/>sourced crowns, rhythm and materials</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/v9-river-postoffice-before-day.png" alt="The Old Post Office before the river icons" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-post-office-day.png" alt="The Old Post Office with the river icons" width="100%"/></td>
</tr>
<tr>
<td><sub>The Old Post Office · Oct 1, before<br/>OSM massing, generic façades</sub></td>
<td><sub>The Old Post Office · Oct 1, after<br/>sourced crowns, rhythm and materials</sub></td>
</tr>
</table>

**Marina City and Trump at the water**

<table>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/v9-river-marinatrump-before-day.png" alt="Marina City and Trump before" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-marina-trump-day.png" alt="Marina City and Trump after" width="100%"/></td>
</tr>
<tr>
<td><sub>Before · Oct 1<br/>plain glass and a stub spire</sub></td>
<td><sub>After · Oct 1<br/>stainless fins, the 60 m podium, the 423 m spire, AMA Plaza's module</sub></td>
</tr>
</table>

**One landmark** — the Wrigley Building and the Tribune

<table>
<tr>
<td width="25%"><img src="docs/screenshots/evolution/v2-wrigley-building-night.png" alt="V2 — the Wrigley Building as a coloured massing" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/evolution/p3-tribune-dusk.png" alt="Phase 3 — the Tribune's Gothic crown" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/v2-wrigley-building-night.png" alt="Today — the Wrigley Building's clock tower" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/p3-tribune-dusk.png" alt="Today — the Tribune's pier ribs and crown" width="100%"/></td>
</tr>
<tr>
<td><sub>V2 · Sep 29<br/>true colour, plain massing</sub></td>
<td><sub>Phase 3 · Sep 29<br/>the Tribune's crown</sub></td>
<td><sub>Phase 4 · Sep 30<br/>the Giralda clock tower</sub></td>
<td><sub>Phase 4 · Sep 30<br/>pier ribs, lantern tracery</sub></td>
</tr>
</table>

**The Chess Pavilion** — Lincoln Park, the same pose

<table>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/p4-chess-pavilion-slab.png" alt="Phase 4 — the Chess Pavilion as a plain slab" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/evolution/today-chess-pavilion.png" alt="Today — the cantilevered canopy, columns, chess tables and carved end walls" width="100%"/></td>
</tr>
<tr>
<td><sub>Phase 4 · Sep 30<br/>a flat roof on two piers</sub></td>
<td><sub>Today · Sep 30<br/>canopy, tables, carved king and knight</sub></td>
</tr>
</table>

**The ride bar** — the Brown Line's front window at Wells & Adams, the same pose

<table>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/p7-l-cab-day-bar.png" alt="Phase 7 — the ride bar with the ride named by its two end stations" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p7-l-cab-day.png" alt="Today — the ride named 'around the Loop', its keys as keycaps" width="100%"/></td>
</tr>
<tr>
<td><sub>Phase 7 · Sep 30<br/>"Addison → the Loop", keys only in the panel</sub></td>
<td><sub>Today · Oct 1<br/>"around the Loop", every key a keycap</sub></td>
</tr>
</table>

**Rain at dusk** — down the river, the same pose

<table>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/p5-rain-river-dusk-sun.png" alt="Phase 5 — rain with the sun's disc burning through the cloud" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p5-rain-river-dusk.png" alt="Today — rain under a deck that hides the sun" width="100%"/></td>
</tr>
<tr>
<td><sub>Phase 5 · Sep 30<br/>the sun shone through the rain</sub></td>
<td><sub>Today · Sep 30<br/>the cloud hides the sun and its glare</sub></td>
</tr>
</table>

**The lake**

<table>
<tr>
<td width="20%"><img src="docs/screenshots/phase1-museum-day.png" alt="Phase 1 — the lake behind Museum Campus" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/v1-harbor-dusk.png" alt="V1 — harbour and lake as one water" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/v1-lake-horizon-day.png" alt="V1 — the lake to the horizon" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/p4-snow-christmas-dusk.png" alt="Phase 4 — the frozen shore" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/p4-fireworks-finale-night.png" alt="Phase 4 — fireworks on the water" width="100%"/></td>
</tr>
<tr>
<td><sub>Phase 1 · Sep 28<br/>a flat plane</sub></td>
<td><sub>V1 · Sep 29<br/>one body of water</sub></td>
<td><sub>V1 · Sep 29<br/>no edge to the lake</sub></td>
<td><sub>Phase 4 · Sep 30<br/>ice along the shore</sub></td>
<td><sub>Phase 4 · Sep 30<br/>fireworks reflected</sub></td>
</tr>
</table>

**The city at night**

<table>
<tr>
<td width="20%"><img src="docs/screenshots/v1-river-night.png" alt="V1 — the river at night" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/v3-transit-loop-night.png" alt="V3 — the L glowing in the Loop" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/v8-loop-night.png" alt="Vision pass — the Loop at night" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/v8-riverwalk-night.png" alt="The Riverwalk at night" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/p4-carbide-carbon-night.png" alt="Phase 4 — Carbide &amp; Carbon's floodlit crown" width="100%"/></td>
</tr>
<tr>
<td><sub>V1 · Sep 29<br/>windows on the water</sub></td>
<td><sub>V3 · Sep 29<br/>the L in its colours</sub></td>
<td><sub>Vision pass · Sep 29<br/>lit crowns, trains</sub></td>
<td><sub>Phase 4 · Sep 30<br/>street lamps, traffic</sub></td>
<td><sub>Phase 4 · Sep 30<br/>floodlit gold leaf</sub></td>
</tr>
</table>

**The HUD**

<table>
<tr>
<td width="20%"><img src="docs/screenshots/phase1-loop-day.png" alt="Phase 1 — the first HUD" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/evolution/v2-willis-loop-day.png" alt="V2 — the HUD with a view list" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/v7-hud-1440x900-day.png" alt="V7 — every feature in one dock" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/p4-visit-beacons-dusk.png" alt="Phase 4 — the guide's lenses" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/p4-place-popup-day.png" alt="Phase 4 — a place card" width="100%"/></td>
</tr>
<tr>
<td><sub>Phase 1 · Sep 28<br/>a readout and time chips</sub></td>
<td><sub>V2 · Sep 29<br/>search, views, time</sub></td>
<td><sub>V7 · Sep 29<br/>one dock, one key each</sub></td>
<td><sub>Phase 4 · Sep 30<br/>VISIT · LIVE · WORK</sub></td>
<td><sub>Phase 4 · Sep 30<br/>hours, address, website</sub></td>
</tr>
</table>

**United Center**

<table>
<tr>
<td width="33%"><img src="docs/screenshots/evolution/v5-united-center-night.png" alt="V5 — United Center game night, the plaza crowd" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/sports-united-center-plaza-night.png" alt="Sports pass — the same pose, the Bulls ribbon round the parapet" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/sports-united-center-night.png" alt="Sports pass — the Bulls board on the roof" width="100%"/></td>
</tr>
<tr>
<td><sub>V5 · Sep 29<br/>lit fascia, a plain roof</sub></td>
<td><sub>Sports pass · Oct 1<br/>the ribbon round the parapet</sub></td>
<td><sub>Sports pass · Oct 1<br/>the Bulls board on the roof</sub></td>
</tr>
</table>

**Wrigley Field**

<table>
<tr>
<td width="20%"><img src="docs/screenshots/phase25-wrigleyville.png" alt="Phase 2.5 — Wrigley as a shell" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/evolution/v5-wrigley-field-day.png" alt="V5 — the field painted" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/evolution/v5-w-flag-day.png" alt="V5 — the W after a win" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/p4-wrigley-marquee-day.png" alt="Phase 4 — the marquee" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/p4-wrigley-rooftops-gameday.png" alt="Phase 4 — the rooftops on game day" width="100%"/></td>
</tr>
<tr>
<td><sub>Phase 2.5 · Sep 28<br/>a ballpark shell</sub></td>
<td><sub>V5 · Sep 29<br/>the field, the bowl</sub></td>
<td><sub>V5 · Sep 29<br/>the W flies</sub></td>
<td><sub>Phase 4 · Sep 30<br/>the red marquee</sub></td>
<td><sub>Phase 4 · Sep 30<br/>rooftop bleachers, full</sub></td>
</tr>
</table>

**Lincoln Park** — the six gallery poses, before and after the pass (the Conservatory's generic dome became four glass houses; the Lion House's pyramid became its tile roof and ridge monitor)

<table>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/before-lp-north-avenue-beach-day.png" alt="North Avenue Beach before the Lincoln Park pass" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-north-avenue-beach-day.png" alt="North Avenue Beach after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>North Avenue Beach · Oct 1, before (day)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>North Avenue Beach · Oct 1, after (day)<br/>every building sculpted, the water shown</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/before-lp-north-avenue-beach-night.png" alt="North Avenue Beach before the Lincoln Park pass" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-north-avenue-beach-night.png" alt="North Avenue Beach after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>North Avenue Beach · Oct 1, before (night)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>North Avenue Beach · Oct 1, after (night)<br/>every building sculpted, the water shown</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/before-lp-zoo-mall-day.png" alt="The zoo before the Lincoln Park pass" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-zoo-mall-day.png" alt="The zoo after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>The zoo · Oct 1, before (day)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>The zoo · Oct 1, after (day)<br/>every building sculpted, the water shown</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/before-lp-zoo-mall-night.png" alt="The zoo before the Lincoln Park pass" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-zoo-mall-night.png" alt="The zoo after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>The zoo · Oct 1, before (night)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>The zoo · Oct 1, after (night)<br/>every building sculpted, the water shown</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/before-lp-south-pond-day.png" alt="South Pond before the Lincoln Park pass" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-south-pond-day.png" alt="South Pond after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>South Pond · Oct 1, before (day)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>South Pond · Oct 1, after (day)<br/>every building sculpted, the water shown</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/before-lp-south-pond-night.png" alt="South Pond before the Lincoln Park pass" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-south-pond-night.png" alt="South Pond after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>South Pond · Oct 1, before (night)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>South Pond · Oct 1, after (night)<br/>every building sculpted, the water shown</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/before-lp-conservatory-day.png" alt="The Conservatory before the Lincoln Park pass" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-conservatory-day.png" alt="The Conservatory after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>The Conservatory · Oct 1, before (day)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>The Conservatory · Oct 1, after (day)<br/>every building sculpted, the water shown</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/before-lp-conservatory-night.png" alt="The Conservatory before the Lincoln Park pass" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-conservatory-night.png" alt="The Conservatory after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>The Conservatory · Oct 1, before (night)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>The Conservatory · Oct 1, after (night)<br/>every building sculpted, the water shown</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/before-lp-theater-on-the-lake-day.png" alt="Fullerton before the Lincoln Park pass" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-theater-on-the-lake-day.png" alt="Fullerton after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>Fullerton · Oct 1, before (day)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>Fullerton · Oct 1, after (day)<br/>every building sculpted, the water shown</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/before-lp-theater-on-the-lake-night.png" alt="Fullerton before the Lincoln Park pass" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-theater-on-the-lake-night.png" alt="Fullerton after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>Fullerton · Oct 1, before (night)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>Fullerton · Oct 1, after (night)<br/>every building sculpted, the water shown</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/before-lp-belmont-waveland-day.png" alt="Diversey to Waveland before the Lincoln Park pass" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-belmont-waveland-day.png" alt="Diversey to Waveland after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>Diversey to Waveland · Oct 1, before (day)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>Diversey to Waveland · Oct 1, after (day)<br/>every building sculpted, the water shown</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/before-lp-belmont-waveland-night.png" alt="Diversey to Waveland before the Lincoln Park pass" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-belmont-waveland-night.png" alt="Diversey to Waveland after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>Diversey to Waveland · Oct 1, before (night)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>Diversey to Waveland · Oct 1, after (night)<br/>every building sculpted, the water shown</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/p4-lily-pool.png" alt="The Lily Pool in Phase 4" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lily-pool-day.png" alt="The Lily Pool after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>The Lily Pool · Sep 30<br/>the Nature Museum a plain box</sub></td>
<td><sub>The Lily Pool · Oct 1, the same view<br/>the Nature Museum and its Butterfly Haven, North Pond as water</sub></td>
</tr>
</table>

---

<div align="center">

**MIT** © 2026 [Connor Evans](https://github.com/AllStreets)

<sub>Four stars on the flag. Every building on the map.</sub>

</div>
