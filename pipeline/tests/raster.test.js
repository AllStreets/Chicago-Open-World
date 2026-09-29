// pipeline/tests/raster.test.js
import { describe, it, expect } from 'vitest'
import { makeGrid, cellOf, fillPolygon, distanceField, encodeHeights } from '../lib/raster.js'

describe('raster', () => {
  const g = makeGrid({ minX: 0, minZ: 0, maxX: 80, maxZ: 40 }, 8)
  it('grid dimensions round up; cellOf maps world → index, −1 outside', () => {
    expect(g).toEqual({ minX: 0, minZ: 0, cell: 8, width: 10, height: 5 })
    expect(cellOf(g, 12, 20)).toBe(2 * 10 + 1)
    expect(cellOf(g, -1, 0)).toBe(-1)
    expect(cellOf(g, 80, 0)).toBe(-1)
  })
  it('fills cells whose centres are inside; holes stay empty', () => {
    const hit = new Set()
    fillPolygon(g, [[[0, 0], [40, 0], [40, 40], [0, 40]], [[16, 16], [24, 16], [24, 24], [16, 24]]], (k) => hit.add(k))
    expect(hit.size).toBe(25 - 1) // 5×5 cells, centre cell (20,20) is in the hole
    expect(hit.has(cellOf(g, 20, 20))).toBe(false)
    expect(hit.has(cellOf(g, 44, 4))).toBe(false)
  })
  it('chamfer distance: 1 per straight step, √2 per diagonal step', () => {
    const m = new Uint8Array(9 * 9); m[4 * 9 + 4] = 1
    const d = distanceField(m, 9, 9)
    expect(d[4 * 9 + 4]).toBe(0)
    expect(d[4 * 9 + 7]).toBeCloseTo(3, 6)
    expect(d[5 * 9 + 5]).toBeCloseTo(Math.SQRT2, 6)
  })
  it('heights as decimetres in two bytes: 527.3 m → 0x14 0x99', () => {
    const px = encodeHeights([527.3, 0, 7000], 0.1)
    expect([...px.slice(0, 3)]).toEqual([0x14, 0x99, 0])
    expect([...px.slice(3, 6)]).toEqual([0, 0, 0])
    expect([...px.slice(6, 9)]).toEqual([0xff, 0xff, 0]) // clamped at 6553.5 m
  })
})
