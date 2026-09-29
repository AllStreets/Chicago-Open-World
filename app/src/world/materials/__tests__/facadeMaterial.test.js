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
  it('reads the style attribute and palette (V2)', () => {
    const s = patchFacadeShader(std())
    expect(s.vertexShader).toContain('attribute float _style;')
    expect(s.vertexShader).toContain('vStyle = _style;')
    expect(s.fragmentShader).toContain('uniform sampler2D uStylePal;')
    expect(s.fragmentShader).toMatch(/texelFetch\(uStylePal, ivec2\(col, si\), 0\)/)
    expect(s.uniforms.uStylePal).toBe(facadeUniforms.uStylePal)
    expect(s.uniforms.uStyleRows).toBe(facadeUniforms.uStyleRows)
  })
  it('clamps a style index beyond the palette to 0', () => {
    const f = patchFacadeShader(std()).fragmentShader
    expect(f).toMatch(/int si = int\(vStyle \+ 0\.5\);\s*si = float\(si\) < uStyleRows \? si : 0;/)
    expect(f).toContain('bool styled = si > 0;')
  })
  it('sourced colours skip the random seed variation and glass tint buckets', () => {
    const f = patchFacadeShader(std()).fragmentShader
    expect(f).toContain('if (!isVenue && !styled)')
    expect(f).toContain('if (fi == 3 && !styled)')
  })
  it('finish presets drive roughness and metalness; windows stay glass', () => {
    const f = patchFacadeShader(std()).fragmentShader
    expect(f).toContain('roughnessFactor = mix(S1.a, 0.06, win * 0.95);')
    expect(f).toContain('metalnessFactor = mix(S2.a, 0.9, win * 0.85);')
  })
  it('program cache key changes with the new shader', async () => {
    const { createFacadeMaterial } = await import('../facadeMaterial.js')
    expect(createFacadeMaterial().customProgramCacheKey()).toBe('facade-v8')
  })
})
