import { describe, it, expect } from 'vitest'
import { classifyFacade, FACADE_FAMILIES, FACADE_COLORS } from '../lib/classify.js'
const id = (n) => FACADE_FAMILIES.indexOf(n)

describe('classifyFacade', () => {
  it('has 8 families with colors', () => {
    expect(FACADE_FAMILIES).toHaveLength(8)
    expect(FACADE_COLORS).toHaveLength(8)
  })
  it('modern tall towers are curtain glass', () => {
    expect(classifyFacade({ height: 300, year: 1974, area: 4000 })).toBe(id('curtain-glass'))
  })
  it('prewar tall is loop limestone; 1925-1940 tall is art deco', () => {
    expect(classifyFacade({ height: 80, year: 1905, area: 2000 })).toBe(id('loop-limestone'))
    expect(classifyFacade({ height: 120, year: 1930, area: 2000 })).toBe(id('art-deco'))
  })
  it('mid-rise 1880-1930 is river-north loft; small residential is three-flat', () => {
    expect(classifyFacade({ height: 25, year: 1900, area: 900 })).toBe(id('river-north-loft'))
    expect(classifyFacade({ height: 11, year: 1910, area: 200 })).toBe(id('three-flat-brick'))
  })
  it('big low boxes are industrial; unknown year mid-rise is precast', () => {
    expect(classifyFacade({ height: 12, year: 0, area: 6000 })).toBe(id('industrial'))
    expect(classifyFacade({ height: 45, year: 0, area: 1500 })).toBe(id('precast-concrete'))
  })
  it('uses the OSM building type for neighbourhood buildings', () => {
    expect(classifyFacade({ height: 9, year: 1905, area: 180, type: 'house' })).toBe(id('three-flat-brick'))
    expect(classifyFacade({ height: 12, year: 0, area: 900, type: 'warehouse' })).toBe(id('industrial'))
    expect(classifyFacade({ height: 15, year: 1920, area: 700, type: 'apartments' })).toBe(id('prewar-brick'))
    expect(classifyFacade({ height: 16, year: 1890, area: 600, type: 'church' })).toBe(id('loop-limestone'))
  })
})
