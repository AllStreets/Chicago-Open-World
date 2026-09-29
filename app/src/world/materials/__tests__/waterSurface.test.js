// app/src/world/materials/__tests__/waterSurface.test.js
import { describe, it, expect } from 'vitest'
import { createWaterMaterial, waterMaterial, waterUniforms, WATER_VERTEX, WATER_FRAGMENT, REFLECT_LAYER, WATER_PLANE_Y } from '../waterSurface.js'
import { createGroundMaterial } from '../groundShader.js'

describe('WaterSurface (B.2)', () => {
  it('one material program and one uniform set for the lake and every water tile', () => {
    expect(createWaterMaterial().uniforms).toBe(waterUniforms)
    expect(waterMaterial.uniforms).toBe(waterUniforms)
  })
  it('reads the per-vertex calm and samples the one shared reflection', () => {
    expect(WATER_VERTEX).toContain('attribute float _calm;')
    expect(WATER_VERTEX).toContain('vReflUv = uTextureMatrix * world;')
    expect(WATER_FRAGMENT).toContain('uniform sampler2D uReflection;')
    expect(WATER_FRAGMENT).toMatch(/mix\(uSky, texture2D\(uReflection, ruv\)\.rgb, uReflect\)/)
  })
  it('calm scales ripple amplitude and speed; colour and reflection are shared', () => {
    expect(WATER_FRAGMENT).toMatch(/float t = uTime \* mix\(0\.3, 1\.0, calm\);/)
    expect(WATER_FRAGMENT).toMatch(/float amp = 1\.5 \* mix\(0\.2, 1\.0, calm\);/)
  })
  it('the far water fades to the horizon colour, never the grey fog', () => {
    expect(WATER_FRAGMENT).toContain('col = mix(col, uHorizon, smoothstep(uFar.x, uFar.y, dist));')
    expect(WATER_FRAGMENT).not.toContain('fog_fragment')
  })
  it('shore foam and shallows from the baked texture; the river ignores it and turns green on March 17', () => {
    expect(WATER_FRAGMENT).toContain('uniform sampler2D uShore;')
    expect(WATER_FRAGMENT).toContain('shoreD = mix(shoreD, 1.0, isRiver);')
    expect(WATER_FRAGMENT).toContain('body = mix(body, uGreenColor, uGreen * isRiver);')
  })
  it('never pulled in front of the streets that bridge it', () => {
    expect(createWaterMaterial().polygonOffsetFactor).toBeGreaterThan(createGroundMaterial().polygonOffsetFactor)
  })
  it('the reflection layer and the mirror plane sit between the lake (0.02) and polygon water (0.04)', () => {
    expect(REFLECT_LAYER).toBe(2)
    expect(WATER_PLANE_Y).toBe(0.03)
  })
})
