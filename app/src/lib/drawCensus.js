// app/src/lib/drawCensus.js — which kinds of objects are drawn from here (main pass, frustum-culled): where the calls go.
import * as THREE from 'three'

const frustum = new THREE.Frustum(), m = new THREE.Matrix4(), sphere = new THREE.Sphere()
export const categoryOf = (o) => o.userData?.kind || o.name || o.parent?.name || o.type

export function censusScene(scene, camera) {
  camera.updateMatrixWorld()
  m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  frustum.setFromProjectionMatrix(m)
  const out = {}
  scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isLine && !o.isPoints) return
    if (o.frustumCulled) {
      const bs = o.isInstancedMesh ? (o.boundingSphere ?? (o.computeBoundingSphere(), o.boundingSphere)) : (o.geometry.boundingSphere ?? (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere))
      if (!frustum.intersectsSphere(sphere.copy(bs).applyMatrix4(o.matrixWorld))) return
    }
    const k = categoryOf(o)
    out[k] = (out[k] ?? 0) + 1
  })
  return out
}
