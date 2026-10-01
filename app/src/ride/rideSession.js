// app/src/ride/rideSession.js — the ride that is running now (P7): its definition, its run (or glider), the view and the
// rider's look. AtlasRig calls frame() each frame for the camera pose; the train renderer asks for the ride train; the
// bus and glider meshes ask for the vehicle pose; the bar reads a 5 Hz snapshot from the store.
import { useStore } from '../state/store.js'
import { getSim } from '../transit/simStore.js'
import { pointAt } from '../transit/path.js'
import { tauAtS } from '../transit/profile.js'
import { consistFor, carPoses } from '../transit/consist.js'
import { createRun, stepRun, runState, skipStop, cycleSpeed, ridePose, UNDERGROUND_Y } from './rideRun.js'
import { allRides, ridesJsonNow, VIEWS } from './rideCatalog.js'
import { createGlider, glideStep, chasePose, glideInput, forward } from './glide.js'
import { roofHeightAt } from '../lib/clearance.js'
import { WORLD_BOUNDS } from '../lib/cameraMath.js'
import { allTilePois } from '../world/poiRegistry.js'

let S = null
export const sessionActive = () => S !== null
export const sessionDef = () => S?.def ?? null

export function rideDefById(id) {
  if (!id) return null
  return allRides(getSim(), useStore.getState().transit, ridesJsonNow()).find((d) => d.id === id) ?? null
}

// where to get on: the stop nearest where you are looking (within 3 km), else the first
export function boardingStop(def, [x, z]) {
  let best = 0, bd = 3000
  def.stops.forEach((st, i) => { const p = pointAt(def.path, st.s).p, d = Math.hypot(p[0] - x, p[2] - z); if (d < bd && i < def.stops.length - 1) { bd = d; best = i } })
  return best
}

export function beginSession(def, from) {
  if (def.kind === 'glide') {
    const [px, py, pz] = from.position, [tx, , tz] = from.target
    const heading = Math.atan2(-(tx - px), -(tz - pz)) // the way the camera faces
    const y = Math.max(py, roofHeightAt(px, pz) + 60, 120)
    S = { def, glider: createGlider({ position: [px, y, pz], heading, speed: 35 }), view: 'chase', look: { yaw: 0, pitch: 0 }, hudAt: 0, last: null }
  } else {
    const fromStop = def.kind === 'walk' ? 0 : boardingStop(def, [from.target[0], from.target[2]])
    S = { def, run: createRun(def, { fromStop }), view: VIEWS[def.kind]?.[0] ?? 'cab', look: { yaw: 0, pitch: 0 }, hudAt: 0, last: null }
    if (def.kind === 'L') {
      const sim = getSim(), period = 'midday'
      S.consist = consistFor(def.spec, period, def.inbound)
      S.dims = sim?.transit?.rollingStock ?? useStore.getState().transit?.rollingStock ?? {}
    }
  }
  return S
}
export function endSession() { const last = S?.last ?? null; S = null; return last }
export const lastPose = () => S?.last ?? null

const clampWorld = ([x, z]) => [Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, x)), Math.max(WORLD_BOUNDS.minZ, Math.min(WORLD_BOUNDS.maxZ, z))]

// this frame's camera pose (and the run advanced by dt); ctx = { keys, tunnels, clearance, reducedMotion }
export function frame(dt, ctx) {
  if (!S) return null
  const r = useStore.getState().ride
  if (S.def.kind === 'glide') {
    S.glider = glideStep(S.glider, glideInput(ctx.keys ?? new Set()), Math.min(dt, 0.25), { clearanceAt: roofHeightAt, clamp: clampWorld })
    S.last = chasePose(S.glider, { reducedMotion: ctx.reducedMotion })
  } else {
    S.run = stepRun(S.def, { ...S.run, paused: Boolean(r?.paused) || S.run.done, speed: r?.speed ?? 1 }, dt)
    S.state = runState(S.def, S.run)
    S.tunnels = ctx.tunnels
    S.last = ridePose(S.def, S.state, r?.view ?? S.view, S.look, { tunnels: ctx.tunnels, clearance: ctx.clearance })
  }
  publishHud(ctx.now ?? performance.now())
  return S.last
}

// --- the rider's controls -------------------------------------------------------------------------------------------
// tests and screenshots: put the ride at arc length s (metres along its path), paused
export function seekRide(s) {
  if (!S?.run) return
  const def = S.def, tau = def.profile ? tauAtS(def.profile, s) : s / (def.paceMps ?? 1.4)
  S.run = { ...S.run, tau, done: false }
  const r = useStore.getState().ride
  if (r) useStore.setState({ ride: { ...r, paused: true } })
}
export function skip(dir) { if (S?.run) { S.run = skipStop(S.def, S.run, dir); publishHud(0, true) } }
export function nextSpeed(run = useStore.getState().ride, dir = 1) { return cycleSpeed({ speed: run?.speed ?? 1 }, dir).speed }
export function addLook(dx, dy) {
  if (!S || S.def.kind === 'glide') return
  S.look = { yaw: Math.max(-2.6, Math.min(2.6, S.look.yaw - dx * 0.005)), pitch: Math.max(-1.05, Math.min(1.05, S.look.pitch - dy * 0.004)) }
}
export const resetLook = () => { if (S) S.look = { yaw: 0, pitch: 0 } }

// --- what the rider sees around them -----------------------------------------------------------------------------
const SIGHT_CATS = new Set([4, 5, 7]) // venues, culture, outdoors (not shops, services, offices or apartments)
let chainsFor = null, chains = new Set()
// Landmarks first (nearest first), then the venues, museums and parks you pass — never a chain (a name on 3+ places)
export function nearbyNames([x, z], radius, landmarks = useStore.getState().manifest?.landmarks ?? [], pois = allTilePois()) {
  if (chainsFor !== pois.length) {
    const n = new Map(); for (const p of pois) n.set(p.n, (n.get(p.n) ?? 0) + 1)
    chains = new Set([...n].filter(([, k]) => k >= 3).map(([name]) => name)); chainsFor = pois.length
  }
  const lm = landmarks.map((l) => [Math.hypot(l.x - x, l.z - z), l.name]).filter(([d]) => d <= radius).sort((a, b) => a[0] - b[0])
  const ps = pois.filter((p) => p.n && SIGHT_CATS.has(p.c) && !chains.has(p.n)).map((p) => [Math.hypot(p.x - x, p.z - z), p.n]).filter(([d]) => d <= radius * 0.5).sort((a, b) => a[0] - b[0])
  return [...new Set([...lm, ...ps].map((e) => e[1]))].slice(0, 3)
}

function publishHud(now, force = false) {
  if (!S || (!force && now - S.hudAt < 200)) return
  S.hudAt = now
  const kind = S.def.kind
  if (kind === 'glide') {
    const g = S.glider
    useStore.setState({ rideHud: { kind, speedKmh: Math.round(g.speed * 3.6), altM: Math.round(g.pos[1]), boost: g.boost } })
    return
  }
  const st = S.state ?? runState(S.def, S.run), p = st.head.p
  useStore.setState({ rideHud: {
    kind, next: st.next && { name: st.next.name, etaS: Math.round(st.etaS) }, at: st.atStop ? st.prev?.name : null, dwelling: st.dwelling,
    progress: st.progress, done: Boolean(S.run.done), underground: kind === 'L' && p[1] < UNDERGROUND_Y, tunnels: Boolean(S.tunnels),
    nearby: nearbyNames([p[0], p[2]], kind === 'walk' ? 250 : 450),
  } })
}

// --- the vehicles ---------------------------------------------------------------------------------------------------
// the L ride's own train, in the simulator's shape, for the instanced renderer
export function rideTrain() {
  if (!S || S.def.kind !== 'L' || !S.state) return null
  const st = S.state
  return { id: 'ride', rn: 'RIDE', line: S.def.line, service: S.def.service, destination: S.def.stops.at(-1)?.name, sHead: st.s, speed: 0, head: st.head, cars: carPoses(S.def.path, st.s, S.consist, S.dims), nextStop: st.next && { station: st.next.station, name: st.next.name, eta: null }, ride: true }
}

// simulated trains of the same service close to the ride train step aside, so two trains never overlap
export function hideNearRide(trains, ride, behind = 250, ahead = 400) {
  if (!ride) return trains
  return trains.filter((t) => t.service !== ride.service || t.sHead < ride.sHead - behind - 200 || t.sHead > ride.sHead + ahead)
}
export function withRideTrain(trains) {
  const ride = rideTrain()
  return ride ? [...hideNearRide(trains, ride), ride] : trains
}

// the bus or glider pose for its mesh: { pos, yaw, pitch, roll } or null
export function vehiclePose() {
  if (!S) return null
  if (S.def.kind === 'glide') { const g = S.glider, [fx, fz] = forward(g.heading); return { kind: 'glide', pos: g.pos, yaw: Math.atan2(-fz, fx), pitch: g.pitch, roll: g.bank } }
  if (S.def.kind !== 'bus' || !S.state) return null
  const half = 6.1, s = Math.max(0, S.state.s - half), c = pointAt(S.def.path, s), d = S.state.head.dir
  return { kind: 'bus', pos: c.p, yaw: Math.atan2(-d[2], d[0]), pitch: 0, roll: 0 }
}
