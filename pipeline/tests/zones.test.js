// pipeline/tests/zones.test.js — neighbourhood zones from official boundaries + curated profiles (P4 Task 7).
import { describe, it, expect } from 'vitest'
import { labelPoint, zoneStats, buildNeighborhoods } from '../lib/zones.js'
import { pointInRing } from '../lib/geom.js'

const sq = (x0, z0, s) => [[x0, z0], [x0 + s, z0], [x0 + s, z0 + s], [x0, z0 + s]]
describe('zones', () => {
  it('labels an L-shaped zone at an interior point, not its (outside) centroid', () => {
    const L = [[0, 0], [100, 0], [100, 20], [20, 20], [20, 100], [0, 100]]
    const p = labelPoint(L)
    expect(pointInRing(p, L)).toBe(true)
  })
  it('counts places, stations, lines, park share and major roads inside the zone', () => {
    const ring = sq(0, 0, 1000)
    const s = zoneStats(ring, {
      pois: [{ x: 10, z: 10, cat: 'food' }, { x: 20, z: 20, cat: 'drinks' }, { x: 5000, z: 5000, cat: 'food' }],
      stations: [{ x: 500, z: 500, lines: ['red', 'blue'], operator: 'cta' }, { x: 900, z: 900, lines: ['red'], operator: 'cta' }, { x: 9000, z: 9000, lines: ['green'], operator: 'cta' }],
      parks: [sq(0, 0, 500)], roads: [[[0, 100], [1000, 100]]],
    })
    expect(s.areaKm2).toBeCloseTo(1, 3)
    expect(s.poiCounts).toEqual({ food: 1, drinks: 1 })
    expect(s.stationCount).toBe(2); expect(s.lineCount).toBe(2)
    expect(s.parkShare).toBeCloseTo(0.25, 2)
    expect(s.majorRoadKmPerKm2).toBeCloseTo(1, 1)
  })
  it('keeps curated zones that match a boundary, with feel scores, nearby lines and sources', () => {
    const feature = (name, x0) => ({ properties: { pri_neigh: name }, geometry: { type: 'Polygon', coordinates: [sq(x0, 0, 0.01).map(([x, z]) => [x, z]).concat([[x0, 0]])] } })
    const project = (lon, lat) => [lon * 100000, lat * 100000]
    const out = buildNeighborhoods({
      features: [feature('Loop', 0), feature('River North', 0.02), feature('Elsewhere', 0.04)],
      curated: [{ id: 'loop', name: 'The Loop', pri_neigh: 'Loop', character: 'x', vibe: ['a', 'b'], rent: null, sources: [] }, { id: 'rn', name: 'River North', pri_neigh: 'River North', character: 'y', vibe: ['c', 'd'], rent: null, sources: [] }, { id: 'gone', name: 'Gone', pri_neigh: 'Nowhere', character: 'z', vibe: ['e', 'f'], rent: null, sources: [] }],
      project, pois: [], stations: [{ x: 500, z: 500, lines: ['brown'], operator: 'cta' }], parks: [], roads: [],
    })
    expect(out.zones.map((z) => z.id)).toEqual(['loop', 'rn'])
    const loop = out.zones[0]
    expect(loop.ring.length).toBeGreaterThanOrEqual(4); expect(loop.lines).toEqual(['brown'])
    for (const k of ['walk', 'transit', 'nightlife', 'green', 'quiet']) expect(loop.feel[k]).toBeGreaterThanOrEqual(0)
  })
})

describe('zones — walkable transit (P4 Task 7 evaluation)', () => {
  it('a station just outside the edge counts (a short walk), one far away does not', () => {
    const s = zoneStats(sq(0, 0, 1000), { stations: [{ x: 1300, z: 500, lines: ['red'], operator: 'cta' }, { x: 3000, z: 500, lines: ['blue'], operator: 'cta' }] })
    expect(s.stationCount).toBe(1); expect(s.lineCount).toBe(1)
  })
  it('lists the lines near the zone even when its label is deep inside a big park', () => {
    const feature = { properties: { pri_neigh: 'Park' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [0.04, 0], [0.04, 0.04], [0, 0.04], [0, 0]]] } }
    const out = buildNeighborhoods({ features: [feature], curated: [{ id: 'p', name: 'P', pri_neigh: 'Park', character: 'x', vibe: ['a', 'b'], sources: [] }], project: (lon, lat) => [lon * 100000, lat * 100000],
      pois: [], stations: [{ x: 4300, z: 100, lines: ['brown'], operator: 'cta' }], parks: [], roads: [] })
    expect(out.zones[0].lines).toEqual(['brown'])
  })
})
