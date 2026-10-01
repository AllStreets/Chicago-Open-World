import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { matchBridgehouses, dressBridgehouses, loadReliefs, HOUSE_TRI_LIMIT, DUSABLE_TRI_LIMIT } from '../lib/bridgehouses.js'
import { polyIndex } from '../lib/riverLevel.js'

const data = JSON.parse(readFileSync(fileURLToPath(new URL('../data/bridgehouses.json', import.meta.url)), 'utf8'))
const levels = { river: -6.3, riverwalk: -5.3 }
// the river runs east–west between z −35 and 35; the bridge crosses it north–south
const water = [{ outer: [[-300, -35], [300, -35], [300, 35], [-300, 35]], holes: [] }]
const waterIdx = polyIndex(water)
const bridge = (o = {}) => ({ key: 'b', name: 'Test Bridge', centre: [0, 0], axis: [0, -1], span: 70, width: 22, houses: { count: 2, style: 'beaux-arts' }, railWayIds: [], ...o })
const sq = ([x, z], w = 6, d = w) => [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]]
let n = 0
const house = (at, name = 'Test Street Bridgehouse', w = 6) => { const outer = sq(at, w); return { id: `w${++n}`, osmId: n, name, tags: { building: 'service' }, polygons: [{ outer, holes: [] }], pieces: [{ outer, base: 0, top: 5 }] } }
const ys = (b) => b.extraMeshes.flatMap((m) => m.positions.filter((_, i) => i % 3 === 1))
const xzs = (meshes) => meshes.flatMap((m) => { const o = []; for (let i = 0; i < m.positions.length; i += 3) o.push([m.positions[i], m.positions[i + 2]]); return o })
const tris = (b) => b.extraMeshes.reduce((t, m) => t + m.positions.length / 9, 0)

let reliefs = null
beforeAll(async () => { reliefs = await loadReliefs(fileURLToPath(new URL('../heroes/out/', import.meta.url))) })

describe('matching OSM bridgehouses to their bridges', () => {
  it('finds the corner and which way the river lies', () => {
    const h = house([16, -38]), other = house([16, -38], 'Some Office'), far = house([400, -38])
    const m = matchBridgehouses([h, other, far], [bridge()], data.match)
    expect(m).toHaveLength(1)
    expect(m[0].b).toBe(h)
    expect(m[0].corner).toBe('ne')
    expect(m[0].riverDir[1]).toBeCloseTo(1)
    expect(m[0].outDir[1]).toBeCloseTo(-1)
    const sw = matchBridgehouses([house([-16, 38])], [bridge()], data.match)[0]
    expect(sw.corner).toBe('sw'); expect(sw.outDir[1]).toBeCloseTo(1)
  })
  it('skips railroad houses unless their bridge carries rails, and takes the nearest bridge', () => {
    expect(matchBridgehouses([house([16, -38], 'Canal Street Railroad Bridgehouse')], [bridge()], data.match)).toHaveLength(0)
    expect(matchBridgehouses([house([16, -38], 'Canal Street Railroad Bridgehouse')], [bridge({ railWayIds: [1] })], data.match)).toHaveLength(1)
    const m = matchBridgehouses([house([116, -38], 'Bridge House')], [bridge(), bridge({ key: 'c', centre: [100, 0] })], data.match)
    expect(m[0].bridge.key).toBe('c')
  })
})

describe('dressing the houses', () => {
  for (const style of ['beaux-arts', 'deco', 'moderne', 'modern', 'dusable']) {
    it(`${style}: hides the OSM box, stays on its footprint, runs down to the water at the river and not inland`, () => {
      const near = house([16, -38]), inland = house([16, -70])
      const b = bridge({ houses: { count: 2, style }, key: style === 'dusable' ? 'dusable' : 'b' })
      const r = dressBridgehouses({ buildings: [near, inland], bridges: [b], waterIdx, levels, data, reliefs })
      expect(r.matched).toBe(2)
      expect(r.bridgeKeys.has(b.key)).toBe(true)
      for (const h of [near, inland]) {
        expect(h.pieces.every((p) => p.hidden)).toBe(true)
        expect(h.bridgehouse.style).toBe(style)
        expect(h.extraMeshes.length).toBeGreaterThan(3)
        for (const m of h.extraMeshes) { expect(typeof m.part).toBe('string'); expect(m.facade).toBeTypeOf('number'); expect(m.positions.length % 9).toBe(0) }
        const c = h === near ? [16, -38] : [16, -70]
        for (const [x, z] of xzs(h.extraMeshes)) { expect(Math.abs(x - c[0])).toBeLessThan(3 + 1.6); expect(Math.abs(z - c[1])).toBeLessThan(3 + 1.6) }
        expect(tris(h)).toBeLessThanOrEqual(style === 'dusable' ? DUSABLE_TRI_LIMIT : HOUSE_TRI_LIMIT)
      }
      expect(Math.min(...ys(near))).toBeCloseTo(levels.river - 0.5, 1)
      expect(Math.min(...ys(inland))).toBeGreaterThan(-0.05)
      const top = Math.max(...ys(near)), spec = data.styles[style]
      expect(top).toBeGreaterThanOrEqual(spec.bodyM - 0.01)
      expect(top).toBeLessThan((spec.atticM ?? spec.bodyM) + (spec.roofM ?? 1.5) + 0.01)
    })
  }
  it('without levels (the flat world) the houses start at the street', () => {
    const h = house([16, -38])
    dressBridgehouses({ buildings: [h], bridges: [bridge()], waterIdx: null, levels: null, data, reliefs })
    expect(Math.min(...ys(h))).toBeGreaterThan(-0.05)
  })
  it('is deterministic', () => {
    const run = () => { const h = house([16, -38]); dressBridgehouses({ buildings: [h], bridges: [bridge({ key: 'dusable', houses: { count: 4, style: 'dusable' } })], waterIdx, levels, data, reliefs }); return JSON.stringify(h.extraMeshes.map((m) => [m.part, m.positions.slice(0, 60)])) }
    expect(run()).toBe(run())
  })
})

describe('the DuSable bridgehouses', () => {
  const dus = () => bridge({ key: 'dusable', houses: { count: 4, style: 'dusable' }, width: 28, span: 78 })
  it('loads the four Blender reliefs', () => {
    for (const k of ['discoverers', 'pioneers', 'defense', 'regeneration']) { expect(reliefs[k]).toBeTruthy(); expect(reliefs[k].positions.length / 9).toBeLessThanOrEqual(2200) }
  })
  it('each relief is on its sourced corner, high on the face away from the river', () => {
    const at = { nw: [-18, -42], ne: [18, -42], sw: [-18, 42], se: [18, 42] }
    const hs = Object.fromEntries(Object.entries(at).map(([k, p]) => [k, house(p, 'DuSable Bridgehouse')]))
    dressBridgehouses({ buildings: Object.values(hs), bridges: [dus()], waterIdx, levels, data, reliefs })
    for (const [corner, h] of Object.entries(hs)) {
      const name = data.dusable.reliefs[corner], rel = h.extraMeshes.filter((m) => m.part === `relief:${name}`)
      expect(rel).toHaveLength(1)
      const out = [0, at[corner][1] < 0 ? -1 : 1], c = at[corner]
      const p = xzs(rel), y = rel[0].positions.filter((_, i) => i % 3 === 1)
      const mean = p.reduce((s, q) => [s[0] + q[0] / p.length, s[1] + q[1] / p.length], [0, 0])
      expect((mean[0] - c[0]) * out[0] + (mean[1] - c[1]) * out[1]).toBeGreaterThan(2.9) // proud of the outward face
      expect(Math.min(...y)).toBeGreaterThan(3)                                         // high above the sidewalk
      expect(Math.max(...y)).toBeLessThan(data.styles.dusable.bodyM)
      // most of its area faces outward
      let fwd = 0, back = 0
      const m = rel[0]
      for (let i = 0; i < m.positions.length; i += 9) {
        const a = m.positions.slice(i, i + 3), b = m.positions.slice(i + 3, i + 6), d = m.positions.slice(i + 6, i + 9)
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]
        const nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], A = Math.hypot(...nn) / 2
        const dir = (m.normals[i] * out[0] + m.normals[i + 2] * out[1])
        if (dir > 0.5) fwd += A; else if (dir < -0.5) back += A
      }
      expect(fwd).toBeGreaterThan(back * 1.4) // a round figure turns half its skin to the wall
    }
    expect(hs.sw.name).toBe('McCormick Bridgehouse & Chicago River Museum')
    expect(hs.sw.extraMeshes.some((m) => m.part === 'museum-door')).toBe(true)
  })
  it('falls back to procedural figures without the Blender exports', () => {
    const h = house([-18, -42], 'DuSable Bridgehouse')
    dressBridgehouses({ buildings: [h], bridges: [dus()], waterIdx, levels, data, reliefs: null })
    expect(h.extraMeshes.some((m) => m.part === 'relief:discoverers')).toBe(true)
  })
})
