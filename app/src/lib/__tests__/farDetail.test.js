import { describe, it, expect } from 'vitest'
import { FAR_M, NEAR_M, TRUNK_M, boxDistance, isFar, sphereDistance, anyLeafLifted } from '../farDetail.js'
import { PERF_POSES } from '../perfPoses.js'
import { BOOKMARKS } from '../bookmarks.js'

const tile = { minX: 0, maxX: 500, minZ: 0, maxZ: 500 }
const centre = (b) => [(b.position[0] + b.target[0]) / 2, (b.position[2] + b.target[2]) / 2]

describe('farDetail', () => {
  it('measures to the nearest point of the tile box, buildings up to their top', () => {
    expect(boxDistance([250, 100, 250], tile, 200)).toBe(0) // inside the box
    expect(boxDistance([250, 300, 250], tile, 200)).toBe(100) // straight above the tallest roof
    expect(boxDistance([800, 0, 900], tile, 0)).toBe(500) // 300 east, 400 south
    expect(boxDistance([250, -10, 250], tile, 50)).toBe(10) // under the ground
  })
  it('stands a LOD0 tile in by its LOD1 only beyond FAR_M, back inside NEAR_M (hysteresis)', () => {
    expect(NEAR_M).toBeLessThan(FAR_M)
    const at = (d) => [500 + d, 0, 250]
    expect(isFar(at(FAR_M - 1), tile, 0)).toBe(false)
    expect(isFar(at(FAR_M + 1), tile, 0)).toBe(true)
    expect(isFar(at((FAR_M + NEAR_M) / 2), tile, 0, true)).toBe(true) // between: keeps what it was
    expect(isFar(at((FAR_M + NEAR_M) / 2), tile, 0, false)).toBe(false)
    expect(isFar(at(NEAR_M - 1), tile, 0, true)).toBe(false)
  })
  it('the wide perf poses look at their LOD0 tiles from beyond FAR_M; the close hero views do not', () => {
    for (const k of ['wideStreeterville', 'wideLoop']) {
      const p = PERF_POSES[k], t = { minX: p.target[0] - 250, maxX: p.target[0] + 250, minZ: p.target[2] - 250, maxZ: p.target[2] + 250 }
      expect(isFar(p.position, t, 300)).toBe(true)
    }
    for (const k of ['streeterville', 'loop', 'river', 'hancock', 'willis', 'navypier', 'westloop', 'wrigleyville']) {
      const b = BOOKMARKS[k], [x, z] = centre(b), t = { minX: x - 250, maxX: x + 250, minZ: z - 250, maxZ: z + 250 }
      expect(isFar(b.position, t, 300)).toBe(false)
    }
  })
  it('a sphere is as far as its surface; inside is 0', () => {
    const s = { center: { x: 0, y: 0, z: 0 }, radius: 100 }
    expect(sphereDistance([0, 0, 0], s)).toBe(0)
    expect(sphereDistance([300, 0, 400], s)).toBe(400)
    expect(TRUNK_M).toBeGreaterThan(1000)
  })
  it('knows when a bascule leaf is off its seat', () => {
    expect(anyLeafLifted({})).toBe(false)
    expect(anyLeafLifted(undefined)).toBe(false)
    expect(anyLeafLifted({ lake: 0, wells: 0 })).toBe(false)
    expect(anyLeafLifted({ lake: 0, wells: 12.5 })).toBe(true)
  })
})
