import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { cubeStepFor, cubeActive, CUBE, CUBE_STEPS, sliceFace, renderCubePart, skipInCube, CUBE_SKIP, trianglesOf } from '../cubeFaces.js'

const box = (x, z, mat = new THREE.MeshBasicMaterial()) => { const m = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), mat); m.position.set(x, 0, z); m.updateMatrixWorld(); return m }
const faceCam = () => { const c = new THREE.PerspectiveCamera(90, 1, 1, 3000); c.lookAt(0, 0, -1); c.updateMatrixWorld(); c.matrixWorldInverse.copy(c.matrixWorld).invert(); return c }

describe('Cloud Gate cube camera budget', () => {
  it('every face in CUBE.parts slices, one a frame, then idle until the next refresh', () => {
    expect(CUBE_STEPS).toBe(6 * CUBE.parts)
    expect(CUBE_STEPS).toBeLessThanOrEqual(CUBE.period)
    const steps = Array.from({ length: CUBE_STEPS }, (_, f) => cubeStepFor(f))
    expect(steps[0]).toEqual({ face: 0, part: 0 })
    expect(steps.at(-1)).toEqual({ face: 5, part: CUBE.parts - 1 })
    for (let face = 0; face < 6; face++) expect(steps.filter((s) => s.face === face).map((s) => s.part)).toEqual([...Array(CUBE.parts).keys()])
    for (let f = CUBE_STEPS; f < CUBE.period; f++) expect(cubeStepFor(f)).toBe(null)
    expect(cubeStepFor(CUBE.period)).toEqual({ face: 0, part: 0 })
  })
  it('stays correct for huge and negative frame counters', () => {
    const s = cubeStepFor(Number.MAX_SAFE_INTEGER)
    expect(s === null || (s.face >= 0 && s.face <= 5 && Number.isInteger(s.part))).toBe(true)
    expect(cubeStepFor(-CUBE.period)).toEqual({ face: 0, part: 0 })
  })
  it('never renders at LOW or when the Bean is far away', () => {
    expect(cubeActive({ quality: 'LOW', camDist: 10 })).toBe(false)
    expect(cubeActive({ quality: 'HIGH', camDist: CUBE.maxDist + 1 })).toBe(false)
    expect(cubeActive({ quality: 'HIGH', camDist: 800 })).toBe(true)
    expect(cubeActive({ quality: 'ULTRA', camDist: 0 })).toBe(true)
  })
  it('slices a face farthest first into runs of about equal triangles; transparent last; outside the face nowhere', () => {
    const near = [box(0, -50), box(0, -60)], far = [box(0, -900), box(0, -1000)]
    const glass = box(0, -2000, new THREE.MeshBasicMaterial({ transparent: true }))
    const behind = box(0, 500)
    const s = sliceFace([...near, ...far, glass, behind], faceCam(), new THREE.Vector3(), 2)
    expect(far.map((o) => s.get(o))).toEqual([0, 0])
    expect(near.map((o) => s.get(o))).toEqual([1, 1])
    expect(s.get(glass)).toBe(1)
    expect(s.has(behind)).toBe(false)
    expect(trianglesOf(near[0])).toBe(12)
  })
  it('draws one slice: the rest hidden and restored; later slices keep the face (no clear); PMREM only when whole', () => {
    const rt = new THREE.WebGLCubeRenderTarget(8), scene = new THREE.Scene()
    scene.background = new THREE.Color('#123456')
    const a = box(0, -1000), b = box(0, -50), skipped = box(0, -40)
    scene.add(a, b, skipped)
    const undo = skipInCube([skipped])
    const cubeCam = new THREE.CubeCamera(1, 3000, rt); cubeCam.updateMatrixWorld(true)
    const seen = []
    const gl = { autoClear: true, getRenderTarget: () => null, setRenderTarget: vi.fn(), xr: { enabled: false }, shadowMap: { autoUpdate: true },
      render: vi.fn(() => seen.push({ a: a.visible, b: b.visible, skipped: skipped.visible, clear: gl.autoClear, bg: scene.background, shadows: gl.shadowMap.autoUpdate })) }
    const v0 = rt.texture.pmremVersion
    const face = [0, 1, 2, 3, 4, 5].find((f) => { const s = sliceFace([a, b], cubeCam.children[f], cubeCam.position, 2); return s.has(a) && s.has(b) })
    renderCubePart(gl, rt, scene, cubeCam, face, 0, { parts: 2 })
    expect(rt.texture.pmremVersion).toBe(v0) // half a face never reaches the mirror
    renderCubePart(gl, rt, scene, cubeCam, face, 1, { parts: 2 })
    expect(rt.texture.pmremVersion).toBeGreaterThan(v0)
    expect(seen[0]).toMatchObject({ a: true, b: false, skipped: false, clear: true, shadows: false })
    expect(seen[0].bg).toBe(scene.background)
    expect(seen[1]).toMatchObject({ a: false, b: true, skipped: false, clear: false, bg: null })
    expect([a.visible, b.visible, skipped.visible, gl.autoClear, gl.shadowMap.autoUpdate]).toEqual([true, true, true, true, true])
    expect(scene.background.isColor).toBe(true)
    undo()
    expect(CUBE_SKIP.has(skipped)).toBe(false)
  })
})
