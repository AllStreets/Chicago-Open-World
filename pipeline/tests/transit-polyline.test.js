import { describe, it, expect } from 'vitest'
import { segLen, cumulative, projectOnPolyline, resample, simplifyLine3, runsWhere } from '../lib/transit/polyline.js'

describe('transit polylines', () => {
  it('arc length and projection', () => {
    expect(cumulative([[0, 0], [30, 40], [30, 50]])).toEqual([0, 50, 60])
    const p = projectOnPolyline([[0, 0], [100, 0], [100, 100]], [60, 7])
    expect(p.s).toBeCloseTo(60); expect(p.d).toBeCloseTo(7); expect(p.i).toBe(0); expect(p.pt).toEqual([60, 0])
    expect(projectOnPolyline([[0, 0], [100, 0], [100, 100]], [103, 50]).s).toBeCloseTo(150)
    expect(segLen([0, 0], [3, 4])).toBe(5)
  })
  it('resample splits long segments and carries each segment tag onto its pieces', () => {
    const r = resample([[0, 0], [30, 0], [35, 0]], ['a', 'b'], 12)
    expect(r.pts.map((p) => p[0])).toEqual([0, 10, 20, 30, 35])
    expect(r.tags).toEqual(['a', 'a', 'a', 'b'])
  })
  it('simplifyLine3 keeps corners and heights', () => {
    const s = simplifyLine3([[0, 7, 0], [50, 7, 0.5], [100, 7, 0], [100, 3, 100]], 2)
    expect(s).toEqual([[0, 7, 0], [100, 7, 0], [100, 3, 100]])
    expect(simplifyLine3([[0, 7.2, 0], [400, 7.2, 0], [800, -9, 0]], 3)).toHaveLength(3) // a portal ramp is kept
  })
  it('runsWhere returns maximal runs of 2+ points', () => {
    const r = runsWhere([[0, 1, 0], [1, 1, 0], [2, -9, 0], [3, 1, 0], [4, 1, 0], [5, 1, 0], [6, -9, 0], [7, 1, 0]], (p) => p[1] > 0)
    expect(r.map((x) => x.length)).toEqual([2, 3])
  })
})
