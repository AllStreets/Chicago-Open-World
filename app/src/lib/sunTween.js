// app/src/lib/sunTween.js — smooth sun direction changes (presets tween ~2.5 s).
export function stepSun(cur, tgt, dt, tau = 0.8) {
  const k = 1 - Math.exp(-dt / tau)
  let x = cur[0] + (tgt[0] - cur[0]) * k
  let y = cur[1] + (tgt[1] - cur[1]) * k
  let z = cur[2] + (tgt[2] - cur[2]) * k
  let l = Math.hypot(x, y, z)
  if (l < 1e-4) { x = cur[0] * 0.7 + 0.3 * -cur[2]; y = cur[1] + 0.3; z = cur[2] * 0.7 + 0.3 * cur[0]; l = Math.hypot(x, y, z) }
  return [x / l, y / l, z / l]
}
