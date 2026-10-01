// app/src/world/water/mirrorCull.js — what the water's mirror pass leaves out: far content whose reflection is a
// sliver at the far end of the water, at half resolution and broken by the ripples (lib/farDetail.js MIRROR_M).
// Tiles register the meshes that may be skipped; WaterRig hides the far ones around its one mirror render.
import * as THREE from 'three'
import { MIRROR_M, boxDistance } from '../../lib/farDetail.js'

export const MIRROR_FAR = new Set()
export function mirrorSkippable(meshes) {
  const list = meshes.filter(Boolean)
  for (const m of list) MIRROR_FAR.add(m)
  return () => { for (const m of list) MIRROR_FAR.delete(m) }
}

const box = new THREE.Box3()
// hide every registered mesh farther than `limit` from the camera; returns the restore
export function hideFarForMirror(camera, set = MIRROR_FAR, limit = MIRROR_M) {
  const hidden = [], p = camera.position
  for (const m of set) {
    if (!m.visible || !m.geometry) continue
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
    box.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld)
    const d = boxDistance([p.x, p.y, p.z], { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z }, box.max.y, box.min.y)
    if (d > limit) { m.visible = false; hidden.push(m) }
  }
  return () => { for (const m of hidden) m.visible = true }
}
