// pipeline/tests/heightfield.test.js
import { describe, it, expect } from 'vitest'
import { bakeHeightfield, meshPoints, boundsUnion, HEIGHTFIELD } from '../lib/heightfield.js'

describe('camera heightfield (G1)', () => {
  const bounds = { minX: -40, minZ: -40, maxX: 120, maxZ: 120 }
  const { grid, heights } = bakeHeightfield({
    pieces: [{ outer: [[0, 0], [40, 0], [40, 40], [0, 40]], top: 100 }, { outer: [[81, 81], [83, 81], [83, 83], [81, 83]], top: 60 }],
    points: [[100, 250, 100]],
  }, bounds)
  const at = (x, z) => heights[Math.floor((z - grid.minZ) / grid.cell) * grid.width + Math.floor((x - grid.minX) / grid.cell)]
  it('max roof height per 8 m cell', () => {
    expect(HEIGHTFIELD).toEqual({ cell: 8, scale: 0.1 })
    expect(grid.width).toBe(20)
    expect(at(20, 20)).toBe(100)
    expect(at(-36, -36)).toBe(0)
  })
  it('thin footprints and crown vertices still mark their cells', () => {
    expect(at(82, 82)).toBe(60)
    expect(at(100, 100)).toBe(250)
  })
  it('meshPoints reads crown and venue vertices; boundsUnion spans tiles and blocks', () => {
    expect(meshPoints([{ extraMeshes: [{ positions: [1, 2, 3] }], venueMeshes: [{ mesh: { positions: [4, 5, 6] } }] }])).toEqual([[1, 2, 3], [4, 5, 6]])
    expect(boundsUnion([{ minX: 0, minZ: 0, maxX: 500, maxZ: 500 }, { minX: -2000, minZ: 0, maxX: 0, maxZ: 2000 }])).toEqual({ minX: -2000, minZ: 0, maxX: 500, maxZ: 2000 })
  })
})
