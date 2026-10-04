// pipeline/lib/tileTris.js — one building's triangles out of a built tile glb (world positions, the stored normal as
// the 4th entry so a test can tell front from back) and the palette rows it uses. Tests and audits only.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

let io = null
export async function buildingTris(path, bldg) {
  if (!io) { await MeshoptDecoder.ready; io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }) }
  const doc = await io.read(path)
  const out = [], styles = new Set()
  for (const node of doc.getRoot().listNodes()) {
    if (node.getName() !== 'buildings') continue
    const m = node.getWorldMatrix(), prim = node.getMesh().listPrimitives()[0]
    const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), B = prim.getAttribute('_BLDG'), S = prim.getAttribute('_STYLE'), I = prim.getIndices()
    const e = [], ne = []
    const pos = (i) => { P.getElement(i, e); return [m[0] * e[0] + m[4] * e[1] + m[8] * e[2] + m[12], m[1] * e[0] + m[5] * e[1] + m[9] * e[2] + m[13], m[2] * e[0] + m[6] * e[1] + m[10] * e[2] + m[14]] }
    const nor = (i) => { N.getElement(i, ne); return [m[0] * ne[0] + m[4] * ne[1] + m[8] * ne[2], m[1] * ne[0] + m[5] * ne[1] + m[9] * ne[2], m[2] * ne[0] + m[6] * ne[1] + m[10] * ne[2]] }
    const n = I ? I.getCount() : P.getCount()
    for (let t = 0; t < n; t += 3) {
      const v = [0, 1, 2].map((k) => (I ? I.getScalar(t + k) : t + k))
      if (Math.round(B.getScalar(v[0])) !== bldg) continue
      const ns = v.map(nor)
      out.push([pos(v[0]), pos(v[1]), pos(v[2]), [0, 1, 2].map((k) => ns[0][k] + ns[1][k] + ns[2][k])])
      styles.add(Math.round(S.getScalar(v[0])))
    }
  }
  return { tris: out, styles }
}
