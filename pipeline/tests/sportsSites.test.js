import { describe, it, expect } from 'vitest'
import { shuffled } from '../lib/sportsSites.js'
import { encodeAnchors, plazaAnchors, venueRecord } from '../lib/sportsSites.js'
import { pointInRing, distToRing } from '../lib/geom.js'

describe('shuffled', () => {
  const list = Array.from({ length: 500 }, (_, i) => i)
  it('is a deterministic permutation', () => {
    const a = shuffled(list, 3)
    expect([...a].sort((x, y) => x - y)).toEqual(list)
    expect(shuffled(list, 3)).toEqual(a)
    expect(shuffled(list, 4)).not.toEqual(a)
    expect(a).not.toEqual(list)
  })
})


describe('encodeAnchors', () => {
  it('packs Int16 decimetres around the venue centre and yaw in 1e-4 rad', () => {
    const buf = encodeAnchors([[105.26, 12.34, -207.5, 1.5708], [80, 0.1, -180, -3.1416]], [100, -200])
    const a = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2)
    expect([...a]).toEqual([53, 123, -75, 15708, -200, 1, 200, -31416])
  })
  it('refuses anchors more than 3.2 km from the centre', () => {
    expect(() => encodeAnchors([[4000, 0, 0, 0]], [0, 0])).toThrow(/out of Int16 range/)
  })
})

describe('plazaAnchors', () => {
  const hull = [[0, 0], [100, 0], [100, -80], [0, -80]]
  const pts = plazaAnchors(hull, { seed: 5 }, (p) => p[0] < 50)
  it('rings the arena between 5 and 24 m out, on free ground, facing it', () => {
    expect(pts.length).toBeGreaterThan(200)
    expect(pts.length).toBeLessThanOrEqual(1200)
    for (const [x, y, z, yaw] of pts) {
      expect(pointInRing([x, z], hull)).toBe(false)
      const d = distToRing([x, z], hull)
      expect(d).toBeGreaterThanOrEqual(5); expect(d).toBeLessThanOrEqual(24)
      expect(x).toBeLessThan(50)
      expect(y).toBe(0.1)
      expect(Math.sin(yaw) * (50 - x) + Math.cos(yaw) * (-40 - z)).toBeGreaterThan(0)
    }
    expect(plazaAnchors(hull, { seed: 5 }, (p) => p[0] < 50)).toEqual(pts)
  })
})

describe('venueRecord', () => {
  const hull = [[0, 0], [200, 0], [200, -200], [0, -200]]
  it('open-air: frame, boards, seat file; radius covers the hull', () => {
    const r = venueRecord({ key: 'wrigleyfield', name: 'Wrigley Field', sports: { kind: 'baseball', slot: 1, teams: ['cubs'], capacity: 41649 } }, hull,
      { frame: { origin: [38, -38] }, boards: [{ w: 23 }], flagPole: [1, 2, 3], seats: [[1, 2, 3, 0], [4, 5, 6, 0]] })
    expect(r).toMatchObject({ key: 'wrigleyfield', kind: 'baseball', slot: 1, center: [100, -100], seats: 'venues/wrigleyfield.seats.bin', seatCount: 2, plaza: null, flagPole: [1, 2, 3] })
    expect(r.radius).toBeGreaterThan(Math.hypot(100, 100))
  })
  it('arena: no frame, no seats', () => {
    const r = venueRecord({ key: 'unitedcenter', name: 'United Center', sports: { kind: 'arena', slot: 3, teams: ['bulls', 'blackhawks'], capacity: 20917 } }, hull, undefined)
    expect(r).toMatchObject({ frame: null, boards: [], seats: null, seatCount: 0 })
  })
})
