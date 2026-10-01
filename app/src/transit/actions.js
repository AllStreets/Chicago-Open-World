// app/src/transit/actions.js — what the transit buttons and ⌘K entries do.
import { useStore } from '../state/store.js'
import { getSim } from './simStore.js'
import { trainsNow } from './liveStore.js'
import { poseForPlace } from '../lib/flight.js'

// Nearest train you can see: any elevated or surface train beats one in the subway.
export function pickTrain(trains, here) {
  const d = (t) => Math.hypot(t.head.p[0] - here[0], t.head.p[2] - here[1]) + (t.head.p[1] < -1 ? 1e6 : 0)
  return [...trains].sort((a, b) => d(a) - d(b))[0]
}

export function followNearest(spec, ms = Date.now()) {
  const s = useStore.getState(), sim = getSim()
  if (!sim) { s.stopFollow('none'); return false }
  const ops = new Map((s.transit?.lines ?? []).map((l) => [l.id, l.operator]))
  const want = (t) => spec === 'any' || (spec === 'metra' ? ops.get(t.line) === 'metra' : t.line === spec)
  const here = [s.readout.x ?? 0, s.readout.z ?? 0]
  const best = pickTrain(trainsNow(ms).filter((t) => want(t) && t.cars?.[0]), here) // P5: the trains on screen — live CTA when the feed is LIVE
  if (!best) { s.stopFollow('none'); return false }
  s.setTransitOn(true)
  s.setHiddenLines(s.hiddenLines.filter((x) => x !== best.line))
  s.startFollow(best.id)
  return true
}

export function lineFramePose(transit, id) {
  const pts = (transit?.routes ?? []).filter((r) => r.line === id).flatMap((r) => r.path)
  if (!pts.length) return null
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[2])
  const x = (Math.min(...xs) + Math.max(...xs)) / 2, z = (Math.min(...zs) + Math.max(...zs)) / 2
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs))
  const pose = poseForPlace({ x, z, top: Math.min(1200, span * 0.35) }) // far enough back to see the whole line
  return { position: pose.position, target: [x, 0, z] }                // looking at the ground, not mid-air
}

export function showLine(id) {
  const s = useStore.getState(), line = s.transit?.lines.find((l) => l.id === id)
  s.setTransitOn(true)
  s.setHiddenLines(s.hiddenLines.filter((x) => x !== id))
  const pose = lineFramePose(s.transit, id)
  if (pose) s.startFlight(pose, line?.name ?? id)
}

export function goToStation(st) {
  const s = useStore.getState()
  s.startFlight(poseForPlace({ x: st.x, z: st.z, top: Math.max(40, (st.y ?? 0) + 30) }), st.name)
  s.select({ kind: 'station', id: st.id })
}
