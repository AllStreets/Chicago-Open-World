// app/src/world/beachNets.js — F-8: the beach-volleyball nets on the sand courts (pipeline lib/beaches.js
// volleyballNets → manifest.beachNets). Pure helpers: decode the instances, pick which draw (near ones cast shadows,
// far ones don't, nothing beyond FAR_M), and the one ~30-triangle net model: two posts, the mesh and its two tapes.
import * as THREE from 'three'

export const STRIDE = 5 // x, z, y (the sand there), yaw, length (post to post)
export const NEAR_M = 140, FAR_M = 650 // shadows within NEAR_M; a 2.5 m net is ~3 px at FAR_M
export const NET_TOP = 2.43, NET_DEPTH = 1.0, POST_H = 2.55, POST_R = 0.05

export function decodeNets(entry) {
  const a = entry?.nets
  const stride = entry?.stride ?? STRIDE
  if (!Array.isArray(a) || stride !== STRIDE || a.length % STRIDE) return []
  const out = []
  for (let i = 0; i < a.length; i += STRIDE) out.push({ x: a[i], z: a[i + 1], y: a[i + 2], yaw: a[i + 3], len: a[i + 4] })
  return out
}

// which nets draw from the camera at (cx, cy, cz): indices into `nets`, split near (shadow-casting) / far
export function pickNets(nets, [cx, cy, cz], { near = NEAR_M, far = FAR_M, inView = null } = {}) {
  const lod0 = [], lod1 = []
  for (let i = 0; i < nets.length; i++) {
    const n = nets[i], d = Math.hypot(n.x - cx, n.y - cy, n.z - cz)
    if (d > far || (inView && !inView(n.x, n.y, n.z))) continue
    ;(d <= near ? lod0 : lod1).push(i)
  }
  return { lod0, lod1 }
}

// one net `len` m long along +x (post to post), centred on the origin, standing on y = 0. It is built at the nets'
// median length and each instance scales x by its own length over that (±10%: the posts stay round to the eye).
// Two parts: the solid one (posts and the two white tapes, which may cast shadows) and the see-through mesh (never).
const POST = [0.72, 0.72, 0.7], MESH = [0.08, 0.08, 0.09], TAPE = [0.93, 0.93, 0.9]
function geometry(tris) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flatMap((t) => t.p), 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(tris.flatMap((t) => t.c), 3))
  g.computeVertexNormals()
  return g
}
export function netGeometry(len = 9.6) {
  const solid = [], mesh = []
  const quad = (out, a, b, c, d, col) => { for (const tri of [[a, b, c], [a, c, d]]) out.push({ p: tri.flat(), c: [...col, ...col, ...col] }) }
  const SIDES = 6
  for (const px of [-len / 2, len / 2]) for (let k = 0; k < SIDES; k++) { // two open hexagonal posts
    const a0 = (k / SIDES) * Math.PI * 2, a1 = ((k + 1) / SIDES) * Math.PI * 2
    const p0 = [px + POST_R * Math.cos(a0), POST_R * Math.sin(a0)], p1 = [px + POST_R * Math.cos(a1), POST_R * Math.sin(a1)]
    quad(solid, [p0[0], 0, p0[1]], [p0[0], POST_H, p0[1]], [p1[0], POST_H, p1[1]], [p1[0], 0, p1[1]], POST)
  }
  const x0 = -len / 2 + POST_R, x1 = len / 2 - POST_R, yb = NET_TOP - NET_DEPTH
  quad(solid, [x0, NET_TOP - 0.07, 0], [x1, NET_TOP - 0.07, 0], [x1, NET_TOP, 0], [x0, NET_TOP, 0], TAPE) // the top tape
  quad(solid, [x0, yb, 0], [x1, yb, 0], [x1, yb + 0.05, 0], [x0, yb + 0.05, 0], TAPE) // the bottom tape
  quad(mesh, [x0, yb + 0.05, 0], [x1, yb + 0.05, 0], [x1, NET_TOP - 0.07, 0], [x0, NET_TOP - 0.07, 0], MESH)
  return { solid: geometry(solid), mesh: geometry(mesh) }
}
export const netTriangles = (g) => g.attributes.position.count / 3
export const medianLength = (nets) => { const l = nets.map((n) => n.len).sort((a, b) => a - b); return l.length ? l[l.length >> 1] : 9.6 }
