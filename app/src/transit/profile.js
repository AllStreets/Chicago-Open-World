// app/src/transit/profile.js — how a train moves along its service: line speed, curve limits, acceleration,
// braking into each stop and the dwell there, precomputed once as (time, arc length) knots.
import { pointAt } from './path.js'

export const A_LAT = 0.9       // m/s² lateral comfort: the Loop's 27 m curves come out near 10 mph
export const STEP_M = 5
export const CURVE_SPAN_M = 10
// The Union Loop (Lake / Wabash / Van Buren / Wells, and the subways beneath it) is a slow zone: ~30 mph at most.
export const LOOP_ZONE = { x: [-530, 170], z: [-440, 600], kmh: 48 }
export const zoneLimit = (p, z = LOOP_ZONE) => (p[0] > z.x[0] && p[0] < z.x[1] && p[2] > z.z[0] && p[2] < z.z[1] ? z.kmh / 3.6 : Infinity)

export function curveLimit(path, s) {
  const a = pointAt(path, s - CURVE_SPAN_M).p, b = pointAt(path, s).p, c = pointAt(path, s + CURVE_SPAN_M).p
  const ab = Math.hypot(b[0] - a[0], b[2] - a[2]), bc = Math.hypot(c[0] - b[0], c[2] - b[2]), ca = Math.hypot(a[0] - c[0], a[2] - c[2])
  const area2 = Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]))
  if (area2 < 1e-6) return Infinity
  return Math.sqrt(A_LAT * ((ab * bc * ca) / (2 * area2)))
}

export function buildProfile(path, stopS, { vmax, accel, brake, dwellS, limitAt = null }) {
  const n = Math.max(2, Math.ceil(path.length / STEP_M) + 1), ds = path.length / (n - 1)
  const stops = new Set(stopS.map((s) => Math.min(n - 1, Math.max(0, Math.round(s / ds)))))
  const lim = Array.from({ length: n }, (_, i) => (stops.has(i) ? 0 : Math.min(vmax, curveLimit(path, i * ds), limitAt ? limitAt(pointAt(path, i * ds).p) : Infinity)))
  const v = lim.slice()
  for (let i = 1; i < n; i++) v[i] = Math.min(lim[i], Math.sqrt(v[i - 1] ** 2 + 2 * accel * ds))
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * brake * ds))
  const knots = [[0, 0]]
  let t = 0
  if (stops.has(0)) { t += dwellS; knots.push([t, 0]) }
  for (let i = 1; i < n; i++) {
    t += ds / Math.max((v[i - 1] + v[i]) / 2, 0.3) // never stall between two stationary samples
    knots.push([t, i * ds])
    if (stops.has(i)) { t += dwellS; knots.push([t, i * ds]) }
  }
  return { knots, duration: t, ds }
}

export function sAt(profile, tau) {
  const k = profile.knots
  if (tau <= 0) return k[0][1]
  if (tau >= profile.duration) return k.at(-1)[1]
  let lo = 0, hi = k.length - 1
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (k[mid][0] <= tau) lo = mid; else hi = mid }
  const [t0, s0] = k[lo], [t1, s1] = k[hi]
  return t1 > t0 ? s0 + ((s1 - s0) * (tau - t0)) / (t1 - t0) : s1
}

export function tauAtS(profile, s) {
  const k = profile.knots
  if (s <= k[0][1]) return k[0][0]
  let lo = 0, hi = k.length - 1
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (k[mid][1] < s) lo = mid; else hi = mid }
  const [t0, s0] = k[lo], [t1, s1] = k[hi]
  return s1 > s0 ? t0 + ((t1 - t0) * (s - s0)) / (s1 - s0) : t1
}
