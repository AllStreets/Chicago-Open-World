// app/src/lib/poiFilter.js — which places to pin (P4 · I-4.1): the chosen categories, nearest the camera target
// first, capped per quality; live CHI places merged in where the map has none; and ⌘K rows for every place.
import { POI_CATEGORIES, POI_CAT_IDS } from '../data/poiCategories.js'

export const MAX_PINS = { LOW: 800, HIGH: 3000, ULTRA: 4000 }
// fewer pins the higher the camera: a wide view shows the nearest few dozen, a street view all of them
export const pinBudget = (altitude, cap) => Math.min(cap, Math.max(60, Math.round(60000 / Math.max(1, altitude))))
const catsOf = (cats, catIds) => (cats === 'all' ? catIds : cats ?? catIds)

export function filterPois(pois, { cats = 'all', target = [0, 0], max = MAX_PINS.HIGH, catIds = POI_CAT_IDS }) {
  const allowed = new Set(catsOf(cats, catIds))
  if (!allowed.size) return []
  const [tx, tz] = target
  return pois
    .filter((p) => allowed.has(catIds[p.c]))
    .map((p) => [p, (p.x - tx) ** 2 + (p.z - tz) ** 2])
    .sort((a, b) => a[1] - b[1])
    .slice(0, max)
    .map(([p]) => p)
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
const LIVE_CAT = { restaurant: 'food', fast_food: 'food', cafe: 'coffee', bar: 'drinks', pub: 'drinks', nightclub: 'nightlife', theatre: 'venues', cinema: 'venues', music_venue: 'venues', museum: 'culture', gallery: 'culture' }
// CHI's /api/places (OSM-backed): add what the build-time data lacks — matched by OSM id or by name within 40 m.
export function mergeLivePlaces(tilePois, live, { project, anchor, inWorld = () => true }) {
  const list = Array.isArray(live?.places) ? live.places : []
  const out = [...tilePois]
  for (const p of list) {
    if (!p?.name || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || !inWorld(p)) continue
    const [x, z] = project(p.lon, p.lat), num = String(p.id ?? '').replace(/^[nwr]/, '')
    const dup = out.some((q) => (num && String(q.id).replace(/^[nwr]/, '') === num) || (norm(q.n) === norm(p.name) && Math.hypot(q.x - x, q.z - z) <= 40))
    if (dup) continue
    const a = anchor({ x, z }), cat = LIVE_CAT[p.amenity] ?? (p.categories ?? []).map((c) => LIVE_CAT[c]).find(Boolean) ?? 'food'
    out.push({ id: `live:${p.id ?? norm(p.name)}`, n: p.name, c: POI_CAT_IDS.indexOf(cat), x: a.x, y: a.y, z: a.z, b: a.bldg, ...(p.address ? { a: p.address } : {}), live: true })
  }
  return out
}

// ⌘K rows for pois-index.json entries [id, name, catIdx, x, z, tileKey]
export function buildPlaceRows(index, catIds = POI_CAT_IDS) {
  const label = (i) => POI_CATEGORIES.find((c) => c.id === catIds[i])?.label ?? 'Place'
  return (index ?? []).map(([id, name, c, x, z, tile]) => ({ id: `p:${id}`, kind: 'place', name, sub: label(c), c, x, z, tile }))
}

// Where the pins gather: a third of the way from the camera toward what it looks at — so the buildings in front of you
// get their pins even when the view runs far down a street (the camera target alone can be a kilometre away).
export function pinFocus([cx, , cz], [tx, , tz]) {
  return [Math.round(cx + (tx - cx) * 0.35), Math.round(cz + (tz - cz) * 0.35)]
}
