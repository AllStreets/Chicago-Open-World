// app/src/lib/cameraMath.js — pure camera limits + keyboard glide.
export const MIN_ALT = 30
export const MAX_DIST = 6000
// World rectangle for the camera target: the expanded city (Addison → 35th, Western → lake) minus a margin; to the
// east it reaches past the harbour to the Chicago Harbor Lighthouse on the outer breakwater (x ≈ 3050, P3).
export const WORLD_BOUNDS = { minX: -5375, maxX: 3150, minZ: -7572, maxZ: 6023 }

export function clampCamera(position, target, bounds) {
  let [tx, ty, tz] = target
  ty = Math.max(0, ty)
  let tr = 0, outside = false
  if (bounds) {
    const cx = Math.min(bounds.maxX, Math.max(bounds.minX, tx)), cz = Math.min(bounds.maxZ, Math.max(bounds.minZ, tz))
    outside = cx !== tx || cz !== tz
    tx = cx; tz = cz
  } else {
    tr = Math.hypot(tx, tz)
    if (tr > MAX_DIST) { tx *= MAX_DIST / tr; tz *= MAX_DIST / tr }
  }
  let [px, py, pz] = position
  // move the camera with the target if the target was pulled in
  px += tx - target[0]; pz += tz - target[2]
  let dx = px - tx, dy = py - ty, dz = pz - tz
  const d = Math.hypot(dx, dy, dz)
  if (d > MAX_DIST) { const k = MAX_DIST / d; dx *= k; dy *= k; dz *= k }
  px = tx + dx; py = ty + dy; pz = tz + dz
  const lifted = py < MIN_ALT
  py = Math.max(MIN_ALT, py)
  // `clamped` comes from the limit checks, not from comparing floats (round-trip noise).
  const clamped = target[1] < 0 || tr > MAX_DIST || outside || d > MAX_DIST || lifted
  return { position: [px, py, pz], target: [tx, ty, tz], clamped }
}

// Compass heading in whole degrees, 0 = north, 90 = east; azimuth is unbounded.
export function headingDeg(azimuth) {
  const deg = Math.round((-azimuth * 180) / Math.PI)
  return ((deg % 360) + 360) % 360
}

// azimuth: camera heading, 0 = looking north (-Z), +π/2 = looking west (camera-controls convention).
export function glideVector(keys, azimuth) {
  let f = 0, r = 0
  if (keys.has('KeyW')) f += 1
  if (keys.has('KeyS')) f -= 1
  if (keys.has('KeyD')) r += 1
  if (keys.has('KeyA')) r -= 1
  if (!f && !r) return [0, 0]
  const len = Math.hypot(f, r)
  f /= len; r /= len
  const fx = -Math.sin(azimuth), fz = -Math.cos(azimuth) // forward
  const rx = Math.cos(azimuth), rz = -Math.sin(azimuth)  // right
  return [f * fx + r * rx, f * fz + r * rz]
}

// Free flight never enters a building. A move whose end is under the roof clearance slides along the free
// axis (x-only, then z-only); a small rise (≤ STEP_M) is climbed; head-on, the camera rises at up to twice
// its glide speed instead of stopping.
export const STEP_M = 12

export function slideMove([px, py, pz], [dx, dy, dz], clearance) {
  const y = py + dy
  const ok = (x, z) => clearance(x, z) <= y + STEP_M
  const lift = (x, z) => Math.max(0, clearance(x, z) - y)
  if (ok(px + dx, pz + dz)) return [dx, dy + lift(px + dx, pz + dz), dz]
  if (dx && ok(px + dx, pz)) return [dx, dy + lift(px + dx, pz), 0]
  if (dz && ok(px, pz + dz)) return [0, dy + lift(px, pz + dz), dz]
  const rise = Math.min(lift(px + dx, pz + dz), 2 * Math.hypot(dx, dz))
  return [0, dy + rise, 0]
}
