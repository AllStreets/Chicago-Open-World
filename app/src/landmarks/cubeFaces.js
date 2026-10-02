// app/src/landmarks/cubeFaces.js — Cloud Gate's mirror budget: a 128 px cube refreshed every 30 frames, each face drawn
// in CUBE.parts slices on consecutive frames — farthest first, then (no clear, same depth) nearer — each slice holding
// about the same number of triangles, so no frame pays for more than a slice. A whole face downtown was ~1 M
// triangles, the frame peak of the whole budget. The mirror's PMREM is rebuilt only once a face is whole, so a part-
// drawn face never shows. First sight fills the cube the same way, one step a frame (it once drew all six at once).
import * as THREE from 'three'

export const CUBE = { size: 128, period: 30, near: 1, far: 3000, maxDist: 1500, parts: 4 }
export const CUBE_STEPS = 6 * CUBE.parts
// frame → { face, part } (part 0: the farthest slice, cleared first), or null between refreshes
export function cubeStepFor(frame, period = CUBE.period, parts = CUBE.parts) {
  const f = ((frame % period) + period) % period
  return f < 6 * parts ? { face: Math.floor(f / parts), part: f % parts } : null
}
export const cubeActive = ({ quality, camDist }) => quality !== 'LOW' && camDist <= CUBE.maxDist

// What a 128 px cube face cannot show (≈ 0.7° a pixel, then bent by the Bean's curve): street traffic, the L's girders
// and ties, trains. Every face drew them whole — an instanced mesh is culled as one sphere — at ~1 M triangles a face,
// the frame's peak downtown. Their owners register them here; the faces skip them (the city, sky, plaza, trees stay).
export const CUBE_SKIP = new Set()
export function skipInCube(objects) {
  const list = objects.filter(Boolean)
  for (const o of list) CUBE_SKIP.add(o)
  return () => { for (const o of list) CUBE_SKIP.delete(o) }
}

const _s = new THREE.Sphere(), _f = new THREE.Frustum(), _m = new THREE.Matrix4()
const matsOf = (o) => (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean)
export function trianglesOf(o) {
  const g = o.geometry
  if (!g) return 0
  const n = g.index ? g.index.count : g.attributes.position?.count ?? 0
  const per = Math.max(0, Math.min(n, g.drawRange.count) / (o.isMesh ? 3 : 1))
  return o.isInstancedMesh ? per * o.count : per
}

// Slice one face's draw list by distance from the Bean into `parts` runs of about equal triangles. Returns, per
// object, its slice: 0 = farthest. Transparent objects go last (after every opaque), anything drawn regardless of depth
// (a sky) first; objects outside the face are left out of every slice.
export function sliceFace(objects, camera, centre, parts = CUBE.parts) {
  _f.setFromProjectionMatrix(_m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
  const out = new Map(), opaque = []
  for (const o of objects) {
    const mats = matsOf(o)
    if (mats.some((m) => m.transparent)) { out.set(o, parts - 1); continue }
    if (mats.some((m) => m.depthTest === false)) { out.set(o, 0); continue }
    const bs = o.isInstancedMesh || o.isBatchedMesh ? o.boundingSphere : (o.geometry?.boundingSphere ?? (o.geometry?.computeBoundingSphere(), o.geometry?.boundingSphere))
    if (!bs) { out.set(o, parts - 1); continue }
    _s.copy(bs).applyMatrix4(o.matrixWorld)
    if (o.frustumCulled !== false && !_f.intersectsSphere(_s)) continue
    opaque.push({ o, d: _s.center.distanceTo(centre), t: trianglesOf(o) })
  }
  opaque.sort((a, b) => b.d - a.d) // farthest first
  const total = opaque.reduce((a, x) => a + x.t, 0)
  let acc = 0
  for (const x of opaque) { out.set(x.o, Math.min(parts - 1, Math.floor((acc / Math.max(1, total)) * parts))); acc += x.t }
  return out
}

let sliced = null // { face, slices } of the face being drawn
// one slice of one face into rt: every other object (and the skip list) hidden; shadows frozen; the PMREM is
// flagged only when the last slice completes the face
export function renderCubePart(gl, rt, scene, cubeCam, face, part, { parts = CUBE.parts, skip = CUBE_SKIP } = {}) {
  const prev = gl.getRenderTarget(), xr = gl.xr.enabled, shadows = gl.shadowMap.autoUpdate, clear = gl.autoClear
  gl.xr.enabled = false; gl.shadowMap.autoUpdate = false
  const cam = cubeCam.children[face]
  if (part === 0 || sliced?.face !== face) {
    const list = []
    scene.traverseVisible((o) => { if ((o.isMesh || o.isPoints || o.isLine) && !skip.has(o)) list.push(o) })
    cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert()
    sliced = { face, list, slices: sliceFace(list, cam, cubeCam.position, parts) }
  }
  // one walk of the scene a face: later slices reuse its list
  const hidden = []
  for (const o of sliced.list) if (o.visible && sliced.slices.get(o) !== part) hidden.push(o)
  for (const o of skip) if (o.visible) hidden.push(o)
  for (const o of hidden) o.visible = false
  const background = scene.background
  try {
    gl.setRenderTarget(rt, face)
    // the farther slices are already in this face, depth and all: no clear (a colour background forces one)
    if (part > 0) { gl.autoClear = false; scene.background = null }
    gl.render(scene, cam)
  } finally {
    for (const o of hidden) o.visible = true
    gl.autoClear = clear; scene.background = background
  }
  gl.setRenderTarget(prev); gl.xr.enabled = xr; gl.shadowMap.autoUpdate = shadows
  if (part === parts - 1) { rt.texture.needsPMREMUpdate = true; sliced = null }
}
