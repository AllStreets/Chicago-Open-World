import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { patchFacadeShader, facadeUniforms } from '../facadeMaterial.js'

const std = () => ({ vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} })

describe('V6 façade surfaces', () => {
  it('draws stone, grid deck, signal lamps, LED faces and bronze', () => {
    const s = patchFacadeShader(std())
    for (const n of [25, 26, 27, 28, 29]) expect(s.fragmentShader).toContain(`vi == ${n}`)
    expect(s.fragmentShader).toContain('vec3 crownFace(vec2 uv, vec4 c)')
    expect(s.fragmentShader).toContain('uniform vec4 uCrownB;')
  })
  it('wires the new uniforms to the shared objects', () => {
    const s = patchFacadeShader(std())
    expect(s.uniforms.uTime).toBe(facadeUniforms.uTime)
    expect(s.uniforms.uCrown).toBe(facadeUniforms.uCrown)
    expect(s.uniforms.uCrownB).toBe(facadeUniforms.uCrownB)
    expect(facadeUniforms.uCrown.value.w).toBe(1)
  })
  it('LED faces glow by day too, signal lamps mostly at night', () => {
    const s = patchFacadeShader(std())
    expect(s.fragmentShader).toMatch(/vi == 28\) totalEmissiveRadiance/)
    expect(s.fragmentShader).toMatch(/vi == 27\) totalEmissiveRadiance/)
  })
})

describe('grid deck anti-aliasing', () => {
  it('the 12 cm steel grid fades to its average once a cell is under a pixel (no moiré), derivative taken before any branch', () => {
    const f = patchFacadeShader(std()).fragmentShader
    const body = f.slice(f.indexOf('void main()'))
    expect(f).toContain('float gFwXZ;')
    expect(body.indexOf('gFwXZ = length(fwidth(vWPos.xz));')).toBeGreaterThan(0)
    expect(body.indexOf('gFwXZ = length(fwidth(vWPos.xz));')).toBeLessThan(body.indexOf('if (isVenue)'))
    expect(f).toMatch(/smoothstep\([^)]*gFwXZ/)
  })
})

describe('bascule leaves rotate in object space', () => {
  it('the world-space trunnion pivot and axis are brought into the (quantized) mesh space before rotating', () => {
    const s = patchFacadeShader(std())
    expect(s.vertexShader).toContain('inverse(modelMatrix)')
    expect(s.vertexShader).toMatch(/lp\.xyz = \(lInv \* vec4\(lp\.xyz, 1\.0\)\)\.xyz/)
    expect(s.vertexShader).toMatch(/lk\.xyz = normalize\(mat3\(lInv\) \* lk\.xyz\)/)
  })
})

describe('the fountain pool takes the show light', () => {
  it('water (façade 22) near the fountain glows in the show colour at night', () => {
    const s = patchFacadeShader(std())
    expect(s.uniforms.uShowGlow).toBe(facadeUniforms.uShowGlow)
    expect(s.uniforms.uShowAt).toBe(facadeUniforms.uShowAt)
    expect(s.fragmentShader).toMatch(/vi == 22 &&[^\n]*uShowGlow/)
  })
})
