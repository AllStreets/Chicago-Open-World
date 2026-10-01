// pipeline/lib/trackClearance.js — no building stands in a track's right-of-way (user, 2026-09-30). OSM footprints
// sometimes overlap a line's structure — a building drawn across the tracks, or a wall through the elevated's deck.
// Each at-grade, embankment or elevated track gets a corridor as wide as its structure plus a margin for trace
// offsets; footprints (and their extrusion pieces) are cut back to the corridor edge, and a building left with less
// than half its footprint is removed. Subway segments carry no corridor (buildings stand over the tubes), and real
// air-rights structures are kept: landmark heroes, station buildings, bridging structures, and the big terminals.
import polygonClipping from 'polygon-clipping'
import { signedArea, ringCentroid, ringBBox } from './geom.js'

// half-widths from a track centreline. The CTA deck's walkway reaches 2.7 m (transit/structure.js WALKWAY), the bents
// 1.6 m past the outer track; the ballast foot 2.2 m (BED.foot). The rest is clearance for OSM trace offsets.
export const CORRIDOR_HW = { elevated: 5, atGrade: 4 }
const SUBWAY_BELOW_Y = -1
const RAISED_Y = 2
const TERMINAL_M2 = 20000, MIN_PIECE_M2 = 20, KEEP_SHARE = 0.5
const CELL = 200

function exempt(b) {
  const t = b.tags ?? {}
  if (b.hero || (b.area ?? 0) >= TERMINAL_M2) return true
  if (/^(train_station|transportation|station)$/.test(t.building ?? '') || t.railway === 'station' || t.public_transport === 'station') return true
  return Number(t['building:min_level'] ?? 0) > 0 || parseFloat(t.min_height ?? '0') > 0 || Number(t.layer ?? 0) >= 1
}

// a rectangle around one track segment (ends extended by the half-width, so consecutive segments overlap at bends)
function segRect([ax, az], [bx, bz], hw) {
  const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l, nx = -uz * hw, nz = ux * hw
  const a = [ax - ux * hw, az - uz * hw], b = [bx + ux * hw, bz + uz * hw]
  return [[[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz], [a[0] + nx, a[1] + nz]]]
}

const ringArea = (r) => Math.abs(signedArea(r))
const toRing = (closed) => closed.slice(0, -1)
const closeRing = (r) => [...r, r[0]]

// the parts of a polygon outside the corridor, as { outer, holes } with any sliver dropped
function subtract(poly, corridor) {
  const res = polygonClipping.difference([closeRing(poly.outer), ...(poly.holes ?? []).map(closeRing)], ...corridor)
  return res.map((p) => ({ outer: toRing(p[0]), holes: p.slice(1).map(toRing) })).filter((p) => ringArea(p.outer) - p.holes.reduce((s, h) => s + ringArea(h), 0) >= MIN_PIECE_M2)
}
const polyArea = (p) => ringArea(p.outer) - (p.holes ?? []).reduce((s, h) => s + ringArea(h), 0)

export function clearTracks(buildings, routes) {
  // corridor rectangles per track segment above ground, bucketed on a coarse grid
  const grid = new Map(), key = (i, j) => `${i},${j}`
  for (const r of routes ?? []) {
    const p = r.path ?? []
    for (let k = 1; k < p.length; k++) {
      const y = Math.max(p[k - 1][1], p[k][1])
      if (y <= SUBWAY_BELOW_Y) continue
      const hw = y > RAISED_Y ? CORRIDOR_HW.elevated : CORRIDOR_HW.atGrade
      const a = [p[k - 1][0], p[k - 1][2]], c = [p[k][0], p[k][2]], rect = segRect(a, c, hw)
      const bb = ringBBox(rect[0])
      for (let i = Math.floor(bb.minX / CELL); i <= Math.floor(bb.maxX / CELL); i++) for (let j = Math.floor(bb.minZ / CELL); j <= Math.floor(bb.maxZ / CELL); j++) {
        const kk = key(i, j); if (!grid.has(kk)) grid.set(kk, []); grid.get(kk).push({ rect, bb })
      }
    }
  }
  const removed = new Set()
  let clipped = 0
  for (const b of buildings) {
    if (exempt(b)) continue
    const bb = ringBBox(b.polygons.flatMap((p) => p.outer))
    const near = new Set()
    for (let i = Math.floor(bb.minX / CELL); i <= Math.floor(bb.maxX / CELL); i++) for (let j = Math.floor(bb.minZ / CELL); j <= Math.floor(bb.maxZ / CELL); j++)
      for (const s of grid.get(key(i, j)) ?? []) if (s.bb.maxX > bb.minX && s.bb.minX < bb.maxX && s.bb.maxZ > bb.minZ && s.bb.minZ < bb.maxZ) near.add(s.rect)
    if (!near.size) continue
    const corridor = [...near]
    const before = b.polygons.reduce((s, p) => s + polyArea(p), 0)
    const polys = b.polygons.flatMap((p) => subtract(p, corridor))
    const after = polys.reduce((s, p) => s + polyArea(p), 0)
    if (after >= before - 0.5) continue // the corridor doesn't reach it
    if (!polys.length || after < KEEP_SHARE * before) { removed.add(b); continue }
    // cut back: the footprint, and every extrusion piece (parts keep their own heights)
    b.polygons = polys
    if (b.pieces) b.pieces = b.pieces.flatMap((pc) => subtract(pc, corridor).map((q) => ({ ...pc, outer: q.outer, holes: q.holes })))
    if (b.pieces && !b.pieces.length) { removed.add(b); continue }
    const main = polys.reduce((a, p) => (polyArea(p) > polyArea(a) ? p : a))
    b.area = after; b.centroid = ringCentroid(main.outer); b.bbox = ringBBox(polys.flatMap((p) => p.outer))
    clipped++
  }
  return { removed, clipped }
}
