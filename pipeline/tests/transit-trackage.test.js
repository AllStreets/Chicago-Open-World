import { describe, it, expect } from 'vitest'
import { linesByWay, laneOf, planBents } from '../lib/transit/trackage.js'

const ORDER = ['red', 'blue', 'brown', 'green', 'orange', 'pink', 'purple', 'yellow']

describe('shared trackage', () => {
  it('counts distinct lines per way, not relations: both Brown directions + Orange + Pink = 3 lanes', () => {
    const m = linesByWay([
      { line: 'pink', wayIds: [5] }, { line: 'brown', wayIds: [5, 6] }, { line: 'brown', wayIds: [7, 5] }, { line: 'orange', wayIds: [5] },
    ], ORDER)
    expect(m.get(5)).toEqual(['brown', 'orange', 'pink'])
    expect(m.get(6)).toEqual(['brown'])
    expect(laneOf(m.get(5), 'brown')).toEqual({ lane: -1, lanes: 3 })
    expect(laneOf(m.get(5), 'pink')).toEqual({ lane: 1, lanes: 3 })
    expect(laneOf(['red'], 'red')).toEqual({ lane: 0, lanes: 1 })
  })
})

describe('planBents', () => {
  const line = (id, z) => ({ wayId: id, pts: [[0, 7.2, z], [100, 7.2, z]] })
  it('paired tracks share one bent every 18 m, posts outside both tracks', () => {
    const b = planBents([line(1, 0), line(2, 3.8)])
    expect(b).toHaveLength(6) // 9, 27, 45, 63, 81, 99
    for (const x of b) {
      expect(Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1])).toBeCloseTo(3.8 + 2 * 1.6, 5)
      expect(x.y).toBeCloseTo(7.2)
    }
    expect(b.map((x) => Math.round(x.a[0]))).toEqual([9, 27, 45, 63, 81, 99])
  })
  it('a single track gets its own narrower bent; crossing tracks never pair', () => {
    expect(planBents([line(1, 0)]).map((x) => Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1]))).toEqual(Array(6).fill(4))
    const cross = { wayId: 2, pts: [[50, 7.2, -50], [50, 7.2, 50]] }
    const b = planBents([line(1, 0), cross])
    expect(b.every((x) => Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1]) === 4)).toBe(true)
  })
  it('spacing carries across vertices of a bending track', () => {
    const b = planBents([{ wayId: 1, pts: [[0, 7, 0], [10, 7, 0], [30, 7, 0]] }])
    expect(b.map((x) => Math.round(x.a[0]))).toEqual([9, 27])
  })
})
