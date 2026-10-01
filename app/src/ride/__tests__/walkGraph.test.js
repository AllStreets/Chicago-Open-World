// app/src/ride/__tests__/walkGraph.test.js — walks re-routed over the walk graph when it is in the world (P7 Task 4).
import { describe, it, expect } from 'vitest'
import { parseWalkGraph, routeOnGraph, routeLeg } from '../walkGraph.js'

// a square path 0-1-2-3 (100 m sides) with a bent edge 0→1 through (50, -20), and a long way round 0-3-2
const g = parseWalkGraph({
  nodes: [0, 0, 100, 0, 100, 100, 0, 100],
  edges: [0, 1, 0, 110, 1, 50, -20, 1, 2, 0, 100, 0, 2, 3, 0, 100, 0, 3, 0, 0, 100, 0],
})

describe('walk graph', () => {
  it('parses nodes and both directions of every edge', () => {
    expect(g.n).toBe(4); expect(g.adj[0].map((e) => e.to).sort()).toEqual([1, 3]); expect(g.adj[1].find((e) => e.to === 0).pts).toEqual([[50, -20]])
  })
  it('routes the shortest way, through each edge’s bends, from waypoint to waypoint', () => {
    expect(routeLeg(g, [2, 3], [98, 2])).toEqual([[2, 3], [0, 0], [50, -20], [100, 0], [98, 2]])
    const r = routeOnGraph(g, [[0, 0], [100, 0], [100, 100]])
    expect(r[0]).toEqual([0, 0]); expect(r.at(-1)).toEqual([100, 100]); expect(r).toContainEqual([50, -20])
  })
  it('a waypoint far from the graph keeps the straight curated line (Mag Mile sidewalks are not in it)', () => {
    expect(routeLeg(g, [500, 500], [0, 0])).toEqual([[500, 500], [0, 0]])
    expect(routeLeg(null, [1, 1], [2, 2])).toEqual([[1, 1], [2, 2]])
  })
  it('a malformed file is no graph', () => {
    expect(parseWalkGraph(null)).toBeNull(); expect(parseWalkGraph({ nodes: [] })).toBeNull()
  })
})
