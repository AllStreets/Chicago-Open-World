// pipeline/lib/aqua.js — Aqua's waves (I-3.1): one white concrete slab per floor whose edge swells out to a
// balcony and sinks back flush, varying smoothly floor to floor, so the tower reads as rippling water; the flush
// "pools" are where the glass shows. Parameters are sourced in heroes.json (aqua.sculptParams).
import { readFileSync } from 'node:fs'
import { pointInRing } from './geom.js'

const hero = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes.find((h) => h.key === 'aqua')
const sp = hero?.sculptParams ?? {}
export const AQUA = { floors: sp.floors ?? 82, heightM: hero?.heightM ?? 261.8, podiumM: sp.podiumM ?? 24, minDepth: sp.minDepth ?? 0.3, maxDepth: sp.maxDepth ?? 3.7, thickness: sp.thickness ?? 0.25 }

const TAU = Math.PI * 2
// three travelling waves around the perimeter (whole numbers of waves, so t = 0 and t = 1 meet), drifting slowly
// with height; below the pool threshold the slab stays flush
const POOL = -0.3
export function aquaOffset(floor, t, seed = 1) {
  const raw = 0.5 * Math.sin(TAU * (2 * t + floor / 47) + seed)
    + 0.3 * Math.sin(TAU * (3 * t - floor / 31) + 2 * seed)
    + 0.2 * Math.sin(TAU * (5 * t + floor / 23) + 3 * seed)
  const u = Math.min(1, Math.max(0, (raw - POOL) / (1 - POOL)))
  return AQUA.minDepth + (AQUA.maxDepth - AQUA.minDepth) * u
}

// Points around the ring at even arc-length steps plus every corner, each with its outward unit normal
// (corners take the mitred normal, so the slab edge stays parallel to both walls).
function perimeterSamples(ring, samples) {
  const n = ring.length, seg = []
  let L = 0
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1])
    seg.push({ a, b, len, from: L }); L += len
  }
  // outward: test the first edge's left normal against the ring
  const s0 = seg.find((s) => s.len > 1e-6), mid = [(s0.a[0] + s0.b[0]) / 2, (s0.a[1] + s0.b[1]) / 2]
  const left = [-(s0.b[1] - s0.a[1]) / s0.len, (s0.b[0] - s0.a[0]) / s0.len]
  const sign = pointInRing([mid[0] + left[0] * 0.01, mid[1] + left[1] * 0.01], ring) ? -1 : 1
  const edgeN = (s) => [sign * -(s.b[1] - s.a[1]) / s.len, sign * (s.b[0] - s.a[0]) / s.len]
  const out = []
  seg.forEach((s, k) => {
    if (s.len < 1e-6) return
    const prev = seg[(k - 1 + n) % n], np = prev.len > 1e-6 ? edgeN(prev) : edgeN(s), ns = edgeN(s)
    const m = [np[0] + ns[0], np[1] + ns[1]], ml = Math.hypot(...m) || 1, cosH = (m[0] * ns[0] + m[1] * ns[1]) / ml
    out.push({ p: s.a, n: [m[0] / ml / Math.max(0.35, cosH), m[1] / ml / Math.max(0.35, cosH)], t: s.from / L })
    const steps = Math.max(1, Math.round((s.len / L) * samples))
    for (let j = 1; j < steps; j++) {
      const f = j / steps
      out.push({ p: [s.a[0] + (s.b[0] - s.a[0]) * f, s.a[1] + (s.b[1] - s.a[1]) * f], n: ns, t: (s.from + s.len * f) / L })
    }
  })
  return out
}

function pushTri(m, a, b, c, n) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  if (Math.hypot(...cr) < 1e-9) return
  if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) [b, c] = [c, b]
  for (const p of [a, b, c]) { m.positions.push(...p); m.normals.push(...n); m.uvs.push(p[0] + p[2], p[1]) }
}

export function aquaSlabs(ring, { floors = AQUA.floors, floorH, baseY = AQUA.podiumM, samples = 96, thickness = AQUA.thickness, seed = 1 }) {
  const m = { positions: [], normals: [], uvs: [] }
  const S = perimeterSamples(ring, samples)
  for (let f = 0; f < floors; f++) {
    const top = baseY + (f + 1) * floorH, bot = top - thickness
    const q = S.map(({ p, n, t }) => { const d = aquaOffset(f, t, seed); return [p[0] + n[0] * d, p[1] + n[1] * d] })
    for (let i = 0; i < S.length; i++) {
      const j = (i + 1) % S.length, pi = S[i].p, pj = S[j].p
      for (const [y, ny] of [[top, 1], [bot, -1]]) {
        pushTri(m, [pi[0], y, pi[1]], [pj[0], y, pj[1]], [q[j][0], y, q[j][1]], [0, ny, 0])
        pushTri(m, [pi[0], y, pi[1]], [q[j][0], y, q[j][1]], [q[i][0], y, q[i][1]], [0, ny, 0])
      }
      // the slab edge, facing out
      const ex = q[j][0] - q[i][0], ez = q[j][1] - q[i][1], el = Math.hypot(ex, ez)
      if (el < 1e-6) continue
      let on = [ez / el, 0, -ex / el]
      const avg = [S[i].n[0] + S[j].n[0], S[i].n[1] + S[j].n[1]]
      if (on[0] * avg[0] + on[2] * avg[1] < 0) on = on.map((k) => -k)
      pushTri(m, [q[i][0], bot, q[i][1]], [q[j][0], bot, q[j][1]], [q[j][0], top, q[j][1]], on)
      pushTri(m, [q[i][0], bot, q[i][1]], [q[j][0], top, q[j][1]], [q[i][0], top, q[i][1]], on)
    }
  }
  return m
}
