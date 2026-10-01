// pipeline/tests/rides.test.js — bus routes from OSM relations, walks that never pass through a building (P7).
import { describe, it, expect } from 'vitest'
import { chainWays, clipToBox, busRide, walkSamplesClear, simplify, projectOnto } from '../lib/rides.js'

const P = (lat, lon) => ({ lat, lon })
const project = (lon, lat) => [lon * 1e5, -lat * 1e5]

describe('bus routes', () => {
  it('chains ways in member order, flipping reversed ones (the first included)', () => {
    const a = [P(0, 0), P(0, 0.001)], b = [P(0, 0.002), P(0, 0.001)], c = [P(0, 0.002), P(0, 0.003)]
    const [one] = chainWays([{ geometry: [...a].reverse() }, { geometry: b }, { geometry: c }])
    expect(one.map((p) => p.lon)).toEqual([0, 0.001, 0.002, 0.003])
  })
  it('a gap starts a new piece', () => {
    expect(chainWays([{ geometry: [P(0, 0), P(0, 1)] }, { geometry: [P(5, 5), P(5, 6)] }])).toHaveLength(2)
  })
  it('keeps the longest run inside the world box', () => {
    expect(clipToBox([[0, 0], [10, 0], [500, 0], [20, 0], [30, 0], [40, 0]], { minX: -1, maxX: 100, minZ: -1, maxZ: 1 })).toEqual([[20, 0], [30, 0], [40, 0]])
  })
  it('a relation → a route with its named stops within 25 m, in order', () => {
    const rel = { id: 7, tags: { ref: '146', name: 'Bus 146: Berwyn -> Museum Campus' }, members: [
      { type: 'way', role: '', geometry: [P(0, 0), P(0, 0.01)] }, { type: 'way', role: '', geometry: [P(0, 0.01), P(0, 0.03)] },
      { type: 'node', role: 'stop', lat: 0.00005, lon: 0.02, tags: { name: 'Oak' } }, { type: 'node', role: 'stop', lat: 0.005, lon: 0.005, tags: { name: 'Far off' } },
      { type: 'node', role: 'platform', lat: 0, lon: 0.005, tags: { name: 'Delaware' } },
    ] }
    const r = busRide(rel, project, { minX: -1e9, maxX: 1e9, minZ: -1e9, maxZ: 1e9 })
    expect(r).toMatchObject({ ref: '146', from: 'Berwyn', to: 'Museum Campus' })
    expect(r.stops.map((s) => s.name)).toEqual(['Delaware', 'Oak'])
    expect(r.path).toEqual([[0, 0], [3000, 0]])
  })
  it('simplify keeps the ends and the corners', () => {
    expect(simplify([[0, 0], [5, 0.1], [10, 0], [10, 10]], 1)).toEqual([[0, 0], [10, 0], [10, 10]])
    expect(projectOnto([[0, 0], [100, 0]], [40, 3])).toEqual({ s: 40, d: 3 })
  })
})

describe('walks', () => {
  const block = { id: 'b1', name: 'A block', polygons: [{ outer: [[10, -10], [20, -10], [20, 10], [10, 10]], holes: [[[12, -2], [18, -2], [18, 2], [12, 2]]] }] }
  const near = () => [block]
  it('a walk through a building fails the check, naming it', () => {
    const bad = walkSamplesClear([[0, 5], [30, 5]], near)
    expect(bad.length).toBeGreaterThan(0); expect(bad[0].name).toBe('A block')
  })
  it('a walk round it — or through its open courtyard only — passes', () => {
    expect(walkSamplesClear([[0, 15], [30, 15]], near)).toEqual([])
    expect(walkSamplesClear([[13, 0], [17, 0]], near)).toEqual([])
  })
})
