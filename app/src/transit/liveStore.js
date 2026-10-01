// app/src/transit/liveStore.js — the live CTA tracker for the loaded transit.json (P5 · C11), fed by the cta feed, and
// the renderer's one call for this frame's trains: live CTA + simulated Metra, or the simulator alone (C12).
import { project } from '../../../shared/project.js'
import { useStore } from '../state/store.js'
import { getSim } from './simStore.js'
import { createLiveTracker, servicePaths } from './liveTrains.js'
import { pickTrains } from './trainSource.js'
import { pointAt } from './path.js'
import { consistFor, carPoses } from './consist.js'
import { chicagoClock, periodOf } from './clock.js'

let tracker = null, trackerSim = null
export function getTracker() {
  const sim = getSim()
  if (!sim) return null
  if (!tracker || trackerSim !== sim) { tracker = createLiveTracker({ paths: servicePaths(sim), project }); trackerSim = sim }
  return tracker
}

export function ingestLiveTrains(json, tMs = Date.now()) {
  getTracker()?.ingest(json?.trains ?? [], tMs)
}

export const liveReports = () => tracker?.reports() ?? []

// A live train in the simulator's shape (head, cars, next stop), so the renderer, cards and follow cam never know.
const consists = new Map()
export function decorateLive(t, sim = getSim(), tMs = Date.now()) {
  const sv = sim?.services.find((x) => x.id === t.pathId)
  if (!sv) return null
  const sHead = Math.min(t.s, sv.path.length)
  const key = `${sv.id}|${periodOf(chicagoClock(tMs), sim.transit.servicePeriods)}`
  if (!consists.has(key)) consists.set(key, consistFor(sv.spec, key.split('|')[1], sv.inbound)) // the line's typical consist (the feed has none)
  const next = sv.stops.find((st) => st.s > sHead + 1) ?? null
  return {
    ...t, sHead, destination: t.destination ?? sv.to, head: pointAt(sv.path, sHead),
    cars: carPoses(sv.path, sHead, consists.get(key), sim.transit.rollingStock),
    nextStop: next && { station: next.station, name: next.name, eta: null },
  }
}

// The frame's trains for everyone (Trains.jsx publishes them).
export function trainsNow(tMs = Date.now()) {
  const sim = getSim()
  if (!sim) return []
  return pickTrains({ ctaStatus: useStore.getState().feeds.cta, tracker, simTrainsAt: (ms) => sim.trainsAt(ms), tMs, decorate: (t) => decorateLive(t, sim, tMs) })
}
