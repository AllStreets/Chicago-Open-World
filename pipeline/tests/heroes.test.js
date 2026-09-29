import { describe, it, expect } from 'vitest'
import { seedForTint, applyHero } from '../lib/heroes.js'
const sq = (x, z, s) => [[x, z], [x + s, z], [x + s, z - s], [x, z - s]]
const bldg = (o = {}) => ({ id: 'h', area: 400, centroid: [10, -10], height: 100, parts: null, polygons: [{ outer: sq(0, 0, 20), holes: [] }], ...o })
const bucket = (s) => { const g = (s * 3.7) % 1; return g < 0.28 ? 'dark' : g < 0.5 ? 'green' : g < 0.78 ? 'silver' : 'blue' }
describe('heroes', () => {
  it('seedForTint lands in the shader bucket', () => {
    for (const t of ['dark', 'green', 'silver', 'blue']) expect(bucket(seedForTint(t))).toBe(t)
  })
  it('tiers stack scaled footprints; heightM sets the top', () => {
    const { pieces } = applyHero(bldg(), { heightM: 150, tiers: [{ scale: 0.5, from: 100, to: 150 }], crowns: [] })
    expect(pieces.map((p) => [p.base, p.top])).toEqual([[0, 100], [100, 150]])
    const xs = pieces[1].outer.map((p) => p[0])
    expect(Math.min(...xs)).toBeCloseTo(5); expect(Math.max(...xs)).toBeCloseTo(15)
  })
  it('heightM without tiers lifts the tallest body pieces', () => {
    const { pieces } = applyHero(bldg(), { heightM: 180, crowns: [] })
    expect(Math.max(...pieces.map((p) => p.top))).toBe(180)
  })
  it('crowns become extra meshes at centroid-relative positions', () => {
    const { extraMeshes } = applyHero(bldg(), { crowns: [{ type: 'spire', at: [0, 0], base: 100, top: 160, r0: 3 }] })
    expect(extraMeshes).toHaveLength(1)
    const ys = extraMeshes[0].positions.filter((_, i) => i % 3 === 1)
    expect(Math.max(...ys)).toBe(160)
    const xs = extraMeshes[0].positions.filter((_, i) => i % 3 === 0)
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(10, 0)
  })
  it('taper + antenna reseat (Hancock) is expressible as a spec', () => {
    const body = { outer: sq(0, 0, 20), holes: [], base: 0, top: 337 }
    const mast = { outer: sq(18, -1, 0.8), holes: [], base: 0, top: 457 }
    const { pieces } = applyHero(bldg({ parts: [body, mast], height: 0 }), { taper: { topScale: 0.62 }, crowns: [] })
    expect(pieces.find((p) => p.top === 337).taper.topScale).toBe(0.62)
    expect(pieces.find((p) => p.top === 457).base).toBeCloseTo(337 * 0.98)
  })
  it('sets façade and tint overrides', () => {
    const b = bldg()
    applyHero(b, { facade: 'precast-concrete', tint: 'dark', crowns: [] })
    expect(b.facadeOverride).toBe('precast-concrete')
    expect(bucket(b.seedOverride)).toBe('dark')
  })
  it('stands: a grandstand ring with an open field in the middle', () => {
    const big = bldg({ polygons: [{ outer: sq(0, 0, 200), holes: [] }], area: 40000, centroid: [100, -100] })
    const { pieces } = applyHero(big, { heightM: 28, stands: 40, crowns: [] })
    expect(pieces).toHaveLength(1)
    expect(pieces[0]).toMatchObject({ base: 0, top: 28 })
    expect(pieces[0].holes).toHaveLength(1)
  })
  it('vault and stepdome crowns default to the footprint ring', () => {
    const { extraMeshes } = applyHero(bldg(), { crowns: [{ type: 'vault', base: 100, rise: 5, axis: [0, -1] }] })
    const y = extraMeshes[0].positions.filter((_, i) => i % 3 === 1)
    expect(Math.max(...y)).toBeCloseTo(105, 5)
    expect(Math.min(...y)).toBeCloseTo(100, 5)
    const s = applyHero(bldg(), { crowns: [{ type: 'stepdome', base: 100, steps: [{ inset: 2, rise: 1 }], domeRise: 3 }] })
    expect(Math.max(...s.extraMeshes[0].positions.filter((_, i) => i % 3 === 1))).toBeGreaterThan(103.8)
  })
  it('the arena heroes carry sourced vault / stepdome roofs', async () => {
    const { readFileSync } = await import('node:fs')
    const H = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes
    const uc = H.find((h) => h.key === 'unitedcenter'), wt = H.find((h) => h.key === 'wintrust')
    expect(uc.crowns[0]).toMatchObject({ type: 'stepdome', base: 30 })
    expect(wt.crowns[0]).toMatchObject({ type: 'vault', base: 25 })
    for (const c of [uc.crowns[0], wt.crowns[0]]) expect(c.source).toMatch(/\w/)
  })
  it('a crown can carry its own surface (arena roofs are membranes, not the brick wall)', () => {
    const { extraMeshes } = applyHero(bldg(), { crowns: [{ type: 'vault', base: 100, rise: 5, axis: [0, -1], surface: { facade: 'steel', style: 'white' } }] })
    expect(extraMeshes[0]).toMatchObject({ facade: 13, seed: 0.6 })
    expect(applyHero(bldg(), { crowns: [{ type: 'vault', base: 100, rise: 5 }] }).extraMeshes[0].facade).toBeUndefined()
  })
})

import { parseOsmRef, matchesOsm, findByOsm } from '../lib/heroes.js'

describe('typed OSM refs (H3)', () => {
  const way = { id: 'w16699535', osmId: 16699535 }, rel = { id: 'r16699535', osmId: 16699535 }, other = { id: 'w1', osmId: 1 }
  it('a typed ref picks the right element when a way and a relation share an id', () => {
    expect(findByOsm([way, rel, other], 'r16699535')).toBe(rel)
    expect(findByOsm([way, rel, other], 'w16699535')).toBe(way)
  })
  it('a bare numeric id still works when it is unambiguous', () => {
    expect(findByOsm([rel, other], 16699535)).toBe(rel)
    expect(findByOsm([rel, other], '16699535')).toBe(rel)
    expect(findByOsm([other], 16699535)).toBe(null)
  })
  it('a bare id that matches both a way and a relation is an error, not a silent pick', () => {
    expect(() => findByOsm([way, rel], 16699535)).toThrow(/ambiguous OSM id 16699535/)
  })
  it('suppress lists and overrides accept typed refs', () => {
    expect(matchesOsm(way, 'r16699535')).toBe(false)
    expect(matchesOsm(rel, 'r16699535')).toBe(true)
    expect(matchesOsm(rel, 16699535)).toBe(true)
  })
  it('rejects malformed refs', () => {
    expect(() => parseOsmRef('x12')).toThrow(/bad OSM ref/)
  })
})
