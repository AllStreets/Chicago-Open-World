import { describe, it, expect } from 'vitest'
import { glowHalfWidth, worldPerPixel, glowLevel, GLOW_DEFAULTS, GLOW_GLSL } from '../glowWidth.js'

const T = (deg) => Math.tan((deg * Math.PI) / 360)

describe('glow width', () => {
  it('is the physical strip up close', () => {
    expect(glowHalfWidth(20, T(42), 1000)).toBe(GLOW_DEFAULTS.baseHalfM)
  })
  it('never drops under 2 px at any distance, field of view or viewport', () => {
    for (const d of [1, 50, 150, 1000, 6000, 100000]) for (const fov of [30, 42, 90]) for (const vh of [300, 1000, 2160]) {
      const px = (2 * glowHalfWidth(d, T(fov), vh)) / worldPerPixel(d, T(fov), vh)
      expect(px).toBeGreaterThanOrEqual(GLOW_DEFAULTS.minPx - 1e-9)
    }
  })
  it('grows linearly with distance once compensated (1 km → 6 km)', () => {
    expect(glowHalfWidth(6000, T(42), 1000) / glowHalfWidth(1000, T(42), 1000)).toBeCloseTo(6, 5)
  })
  it('stays finite with the camera on the ribbon or a zero-height viewport', () => {
    expect(glowHalfWidth(0, T(42), 1000)).toBe(GLOW_DEFAULTS.baseHalfM)
    expect(Number.isFinite(glowHalfWidth(500, T(42), 0))).toBe(true)
    expect(Number.isFinite(glowHalfWidth(-5, T(42), 1000))).toBe(true)
  })
  it('glow level: 15 % by day, full at night, clamped; GLSL mirrors the constants', () => {
    expect(glowLevel(0)).toBeCloseTo(0.15); expect(glowLevel(1)).toBe(1); expect(glowLevel(3)).toBe(1)
    expect(glowLevel(-1)).toBeCloseTo(0.15); expect(glowLevel(0.5)).toBeCloseTo(0.575)
    expect(GLOW_GLSL).toContain('float owGlowHalfWidth(')
    expect(GLOW_GLSL).toContain('0.150 + 0.850 * clamp(night, 0.0, 1.0)')
  })
})
