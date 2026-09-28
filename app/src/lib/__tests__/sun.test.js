import { describe, it, expect } from 'vitest'
import { sunForPreset } from '../sun.js'

const june = new Date('2026-06-21T17:00:00Z') // noon CDT
describe('sunForPreset', () => {
  it('DAY sun is high and in the southern sky (+Z)', () => {
    const s = sunForPreset('DAY', june)
    expect(s.altitude).toBeGreaterThan(0.8)
    expect(s.direction[2]).toBeGreaterThan(0)
    expect(s.night).toBe(0)
  })
  it('DUSK sun sits low in the west (-X)', () => {
    const s = sunForPreset('DUSK', june)
    expect(s.altitude).toBeLessThan(0.1)
    expect(s.direction[0]).toBeLessThan(0)
  })
  it('NIGHT is below the horizon with night=1', () => {
    const s = sunForPreset('NIGHT', june)
    expect(s.altitude).toBeLessThan(0)
    expect(s.night).toBe(1)
  })
  it('DAWN rises in the east (+X)', () => {
    expect(sunForPreset('DAWN', june).direction[0]).toBeGreaterThan(0)
  })
  it('LIVE uses the given time; direction is unit length', () => {
    const s = sunForPreset('LIVE', june)
    expect(s.date).toEqual(june)
    expect(Math.hypot(...s.direction)).toBeCloseTo(1)
  })
})
