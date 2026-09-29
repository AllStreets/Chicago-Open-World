import { describe, it, expect } from 'vitest'
import { stepSun } from '../sunTween.js'

const len = (v) => Math.hypot(...v)
describe('stepSun', () => {
  it('stays unit length and moves toward the target', () => {
    const a = [1, 0, 0], b = [0, 1, 0]
    const s = stepSun(a, b, 0.1)
    expect(len(s)).toBeCloseTo(1)
    expect(s[1]).toBeGreaterThan(0)
  })
  it('converges within 2.5 s (small steps are continuous)', () => {
    let s = [1, 0, 0]
    let maxJump = 0
    for (let i = 0; i < 150; i++) {
      const n = stepSun(s, [0, 1, 0], 1 / 60)
      maxJump = Math.max(maxJump, Math.hypot(n[0] - s[0], n[1] - s[1], n[2] - s[2]))
      s = n
    }
    expect(s[1]).toBeGreaterThan(0.95)
    expect(maxJump).toBeLessThan(0.05)
  })
  it('handles opposite vectors without NaN', () => {
    const s = stepSun([1, 0, 0], [-1, 0, 0], 0.1)
    expect(s.every(Number.isFinite)).toBe(true)
  })
})
