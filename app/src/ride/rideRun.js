// app/src/ride/rideRun.js — the one engine behind every path ride (P7): a ride definition (a path, its stops, a speed
// profile or a walking pace, an optional vehicle) and a run with its own clock, so pause, speed and skip-to-stop are
// exact. L rides use V4's own service profiles (the ride train accelerates, brakes and dwells like the city's trains).
// Pure: the session module keeps the run and calls these each frame.
import { pointAt } from '../transit/path.js'
import { sAt, tauAtS } from '../transit/profile.js'
import { followPose } from '../transit/followCam.js'

export const RIDE_SPEEDS = [1, 2, 4]
export const MAX_STEP_S = 0.25 // a tab switch or a GC pause never jumps a ride
export const WALK_MPS = 1.4
export const EYE_M = { L: 2.7, bus: 2.4, walk: 1.7 } // rail + car floor + a standing eye; a raised bus seat; a person
export const UNDERGROUND_Y = -2
export const STREET_EYE_M = 3

const pace = (def) => def.paceMps ?? WALK_MPS
const duration = (def) => (def.profile ? def.profile.duration : def.path.length / pace(def))
const sOf = (def, tau) => (def.profile ? sAt(def.profile, tau) : Math.max(0, Math.min(def.path.length, tau * pace(def))))
const tauOf = (def, s) => (def.profile ? tauAtS(def.profile, s) : s / pace(def))

export function createRun(def, { fromStop = 0 } = {}) {
  const st = def.stops?.[fromStop]
  return { tau: st ? tauOf(def, st.s) : 0, paused: false, speed: 1, done: false }
}

export function stepRun(def, run, dt) {
  if (run.paused || run.done) return run
  const tau = run.tau + Math.min(Math.max(dt, 0), MAX_STEP_S) * run.speed, end = duration(def)
  return tau >= end ? { ...run, tau: end, done: true } : { ...run, tau }
}

export const setSpeed = (run, speed) => ({ ...run, speed: RIDE_SPEEDS.includes(speed) ? speed : 1 })
export const cycleSpeed = (run, dir = 1) => {
  const i = RIDE_SPEEDS.indexOf(run.speed) + dir
  return setSpeed(run, RIDE_SPEEDS[Math.max(0, Math.min(RIDE_SPEEDS.length - 1, i))])
}

const NEAR = 2
export function runState(def, run) {
  const s = sOf(def, run.tau), stops = def.stops ?? []
  const next = stops.find((x) => x.s > s + NEAR) ?? null
  const prev = [...stops].reverse().find((x) => x.s <= s + NEAR) ?? null
  const moving = def.profile ? sOf(def, run.tau + 0.5) - sOf(def, run.tau - 0.5) > 0.01 : !run.paused
  const atStop = prev && Math.abs(prev.s - s) <= 3
  return {
    s, head: pointAt(def.path, s), next, prev, etaS: next ? Math.max(0, tauOf(def, next.s) - run.tau) : 0,
    dwelling: Boolean(def.profile && atStop && !moving), atStop: Boolean(atStop), progress: def.path.length ? s / def.path.length : 1,
  }
}

// to the next (+1) or the previous (−1) stop, arriving there; past the last stop the ride is over
export function skipStop(def, run, dir) {
  const s = sOf(def, run.tau), stops = def.stops ?? []
  const to = dir > 0 ? stops.find((x) => x.s > s + NEAR) : [...stops].reverse().find((x) => x.s < s - NEAR) ?? stops[0]
  if (!to) return { ...run, tau: duration(def), done: true }
  return { ...run, tau: Math.min(duration(def), tauOf(def, to.s) + 0.5), done: false }
}

// --- camera -------------------------------------------------------------------------------------------------------
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l) }
// turn a travel direction by the rider's look: yaw about +Y (positive = left), pitch up/down
function look(dir, yaw, pitch) {
  const c = Math.cos(yaw), s = Math.sin(yaw)
  const x = dir[0] * c + dir[2] * s, z = -dir[0] * s + dir[2] * c
  const h = Math.hypot(x, z) || 1, p = Math.atan2(dir[1], Math.hypot(dir[0], dir[2])) + pitch
  return [(x / h) * Math.cos(p), Math.sin(p), (z / h) * Math.cos(p)]
}

const LOOK_AHEAD = { L: 30, bus: 20, walk: 10 }
// where the vehicle (or walker) is heading here: toward a point a little further on, so corners turn smoothly
function heading(def, st) {
  const ahead = Math.min(def.path.length, st.s + (LOOK_AHEAD[def.kind] ?? 20))
  if (ahead - st.s < 1) return st.head.dir
  const a = pointAt(def.path, ahead).p, p = st.head.p
  return norm([a[0] - p[0], (a[1] - p[1]) * 0.5, a[2] - p[2]])
}

// views: 'cab' (L, bus: the front window), 'side' and 'chase' (V4's clearance-safe follow poses), 'eye' (walks)
export function ridePose(def, st, view, { yaw = 0, pitch = 0 } = {}, { tunnels = false, clearance = () => 0 } = {}) {
  const p = st.head.p, dir = heading(def, st)
  const underground = def.kind === 'L' && p[1] < UNDERGROUND_Y
  if ((view === 'side' || view === 'chase') && !underground && def.kind !== 'walk') {
    const f = followPose(p, st.head.dir, view, clearance, def.trainLength ?? 0)
    const d = norm(f.target.map((v, i) => v - f.position[i]))
    const dd = look(d, yaw, pitch)
    return { position: f.position, target: f.position.map((v, i) => v + dd[i] * 80) }
  }
  const h = Math.hypot(dir[0], dir[2]) || 1, back = def.kind === 'walk' ? 0 : 1.2
  const eye = underground && !tunnels ? STREET_EYE_M : p[1] + (EYE_M[def.kind] ?? 1.7)
  const position = [p[0] - (dir[0] / h) * back, eye, p[2] - (dir[2] / h) * back]
  const d = look(dir, yaw, pitch)
  return { position, target: position.map((v, i) => v + d[i] * 80) }
}

// Leaving a ride: lifted clear of the roofs (≥ 120 m, ≥ clearance + 25 — clearanceAt already includes the 25), looking ahead and down.
export function exitPose({ position, target }, clearance) {
  const dx = target[0] - position[0], dz = target[2] - position[2], h = Math.hypot(dx, dz) || 1
  const y = Math.max(120, clearance(position[0], position[2]) + 25)
  const back = 220
  const pos = [position[0] - (dx / h) * back, y, position[2] - (dz / h) * back]
  return { position: pos, target: [position[0] + (dx / h) * 260, 0, position[2] + (dz / h) * 260] }
}
