import { describe, it, expect } from 'vitest'
import { signedArea, ensureCCW, ensureCW, simplifyRing, pointInRing, ringBBox, ringCentroid, openRing } from '../lib/geom.js'

// A 10x10 square, CCW on the map: east then north (north = -z)
const sqCCW = [[0, 0], [10, 0], [10, -10], [0, -10]]

describe('geom', () => {
  it('signedArea is +100 for a map-CCW square and -100 reversed', () => {
    expect(signedArea(sqCCW)).toBeCloseTo(100)
    expect(signedArea([...sqCCW].reverse())).toBeCloseTo(-100)
  })
  it('ensureCCW / ensureCW orient rings', () => {
    expect(signedArea(ensureCCW([...sqCCW].reverse()))).toBeGreaterThan(0)
    expect(signedArea(ensureCW(sqCCW))).toBeLessThan(0)
  })
  it('openRing drops a duplicated closing point', () => {
    expect(openRing([[0, 0], [1, 0], [1, 1], [0, 0]])).toHaveLength(3)
    expect(openRing([[0, 0], [1, 0], [1, 1]])).toHaveLength(3)
  })
  it('simplifyRing removes collinear points but keeps corners', () => {
    const noisy = [[0, 0], [5, 0.1], [10, 0], [10, -10], [0, -10]]
    expect(simplifyRing(noisy, 0.3)).toHaveLength(4)
  })
  it('simplifyRing never returns fewer than 3 points', () => {
    expect(simplifyRing([[0, 0], [0.1, 0], [0.2, 0.05]], 5).length).toBeGreaterThanOrEqual(3)
  })
  it('pointInRing', () => {
    expect(pointInRing([5, -5], sqCCW)).toBe(true)
    expect(pointInRing([15, -5], sqCCW)).toBe(false)
  })
  it('bbox and centroid', () => {
    expect(ringBBox(sqCCW)).toEqual({ minX: 0, minZ: -10, maxX: 10, maxZ: 0 })
    const [cx, cz] = ringCentroid(sqCCW)
    expect(cx).toBeCloseTo(5); expect(cz).toBeCloseTo(-5)
  })
})
