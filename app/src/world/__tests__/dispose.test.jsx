// app/src/world/__tests__/dispose.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import * as THREE from 'three'
import { disposeObject } from '../dispose.js'

const h = vi.hoisted(() => ({ scene: null, urls: [] }))
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({ GLTFLoader: class { loadAsync(url) { h.urls.push(url); return Promise.resolve({ scene: h.scene }) } } }))
vi.mock('../materials/useGroundMaterials.js', () => ({ useGroundMaterials: () => ({ land: {} }) }))
import Land from '../Land.jsx'

describe('disposal (H10)', () => {
  it('disposeObject frees every geometry and leaves shared materials alone', () => {
    const mat = new THREE.MeshStandardMaterial(), matSpy = vi.spyOn(mat, 'dispose')
    const a = new THREE.BufferGeometry(), b = new THREE.BufferGeometry()
    const sa = vi.spyOn(a, 'dispose'), sb = vi.spyOn(b, 'dispose')
    const g = new THREE.Group(); g.add(new THREE.Mesh(a, mat)); g.add(new THREE.Mesh(b, mat))
    expect(disposeObject(g)).toBe(2)
    expect(sa).toHaveBeenCalledTimes(1); expect(sb).toHaveBeenCalledTimes(1); expect(matSpy).not.toHaveBeenCalled()
    expect(disposeObject(null)).toBe(0)
  })
  it('Land disposes its geometry on unmount (no leak across remounts) and loads a versioned URL', async () => {
    const geo = new THREE.BufferGeometry(), spy = vi.spyOn(geo, 'dispose')
    h.scene = new THREE.Group(); h.scene.add(new THREE.Mesh(geo))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {}) // <primitive> is an R3F tag; react-dom warns
    const { unmount } = render(<Land file="ground/land.glb" version={4} />)
    await waitFor(() => expect(document.querySelector('primitive')).not.toBeNull())
    unmount()
    err.mockRestore()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(h.urls).toEqual(['/world/ground/land.glb?v=4'])
  })
})
