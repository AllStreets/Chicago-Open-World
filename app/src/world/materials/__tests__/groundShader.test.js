import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { patchGroundShader, groundUniforms, GROUND_TEXTURES, LAYER_RANK, createGroundMaterial } from '../groundShader.js'
import { groundMaterials } from '../groundMaterials.js'
import { waterMaterial } from '../waterSurface.js'
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
  it('orders overlapping layers in depth by rank, independent of quantized heights', () => {
    const s = patchGroundShader(std())
    expect(s.vertexShader).toMatch(/gl_Position\.z -= uLayerBias \* /)
    const [roads, sidewalks, parks, pitches, beaches, rail] = LAYER_RANK
    expect(roads).toBeGreaterThan(sidewalks); expect(sidewalks).toBeGreaterThan(rail)
    expect(rail).toBeGreaterThan(pitches); expect(pitches).toBeGreaterThan(parks); expect(parks).toBe(beaches)
  })
  it('water is never pulled in front of the streets that bridge it', () => {
    expect(waterMaterial.polygonOffsetFactor).toBeGreaterThan(createGroundMaterial().polygonOffsetFactor)
  })
  it('there is one water material: the ground set no longer carries a river', () => {
    expect(groundMaterials(null).river).toBeUndefined()
  })
})
