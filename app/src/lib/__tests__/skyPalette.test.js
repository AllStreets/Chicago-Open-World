import { describe, it, expect } from 'vitest'
import { paletteFor, phaseFor } from '../skyPalette.js'

describe('paletteFor', () => {
  it('is fully night at -18° and fully day at 60°', () => {
    expect(paletteFor(-18).night).toBe(1); expect(paletteFor(-18).stars).toBe(1)
    expect(paletteFor(60).night).toBe(0); expect(paletteFor(60).stars).toBe(0)
  })
  it('never returns NaN or negative values across -90..90', () => {
    for (let e = -90; e <= 90; e += 0.5) {
      const p = paletteFor(e)
      for (const k of ['hemiIntensity', 'sunIntensity', 'night', 'stars', 'exposure']) {
        expect(Number.isFinite(p[k])).toBe(true); expect(p[k]).toBeGreaterThanOrEqual(0)
      }
      expect(Number.isFinite(p.fog.r + p.fog.g + p.fog.b)).toBe(true)
    }
  })
  it('sun light is warm near the horizon and white at noon', () => {
    const low = paletteFor(3).sunColor, high = paletteFor(60).sunColor
    expect(low.r - low.b).toBeGreaterThan(high.r - high.b)
  })
  it('night gets darker monotonically below the horizon', () => {
    expect(paletteFor(-10).hemiIntensity).toBeLessThanOrEqual(paletteFor(-2).hemiIntensity)
  })
})

describe('phaseFor', () => {
  it('names the phase from elevation and east/west', () => {
    expect(phaseFor(-15, 0)).toBe('NIGHT')
    expect(phaseFor(4, 1)).toBe('DAWN')   // sun in the east (+x)
    expect(phaseFor(4, -1)).toBe('DUSK')  // sun in the west
    expect(phaseFor(40, 1)).toBe('DAY')
  })
})
