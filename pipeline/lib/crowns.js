// pipeline/lib/crowns.js — landmark crown primitives (spires, antennas, pyramids, drums, sloped "diamond" tops).
// Each returns a raw non-indexed mesh { positions, normals, uvs } in world metres.
import earcut from 'earcut'
import polygonClipping from 'polygon-clipping'
import { ringCentroid, ringBBox, pointInRing, distToRing } from './geom.js'
import { insetRing } from './roofs.js'

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

// ── arena roofs (V5, D2) ─────────────────────────────────────────────────────
function densify(ring, step) {
  const out = []
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step))
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
  }
  return out
}
// Curved top over `ring`, lifted by h(p): a grid of `step`-metre cells aligned on the centroid, each clipped to the
// ring and triangulated locally, so no triangle is longer than a cell (long slivers shade in streaks). Returns the
// ring's edge densified every `step` m (for the skirt walls).
function liftedTop(out, ring, h, step) {
  const edge = densify(ring, step), bb = ringBBox(ring), [cx, cz] = ringCentroid(ring)
  const closed = [[...ring, ring[0]]]
  const x0 = cx - Math.ceil((cx - bb.minX) / step) * step, z0 = cz - Math.ceil((cz - bb.minZ) / step) * step
  const from = out.positions.length
  for (let x = x0; x < bb.maxX; x += step) {
    for (let z = z0; z < bb.maxZ; z += step) {
      const cell = [[[x, z], [x + step, z], [x + step, z + step], [x, z + step], [x, z]]]
      for (const poly of polygonClipping.intersection(cell, closed)) {
        const flat = [], holes = []
        poly.forEach((r, k) => { if (k) holes.push(flat.length / 2); for (const q of r.slice(0, -1)) flat.push(q[0], q[1]) })
        const t = earcut(flat, holes.length ? holes : undefined, 2)
        const P = (k) => [flat[k * 2], h([flat[k * 2], flat[k * 2 + 1]]), flat[k * 2 + 1]]
        for (let i = 0; i < t.length; i += 3) tri(out, P(t[i]), P(t[i + 1]), P(t[i + 2]), [cx, -1e5, cz], (q) => [q[0], q[2]])
      }
    }
  }
  // smooth shading: each vertex takes the surface normal of h (central differences), so the grid doesn't facet
  // (one-sided at the edge, where a central difference would straddle the eave and halve the slope)
  const e = 0.05, inside = (q) => pointInRing(q, ring) && distToRing(q, ring) > 1e-6
  const d = (p, v) => {
    const a = [p[0] + v[0], p[1] + v[1]], b = [p[0] - v[0], p[1] - v[1]], ia = inside(a), ib = inside(b)
    return ia === ib ? (h(a) - h(b)) / (2 * e) : ia ? (h(a) - h(p)) / e : (h(p) - h(b)) / e
  }
  for (let i = from; i < out.positions.length; i += 3) {
    const p0 = [out.positions[i], out.positions[i + 2]], p = [p0[0] + (cx - p0[0]) * 1e-3, p0[1] + (cz - p0[1]) * 1e-3] // off the edge lines
    const nx = -d(p, [e, 0]), nz = -d(p, [0, e]), l = Math.hypot(nx, 1, nz)
    out.normals[i] = nx / l; out.normals[i + 1] = 1 / l; out.normals[i + 2] = nz / l
  }
  return edge
}
// Walls from `base` up to h(p) around a densified edge (skipped where the roof meets the eave).
function skirt(out, edge, base, h) {
  const [cx, cz] = ringCentroid(edge), c = [cx, base, cz]
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i], b = edge[(i + 1) % edge.length], ha = h(a), hb = h(b)
    // each half of the wall quad only where its own vertical edge has height (no zero-area slivers at the eaves)
    if (ha - base > 1e-3) tri(out, [a[0], base, a[1]], [b[0], base, b[1]], [a[0], ha, a[1]], c)
    if (hb - base > 1e-3) tri(out, [b[0], base, b[1]], [b[0], hb, b[1]], [a[0], ha, a[1]], c)
  }
}
// Flat annulus between an outer ring and an inner ring at height y.
function ledge(out, outer, inner, y) {
  const flat = [...outer.flat(), ...inner.flat()]
  const t = earcut(flat, [outer.length], 2)
  const [cx, cz] = ringCentroid(outer)
  const P = (k) => [flat[k * 2], y, flat[k * 2 + 1]]
  for (let i = 0; i < t.length; i += 3) tri(out, P(t[i]), P(t[i + 1]), P(t[i + 2]), [cx, -1e5, cz], (q) => [q[0], q[2]])
}

// Barrel vault (Wintrust Arena): the ridge runs along `axis` through the centroid.
export function vault({ ring, base, rise, axis = [0, -1], step = 4 }) {
  const out = mesh()
  const l = Math.hypot(axis[0], axis[1]) || 1, perp = [-axis[1] / l, axis[0] / l]
  const [cx, cz] = ringCentroid(ring)
  const across = (p) => (p[0] - cx) * perp[0] + (p[1] - cz) * perp[1]
  const half = Math.max(...ring.map((p) => Math.abs(across(p)))) || 1
  const h = (p) => base + rise * Math.max(0, 1 - (across(p) / half) ** 2)
  const edge = liftedTop(out, ring, h, step)
  skirt(out, edge, base, h)
  return out
}

// Stepped dome (United Center): ledge + vertical step per entry in `steps`, then a smooth dome over the last ring.
export function stepdome({ ring, base, steps = [], domeRise, step = 4 }) {
  const out = mesh()
  let r = ring, y = base
  for (const s of steps) {
    const inner = insetRing(r, s.inset)
    ledge(out, r, inner, y)
    const top = y + s.rise
    skirt(out, densify(inner, step), y, () => top)
    r = inner; y = top
  }
  // an elliptic paraboloid over the inner ring's box: smooth everywhere (a distance-to-edge dome creases like a hip roof)
  const bb = ringBBox(r), cx = (bb.minX + bb.maxX) / 2, cz = (bb.minZ + bb.maxZ) / 2, hx = (bb.maxX - bb.minX) / 2 || 1, hz = (bb.maxZ - bb.minZ) / 2 || 1
  const h = (p) => y + domeRise * Math.max(0, 1 - ((p[0] - cx) / hx) ** 2 - ((p[1] - cz) / hz) ** 2)
  liftedTop(out, r, h, step)
  return out
}
