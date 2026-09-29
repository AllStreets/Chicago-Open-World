import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { patchTrainShader, createTrainMaterial, createLightsMaterial, trainUniforms } from '../trainMaterial.js'
import { facadeUniforms } from '../../world/materials/facadeMaterial.js'

const std = () => ({ vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} })

describe('train materials', () => {
  it('night: lit windows, line-colour signs, headlights only on the leading cab, tail lights on the trailing one', () => {
    const s = patchTrainShader(std())
    for (const a of ['attribute float _kind;', 'attribute vec3 aLine;', 'attribute float aLead;']) expect(s.vertexShader).toContain(a)
    expect(s.vertexShader).toContain('vLocalX = position.x;')
    expect(s.fragmentShader).toContain('if (owK == 6) totalEmissiveRadiance += vLine')
    expect(s.fragmentShader).toContain('owK == 11 && vLead > 0.5 && vLocalX > 0.0')
    expect(s.fragmentShader).toContain('owK == 12 && vLead < -0.5 && vLocalX > 0.0')
    expect(s.uniforms.uNight).toBe(facadeUniforms.uNight); expect(trainUniforms.uNight).toBe(facadeUniforms.uNight)
    expect(createTrainMaterial().vertexColors).toBe(true)
  })
  it('light sprites are additive and never write depth', () => {
    const m = createLightsMaterial()
    expect(m.blending).toBe(THREE.AdditiveBlending); expect(m.depthWrite).toBe(false); expect(m.transparent).toBe(true)
    expect(m.vertexShader).toContain('attribute float aMode;')
  })
})
