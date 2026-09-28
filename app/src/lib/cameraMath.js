// app/src/lib/cameraMath.js — pure camera limits + keyboard glide.
export const MIN_ALT = 30
export const MAX_DIST = 3000

export function clampCamera(position, target) {
  let [tx, ty, tz] = target
  ty = Math.max(0, ty)
  const tr = Math.hypot(tx, tz)
  if (tr > MAX_DIST) { tx *= MAX_DIST / tr; tz *= MAX_DIST / tr }
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
  const clamped = target[1] < 0 || tr > MAX_DIST || d > MAX_DIST || lifted
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
