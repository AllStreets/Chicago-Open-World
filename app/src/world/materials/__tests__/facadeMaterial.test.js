import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { patchFacadeShader, facadeUniforms } from '../facadeMaterial.js'
import { setFieldFrames, setVenueLights } from '../facadeMaterial.js'

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
    expect(createFacadeMaterial().customProgramCacheKey()).toBe('facade-v14')
  })
  it('crown night light: flood reflects off the wall, lantern glows, both only at night inside the band', () => {
    const f = patchFacadeShader(std()).fragmentShader
    const em = f.slice(f.indexOf('if (styled && uNight > 0.001)'))
    expect(em).toContain('if (styled && uNight > 0.001)')
    expect(em).toContain('vec4 C5 = styleTexel(si, 5), C6 = styleTexel(si, 6);')
    expect(em).toContain('float band = step(C6.r, vWPos.y) * step(vWPos.y, C6.g);')
    expect(em).toMatch(/C6\.b > 0\.5 && C6\.b < 1\.5\) totalEmissiveRadiance \+= diffuseColor\.rgb \* C5\.rgb/)
    expect(em).toMatch(/C6\.b > 1\.5\) totalEmissiveRadiance \+= C5\.rgb \* C5\.a \* band \* uNight \* uLitBoost/)
  })
})

describe('field surfaces (façade 24)', () => {
  it('draw and glow like turf', () => {
    const f = patchFacadeShader(std()).fragmentShader
    expect(f).toContain('vi == 24')
    expect(f).toMatch(/\(vi >= 10 && vi <= 12\) \|\| vi == 24/)
  })
})


describe('venue uniforms (V5)', () => {
  it('samples the painted field layer and gates venue light by position', () => {
    const s = patchFacadeShader(std())
    expect(s.fragmentShader).toContain('uniform sampler2DArray uFieldTex;')
    expect(s.fragmentShader).toContain('float venueLevel(vec2 p)')
    expect(s.fragmentShader).toContain('textureGrad(uFieldTex')
    for (const u of ['uFieldTex', 'uFieldFrame', 'uVenueLight']) expect(s.uniforms[u]).toBe(facadeUniforms[u])
  })
  it('setFieldFrames packs (u0, v1, 1/width, 1/height) per slot and clears the rest', () => {
    setFieldFrames([{ slot: 1, frame: { u0: -24, u1: 132, v0: -96, v1: 96 } }])
    const v = facadeUniforms.uFieldFrame.value
    expect([v[1].x, v[1].y, v[1].z, v[1].w]).toEqual([-24, 96, 1 / 156, 1 / 192])
    expect(v[0].z).toBe(0)
    setFieldFrames([])
    expect(v[1].z).toBe(0)
  })
  it('setVenueLights registers (x, z, radius, level) per slot and clears the rest', () => {
    setVenueLights([{ slot: 3, center: [-3842, 147], radius: 130, level: 0.5 }])
    const v = facadeUniforms.uVenueLight.value
    expect([v[3].x, v[3].y, v[3].z, v[3].w]).toEqual([-3842, 147, 130, 0.5])
    setVenueLights([])
    expect(v[3].z).toBe(0)
  })
  it('keeps derivatives out of branches (the uv gradient is taken before the venue branch)', () => {
    const f = patchFacadeShader(std()).fragmentShader
    const body = f.slice(f.indexOf('void main()'))
    expect(body.indexOf('vec4 uvGrad = vec4(dFdx(vMUv), dFdy(vMUv));')).toBeGreaterThan(0)
    expect(body.indexOf('vec4 uvGrad')).toBeLessThan(body.indexOf('if (isVenue)'))
  })
})
