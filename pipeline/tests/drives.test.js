// pipeline/tests/drives.test.js — D3-3: drives under the street routed over the traffic graph, in the right-hand lane,
// with the roadway's height per point; and a bascule's lower deck driven at its lower street's level.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildRoadGraph, encodeRoadGraph } from '../lib/traffic.js'
import { lowerProfile, MOUTH_Y } from '../lib/lowerLevels.js'
import { driveRide, simplify3, DRIVES } from '../lib/drives.js'
import { project } from '../../shared/project.js'

const L = JSON.parse(readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8')).levels
const LON = -87.625, lat = (k) => 41.885 + k * 0.0009 // ≈ 100 m steps north–south inside the downtown zone
const w = (id, nodes, tags) => ({ type: 'way', id, nodes, tags, geometry: nodes.map((n) => ({ lat: lat(n), lon: LON })) })
// street 0–1 · a ramp 1–2 down (one-way north→south… as drawn) · Lower Wacker 2–3–4 · a ramp 4–5 up · street 5–6
const roads = [
  w(10, [0, 1], { highway: 'secondary', name: 'Upper A', oneway: 'yes' }),
  w(11, [1, 2], { highway: 'secondary', layer: '-1', tunnel: 'yes', oneway: 'yes' }),
  w(12, [2, 3, 4], { highway: 'trunk', layer: '-1', tunnel: 'covered', name: 'East Lower Wacker Drive', lanes: '3', oneway: 'yes' }),
  w(13, [4, 5], { highway: 'trunk_link', layer: '-1', tunnel: 'yes', oneway: 'yes' }),
  w(14, [5, 6], { highway: 'secondary', name: 'Upper B', oneway: 'yes' }),
]
const lower = lowerProfile({ roads, levels: L })
const bin = new Int16Array(encodeRoadGraph(buildRoadGraph(roads, project, lower)))
const at = (k, y) => { const [x, z] = project(LON, lat(k)); return [x, z, y] }

describe('drives under the street (D3-3)', () => {
  const drive = { id: 't', waypoints: [{ name: 'Start', at: at(0.5, 0) }, { name: 'On the deck', at: at(3, L.LOWER_Y - MOUTH_Y) }, { name: 'Out', at: at(5.5, 0) }] }
  const r = driveRide(bin, drive)
  it('routes down the ramp, along the deck and up again, one stop per waypoint', () => {
    expect(r).toBeTruthy()
    expect(r.stops.map((s) => s.name)).toEqual(['Start', 'On the deck', 'Out'])
    expect(r.path[0][2]).toBeCloseTo(MOUTH_Y, 1)
    expect(Math.min(...r.path.map((p) => p[2]))).toBeCloseTo(L.LOWER_Y, 1)
    expect(r.path.at(-1)[2]).toBeCloseTo(MOUTH_Y, 1)
    for (let i = 1; i < r.path.length; i++) expect(r.stops[1].s).toBeGreaterThan(0)
  })
  it('keeps to the right-hand lane (clear of the kerb columns on a 9.9 m deck)', () => {
    // where the path crosses node 3's line (mid-deck)
    const zc = at(3, 0)[1], i = r.path.findIndex((p, k) => k > 0 && (r.path[k - 1][1] - zc) * (p[1] - zc) <= 0)
    const a = r.path[i - 1], b = r.path[i], f = (zc - a[1]) / (b[1] - a[1] || 1), mid = [a[0] + (b[0] - a[0]) * f, zc]
    const [cx] = at(3, 0)
    const off = Math.abs(mid[0] - cx)
    // a truck's side (1.3 m) stays clear of the kerb columns (0.5 in, 0.3 half) — DECK.margin covers the graph's whole-metre points
    expect(off).toBeGreaterThan(0.5); expect(off + 1.3).toBeLessThan(9.9 / 2 - 0.5 - 0.3) // measured from the true centreline
  })
  it('no route through a waypoint off the graph', () => {
    expect(driveRide(bin, { ...drive, waypoints: [drive.waypoints[0], { name: 'Nowhere', at: [99999, 99999, 0] }] })).toBeNull()
  })
  it('simplify3 keeps a ramp knee', () => {
    const pts = [[0, 0, 0], [50, 0, -4], [100, 0, -4], [150, 0, -4]]
    expect(simplify3(pts, 0.25)).toEqual([[0, 0, 0], [50, 0, -4], [150, 0, -4]])
  })
  it('the curated Lower Wacker drive names Columbus, Lower Wacker and Lake St', () => {
    const d = DRIVES.find((x) => x.id === 'lower-wacker')
    expect(d.waypoints[0].name).toMatch(/Columbus/); expect(d.waypoints.at(-1).name).toMatch(/Lake St/)
    expect(d.waypoints.filter((p) => p.at[2] < -4).length).toBeGreaterThanOrEqual(3)
  })
})

describe('a bascule lower deck (Lower Michigan across DuSable) is driven at the lower level', () => {
  it('joins the lower street on both banks at LOWER_Y', () => {
    const r2 = [
      w(20, [0, 1], { highway: 'tertiary', name: 'North Lower Michigan Avenue', tunnel: 'yes', layer: '0', oneway: 'yes' }),
      w(21, [1, 2], { highway: 'tertiary', name: 'North Lower Michigan Avenue', bridge: 'movable', layer: '1', level: '-1', oneway: 'yes' }),
      w(22, [2, 3], { highway: 'tertiary', name: 'North Lower Michigan Avenue', tunnel: 'yes', layer: '-1', oneway: 'yes' }),
    ]
    const lp = lowerProfile({ roads: r2, levels: L }), g = buildRoadGraph(r2, project, lp)
    const deck = g.edges.find((e) => Math.abs(e.pts[0][1] - project(LON, lat(1))[1]) < 1)
    expect(deck.w).toBeGreaterThan(0)
    expect(deck.pts.every((p) => Math.abs(p[2] - (L.LOWER_Y - MOUTH_Y)) < 0.01)).toBe(true)
    // one chain: the three edges share their nodes
    const ends = g.edges.flatMap((e) => [e.a, e.b])
    expect(new Set(ends).size).toBe(4)
  })
})
