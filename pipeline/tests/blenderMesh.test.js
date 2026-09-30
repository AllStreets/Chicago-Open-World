// pipeline/tests/blenderMesh.test.js
import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Document, NodeIO } from '@gltf-transform/core'
import { loadBlenderMesh } from '../lib/blenderMesh.js'

let dir, cubeGlb
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'blendermesh-'))
  const doc = new Document(), buf = doc.createBuffer()
  // one triangle, 1 m tall, at the origin
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
  const nrm = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1])
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nrm).setBuffer(buf))
  doc.createScene().addChild(doc.createNode('tri').setMesh(doc.createMesh('tri').addPrimitive(prim)))
  cubeGlb = join(dir, 'tri.glb')
  await new NodeIO().write(cubeGlb, doc)
})

describe('loadBlenderMesh', () => {
  it('returns null for a missing file instead of throwing', async () => {
    expect(await loadBlenderMesh(join(dir, 'nope.glb'), { at: [0, 0] })).toBeNull()
  })
  it('returns null for a corrupt file', async () => {
    const bad = join(dir, 'bad.glb'); writeFileSync(bad, 'not a glb')
    expect(await loadBlenderMesh(bad, { at: [0, 0] })).toBeNull()
  })
  it('places, scales and rotates into world metres', async () => {
    const m = await loadBlenderMesh(cubeGlb, { at: [100, -50], baseY: 20, scale: 2, rotationDeg: 90 })
    const ys = m.positions.filter((_, i) => i % 3 === 1)
    expect(Math.min(...ys)).toBeCloseTo(20); expect(Math.max(...ys)).toBeCloseTo(22)
    // local +X (east) rotated 90° clockwise from north becomes +Z (south)
    expect(m.positions[3]).toBeCloseTo(100); expect(m.positions[5]).toBeCloseTo(-50 + 2)
  })
  it('refuses meshes over the triangle ceiling', async () => {
    expect(await loadBlenderMesh(cubeGlb, { at: [0, 0], maxTris: 0 })).toBeNull()
  })
})
