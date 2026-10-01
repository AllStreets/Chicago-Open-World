// pipeline/lib/water.js — OSM water polygons → one water layer with a per-vertex calm factor (B.2), and
// breakwaters as low concrete footprints so the harbours read (B7).
import { flatMesh } from './ground.js'
import { openRing, signedArea, ringCentroid, ringBBox } from './geom.js'
import { STYLE } from './venue.js'
import { insetRing } from './roofs.js'

export const CALM = { river: 0.6, sheltered: 0.35, lake: 1.0 }

export function calmFor(tags = {}) {
  if (['river', 'canal', 'stream'].includes(tags.water) || tags.waterway) return CALM.river
  return CALM.sheltered
}

// Lake Michigan is the baked lake mesh; fountains belong to their landmark builders.
export const keepWater = (tags = {}) => tags.water !== 'fountain' && tags.name !== 'Lake Michigan'

// y: one height for every polygon, or a function of the polygon (D1: the river system at RIVER_Y, the rest as before)
export function waterLayer(polys, y) {
  const out = { positions: [], normals: [], uvs: [] }, calm = []
  for (const p of polys) {
    const m = flatMesh([p], typeof y === 'function' ? y(p) : y)
    for (const k of ['positions', 'normals', 'uvs']) for (const v of m[k]) out[k].push(v)
    const c = calmFor(p.tags)
    for (let i = 0; i < m.positions.length / 3; i++) calm.push(c)
  }
  return { ...out, extra: { CALM: new Float32Array(calm) } }
}

export const BREAKWATER = { width: 6, top: 1.8 }

// A polyline → the closed outline of a band hw either side (central-difference normals).
export function strokeRing(pts, hw) {
  const L = [], R = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1
    const n = [-dz / l, dx / l]
    L.push([pts[i][0] + n[0] * hw, pts[i][1] + n[1] * hw])
    R.push([pts[i][0] - n[0] * hw, pts[i][1] - n[1] * hw])
  }
  return [...L, ...R.reverse()]
}

export function breakwaterBuildings(ways) {
  const out = []
  ways.forEach((w, i) => {
    const pts = w.points
    const closed = pts.length >= 4 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]
    let outer = closed ? openRing(pts) : strokeRing(pts, BREAKWATER.width / 2), holes = []
    // A closed way is a breakwater's own footprint only when it is thin (mean width ≤ 20 m). A loop around a
    // whole harbour (Monroe Harbor is mapped that way) is a wall along its outline, never a slab over the water.
    if (closed && outer.length >= 3) {
      const perim = outer.reduce((t, p, k) => t + Math.hypot(outer[(k + 1) % outer.length][0] - p[0], outer[(k + 1) % outer.length][1] - p[1]), 0)
      if ((2 * Math.abs(signedArea(outer))) / perim > 20) holes = [insetRing(outer, BREAKWATER.width)]
    }
    const area = Math.abs(signedArea(outer)) - holes.reduce((t, h) => t + Math.abs(signedArea(h)), 0)
    if (outer.length < 3 || area < 1) return
    out.push({
      id: `bw${w.id ?? i}`, osmId: null, source: 'osm-breakwater', tags: w.tags ?? {}, name: w.tags?.name ?? 'Breakwater',
      address: null, stories: null, year: null, polygons: [{ outer, holes }], area, centroid: ringCentroid(outer), bbox: ringBBox(outer),
      height: BREAKWATER.top, heightSource: 'default', parts: null,
      pieces: [{ outer, holes, base: 0, top: BREAKWATER.top }],
      facadeOverride: 'wall', seedOverride: STYLE.wall.concrete, noParapet: true,
    })
  })
  return out
}
