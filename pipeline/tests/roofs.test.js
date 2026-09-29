import { describe, it, expect } from 'vitest'
import { insetRing, parapetPiece, PARAPET_FACADE } from '../lib/roofs.js'
import { signedArea } from '../lib/geom.js'

const sq = (x, z, s) => [[x, z], [x + s, z], [x + s, z - s], [x, z - s]]

describe('insetRing', () => {
  it('insets a square by d on every side (either winding)', () => {
    expect(Math.abs(signedArea(insetRing(sq(0, 0, 10), 1)))).toBeCloseTo(64)
    expect(Math.abs(signedArea(insetRing([...sq(0, 0, 10)].reverse(), 1)))).toBeCloseTo(64)
  })
})

describe('parapetPiece', () => {
  it('is a 1.1 m ring on top of the roof with the inset as a hole', () => {
    const p = parapetPiece({ outer: sq(0, 0, 30), holes: [], base: 0, top: 40 })
    expect(p).toMatchObject({ base: 40, top: 41.1 })
    expect(p.holes).toHaveLength(1)
    expect(PARAPET_FACADE).toBe(8)
  })
  it('skips low, tiny and tapered pieces', () => {
    expect(parapetPiece({ outer: sq(0, 0, 30), holes: [], base: 0, top: 8 })).toBeNull()
    expect(parapetPiece({ outer: sq(0, 0, 4), holes: [], base: 0, top: 40 })).toBeNull()
    expect(parapetPiece({ outer: sq(0, 0, 30), holes: [], base: 0, top: 40, taper: {} })).toBeNull()
  })
})
