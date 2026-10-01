// pipeline/tests/conservatory.test.js — B-2: the Lincoln Park Conservatory as four glass houses in a line, a 50 ft
// (15.2 m) Palm House, the formal garden and the Bates Fountain (user: "the same level of attention … as the Wrigley
// and Tribune").
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { glassHouse, conservatoryGrounds } from '../lib/lincolnpark.js'
import { setSiteLookup } from '../lib/parkkit.js'
import { pointInRing } from '../lib/geom.js'
import { project } from '../../shared/project.js'

const heroes = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes
const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
const B = (outer) => ({ id: 't', height: 6, polygons: [{ outer, holes: [] }], centroid: [(outer[0][0] + outer[2][0]) / 2, (outer[0][1] + outer[2][1]) / 2], area: 1 })
const pts = (ms) => ms.flatMap((m) => { const o = []; for (let i = 0; i < m.mesh.positions.length; i += 3) o.push(m.mesh.positions.slice(i, i + 3)); return o })
const part = (r, p) => r.meshes.filter((m) => m.part === p)
const hi = (a) => a.reduce((m, v) => Math.max(m, v), -Infinity)
const tris = (r) => r.meshes.reduce((n, m) => n + m.mesh.positions.length / 9, 0)

describe('the four glass houses (heroes.json)', () => {
  const houses = heroes.filter((h) => h.landmark?.type === 'glassHouse')
  it('Palm House, Fern Room, Show House and Orchid House: four distinct OSM outlines, all inside the conservatory', () => {
    expect(houses.map((h) => h.key).sort()).toEqual(['fernroom', 'orchidhouse', 'palmhouse', 'showhouse'])
    expect(new Set(houses.map((h) => h.match.osmId)).size).toBe(4)
    const cons = heroes.find((h) => h.key === 'conservatory')
    expect(cons.landmark.type).toBe('conservatoryGrounds')
    expect(cons.landmark.houses.slice().sort()).toEqual(houses.map((h) => h.match.osmId).sort())
    for (const h of houses) { expect(h.aliases.length).toBeGreaterThan(0); expect(h.sources.every((s) => s.startsWith('https://'))).toBe(true); expect(h.landmark.note).toMatch(/approximate/) }
  })
  it('the Palm House crown stands at its sourced 50 ft (15.2 m) ± 0.5 m; the other houses well below it', () => {
    const spec = houses.find((h) => h.key === 'palmhouse').landmark
    const r = glassHouse(B(rect(0, 0, 51, 21)), spec)
    const crown = hi(pts(part(r, 'glass')).map((q) => q[1]))
    expect(Math.abs(crown - 15.24)).toBeLessThan(0.5)
    for (const k of ['fernroom', 'showhouse', 'orchidhouse']) {
      const s = houses.find((h) => h.key === k).landmark, top = hi(pts(part(glassHouse(B(rect(0, 0, 30, 17)), s), 'glass')).map((q) => q[1]))
      expect(top, k).toBeLessThan(10)
    }
  })
  it('glass on a stone base, white iron glazing bars proud of it, a finial on each crown; within budget', () => {
    const r = glassHouse(B(rect(0, 0, 40, 16)), { roofs: [{ top: 8 }] })
    for (const p of ['glass', 'ribs', 'base', 'finials']) expect(part(r, p).length, p).toBe(1)
    expect(part(r, 'glass')[0].style).toBe('lp-glasshouse'); expect(part(r, 'ribs')[0].style).toBe('lp-iron-white')
    expect(part(r, 'ribs')[0].lod0Only).toBe(true); expect(part(r, 'glass')[0].lod0Only).toBe(false)
    // nothing outside the footprint by more than the roof's eave rail
    for (const [x, , z] of pts(r.meshes)) { expect(x).toBeGreaterThan(-0.3); expect(x).toBeLessThan(40.3); expect(z).toBeGreaterThan(-0.3); expect(z).toBeLessThan(16.3) }
    expect(tris(r)).toBeLessThan(15000)
  })
})

describe('the conservatory grounds: ranges, formal garden, Bates Fountain', () => {
  const house = rect(0, 0, 20, 20), bed = rect(0, 40, 6, 52)
  setSiteLookup({ building: (ref) => (ref === 'w1' ? { polygons: [{ outer: house, holes: [] }] } : null), green: (id) => (id === 7 ? { outer: bed, holes: [] } : null) })
  const fountain = { lat: 41.92276, lon: -87.63522, radiusM: 6 }
  const r = conservatoryGrounds(B(rect(0, 0, 60, 20)), { houses: ['w1'], garden: { beds: [7] }, fountain })
  it('the propagation ranges fill the outline but never a display house', () => {
    const q = pts(part(r, 'ranges'))
    expect(q.length).toBeGreaterThan(0)
    for (const [x, , z] of q) expect(pointInRing([x, z], rect(0.5, 0.5, 19.5, 19.5))).toBe(false)
    expect(hi(q.map((p) => p[1]))).toBeLessThan(5) // low ranges, ridge-and-furrow
  })
  it('the formal garden: hedged beds; the Bates Fountain: a 12 m granite basin, water, the bronze storks', () => {
    expect(part(r, 'beds').length).toBe(1); expect(part(r, 'hedges').length).toBe(1)
    const c = project(fountain.lon, fountain.lat), basin = pts(part(r, 'basin'))
    const rr = hi(basin.map(([x, , z]) => Math.hypot(x - c[0], z - c[1])))
    expect(Math.abs(rr - 6)).toBeLessThan(0.05)
    expect(part(r, 'water')[0].style).toBe('lp-pool') // unlit at night
    const g = pts(part(r, 'fountain-group'))
    for (const [x, , z] of g) expect(Math.hypot(x - c[0], z - c[1])).toBeLessThan(2.5)
    expect(r.clear.length).toBe(2) // no tree in the garden or the fountain
  })
})
