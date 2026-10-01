// pipeline/tests/recreation.test.js — B-7: the beach house, the Passerelle, the driving range, the cultural center and
// comfort stations: each named for hover and ⌘K, sourced, within budget.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLandmark } from '../lib/landmarks.js'
import { landmarkKind } from '../lib/landmarkRuntime.js'
import { project } from '../../shared/project.js'

const heroes = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes
const H = (k) => heroes.find((x) => x.key === k)
const pts = (ms) => ms.flatMap((m) => { const o = []; for (let i = 0; i < m.mesh.positions.length; i += 3) o.push(m.mesh.positions.slice(i, i + 3)); return o })
const part = (r, p) => r.meshes.filter((m) => m.part === p)
const hi = (a) => a.reduce((m, v) => Math.max(m, v), -Infinity)
const tris = (r) => r.meshes.reduce((n, m) => n + m.mesh.positions.length / 9, 0)

describe('Lincoln Park recreation (B-7)', () => {
  it('each site has its card line and ⌘K aliases', () => {
    const want = { northavebeach: 'Beach house', passerelle: 'Footbridge', drivingrange: 'Driving range', lpculturalcenter: 'Cultural center', fullertoncomfort: 'Comfort station', roscoecomfort: 'Comfort station', southfieldhouse: 'Fieldhouse' }
    for (const [k, line] of Object.entries(want)) { expect(landmarkKind(H(k), false).kindLine, k).toBe(line); expect(H(k).aliases.length, k).toBeGreaterThan(0) }
    expect(H('wavelandclock').aliases).toContain('Marovitz Golf Course')
  })
  it('the North Avenue Beach House: a white hull with portholes, an upper deck, two red-banded funnels', () => {
    const ring = [[36.8, 31.8], [43.7, 19.6], [40.0, 12.2], [28.1, 1.8], [7.5, -13.0], [-10.5, -23.8], [-29.7, -32.4], [-41.3, -33.4], [-43.7, -29.9], [-40.9, -22.7], [-23.7, -2.6], [0.7, 16.8], [17.6, 27.8], [31.3, 33.5]]
    const r = buildLandmark({ id: 't', height: 8, polygons: [{ outer: ring, holes: [] }], centroid: [0, 0], area: 1 }, H('northavebeach').landmark)
    expect(part(r, 'funnel-bands').length).toBe(1)
    expect(pts(part(r, 'portholes')).length / 3).toBeGreaterThan(20 * 10)
    expect(hi(pts(part(r, 'hull')).map((q) => q[1]))).toBeGreaterThan(12) // the funnels over the upper deck
    expect(tris(r)).toBeLessThan(15000)
  })
  it('the Passerelle: two arch ribs over Lake Shore Drive, the deck at clearance height, ramps to the ground', () => {
    const h = H('passerelle'), c = project(h.match.lon, h.match.lat)
    const r = buildLandmark({ id: 't', height: 0, polygons: [{ outer: [[c[0] - 3, c[1] - 3], [c[0] + 3, c[1] - 3], [c[0] + 3, c[1] + 3]], holes: [] }], centroid: c, area: 9 }, h.landmark)
    const deck = pts(part(r, 'deck')).map((q) => q[1]), arch = pts(part(r, 'arch')).map((q) => q[1])
    expect(Math.max(...deck)).toBeCloseTo(5.6, 1); expect(Math.min(...deck)).toBeGreaterThan(4.9) // ≥ 4.9 m clear over the drive
    expect(hi(arch)).toBeGreaterThan(13); expect(Math.min(...pts(part(r, 'ramps')).map((q) => q[1]))).toBeLessThan(0.05)
  })
  it('the driving range: nets round the landing area keep trees off it; the bays on their OSM roof outline', () => {
    const h = H('drivingrange'), c = project(-87.63507, 41.93382)
    const r = buildLandmark({ id: 't', height: 0, polygons: [{ outer: [[c[0] - 5, c[1] - 5], [c[0] + 5, c[1] - 5], [c[0] + 5, c[1] + 5], [c[0] - 5, c[1] + 5]], holes: [] }], centroid: c, area: 100 }, h.landmark)
    expect(r.clear.length).toBe(1); expect(part(r, 'nets')[0].facade).toBe(26)
    expect(hi(pts(part(r, 'posts')).map((q) => q[1]))).toBeCloseTo(18.6, 1)
  })
})
