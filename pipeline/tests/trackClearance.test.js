// pipeline/tests/trackClearance.test.js — no building stands in a track's right-of-way (user, 2026-09-30): footprints
// overlapping the elevated structure or the ballast are cut back to the corridor edge, or removed if mostly inside.
import { describe, it, expect } from 'vitest'
import { clearTracks, CORRIDOR_HW } from '../lib/trackClearance.js'

const sq = (x0, z0, w, d = w) => [[x0, z0], [x0 + w, z0], [x0 + w, z0 + d], [x0, z0 + d]]
const area = (r) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1] }, 0) / 2)
const bld = (id, ring, extra = {}) => ({ id, polygons: [{ outer: ring, holes: [] }], pieces: [{ outer: ring, holes: [], base: 0, top: 12 }], area: area(ring), centroid: [0, 0], tags: {}, ...extra })
// a two-track elevated line: tracks 3.6 m apart either side of x = 0
const elevated2 = [{ path: [[-1.8, 7.2, -500], [-1.8, 7.2, 500]] }, { path: [[1.8, 7.2, -500], [1.8, 7.2, 500]] }]

describe('track clearance', () => {
  it('the corridor covers the structure: elevated reaches 5 m past the outer track, at grade 4 m', () => {
    expect(CORRIDOR_HW.elevated).toBe(5); expect(CORRIDOR_HW.atGrade).toBe(4)
  })
  it('a building grazing a two-track elevated corridor is cut back to the corridor edge, the rest kept', () => {
    // west wall at x = 4 overlaps the corridor (which ends at 1.8 + 5 = 6.8)
    const b = bld('graze', sq(4, 0, 20, 20))
    const r = clearTracks([b], elevated2)
    expect(r.removed.size).toBe(0); expect(r.clipped).toBe(1)
    const xs = b.polygons[0].outer.map((p) => p[0])
    expect(Math.min(...xs)).toBeCloseTo(6.8, 1)
    for (const pc of b.pieces) expect(Math.min(...pc.outer.map((p) => p[0]))).toBeGreaterThanOrEqual(6.79)
    expect(b.area).toBeCloseTo(17.2 * 20, 0)
  })
  it('a building mostly inside the corridor is removed', () => {
    expect(clearTracks([bld('over', sq(-8, 0, 16, 20))], elevated2).removed.size).toBe(1)
  })
  it('subway segments carry no corridor; heroes, stations, bridging structures and terminals are kept', () => {
    expect(clearTracks([bld('x', sq(-8, 0, 16, 20))], [{ path: [[0, -9, -500], [0, -9, 500]] }]).removed.size).toBe(0)
    const keep = [bld('hero', sq(-8, 0, 16, 20), { hero: 'mart' }), bld('st', sq(-8, 40, 16, 20), { tags: { building: 'train_station' } }),
      bld('air', sq(-8, 80, 16, 20), { tags: { 'building:min_level': '2' } }), bld('term', sq(-8, 120, 16, 20), { area: 25000 })]
    const r = clearTracks(keep, elevated2)
    expect(r.removed.size + r.clipped).toBe(0)
  })
  it('an at-grade track crossing a building diagonally removes or clips it', () => {
    const b = bld('x', sq(100, 100, 20)), r = clearTracks([b], [{ path: [[90, 0.35, 130], [130, 0.35, 90]] }])
    expect(r.removed.size + r.clipped).toBe(1)
  })
})
