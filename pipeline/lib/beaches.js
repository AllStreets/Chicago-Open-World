// pipeline/lib/beaches.js — Lincoln Park's lakefront beaches (B, coordinator fix 2026-10-01). OSM maps Oak Street and
// the South Side beaches as natural=beach but not North Avenue Beach or the sand north of it, so the beach house stood on
// lawn among trees. Each beach in data/beaches.json is a north–south band of the lakefront: everything between the
// Lakefront Trail (the landward edge, where the grass and trees begin) and the shore is sand. Beach-volleyball courts
// (OSM pitches on sand) are sand too, never turf.
// F-8 (beach polish, 2026-10-02): the band leaves out what OSM maps inside it — the lawns and gardens and the parking lot
// at North Avenue Beach's south end; walks across the sand are narrow concrete, never road-like blacktop; the Lakefront
// Trail is the trail layer (park blacktop, no street glow); each sand volleyball court gets a net.
import polygonClipping from 'polygon-clipping'
import { project } from '../../shared/project.js'
import { openRing, ringBBox, signedArea } from './geom.js'
import { convexHull } from './venue.js'

const close = (r) => [...r, r[0]]
export const isSandPitch = (t = {}) => /beach_?volleyball/.test(t.sport ?? '') || t.surface === 'sand'

// trail: polylines (local metres) of the Lakefront Trail; lake: polygons of the lake side of the shore (lakeSide()).
// keepOut: polygons ({ outer }) mapped inside a band that are not sand (lawns, gardens, parking lots)
export function lakefrontBeaches(bands, { trail, lake, keepOut = [] }) {
  const out = []
  for (const b of bands) {
    const zS = project(0, b.south)[1], zN = project(0, b.north)[1]
    const pts = trail.flat().filter(([, z]) => z <= zS + 60 && z >= zN - 60).sort((p, q) => p[1] - q[1])
    if (pts.length < 2) continue
    // the landward edge: for each 10 m of latitude, the trail's westernmost point there (the cycleway, not the beach walks)
    const rows = new Map()
    for (const [x, z] of pts) { const k = Math.round(z / 10); if (!rows.has(k) || x < rows.get(k)[0]) rows.set(k, [x + (b.setbackM ?? 6), z]) }
    const edge = [...rows.values()].sort((p, q) => p[1] - q[1])
    const east = Math.max(...edge.map((p) => p[0])) + 1500
    const band = [...edge, [east, edge.at(-1)[1]], [east, edge[0][1]]]
    const box = [[-1e6, zN], [1e6, zN], [1e6, zS], [-1e6, zS]]
    const clipped = polygonClipping.intersection([close(band)], [close(box)])
    const wet = lake.length ? polygonClipping.difference(clipped, ...lake.map((p) => [close(p.outer), ...(p.holes ?? []).map(close)])) : clipped
    const out1 = keepOut.filter((p) => p.outer.some(([, z]) => z <= zS && z >= zN)).map((p) => [close(p.outer)])
    const dry = out1.length ? polygonClipping.difference(wet, ...out1) : wet
    for (const [outer, ...holes] of dry) {
      const o = openRing(outer)
      if (o.length < 3 || Math.abs(signedArea(o)) < 200) continue
      out.push({ id: `beach-${b.key}`, outer: o, holes: holes.map(openRing), tags: { natural: 'beach', name: b.name, surface: 'sand', source: b.source }, bbox: ringBBox(o) })
    }
  }
  return out
}

// what inside a beach band is not sand: OSM lawns and gardens (not the park polygon the whole lakefront sits in)
export const isBeachKeepOut = (t = {}) => t.landuse === 'grass' || t.leisure === 'garden'

// a parking lot from its aisle: the aisle's hull widened by the stalls on either side (OSM maps North Avenue Beach's lot
// as its aisle loop only)
export function parkingLot(aisle, padM = 9) {
  const pts = []
  for (const [x, z] of aisle) for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; pts.push([x + padM * Math.cos(a), z + padM * Math.sin(a)]) }
  return { outer: convexHull(pts), holes: [] }
}

// the share of a line's length (sampled every `step` m) that lies on sand
export function sandShare(line, onSand, step = 4) {
  let on = 0, all = 0
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step))
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; all++; if (onSand([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) on++ }
  }
  return all ? on / all : 0
}

export const isLakefrontTrail = (t = {}) => t.name === 'Lakefront Trail'
// how a path is drawn: the Lakefront Trail's blacktop on the trail layer (wherever it runs); any other walk that runs
// mostly over sand as a narrow light-concrete beach walk; everything else unchanged ({ surface, hw } in, out)
export function pathOnBeach(tags, { surface, hw }, share) {
  if (surface === 'asphalt' && isLakefrontTrail(tags)) return { surface: 'trail', hw }
  if (share < 0.5 || isLakefrontTrail(tags)) return { surface, hw }
  return { surface: 'concrete', hw: Math.min(hw, 1) }
}

// Beach-volleyball nets: one per sand court, across the middle of its long axis, a little wider than the court (the
// posts stand outside the sidelines). yAt([x, z]) is the sand's height there. → [{ x, z, y, yaw, len }]
export function volleyballNets(courts, yAt = () => 0) {
  const out = []
  for (const c of courts) {
    const r = c.outer
    if (!r || r.length < 4) continue
    // the court's long axis: its longest edge
    let best = null
    for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!best || l > best.l) best = { l, d: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] } }
    const cx = r.reduce((s, p) => s + p[0], 0) / r.length, cz = r.reduce((s, p) => s + p[1], 0) / r.length
    // the width across the long axis
    const n = [-best.d[1], best.d[0]], ws = r.map((p) => (p[0] - cx) * n[0] + (p[1] - cz) * n[1])
    const width = Math.max(...ws) - Math.min(...ws)
    if (!(width > 3 && width < 20 && best.l < 40)) continue
    // the net runs along n; yaw turns the model's +x onto it (three.js: rotation about +y takes +x to (cos, −sin))
    const yaw = Math.atan2(-n[1], n[0])
    out.push({ x: cx, z: cz, y: yAt([cx, cz]), yaw, len: width + 1.6 })
  }
  return out.sort((a, b) => a.z - b.z || a.x - b.x)
}
