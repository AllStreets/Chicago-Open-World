import { describe, it, expect } from 'vitest'
import { makePath, pointAt } from '../path.js'

describe('track paths', () => {
  const p = makePath([[0, 0, 0], [100, 0, 0], [100, 10, 100]])
  it('arc length in plan', () => { expect(p.length).toBe(200); expect(p.cum).toEqual([0, 100, 200]) })
  it('interpolates position and direction; clamps', () => {
    const a = pointAt(p, 150)
    expect(a.p).toEqual([100, 5, 50]); expect(a.dir[2]).toBeGreaterThan(0.99)
    expect(pointAt(p, -5).p).toEqual([0, 0, 0]); expect(pointAt(p, 999).p).toEqual([100, 10, 100])
    expect(pointAt(p, 100).p).toEqual([100, 0, 0])
  })
})
