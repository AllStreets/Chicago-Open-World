// pipeline/lib/rooftops.js — the Wrigley Field rooftop clubs (user item 13): steel bleacher grandstands on the roofs of
// the Waveland and Sheffield three-flats, rows stepping up away from the field so every seat looks over the street and
// the outfield walls at home plate; each club is a named place with its address and website, and its seats are crowd
// anchors for game nights. Data and sources: pipeline/data/rooftops.json.
import { orientedBox } from './sacred.js'
import { signedArea } from './geom.js'
import { add2, sub2, mul2, dot2, norm2, mesh, slab, tube, at3 } from './meshkit.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'
import { shuffled } from './sportsSites.js'

// lean for the size budget: tread and riser per row (no separate bench), four-sided tubes
const ROW_D = 0.85, RISE = 0.55, DECK = 1.2, MAX_ROWS = 14, SEAT_GAP = 0.62

// One grandstand on a roof. ring: the footprint (x, z); roofY: the roof height; plate: home plate (x, z).
export function rooftopStand({ ring, roofY, plate }) {
  const ob = orientedBox(ring)
  const f = norm2(sub2(plate, ob.c))
  const [a, A, b, B] = Math.abs(dot2(ob.u, f)) >= Math.abs(dot2(ob.v, f)) ? [ob.u, ob.L, ob.v, ob.W] : [ob.v, ob.W, ob.u, ob.L]
  const d = dot2(a, f) >= 0 ? a : mul2(a, -1) // toward the field
  const s = b, D = A, Ws = B
  const n = Math.max(4, Math.min(MAX_ROWS, Math.floor((D - 1.6) / ROW_D)))
  const front = add2(ob.c, mul2(d, D / 2 - 0.8))
  const rowC = (i) => add2(front, mul2(d, -(ROW_D / 2 + i * ROW_D)))
  const rowY = (i) => roofY + DECK + i * RISE
  const seat = mesh(), steel = mesh(), rail = mesh()
  const width = Ws - 0.6, hw = width / 2 - 0.15
  for (let i = 0; i < n; i++) {
    const c = rowC(i), y = rowY(i)
    slab(seat, c, s, width, ROW_D, y - 0.08, y) // the tread
    slab(seat, add2(c, mul2(d, ROW_D / 2 - 0.02)), s, width, 0.04, i ? rowY(i - 1) : roofY, y - 0.08) // the riser
  }
  // the steel frame: columns under every third row and the back row, cross-braced along both sides
  const cols = [...new Set([...Array.from({ length: Math.ceil(n / 3) }, (_, k) => k * 3), n - 1])]
  for (const side of [-1, 1]) {
    const foot = (i) => add2(rowC(i), mul2(s, side * hw))
    for (const i of cols) tube(steel, at3(foot(i), roofY), at3(foot(i), rowY(i) - 0.08), 0.12, 4)
    for (let k = 0; k + 1 < cols.length; k++) tube(steel, at3(foot(cols[k]), roofY + 0.2), at3(foot(cols[k + 1]), rowY(cols[k + 1]) - 0.3), 0.07, 4)
  }
  // rails: along the front, up both sides with the rows, and across the back
  const top = rowY(n - 1) + 1.05
  const fl = add2(rowC(0), mul2(d, ROW_D / 2)), bl = add2(rowC(n - 1), mul2(d, -ROW_D / 2))
  const sideAt = (p, k) => add2(p, mul2(s, k * (width / 2)))
  tube(rail, at3(sideAt(fl, -1), rowY(0) + 0.95), at3(sideAt(fl, 1), rowY(0) + 0.95), 0.05, 4)
  for (const k of [-1, 1]) {
    tube(rail, at3(sideAt(fl, k), rowY(0) + 1.0), at3(sideAt(bl, k), top), 0.05, 4)
    tube(rail, at3(sideAt(fl, k), rowY(0) - 0.08), at3(sideAt(fl, k), rowY(0) + 1.0), 0.04, 4)
    tube(rail, at3(sideAt(bl, k), rowY(n - 1) - 0.08), at3(sideAt(bl, k), top), 0.04, 4)
  }
  tube(rail, at3(sideAt(bl, -1), top), at3(sideAt(bl, 1), top), 0.05, 4)
  // the crowd: one place every SEAT_GAP along each row, facing home plate
  const seats = []
  const per = Math.max(1, Math.floor((width - 0.4) / SEAT_GAP))
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < per; k++) {
      const p = add2(rowC(i), mul2(s, (k - (per - 1) / 2) * SEAT_GAP))
      seats.push([+p[0].toFixed(2), +(rowY(i) + 0.05).toFixed(2), +p[1].toFixed(2), +Math.atan2(plate[0] - p[0], plate[1] - p[1]).toFixed(4)])
    }
  }
  return {
    meshes: [
      { mesh: steel, facade: F.steel, seed: 0.2, style: 'rooftop-steel', part: 'rooftop' },
      { mesh: seat, facade: F.paint, seed: 0.4, style: 'rooftop-seat', part: 'rooftop' },
      { mesh: rail, facade: F.steel, seed: 0.6, style: 'rooftop-rail', part: 'rooftop' },
    ],
    seats,
  }
}

// A club as a place (category Venues): its name, street address and website, pinned on its roof.
export function rooftopPlace(club, b) {
  const m = /^(\d{4}(?:-\d{4})?) (.+)$/.exec(club.address) ?? []
  const tags = { website: club.website, 'addr:housenumber': m[1], 'addr:street': m[2], 'addr:city': 'Chicago' }
  return { id: `rt:${club.key}`, name: club.name, cat: 'venues', x: b.centroid[0], z: b.centroid[1], tags, qid: null }
}

const FLOOR_M = 3.8
// The lots OSM leaves empty (a club's `lot`, world metres): plain brick buildings of the club's storeys, built like any
// other footprint and then dressed by applyRooftops.
export function rooftopLots(clubs) {
  return clubs.filter((c) => c.lot).map((c) => {
    const outer = c.lot, xs = outer.map((p) => p[0]), zs = outer.map((p) => p[1])
    const centroid = [xs.reduce((a, x) => a + x, 0) / xs.length, zs.reduce((a, z) => a + z, 0) / zs.length]
    return {
      id: `rt-${c.key}`, osmId: null, source: 'rooftops', name: null, address: c.address, stories: c.storeys, year: null,
      tags: { building: 'residential', 'building:levels': String(c.storeys), 'building:colour': c.brick, 'building:material': 'brick' },
      polygons: [{ outer, holes: [] }], area: Math.abs(signedArea(outer)), centroid,
      bbox: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) },
      height: +(c.storeys * FLOOR_M).toFixed(1), heightSource: 'rooftops', parts: null,
    }
  })
}

// Dress the matched buildings and collect the places and crowd anchors.
export function applyRooftops(buildings, clubs, plate) {
  const byId = new Map(buildings.map((b) => [b.id, b]))
  const places = [], seats = []
  let matched = 0
  for (const club of clubs) {
    const id = club.osm ?? (club.lot ? `rt-${club.key}` : null)
    const b = id ? byId.get(id) : null
    if (!b) { if (club.at) places.push(rooftopPlace(club, { centroid: club.at })); continue }
    const piece = (b.pieces ?? []).reduce((p, q) => (!p || Math.abs(signedArea(q.outer)) > Math.abs(signedArea(p.outer)) ? q : p), null)
    const ring = piece?.outer ?? b.polygons[0].outer
    const roofY = Math.max(0, ...(b.pieces ?? []).map((p) => p.top ?? 0)) || b.height
    const st = rooftopStand({ ring, roofY, plate })
    b.extraMeshes = [...(b.extraMeshes ?? []), ...st.meshes.map((m) => Object.assign(m.mesh, { facade: m.facade, seed: m.seed, style: m.style, lod0Only: true }))]
    b.tags ??= {}
    if (club.brick && !b.tags['building:colour']) { b.tags['building:colour'] = club.brick; b.tags['building:material'] ??= 'brick' }
    b.rooftop = club.key
    places.push(rooftopPlace(club, b))
    seats.push(...st.seats)
    matched++
  }
  // shuffled, so a part-full night thins every club evenly instead of leaving the last ones empty
  return { places, seats: shuffled(seats, 13), matched }
}
