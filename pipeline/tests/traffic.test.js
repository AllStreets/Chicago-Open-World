// pipeline/tests/traffic.test.js — the drivable road graph (user, 2026-09-30: cars, buses, trucks, traffic lights).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { trafficClass, lanesOf, buildRoadGraph, encodeRoadGraph, LOWER_FLAG, TRAFFIC_VERSION } from '../lib/traffic.js'
import { lowerProfile, MOUTH_Y, RAMP_GRADE } from '../lib/lowerLevels.js'
import { project as worldProject } from '../../shared/project.js'

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
    expect(enc.slice(0, 2)).toEqual([TRAFFIC_VERSION, 2])
    expect(enc.every(Number.isInteger)).toBe(true)
    expect(enc[6]).toBe(0) // no node off the street
    expect(enc.slice(-8)).toEqual([0, 1, 2, 2, 2, 1, 2000, 0]) // a, b, class, lanes ↔, one interior point (v1's layout)
  })
})

// D3-1: Lower Wacker and the other multi-level streets are driven at their decks' heights, up their ramps to the street
describe('traffic on the lower levels (D3-1)', () => {
  const L = JSON.parse(readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8')).levels
  const LON = -87.625, lat = (k) => 41.885 + k * 0.0009 // ≈ 100 m steps north–south inside the downtown zone
  const w = (id, nodes, tags) => ({ type: 'way', id, nodes, tags, geometry: nodes.map((n) => ({ lat: lat(n), lon: LON })) })
  // street 0–1 · a ramp 1–2–3 down from the street (layer −1) · Lower Wacker 3–4–5 · a street 9–4–8 passing over node 4
  const roads = [
    w(10, [0, 1], { highway: 'secondary', name: 'Upper Street' }),
    w(11, [1, 2, 3], { highway: 'secondary', layer: '-1', tunnel: 'yes', oneway: 'yes' }),
    w(12, [3, 4, 5], { highway: 'trunk', layer: '-1', tunnel: 'covered', name: 'East Lower Wacker Drive', lanes: '3', oneway: 'yes' }),
    { type: 'way', id: 13, nodes: [9, 4, 8], tags: { highway: 'tertiary', name: 'Crossing Street' }, geometry: [{ lat: lat(4), lon: LON - 0.001 }, { lat: lat(4), lon: LON }, { lat: lat(4), lon: LON + 0.001 }] },
    w(14, [5, 6], { highway: 'service', layer: '-1', tunnel: 'yes' }),
  ]
  const lower = lowerProfile({ roads, levels: L })
  const g = buildRoadGraph(roads, worldProject, lower)
  const lowY = L.LOWER_Y - MOUTH_Y
  it('keeps the lower streets (not their service drives) and leaves them out without the lower-levels profile', () => {
    expect(g.edges.filter((e) => e.w != null).length).toBe(2) // the ramp and Lower Wacker; the service lane is not driven
    expect(buildRoadGraph(roads, worldProject).edges.every((e) => e.pts.every((p) => p[2] === 0))).toBe(true)
  })
  it('a ramp edge starts on the street and falls at the ramp grade to the deck, its knee a point of its own', () => {
    const ramp = g.edges.find((e) => e.w != null && e.pts[0][2] === 0)
    expect(ramp.pts.at(-1)[2]).toBeCloseTo(lowY, 2)
    const knee = ramp.pts.find((p) => Math.abs(p[2] - lowY) < 0.01)
    expect(Math.hypot(knee[0] - ramp.pts[0][0], knee[1] - ramp.pts[0][1])).toBeCloseTo((MOUTH_Y - L.LOWER_Y) / RAMP_GRADE, 0)
    for (let i = 1; i < ramp.pts.length; i++) {
      const a = ramp.pts[i - 1], b = ramp.pts[i]
      expect(Math.abs(b[2] - a[2]) / Math.hypot(b[0] - a[0], b[1] - a[1])).toBeLessThanOrEqual(RAMP_GRADE + 0.01)
    }
  })
  it('the street passing over Lower Wacker does not join it: the deep node is its own', () => {
    const deck = g.edges.find((e) => e.w != null && e.pts.every((p) => Math.abs(p[2] - lowY) < 0.01))
    expect(deck).toBeTruthy()
    const street = g.edges.filter((e) => e.w == null && e.pts.some((p) => Math.abs(p[1] - deck.pts[1][1]) < 1))
    for (const s of street) expect([s.a, s.b]).not.toContain(deck.a)
    expect(deck.w).toBeCloseTo(9.9) // three lanes
  })
  it('encodes heights in centimetres and the deck width, flagged per edge', () => {
    const enc = encodeRoadGraph(g)
    expect(enc[0]).toBe(2)
    const nN = enc[1], nLift = enc[2 + nN * 2]
    expect(nLift).toBeGreaterThan(0)
    expect(enc[2 + nN * 2 + 2]).toBe(Math.round(lowY * 100))
    let i = 3 + nN * 2 + nLift * 2
    const nE = enc[i++]
    let lowered = 0
    for (let e = 0; e < nE; e++) {
      const cls = enc[i + 2], k = enc[i + 5]
      i += 6
      if (cls & LOWER_FLAG) { lowered++; expect([99, 140]).toContain(enc[i]); i += 1 + k * 3 } else i += k * 2
    }
    expect(i).toBe(enc.length)
    expect(lowered).toBe(2)
  })
})
