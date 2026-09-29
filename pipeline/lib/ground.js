// pipeline/lib/ground.js — rules for roads, rail and tree scatter.
import { pointInRing, ringBBox } from './geom.js'
import { hashSeed } from './buildings.js'

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
