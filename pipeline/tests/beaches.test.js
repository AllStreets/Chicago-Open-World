// pipeline/tests/beaches.test.js — Lincoln Park's beaches are sand from the Lakefront Trail to the water (coordinator fix:
// the North Avenue Beach House stood on lawn among trees), and beach-volleyball courts are sand, not turf.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { lakefrontBeaches, isSandPitch } from '../lib/beaches.js'
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
})
