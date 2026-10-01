import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { mirrorSkippable, hideFarForMirror, MIRROR_FAR } from '../water/mirrorCull.js'
import { MIRROR_M } from '../../lib/farDetail.js'

const block = (x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(2000, 100, 2000).translate(0, 50, 0)); m.position.set(x, 0, 0); m.updateMatrixWorld(); return m }

describe('the water mirror leaves far 2 km blocks out', () => {
  it('hides only registered meshes wholly beyond MIRROR_M, and restores them', () => {
    const near = block(1000 + MIRROR_M - 10), far = block(1000 + MIRROR_M + 10), loose = block(1000 + MIRROR_M + 500)
    const undo = mirrorSkippable([near, far])
    const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 0, 0)
    const restore = hideFarForMirror(camera)
    expect([near.visible, far.visible, loose.visible]).toEqual([true, false, true]) // `loose` is not registered
    restore()
    expect(far.visible).toBe(true)
    undo()
    expect(MIRROR_FAR.size).toBe(0)
  })
  it('measures in 3D: a camera high above a block is as far as its height above the roofs', () => {
    const b = block(0), camera = new THREE.PerspectiveCamera()
    const undo = mirrorSkippable([b])
    camera.position.set(0, 100 + MIRROR_M + 10, 0)
    const restore = hideFarForMirror(camera)
    expect(b.visible).toBe(false)
    restore(); undo()
  })
})
