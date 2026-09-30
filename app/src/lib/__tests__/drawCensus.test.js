// app/src/lib/__tests__/drawCensus.test.js
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { censusScene, categoryOf } from '../drawCensus.js'

describe('draw census', () => {
  it('counts visible objects in the frustum by layer or kind', () => {
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(60, 1, 1, 1000); cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0); cam.updateMatrixWorld()
    const box = new THREE.BoxGeometry(1, 1, 1), mat = new THREE.MeshBasicMaterial()
    const a = new THREE.Mesh(box, mat); a.name = 'buildings'
    const b = new THREE.Mesh(box, mat); b.name = 'buildings'; b.position.set(0, 0, 50) // behind the camera
    const c = new THREE.Mesh(box, mat); c.userData.kind = 'canopy'
    const d = new THREE.Mesh(box, mat); d.name = 'water'; d.visible = false
    scene.add(a, b, c, d); scene.updateMatrixWorld()
    expect(censusScene(scene, cam)).toEqual({ buildings: 1, canopy: 1 })
    expect(categoryOf(c)).toBe('canopy')
  })
})
