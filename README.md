<div align="center">

# CHI ATLAS · OPEN WORLD

**THE CITY, AT FULL SCALE**

<img alt="phases" src="https://img.shields.io/badge/phases-1_to_5_·_7_shipped-45d8ff?style=for-the-badge&labelColor=030509"/>
<img alt="buildings" src="https://img.shields.io/badge/real_buildings-105,971-ff3b53?style=for-the-badge&labelColor=030509"/>
<img alt="landmarks" src="https://img.shields.io/badge/landmarks-107-45d8ff?style=for-the-badge&labelColor=030509"/>
<img alt="draw calls" src="https://img.shields.io/badge/draw_calls-≤900-ff3b53?style=for-the-badge&labelColor=030509"/>
<img alt="skyline" src="https://img.shields.io/badge/top_50_skyline-verified-ff3b53?style=for-the-badge&labelColor=030509"/>
<a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-45d8ff?style=for-the-badge&labelColor=030509"/></a>
<br/>
<img alt="stack" src="https://img.shields.io/badge/stack-React_19_·_Three.js_·_R3F-6b7382?style=flat-square&labelColor=030509"/>
<img alt="data" src="https://img.shields.io/badge/data-City_of_Chicago_·_OpenStreetMap-6b7382?style=flat-square&labelColor=030509"/>
<img alt="tests" src="https://img.shields.io/badge/tests-Vitest_·_Playwright-6b7382?style=flat-square&labelColor=030509"/>

**[chicago-open-world.vercel.app](https://chicago-open-world.vercel.app)**

</div>

---

<p align="center">
  <img src="docs/screenshots/phase2-streeterville-dusk.png" alt="Dusk over Streeterville — Willis and Trump against an amber horizon, windows coming on" width="100%"/>
</p>

<p align="center"><em>Dusk over Streeterville. Real footprints at real heights, generated façades, windows lighting up floor by floor as the real Chicago sun goes down.</em></p>

<p align="center">
<a href="#controls">Controls</a> ·
<a href="#the-river">The river</a> ·
<a href="#lincoln-park">Lincoln Park</a> ·
<a href="#the-streets-under-the-streets">Under the streets</a> ·
<a href="#the-lake">The lake</a> ·
<a href="#sports">Sports</a> ·
<a href="#how-it-came-together">How it came together</a> ·
<a href="#live-data">Live data</a> ·
<a href="#quickstart">Quickstart</a> ·
<a href="#roadmap">Roadmap</a> ·
<a href="#evolution">Evolution</a>
</p>

---

## What this is

**An explorable, game-quality Chicago that runs in your browser** — and a new way to plan
a visit, a move, or a job in a city. Fly it like a drone, orbit a tower, drop down the river canyon,
ride the L, walk the Riverwalk at the water or drive Lower Wacker under the street.

It is the sibling of [CHI ATLAS](https://github.com/AllStreets/chi) — same mission-control HUD
(near-black glass, electric cyan, Chicago red, Michroma / Archivo / IBM Plex Mono) — but the map is
replaced by a full 3D city built from public data, with hand-modelled Blender landmarks, generated
façade textures, running L trains, live game days and three guide lenses: **VISIT · LIVE · WORK**.

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
<td><em>Down the river canyon to Trump Tower: the river 6.3 m under Wacker Drive, the Riverwalk at the water's edge.</em></td>
</tr>
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

### What's in it

- **The whole north–south spine** — Addison (Wrigleyville) to 35th Street, Western Avenue to the lake: 110 km², 105,971 buildings from OpenStreetMap, enriched with City of Chicago data, streamed in 500 m tiles and 2 km far blocks with meshopt compression. Beyond it, 50,000 simple buildings on Chicago's real street grid carry the city to the horizon, with suburbs beyond the city limits.
- **A skyline you can check** — the top 50 towers are validated against a curated list on every build (St. Regis, One Chicago, NEMA, 400 Lake Shore included); every landmark is hand-specified — setbacks, crowns, spires, sourced materials, night lighting.
- **The river and the lake at their real levels** — the river 6.3 m under Wacker Drive with the Riverwalk at the water, the lake 4.65 m under the lakefront with its revetments, harbours and about 1,200 moored boats.
- **The streets under the streets** — Lower Wacker, Lower Michigan, Lower Columbus and the rest of the double- and triple-decker streets, with their own traffic, opened to view with `U`.
- **Lincoln Park, all of it** — the zoo, the Conservatory, Café Brauer, the museums, the monuments and the beaches from North Avenue to Irving Park.
- **Stadiums** — Wrigley, Rate Field, Soldier Field and the United Center as real venues that light up, fill and play on real game days.
- **Façades and light** — eight Chicago façade families generated with Z-Image and made seamless; glass that reflects the live sky; windows lit by office floor; a sky that follows real Chicago time, with DAWN / DAY / DUSK / NIGHT, SUNNY and SNOW views.
- **Rooftops and ground** — parapets, gravel / tar / membrane / green roofs, 120 water towers, 2,440 HVAC units; parks, beaches and 28,862 trees coloured by the current month; the elevated Loop L on steel bents.
- **Sacred buildings and civic icons** — about 220 churches, cathedrals, synagogues, temples and a mosque; the Centennial Wheel, Cloud Gate, Buckingham Fountain, Pritzker Pavilion, the Water Tower and the rest.
- **The L, Metra and the bus** — every line in its true colours, trains on real headways, eight CTA bus routes, and rides from the front window.
- **A guide** — hover and click any building, 6,900 places pinned to their roofs, tours, neighbourhood profiles and commute times.
- **Human controls** — ⌘K search with fly-over flights, arrow keys, an on-screen control dock, a help card; the whole HUD scales together on any window size.

---

## Controls

Everything is reachable with the keyboard, the mouse and the on-screen dock. Press `?` in the app for the same list in plain words.

| Input | Action |
|---|---|
| `⌘K` / `Ctrl+K` / `/` | search any landmark, neighbourhood, view or command — Enter flies you there |
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
| Click a train / station | its card — run, next stop, arrivals; "Follow this train" rides along (`Esc` or a move key stops) |
| `⌘K` "Follow a … train" · "Go to …" · "Show … Line" | transit from the search |
| `C` · ⌘K "Traffic" | cars, buses and trucks on the streets, stopping at the lights — busiest at rush hour, lit after dusk |
| `M` · ⌘K "Sound" | music for the fountain and bridge shows, crowd cheers, passing trains and your ride — off until you turn it on; a green speaker (on) or a red one with a slash (off) shows in the middle of the screen for a second, then fades |
| `G` · Games button · ⌘K "tonight" | tonight's game, scores and the next game at every venue |
| `Y` · ▶ Play a game (a ballpark's card) | a 90-second game at Wrigley, Rate Field or Soldier Field — the card's ballpark, else the nearest; `Y` again or `Esc` stops it (⌘K "Play a Cubs game", "Play a Fire match", "Stop the game"); a real live game always wins |
| `B` · Bridges button | raise the river bridges — a boat-run lift with gate bells, flashers and music, the traffic waiting at the gates; press again and they come down within seconds |
| `J` · Fountain button | Buckingham Fountain water show — jets dance to music, lit in colour after dusk; press again to stop |
| `X` · Fireworks button | Navy Pier fireworks — flies you to the harbour view; press again to stop (real shows: Wed 9 pm, Sat 10 pm in summer) |
| `P` · Places button | pins for restaurants, bars, venues and more — click one for its card and website |
| `L` · Ride button | ride the city — an L line, a CTA bus, a street-level walk (⌘K "Riverwalk (river level)" walks it at the water), a drive under the street (⌘K "Drive Lower Wacker") or the glide; `Space` pauses, `.` `,` next or previous stop, `>` `<` faster or slower, drag to look, `Esc` gets off. `M`, `X` and the other toggles never end a ride, a tour or a train follow |
| `K` | change the view — in a ride (front window, alongside, behind) or while following a train |
| `U` · ⌘K "Lower levels" | the streets under the streets — the street over Lower Wacker, Lower Michigan, Lower Columbus and the other double-decker streets opens like a cut-away drawing, the lower streets named, the traffic driving underneath; `U` again closes it (from far away it flies you over the river first) |
| `I` · ⌘K "Team lights" | Team lights on/off (on unless you turn it off; remembered) — on the night a Chicago team wins, Willis Tower's antennas, 875 North Michigan's crown and masts, Two Prudential's spire, the Wrigley Building and the Merchandise Mart glow in the team's two colours until 2 a.m.; ⌘K "Preview Cubs lights" (or Bears, White Sox, Bulls, Blackhawks, Sky, Fire) shows them for a minute |
| `V` · SCAN button | holographic Scan; in the Live lens, light columns for transit, nightlife, green space or rent |
| Weather button | follows Chicago live, or pick clear, overcast, rain, snow or lake fog (also ⌘K "Weather") |
| LIVE CTA / SIMULATED chip | click for the data sources and "Try live again" |
| `?` · `Esc` | help card · close / stop a flight |
| ⌘K "performance" | draw calls, triangles and frame rate (a diagnostic chip) |
| Control dock & minimap | the same moves as buttons; click the minimap to fly |

<table>
<tr>
<td width="50%"><img src="docs/screenshots/c-sound-on.png" alt="M — a bare green speaker with waves in the middle of the screen: sound on" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/c-sound-off.png" alt="M again — a bare red speaker with a slash: sound off" width="100%"/></td>
</tr>
<tr>
<td><em><code>M</code> — sound on: a green speaker, held a second, then fading.</em></td>
<td><em><code>M</code> again — sound off: the same speaker in red, struck through.</em></td>
</tr>
</table>

The help card (`?`) is one wide sheet: Move · Look · Search · City life · Rides and tours · Games · Guide · Live city · Time, flowing through as many columns as the screen holds — every key on one page at 1440 × 900, a scrolling full-height sheet on a phone.

<table>
<tr>
<td width="72%"><img src="docs/screenshots/help-1440x900.png" alt="The help card at 1440 by 900: four even columns of keycaps and plain-word lines, nothing scrolled" width="100%"/></td>
<td width="28%"><img src="docs/screenshots/help-390x844.png" alt="The help card on a phone: a full-height sheet" width="100%"/></td>
</tr>
</table>

### Team lights — *the skyline in the winner's colours*

The way Chicago really does it, coordinated through BOMA so the skyline speaks for one team at a time: after a Bears, Cubs, White Sox, Bulls, Blackhawks, Sky or Fire win, from the final (or sunset, if that's later) until 2 a.m., **Willis Tower**'s LED antennas, **875 North Michigan**'s crown band and masts, **Two Prudential Plaza**'s pyramid and spire, the floodlit **Wrigley Building** and its clock tower, and the **Merchandise Mart**'s block and tower glow in the team's two colours — two winners on one day take turns every 12 seconds. "Play a game" ending in a home win lights them for its celebration. Black is drawn as dark bands (the White Sox' silver-and-black), navy as deep-blue light. `I` turns it off or on; ⌘K "Preview Bears lights" shows any team for a minute. It is the façade shader's own light — no extra meshes or draw calls.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/tl-skyline-cubs.png" alt="The skyline at night after a Cubs win — blue and red on Willis, Hancock, Two Pru and the Wrigley Building" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/tl-skyline-bears.png" alt="The skyline after a Bears win in navy blue and orange" width="100%"/></td>
</tr>
<tr>
<td><em>Cubs: blue below, red above — antennas, masts, spire, the Wrigley Building's clock tower.</em></td>
<td><em>Bears: navy-blue light and orange.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/tl-skyline-whitesox.png" alt="The skyline after a White Sox win in silver with dark bands" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/tl-skyline-bulls.png" alt="The skyline after a Bulls win in red and white" width="100%"/></td>
</tr>
<tr>
<td><em>White Sox: silver light, the black as dark tips and bands.</em></td>
<td><em>Bulls: red, with white for the black.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/tl-willis-bears.png" alt="Willis Tower's antennas in Bears blue and orange" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/tl-mart-cubs.png" alt="The Merchandise Mart floodlit Cubs blue, its tower red" width="100%"/></td>
</tr>
<tr>
<td><em>Willis Tower's LED antennas for the Bears.</em></td>
<td><em>The Merchandise Mart floodlit for the Cubs: blue block, red tower.</em></td>
</tr>
</table>

---

## The river

### At its real depth — *6.3 m under the street, the Riverwalk at the water*

The Chicago River runs where it really does: 6.3 m below Upper Wacker Drive (the regulated river level, checked against the 2017 Cook County LiDAR), between concrete dockwalls downtown and rubble-faced banks upriver, with the slips, basins and the Harbor Lock opening onto it. The Riverwalk sits 1 m above the water, from Lake Shore Drive to the Confluence at Lake Street, with its rooms between the bridges — the east section, the Vietnam Veterans Memorial, Marina Plaza, the Cove, the River Theater's steps up to Wacker, the Water Plaza, the Jetty and the Boardwalk — a passage under every bridge and a stair up to the street beside each one. The bascule piers stand in the water, each leaf swings down into a pit sized for its tail, the subway tubes dive under the river (the Red Line to about 20 m down at State Street), and the water's reflection follows the view.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/d1-river-michigan-dusk.png" alt="The river from the Michigan Avenue bridge at dusk" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d1-riverwalk-theater-day.png" alt="The River Theater's steps on the Riverwalk" width="100%"/></td>
</tr>
<tr>
<td><em>West from the Michigan Avenue bridge at dusk: the river down in its canyon, the bascules lined up toward Marina City.</em></td>
<td><em>On the Riverwalk at the River Theater: the seat-steps climb to Upper Wacker, the LaSalle Street bridge ahead.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/d1-riverwalk-jetty-day.png" alt="The Jetty's piers and the vaults under Wacker" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d1-bridge-raised-pit.png" alt="The Clark Street bridge raised over its pit" width="100%"/></td>
</tr>
<tr>
<td><em>The Jetty: wooden piers out over the water, the arched vaults under Wacker Drive behind.</em></td>
<td><em>Press <code>B</code>: the Clark Street leaf stands up and its tail drops into the open pit in the pier.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/d1-subway-under-river.png" alt="Following a Red Line train under the river" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d1-hero-river-dusk.png" alt="The river hero view at dusk" width="100%"/></td>
</tr>
<tr>
<td><em>Following a Red Line train through the State Street tube, about 16 m down where it passes under the river.</em></td>
<td><em>The river at dusk: the water below the dockwalls, the Riverwalk at its edge.</em></td>
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
<td colspan="2"><em>The mouth: the Harbor Lock's 600 × 80 ft chamber, its sector gates and the zinc control house, with Lake Point and the Streeterville wall behind — and, left, the St. Regis with its two-storey blow-through closed in slabs behind a fine steel grille.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v9-river-dusable-day.png" alt="DuSable Bridge by day" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-dusable-night.png" alt="DuSable Bridge at night" width="100%"/></td>
</tr>
<tr>
<td colspan="2"><em>At DuSable: the Wrigley Building and the Tribune with London Guarantee's tholos and 333 N Michigan across the bridge; Trump's stainless fins and setbacks behind. Bennett's four bridgehouses stand on their mapped corners, their stone run down to the water.</em></td>
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
<td colspan="2"><em>The South Branch from over the water: the bridge-tender houses at every crossing in their bridge's style, the Civic Opera on the right bank, Riverside Plaza and 150 N Riverside on the left.</em></td>
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

### At the water — *how the river icons meet the river, from a tour boat and the street*

Each icon's riverfront is built where it meets the dockwall: Trump's and Wrigley's river walks on piles with stairs down the wall, Marina City's raised plaza over its marina with the restaurants and slips beneath, Apple Michigan Avenue's steps from Pioneer Court to the water, the Opera's arcade at the river, the walks at 300 N LaSalle, Wolf Point, River Point, 150 N Riverside and River City, and the balustrades of the Mart and Riverside Plaza. Sixty bridge-tender houses stand on their mapped footprints in their bridge's style, down to the water; DuSable's carry Fraser's and Hering's 1928 reliefs. Upper Wacker's parapet is Bennett's balustrade again, and Taft's Heald Square group stands at Wabash.

The river has its boats: cruisers, runabouts and flybridge yachts in the Marina City and River City slips, architecture-tour boats at their docks by Michigan Avenue and under way past Marina City, toward the lake and up the South Branch, and water taxis at their stops. Each is a scripted Blender model with a real hull and its cabins, windscreens, rails and canopies; one model wears any livery. All are generic, with no operator's name or colours, and the working boats' cabins light up after dusk.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/v9-river-level-marina-day.png" alt="Marina City at the water" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-level-marina-dusk.png" alt="Marina City at the water at dusk" width="100%"/></td>
</tr>
<tr>
<td colspan="2"><em>Marina City from a tour boat: the plaza deck on its columns over the marina, the restaurants' glass beneath it, a terrace at the water, and its slips full of cruisers and flybridge yachts.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/f9-tourboat-marina-day.png" alt="A tour boat under way past Marina City" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/f9-tourboat-marina-dusk.png" alt="A tour boat past Marina City at dusk" width="100%"/></td>
</tr>
<tr>
<td colspan="2"><em>An architecture-tour boat under way west past Marina City, with a glazed lower saloon and an open upper deck of benches under a canopy. At dusk its cabin is lit.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/f9-tourboat-michigan-day.png" alt="A tour boat at its dock below the Wrigley Building" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/f9-river-east-day.png" alt="Tour boats on the main stem east of Michigan Avenue" width="100%"/></td>
</tr>
<tr>
<td colspan="2"><em>Tour boats at their docks by Michigan Avenue, and under way to the lake.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v9-river-level-apple-day.png" alt="Apple Michigan Avenue at the water" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-level-apple-dusk.png" alt="Apple Michigan Avenue at dusk" width="100%"/></td>
</tr>
<tr>
<td colspan="2"><em>Apple Michigan Avenue: 32 ft of glass under the 111 × 98 ft carbon-fibre roof, with the wide steps down from Pioneer Court on either side to a landing at the river.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v9-river-level-dusable-day.png" alt="The DuSable southeast bridgehouse" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-level-dusable-dusk.png" alt="The DuSable southeast bridgehouse at dusk" width="100%"/></td>
</tr>
<tr>
<td colspan="2"><em>DuSable's southeast bridgehouse and Henry Hering's <em>Regeneration</em> (1928), workers rebuilding after the Fire. Fraser's <em>The Discoverers</em> and <em>The Pioneers</em> are on the north houses, Hering's <em>Defense</em> on the McCormick Bridgehouse. The figures are read from photographs.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v9-river-level-opera-day.png" alt="The Civic Opera at the water" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-level-opera-dusk.png" alt="The Civic Opera at the water at dusk" width="100%"/></td>
</tr>
<tr>
<td colspan="2"><em>The Civic Opera's limestone carried down to the South Branch, with its arcade at the water.</em></td>
</tr>
<tr>
<td colspan="2"><img src="docs/screenshots/f9-boat-models.png" alt="The five boat models rendered in Blender" width="100%"/></td>
</tr>
<tr>
<td colspan="2"><em>The five boats as built: runabout, express cruiser, flybridge yacht, water taxi and architecture-tour boat (Blender previews, baked occlusion). Each has a lofted hull, about 1.8–4.3 k triangles up close and under 600 far off.</em></td>
</tr>
</table>

---

## Lincoln Park

*The whole park to the Tribune and Wrigley standard, North Avenue to Irving Park.*

Every building, monument and landmark in Lincoln Park, each from its OSM outline with sourced heights, materials and lighting (what is read from photographs is marked approximate): the zoo's houses from the 1912 Lion House to Penguin Cove and the red barns of Farm-in-the-Zoo, Café Brauer and the Nature Boardwalk, the Conservatory's four glass houses and the Bates Fountain, the History and Nature Museums, North Pond, Theater on the Lake, the Elks Memorial, the beach house, the Passerelle, the driving range, and the monuments — Lincoln's exedra, Grant's arch, Schiller, Andersen, Franklin, the gilded Hamilton, Altgeld, A Signal of Peace and Kwanusila — alongside the Lily Pool, the Chess Pavilion, the Couch Tomb and the Waveland Clock Tower. The ponds, lagoons and harbours show as water. Every site is on its hover card and in ⌘K, and the VISIT lens has a tour: *Lincoln Park, South to North*.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/v10-lp-north-avenue-beach-day.png" alt="North Avenue Beach by day" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-north-avenue-beach-night.png" alt="North Avenue Beach at night" width="100%"/></td>
</tr>
<tr>
<td><em>The North Avenue Beach House as the ocean liner it was built to be, aground on the sand: portholes, the blue-railed decks, the Castaways canopy and two red-banded funnels, the beach sloping down into the lake.</em></td>
<td><em>At night the portholes glow along the hull, and Lake Shore Drive's traffic streams past behind.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v10-lp-zoo-mall-day.png" alt="Lincoln Park Zoo by day" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-south-pond-day.png" alt="South Pond by day" width="100%"/></td>
</tr>
<tr>
<td><em>Lincoln Park Zoo: the Kovler Lion House's tile roof, ridge monitor and great arched door, the Primate House portico, the Small Mammal–Reptile House dome, the carousel, the sea lions' pool.</em></td>
<td><em>South Pond: Café Brauer's Prairie School brick and green tile curving round the water, the boardwalk loop and its prairie edge, the honeycomb pavilion across the pond.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v10-lp-south-pond-night.png" alt="South Pond at night" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-conservatory-day.png" alt="The Conservatory by day" width="100%"/></td>
</tr>
<tr>
<td><em>Café Brauer's windows lit for an evening event over the pond; the zoo beside it closed and dark, the way it is.</em></td>
<td><em>The Conservatory's four glass houses — the 50 ft Palm House over the formal garden's hedged beds and the Bates Fountain.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v10-lp-theater-on-the-lake-day.png" alt="Theater on the Lake at Fullerton" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-belmont-waveland-day.png" alt="Diversey to Waveland" width="100%"/></td>
</tr>
<tr>
<td><em>Fullerton: Theater on the Lake's brick arches under its tile roofs, the stepped revetment down to the lake, North Pond and the Nature Museum beyond.</em></td>
<td><em>From Diversey to Waveland: Belmont Harbor down at the lake's level with its docks and moored boats, the driving range's nets, the Elks rotunda, Kwanusila and the Waveland Clock Tower at the park's north edge.</em></td>
</tr>
</table>

---

## The streets under the streets

### Lower Wacker and the U cut-away

Chicago's double- and triple-decker streets are under the city where they really are: Lower Wacker Drive 5.1 m below Upper Wacker (4.2 m of clearance under a 0.9 m deck, the 2002 rebuild's 13′9″), Lower Michigan, Lower Columbus, Lower Randolph, Lower Stetson, South Water, Field Boulevard, Lower North Water and the service drives, and a third level 9.5 m down for Lower Lower Wacker and Lower Lower Randolph — 25 km of roadway from OpenStreetMap, each ramp climbing to the street at its real mouth. They have their lanes and worn yellow edge lines, a column every 32 ft (9.75 m) holding up the street above, and strip lights pooling warm light on the asphalt; the DuSable and Outer Drive bridges carry Lower Michigan and the lower Drive across the river on their lower decks.

Press **`U`** (or ⌘K "Lower levels") and the street over them dissolves away, outlined by a thin cyan cut line like an architect's cut-away drawing, so you can look down into Lower Wacker from anywhere; the lower streets are named where they run — the famous ones from across the Loop, the side streets once you are close — and the Riverwalk's rooms along the water's edge. Click any name to fly there. Press `U` again and the street closes; with it off, nothing at street level changes.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/d2-u-loop-day.png" alt="The U cut-away over the river: Lower Wacker and Lower Michigan opened" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d2-u-loop-night.png" alt="The U cut-away at night: the lower streets' lights" width="100%"/></td>
</tr>
<tr>
<td><em>Press <code>U</code> over the river: the street opens along Wacker Drive and up Michigan Avenue, the lower level shows underneath with its traffic, and its streets and the Riverwalk's rooms are named.</em></td>
<td><em>The same view at night: Lower Wacker's strip lights glow under the opened street, its cars' headlights with them, the names still crisp.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/d2-lower-wacker-day.png" alt="Down into Lower Wacker between Michigan and Columbus" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d2-lower-wacker-night.png" alt="Lower Wacker at night under the cut-away" width="100%"/></td>
</tr>
<tr>
<td><em>Down into Lower Wacker east of Michigan: its lanes, the column rows every 32 ft, the side streets named, and the Stetson ramp climbing to the street in its open trench, its header signed.</em></td>
<td><em>Lower Wacker at night: the lamps pool light on the roadway; the street above stays dark.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/d2-lower-michigan-river-day.png" alt="Lower Michigan at the river, beside the DuSable Bridge" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d2-lower-wacker-riverwalk-day.png" alt="Lower Wacker behind the Riverwalk at Columbus Drive" width="100%"/></td>
</tr>
<tr>
<td><em>Lower Michigan meets the river at the DuSable Bridge, whose lower deck carries it across.</em></td>
<td><em>Lower Wacker runs behind the Riverwalk's retaining wall, between the river and the towers.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/d4-u-labels-day.png" alt="The U view with the lower streets and the Riverwalk's rooms named" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d4-riverwalk-rooms-day.png" alt="Down by the river, the Riverwalk's rooms named" width="100%"/></td>
</tr>
<tr>
<td><em><code>U</code> closer in: Lower Michigan, Lower Wacker and the service drives named where they run, and the Riverwalk's rooms from Michigan–Wabash to the Cove.</em></td>
<td><em>Fly down by the river and the rooms name themselves, without <code>U</code>: Riverwalk East, Michigan–Wabash and the Vietnam Veterans Memorial Plaza.</em></td>
</tr>
</table>

### Traffic under the street, and Drive Lower Wacker

The lower streets carry traffic. Cars, buses and trucks come down the ramps from the street at the ramp's grade, run along Lower Wacker, Lower Michigan, Lower Columbus and Lower Randolph (and the third level), and climb back out to the street. Their lanes keep every vehicle, even a 2.6 m truck, clear of the walls and of each row of columns, and under the deck their headlights are on at any hour. Raising the bridges (`B`) stops the traffic: the gates come down ten seconds before the leaves move, cars queue at both ends (most turn away), nobody is ever left on a rising leaf, and traffic crosses again once the bridge is down.

**Drive Lower Wacker** (⌘K "Drive Lower Wacker", or Ride → Drives) is a ride under the street: from Randolph and Columbus down the ramp, along Lower Columbus, under the river front on Lower Wacker past Michigan, State and Franklin, then up the Lake Street exit to Upper Wacker — 2.1 km from the front of a bus, with the lower level's traffic around you.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/d3-drive-lower-columbus-day.png" alt="Driving Lower Columbus toward Lower Wacker, oncoming headlights between the columns" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d3-drive-lower-michigan-day.png" alt="The drive at Lower Michigan, traffic under the street" width="100%"/></td>
</tr>
<tr>
<td><em>Drive Lower Wacker: down on Lower Columbus, oncoming headlights between the rows of columns.</em></td>
<td><em>Under Michigan Avenue: Lower Wacker's traffic queues at the Lower Michigan junction, the river through the opening on the right.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/d3-u-lower-wacker-traffic-dusk.png" alt="The U cut-away at dusk: Lower Wacker's traffic behind the Riverwalk" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d3-bridges-raised-traffic-day.png" alt="The bridges raised, traffic waiting on Wacker" width="100%"/></td>
</tr>
<tr>
<td><em><code>U</code> at dusk, closer in: a truck and cars on Lower Wacker behind the Riverwalk, headlights on under the deck.</em></td>
<td><em><code>B</code> raises the bridges: the leaves are empty, and the traffic waits on Wacker until they come down.</em></td>
</tr>
</table>

### The ramps, open to the sky

Every ramp between the street and the lower levels is a real opening in the street: where OpenStreetMap's ramp leaves the street, the road surface opens over a trench that falls at the ramp's grade between retaining walls, their parapets rising to a metre above the pavement, until it passes under the street at a concrete header — the tunnel's mouth, dark beyond it. Traffic drives visibly down into them and up out of them at any time, `U` or not. The famous ramps carry their street's name on the header in Chicago's green: Lower Columbus at Randolph, Lower Lower Wacker at Stetson, Lower Michigan at Lake, Lower Wacker from Congress at Franklin, at Lake Street, east of Michigan and at the Drive, Lower Randolph and Lower Grand.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/d4-portal-michigan-day.png" alt="The Lower Michigan ramp at Lake Street, cars driving down into it" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d4-portal-columbus-close-day.png" alt="The Lower Columbus portal at Randolph, its header signed" width="100%"/></td>
</tr>
<tr>
<td><em>Michigan Avenue at Lake Street: the street opens over the Lower Michigan ramp and traffic drives down into the tunnel.</em></td>
<td><em>Columbus Drive at Randolph: the two ramps of Lower Columbus between their parapets, the header lettered LOWER COLUMBUS DR.</em></td>
</tr>
</table>

---

## The lake

### At its real level — *4.65 m under the lakefront, and the harbours full of boats*

Lake Michigan lies where it really does: 4.65 m below the lakefront park and Lake Shore Drive (its long-term mean level, checked against the 2017 Cook County LiDAR), with Monroe, DuSable, Burnham, 31st Street, Diversey and Belmont harbours at the same level. Every edge meets the water the way the real one does: the stepped limestone revetments of Lincoln Park and the Shoreline Protection Project, with a promenade ledge 2.6 m above the water and big steps down into the lake; harbour walls with a rubble slope and a concrete coping; Navy Pier's tall dock face; the beaches sloping from the Lakefront Trail down into the water. The breakwaters and the harbour lighthouse stand 1.8–2.4 m above the lake. The river is 1.65 m lower again, and the two only meet at the Chicago Harbor Lock, behind its lake gate; Lincoln Park's ponds and the South Lagoon stay perched 0.6 m below their grassy banks.

The harbours have floating docks with finger slips and a mooring field where every boat swings into the wind — about 1,200 sailboats and cruisers, each built in Blender (a lofted hull with its sheer stripe, a cabin with its windows, lifelines and pulpits, a mast and boom or a hardtop with its radar arch) and painted in its own colours; at dusk their masthead lights come on. ⌘K "Belmont Harbor", "Diversey Harbor", "Chicago Harbor Lock" and "North Avenue Beach" fly you there.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/d5-navypier-lake-day.png" alt="Navy Pier and Streeterville from the lake by day" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d5-navypier-lake-dusk.png" alt="Navy Pier and Streeterville from the lake at dusk" width="100%"/></td>
</tr>
<tr>
<td><em>Navy Pier from the lake: the pier's dock face down to the water, the shore along Streeterville behind.</em></td>
<td><em>The same view at dusk, the Centennial Wheel lit.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/d5-belmont-harbor-dusk.png" alt="Belmont Harbor at dusk" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d5-belmont-docks-day.png" alt="Among the moored boats in Belmont Harbor" width="100%"/></td>
</tr>
<tr>
<td><em>Belmont Harbor at dusk: the docks and their slips in the south basin, the mooring field beyond, masthead lights coming on.</em></td>
<td><em>Down among the moorings: every boat swung to the same wind, the harbour wall's limestone behind.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/d5-diversey-harbor-day.png" alt="Diversey Harbor" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d5-monroe-harbor-day.png" alt="Monroe Harbor's mooring field" width="100%"/></td>
</tr>
<tr>
<td><em>Diversey Harbor between its walls, its docks at the north end.</em></td>
<td><em>Monroe Harbor's mooring field in front of the Loop, sailboats and cruisers pointing into the wind.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/d5-lock-mouth-day.png" alt="The shore by the Chicago Harbor Lock" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d5-lock-high-day.png" alt="The Chicago Harbor Lock from above" width="100%"/></td>
</tr>
<tr>
<td><em>The lakefront by the river mouth: the stepped revetment and its stairs down to the water.</em></td>
<td><em>The Chicago Harbor Lock: the lake on the outside, the river 1.65 m lower inside the chamber; nowhere else do the two waters meet.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/d5-lock-mouth-dusk.png" alt="The river mouth at dusk" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d5-northerly-island-dusk.png" alt="Northerly Island at dusk" width="100%"/></td>
</tr>
<tr>
<td><em>The river mouth at dusk, the revetment's steps in shadow, the Streeterville wall lit above.</em></td>
<td><em>Northerly Island at dusk, its shore down at the lake.</em></td>
</tr>
</table>

### The beaches — *Chicago's tan sand, the walks across it, and the volleyball nets*

The beaches look like the real ones in photographs: the light tan of Chicago's lakefront sand, holding that colour through day, dusk and night (and white under the SNOW view). The walks that cross the sand are narrow light-concrete paths, and the Lakefront Trail is what it is — a park trail of weathered blacktop with a dashed yellow centre line, ploughed in snow. North Avenue Beach's lawns, gardens and parking lot by the beach house sit clear of the sand, and no tree stands on a beach. Every sand volleyball court OSM maps has its net at regulation height (2.43 m): two thin dark posts and a dark see-through mesh under a white top tape, sagging slightly — 112 nets, drawn only inside the view and within 650 m.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/f8-northave-beach-day.png" alt="North Avenue Beach by day" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/f8-northave-beach-dusk.png" alt="North Avenue Beach at dusk" width="100%"/></td>
</tr>
<tr>
<td><em>North Avenue Beach by day: tan sand down to the water, the courts' nets in rows, the beach house beyond.</em></td>
<td><em>The same beach at dusk, the sand warm in the low sun.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/f8-oak-beach-day.png" alt="Oak Street Beach by day" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/f8-northave-courts-day.png" alt="The volleyball courts at North Avenue Beach" width="100%"/></td>
</tr>
<tr>
<td><em>Oak Street Beach from the lake: the curve of sand under the Gold Coast towers.</em></td>
<td><em>Down at the courts: thin dark posts, the dark mesh and its white top tape.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/d5-ohio-beach-day.png" alt="Ohio Street Beach and the stepped revetment" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d5-northave-beach-dusk.png" alt="North Avenue Beach at dusk from the lake" width="100%"/></td>
</tr>
<tr>
<td><em>Ohio Street Beach: the tan sand runs into the water, and the stepped limestone revetment carries on along Lake Shore Drive.</em></td>
<td><em>North Avenue Beach at dusk from the lake: the beach house on the sand, the volleyball nets, the beach sloping down to the water.</em></td>
</tr>
</table>

---

## Sports

Game days come from the real schedules of all seven Chicago teams (see [Live data](#live-data)). When a real game is on, Wrigley, Rate Field, Soldier Field, the United Center or Wintrust comes alive by itself — the crowd, the lights, the players and the live score on the board — and after a Cubs win the W flies.

### The Bulls board

The United Center carries the same game information as the open-air boards, in Bulls colours: a four-faced LED board on a mast at the roof centre and a ribbon that scrolls round the parapet (Blackhawks colours on a Blackhawks game night) — a guide display, not a real fixture.

<table>
<tr>
<td width="33%"><img src="docs/screenshots/sports-united-center-day.png" alt="United Center by day — the Bulls board on the roof showing the next game" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/sports-united-center-night.png" alt="United Center at night — the Bulls board showing a live score" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/sports-united-center-plaza-night.png" alt="United Center game night, the Bulls ribbon round the roof" width="100%"/></td>
</tr>
<tr>
<td><em>By day the board on the roof shows the next game.</em></td>
<td><em>At night, a game in progress: the live score on all four faces.</em></td>
<td><em>From the plaza: lit fascia, the stepped grey dome and the scrolling ribbon round the parapet.</em></td>
</tr>
</table>

### Play a game

Any card for Wrigley, Rate Field or Soldier Field has **▶ Play a game** (also `Y` and ⌘K): a 90-second game — the crowd fills, the lights come up, the teams take the field, the board and the marquee tick through the innings, and the crowd stands for every home score. A real live game always wins: during one the button is hidden and the card says "Live now — this is the real game".

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

### Vision pass V4 · Trains — *the L and Metra running on time*

<table>
<tr>
<td width="33%"><img src="docs/screenshots/v4-trains-loop-night.png" alt="V4 — riding a Brown Line train round the Loop at night" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v4-trains-chase-dusk.png" alt="V4 — riding behind a Red Line train at dusk" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v4-trains-metra-day.png" alt="V4 — a Metra MP36 leading a push-pull train of gallery cars" width="100%"/></td>
</tr>
<tr>
<td><em>5000- and 7000-series cars on real headways — accelerating, braking, dwelling at stations, held to 30 mph round the Loop.</em></td>
<td><em>Follow any train from ⌘K or its card; the camera stays above the roofs and lets go on <code>Esc</code> or a movement key.</em></td>
<td><em>Metra gallery cars and an MP36 in push-pull, simulated from the clock.</em></td>
</tr>
</table>

### Vision pass V5 · Stadiums — *game nights, crowds and the W*

<table>
<tr>
<td width="33%"><img src="docs/screenshots/v5-soldier-field-night.png" alt="V5 — Soldier Field on a game night" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v5-wrigley-field-day.png" alt="V5 — Wrigley Field from above" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v5-w-flag-day.png" alt="V5 — the W flag over Wrigley's scoreboard" width="100%"/></td>
</tr>
<tr>
<td><em>Soldier Field on a game night: rim floodlights, painted Bears end zones, a full bowl and the teams at the line.</em></td>
<td><em>Wrigley from above: crosshatched outfield, clay arc and chalk at MLB dimensions — and the rooftop clubs' steel bleachers across Waveland and Sheffield.</em></td>
<td><em>After a Cubs win the W flies over the scoreboard, the board reads FINAL, and the fans wave W flags — on the rooftops across Sheffield too.</em></td>
</tr>
</table>

### Vision pass V6 · Landmarks and bridges — *bascules, Buckingham, the Bean, the civic icons*

<table>
<tr>
<td width="50%"><img src="docs/screenshots/v6-bridges-before-dusk.png" alt="V6 — the river bridges before the detail work" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v6-bridges-after-dusk.png" alt="V6 — the river bridges as Chicago-type trunnion bascules" width="100%"/></td>
</tr>
<tr>
<td><em>Before: the river bridges were flat road ribbons over the water — "the bridges are starting to look good" was the moment in the build log that started the bridge work.</em></td>
<td><em>After: 32 named bascules — grid decks, lattice railings, tender houses, lanterns and navigation lights (press <code>B</code> to raise them).</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v6-south-branch-bascules-day.png" alt="V6 — the run of bascule bridges up the South Branch" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v6-dusable-dusk.png" alt="V6 — the DuSable Bridge with its four bridgehouses" width="100%"/></td>
</tr>
<tr>
<td><em>Up the South Branch: one bascule per street, each with its tender houses.</em></td>
<td><em>The DuSable Bridge: four Bedford-stone bridgehouses, balustrades, lanterns and red channel lights.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v6-buckingham-night.png" alt="V6 — Buckingham Fountain's evening water show" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v6-cloudgate-day.png" alt="V6 — Cloud Gate mirroring the skyline" width="100%"/></td>
</tr>
<tr>
<td><em>Buckingham Fountain in pink marble with eight bronze seahorses; the 46 m jet plays on the real schedule (press <code>J</code> for a show now).</em></td>
<td><em>Cloud Gate at its true 20 × 13 × 10 m shape, mirroring the live sky and the skyline, with people on the plaza.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v6-crownfountain-night.png" alt="V6 — Crown Fountain's faces at night" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v6-picasso-day.png" alt="V6 — the Chicago Picasso in Daley Plaza" width="100%"/></td>
</tr>
<tr>
<td><em>Crown Fountain's LED faces pucker and spout on their cycle. Also new: Lurie Garden, the BP Bridge, the Art Institute lions, the Flamingo, the Cultural Center domes, Union Station, Navy Pier's Headhouse and Ballroom, the Riverwalk and the Zoo.</em></td>
<td><em>The Chicago Picasso in Daley Plaza — 50 ft of rust-red Cor-Ten steel on its granite base, under the Daley Center's dark glass.</em></td>
</tr>
</table>

### Vision pass V7 · Controls — *every feature one click, one key, one search away*

<table>
<tr>
<td width="37%"><img src="docs/screenshots/v7-hud-1440x900-day.png" alt="V7 — the HUD at 1440×900 with Transit, Games, Sound, Bridges and Fountain in the dock" width="100%"/></td>
<td width="26%"><img src="docs/screenshots/v7-hud-800x600-day.png" alt="V7 — the same HUD at 800×600" width="100%"/></td>
<td width="37%"><img src="docs/screenshots/v7-help-card-day.png" alt="V7 — the help card with the City life controls" width="100%"/></td>
</tr>
<tr>
<td><em>Transit, Games, Sound, Bridges and Fountain share one dock row; legends and cards stack on the left, clear of the minimap.</em></td>
<td><em>The same HUD at 800 × 600 — everything scales together.</em></td>
<td><em>The help card lists every control in plain words.</em></td>
</tr>
</table>

### Vision pass · complete — *the bridges, the budget, the whole city at once*

<table>
<tr>
<td width="50%"><img src="docs/screenshots/v8-bridges-dusk.png" alt="V8 — the detailed bascule bridges down the river at dusk" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v8-bridge-lift-dusk.png" alt="V8 — the DuSable Bridge raised during a boat-run lift" width="100%"/></td>
</tr>
<tr>
<td><em>The Chicago-type bascules down the river canyon at dusk: trunnion leaves, tender houses, lanterns — one deck per crossing.</em></td>
<td><em>Press <code>B</code>: the boat-run lift raises bridge after bridge to its own music, with gate bells and flashing gates.</em></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/v8-wide-streeterville-dusk.png" alt="V8 — the wide Streeterville view at dusk" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v8-loop-night.png" alt="V8 — the Loop at night" width="100%"/></td>
</tr>
<tr>
<td><em>The widest lakefront view — about 580 draw calls and 3.3 M triangles, well inside the 900-call budget.</em></td>
<td><em>The Loop at night: lit crowns, glowing L lines, trains and ballparks in one frame.</em></td>
</tr>
</table>

### Phase 3 · Heroes — *sculptural signatures and twenty more landmarks*

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

The city became a guide: hover any building for its name and year, click for its card with the nearest L; 6,900 places pinned on the roofs they belong to; and three lenses — VISIT (landmark beacons, CHI ATLAS's curated picks, guided tours), LIVE (22 neighbourhoods with character, rent and five feel scores) and WORK (set your office, or type an address, and see how far the L gets you).

<table>
<tr>
<td width="50%"><img src="docs/screenshots/p4-visit-beacons-dusk.png" alt="Phase 4 — the Visit lens at dusk: tours, places and landmark beacons" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p4-live-zones-night.png" alt="Phase 4 — the Live lens at night: neighbourhood zones and names" width="100%"/></td>
</tr>
<tr>
<td><em>VISIT at dusk: guided tours, place filters and the curated landmarks, their labels never overlapping.</em></td>
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
<td><em>Press <code>7</code>: Christmas Eve at dusk — snow falling, roofs and parks white, the harbour frozen, windows coming on.</em></td>
<td><em>Press <code>6</code>: a clear midsummer afternoon.</em></td>
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
<td><em>Lincoln Park's stone: Caldwell's Lily Pool between stratified limestone ledges, the Nature Museum and its Butterfly Haven beyond.</em></td>
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

### Phase 5 · Alive — *live trains, live scores, weather and Scan*

The city reads live data when it can and never shows an error when it can't: CTA trains snapped onto the track (with the timetable simulator as the fallback), live scores driving the stadiums, the scoreboards and the W flag, and the real Chicago sky — overcast, rain, snow or lake fog, carried by the wind. The chip at the top left says honestly which: LIVE CTA or SIMULATED, with the data sources one click away. Press `V` for Scan, the holographic city.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/p5-live-trains-dusk.png" alt="Phase 5 — a live Brown Line train on Lake Street with the data sources open" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/p5-scan-over-live.png" alt="Phase 5 — Scan over the Live lens at dusk" width="100%"/></td>
</tr>
<tr>
<td><em>LIVE CTA: a Brown Line run on Lake Street, placed from Train Tracker (here a stand-in CHI server), and the plain-words data sources.</em></td>
<td><em>Scan (<code>V</code>) over the Live lens: dark glass and cyan floor lines, a light column over each neighbourhood — here, transit.</em></td>
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

A second way to be in Chicago (`L`, the Ride button or ⌘K): ride any L line from the front window, alongside or behind the train — through the subway tubes — with every stop announced and what's nearby named; ride eight CTA bus routes up the big avenues; walk the Riverwalk at the water, the Magnificent Mile, the Lakefront Trail, Fulton Market and Lincoln Park at eye height (every walk checked never to pass through a building); drive Lower Wacker under the street; or hang-glide over the city.

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
<td><em>The Riverwalk walk at river level at dusk: the Water Plaza, the vaults under Wacker, an L train crossing the Wells Street bridge overhead.</em></td>
<td><em>The glide: dive for speed, climb to trade it away — it banks round the towers, never through them.</em></td>
</tr>
</table>

---

## Live data

**Sports, live today.** The schedules of all seven Chicago teams come from ESPN's public site API. A copy is built with the world (`npm run schedules`), and on the live site our own cached `/api/schedule` function refreshes it — every 10 minutes, every minute around a game — so new games, reschedules, results and live scores arrive without a redeploy. Vercel's CDN caches it, so ESPN sees about one request per 10 minutes however many people visit. **The browser never calls ESPN.** Without either source the city falls back to a simulated calendar and says so; the game card and the Games panel say where the schedule came from and how old it is.

**CTA trains, alerts and weather, parked.** The plumbing is in (the LIVE CTA / SIMULATED chip, trains snapped onto the track), but the live feeds wait for the link to the CHI ATLAS API, which is parked — so the live site shows them simulated, and the chip says so.

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

The generated world (about 182 MB) is committed, so `npm run dev` works straight after install.

**Deploy.** Vercel project `chicago-open-world` (Root Directory `app`, settings in [`app/vercel.json`](app/vercel.json)): every push to `main` deploys production at **https://chicago-open-world.vercel.app**, other branches get preview URLs. Only the app is built — the committed world in `app/public/world` ships as static files; the pipeline never runs on Vercel. `?view=` / `?time=` URL parameters exist only for tests and screenshots.

## Under the hood

```
shared/project.js     one projection, used by pipeline and app
pipeline/             build-time Node — fetch → project → extrude → classify → tile → .glb
  heroes/             Blender landmarks and boats, built headless from checked-in scripts
app/                  Vite · React 19 · React Three Fiber · zustand
  api/schedule.js     the cached sports-schedule function (ESPN → Vercel CDN)
  src/world/          city tiles, land, river, Lake Michigan, lower levels, physical sky
  src/camera/         Atlas camera rig
  src/hud/            CHI ATLAS HUD — dock, search, cards, help, lenses
```

```bash
npm test                          # pipeline + app unit tests (Vitest), incl. the README image-link check
npm run e2e --prefix app          # hero-view screenshot baselines (Playwright)
```

## Data

- **City of Chicago Data Portal** — Building Footprints (`syp8-uezg`), City Boundary (`qqq8-j68g`).
- **OpenStreetMap** — building heights, `building:part` setbacks, water, parks, roads and their lower levels, rail, street trees.
  © OpenStreetMap contributors, available under the [ODbL](https://www.openstreetmap.org/copyright).
- **Cook County 2017 LiDAR** — the river and lake levels, the revetment heights.
- **ESPN public site API** — team schedules and scoreboards, at build time and through the cached `/api/schedule` (see [Live data](#live-data)).

## Roadmap

- [x] **1 · Foundation** — real footprints and heights, land, river, lake, sky, Atlas camera, HUD shell
- [x] **2 · Beauty pass** — generated façades, lit windows, living sky, rooftops, parks & trees, the L, post-processing, minimap, intro flight
- [x] **2.5 · Expanded city** — Wrigleyville → 35th St, verified top-50 skyline, 41 landmarks, stadiums, sacred buildings, civic icons, horizon fill, streaming, human-first controls
- [x] **Vision pass** — one lake & river, CTA and Metra in true colours with a restrained glow and running trains, stadium game nights & crowds, detailed bridges & landmarks with music-and-light shows, true building colours, camera clearance, ≤ 900 draw calls
- [x] **3 · Heroes** — Aqua's waves, Marina City's petals and spiral, the 900 N Michigan / CBOT / Tribune / Carbide crowns, Blender Ceres, sea horses and Lincoln Park statues, 20 P2 landmarks
- [x] **4 · Guide** — VISIT / LIVE / WORK lenses: places, tours, neighbourhood profiles, commute estimates; hover cards; Navy Pier fireworks; snow and sunny views
- [x] **5 · Alive** — live scores, weather and the LIVE / SIMULATED chip, Scan mode (live CTA trains parked, below)
- [x] **7 · Ride the city** — L train rides, CTA bus rides, street-level walks, the glide and a drive along Lower Wacker
- [x] **River, Lincoln Park and the levels** — 44 river icons and their bases at the water, sixty bridge houses and the river boats; all of Lincoln Park and its beaches; the river at −6.3 m with the Riverwalk at the water; Lower Wacker, Lower Michigan and Lower Columbus with the `U` cut-away, their traffic, portals and names, and Drive Lower Wacker; the lake at −4.65 m with its revetments and harbours of Blender boats; the United Center board and Play a game; the sound toast; beach polish and volleyball nets — and the world trimmed from 199.7 to about 182 MB with no visible change

### Parked

- **6 · The rest of the city** — streaming the further rings, deferred for later; it includes the **Lincoln Park north strip** (Montrose Harbor and Beach, the Magic Hedge, Cricket Hill, Foster and Hollywood/Osterman beaches), north of today's world edge at Irving Park.
- **VR** — a written plan; the Riverwalk and Lower Wacker rides would be the first VR rides.
- **Live CTA trains, alerts and weather via CHI ATLAS** — connect the existing LIVE CTA plumbing to the CHI ATLAS / Chicago Explorer data.
- **The game** — a separate GTA-style open-world game (and a separate guide app) built on this world, which is kept engine-neutral and reusable for it.

Design spec: [docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md](docs/superpowers/specs/2026-09-28-chi-atlas-open-world-design.md)

---

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
<td><sub>Phase 4 · Sep 30<br/>traffic, crowns, paving</sub></td>
</tr>
</table>

**The river** — from flat water at street level to the river at its real depth

<table>
<tr>
<td width="33%"><img src="docs/screenshots/evolution/phase2-river-day.png" alt="Phase 2 — the river at street level" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/evolution/hero-river-dusk-before-d1.png" alt="Before the river went down — the river hero view, flat" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/phase2-river-day.png" alt="Today — the river 6.3 m down, the Riverwalk at the water" width="100%"/></td>
</tr>
<tr>
<td><sub>Phase 2 · Sep 28<br/>water level with the street</sub></td>
<td><sub>Vision pass · Sep 30<br/>one water, still flat</sub></td>
<td><sub>River depth · Oct 1<br/>6.3 m down, the Riverwalk at the water</sub></td>
</tr>
</table>

**The Riverwalk** — the walk and the night view, before and after it went down to the water

<table>
<tr>
<td width="25%"><img src="docs/screenshots/evolution/p7-riverwalk-dusk.png" alt="Phase 7 — the Riverwalk walk at street level" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/p7-riverwalk-dusk.png" alt="Today — the Riverwalk walk at river level" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/evolution/v8-riverwalk-night.png" alt="Vision pass — the Riverwalk at night, flat" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/v8-riverwalk-night.png" alt="Today — the Riverwalk at night, lamps at the water" width="100%"/></td>
</tr>
<tr>
<td><sub>Phase 7 · Sep 30<br/>a walk at street level</sub></td>
<td><sub>River depth · Oct 1<br/>the walk at river level</sub></td>
<td><sub>Vision pass · Sep 29<br/>the flat river at night</sub></td>
<td><sub>River depth · Oct 1<br/>its lamps down at the water</sub></td>
</tr>
</table>

**The bridges** — down the river, the same pose, before and after the bascules

<table>
<tr>
<td width="25%"><img src="docs/screenshots/v6-bridges-before-day.png" alt="V6 — the river bridges as flat ribbons by day" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/v6-bridges-after-day.png" alt="V6 — the bascule bridges by day" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/v6-bridges-before-night.png" alt="V6 — the river bridges as flat ribbons at night" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/v6-bridges-after-night.png" alt="V6 — the bascule bridges at night" width="100%"/></td>
</tr>
<tr>
<td><sub>V6 · Sep 29, before (day)<br/>flat road ribbons</sub></td>
<td><sub>V6 · Sep 29, after (day)<br/>trunnion bascules, tender houses</sub></td>
<td><sub>V6 · Sep 29, before (night)<br/>flat road ribbons</sub></td>
<td><sub>V6 · Sep 29, after (night)<br/>lanterns and channel lights</sub></td>
</tr>
</table>

**River icons** — the same poses, before and after the river icons

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
<td><sub>The Civic Opera · Oct 1, after<br/>sourced crowns and materials, re-posed over the river</sub></td>
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

**The St. Regis** — the river mouth, the same pose, before and after its blow-through was closed in

<table>
<tr>
<td width="25%"><img src="docs/screenshots/evolution/v9-river-mouth-before-blowthrough-day.png" alt="The St. Regis with an open blow-through, by day" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/v9-river-mouth-day.png" alt="The St. Regis with its blow-through closed in, by day" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/evolution/v9-river-mouth-before-blowthrough-night.png" alt="The St. Regis with an open blow-through, at night" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/v9-river-mouth-night.png" alt="The St. Regis with its blow-through closed in, at night" width="100%"/></td>
</tr>
<tr>
<td><sub>The mouth · Oct 2, before (day)<br/>sky through the blow-through</sub></td>
<td><sub>The mouth · Oct 2, after (day)<br/>slabs and soffit behind a steel grille</sub></td>
<td><sub>The mouth · Oct 2, before (night)<br/>sky through the blow-through</sub></td>
<td><sub>The mouth · Oct 2, after (night)<br/>a dark inner wall and columns</sub></td>
</tr>
</table>

**Marina City and Trump at the water**

<table>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/v9-river-marinatrump-before-day.png" alt="Marina City and Trump before" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-marina-trump-day.png" alt="Marina City and Trump after" width="100%"/></td>
</tr>
<tr>
<td><sub>From above · Oct 1, before<br/>plain glass and a stub spire</sub></td>
<td><sub>From above · Oct 1, after<br/>stainless fins, the 60 m podium, the 423 m spire, AMA Plaza's module</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/v9-river-level-marina-before-day.png" alt="Marina City at the water before its base was built" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-level-marina-day.png" alt="Marina City at the water after its base was built" width="100%"/></td>
</tr>
<tr>
<td><sub>From a tour boat · Oct 1, before<br/>a bare dockwall, a stray box in the marina</sub></td>
<td><sub>From a tour boat · Oct 1, after<br/>the raised plaza on columns, restaurants, terrace and slips with their boats</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/v9-river-level-marina-before-f9-day.png" alt="Marina City's slips with box boats" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-level-marina-day.png" alt="Marina City's slips with the Blender boats" width="100%"/></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/v9-river-level-marina-before-f9-dusk.png" alt="Marina City's slips with box boats at dusk" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-level-marina-dusk.png" alt="Marina City's slips with the Blender boats at dusk" width="100%"/></td>
</tr>
<tr>
<td><sub>The slips · Oct 1, before the river boats<br/>a box hull under a box cabin</sub></td>
<td><sub>The slips · Oct 1, river boats<br/>scripted Blender boats: hulls, windscreens, rails, flybridges</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/v9-river-dusable-before-a8-day.png" alt="DuSable before the bridgehouses" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-dusable-day.png" alt="DuSable with the bridgehouses" width="100%"/></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/v9-river-dusable-before-a8-night.png" alt="DuSable at night before the bridgehouses" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v9-river-dusable-night.png" alt="DuSable at night with the bridgehouses" width="100%"/></td>
</tr>
<tr>
<td><sub>DuSable · Oct 1, before the bridge houses<br/>guessed tender houses beside OSM boxes</sub></td>
<td><sub>DuSable · Oct 1, after<br/>the four bridgehouses on their mapped corners, down to the water</sub></td>
</tr>
</table>

**Lower Wacker** — the U cut-away, the same pose: empty, then its traffic, then its names

<table>
<tr>
<td width="33%"><img src="docs/screenshots/evolution/d2-u-loop-day-before-d3.png" alt="The U cut-away by day, the lower level empty" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/evolution/before-d4-d2-u-loop-day.png" alt="The U cut-away by day with the lower level's traffic" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/d2-u-loop-day.png" alt="The U cut-away by day, the lower streets and the Riverwalk's rooms named" width="100%"/></td>
</tr>
<tr>
<td><sub>Lower levels · Oct 1<br/>the decks, empty</sub></td>
<td><sub>Lower traffic · Oct 1<br/>cars, buses and trucks down there</sub></td>
<td><sub>Portals and names · Oct 1<br/>the streets and the Riverwalk's rooms named</sub></td>
</tr>
<tr>
<td width="33%"><img src="docs/screenshots/evolution/d2-u-loop-night-before-d3.png" alt="The U cut-away at night, the lower level empty" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/evolution/before-d4-d2-u-loop-night.png" alt="The U cut-away at night, headlights under the street" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/d2-u-loop-night.png" alt="The U cut-away at night with its names" width="100%"/></td>
</tr>
<tr>
<td><sub>Lower levels · Oct 1<br/>its strip lights alone</sub></td>
<td><sub>Lower traffic · Oct 1<br/>headlights at any hour</sub></td>
<td><sub>Portals and names · Oct 1<br/>named, legible by night</sub></td>
</tr>
</table>

**Lincoln Park** — the gallery poses before and after the Lincoln Park pass, then after the lake came down to its real level and the beach polish

<table>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/before-lp-zoo-mall-day.png" alt="The zoo before the Lincoln Park pass" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-zoo-mall-day.png" alt="The zoo after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>The zoo · Oct 1, before (day)<br/>OSM boxes; the Lion House a plain pyramid roof</sub></td>
<td><sub>The zoo · Oct 1, after (day)<br/>the Lion House's tile roof, ridge monitor and arched door; every house sculpted</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/before-lp-zoo-mall-night.png" alt="The zoo at night before the Lincoln Park pass" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-zoo-mall-night.png" alt="The zoo at night after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>The zoo · Oct 1, before (night)<br/>lit like an office block</sub></td>
<td><sub>The zoo · Oct 1, after (night)<br/>closed and dark, the way it is</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/before-lp-conservatory-day.png" alt="The Conservatory before the Lincoln Park pass" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-conservatory-day.png" alt="The Conservatory after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>The Conservatory · Oct 1, before (day)<br/>a generic dome and two wings</sub></td>
<td><sub>The Conservatory · Oct 1, after (day)<br/>four glass houses: the Palm House dome, Fern Room, Orchid House, Show House</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/before-lp-conservatory-night.png" alt="The Conservatory at night before the Lincoln Park pass" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lp-conservatory-night.png" alt="The Conservatory at night after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>The Conservatory · Oct 1, before (night)<br/>a generic dome and two wings</sub></td>
<td><sub>The Conservatory · Oct 1, after (night)<br/>the glass houses dark after closing</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/p4-lily-pool.png" alt="The Lily Pool in Phase 4" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/v10-lily-pool-day.png" alt="The Lily Pool after the Lincoln Park pass" width="100%"/></td>
</tr>
<tr>
<td><sub>The Lily Pool · Sep 30<br/>the Nature Museum a plain box</sub></td>
<td><sub>The Lily Pool · Oct 1, the same view<br/>the Nature Museum and its Butterfly Haven, North Pond as water</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/p4-chess-pavilion-slab.png" alt="Phase 4 — the Chess Pavilion as a plain slab" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/evolution/today-chess-pavilion.png" alt="The cantilevered canopy, columns, chess tables and carved end walls" width="100%"/></td>
</tr>
<tr>
<td><sub>The Chess Pavilion · Sep 30<br/>a flat roof on two piers</sub></td>
<td><sub>The Chess Pavilion · Sep 30, the same view<br/>canopy, tables, carved king and knight</sub></td>
</tr>
</table>

<table>
<tr>
<td width="33%"><img src="docs/screenshots/evolution/before-lp-south-pond-day.png" alt="South Pond before the Lincoln Park pass" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/evolution/v10-lp-south-pond-day-lp-pass.png" alt="South Pond after the Lincoln Park pass" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v10-lp-south-pond-day.png" alt="South Pond with the lake at its real level" width="100%"/></td>
</tr>
<tr>
<td><sub>South Pond · Oct 1, before (day)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>South Pond · Oct 1, after (day)<br/>Café Brauer sculpted, the pond shown</sub></td>
<td><sub>South Pond · Oct 1, lake level (day)<br/>the pond perched 0.6 m under its banks</sub></td>
</tr>
<tr>
<td width="33%"><img src="docs/screenshots/evolution/before-lp-south-pond-night.png" alt="South Pond at night before the Lincoln Park pass" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/evolution/v10-lp-south-pond-night-lp-pass.png" alt="South Pond at night after the Lincoln Park pass" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v10-lp-south-pond-night.png" alt="South Pond at night with the lake at its real level" width="100%"/></td>
</tr>
<tr>
<td><sub>South Pond · Oct 1, before (night)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>South Pond · Oct 1, after (night)<br/>Café Brauer lit for an evening event</sub></td>
<td><sub>South Pond · Oct 1, lake level (night)<br/>the pond perched 0.6 m under its banks</sub></td>
</tr>
<tr>
<td width="33%"><img src="docs/screenshots/evolution/before-lp-belmont-waveland-day.png" alt="Diversey to Waveland before the Lincoln Park pass" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/evolution/v10-lp-belmont-waveland-day-lp-pass.png" alt="Diversey to Waveland after the Lincoln Park pass" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v10-lp-belmont-waveland-day.png" alt="Diversey to Waveland with the lake at its real level" width="100%"/></td>
</tr>
<tr>
<td><sub>Diversey to Waveland · Oct 1, before (day)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>Diversey to Waveland · Oct 1, after (day)<br/>every building sculpted, the water shown</sub></td>
<td><sub>Diversey to Waveland · Oct 1, lake level (day)<br/>the harbours at lake level, docks and boats</sub></td>
</tr>
<tr>
<td width="33%"><img src="docs/screenshots/evolution/before-lp-belmont-waveland-night.png" alt="Diversey to Waveland at night before the Lincoln Park pass" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/evolution/v10-lp-belmont-waveland-night-lp-pass.png" alt="Diversey to Waveland at night after the Lincoln Park pass" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/v10-lp-belmont-waveland-night.png" alt="Diversey to Waveland at night with the lake at its real level" width="100%"/></td>
</tr>
<tr>
<td><sub>Diversey to Waveland · Oct 1, before (night)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>Diversey to Waveland · Oct 1, after (night)<br/>every building sculpted, the water shown</sub></td>
<td><sub>Diversey to Waveland · Oct 1, lake level (night)<br/>the harbours at lake level, masthead lights</sub></td>
</tr>
</table>

<table>
<tr>
<td width="25%"><img src="docs/screenshots/evolution/before-lp-north-avenue-beach-day.png" alt="North Avenue Beach before the Lincoln Park pass" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/evolution/v10-lp-north-avenue-beach-day-lp-pass.png" alt="North Avenue Beach after the Lincoln Park pass" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/evolution/v10-lp-north-avenue-beach-day-d5.png" alt="North Avenue Beach with the lake at its real level" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/v10-lp-north-avenue-beach-day.png" alt="North Avenue Beach after the beach polish" width="100%"/></td>
</tr>
<tr>
<td><sub>North Avenue Beach · Oct 1, before (day)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>North Avenue Beach · Oct 1, after (day)<br/>the beach house a steamship, the water shown</sub></td>
<td><sub>North Avenue Beach · Oct 1, lake level (day)<br/>the sand slopes into the lake at its real level</sub></td>
<td><sub>North Avenue Beach · Oct 2, beach polish (day)<br/>warm tan sand, concrete walks, volleyball nets</sub></td>
</tr>
<tr>
<td width="25%"><img src="docs/screenshots/evolution/before-lp-north-avenue-beach-night.png" alt="North Avenue Beach at night before the Lincoln Park pass" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/evolution/v10-lp-north-avenue-beach-night-lp-pass.png" alt="North Avenue Beach at night after the Lincoln Park pass" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/evolution/v10-lp-north-avenue-beach-night-d5.png" alt="North Avenue Beach at night with the lake at its real level" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/v10-lp-north-avenue-beach-night.png" alt="North Avenue Beach at night after the beach polish" width="100%"/></td>
</tr>
<tr>
<td><sub>North Avenue Beach · Oct 1, before (night)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>North Avenue Beach · Oct 1, after (night)<br/>portholes glowing along the hull</sub></td>
<td><sub>North Avenue Beach · Oct 1, lake level (night)<br/>the sand slopes into the lake at its real level</sub></td>
<td><sub>North Avenue Beach · Oct 2, beach polish (night)<br/>warm tan sand, concrete walks, volleyball nets</sub></td>
</tr>
<tr>
<td width="25%"><img src="docs/screenshots/evolution/before-lp-theater-on-the-lake-day.png" alt="Fullerton before the Lincoln Park pass" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/evolution/v10-lp-theater-on-the-lake-day-lp-pass.png" alt="Fullerton after the Lincoln Park pass" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/evolution/v10-lp-theater-on-the-lake-day-d5.png" alt="Fullerton with the lake at its real level" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/v10-lp-theater-on-the-lake-day.png" alt="Fullerton after the beach polish" width="100%"/></td>
</tr>
<tr>
<td><sub>Fullerton · Oct 1, before (day)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>Fullerton · Oct 1, after (day)<br/>Theater on the Lake sculpted, the water shown</sub></td>
<td><sub>Fullerton · Oct 1, lake level (day)<br/>the stepped limestone revetment down to the lake</sub></td>
<td><sub>Fullerton · Oct 2, beach polish (day)<br/>Fullerton Beach in warm tan sand</sub></td>
</tr>
<tr>
<td width="25%"><img src="docs/screenshots/evolution/before-lp-theater-on-the-lake-night.png" alt="Fullerton at night before the Lincoln Park pass" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/evolution/v10-lp-theater-on-the-lake-night-lp-pass.png" alt="Fullerton at night after the Lincoln Park pass" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/evolution/v10-lp-theater-on-the-lake-night-d5.png" alt="Fullerton at night with the lake at its real level" width="100%"/></td>
<td width="25%"><img src="docs/screenshots/v10-lp-theater-on-the-lake-night.png" alt="Fullerton at night after the beach polish" width="100%"/></td>
</tr>
<tr>
<td><sub>Fullerton · Oct 1, before (night)<br/>OSM boxes; the water under the grass</sub></td>
<td><sub>Fullerton · Oct 1, after (night)<br/>every building sculpted, the water shown</sub></td>
<td><sub>Fullerton · Oct 1, lake level (night)<br/>the stepped limestone revetment down to the lake</sub></td>
<td><sub>Fullerton · Oct 2, beach polish (night)<br/>Fullerton Beach in warm tan sand</sub></td>
</tr>
</table>

**The lakefront beaches** — the same poses, before and after the beach polish

<table>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/d5-ohio-beach-day-d5.png" alt="Ohio Street Beach before the beach polish" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d5-ohio-beach-day.png" alt="Ohio Street Beach after the beach polish" width="100%"/></td>
</tr>
<tr>
<td><sub>Ohio Street Beach · Oct 1, lake level (day)<br/>pale, almost white sand</sub></td>
<td><sub>Ohio Street Beach · Oct 2, beach polish (day)<br/>warm tan sand</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/evolution/d5-northave-beach-dusk-d5.png" alt="North Avenue Beach at dusk before the beach polish" width="100%"/></td>
<td width="50%"><img src="docs/screenshots/d5-northave-beach-dusk.png" alt="North Avenue Beach at dusk after the beach polish" width="100%"/></td>
</tr>
<tr>
<td><sub>North Avenue Beach · Oct 1, lake level (dusk)<br/>grey trail spurs across the sand like roads</sub></td>
<td><sub>North Avenue Beach · Oct 2, beach polish (dusk)<br/>tan sand, the volleyball nets</sub></td>
</tr>
</table>

**The lake**

<table>
<tr>
<td width="16%"><img src="docs/screenshots/phase1-museum-day.png" alt="Phase 1 — the lake behind Museum Campus" width="100%"/></td>
<td width="16%"><img src="docs/screenshots/v1-harbor-dusk.png" alt="V1 — harbour and lake as one water" width="100%"/></td>
<td width="16%"><img src="docs/screenshots/v1-lake-horizon-day.png" alt="V1 — the lake to the horizon" width="100%"/></td>
<td width="16%"><img src="docs/screenshots/p4-snow-christmas-dusk.png" alt="Phase 4 — the frozen shore" width="100%"/></td>
<td width="16%"><img src="docs/screenshots/p4-fireworks-finale-night.png" alt="Phase 4 — fireworks on the water" width="100%"/></td>
<td width="16%"><img src="docs/screenshots/d5-monroe-harbor-day.png" alt="The lake at its real level, Monroe Harbor full of boats" width="100%"/></td>
</tr>
<tr>
<td><sub>Phase 1 · Sep 28<br/>a flat plane</sub></td>
<td><sub>V1 · Sep 29<br/>one body of water</sub></td>
<td><sub>V1 · Sep 29<br/>no edge to the lake</sub></td>
<td><sub>Phase 4 · Sep 30<br/>ice along the shore</sub></td>
<td><sub>Phase 4 · Sep 30<br/>fireworks reflected</sub></td>
<td><sub>Lake level · Oct 1<br/>4.65 m down, the harbours full</sub></td>
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

**United Center**

<table>
<tr>
<td width="33%"><img src="docs/screenshots/evolution/v5-united-center-night.png" alt="V5 — United Center game night, the plaza crowd" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/sports-united-center-plaza-night.png" alt="Sports pass — the same pose, the Bulls ribbon round the parapet" width="100%"/></td>
<td width="33%"><img src="docs/screenshots/sports-united-center-night.png" alt="Sports pass — the Bulls board on the roof" width="100%"/></td>
</tr>
<tr>
<td><sub>V5 · Sep 29<br/>lit fascia, a plain roof</sub></td>
<td><sub>Sports · Oct 1, the same pose<br/>the ribbon round the parapet</sub></td>
<td><sub>Sports · Oct 1<br/>the Bulls board on the roof</sub></td>
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

**The city at night**

<table>
<tr>
<td width="20%"><img src="docs/screenshots/v1-river-night.png" alt="V1 — the river at night" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/v3-transit-loop-night.png" alt="V3 — the L glowing in the Loop" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/v8-loop-night.png" alt="Vision pass — the Loop at night" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/p4-carbide-carbon-night.png" alt="Phase 4 — Carbide &amp; Carbon's floodlit crown" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/v8-riverwalk-night.png" alt="The Riverwalk at night" width="100%"/></td>
</tr>
<tr>
<td><sub>V1 · Sep 29<br/>windows on the water</sub></td>
<td><sub>V3 · Sep 29<br/>the L in its colours</sub></td>
<td><sub>Vision pass · Sep 29<br/>lit crowns, trains</sub></td>
<td><sub>Phase 4 · Sep 30<br/>floodlit gold leaf</sub></td>
<td><sub>River depth · Oct 1<br/>the river at its real depth</sub></td>
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
<tr>
<td width="20%"><img src="docs/screenshots/evolution/v2-westloop-day.png" alt="V2 — the West Loop before the transit legend" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/v2-westloop-day.png" alt="V3 — the same West Loop pose with the transit legend" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/evolution/p7-l-cab-day-bar.png" alt="Phase 7 — the ride bar with the ride named by its two end stations" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/p7-l-cab-day.png" alt="Today — the ride named 'around the Loop', its keys as keycaps" width="100%"/></td>
<td width="20%"><img src="docs/screenshots/c-sound-on.png" alt="The sound toast — a green speaker in the middle of the screen" width="100%"/></td>
</tr>
<tr>
<td><sub>V2 · Sep 29, West Loop<br/>no transit legend yet</sub></td>
<td><sub>V3 · Sep 29, the same pose<br/>the line legend on the left</sub></td>
<td><sub>Phase 7 · Sep 30, the ride bar<br/>"Addison → the Loop", keys only in the panel</sub></td>
<td><sub>Phase 7 · Oct 1, the same pose<br/>"around the Loop", every key a keycap</sub></td>
<td><sub>Sound toast · Oct 1<br/><code>M</code> shows on or off for a second</sub></td>
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
<td><sub>Phase 5 · Sep 30, the same pose<br/>the cloud hides the sun and its glare</sub></td>
</tr>
</table>

---

<div align="center">

**MIT** © 2026 [Connor Evans](https://github.com/AllStreets)

<sub>Four stars on the flag. Every building on the map.</sub>

</div>
