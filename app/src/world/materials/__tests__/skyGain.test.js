import { describe, it, expect } from 'vitest'
import { Sky } from 'three-stdlib'
import { applySkyGain } from '../skyGain.js'

describe('applySkyGain', () => {
  it('scales the sky output by a uniform and is idempotent', () => {
    const sky = new Sky()
    applySkyGain(sky.material, 0.45)
    applySkyGain(sky.material, 0.5)
    expect(sky.material.fragmentShader).toContain('retColor * skyGain')
    expect(sky.material.fragmentShader.match(/uniform float skyGain;/g)).toHaveLength(1)
    expect(sky.material.uniforms.skyGain.value).toBe(0.5)
  })
  it('throws if three-stdlib changes the output line', () => {
    const m = { fragmentShader: 'void main(){}', uniforms: {} }
    expect(() => applySkyGain(m, 1)).toThrow(/sky shader/)
  })
})
