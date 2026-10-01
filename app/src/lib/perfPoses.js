// app/src/lib/perfPoses.js — the poses the draw-call budget is measured at (spec B.1.6; E3/E4 venues, X-1).
// `showcase: [venue, team, msIn]` starts "Play a game" that far in before measuring.
export const PERF_POSES = {
  // from far out over the lake: Streeterville, Navy Pier and the whole north lakefront in frame
  wideStreeterville: { position: [4200, 900, -2600], target: [0, 60, -600] },
  // from the south-west, high: the Loop, the river and the lake behind
  wideLoop: { position: [-3600, 1100, 2600], target: [0, 60, -300] },
  // the densest view (= BOOKMARKS.loop): above Willis looking NE across the Loop
  densest: { position: [-1100, 520, 900], target: [150, 40, -500] },
  // E3 / X-1: the United Center board — the crown and its parapet ribbon in frame
  unitedCenter: { position: [-3655, 88, 375], target: [-3846, 44, 150] },
  // E4 / X-1: Wrigley mid-showcase — a full bowl, the players, the board and the marquee ticking
  wrigleyShowcase: { position: [-2400, 62, -7255], target: [-2240, 6, -7410], showcase: ['wrigleyfield', 'cubs', 40000] },
}
