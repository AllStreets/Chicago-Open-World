// pipeline/tests/riverwalk.test.js — D1-2: the Riverwalk at river level, its rooms between the bridges, the River
// Theater's steps up to Upper Wacker, a passage under every bridge, and the walk that never leaves the floor.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { buildRiverwalk, roomExtents, RW } from '../lib/riverwalk.js'
import { sunkWater, inPoly } from '../lib/riverLevel.js'
import { pierRing } from '../lib/bridges.js'
import { pointInRing } from '../lib/geom.js'

const L = JSON.parse(readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8')).levels
const levels = { river: L.RIVER_Y, riverwalk: L.RIVERWALK_Y, lower: L.LOWER_Y }
const spec = JSON.parse(readFileSync(new URL('../data/riverwalk.json', import.meta.url), 'utf8'))

// A straight Main Branch running east–west: the river north of z = 0, the Riverwalk a 26 m band south of it, the
// street (Upper Wacker) behind; bridges every 120 m, the trunnion of each south leaf on the Riverwalk.
const RIVER = [[-800, -80], [1300, -80], [1300, 0], [-800, 0]]
const WALK = [[-790, 0], [1290, 0], [1290, 26], [-790, 26]]
const keys = ['lakeshore', 'columbus', 'dusable', 'wabash', 'state', 'dearborn', 'clark', 'lasalle', 'wells', 'franklin-orleans']
const bridges = keys.map((key, i) => ({ key, leaf: 'deck-truss', decks: 1, span: 80, width: 20, centre: [1200 - i * 200, -40 + 0], axis: [0, -1], houses: { count: 0 } }))
// put each south trunnion 10 m into the walk band (z = 0 + 10): centre z = 10 − 40 = −30
for (const b of bridges) b.centre = [b.centre[0], -30]
const water = sunkWater([{ outer: RIVER, holes: [], tags: { natural: 'water', water: 'river' } }])
const rw = buildRiverwalk({ ring: WALK, water, bridges, greens: [], spec, deckY: 0.14, levels })
const onFloor = (p) => rw.zones.some((z) => inPoly(p, z))

describe('the floor (D1-2)', () => {
  it('is at RIVERWALK_Y and gives way to every pier it passes', () => {
    expect(rw.zones.every((z) => z.y === L.RIVERWALK_Y)).toBe(true)
    expect(rw.piers.length).toBe(bridges.length)
    for (const p of rw.piers) {
      const c = p.ring.reduce((s, q) => [s[0] + q[0] / 4, s[1] + q[1] / 4], [0, 0])
      expect(onFloor(c)).toBe(false)
      expect(pierRing(p.box, 'inner').every((q) => !onFloor(q))).toBe(true)
    }
  })
  it('runs under every bridge: a passage in front of each pier joins the rooms either side', () => {
    for (const p of rw.piers) {
      const x = p.bridge.centre[0], front = Math.max(...p.ring.map((q) => -q[1])) // the pier's river face (z is negative into the river)
      for (const dx of [-p.box.outer - 1, 0, p.box.outer + 1]) expect(onFloor([x + dx, -front - RW.passageW / 2])).toBe(true)
    }
  })
  it('one connected floor from the east end to the Boardwalk', () => {
    expect(rw.zones.length).toBe(1)
  })
})

describe('the rooms between their bridges (the street table)', () => {
  const rooms = roomExtents(spec.rooms, bridges, WALK)
  const byKey = new Map(bridges.map((b) => [b.key, b]))
  it('every room of the plan, in order from Lake Shore Drive to Lake Street', () => {
    expect(spec.rooms.map((r) => r.key)).toEqual(['east', 'michigan', 'memorial', 'marina', 'cove', 'theater', 'waterplaza', 'jetty', 'boardwalk'])
    expect(spec.rooms.map((r) => r.name)).toEqual(expect.arrayContaining(['Marina Plaza', 'The Cove', 'River Theater', 'Water Plaza', 'The Jetty', 'The Boardwalk', 'Vietnam Veterans Memorial Plaza']))
  })
  it('each room lies between its two bridges, clear of their piers, and the rooms do not overlap', () => {
    for (const r of rooms) {
      if (r.east) expect(r.x1).toBeLessThan(byKey.get(r.east).centre[0] - 10)
      if (r.west) expect(r.x0).toBeGreaterThan(byKey.get(r.west).centre[0] + 10)
      expect(r.x1).toBeGreaterThan(r.x0)
    }
    for (let i = 1; i < rooms.length; i++) expect(rooms[i].x1).toBeLessThan(rooms[i - 1].x0)
  })
})

describe('the River Theater and the stairs: up to Upper Wacker', () => {
  const ys = (part) => rw.meshes.filter((m) => m.part === part).flatMap((m) => m.mesh.positions.filter((_, i) => i % 3 === 1))
  it('the theater’s seat-steps climb ≈ 5 m from the floor to the street', () => {
    const y = ys('river-theater')
    expect(y.length).toBeGreaterThan(0)
    expect(Math.min(...y)).toBeCloseTo(L.RIVERWALK_Y, 6)
    expect(Math.max(...y) - Math.min(...y)).toBeGreaterThan(4.8)
    expect(Math.max(...y)).toBeCloseTo(0, 1) // the top step is the street
    expect(RW.theater.steps * RW.theater.rise).toBeCloseTo(-L.RIVERWALK_Y, 1)
  })
  it('a stair from the floor to the street beside the piers', () => {
    const y = ys('stairs')
    expect(Math.min(...y)).toBeCloseTo(L.RIVERWALK_Y, 6); expect(Math.max(...y)).toBeCloseTo(0, 1)
  })
  it('A41: the Wacker parapet is a balustrade (coping over balusters) with a pair of light pylons at every stair head', () => {
    const tris = (part) => rw.meshes.filter((m) => m.part === part).reduce((t, m) => t + m.mesh.positions.length / 9, 0)
    expect(tris('wacker-balusters')).toBeGreaterThan(100)
    const stairs = ys('stairs').length ? rw.meshes.find((m) => m.part === 'stairs').mesh.positions.length / 3 / 36 : 0 // 36 vertices a step slab
    expect(stairs).toBeGreaterThan(0)
    const lamps = rw.meshes.find((m) => m.part === 'wacker-pylon-lamp').mesh.positions.length / 3 / 36
    expect(lamps % 2).toBe(0)
    expect(lamps).toBeGreaterThanOrEqual(2)
    expect(Math.max(...ys('wacker-pylons'))).toBeCloseTo(4.6, 5)
  })
  it('features leave the walk along the river open (≥ 4 m of floor in front of them)', () => {
    for (const o of rw.obstacles) for (const q of o) expect(q[1]).toBeGreaterThan(-0.01 + 0) // obstacles stay on the walk band (z ≥ 0)…
    // …and a 4 m strip along the river edge is clear of all of them between the piers
    for (let x = -780; x < 1280; x += 3) {
      if (rw.piers.some((p) => Math.abs(p.bridge.centre[0] - x) < p.box.outer + 2)) continue
      expect(rw.obstacles.some((o) => pointInRing([x, 2], o))).toBe(false)
    }
  })
  it('every built part is at or above the water and at or below the street (bar the parapet, its balusters and pylons (A41), and the railing)', () => {
    for (const m of rw.meshes) for (let i = 1; i < m.mesh.positions.length; i += 3) {
      expect(m.mesh.positions[i]).toBeGreaterThanOrEqual(L.RIVER_Y - 0.5)
      if (!['wacker-parapet', 'wacker-balusters', 'wacker-pylons', 'wacker-pylon-lamp', 'railing'].includes(m.part)) expect(m.mesh.positions[i]).toBeLessThanOrEqual(0.01)
    }
  })
})

// The built world: the Riverwalk walk ride (rides.json) never leaves the floor (river-levels.json), every 2 m.
const rides = new URL('../../app/src/data/rides.json', import.meta.url), rl = new URL('../../app/public/world/river-levels.json', import.meta.url)
const built = existsSync(rl) ? { r: JSON.parse(readFileSync(rl, 'utf8')), w: JSON.parse(readFileSync(rides, 'utf8')).walks.find((x) => x.id === 'riverwalk') } : null
describe.skipIf(!built?.w?.level)('the built world: the Riverwalk walk stays on its floor', () => {
  it('every 2 m of the walk is on the river-level floor, at its height', () => {
    const p = built.w.path, floors = built.r.floors
    let n = 0
    for (let i = 1; i < p.length; i++) {
      const [ax, az] = p[i - 1], [bx, bz] = p[i], k = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2))
      for (let j = 0; j <= k; j++) { const q = [ax + ((bx - ax) * j) / k, az + ((bz - az) * j) / k]; n++; expect(floors.some((f) => inPoly(q, f)), `${q}`).toBe(true) }
    }
    expect(n).toBeGreaterThan(500)
    expect(p.every((q) => q[2] === built.r.riverwalk)).toBe(true)
  })
})
