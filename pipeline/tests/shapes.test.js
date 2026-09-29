import { describe, it, expect } from 'vitest'
import { shapePieces, HERO_SHAPES } from '../lib/shapes.js'

const sq = (x, z, s) => [[x, z], [x + s, z], [x + s, z - s], [x, z - s]]
const bldg = (id, extra = {}) => ({
  id, area: 80 * 50, centroid: [40, -25], height: 0,
  polygons: [{ outer: sq(0, 0, 80), holes: [] }],
  parts: null, ...extra,
})

describe('shapePieces', () => {
  it('plain buildings: one piece per polygon at building height', () => {
    const p = shapePieces(bldg('1', { height: 30 }))
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({ base: 0, top: 30 })
    expect(p[0].taper).toBeUndefined()
  })
  it('keeps parts, skips zero-height footprint', () => {
    const p = shapePieces(bldg('1', { parts: [{ outer: sq(0, 0, 80), holes: [], base: 0, top: 200 }] }))
    expect(p).toHaveLength(1)
    expect(p[0].top).toBe(200)
  })
  it('Hancock: body tapers, antennas reseat on the shaft top and move inward', () => {
    expect(HERO_SHAPES['331204'].topScale).toBeCloseTo(0.62)
    const body = { outer: sq(0, 0, 80), holes: [], base: 0, top: 337 }
    const mast = { outer: sq(70, -5, 2), holes: [], base: 0, top: 457 } // near the east edge
    const p = shapePieces(bldg('331204', { parts: [body, mast] }))
    const b = p.find((x) => x.top === 337)
    const a = p.find((x) => x.top === 457)
    expect(b.taper).toMatchObject({ shaftTop: 337, topScale: 0.62 })
    expect(a.taper).toBeUndefined()
    expect(a.base).toBeCloseTo(337 * 0.98)
    const ax = a.outer.reduce((s, q) => s + q[0], 0) / a.outer.length
    expect(ax).toBeLessThan(71) // pulled toward center x=40
    expect(ax).toBeCloseTo(40 + (71 - 40) * 0.62, 0)
  })
})
