// pipeline/tests/water.test.js
import { describe, it, expect } from 'vitest'
import { CALM, calmFor, keepWater, waterLayer, strokeRing, breakwaterBuildings, BREAKWATER } from '../lib/water.js'
import { signedArea } from '../lib/geom.js'
import { STYLE } from '../lib/venue.js'

const sq = (x) => [[x, 0], [x + 10, 0], [x + 10, -10], [x, -10]]

describe('calm factor (B.2)', () => {
  it('rivers and canals 0.6; harbours, lagoons and ponds 0.35; the open lake 1.0', () => {
    expect(calmFor({ water: 'river' })).toBe(0.6)
    expect(calmFor({ water: 'canal' })).toBe(0.6)
    expect(calmFor({ waterway: 'canal', area: 'yes' })).toBe(0.6)
    expect(calmFor({ water: 'harbour' })).toBe(0.35)
    expect(calmFor({ natural: 'water', water: 'lagoon' })).toBe(0.35)
    expect(calmFor({ natural: 'water', water: 'pond' })).toBe(0.35)
    expect(CALM.lake).toBe(1)
  })
  it('drops fountains and Lake Michigan itself (the lake mesh is baked separately)', () => {
    expect(keepWater({ natural: 'water', water: 'fountain' })).toBe(false)
    expect(keepWater({ natural: 'water', name: 'Lake Michigan' })).toBe(false)
    expect(keepWater({ water: 'harbour', name: 'Monroe Harbor' })).toBe(true)
  })
  it('the water layer carries one calm value per vertex', () => {
    const m = waterLayer([{ outer: sq(0), holes: [], tags: { water: 'river' } }, { outer: sq(20), holes: [], tags: { water: 'harbour' } }], 0.04)
    expect(m.extra.CALM).toBeInstanceOf(Float32Array)
    expect(m.extra.CALM.length).toBe(m.positions.length / 3)
    expect(m.extra.CALM[0]).toBeCloseTo(0.6, 5)
    expect(m.extra.CALM[m.extra.CALM.length - 1]).toBeCloseTo(0.35, 5)
    expect(new Set(m.positions.filter((_, i) => i % 3 === 1))).toEqual(new Set([0.04]))
  })
})

describe('breakwaters (B7)', () => {
  it('a mapped line becomes a 6 m wide concrete footprint, 1.8 m above the water', () => {
    expect(Math.abs(signedArea(strokeRing([[0, 0], [100, 0]], 3)))).toBeCloseTo(600, 6)
    const [b] = breakwaterBuildings([{ id: 42, points: [[0, 0], [100, 0]], tags: { man_made: 'breakwater' } }])
    expect(b.id).toBe('bw42')
    expect(b.pieces[0]).toMatchObject({ base: 0, top: BREAKWATER.top })
    expect(b.facadeOverride).toBe('wall')
    expect(b.seedOverride).toBe(STYLE.wall.concrete)
    expect(b.noParapet).toBe(true)
  })
  it('a closed way is its own footprint', () => {
    const ring = [[0, 0], [20, 0], [20, -8], [0, -8], [0, 0]]
    const [b] = breakwaterBuildings([{ id: 7, points: ring, tags: {} }])
    expect(Math.abs(signedArea(b.polygons[0].outer))).toBeCloseTo(160, 6)
  })
})
