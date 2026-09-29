// pipeline/lib/crowns.js — landmark crown primitives (spires, antennas, pyramids, drums, sloped "diamond" tops).
// Each returns a raw non-indexed mesh { positions, normals, uvs } in world metres.
import earcut from 'earcut'
import { ringCentroid } from './geom.js'

function mesh() { return { positions: [], normals: [], uvs: [] } }

// Push a triangle, oriented so its normal points away from `center` (convex solids).
function tri(out, a, b, c, center, uv = null) {
  let u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  const m = [(a[0] + b[0] + c[0]) / 3 - center[0], (a[1] + b[1] + c[1]) / 3 - center[1], (a[2] + b[2] + c[2]) / 3 - center[2]]
  if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0) { [b, c] = [c, b]; n = n.map((x) => -x) }
  const l = Math.hypot(...n) || 1
  for (const p of [a, b, c]) {
    out.positions.push(...p); out.normals.push(n[0] / l || 0, n[1] / l || 0, n[2] / l || 0)
    out.uvs.push(...(uv ? uv(p) : [p[0] + p[2], p[1]]))
  }
}

const circle = ([x, z], r, sides) => Array.from({ length: sides }, (_, i) => {
  const t = (i / sides) * Math.PI * 2
  return [x + r * Math.cos(t), z + r * Math.sin(t)]
})

function frustum({ at, base, top, r0, r1, sides, cap }) {
  const out = mesh(), center = [at[0], (base + top) / 2, at[1]]
  const lo = circle(at, r0, sides), hi = r1 > 0 ? circle(at, r1, sides) : null
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides
    const a0 = [lo[i][0], base, lo[i][1]], b0 = [lo[j][0], base, lo[j][1]]
    if (hi) {
      const a1 = [hi[i][0], top, hi[i][1]], b1 = [hi[j][0], top, hi[j][1]]
      tri(out, a0, b0, a1, center); tri(out, b0, b1, a1, center)
      if (cap) tri(out, a1, b1, [at[0], top, at[1]], [at[0], top - 1, at[1]], (p) => [p[0], p[2]])
    } else tri(out, a0, b0, [at[0], top, at[1]], center)
  }
  return out
}

export const spire = ({ at, base, top, r0, r1 = 0, sides = 12 }) => frustum({ at, base, top, r0, r1, sides, cap: r1 > 0 })
export const antenna = ({ at, base, top, r = 0.9 }) => frustum({ at, base, top, r0: r, r1: r * 0.6, sides: 8, cap: true })
export const drum = ({ at, base, top, r, sides = 24 }) => frustum({ at, base, top, r0: r, r1: r, sides, cap: true })

export function pyramid({ ring, base, top }) {
  const out = mesh(), [cx, cz] = ringCentroid(ring), apex = [cx, top, cz], center = [cx, base, cz]
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]
    tri(out, [a[0], base, a[1]], [b[0], base, b[1]], apex, center, (p) => [p[0] + p[2], p[1]])
  }
  return out
}

export function sloped({ ring, base, lowTop, highTop, dir }) {
  const out = mesh(), [cx, cz] = ringCentroid(ring)
  const dl = Math.hypot(dir[0], dir[1]) || 1, d = [dir[0] / dl, dir[1] / dl]
  const proj = ring.map(([x, z]) => x * d[0] + z * d[1])
  const pMin = Math.min(...proj), pMax = Math.max(...proj)
  const h = ([x, z]) => lowTop + (highTop - lowTop) * ((x * d[0] + z * d[1] - pMin) / (pMax - pMin || 1))
  const center = [cx, (base + lowTop) / 2, cz]
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]
    const a0 = [a[0], base, a[1]], b0 = [b[0], base, b[1]], a1 = [a[0], h(a), a[1]], b1 = [b[0], h(b), b[1]]
    tri(out, a0, b0, a1, center); tri(out, b0, b1, a1, center)
  }
  const flat = ring.flat(), t = earcut(flat, undefined, 2)
  const topCenter = [cx, base, cz]
  for (let i = 0; i < t.length; i += 3) {
    const p = (k) => [flat[k * 2], h([flat[k * 2], flat[k * 2 + 1]]), flat[k * 2 + 1]]
    tri(out, p(t[i]), p(t[i + 1]), p(t[i + 2]), topCenter, (q) => [q[0], q[2]])
  }
  return out
}
