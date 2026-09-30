// app/src/lib/__tests__/atmosphere.test.js — user fixes: "the day is too gray" → a clear DAY, a SUNNY summer day and
// a SNOW Christmas view (falling snow, snow on the roofs, a frozen lake).
import { describe, it, expect } from 'vitest'
import { atmosphereFor, PRESETS } from '../atmosphere.js'
import { sunForPreset } from '../sun.js'

describe('atmosphere presets', () => {
  it('lists the seven views in pill order', () => {
    expect(PRESETS).toEqual(['LIVE', 'DAWN', 'DAY', 'DUSK', 'NIGHT', 'SUNNY', 'SNOW'])
  })
  it('DAY and SUNNY are clear: a brighter, bluer sky than before and haze pushed out', () => {
    for (const p of ['DAY', 'SUNNY']) {
      const a = atmosphereFor(p)
      // blue, not white: the sky's output is tinted toward blue (the physical sky alone blows out white under ACES)
      expect(a.skyTint[2]).toBeGreaterThan(a.skyTint[0] * 1.3); expect(a.turbidity).toBeLessThan(3.2); expect(a.fogScale).toBeGreaterThan(1)
      expect(a.snow).toBe(0); expect(a.ice).toBe(0)
    }
  })
  it('SNOW is overcast with falling snow, snowy roofs and a frozen lake', () => {
    const a = atmosphereFor('SNOW')
    expect(a.snow).toBe(1); expect(a.ice).toBe(1); expect(a.overcast).toBeGreaterThan(0.5); expect(a.fogScale).toBeLessThan(1)
  })
  it('other presets keep the old look', () => {
    expect(atmosphereFor('NIGHT')).toMatchObject({ skyGain: 0.42, turbidity: 3.2, snow: 0, ice: 0, overcast: 0, skyTint: [1, 1, 1], sunScale: 1 })
  })
})
describe('sun for the new presets', () => {
  const now = new Date('2026-09-29T15:00:00-05:00')
  it('SUNNY is a midsummer early afternoon: the sun high in the south', () => {
    const s = sunForPreset('SUNNY', now)
    expect((s.altitude * 180) / Math.PI).toBeGreaterThan(60); expect(s.night).toBe(0)
  })
  it('SNOW is Christmas Eve at dusk: the sun just down, windows coming on', () => {
    const s = sunForPreset('SNOW', now)
    expect(s.date.getUTCMonth()).toBe(11); expect(s.date.getUTCDate()).toBe(24)
    const alt = (s.altitude * 180) / Math.PI
    expect(alt).toBeLessThan(2); expect(alt).toBeGreaterThan(-6)
    expect(s.night).toBeGreaterThan(0.4)
  })
})
