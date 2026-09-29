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
  // Transit (V3): Tower 18 at Lake & Wells from street level, the Loop from 150 m and 1 km, Fullerton's 4-track corridor
  wellslake: { position: [-420, 30, -335], target: [-495, 7, -412] },
  transit150: { position: [40, 150, 330], target: [-175, 8, 86] },
  transit1000: { position: [900, 1000, 1400], target: [-175, 0, 86] },
  northside: { position: [-1700, 400, -4270], target: [-2080, 8, -4773] },
}

export function bookmarkFromUrl(search) {
  const v = new URLSearchParams(search).get('view')
  return BOOKMARKS[v] ?? BOOKMARKS.streeterville
}
