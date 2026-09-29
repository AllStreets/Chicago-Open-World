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
  wabash: { position: [150, 55, -80], target: [140, 6, -440] },
  willis: { position: [-200, 380, 900], target: [-669, 260, 348] },
}

export function bookmarkFromUrl(search) {
  const v = new URLSearchParams(search).get('view')
  return BOOKMARKS[v] ?? BOOKMARKS.streeterville
}
