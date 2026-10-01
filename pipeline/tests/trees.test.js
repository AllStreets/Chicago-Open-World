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
    // (5, 50) is 5 m off the hull, inside the colonnade/concourse margin since the user fix; (-30, 50) is clear
    const r = filterTrees([[10.06, 50], [-30, 50], [550, 40]], { zones: zones.map((z) => z.ring) })
    expect(r.kept).toEqual([[-30, 50]])
    expect(r.removed.venue).toBe(2)
  })
  it('the build gate names the venue and the tile', () => {
    expect(() => assertNoVenueTrees([['0_0', [[50, 50, 1, 0]]]], zones)).toThrow(/soldierfield 50,50 \(tile 0_0\)/)
    expect(() => assertNoVenueTrees([['0_0', [[5, 50, 1, 0]]]], zones)).not.toThrow()
  })
})

import { outsideZones, canopyRadius, VENUE_MARGIN_M } from '../lib/trees.js'

describe('no canopy through a building, a stadium, a plaza or a railway (user fix, project-wide)', () => {
  const b = { bbox: { minX: 0, minZ: 0, maxX: 40, maxZ: 40 }, polygons: [{ outer: sq(0, 0, 40, 40), holes: [sq(10, 10, 30, 30)] }] }
  it('a canopy is ~3.5 m × the tree\'s scale (0.8–1.4), decided on the stored coordinates', () => {
    const r = canopyRadius([100, 100])
    expect(r).toBeGreaterThanOrEqual(3.5 * 0.8); expect(r).toBeLessThanOrEqual(3.5 * 1.4)
    expect(canopyRadius([100.04, 100])).toBe(canopyRadius([100, 100]))
  })
  it('a trunk outside the wall whose canopy reaches it goes; one a full canopy clear stays', () => {
    const r = filterTrees([[42, 20], [-10, 20]], { nearBuildings: () => [b] })
    expect(r.kept).toEqual([[-10, 20]]); expect(r.removed.building).toBe(1)
  })
  it('in a courtyard: the middle stays, a tree against the courtyard wall goes', () => {
    const r = filterTrees([[20, 20], [11, 20]], { nearBuildings: () => [b] })
    expect(r.kept).toEqual([[20, 20]])
  })
  it('a hero whose built form spills past its OSM outline (a podium on the oriented box) keeps trees off that form too', () => {
    const hero = { polygons: [{ outer: [[0, 0], [40, 0], [20, 30]], holes: [] }], treeHull: sq(0, 0, 40, 30) }
    const r = filterTrees([[38, 25], [60, 25]], { nearBuildings: () => [hero] })
    expect(r.kept).toEqual([[60, 25]])
  })
  it('stadium colonnades and concourses: a margin round the venue hull', () => {
    expect(VENUE_MARGIN_M).toBeGreaterThanOrEqual(10)
    const zone = sq(0, 0, 100, 100)
    const r = filterTrees([[-8, 50], [-40, 50]], { zones: [zone] })
    expect(r.kept).toEqual([[-40, 50]]); expect(r.removed.venue).toBe(1)
  })
  it('paved plazas and squares: no trunk on the paving (canopy may overhang — tree pits at the edge are real)', () => {
    const r = filterTrees([[10, 10], [30, 10]], { paved: () => [sq(0, 0, 20, 20)] })
    expect(r.kept).toEqual([[30, 10]]); expect(r.removed.paved).toBe(1)
  })
  it('plazas and railways', () => {
    const r = filterTrees([[0, 3], [50, 50], [200, 2], [200, 40]], { plazas: [{ c: [50, 50], r: 20 }], rails: () => [[[-100, 0], [300, 0]]] })
    expect(r.kept).toEqual([[200, 40]])
    expect(r.removed.plaza).toBe(1); expect(r.removed.rail).toBe(2)
  })
})

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

import { cutWater } from '../lib/trees.js'
describe('Lincoln Park water shows through the park (ponds, lagoons, harbours were hidden under the grass)', () => {
  const park = { outer: sq(0, 0, 200, 200), holes: [], tags: { leisure: 'park' } }
  const pond = { outer: sq(50, 50, 150, 150), holes: [sq(90, 90, 110, 110)], tags: { natural: 'water' } } // with an island
  it('the park ground is cut around each water body; its island stays grass', () => {
    const out = cutWater([park], [pond])
    const area = (r) => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1] }, 0)) / 2
    const total = out.reduce((t, p) => t + area(p.outer) - p.holes.reduce((h, r) => h + area(r), 0), 0)
    expect(total).toBeCloseTo(200 * 200 - 100 * 100 + 20 * 20, 0)
    expect(out.some((p) => area(p.outer) === 400)).toBe(true) // the island
  })
  it('no tree stands in the water (but one on the island may)', () => {
    const r = filterTrees([[60, 60], [100, 100], [10, 10]], { wet: () => [pond] })
    expect(r.kept).toEqual([[100, 100], [10, 10]])
    expect(r.removed.water).toBe(1)
  })
})
