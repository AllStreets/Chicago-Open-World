// pipeline/tests/trackClearance.test.js — no building stands on an at-grade or elevated track (user, 2026-09-30).
import { describe, it, expect } from 'vitest'
import { buildingsOverTracks, TRACK_HALF_WIDTH_M } from '../lib/trackClearance.js'

const sq = (x0, z0, s) => [[x0, z0], [x0 + s, z0], [x0 + s, z0 + s], [x0, z0 + s]]
const bld = (id, ring, extra = {}) => ({ id, polygons: [{ outer: ring, holes: [] }], area: 400, tags: {}, ...extra })
const route = (path) => ({ id: 'r', line: 'blue', path })

describe('buildings over tracks', () => {
  const elevated = route([[0, 7.2, -500], [0, 7.2, 500]])
  it('flags a three-flat standing on an elevated track, and one whose edge is inside the corridor', () => {
    const over = bld('over', sq(-10, 0, 20)), edge = bld('edge', sq(TRACK_HALF_WIDTH_M - 1, 100, 20)), clear = bld('clear', sq(30, 0, 20))
    expect(buildingsOverTracks([over, edge, clear], [elevated]).map((b) => b.id).sort()).toEqual(['edge', 'over'])
  })
  it('ignores subway segments — buildings legitimately stand over the tubes', () => {
    expect(buildingsOverTracks([bld('over', sq(-10, 0, 20))], [route([[0, -9, -500], [0, -9, 500]])])).toEqual([])
  })
  it('keeps heroes, station buildings, bridging structures and big terminals (air rights)', () => {
    const r = [elevated]
    const keep = [
      bld('hero', sq(-10, 0, 20), { hero: 'mart' }),
      bld('station', sq(-10, 40, 20), { tags: { building: 'train_station' } }),
      bld('bridge', sq(-10, 80, 20), { tags: { 'building:min_level': '2' } }),
      bld('terminal', sq(-10, 120, 20), { area: 25000 }),
    ]
    expect(buildingsOverTracks(keep, r)).toEqual([])
  })
  it('handles a track crossing a building diagonally with no vertex inside', () => {
    expect(buildingsOverTracks([bld('x', sq(100, 100, 20))], [route([[90, 0.35, 130], [130, 0.35, 90]])]).map((b) => b.id)).toEqual(['x'])
  })
})
