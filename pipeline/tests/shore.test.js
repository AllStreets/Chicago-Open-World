// pipeline/tests/shore.test.js
import { describe, it, expect } from 'vitest'
import { bakeShore, SHORE } from '../lib/shore.js'

describe('shore distance texture (B6)', () => {
  const land = [{ outer: [[0, 0], [20, 0], [20, 40], [0, 40]], holes: [] }]
  const { grid, pixels } = bakeShore({ bounds: { minX: 0, minZ: 0, maxX: 400, maxZ: 40 }, land, water: [] })
  it('4 m cells over the band', () => {
    expect(SHORE).toEqual({ cell: 4, maxDist: 200 })
    expect(grid).toEqual({ minX: 0, minZ: 0, cell: 4, width: 100, height: 10 })
  })
  it('0 on land, grows with distance, saturates at 200 m', () => {
    expect(pixels[5 * 100 + 2]).toBe(0)
    expect(pixels[5 * 100 + 15]).toBe(Math.round((44 / 200) * 255)) // cell centre x=62, nearest land centre x=18
    expect(pixels[5 * 100 + 99]).toBe(255)
  })
  it('mapped water carves the land (harbours and lagoons get their own shore)', () => {
    const r = bakeShore({ bounds: { minX: 0, minZ: 0, maxX: 400, maxZ: 40 }, land, water: [{ outer: [[8, 0], [16, 0], [16, 40], [8, 40]], holes: [] }] })
    expect(r.pixels[5 * 100 + 2]).toBeGreaterThan(0)
  })
})
