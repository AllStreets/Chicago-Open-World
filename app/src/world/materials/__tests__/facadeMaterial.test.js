import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { patchFacadeShader, facadeUniforms } from '../facadeMaterial.js'

const std = () => ({
  vertexShader: THREE.ShaderLib.standard.vertexShader,
  fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  uniforms: {},
})

describe('patchFacadeShader', () => {
  it('injects attributes, varyings and uniforms into the standard shader', () => {
    const s = patchFacadeShader(std())
    expect(s.vertexShader).toContain('attribute float _facade;')
    expect(s.vertexShader).toContain('vFacade = _facade;')
    expect(s.fragmentShader).toContain('uniform sampler2DArray uAlbedo;')
    expect(s.fragmentShader).toContain('totalEmissiveRadiance +=')
    expect(s.uniforms.uNight).toBe(facadeUniforms.uNight)
  })
  it('fails loudly when three.js changes a chunk name', () => {
    const broken = std(); broken.fragmentShader = broken.fragmentShader.replace('#include <emissivemap_fragment>', '')
    expect(() => patchFacadeShader(broken)).toThrow(/emissivemap_fragment/)
  })
  it('has one tile descriptor per façade family', () => {
    expect(facadeUniforms.uTile.value).toHaveLength(8)
  })
  it('residential façades get their own sparser, warmer night occupancy', () => {
    const s = patchFacadeShader(std())
    expect(s.fragmentShader).toContain('isResidential')
  })
  it('takes screen-space derivatives only in uniform control flow (ANGLE/D3D safe)', () => {
    const f = patchFacadeShader({ vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} }).fragmentShader
    const body = f.slice(f.indexOf('void main()'))
    const firstBranch = body.indexOf('if (isVenue)')
    expect(firstBranch).toBeGreaterThan(0)
    expect(body.slice(firstBranch)).not.toMatch(/fwidth\(|dFdx\(|dFdy\(/)
    expect(f.slice(0, f.indexOf('void main()'))).not.toMatch(/fwidth\(/) // helper functions run inside branches
  })
})
