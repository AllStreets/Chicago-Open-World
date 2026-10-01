// D1-6 / D1-7 / D1-8: the app reads the river's level from the manifest; without `levels` it is today's flat world.
import { describe, it, expect } from 'vitest'
import { readLevels, inCorridor, planeYFor, viewTarget, FLAT } from '../levels.js'
import { WATER_PLANE_Y } from '../../world/materials/waterSurface.js'
import { undergroundBelow } from '../../transit/Tunnels.jsx'
import { toPath, walkRides } from '../../ride/rideCatalog.js'
import { corridorMask, inCorridor as pipelineInCorridor } from '../../../../pipeline/lib/riverLevel.js'

const manifest = { levels: { river: { y: -6.3, riverwalk: -5.3, file: 'river-levels.json' } } }
const river = { outer: [[0, 0], [1000, 0], [1000, 60], [0, 60]], holes: [] }
const corridor = corridorMask([river], { minX: -2000, minZ: -2000, maxX: 2000, maxZ: 2000 })

describe('readLevels (D1-8)', () => {
  it('a manifest without levels is the flat world', () => {
    expect(readLevels({ tiles: [] })).toBe(FLAT)
    expect(readLevels(null)).toBe(FLAT)
    expect(readLevels({ levels: { river: { y: 'deep' } } })).toBe(FLAT)
  })
  it('reads the river and Riverwalk heights from the manifest, never a constant', () => {
    expect(readLevels(manifest).river).toEqual({ y: -6.3, riverwalk: -5.3, file: 'river-levels.json' })
    expect(readLevels({ levels: { river: { y: -5 } } }).river.y).toBe(-5)
  })
})

describe('the mirror plane follows the view (D1-6)', () => {
  const lv = readLevels(manifest)
  it('looking at the river: the river’s plane; the city or the lake: the lake’s', () => {
    expect(planeYFor([500, 0, 30], lv, corridor)).toBeCloseTo(-6.29, 6)
    expect(planeYFor([500, 0, 110], lv, corridor)).toBeCloseTo(-6.29, 6) // its banks
    expect(planeYFor([500, 0, 800], lv, corridor)).toBe(WATER_PLANE_Y)
  })
  it('the flat world (no levels) or no corridor yet: always the old plane', () => {
    expect(planeYFor([500, 0, 30], FLAT, corridor)).toBe(WATER_PLANE_Y)
    expect(planeYFor([500, 0, 30], lv, null)).toBe(WATER_PLANE_Y)
  })
  it('the app’s corridor lookup agrees with the pipeline’s, cell for cell', () => {
    for (let x = -100; x <= 1100; x += 37) for (let z = -200; z <= 260; z += 23) expect(inCorridor(corridor, x, z)).toBe(pipelineInCorridor(corridor, x, z))
  })
  it('viewTarget: where the view meets the ground, or under the camera when it looks up or level', () => {
    expect(viewTarget([0, 100, 0], [0, -0.7071, 0.7071])).toEqual([0, 0, expect.closeTo(100, 4)])
    expect(viewTarget([5, -3.6, 7], [1, 0, 0])).toEqual([5, 0, 7]) // a walker on the Riverwalk
  })
})

describe('underground (D1): the Riverwalk is open air', () => {
  it('flat world: anything under the street is a tube (as before)', () => expect(undergroundBelow(FLAT)).toBe(0))
  it('with the river sunk: only below the tubes’ mouth, so a Riverwalk eye at −3.6 m keeps the city AO', () => {
    expect(undergroundBelow(readLevels(manifest))).toBeLessThan(-3.6 - 0.5)
  })
})

describe('walks with a height per point (D1-7)', () => {
  it('[x, z, y] keeps its y; [x, z] takes the street height', () => {
    const p = toPath([[0, 0, -5.3], [10, 0, -5.3], [20, 0]], 0.1)
    expect(p.pts.map((q) => q[1])).toEqual([-5.3, -5.3, 0.1])
    expect(p.length).toBe(20)
  })
  it('the Riverwalk ride in rides.json runs at river level all the way', async () => {
    const rides = (await import('../../data/rides.json')).default
    const [w] = walkRides({ walks: rides.walks.filter((x) => x.id === 'riverwalk') })
    expect(w.path.pts.length).toBeGreaterThan(20)
    for (const q of w.path.pts) expect(q[1]).toBeCloseTo(manifest.levels.river.riverwalk, 6)
  })
})
