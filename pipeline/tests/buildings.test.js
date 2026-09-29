import { describe, it, expect } from 'vitest'
import { normalizeFootprint, attachOsmHeights, applyBuildingParts, hashSeed } from '../lib/buildings.js'
import { keepsShapeAtDistance } from '../lib/buildings.js'
import { unproject } from '../../shared/project.js'

// Build a Socrata-like MultiPolygon from world-metre rings.
const ll = (ring) => [...ring, ring[0]].map(([x, z]) => unproject(x, z))
const row = (polys, extra = {}) => ({
  bldg_id: '1', bldg_statu: 'ACTIVE', stories: '10', year_built: '1920',
  bldg_name1: 'TEST BLDG', f_add1: '100', t_add1: '120', pre_dir1: 'N', st_name1: 'STATE', st_type1: 'ST',
  the_geom: { type: 'MultiPolygon', coordinates: polys.map((rings) => rings.map(ll)) },
  ...extra,
})
const sq = (x, z, s) => [[x, z], [x + s, z], [x + s, z - s], [x, z - s]]

describe('normalizeFootprint', () => {
  it('parses metadata, height, area and centroid', () => {
    const b = normalizeFootprint(row([[sq(0, 0, 20)]]))
    expect(b.id).toBe('1')
    expect(b.name).toBe('Test Bldg')
    expect(b.address).toBe('100 N State St')
    expect(b.year).toBe(1920)
    expect(b.height).toBeCloseTo(38)
    expect(b.area).toBeCloseTo(400, 0)
    expect(b.centroid[0]).toBeCloseTo(10, 0)
  })
  it('keeps every part of a multipart footprint and its holes', () => {
    const b = normalizeFootprint(row([[sq(0, 0, 20), sq(5, -5, 5)], [sq(100, 0, 10)]]))
    expect(b.polygons).toHaveLength(2)
    expect(b.polygons[0].holes).toHaveLength(1)
    expect(b.area).toBeCloseTo(400 - 25 + 100, 0)
  })
  it('drops tiny and inactive footprints', () => {
    expect(normalizeFootprint(row([[sq(0, 0, 3)]]))).toBeNull()
    expect(normalizeFootprint(row([[sq(0, 0, 20)]], { bldg_statu: 'DEMOLISHED' }))).toBeNull()
  })
  it('treats year 0 and missing names as null', () => {
    const b = normalizeFootprint(row([[sq(0, 0, 20)]], { year_built: '0', bldg_name1: '' }))
    expect(b.year).toBeNull(); expect(b.name).toBeNull()
  })
})

describe('OSM joins', () => {
  it('attachOsmHeights overrides height for the containing building only', () => {
    const a = normalizeFootprint(row([[sq(0, 0, 20)]]))
    const b = normalizeFootprint(row([[sq(100, 0, 20)]], { bldg_id: '2' }))
    attachOsmHeights([a, b], [{ center: [10, -10], tags: { height: '124' } }])
    expect(a.height).toBe(124)
    expect(b.height).toBeCloseTo(38)
  })
  it('applyBuildingParts replaces a fully covered footprint', () => {
    const a = normalizeFootprint(row([[sq(0, 0, 20)]]))
    applyBuildingParts([a], [
      { outer: sq(0, 0, 20), holes: [], center: [10, -10], tags: { height: '200' } },
      { outer: sq(5, -5, 10), holes: [], center: [10, -10], tags: { height: '300', min_height: '200' } },
    ])
    expect(a.parts).toHaveLength(2)
    expect(a.parts[1]).toMatchObject({ base: 200, top: 300 })
    expect(a.height).toBe(0)
  })
  it('keeps a podium (never taller than itself) when parts cover < 80% of the footprint', () => {
    const a = normalizeFootprint(row([[sq(0, 0, 20)]]))
    applyBuildingParts([a], [{ outer: sq(0, 0, 5), holes: [], center: [2, -2], tags: { height: '90' } }])
    expect(a.parts).toHaveLength(1)
    expect(a.height).toBeCloseTo(38)
  })
})

describe('untagged parts', () => {
  it('a part with no height or levels inherits the building height (not a 10 m default)', () => {
    const a = normalizeFootprint(row([[sq(0, 0, 20)]]))
    a.height = 257
    applyBuildingParts([a], [{ outer: sq(0, 0, 20), holes: [], center: [10, -10], tags: { 'building:part': 'yes' } }])
    expect(a.parts[0].top).toBe(257)
  })
})

describe('hashSeed', () => {
  it('is deterministic and in [0,1)', () => {
    expect(hashSeed('358897')).toBe(hashSeed('358897'))
    expect(hashSeed('a')).not.toBe(hashSeed('b'))
    expect(hashSeed('x')).toBeGreaterThanOrEqual(0); expect(hashSeed('x')).toBeLessThan(1)
  })
})

describe('distance detail', () => {
  it('landmarks, part-built towers, shaped churches and skyline-corrected towers keep their pieces at LOD1', () => {
    expect(keepsShapeAtDistance({ hero: 'willis' })).toBe(true)
    expect(keepsShapeAtDistance({ parts: [{}] })).toBe(true)
    expect(keepsShapeAtDistance({ sacred: true })).toBe(true)
    expect(keepsShapeAtDistance({ skylineFixed: true })).toBe(true)
    expect(keepsShapeAtDistance({})).toBe(false)
  })
})

import { lod1Pieces } from '../lib/buildings.js'
import { extrudeBuilding } from '../lib/extrude.js'

describe('LOD1 courtyards (H1)', () => {
  const b = { height: 20, polygons: [{ outer: [[0, 0], [40, 0], [40, -40], [0, -40]], holes: [[[10, -10], [30, -10], [30, -30], [10, -30]]] }] }
  it('carries the holes through simplification', () => {
    const [p] = lod1Pieces(b)
    expect(p.holes).toHaveLength(1)
    expect(p).toMatchObject({ base: 0, top: 20 })
  })
  it('no roof triangle covers the open courtyard', () => {
    const m = extrudeBuilding(lod1Pieces(b)[0])
    const inTri = ([px, pz], a, c, d) => {
      const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1])
      const d1 = s([px, pz], a, c), d2 = s([px, pz], c, d), d3 = s([px, pz], d, a)
      return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
    }
    const P = m.positions
    for (let i = 0; i < P.length; i += 9) {
      if (m.normals[i + 1] < 0.99) continue // roof triangles only
      expect(inTri([20, -20], [P[i], P[i + 2]], [P[i + 3], P[i + 5]], [P[i + 6], P[i + 8]])).toBe(false)
    }
  })
})
