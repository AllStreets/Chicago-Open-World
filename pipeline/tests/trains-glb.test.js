import { describe, it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { writeTrainsGlb } from '../build/build-trains.js'
import { loadCatalog } from '../lib/transit/lines.js'

describe('trains.glb', () => {
  it('holds the four models with kinds and colours', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'tr-')), 'trains.glb')
    await writeTrainsGlb(path, loadCatalog())
    await MeshoptDecoder.ready
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read(path)
    expect(doc.getRoot().listNodes().map((n) => n.getName()).sort()).toEqual(['cta5000', 'cta7000', 'metraCoach', 'metraLoco'])
    for (const mesh of doc.getRoot().listMeshes()) {
      const p = mesh.listPrimitives()[0]
      expect(p.getAttribute('_KIND')).toBeTruthy(); expect(p.getAttribute('COLOR_0')).toBeTruthy()
    }
  })
})
