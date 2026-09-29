// app/src/transit/consist.js — which cars a train has, and where each sits on the track, articulating on its bogies.
import { pointAt } from './path.js'

export const COUPLER_GAP_M = 0.9

export function consistFor(spec, period, inbound) {
  const n = period === 'peak' ? spec.cars.peak : spec.cars.offpeak
  if (spec.stock === 'metra') {
    const coaches = Array.from({ length: n }, () => ({ model: 'metraCoach', flip: false, lead: 0 }))
    if (inbound) { // push: the cab car leads into downtown, the locomotive pushes from the suburban end
      coaches[0] = { ...coaches[0], lead: 1 }
      return [...coaches, { model: 'metraLoco', flip: true, lead: -1 }]
    }
    coaches[n - 1] = { model: 'metraCoach', flip: true, lead: -1 } // pull: the locomotive leads out
    return [{ model: 'metraLoco', flip: false, lead: 1 }, ...coaches]
  }
  // CTA married pairs: every second car turned round, so each end of the train shows a cab
  return Array.from({ length: n }, (_, i) => ({ model: spec.stock, flip: i % 2 === 1, lead: i === 0 ? 1 : i === n - 1 ? -1 : 0 }))
}

export function carPoses(path, sHead, consist, dims, gap = COUPLER_GAP_M) {
  const out = []
  let front = sHead
  for (const car of consist) {
    const d = dims[car.model], centre = front - d.length / 2, sf = centre + d.truckCentres / 2, sr = centre - d.truckCentres / 2
    front -= d.length + gap
    if (sr < 0 || sf > path.length) { out.push(null); continue } // off the mapped track: outside the world
    const a = pointAt(path, sf).p, b = pointAt(path, sr).p
    const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2], h = Math.hypot(dx, dz)
    out.push({
      pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
      yaw: Math.atan2(-dz, dx) + (car.flip ? Math.PI : 0), pitch: (car.flip ? -1 : 1) * Math.atan2(dy, h),
      model: car.model, lead: car.lead, length: d.length,
    })
  }
  return out
}
