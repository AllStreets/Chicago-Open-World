// pipeline/tests/lakeLevel.test.js — D5: the lake at LAKE_Y, how every edge meets it, beaches, perched ponds (D5-2).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { lakeLevels, lakeWaterOf, isPerchedPond, shoreChains, sweepChains, profileAt, gateWalls, beachSlope, drape, beachRisers, pondBank, cutAtWater, waterNear, lowerBreakwaters, lakeSkirts, EDGE_TOP, edgeIndex } from '../lib/lakeLevel.js'
import { polyIndex } from '../lib/riverLevel.js'
import { flatMesh, GROUND_Y } from '../lib/ground.js'
import { bufferPolyline } from '../lib/ribbon.js'
import { breakwaterBuildings } from '../lib/water.js'

const levels = JSON.parse(readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8'))
const shore = JSON.parse(readFileSync(new URL('../data/shore.json', import.meta.url), 'utf8'))
const LAKE_Y = levels.levels.LAKE_Y
const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
const W = (outer, tags, holes = []) => ({ outer, holes, tags: { natural: 'water', ...tags } })
const profiles = Object.fromEntries(Object.entries(shore.profiles).map(([k, v]) => [k, profileAt(v, LAKE_Y)]))
const area = (m) => { let a = 0; for (let i = 0; i < m.positions.length; i += 9) { const [ax, az, bx, bz, cx, cz] = [m.positions[i], m.positions[i + 2], m.positions[i + 3], m.positions[i + 5], m.positions[i + 6], m.positions[i + 8]]; a += Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2 } return a }
const chainLen = (c) => c.pts.reduce((t, q, i) => (i ? t + Math.hypot(q.p[0] - c.pts[i - 1].p[0], q.p[1] - c.pts[i - 1].p[1]) : 0), 0)

describe('lakeLevels (D5 flag)', () => {
  it('reads LAKE_Y (−4.65 m, D0) from levels.json; LEVELS_LAKE=0 keeps the lake at the street', () => {
    expect(lakeLevels(levels)).toEqual({ lake: -4.65 })
    expect(lakeLevels(levels, { LEVELS_LAKE: '0' })).toBeNull()
    expect(lakeLevels(null)).toBeNull()
  })
  it('the step at the lock: the river below the lake, the lake below the lakefront, the edge ≈ 2.6 m over the water', () => {
    expect(levels.levels.RIVER_Y).toBeLessThan(LAKE_Y)
    expect(LAKE_Y).toBeLessThan(0)
    expect(shore.edgeAboveLakeM).toBeCloseTo(levels.sampleSummary.lakeEdgeAboveWaterM, 0)
  })
})

describe('which water is at lake level', () => {
  const lake = [{ outer: rect(1000, -5000, 9000, 5000), holes: [] }]
  const monroe = W(rect(700, -300, 1000, 300), { water: 'harbour', name: 'Monroe Harbor' })
  const dusable = W(rect(700, 300, 990, 500), { water: 'harbour', name: 'DuSable Harbor' }) // only touches Monroe
  const lagoon = W(rect(600, 500, 640, 900), { water: 'lagoon', name: 'South Lagoon' }) // touches DuSable
  const river = W(rect(0, 0, 700, 60), { water: 'river', _sunk: true })
  const pool = W(rect(980, 600, 990, 610), { water: 'basin', name: 'Pool 1' })
  const lw = lakeWaterOf([monroe, dusable, lagoon, river, pool], lake, { ponds: shore.ponds })
  it('the harbours that open onto the lake, transitively', () => { expect(lw).toEqual(expect.arrayContaining([monroe, dusable])) })
  it('never the river system, a perched lagoon or a small pool', () => { for (const p of [lagoon, river, pool]) expect(lw).not.toContain(p) })
})

describe('D5-2: inland ponds stay perched 0.6 m below their banks, with sloped banks', () => {
  const named = { 'South Pond': 'pond', 'North Pond': 'pond', 'South Lagoon': 'lagoon', 'Alfred Caldwell Lily Pool': 'pond' }
  it('lists South Pond, North Pond, the Lagoon and the Lily Pool with their water height', () => {
    expect(shore.ponds.named).toEqual(Object.keys(named))
    const ys = Object.fromEntries(Object.entries(named).map(([name, water], i) => {
      const p = W(rect(i * 100, 0, i * 100 + 60, 40), { water, name })
      expect(isPerchedPond(p, shore.ponds)).toBe(true)
      return [name, +pondBank(p, { bankY: GROUND_Y.parks, spec: shore.ponds }).waterY.toFixed(2)]
    }))
    expect(ys).toEqual({ 'South Pond': -0.52, 'North Pond': -0.52, 'South Lagoon': -0.52, 'Alfred Caldwell Lily Pool': -0.52 })
  })
  it('fountains, the river system and tiny ponds are not perched', () => {
    expect(isPerchedPond(W(rect(0, 0, 60, 40), { water: 'pond', name: 'Buckingham Fountain' }), shore.ponds)).toBe(false)
    expect(isPerchedPond(W(rect(0, 0, 60, 40), { water: 'pond', _sunk: true }), shore.ponds)).toBe(false)
    expect(isPerchedPond(W(rect(0, 0, 5, 5), { water: 'pond' }), shore.ponds)).toBe(false)
  })
  it('the bank runs from the ground at the edge to under the water, sloping inward all round', () => {
    const p = W(rect(0, 0, 60, 40), { water: 'pond' })
    const { waterY, mesh } = pondBank(p, { bankY: 0.08, spec: shore.ponds })
    const ys = mesh.positions.filter((_, i) => i % 3 === 1)
    expect(Math.max(...ys)).toBeCloseTo(0.08, 6); expect(Math.min(...ys)).toBeLessThan(waterY)
    for (let i = 1; i < mesh.normals.length; i += 3) expect(mesh.normals[i]).toBeGreaterThan(0.3) // faces up and in
    expect(mesh.positions.length / 9).toBe(8) // 4 edges × 2 triangles
  })
})

describe('the shoreline: every edge meets the water, no gaps (D5-1)', () => {
  // land west of x = 0 with a 12 m mole sticking out at z 200–212 and Navy Pier as a zone; a harbour cut into the land
  const lakeP = { outer: [[0, -1000], [3000, -1000], [3000, 1000], [0, 1000], [0, 212], [400, 212], [400, 200], [0, 200]], holes: [] }
  const harbour = W(rect(-300, -600, 0, -400), { water: 'harbour', name: 'Belmont Harbor' })
  const lock = W(rect(-150, 500, 0, 520), { water: 'lock', name: 'Chicago Harbor Lock', _sunk: true })
  const pier = { profile: 'pier', minX: -1, maxX: 1, minZ: 800, maxZ: 900 }
  const beach = { outer: rect(-120, -100, 0, 100), holes: [] }
  const { chains, contacts } = shoreChains({ lakeWater: [lakeP, harbour], sunk: [lock], beaches: [beach], zones: [pier], moleWidthM: shore.moleWidthM, within: { minX: -500, maxX: 500, minZ: -990, maxZ: 990 } })
  const kinds = (k) => chains.filter((c) => c.kind === k)
  it('classifies revetment, harbour wall, Navy Pier, the narrow mole and the lock gate; beaches get no wall', () => {
    expect(new Set(chains.map((c) => c.kind))).toEqual(new Set(['revetment', 'harbour', 'pier', 'mole', 'gate']))
    expect(kinds('gate').reduce((t, c) => t + chainLen(c), 0)).toBeCloseTo(20, 0)
    expect(kinds('pier').reduce((t, c) => t + chainLen(c), 0)).toBeCloseTo(100, 0)
    expect(kinds('mole').reduce((t, c) => t + chainLen(c), 0)).toBeCloseTo(2 * 400 + 12, 0)
    expect(kinds('harbour').reduce((t, c) => t + chainLen(c), 0)).toBeCloseTo(300 + 200 + 300, 0) // the harbour's three land sides
  })
  it('covers every metre of the shore that faces land inside the world (the west edge less the beach, plus the mole)', () => {
    const lakeLand = chains.filter((c) => c.owner === lakeP).reduce((t, c) => t + chainLen(c), 0)
    expect(lakeLand).toBeCloseTo(1980 - 12 - 200 - 200 + 2 * 400 + 12, 0) // the west edge (z ±990) less the mole root, the beach and the harbour mouth, plus the mole
  })
  it('every river–lake water contact lies inside the lock polygon', () => {
    expect(contacts.length).toBeGreaterThan(0)
    for (const c of contacts) expect(c.water.tags.water).toBe('lock')
  })
  it('the swept profiles start at the ground layers, step down past the water and face up/out to the lake', () => {
    const m = sweepChains(chains, profiles, LAKE_Y)
    expect(Object.keys(m).sort()).toEqual(['dockwall', 'limestone', 'riprap'])
    const ys = Object.values(m).flatMap((x) => x.positions.filter((_, i) => i % 3 === 1))
    expect(Math.max(...ys)).toBeCloseTo(EDGE_TOP, 6)
    expect(Math.min(...ys)).toBeLessThan(LAKE_Y - 0.5)
    // the revetment's promenade ledge at the measured lake-edge height (≈ 2.6 m over the water)
    expect(ys.some((y) => Math.abs(y - (LAKE_Y + shore.edgeAboveLakeM)) < 1e-6)).toBe(true)
    // a stepped revetment: its faces point to the lake (+x) or up, never back into the land
    const L = m.limestone
    for (let i = 0; i < L.normals.length; i += 3) expect(L.normals[i] > -1e-6 || L.normals[i + 1] > 0.5 || Math.abs(L.normals[i + 2]) > 0.5).toBe(true)
  })
  it('every profile is continuous from the edge top to under the water', () => {
    for (const [k, p] of Object.entries(profiles)) {
      expect(p[0]).toEqual([0, EDGE_TOP, null])
      expect(p[p.length - 1][1]).toBeLessThan(LAKE_Y)
      for (let i = 1; i < p.length; i++) { expect(p[i][0]).toBeGreaterThanOrEqual(p[i - 1][0]); expect(p[i][1]).toBeLessThanOrEqual(p[i - 1][1]) }
      void k
    }
  })
  it('the lock gate is a wall from the lock walls\' top down past the lake, facing the lake', () => {
    const g = gateWalls(chains, { bottom: LAKE_Y - 0.5 }).dockwall
    expect(area({ positions: g.positions.map((v, i) => (i % 3 === 1 ? 0 : v)) })).toBeCloseTo(0, 3) // vertical
    const ys = g.positions.filter((_, i) => i % 3 === 1)
    expect(Math.min(...ys)).toBeCloseTo(LAKE_Y - 0.5, 6)
    for (let i = 0; i < g.normals.length; i += 3) expect(g.normals[i]).toBeGreaterThan(0.99) // the lake is east
  })
  it('the gate only ever stands at the lock', () => {
    const { contacts: c2 } = shoreChains({ lakeWater: [lakeP], sunk: [W(rect(-50, -50, 0, 50), { water: 'river', _sunk: true })] })
    expect(c2.some((c) => c.water.tags.water !== 'lock')).toBe(true) // the build throws on this (a river meeting the lake outside the lock)
  })
})

describe('beaches slope into the lake', () => {
  // sand from the trail (x = 0) to the water (x = 100), land west, lake east; north and south ends against the park
  const beach = { outer: rect(0, -200, 100, 200), holes: [] }
  const lake = [{ outer: rect(100, -2000, 4000, 2000), holes: [] }]
  const top = GROUND_Y.beaches
  const s = beachSlope({ beaches: [beach], lakeWater: lake, lakeY: LAKE_Y, top, spec: shore.beach })
  it('meets the trail at the beach layer and the lake under its surface, rising monotonically', () => {
    expect(s.y([0, 0])).toBeCloseTo(top, 6)
    expect(s.y([100, 0])).toBeCloseTo(LAKE_Y - shore.beach.waterlineBelowM, 6)
    let prev = Infinity
    for (let x = 0; x <= 100; x += 5) { const y = s.y([x, 0]); expect(y).toBeLessThanOrEqual(prev + 1e-9); prev = y }
    expect(s.y([60, 0])).toBeGreaterThan(LAKE_Y) // the waterline is near the shore, not mid-beach
  })
  it('a draped beach mesh follows it; its land ends get a face from the street down to the sand', () => {
    const m = drape(flatMesh([beach], top), s.y)
    expect(Math.min(...m.positions.filter((_, i) => i % 3 === 1))).toBeLessThan(LAKE_Y)
    const r = beachRisers(s.landSegs, s.y, { top })
    expect(r.positions.length).toBeGreaterThan(0)
    expect(Math.min(...r.positions.filter((_, i) => i % 3 === 1))).toBeLessThan(LAKE_Y + 0.5)
  })
  it('every normal of the risers, banks and swept profiles is a unit vector (a zero normal blacks out the post-processing)', () => {
    const unit = (m) => { for (let i = 0; i < m.normals.length; i += 3) expect(Math.hypot(m.normals[i], m.normals[i + 1], m.normals[i + 2])).toBeCloseTo(1, 6) }
    unit(beachRisers(s.landSegs, s.y, { top }))
    unit(pondBank(W(rect(0, 0, 60, 40), { water: 'pond' }), { bankY: 0.08, spec: shore.ponds }).mesh)
    const lakeP = { outer: [[0, -500], [900, -500], [900, 500], [0, 500]], holes: [] }
    for (const m of Object.values(sweepChains(shoreChains({ lakeWater: [lakeP], within: { minX: -10, maxX: 10, minZ: -490, maxZ: 490 } }).chains, profiles, LAKE_Y))) unit(m)
  })
  it('a beach far from the lake (a volleyball court inland) stays flat', () => {
    expect(s.y([-1000, 0])).toBe(top)
  })
})

describe('nothing floats over the sunken lake', () => {
  it('ground drawn past the shoreline (a trail, a park) is cut off at the water', () => {
    const lake = [{ outer: rect(50, -500, 1000, 500), holes: [] }]
    const idx = polyIndex(lake)
    const trail = bufferPolyline([[0, -300], [80, 300]], 2, 0.12, {})
    const cut = cutAtWater(trail, idx, waterNear(lake, { minX: -100, minZ: -400, maxX: 200, maxZ: 400 }))
    for (let i = 0; i < cut.positions.length; i += 3) expect(cut.positions[i]).toBeLessThanOrEqual(50.001)
    expect(area(cut)).toBeGreaterThan(0)
    const far = bufferPolyline([[-400, -300], [-400, 300]], 2, 0.12, {})
    expect(cutAtWater(far, idx, waterNear(lake, { minX: -500, minZ: -400, maxX: 200, maxZ: 400 }))).toEqual(far) // untouched
  })
  it('breakwaters stand in the lake: 1.8 m over the water, footed under it', () => {
    const b = breakwaterBuildings([{ id: 1, points: [[0, 0], [100, 0]], tags: {} }])
    lowerBreakwaters(b, { lakeY: LAKE_Y, spec: shore.breakwater })
    expect(b[0].pieces[0]).toMatchObject({ base: LAKE_Y - shore.breakwater.belowLakeM, top: LAKE_Y + shore.breakwater.aboveLakeM })
  })
  it('a building out over the water runs down to it; one standing back on land does not', () => {
    const lake = [{ outer: rect(0, -500, 1000, 500), holes: [] }]
    const mk = (x) => ({ id: `b${x}`, polygons: [{ outer: rect(x - 20, 0, x, 20), holes: [] }], pieces: [{ outer: rect(x - 20, 0, x, 20), holes: [], base: 0, top: 10 }] })
    const near = mk(5), far = mk(-200) // near: its footprint (−15…5) reaches 5 m out over the water
    expect(lakeSkirts([near, far], { waterIdx: polyIndex(lake), lakeY: LAKE_Y })).toBe(1)
    expect(near.pieces[0].base).toBeCloseTo(LAKE_Y - 0.5, 6); expect(far.pieces[0].base).toBe(0)
  })
  it('edgeIndex finds the nearest segment', () => {
    const e = edgeIndex([[[0, 0], [100, 0]], [[0, 50], [100, 50]]])
    expect(e.nearest([50, 10], 100)).toBeCloseTo(10, 6)
    expect(e.nearest([50, 400], 100)).toBe(Infinity)
  })
})
