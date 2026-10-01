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

describe('overcast cloud deck (user, 2026-09-30)', () => {
  it('blends the sky toward a flat cloud colour by the overcast amount', async () => {
    const { applySkyGain } = await import('../skyGain.js')
    const m = { fragmentShader: 'void main(){ gl_FragColor = vec4( retColor, 1.0 ); }', uniforms: {}, needsUpdate: false }
    applySkyGain(m, 0.4, [1, 1, 1], [0.3, 0.3, 0.35, 0.8])
    expect(m.fragmentShader).toContain('skyCloud')
    expect(m.uniforms.skyCloud.value).toEqual([0.3, 0.3, 0.35, 0.8])
    applySkyGain(m, 0.4, [1, 1, 1])
    expect(m.uniforms.skyCloud.value[3]).toBe(0.8) // unchanged when not given
  })
})

describe('the sun disc under weather (user, 2026-09-30: "sun disc visible through rain at dusk")', () => {
  it('scales the solar disc term of the stock sky by a uniform, idempotently', () => {
    const sky = new Sky()
    applySkyGain(sky.material, 0.4, [1, 1, 1], [0.2, 0.2, 0.25, 0.7], 0)
    applySkyGain(sky.material, 0.4, null, null, 0.25)
    expect(sky.material.fragmentShader).toMatch(/sundisk \* skySunDisc/)
    expect(sky.material.fragmentShader.match(/uniform float skySunDisc;/g)).toHaveLength(1)
    expect(sky.material.uniforms.skySunDisc.value).toBe(0.25)
    applySkyGain(sky.material, 0.4)
    expect(sky.material.uniforms.skySunDisc.value).toBe(0.25) // unchanged when not given
  })
  it('a fresh sky shows the whole disc; the stock shader still has the disc line we scale', () => {
    // three-stdlib's Skys all share one material, so a fresh one is a copy of the stock shader
    const m = { fragmentShader: Sky.SkyShader.fragmentShader, uniforms: {}, needsUpdate: false }
    applySkyGain(m, 0.4)
    expect(m.uniforms.skySunDisc.value).toBe(1)
    expect(m.fragmentShader).toMatch(/sundisk \* skySunDisc/)
  })
})
