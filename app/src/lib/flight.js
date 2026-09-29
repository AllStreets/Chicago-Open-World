// app/src/lib/flight.js — cinematic fly-to: eased glide that arcs up over the city on long jumps,
// lifted over any roof in the way and never ending inside a building (G1).
import { MIN_ALT } from './cameraMath.js'
import { clearanceAt } from './clearance.js'

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const copy = (p) => ({ position: [...p.position], target: [...p.target] })
const MAX_EXTRA_LIFT = 1500

export function flightDuration(from, to) {
  const d = Math.max(dist(from.target, to.target), dist(from.position, to.position))
  return Math.min(4.5, Math.max(1.4, 1.4 + d / 2500))
}

export function flyPose(from, to, t, extraLift = 0) {
  if (t <= 0) return copy(from)
  if (t >= 1) return copy(to)
  const k = ease(t)
  const lerp = (a, b) => a.map((v, i) => v + (b[i] - v) * k)
  const lift = (Math.min(1400, 0.35 * dist(from.target, to.target)) + extraLift) * Math.sin(Math.PI * t)
  const position = lerp(from.position, to.position)
  position[1] += lift
  return { position, target: lerp(from.target, to.target) }
}

// Raise the camera (never the target) to the clearance over where it stands.
export function liftAboveRoofs(pose, clearance = clearanceAt) {
  const [x, y, z] = pose.position
  const minY = clearance(x, z)
  return y >= minY ? copy(pose) : { position: [x, minY, z], target: [...pose.target] }
}

// Extra arc height so the middle of the path clears the roofs under it. The ends (t < 0.1, t > 0.9) are
// left to liftAboveRoofs per frame: dividing by a near-zero sine there would balloon the arc.
export function flightLift(from, to, clearance = clearanceAt) {
  let need = 0
  for (let s = 10; s <= 90; s++) {
    const t = s / 100
    const p = flyPose(from, to, t).position
    const deficit = clearance(p[0], p[2]) - p[1]
    if (deficit > 0) need = Math.max(need, deficit / Math.sin(Math.PI * t))
  }
  return Math.min(need, MAX_EXTRA_LIFT)
}

export function poseForPlace({ x, z, top = 0 }) {
  const d = Math.max(420, top * 2.3)
  return {
    position: [x + d * 0.55, Math.max(MIN_ALT, top * 0.85 + 90), z + d * 0.65],
    target: [x, top * 0.5, z],
  }
}
