// app/src/transit/__tests__/tunnels.test.js — subway tubes and stations from route paths (user, 2026-09-30).
import { describe, it, expect } from 'vitest'
import { undergroundSegments, dedupeSegments, sideRoom, stationPlans, buildTunnels, signQuads, TUNNEL } from '../tunnels.js'
import { followPose } from '../followCam.js'

// a north-bound line resampled every 12 m like transit.json: down a 4 % ramp from z = -60, then a straight subway;
// two tracks 7 m apart
const line = (x) => Array.from({ length: 51 }, (_, i) => { const z = -12 * i; return [x, Math.max(-9, Math.min(0.35, 0.35 + (z + 60) * 0.04)), z] })
const TRANSIT = {
  routes: [{ id: 'a', line: 'red', path: line(-3.5) }, { id: 'b', line: 'red', path: line(3.5).reverse() }],
  stations: [{ name: 'Lake', lines: ['red'], x: 0, z: -400, y: 0, grade: 'subway', heading: 0 }],
}

describe('tunnels', () => {
  it('tubes start at the portal mouth: the ramp above it stays an open trench', () => {
    const s = undergroundSegments([TRANSIT.routes[0]])
    expect(Math.max(...s.map((q) => Math.max(q.a[1], q.b[1])))).toBeCloseTo(TUNNEL.mouthY, 5)
    expect(s[0].a[2]).toBeLessThan(-180); expect(s[0].a[2]).toBeGreaterThan(-200) // clipped part-way down the ramp
  })
  it('routes over the same track draw it once', () => {
    const one = undergroundSegments([TRANSIT.routes[0]]), two = undergroundSegments([TRANSIT.routes[0], { ...TRANSIT.routes[0], id: 'c' }])
    expect(dedupeSegments(two).length).toBe(dedupeSegments(one).length)
  })
  it('parallel tracks share one tube: no wall between them, walls outside', () => {
    const segs = sideRoom(dedupeSegments(undergroundSegments(TRANSIT.routes)))
    const a = segs.find((s) => s.route === 'a' && s.mid[2] < -300) // north-bound at x = -3.5: right (+x) is the other track
    expect(a.wall[1]).toBe(false); expect(a.ext[1]).toBeCloseTo(3.8, 5)
    expect(a.wall[-1]).toBe(true); expect(a.ext[-1]).toBe(TUNNEL.half)
  })
  it('an underground station gets an island platform between its tracks', () => {
    const segs = sideRoom(dedupeSegments(undergroundSegments(TRANSIT.routes)))
    const [p] = stationPlans(TRANSIT.stations, segs)
    expect(p.kind).toBe('island'); expect(p.tracks.map(Math.abs)).toEqual([3.5, 3.5])
  })
  it('everything stays below the ground: the surface, the water and the skyline are untouched', () => {
    const t = buildTunnels(TRANSIT)
    let top = -Infinity
    for (let i = 1; i < t.tube.position.length; i += 3) top = Math.max(top, t.tube.position[i])
    expect(top).toBeLessThanOrEqual(TUNNEL.mouthY + TUNNEL.clear + 1e-6)
    expect(top).toBeLessThan(0)
    expect(t.signs.index.length).toBeGreaterThan(0)
    expect(t.names).toEqual(['Lake'])
  })
  it('knows the inside of a tube: between the walls, above the floor, under the ceiling', () => {
    const { inside } = buildTunnels(TRANSIT)
    expect(inside(-3.5, -7, -300)).toBe(true)
    expect(inside(0, -7, -300)).toBe(true) // between the tracks: one tube
    expect(inside(-8, -7, -300)).toBe(false) // beyond the outer wall
    expect(inside(-3.5, -2, -300)).toBe(false) // above the ceiling
    expect(inside(-3.5, -7, -40)).toBe(false) // the open ramp
  })
  it('signs read from the side they face', () => {
    const q = signQuads([{ c: [0, 0], n: [1, 0], y0: 0, y1: 1, half: 2, row: 0 }], 1)
    const P = (i) => [q.position[i * 3], q.position[i * 3 + 1], q.position[i * 3 + 2]], [a, b, c] = [...q.index.slice(0, 3)].map(P)
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    expect(u[1] * v[2] - u[2] * v[1]).toBeGreaterThan(0) // the face normal points along n (+x)
    // a viewer at +x looking west has north (−z) on the right: the text's start (u = 0) is at +z
    expect(q.position[2]).toBeGreaterThan(q.position[5])
  })
  it('the follow cam rides inside the tube, below ground, in chase and side views', () => {
    const { inside } = buildTunnels(TRANSIT)
    for (const view of ['chase', 'side']) {
      const p = followPose([-3.5, -9, -350], [0, 0, -1], view, () => 25, 60, inside)
      expect(p.underground).toBe(true)
      expect(p.position[1]).toBeLessThan(0)
      expect(inside(...p.position)).toBe(true)
    }
    expect(followPose([-3.5, -9, -350], [0, 0, -1], 'chase', () => 25).position[1]).toBe(25) // no tubes drawn: the surface
  })
})
