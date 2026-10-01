// app/e2e/parity-shots.js — the X-0f visual-parity poses (plan §6.1 V1): every hero-view view by day and by night at
// DPR 1 and 2, plus close detail poses (DPR 2 only, judged at 2× zoom) on the surfaces quantisation could touch first:
// curved and carved crowns, clock faces, glass and mullions, setbacks, bridge houses, painted faces and murals.
const HERO_VIEWS = ['streeterville', 'loop', 'river', 'museum', 'hancock', 'willis', 'wrigleyville', 'westloop', 'navypier']

// pose = camera x, y, z, then target x, y, z (world metres; see the manifest's landmarks for the centres)
const DETAIL = [
  ['tribune-crown', [292, 150, -868, 344, 128, -928]],
  ['wrigley-clock', [262, 112, -748, 250, 104, -830]],
  ['marina-petals', [-60, 95, -580, -80, 110, -672]],
  ['water-tower', [330, 30, -1630, 282, 25, -1682]],
  ['chess-pavilion', [262, 9, -3222, 236, 2, -3252]],
  ['willis-setbacks', [-520, 420, 230, -667, 380, 349]],
  ['trump-glass', [190, 215, -700, 117, 200, -772]],
  ['dusable-bridgehouses', [330, 18, -715, 287, 6, -757]],
  ['crown-fountain', [298, 12, 22, 340, 8, 60]],
  ['pilsen-murals', [-2300, 10, 2670, -2337, 5, 2702]],
]

export const PARITY_SHOTS = [
  ...HERO_VIEWS.flatMap((view) => ['day', 'night'].map((time) => ({ name: `${view}-${time}`, view, time, minimap: view === 'loop' && time === 'day' }))),
  ...DETAIL.map(([name, pose]) => ({ name: `detail-${name}`, pose, time: 'day', dpr: [2] })),
]
