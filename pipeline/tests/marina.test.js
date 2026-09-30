// pipeline/tests/marina.test.js
import { describe, it, expect } from 'vitest'
import { MARINA, petalRing, marinaTower } from '../lib/marina.js'

const radius = (c) => ([x, z]) => Math.hypot(x - c[0], z - c[1])
const ys = (m) => m.positions.filter((_, i) => i % 3 === 1)
const tris = (m) => m.positions.length / 9

describe('Marina City', () => {
  it('petal ring has exactly 16 lobes reaching rPetal, with valleys at rCore', () => {
    const c = [10, -5], ring = petalRing(c, 14, 17.5, 16)
    const r = ring.map(radius(c))
    let peaks = 0
    for (let i = 0; i < r.length; i++) if (r[i] > r[(i - 1 + r.length) % r.length] && r[i] >= r[(i + 1) % r.length]) peaks++
    expect(peaks).toBe(16)
    expect(Math.max(...r)).toBeCloseTo(17.5, 1); expect(Math.min(...r)).toBeCloseTo(14, 1)
  })
  it('parking ramp rises monotonically, one turn per parking level', () => {
    const t = marinaTower([0, 0], { heightM: 179, rCore: 9, rPetal: 17.5, floorH: 179 / 65, parkingLevels: 19, aptFrom: 21, aptTo: 60, petals: 16 })
    const cl = t.rampCentreline
    for (let i = 1; i < cl.length; i++) expect(cl[i][1]).toBeGreaterThanOrEqual(cl[i - 1][1])
    let turns = 0
    for (let i = 1; i < cl.length; i++) {
      const a0 = Math.atan2(cl[i - 1][2], cl[i - 1][0]), a1 = Math.atan2(cl[i][2], cl[i][0])
      let d = a1 - a0; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI
      turns += d / (2 * Math.PI)
    }
    expect(Math.round(Math.abs(turns))).toBe(19)
  })
  it('40 petal slabs (floors 21–60), top at heightM, within 50 k tris', () => {
    const floorH = 179 / 65
    const t = marinaTower([0, 0], { heightM: 179, rCore: 9, rPetal: 17.5, floorH, parkingLevels: 19, aptFrom: 21, aptTo: 60, petals: 16 })
    const levels = new Set(ys(t.slabs).map((y) => Math.round(y / floorH)))
    expect([...levels].filter((l) => l >= 21 && l <= 61).length).toBeGreaterThanOrEqual(40)
    expect(Math.max(...ys(t.core))).toBeCloseTo(179, 0)
    expect(tris(t.core) + tris(t.slabs) + tris(t.ramp)).toBeLessThanOrEqual(50000)
  })
})
