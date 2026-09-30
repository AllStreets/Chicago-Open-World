// app/src/bridges/lift.js — Chicago's boat-run bridge lifts: schedule, leaf angles and the trunnion rotation.
import { chicagoClock } from '../lib/chicagoTime.js'

export const MAX_LIFT_DEG = 75
export const LIFT = { raiseS: 90, holdS: 240, lowerS: 90, staggerS: 150 }
export const LIFT_DEMO = { raiseS: 14, holdS: 40, lowerS: 14, staggerS: 2.5 } // the B button: every bridge moving within half a minute
export const STOP_LOWER_S = 6 // pressing B again: every leaf down within seconds
// Spring runs bring sailboats in from the lake to the boatyards, fall runs take them back out.
export const BOAT_RUNS = { spring: [4, 5, 6], fall: [9, 10, 11], starts: { 3: [9, 30], 6: [8, 0] }, source: 'https://www.chicagoloopbridges.com/ (CDOT boat-run lift schedule)' }

export const runDuration = (n, T = LIFT) => Math.max(0, n - 1) * T.staggerS + T.raiseS + T.holdS + T.lowerS
const ease = (x) => x * x * (3 - 2 * x)
export function liftAngle(t, T = LIFT) {
  const max = (MAX_LIFT_DEG * Math.PI) / 180
  if (t <= 0) return 0
  if (t < T.raiseS) return max * ease(t / T.raiseS)
  if (t < T.raiseS + T.holdS) return max
  if (t < T.raiseS + T.holdS + T.lowerS) return max * (1 - ease((t - T.raiseS - T.holdS) / T.lowerS))
  return 0
}
export const liftPlan = (order, elapsed, T = LIFT) => Object.fromEntries(order.map((k, i) => [k, liftAngle(elapsed - i * T.staggerS, T)]))

export function boatRunAt(date, order) {
  const c = chicagoClock(date), start = BOAT_RUNS.starts[c.weekday]
  const season = BOAT_RUNS.spring.includes(c.month) ? 'spring' : BOAT_RUNS.fall.includes(c.month) ? 'fall' : null
  if (!season || !start) return null
  const elapsed = (c.hour - start[0]) * 3600 + (c.minute - start[1]) * 60 + c.second + date.getMilliseconds() / 1000
  if (elapsed < 0 || elapsed > runDuration(order.length)) return null
  return { season, elapsed, order: season === 'spring' ? order : [...order].reverse() }
}

// manualStop: the person pressed B again mid-lift — every leaf eases down from where it was within STOP_LOWER_S.
export function liftState({ now, manualStart = null, manualStop = null, order }) {
  if (manualStart != null && manualStop != null) {
    const k = (now - manualStop) / 1000 / STOP_LOWER_S
    if (k >= 1) return { source: 'manual', done: true, angles: {}, T: LIFT_DEMO }
    const from = liftPlan(order, (manualStop - manualStart) / 1000, LIFT_DEMO), e = ease(Math.max(0, k))
    return { source: 'manual', done: false, angles: Object.fromEntries(order.map((b) => [b, from[b] * (1 - e)])), T: LIFT_DEMO }
  }
  if (manualStart != null) {
    const elapsed = (now - manualStart) / 1000
    const done = elapsed > runDuration(order.length, LIFT_DEMO)
    return { source: 'manual', done, angles: done ? {} : liftPlan(order, elapsed, LIFT_DEMO), T: LIFT_DEMO }
  }
  const run = boatRunAt(new Date(now), order)
  return { source: run ? run.season : 'idle', done: false, angles: run ? liftPlan(run.order, run.elapsed) : {}, elapsed: run ? run.elapsed : null, order: run?.order ?? null, T: LIFT }
}

// Rodrigues rotation of p about the unit axis k through pivot (mirrors the USE_LEAF vertex shader).
export function rotateAboutAxis(p, pivot, k, a) {
  const v = [p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2]], c = Math.cos(a), s = Math.sin(a)
  const kxv = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]], kd = k[0] * v[0] + k[1] * v[1] + k[2] * v[2]
  return [0, 1, 2].map((i) => pivot[i] + v[i] * c + kxv[i] * s + k[i] * kd * (1 - c))
}
