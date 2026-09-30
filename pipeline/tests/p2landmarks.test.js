// pipeline/tests/p2landmarks.test.js
import { describe, it, expect } from 'vitest'
import { lighthouse, beachHouse, pagoda, gate, boardwalkArches, ribbonRink, canopy, doricColonnade } from '../lib/p2landmarks.js'

const allYs = (r) => r.meshes.flatMap(({ mesh }) => mesh.positions.filter((_, i) => i % 3 === 1))
const tris = (r) => r.meshes.reduce((n, { mesh }) => n + mesh.positions.length / 9, 0)
const square = (s) => ({ polygons: [{ outer: [[-s, -s], [s, -s], [s, s], [-s, s]], holes: [] }], centroid: [0, 0], area: 4 * s * s })

describe('P2 builders', () => {
  it('lighthouse is ~14 m tall above its base and has a lantern part', () => {
    const r = lighthouse({ at: [0, 0], base: 2 }, {})
    expect(Math.max(...allYs(r)) - 2).toBeGreaterThan(12); expect(Math.max(...allYs(r)) - 2).toBeLessThan(18)
    expect(r.meshes.some((m) => m.part === 'lantern')).toBe(true)
  })
  it('pagoda has the requested number of roof tiers', () => {
    const r = pagoda({ at: [0, 0], tiers: 4, baseW: 10, tierH: 3 })
    expect(r.meshes.filter((m) => m.part === 'roof')).toHaveLength(4)
  })
  it('gate spans the street and stays under its height', () => {
    const r = gate({ at: [0, 0], spanM: 16, heightM: 12, bearingDeg: 0 })
    const xs = r.meshes.flatMap(({ mesh }) => mesh.positions.filter((_, i) => i % 3 === 0))
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(16)
    expect(Math.max(...allYs(r))).toBeLessThanOrEqual(12.01)
  })
  it('ribbon rink lies flat on the ground', () => {
    const r = ribbonRink([[0, 0], [30, 0], [30, 30], [0, 30], [0, 0]], 4)
    for (const y of allYs(r)) expect(y).toBeCloseTo(0.05, 2)
  })
  it('every builder stays under 15 k tris', () => {
    for (const r of [lighthouse({ at: [0, 0], base: 0 }, {}), beachHouse(square(20), { style: 'ship' }), pagoda({ at: [0, 0], tiers: 4, baseW: 10, tierH: 3 }),
      gate({ at: [0, 0], spanM: 16, heightM: 12, bearingDeg: 0 }), boardwalkArches({ at: [0, 0], count: 9, spanM: 12, heightM: 8 }),
      canopy({ at: [0, 0], w: 60, d: 50, peakH: 22, masts: 4 }), doricColonnade({ from: [0, 0], to: [80, 0], columns: 16, r: 1.1, h: 14 })])
      expect(tris(r)).toBeLessThan(15000)
  })
  it('doric colonnade places exactly the requested number of columns', () => {
    const r = doricColonnade({ from: [0, 0], to: [80, 0], columns: 16, r: 1.1, h: 14 })
    expect(r.meshes.filter((m) => m.part === 'column')).toHaveLength(16)
  })
})

function frontFacing(m) {
  for (let i = 0; i < m.positions.length; i += 9) {
    const p = m.positions.slice(i, i + 9), n = m.normals.slice(i, i + 3)
    const u = [p[3] - p[0], p[4] - p[1], p[5] - p[2]], v = [p[6] - p[0], p[7] - p[1], p[8] - p[2]]
    const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    if (c[0] * n[0] + c[1] * n[1] + c[2] * n[2] <= 0) return false
  }
  return true
}
describe('P2 builders — winding (review focus 3)', () => {
  it('every triangle of every P2 builder faces along its normal', () => {
    for (const r of [lighthouse({ at: [0, 0], base: 0 }, {}), beachHouse(square(20), { style: 'ship' }), beachHouse(square(8), { style: 'small' }), pagoda({ at: [0, 0], tiers: 4, baseW: 10, tierH: 3 }),
      gate({ at: [0, 0], spanM: 16, heightM: 12, bearingDeg: 0 }), boardwalkArches({ at: [0, 0], count: 9, spanM: 12, heightM: 8 }), ribbonRink([[0, 0], [30, 0], [30, 30], [0, 30], [0, 0]], 4),
      canopy({ at: [0, 0], w: 60, d: 50, peakH: 22, masts: 4 }), doricColonnade({ from: [0, 0], to: [80, 0], columns: 16, r: 1.1, h: 14 })])
      for (const { mesh, part } of r.meshes) expect([part, frontFacing(mesh)]).toEqual([part, true])
  })
})

import { muralQuads, MURAL_FACADE0 } from '../lib/p2landmarks.js'
describe('Pilsen murals (Task 10)', () => {
  it('mural quads sit just off the wall and use one of four mural layers', () => {
    const r = muralQuads([{ a: [0, 0], b: [20, 0], base: 0.5, top: 9, layer: 2 }])
    expect(r.meshes).toHaveLength(1)
    expect(r.meshes[0].facade).toBe(MURAL_FACADE0 + 2)
    const zs = r.meshes[0].mesh.positions.filter((_, i) => i % 3 === 2)
    for (const z of zs) expect(Math.abs(z)).toBeCloseTo(0.05, 2)
  })
  it('faces the side it is told to, and repeats the design along a long wall instead of stretching it', () => {
    const r = muralQuads([{ a: [0, 0], b: [30, 0], base: 0.5, top: 7.5, layer: 1, out: [0, 1] }])
    const m = r.meshes[0].mesh
    for (let i = 2; i < m.normals.length; i += 3) expect(m.normals[i]).toBeCloseTo(1)
    expect(Math.max(...m.uvs.filter((_, i) => i % 2 === 0))).toBeGreaterThanOrEqual(3)
    expect(frontFacing(m)).toBe(true)
  })
})

import { P2_BUILDERS } from '../lib/p2landmarks.js'
describe('harbour light on its breakwater', () => {
  it('adds the breakwater under the light when the spec asks for one, level with its base', () => {
    const b = { polygons: [{ outer: [[-8, -8], [8, -8], [8, 8], [-8, 8]], holes: [] }], centroid: [0, 0], area: 256 }
    const r = P2_BUILDERS.lighthouse(b, { base: 2, breakwater: { bearingDeg: 0, aheadM: 260, behindM: 60, widthM: 9 } })
    const bw = r.meshes.find((m) => m.part === 'breakwater')
    const zs = bw.mesh.positions.filter((_, i) => i % 3 === 2), ys = bw.mesh.positions.filter((_, i) => i % 3 === 1)
    expect(Math.min(...zs)).toBeCloseTo(-260, 0); expect(Math.max(...zs)).toBeCloseTo(60, 0) // north is −z
    expect(Math.max(...ys)).toBeCloseTo(2)
  })
})
