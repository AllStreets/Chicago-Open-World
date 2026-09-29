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
})
