// pipeline/lib/blenderMesh.js — a Blender export (.glb, metres, +Y up) as a raw world mesh, or null.
// Never throws: a missing, corrupt, empty or over-budget export means "use the procedural fallback".
// Placement order: scale, then rotate about +Y by a compass bearing (clockwise from north), then translate.
import { existsSync } from 'node:fs'
import { NodeIO } from '@gltf-transform/core'
import { EXTMeshoptCompression } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

let io = null
async function reader() {
  if (!io) { await MeshoptDecoder.ready; io = new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }) }
  return io
}

// the node's world matrix applied to a point / a direction (column-major 4×4)
const xf = (m, [x, y, z], w) => [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w, m[2] * x + m[6] * y + m[10] * z + m[14] * w]

export async function loadBlenderMesh(path, { at, baseY = 0, rotationDeg = 0, scale = 1, maxTris = 60000 }) {
  if (!existsSync(path)) return null
  let doc
  try { doc = await (await reader()).read(path) } catch { return null }
  const positions = [], normals = [], uvs = []
  // compass bearing → rotation about +Y: local +X (east) turns toward +Z (south) for +90°
  const r = (rotationDeg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r)
  const place = ([x, y, z]) => [at[0] + scale * (x * c - z * s), baseY + scale * y, at[1] + scale * (x * s + z * c)]
  const turn = ([x, y, z]) => { const v = [x * c - z * s, y, x * s + z * c], l = Math.hypot(...v) || 1; return v.map((k) => k / l) }
  try {
    for (const node of doc.getRoot().listNodes()) {
      const meshNode = node.getMesh()
      if (!meshNode) continue
      const M = node.getWorldMatrix()
      for (const prim of meshNode.listPrimitives()) {
        const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), T = prim.getAttribute('TEXCOORD_0'), I = prim.getIndices()
        if (!P || (prim.getMode() ?? 4) !== 4) continue
        const count = I ? I.getCount() : P.getCount()
        for (let k = 0; k < count; k++) {
          const i = I ? I.getScalar(k) : k
          const p = place(xf(M, P.getElement(i, []), 1))
          positions.push(...p)
          normals.push(...(N ? turn(xf(M, N.getElement(i, []), 0)) : [0, 1, 0]))
          if (T) { const [u, v] = T.getElement(i, []); uvs.push(u, v) } else uvs.push(p[0] + p[2], p[1])
        }
      }
    }
  } catch { return null }
  const tris = positions.length / 9
  if (tris === 0 || tris > maxTris) return null
  return { positions, normals, uvs }
}
