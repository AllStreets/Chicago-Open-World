import { describe, it, expect } from 'vitest'
import { findGaps, closeGaps, openStorey, auditGap, trisOf, GAP } from '../lib/gaps.js'
import { extrudeBuilding } from '../lib/extrude.js'

const sq = (s, o = [0, 0]) => [[o[0], o[1]], [o[0] + s, o[1]], [o[0] + s, o[1] + s], [o[0], o[1] + s]]
const L = [[0, 0], [30, 0], [30, 12], [12, 12], [12, 30], [0, 30]]
const body = (pieces) => pieces.flatMap((p) => trisOf(extrudeBuilding(p)))
const ys = (m) => m.positions.filter((_, i) => i % 3 === 1)

// user, 2026-10-02: an open storey "cannot have an invisible interior and it needs … flat steel rods that show that
// the building is still being held up"
const CASES = {
  'a box over a box (blow-through)': [{ outer: sq(25), holes: [], base: 0, top: 40 }, { outer: sq(25), holes: [], base: 47, top: 120 }],
  'an L-shaped open storey (a reflex corner)': [{ outer: L, holes: [], base: 0, top: 40 }, { outer: L, holes: [], base: 47, top: 120 }],
  'a building on stilts': [{ outer: sq(25), holes: [], base: 6, top: 30 }],
  'a ring around a core (Marina City)': [{ outer: sq(30), holes: [], base: 0, top: 45 }, { outer: sq(26, [2, 2]), holes: [], base: 55, top: 160 }, { outer: sq(20, [5, 5]), holes: [], base: 0, top: 170 }],
  'a leaning frustum stack': null,
}

describe('open storeys: found', () => {
  it('a gap between two volumes, its height and region', () => {
    const g = findGaps(CASES['a box over a box (blow-through)'])
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ y0: 40, y1: 47, kind: 'storey' })
    expect(g[0].area).toBeCloseTo(625, 0)
  })
  it('a ring around a core: only the ring, opening from the podium roof', () => {
    const g = findGaps(CASES['a ring around a core (Marina City)'])
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ y0: 45, y1: 55, kind: 'storey' })
    expect(g[0].area).toBeCloseTo(26 * 26 - 400, 0)
    expect(g[0].holes).toHaveLength(1)
  })
  it('a piece resting on the one below, a seam under GAP.minH and a rooftop box are no gap', () => {
    expect(findGaps([{ outer: sq(20), holes: [], base: 0, top: 40 }, { outer: sq(20), holes: [], base: 40, top: 80 }])).toEqual([])
    expect(findGaps([{ outer: sq(20), holes: [], base: 0, top: 40 }, { outer: sq(20), holes: [], base: 40 + GAP.minH * 0.8, top: 80 }])).toEqual([])
    expect(findGaps([{ outer: sq(20), holes: [], base: 0, top: 40 }, { outer: sq(5, [5, 5]), holes: [], base: 40, top: 45 }])).toEqual([])
  })
  it('an OSM roof part over open ground is a canopy; a sliver is continuous façade', () => {
    expect(findGaps([{ outer: sq(10), holes: [], base: 0, top: 13 }, { outer: sq(10, [20, 0]), holes: [], base: 0, top: 13 }, { outer: sq(30), holes: [], base: 12, top: 13, role: 'roof' }])[0].kind).toBe('canopy')
    expect(findGaps([{ outer: sq(20), holes: [], base: 0, top: 40 }, { outer: [[0, 0], [21.5, 0], [21.5, 20], [0, 20]], holes: [], base: 40, top: 80 }]).map((g) => [g.kind, g.y0])).toEqual([['overhang', 0]]) // a 1.5 m ledge at 40 m: a soffit, open air below
    const strip = findGaps([{ outer: sq(20), holes: [], base: 0, top: 40 }, { outer: [[20, 0], [22, 0], [22, 20], [20, 20]], holes: [], base: 0, top: 30 }, { outer: [[0, 0], [22, 0], [22, 20], [0, 20]], holes: [], base: 40, top: 80 }])
    expect(strip.map((g) => [g.kind, g.y0])).toEqual([['facade', 30]]) // a 2 m sliver between two volumes: continuous façade
    const sliver = findGaps([{ outer: sq(20), holes: [], base: 0, top: 30 }, { outer: [[0, 0], [22, 0], [22, 20], [0, 20]], holes: [], base: 40, top: 80 }])
    expect(sliver.map((g) => [g.kind, g.y0])).toEqual([['storey', 30]]) // one region, opening from the lower roof
  })
})

describe('open storeys: closed — slabs, a dark core and steel at the perimeter, never see-through', () => {
  for (const [name, pieces] of Object.entries(CASES)) {
    if (!pieces) continue
    it(name, () => {
      const { gaps, meshes } = closeGaps(pieces)
      expect(gaps.length).toBeGreaterThan(0)
      const open = auditGap(body(pieces), gaps[0])
      expect(open.through + open.hollow).toBeGreaterThan(0) // the audit sees the bare gap
      // every closing mesh is kept at LOD1 and in the blocks
      expect(meshes.every((m) => m.lod0Only === false)).toBe(true)
      const core = meshes.find((m) => m.part === 'gap-core'), steel = meshes.find((m) => m.part === 'gap-steel')
      expect(core.style).toBe('gap-core'); expect(steel.style).toBe('gap-steel')
      // the soffit faces down at the top of the gap; plates every ≤ 6 m round the perimeter, each the full storey
      const g = gaps[0], down = []
      for (let i = 0; i < core.positions.length; i += 9) if ([1, 4, 7].every((k) => Math.abs(core.positions[i + k] - g.y1) < 1e-6)) down.push(core.normals[i + 1])
      expect(down.length).toBeGreaterThan(0); expect(down.every((n) => n < -0.99)).toBe(true)
      expect(Math.min(...ys(steel))).toBeCloseTo(g.y0, 6); expect(Math.max(...ys(steel))).toBeCloseTo(g.y1, 6)
      const perim = g.outer.reduce((s, p, i) => s + Math.hypot(g.outer[(i + 1) % g.outer.length][0] - p[0], g.outer[(i + 1) % g.outer.length][1] - p[1]), 0)
      expect(steel.positions.length / 9 / 8).toBeGreaterThanOrEqual(perim / 6)
      const closed = auditGap([...body(pieces), ...meshes.flatMap(trisOf)], g)
      expect(closed.rays).toBeGreaterThan(500)
      expect(closed).toMatchObject({ through: 0, hollow: 0 })
    })
  }
  it('a leaning frustum storey (St. Regis): closed to every sight line between the two rings', () => {
    const A = sq(24, [3, 3]), B = sq(27), s = openStorey(A, B, 300, 307.2)
    const tris = [s.slabs, s.core, s.steel, extrudeBuilding({ outer: A, base: 260, top: 300 }), extrudeBuilding({ outer: B, base: 307.2, top: 340 })].flatMap(trisOf)
    expect(auditGap(tris, { outer: sq(20, [5, 5]), holes: [], y0: 300, y1: 307.2, kind: 'storey' })).toMatchObject({ through: 0, hollow: 0 })
  })
  it('a canopy: a soffit and steel posts, nothing hollow underneath', () => {
    const pieces = [{ outer: sq(10), holes: [], base: 0, top: 13 }, { outer: sq(10, [20, 0]), holes: [], base: 0, top: 13 }, { outer: sq(30), holes: [], base: 12, top: 13, role: 'roof' }]
    const { gaps, meshes } = closeGaps(pieces)
    expect(meshes.map((m) => m.part)).toEqual(['gap-soffit', 'gap-posts'])
    expect(auditGap([...body(pieces), ...meshes.flatMap(trisOf)], gaps[0]).hollow).toBe(0)
  })
  it('a cantilever over open ground: only its soffit, facing down', () => {
    const pieces = [{ outer: sq(20), holes: [], base: 0, top: 60 }, { outer: [[0, 0], [28, 0], [28, 20], [0, 20]], holes: [], base: 60, top: 90 }]
    const { gaps, meshes } = closeGaps(pieces)
    expect(gaps.map((g) => g.kind)).toEqual(['overhang'])
    expect(meshes.map((m) => m.part)).toEqual(['gap-soffit'])
    expect(auditGap([...body(pieces), ...meshes.flatMap(trisOf)], gaps[0]).hollow).toBe(0)
    expect(auditGap(body(pieces), gaps[0]).hollow).toBeGreaterThan(0)
  })
  it('a forced façade verdict fills the gap with the building’s own walls', () => {
    const { meshes } = closeGaps(CASES['a box over a box (blow-through)'], { verdict: 'facade' })
    expect(meshes).toHaveLength(1); expect(meshes[0].facade).toBeUndefined()
    expect(Math.min(...ys(meshes[0]))).toBe(40); expect(Math.max(...ys(meshes[0]))).toBe(47)
  })
  it('is lean: a 25 m storey closes in under 250 triangles', () => {
    const { meshes } = closeGaps(CASES['a box over a box (blow-through)'])
    expect(meshes.reduce((n, m) => n + m.positions.length / 9, 0)).toBeLessThan(250)
  })
})
