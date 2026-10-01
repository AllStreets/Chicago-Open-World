// app/src/lib/bookmarks.js — named camera poses (also used by Playwright baselines).
export const BOOKMARKS = {
  // From over the lake east of Streeterville looking SW at the skyline
  streeterville: { position: [1900, 320, -1500], target: [150, 60, -350] },
  // From above Willis looking NE across the Loop
  loop: { position: [-1100, 520, 900], target: [150, 40, -500] },
  // Down the main river canyon from the east
  river: { position: [950, 140, -760], target: [-700, 40, -560] },
  // Museum Campus looking back north at the skyline
  museum: { position: [900, 180, 2600], target: [0, 80, 0] },
  // Hancock from the southeast, over Streeterville
  hancock: { position: [900, 420, -1500], target: [395, 200, -1865] },
  // Willis from the south over the river
  // The Loop L at Wabash & Lake, low over the tracks
  wabash: { position: [135, 55, -200], target: [138, 6, -470] }, // on the street centreline: clearance there is open sky
  // Wider world (Phase 2.5)
  wrigleyville: { position: [-1650, 280, -6850], target: [-2279, 12, -7372] },
  lincolnpark: { position: [900, 420, -3800], target: [-511, 20, -4351] },
  westloop: { position: [-900, 280, -250], target: [-2030, 20, -508] },
  pilsen: { position: [-1850, 240, 1950], target: [-2669, 10, 2702] },
  soldierfield: { position: [1950, 280, 1450], target: [925, 20, 2191] },
  navypier: { position: [2700, 320, -500], target: [1074, 150, -874] },
  willis: { position: [-200, 380, 900], target: [-669, 260, 348] },
  // ── V6 — landmarks and bridges (positions from OSM ways/buildings in pipeline/cache/world) ──
  bridges: { position: [180, 60, -540], target: [-420, 4, -612] },         // main stem looking west: Wabash → LaSalle
  dusable: { position: [385, 32, -680], target: [287, 5, -757] },          // DuSable Bridge, OSM centre (287, −757)
  southbranch: { position: [-768, 60, 650], target: [-856, 4, 230] },      // over the river between Van Buren and Congress, looking north up the bascules
  wells: { position: [-450, 35, -540], target: [-511, 6, -611] },          // Wells St double deck (L on top)
  buckingham: { position: [800, 55, 600], target: [711, 8, 693] },         // manifest (711, 692)
  cloudgate: { position: [398, 30, -46], target: [374, 5, -73] },           // manifest (374, −73)
  crownfountain: { position: [420, 30, 60], target: [340, 7, 60] },        // towers (339, 34) and (340, 86)
  lurie: { position: [575, 55, 150], target: [506, 1, 66] },
  bpbridge: { position: [650, 45, 10], target: [640, 3, -105] },
  artinstitute: { position: [282, 32, 370], target: [308, 5, 300] },       // Michigan Ave lions
  daleyplaza: { position: [-140, 30, -150], target: [-186, 8, -202] },     // the Picasso
  federalplaza: { position: [-230, 45, 380], target: [-167, 8, 303] },     // the Flamingo
  culturalcenter: { position: [330, 90, -300], target: [237, 30, -205] },
  unionstation: { position: [-930, 90, 300], target: [-1043, 20, 373] },
  martriver: { position: [-625, 45, -560], target: [-625, 40, -705] },
  navypierhead: { position: [1480, 50, -980], target: [1541, 14, -1078] }, // Family Pavilion / Headhouse
  ballroom: { position: [2250, 70, -960], target: [2361, 20, -1090] },     // Aon Grand Ballroom
  lowerlevels: { position: [450, 300, -1050], target: [200, -5, -560] }, // D2-3: the U cut-away — Lower Wacker, Lower Michigan and the river streets from over the river
  riverwalk: { position: [-120, 32, -560], target: [80, 1, -606] },
  zoo: { position: [-380, 110, -4150], target: [-560, 5, -4500] },         // Lion House (−456, −4365), Conservatory (−598, −4706)
  // Transit (V3): Tower 18 at Lake & Wells from street level, the Loop from 150 m and 1 km, Fullerton's 4-track corridor
  wellslake: { position: [-380, 32, -412], target: [-495, 7, -412] }, // over Lake St, looking west along the L into Tower 18
  transit150: { position: [215, 150, 660], target: [152, 8, 581] }, // the Loop's SE corner: Tower 12 at Van Buren & Wabash
  transit1000: { position: [900, 1000, 1400], target: [-175, 0, 86] },
  northside: { position: [-1700, 400, -4270], target: [-2080, 8, -4773] },
}

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
