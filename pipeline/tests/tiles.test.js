import { describe, it, expect } from 'vitest'
import { TILE_SIZE, tileKeyFor, tileBounds, groupByTile } from '../lib/tiles.js'

describe('tiles', () => {
  it('keys by floor division, including negatives', () => {
    expect(tileKeyFor([0, 0])).toBe('0_0')
    expect(tileKeyFor([499.9, 0])).toBe('0_0')
    expect(tileKeyFor([500, 0])).toBe('1_0')
    expect(tileKeyFor([-0.1, -0.1])).toBe('-1_-1')
  })
  it('bounds partition space with no gaps', () => {
    expect(tileBounds('-1_2')).toEqual({ minX: -500, maxX: 0, minZ: 1000, maxZ: 1500 })
    expect(tileBounds('0_0').minX).toBe(tileBounds('-1_0').maxX)
    expect(TILE_SIZE).toBe(500)
  })
  it('groups buildings by centroid', () => {
    const g = groupByTile([{ centroid: [10, 10] }, { centroid: [20, 20] }, { centroid: [-10, 10] }])
    expect(g.get('0_0')).toHaveLength(2)
    expect(g.get('-1_0')).toHaveLength(1)
  })
})
