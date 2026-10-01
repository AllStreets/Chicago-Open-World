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

describe('wider world streets', () => {
  it('Western & Addison, Halsted & 35th, Ashland & Cermak', () => {
    expect(crossStreets(-2400 * M_PER_NUMBER, -3600 * M_PER_NUMBER)).toBe('WESTERN & ADDISON')
    expect(crossStreets(-800 * M_PER_NUMBER, 3500 * M_PER_NUMBER)).toBe('HALSTED & 35TH')
    expect(crossStreets(-1600 * M_PER_NUMBER, 2200 * M_PER_NUMBER)).toBe('ASHLAND & CERMAK')
  })
  it('water check wins when provided', () => {
    expect(crossStreets(0, 0, () => true)).toBe('LAKE MICHIGAN')
    expect(crossStreets(0, 0, () => false)).toBe('STATE & MADISON')
  })
})

import { parseGridAddress } from '../grid.js'
describe('grid addresses (P4 Task 8)', () => {
  it('parses grid addresses into world metres', () => {
    const r = parseGridAddress('233 S Wacker')
    expect(r.label).toBe('233 S WACKER'); expect(r.z).toBeCloseTo(233 * M_PER_NUMBER, 0); expect(r.x).toBeCloseTo(-360 * M_PER_NUMBER, 0)
    expect(parseGridAddress('800 N Michigan').z).toBeCloseTo(-800 * M_PER_NUMBER, 0)
    expect(parseGridAddress('333 N Green St').x).toBeCloseTo(-832 * M_PER_NUMBER, 0) // Green is 832 W
    expect(parseGridAddress('100 W Madison')).toMatchObject({ x: expect.closeTo(-100 * M_PER_NUMBER, 0), z: expect.closeTo(0, 0) })
    expect(parseGridAddress('pizza')).toBeNull()
  })
})
