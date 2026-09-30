// pipeline/lib/pois.js — places (P4 · I-4.1): named OSM amenities in ten categories, one record per venue, each
// pinned where a person would look for it — on the roof of its building, or just above the ground in the open or
// in a courtyard.
import { pointInRing, distToRing } from './geom.js'

export const POI_CATEGORIES = [
  { id: 'food', label: 'Food', icon: 'RiRestaurantLine' },
  { id: 'drinks', label: 'Bars', icon: 'RiGoblet2Line' },
  { id: 'coffee', label: 'Coffee', icon: 'RiCupLine' },
  { id: 'nightlife', label: 'Nightlife', icon: 'RiMoonLine' },
  { id: 'venues', label: 'Venues', icon: 'RiMusic2Line' },
  { id: 'culture', label: 'Culture', icon: 'RiBankLine' },
  { id: 'shops', label: 'Shops', icon: 'RiShoppingBag3Line' },
  { id: 'outdoors', label: 'Outdoors', icon: 'RiLeafLine' },
  { id: 'hotels', label: 'Hotels', icon: 'RiHotelLine' },
  { id: 'services', label: 'Services', icon: 'RiFirstAidKitLine' },
]
export const POI_CAT_IDS = POI_CATEGORIES.map((c) => c.id)

const AMENITY = {
  restaurant: 'food', fast_food: 'food', food_court: 'food', ice_cream: 'food',
  bar: 'drinks', pub: 'drinks', biergarten: 'drinks',
  cafe: 'coffee', nightclub: 'nightlife',
  theatre: 'venues', cinema: 'venues', music_venue: 'venues', events_venue: 'venues', arts_centre: 'culture', library: 'culture',
  marketplace: 'shops',
  pharmacy: 'services', bank: 'services', hospital: 'services', clinic: 'services', post_office: 'services', community_centre: 'services',
}
const TOURISM = { museum: 'culture', gallery: 'culture', attraction: 'culture', viewpoint: 'outdoors', hotel: 'hotels' }
const LEISURE = { park: 'outdoors', playground: 'outdoors', sports_centre: 'outdoors', fitness_centre: 'outdoors', marina: 'outdoors' }

export function poiCategory(tags = {}) {
  if (!tags.name?.trim()) return null
  return AMENITY[tags.amenity] ?? TOURISM[tags.tourism] ?? LEISURE[tags.leisure] ?? (tags.shop ? 'shops' : null)
}

const KEEP = ['cuisine', 'opening_hours', 'website']
export function poiRecord(el) {
  const tags = el?.tags ?? {}, cat = poiCategory(tags)
  const lat = el?.lat ?? el?.center?.lat, lon = el?.lon ?? el?.center?.lon
  if (!cat || lat == null || lon == null) return null
  const t = {}
  for (const k of KEEP) if (tags[k]) t[k] = tags[k]
  if (!t.website && tags['contact:website']) t.website = tags['contact:website']
  for (const [k, v] of Object.entries(tags)) if (k.startsWith('addr:')) t[k] = v
  return { id: `${el.type?.[0] ?? 'n'}${el.id}`, name: tags.name.trim(), cat, lon, lat, tags: t }
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
// The same venue is often mapped twice (an entrance node and the building way): one record per name within 25 m,
// the way (the building) preferred over the node.
export function dedupePois(list, radius = 25) {
  const out = [], byName = new Map()
  const rank = (p) => (p.id?.[0] === 'w' ? 2 : p.id?.[0] === 'r' ? 1 : 0)
  for (const p of [...list].sort((a, b) => rank(b) - rank(a))) {
    const k = norm(p.name), same = byName.get(k) ?? []
    if (same.some((q) => Math.hypot(q.x - p.x, q.z - p.z) <= radius)) continue
    same.push(p); byName.set(k, same); out.push(p)
  }
  return out
}

const SNAP_M = 3, ROOF_M = 4, OPEN_M = 6
const ringsOf = (b) => b.polygons ?? [{ outer: b.outer, holes: b.holes ?? [] }]
// A pin on the roof it belongs to: inside a footprint (not in a courtyard hole) → roof + 4 m; an entrance node within
// 3 m of a wall → that building's roof; otherwise ground + 6 m.
export function anchorPoi({ x, z }, index, groundY = 0) {
  const p = [x, z]
  let near = null, nearD = Infinity
  for (const b of index.query(x, z) ?? []) {
    for (const r of ringsOf(b)) {
      if (pointInRing(p, r.outer)) {
        if ((r.holes ?? []).some((h) => pointInRing(p, h))) return { x, y: groundY + OPEN_M, z, bldg: -1 } // a courtyard
        return { x, y: b.top + ROOF_M, z, bldg: b.bldg }
      }
      const d = distToRing(p, r.outer)
      if (d <= SNAP_M && d < nearD) { near = b; nearD = d }
    }
  }
  return near ? { x, y: near.top + ROOF_M, z, bldg: near.bldg } : { x, y: groundY + OPEN_M, z, bldg: -1 }
}
