// pipeline/tests/riverbases.test.js — A-8: the river icons' river-level bases (the walk on piles, the stairs down the
// dockwall, the stone plinths, Marina City's platform and marina, Apple's steps and pavilion) and the "done when" rule:
// every listed building whose footprint comes within 3 m of the river reaches down to the water.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildRiverBases, frontage, walkAlong, stairDown, plinth, docksAlong, stepsDown, applePavilion, checkReachesWater, RB } from '../lib/riverbases.js'
import { sunkWater, wallRuns, polyIndex, applySkirts } from '../lib/riverLevel.js'
import { ringBBox, ringCentroid } from '../lib/geom.js'

const L = JSON.parse(readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8')).levels
const levels = { river: L.RIVER_Y, riverwalk: L.RIVERWALK_Y }
const spec = JSON.parse(readFileSync(new URL('../data/riverbases.json', import.meta.url), 'utf8'))

// A straight river south of z = 0 (x −200…200); a building on the north bank, 2 m back from the dockwall.
const water = sunkWater([{ outer: [[-200, 0], [200, 0], [200, 60], [-200, 60]], holes: [], tags: { natural: 'water', water: 'river' } }])
const waterIdx = polyIndex(water)
const bldg = (outer, id = 'w1') => ({ id, osmId: 1, polygons: [{ outer, holes: [] }], centroid: ringCentroid(outer), bbox: ringBBox(outer), pieces: [{ outer, holes: [], base: 0, top: 60 }] })
const B = bldg([[-30, -40], [30, -40], [30, -2], [-30, -2]])
const runs = wallRuns({ water, riverY: levels.river })
const ys = (ms) => ms.flatMap((m) => m.positions.filter((_, i) => i % 3 === 1))
const xs = (ms, k) => ms.flatMap((m) => m.positions.filter((_, i) => i % 3 === k))

describe('frontage', () => {
  it('is the dockwall in front of the building, its normal pointing onto the land', () => {
    const f = frontage(B, runs, { reach: 10 })
    expect(f.length).toBeGreaterThan(0)
    const total = f.reduce((t, s) => t + s.len, 0)
    expect(total).toBeGreaterThan(70) // the 60 m face ± the 10 m reach
    expect(total).toBeLessThan(82)
    for (const s of f) { expect(Math.abs(s.a[1])).toBeLessThan(0.01); expect(s.n[1]).toBeLessThan(-0.99) }
  })
  it('ignores the far bank', () => { expect(frontage(B, runs, { reach: 10 }).every((s) => s.a[1] < 1)).toBe(true) })
})

describe('the walk on piles and the stairs down to it', () => {
  const f = frontage(B, runs, { reach: 10 })
  const walk = walkAlong(f, { width: 5, y: levels.riverwalk, riverY: levels.river })
  it('stands out over the water at RIVERWALK_Y, its piles in the river', () => {
    const deck = walk.find((m) => m.part === 'river-walk')
    expect(Math.max(...ys([deck]))).toBeCloseTo(levels.riverwalk, 5)
    expect(Math.min(...xs([deck], 2))).toBeGreaterThan(-0.4) // never on the land side of the wall
    expect(Math.max(...xs([deck], 2))).toBeLessThan(5.1)
    expect(Math.min(...ys([walk.find((m) => m.part === 'piles')]))).toBeLessThan(levels.river - 0.5) // into the river, below the water line
  })
  it('has a railing along its water edge and lamps every 18 m', () => {
    expect(walk.some((m) => m.part === 'railing')).toBe(true)
    expect(walk.find((m) => m.part === 'lantern').positions.length / 108).toBeGreaterThanOrEqual(3)
  })
  it('the stairs run down the wall face from the street to the walk, ≈ 6¾ in risers', () => {
    const s = stairDown(f[0], { at: 5, dir: 1, y1: levels.riverwalk })
    const yy = ys(s.meshes.filter((m) => m.part === 'stairs'))
    expect(Math.max(...yy)).toBeCloseTo(0, 5)
    expect(Math.min(...yy)).toBeLessThan(levels.riverwalk)
    expect(s.run / RB.tread + 1).toBeCloseTo(Math.round(-levels.riverwalk / RB.riser), 0)
    expect(Math.max(...xs(s.meshes, 2))).toBeLessThan(RB.stairW + 0.2) // inside the walk's width over the water
  })
})

describe('the plinth', () => {
  it('faces the river below the street on the edges near the water, down to the river', () => {
    const p = plinth(B, { waterIdx, bottom: levels.river - 0.5, style: 'x' })
    expect(p.edges.length).toBe(1) // only the south face
    const face = p.meshes.find((m) => m.part === 'river-plinth')
    expect(Math.min(...ys([face]))).toBeCloseTo(levels.river - 0.5, 5)
    expect(Math.max(...ys([face]))).toBeCloseTo(0, 5)
  })
  it('cuts arched openings at the walk level when asked', () => {
    const p = plinth(B, { waterIdx, bottom: levels.river - 0.5, style: 'x', arches: { every: 6, w: 3, h: 3.4, y0: levels.riverwalk } })
    const dark = p.meshes.find((m) => m.part === 'river-arcade')
    expect(dark.positions.length / 9).toBeGreaterThan(9 * 8)
    expect(Math.min(...ys([dark]))).toBeCloseTo(levels.riverwalk, 5)
  })
})

describe('marina, steps and pavilion', () => {
  it('docks float at the water with finger slips and moored boats', () => {
    const d = docksAlong(frontage(B, runs, { reach: 10 }), { riverY: levels.river, boats: 4 })
    const slips = d.find((m) => m.part === 'boat-slips')
    expect(Math.max(...ys([slips]))).toBeCloseTo(levels.river + RB.dock.freeboard, 5)
    expect(d.filter((m) => m.part === 'boat').length).toBe(4)
    expect(Math.min(...ys(d.filter((m) => m.part === 'boat')))).toBeGreaterThan(levels.river - 0.6)
  })
  it('steps cut into the land: each a riser down, ending at the landing, with their own sunken zone', () => {
    const s = stepsDown({ from: [0, -30], to: [0, -6], width: 12, y1: levels.riverwalk })
    expect(s.zone.y).toBe(levels.riverwalk)
    expect(s.count).toBe(Math.round(-levels.riverwalk / RB.riser))
    expect(Math.max(...ys([s.mesh]))).toBeCloseTo(0, 5)
  })
  it('Apple: glass from the landing to a thin roof 33.8 × 29.8 m', () => {
    const ring = [[-14, -30], [14, -30], [14, -6], [-14, -6]]
    const p = applePavilion(ring, { y0: levels.riverwalk, roofTop: 4.4, L: 33.8, W: 29.8 })
    const roof = p.find((m) => m.part === 'carbon-roof'), bb = [Math.min(...xs([roof], 0)), Math.max(...xs([roof], 0)), Math.min(...xs([roof], 2)), Math.max(...xs([roof], 2))]
    expect(bb[1] - bb[0]).toBeCloseTo(33.8, 0)
    expect(bb[3] - bb[2]).toBeCloseTo(29.8, 0)
    expect(Math.max(...ys([roof])) - Math.min(...ys([roof]))).toBeLessThan(0.5) // impossibly thin
    expect(Math.min(...ys(p.filter((m) => m.part === 'glass-walls')))).toBeCloseTo(levels.riverwalk, 5)
  })
})

describe('A-8 done when: the listed river-front buildings reach the water', () => {
  it('a building within 3 m of the river reaches RIVER_Y after the skirts and its base', () => {
    const b = bldg([[-30, -40], [30, -40], [30, -2], [-30, -2]])
    expect(checkReachesWater(b, { waterIdx, riverY: levels.river }).ok).toBe(false)
    applySkirts([b], { waterIdx, riverY: levels.river })
    expect(checkReachesWater(b, { waterIdx, riverY: levels.river }).ok).toBe(true)
  })
  it('a building far from the river is not asked to', () => {
    expect(checkReachesWater(bldg([[-30, -60], [30, -60], [30, -30], [-30, -30]]), { waterIdx, riverY: levels.river }).near).toBe(false)
  })
  it('buildRiverBases dresses a site and attaches its meshes to the building', () => {
    const site = { key: 't', osm: 'w1', walk: { width: 5 }, stairs: [{ at: 3 }], plinth: { style: 'x' }, docks: { boats: 2 } }
    const b = bldg([[-30, -40], [30, -40], [30, -2], [-30, -2]])
    const r = buildRiverBases({ spec: { sites: [site] }, buildings: [b], water, levels, findBuilding: () => b })
    expect(r.attach[0].building).toBe(b)
    expect(r.report[0].parts).toEqual(expect.arrayContaining(['walk', 'stairs', 'docks']))
    const r2 = buildRiverBases({ spec: { sites: [site] }, buildings: [b], water, levels, findBuilding: () => b })
    expect(r2.attach[0].meshes.map((m) => m.positions.length)).toEqual(r.attach[0].meshes.map((m) => m.positions.length)) // deterministic
  })
})

describe('data/riverbases.json', () => {
  it('covers the A-8 list (A1, A3, A4, A7, A9, A10, A11, A13, A14, A17, A24, A32) with sources', () => {
    const want = ['wrigleybldg', 'trump', 'marina1', 'mart', 'riverside150', 'riverpoint', 'wolfpointeast', 'riversideplaza', 'civicopera', 'rivercity', 'lasalle300', 'applemichigan']
    const keys = spec.sites.map((s) => s.key)
    for (const k of want) expect(keys).toContain(k)
    for (const s of spec.sites) { expect(s.source?.length, s.key).toBeGreaterThan(0); expect(s.about, s.key).toBeTruthy() }
  })
  it('every per-site triangle budget stays under the hero limit (≤ 40 k)', () => {
    for (const s of spec.sites) expect(s.maxTris ?? 40000).toBeLessThanOrEqual(40000)
  })
})
