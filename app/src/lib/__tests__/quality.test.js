import { describe, it, expect } from 'vitest'
import { QUALITY, nextQuality, cycleQuality } from '../quality.js'

describe('quality', () => {
  it('has three presets with increasing cost', () => {
    expect(Object.keys(QUALITY)).toEqual(['LOW', 'HIGH', 'ULTRA'])
    expect(QUALITY.LOW.shadows).toBe(false)
    expect(QUALITY.ULTRA.shadowMap).toBeGreaterThan(QUALITY.HIGH.shadowMap)
  })
  it('downgrades one step when slow, never upgrades', () => {
    expect(nextQuality(40, 'ULTRA')).toBe('HIGH')
    expect(nextQuality(40, 'HIGH')).toBe('LOW')
    expect(nextQuality(40, 'LOW')).toBe('LOW')
    expect(nextQuality(10, 'LOW')).toBe('LOW')
  })
  it('cycles LOW → HIGH → ULTRA → LOW', () => {
    expect(cycleQuality('LOW')).toBe('HIGH'); expect(cycleQuality('ULTRA')).toBe('LOW')
  })
})
