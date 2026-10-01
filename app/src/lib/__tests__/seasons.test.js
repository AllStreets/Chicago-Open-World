import { describe, it, expect } from 'vitest'
import { treePalette, chicagoMonth } from '../seasons.js'

describe('treePalette', () => {
  it('winter is bare, summer is green, October is orange', () => {
    expect(treePalette(1).bare).toBe(true)
    expect(treePalette(7).bare).toBe(false)
    expect(treePalette(7).canopy.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true)
    const oct = treePalette(10).canopy
    expect(oct.some((c) => parseInt(c.slice(1, 3), 16) > 0xb0)).toBe(true) // warm reds/oranges
  })
  it('covers every month', () => {
    for (let m = 1; m <= 12; m++) expect(treePalette(m).canopy.length).toBeGreaterThan(0)
  })
  it('chicagoMonth reads the America/Chicago calendar month', () => {
    expect(chicagoMonth(new Date('2026-10-01T03:00:00Z'))).toBe(9) // still Sep 30 in Chicago
  })
})

import { treePaletteFor } from '../seasons.js'
describe('trees follow the season views (user, 2026-09-30)', () => {
  it('SNOW: snow-laden canopies (not autumn leaves); SUNNY: summer green; other views: the real month', () => {
    const snow = treePaletteFor('SNOW', 10)
    expect(snow.bare).toBe(false)
    for (const hex of snow.canopy) expect(parseInt(hex.slice(1, 3), 16)).toBeGreaterThan(200) // white-ish
    expect(treePaletteFor('SUNNY', 10).canopy).toEqual(treePaletteFor('LIVE', 7).canopy)
    expect(treePaletteFor('DUSK', 10).canopy).toEqual(treePaletteFor('LIVE', 10).canopy)
  })
})
