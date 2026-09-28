// pipeline/lib/buildings.js — Socrata footprint rows → Building records, plus OSM joins.
import { project } from '../../shared/project.js'
import { openRing, simplifyRing, signedArea, pointInRing, ringBBox, ringCentroid } from './geom.js'
import { resolveHeight, parseHeightTag } from './height.js'

const MIN_AREA = 12
const SIMPLIFY_M = 0.3

export function hashSeed(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0) / 4294967296
}

const title = (s) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
const clean = (s) => (s && s.trim() ? s.trim() : null)

function toRing(lonlat) {
  return simplifyRing(openRing(lonlat.map(([lon, lat]) => project(lon, lat))), SIMPLIFY_M)
}

export function normalizeFootprint(r) {
  if (r.bldg_statu && r.bldg_statu !== 'ACTIVE') return null
  const g = r.the_geom
  if (!g || !g.coordinates) return null
  const polysLL = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  const polygons = polysLL.map(([outer, ...holes]) => ({ outer: toRing(outer), holes: holes.map(toRing) }))
  const area = polygons.reduce((s, p) =>
    s + Math.abs(signedArea(p.outer)) - p.holes.reduce((t, h) => t + Math.abs(signedArea(h)), 0), 0)
  if (area < MIN_AREA) return null
  const main = polygons.reduce((a, b) => (Math.abs(signedArea(b.outer)) > Math.abs(signedArea(a.outer)) ? b : a))
  const allPts = polygons.flatMap((p) => p.outer)
  const num = parseInt(r.f_add1, 10)
  const street = [r.pre_dir1, clean(r.st_name1) && title(r.st_name1), clean(r.st_type1) && title(r.st_type1)].filter(Boolean).join(' ')
  const year = parseInt(r.year_built, 10)
  const stories = parseInt(r.stories, 10)
  return {
    id: String(r.bldg_id),
    name: clean(r.bldg_name1) ? title(r.bldg_name1.trim()) : null,
    address: num > 0 && street ? `${num} ${street}` : null,
    stories: stories > 0 ? stories : null,
    year: year > 1800 ? year : null,
    polygons,
    area,
    centroid: ringCentroid(main.outer),
    bbox: ringBBox(allPts),
    height: resolveHeight({ stories: r.stories }),
    parts: null,
  }
}

function containing(buildings, pt) {
  for (const b of buildings) {
    const { minX, minZ, maxX, maxZ } = b.bbox
    if (pt[0] < minX || pt[0] > maxX || pt[1] < minZ || pt[1] > maxZ) continue
    if (b.polygons.some((p) => pointInRing(pt, p.outer))) return b
  }
  return null
}

export function attachOsmHeights(buildings, osmBuildings) {
  for (const o of osmBuildings) {
    const b = containing(buildings, o.center)
    if (!b) continue
    b.height = resolveHeight({ osmHeight: o.tags.height, osmLevels: o.tags['building:levels'], stories: b.stories })
  }
}

export function applyBuildingParts(buildings, osmParts) {
  const byBuilding = new Map()
  for (const p of osmParts) {
    const b = containing(buildings, p.center)
    if (!b) continue
    if (!byBuilding.has(b)) byBuilding.set(b, [])
    byBuilding.get(b).push({
      outer: p.outer,
      holes: p.holes,
      base: parseHeightTag(p.tags.min_height) ?? 0,
      top: resolveHeight({ osmHeight: p.tags.height, osmLevels: p.tags['building:levels'] }),
    })
  }
  for (const [b, parts] of byBuilding) {
    b.parts = parts
    const covered = parts.filter((p) => p.base === 0)
      .reduce((s, p) => s + Math.abs(signedArea(p.outer)), 0)
    b.height = covered / b.area >= 0.8 ? 0 : Math.min(b.height, ...parts.map((p) => p.top))
  }
}
