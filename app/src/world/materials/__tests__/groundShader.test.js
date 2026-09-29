import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { patchGroundShader, groundUniforms, GROUND_TEXTURES } from '../groundShader.js'
const std = () => ({ vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} })
describe('ground shader', () => {
  it('samples a texture array by per-vertex layer', () => {
    const s = patchGroundShader(std())
    expect(s.vertexShader).toContain('attribute float _layer;')
    expect(s.fragmentShader).toContain('uniform sampler2DArray uGround;')
    expect(s.uniforms.uNight).toBe(groundUniforms.uNight)
  })
  it('one texture, size and tint per ground layer, in pipeline order', () => {
    expect(GROUND_TEXTURES).toEqual(['asphalt', 'sidewalk', 'grass', 'pitch', 'sand', 'gravel'])
    expect(groundUniforms.uSize.value).toHaveLength(6)
    expect(groundUniforms.uTint.value).toHaveLength(6)
  })
})
