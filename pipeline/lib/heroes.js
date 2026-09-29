// pipeline/lib/heroes.js — hand-shaped landmark specs (data/heroes.json) → extrusion pieces + crown meshes.
import { shapePieces } from './shapes.js'
import { spire, antenna, pyramid, drum, sloped, vault, stepdome } from './crowns.js'
import { signedArea } from './geom.js'
import { insetRing } from './roofs.js'
import { buildVenue, convexHull, STYLE, VENUE_FACADES } from './venue.js'
import { buildLandmark } from './landmarks.js'
import { project } from '../../shared/project.js'

// Mirror of the façade shader's curtain-glass tint buckets: g = fract(seed * 3.7).
const TINT_G = { dark: 0.14, green: 0.39, silver: 0.64, blue: 0.89 }
export const seedForTint = (tint) => TINT_G[tint] / 3.7

const scaleRing = (ring, [cx, cz], s, [ox, oz] = [0, 0]) => ring.map(([x, z]) => [cx + (x - cx) * s + ox, cz + (z - cz) * s + oz])
const CROWNS = { spire, antenna, pyramid, drum, sloped, vault, stepdome }
const bearing = (deg) => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)]
const local = (p) => (p && p.lat != null ? project(p.lon, p.lat) : p)

// heroes.json venue specs speak lat/lon + compass bearings; buildVenue speaks local metres + vectors.
export function resolveVenue(v) {
  return {
    ...v,
    home: v.homeLocal ?? local(v.home),
    center: v.centerLocal ?? local(v.center),
    cf: v.cfBearing != null ? bearing(v.cfBearing) : v.cf,
    axis: v.axisBearing != null ? bearing(v.axisBearing) : v.axis,
  }
}

export function applyHero(b, spec) {
  let pieces = shapePieces(b, spec.taper ? { topScale: spec.taper.topScale } : undefined)
  const [cx, cz] = b.centroid
  const main = b.polygons.reduce((a, p) => (Math.abs(signedArea(p.outer)) > Math.abs(signedArea(a.outer)) ? p : a))

  if (spec.venue) {
    // a venue is often mapped as many pieces (bowl, colonnades, gates): build over their hull
    const venueMeshes = buildVenue(convexHull(b.polygons.flatMap((p) => p.outer)), { ...resolveVenue(spec.venue), slot: spec.sports?.slot ?? 0, capacity: spec.sports?.capacity })
    return { pieces: [], extraMeshes: [], venueMeshes }
  }
  if (spec.stands) {
    // stadium: grandstand ring around an open field
    pieces = b.polygons.map((p) => ({ outer: p.outer, holes: [insetRing(p.outer, spec.stands)], base: 0, top: spec.heightM ?? 25 }))
  } else if (spec.tiers?.length) {
    const first = spec.tiers[0].from
    pieces = [{ outer: main.outer, holes: main.holes, base: 0, top: first }]
    for (const t of spec.tiers) pieces.push({ outer: scaleRing(main.outer, [cx, cz], t.scale, t.offset), holes: [], base: t.from, top: t.to })
  } else if (spec.heightM) {
    const bodyTop = Math.max(...pieces.filter((p) => Math.abs(signedArea(p.outer)) >= 0.03 * b.area).map((p) => p.top))
    pieces = pieces.map((p) => (p.top === bodyTop ? { ...p, top: spec.heightM } : p))
  }

  let venueMeshes, clear, detached, runtime
  if (spec.landmark) {
    const r = buildLandmark({ ...b, height: spec.heightM ?? b.height }, spec.landmark)
    if (r.replace) pieces = r.pieces ?? []
    venueMeshes = r.meshes
    clear = r.clear
    detached = r.detached; runtime = r.runtime
  }

  const extraMeshes = (spec.crowns || []).map((c) => {
    const at = [cx + (c.at?.[0] ?? 0), cz + (c.at?.[1] ?? 0)]
    const ring = c.scale ? scaleRing(main.outer, [cx, cz], c.scale, c.offset) : undefined
    const m = CROWNS[c.type]({ ...c, at, ring: c.ring ?? ring ?? main.outer })
    // a crown with its own surface (an arena's membrane roof) is not drawn in the wall's façade
    if (c.surface) { m.facade = VENUE_FACADES[c.surface.facade]; m.seed = STYLE[c.surface.facade][c.surface.style] }
    return m
  })

  if (spec.facade) b.facadeOverride = spec.facade
  if (spec.tint) b.seedOverride = seedForTint(spec.tint)
  if (spec.wallStyle) b.seedOverride = STYLE.wall[spec.wallStyle]
  return { pieces, extraMeshes, venueMeshes, clear, detached, runtime }
}

// OSM ids are unique per element type only: way 123 and relation 123 are different buildings.
// A ref is 'w123' / 'r123' (typed) or a bare number / digit string (must then be unambiguous).
export function parseOsmRef(ref) {
  if (typeof ref === 'number') return { type: null, id: ref }
  const m = /^([wr])?(\d+)$/.exec(String(ref))
  if (!m) throw new Error(`bad OSM ref: ${ref}`)
  return { type: m[1] ?? null, id: Number(m[2]) }
}

export function matchesOsm(b, ref) {
  const { type, id } = parseOsmRef(ref)
  return b.osmId === id && (!type || b.id?.[0] === type)
}

export function findByOsm(buildings, ref) {
  const hits = buildings.filter((b) => matchesOsm(b, ref))
  if (hits.length > 1) throw new Error(`ambiguous OSM id ${ref}: ${hits.map((b) => b.id).join(', ')} — write it as 'w…' or 'r…'`)
  return hits[0] ?? null
}
