// pipeline/tests/feel.test.js
import { describe, it, expect } from 'vitest'
import { feelScores } from '../lib/feel.js'

const zone = (id, o = {}) => ({ id, areaKm2: 1, poiCounts: { food: 10, coffee: 5, shops: 10, services: 5, drinks: 5, nightlife: 1 }, stationCount: 1, lineCount: 1, parkShare: 0.1, majorRoadKmPerKm2: 3, ...o })
describe('feelScores', () => {
  const zones = [zone('a'), zone('b', { stationCount: 4, lineCount: 5 }), zone('c', { poiCounts: { drinks: 60, nightlife: 20 }, majorRoadKmPerKm2: 8 }), zone('d', { parkShare: 0.6 })]
  const s = feelScores(zones)
  it('every zone gets all five scores in 0–10', () => {
    for (const id of ['a', 'b', 'c', 'd']) for (const k of ['walk', 'transit', 'nightlife', 'green', 'quiet']) {
      expect(s[id][k]).toBeGreaterThanOrEqual(0); expect(s[id][k]).toBeLessThanOrEqual(10)
    }
  })
  it('more stations and lines → higher transit', () => { expect(s.b.transit).toBeGreaterThan(s.a.transit) })
  it('nightlife-heavy, road-heavy zones are the least quiet', () => {
    expect(s.c.nightlife).toBe(10); expect(s.c.quiet).toBe(Math.min(...Object.values(s).map((z) => z.quiet)))
  })
  it('park share drives green', () => { expect(s.d.green).toBe(10) })
  it('is deterministic', () => { expect(feelScores(zones)).toEqual(s) })
})
