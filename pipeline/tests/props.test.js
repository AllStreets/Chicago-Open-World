import { describe, it, expect } from 'vitest'
import { roofProps } from '../lib/props.js'
import { pointInRing } from '../lib/geom.js'

const sq = (x, z, s) => [[x, z], [x + s, z], [x + s, z - s], [x, z - s]]
const mk = (o) => ({ id: 'x1', year: 1920, area: 900, centroid: [15, -15], height: 40, parts: null, polygons: [{ outer: sq(0, 0, 30), holes: [] }], ...o })

describe('roofProps', () => {
  it('is deterministic', () => {
    const b = mk({})
    const pieces = [{ outer: sq(0, 0, 30), holes: [], base: 0, top: 40 }]
    expect(roofProps(b, pieces)).toEqual(roofProps(b, pieces))
  })
  it('props sit on the roof, inside the ring', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      const b = mk({ id })
      const pieces = [{ outer: sq(0, 0, 30), holes: [], base: 0, top: 40 }]
      for (const [, x, y, z] of roofProps(b, pieces)) {
        expect(y).toBe(40)
        expect(pointInRing([x, z], pieces[0].outer)).toBe(true)
      }
    }
  })
  it('no water towers on modern towers; penthouse on tall plain towers', () => {
    const b = mk({ year: 1990, height: 150, area: 2500, polygons: [{ outer: sq(0, 0, 50), holes: [] }] })
    const out = roofProps(b, [{ outer: sq(0, 0, 50), holes: [], base: 0, top: 150 }])
    expect(out.some((p) => p[0] === 0)).toBe(false)
    expect(out.some((p) => p[0] === 2)).toBe(true)
  })
  it('low buildings get nothing', () => {
    expect(roofProps(mk({ height: 10 }), [{ outer: sq(0, 0, 30), holes: [], base: 0, top: 10 }])).toEqual([])
  })
})
