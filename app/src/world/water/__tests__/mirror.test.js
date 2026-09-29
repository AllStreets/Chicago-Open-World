// app/src/world/water/__tests__/mirror.test.js
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { mirrorCamera, textureMatrixFor } from '../mirror.js'

describe('shared planar reflection math', () => {
  const cam = new THREE.PerspectiveCamera(42, 1.6, 5, 60000)
  cam.position.set(300, 250, 900); cam.lookAt(0, 0, 0); cam.updateMatrixWorld()
  const mirror = mirrorCamera(cam, 0, new THREE.PerspectiveCamera())
  it('the mirror camera sits below the water, reflected', () => {
    expect(mirror.position.x).toBeCloseTo(300, 9)
    expect(mirror.position.y).toBeCloseTo(-250, 9)
    expect(mirror.position.z).toBeCloseTo(900, 9)
    expect(mirror.projectionMatrix.equals(cam.projectionMatrix)).toBe(true)
  })
  it('a point on the water samples the reflection at the mirrored screen x, same screen y', () => {
    const m = textureMatrixFor(mirror, new THREE.Matrix4())
    for (const q of [[0, 0, 0], [120, 0, -300], [-80, 0, 200]]) {
      const v = new THREE.Vector4(...q, 1).applyMatrix4(m)
      const s = new THREE.Vector3(...q).project(cam)
      expect(v.x / v.w).toBeCloseTo(1 - (s.x * 0.5 + 0.5), 6)
      expect(v.y / v.w).toBeCloseTo(s.y * 0.5 + 0.5, 6)
    }
  })
  it('works for a water plane above zero', () => {
    const m2 = mirrorCamera(cam, 0.03, new THREE.PerspectiveCamera())
    expect(m2.position.y).toBeCloseTo(-249.94, 9)
  })
})
