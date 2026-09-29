import { describe, it, expect } from 'vitest'
import { buildVenue, VENUE_FACADES as F, STYLE } from '../lib/venue.js'
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
  it('produces seats, turf, clay, paint, steel, lamp, screen, wall, marquee and ivy', () => {
    for (const k of ['seats', 'turf', 'clay', 'paint', 'steel', 'lamp', 'screen', 'wall', 'marquee', 'ivy']) expect(byFacade(meshes, F[k]).length, k).toBeGreaterThan(0)
  })
  it('field surfaces tile the field exactly once (no overlaps, no gaps)', () => {
    const field = meshes.filter((m) => m.field)
    const total = field.reduce((s, m) => s + triArea(m.mesh), 0)
    const ring = meshes.find((m) => m.fieldRing).fieldRing
    expect(total / polyArea(ring)).toBeGreaterThan(0.995)
    expect(total / polyArea(ring)).toBeLessThan(1.005)
  })
  it('puts the pitcher’s mound 18.4 m from home toward centre field', () => {
    const mound = meshes.find((m) => m.part === 'mound')
    const pts = xz(mound.mesh)
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2
    expect(Math.hypot(cx - (38 + d[0] * 18.44), cz - (-38 + d[1] * 18.44))).toBeLessThan(0.6)
  })
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
})

describe('buildVenue — football', () => {
  const OUTF = rect(0, 0, 220, -360)
  const meshes = buildVenue(OUTF, {
    kind: 'football', center: [110, -180], axis: [0, -1], outerInset: 12,
    rim: [[-180, 28], [-90, 40], [0, 28], [90, 52], [180, 28]],
    seats: 'navy', wall: 'glass-steel', steel: 'gray', endZone: 'navy', logo: 'orange',
    colonnade: { rows: 2, spacing: 5.8, r: 1.05, h: 17, lengthFrac: 0.55, from: 3, rowGap: 4.2, podium: 2.5, style: 'limestone' },
  })
  it('paints yard lines and navy end zones on the turf', () => {
    const paint = byFacade(meshes, F.paint)
    expect(paint.some((m) => m.seed === STYLE.paint.navy)).toBe(true)
    const white = paint.filter((m) => m.seed === STYLE.paint.white).reduce((s, m) => s + triArea(m.mesh), 0)
    expect(white).toBeGreaterThan(21 * 0.3 * 48)
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
})
