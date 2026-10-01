// pipeline/tests/traffic.test.js — the drivable road graph (user, 2026-09-30: cars, buses, trucks, traffic lights).
import { describe, it, expect } from 'vitest'
import { trafficClass, lanesOf, buildRoadGraph, encodeRoadGraph } from '../lib/traffic.js'

const project = (lon, lat) => [lon * 1000, -lat * 1000]
const way = (id, nodes, tags) => ({ id, nodes, tags, geometry: nodes.map((n) => ({ lon: n, lat: 0 })) })

describe('traffic road graph', () => {
  it('drives on streets the ground shows: no tunnels, Lower Wacker, service or private roads', () => {
    expect(trafficClass({ highway: 'primary' })).toBe(2)
    expect(trafficClass({ highway: 'motorway_link' })).toBe(6)
    expect(trafficClass({ highway: 'primary', tunnel: 'yes' })).toBe(-1)
    expect(trafficClass({ highway: 'secondary', layer: '-1' })).toBe(-1)
    expect(trafficClass({ highway: 'service' })).toBe(-1)
    expect(trafficClass({ highway: 'residential', access: 'private' })).toBe(-1)
  })
  it('lanes each way: from the tags, or a default for the class; one-ways and motorways run one way', () => {
    expect(lanesOf({ highway: 'primary', lanes: '4' }, 2)).toEqual({ fwd: 2, back: 2, reverse: false })
    expect(lanesOf({ highway: 'secondary', oneway: 'yes', lanes: '3' }, 3)).toEqual({ fwd: 3, back: 0, reverse: false })
    expect(lanesOf({ highway: 'motorway' }, 0).back).toBe(0)
    expect(lanesOf({ highway: 'residential', oneway: '-1' }, 5).reverse).toBe(true)
  })
  it('splits ways at shared nodes into edges between junctions', () => {
    // a street 1-2-3-4 crossed at node 2 by 5-2-6, and a one-way 7-8 drawn backwards
    const g = buildRoadGraph([way(1, [1, 2, 3, 4], { highway: 'primary' }), way(2, [5, 2, 6], { highway: 'tertiary' }), way(3, [7, 8], { highway: 'residential', oneway: '-1' })], project)
    expect(g.edges.length).toBe(5) // 1-2, 2-4 (3 is interior), 5-2, 2-6, 8-7
    const long = g.edges.find((e) => e.pts.length === 3)
    expect(long.pts.map((p) => p[0])).toEqual([2000, 3000, 4000])
    const rev = g.edges.find((e) => e.cls === 5)
    expect(g.nodes[rev.a][0]).toBe(8000); expect(rev.back).toBe(0)
  })
  it('encodes to whole metres in one integer array', () => {
    const g = buildRoadGraph([way(1, [1, 2, 3], { highway: 'primary' })], project), enc = encodeRoadGraph(g)
    expect(enc.slice(0, 2)).toEqual([1, 2])
    expect(enc.every(Number.isInteger)).toBe(true)
    expect(enc.slice(-8)).toEqual([0, 1, 2, 2, 2, 1, 2000, 0]) // a, b, class, lanes ↔, one interior point
  })
})
