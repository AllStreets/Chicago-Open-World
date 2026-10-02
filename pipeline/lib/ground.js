import earcut from 'earcut'
// pipeline/lib/ground.js — rules for roads, rail and tree scatter.
import { pointInRing, ringBBox } from './geom.js'
import { hashSeed } from './buildings.js'

// Ground surface heights (m). Water sits below every street layer so bridges cross it.
export const GROUND_Y = { lake: 0.02, water: 0.04, beaches: 0.07, parks: 0.08, pitches: 0.09, rail: 0.09, sidewalks: 0.1, paving: 0.105, trail: 0.11, roads: 0.12 }

export const ROAD_WIDTHS = {
  motorway: 22, trunk: 18, primary: 16, secondary: 14, tertiary: 12, unclassified: 10,
  residential: 9, service: 5, motorway_link: 8, trunk_link: 8, primary_link: 8, secondary_link: 8,
}

export function roadHalfWidth(tags) {
  if (tags.tunnel && tags.tunnel !== 'no') return 0
  if (parseInt(tags.layer ?? '0', 10) < 0) return 0
  const w = ROAD_WIDTHS[tags.highway]
  return w ? w / 2 : 0
}

export function isElevatedRail(tags) {
  if (!['subway', 'light_rail'].includes(tags.railway)) return false
  if (tags.tunnel && tags.tunnel !== 'no') return false
  return Boolean((tags.bridge && tags.bridge !== 'no') || parseInt(tags.layer ?? '0', 10) >= 1)
}

export function scatterInPolygon(ring, spacing, seed) {
  const { minX, minZ, maxX, maxZ } = ringBBox(ring)
  const out = []
  for (let x = minX + spacing / 2; x < maxX; x += spacing) {
    for (let z = minZ + spacing / 2; z < maxZ; z += spacing) {
      const h = hashSeed(`${seed}:${Math.round(x)}:${Math.round(z)}`)
      const h2 = hashSeed(`${seed}:${Math.round(z)}:${Math.round(x)}`)
      const p = [x + (h - 0.5) * spacing * 0.8, z + (h2 - 0.5) * spacing * 0.8]
      if (pointInRing(p, ring)) out.push(p)
    }
  }
  return out
}

// Polygons (outer + holes, local metres) → flat up-facing triangles at height y; uv = world xz.
export function flatMesh(polys, y) {
  const positions = [], normals = [], uvs = []
  for (const { outer, holes } of polys) {
    const flat = [], hi = []
    for (const [x, z] of outer) flat.push(x, z)
    for (const h of holes) { hi.push(flat.length / 2); for (const [x, z] of h) flat.push(x, z) }
    const t = earcut(flat, hi.length ? hi : undefined, 2)
    for (let i = 0; i < t.length; i += 3) {
      let [a, b, c] = [t[i], t[i + 1], t[i + 2]]
      const cr = (flat[b * 2 + 1] - flat[a * 2 + 1]) * (flat[c * 2] - flat[a * 2]) - (flat[b * 2] - flat[a * 2]) * (flat[c * 2 + 1] - flat[a * 2 + 1])
      if (cr < 0) [b, c] = [c, b]
      for (const k of [a, b, c]) { positions.push(flat[k * 2], y, flat[k * 2 + 1]); normals.push(0, 1, 0); uvs.push(flat[k * 2], flat[k * 2 + 1]) }
    }
  }
  return { positions, normals, uvs }
}
