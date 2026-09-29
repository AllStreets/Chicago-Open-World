import { describe, it, expect } from 'vitest'
import { buildVenue, VENUE_FACADES as F, STYLE, fieldSeed } from '../lib/venue.js'
import { applyHero } from '../lib/heroes.js'
import { defaultHeightFor } from '../lib/osm.js'

const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
const ys = (m) => m.positions.filter((_, i) => i % 3 === 1)
const xz = (m) => { const o = []; for (let i = 0; i < m.positions.length; i += 3) o.push([m.positions[i], m.positions[i + 2]]); return o }
const triArea = (m) => {
  let a = 0
  for (let i = 0; i < m.positions.length; i += 9) {
    const p = m.positions
    const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2]
    const vx = p[i + 6] - p[i], vy = p[i + 7] - p[i + 1], vz = p[i + 8] - p[i + 2]
    a += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2
  }
  return a
}
const polyArea = (r) => Math.abs(r.reduce((s, [x, z], i) => { const [x2, z2] = r[(i + 1) % r.length]; return s + x * z2 - x2 * z }, 0) / 2)

// A Wrigley-sized block: 190 m square, home plate near the SW corner, centre field to the NE.
const OUT = rect(0, 0, 190, -190)
const d = [Math.SQRT1_2, -Math.SQRT1_2]
const BASEBALL = {
  kind: 'baseball', home: [38, -38], cf: d, walls: { lf: 108, lcf: 112, cf: 122, rcf: 112, rf: 108 }, foul: 12, backstop: 18,
  rim: [[0, 13], [42, 13], [58, 26], [180, 26]], roofFrom: 60, roofRise: 6,
  seats: 'green', wall: 'brick-steel', steel: 'green', ivy: true,
  lights: [{ angle: 70, h: 18 }, { angle: -70, h: 18 }],
  scoreboard: { w: 23, h: 8.5, style: 'manual', setback: 8 },
  marquee: { w: 11, h: 3.4, base: 7 },
}
const byFacade = (meshes, f) => meshes.filter((m) => m.facade === f)

describe('buildVenue — baseball', () => {
  const meshes = buildVenue(OUT, BASEBALL)
  it('stays inside the footprint except the street marquee', () => {
    for (const m of meshes.filter((q) => q.part !== 'marquee')) for (const [x, z] of xz(m.mesh)) {
      expect(x).toBeGreaterThan(-0.5); expect(x).toBeLessThan(190.5); expect(z).toBeLessThan(0.5); expect(z).toBeGreaterThan(-190.5)
    }
  })
  it('grandstand rises higher than the outfield bleachers', () => {
    const seats = byFacade(meshes, F.seats).flatMap((m) => xz(m.mesh).map((p, i) => [...p, ys(m.mesh)[i]]))
    const along = ([x, z]) => (x - 38) * d[0] + (z + 38) * d[1]
    const behindHome = Math.max(...seats.filter((p) => along(p) < 0).map((p) => p[2]))
    const deepCf = Math.max(...seats.filter((p) => along(p) > 140).map((p) => p[2]))
    expect(behindHome).toBeGreaterThan(24)
    expect(deepCf).toBeLessThan(15)
  })
  it('style selectors ride in the seed', () => {
    expect(byFacade(meshes, F.seats)[0].seed).toBe(STYLE.seats.green)
    expect(byFacade(meshes, F.wall).some((m) => m.seed === STYLE.wall['brick-steel'])).toBe(true)
  })
  it('produces seats, the field, steel, lamps, screens, walls, the marquee and ivy', () => {
    for (const k of ['seats', 'field', 'steel', 'lamp', 'screen', 'wall', 'marquee', 'ivy']) expect(byFacade(meshes, F[k]).length, k).toBeGreaterThan(0)
    for (const k of ['turf', 'clay', 'paint']) expect(byFacade(meshes, F[k]).length, k).toBe(0)
  })
  it('the field is one surface covering the field ring exactly once', () => {
    const field = meshes.filter((m) => m.field)
    expect(field).toHaveLength(1)
    expect(field[0]).toMatchObject({ facade: 24, seed: fieldSeed(0), part: 'field' })
    const ring = meshes.find((m) => m.fieldRing).fieldRing
    const r = triArea(field[0].mesh) / polyArea(ring)
    expect(r).toBeGreaterThan(0.995); expect(r).toBeLessThan(1.005)
  })
  it('field uvs are local metres from home plate: u toward centre field, v toward left field', () => {
    const f = meshes.find((m) => m.part === 'field').mesh, L = [d[1], -d[0]]
    for (let i = 0, k = 0; i < f.positions.length; i += 3, k += 2) {
      const px = f.positions[i] - 38, pz = f.positions[i + 2] + 38
      expect(f.uvs[k]).toBeCloseTo(px * d[0] + pz * d[1], 3)
      expect(f.uvs[k + 1]).toBeCloseTo(px * L[0] + pz * L[1], 3)
    }
  })
  it('emits the venue frame with its ring and a grass ring 4.6 m inside it', () => {
    const v = meshes.find((m) => m.venue).venue
    expect(v.frame.origin).toEqual([38, -38])
    expect(v.frame).toMatchObject({ u0: -24, u1: 132, v0: -96, v1: 96 })
    expect(v.frame.ring).toHaveLength(192)
    for (const [u, w] of v.frame.ring) { expect(u).toBeGreaterThan(-24); expect(u).toBeLessThan(132); expect(Math.abs(w)).toBeLessThan(96) }
    expect(polyArea(v.frame.grassRing)).toBeLessThan(polyArea(v.frame.ring))
  })
  it('emits each board face and the flag pole for the sidecar', () => {
    const v = meshes.find((m) => m.venue).venue
    expect(v.boards).toHaveLength(1)
    const b = v.boards[0]
    expect(b).toMatchObject({ style: 'manual', w: 23, h: 8.5 })
    expect(b.normal[0] * (38 - b.center[0]) + b.normal[1] * (-38 - b.center[2])).toBeGreaterThan(0) // faces home plate
    expect(v.flagPole[1]).toBeGreaterThan(b.center[1] + b.h / 2 + 5)
  })
})

describe('buildVenue — football', () => {
  const OUTF = rect(0, 0, 220, -360)
  const meshes = buildVenue(OUTF, {
    kind: 'football', center: [110, -180], axis: [0, -1], outerInset: 12,
    rim: [[-180, 28], [-90, 40], [0, 28], [90, 52], [180, 28]],
    seats: 'navy', wall: 'glass-steel', steel: 'gray', endZone: 'navy', logo: 'orange',
    colonnade: { rows: 2, spacing: 5.8, r: 1.05, h: 17, lengthFrac: 0.55, from: 3, rowGap: 4.2, podium: 2.5, style: 'limestone' },
  })
  it('the west side (left of north) is the tall side', () => {
    const seats = byFacade(meshes, F.seats).flatMap((m) => xz(m.mesh).map((p, i) => [...p, ys(m.mesh)[i]]))
    const west = Math.max(...seats.filter((p) => p[0] < 60).map((p) => p[2]))
    const east = Math.max(...seats.filter((p) => p[0] > 160).map((p) => p[2]))
    expect(west).toBeGreaterThan(east + 8)
  })
  it('raises limestone colonnades on both long sides', () => {
    const cols = meshes.filter((m) => m.part === 'column')
    expect(cols.length).toBeGreaterThan(40)
    expect(cols.some((m) => xz(m.mesh)[0][0] < 110)).toBe(true)
    expect(cols.some((m) => xz(m.mesh)[0][0] > 110)).toBe(true)
    expect(cols[0].seed).toBe(STYLE.wall.limestone)
  })
  it('the football frame is centred on the field, ±75 × ±37.5 m, with no grass ring', () => {
    const v = meshes.find((m) => m.venue).venue
    expect(v.frame.origin).toEqual([110, -180])
    expect(v.frame).toMatchObject({ u0: -75, u1: 75, v0: -37.5, v1: 37.5 })
    expect(v.frame.grassRing).toBeUndefined()
    for (const [u, w] of v.frame.ring) { expect(Math.abs(u)).toBeLessThan(75); expect(Math.abs(w)).toBeLessThan(37.5) }
  })
})

describe('venue heroes + defaults', () => {
  it('applyHero with a venue spec replaces the extrusion with venue meshes', () => {
    const b = { id: 'v', area: 190 * 190, centroid: [95, -95], height: 24, parts: null, polygons: [{ outer: OUT, holes: [] }] }
    const r = applyHero(b, { crowns: [], venue: { ...BASEBALL, home: undefined, homeLocal: [38, -38] } })
    expect(r.pieces).toEqual([])
    expect(r.venueMeshes.length).toBeGreaterThan(10)
  })
  it('arena façade names resolve to the venue wall with a style seed', () => {
    const b = { id: 'a', area: 400, centroid: [10, -10], height: 30, parts: null, polygons: [{ outer: rect(0, 0, 20, -20), holes: [] }] }
    applyHero(b, { crowns: [], facade: 'arena', wallStyle: 'arena' })
    expect(b.facadeOverride).toBe('arena')
    expect(b.seedOverride).toBe(STYLE.wall.arena)
  })
  it('untagged small stadiums and grandstands default low, not 25 m blocks', () => {
    expect(defaultHeightFor({ building: 'stadium' })).toBeLessThanOrEqual(10)
    expect(defaultHeightFor({ building: 'grandstand' })).toBeLessThanOrEqual(7)
  })
  it('applyHero passes the sports slot and capacity to the venue', () => {
    const b = { id: 'v', area: 190 * 190, centroid: [95, -95], height: 24, parts: null, polygons: [{ outer: OUT, holes: [] }] }
    const r = applyHero(b, { crowns: [], venue: { ...BASEBALL, home: undefined, homeLocal: [38, -38] }, sports: { kind: 'baseball', slot: 2, capacity: 1000 } })
    expect(r.venueMeshes.find((m) => m.field).seed).toBe(fieldSeed(2))
  })
})

import { innerRadius } from '../lib/venue.js'

describe('bowl inner radius (H9)', () => {
  it('real venues: the field edge, but at least 6 m of stand', () => {
    expect(innerRadius([50], 100)).toBe(50)
    expect(innerRadius([98], 100)).toBe(94)
    expect(innerRadius([64], 166)).toBe(64) // Soldier Field along its axis: unchanged
  })
  it('tiny hulls never flip the ray through the centre', () => {
    expect(innerRadius([50], 8)).toBe(4)
    expect(innerRadius([50], 3)).toBe(1.5)
    expect(innerRadius([2], 8)).toBe(2)
    for (const rO of [0.5, 1, 2, 5, 6, 7, 11]) expect(innerRadius([100], rO)).toBeGreaterThan(0)
  })
})

describe('buildVenue — seat anchors', () => {
  const meshes = buildVenue(OUT, BASEBALL)
  const all = meshes.find((m) => m.venue).venue.seats
  const ring = meshes.find((m) => m.fieldRing).fieldRing
  const cen = [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length]
  const quadShares = (pts) => { const q = [0, 0, 0, 0]; for (const [x, , z] of pts) q[(x > cen[0] ? 1 : 0) + (z > cen[1] ? 2 : 0)]++; return q.map((n) => n / pts.length) }
  it('puts seats on the stands, inside the footprint, facing the field', () => {
    expect(all.length).toBeGreaterThan(5000)
    let facing = 0
    for (const [x, y, z, yaw] of all) {
      expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(190); expect(z).toBeLessThan(0); expect(z).toBeGreaterThan(-190)
      expect(y).toBeGreaterThan(3.4); expect(y).toBeLessThan(27.5)
      if (Math.sin(yaw) * (cen[0] - x) + Math.cos(yaw) * (cen[1] - z) > 0) facing++
    }
    expect(facing / all.length).toBeGreaterThan(0.97)
  })
  it('a capacity keeps a uniform, deterministic subset', () => {
    const cap = Math.floor(all.length / 4)
    const sub = buildVenue(OUT, { ...BASEBALL, capacity: cap }).find((m) => m.venue).venue.seats
    expect(sub).toHaveLength(cap)
    expect(buildVenue(OUT, { ...BASEBALL, capacity: cap }).find((m) => m.venue).venue.seats).toEqual(sub)
    const a = quadShares(all), b = quadShares(sub)
    for (let i = 0; i < 4; i++) expect(Math.abs(a[i] - b[i])).toBeLessThan(0.03)
  })
})

describe('buildVenue — rim light rows', () => {
  const OUTF = rect(0, 0, 220, -360)
  const spec = {
    kind: 'football', center: [110, -180], axis: [0, -1], outerInset: 12, rim: [[-180, 28], [-90, 40], [0, 28], [90, 52], [180, 28]],
    rimLights: [{ from: 62, to: 118, every: 4, w: 7, h: 2.6, lift: 2.5 }, { from: -118, to: -62, every: 4, w: 7, h: 2.6, lift: 2.5 }],
  }
  const lamps = buildVenue(OUTF, spec).filter((m) => m.facade === F.lamp)
  it('mounts one lamp per step along both long rims, above the rim, inside the footprint', () => {
    expect(lamps).toHaveLength(30)
    for (const l of lamps) {
      expect(Math.min(...ys(l.mesh))).toBeGreaterThan(28 + 1.2 + 2.5 - 1e-6)
      for (const [x, z] of xz(l.mesh)) { expect(x).toBeGreaterThan(-0.5); expect(x).toBeLessThan(220.5); expect(z).toBeLessThan(0.5); expect(z).toBeGreaterThan(-360.5) }
    }
    expect(lamps.some((l) => xz(l.mesh)[0][0] < 110)).toBe(true)
    expect(lamps.some((l) => xz(l.mesh)[0][0] > 110)).toBe(true)
  })
})
