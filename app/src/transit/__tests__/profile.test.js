import { describe, it, expect } from 'vitest'
import { makePath } from '../path.js'
import { buildProfile, sAt, tauAtS, curveLimit, A_LAT } from '../profile.js'

const straight = makePath(Array.from({ length: 201 }, (_, i) => [i * 5, 0, 0])) // 1 km
const spec = { vmax: 20, accel: 1, brake: 1, dwellS: 30 }
const speedAt = (p, t) => (sAt(p, t + 0.25) - sAt(p, t - 0.25)) / 0.5

describe('run profile', () => {
  const p = buildProfile(straight, [500], spec)
  it('brakes into the stop, dwells 30 s there, accelerates away', () => {
    const arrive = tauAtS(p, 500)
    expect(sAt(p, arrive + 1)).toBeCloseTo(500, 6); expect(sAt(p, arrive + 29)).toBeCloseTo(500, 6)
    expect(sAt(p, arrive + 35)).toBeGreaterThan(500)
    expect(speedAt(p, arrive - 2)).toBeLessThan(speedAt(p, arrive - 12)) // braking
  })
  it('enters the world at line speed and never exceeds it', () => {
    expect(speedAt(p, 0.5)).toBeGreaterThan(18)
    let max = 0
    for (let t = 0; t < p.duration; t += 0.5) max = Math.max(max, speedAt(p, t))
    expect(max).toBeLessThanOrEqual(20.01)
    expect(sAt(p, p.duration + 100)).toBeCloseTo(1000, 6); expect(sAt(p, -5)).toBe(0)
  })
  it('slows for tight curves: √(0.9 m/s² × R)', () => {
    const arc = Array.from({ length: 46 }, (_, i) => { const a = (i / 45) * (Math.PI / 2); return [300 + 30 * Math.sin(a), 0, 30 - 30 * Math.cos(a)] })
    const path = makePath([[0, 0, 0], ...arc, [330, 0, 330]])
    expect(curveLimit(path, 300 + 23.5)).toBeCloseTo(Math.sqrt(A_LAT * 30), 0)
    const q = buildProfile(path, [], spec), mid = tauAtS(q, 300 + 23.5)
    expect(speedAt(q, mid)).toBeLessThan(Math.sqrt(A_LAT * 30) + 0.5)
    expect(curveLimit(straight, 500)).toBe(Infinity)
  })
})

describe('zone speed limits', () => {
  it('a slow zone caps speed inside it and nowhere else', async () => {
    const { LOOP_ZONE, zoneLimit } = await import('../profile.js')
    expect(zoneLimit([0, 7, 0])).toBeCloseTo(LOOP_ZONE.kmh / 3.6, 6)   // on the Loop
    expect(zoneLimit([0, 7, -3000])).toBe(Infinity)                     // out on the North Side
    const slow = (p) => (p[0] > 300 && p[0] < 700 ? 8 : Infinity)
    const q = buildProfile(straight, [], { ...spec, limitAt: slow })
    expect(speedAt(q, tauAtS(q, 500))).toBeLessThanOrEqual(8.01)
    expect(speedAt(q, tauAtS(q, 900))).toBeGreaterThan(15)
  })
})
