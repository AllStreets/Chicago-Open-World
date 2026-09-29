// app/src/lib/minimapMath.js — world ↔ minimap image, compass strip offset.
import { MAX_DIST } from './cameraMath.js'

export const worldToMap = ([x, z], b, size) => [((x - b.minX) / (b.maxX - b.minX)) * size, ((z - b.minZ) / (b.maxZ - b.minZ)) * size]

export function mapToWorld([px, py], b, size) {
  let x = b.minX + ((Number.isFinite(px) ? px : size / 2) / size) * (b.maxX - b.minX)
  let z = b.minZ + ((Number.isFinite(py) ? py : size / 2) / size) * (b.maxZ - b.minZ)
  const r = Math.hypot(x, z)
  if (r > MAX_DIST) { x *= MAX_DIST / r; z *= MAX_DIST / r }
  return [x, z]
}

export const compassOffset = (heading, strip) => ((((heading / 360) * strip) % strip) + strip) % strip
