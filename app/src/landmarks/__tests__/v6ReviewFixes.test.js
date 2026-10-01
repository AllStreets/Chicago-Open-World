// V6 final-review fixes (app side): each test reproduces one reviewer finding.
import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { renderCubePart } from '../cubeFaces.js'
import { showEmitters } from '../jets.js'

describe('V6 review fixes', () => {
  it('#1 completing a cube face flags the mirror PMREM for a rebuild (the Bean must not freeze on its first frame)', () => {
    const rt = new THREE.WebGLCubeRenderTarget(8)
    const before = rt.texture.pmremVersion
    const gl = { autoClear: true, getRenderTarget: () => null, setRenderTarget: vi.fn(), render: vi.fn(), xr: { enabled: false }, shadowMap: { autoUpdate: true } }
    let during = null
    gl.render = vi.fn(() => { during = gl.shadowMap.autoUpdate })
    renderCubePart(gl, rt, new THREE.Scene(), new THREE.CubeCamera(1, 10, rt), 3, 0, { parts: 1 })
    expect(rt.texture.pmremVersion).toBeGreaterThan(before)
    expect(during).toBe(false)                       // #7: no city shadow pass per cube face
    expect(gl.shadowMap.autoUpdate).toBe(true)       // restored
    expect(gl.setRenderTarget).toHaveBeenLastCalledWith(null)
  })
  it('#2 the fountain emitter list is stable for one runtime (no new GPU buffers on every render)', () => {
    const runtime = { fountain: { emitters: [{ kind: 'centre' }] }, crown: { spouts: [{ kind: 'crown' }] } }
    const a = showEmitters(runtime), b = showEmitters(runtime)
    expect(a).toBe(b)
    expect(a).toHaveLength(2)
    expect(showEmitters({ fountain: { emitters: [] } })).not.toBe(a)
  })
})
