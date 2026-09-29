import { describe, it, expect } from 'vitest'
import { horizonBoxes, GRID } from '../lib/horizon.js'

const inner = { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 }
const allLand = () => true

describe('horizon fill', () => {
  const boxes = horizonBoxes({ inner, band: 1200, isLand: allLand, seed: 1 })
  const center = (b) => [b.outer.reduce((s, p) => s + p[0], 0) / 4, b.outer.reduce((s, p) => s + p[1], 0) / 4]
  it('fills only the band outside the detailed world', () => {
    expect(boxes.length).toBeGreaterThan(500)
    for (const b of boxes) for (const [x, z] of b.outer) {
      expect(x >= inner.minX && x <= inner.maxX && z >= inner.minZ && z <= inner.maxZ).toBe(false)
      expect(Math.abs(x)).toBeLessThanOrEqual(2200.5); expect(Math.abs(z)).toBeLessThanOrEqual(2200.5)
    }
  })
  it('leaves Chicago-grid streets open between blocks', () => {
    // no box straddles a street centreline
    for (const b of boxes) {
      const xs = b.outer.map((p) => p[0]), zs = b.outer.map((p) => p[1])
      const kx0 = Math.floor(Math.min(...xs) / GRID.x), kx1 = Math.floor(Math.max(...xs) / GRID.x)
      const kz0 = Math.floor(Math.min(...zs) / GRID.z), kz1 = Math.floor(Math.max(...zs) / GRID.z)
      expect(kx0).toBe(kx1); expect(kz0).toBe(kz1)
    }
  })
  it('is mostly low-rise brick with the odd mid-rise', () => {
    const tops = boxes.map((b) => b.top)
    expect(tops.filter((t) => t <= 14).length / tops.length).toBeGreaterThan(0.75)
    expect(Math.max(...tops)).toBeLessThanOrEqual(40)
  })
  it('skips water and the lakefront', () => {
    const lakeEast = horizonBoxes({ inner, band: 1200, isLand: ([x]) => x < 1500, seed: 1 })
    expect(lakeEast.every((b) => center(b)[0] < 1500 - 400)).toBe(true)
  })
  it('is deterministic', () => {
    expect(horizonBoxes({ inner, band: 1200, isLand: allLand, seed: 1 })).toEqual(boxes)
  })
})
