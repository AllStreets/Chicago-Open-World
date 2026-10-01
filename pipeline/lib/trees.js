// pipeline/lib/trees.js — where a tree may stand: never inside a footprint (courtyards are open ground),
// never inside a venue, never in a landmark's clearing. Decisions are made on the rounded coordinates the
// sidecars store, so the check and the file can never disagree.
import { pointInRing, ringBBox } from './geom.js'
import { convexHull } from './venue.js'
import polygonClipping from 'polygon-clipping'
import { hashSeed } from './buildings.js'

// Arenas and plazas without a field mesh that must still stay clear.
export const TREE_FREE_HEROES = new Set(['unitedcenter', 'wintrust', 'buckingham'])

export const roundTree = ([x, z]) => [+x.toFixed(1), +z.toFixed(1)]

export function insideFootprint(p, b) {
  if (b.bbox && (p[0] < b.bbox.minX || p[0] > b.bbox.maxX || p[1] < b.bbox.minZ || p[1] > b.bbox.maxZ)) return false
  return b.polygons.some((q) => pointInRing(p, q.outer) && !(q.holes || []).some((h) => pointInRing(p, h)))
}

export const isVenue = (spec) => Boolean(spec && (spec.venue || spec.stands || TREE_FREE_HEROES.has(spec.key)))

export function venueZones(buildings, specFor) {
  return buildings
    .filter((b) => isVenue(specFor(b)))
    .map((b) => ({ key: specFor(b).key, ring: convexHull(b.polygons.flatMap((p) => p.outer)) }))
}

// A tree is its canopy, not its trunk (user fix: trees grew out of the BCG podium and through Soldier Field's
// colonnade). The canopy is CANOPY_M × the tree's scale — the same hash the tile writer uses for that scale.
export const CANOPY_M = 3.5
export const VENUE_MARGIN_M = 14 // colonnades, concourses and gates around a stadium's hull
export const RAIL_CLEAR_M = 2.4 // half a mainline right-of-way
export const treeScale = ([x, z]) => 0.8 + hashSeed(`${Math.round(x)}:${Math.round(z)}`) * 0.6
export const canopyRadius = (p) => CANOPY_M * treeScale(roundTree(p))

function segDist([px, pz], [ax, az], [bx, bz]) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0
  return Math.hypot(px - ax - t * dx, pz - az - t * dz)
}
export const ringDist = (p, ring) => ring.reduce((m, a, i) => Math.min(m, segDist(p, a, ring[(i + 1) % ring.length])), Infinity)
// inside the ring, or within r of its edge
const nearRing = (p, ring, r) => pointInRing(p, ring) || ringDist(p, ring) < r
// a canopy over any part of a footprint: inside its walls (not in a courtyard), or reaching any wall, courtyard walls
// included; a hero's built form (treeHull) counts too when it spills past the OSM outline
export function canopyOverFootprint(p, b, r) {
  if (b.bbox && (p[0] < b.bbox.minX - r || p[0] > b.bbox.maxX + r || p[1] < b.bbox.minZ - r || p[1] > b.bbox.maxZ + r) && !b.treeHull) return false
  if (insideFootprint(p, b)) return true
  if (b.polygons.some((q) => ringDist(p, q.outer) < r || (q.holes || []).some((h) => ringDist(p, h) < r))) return true
  return Boolean(b.treeHull && nearRing(p, b.treeHull, r))
}

export function filterTrees(points, { zones = [], clearings = [], nearBuildings = () => [], plazas = [], rails = () => [] } = {}) {
  const kept = [], removed = { venue: 0, clearing: 0, building: 0, plaza: 0, rail: 0 }
  for (const raw of points) {
    const p = roundTree(raw), r = canopyRadius(p)
    if (zones.some((z) => nearRing(p, z, r + VENUE_MARGIN_M))) removed.venue++
    else if (clearings.some((c) => nearRing(p, c, r))) removed.clearing++
    else if (plazas.some((q) => Math.hypot(p[0] - q.c[0], p[1] - q.c[1]) < q.r + r)) removed.plaza++
    else if (rails(p).some((line) => line.some((a, i) => i + 1 < line.length && segDist(p, a, line[i + 1]) < r + RAIL_CLEAR_M))) removed.rail++
    else if (nearBuildings(p).some((b) => canopyOverFootprint(p, b, r))) removed.building++
    else kept.push(p)
  }
  return { kept, removed }
}

export function assertNoVenueTrees(tileTrees, zones) {
  const bad = []
  for (const [key, trees] of tileTrees) for (const t of trees) for (const z of zones) {
    if (pointInRing([t[0], t[1]], z.ring)) bad.push(`${z.key} ${t[0]},${t[1]} (tile ${key})`)
  }
  if (bad.length) throw new Error(`trees inside venues (${bad.length}): ${bad.slice(0, 10).join('; ')}`)
}

// Polygons (by bbox centre) that lie outside every venue zone — mapped pitches inside a stadium are dropped,
// because the venue builder paints the real field.
export const outsideZones = (polys, zones) =>
  polys.filter((p) => !zones.some((z) => pointInRing([(p.bbox.minX + p.bbox.maxX) / 2, (p.bbox.minZ + p.bbox.maxZ) / 2], z)))

// Ground polygons (parks) with the venue hulls cut out: the ground's polygon offset would otherwise draw the park
// over a stadium field at oblique angles (V5: Soldier Field sits inside Burnham Park).
export function cutZones(polys, zones) {
  const out = []
  for (const p of polys) {
    const pb = p.bbox ?? ringBBox(p.outer)
    const hit = zones.filter((z) => { const b = ringBBox(z); return b.maxX > pb.minX && b.minX < pb.maxX && b.maxZ > pb.minZ && b.minZ < pb.maxZ })
    if (!hit.length) { out.push(p); continue }
    for (const [outer, ...holes] of polygonClipping.difference([p.outer, ...p.holes], ...hit.map((z) => [z]))) {
      const o = outer.slice(0, -1), h = holes.map((r) => r.slice(0, -1))
      out.push({ ...p, outer: o, holes: h, bbox: ringBBox(o) })
    }
  }
  return out
}
