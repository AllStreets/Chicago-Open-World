// pipeline/lib/heroes.js — hand-shaped landmark specs (data/heroes.json) → extrusion pieces + crown meshes.
import { shapePieces } from './shapes.js'
import { spire, antenna, pyramid, drum, sloped, vault, stepdome, pavilion, gothicCrown } from './crowns.js'
import { signedArea, ringCentroid, ringBBox } from './geom.js'
import { insetRing } from './roofs.js'
import { buildVenue, convexHull, STYLE, VENUE_FACADES } from './venue.js'
import { buildLandmark } from './landmarks.js'
import { project } from '../../shared/project.js'
import { aquaSlabs, AQUA } from './aqua.js'
import { marinaTower, MARINA } from './marina.js'
import { placeStatue } from './statues.js'
import { LANDMARK_FACADES } from './facadeIds.js'

// Mirror of the façade shader's curtain-glass tint buckets: g = fract(seed * 3.7).
const TINT_G = { dark: 0.14, green: 0.39, silver: 0.64, blue: 0.89 }
export const seedForTint = (tint) => TINT_G[tint] / 3.7

const scaleRing = (ring, [cx, cz], s, [ox, oz] = [0, 0]) => ring.map(([x, z]) => [cx + (x - cx) * s + ox, cz + (z - cz) * s + oz])
const merge = (ms) => ms.reduce((o, m) => { o.positions.push(...m.positions); o.normals.push(...m.normals); o.uvs.push(...m.uvs); return o }, { positions: [], normals: [], uvs: [] })
// Phase 3: four corner pavilions on the tower's roof (900 N Michigan), inset `inset` m from the bounding-box corners
function pavilions({ ring, base, top, w, d = w, roofH, inset = 0 }) {
  const bb = ringBBox(ring), hx = w / 2 + inset, hz = d / 2 + inset
  return merge([[bb.minX + hx, bb.minZ + hz], [bb.maxX - hx, bb.minZ + hz], [bb.maxX - hx, bb.maxZ - hz], [bb.minX + hx, bb.maxZ - hz]].map((at) => pavilion({ at, base, top, w, d, roofH })))
}
const gothic = (c) => { const g = gothicCrown(c); return merge([g.lantern, g.piers, g.buttresses, g.pinnacles]) }
const CROWNS = { spire, antenna, pyramid, drum, sloped, vault, stepdome, pavilion, pavilions, gothic }
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
    const r = buildLandmark({ ...b, height: spec.heightM ?? b.height, pieces }, spec.landmark)
    if (r.replace) pieces = r.pieces ?? []
    venueMeshes = r.meshes
    clear = r.clear
    detached = r.detached; runtime = r.runtime
  }

  // Phase 3 crowns sit on the tower (the tallest piece), whose body stops at bodyTopM where the crown begins
  // (OSM often maps a narrow top as its own full-height part: every piece above bodyTopM is capped there, and the crown
  // sits on the widest of them)
  const area = (p) => Math.abs(signedArea(p.outer))
  const rising = spec.bodyTopM ? pieces.filter((p) => p.top > spec.bodyTopM) : []
  const tower = rising.length ? rising.reduce((a, p) => (area(p) > area(a) ? p : a)) : pieces.length ? pieces.reduce((a, p) => (p.top > a.top ? p : a)) : null
  if (rising.length) pieces = pieces.map((p) => (p.top > spec.bodyTopM ? { ...p, top: spec.bodyTopM } : p))
  const extraMeshes = (spec.crowns || []).map((c) => {
    const onTower = c.on === 'tower' && tower, [ox, oz] = onTower ? ringCentroid(tower.outer) : [cx, cz], baseRing = onTower ? tower.outer : main.outer
    const at = [ox + (c.at?.[0] ?? 0), oz + (c.at?.[1] ?? 0)]
    const ring = c.scale ? scaleRing(baseRing, [ox, oz], c.scale, c.offset) : onTower ? baseRing : undefined
    const m = CROWNS[c.type]({ ...c, at, ring: c.ring ?? ring ?? main.outer })
    // a crown with its own surface (an arena's membrane roof) is not drawn in the wall's façade
    if (c.surface) { m.facade = VENUE_FACADES[c.surface.facade]; m.seed = STYLE[c.surface.facade][c.surface.style] }
    if (c.style) { m.facade = LANDMARK_FACADES[c.facade ?? 'paint']; m.seed = 0.5; m.style = c.style } // a sourced material row (P3)
    return m
  })

  // sculpted detail (Phase 3): close-range geometry merged into the hero; LOD1 keeps the plain silhouette
  if (spec.sculpt === 'aqua') {
    const tower = pieces.reduce((a, p) => (p.top > a.top ? p : a))
    const base = spec.sculptParams?.podiumM ?? AQUA.podiumM
    const m = aquaSlabs(tower.outer, { floors: AQUA.floors, floorH: (tower.top - base) / AQUA.floors, baseY: base })
    extraMeshes.push(Object.assign(m, { facade: LANDMARK_FACADES.stone, seed: 0.5, style: 'aqua-slab-concrete', lod0Only: true }))
  }
  // a figure on the crown's apex (CBOT's Ceres): Blender export when the build pre-loaded one, else the stand-in
  if (spec.statue && tower) {
    const [sx, sz] = ringCentroid(tower.outer), s = spec.statue
    const { mesh: m, source } = placeStatue(s, { at: [sx, sz], base: s.topM - s.heightM }, s.preloaded)
    extraMeshes.push(Object.assign(m, { facade: LANDMARK_FACADES.bronze, seed: 0.5, style: s.style, lod0Only: true, statueSource: source }))
  }
  let sculptReplaces = false
  if (spec.sculpt === 'marina') {
    // radii from the footprint (its farthest point is a petal tip) unless sourced overrides are given
    const sp = spec.sculptParams ?? {}, rPetal = sp.rPetal ?? Math.max(...main.outer.map(([x, z]) => Math.hypot(x - cx, z - cz)))
    const heightM = spec.heightM ?? MARINA.heightM
    const t = marinaTower([cx, cz], { heightM, rCore: sp.rCore ?? rPetal - (sp.petalDepthM ?? 3.2), rPetal, floorH: heightM / MARINA.floors, parkingLevels: MARINA.parkingLevels, aptFrom: MARINA.aptFrom, aptTo: MARINA.aptTo, petals: MARINA.petals })
    for (const k of ['core', 'slabs', 'ramp']) extraMeshes.push(Object.assign(t[k], { facade: LANDMARK_FACADES.stone, seed: 0.5, style: 'marina-concrete', lod0Only: true }))
    extraMeshes.push(Object.assign(t.glass, { lod0Only: true })) // the hero's own window façade and glass colour
    sculptReplaces = true
  }

  if (spec.facade) b.facadeOverride = spec.facade
  if (spec.tint) b.seedOverride = seedForTint(spec.tint)
  if (spec.wallStyle) b.seedOverride = STYLE.wall[spec.wallStyle]
  return { pieces, extraMeshes, venueMeshes, clear, detached, runtime, sculptReplaces }
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
