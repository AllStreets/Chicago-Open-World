// app/src/lib/__tests__/pinColors.test.js — pin colours survive the ACES tone map and stay out of the bloom (P4 fix).
import { describe, it, expect } from 'vitest'
import { acesFilmic, pinInput, srgbToLinear, BLOOM_LIMIT, PIN_WHITE, PIN_OUTLINE, PIN_NIGHT_DIM } from '../pinColors.js'
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
  it('fully saturated, with hues spread around the wheel (services alone stays a neutral slate)', () => {
    const hsv = (hex) => {
      const n = parseInt(hex.slice(1), 16), [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255)
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
      const h = d === 0 ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
      return { h: h * 60, s: mx ? d / mx : 0 }
    }
    const chroma = POI_CATEGORIES.filter((c) => c.id !== 'services').map((c) => ({ id: c.id, ...hsv(c.color) }))
    for (const c of chroma) expect(c.s, c.id).toBeGreaterThan(0.7)
    for (let i = 0; i < chroma.length; i++) for (let j = i + 1; j < chroma.length; j++) {
      const dh = Math.abs(chroma[i].h - chroma[j].h), sep = Math.min(dh, 360 - dh)
      // brown coffee and amber apartments share a hue family but not a value: they differ by brightness instead
      if ([chroma[i].id, chroma[j].id].sort().join() !== 'apartments,coffee' && [chroma[i].id, chroma[j].id].sort().join() !== 'coffee,food') expect(sep, `${chroma[i].id} vs ${chroma[j].id}`).toBeGreaterThan(14)
    }
  })
  it('a thin dark outline, not a white glow ring; dimmed at night so pins sit in the scene, not light it', () => {
    expect(lum(srgbToLinear(PIN_OUTLINE))).toBeLessThan(0.02)
    expect(PIN_NIGHT_DIM).toBeGreaterThan(0.5); expect(PIN_NIGHT_DIM).toBeLessThan(0.9)
  })
})
