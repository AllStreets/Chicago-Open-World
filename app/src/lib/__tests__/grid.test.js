import { describe, it, expect } from 'vitest'
import { worldToGrid, crossStreets, M_PER_NUMBER } from '../grid.js'

describe('grid', () => {
  it('800 address numbers is one mile', () => {
    expect(M_PER_NUMBER * 800).toBeCloseTo(1609.344)
  })
  it('origin is State & Madison', () => {
    expect(worldToGrid(0, 0)).toEqual({ ns: 0, ew: 0 })
    expect(crossStreets(0, 0)).toBe('STATE & MADISON')
  })
  it('Michigan & Ohio', () => {
    expect(crossStreets(100 * M_PER_NUMBER, -600 * M_PER_NUMBER)).toBe('MICHIGAN & OHIO')
  })
  it('Wacker & Adams (Willis Tower) resolves west side', () => {
    expect(crossStreets(-360 * M_PER_NUMBER, 200 * M_PER_NUMBER)).toBe('WACKER & ADAMS')
  })
  it('snaps to the nearest named street', () => {
    expect(crossStreets(-130 * M_PER_NUMBER, -810 * M_PER_NUMBER)).toBe('LASALLE & CHICAGO')
  })
  it('over the lake reads LAKE MICHIGAN; never throws far away', () => {
    expect(crossStreets(900 * M_PER_NUMBER, 0)).toBe('LAKE MICHIGAN')
    expect(() => crossStreets(-50000, 50000)).not.toThrow()
    expect(crossStreets(-50000, 50000)).toMatch(/&/)
  })
})
