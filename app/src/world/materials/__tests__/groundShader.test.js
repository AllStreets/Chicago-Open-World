import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { patchGroundShader, groundUniforms, GROUND_TEXTURES, LAYER_RANK, GROUND_LAYER_COUNT, createGroundMaterial } from '../groundShader.js'
import { GROUND_LAYERS } from '../../../../../pipeline/lib/tilepack.js'
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
  it('one texture, size and tint per ground layer, in pipeline order (paving: brick plazas, user 2026-09-30)', () => {
    expect(GROUND_TEXTURES).toEqual(['asphalt', 'sidewalk', 'grass', 'pitch', 'sand', 'gravel', 'sidewalk', 'sidewalk', 'gravel', 'sidewalk', 'asphalt'])
    expect(GROUND_LAYER_COUNT).toBe(GROUND_LAYERS.length) // the pipeline's layer list, index for index
    expect(groundUniforms.uSize.value).toHaveLength(GROUND_LAYER_COUNT)
    expect(groundUniforms.uTint.value).toHaveLength(GROUND_LAYER_COUNT)
    expect(LAYER_RANK).toHaveLength(GROUND_LAYER_COUNT)
    const s = patchGroundShader(std())
    expect(s.vertexShader).toContain(`uniform float uLayerRank[${GROUND_LAYER_COUNT}];`)
    expect(s.fragmentShader).toContain(`uniform vec3 uTint[${GROUND_LAYER_COUNT}];`)
  })
  it('paving draws over the walks and under the roads, and lays brick in a running bond', () => {
    const [roads, sidewalks, , , , , paving] = LAYER_RANK
    expect(paving).toBeGreaterThan(sidewalks); expect(paving).toBeLessThan(roads)
    expect(patchGroundShader(std()).fragmentShader).toMatch(/li == 6/)
    expect(createGroundMaterial().customProgramCacheKey()).toBe('ground-v9')
  })
  it('D2-3: the ground also takes the U cut-away (a no-op while uCut is 0)', () => {
    const shader = std()
    createGroundMaterial().onBeforeCompile(shader)
    expect(shader.fragmentShader).toMatch(/cutDepthAt/)
    expect(shader.fragmentShader).toMatch(/li == 6/)
    expect(shader.uniforms.uCut.value).toBe(0)
  })
  it('orders overlapping layers in depth by rank, independent of quantized heights', () => {
    const s = patchGroundShader(std())
    expect(s.vertexShader).toMatch(/gl_Position\.z -= uLayerBias \* /)
    const [roads, sidewalks, parks, pitches, beaches, rail] = LAYER_RANK
    expect(roads).toBeGreaterThan(sidewalks); expect(sidewalks).toBeGreaterThan(rail)
    expect(rail).toBeGreaterThan(pitches); expect(pitches).toBeGreaterThan(parks); expect(parks).toBe(beaches)
  })
  it('D1: the river walls (dockwall 7, riprap 8) darken toward the water and never hold snow', () => {
    expect(GROUND_LAYERS.indexOf('dockwall')).toBe(7); expect(GROUND_LAYERS.indexOf('riprap')).toBe(8)
    const f = patchGroundShader(std()).fragmentShader
    expect(f).toMatch(/li >= 7 && li <= 9\) gcol \*=/)
    expect(f).toMatch(/li >= 7 \? 0\.0/)
  })
  it('D5: the lakefront\'s limestone (layer 9) lays coursed blocks and, like the river walls, darkens toward the water', () => {
    expect(GROUND_LAYERS.indexOf('limestone')).toBe(9)
    const f = patchGroundShader(std()).fragmentShader
    expect(f).toMatch(/li == 9/)
  })
  it('F-8: the Lakefront Trail (layer 10) is park blacktop — a dashed centre line, no street glow, ploughed in snow — and draws over the walks, under the roads', () => {
    expect(GROUND_LAYERS.indexOf('trail')).toBe(10)
    const [roads, sidewalks, , , , , paving] = LAYER_RANK, trail = LAYER_RANK[10]
    expect(trail).toBeGreaterThan(paving); expect(trail).toBeGreaterThan(sidewalks); expect(trail).toBeLessThan(roads)
    const f = patchGroundShader(std()).fragmentShader
    expect(f).toMatch(/li == 10\) \{/)
    expect(f).toMatch(/if \(li == 0\) totalEmissiveRadiance/) // only the streets glow sodium
    expect(f).toMatch(/li == 10 \? 0\.55/)
  })
  it('F-8: the sand is warm tan, not pale cream (more red than blue, clearly saturated)', () => {
    const c = groundUniforms.uTint.value[GROUND_LAYERS.indexOf('beaches')], hsl = {}
    c.getHSL(hsl)
    expect(hsl.h * 360).toBeGreaterThan(25); expect(hsl.h * 360).toBeLessThan(50)
    expect(c.r - c.b).toBeGreaterThan(0.3)
    expect(groundMaterials(null).beaches.color.getHex()).toBe(c.getHex())
  })
  it('water is never pulled in front of the streets that bridge it', () => {
    expect(waterMaterial.polygonOffsetFactor).toBeGreaterThan(createGroundMaterial().polygonOffsetFactor)
  })
  it('there is one water material: the ground set no longer carries a river', () => {
    expect(groundMaterials(null).river).toBeUndefined()
  })
})
