// app/src/lib/tourPoses.js — where each tour stop looks from (P4 · I-4.2): a stop's own pose, or the landmark's
// place pose, lifted clear of the roofs (G1). The tour clock lives here too: read every frame by the camera, pushed
// to the store only a few times a second for the tour bar.
import tours from '../data/tours.json'
import { liftAboveRoofs } from './flight.js'
import { clearanceAt, roofHeightAt } from './clearance.js'

export const TOURS = tours
export const tourById = (id) => tours.find((t) => t.id === id) ?? null

// A tour frames each landmark closer than a ⌘K flight: ~1.6× its height away (at least 220 m), a little above its
// crown and looking into it — from whichever of eight directions has the clearest sightline (the default south-east
// first), so a neighbouring tower doesn't fill the frame.
const DIRS = [[0.6, 0.8], [0.8, 0.6], [0.8, -0.6], [0.6, -0.8], [-0.6, -0.8], [-0.8, -0.6], [-0.8, 0.6], [-0.6, 0.8]]
export function tourStopPose({ x, z, top }, roofs = roofHeightAt) {
  const d = Math.max(220, top * 1.6), camY = top * 1.05 + 30, tgtY = top * 0.7
  let best = null, bestBlock = Infinity
  for (const [ux, uz] of DIRS) {
    let block = 0
    for (let k = 1; k < 12; k++) { // along the sightline from the camera toward the target, stopping short of it
      const t = k / 12, sx = x + ux * d * (1 - t), sz = z + uz * d * (1 - t), sy = camY + (tgtY - camY) * t
      block += Math.max(0, roofs(sx, sz) - sy)
    }
    if (block < bestBlock - 1) { best = [ux, uz]; bestBlock = block }
  }
  return { position: [x + best[0] * d, camY, z + best[1] * d], target: [x, tgtY, z] }
}

export function tourPoses(tour, manifest) {
  const L = manifest?.landmarks ?? []
  return tour.stops.map((s) => {
    if (s.pose) return liftAboveRoofs(s.pose, clearanceAt)
    const lm = L.find((l) => l.key === s.landmark)
    const at = lm ? { x: lm.x, z: lm.z, top: lm.top } : { x: 0, z: 0, top: 50 }
    return liftAboveRoofs(tourStopPose({ ...at, top: Math.max(40, at.top) }), clearanceAt)
  })
}

export const tourClock = { t: 0 }

// Start a tour from its first stop: flights and following stop, the tour's time of day applies.
export function startTour(id, store) {
  const def = tourById(id)
  if (!def) return
  const s = store.getState()
  tourClock.t = 0
  s.clearFlight?.(); s.stopFollow?.()
  if (def.time) s.setTimePreset(def.time)
  s.setTour({ id, t: 0, playing: true })
}
