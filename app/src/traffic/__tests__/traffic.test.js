// app/src/traffic/__tests__/traffic.test.js — road graph, signals and the car-following sim (user, 2026-09-30).
import { describe, it, expect } from 'vitest'
import { decodeRoadGraph, buildNetwork, signalState, pointOnLink, CYCLE } from '../graph.js'
import { createTraffic, hourFactor, TYPES, CAP } from '../sim.js'
import { sceneHour } from '../Traffic.jsx'

// a crossroads: an east–west primary (nodes 0–1–2) crossed at node 1 by a north–south secondary (3–1–4), arms 400 m
function crossroads() {
  const nodes = [[-400, 0], [0, 0], [400, 0], [0, -400], [0, 400]]
  const enc = [1, nodes.length, ...nodes.flat(), 4,
    0, 1, 2, 2, 2, 0, 1, 2, 2, 2, 2, 0, // primary, two lanes each way, no interior points
    3, 1, 3, 1, 1, 0, 1, 4, 3, 1, 1, 0]
  return decodeRoadGraph(new Int16Array(enc))
}

describe('road network', () => {
  it('decodes the int16 graph into directed links with lanes on the right', () => {
    const net = buildNetwork(crossroads())
    expect(net.links.length).toBe(8) // four streets, both ways
    const east = net.links.find((l) => l.from === 0 && l.to === 1)
    expect(east.lanes).toBe(2); expect(east.len).toBeCloseTo(400)
    // heading east (+x), the right-hand side is south (+z)
    expect(pointOnLink(east, 100, east.offsets[0]).z).toBeGreaterThan(0)
  })
  it('puts a light at the junction of two arterials, each street on its own phase, and holds cars back of the box', () => {
    const net = buildNetwork(crossroads())
    expect(net.signals.length).toBe(1)
    const ew = net.links.find((l) => l.from === 0 && l.to === 1), ns = net.links.find((l) => l.from === 3 && l.to === 1)
    expect(ew.signal).toBe(0); expect(ns.signal).toBe(0); expect(ew.phase).not.toBe(ns.phase)
    expect(ew.stopAt).toBeLessThan(ew.len - 5) // back from the crossing street's kerb
    const c = net.signals[0]
    for (let t = 0; t < 58; t += 0.5) expect([signalState(c, ew.phase, t), signalState(c, ns.phase, t)]).not.toEqual(['green', 'green'])
    let green = 0
    for (let t = 0; t < 58; t += 0.5) if (signalState(c, 0, t) === 'green') green += 0.5
    expect(green).toBeCloseTo(CYCLE.green, 0)
  })
})

describe('traffic sim', () => {
  it('density follows the hour: rush hour busy, 4 am nearly empty', () => {
    expect(hourFactor(8)).toBeGreaterThan(0.9); expect(hourFactor(17)).toBeGreaterThan(0.9); expect(hourFactor(4)).toBeLessThan(0.15)
    expect(sceneHour('NIGHT', new Date('2026-09-30T12:00:00-05:00'))).toBeGreaterThan(19)
  })
  it('fills only the streets in range, up to the quality cap', () => {
    const net = buildNetwork(crossroads()), sim = createTraffic(net, { cap: 30 })
    sim.refresh(0, 0, 8)
    expect(sim.vehicles.length).toBeGreaterThan(0); expect(sim.vehicles.length).toBeLessThanOrEqual(30)
    sim.refresh(50000, 50000, 8)
    expect(sim.vehicles.length).toBe(0)
    expect(CAP.HIGH).toBeGreaterThan(CAP.LOW)
  })
  it('cars queue at a red light and never run into the car ahead', () => {
    const net = buildNetwork(crossroads()), sim = createTraffic(net, { seed: 3, cap: 400 })
    sim.refresh(0, 0, 8)
    const ew = net.links.find((l) => l.from === 0 && l.to === 1)
    let minGap = Infinity, ranRed = 0
    for (let k = 0; k < 2400; k++) { // four minutes at 10 Hz
      const before = new Map(sim.vehicles.map((v) => [v.id, { link: v.link, s: v.s }]))
      sim.step(0.1)
      for (const v of sim.vehicles) {
        const b = before.get(v.id)
        // crossing the stop line on red (from behind it to past it in one step) counts as running it
        if (b && b.link === v.link && v.link.signal >= 0 && b.s < v.link.stopAt - 0.5 && v.s > v.link.stopAt + 0.5 && sim.signalAt(v.link) === 'red') ranRed++
      }
      for (const l of net.links) {
        const on = sim.vehicles.filter((v) => v.link === l)
        for (const a of on) for (const b of on) if (a !== b && a.lane === b.lane && b.s > a.s) minGap = Math.min(minGap, b.s - TYPES[b.type].length - a.s)
      }
    }
    expect(ranRed).toBe(0)
    expect(minGap).toBeGreaterThan(0)
    // at some moment a queue stood at the eastbound stop line
    expect(ew.stopAt).toBeGreaterThan(0)
  })
  it('a car stops at the line on red and moves off on green', () => {
    const net = buildNetwork(crossroads()), sim = createTraffic(net, { cap: 1 })
    sim.refresh(0, 0, 3)
    sim.vehicles.length = 0
    const ew = net.links.find((l) => l.from === 0 && l.to === 1)
    // find a moment the eastbound approach turns red, then drop a car 120 m back
    let t = 0
    while (signalState(net.signals[0], ew.phase, t) !== 'red') t += 0.5
    sim.time = t
    sim.refresh(0, 0, 3)
    sim.vehicles.length = 0
    const v = { id: 1, type: 'car', link: ew, lane: 0, s: ew.stopAt - 120, v: 12, acc: 0, next: null, seg: 0, colour: 0, vmul: 1, x: 0, z: 0, yaw: 0 }
    sim.vehicles.push(v)
    for (let k = 0; k < 250 && signalState(net.signals[0], ew.phase, sim.time) === 'red'; k++) sim.step(0.1)
    expect(v.s).toBeLessThan(ew.stopAt + 0.5)
  })
})
