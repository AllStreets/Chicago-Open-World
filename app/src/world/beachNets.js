// app/src/world/beachNets.js — F-8: the beach-volleyball nets on the sand courts (pipeline lib/beaches.js
// volleyballNets → manifest.beachNets). Pure helpers: decode the instances, pick which draw (near ones cast shadows,
// far ones don't, nothing beyond FAR_M), and the one 32-triangle net model: two thin dark posts, the dark mesh band and its white top tape.
import * as THREE from 'three'

export const STRIDE = 5 // x, z, y (the sand there), yaw, length (post to post)
export const NEAR_M = 140, FAR_M = 650 // shadows within NEAR_M; a 2.5 m net is ~3 px at FAR_M
export const NET_TOP = 2.43, NET_DEPTH = 1.0, POST_H = 2.5, POST_R = 0.04 // men's height; a 1 m deep net

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
// median length and each instance scales x by its own length over that (±10%).
// Two parts: the solid one (two thin dark posts and the white top tape, which may cast shadows) and the see-through
// dark mesh band below the tape (never). Both sag a little toward the middle, like a real net on its cable.
// Matte colours below 0.75: nothing here gets near the bloom threshold under the noon sun.
export const POST_COL = [0.09, 0.09, 0.1], MESH_COL = [0.05, 0.05, 0.06], TAPE_COL = [0.72, 0.72, 0.7]
export const SAG_TOP = 0.05, SAG_BOTTOM = 0.12, NET_SEGS = 4
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
  for (const px of [-len / 2, len / 2]) { // two thin square posts
    const r = POST_R, c = [[px - r, -r], [px + r, -r], [px + r, r], [px - r, r]]
    for (let k = 0; k < 4; k++) { const p0 = c[k], p1 = c[(k + 1) % 4]; quad(solid, [p0[0], 0, p0[1]], [p0[0], POST_H, p0[1]], [p1[0], POST_H, p1[1]], [p1[0], 0, p1[1]], POST_COL) }
  }
  const x0 = -len / 2 + POST_R, x1 = len / 2 - POST_R, TAPE = 0.07
  const sag = (t, s) => s * (1 - (2 * t - 1) ** 2) // 0 at the posts, s in the middle
  for (let i = 0; i < NET_SEGS; i++) {
    const t0 = i / NET_SEGS, t1 = (i + 1) / NET_SEGS, xa = x0 + (x1 - x0) * t0, xb = x0 + (x1 - x0) * t1
    const ta = NET_TOP - sag(t0, SAG_TOP), tb = NET_TOP - sag(t1, SAG_TOP)
    const ba = NET_TOP - NET_DEPTH - sag(t0, SAG_BOTTOM), bb = NET_TOP - NET_DEPTH - sag(t1, SAG_BOTTOM)
    quad(solid, [xa, ta - TAPE, 0], [xb, tb - TAPE, 0], [xb, tb, 0], [xa, ta, 0], TAPE_COL) // the white top tape
    quad(mesh, [xa, ba, 0], [xb, bb, 0], [xb, tb - TAPE, 0], [xa, ta - TAPE, 0], MESH_COL) // the dark mesh
  }
  return { solid: geometry(solid), mesh: geometry(mesh) }
}
export const netTriangles = (g) => g.attributes.position.count / 3
export const medianLength = (nets) => { const l = nets.map((n) => n.len).sort((a, b) => a - b); return l.length ? l[l.length >> 1] : 9.6 }
