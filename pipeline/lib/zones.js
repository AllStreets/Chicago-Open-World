// pipeline/lib/zones.js — the LIVE lens's neighbourhoods (P4 · I-4.3): official boundaries (City of Chicago
// y6yq-dbs2, pri_neigh) joined to curated profiles, each measured for its feel — places, stations, parks, roads.
import polygonClipping from 'polygon-clipping'
import { pointInRing, distToRing, signedArea, ringCentroid, simplifyRing } from './geom.js'
import { feelScores } from './feel.js'

const MAJOR = /^(motorway|trunk|primary|secondary)(_link)?$/
const WALK_EDGE_M = 600

// An interior point for the label: the grid point farthest from the edge (a pole-of-inaccessibility approximation).
export function labelPoint(ring) {
  const c = ringCentroid(ring)
  let best = pointInRing(c, ring) ? c : null, bestD = best ? distToRing(c, ring) : -1
  const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1])
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]
  for (let i = 1; i < 24; i++) for (let j = 1; j < 24; j++) {
    const p = [x0 + ((x1 - x0) * i) / 24, z0 + ((z1 - z0) * j) / 24]
    if (!pointInRing(p, ring)) continue
    const d = distToRing(p, ring)
    if (d > bestD) { best = p; bestD = d }
  }
  return best ?? c
}

const closed = (r) => [...r, r[0]]
export function zoneStats(ring, { pois = [], stations = [], parks = [], roads = [] }) {
  const areaM2 = Math.abs(signedArea(ring)), areaKm2 = areaM2 / 1e6
  const poiCounts = {}
  for (const p of pois) if (pointInRing([p.x, p.z], ring)) poiCounts[p.cat] = (poiCounts[p.cat] ?? 0) + 1
  // an L stop inside the zone or a short walk (600 m) past its edge serves it
  const inside = stations.filter((s) => (s.operator ?? 'cta') === 'cta' && (pointInRing([s.x, s.z], ring) || distToRing([s.x, s.z], ring) <= WALK_EDGE_M))
  const lineCount = new Set(inside.flatMap((s) => s.lines ?? [])).size
  let park = 0
  for (const pk of parks) {
    for (const poly of polygonClipping.intersection([closed(ring)], [closed(pk)])) park += Math.abs(signedArea(poly[0].slice(0, -1))) - poly.slice(1).reduce((a, h) => a + Math.abs(signedArea(h.slice(0, -1))), 0)
  }
  let roadM = 0
  for (const line of roads) for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1]
    if (pointInRing([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ring)) roadM += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return { areaKm2, poiCounts, stationCount: inside.length, lineCount, parkShare: Math.min(1, park / Math.max(1, areaM2)), majorRoadKmPerKm2: roadM / 1000 / Math.max(1e-6, areaKm2) }
}

// CTA lines within 800 m of the zone (inside it or past its edge), the stop nearest the label first (C17)
function linesNear(ring, [x, z], stations, maxM = 800) {
  const out = []
  const near = (s) => pointInRing([s.x, s.z], ring) || distToRing([s.x, s.z], ring) <= maxM
  for (const s of stations.filter((s) => (s.operator ?? 'cta') === 'cta' && near(s)).map((s) => ({ s, d: Math.hypot(s.x - x, s.z - z) })).sort((a, b) => a.d - b.d))
    for (const l of s.s.lines ?? []) if (!out.includes(l)) out.push(l)
  return out
}

export function buildNeighborhoods({ features, curated, project, pois, stations, parks, roads, simplifyM = 6 }) {
  const zones = []
  for (const c of curated) {
    const f = features.find((x) => x.properties?.pri_neigh === c.pri_neigh)
    if (!f) continue
    const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates]
    // the largest part is the zone; its outer ring in local metres, gently simplified
    const rings = polys.map((p) => p[0].slice(0, -1).map(([lon, lat]) => project(lon, lat)))
    const main = rings.reduce((a, r) => (Math.abs(signedArea(r)) > Math.abs(signedArea(a)) ? r : a))
    const ring = simplifyRing(main, simplifyM).map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10])
    const stats = zoneStats(ring, { pois, stations, parks, roads })
    const label = labelPoint(ring).map((v) => Math.round(v))
    zones.push({ id: c.id, name: c.name, ring, label, areaKm2: Math.round(stats.areaKm2 * 100) / 100, character: c.character, vibe: c.vibe, rent: c.rent ?? null, lines: linesNear(ring, label, stations), sources: c.sources, chiId: c.chiId ?? null, stats })
  }
  const feel = feelScores(zones.map((z) => ({ id: z.id, ...z.stats })))
  for (const z of zones) { z.feel = feel[z.id]; delete z.stats }
  return { zones, generatedFrom: ['City of Chicago — Boundaries: Neighborhoods (y6yq-dbs2)', 'OpenStreetMap (ODbL) — places, parks, roads', 'CTA stations (transit.json)', 'Curated profiles — data/neighborhoods.curated.json'] }
}
