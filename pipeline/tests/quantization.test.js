// X-0b / V2: the tile glb quantisation — normals ≥ 10 bits, metric UVs within 2 mm, custom attributes exact, positions
// exactly as every baseline was taken (14 bits per mesh volume; 16 bits was measured and rejected for parity) — and the
// measurement agrees with what writeTileGlb actually writes.
import { describe, it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { writeTileGlb, quantizationError, V2_LIMITS, POSITION_BITS, snapUvs, EXACT_UV_FACADES } from '../lib/tilepack.js'

// a "tile" of smooth curved towers corner to corner (worst case for faceting), metric UVs far from the origin
function towers({ extent = 500, n = 6, seg = 48, h = 300, off = [-9000, 0, 6000] } = {}) {
  const m = { positions: [], normals: [], uvs: [], extra: { FACADE: [], BLDG: [], SEED: [] } }
  for (let k = 0; k < n; k++) {
    const cx = off[0] + (k / (n - 1)) * (extent - 40) + 20, cz = off[2] + ((n - 1 - k) / (n - 1)) * (extent - 40) + 20, r = 12 + k * 1.7
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

describe('tile quantisation (X-0b · V2)', () => {
  it('a 520 m tile of curved towers: positions as the 14-bit baseline, normals and UVs inside the limits, ids exact', async () => {
    const e = (await quantizationError({ buildings: towers({ extent: 520 }) })).buildings
    expect(POSITION_BITS).toBe(14)
    const half = 520 / 2 + 20 // the mesh volume's half-extent, near enough
    expect(e.positionM).toBeLessThanOrEqual((Math.sqrt(3) * half) / 8191) // ≤ one 14-bit step of 3-D displacement
    expect(e.normalDeg).toBeLessThanOrEqual(V2_LIMITS.normalDeg)
    expect(e.uvM).toBeLessThanOrEqual(V2_LIMITS.uvM)
    expect(e.customExact).toBe(true) // integer ids (_FACADE, _BLDG, …) exact
    expect(e.fracErr).toBeLessThanOrEqual(V2_LIMITS.fracCustom) // _SEED: as before
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
    await writeTileGlb(path, layers)
    const doc = await read(path)
    const node = doc.getRoot().listNodes()[0], pos = node.getMesh().listPrimitives()[0].getAttribute('POSITION')
    const t = node.getTranslation(), s = node.getScale()
    const written = new Set()
    for (let i = 0; i < pos.getCount(); i++) { const p = pos.getElement(i, []); written.add(p.map((v, k) => (v * s[k] + t[k]).toFixed(4)).join(',')) }
    const e = await quantizationError(layers, { keepPositions: true })
    for (const p of e.buildings.positions) expect(written.has(p.map((v) => v.toFixed(4)).join(','))).toBe(true)
  })
})
