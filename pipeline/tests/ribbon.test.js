import { describe, it, expect } from 'vitest'
import { bufferPolyline } from '../lib/ribbon.js'

describe('bufferPolyline', () => {
  it('straight segment → 2 up-facing tris of the right width', () => {
    const m = bufferPolyline([[0, 0], [10, 0]], 2, 0.05)
    expect(m.positions.length / 9).toBe(2)
    const zs = m.positions.filter((_, i) => i % 3 === 2)
    expect(Math.min(...zs)).toBeCloseTo(-2); expect(Math.max(...zs)).toBeCloseTo(2)
    const ys = m.positions.filter((_, i) => i % 3 === 1)
    expect(new Set(ys)).toEqual(new Set([0.05]))
    for (let i = 0; i < m.normals.length; i += 3) expect(m.normals[i + 1]).toBe(1)
  })
  it('front faces point up (winding)', () => {
    const m = bufferPolyline([[0, 0], [10, 0], [10, -10]], 1)
    for (let i = 0; i < m.positions.length; i += 9) {
      const p = m.positions.slice(i, i + 9)
      const cy = (p[5] - p[2]) * (p[6] - p[0]) - (p[3] - p[0]) * (p[8] - p[2])
      expect(cy).toBeGreaterThan(0)
    }
  })
  it('caps extreme miters and ignores duplicate points', () => {
    const m = bufferPolyline([[0, 0], [10, 0], [10, 0], [0, 0.01]], 1)
    const xs = m.positions.filter((_, i) => i % 3 === 0)
    expect(Math.max(...xs)).toBeLessThan(13)
    expect(m.positions.every(Number.isFinite)).toBe(true)
  })
})
