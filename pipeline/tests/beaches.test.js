// pipeline/tests/beaches.test.js — Lincoln Park's beaches are sand from the Lakefront Trail to the water (coordinator fix:
// the North Avenue Beach House stood on lawn among trees), and beach-volleyball courts are sand, not turf.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { lakefrontBeaches, isSandPitch, isBeachKeepOut, parkingLot, sandShare, pathOnBeach, volleyballNets } from '../lib/beaches.js'
import { pointInRing } from '../lib/geom.js'
import { project } from '../../shared/project.js'

describe('lakefront beaches', () => {
  // a straight trail at x = 0 and the lake east of x = 100, from z = −4000 to −3000
  const zS = project(0, 41.9118)[1], zN = project(0, 41.9252)[1]
  const trail = [Array.from({ length: 200 }, (_, i) => [0, zS + 200 - ((zS - zN + 400) * i) / 199])]
  const lake = [{ outer: [[100, zS + 500], [5000, zS + 500], [5000, zN - 500], [100, zN - 500]], holes: [] }]
  const b = lakefrontBeaches([{ key: 'n', name: 'North Avenue Beach', south: 41.9118, north: 41.9252, setbackM: 6, source: 'x' }], { trail, lake })
  it('is sand between the trail (plus its setback) and the shore, within its latitudes', () => {
    expect(b).toHaveLength(1)
    const r = b[0].outer, xs = r.map((p) => p[0]), zs = r.map((p) => p[1])
    expect(Math.min(...xs)).toBeCloseTo(6, 0); expect(Math.max(...xs)).toBeCloseTo(100, 0)
    expect(Math.max(...zs)).toBeCloseTo(zS, 0); expect(Math.min(...zs)).toBeCloseTo(zN, 0)
    expect(pointInRing([50, (zS + zN) / 2], r)).toBe(true); expect(pointInRing([-20, (zS + zN) / 2], r)).toBe(false)
    expect(b[0].tags.natural).toBe('beach')
  })
  it('volleyball courts on sand are sand; other pitches stay turf', () => {
    expect(isSandPitch({ leisure: 'pitch', sport: 'beachvolleyball', surface: 'sand' })).toBe(true)
    expect(isSandPitch({ leisure: 'pitch', sport: 'tennis' })).toBe(false)
  })
  it('data/beaches.json: North Avenue Beach from North Ave to Fullerton, sourced', () => {
    const d = JSON.parse(readFileSync(new URL('../data/beaches.json', import.meta.url), 'utf8')).beaches
    const n = d.find((x) => x.key === 'northavenue')
    expect(n.south).toBeLessThan(41.912); expect(n.north).toBeGreaterThan(41.925)
    for (const x of d) expect(x.source).toMatch(/^https:\/\//)
  })
  it('F-8: lawns, gardens and parking lots mapped inside a band stay out of the sand', () => {
    const zm = (zS + zN) / 2
    const lawn = { outer: [[20, zm - 20], [60, zm - 20], [60, zm + 20], [20, zm + 20]] }
    const [s1] = lakefrontBeaches([{ key: 'n', name: 'N', south: 41.9118, north: 41.9252, setbackM: 6, source: 'x' }], { trail, lake, keepOut: [lawn] })
    expect(s1.holes).toHaveLength(1)
    expect(isBeachKeepOut({ landuse: 'grass' })).toBe(true); expect(isBeachKeepOut({ leisure: 'garden' })).toBe(true)
    expect(isBeachKeepOut({ leisure: 'park' })).toBe(false) // the park the whole lakefront sits in
    const lot = parkingLot([[0, 0], [0, 40], [10, 40], [10, 0]], 9)
    expect(pointInRing([5, 20], lot.outer)).toBe(true); expect(pointInRing([-8, 20], lot.outer)).toBe(true); expect(pointInRing([-12, 20], lot.outer)).toBe(false)
  })
})

describe('F-8: paths on the sand and the Lakefront Trail', () => {
  const onSand = ([x]) => x > 0
  it('measures how much of a path runs over the sand', () => {
    expect(sandShare([[-12, 0], [12, 0]], onSand)).toBeCloseTo(0.5, 5)
    expect(sandShare([[1, 0], [1, 50]], onSand)).toBe(1)
  })
  it('the Lakefront Trail is the trail layer wherever it runs; other walks over sand are narrow concrete', () => {
    expect(pathOnBeach({ name: 'Lakefront Trail', highway: 'cycleway' }, { surface: 'asphalt', hw: 2.2 }, 0)).toEqual({ surface: 'trail', hw: 2.2 })
    expect(pathOnBeach({ name: 'Lakefront Trail' }, { surface: 'asphalt', hw: 1.5 }, 0.9).surface).toBe('trail')
    expect(pathOnBeach({ name: 'Lakefront Trail' }, { surface: 'concrete', hw: 2 }, 0.9).surface).toBe('concrete')
    expect(pathOnBeach({ highway: 'footway', surface: 'paved' }, { surface: 'asphalt', hw: 1.5 }, 0.8)).toEqual({ surface: 'concrete', hw: 1 })
    expect(pathOnBeach({ highway: 'footway' }, { surface: 'asphalt', hw: 1.5 }, 0.2)).toEqual({ surface: 'asphalt', hw: 1.5 })
  })
})

describe('F-8: volleyball nets', () => {
  // an 8 × 16 m court, its long axis along z, centred at (100, −50)
  const court = { outer: [[96, -58], [104, -58], [104, -42], [96, -42]] }
  it('one net across the middle of each court, a little wider than it, on the sand', () => {
    const [n] = volleyballNets([court], () => -0.8)
    expect(n.x).toBeCloseTo(100); expect(n.z).toBeCloseTo(-50); expect(n.y).toBe(-0.8)
    expect(n.len).toBeGreaterThan(8); expect(n.len).toBeLessThan(10.5)
    // the net (the model's +x turned by yaw about +y) runs across the long axis: along x here
    expect(Math.abs(Math.cos(n.yaw))).toBeCloseTo(1, 5)
  })
  it('skips shapes that are not courts', () => {
    expect(volleyballNets([{ outer: [[0, 0], [100, 0], [100, 100], [0, 100]] }])).toHaveLength(0)
  })
})

