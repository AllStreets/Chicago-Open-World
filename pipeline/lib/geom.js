// pipeline/lib/geom.js — 2D ring helpers in world metres [x, z].
// Orientation is judged on the map plane (x, -z): positive area = CCW.

export function openRing(coords) {
  const n = coords.length
  if (n > 1 && coords[0][0] === coords[n - 1][0] && coords[0][1] === coords[n - 1][1]) {
    return coords.slice(0, -1)
  }
  return coords.slice()
}

export function signedArea(ring) {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i]
    const [x2, z2] = ring[(i + 1) % ring.length]
    a += x1 * -z2 - x2 * -z1
  }
  return a / 2
}

export const ensureCCW = (ring) => (signedArea(ring) < 0 ? [...ring].reverse() : ring)
export const ensureCW = (ring) => (signedArea(ring) > 0 ? [...ring].reverse() : ring)

function perpDist([px, pz], [ax, az], [bx, bz]) {
  const dx = bx - ax, dz = bz - az
  const len2 = dx * dx + dz * dz
  if (len2 === 0) return Math.hypot(px - ax, pz - az)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2))
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}

function dp(points, tol) {
  if (points.length < 3) return points
  let maxD = 0, idx = 0
  const last = points.length - 1
  for (let i = 1; i < last; i++) {
    const d = perpDist(points[i], points[0], points[last])
    if (d > maxD) { maxD = d; idx = i }
  }
  if (maxD <= tol) return [points[0], points[last]]
  return [...dp(points.slice(0, idx + 1), tol).slice(0, -1), ...dp(points.slice(idx), tol)]
}

// Douglas-Peucker on a closed ring: split at the point farthest from ring[0].
export function simplifyRing(ring, tol) {
  if (ring.length <= 3) return ring
  let far = 1, farD = 0
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1])
    if (d > farD) { farD = d; far = i }
  }
  const a = dp(ring.slice(0, far + 1), tol)
  const b = dp([...ring.slice(far), ring[0]], tol)
  const out = [...a.slice(0, -1), ...b.slice(0, -1)]
  return out.length >= 3 ? out : ring
}

export function pointInRing([px, pz], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j]
    if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

export function ringBBox(ring) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity
  for (const [x, z] of ring) {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
  }
  return { minX, minZ, maxX, maxZ }
}

export function ringCentroid(ring) {
  let a = 0, cx = 0, cz = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i], [x2, z2] = ring[(i + 1) % ring.length]
    const f = x1 * z2 - x2 * z1
    a += f; cx += (x1 + x2) * f; cz += (z1 + z2) * f
  }
  if (Math.abs(a) < 1e-9) {
    const n = ring.length
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n]
  }
  return [cx / (3 * a), cz / (3 * a)]
}
