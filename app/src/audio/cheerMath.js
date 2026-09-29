// app/src/audio/cheerMath.js — pure numbers for the crowd sound: attenuation, murmur, swell timing and shape.
export const CHEER = { refDistance: 80, maxDistance: 1500, rolloff: 1.1 }
export const MURMUR = { idle: 0, pregame: 0.12, live: 0.28, postgame: 0.16 }
export const murmurLevel = (state) => MURMUR[state] ?? 0
export function distanceGain(d) {
  if (d >= CHEER.maxDistance) return 0
  const r = CHEER.refDistance
  return r / (r + CHEER.rolloff * (Math.max(d, r) - r))
}
const h = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x) }
// Simulated scoring swells: in each minute, a 40 % chance of one at a hashed second.
export function cheerTimes(seed, t0, t1) {
  const out = []
  for (let m = Math.floor(t0 / 60); m <= Math.floor(t1 / 60); m++) {
    if (h(seed, m) >= 0.4) continue
    const t = m * 60 + h(seed + 0.5, m) * 60
    if (t >= t0 && t < t1) out.push(t)
  }
  return out
}
export function lastCheer(seed, t) { const c = cheerTimes(seed, t - 600, t + 1e-6); return c.length ? c[c.length - 1] : -Infinity }
export function swellEnvelope(dt) {
  if (!Number.isFinite(dt) || dt < 0) return 0
  return dt < 0.4 ? dt / 0.4 : Math.exp(-(dt - 0.4) / 1.6)
}
export function swellNow(state, seed, nowSec, pushed) {
  const sim = state === 'live' ? swellEnvelope(nowSec - lastCheer(seed, nowSec)) : 0
  const live = pushed ? swellEnvelope(nowSec - pushed.at / 1000) * Math.min(1, pushed.strength ?? 1) : 0
  return Math.max(sim, live)
}
