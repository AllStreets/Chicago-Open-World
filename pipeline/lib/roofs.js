// pipeline/lib/roofs.js — parapet walls so roofs read as finished tops, not cut-off prisms.
import { ensureCCW, signedArea } from './geom.js'

export const PARAPET_FACADE = 8 // façade index the shader renders as plain coping
const PARAPET_H = 1.1
const PARAPET_T = 0.45

// Offset every vertex inward along the corner bisector (miter capped at 2d).
export function insetRing(ring, d) {
  const r = ensureCCW(ring)
  const n = r.length
  const inward = (a, b) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [(b[1] - a[1]) / len, -(b[0] - a[0]) / len] // negated outward normal (see extrude.js)
  }
  return r.map((p, i) => {
    const n0 = inward(r[(i - 1 + n) % n], p), n1 = inward(p, r[(i + 1) % n])
    let bx = n0[0] + n1[0], bz = n0[1] + n1[1]
    const bl = Math.hypot(bx, bz) || 1
    bx /= bl; bz /= bl
    const m = Math.min(2 * d, d / Math.max(0.2, bx * n1[0] + bz * n1[1]))
    return [p[0] + bx * m, p[1] + bz * m]
  })
}

export function parapetPiece(piece) {
  if (piece.taper || piece.top < 12) return null
  if (Math.abs(signedArea(piece.outer)) < 60) return null
  return { outer: piece.outer, holes: [insetRing(piece.outer, PARAPET_T)], base: piece.top, top: piece.top + PARAPET_H }
}
