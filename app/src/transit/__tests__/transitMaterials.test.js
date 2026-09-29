import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { patchGlowShader, patchStructureShader, glowUniforms, structureUniforms, setLineMask, createGlowMaterial, createStructureMaterial } from '../transitMaterials.js'
import { facadeUniforms } from '../../world/materials/facadeMaterial.js'

const lib = (k) => ({ vertexShader: THREE.ShaderLib[k].vertexShader, fragmentShader: THREE.ShaderLib[k].fragmentShader, uniforms: {} })

describe('transit materials', () => {
  it('glow: expands a camera-facing ribbon from the tangent, width-compensated, lanes side by side', () => {
    const s = patchGlowShader(lib('basic'))
    for (const a of ['_side', '_lane', '_lanes', '_line', '_intensity', '_ghost']) expect(s.vertexShader).toContain(`attribute float ${a};`)
    expect(s.vertexShader).toContain('owGlowHalfWidth(owDist, uTanHalfFov, uViewportH, uMinPx, uBaseHalf)')
    expect(s.vertexShader).toContain('_lane * 2.0 * owHw + _side * owHw')
    expect(s.fragmentShader).toContain('owGlowLevel(uNight)')
    expect(s.uniforms.uNight).toBe(facadeUniforms.uNight)
    const m = createGlowMaterial()
    expect(m.transparent).toBe(true); expect(m.depthWrite).toBe(false); expect(m.side).toBe(THREE.DoubleSide); expect(m.vertexColors).toBe(true)
  })
  it('structure: kinds drive painted ties, polished rails, lit accents and signs', () => {
    const s = patchStructureShader(lib('standard'))
    expect(s.vertexShader).toContain('attribute float _kind;'); expect(s.vertexShader).toContain('attribute float _along;')
    expect(s.fragmentShader).toContain('fract(vAlong / 0.61)')
    expect(s.fragmentShader).toContain('if (owK == 4) totalEmissiveRadiance')
    expect(s.uniforms.uAccent).toBe(structureUniforms.uAccent)
    expect(createStructureMaterial().vertexColors).toBe(true)
    expect(() => patchStructureShader({ vertexShader: 'void main(){}', fragmentShader: '', uniforms: {} })).toThrow(/missing/)
  })
  it('the line mask switches single lines off by catalog index', () => {
    setLineMask([{ id: 'red', index: 0 }, { id: 'blue', index: 1 }, { id: 'up-n', index: 8 }], ['blue', 'up-n'])
    expect(glowUniforms.uLineOn.value[0]).toBe(1); expect(glowUniforms.uLineOn.value[1]).toBe(0)
    expect(glowUniforms.uLineOn.value[8]).toBe(0); expect(glowUniforms.uLineOn.value[2]).toBe(1)
    setLineMask([{ id: 'blue', index: 1 }], [])
    expect(glowUniforms.uLineOn.value[1]).toBe(1)
  })
})

import * as THREE_ from 'three'
import { createGlowMaterial as cgm, GLOW_BLENDING } from '../transitMaterials.js'
describe('glow blending (coordinator override: neon)', () => {
  it('the line glow blends additively', () => {
    expect(GLOW_BLENDING).toBe(THREE_.AdditiveBlending)
    expect(cgm().blending).toBe(THREE_.AdditiveBlending)
  })
})

