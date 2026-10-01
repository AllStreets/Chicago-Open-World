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

describe('closed breakwater loops (harbour outlines)', () => {
  it('a closed loop around a whole harbour is a wall along its outline, not a slab over the water', () => {
    const loop = [[0, 0], [500, 0], [500, -500], [0, -500], [0, 0]]
    const [b] = breakwaterBuildings([{ id: 9, points: loop, tags: { man_made: 'breakwater' } }])
    expect(b.polygons[0].holes.length).toBe(1)
    const outerA = Math.abs(signedArea(b.polygons[0].outer)), holeA = Math.abs(signedArea(b.polygons[0].holes[0]))
    expect(outerA - holeA).toBeLessThan(500 * 4 * BREAKWATER.width * 1.2)
  })
})

describe('D1-1: the river at RIVER_Y, closed by its dockwalls', async () => {
  const { sunkWater, wallRuns, wallMesh } = await import('../lib/riverLevel.js')
  const { readFileSync } = await import('node:fs')
  const RIVER_Y = JSON.parse(readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8')).levels.RIVER_Y
  const river = { outer: [[0, 0], [300, 0], [300, 50], [0, 50]], holes: [], tags: { natural: 'water', water: 'river' } }
  const pond = { outer: [[0, 200], [40, 200], [40, 240], [0, 240]], holes: [], tags: { natural: 'water', water: 'pond' } }
  const sunk = sunkWater([river, pond])
  it('the river system draws at RIVER_Y; ponds, harbours and the lake stay where they were', () => {
    const m = waterLayer([river, pond], (p) => (sunk.includes(p) ? RIVER_Y : 0.04))
    const ys = new Set(m.positions.filter((_, i) => i % 3 === 1))
    expect(ys).toEqual(new Set([RIVER_Y, 0.04]))
    expect(m.extra.CALM.length).toBe(m.positions.length / 3)
  })
  it('the wall quads close every land–river edge, from the street down past the water', () => {
    const runs = wallRuns({ water: sunk, riverY: RIVER_Y })
    const walled = runs.reduce((s, r) => s + Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]), 0)
    expect(walled).toBeCloseTo(700, 6) // the whole perimeter of the river polygon
    const m = wallMesh(runs), ys = m.positions.filter((_, i) => i % 3 === 1)
    expect(Math.max(...ys)).toBe(0); expect(Math.min(...ys)).toBeLessThan(RIVER_Y)
  })
})

