// app/src/world/water/mirror.js — the camera mirrored in the water plane (Reflector-style), and the matrix
// that maps any world point on the water to its spot in the shared reflection texture.
import * as THREE from 'three'

const _p = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _t = new THREE.Vector3()

export function mirrorCamera(camera, planeY, out) {
  camera.updateMatrixWorld()
  _p.setFromMatrixPosition(camera.matrixWorld)
  camera.getWorldDirection(_f)
  _u.setFromMatrixColumn(camera.matrixWorld, 1) // the camera's real up axis
  out.position.set(_p.x, 2 * planeY - _p.y, _p.z)
  out.up.set(_u.x, -_u.y, _u.z)
  _t.copy(_p).add(_f)
  _t.y = 2 * planeY - _t.y
  out.lookAt(_t)
  out.projectionMatrix.copy(camera.projectionMatrix)
  out.projectionMatrixInverse.copy(camera.projectionMatrixInverse)
  out.updateMatrixWorld()
  return out
}

export function textureMatrixFor(mirror, out) {
  out.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
  out.multiply(mirror.projectionMatrix)
  out.multiply(mirror.matrixWorldInverse)
  return out
}
