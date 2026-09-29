// app/src/transit/sim.js — simulated trains (C8, C12), deterministic from the wall clock: departures per line and
// period → a precomputed speed/time profile per service → the head's arc length → bogie-sampled car poses.
import { chicagoClock, periodOf } from './clock.js'
import { makePath, pointAt } from './path.js'
import { buildProfile, sAt, tauAtS, zoneLimit } from './profile.js'
import { consistFor, carPoses } from './consist.js'

export function hash01(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) / 4294967296
}

export function departuresForDay(sv, dayStartMs, weekend, periods, carryMs = -Infinity) {
  const out = []
  let t = null
  for (const [name, h0, h1] of weekend ? periods.weekend : periods.weekday) {
    const hw = sv.spec.headwayMin?.[name]
    if (!hw) { t = null; continue } // no service this period
    const step = hw * 60000, a = h0 * 3600000, b = h1 * 3600000
    if (t === null || t < a) t = Math.max(a + sv.phase * step, carryMs)
    for (; t < b; t += step) out.push(dayStartMs + t)
  }
  return out
}

const memo = (map, key, fn) => { if (!map.has(key)) { if (map.size > 4000) map.clear(); map.set(key, fn()) } return map.get(key) }

export function createSim(transit) {
  const periods = transit.servicePeriods, dims = transit.rollingStock
  const lines = new Map(transit.lines.map((l) => [l.id, l])), routes = new Map(transit.routes.map((r) => [r.id, r]))
  const services = []
  for (const sv of transit.services ?? []) {
    const line = lines.get(sv.line), spec = line?.service
    if (!spec) continue
    const pts = [], stops = []
    let offset = 0
    for (const id of sv.routes) {
      const r = routes.get(id)
      if (!r || r.path.length < 2) continue
      if (pts.length) offset += Math.hypot(r.path[0][0] - pts.at(-1)[0], r.path[0][2] - pts.at(-1)[2]) // the join between routes
      for (const st of r.stops) stops.push({ station: st.station, name: st.name, s: st.s + offset })
      pts.push(...r.path)
      offset += makePath(r.path).length
    }
    if (pts.length < 2) continue
    const path = makePath(pts)
    const profile = buildProfile(path, stops.map((s) => s.s), { vmax: spec.vmaxKmh / 3.6, accel: spec.accel, brake: spec.brake, dwellS: spec.dwellS, limitAt: zoneLimit })
    const last = routes.get(sv.routes.at(-1))
    services.push({ id: sv.id, line: sv.line, inbound: !!sv.inbound, spec, path, stops, profile, phase: hash01(sv.id), to: last?.to || stops.at(-1)?.name || line.name })
  }

  const base = new Map(), final = new Map(), consists = new Map()
  const baseFor = (sv, day) => memo(base, `${sv.id}|${day.date}`, () => departuresForDay(sv, day.midnightMs, day.weekend, periods))
  // a day's departures start at least one headway after yesterday's last (no bunching at midnight)
  function departures(sv, day) {
    return memo(final, `${sv.id}|${day.date}`, () => {
      const y = baseFor(sv, chicagoClock(day.midnightMs - 3600000))
      const carry = y.length ? y.at(-1) + (sv.spec.headwayMin[periodOf(chicagoClock(y.at(-1)), periods)] ?? 0) * 60000 - day.midnightMs : -Infinity
      return departuresForDay(sv, day.midnightMs, day.weekend, periods, carry)
    })
  }

  function trainAt(sv, day, k, dep, ms) {
    const tau = (ms - dep) / 1000, sHead = sAt(sv.profile, tau)
    const consist = memo(consists, `${sv.id}|${day.date}|${k}`, () => consistFor(sv.spec, periodOf(chicagoClock(dep), periods), sv.inbound))
    const cars = carPoses(sv.path, sHead, consist, dims)
    const next = sv.stops.find((st) => st.s > sHead + 1) ?? null
    return {
      id: `${sv.id}:${day.date}:${k}`, rn: String(sv.spec.runBase + (k % 100)), line: sv.line, service: sv.id, destination: sv.to,
      sHead, speed: sAt(sv.profile, tau + 0.5) - sAt(sv.profile, tau - 0.5), head: pointAt(sv.path, sHead), cars,
      nextStop: next && { station: next.station, name: next.name, eta: dep + tauAtS(sv.profile, next.s) * 1000 },
    }
  }

  // chicagoClock is an Intl call: per frame, only re-resolve the day when the clock leaves the cached one
  let days = null
  function daysFor(ms) {
    if (!days || ms < days.today.midnightMs || ms >= days.until) {
      const today = chicagoClock(ms)
      days = { today, yday: chicagoClock(today.midnightMs - 3600000), until: chicagoClock(today.midnightMs + 25 * 3600000).midnightMs }
    }
    return days
  }

  function trainsAt(ms) {
    const { today, yday } = daysFor(ms), out = []
    for (const sv of services) for (const day of [yday, today]) {
      departures(sv, day).forEach((dep, k) => { if (ms >= dep && ms <= dep + sv.profile.duration * 1000) out.push(trainAt(sv, day, k, dep, ms)) })
    }
    return out
  }

  // simulated arrivals, in the shape of CHI's /api/cta/arrivals so Phase 5 can swap the source
  function arrivalsAt(stationId, ms, horizonMin = 30) {
    const today = chicagoClock(ms), end = ms + horizonMin * 60000, out = []
    const days = [chicagoClock(today.midnightMs - 3600000), today, chicagoClock(today.midnightMs + 25 * 3600000)]
    for (const sv of services) for (const st of sv.stops) {
      if (st.station !== stationId) continue
      const lag = tauAtS(sv.profile, st.s) * 1000
      for (const day of days) departures(sv, day).forEach((dep, k) => {
        const at = dep + lag
        if (at < ms || at > end) return
        out.push({ station: st.name, line: sv.line, destination: sv.to, arrTime: new Date(at).toISOString(), isApproaching: at - ms < 60000, isDelayed: false, minutes: Math.floor((at - ms) / 60000), rn: String(sv.spec.runBase + (k % 100)), trainId: `${sv.id}:${day.date}:${k}` })
      })
    }
    return out.sort((a, b) => (a.arrTime < b.arrTime ? -1 : a.arrTime > b.arrTime ? 1 : 0)).slice(0, 8)
  }
  const trainById = (id, ms) => trainsAt(ms).find((t) => t.id === id) ?? null
  return { transit, services, departures, trainsAt, arrivalsAt, trainById }
}
