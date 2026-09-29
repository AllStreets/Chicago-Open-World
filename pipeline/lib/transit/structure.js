// pipeline/lib/transit/structure.js — the physical railway: the CTA's open-deck steel elevated, Metra viaducts and
// embankments, at-grade ballast, subway portals, catenary and the Loop junction boxes. pts = [x, railTopY, z][].
import { KIND, hexToLinear, box, sweep, wall, chunksOf, cumulative3, cross3, unit3 } from './meshkit.js'

export const GAUGE_M = 1.435
export const TIE = { spacing: 0.61, length: 2.59, width: 0.2, depth: 0.18 }
export const RAIL = { width: 0.07, height: 0.16 }
export const GIRDER = { offset: 0.8, depth: 1.4, width: 0.36 }
export const DECK_DROP = RAIL.height + TIE.depth             // rail top → girder top
export const GIRDER_BOTTOM = DECK_DROP + GIRDER.depth        // rail top → girder bottom
export const THIRD_RAIL = { offset: 1.45, width: 0.08 }
export const WALKWAY = { offset: 1.95, width: 0.75 }
export const BED = { top: 1.6, foot: 2.2, topV: -0.16, footV: -0.46 } // ballast half-widths and heights under rail top
export const PORTAL = { half: 2.6, thick: 0.4, parapet: 1.0, mouth: -4.6, clearance: 4.2 }
export const BENT = { post: 0.56, beamDepth: 0.7, beamWidth: 0.6, brace: 1.6, minFoot: 1.5 }
export const JUNCTION_GRID_M = 9
export const ACCENT_CYCLE_M = 20
export const CATENARY = { spacing: 60, mast: 6.2, arm: 5.9, contact: 5.5, messenger: 6.1, offset: 2.7 }
export const COLOURS = { steel: '#2f3a33', concrete: '#9c9a92', ballast: '#6d665e', rail: '#8a8580', tie: '#4a3a2c', dark: '#23272a', cab: '#3b4a3f', glass: '#1c2630' }
const C = Object.fromEntries(Object.entries(COLOURS).map(([k, v]) => [k, hexToLinear(v)]))
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1]
const rect = (u, w, v0, v1) => [[u - w / 2, v0], [u + w / 2, v0], [u + w / 2, v1], [u - w / 2, v1]]

function railsOn(m, pts, thirdRail) {
  for (const s of [-1, 1]) sweep(m, pts, rect((s * GAUGE_M) / 2, RAIL.width, -RAIL.height, 0), C.rail, KIND.rail)
  if (thirdRail) sweep(m, pts, rect(thirdRail * THIRD_RAIL.offset, THIRD_RAIL.width, -0.07, 0.05), C.steel, KIND.steel)
}

function tiesOn(ties, pts) {
  const S = cumulative3(pts), L = S.at(-1)
  let i = 0
  for (let d = TIE.spacing / 2; d < L; d += TIE.spacing) {
    while (i < pts.length - 2 && S[i + 1] < d) i++
    const a = pts[i], b = pts[i + 1], f = (d - S[i]) / (S[i + 1] - S[i] || 1)
    const c = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - RAIL.height - TIE.depth / 2, a[2] + (b[2] - a[2]) * f]
    const t = unit3([b[0] - a[0], 0, b[2] - a[2]]), side = [-t[2], 0, t[0]]
    box(ties, c, side, Y, t, [TIE.length / 2, TIE.depth / 2, TIE.width / 2], C.tie, KIND.concrete, ['top', 'bottom'])
  }
}

function bed(m, pts) {
  sweep(m, pts, [[BED.top, BED.topV], [-BED.top, BED.topV]], C.ballast, KIND.ballast, { closed: false }) // painted ties
  sweep(m, pts, [[BED.foot, BED.footV], [BED.top, BED.topV]], C.ballast, KIND.concrete, { closed: false })
  sweep(m, pts, [[-BED.top, BED.topV], [-BED.foot, BED.footV]], C.ballast, KIND.concrete, { closed: false })
}

// the line-colour accent: a thin lit strip on each outer girder web, cycling through the lines that share the track
function accent(m, pts, colours) {
  if (!colours.length) return
  chunksOf(pts, ACCENT_CYCLE_M).forEach((chunk, k) => {
    for (const s of [-1, 1]) sweep(m, chunk, rect(s * (GIRDER.offset + GIRDER.width / 2 + 0.006), 0.012, -DECK_DROP - 0.16, -DECK_DROP - 0.04), colours[k % colours.length], KIND.accent)
  })
}

export function elevatedPiece(m, ties, { pts, operator, colours = [] }) {
  if (operator === 'metra') { // Chicago's through-girder rail viaducts: girders beside the tracks, ballasted deck between
    for (const s of [-1, 1]) sweep(m, pts, rect(s * 2.25, 0.3, -1.3, 0.9), C.dark, KIND.steel)
    sweep(m, pts, rect(0, 4.2, -1.3, -0.5), C.concrete, KIND.concrete)
    bed(m, pts); railsOn(m, pts, 0)
    return
  }
  for (const s of [-1, 1]) sweep(m, pts, rect(s * GIRDER.offset, GIRDER.width, -GIRDER_BOTTOM, -DECK_DROP), C.steel, KIND.steel)
  tiesOn(ties, pts)
  railsOn(m, pts, -1)
  sweep(m, pts, rect(WALKWAY.offset, WALKWAY.width, -DECK_DROP - 0.06, -DECK_DROP), C.steel, KIND.steel)
  accent(m, pts, colours)
}

export function embankmentPiece(m, { pts, operator }) {
  bed(m, pts); railsOn(m, pts, operator === 'cta' ? -1 : 0)
  for (const s of [-1, 1]) wall(m, pts, { u: s * (BED.foot + 0.15), thick: 0.3, bottom: () => 0, top: (p) => p[1] + BED.footV }, C.concrete, KIND.concrete)
}

export function atGradePiece(m, { pts, operator }) {
  bed(m, pts); railsOn(m, pts, operator === 'cta' ? -1 : 0)
}

export function portalPiece(m, { pts, operator }) {
  bed(m, pts); railsOn(m, pts, operator === 'cta' ? -1 : 0)
  for (const s of [-1, 1]) wall(m, pts, { u: s * PORTAL.half, thick: PORTAL.thick, bottom: (p) => p[1] - 0.6, top: () => PORTAL.parapet }, C.concrete, KIND.concrete)
  // headwall over the tunnel mouth, at the first point deep enough to swallow a train
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]]
    if ((a[1] > PORTAL.mouth) === (b[1] > PORTAL.mouth)) continue
    const deep = a[1] <= PORTAL.mouth ? a : b, t = unit3([b[0] - a[0], 0, b[2] - a[2]]), side = [-t[2], 0, t[0]]
    const y0 = deep[1] + PORTAL.clearance, h = (PORTAL.parapet - y0) / 2
    if (h > 0.15) box(m, [deep[0], y0 + h, deep[2]], side, Y, t, [PORTAL.half + PORTAL.thick, h, 0.3], C.concrete, KIND.concrete)
    break
  }
}

export function catenary(m, { pts }) {
  const S = cumulative3(pts)
  let i = 0
  for (let d = CATENARY.spacing / 2; d < S.at(-1); d += CATENARY.spacing) {
    while (i < pts.length - 2 && S[i + 1] < d) i++
    const a = pts[i], b = pts[i + 1], f = (d - S[i]) / (S[i + 1] - S[i] || 1)
    const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
    const t = unit3([b[0] - a[0], 0, b[2] - a[2]]), side = [-t[2], 0, t[0]]
    const foot = [p[0] + side[0] * CATENARY.offset, p[2] + side[2] * CATENARY.offset], top = p[1] + CATENARY.mast
    box(m, [foot[0], top / 2, foot[1]], side, Y, t, [0.15, top / 2, 0.15], C.dark, KIND.steel, ['front', 'back', 'left', 'right', 'top'])
    box(m, [p[0] + side[0] * (CATENARY.offset / 2), p[1] + CATENARY.arm, p[2] + side[2] * (CATENARY.offset / 2)], side, Y, t, [CATENARY.offset / 2 + 0.15, 0.06, 0.06], C.dark, KIND.steel)
  }
  sweep(m, pts, rect(0, 0.04, CATENARY.contact, CATENARY.contact + 0.04), C.dark, KIND.dark)
  sweep(m, pts, rect(0, 0.04, CATENARY.messenger, CATENARY.messenger + 0.04), C.dark, KIND.dark)
}

export function bentsMesh(m, bents) {
  for (const { a, b, y, dir } of bents) {
    const yTop = y - GIRDER_BOTTOM, yFoot = yTop - BENT.beamDepth
    if (yFoot < BENT.minFoot) continue // ramp foot: the girders rest on the ground there
    const ax = unit3([b[0] - a[0], 0, b[1] - a[1]]), az = [dir[0], 0, dir[1]]
    const span = Math.hypot(b[0] - a[0], b[1] - a[1])
    box(m, [(a[0] + b[0]) / 2, yTop - BENT.beamDepth / 2, (a[1] + b[1]) / 2], ax, Y, az, [span / 2 + BENT.post / 2, BENT.beamDepth / 2, BENT.beamWidth / 2], C.steel, KIND.steel)
    for (const [p, s] of [[a, 1], [b, -1]]) {
      box(m, [p[0], yFoot / 2, p[1]], ax, Y, az, [BENT.post / 2, yFoot / 2, BENT.post / 2], C.steel, KIND.steel, ['front', 'back', 'left', 'right'])
      box(m, [p[0], 0.05, p[1]], ax, Y, az, [0.45, 0.05, 0.45], C.concrete, KIND.concrete, ['top', 'front', 'back', 'left', 'right'])
      const lo = [p[0] + ax[0] * s * 0.1, yFoot - BENT.brace, p[1] + ax[2] * s * 0.1], hi = [p[0] + ax[0] * s * BENT.brace, yFoot, p[1] + ax[2] * s * BENT.brace]
      const d = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], len = Math.hypot(...d), dx = unit3(d)
      box(m, [lo[0] + d[0] / 2, lo[1] + d[1] / 2, lo[2] + d[2] / 2], dx, cross3(az, dx), az, [len / 2, 0.1, 0.1], C.steel, KIND.steel)
    }
  }
}

export function junctionBox(m, { x, z, y, size, tower }) {
  const n = Math.floor(size / JUNCTION_GRID_M), h = (n * JUNCTION_GRID_M) / 2
  const yTop = y - GIRDER_BOTTOM, yFoot = yTop - BENT.beamDepth
  for (let i = 0; i <= n; i++) for (let k = 0; k <= n; k++) {
    box(m, [x - h + i * JUNCTION_GRID_M, yFoot / 2, z - h + k * JUNCTION_GRID_M], X, Y, Z, [BENT.post / 2, yFoot / 2, BENT.post / 2], C.steel, KIND.steel, ['front', 'back', 'left', 'right'])
  }
  for (let i = 0; i <= n; i++) {
    const o = -h + i * JUNCTION_GRID_M
    box(m, [x, yTop - BENT.beamDepth / 2, z + o], X, Y, Z, [h + 0.3, BENT.beamDepth / 2, 0.3], C.steel, KIND.steel)
    box(m, [x + o, yTop - BENT.beamDepth / 2, z], X, Y, Z, [0.3, BENT.beamDepth / 2, h + 0.3], C.steel, KIND.steel)
  }
  if (tower) { // the interlocking tower cab rides the structure at one corner of the junction
    const c = [x + h - 2.5, y + 1.8, z - h + 2.5]
    box(m, c, X, Y, Z, [2.0, 1.8, 1.6], C.cab, KIND.steel)
    box(m, [c[0], c[1] + 0.3, c[2]], X, Y, Z, [2.02, 0.55, 1.62], C.glass, KIND.glass, ['front', 'back', 'left', 'right'])
    box(m, [c[0], c[1] + 1.95, c[2]], X, Y, Z, [2.3, 0.15, 1.9], C.dark, KIND.steel)
  }
}
