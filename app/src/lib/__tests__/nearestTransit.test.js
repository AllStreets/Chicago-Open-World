// app/src/lib/__tests__/nearestTransit.test.js
import { describe, it, expect } from 'vitest'
import { nearestStations, linesNear, CHI_LINE, WALK_M_PER_MIN } from '../nearestTransit.js'

const stations = [
  { id: 'grand-red', name: 'Grand', x: 0, z: -1450, lines: ['red'] },
  { id: 'chicago-red', name: 'Chicago', x: 0, z: -1600, lines: ['red'] },
  { id: 'merch', name: 'Merchandise Mart', x: -500, z: -800, lines: ['brown', 'purple'] },
  { id: 'far', name: 'Far', x: 9000, z: 9000, lines: ['blue'] },
]
describe('nearest L', () => {
  it('returns the k nearest within walking range with walk minutes at 80 m/min', () => {
    const r = nearestStations(0, -1300, stations, { k: 2 })
    expect(r.map((s) => s.station.id)).toEqual(['grand-red', 'chicago-red'])
    expect(r[0].walkMin).toBeCloseTo(150 / WALK_M_PER_MIN, 5)
  })
  it('returns [] when nothing is within range (never NaN)', () => {
    expect(nearestStations(20000, 20000, stations)).toEqual([])
  })
  it('linesNear lists each line once, nearest first', () => {
    expect(linesNear(-400, -900, stations, 1000)).toEqual(['brown', 'purple', 'red'])
  })
  it('maps CHI line codes to app ids', () => {
    expect(['Red', 'Blue', 'Brn', 'G', 'Org', 'Pink', 'P', 'Y'].map((c) => CHI_LINE[c])).toEqual(['red', 'blue', 'brown', 'green', 'orange', 'pink', 'purple', 'yellow'])
  })
})
