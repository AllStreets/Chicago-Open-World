// pipeline/tests/layers.test.js
import { describe, it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { bAcc, appendBuilding, appendLayer, asLayer } from '../lib/layers.js'
import { writeTileGlb } from '../lib/tilepack.js'

const tri = (x) => ({ positions: [x, 0, 0, x + 10, 0, 0, x, 10, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], uvs: [0, 0, 10, 0, 0, 10] })
async function roundTrip(styles) {
  const L = bAcc()
  styles.forEach((s, i) => appendBuilding(L, tri(i * 20), 3, 0.5, i, s))
  const path = join(mkdtempSync(join(tmpdir(), 'l-')), 't.glb')
  await writeTileGlb(path, { buildings: asLayer(L) })
  await MeshoptDecoder.ready
  const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read(path)
  const a = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('_STYLE')
  return Array.from({ length: a.getCount() }, (_, i) => a.getScalar(i))
}

describe('building layers', () => {
  it('appendBuilding writes one style per vertex, defaulting to 0', () => {
    const L = bAcc()
    appendBuilding(L, tri(0), 3, 0.5, 7)
    appendBuilding(L, tri(20), 3, 0.5, 8, 12)
    expect(L.style).toEqual([0, 0, 0, 12, 12, 12])
    expect(L.fac).toHaveLength(6); expect(L.seed).toHaveLength(6); expect(L.bldg).toHaveLength(6)
    expect(asLayer(L).extra.STYLE).toBeInstanceOf(Float32Array)
    expect([...asLayer(L).extra.STYLE]).toEqual([0, 0, 0, 12, 12, 12])
  })
  it('appendLayer concatenates every array (2 km blocks)', () => {
    const A = bAcc(), B = bAcc()
    appendBuilding(A, tri(0), 1, 0.1, 0, 2); appendBuilding(B, tri(0), 4, 0.2, 0, 9)
    appendLayer(A, B)
    expect(A.style).toEqual([2, 2, 2, 9, 9, 9]); expect(A.fac).toEqual([1, 1, 1, 4, 4, 4]); expect(A.positions).toHaveLength(18)
  })
  it('survives quantization when a tile\'s styles are only 0 and 1', async () => {
    expect(new Set(await roundTrip([0, 1]))).toEqual(new Set([0, 1]))
  })
  it('survives exactly when indexes exceed 1 (float32 path)', async () => {
    expect(new Set(await roundTrip([0, 37, 255]))).toEqual(new Set([0, 37, 255]))
  })
  it('an all-unstyled tile decodes to zeros', async () => {
    expect(new Set(await roundTrip([0, 0]))).toEqual(new Set([0]))
  })
})
