// pipeline/lib/trees.js — where a tree may stand: never inside a footprint (courtyards are open ground),
// never inside a venue, never in a landmark's clearing. Decisions are made on the rounded coordinates the
// sidecars store, so the check and the file can never disagree.
import { pointInRing } from './geom.js'
import { convexHull } from './venue.js'

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

export function filterTrees(points, { zones = [], clearings = [], nearBuildings = () => [] } = {}) {
  const kept = [], removed = { venue: 0, clearing: 0, building: 0 }
  for (const raw of points) {
    const p = roundTree(raw)
    if (zones.some((z) => pointInRing(p, z))) removed.venue++
    else if (clearings.some((c) => pointInRing(p, c))) removed.clearing++
    else if (nearBuildings(p).some((b) => insideFootprint(p, b))) removed.building++
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
