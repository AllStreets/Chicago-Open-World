import { describe, it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { clipPolysToTile, splitLineByTiles, writeTileGlb } from '../lib/tilepack.js'
import { signedArea } from '../lib/geom.js'
describe('tilepack', () => {
  it('clips a polygon spanning two tiles into exactly the tile part', () => {
    const p = [{ outer: [[400, -10], [600, -10], [600, -110], [400, -110]], holes: [] }]
    const a = clipPolysToTile(p, { minX: 0, maxX: 500, minZ: -500, maxZ: 0 })
    expect(a.reduce((s, q) => s + Math.abs(signedArea(q.outer)), 0)).toBeCloseTo(100 * 100)
  })
  it('keeps holes when clipping', () => {
    const p = [{ outer: [[10, -10], [200, -10], [200, -200], [10, -200]], holes: [[[50, -50], [100, -50], [100, -100], [50, -100]]] }]
    const a = clipPolysToTile(p, { minX: 0, maxX: 500, minZ: -500, maxZ: 0 })
    expect(a[0].holes).toHaveLength(1)
  })
  it('splits a line so every segment lives in exactly one tile', () => {
    const m = splitLineByTiles([[100, 10], [400, 10], [700, 10], [900, 10]])
    expect([...m.keys()].sort()).toEqual(['0_0', '1_0'])
    expect(m.get('0_0')).toEqual([[[100, 10], [400, 10]]])
    expect(m.get('1_0')).toEqual([[[400, 10], [700, 10], [900, 10]]])
  })
  it('compressed tile round-trips layer names and exact custom attributes', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 't-')), 't.glb')
    const tri = { positions: [0, 0, 0, 10, 0, 0, 0, 10, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], uvs: [0, 0, 10, 0, 0, 10] }
    await writeTileGlb(path, { buildings: { ...tri, extra: { FACADE: new Float32Array([8, 8, 8]), SEED: new Float32Array([0.25, 0.25, 0.25]), BLDG: new Float32Array([1234, 1234, 1234]) } }, roads: tri, empty: { positions: [], normals: [], uvs: [] } })
    await MeshoptDecoder.ready
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read(path)
    const names = doc.getRoot().listNodes().map((n) => n.getName()).sort()
    expect(names).toEqual(['buildings', 'roads'])
    const prim = doc.getRoot().listMeshes().find((m) => m.getName() === 'buildings').listPrimitives()[0]
    expect(prim.getAttribute('_FACADE').getScalar(0)).toBe(8) // getScalar = decoded value, as three.js sees it
    expect(prim.getAttribute('_SEED').getScalar(0)).toBeCloseTo(0.25, 3) // quantized seed: ~6e-5 precision
    expect(prim.getAttribute('_BLDG').getScalar(0)).toBe(1234)
  })
})
