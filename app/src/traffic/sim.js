// app/src/traffic/sim.js — cars, buses and trucks on the road graph (user, 2026-09-30). Each vehicle keeps its lane,
// follows the one ahead with an IDM-lite law, stops on amber and red at the junction's stop line, slows for turns and
// queues. Only links within ~1.5 km of the camera carry traffic: vehicles appear on them as they come into range (far
// from the camera) and go when they leave it. Density follows the hour the scene shows. Pure; Traffic.jsx draws it.
import { pointOnLink, signalState } from './graph.js'

export const TYPES = {
  car: { length: 4.6, width: 1.85, height: 1.45, accel: 1.8, decel: 2.8, vmul: 1 },
  bus: { length: 12.2, width: 2.55, height: 3.1, accel: 1.0, decel: 2.2, vmul: 0.85 },
  truck: { length: 16.5, width: 2.6, height: 3.9, accel: 0.8, decel: 2.2, vmul: 0.9 },
}
export const RANGE_M = 1500
const NEAR_M = 650
export const CAP = { LOW: 600, HIGH: 2400, ULTRA: 3200 }
// vehicles per km per lane at the busiest hour: motorway, trunk, primary, secondary, tertiary, local, ramp
const DENSITY = [30, 24, 20, 16, 12, 5, 8]
const S0 = 2.2, HEADWAY_S = 1.3, TURN_V = 6.5

// how busy the streets are at an hour (0–24) of the scene's clock
export function hourFactor(h) {
  const k = [0.12, 0.08, 0.06, 0.06, 0.1, 0.25, 0.55, 0.95, 1, 0.8, 0.7, 0.72, 0.78, 0.75, 0.72, 0.8, 0.95, 1, 0.85, 0.65, 0.5, 0.42, 0.32, 0.2]
  const i = Math.floor(((h % 24) + 24) % 24), f = h - Math.floor(h)
  return k[i] + (k[(i + 1) % 24] - k[i]) * f
}

// small deterministic RNG so a scene repopulates the same way
export function rng(seed = 1) {
  let s = seed >>> 0 || 1
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 }
}

export function createTraffic(net, { seed = 7, cap = CAP.HIGH } = {}) {
  const rand = rng(seed)
  const active = new Set()            // link ids in range
  const onLink = new Map()            // link id → vehicles on it (unsorted between frames)
  const vehicles = []
  let nextId = 1, t = 0, density = 1, maxVehicles = cap
  const centre = [0, 0]

  const typeFor = (cls) => {
    const r = rand()
    if (cls <= 1 || cls === 6) return r < 0.16 ? 'truck' : 'car'
    if (cls === 2 || cls === 3) return r < 0.05 ? 'bus' : r < 0.08 ? 'truck' : 'car'
    return r < 0.02 ? 'truck' : 'car'
  }
  const pickNext = (l, type) => {
    if (!l.next.length) return null
    let total = 0
    const w = l.next.map((o, i) => {
      const straight = l.turn[i] < 0.5 ? 4 : l.turn[i] < 2.2 ? 1 : 0.05
      const pref = type === 'truck' ? (o.cls <= 1 || o.cls === 6 ? 3 : o.cls === 5 ? 0.1 : 1) : type === 'bus' ? (o.cls === 2 || o.cls === 3 ? 3 : 0.2) : o.cls === 5 ? 0.5 : 1
      total += straight * pref; return total
    })
    const r = rand() * total, i = w.findIndex((x) => x >= r)
    return l.next[Math.max(0, i)]
  }
  const add = (l, s, lane, type) => {
    const T = TYPES[type]
    const v = { id: nextId++, type, link: l, lane, s, v: l.speed * T.vmul * 0.8, acc: 0, next: null, seg: 0, colour: Math.floor(rand() * 1e6), vmul: T.vmul * (0.88 + rand() * 0.22), x: 0, z: 0, yaw: 0 }
    v.next = pickNext(l, type)
    vehicles.push(v)
    if (!onLink.has(l.id)) onLink.set(l.id, [])
    onLink.get(l.id).push(v)
    return v
  }
  const removeAt = (i) => {
    const v = vehicles[i], arr = onLink.get(v.link.id)
    if (arr) { const j = arr.indexOf(v); if (j >= 0) arr.splice(j, 1) }
    vehicles[i] = vehicles[vehicles.length - 1]; vehicles.pop()
  }
  const inRange = (l, r) => l.bbox[2] > centre[0] - r && l.bbox[0] < centre[0] + r && l.bbox[3] > centre[1] - r && l.bbox[1] < centre[1] + r &&
    Math.hypot(Math.max(l.bbox[0] - centre[0], 0, centre[0] - l.bbox[2]), Math.max(l.bbox[1] - centre[1], 0, centre[1] - l.bbox[3])) < r
  // full density near the camera's focus, thinning to a third at the edge of the range (the far streets are tiny)
  const falloff = (l) => {
    const d = Math.hypot((l.bbox[0] + l.bbox[2]) / 2 - centre[0], (l.bbox[1] + l.bbox[3]) / 2 - centre[1])
    return d < NEAR_M ? 1 : Math.max(0.33, 1 - (0.67 * (d - NEAR_M)) / (RANGE_M - NEAR_M))
  }
  const target = (l) => (l.len / 1000) * l.lanes * DENSITY[l.cls] * density * falloff(l)

  // fill a link coming into range: vehicles spaced along each lane (it's out at the edge of the range, or the scene is new)
  function populate(l) {
    const want = target(l)
    let n = Math.floor(want) + (rand() < want - Math.floor(want) ? 1 : 0)
    for (let k = 0; k < n && vehicles.length < maxVehicles; k++) {
      const lane = Math.floor(rand() * l.lanes), s = 8 + rand() * Math.max(0, l.stopAt - 12)
      const others = onLink.get(l.id) ?? []
      if (others.some((o) => o.lane === lane && Math.abs(o.s - s) < 22)) continue
      add(l, s, lane, typeFor(l.cls))
    }
  }

  // which links carry traffic: the camera moved, or the scene started
  function refresh(cx, cz, hour) {
    centre[0] = cx; centre[1] = cz
    density = hourFactor(hour)
    const now = new Set()
    for (const l of net.links) if (inRange(l, RANGE_M)) now.add(l.id)
    for (const id of now) if (!active.has(id)) populate(net.links[id])
    for (let i = vehicles.length - 1; i >= 0; i--) if (!now.has(vehicles[i].link.id)) removeAt(i)
    active.clear(); for (const id of now) active.add(id)
  }

  // keep the count near its target: new vehicles enter at the start of a link far from the camera
  function topUp() {
    let want = 0
    for (const id of active) want += target(net.links[id])
    want = Math.min(maxVehicles, want)
    const ids = [...active]
    for (let tries = 0; tries < 6 && vehicles.length < want && ids.length; tries++) {
      const l = net.links[ids[Math.floor(rand() * ids.length)]]
      const [x0, z0] = [l.xs[0], l.zs[0]]
      if (Math.hypot(x0 - centre[0], z0 - centre[1]) < RANGE_M * 0.55) continue
      const lane = Math.floor(rand() * l.lanes)
      if ((onLink.get(l.id) ?? []).some((o) => o.lane === lane && o.s - TYPES[o.type].length < 24)) continue
      add(l, 0, lane, typeFor(l.cls))
    }
  }

  const leaderOn = (arr, lane, s) => { // the nearest vehicle ahead in this lane
    let best = null
    for (const o of arr) if (o.lane === lane && o.s > s && (!best || o.s < best.s)) best = o
    return best
  }
  const lastOn = (arr, lane) => { let best = null; for (const o of arr) if (o.lane === lane && (!best || o.s < best.s)) best = o; return best }

  function step(dt) {
    dt = Math.min(dt, 0.1)
    t += dt
    for (const v of vehicles) {
      const l = v.link, T = TYPES[v.type], arr = onLink.get(l.id)
      let gap = 1e4, vLead = 0
      const lead = leaderOn(arr, v.lane, v.s)
      if (lead) { gap = lead.s - TYPES[lead.type].length - v.s; vLead = lead.v }
      else if (v.next) {
        const nl = v.next, lane = Math.min(v.lane, nl.lanes - 1), back = lastOn(onLink.get(nl.id) ?? [], lane)
        if (back) { gap = l.len - v.s + back.s - TYPES[back.type].length; vLead = back.v }
      }
      // the light: hold at the stop line on red, and on amber when there's room to stop
      if (l.signal >= 0) {
        const d = l.stopAt - v.s
        if (d > -0.5) {
          const st = signalState(net.signals[l.signal], l.phase, t)
          if (st === 'red' || (st === 'amber' && d > (v.v * v.v) / (2 * T.decel) - 1)) { if (d < gap) { gap = Math.max(0.01, d); vLead = 0 } }
        }
      }
      let v0 = l.speed * v.vmul
      if (v.next) { // ease off for a turn
        const i = l.next.indexOf(v.next), turn = i >= 0 ? l.turn[i] : 0
        if (turn > 0.6) { const d = Math.max(0, l.len - v.s); v0 = Math.min(v0, Math.sqrt(TURN_V * TURN_V + 2 * 1.5 * d)) }
      }
      const sStar = S0 + Math.max(0, v.v * HEADWAY_S + (v.v * (v.v - vLead)) / (2 * Math.sqrt(T.accel * T.decel)))
      const g = Math.max(gap, 0.01)
      v.acc = Math.max(-9, T.accel * (1 - Math.pow(v.v / Math.max(v0, 0.1), 4) - (sStar / g) * (sStar / g)))
    }
    for (let i = vehicles.length - 1; i >= 0; i--) {
      const v = vehicles[i]
      v.v = Math.max(0, v.v + v.acc * dt)
      v.s += v.v * dt
      while (v.s >= v.link.len) {
        const nl = v.next
        if (!nl || !active.has(nl.id)) { removeAt(i); break }
        // into a lane with room behind its last vehicle (merging turns wait their turn at the end of the link)
        const over = v.s - v.link.len, there = onLink.get(nl.id) ?? []
        const room = (lane) => there.every((o) => o.lane !== lane || o.s - TYPES[o.type].length > over + 1.5)
        const keep = Math.min(nl.lanes - 1, v.lane), other = Math.floor(rand() * nl.lanes)
        const lane = rand() < 0.15 && room(other) ? other : room(keep) ? keep : [...Array(nl.lanes).keys()].find(room)
        if (lane === undefined) { v.s = v.link.len - 0.01; v.v = 0; break }
        const arr = onLink.get(v.link.id); arr.splice(arr.indexOf(v), 1)
        v.s = over; v.link = nl; v.seg = 0; v.lane = lane
        v.next = pickNext(nl, v.type)
        if (!onLink.has(nl.id)) onLink.set(nl.id, [])
        onLink.get(nl.id).push(v)
      }
    }
    for (const v of vehicles) {
      const p = pointOnLink(v.link, Math.min(v.s, v.link.len) - TYPES[v.type].length / 2, v.link.offsets[v.lane], v.seg)
      v.seg = p.k; v.x = p.x; v.z = p.z; v.yaw = Math.atan2(-p.dz, p.dx)
    }
    topUp()
  }

  return {
    vehicles, refresh, step, active,
    get time() { return t }, set time(x) { t = x },
    setCap: (c) => { maxVehicles = c },
    signalAt: (l) => (l.signal >= 0 ? signalState(net.signals[l.signal], l.phase, t) : null),
  }
}
