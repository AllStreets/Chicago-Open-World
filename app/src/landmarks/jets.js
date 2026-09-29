// app/src/landmarks/jets.js — ballistic fountain jets (JS mirror of FountainShow's vertex shader).
export const G = 9.81
export const KIND = { centre: 0, seahorse: 1, ring: 2, lower: 3, crown: 4 }
export const PARTICLES = { centre: 7000, seahorse: 450, ring: 120, lower: 90, crown: 400 }
const fract = (x) => x - Math.floor(x)
export const launchSpeed = (h) => Math.sqrt(2 * G * Math.max(0, h))
export function landingTime(e, level) {
  const vy = launchSpeed(e.h * level) * e.dir[1]
  return (vy + Math.sqrt(vy * vy + 2 * G * Math.max(0, e.p[1] - e.floor))) / G
}
export function jetPoint(e, level, seed, t) {
  const h = e.h * level
  if (h < 0.05) return null
  const spread = e.kind === 'centre' ? 0.03 : 0.08
  const d = [e.dir[0] + (fract(seed * 7.13) - 0.5) * spread, e.dir[1], e.dir[2] + (fract(seed * 3.91) - 0.5) * spread]
  const l = Math.hypot(...d), v = launchSpeed(h), T = landingTime(e, level)
  const tau = fract(seed + t / T) * T
  return [e.p[0] + (d[0] / l) * v * tau, e.p[1] + (d[1] / l) * v * tau - 0.5 * G * tau * tau, e.p[2] + (d[2] / l) * v * tau]
}
export function buildParticles(emitters) {
  const n = emitters.reduce((s, e) => s + PARTICLES[e.kind], 0), emitter = new Float32Array(n), seed = new Float32Array(n)
  let k = 0
  emitters.forEach((e, i) => { for (let j = 0; j < PARTICLES[e.kind]; j++, k++) { emitter[k] = i; seed[k] = fract(Math.sin((k + 1) * 12.9898) * 43758.5453) } })
  return { emitter, seed }
}

// The show's emitter list, built once per landmarks runtime: a fresh array per render would rebuild the particle
// geometry and material every minute (V6 review #2).
const emitterCache = new WeakMap()
export function showEmitters(runtime) {
  if (!emitterCache.has(runtime)) emitterCache.set(runtime, [...(runtime?.fountain?.emitters ?? []), ...(runtime?.crown?.spouts ?? [])])
  return emitterCache.get(runtime)
}
