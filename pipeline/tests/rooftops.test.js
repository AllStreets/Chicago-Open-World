// pipeline/tests/rooftops.test.js — the Wrigley rooftop clubs (user item 13).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { rooftopStand, rooftopPlace, applyRooftops, rooftopLots } from '../lib/rooftops.js'

const data = JSON.parse(readFileSync(new URL('../data/rooftops.json', import.meta.url), 'utf8'))
// a Sheffield three-flat: 7.6 m wide (north–south), 32 m deep (east–west); the field is to the west
const lot = [[0, 0], [32, 0], [32, 7.6], [0, 7.6]]
const plate = [-150, 60]
const ys = (m) => m.positions.filter((_, i) => i % 3 === 1)

describe('rooftop bleachers', () => {
  const st = rooftopStand({ ring: lot, roofY: 11.4, plate })
  it('a stepped steel grandstand on the roof: rows rise away from the field', () => {
    expect(st.meshes.length).toBeGreaterThan(2)
    const seats = st.seats
    expect(seats.length).toBeGreaterThan(60)
    const front = seats.reduce((a, s) => (s[0] < a[0] ? s : a)), back = seats.reduce((a, s) => (s[0] > a[0] ? s : a))
    expect(back[1]).toBeGreaterThan(front[1] + 3) // the back rows (east, away from the field) stand higher
    expect(Math.min(...seats.map((s) => s[1]))).toBeGreaterThan(11.4)
  })
  it('stays on its own roof and is built from the steel, seat and rail rows', () => {
    for (const m of st.meshes) {
      for (let i = 0; i < m.mesh.positions.length; i += 3) {
        expect(m.mesh.positions[i]).toBeGreaterThan(-0.6); expect(m.mesh.positions[i]).toBeLessThan(32.6)
        expect(m.mesh.positions[i + 2]).toBeGreaterThan(-0.6); expect(m.mesh.positions[i + 2]).toBeLessThan(8.2)
      }
      expect(Math.min(...ys(m.mesh))).toBeGreaterThanOrEqual(11.4 - 1e-6)
    }
    expect(new Set(st.meshes.map((m) => m.style))).toEqual(new Set(['rooftop-steel', 'rooftop-seat', 'rooftop-rail']))
  })
  it('every seat faces home plate', () => {
    for (const [x, , z, yaw] of st.seats) {
      const want = Math.atan2(plate[0] - x, plate[1] - z)
      expect(Math.abs(Math.atan2(Math.sin(yaw - want), Math.cos(yaw - want)))).toBeLessThan(0.05)
    }
  })
  it('a Waveland lot (field to the south) steps up to the north', () => {
    const w = rooftopStand({ ring: [[0, 0], [7.6, 0], [7.6, 30], [0, 30]], roofY: 11.4, plate: [-20, 160] })
    const front = w.seats.reduce((a, s) => (s[2] > a[2] ? s : a)), back = w.seats.reduce((a, s) => (s[2] < a[2] ? s : a))
    expect(back[1]).toBeGreaterThan(front[1] + 3)
  })
})

describe('lots OSM leaves empty', () => {
  it('3627 and 3633 Sheffield become three-storey brick buildings that the clubs then dress', () => {
    const lots = rooftopLots(data.clubs)
    expect(lots.map((b) => b.id)).toEqual(['rt-skybox-on-sheffield', 'rt-lakeview-baseball-club'])
    for (const b of lots) {
      expect(b).toMatchObject({ stories: 3, height: 11.4, source: 'rooftops' })
      expect(b.tags['building:material']).toBe('brick'); expect(b.tags['building:colour']).toMatch(/^#/)
      expect(b.area).toBeGreaterThan(300)
    }
    const r = applyRooftops(lots.map((b) => ({ ...b, pieces: [{ outer: b.polygons[0].outer, top: 11.4 }] })), data.clubs.filter((c) => c.lot), plate)
    expect(r.matched).toBe(2)
  })
})

describe('the rooftop clubs as places', () => {
  it('sixteen clubs with real names, street addresses and websites', () => {
    expect(data.clubs).toHaveLength(16)
    for (const c of data.clubs) {
      expect(c.name).toBeTruthy(); expect(c.address).toMatch(/^\d{4}(-\d{4})? [NW] (Waveland|Sheffield) Ave$/); expect(c.website).toMatch(/^https?:\/\//)
      expect(c.osm || c.at || c.lot).toBeTruthy()
    }
  })
  it('a club becomes a Venues place carrying its address and website', () => {
    const p = rooftopPlace(data.clubs[0], { centroid: [5, 6] })
    expect(p).toMatchObject({ id: 'rt:wrigley-view', name: 'Wrigley View Rooftop', cat: 'venues', x: 5, z: 6 })
    expect(p.tags).toMatchObject({ website: 'http://www.wrigleyview.com/', 'addr:housenumber': '1050', 'addr:street': 'W Waveland Ave' })
  })
  it('applyRooftops dresses matched buildings (bleachers + brick) and returns places and crowd anchors', () => {
    const b = { id: 'w1', tags: {}, centroid: [16, 3.8], polygons: [{ outer: lot, holes: [] }], pieces: [{ outer: lot, top: 11.4 }] }
    const clubs = [{ key: 'k', name: 'K Club', address: '3617 N Sheffield Ave', osm: 'w1', website: 'http://k.example/', brick: '#7e3b2c' }, { key: 'm', name: 'M Club', address: '3627 N Sheffield Ave', osm: null, at: [1, 2], website: 'http://m.example/' }]
    const r = applyRooftops([b], clubs, plate)
    expect(b.extraMeshes.length).toBeGreaterThan(2)
    expect(b.tags['building:colour']).toBe('#7e3b2c')
    expect(b.rooftop).toBe('k')
    expect(r.places.map((p) => p.id)).toEqual(['rt:k', 'rt:m'])
    expect(r.places[1]).toMatchObject({ x: 1, z: 2 })
    expect(r.seats.length).toBeGreaterThan(60)
    expect(r.matched).toBe(1)
  })
  it('a part-full night thins every club evenly: the first third of the anchors reaches both grandstands', () => {
    const mk = (id, dz) => { const ring = lot.map(([x, z]) => [x, z + dz]); return { id, tags: {}, centroid: [16, 3.8 + dz], polygons: [{ outer: ring, holes: [] }], pieces: [{ outer: ring, top: 11.4 }] } }
    const r = applyRooftops([mk('w1', 0), mk('w2', 100)], [{ key: 'a', name: 'A', address: '3617 N Sheffield Ave', osm: 'w1', website: 'http://a/' }, { key: 'b', name: 'B', address: '3619 N Sheffield Ave', osm: 'w2', website: 'http://b/' }], plate)
    const third = r.seats.slice(0, Math.floor(r.seats.length / 3))
    expect(third.some((s) => s[2] < 50)).toBe(true); expect(third.some((s) => s[2] > 50)).toBe(true)
  })
})
