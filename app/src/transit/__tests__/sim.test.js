import { describe, it, expect } from 'vitest'
import { createSim, departuresForDay, hash01 } from '../sim.js'
import { consistFor, carPoses, COUPLER_GAP_M } from '../consist.js'
import { chicagoClock } from '../clock.js'
import { makePath } from '../path.js'
import { tauAtS } from '../profile.js'
import { P, DIMS, svc, TRANSIT } from './fixtures.js'

const sim = createSim(TRANSIT)
const T = (iso) => Date.parse(iso)
const red = (ms) => sim.trainsAt(ms).filter((t) => t.line === 'red')
const RED_CONSIST_M = 8 * (14.63 + COUPLER_GAP_M)

describe('consists', () => {
  it('CTA married pairs; Metra push-pull with the locomotive on the suburban end', () => {
    const c = consistFor(TRANSIT.lines[0].service, 'peak', false)
    expect(c.map((x) => x.flip)).toEqual([false, true, false, true, false, true, false, true])
    expect(c.map((x) => x.lead)).toEqual([1, 0, 0, 0, 0, 0, 0, -1])
    const m = TRANSIT.lines[2].service
    expect(consistFor(m, 'midday', true).map((x) => x.model)).toEqual(['metraCoach', 'metraCoach', 'metraCoach', 'metraCoach', 'metraCoach', 'metraLoco'])
    expect(consistFor(m, 'midday', true)[0].lead).toBe(1)
    expect(consistFor(m, 'peak', false)[0]).toEqual({ model: 'metraLoco', flip: false, lead: 1 })
    expect(consistFor(m, 'peak', false).at(-1)).toEqual({ model: 'metraCoach', flip: true, lead: -1 })
  })
  it('cars articulate round a curve: both bogies on the track, each car turned a little more', () => {
    const arc = makePath(Array.from({ length: 181 }, (_, i) => { const a = (i / 180) * Math.PI; return [100 * Math.sin(a), 7, 100 - 100 * Math.cos(a)] }))
    const cars = carPoses(arc, 150, consistFor(svc({}, { cars: { peak: 4, offpeak: 4 } }), 'peak', false), DIMS)
    for (const c of cars) expect(Math.hypot(c.pos[0], c.pos[2] - 100)).toBeCloseTo(Math.sqrt(100 ** 2 - (10.06 / 2) ** 2), 1)
    for (let i = 0; i < 3; i++) {
      const d = cars[i].yaw - cars[i + 1].yaw, n = ((((d + Math.PI / 2) % Math.PI) + Math.PI) % Math.PI) - Math.PI / 2
      expect(Math.abs(n)).toBeCloseTo((14.63 + COUPLER_GAP_M) / 100, 2)
    }
    expect(carPoses(arc, 20, consistFor(svc({}), 'peak', false), DIMS).filter(Boolean)).toHaveLength(1) // entering the map
  })
})

describe('simulator', () => {
  it('is deterministic from the clock, with unique train ids', () => {
    const ms = T('2026-09-30T08:15:00-05:00')
    const a = sim.trainsAt(ms), b = sim.trainsAt(ms)
    expect(a).toEqual(b)
    expect(new Set(a.map((t) => t.id)).size).toBe(a.length)
    expect(red(ms).length).toBeGreaterThanOrEqual(3); expect(red(ms).length).toBeLessThanOrEqual(6)
    expect(red(ms)[0]).toMatchObject({ line: 'red', destination: 'Loop' })
    expect(red(ms)[0].rn).toMatch(/^8\d\d$/)
  })
  it('consecutive trains never overlap', () => {
    const sv = sim.services[0], deps = departuresForDay(sv, chicagoClock(T('2026-09-30T12:00:00-05:00')).midnightMs, false, P)
    for (let i = 1; i < deps.length; i++) expect(deps[i] - deps[i - 1]).toBeGreaterThanOrEqual(5 * 60000)
    for (let ms = T('2026-09-30T05:00:00-05:00'); ms < T('2026-09-30T11:00:00-05:00'); ms += 97000) {
      const s = red(ms).map((t) => t.sHead).sort((a, b) => a - b)
      for (let i = 1; i < s.length; i++) expect(s[i] - s[i - 1]).toBeGreaterThanOrEqual(RED_CONSIST_M)
    }
  })
  it('trains dwell at stations', () => {
    const sv = sim.services[0], day = chicagoClock(T('2026-09-30T12:00:00-05:00'))
    const dep = sim.departures(sv, day)[40], arrive = dep + tauAtS(sv.profile, 7500) * 1000, id = `svc-r1:2026-09-30:40`
    const at = (ms) => sim.trainsAt(ms).find((t) => t.id === id)
    expect(at(arrive + 5000).sHead).toBeCloseTo(7500, 0); expect(at(arrive + 20000).sHead).toBeCloseTo(7500, 0)
    expect(at(arrive + 40000).sHead).toBeGreaterThan(7501)
    expect(at(arrive - 60000).nextStop).toMatchObject({ station: 'st-a', name: 'A' })
  })
  it("midnight: yesterday's trains keep running; no bunching", () => {
    expect(red(T('2026-10-01T00:05:00-05:00')).some((t) => t.id.includes(':2026-09-30:'))).toBe(true)
    const sv = sim.services[0]
    const y = sim.departures(sv, chicagoClock(T('2026-09-30T12:00:00-05:00'))), t = sim.departures(sv, chicagoClock(T('2026-10-01T12:00:00-05:00')))
    expect(t[0] - y.at(-1)).toBeGreaterThanOrEqual(10 * 60000)
  })
  it('DST day: unique ids either side of the repeated hour', () => {
    for (const iso of ['2026-11-01T01:30:00-05:00', '2026-11-01T01:30:00-06:00']) {
      const a = sim.trainsAt(T(iso))
      expect(new Set(a.map((x) => x.id)).size).toBe(a.length); expect(a.some((x) => x.line === 'red')).toBe(true)
    }
  })
  it('a line runs only when it has service (Purple Express: rush hours only)', () => {
    expect(sim.trainsAt(T('2026-09-30T12:00:00-05:00')).some((t) => t.line === 'purple')).toBe(false)
    expect(sim.trainsAt(T('2026-09-30T08:15:00-05:00')).some((t) => t.line === 'purple')).toBe(true)
    expect(hash01('svc-r1')).toBeGreaterThanOrEqual(0); expect(hash01('svc-r1')).toBeLessThan(1)
  })
})
