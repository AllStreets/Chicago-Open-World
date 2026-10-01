// pipeline/tests/walkPaths.test.js — walking paths drawn by surface, cut out of buildings, and the walk graph (2026-09-30).
import { describe, it, expect } from 'vitest'
import { pathSurface, clipOutside, pathHalfWidth } from '../lib/paving.js'
import { buildWalkGraph, encodeWalkGraph, isWalkable } from '../lib/walkGraph.js'
import { overpassQuery, FETCH_KINDS } from '../lib/sources.js'

describe('walking paths', () => {
  it('draws each path in its surface: blacktop trails, crushed gravel, brick, concrete', () => {
    expect(pathSurface({ highway: 'cycleway', name: 'Lakefront Trail' })).toBe('asphalt')
    expect(pathSurface({ highway: 'path', surface: 'fine_gravel' })).toBe('gravel')
    expect(pathSurface({ highway: 'footway', surface: 'paving_stones' })).toBe('brick')
    expect(pathSurface({ highway: 'footway' })).toBe('concrete')
    expect(pathSurface({ highway: 'pedestrian', surface: 'asphalt' })).toBe('asphalt')
  })
  it("doesn't draw street sidewalks, crossings, indoor or underground ways, bridges, or grass tracks", () => {
    for (const t of [{ footway: 'sidewalk' }, { footway: 'crossing' }, { indoor: 'yes' }, { tunnel: 'yes' }, { layer: '-1' }, { bridge: 'yes' }, { surface: 'grass' }])
      expect(pathSurface({ highway: 'footway', ...t }), JSON.stringify(t)).toBeNull()
    expect(pathSurface({ highway: 'residential' })).toBeNull()
    expect(pathHalfWidth({ highway: 'cycleway' })).toBeGreaterThan(pathHalfWidth({ highway: 'footway' }))
  })
  it('cuts a path where it runs through a building, keeping its own vertices', () => {
    const inside = ([x]) => x > 40 && x < 60 // a building across x = 40…60
    const runs = clipOutside([[0, 0], [100, 0]], inside)
    expect(runs.length).toBe(2)
    expect(runs[0][0]).toEqual([0, 0]); expect(runs[0].at(-1)[0]).toBeLessThanOrEqual(40)
    expect(runs[1][0][0]).toBeGreaterThanOrEqual(60); expect(runs[1].at(-1)).toEqual([100, 0])
    expect(runs.every((r) => r.length === 2)).toBe(true) // no densified points left behind
    expect(clipOutside([[0, 0], [30, 0]], inside)).toEqual([[[0, 0], [30, 0]]])
  })
  it('trails join the world fetch', () => {
    expect(overpassQuery('trails', { s: 41.8, w: -87.7, n: 41.9, e: -87.6 })).toContain('cycleway')
    expect(FETCH_KINDS.trails).toBeTruthy()
  })
})

describe('walk graph', () => {
  const project = (lon, lat) => [lon * 100, lat * 100]
  const way = (id, nodes, tags) => ({ type: 'way', id, nodes, tags, geometry: nodes.map((n) => ({ lon: n, lat: 0 })) })
  it('splits at shared nodes, keeps bridges walkable, and records surface and length', () => {
    const g = buildWalkGraph([way(1, [1, 2, 3], { highway: 'cycleway' }), way(2, [2, 4], { highway: 'footway', bridge: 'yes', surface: 'concrete' }), way(3, [5, 6], { highway: 'residential' })], project)
    expect(g.edges.length).toBe(3)
    expect(g.edges.map((e) => Math.round(e.len))).toEqual([100, 100, 200])
    expect(isWalkable({ highway: 'footway', access: 'private' })).toBe(false)
    const enc = encodeWalkGraph(g)
    expect(enc.surfaces).toEqual(['concrete', 'asphalt', 'gravel', 'brick'])
    expect(enc.nodes.length).toBe(8)
    expect(enc.edges.slice(0, 5)).toEqual([0, 1, 1, 100, 0]) // a, b, asphalt, 100 m, no interior points
  })
})
