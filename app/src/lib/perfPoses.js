// app/src/lib/perfPoses.js — the three poses the draw-call budget is measured at (spec B.1.6).
export const PERF_POSES = {
  // from far out over the lake: Streeterville, Navy Pier and the whole north lakefront in frame
  wideStreeterville: { position: [4200, 900, -2600], target: [0, 60, -600] },
  // from the south-west, high: the Loop, the river and the lake behind
  wideLoop: { position: [-3600, 1100, 2600], target: [0, 60, -300] },
  // the densest view (= BOOKMARKS.loop): above Willis looking NE across the Loop
  densest: { position: [-1100, 520, 900], target: [150, 40, -500] },
}
