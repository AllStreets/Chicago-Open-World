// X-0b / V2: the tile glb quantisation stays inside the visual-parity limits — positions ≤ 1 cm at LOD0 and ≤ 5 cm at
// LOD1 and in far blocks, normals ≥ 10 bits, metric UVs within 2 mm, custom attributes exact — and the measurement
// agrees with what writeTileGlb actually writes.
import { describe, it, expect } from 'vitest'
import { mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { writeTileGlb, quantizationError, V2_LIMITS, POSITION_BITS, snapUvs, EXACT_UV_FACADES } from '../lib/tilepack.js'

// a 500 m "tile" of smooth curved towers (worst case for stair-stepping and faceting), metric UVs far from the origin
function towers({ extent = 500, n = 6, seg = 48, h = 300, off = [-9000, 0, 6000] } = {}) {
  const m = { positions: [], normals: [], uvs: [], extra: { FACADE: [], BLDG: [], SEED: [] } }
  for (let k = 0; k < n; k++) {
    const cx = off[0] + (k / (n - 1)) * (extent - 40) + 20, cz = off[2] + ((n - 1 - k) / (n - 1)) * (extent - 40) + 20, r = 12 + k * 1.7 // corner to corner: the widest volume
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2
      const P = (a, y) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r], N = (a) => [Math.cos(a), 0, Math.sin(a)]
      const u0 = 9000 + r * a0, u1 = 9000 + r * a1
      const quad = [[P(a0, 0), N(a0), [u0, 0]], [P(a1, 0), N(a1), [u1, 0]], [P(a1, h), N(a1), [u1, h]], [P(a0, 0), N(a0), [u0, 0]], [P(a1, h), N(a1), [u1, h]], [P(a0, h), N(a0), [u0, h]]]
      for (const [p, nn, t] of quad) { m.positions.push(...p); m.normals.push(...nn); m.uvs.push(...t); m.extra.FACADE.push(k === 0 ? 28 : 3); m.extra.BLDG.push(k * 1000 + 7); m.extra.SEED.push(0.123) }
    }
  }
  m.extra = Object.fromEntries(Object.entries(m.extra).map(([k, v]) => [k, new Float32Array(v)]))
  return m
}

const read = async (path) => {
  await MeshoptDecoder.ready
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read(path)
}

describe('V2 quantisation limits (X-0b)', () => {
  it('declares the plan limits', () => {
    expect(V2_LIMITS.lod0.positionM).toBeLessThanOrEqual(0.01)
    expect(V2_LIMITS.lod1.positionM).toBeLessThanOrEqual(0.05)
    expect(V2_LIMITS.normalBits).toBeGreaterThanOrEqual(10)
    for (const lod of ['lod0', 'lod1', 'block']) expect(POSITION_BITS[lod]).toBeGreaterThanOrEqual(16) // V2: ≥ 16 bits per axis
  })
  for (const [lod, extent] of [['lod0', 520], ['lod1', 520], ['block', 2100]]) {
    it(`${lod}: a ${extent} m tile of curved towers stays inside the limits`, async () => {
      const e = await quantizationError({ buildings: towers({ extent }) }, { lod })
      const b = e.buildings
      expect(b.positionM).toBeLessThanOrEqual(V2_LIMITS[lod].positionM)
      expect(b.normalDeg).toBeLessThanOrEqual(V2_LIMITS.normalDeg)
      expect(b.uvM).toBeLessThanOrEqual(V2_LIMITS.uvM)
      expect(b.customExact).toBe(true) // integer ids (_FACADE, _BLDG, …) exact
      expect(b.fracErr).toBeLessThanOrEqual(V2_LIMITS.fracCustom) // _SEED: as before
    })
  }
  it('a LOD0 layer too big for 1 cm at 16 bits (a 2 km pier) keeps float32 positions, and the file still reads', async () => {
    const layers = { buildings: towers({ extent: 2000, n: 3, seg: 8 }), ground: towers({ extent: 400, n: 2, seg: 8 }) }
    const e = await quantizationError(layers, { lod: 'lod0' })
    expect(e.buildings.bits).toBe(32); expect(e.buildings.positionM).toBeLessThan(0.001)
    expect(e.ground.bits).toBe(16); expect(e.ground.positionM).toBeLessThanOrEqual(0.01)
    const path = join(mkdtempSync(join(tmpdir(), 'q-')), 'big.glb')
    await writeTileGlb(path, layers, { lod: 'lod0' })
    const doc = await read(path)
    const types = Object.fromEntries(doc.getRoot().listNodes().map((n) => [n.getName(), n.getMesh().listPrimitives()[0].getAttribute('POSITION').getComponentType()]))
    expect(types).toEqual({ buildings: 5126, ground: 5122 })
  })
  it('UV snapping is 1/256 m and leaves the normalised-UV façades (Crown Fountain, murals, fields) exact', () => {
    const m = { uvs: [1000.12345, 3.0001, 0.123456, 0.987654], extra: { FACADE: new Float32Array([3, EXACT_UV_FACADES.values().next().value]) } }
    const s = snapUvs(m)
    expect(s[0]).toBe(Math.round(1000.12345 * 256) / 256); expect(s[1]).toBe(3)
    expect(s[2]).toBe(Math.fround(0.123456)); expect(s[3]).toBe(Math.fround(0.987654))
  })
  it('the measured positions are the ones written (same quantisation path)', async () => {
    const layers = { buildings: towers({ extent: 520, n: 2, seg: 8 }) }
    const path = join(mkdtempSync(join(tmpdir(), 'q-')), 't.glb')
    await writeTileGlb(path, layers, { lod: 'lod0' })
    expect(statSync(path).size).toBeGreaterThan(0)
    const doc = await read(path)
    const node = doc.getRoot().listNodes()[0], prim = node.getMesh().listPrimitives()[0], pos = prim.getAttribute('POSITION')
    const t = node.getTranslation(), s = node.getScale()
    const written = new Set()
    for (let i = 0; i < pos.getCount(); i++) { const p = pos.getElement(i, []); written.add(p.map((v, k) => (v * s[k] + t[k]).toFixed(4)).join(',')) }
    const e = await quantizationError(layers, { lod: 'lod0', keepPositions: true })
    for (const p of e.buildings.positions) expect(written.has(p.map((v) => v.toFixed(4)).join(','))).toBe(true)
  })
})
