// pipeline/tests/trees.test.js
import { describe, it, expect } from 'vitest'
import { insideFootprint, venueZones, filterTrees, assertNoVenueTrees, roundTree, isVenue } from '../lib/trees.js'

const sq = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]

describe('trees in courtyards (H6)', () => {
  const b = { bbox: { minX: 0, minZ: 0, maxX: 40, maxZ: 40 }, polygons: [{ outer: sq(0, 0, 40, 40), holes: [sq(10, 10, 30, 30)] }] }
  it('a tree in an open courtyard stays; a tree on the roof goes', () => {
    expect(insideFootprint([20, 20], b)).toBe(false)
    expect(insideFootprint([5, 5], b)).toBe(true)
    const r = filterTrees([[20, 20], [5, 5]], { nearBuildings: () => [b] })
    expect(r.kept).toEqual([[20, 20]])
    expect(r.removed.building).toBe(1)
  })
})

describe('venues stay tree-free (D1)', () => {
  const field = { hero: 'soldierfield', polygons: [{ outer: sq(10.07, 0, 110, 100), holes: [] }] }
  const arena = { hero: 'unitedcenter', polygons: [{ outer: sq(500, 0, 600, 80), holes: [] }] }
  const tower = { hero: 'willis', polygons: [{ outer: sq(900, 0, 960, 60), holes: [] }] }
  const specs = new Map([[field, { key: 'soldierfield', venue: { kind: 'football' } }], [arena, { key: 'unitedcenter', facade: 'arena' }], [tower, { key: 'willis' }]])
  const zones = venueZones([field, arena, tower], (b) => specs.get(b))
  it('covers open-air venues and arenas, not towers', () => {
    expect(zones.map((z) => z.key)).toEqual(['soldierfield', 'unitedcenter'])
    expect(isVenue({ key: 'wrigleyfield', venue: {} })).toBe(true)
    expect(isVenue({ key: 'willis' })).toBe(false)
  })
  it('filters on the coordinates it writes: a tree 1 cm outside a hull that rounds inside is removed', () => {
    expect(roundTree([10.06, 50])).toEqual([10.1, 50])
    const r = filterTrees([[10.06, 50], [5, 50], [550, 40]], { zones: zones.map((z) => z.ring) })
    expect(r.kept).toEqual([[5, 50]])
    expect(r.removed.venue).toBe(2)
  })
  it('the build gate names the venue and the tile', () => {
    expect(() => assertNoVenueTrees([['0_0', [[50, 50, 1, 0]]]], zones)).toThrow(/soldierfield 50,50 \(tile 0_0\)/)
    expect(() => assertNoVenueTrees([['0_0', [[5, 50, 1, 0]]]], zones)).not.toThrow()
  })
})

import { outsideZones } from '../lib/trees.js'

describe('mapped pitches inside venues (the venue paints its own field)', () => {
  it('drops a pitch polygon whose centre is inside a venue zone, keeps park pitches', () => {
    const zone = [[0, 0], [100, 0], [100, 100], [0, 100]]
    const inVenue = { bbox: { minX: 20, minZ: 20, maxX: 60, maxZ: 80 } }, park = { bbox: { minX: 300, minZ: 0, maxX: 360, maxZ: 90 } }
    expect(outsideZones([inVenue, park], [zone])).toEqual([park])
  })
})

describe('cutZones (V5: parks never under a venue field)', () => {
  it('subtracts venue hulls from ground polygons, keeping the rest of the park and its tags', async () => {
    const { cutZones } = await import('../lib/trees.js')
    const park = { outer: [[0, 0], [100, 0], [100, -100], [0, -100]], holes: [], tags: { leisure: 'park' } }
    const zone = [[40, -40], [60, -40], [60, -60], [40, -60]]
    const out = cutZones([park], [zone])
    expect(out).toHaveLength(1)
    expect(out[0].tags).toEqual({ leisure: 'park' })
    expect(out[0].holes).toHaveLength(1)
    const area = (r) => Math.abs(r.reduce((s, [x, z], i) => { const [x2, z2] = r[(i + 1) % r.length]; return s + x * z2 - x2 * z }, 0) / 2)
    expect(area(out[0].outer) - area(out[0].holes[0])).toBeCloseTo(10000 - 400, 3)
    expect(out[0].bbox).toMatchObject({ minX: 0, maxX: 100 })
    const far = { ...park, outer: [[500, 0], [600, 0], [600, -100], [500, -100]] }
    expect(cutZones([far], [zone])[0]).toBe(far) // untouched polygons pass through as-is
  })
})
