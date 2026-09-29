import { describe, it, expect } from 'vitest'
import { worldToMap, mapToWorld, compassOffset } from '../minimapMath.js'

const B = { minX: -2000, minZ: -2000, maxX: 2000, maxZ: 2000 }
describe('minimap math', () => {
  it('maps the world square onto the image', () => {
    expect(worldToMap([-2000, -2000], B, 1000)).toEqual([0, 0])
    expect(worldToMap([2000, 2000], B, 1000)).toEqual([1000, 1000])
  })
  it('mapToWorld inverts worldToMap', () => {
    const [x, z] = mapToWorld(worldToMap([123, -456], B, 1000), B, 1000)
    expect(x).toBeCloseTo(123); expect(z).toBeCloseTo(-456)
  })
  it('clamps far clicks to the camera radius and never returns NaN', () => {
    const [x, z] = mapToWorld([1e9, 1e9], { minX: -9e6, minZ: -9e6, maxX: 9e6, maxZ: 9e6 }, 1000)
    expect(Math.hypot(x, z)).toBeLessThanOrEqual(6000 + 1e-6) // MAX_DIST grew with the world
    expect(mapToWorld([NaN, 5], B, 1000).every(Number.isFinite)).toBe(true)
  })
  it('compass offset wraps', () => {
    expect(compassOffset(0, 360)).toBe(0)
    expect(compassOffset(90, 360)).toBe(90)
    expect(compassOffset(-90, 360)).toBe(270)
    expect(compassOffset(720, 360)).toBe(0)
  })
})
