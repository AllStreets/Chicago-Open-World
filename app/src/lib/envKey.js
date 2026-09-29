// app/src/lib/envKey.js — when to re-capture sky reflections: every ~2° of sun movement.
const STEP = 2
export function envKey([x, y, z]) {
  const elev = (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI
  const az = (Math.atan2(x, -z) * 180) / Math.PI
  return `${Math.round(elev / STEP) * STEP}:${Math.round(az / (STEP * 4)) * STEP * 4}`
}
