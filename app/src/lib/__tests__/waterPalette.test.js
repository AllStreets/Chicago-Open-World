// app/src/lib/__tests__/waterPalette.test.js
import { describe, it, expect } from 'vitest'
import { waterPalette, isGreenRiverDay } from '../waterPalette.js'
import { paletteFor } from '../skyPalette.js'

const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b

describe('water palette (B3)', () => {
  it('the far lake fades to a horizon that is bluer than the grey haze', () => {
    for (const elev of [3, 10, 25, 60]) {
      const w = waterPalette(elev), fog = paletteFor(elev).fog
      expect(w.horizon.b - w.horizon.r).toBeGreaterThan(fog.b - fog.r)
      expect(w.horizon.equals(fog)).toBe(false)
    }
  })
  it('tracks the time of day: night water and horizon are dark, day is bright', () => {
    const day = waterPalette(25), night = waterPalette(-12)
    expect(lum(night.horizon)).toBeLessThan(lum(day.horizon) * 0.3)
    expect(lum(night.deep)).toBeLessThan(lum(day.deep))
    expect(night.night).toBe(1); expect(day.night).toBe(0)
  })
  it('shallow water near the shore is lighter than deep water by day', () => {
    const w = waterPalette(25)
    expect(lum(w.shallow)).toBeGreaterThan(lum(w.deep))
  })
})

describe('green river (B9)', () => {
  it('March 17 in Chicago, whatever the UTC date', () => {
    expect(isGreenRiverDay(new Date('2027-03-17T12:00:00-05:00'))).toBe(true)
    expect(isGreenRiverDay(new Date('2027-03-18T03:30:00Z'))).toBe(true) // 22:30 CDT on the 17th
    expect(isGreenRiverDay(new Date('2027-03-17T04:30:00Z'))).toBe(false) // 23:30 CDT on the 16th
    expect(isGreenRiverDay(new Date('2027-03-18T12:00:00-05:00'))).toBe(false)
    expect(isGreenRiverDay(new Date('2026-09-28T12:00:00-05:00'))).toBe(false)
  })
})
