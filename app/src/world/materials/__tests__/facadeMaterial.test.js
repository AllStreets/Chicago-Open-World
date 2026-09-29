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
})
