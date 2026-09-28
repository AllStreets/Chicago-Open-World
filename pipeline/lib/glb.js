// pipeline/lib/glb.js — one-mesh glb writer (Phase 1: uncompressed).
import { Document, NodeIO } from '@gltf-transform/core'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export async function writeMeshGlb(path, { positions, normals, uvs, colors, extra = {} }) {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const acc = (arr, type) => doc.createAccessor().setType(type).setArray(arr instanceof Float32Array ? arr : new Float32Array(arr)).setBuffer(buffer)
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc(positions, 'VEC3'))
    .setAttribute('NORMAL', acc(normals, 'VEC3'))
  if (uvs) prim.setAttribute('TEXCOORD_0', acc(uvs, 'VEC2'))
  if (colors) prim.setAttribute('COLOR_0', acc(colors, 'VEC3'))
  for (const [name, arr] of Object.entries(extra)) prim.setAttribute(`_${name}`, acc(arr, 'SCALAR'))
  const mesh = doc.createMesh('mesh').addPrimitive(prim)
  doc.createScene().addChild(doc.createNode('node').setMesh(mesh))
  mkdirSync(dirname(path), { recursive: true })
  await new NodeIO().write(path, doc)
}
