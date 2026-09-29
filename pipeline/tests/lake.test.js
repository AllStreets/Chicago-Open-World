// pipeline/tests/lake.test.js
import { describe, it, expect } from 'vitest'
import { lakePolygons, LAKE } from '../lib/lake.js'
import { pointInRing } from '../lib/geom.js'

describe('lake polygon (B4)', () => {
  const land = [{ outer: [[-5000, -5000], [0, -5000], [0, 5000], [-5000, 5000]], holes: [] }]
  const harbour = [{ outer: [[0, 0], [300, 0], [300, 300], [0, 300]], holes: [] }]
  const lake = lakePolygons({ center: [0, 0], land, water: harbour })
  const inLake = (p) => lake.some((q) => pointInRing(p, q.outer) && !q.holes.some((h) => pointInRing(p, h)))
  it('is 120 km east–west and 160 km north–south around the shoreline', () => {
    expect(LAKE).toEqual({ width: 120000, depth: 160000 })
    expect(inLake([59000, 79000])).toBe(true)
    expect(inLake([61000, 0])).toBe(false)
  })
  it('never overlaps land or the mapped harbour (no z-fighting)', () => {
    expect(inLake([-100, 0])).toBe(false)
    expect(inLake([150, 150])).toBe(false)
    expect(inLake([1000, 150])).toBe(true)
  })
})
