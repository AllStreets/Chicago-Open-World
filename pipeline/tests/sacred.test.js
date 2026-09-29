import { describe, it, expect } from 'vitest'
import { sacredKind, orientedBox, shapeSacred, SACRED, SACRED_STYLE } from '../lib/sacred.js'

const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
const rotRing = (ring, deg) => { const a = (deg * Math.PI) / 180; return ring.map(([x, z]) => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)]) }
const bldg = (outer, tags = { building: 'church', amenity: 'place_of_worship', religion: 'christian' }, o = {}) =>
  ({ id: 'c1', tags, name: tags.name ?? null, height: 16, parts: null, polygons: [{ outer, holes: [] }], area: 800, centroid: [0, 0], ...o })
const allY = (r) => [...r.pieces.map((p) => p.top), ...r.meshes.flatMap((m) => m.mesh.positions.filter((_, i) => i % 3 === 1))]

describe('sacredKind', () => {
  it('reads building, religion, denomination and name', () => {
    expect(sacredKind({ building: 'church' })).toBe('church')
    expect(sacredKind({ building: 'cathedral', name: 'Holy Name Cathedral' })).toBe('cathedral')
    expect(sacredKind({ building: 'church', amenity: 'place_of_worship', denomination: 'ukrainian_orthodox', name: 'Saint Volodymyr Ukrainian Orthodox Cathedral' })).toBe('orthodox')
    expect(sacredKind({ building: 'mosque', religion: 'muslim' })).toBe('mosque')
    expect(sacredKind({ building: 'synagogue', religion: 'jewish' })).toBe('synagogue')
    expect(sacredKind({ building: 'temple', religion: 'buddhist' })).toBe('temple')
  })
  it('leaves storefront congregations and ordinary buildings alone', () => {
    expect(sacredKind({ building: 'commercial', amenity: 'place_of_worship', religion: 'christian' })).toBe(null)
    expect(sacredKind({ building: 'retail' })).toBe(null)
  })
})

describe('orientedBox', () => {
  it('finds the long axis of a rotated rectangle', () => {
    const o = orientedBox(rotRing(rect(-20, -8, 20, 8), 30))
    expect(o.L).toBeCloseTo(40, 3); expect(o.W).toBeCloseTo(16, 3)
    expect(Math.abs(o.u[0] * Math.cos(Math.PI / 6) + o.u[1] * Math.sin(Math.PI / 6))).toBeCloseTo(1, 3)
  })
})

describe('shapeSacred', () => {
  const nave = rect(-20, -8, 20, 8) // 40 x 16, long axis east-west
  it('church: stone walls to the eave, a gabled roof, and a steepled tower at the street end', () => {
    const r = shapeSacred(bldg(nave), { front: [30, 0] })
    expect(r.facade).toBe('sacred')
    const tower = r.pieces.find((p) => p.part === 'tower')
    const tx = tower.outer.reduce((s, p) => s + p[0], 0) / 4
    expect(tx).toBeGreaterThan(10) // east end, the end nearest the street
    const roof = r.meshes.filter((m) => m.part === 'roof')
    expect(roof.length).toBe(1); expect(roof[0].facade).toBe(SACRED.roofing)
    const spire = r.meshes.find((m) => m.part === 'spire')
    const top = Math.max(...spire.mesh.positions.filter((_, i) => i % 3 === 1))
    expect(top).toBeGreaterThan(tower.top + 10)
    expect(r.noParapet).toBe(true)
  })
  it('cathedral spires rise higher than a parish church', () => {
    const church = Math.max(...allY(shapeSacred(bldg(nave), { front: [30, 0] })))
    const cath = Math.max(...allY(shapeSacred(bldg(nave, { building: 'cathedral', name: 'St. Something Cathedral' }), { front: [30, 0] })))
    expect(cath).toBeGreaterThan(church * 1.15)
  })
  it('orthodox: onion domes instead of a spire', () => {
    const r = shapeSacred(bldg(nave, { building: 'church', denomination: 'ukrainian_greek_catholic', name: 'Saint Nicholas Ukrainian Catholic Cathedral' }), { front: [30, 0] })
    const domes = r.meshes.filter((m) => m.part === 'dome')
    expect(domes.length).toBeGreaterThanOrEqual(5)
    expect(domes.every((m) => [SACRED_STYLE.roofing.gold, SACRED_STYLE.roofing.copper].includes(m.seed))).toBe(true)
    expect(r.meshes.some((m) => m.part === 'spire')).toBe(false)
  })
  it('mosque: a dome and a slender minaret', () => {
    const r = shapeSacred(bldg(nave, { building: 'mosque', religion: 'muslim' }), { front: [30, 0] })
    expect(r.meshes.some((m) => m.part === 'dome')).toBe(true)
    const min = r.pieces.find((p) => p.part === 'minaret') ?? r.meshes.find((m) => m.part === 'minaret')
    expect(min).toBeTruthy()
  })
  it('irregular footprints keep their shape: stone walls and a flat top, no gable', () => {
    const L = [[0, 0], [40, 0], [40, -10], [10, -10], [10, -40], [0, -40]]
    const r = shapeSacred(bldg(L), { front: [50, 0] })
    expect(r.meshes.some((m) => m.part === 'roof')).toBe(false)
    expect(r.pieces[0].outer).toEqual(L)
  })
  it('buildings with mapped parts or real height keep their geometry and only change material', () => {
    const withParts = shapeSacred(bldg(nave, undefined, { parts: [{ outer: nave, holes: [], base: 0, top: 30 }] }), { front: [30, 0] })
    expect(withParts.keepPieces).toBe(true)
    expect(shapeSacred(bldg(nave, { building: 'yes', amenity: 'place_of_worship', religion: 'christian' }, { height: 120 }), { front: [30, 0] })).toBe(null)
  })
})

describe('landmark church overrides', () => {
  const nave = rect(-30, -12, 30, 12)
  it('dome crown: a great dome over the crossing and twin front towers, no spire', () => {
    const r = shapeSacred(bldg(nave), { front: [40, 0], override: { crown: 'dome' } })
    expect(r.meshes.some((m) => m.part === 'spire')).toBe(false)
    const dome = r.meshes.find((m) => m.part === 'dome')
    const xs = dome.mesh.positions.filter((_, i) => i % 3 === 0)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(12)
    expect(r.pieces.filter((p) => p.part === 'tower').length).toBe(2)
  })
  it('tower crown: a square Gothic tower without a spire', () => {
    const r = shapeSacred(bldg(nave), { front: [40, 0], override: { crown: 'tower' } })
    expect(r.pieces.filter((p) => p.part === 'tower').length).toBe(1)
    expect(r.meshes.some((m) => m.part === 'spire')).toBe(false)
  })
})

describe('tagged heights and materials', () => {
  const nave = rect(-25, -10, 25, 10)
  it('a church-typed building with a tall tagged height is shaped, its steeple reaching that height', () => {
    const r = shapeSacred(bldg(nave, undefined, { height: 60, heightSource: 'osm' }), { front: [40, 0] })
    const top = Math.max(...allY(r))
    expect(top).toBeGreaterThan(57); expect(top).toBeLessThan(63)
  })
  it('building:material picks the wall stone', () => {
    const r = shapeSacred(bldg(nave, { building: 'church', 'building:material': 'brick' }), { front: [40, 0] })
    expect(r.seed).toBe(SACRED_STYLE.walls.brick)
    const s = shapeSacred(bldg(nave, { building: 'church', 'building:material': 'stone' }), { front: [40, 0] })
    expect([SACRED_STYLE.walls.limestone, SACRED_STYLE.walls.graystone]).toContain(s.seed)
  })
})

describe('storefront congregations (H5)', () => {
  const shop = rect(-10, -6, 10, 6)
  const tags = { building: 'yes', amenity: 'place_of_worship', religion: 'christian', name: 'Iglesia Pentecostal Monte Sion' }
  it('a building=yes place of worship keeps its plain extrusion', () => {
    expect(sacredKind(tags)).toBe(null)
    expect(shapeSacred(bldg(shop, tags), { front: [20, 0] })).toBe(null)
  })
  it('an explicit sacred.json override still shapes a building=yes church', () => {
    const r = shapeSacred(bldg(rect(-20, -8, 20, 8), { ...tags, name: 'Saint Mary of the Angels' }), { front: [40, 0], override: { crown: 'dome' } })
    expect(r).not.toBe(null)
    expect(r.facade).toBe('sacred')
  })
})
