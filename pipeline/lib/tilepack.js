// pipeline/lib/tilepack.js — split world layers into 500 m tiles and write compressed multi-layer glbs.
import polygonClipping from 'polygon-clipping'
import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { weld, meshopt } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { openRing, signedArea } from './geom.js'
import { tileKeyFor } from './tiles.js'

const close = (r) => [...r, r[0]]

export function clipPolysToTile(polys, { minX, minZ, maxX, maxZ }) {
  const rect = [[[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ], [minX, minZ]]]
  const out = []
  for (const p of polys) {
    let res
    try { res = polygonClipping.intersection([close(p.outer), ...p.holes.map(close)], rect) } catch { continue }
    for (const [outer, ...holes] of res) {
      const o = openRing(outer)
      if (o.length >= 3 && Math.abs(signedArea(o)) > 0.5) out.push({ outer: o, holes: holes.map(openRing), tags: p.tags })
    }
  }
  return out
}

export function splitLineByTiles(points) {
  const out = new Map()
  let curKey = null, cur = null
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const key = tileKeyFor([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
    if (key !== curKey) {
      cur = [a, b]; curKey = key
      if (!out.has(key)) out.set(key, [])
      out.get(key).push(cur)
    } else cur.push(b)
  }
  return out
}

let io = null
async function getIO() {
  if (!io) {
    await MeshoptEncoder.ready
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
  }
  return io
}

export async function writeTileGlb(path, layers) {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const scene = doc.createScene()
  const acc = (arr, type) => doc.createAccessor().setType(type).setArray(arr instanceof Float32Array ? arr : new Float32Array(arr)).setBuffer(buffer)
  for (const [name, m] of Object.entries(layers)) {
    if (!m || !m.positions.length) continue
    const prim = doc.createPrimitive().setAttribute('POSITION', acc(m.positions, 'VEC3')).setAttribute('NORMAL', acc(m.normals, 'VEC3'))
    if (m.uvs?.length) prim.setAttribute('TEXCOORD_0', acc(m.uvs, 'VEC2'))
    for (const [k, arr] of Object.entries(m.extra || {})) prim.setAttribute(`_${k}`, acc(arr, 'SCALAR'))
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)))
  }
  await doc.transform(weld(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  mkdirSync(dirname(path), { recursive: true })
  await (await getIO()).write(path, doc)
}
