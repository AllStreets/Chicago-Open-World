import { describe, it, expect } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { writeMeshGlb } from '../lib/glb.js'

describe('writeMeshGlb', () => {
  it('writes a readable glb with custom attributes', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'glb-')), 't.glb')
    await writeMeshGlb(path, {
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
      uvs: [0, 0, 1, 0, 0, 1], colors: [1, 0, 0, 1, 0, 0, 1, 0, 0],
      extra: { FACADE: new Float32Array([3, 3, 3]) },
    })
    expect(readFileSync(path).subarray(0, 4).toString()).toBe('glTF')
    const doc = await new NodeIO().read(path)
    const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0]
    expect(prim.getAttribute('_FACADE').getArray()[0]).toBe(3)
    expect(prim.getAttribute('COLOR_0')).toBeTruthy()
  })
})
