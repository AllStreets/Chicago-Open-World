import { describe, it, expect } from 'vitest'
import { hudScale, hudCompact } from '../hudScale.js'
describe('hudScale', () => {
  it('full size on big screens, never above 1', () => {
    expect(hudScale(1920, 1080)).toBe(1); expect(hudScale(1280, 800)).toBe(1)
  })
  it('shrinks uniformly with the tighter dimension', () => {
    expect(hudScale(1024, 800)).toBeCloseTo(0.8)
    expect(hudScale(1600, 600)).toBeCloseTo(0.75)
  })
  it('never below 0.55', () => {
    expect(hudScale(390, 844)).toBe(0.55)
  })
  it('compact layout when the scaled layout is narrow', () => {
    expect(hudCompact(1600, 1000)).toBe(false)
    expect(hudCompact(600, 900)).toBe(true)
  })
})
