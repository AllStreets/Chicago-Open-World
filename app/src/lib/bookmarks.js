// app/src/lib/bookmarks.js — named camera poses (also used by Playwright baselines).
export const BOOKMARKS = {
  // From over the lake east of Streeterville looking SW at the skyline
  streeterville: { position: [1900, 320, -1500], target: [150, 60, -350] },
  // From above Willis looking NE across the Loop
  loop: { position: [-1100, 520, 900], target: [150, 40, -500] },
  // Down the main river canyon from the east
  river: { position: [900, 90, -560], target: [-600, 30, -520] },
  // Museum Campus looking back north at the skyline
  museum: { position: [900, 180, 2600], target: [0, 80, 0] },
}

export function bookmarkFromUrl(search) {
  const v = new URLSearchParams(search).get('view')
  return BOOKMARKS[v] ?? BOOKMARKS.streeterville
}
