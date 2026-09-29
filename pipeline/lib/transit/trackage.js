// pipeline/lib/transit/trackage.js — which lines share each track (side-by-side glow strips) and where the L's bents stand.
import { buildGridIndex } from '../enrich.js'

export function linesByWay(routes, order) {
  const m = new Map()
  for (const r of routes) for (const w of r.wayIds) { if (!m.has(w)) m.set(w, new Set()); m.get(w).add(r.line) }
  const rank = (id) => { const i = order.indexOf(id); return i < 0 ? 1e9 : i }
  return new Map([...m].map(([w, s]) => [w, [...s].sort((a, b) => rank(a) - rank(b))]))
}

export function laneOf(lines, id) {
  const k = lines.length, i = lines.indexOf(id)
  return { lane: i - (k - 1) / 2, lanes: k }
}

export const BENT_SPACING_M = 18
export const POST_OUTSET_M = 1.6
export const SINGLE_HALF_SPAN_M = 2.0
const PAIR_MIN = 2.5, PAIR_MAX = 6.5, PARALLEL = 0.95

function nearestParallel(idx, wayId, p, t) {
  let best = null
  for (const s of idx.query(p, 50)) {
    if (s.wayId === wayId) continue
    const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], L = Math.hypot(dx, dz)
    if (!L || Math.abs((dx / L) * t[0] + (dz / L) * t[1]) < PARALLEL) continue
    const f = Math.max(0, Math.min(1, ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dz) / (L * L)))
    const q = [s.a[0] + dx * f, s.a[1] + dz * f], d = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (d >= PAIR_MIN && d <= PAIR_MAX && (!best || d < best.d)) best = { wayId: s.wayId, pt: q, d }
  }
  return best
}

export function planBents(pieces, { spacing = BENT_SPACING_M, outset = POST_OUTSET_M, singleHalf = SINGLE_HALF_SPAN_M } = {}) {
  const segs = []
  for (const p of pieces) for (let i = 0; i < p.pts.length - 1; i++) {
    const a = p.pts[i], b = p.pts[i + 1]
    segs.push({ wayId: p.wayId, a: [a[0], a[2]], b: [b[0], b[2]], mid: [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2] })
  }
  const idx = buildGridIndex(segs, 50, (s) => s.mid)
  const bents = []
  for (const p of pieces) {
    let d = spacing / 2
    for (let i = 0; i < p.pts.length - 1; i++) {
      const A = p.pts[i], B = p.pts[i + 1], L = Math.hypot(B[0] - A[0], B[2] - A[2])
      if (L < 1e-6) continue
      const t = [(B[0] - A[0]) / L, (B[2] - A[2]) / L], side = [-t[1], t[0]]
      for (; d < L; d += spacing) {
        const f = d / L, x = A[0] + (B[0] - A[0]) * f, z = A[2] + (B[2] - A[2]) * f, y = A[1] + (B[1] - A[1]) * f
        const partner = nearestParallel(idx, p.wayId, [x, z], t)
        if (partner && partner.wayId < p.wayId) continue // the partner track plants this bent
        if (partner) {
          const u = [(partner.pt[0] - x) / partner.d, (partner.pt[1] - z) / partner.d]
          bents.push({ a: [x - u[0] * outset, z - u[1] * outset], b: [partner.pt[0] + u[0] * outset, partner.pt[1] + u[1] * outset], y, dir: t })
        } else {
          bents.push({ a: [x + side[0] * singleHalf, z + side[1] * singleHalf], b: [x - side[0] * singleHalf, z - side[1] * singleHalf], y, dir: t })
        }
      }
      d -= L
    }
  }
  return bents
}
