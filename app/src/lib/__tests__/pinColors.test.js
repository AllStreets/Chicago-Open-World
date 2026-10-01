// app/src/lib/__tests__/pinColors.test.js — pin colours survive the ACES tone map and stay out of the bloom (P4 fix).
import { describe, it, expect } from 'vitest'
import { acesFilmic, pinInput, srgbToLinear, BLOOM_LIMIT, PIN_WHITE } from '../pinColors.js'
import { POI_CATEGORIES } from '../../data/poiCategories.js'

const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b
describe('pin colours', () => {
  it('pre-compensates so the tone-mapped colour lands on the chosen sRGB hue', () => {
    for (const c of POI_CATEGORIES) {
      const want = srgbToLinear(c.color), got = acesFilmic(pinInput(c.color))
      for (let k = 0; k < 3; k++) expect(Math.abs(got[k] - want[k]), `${c.id}[${k}]`).toBeLessThan(0.02)
    }
  })
  it('keeps every fill and the white outline below the bloom threshold (no glowing halos)', () => {
    for (const c of POI_CATEGORIES) expect(lum(pinInput(c.color)), c.id).toBeLessThan(BLOOM_LIMIT)
    expect(lum(pinInput(PIN_WHITE))).toBeLessThan(BLOOM_LIMIT)
  })
  it('twelve deep, clearly distinct category colours', () => {
    expect(POI_CATEGORIES.map((c) => c.id)).toEqual(['food', 'drinks', 'coffee', 'nightlife', 'venues', 'culture', 'shops', 'outdoors', 'hotels', 'services', 'apartments', 'offices'])
    const rgb = POI_CATEGORIES.map((c) => srgbToLinear(c.color).map((v) => v ** (1 / 2.2)))
    for (let i = 0; i < rgb.length; i++) for (let j = i + 1; j < rgb.length; j++) {
      const d = Math.hypot(...rgb[i].map((v, k) => v - rgb[j][k]))
      expect(d, `${POI_CATEGORIES[i].id} vs ${POI_CATEGORIES[j].id}`).toBeGreaterThan(0.12)
    }
  })
})
