// pipeline/tests/zoo.test.js — Lincoln Park Zoo (Workstream B): the zoo's builders live in zoo.js (B-1).
import { describe, it, expect } from 'vitest'
import { ZOO_BUILDERS } from '../lib/zoo.js'
import { buildLandmark } from '../lib/landmarks.js'

const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
const B = (outer, o = {}) => ({ id: 't', height: 11, polygons: [{ outer, holes: [] }], centroid: [(outer[0][0] + outer[2][0]) / 2, (outer[0][1] + outer[2][1]) / 2], area: Math.abs((outer[2][0] - outer[0][0]) * (outer[2][1] - outer[0][1])), ...o })

import { readFileSync } from 'node:fs'
import { cafeBrauer, honeycombVault, natureBoardwalk } from '../lib/zoo.js'
import { setSiteLookup } from '../lib/parkkit.js'
const heroes = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes
const rows = [...JSON.parse(readFileSync(new URL('../data/styles.json', import.meta.url), 'utf8')).styles, ...JSON.parse(readFileSync(new URL('../data/styles-lincolnpark.json', import.meta.url), 'utf8')).styles]
const pts = (ms) => ms.flatMap((m) => { const o = []; for (let i = 0; i < m.mesh.positions.length; i += 3) o.push(m.mesh.positions.slice(i, i + 3)); return o })
const part = (r, p) => r.meshes.filter((m) => m.part === p)
const hi = (a) => a.reduce((m, v) => Math.max(m, v), -Infinity)
const tris = (r) => r.meshes.reduce((n, m) => n + m.mesh.positions.length / 9, 0)

describe('Café Brauer (Perkins, 1908) — B-3', () => {
  const h = heroes.find((x) => x.key === 'cafebrauer')
  // its OSM outline, local about the bbox centre
  const outline = [[-21.7, 4.0], [-16.5, -16.7], [-7.3, -14.5], [-0.3, -17.5], [2.8, -23.0], [6.8, -25.8], [5.5, -29.2], [15.0, -34.3], [20.6, -23.6], [21.7, -21.5], [12.7, -16.7], [11.7, -7.7], [7.4, 10.2], [0.2, 14.4], [1.1, 19.3], [4.1, 18.2], [9.6, 27.1], [-2.5, 34.3], [-8.2, 24.9], [-7.6, 12.1], [-13.5, 10.5], [-12.7, 6.3]]
  const r = cafeBrauer(B(outline), h.landmark)
  it('the Great Hall, two end pavilions and the loggias joining them, traced from the OSM outline', () => {
    expect(h.match.osmId).toBe('w24826112')
    expect(h.landmark.parts.map((p) => p.kind)).toEqual(['hall', 'pavilion', 'loggia', 'pavilion', 'loggia'])
    for (const p of ['walls', 'trim', 'windows', 'roof', 'flat-roof']) expect(part(r, p).length, p).toBe(1)
    expect(part(r, 'walls')[0].facade).toBe(34) // brick
  })
  it('green tile hipped roofs (a sourced row), the hall two storeys over one-storey loggias', () => {
    const roof = part(r, 'roof')[0]
    expect(roof.style).toBe('lp-tile-green')
    expect(rows.find((x) => x.key === 'lp-tile-green').source).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\/Caf/)
    expect(hi(pts([roof]).map((q) => q[1]))).toBeGreaterThan(13)
    expect(hi(pts(part(r, 'flat-roof')).map((q) => q[1]))).toBeLessThan(5.1)
    expect(tris(r)).toBeLessThan(15000)
  })
})

describe('the Nature Boardwalk pavilion (Studio Gang, 2010) — B-3', () => {
  it('a honeycomb lattice: whole hexagonal cells, each edge shared, pods only along the crown', () => {
    const v = honeycombVault({ c: [0, 0], u: [1, 0], L: 13.5, span: 9.4, H: 5.5, cell: 1.25 })
    expect(v.cells).toBeGreaterThanOrEqual(24)
    // a hexagonal net: fewer than 6 edges a cell (they are shared), more than 2.5 (it is connected)
    expect(v.edges).toBeLessThan(6 * v.cells); expect(v.edges).toBeGreaterThan(2.5 * v.cells)
    expect(v.crownCells).toBeGreaterThan(8); expect(v.crownCells).toBeLessThan(v.cells)
    expect(v.ribs.positions.length / 9).toBe(v.edges * 8) // a four-sided rib per edge
  })
  it('stands on its OSM outline at ≈ 5.5 m, the pods fibreglass and the ribs laminated wood', () => {
    setSiteLookup({ water: () => [] })
    const h = heroes.find((x) => x.key === 'natureboardwalk')
    expect(h.match.osmId).toBe('w186667195')
    const rr = natureBoardwalk(B([[0, 0], [13.5, 0], [13.5, 9.4], [0, 9.4]]), h.landmark)
    expect(Math.abs(hi(pts(part(rr, 'ribs')).map((q) => q[1])) - 5.5)).toBeLessThan(0.3)
    expect(part(rr, 'pods')[0].style).toBe('lp-pod'); expect(part(rr, 'ribs')[0].style).toBe('boardwalk-wood')
    for (const [x, , z] of pts(part(rr, 'ribs'))) { expect(x).toBeGreaterThan(-0.3); expect(x).toBeLessThan(13.8); expect(z).toBeGreaterThan(-0.3); expect(z).toBeLessThan(9.7) }
  })
})

import { buildLandmark as build } from '../lib/landmarks.js'
import { project } from '../../shared/project.js'
import { offsetRing } from '../lib/parkkit.js'
import { pointInRing } from '../lib/geom.js'
describe('the zoo houses, habitats and farm (B-4)', () => {
  const zooKeys = ['lincolnparkzoo', 'primatehouse', 'birdhouse', 'apescenter', 'smallmammal', 'africanjourney', 'birdsofprey', 'macaqueforest', 'penguincove', 'childrenszoo', 'zooadmin', 'zoohospital', 'visitorcenter', 'carousel', 'sealionpool', 'mainbarn', 'dairybarn', 'livestockbarn', 'holdingbarn', 'farmhouse']
  const L = (k) => heroes.find((h) => h.key === k)
  it('each is a hero with ⌘K aliases, sources and a note that says what is approximate', () => {
    for (const k of zooKeys) {
      const h = L(k)
      expect(h, k).toBeTruthy()
      expect(h.aliases.length, k).toBeGreaterThan(0)
      expect(h.sources.some((s) => s.startsWith('https://')), k).toBe(true)
      expect(h.landmark.note, k).toMatch(/approximate|sources/)
    }
    for (const q of ['Lion House', 'Farm-in-the-Zoo', 'penguins', 'Sea Lion Pool', 'Primate House', 'Bird House', 'Carousel']) expect(zooKeys.some((k) => L(k).aliases.includes(q)), q).toBe(true)
  })
  // every part stays on its outline: nothing beyond the footprint but eaves (≤ 1.7 m), and nothing floats
  const outline = { brickHouse: [[0, 0], [40, 0], [40, 24], [0, 24]], modernPavilion: [[0, 0], [50, 0], [56, 20], [0, 30]], meshHabitat: [[0, 0], [12, 0], [12, 8], [0, 8]], rockHabitat: [[0, 0], [17, 0], [17, 12], [0, 12]], barn: [[0, 0], [30, 0], [30, 20], [0, 20]], carousel: [[0, 0], [32, 0], [32, 32], [0, 32]], lionHouse: [[0, 0], [66, 0], [66, 20], [40, 24], [26, 24], [0, 20]] }
  for (const [type, ring] of Object.entries(outline)) {
    it(`${type}: every part on the outline (eaves aside), within budget`, () => {
      const spec = { ...(heroes.find((h) => h.landmark?.type === type)?.landmark ?? {}), roofs: undefined, silo: undefined }
      const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length, cz = ring.reduce((a, p) => a + p[1], 0) / ring.length
      const r = build({ id: 't', height: 8, polygons: [{ outer: ring, holes: [] }], centroid: [cx, cz], area: 1 }, { ...spec, type })
      const grown = offsetRing(ring, 1.8), porch = offsetRing(ring, 5) // a portico stands out from its wall
      for (const m of r.meshes) for (const [x, y, z] of pts([m])) { expect(pointInRing([x, z], m.part === 'portico' ? porch : grown), `${type} ${m.part} ${x.toFixed(1)},${z.toFixed(1)}`).toBe(true); expect(y).toBeGreaterThan(-0.5) }
      expect(tris(r)).toBeLessThan(15000)
    })
  }
  it('the Farm-in-the-Zoo main barn: red walls, white trim, gambrel roof, the silo where the outline rounds it', () => {
    const h = L('mainbarn'), ring = [[-16, -19], [16, -19], [16, 0.6], [8.7, 0.6], [8.8, 19], [-9, 19], [-9, -1.9], [-16, -4]]
    const r = build({ id: 't', height: 5, polygons: [{ outer: ring, holes: [] }], centroid: [0, 0], area: 1 }, h.landmark)
    expect(part(r, 'walls')[0].style).toBe('lp-barn-red'); expect(part(r, 'trim')[0].style).toBe('lp-trim-white')
    const silo = pts(part(r, 'silo')), cb = [0, 0]
    expect(hi(silo.map((q) => q[1]))).toBeCloseTo(12, 1)
    for (const [x, , z] of silo) expect(Math.hypot(x - (cb[0] - 10.7), z - (cb[1] + 2.6))).toBeLessThan(2.4)
  })
  it('the Sea Lion Pool sits west of the Lion House, the carousel ring is open (columns, no walls)', () => {
    const sl = L('sealionpool').match, lh = project(-87.63332, 41.92128)
    expect(project(sl.lon, sl.lat)[0]).toBeLessThan(lh[0] - 50)
    const r = build({ id: 't', height: 5, polygons: [{ outer: outline.carousel, holes: [] }], centroid: [16, 16], area: 1 }, L('carousel').landmark)
    expect(part(r, 'columns').length).toBe(1); expect(r.meshes.some((m) => m.part === 'walls')).toBe(false)
  })
})

describe('zoo.js (B-1)', () => {
  it('routes the Lion House through the zoo module', () => {
    expect(Object.keys(ZOO_BUILDERS)).toContain('lionHouse')
    const r = buildLandmark(B(rect(0, 0, 66, 25)), { type: 'lionHouse', roofRise: 5 })
    expect(r.meshes.length).toBeGreaterThan(0)
  })
})
