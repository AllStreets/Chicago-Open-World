// pipeline/lib/osm.js — OSM building elements → Building records (primary source since City data froze in 2015).
import { project } from '../../shared/project.js'
import { openRing, simplifyRing, signedArea, pointInRing, ringBBox, ringCentroid } from './geom.js'
import { assembleRings } from './multipolygon.js'
import { parseHeightTag, FLOOR_M, MAX_HEIGHT_M } from './height.js'

const MIN_AREA = 12
const TYPE_DEFAULTS = {
  house: 8, detached: 8, semidetached_house: 8, terrace: 9, garage: 4, garages: 4, shed: 3, carport: 3,
  apartments: 12, residential: 10, commercial: 8, retail: 6, industrial: 10, warehouse: 10,
  church: 16, school: 12, hospital: 20, stadium: 8, grandstand: 6, roof: 5,
}
export const defaultHeightFor = (tags = {}) => TYPE_DEFAULTS[tags.building] ?? 9

const toRing = (pts) => simplifyRing(openRing(pts.map((p) => project(p.lon, p.lat))), 0.3)

export function osmBuildingPolys(el) {
  if (el.type === 'way') {
    if (!el.geometry || el.geometry.length < 4) return []
    const r = toRing(el.geometry)
    return r.length >= 3 ? [{ outer: r, holes: [] }] : []
  }
  if (el.type === 'relation' && el.members) {
    const ways = (role) => el.members.filter((m) => m.role === role && m.geometry).map((m) => m.geometry.map((p) => project(p.lon, p.lat)))
    const outers = assembleRings(ways('outer')).map((r) => simplifyRing(r, 0.3)).filter((r) => r.length >= 3)
    const inners = assembleRings(ways('inner')).map((r) => simplifyRing(r, 0.3)).filter((r) => r.length >= 3)
    const polys = outers.map((o) => ({ outer: o, holes: [] }))
    for (const h of inners) {
      const host = polys.find((p) => pointInRing(h[0], p.outer))
      if (host) host.holes.push(h)
    }
    return polys
  }
  return []
}

const posInt = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null }

export function osmToBuilding(el) {
  const tags = el.tags || {}
  // below-grade structures (garages under Millennium Park, concourses) are not part of the skyline
  if (Number(tags.layer) < 0 || tags.location === 'underground') return null
  const polygons = osmBuildingPolys(el)
  if (!polygons.length) return null
  const area = polygons.reduce((s, p) => s + Math.abs(signedArea(p.outer)) - p.holes.reduce((t, h) => t + Math.abs(signedArea(h)), 0), 0)
  if (area < MIN_AREA) return null
  const main = polygons.reduce((a, b) => (Math.abs(signedArea(b.outer)) > Math.abs(signedArea(a.outer)) ? b : a))
  let height, heightSource
  const h = parseHeightTag(tags.height), lv = posInt(tags['building:levels'])
  if (h) { height = h; heightSource = 'osm' } else if (lv) { height = lv * FLOOR_M; heightSource = 'levels' } else { height = defaultHeightFor(tags); heightSource = 'default' }
  const year = parseInt(String(tags.start_date ?? '').slice(0, 4), 10)
  const num = tags['addr:housenumber'], street = tags['addr:street']
  return {
    id: `${el.type[0]}${el.id}`, osmId: el.id, source: 'osm', tags,
    name: tags.name || null,
    address: num && street ? `${num} ${street}` : null,
    stories: lv, year: year > 1800 ? year : null,
    polygons, area, centroid: ringCentroid(main.outer), bbox: ringBBox(polygons.flatMap((p) => p.outer)),
    height: Math.min(height, MAX_HEIGHT_M), heightSource, parts: null,
  }
}
