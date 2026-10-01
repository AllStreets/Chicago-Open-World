// app/src/lib/perfPoses.js — the poses the draw-call budget is measured at (spec B.1.6; E3/E4 venues, X-1).
// `showcase: [venue, team, msIn]` starts "Play a game" that far in before measuring; `lowerLevels` presses U first.
export const PERF_POSES = {
  // from far out over the lake: Streeterville, Navy Pier and the whole north lakefront in frame
  wideStreeterville: { position: [4200, 900, -2600], target: [0, 60, -600] },
  // from the south-west, high: the Loop, the river and the lake behind
  wideLoop: { position: [-3600, 1100, 2600], target: [0, 60, -300] },
  // the densest view (= BOOKMARKS.loop): above Willis looking NE across the Loop
  densest: { position: [-1100, 520, 900], target: [150, 40, -500] },
  // low over the river (D1 · the triangle pass): the water's mirror, the shadow map and the Bean's cube all at work —
  // down the main-stem canyon from the east (= BOOKMARKS.river), and at the Riverwalk's level looking east to the lake
  riverCanyon: { position: [950, 140, -760], target: [-700, 40, -560] },
  riverLevel: { position: [-300, -3.5, -575], target: [300, -3, -600] },
  // E3 / X-1: the United Center board — the crown and its parapet ribbon in frame
  unitedCenter: { position: [-3655, 88, 375], target: [-3846, 44, 150] },
  // E4 / X-1: Wrigley mid-showcase — a full bowl, the players, the board and the marquee ticking
  // D2 / X-1: the densest view with U on — the cut-away open over Lower Wacker, Lower Michigan and Illinois Center's
  // lower streets (lower, closer poses over the river already spike past 4 M on reflection/shadow frames with U off)
  lowerWackerCutaway: { position: [-1100, 520, 900], target: [150, 40, -500], lowerLevels: true },
  wrigleyShowcase: { position: [-2400, 62, -7255], target: [-2240, 6, -7410], showcase: ['wrigleyfield', 'cubs', 40000] },
}
