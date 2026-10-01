// pipeline/lib/trackClearance.js — no building stands on an at-grade or elevated track (user, 2026-09-30). OSM
// footprints sometimes overlap a line's right-of-way (an offset trace, a building drawn across the tracks); those are
// dropped. Subway segments are ignored (buildings stand over the tubes), and real air-rights structures are kept:
// landmark heroes, station buildings, buildings that bridge over things, and the big terminals over the rail yards.
import { pointInRing } from './geom.js'

export const TRACK_HALF_WIDTH_M = 2.0 // per track: a car's half-width (1.4 m) plus a margin — buildings that abut the L structure stay
const ABOVE_Y = -1                     // rail top above this is at grade, on an embankment or elevated
const TERMINAL_M2 = 20000

const distSeg = ([px, pz], [ax, az], [bx, bz]) => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
const segsCross = (a, b, c, d) => cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0

function exempt(b) {
  const t = b.tags ?? {}
  if (b.hero || b.bridgeKey || (b.area ?? 0) >= TERMINAL_M2) return true
  if (/^(train_station|transportation|station)$/.test(t.building ?? '') || t.railway === 'station' || t.public_transport === 'station') return true
  if (Number(t['building:min_level'] ?? 0) > 0 || parseFloat(t.min_height ?? '0') > 0 || Number(t.layer ?? 0) >= 1) return true
  return false
}

// The building's footprint touches the corridor: a vertex within the half-width of a track segment, the segment
// crossing an edge, or the segment running through the inside.
function touches(b, segs, hw) {
  for (const { outer } of b.polygons) {
    const n = outer.length
    for (const [a, c] of segs) {
      if (pointInRing(a, outer) || pointInRing(c, outer)) return true
      for (let i = 0; i < n; i++) {
        const p = outer[i], q = outer[(i + 1) % n]
        if (distSeg(p, a, c) <= hw || distSeg(a, p, q) <= hw || distSeg(c, p, q) <= hw || segsCross(a, c, p, q)) return true
      }
    }
  }
  return false
}

export function buildingsOverTracks(buildings, routes, { halfWidth = TRACK_HALF_WIDTH_M, cell = 200 } = {}) {
  // track segments above ground, bucketed on a coarse grid
  const grid = new Map(), key = (i, j) => `${i},${j}`
  for (const r of routes ?? []) {
    const p = r.path ?? []
    for (let k = 1; k < p.length; k++) {
      if (p[k - 1][1] <= ABOVE_Y && p[k][1] <= ABOVE_Y) continue
      const a = [p[k - 1][0], p[k - 1][2]], c = [p[k][0], p[k][2]]
      const i0 = Math.floor((Math.min(a[0], c[0]) - halfWidth) / cell), i1 = Math.floor((Math.max(a[0], c[0]) + halfWidth) / cell)
      const j0 = Math.floor((Math.min(a[1], c[1]) - halfWidth) / cell), j1 = Math.floor((Math.max(a[1], c[1]) + halfWidth) / cell)
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const kk = key(i, j); if (!grid.has(kk)) grid.set(kk, []); grid.get(kk).push([a, c]) }
    }
  }
  const out = []
  for (const b of buildings) {
    if (exempt(b)) continue
    const xs = b.polygons.flatMap((p) => p.outer.map((q) => q[0])), zs = b.polygons.flatMap((p) => p.outer.map((q) => q[1]))
    const segs = new Set()
    for (let i = Math.floor((Math.min(...xs) - halfWidth) / cell); i <= Math.floor((Math.max(...xs) + halfWidth) / cell); i++)
      for (let j = Math.floor((Math.min(...zs) - halfWidth) / cell); j <= Math.floor((Math.max(...zs) + halfWidth) / cell); j++)
        for (const s of grid.get(key(i, j)) ?? []) segs.add(s)
    if (segs.size && touches(b, [...segs], halfWidth)) out.push(b)
  }
  return out
}
