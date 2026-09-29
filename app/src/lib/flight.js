// app/src/lib/flight.js — cinematic fly-to: eased glide that arcs up over the city on long jumps.
import { MIN_ALT } from './cameraMath.js'

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const copy = (p) => ({ position: [...p.position], target: [...p.target] })

export function flightDuration(from, to) {
  const d = Math.max(dist(from.target, to.target), dist(from.position, to.position))
  return Math.min(4.5, Math.max(1.4, 1.4 + d / 2500))
}

export function flyPose(from, to, t) {
  if (t <= 0) return copy(from)
  if (t >= 1) return copy(to)
  const k = ease(t)
  const lerp = (a, b) => a.map((v, i) => v + (b[i] - v) * k)
  const lift = Math.min(1400, 0.35 * dist(from.target, to.target)) * Math.sin(Math.PI * t)
  const position = lerp(from.position, to.position)
  position[1] += lift
  return { position, target: lerp(from.target, to.target) }
}

export function poseForPlace({ x, z, top = 0 }) {
  const d = Math.max(420, top * 2.3)
  return {
    position: [x + d * 0.55, Math.max(MIN_ALT, top * 0.85 + 90), z + d * 0.65],
    target: [x, top * 0.5, z],
  }
}
