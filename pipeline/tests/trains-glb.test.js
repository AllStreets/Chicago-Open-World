import { describe, it, expect } from 'vitest'
import { mkdtempSync, existsSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { writeTrainsGlb, HERO_TRAINS } from '../build/build-trains.js'
import { loadCatalog } from '../lib/transit/lines.js'
import { KIND } from '../lib/transit/meshkit.js'

async function check(opts) {
  const path = join(mkdtempSync(join(tmpdir(), 'tr-')), 'trains.glb')
  await writeTrainsGlb(path, loadCatalog(), opts)
  await MeshoptDecoder.ready
  const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read(path)
  expect(doc.getRoot().listNodes().map((n) => n.getName()).sort()).toEqual(['cta5000', 'cta7000', 'metraCoach', 'metraLoco'])
  for (const mesh of doc.getRoot().listMeshes()) {
    const p = mesh.listPrimitives()[0], K = p.getAttribute('_KIND')
    expect(K).toBeTruthy(); expect(p.getAttribute('COLOR_0')).toBeTruthy()
    const kinds = new Set(Array.from({ length: K.getCount() }, (_, i) => K.getScalar(i)))
    for (const k of [KIND.glass, KIND.sign, KIND.headlight, KIND.tail, KIND.dark]) expect(kinds.has(k)).toBe(true) // night lights, line-colour signs, lamps
  }
}

describe('trains.glb', () => {
  it('holds the four models with kinds and colours (procedural)', () => check({ hero: null }))
  it.skipIf(!existsSync(HERO_TRAINS))('holds the four models with kinds and colours (Blender heroes/out/trains.glb)', () => check({}))
})
