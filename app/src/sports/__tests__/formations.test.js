import { describe, it, expect } from 'vitest'
import { formation, ballAt, uniformColors, HALF_INNING_S } from '../formations.js'

const count = (f, side) => f.filter((p) => p.side === side).length
describe('formations', () => {
  it('baseball: nine fielders on defence, a batter and runners on offence, four umpires', () => {
    for (const t of [0, 100, 400, HALF_INNING_S + 5]) {
      const f = formation('baseball', t), def = t < HALF_INNING_S ? 'home' : 'away', off = def === 'home' ? 'away' : 'home'
      expect(count(f, def)).toBe(9)
      expect(count(f, off)).toBeGreaterThanOrEqual(1); expect(count(f, off)).toBeLessThanOrEqual(4)
      expect(count(f, 'official')).toBe(4)
      const p = f.find((x) => x.role === 'P'); expect(p.u).toBeCloseTo(18.44); expect(p.v).toBeCloseTo(0)
    }
  })
  it('football: 11 v 11 inside the field, with officials', () => {
    for (const t of [0, 10, 150, 301]) {
      const f = formation('football', t)
      expect(count(f, 'home')).toBe(11); expect(count(f, 'away')).toBe(11); expect(count(f, 'official')).toBe(5)
      for (const p of f.filter((x) => x.side !== 'official')) { expect(Math.abs(p.u)).toBeLessThanOrEqual(54.864); expect(Math.abs(p.v)).toBeLessThanOrEqual(24.384) }
    }
  })
  it('soccer: 11 v 11 inside the pitch, one referee', () => {
    const f = formation('soccer', 77)
    expect(count(f, 'home')).toBe(11); expect(count(f, 'away')).toBe(11); expect(count(f, 'official')).toBe(1)
    for (const p of f) { expect(Math.abs(p.u)).toBeLessThanOrEqual(52.5); expect(Math.abs(p.v)).toBeLessThanOrEqual(34) }
  })
  it('the ball: a pitch to the plate, fly balls to about 31 m, a 12 m pass apex', () => {
    const mid = ballAt('baseball', 22 * 1 + 0.225)          // a normal pitch, halfway
    expect(mid[0]).toBeGreaterThan(8); expect(mid[0]).toBeLessThan(10); expect(mid[1]).toBeGreaterThan(1.2); expect(mid[1]).toBeLessThan(1.5)
    const fly = ballAt('baseball', 0.45 + 2)                  // cycle 0 is a fly ball; halfway up
    expect(fly[1]).toBeCloseTo(31, 0)
    const pass = ballAt('football', 10.5)                     // halfway through the pass window
    expect(pass[1]).toBeCloseTo(14, 0)
    expect(ballAt('basketball', 3)).toBeNull()
  })
  it('kits: baseball home whites and road greys; Bears navy at home; officials apart', () => {
    expect(uniformColors('baseball', { colors: ['#0E3386', '#CC3433'] })).toEqual({ home: '#F4F4F0', away: '#9A9CA0', official: '#1F2530' })
    expect(uniformColors('football', { colors: ['#0B162A', '#C83803'] }).home).toBe('#0B162A')
    expect(uniformColors('soccer', { colors: ['#FF0000', '#7CCDEF'] }).home).toBe('#FF0000')
  })
})
