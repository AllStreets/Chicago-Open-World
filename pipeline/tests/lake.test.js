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

import { landMinusWater } from '../lib/lake.js'

describe('land is never drawn under mapped water (no far z-fight)', () => {
  it('cuts harbours and the river out of the land mesh', () => {
    const land = [{ outer: [[0, 0], [1000, 0], [1000, 1000], [0, 1000]], holes: [] }]
    const harbour = [{ outer: [[200, 200], [600, 200], [600, 600], [200, 600]], holes: [] }]
    const out = landMinusWater({ land, water: harbour })
    const inLand = (p) => out.some((q) => pointInRing(p, q.outer) && !q.holes.some((h) => pointInRing(p, h)))
    expect(inLand([400, 400])).toBe(false)
    expect(inLand([100, 100])).toBe(true)
  })
})

import { joinLines, lakeSide } from '../lib/lake.js'

describe('real shoreline (the city limits reach into the lake)', () => {
  it('joins shoreline ways end to end, bridging tiny gaps', () => {
    const a = [[0, -100], [10, 0]], b = [[10.002, 0], [0, 100]], c = [[50, 50], [60, 60]]
    const chains = joinLines([b, a, c], 0.01)
    expect(chains[0]).toHaveLength(3)
    expect([chains[0][0], chains[0][2]]).toEqual([[0, -100], [0, 100]])
    expect(chains).toHaveLength(2)
  })
  it('the lake side of a north–south shore is everything east of it', () => {
    const side = lakeSide([[[0, -1000], [100, 0], [0, 1000]]], 5000)
    const inSide = (p) => side.some((q) => pointInRing(p, q.outer))
    expect(inSide([500, 0])).toBe(true)
    expect(inSide([50, 0])).toBe(false)
    expect(inSide([-200, 500])).toBe(false)
  })
})
