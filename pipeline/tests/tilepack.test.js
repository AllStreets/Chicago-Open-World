import { describe, it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { clipPolysToTile, splitLineByTiles, writeTileGlb } from '../lib/tilepack.js'
import { signedArea } from '../lib/geom.js'
describe('tilepack', () => {
  it('large building ids survive compression exactly (blocks hold thousands)', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 't-')), 'big.glb')
    const tri = { positions: [0, 0, 0, 10, 0, 0, 0, 10, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], uvs: [0, 0, 10, 0, 0, 10] }
    await writeTileGlb(path, { buildings: { ...tri, extra: { BLDG: new Float32Array([0, 4500, 9000]) } } })
    await MeshoptDecoder.ready
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read(path)
    const a = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('_BLDG')
    expect([a.getScalar(0), a.getScalar(1), a.getScalar(2)].sort((x, y) => x - y)).toEqual([0, 4500, 9000])
  })
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

describe('ground merge + blocks', () => {
  it('mergeGroundLayers stacks layers into one mesh with a per-vertex layer index', async () => {
    const { mergeGroundLayers, GROUND_LAYERS } = await import('../lib/tilepack.js')
    const tri = { positions: [0, 0, 0, 1, 0, 0, 0, 0, 1], normals: [0, 1, 0, 0, 1, 0, 0, 1, 0], uvs: [0, 0, 1, 0, 0, 1] }
    const m = mergeGroundLayers({ roads: tri, parks: tri, beaches: { positions: [], normals: [], uvs: [] } })
    expect(m.positions).toHaveLength(18)
    const r = GROUND_LAYERS.indexOf('roads'), p = GROUND_LAYERS.indexOf('parks')
    expect([...m.extra.LAYER]).toEqual([r, r, r, p, p, p])
  })
  it('blockKeyFor groups 4×4 tiles into 2 km blocks', async () => {
    const { blockKeyFor } = await import('../lib/tilepack.js')
    expect(blockKeyFor('0_0')).toBe('0_0'); expect(blockKeyFor('3_3')).toBe('0_0')
    expect(blockKeyFor('4_0')).toBe('1_0'); expect(blockKeyFor('-1_-1')).toBe('-1_-1'); expect(blockKeyFor('-5_2')).toBe('-2_0')
  })
})

describe('tilepack colours + concat (V3)', () => {
  it('COLOR_0 and large custom scalars survive compression', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 't-')), 'c.glb')
    const tri = { positions: [0, 0, 0, 10, 0, 0, 0, 0, 10], normals: [0, 1, 0, 0, 1, 0, 0, 1, 0], colors: [0.5, 0.25, 1, 0.5, 0.25, 1, 0.5, 0.25, 1], extra: { KIND: new Float32Array([4, 4, 4]), ALONG: new Float32Array([0, 350.5, 700.25]) } }
    await writeTileGlb(path, { transit: tri })
    await MeshoptDecoder.ready
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read(path)
    const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0]
    const c = prim.getAttribute('COLOR_0').getElement(0, [])
    expect(c[0]).toBeCloseTo(0.5, 2); expect(c[1]).toBeCloseTo(0.25, 2); expect(c[2]).toBeCloseTo(1, 2)
    expect(prim.getAttribute('_KIND').getScalar(0)).toBe(4)
    const along = [0, 1, 2].map((i) => prim.getAttribute('_ALONG').getScalar(i)).sort((a, b) => a - b)
    expect(along[2]).toBeCloseTo(700.25, 1)
  })
  it('concatLayers joins layers and their extras', async () => {
    const { concatLayers } = await import('../lib/tilepack.js')
    const a = { positions: [1, 2, 3], normals: [0, 1, 0], colors: [1, 0, 0], extra: { SIDE: new Float32Array([1]) } }
    const out = concatLayers([a, a])
    expect(out.positions).toEqual([1, 2, 3, 1, 2, 3]); expect(out.colors).toEqual([1, 0, 0, 1, 0, 0])
    expect(out.extra.SIDE).toEqual(new Float32Array([1, 1]))
  })
})
