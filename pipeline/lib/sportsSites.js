// pipeline/lib/sportsSites.js — the V5 venues sidecar: seeded shuffles, packed anchors, plaza anchors, records.
import { pointInRing, ringBBox, ringCentroid, distToRing } from './geom.js'

// Seeded Fisher–Yates (mulberry32). Any prefix is a uniform sample, so the app shows density d
// by drawing the first d·N anchors.
export function shuffled(list, seed = 1) {
  let s = Math.imul(seed | 0, 2654435761) >>> 0 || 1
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// Int16 ×4 per anchor: dx·10, y·10, dz·10 (decimetres around the venue centre), yaw·10000.
export function encodeAnchors(anchors, center) {
  const a = new Int16Array(anchors.length * 4)
  anchors.forEach(([x, y, z, yaw], i) => {
    const q = [Math.round((x - center[0]) * 10), Math.round(y * 10), Math.round((z - center[1]) * 10), Math.round(yaw * 10000)]
    if (q.some((v) => v < -32768 || v > 32767)) throw new Error(`anchor ${i} out of Int16 range (${x}, ${y}, ${z}) around ${center}`)
    a.set(q, i * 4)
  })
  return Buffer.from(a.buffer)
}

const frac = (x) => x - Math.floor(x)
// Standing fans on the plaza around an arena: a jittered grid between `from` and `to` metres outside
// the hull, on free ground only, each facing the arena.
export function plazaAnchors(hull, { from = 5, to = 24, step = 1.6, max = 1200, seed = 1 } = {}, isFree = () => true) {
  const [cx, cz] = ringCentroid(hull), bb = ringBBox(hull), pts = []
  let k = 0
  for (let x = bb.minX - to; x <= bb.maxX + to; x += step) {
    for (let z = bb.minZ - to; z <= bb.maxZ + to; z += step) {
      k++
      const p = [x + (frac(k * 0.618034) - 0.5) * step * 0.6, z + (frac(k * 0.414214) - 0.5) * step * 0.6]
      if (pointInRing(p, hull)) continue
      const d = distToRing(p, hull)
      if (d < from || d > to || !isFree(p)) continue
      pts.push([+p[0].toFixed(2), 0.1, +p[1].toFixed(2), +Math.atan2(cx - p[0], cz - p[1]).toFixed(3)])
    }
  }
  return shuffled(pts, seed).slice(0, max)
}

export function venueRecord(hero, hull, info) {
  const s = hero.sports
  const center = ringCentroid(hull).map((v) => +v.toFixed(1))
  const radius = Math.round(Math.max(...hull.map((p) => Math.hypot(p[0] - center[0], p[1] - center[1]))) + 20)
  return {
    key: hero.key, name: hero.name, kind: s.kind, slot: s.slot, teams: s.teams, capacity: s.capacity, center, radius,
    frame: info?.frame ?? null, boards: info?.boards ?? [], flagPole: info?.flagPole ?? null,
    marquee: info?.marquee ?? null,
    seats: info ? `venues/${hero.key}.seats.bin` : null, seatCount: info?.seats?.length ?? 0,
    plaza: null, plazaCount: 0,
    ...(s.crown ? { crown: crownRecord(s.crown, hull, center) } : {}),
  }
}

// E3-1: a guide board on an arena roof (heroes.json sports.crown) — a four-faced LED cube on a mast at the roof
// centre, and an LED ribbon ring pushed `outM` outside the walls (each vertex along its corner bisector, so every
// side sits exactly outM out). Heights in metres above grade; the app draws it (sports/ArenaCrown.jsx).
export function crownRecord(c, hull, center) {
  const [w, h] = c.faceM
  const r1 = (v) => +v.toFixed(1)
  const out = { center: [...center], roofY: c.roofM, mast: c.mastM, face: { w, h }, faceY: c.roofM + c.mastM + h / 2 }
  if (c.ribbon) {
    let area = 0
    for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; area += a[0] * b[1] - b[0] * a[1] }
    const sgn = area > 0 ? 1 : -1, n = hull.length
    // outward unit normal of edge i → i+1 (for a ring with the given winding)
    const normal = (i) => { const a = hull[i], b = hull[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return [(sgn * dz) / L, (-sgn * dx) / L] }
    const ring = hull.map((p, i) => {
      const n0 = normal((i - 1 + n) % n), n1 = normal(i), k = c.ribbon.outM / (1 + n0[0] * n1[0] + n0[1] * n1[1])
      return [r1(p[0] + (n0[0] + n1[0]) * k), r1(p[1] + (n0[1] + n1[1]) * k)]
    })
    out.ribbon = { ring, top: c.ribbon.topM, h: c.ribbon.hM }
  }
  return out
}
