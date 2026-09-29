// app/src/lib/__tests__/clearance.test.js
import { describe, it, expect, afterEach, vi } from 'vitest'
import { CLEARANCE_M, decodeHeightfield, setHeightfield, roofHeightAt, clearanceAt, loadHeightfield } from '../clearance.js'

const grid = { minX: 0, minZ: 0, cell: 8, width: 4, height: 3, scale: 0.1 }

describe('camera clearance (G1/G2)', () => {
  afterEach(() => setHeightfield(grid, null))
  it('decodes decimetres from R (high byte) and G (low byte)', () => {
    const rgba = new Uint8ClampedArray(4 * 12)
    rgba[5 * 4] = 0x14; rgba[5 * 4 + 1] = 0x99; rgba[5 * 4 + 3] = 255
    const dm = decodeHeightfield(rgba, grid)
    expect(dm[5]).toBe(5273)
    expect(dm[0]).toBe(0)
  })
  it('no data → 25 m everywhere', () => {
    expect(CLEARANCE_M).toBe(25)
    expect(clearanceAt(12, 12)).toBe(25)
  })
  it('roof + 25 m over a tower; 25 m over open ground and outside the grid', () => {
    const dm = new Uint16Array(12); dm[5] = 3000 // cell i=1, j=1 (x 8–16, z 8–16): 300 m
    setHeightfield(grid, dm)
    expect(roofHeightAt(12, 12)).toBeCloseTo(300, 6)
    expect(clearanceAt(12, 12)).toBeCloseTo(325, 6)
    expect(clearanceAt(31, 23)).toBe(25)
    expect(clearanceAt(-500, -500)).toBe(25)
  })
  it('samples conservatively: a point up to one cell from a tall cell sees it', () => {
    const dm = new Uint16Array(12); dm[5] = 3000
    setHeightfield(grid, dm)
    expect(clearanceAt(19.5, 12)).toBeCloseTo(325, 6)
    expect(clearanceAt(28.5, 12)).toBe(25)
  })
  it('a failed load falls back to 25 m everywhere (review focus)', async () => {
    const dm = new Uint16Array(12); dm[5] = 3000
    setHeightfield(grid, dm)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(loadHeightfield('/world/missing.png', grid)).resolves.toBeUndefined()
    warn.mockRestore()
    expect(clearanceAt(12, 12)).toBe(25)
  })
})
