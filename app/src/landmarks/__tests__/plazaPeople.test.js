import { describe, it, expect } from 'vitest'
import { plazaPeople, crowdDensity } from '../plazaPeople.js'

const plazas = [
  { key: 'cloudgate', c: [374, -73], r: 38, avoid: [{ c: [374, -73], r: 11 }] },
  { key: 'buckingham', c: [711, 693], r: 62, avoid: [{ c: [711, 693], r: 43.7 }] },
]
describe('plaza people', () => {
  it('nobody stands inside a sculpture or in the fountain pool, nobody outside the plaza', () => {
    for (const p of plazaPeople(plazas, 14)) {
      const pl = plazas.find((x) => x.key === p.plaza)
      expect(Math.hypot(p.x - pl.c[0], p.z - pl.c[1])).toBeLessThanOrEqual(pl.r + 1e-9)
      for (const a of pl.avoid) expect(Math.hypot(p.x - a.c[0], p.z - a.c[1])).toBeGreaterThanOrEqual(a.r)
    }
  })
  it('busy by day, nearly empty at 3 am, identical on every call', () => {
    expect(plazaPeople(plazas, 14).length).toBeGreaterThan(5 * plazaPeople(plazas, 3).length)
    expect(plazaPeople(plazas, 14)).toEqual(plazaPeople(plazas, 14))
    expect(crowdDensity(14)).toBeGreaterThan(crowdDensity(20))
  })
  it('respects the instance cap', () => {
    expect(plazaPeople([{ key: 'big', c: [0, 0], r: 400, avoid: [] }], 14, { cap: 300 }).length).toBe(300)
  })
})
