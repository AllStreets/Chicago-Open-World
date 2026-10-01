# River icons, all of Lincoln Park, the M sound toast, and the river at its real depth — to-do

> **Status: PLAN ONLY. Nothing here gets built until the user says "go ahead".** Written 2026-09-30 against `main` @ `b9f7935`
> (Chess Pavilion sculpt merged). Nothing in `app/`, `pipeline/` or `public/world` was changed while writing it.
> Every to-do has a checkbox and a "done when …" so a worktree subagent can pick it up and prove it finished.
>
> **Revised 2026-10-01 (plan only, still no code):** the user answered all eight open questions (now **§8 Decisions**, each
> pushed into the to-dos it affects), and asked for a sports pass: **Workstream E** (§5B: schedules that refresh on
> the live site, a Bulls-colours board on the United Center, a "Play a game" showcase for the three open-air
> stadiums, and copy that explains live games) plus **C-fix** (§5.3: pressing M while following a train must not stop
> the follow). §6.5 batching and a closing **audit** table (§9) cover both of the user's messages.

---

## 0. Summary and how I read the request

The user asked for four things and one parked idea:

| # | Request (user's words, shortened) | How I read it | Workstream |
|---|---|---|---|
| 1 | "all of the major buildings along the river that are iconic and well-known … receive the same level of attention … as the Wrigley Tower and Tribune Tower" | Bring every postcard building on the Chicago River (main stem, North Branch and South Branch, inside the world bounds) up to the **hero standard** in §1 | **A** |
| 2 | "as well as all of Lincoln Park" | Every building, monument, harbour and landscape feature *in* Lincoln Park (the park, not the neighbourhood) inside the world bounds, to the same standard | **B** |
| 3 | "a green volume on icon with no background … in the middle of the screen when I press M to turn sound on and a red volume off with … the triangle and the slash … stay on the screen for … one second … fades out over 1 1/2 seconds" ("fat and fades" = "fades") | A centred, plate-free speaker glyph: green speaker + waves for ON, red speaker with a slash for OFF; holds 1.0 s at full opacity, then fades out over 1.5 s | **C** |
| 4 | "do the riverwalk lower level if it won't ruin the rest of the build … also raise up the lower level and double level streets … accurate … because of water, traffic, street levels, buildings" | Put the river and the Riverwalk at their real depth below the street, and model the multi-level streets (Lower and Lower Lower Wacker, Lower Michigan, Lower Columbus, Lower Randolph/Lake/South Water/Stetson, Lower Illinois/Hubbard/Grand, Field Blvd) under the street grid at real clearances, with their own traffic. The street grid ends up **above** the lower levels and the water the way it is in Chicago. Ship it in stages behind a flag, with a fallback | **D** |
| 5 | "save the idea of live CTA trains for later and link it to … CHI ATLAS or Chicago Explorer … bring it up again like you did with phase 6 and the VR idea" | Write it down under **Parked** next to Phase 6 and VR, and bring it up again at the end of this pass | §7 |
| 6 | (2026-10-01) "make sure this isn't hard coded in and changes/updates regularly" (the Soldier Field board reading "NEXT NYJ · SUN OCT 4 12:00 PM") | The board text is computed, but its data is a schedule file fetched from ESPN only when the world is built, so the live site goes stale. Make schedules, next games and results refresh on the deployed site by themselves | **E1, E2** |
| 7 | "in bulls colors the same should be displayed in a visually attractive way over the bulls arena/united center" | A Bulls-red/black board on the United Center (which has no board today) showing the same next/live/final info | **E3** |
| 8 | "something to click maybe in the card for the stadiums (the three open air ones …) that I can make the corresponding sport's scene play out just quick enough to showcase the feature well like the fireworks but still have the live game feature … for when games are actively happening" | A "Play a game" button (plus ⌘K, key and help) for Wrigley, Rate Field and Soldier Field that plays a short accelerated game, started and stopped like the fireworks, and never overrides a real live game | **E4, E5** |
| 9 | "when I press M to switch the sound on/off while following a train it makes me stop following it. fix that when you fix the sign showing that sound has turned on/off" | Bug: every non-modifier key ends a follow. Whitelist M and the other feature toggles; ship it with the sound toast | **C-fix** |

**Ambiguities, each with the resolution I recommend.** *(Resolved by the user on 2026-10-01; see §8 Decisions. Items 3 and 5 below changed as a result: the north strip is parked for Phase 6, and the glyph has **no** drop shadow.)*

1. **What does "raise up" mean?** Keep the street grid where it is (y = 0, the datum every building, road, train, pin and camera pose already uses) and **lower the water** to its real depth. Then put the lower decks between the street and the water. Relative to the water and the lower levels, the street ends up raised. In absolute terms nothing above ground moves. The alternative is lifting the whole city about 6 m: that touches every tile, traffic lane, transit height constant, pose and baseline, and I recommend against it (see §4.3).
2. **Does the lake drop too?** The river and Lake Michigan are almost the same water. The Chicago Harbor Lock moves boats only about 0.3–1.7 m. I recommend a river level and a slightly higher lake level, separated by the lock (§4.3, Option A). The user decided: Option A (Decision 4).
3. **What counts as "all of Lincoln Park"?** The park runs from North Avenue to Ardmore (5800 N). The modelled world stops at about Irving Park Road (`WORLD_BOUNDS.minZ = −7850` ≈ 41.9527° N; manifest `bbox.n = 41.952`). Everything from North Avenue Beach to the Waveland Clock Tower, Belmont Harbor, the golf course and the Kwanusila totem pole is in bounds. Montrose Harbor and Beach, the Magic Hedge, Cricket Hill, Wilson, Foster and Hollywood/Osterman beaches are **not**. I recommend doing everything in bounds now and offering a narrow "Lincoln Park north strip" extension as a separate ask, since Phase 6 (the rest of the city) is deferred. **Decided: left for Phase 6 (Decision 3).**
4. **Which paths show the sound toast?** Every path that switches sound: the M key, the ⌘K "Sound" command and any future Sound button. The toast confirms the *state change*, and people need that confirmation most when they didn't press M (they used ⌘K). It does **not** show on page load.
5. **"No background."** No plate, panel or blur. I recommend one soft drop-shadow on the glyph only (`filter: drop-shadow(…)`) so it stays readable over a white sky or snow. It is a shadow, not a background. **Superseded: the user chose no shadow at all (Decision 6).**

---

## 1. The "hero standard" (the bar the Tribune and Wrigley set)

Taken from how the Tribune, Wrigley, Carbide & Carbon, Willis, the Water Tower and the Chess Pavilion were done: commits `7273e85`, `70c9d2b`, `e515713` and `26b847c`. The pipeline is `pipeline/data/heroes.json` → `pipeline/lib/heroes.js#applyHero` → sculpt functions in `pipeline/lib/icons.js` and `lincolnpark.js`, with colour rows in `pipeline/data/styles.json`, method rules in `heroMethod.js` and `data/hero-methods.json`, and an optional Blender export via `blenderMesh.js` / `swapModel.js`.

A building meets the hero standard when **all twelve** hold:

| # | Criterion | Concretely |
|---|---|---|
| H1 | **Identity** | A `heroes.json` entry with `key`, `name`, `aliases`, `match.osmId` (or `waterOsmId` / `parkOsmId`), and `source`/`sources` URLs. A card entry (`landmarkRuntime` TYPE_WORD, or `app/src/data/landmarks.js` with `heroKey`). ⌘K finds every alias (`searchCoverage.test.js`) |
| H2 | **Massing** | Height within ±2 % of a sourced figure (CTBUH / Wikipedia / `skyline.json`). Every setback and tier at its sourced height (`bodyTopM`, `tiers`, OSM `building:part`). Footprint from OSM/City footprints, corrected in the spec where OSM is wrong |
| H3 | **Signature sculpt** | The 3–6 features a person recognises from the street (crown, clock, cupola, entrance arch, pier ribs, spire, lantern, skybridges), built as a `sculpt` + `sculptParams` (procedural in `icons.js` or a new module), or in Blender when `chooseMethod` says figurative or more than 40 k triangles |
| H4 | **Façade articulation** | The right façade family (limestone piers, terra cotta, curtain glass with tint bucket, precast) and the right rhythm (pier spacing like the Mart's `pierEvery: 6.1`). Glass, mullion and spandrel each get their own colour |
| H5 | **Material and colour** | A `look` row with a sourced material sentence, `base`/`top`/`topFromM` colours tuned for the bloom (the Wrigley "a step below pure white" lesson), and `note` wherever the colour is read from photographs |
| H6 | **Night** | Real lighting only: a `crownLight` flood band (`fromM`/`toM`/colour/intensity, sourced) and lit features such as clock faces. Nothing lit that isn't lit in life |
| H7 | **Ground contact** | Sits on true grade. For river buildings after D1, the base runs down to the river level and the real riverfront (terraces, esplanades, marina, colonnade) is modelled. No tree inside it, nothing on a track |
| H8 | **LOD** | Fine detail is LOD0-only (`lod0Only`). LOD1 and blocks keep the silhouette and crown. Per-hero cost: ≤ 15 k triangles typical, ≤ 40 k hard limit (`METHOD_TRI_LIMIT`), ≤ 80 KB compressed added to its tile |
| H9 | **Perf** | No new draw calls (merged into the tile `buildings` layer). The perf spec stays ≥ 58 fps at the gallery pose that frames it |
| H10 | **Tests** | A pipeline unit test in the `icons.test.js` / `lincolnpark.test.js` style: parts within the footprint or roof (the 900 N Michigan "floating pavilion" lesson), heights, counts, triangle ceiling. Plus `heroes-data.test.js` (sources present) and app `landmarks.test.js` |
| H11 | **Sources** | Every number has a source in the data. Approximations are marked "approximate" or "read from photographs" |
| H12 | **README** | A day shot and a night (or dusk) shot at a fixed gallery pose (`galleryShots.js`), with a caption. The previous frame moves to `docs/screenshots/evolution/`, and the Evolution table gets a row (README cohesion rule) |

Size key: **S** ≈ ≤ 2 h (look row, crown primitive, colour), **M** ≈ half a day (a sculpt function with 3–5 features), **L** ≈ a day or more (a complex sculpt, a river-level base, night features, or Blender).

---

## 2. Workstream A — river icons

**Scope:** buildings whose river face or riverfront is part of the river view, from the Chicago Harbor Lock (mouth) to the bounds. That covers the main stem, the North Branch to about North Avenue / Goose Island, and the South Branch to about Cermak / Ping Tom Park. Status was read from `heroes.json` (81 heroes), the OSM caches in `pipeline/cache/world/osm-allbuildings-*.json` and `bridges.json`.
**State legend:** **SCULPT** = hero with a sculpt; **LOOK** = hero with a colour/crown row but no sculpt; **LMK** = landmark-type hero (civic.js / landmarks.js); **OSM** = plain OSM extrusion (OSM height and parts, generic façade family, maybe `building:colour`); **BRIDGE** = `bridges.json`.

### 2.1 Inventory

| # | Building (river position) | State | Gap vs hero standard | Real features to model | Sources | Size |
|---|---|---|---|---|---|---|
| A1 | **Wrigley Building** (N bank, Michigan) | SCULPT | Reference. Only the river-level/Riverwalk plaza after D1 | Wrigley Plaza steps down to the river | WP, AIA/architecture.org | S |
| A2 | **Tribune Tower** (N of river, Michigan) | SCULPT | Reference. None beyond context | — | WP, SAH Archipedia | — |
| A3 | **Trump International Hotel & Tower** (N bank, Wabash) | LOOK (`spireCounts`) | No sculpt. Setbacks must align with the Wrigley cornice, River Plaza and IBM (the three real setbacks); spire proportion; riverfront terraces | 3 setbacks at real heights (≈ 6/16/29th fl. tiers), stainless fins, 2-level Riverwalk terraces and steps to the river (D1), the stainless spire | CTBUH case study (already cited), WP | L |
| A4 | **Marina City 1 & 2** (N bank, State–Dearborn) | SCULPT (petals, spiral parking) | River level: the marina slips under the towers, the Hotel Chicago / House of Blues "saddle" theatre building, the plaza deck | Boat-slip level at the river (D1), saddle-roof theatre (Bertrand Goldberg), plaza slab, the 19-storey parking spiral already built | WP, architecture.org | M |
| A5 | **330 N Wabash (AMA Plaza, ex-IBM)** (N bank) | OSM | Not a hero. Needs Mies's bronze-tinted black aluminium I-beam mullions and the travertine plaza | 52 fl. black aluminium curtain wall, recessed glass ground floor, plaza to the river | WP, Mies Society | M |
| A6 | **333 W Wacker** (S bank at the bend) | OSM (`116017092`, 148 m) | Not a hero. The curved green-glass river façade *is* the icon | Curved façade following the bend, green-silver reflective glass with banding, granite/marble base, faceted Lake-St façade | WP, KPF | M |
| A7 | **Merchandise Mart** (N bank, Wells–Orleans) | LMK `martRiverFace` (piers 6.1 m) | No corner towers or crown pavilions; no **Art on theMART** projection; river-level dockwall | Corner towers and central tower, setback crown, limestone piers. **Art on theMART** night projection on the river façade (Apr–Dec, sourced schedule, like the fountain schedule). River face down to the water | WP, artonthemart.com | L |
| A8 | **110 N Wacker** (S Branch, E bank) | LOOK | No fins and no canted river face. Real: glass fins, prow-like ends, stainless | Vertical glass fins, sloped "boat" top and bottom ends, the cantilevered plaza over Lower Wacker, Riverwalk frontage (D1) | Pohl facades, WP | M |
| A9 | **150 N Riverside** (S Branch, W bank) | OSM (`330879260`, 229 m) | Not a hero. The icon is the narrow core base under a full-width tower | Inverted massing (narrow concrete core 8 storeys, then full floorplate), sloped transition, river esplanade (D1) | WP, Goettsch Partners | L |
| A10 | **River Point (444 W Lake)** (W bank at the confluence) | OSM (`330309437`, 222 m) | Not a hero | Curved east façade, arched trusses spanning the rail tracks at the base, 1.5-acre riverfront park (D1) | WP, Pickard Chilton | L |
| A11 | **Wolf Point East / West / South** (Wolf Point) | OSM (East `509957160`, West `330745077`; South: verify OSM way) | Not heroes | Pelli Clarke Pelli towers with distinctive tops; Wolf Point's riverwalk and lawn (D1) | WP | M |
| A12 | **Boeing HQ (100 N Riverside)** (S Branch, W bank) | OSM (`124434705`) | Not a hero | The building straddles the Metra tracks: exposed steel trusses, glass-and-steel, river plaza | WP | M |
| A13 | **Riverside Plaza / Chicago Daily News Building (2 N Riverside)** | OSM (`149215037`) | Not a hero | 1929 Art Deco limestone, river-level plaza and fountain, the long horizontal river façade | WP, Chicago Landmarks | M |
| A14 | **Civic Opera House (20 N Wacker)** (S Branch, E bank) | OSM (`124865443`) | Not a hero. The "armchair" massing and the Wacker colonnade | 45-storey tower between two 22-storey wings, the Wacker Drive colonnade, river (W) façade (D1) | WP, Lyric Opera | L |
| A15 | **Chicago Union Station** (Canal) | LMK `headhouse` | Gap: Great Hall skylight barrel vault, Corinthian colonnade on Canal St, river side | Headhouse with 7-storey office block, Great Hall vault, Canal colonnade | WP, Amtrak | M |
| A16 | **Old Main Post Office** (S Branch, spans Congress/Eisenhower) | OSM (`24989834`, 65.5 m) | Not a hero. The icon is the expressway running through it | Art Deco limestone, Eisenhower portal through the base, roof terrace | WP, 601W | L |
| A17 | **River City** (S Branch, W bank) | OSM relation `20355402` | Not a hero | Goldberg's serpentine curved 10–17 storey "street", river marina | WP | M |
| A18 | **35 E Wacker (Jewelers Building)** (S bank) | OSM (`124865488`, 160.65 m) | Not a hero | Terra-cotta tower with the domed cupola crown and four corner tempietti, once an auto-lift garage | WP | M |
| A19 | **333 N Michigan** (S bank, Michigan) | OSM (`144710192`, 121 m) | Not a hero | Art Deco limestone, setback tower, carved frieze over the base | WP | M |
| A20 | **London Guarantee / LondonHouse (360 N Michigan)** (S bank) | OSM (`147399567`) | Not a hero | Curved corner façade to the river, Corinthian colonnade, the domed tholos cupola (lit) | WP | M |
| A21 | **Carbide & Carbon** (Michigan, one block S) | SCULPT | Reference. Check river view only | — | — | — |
| A22 | **Mather Tower (75 E Wacker)** (S bank) | OSM, **unnamed in OSM** (look up the way id) | Not a hero. The slim octagonal terra-cotta tower top | Narrow terra-cotta shaft, octagonal setback tower, lantern spire, lit at night | WP | M |
| A23 | **Leo Burnett Building (35 W Wacker)** (S bank) | OSM (`64390087`) | Not a hero | Granite-clad gridded tower, columned crown | WP | S |
| A24 | **300 N LaSalle** (N bank) | OSM (`1274706595`, 239 m on skyline) | Not a hero | Glass tower with the stepped top, river plaza (D1) | WP | M |
| A25 | **Reid Murdoch Center** (N bank, LaSalle–Clark) | OSM (`117996137`) | Not a hero | 1914 brick Prairie-school warehouse, the clock tower over the river | WP, Chicago Landmarks | M |
| A26 | **St. Regis Chicago (Vista Tower)** (S bank, E end) | LOOK | No frustum sculpt | Three stacked frustums with notch gaps, the "blow-through" floor gap, graduated blue-green glass | WP, Studio Gang | M |
| A27 | **NBC Tower** (N bank, Columbus) | OSM (`153567403`, 151.5 m) | Not a hero | Limestone Art-Deco revival setbacks and the spire | WP | M |
| A28 | **Sheraton Grand Chicago Riverwalk** (N bank, Columbus) | OSM (`188171430`) | Not a hero | Red-brown granite slab with the river terrace | WP | S |
| A29 | **Hyatt Regency Chicago** (S bank, Stetson) | OSM (`235920251`) | Not a hero | Twin towers, river skybridge glass atrium | WP | S |
| A30 | **Swissôtel Chicago** (S bank, Columbus) | OSM (`95486966`, 139 m) | Not a hero | Triangular prism, silver reflective glass | WP | S |
| A31 | **Equitable Building (401 N Michigan) + Pioneer Court** (N bank) | OSM (`127107027`) | Not a hero | 1965 SOM aluminium-clad tower, Pioneer Court plaza | WP | S |
| A32 | **Apple Michigan Avenue** (N bank at Pioneer Court) | OSM (`685480593`) | Not a hero. A Foster icon that steps down to the river | Thin carbon-fibre roof, glass walls, the wide steps to the Riverwalk (needs D1) | Foster + Partners, WP | M |
| A33 | **Seventeenth Church of Christ, Scientist (55 E Wacker)** (S bank) | OSM (`144846554`) | Not a hero | Curved travertine semicircle, lantern | WP | S |
| A34 | **Hotel 71 / 77 W Wacker / 225 W Wacker / Builders Bldg / LaSalle-Wacker** (S bank, Wacker wall) | OSM (77 W `64391028`; 225 W `64391366`; Builders `124865436`; LaSalle-Wacker `124873924`) | Not heroes. Together they make the Wacker street wall | 77 W: Bofill temple pediment. 225 W: four lantern spires. Builders: terra-cotta cornice. LaSalle-Wacker: Holabird & Root limestone H-plan | WP | M (all five) |
| A35 | **Salt Shed (Morton Salt)** (N Branch, Elston) | OSM (`210307434`, industrial) | Not a hero | Gable-roof shed with the "MORTON SALT" roof sign, lit at night | WP | M |
| A36 | **Montgomery Ward Catalog House** (N Branch, Chicago Ave) | Verify OSM way (the "Memorial Building" `158621257` is a different building) | Not a hero | 1908 reinforced-concrete warehouse, ~1/4 mile along the river | WP, Chicago Landmarks | M |
| A37 | **Chicago Harbor Lock + Lock House** (mouth) | OSM (`237535869`) | Not modelled as a lock | Lock walls and gates, control house. The boundary between lake and river level (D5) | WP, USACE | M |
| A38 | **Centennial Fountain** (N bank, McClurg Ct) | Not modelled | — | Stepped fountain and the arc of water shot across the river (summer, 10 minutes each hour, sourced) | WP, MWRD | M |
| A39 | **Bridge houses** (32 bascules) | BRIDGE (houses with styles; DuSable reliefs done) | Generic houses. The McCormick Bridgehouse Museum, the Outer Drive "moderne" houses, the Franklin beaux-arts houses | Per-style bridge-house detail. Bascule piers and abutments down to the water (D1). Lower decks of the double-deck bridges at the real lower-street level (D2) | chicagoloopbridges.com, WP | M |
| A40 | **Railroad bridges** (Kinzie St RR bascule permanently up; Canal St vertical lift; St. Charles Air Line) | `skipWays` / verify | Probably missing or generic | Kinzie: raised leaf frozen in place. Canal St: two lift towers. St. Charles Air Line: Strauss bascule with its counterweight | WP, HistoricBridges.org | M |
| A41 | **Vietnam Veterans Memorial, Heald Square monument, Wacker lamp standards and balustrade** | Not modelled | — | Riverwalk memorial (D1). Washington-Morris-Salomon statue (Wacker & Wabash). Bennett's Wacker Drive obelisk pylons and balustrade along the river edge | WP, City of Chicago | M |
| A42 | **Ping Tom Park boathouse** (S Branch, Chinatown) | Park exists (`Ping Tom Memorial Park` p2) | Boathouse not built | Studio Gang boathouse with zig-zag roofs | WP, Studio Gang | S |
| A43 | **Willis Tower** (Wacker, 1 block from the river) | SCULPT | Reference | — | — | — |

**Totals:** 43 rows (4 references, 39 to build or upgrade; A34 bundles 5 buildings, so **43 buildings/structures** to touch).

### 2.2 To-dos (ordered; items marked †D1 wait for the river to drop)

**Decision 1 (2026-10-01): all 43 rows are in scope; Tier 1 and Tier 2 ship first.** Order: A-3 → A-4 → A-6 (Tiers 1–2), then A-7 (Tier 3), with A-8/A-9/A-12 after D1. No row is dropped. The A-12 README pass waits until Tier 3 is in.

- [ ] **A-0 Gallery poses.** Add 8 river gallery poses to `app/src/lib/galleryShots.js`: mouth, DuSable, Marina/Trump, Clark–LaSalle, the bend at Wolf Point, South Branch at the Opera, Old Post Office, North Branch Salt Shed. **Done when** `gallery.spec.js` captures all 8 day and night, and "before" frames are saved to `docs/screenshots/evolution/`.
- [ ] **A-1 Look up ids.** Find OSM way ids for Mather Tower, Wolf Point South, the Montgomery Ward Catalog House and the Kinzie/Canal/St. Charles rail bridges. Add them as `match` in new hero rows. **Done when** `heroes-data.test.js` passes with every A-row matched to exactly one building in the build log.
- [ ] **A-2 New module.** Create `pipeline/lib/rivericons.js` (so A never edits the same functions as Lincoln Park or `icons.js`'s existing heroes) with the sculpt dispatch added to `applyHero` behind `spec.sculpt` names. **Done when** an empty `rivericons.test.js` runs and `applyHero` routes an unknown sculpt to a no-op.
- [ ] **A-3 Tier 1 crowns/massing (no water dependency):** Trump setbacks and spire (A3), St. Regis frustums (A26), 333 W Wacker curve and glass (A6), 330 N Wabash mullions (A5), 35 E Wacker cupola (A18), London Guarantee tholos (A20), Mather lantern (A22), Reid Murdoch clock (A25). **Done when** each has H1–H6, H8–H11 green: unit test per sculpt (inside footprint, heights ±2 %, triangles ≤ 15 k) and colours sourced.
- [ ] **A-4 Tier 1 heavy:** Merchandise Mart towers and crown (A7), Civic Opera armchair and colonnade (A14), Old Post Office with the Eisenhower portal (A16), 150 N Riverside inverted base (A9), River Point trusses (A10). **Done when** the same per-sculpt tests pass and each is ≤ 40 k triangles.
- [ ] **A-5 Art on theMART.** Night projection on the Mart's river façade from a sourced schedule (`pipeline/data/schedules.json` style; dusk to 10 pm Apr–Dec, read from artonthemart.com), on the `led` façade id with a slow cross-fade, and an ⌘K "Art on theMART" entry that flies there. **Done when** a unit test proves on/off from the schedule, ⌘K finds it, and a README night shot shows it.
- [ ] **A-6 Tier 2:** 110 N Wacker fins (A8), Wolf Point towers (A11), Boeing trusses (A12), Riverside Plaza (A13), Union Station vault and colonnade (A15), River City (A17), 333 N Michigan (A19), 300 N LaSalle (A24), NBC Tower (A27), Salt Shed and sign (A35), Montgomery Ward (A36). **Done when** each passes H1–H11.
- [ ] **A-7 Tier 3 (look rows plus small sculpts):** Leo Burnett, Sheraton, Hyatt, Swissôtel, Equitable, 17th Church, the Wacker five (A23, A28–A31, A33, A34). **Done when** each has a sourced look row and a crown where the real building has one, and the gallery shot shows no generic façade on the main-stem south bank between Michigan and Lake.
- [ ] **A-8 †D1 River-level bases** for A1, A3, A4, A7, A9, A10, A11, A13, A14, A17, A24, A32: walls down to the water, plus each building's real riverfront (terraces, esplanade, marina slips, Opera's river face, Apple's steps). **Done when** no river-front building shows a gap between its wall and the dockwall (unit test: footprint edges within 3 m of the river polygon have `base = RIVER_Y`), and the river gallery poses show the terraces.
- [ ] **A-9 Bridges.** Per-style bridge houses, the McCormick Bridgehouse Museum (DuSable SW house), bascule piers and abutments to the water (†D1), and the lower decks of the double-deck bridges at `LOWER_Y` (†D2). **Done when** `bridgeParts.test.js` covers the four house styles and pier depth, and the bridge lift still runs in e2e (`hero-view` bridges pose).
- [ ] **A-10 Rail bridges** (A40): the raised Kinzie leaf, the Canal St lift towers, the St. Charles Air Line. **Done when** they are in `bridges.json` with sources, are not liftable by B (except per reality), and the build log lists them.
- [ ] **A-11 Small river icons** (A37 lock, A38 Centennial Fountain with its sourced hourly arc and a ⌘K entry, A41 memorials and the Wacker balustrade †D1, A42 boathouse). **Done when** each has a card and ⌘K entry and the fountain arc unit test passes against its schedule.
- [ ] **A-12 README.** A "River icons" gallery section (12 frames, day and dusk) and Evolution rows ("Down the river, the same pose" and "Marina City and Trump at the water"), with the old frames moved to `docs/screenshots/evolution/`. **Done when** README links resolve and `docs/screenshots` has no orphan images.

---

## 3. Workstream B — all of Lincoln Park (in bounds: North Avenue → Irving Park Rd)

### 3.1 Inventory (south → north)

| # | Site | State | Gap | Real features | Sources | Size |
|---|---|---|---|---|---|---|
| B1 | **North Avenue Beach House** | LMK `beachHouse` (ship), p2 | Check against photos: the steamship profile, portholes, the twin "smokestacks", the rooftop Castaways deck | Ship hull in blue and white, two stacks, portholes, top-deck bar | WP, CPD | M |
| B2 | **North Avenue "Passerelle" pedestrian bridge** over LSD (2014) | Not modelled (OSM viewpoint node only) | — | Curved steel arch bridge | CDOT | S |
| B3 | **Chicago History Museum** (1601 N Clark) | OSM (`23987046`, plain) | Not a hero | 1932 Georgian brick with a cupola and the 1988 glass addition on Clark | WP, CHM | M |
| B4 | **Couch Tomb** | SCULPT (`e515713`) | Reference. Review only | — | — | — |
| B5 | **Standing Lincoln** (Saint-Gaudens) | Statue p2 | Check: the Stanford White exedra (granite bench) behind it | Bronze figure plus the exedra | WP | S |
| B6 | **Lincoln Park Zoo campus**: Kovler Lion House (1912) | LMK `lionHouse` (pyramid roof only) | No brick detail. The real roof is not a pyramid | Arts & Crafts brick, arched windows, tile roof, terracotta lions | WP, LPZ | M |
| B7 | Zoo: Helen Brach Primate House (1927) | OSM (`210686220`) | Not a hero | Georgian brick, columned entrance | LPZ | S |
| B8 | Zoo: McCormick Bird House (1904) | OSM (`24826074`) | Not a hero | Perkins brick with arched windows | LPZ | S |
| B9 | Zoo: Regenstein Center for African Apes, Small Mammal–Reptile House, African Journey, Birds of Prey, Macaque Forest, Pritzker Penguin Cove, Pritzker Family Children's Zoo, Zoo Administration, Conservation & Science Bldg | OSM (ways `210685702`, `210686225`, `210686226`, `210686561`, `524245311`, `758363114`, `210686576`, `53584351`, `24826061`) | Plain boxes | Each gets a look row and roof form (glass, mesh aviary, green roofs) | LPZ | M (bundle) |
| B10 | Zoo: **Farm-in-the-Zoo** (red barns) | OSM (`24826133` "Farm House", barn) | Not a hero | The red gambrel-roof barns and silo | LPZ | S |
| B11 | Zoo: **Kovler Sea Lion Pool**, the carousel, zoo gates (Cannon Dr, Stockton) | Not modelled | — | Pool with rockwork, carousel pavilion, gate piers | LPZ | S |
| B12 | **Café Brauer** (South Pond Refectory, 1908) | OSM (`24826112`) | Not a hero | Prairie School (Perkins), red brick and green-tile hip roofs, the loggia and twin towers on the pond | WP, Chicago Landmarks | M |
| B13 | **South Pond + Nature Boardwalk + honeycomb pavilion** (Studio Gang) | LMK `boardwalkArches` p2 | Check the arch lattice against photos; the boardwalk deck; the prairie edge | Laminated-wood honeycomb arch, boardwalk loop | WP, Studio Gang | M |
| B14 | **Lincoln Park Conservatory** (1895, Silsbee) | LMK `glasshouse` (generic dome + 2 wings) | Real plan: Palm House with a 50 ft dome, Fern Room, Orchid House, Show House in a line | Palm House dome, three glass houses, the Grandmother's Garden, **Bates Fountain** ("Storks at Play", Saint-Gaudens & MacMonnies) | WP, Chicago Park District | L |
| B15 | **Alfred Caldwell Lily Pool** | SCULPT | Reference. Review | — | — | — |
| B16 | **Peggy Notebaert Nature Museum** (1999) | OSM POI way `23986958` | Not a hero | Limestone and glass, the Judy Istock Butterfly Haven glass wing, terraces to North Pond | WP | M |
| B17 | **North Pond + North Pond restaurant** (1912 warming shelter) | Pond: OSM water. Restaurant: verify way | Not a hero | Arts & Crafts shelter on the pond, the skyline view south | WP | S |
| B18 | **Theater on the Lake** (Fullerton) | OSM POI way `23989552` | Not a hero | 1920 brick pavilion (ex-TB sanitarium), arched openings, lakefront lawn | WP, CPD | M |
| B19 | **Chess Pavilion** | SCULPT (`26b847c`) | Reference | — | — | — |
| B20 | **Monuments and statues**: Grant (exists), Goethe (exists), Schiller, Hans Christian Andersen, Alexander Hamilton (gilded, Diversey), Signal of Peace, Garibaldi, Benjamin Franklin, Altgeld, Kwanusila totem (Addison) | 3 exist (`statues.js`) | 7 missing | Each statue on its sourced pedestal. Hamilton gilded. Kwanusila painted cedar | WP, CPD monuments | M (bundle) |
| B21 | **Diversey Harbor** + Diversey Yacht Club + Lincoln Park Boat Club + the Lagoon (rowing canal) | Water and boathouses OSM (`52494792`, `52494874`) | Harbour walls generic; boathouses plain | Harbour walls (level from D5), boathouses, rowing docks, the Fullerton–Diversey lagoon | CPD | M |
| B22 | **Diversey Driving Range & mini golf** | OSM (`210686996`) | Plain | The tee house and the tall net poles | CPD | S |
| B23 | **Belmont Harbor** + Chicago Yacht Club Belmont Station + Belmont Harbor Market | Water OSM `17766386` | Generic | Harbour walls and docks (D5), club, boats on moorings (static instanced, no people) | CPD, CYC | M |
| B24 | **Waveland Clock Tower & fieldhouse** | SCULPT | Reference | — | — | — |
| B25 | **Sydney R. Marovitz Golf Course** (9-hole, Waveland) | Park and pitch layers only | Fairway/green surface only | Greens, bunkers, the clubhouse | CPD | S |
| B26 | **Lakefront Trail + Fullerton revetment + beaches** (Fullerton, Diversey) | Trails and beaches layers | Revetment steps not modelled | Stepped revetments at the lake edge (depends on D5) | CPD, CDOT revetment program | M (D5) |
| B27 | **Elks National Memorial** (2750 N Lakeview, park edge) | OSM relation `2826708` | Not a hero | Beaux-Arts rotunda and dome, colonnade | WP | M |
| B28 | **Lincoln Park Cultural Center** & comfort stations | OSM (`53584355`, `356071739`) | Plain | Look rows only | CPD | S |

**Out of bounds (Decision 3: left for Phase 6, moved to §7 Parked):** Montrose Harbor and Beach, the Montrose Point bird sanctuary (Magic Hedge), Cricket Hill, Wilson Ave, Foster Beach, Hollywood/Osterman Beach. No world-bounds change in this pass.

**Totals:** 28 rows (4 references, 24 to build or upgrade; B9 and B20 bundle 9 and 7 sites), **44 sites** in all. **Decision 2 (2026-10-01): all 44 sites are in scope.**

### 3.2 To-dos

- [ ] **B-0 Gallery poses.** Add 6 Lincoln Park poses (North Ave Beach, the zoo's main mall, South Pond/Café Brauer, the Conservatory with the Bates Fountain, Theater on the Lake/Fullerton, Belmont Harbor/Waveland). **Done when** "before" frames are in `docs/screenshots/evolution/`.
- [ ] **B-1 Zoo module.** Split zoo and park builders into `pipeline/lib/zoo.js` (new). Lincoln Park landscape stays in `lincolnpark.js`. **Done when** `zoo.test.js` exists and the build routes `lionHouse` through it with the same output hash as today (a refactor-only commit).
- [ ] **B-2 Conservatory** (B14): four glass houses in a line, a 50 ft (15.2 m) dome, Grandmother's Garden beds, the Bates Fountain. **Done when** a test proves the dome height ±0.5 m and four distinct houses, and the night shot shows the glass lit (it is lit for events; mark "approximate" unless sourced).
- [ ] **B-3 Café Brauer + South Pond + Nature Boardwalk** (B12, B13). **Done when** the loggia, towers and green-tile roof, and the honeycomb arch, match photos at the B-0 pose, with a unit test for the arch lattice count and the roof colour sourced.
- [ ] **B-4 Zoo buildings** (B6–B11): Lion House brick and roof correction, Primate House, Bird House, the Regenstein bundle look rows, the red barns, the sea lion pool, the carousel and gates. **Done when** each has a card word, ⌘K aliases (e.g., "Lion House", "Farm-in-the-Zoo", "penguins") and tests for no-part-outside-footprint.
- [ ] **B-5 Museums and pavilions:** Chicago History Museum (B3), Nature Museum + Butterfly Haven (B16), North Pond restaurant (B17), Theater on the Lake (B18), Elks Memorial (B27). **Done when** each passes H1–H11.
- [ ] **B-6 Monuments** (B5, B20): exedra plus 7 statues via `statues.js` (Blender only if figurative detail is needed per `chooseMethod`). **Done when** each statue's pedestal is at its sourced coordinates (±3 m), the Hamilton statue reads gilded, and the ⌘K aliases resolve.
- [ ] **B-7 Recreation:** driving range (B22), golf course (B25), Cultural Center and comfort stations (B28), Passerelle (B2), North Ave Beach House polish (B1). **Done when** each has its card and ⌘K entry.
- [ ] **B-8 Harbours and lakefront** (B21, B23, B26): harbour walls, docks, moored boats (static, instanced), revetment steps. **Depends on D5** (approved, Decision 4): build them as real walls at `LAKE_Y` after D5 merges, not as low curbs first. **Done when** draw calls are unchanged (boats as one InstancedMesh, total ≤ 900) and the Belmont pose shows docks.
- [ ] **B-9 Tours.** A "Lincoln Park" VISIT tour (8 stops, south → north) in `tours.json`, with poses that pass `poseClearance`. **Done when** `tour.spec.js` runs it (or a unit test for the tour data, if the e2e gets too long).
- [ ] **B-10 README.** A "Lincoln Park" gallery section (8 frames) and Evolution rows: Conservatory (generic dome → four glass houses) and Lion House. **Done when** links resolve.

---

## 4. Workstream D — the Riverwalk lower level and Chicago's multi-level streets

*(Workstream C, the sound toast, is §5. It is small and independent, so it can ship first.)*

### 4.1 What the repo does today (verified)

- **The world is flat at the street datum.** `pipeline/lib/ground.js` `GROUND_Y = { lake 0.02, water 0.04, beaches 0.07, parks 0.08, …, roads 0.12 }`. The river and the lake are drawn 8 cm below the roads.
- **Bridges** sit at road level: `build-world.js:215 deckY = GROUND_Y.roads + 0.02`. 32 bascules are in `data/bridges.json`; DuSable, Wells, Lake and Outer Drive are `decks: 2`.
- **The Riverwalk** (`civic.js#riverwalk`) is granite paving at y = 0.16 with a rail and River Theater steps. The code itself says "(The flat world cannot show its drop below Wacker Drive.)"
- **Lower streets are dropped.** `ground.js#roadHalfWidth` and `traffic.js` skip `layer < 0` and tunnels. The OSM road cache holds **322 `layer<0` highway ways** that are never drawn or driven. Examples: E/W/S/N Lower Wacker (trunk, `tunnel=covered`), Lower Wacker Service Drive, Lower Columbus and its L-3 service drive, Lower and Lower Lower Randolph (L-2/L-3), Lower Michigan, Lower Illinois, Lower Stetson, Lower Beaubien, South Water (L-1/L-2), Field Blvd (L-1/L-2), Lower Wabash, Grand, Hubbard and Rush lower segments, Wolf Point Service Drive.
- **Traffic** (`app/src/traffic/Traffic.jsx`) uses one constant `ROAD_Y = 0.13`. `traffic.bin` has no level.
- **Subway tubes** are app-built (`app/src/transit/tunnels.js`) at rail top `SUBWAY_Y = −9` with ceilings at −4.8 m (`clear: 4.2`).
- **Camera:** `cameraMath.clampCamera` keeps target y ≥ 0 and the camera ≥ `MIN_ALT = 30 m`. Only the follow cam (in tubes) and rides (`rideRun.js` `EYE_M.walk = 1.7`) go lower.
- **Water reflections** use one shared mirror plane (`world/water/mirror.js#mirrorCamera(camera, planeY)`). This is the V1 "one lake, one river" design.
- **Rides:** the Riverwalk walk (`app/src/data/rides.json`, `walks.curated.json`) runs on the walk graph at street level.

### 4.2 Real-world numbers (all heights relative to the Loop street grade = model y 0)

| Thing | Real value | Model value proposed | Source |
|---|---|---|---|
| Chicago City Datum (CCD) 0 | 579.88 ft (Mean Tide NY) | — | MWRD CWS report; City of Chicago elevation benchmarks |
| Chicago River normal level | −0.5 to −2.0 ft CCD, target −2.0 ft (≈ 577 ft ASL) | — | MWRD (`08-15_Description_of_CWS_Report_for_UAA.pdf`); CPL "The Elevation of Chicago" |
| Lake Michigan | 576–582 ft recently; "generally a few feet higher than the river"; ≈ +1.3 ft CCD at 580 ft | — | CPL blog; USGS 05536121 (Chicago Lock) |
| Loop ground (at Willis) | ≈ 595 ft ASL | **y 0** (unchanged) | CPL blog |
| River below street | 595 − 577 ≈ 18 ft ≈ **5.5 m** at Willis; Wacker sits a few feet higher (≈ 6–6.5 m) | **RIVER_Y = −6.0 m** | derived from the above; to be verified by LiDAR (D0-2) |
| Lake below street | 595 − 579/580 ≈ 4.6–4.9 m | **LAKE_Y = −4.6 m** (Option A) | derived |
| Riverwalk | "about 2 storeys below street level"; walk ≈ 1 m above normal water | **RIVERWALK_Y = −5.0 m** | Wikipedia "Chicago Riverwalk"; framework plan |
| Lower Wacker clearance | Rebuilt 2001–02 from 12′6″ to ≥ **13′9″ (4.19 m)** | soffit −0.8 m (upper slab 0.8 m), **LOWER_Y = −5.0 m** → 4.2 m clear | DNAinfo/CDOT Wacker reconstruction; LUSAS case study |
| Lower Lower Wacker / Lower Lower Randolph | A third level under the Illinois Center grid | **LOWER2_Y ≈ −9.5 m** (behind the dockwall, no river exposure; verify) | Wikipedia "Multilevel streets in Chicago"; OSM `layer=-2/-3` |
| Bascule clearance (closed) | DuSable has the lowest on the river: **17 ft (5.2 m)** at Low Water Datum | deck 0 over water −6.0 → 6.0 m to the deck surface, ≈ 5.2 m to the soffit | chicagoloopbridges.com FAQ |
| L and Metra decks | unchanged (CTA 7.2 m, Metra 5.8 m) | unchanged | `transit/grade.js` |
| Subway under the river | The real tubes dive well below the riverbed | tubes dip to **−16 m** within 40 m of the river polygon (4 % ramps) | to verify per line (D0-3) |

**Riverwalk rooms** (south bank, east → west): Lake Shore Dr → Michigan (east section, McCormick Bridgehouse at Michigan); Vietnam Veterans Memorial Plaza (Wabash–State); **Marina Plaza** (State–Dearborn); **The Cove** (Dearborn–Clark); **River Theater** (Clark–LaSalle, with the stairs up to Upper Wacker); **Water Plaza** (LaSalle–Wells); **The Jetty** (Wells–Franklin, floating wetland gardens); **The Boardwalk** (Franklin–Lake). Under-bridge passages run through. Sources: Wikipedia "Chicago Riverwalk"; Chicago River Main Branch Framework Plan (City of Chicago, PDF); Sasaki/Ross Barney phase descriptions.

**Multi-level streets** (Wikipedia, with OSM confirming the levels): Wacker (3 levels), Michigan Ave N of the river (2), Wabash N of the river (2), Columbus (3), Randolph (3), Stetson (3), South Water (3), Lake Shore Drive bridge (2), plus Beaubien, Field Blvd, Harbor Dr, Illinois St, LaSalle Dr, Wacker Pl, North Water St. **Why they exist:** rail yards and tracks along the river and the Illinois Central yard. The upper grid was built over them.

### 4.3 Approach options

| | Option | What moves | Consequences | Verdict |
|---|---|---|---|---|
| **A** | **Sink the water** (recommended). River at −6.0, lake and harbours at −4.6, separated at the Chicago Harbor Lock (real gates; real head difference 0.3–1.7 m, model 1.4 m). Lower decks are carved under the existing ground | Water meshes, river dockwalls, lake shore aprons and revetments, beaches sloped, bascule piers, river-front building skirts, the Riverwalk, app-built lower decks | Buildings, roads, traffic lanes on top, transit structures, pins, tours, heightfield and camera clearance stay at y 0. Hero baselines that show water change (re-baseline once, deliberately). The mirror plane follows the view (river plane when the target is over the river corridor, else lake), so there is no second reflection pass | **Feasible**, medium risk, staged |
| A′ | A with a single water level (−6.0 everywhere) | Same as A | Simpler mirror, but the lakefront drop is overstated by about 1.4 m beyond the real gap, so the lakefront reads as a 6 m wall | Fallback if the lock seam looks wrong |
| B | **Raise the city** (+6 m for everything but water) | Every tile, block, building base, road, traffic `ROAD_Y`, transit `RAIL_TOP_Y`, tunnels, trees, pins, heightfield, camera clamps, tour/ride/perf/gallery poses, all hero-view baselines | Touches about every module. Weeks of re-baselining. High risk of "ruining the build" | **Rejected** |
| C | **Local trench only** (fallback). Lower just the main-stem river between the lock and Wolf Point plus the Riverwalk; the lake stays flat | River polygons in a corridor | A 6 m water step where the river meets the flat lake (hidden at the lock, physically wrong). Branches stay flat | Fallback if A's lake work slips |
| D | Do nothing to the water; draw lower decks only as a cutaway | App only | Not "accurate"; the user asked for accuracy | Not recommended |

**Recommendation: Option A in stages D1 → D5, each behind a flag, each a separately mergeable gate.** D1 (river) and D2 (lower decks) deliver what the user asked for. **Decision 4 (2026-10-01): Option A approved** — river −6.0 m, lake −4.6 m, the 1.4 m step hidden at the Chicago Harbor Lock (A37 is the seam). D5 is therefore in scope; A′ and C stay as fallbacks only.

**Feasibility verdict:** **feasible without ruining the build**, provided that (1) the street datum stays at 0 (nothing above ground moves), (2) the lower decks are built in the app from compact centrelines like the subway tubes, so they cost almost no world bytes and can be switched off at runtime, (3) the river drop ships as one world rebuild with a revert-ready commit, and (4) the subway tubes are dipped under the river *in the same change*. They would otherwise poke through the sunken water: the tube ceiling at −4.8 is above RIVER_Y −6.0. Overall risk: **medium**, concentrated in D1 (re-baselining, tube dip) and D3 (traffic graph).

### 4.4 Risks and mitigations

| Risk | Where | Mitigation |
|---|---|---|
| Subway tubes surface in the river channel (ceiling −4.8 > −6.0), and Lower Wacker (−5.0) crosses the State/Dearborn tubes | `app/src/transit/tunnels.js`, `pipeline/lib/transit/grade.js` | Dip the profile to −16 under river polygons and lower-level road footprints (4 % ramps). A unit test asserts every tube ceiling is < RIVER_Y − 1 under water and < LOWER2_Y − 1 under lower decks. Re-run `tunnel.spec.js` |
| Hero-view baselines with water change | `app/e2e/hero-view.spec.js-snapshots` | One deliberate re-baseline commit per stage, before/after images in the PR and README, and the user sees the Evolution row |
| Buildings float over the channel (footprints overlap the river polygon or touch the dockwall) | `build-world.js` building pass | "River skirt": footprint edges within 3 m of a river polygon extend their base to RIVER_Y. Unit test |
| Bascule leaves and counterweights clip the new pits / pier walls | `pipeline/lib/bridges.js` | Pier walls are generated from `leafGeometry` pivots (the pit opens to the depth the tail needs). The bridge-lift pose is in hero-view |
| Mirror reflection error for the river (the plane sits at lake level) | `world/water/mirror.js`, `WaterRig.jsx` | `planeY` follows the view (a river-corridor mask from the manifest), with a unit test. Optional: blend the plane over 1 s |
| Camera can't see the lower levels (MIN_ALT 30) | `cameraMath.js` | Never relax the orbit clamp globally. Lower levels are seen from (a) the river channel at oblique angles, (b) the **U "Lower levels"** cutaway, (c) rides (Lower Wacker drive, Riverwalk walk). Near-plane and orbit relax only inside ride/cutaway, as the tunnels do |
| Picking lower geometry by mistake | `world/Picker.jsx` | Lower decks are on a non-pick layer. Unit test |
| Traffic graph breaks (new nodes, ramps, signals) | `pipeline/lib/traffic.js`, `traffic.bin`, `traffic/graph.js`, `sim.js` | `traffic.bin` v2 adds a per-node level byte and per-edge y interpolation. No signals on `layer<0` unless OSM tags them. `traffic.test.js` covers ramps. Behind a flag with the old bin format still readable |
| Trees, pins, labels under decks | trees, PoiPins | Trees never on `layer<0`. Pins stay on roofs |
| World budget | `public/world` | Lower decks are app-built (≈ 60–120 KB JSON). Dockwalls and revetments go in the existing ground layer (≈ +1–2 MB). See §6.1 |
| Rides and tours at street level now cross water | `rides.json`, `tours.json` | The Riverwalk walk is rebuilt at RIVERWALK_Y. `build-rides` takes the y per point from the level map. Every pose is re-checked by `poseClearance` |
| Lighting under decks (sun shadow maps don't reach) | renderer | Self-lit like the tubes: sodium/LED strips every 12 m, an emissive soffit band, AO off under decks, a darker ambient. Sun shadows ignored there |

### 4.5 To-dos (staged; each stage is its own branch, gate, merge and push)

**D0 — Research and spec (no world change)**
- [ ] **D0-1** Write `pipeline/data/levels.json` with `RIVER_Y`, `LAKE_Y`, `RIVERWALK_Y`, `LOWER_Y`, `LOWER2_Y`, `SLAB_M`, `CLEAR_M` and the sources from §4.2. **Done when** `levels.test.js` checks the invariants (LOWER_Y − RIVER_Y ≥ 0.8; −SLAB_M − LOWER_Y ≥ 4.19; LAKE_Y − RIVER_Y ∈ [0, 1.7]).
- [ ] **D0-2** Sample the **Cook County 2017 LiDAR / Illinois Height Modernization DEM** at 40 points (Upper Wacker, the Riverwalk rooms, Lower Wacker entrances, bridge decks, the lakefront at North Ave, Belmont and Navy Pier) and record street-to-water differences in `levels.json.samples`. **Done when** the model values are within ±0.7 m of the LiDAR median, or are changed to match it.
- [ ] **D0-3** For each subway line crossing the river or a lower street (Red/State, Blue/Dearborn, Blue/Milwaukee-Kinzie), record the dip profile. **Done when** `levels.json.tubeDips` lists every crossing with a source or "approximate".
- [ ] **D0-4** Bytes ledger: estimate per stage from a dry-run build in a scratch output dir (not `public/world`). **Done when** the ledger is in this plan's PR description.

**D1 — The river at its real depth + the Riverwalk at river level (world rebuild)**
- [ ] **D1-1** River polygons at `RIVER_Y`. Generate **dockwalls** (vertical concrete, sheet-pile tone downtown, darker riprap tone upriver) along every river polygon edge that meets land, from 0 to RIVER_Y − 0.5, merged into the ground layer. **Done when** `water.test.js` asserts the wall quads close every land–river edge and the draw-call census is unchanged.
- [ ] **D1-2** Rebuild the Riverwalk (`civic.js#riverwalk`) at RIVERWALK_Y with the eight rooms as real geometry: Marina Plaza tiers, the Cove docks, River Theater steps up to Upper Wacker (5 m rise), Water Plaza fountain, Jetty piers and floating gardens, Boardwalk, Vietnam memorial, under-bridge passages, the inner retaining wall with the arcade vault openings into the Lower Wacker zone, and stairs and ramps up to the street at each bridge. **Done when** a unit test checks continuity (the walk polyline never leaves the paving), the River Theater steps total ≈ 5 m, and the rooms' extents match the street table above.
- [ ] **D1-3** River-front building skirts (see Risks). **Done when** the test passes for every river-adjacent footprint.
- [ ] **D1-4** Bascule piers and abutments down to the water, plus pits sized from the leaf tail sweep. **Done when** the bridge-lift animation clears the pit in `bridgeParts.test.js` and the e2e bridges pose passes.
- [ ] **D1-5** Subway tube dips (D0-3) in `transit` and `tunnels.js`. **Done when** the tube-ceiling invariant test passes and `tunnel.spec.js` is green.
- [ ] **D1-6** Mirror plane follows the view, with a river-corridor mask in the manifest. **Done when** a unit test covers `planeYFor(target)` and a hero-view river pose shows correct reflections.
- [ ] **D1-7** Riverwalk walk ride at river level (`build-rides`, `rides.json` with y per point). **Done when** `ride.spec.js` completes the Riverwalk walk at ≥ 58 fps and the eye stays between RIVERWALK_Y + 1.5 and + 1.9.
- [ ] **D1-8** Feature flag `levels.river` in the manifest. The app reads `RIVER_Y` from the manifest, never a constant. **Done when** a manifest without `levels` renders exactly as today (unit test on the reader).
- [ ] **D1-9** Re-baseline the affected hero-view snapshots in one commit with a before/after table (**Decision 8: approved, once per stage**; the old frames move to `docs/screenshots/evolution/`). **Done when** the gate is 3× green at 1 worker and no river/lakefront snapshot is re-baselined more than once in the stage.

**D2 — Lower streets you can see (app-built, no tile bytes)**
- [ ] **D2-1** `pipeline/lib/lowerLevels.js` turns the 322 `layer<0` ways into compact centrelines with width, level and ramp ends → `public/world/lower-levels.json` (≤ 150 KB). **Done when** a unit test counts Lower Wacker, Lower Michigan, Lower Columbus and Lower Lower Randolph, and the file size is asserted.
- [ ] **D2-2** `app/src/world/LowerLevels.jsx` builds decks, soffits, columns every 9 m, kerbs, lane marks and self-lit strip lights from that JSON. Drawn only when the camera is in a ride, in the cutaway, or below 120 m altitude within 600 m. **Done when** ≤ 3 extra draw calls when visible, 0 when not (draw census test), and `noPedestrians` still passes.
- [ ] **D2-3** **U — Lower levels cutaway.** Fades the upper road and sidewalk ribbons over bilevel zones (a mask from `lower-levels.json`) and shows the lower decks and their traffic. Add it to `FEATURE_CONTROLS` (key U, ⌘K "Lower levels", help line). **Decision 7: no dock button** — leave it out of `DOCK_ORDER` (the dock keeps its six buttons), like Traffic and Scan. U must also be in the follow/tour/ride-safe key list (C-fix). **Done when** `featureControls.test.js`, `help.test.jsx` and `searchCoverage.test.js` pass, a test asserts `DOCK_FEATURES` does not contain `lowerLevels`, and a hero-view pose with U on is baselined.
- [ ] **D2-4** Double-deck bridges' lower decks at LOWER_Y (DuSable lower deck = Lower Michigan, Outer Drive lower deck). **Done when** `bridgeWorld.test.js` checks both deck ys.

**D3 — Traffic on the lower levels**
- [ ] **D3-1** `traffic.js` keeps `layer<0` ways (not service/private) with a level, and ramps interpolate y. `traffic.bin` v2 header. **Done when** `traffic.test.js` covers a ramp edge and the v1 reader still parses the old file.
- [ ] **D3-2** `Traffic.jsx` places vehicles at the edge y, and lower-level vehicles render only when D2 is visible. Headlights stay on below deck at all hours. **Done when** a unit test covers `yAt(edge, t)` and perf stays within ±1 fps at the perf poses.
- [ ] **D3-3** Lower Wacker "drive" ride (bus-style vehicle, cab view) in `rideCatalog`: Columbus → Lower Wacker → Lake St exit. **Done when** `ride.spec.js` completes it and ⌘K "Drive Lower Wacker" finds it.

**D4 — Polish**
- [ ] **D4-1** Lower-level entrance and exit portals and signage at real locations (the Columbus, Stetson, Michigan, Franklin and Lake St ramps). **Done when** each portal is at an OSM ramp end ±5 m.
- [ ] **D4-2** Lower-level labels in `WorldLabels` ("Lower Wacker Dr") that show only with U on. **Done when** the label test passes.

**D5 — The lake at its real level (Decision 4: approved — `LAKE_Y` −4.6 m, the step hidden at the Harbor Lock)**
- [ ] **D5-1** Lake and harbours to `LAKE_Y`, with shore aprons: stepped revetments (≈ 1.2 m steps), beaches sloped across their width, harbour walls, Navy Pier and breakwater faces, the lighthouse base, and the Chicago Harbor Lock (A37) as the seam: the 1.4 m step between `RIVER_Y` and `LAKE_Y` happens only inside the lock chamber, between its gates, so no open-water edge shows a step. **Done when** `shore.test.js` / `lake.test.js` assert no gap along the shoreline, a unit test asserts every river–lake water contact lies inside the lock polygon, a hero-view pose at the lock mouth shows no visible step outside the gates, and the lakefront hero-view poses are re-baselined once (Decision 8).
- [ ] **D5-2** Inland ponds (South Pond, North Pond, the Lagoon, the Lily Pool) stay perched about 0.6 m below their banks with sloped edges. **Done when** a unit test lists them with their y.

**Fallback (if any stage threatens the build):** revert that stage's single world commit (each stage is one commit for `public/world`). Set `levels.*` to absent so the app renders today's flat world. Go to Option C (main stem only) or ship D2 as a cutaway-only view. The user is told in plain words before any fallback ships.

---

## 5. Workstream C — the M sound toast + C-fix — DONE 2026-10-01

Shipped (C-1…C-6 sound toast; C-fix-1…5 follow/tour/ride-safe toggles incl. K cycling the follow view). Removed from this list.

---

## 5B. Workstream E — Sports: live schedules, the United Center board, "Play a game"

### 5B.1 What exists (verified 2026-10-01)

- **The board text is computed, not hard-coded.** `scoreboard.js#boardLines` builds "SOLDIER FIELD / NEXT NYJ · SUN OCT 4 12:00 PM" from `states[venue].next` (`gameState.js#nextGame`). `SportsClock.jsx#tick` recomputes every venue every 15 s.
- **The data goes stale.** `loadSchedule` (`sportsStore.js:26`) reads `/world/schedules.json`, a copy of `pipeline/data/schedules.json` made by `build-world.js:306-307`. That file is written by `npm run schedules` (`pipeline/fetch/fetch-schedules.js` → `pipeline/lib/schedules.js`, ESPN site API: "build time only; the app never calls ESPN"). Today's file is `generatedAt 2026-09-29T17:36Z`. On the deployed site it changes only when someone re-runs the fetch, rebuilds and pushes. Postseason games, reschedules, results (and so the Wrigley W/L flag), attendance and new games never arrive. `isStale` (`venueStates.js:15`, `STALE_DAYS = 45`) then drops the whole file to the simulated calendar (`simSchedule.js`), so around mid-November the boards switch from real to simulated without anyone noticing.
- **Live overlay.** `services/feeds.js:21` wires a `sports` feed to CHI ATLAS `/api/sports` (`liveScores.parseChiSports` → `overlayLive`). It starts only when `VITE_CHI_API_URL` is set and CHI answers. That variable is unset in production, so **production has no live scores**. The CHI ATLAS / Chicago Explorer linkage is **parked** (§7), so nothing in E may depend on it.
- **Where the state is shown:** Scoreboards (Rate Field 1 board, Soldier Field 2, Wrigley 1, from `venues.json`), `WrigleyMarquee.jsx` (`marquee.js#marqueeMessage(st)`), `WinFlag` (results), crowd density and lights (`venueStates.lightLevel`), `VenueCard.jsx` (⌘K / Games), `GamesPanel.jsx`, and ⌘K `sports/palette.js#gamePlaces`. They all read `useSports.states`, so one source feeds everything.
- **The United Center has no board.** `venues.json`: `unitedcenter` kind `arena`, teams `bulls, blackhawks`, `boards: []`, radius 111 m. Wintrust Arena is the same.
- **Cards.** Clicking a stadium opens `ContextPanel` → `LandmarkCard`/`BuildingCard` (`hud/cards/`). `VenueCard.jsx` opens from ⌘K "Games at …" and the Games panel. Neither has an action button today.
- **Previews to copy.** Fireworks: `store.fireworksPreview` / `startFireworks` / `stopFireworks` (`store.js:29-33`), the pure `fireworksShow(date, { previewStart, stoppedAt })`, X toggles, and `requestFireworksView` flies you to a view. Fountain: `startFountainPreview` / `stopFountain` / `expireFountainPreview`. A test-only `?sports=<mode>` override (`venueStates.js#overrideStates`) already fakes live/final states.
- **Vercel root is `app/`** (`app/vercel.json`, framework vite). `/world/*` is cached 1 h. There is no `app/api/` yet.

### 5B.2 E1 — How schedules should refresh — DONE 2026-10-01 (live: /api/schedule, espn-proxy)

| | Option | Freshness | Live scores? | Cost / risk | Verdict |
|---|---|---|---|---|---|
| **P** | **Vercel Function `app/api/schedule.js`**: proxies ESPN's team-schedule (and league scoreboard) endpoints, parses with the *same* `parseEvent`/`mergeGames`, returns the `schedules.json` shape. `Cache-Control: public, s-maxage=600, stale-while-revalidate=3600`, dropping to `s-maxage=60` while any in-map game is between 90 min before and 60 min after it ends (the same windows as `liveScores.sportsInterval`). The client polls it through the existing `createFeed` scheduler | Minutes; 1 min around games | **Yes**: ESPN's `state: in` and scores become `live`, so `gameState.liveState` makes the venue live without CHI | Free tier is fine: the CDN cache means ESPN sees about one fetch per URL per cache window whatever the traffic. One small function. Unofficial ESPN API (the same risk the build already accepts) | **Recommended** |
| Q | **Scheduled GitHub Action / Vercel Cron** runs `npm run schedules`, copies the file into `app/public/world/`, commits and pushes, which redeploys | Up to 24 h (or one deploy per run) | No | A production deploy every day, bot commits to `public/world` (clashes with "never commit `public/world` mid-wave"), CI secrets for push | Not recommended. Keep only as a fallback if functions are blocked |
| R | Browser fetches ESPN directly | Live | Yes | CORS-blocked, every visitor hits ESPN, breaks the principle | Rejected |

**Recommendation: P.** The build-time `schedules.json` stays as the first fallback and `simSchedule.js` stays as the last resort. Order of trust: **proxy (fresh) → build-time file (younger than 45 days) → simulated calendar**. The parked CHI overlay, if it ever comes back, layers on top and is never required.

**The "app never calls ESPN" principle.** The *browser* still never calls ESPN: it calls our own same-origin `/api/schedule`. The server function calls ESPN on a CDN-cached schedule with an honest `User-Agent` (`chi-atlas-open-world (schedule proxy)`), timeouts and no retries in a loop. That keeps the intent (no visitor-driven load on ESPN, no third-party calls from the page). The wording changes from "build time only" to "build time and the cached `/api/schedule` proxy; the browser never calls ESPN". **Tell the user about this principle change in plain words in the PR and the final report.**


### 5B.3 E2 — Every venue uses the refreshed data

- [ ] **E2-1** Prove one source. A unit test feeds one proxy payload through `setData → tick → computeStates`, then checks that `boardLines` for Wrigley, Rate Field and Soldier Field (both boards), `marqueeMessage` at Wrigley, `WinFlag`'s `flagKind`, `VenueCard`, `GamesPanel` and ⌘K `gamePlaces` all show the same next/live/final game. The new United Center board (E3) joins the same test. **Done when** the test is green and no component reads `schedules.json` directly (grep check in the test).
- [ ] **E2-2** Crosstown and shared venues: a White Sox game at Wrigley, a Fire match at Soldier Field, a Sky game at the United Center go to the venue in the data (`VENUE_BY_NAME`), not to the team's home. **Done when** fixtures for all three pass.

### 5B.4 E3 — A Bulls board on the United Center

**Design.** The user asked for the info "in bulls colors … in a visually attractive way over the bulls arena/united center".
- **E3-0 sourcing first:** the real United Center has exterior LED displays at its Madison Street atrium. If they can be sourced (position and size), put a matching board there too, at real size.
- **The main piece is a roof "crown"** that echoes the arena's centre-hung scoreboard: a slim four-faced LED cube on a short dark mast at the roof centre, with a thin LED fascia ribbon around the roof parapet. The user asked for this display, so it is a deliberate, labelled exception to H6 ("nothing lit that isn't lit in life"). The card and README caption say "game board added for the guide".
- **Faces:** the same lines as every other board (`boardLines`: title, the two rows with scores, status), drawn by a new `drawBoard` style `'bulls'`. Black ground (#000), Bulls red #CE1141 frame and header band, white text with a step-below-white #F4F4F4 for the bloom, and a red bull-horn accent made of simple geometric shapes. **No logo artwork** (trademark).
- **The ribbon** scrolls the status ("NEXT MIL · TUE 7:00 PM", "LIVE · Q3 CHI 78–71 MIL", "FINAL · CHI 104–97") by UV offset, never by redrawing.
- **Colour rule (decided):** the board takes the colours of the team whose game it is showing. A Blackhawks game today, live or final within the postgame hour, gets Blackhawks styling: #CF0A2C red with black and a white feather-stripe accent. The header reads "BLACKHAWKS". Everything else, including idle, the next game and Sky or other events, gets **Bulls styling** as the user asked. Reason: the two reds are nearly identical (#CE1141 vs #CF0A2C), so what changes is the wordmark band and accent, which is what the real arena does on a Hawks night. The user still sees Bulls colours almost all the time.

- [ ] **E3-0 Source check.** Find the United Center's real exterior displays (Madison St atrium LED boards: position and size) and its roof height. Record them with sources in `heroes.json` `unitedcenter.sports`. **Done when** the sources are in the data, and the plan notes whether a real-position board is added next to the roof crown.
- [ ] **E3-1 Data.** `heroes.json` `unitedcenter.sports.crown = { roofM, faceM, mastM, ribbon: true, source/note }`, with the roof height sourced. `pipeline/lib/sportsSites.js#venueRecord` emits `crown: { center, roofY, face, mast }` into `venues.json` (world rebuild in E's wave). **Done when** a pipeline test asserts the crown sits inside the hull and above the roof by `mastM`, and `venues.json` has it.
- [ ] **E3-2 `app/src/sports/ArenaCrown.jsx`** (mounted by `SportsLife` for venues with `crown`). One merged mesh for the four faces (one `CanvasTexture` shared, redrawn only when `boardLines` text changes, the same as `Scoreboard.jsx`), plus one ribbon mesh: **≤ 2 draw calls**. `MeshBasicMaterial`, `toneMapped: false`. Night glow scales with `facadeUniforms.uNight` like the boards; by day it is still readable at 0.8. LOD: mounted within 3 km (`MOUNT_M`), canvas 1024×512 at HIGH, 512×256 at LOW, and the ribbon hidden at LOW. **Done when** a unit test covers `crownStyle(st)` (bulls / blackhawks rule, idle → bulls) and `drawBoard(…, 'bulls')`, the draw-census test shows ≤ 2 calls added, and `perf.spec.js` at a new "United Center" pose holds ≥ 58 fps.
- [ ] **E3-3 Card and ⌘K.** The United Center card says "Bulls and Blackhawks — the board on the roof shows the next game, live scores and finals". ⌘K "Games at United Center" already flies there. **Done when** `sports.test.jsx` covers the line.
- [ ] **E3-4 README (cohesion rule).** Day and night shots at a fixed United Center gallery pose (`galleryShots.js`), with the caption "United Center — the Bulls board on the roof, showing the same next game and live score as the other venues (a guide display, not a real fixture)". The previous United Center frame moves to `docs/screenshots/evolution/` with an Evolution row. **Done when** links resolve and there are no orphans.

### 5B.5 E4 — "Play a game" at Wrigley, Rate Field and Soldier Field

**Behaviour.**
- **A short accelerated game: `SHOWCASE_S = 90` s.** About 10 s of pregame: the crowd fills and the lights come up even by day. About 65 s of play: the players in formation (`formations.js`: baseball, football, soccer), 5–8 scoring plays at hashed moments, the scoreboard and Wrigley marquee ticking ("TOP 3RD", "Q2"), and the crowd standing and cheering on each home score (`pushSwell`, plus `cheer()` when Sound is on). About 15 s of final: celebration; at Wrigley on a Cubs win the **W flag goes up** and fans come onto the field, as on a real Cubs win day. Then everything goes back to normal by itself.
- **Which team:** Wrigley plays the Cubs, Rate Field the White Sox, Soldier Field the Bears. ⌘K also offers "Play a Fire match at Soldier Field" (soccer formations exist).
- **Same pattern as the fireworks.** Clicking the button again ("Stop the game") or pressing Esc stops it and the venue goes back to its real state. One showcase runs at a time; starting another venue stops the first. If the venue is off-screen it flies you there (`clearedVenuePose`), but never while you're following, touring or riding (C-fix rule; a Toast says where the game is instead).
- **The real live game always wins.** The showcase is a separate `useSports.showcase = { venueKey, team, startedAt }`. `tick()` uses it for that venue **only while the venue's real state is idle or postgame**. During a real **live** game the button is hidden and the card reads "Live now — this is the real game". During real **pregame** (gates open, 2 h before) the button is disabled with "Tonight's game starts at 7:05 PM — watch it live then". If a real game goes live mid-showcase, the showcase stops and a Toast says "The real game is starting — showing it live". The showcase never writes to `games`, `liveGames` or `boardOverrides`.
- **Sound off:** the same text Toast as the fireworks ("Sound is off — press M to hear the crowd").

- [ ] **E4-1 `app/src/sports/showcase.js`** (pure): `showcaseState(venue, team, startedAt, nowMs)` → `{ state, game, virtualNow, winDay }`, mapping 90 s onto the sport's full `gameWindow` so `boardLines`, `periodLabel`, `simScore` and `flagKind` work unchanged on `virtualNow`; a deterministic simulated game (`hashFrac` seed) in which the home team wins by default so the W flag shows. **Done when** unit tests cover the phase boundaries (0 / 10 / 75 / 90 s), the score never decreases, it ends at 90 s, the Cubs final gives `winDay`, and each sport's labels are right.
- [ ] **E4-2 Store and clock.** Add `startShowcase(venueKey, team)` / `stopShowcase()` / an expiry in `sportsStore.js`. `tick()` applies the precedence above and pushes a swell on each simulated score change. `SportsLife` and `WrigleyMarquee` take a per-venue `now` (`virtualNow` while a showcase runs). Venue lights use `lightLevel('live')` during the showcase. **Done when** unit tests show a real `live` beats the showcase, a real pregame start stops it, expiry at 90 s restores the real state, and `boardOverrides` and `games` are untouched.
- [ ] **E4-3 Buttons in both cards.** `VenueCard.jsx`, and the clicked-stadium card (`LandmarkCard`/`BuildingCard` when `selection.id` is `wrigleyfield`, `ratefield` or `soldierfield`), get a pill "▶ Play a Cubs game" ↔ "■ Stop the game" with the live/pregame states above. It shows only for those three venues (not the United Center or Wintrust, which are indoor). **Done when** `sports.test.jsx` covers idle (button), live (hidden plus "Live now"), pregame (disabled plus explanation), running (Stop), and another venue (none).
- [ ] **E4-4 Key, ⌘K, help (human-first).** A `FEATURE_CONTROLS` entry `showcase`, key **Y** ("Play a game": the venue whose card is open, else the nearest of the three to the camera target; Y again stops), **not in the dock** (it stays at six buttons). ⌘K: "Play a Cubs game at Wrigley Field", "Play a White Sox game at Rate Field", "Play a Bears game at Soldier Field", "Play a Fire match at Soldier Field", "Stop the game". A help line. Y joins the C-fix safe-key list. **Done when** `featureControls.test.js`, `help.test.jsx` and `searchCoverage.test.js` pass, and a test asserts `DOCK_FEATURES` is unchanged.
- [ ] **E4-5 e2e.** Open the Wrigley card, press Play: within 2 s `window.__sports` (with `?stats`) shows `wrigleyfield` live with the showcase flag; the board text changes within 10 s; Stop returns it to the real state; Esc also stops it. With `?sports=live` (a real live game) the button is hidden. Perf: a "Wrigley showcase" pose holds ≥ 58 fps and ≤ 900 calls. **Done when** 3× green at 1 worker.
- [ ] **E4-6 README.** One frame per venue mid-showcase (day), plus the Wrigley W flag at the final, in the sports gallery section, with captions. The previous sports frames move to Evolution per the cohesion rule. **Done when** links resolve.

### 5B.6 E5 — Explain the live-game feature to people

- [ ] **E5-1 Card copy.** A one-line explainer on every venue card: "When a real game is on, this stadium comes alive by itself — the crowd, the lights, the players and the live score on the board. Press ▶ Play a game to see a 90-second preview any time." (Indoor arenas get the first sentence only.) **Done when** `sports.test.jsx` checks the line on all five venue cards.
- [ ] **E5-2 Help card and Games panel.** The help card gets a "Games" paragraph: the live behaviour, Y / "Play a game", where the data comes from (ESPN, refreshed on the live site), and that live CTA trains stay simulated for now. The Games panel gets the same one line and the staleness label (E1-4). **Done when** `help.test.jsx` is green and the hint bar has no dead entry.

---

## 6. Cross-cutting

### 6.1 World-size budget (today 199.73 MB of the 200 MB cap; `build-world.js:662` throws above 200e6)

**Where today's bytes are** (`du`, KB): tiles 137,840 (1,024 glb incl. 33,808 KB of LOD1 + **15,148 KB of tile JSON**), blocks 42,840, ground 9,300, minimap.png 3,076, venues 1,124, transit.json 992, heightfield 836, trees.json 632, walk-graph 616, landmarks 568, pois-index 436, traffic.bin 332.

**What this pass adds (estimate):** A +3–5 MB (39 heroes; detail is LOD0-only, but blocks carry silhouettes), B +1–2 MB, D1 +1–2 MB (dockwalls, Riverwalk, piers in ground and tiles), D2 +0.15 MB JSON, D3 +0.1 MB, D5 +1–2 MB, C 0. **Total ≈ +6–11 MB.**

**Decision 5 (2026-10-01): free space first — but only if it costs no visual quality.** Every X-0 saving must pass the **visual-parity acceptance criteria** below. A saving that shows any artefact is reverted, even if that leaves the budget short. The **210 MB cap is a last resort only**: allowed only after every visually safe saving has been taken and the shortfall is still real, and it is **reported to the user** in the wave summary (the numbers, and which savings were rejected for artefacts). E3's crown adds 0 world MB of note (a `venues.json` field); E1's proxy adds none.

**Visual-parity acceptance criteria (apply to X-0a…X-0d and to any later compression):**
- **V1 side-by-side screenshots.** Before/after captures at every hero-view pose plus the gallery poses (`gallery.spec.js`), day and night, at 1920×1080 with DPR 1 and 2, saved as pairs in `docs/screenshots/compression/` (not linked from the README) and shown side by side in the PR. **No visible degradation:** per-pose pixel diff ≤ the current hero-view thresholds and SSIM ≥ 0.995, *and* a manual look at 2× zoom on the detail-heavy crops (Tribune crown, Wrigley clock, Marina petals, Water Tower, Chess Pavilion, Willis setbacks, glass/mullion façades, bridge houses, the minimap).
- **V2 mesh quantisation limits.** Positions ≥ 16-bit per axis within each tile/meshlet bound (no visible "stair-stepping" on curves; maximum vertex displacement ≤ 1 cm at LOD0, ≤ 5 cm at LOD1); normals octahedral at ≥ 10 bits per component (no faceting on Marina City or the Wrigley clock); UVs ≥ 12 bits (no texture swimming); custom attributes (`_seed`, `_layer`, `CALM`) **unfiltered**. A unit test measures maximum position error and normal angle error per tile against the uncompressed build.
- **V3 texture limits.** No re-encoding of façade, ground or sky textures in this pass. `minimap.png` palette quantisation keeps ≥ 256 colours with dithering off, and a ΔE2000 ≤ 2 average / ≤ 5 maximum against the original. No resolution reduction anywhere.
- **V4 data precision.** Tile JSON heights at 0.1 m and coordinates at 0.1 m are display-only. Hover cards stay identical (X-0a test), and nothing that places geometry is rounded.
- **V5 revert rule.** Any saving that fails V1–V4 is reverted in its own commit, and the ledger (X-0e) records "rejected: artefact" with the before/after pair.

**Where the bytes come from (do X-0 before any content lands):**
- [ ] **X-0a Compact the tile metadata JSON** (15.1 MB). Today each building is `{"id","name","address","stories","year","height","hero"}` with many `null`s. Change to columnar arrays with nulls omitted, a shared string table per tile, and heights at 0.1 m. Update `TileContent.jsx` / picking to read v2 and still read v1. **Expected −8 to −10 MB.** **Done when** hover cards are identical on 50 sampled buildings (unit test on the decoder) and `hover.spec.js` is green.
- [ ] **X-0b meshopt `level: 'high'`** (filters: octahedral normals, quantised positions) in `tilepack.js#writeTileGlb` for tiles, blocks and ground, after checking that the custom `_seed`/`_layer`/`CALM` attributes survive (keep them unfiltered if needed). **Expected −5 to −12 % of ≈ 181 MB of glb (−9 to −20 MB).** **Done when** V1–V3 pass (side-by-side pairs show no visible change, and the quantisation-error test is within the V2 limits), hero-view diffs stay within the current thresholds, and `glb.test.js` round-trips the custom attributes. Otherwise use a lower meshopt level, or revert (V5).
- [ ] **X-0c `minimap.png`** palette-quantised (pngquant-style in the pipeline, ≤ 1.2 MB). **Expected −1.9 MB.** **Done when** `minimap.test.js` passes, the V3 ΔE limits hold, and the minimap looks unchanged at 2× zoom in a side-by-side pair. Otherwise revert (V5).
- [ ] **X-0d Minify** `trees.json`, `walk-graph.json`, `pois-index.json`, `transit.json` (fixed 0.1 m precision, no whitespace). **Expected −0.5 to −1 MB.**
- [ ] **X-0e Budget ledger.** `build-world` prints per-folder MB and a per-stage delta, and fails above **197 MB** for content stages (a 3 MB margin). **Done when** the log shows the ledger.
- **Expected reclaim ≈ 19–33 MB vs ≈ 6–11 MB of additions.** The world ends around 185–192 MB.
- **Escalation (Decision 5: approved as a last resort only):** if, after every saving that passes V1–V5, a content stage still can't fit under 197 MB, raise the `build-world.js:662` cap to 210 MB in its own commit and **report it to the user** with the ledger. Vercel serves brotli, so transfer size stays far lower. **Never used to avoid doing X-0.**
- [ ] **X-0f Visual-parity harness.** A `compare-shots` script plus a Playwright run that writes the before/after pairs, the SSIM/diff table and the quantisation-error report for V1–V4. **Done when** it runs on X-0a…X-0d and its table is in the wave-0 PR.

### 6.2 Performance plan
- Budgets: ≤ 900 draw calls, ≤ 4 M triangles, about 60 fps.
- Heroes merge into the tile `buildings` layer (0 new calls). Dockwalls and revetments go in the ground mesh (0). Lower decks are one merged mesh per visible region (≤ 3 calls, drawn only when needed). Lower traffic reuses the instanced vehicles (0). Moored boats are one InstancedMesh (+1). The toast is DOM (0).
- Triangles: A + B add ≤ ≈ 0.6 M at LOD0 if everything is in view at once (it never is). Lower decks ≤ 60 k.
- [ ] **X-1** Add perf poses: "river canyon" (Wolf Point looking east, 60 m), "Lincoln Park zoo" (150 m), "Lower Wacker cutaway" (U on), "United Center board" (E3, night), "Wrigley showcase" (E4, mid-game). **Done when** `perf.spec.js` records ≥ 58 fps and ≤ 900 calls at each, at 1 worker, 3 runs.

### 6.3 ⌘K, help, hints, README
- [ ] **X-2 ⌘K:** every A/B site name and alias, "Lower levels", "Drive Lower Wacker", "Riverwalk (river level)", "Art on theMART", "Centennial Fountain", "Lincoln Park tour", and E4's "Play a Cubs game at Wrigley Field", "Play a White Sox game at Rate Field", "Play a Bears game at Soldier Field", "Play a Fire match at Soldier Field", "Stop the game". **Done when** `searchCoverage.test.js` enumerates them.
- [ ] **X-3 Help card:** U line, updated M line, K "change the view (ride or follow)" (C-fix-3), Y "Play a game" and the Games paragraph (E4-4, E5-2), Riverwalk and Lower Wacker ride lines. **Done when** `help.test.jsx` is green and the hint bar has no dead entry.
- [ ] **X-4 README:** new gallery sections ("River icons", "Lincoln Park", "The river at its real depth"), sports frames (United Center board E3-4, "Play a game" E4-6), a "Live data" paragraph (E1-5), Controls (M toast, U, Y, K), a Roadmap line for this pass, a Parked list, and Evolution rows: river same-pose (flat → sunk with the Riverwalk), Marina/Trump at the water, the Conservatory, the Lion House. Old frames move to `docs/screenshots/evolution/`. **Done when** every image link resolves, there are no empty table cells, and no orphan screenshots remain.

### 6.4 Test and gate plan
- Every branch: `pipeline` vitest + `app` vitest green.
- **Gate:** e2e at 1 worker, **3 consecutive green runs** of hero-view, hud-layout, perf, hover, tour, tunnel and ride. Never edit `app/` or `public/world` during a gate run.
- Re-baselines happen only in a dedicated commit with before/after images (D1-9, D2-3, D5-1, and A/B gallery poses if hero-view frames include them).
- Rules re-checked by tests on every build: `noPedestrians`, trees never inside buildings or stadiums (`worldTrees.test.js`), buildings never on tracks (`trackClearance.test.js`).

### 6.5 Subagent batching (worktrees, own dev ports 5174+, the user's server stays on 5173)

| Wave | Parallel worktrees | Touches | Conflicts / notes |
|---|---|---|---|
| **0** | X-0 budget reclaim + X-0f visual-parity harness (alone) | `tilepack.js`, `build-world.js`, `TileContent.jsx`, picking | Must merge first. Every saving passes V1–V5 or is reverted (Decision 5). World rebuild on merged main. Gate. Push |
| **0′** (parallel with 0; app-only, no world bytes) | **C + C-fix** sound toast and follow-safe keys (port 5174) · **E1** schedule proxy + feed + staleness (5175) | C/C-fix: `hud/SoundToast.*`, `Hud.jsx`, `global.css`, `HelpOverlay`, `featureControls.js` (help text only), `transit/followCam.js`, `camera/AtlasRig.jsx`, `landmarks/Fireworks.jsx`, new `lib/cameraKeepKeys.js`, `CommandPalette.jsx`. E1: new `app/api/schedule.js`, new `shared/schedules.js`, `pipeline/lib/schedules.js` (re-export), `services/feeds.js`, `sports/sportsStore.js`, `sports/tonight.js`, `hud/VenueCard.jsx`, `hud/GamesPanel.jsx` | No file overlap between C and E1 except **`HelpOverlay`/help text** (C-4 vs E5-2, which comes later) and `VenueCard.jsx` (E1-4 only). Both are user-visible fixes, so ship them early: merge C first, then E1, and push each when green. E1 needs a preview deploy to prove `/api/schedule` works on Vercel (root `app/`, `../shared` bundling) before it merges |
| **1** | **A-tops** A-0…A-7, A-10, A-11 non-water (5175) · **B-tops** B-0…B-7, B-9 (5176) · **E2–E5** sports (5177) · **D0** research (no code) | A: new `rivericons.js`, `heroes.json` (river block), `styles.json`. B: new `zoo.js`, `lincolnpark.js`, `statues.js`, `heroes.json` (LP block), `landmarks.js`, `tours.json`. E: `heroes.json` (`unitedcenter.sports.crown` only), `pipeline/lib/sportsSites.js`, new `sports/ArenaCrown.jsx`, new `sports/showcase.js`, `SportsClock.jsx`, `SportsLife.jsx`, `WrigleyMarquee.jsx`, `scoreboard.js`, `sportsStore.js`, `VenueCard.jsx`, `hud/cards/LandmarkCard.jsx`/`BuildingCard.jsx`, `featureControls.js` (+`showcase`), `sports/palette.js`, `HelpOverlay`, `galleryShots.js` | A, B and E all touch **`heroes.json`** (separate contiguous blocks; E edits one existing entry). **`featureControls.js`** is shared by C (wave 0′), E4-4 (Y) and D2-3 (U, wave 3): each adds its own entry, and the safe-key list (C-fix-1) derives from `FEATURE_CONTROLS`, so new keys join it automatically. **The cards** (`LandmarkCard`/`BuildingCard`/`ContextPanel`) are touched by B-4/B-7 (card words) and E4-3 (Play button): E puts its button in a separate `VenueActions` child component so the merge is a one-line mount. `galleryShots.js` is shared by A-0, B-0 and E3-4: append-only blocks. **`store.js`/`sportsStore.js`**: E uses `sportsStore.js` only (no `store.js` edits), so it can't collide with C-fix or D. Merge order: A → B → E. **Nobody commits `public/world`**; one world rebuild on merged main (it carries E3's crown) ends the wave |
| **2** | **D1** (alone, world rebuild) | `water.js`, `civic.js`, `bridges.js`, `build-world.js`, `transit/*`, `tunnels.js`, `mirror.js`, `build-rides.js` | Serial. Re-baseline. Gate. Push |
| **3** | **A-8/A-9/A-12** river-level bases + bridges (5174) · **D2** lower decks + U (5175) | A: `rivericons.js`, `bridges.js`. D2: new `lowerLevels.js`, `LowerLevels.jsx`, `featureControls.js` | A-9 and D2-4 both touch `bridges.js`: merge D2 first, then A. One world rebuild |
| **4** | **D3** traffic levels (5174) · **D4** polish (5175) | `traffic.js`, `Traffic.jsx`, `rideCatalog` · `WorldLabels` | Merge D3 then D4. D2-3 (wave 3) adds U to `featureControls.js`; check that the C-fix safe list picked it up (C-fix-1 test) |
| **5** | **D5** lake (approved, Decision 4), then **B-8** harbours and **B-10** README | `lake.js`, `shore.js`, `water.js` | Serial. Re-baseline the lakefront poses once (Decision 8) |

Each wave ends with a world rebuild on merged main (wave 0′ needs none), the 3× gate, the README refresh and a push to `main` (production deploy).

**File-conflict hot spots across C / E / D (read before dispatching):** `app/src/hud/featureControls.js` (C help text, E4 `showcase`, D2 `lowerLevels`); `app/src/camera/AtlasRig.jsx` (C-fix, and D2 near-plane relax in the cutaway); `app/src/hud/HelpOverlay.jsx` (C-4, C-fix-3, E5-2, X-3); `app/src/hud/VenueCard.jsx` (E1-4, E4-3, E5-1, all in E, so serial inside E); `hud/cards/*` (B-4/B-7 vs E4-3); `pipeline/data/heroes.json` (A, B, E3-1); `app/src/lib/galleryShots.js` (A-0, B-0, E3-4); `app/src/state/store.js` (C-fix reads it only; D adds `lowerLevelsOn`; E uses none of it). Rule: one branch owns a file per wave, or the edits are append-only blocks merged in the stated order.

---

## 7. Parked ideas (not in this pass; raised again at its close)

- **Phase 6: the rest of the city.** Deferred by the user (`docs/superpowers/plans/2026-09-29-phase-6-further-rings.md`).
- **Lincoln Park north strip → Phase 6 (Decision 3, 2026-10-01).** Montrose Harbor and Beach, the Montrose Point bird sanctuary (Magic Hedge), Cricket Hill, Wilson Ave, Foster Beach and Hollywood/Osterman Beach lie north of `WORLD_BOUNDS.minZ` (≈ Irving Park Rd). They are not built in this pass. When Phase 6 is raised, the hero standard in §1 applies to them, and the B-9 Lincoln Park tour gets its northern stops then.
- **VR.** Written as a future section in `2026-09-29-phase-7-traversal.md` ("Future: VR"). The Riverwalk and Lower Wacker rides from D would be natural first VR rides.
- **Live CTA trains linked to CHI ATLAS / Chicago Explorer data.** Phase 5 already has the plumbing (`services/chiApi.js`, `feeds.js`, LIVE/SIMULATED chip, trains snapped onto V3 services). Production shows **SIMULATED** unless `VITE_CHI_API_URL` points at a reachable CHI ATLAS API. Parked: connect it to the CHI ATLAS / Chicago Explorer data (Vercel project `chicago-explore`): endpoints, CORS, env on Vercel, an uptime check. Bring it up again at the end of this pass. **Sports doesn't wait for it:** E1's same-origin `/api/schedule` feed gives live scores on its own; the CHI `sports` feed stays wired but dormant, as an optional extra layer.
- **The separate GTA-style game and guide app.** Keep the world reusable: `levels.json`, `lower-levels.json` and traffic v2 are engine-neutral data, not React-only.
- Smaller follow-ons noticed while planning (raise later, not now): the Chicago Pedway, the freight tunnels, and a LiDAR "grade field" so the lakefront land can sit its real 2–3 m below the Loop.

---

## 8. Decisions (2026-10-01)

The user answered all eight open questions. Each answer is already applied in the to-dos listed.

| # | Question (was) | Decision | Applied in |
|---|---|---|---|
| 1 | River scope: all 43 rows, or Tiers 1–2 first? | **All 43 rows, with Tiers 1–2 first** (the recommendation) | §2.2 header note; A-3, A-4, A-6 then A-7; A-12 after Tier 3 |
| 2 | Lincoln Park scope: all 44 in-bounds sites? | **Yes, all 44** | §3.1 totals; B-0…B-10 |
| 3 | Lincoln Park north strip (Montrose → Hollywood): extend bounds or Phase 6? | **Leave it for Phase 6**, moved to Parked | §3.1 out-of-bounds note; §7 Parked |
| 4 | Water levels | **Option A: river −6.0 m, lake −4.6 m, the step hidden at the Chicago Harbor Lock** | §4.3; D5 approved (D5-1 lock-seam criteria); B-8 builds at `LAKE_Y`; §6.5 wave 5 |
| 5 | Budget: free space first? 210 MB? | **Free space first, but only with no visual cost**: the V1–V5 visual-parity criteria (side-by-side hero/gallery pairs, mesh/texture quantisation limits, revert anything with artefacts). **210 MB only as a last resort, and reported** | §6.1 Decision 5 block, X-0b, X-0c, X-0f, escalation line; §6.5 wave 0 |
| 6 | Toast drop shadow? | **None.** No drop shadow and no readability treatment: just the bare green/red glyph, ~1 s visible, then a 1.5 s fade | §5.2 Placement and Timing; C-5 asserts `filter: none` and no shadows |
| 7 | Lower levels: dock button? | **No.** Key U + ⌘K + help only | D2-3 (asserts not in `DOCK_FEATURES`) |
| 8 | Re-take river/lakefront references once per stage? | **Yes** | D1-9, D5-1, §6.4 |

**New decisions made in this revision (the user can overrule them; nothing here is built until "go ahead"):**
- E1: the schedule refresh is a **cached Vercel Function proxy** (`/api/schedule`), not a daily redeploy. The "never calls ESPN" principle is reworded to "the *browser* never calls ESPN" (§5B.2).
- E3: the United Center board uses **Bulls colours by default**, and **Blackhawks colours only on a Blackhawks game day** (live or final). It is a roof crown labelled "a guide display, not a real fixture".
- E4: the showcase is **90 s**, on key **Y** (not in the dock), and is **hidden during a real live game** and disabled during a real pregame.
- C-fix: every feature toggle key, plus K and `?`, is **follow/tour/ride-safe**. Only Esc, the movement keys and the camera commands (H, N, `[`, `]`) take the camera back.

---

## 9. Audit — user requests ↔ to-dos (2026-10-01)

One row per distinct request or clause, from **both** of the user's messages (message 1 = the 2026-09-30 request this plan was written for; message 2 = the 2026-10-01 answers and sports request).

| # | Msg | Request / clause (user's words, shortened) | To-do IDs that satisfy it | Mapped |
|---|---|---|---|---|
| 1 | 1 | Major iconic buildings along the river get the same attention as the Wrigley Building and Tribune Tower | §1 H1–H12; A-0…A-12 | Y |
| 2 | 1 | …as well as all of Lincoln Park | B-0…B-10 | Y |
| 3 | 1 | Green volume-on icon when I press M to turn sound on | C-1, C-2, C-3, C-5 | Y |
| 4 | 1 | Red volume-off icon with the triangle and the slash when sound goes off | C-2 (slash, no waves), C-5 (red) | Y |
| 5 | 1 | No background | §5.2 Placement; C-5 (transparent, no border) | Y |
| 6 | 1 | In the middle of the screen | §5.2 Placement; C-5 (centre within 2 %) | Y |
| 7 | 1 | Stays on screen about one second | §5.2 Timing `HOLD_MS = 1000`; C-3(c) | Y |
| 8 | 1 | Then fades out over 1½ seconds | §5.2 Timing `FADE_MS = 1500`; C-3(c), C-5 | Y |
| 9 | 1 | Shows when I press M | C-3 (all paths including M), C-5 | Y |
| 10 | 1 | Do the Riverwalk lower level, if it won't ruin the rest of the build | §4.3 feasibility; D1-1…D1-9; fallback paragraph; X-0 budget | Y |
| 11 | 1 | …and won't ruin the ground floor | §4.3 (street datum stays at y 0, nothing above ground moves); D1-3, D1-8 flag; Fallback | Y |
| 12 | 1 | Raise up the lower level and the double-level streets | D2-1…D2-4, D4-1, D4-2 | Y |
| 13 | 1 | Accurate because of the water | D0-1, D0-2, D1-1, D1-6, D5-1, D5-2 | Y |
| 14 | 1 | …traffic | D3-1, D3-2, D3-3 | Y |
| 15 | 1 | …street levels | D0-1 (`LOWER_Y`, `LOWER2_Y`, clearances), D0-2 LiDAR, D2-2, D2-4 | Y |
| 16 | 1 | …buildings | A-8, D1-3 (river skirts), H7 | Y |
| 17 | 1 | …physics (how it actually works: clearances, bridges, tubes, camera) | D0-3, D1-4 (bascule pits), D1-5 (tube dips), §4.4 camera/picking; D2-2 non-pick layer | Y |
| 18 | 1 | …and the look | D1-2 (Riverwalk rooms), D2-2 (lighting), §4.4 lighting row; D1-9, X-1 | Y |
| 19 | 1 | Park live CTA trains for later, linked to CHI ATLAS / Chicago Explorer | §7 Parked (live CTA) | Y |
| 20 | 1 | Bring it up again like Phase 6 and the VR idea | §7 ("bring it up again at the end of this pass"); final-report reminder | Y |
| 21 | 2 | A1: all 43 river rows, tiers 1–2 first | §8 #1; §2.2 Decision 1 note; A-3, A-4, A-6, A-7 | Y |
| 22 | 2 | A2: all 44 Lincoln Park sites | §8 #2; §3.1 totals; B-0…B-10 | Y |
| 23 | 2 | A3: north end of Lincoln Park left for Phase 6 (Parked) | §8 #3; §3.1 note; §7 Parked | Y |
| 24 | 2 | A4: river −6.0 m, lake −4.6 m, step hidden at the Harbor Lock | §8 #4; §4.3; D5-1; B-8 | Y |
| 25 | 2 | A5: free space first, but only if it doesn't sacrifice visuals | §6.1 V1–V5; X-0b, X-0c, X-0f | Y |
| 26 | 2 | A5: side-by-side hero-view screenshot comparisons before/after compression | V1; X-0f | Y |
| 27 | 2 | A5: texture/mesh quantisation limits | V2, V3; X-0b | Y |
| 28 | 2 | A5: revert any saving that shows artefacts | V5; X-0b, X-0c | Y |
| 29 | 2 | A5: 210 MB only as a last resort, and reported | §6.1 escalation line; §8 #5 | Y |
| 30 | 2 | A6: no drop shadow or readability treatment, just the bare glyph, ~1 s then a 1.5 s fade | §5.2 Placement/Timing; C-5 | Y |
| 31 | 2 | A7: lower levels on U + ⌘K + help only, no dock button | D2-3; X-2; X-3 | Y |
| 32 | 2 | A8: re-take river/lakefront references once per stage | D1-9; D5-1 | Y |
| 33 | 2 | Make sure the scoreboard isn't hard-coded… | §5B.1 (verified: computed by `boardLines`); E2-1 (one source, no direct file reads) | Y |
| 34 | 2 | …and that it changes/updates regularly | E1-1, E1-2, E1-3 (proxy + feed, 1–10 min), E1-6 | Y |
| 35 | 2 | (implied) Keep the build-time file and simulated calendar as fallbacks; show staleness | E1-3 (trust order), E1-4 (staleness label) | Y |
| 36 | 2 | (implied) Live sports must not depend on the parked CHI linkage | E1-3 (feed independent of `VITE_CHI_API_URL`); §7 note | Y |
| 37 | 2 | (implied) The "app never calls ESPN" principle | §5B.2 principle paragraph; E1-5 | Y |
| 38 | 2 | All three open-air venues and the Wrigley marquee use the refreshed data | E2-1, E2-2 | Y |
| 39 | 2 | In Bulls colours, the same info displayed over the United Center | E3-0…E3-2 | Y |
| 40 | 2 | …in a visually attractive way | E3 design (crown, ribbon, night glow), E3-2 (LOD/perf), E3-4 README shots | Y |
| 41 | 2 | (cohesion rule) README screenshot and caption for the United Center | E3-4; X-4 | Y |
| 42 | 2 | Something to click in the card for the three open-air stadiums | E4-3 (VenueCard + clicked-stadium card) | Y |
| 43 | 2 | …makes the corresponding sport's scene play out | E4-1 (sport-specific formations, scoring, board), E4-2 | Y |
| 44 | 2 | …just quick enough to showcase the feature well | E4-1 (`SHOWCASE_S = 90`, phases) | Y |
| 45 | 2 | …like the fireworks | E4-2 (start/stop/expire pattern), E4-3 (click again stops), Esc stops, E4-4 (key/⌘K/help) | Y |
| 46 | 2 | …but still keep the live-game feature for when games are actively happening | E4 behaviour (real live wins; hidden during live, disabled in pregame, auto-stop), E4-2 tests, E4-5 e2e with `?sports=live` | Y |
| 47 | 2 | (human-first) Key, ⌘K and help entries for "Play a game" | E4-4; X-2; X-3 | Y |
| 48 | 2 | Briefly explain the live-game feature to users | E5-1, E5-2 | Y |
| 49 | 2 | Pressing M while following a train stops the follow; fix it | C-fix-1, C-fix-5 (cause `followCam.js:93-97` / `AtlasRig.jsx:118`) | Y |
| 50 | 2 | …and audit the other toggles (follow, tour, ride) | §5.4 decision table; C-fix-1, C-fix-2 (X flight), C-fix-3 (K), C-fix-4 (⌘K) | Y |
| 51 | 2 | …fix it when you fix the sound sign | §5.4 (same branch/PR as C-1…C-6); §6.5 wave 0′ | Y |
| 52 | 2 | Tests that would have caught the follow bug | C-fix-1 (unit), C-fix-5 (e2e: follow, press M, still following) | Y |

**Result: 52 rows, 52 mapped (all Y).** No request needed a new to-do beyond those added in this revision (C-fix-1…5, E1-1…E5-2, X-0f).

**Final re-read (2026-10-01).** Both messages were read again clause by clause against this table:
- Message 1: river icons; Lincoln Park; the glyph's colour, shape, background, position, hold, fade and trigger; the Riverwalk's "won't ruin the build"; the multi-level streets' six accuracy aspects; and the parked live CTA with its re-raise. All present.
- Message 2: the eight answers (each split into its clauses, #21–32), "not hard-coded", "updates regularly", the Bulls colours and "visually attractive" United Center display, the card button, the open-air restriction, "just quick enough", "like the fireworks", keeping live games, the explanation copy, the M/follow bug, and "fix it with the sign". All present.

Nothing is missing.

## 10. Additions (2026-10-01, after the audit)

Done 2026-10-01 and removed: F-1 weather menu, F-3 keycaps, F-4 ride names, F-5 swatches, F-6 ride panel placement, F-7 ride audio.


- [ ] **F-2 Sports go/no-go check.** After Workstream E merges: verify in the browser that all five venues (Wrigley, Rate Field, Soldier Field, United Center, Wintrust) show fresh data from `/api/schedule`, live/pregame/final states, the "Play a game" showcase at the three open-air venues, the W flag, cheers with sound on, and the staleness labels. **Done when** a checked list with screenshots is in the final report.
- Note on redeploys: production `b9f7935` was verified live 2026-10-01 (assets + world tiles byte-identical). Vercel deployment storage is near its limit — offer to prune old deployments before the big world-changing stages.

### 10.1 Audit rows (2026-10-01 additions)

| User request | To-dos |
|---|---|
| Weather menu partially hidden behind the dock — must go over it / fit, visually pleasing, good UI/UX | F-1 |
| "make sure you have gotten everything fixed with the games and all of that is good to go" | E1–E5, F-2 |
| Redeploy fully understood (production verified live; storage near limit) | §10 note; prune offer before D stages |
| Game brainstorm: grounded action thriller, JC3-like, semi/almost fully open world | not in this plan — separate project (memory: game-brainstorm) |
| "I still have not said go ahead" | no coding until go-ahead |
| Arrows around "and" in the ride panel | F-3 |
| (found in the same screenshot) duplicate Blue Line rows, dark swatches, panel covering pills | F-4, F-5, F-6 |
| Sound gone while riding trains | F-7 |

