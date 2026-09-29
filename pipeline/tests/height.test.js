import { describe, it, expect } from 'vitest'
import { parseHeightTag, resolveHeight, FLOOR_M } from '../lib/height.js'

describe('height', () => {
  it('parses plain, unit-suffixed, approximate and feet tags', () => {
    expect(parseHeightTag('124')).toBe(124)
    expect(parseHeightTag('124 m')).toBe(124)
    expect(parseHeightTag('~30')).toBe(30)
    expect(parseHeightTag("100'")).toBeCloseTo(30.48)
    expect(parseHeightTag('100 ft')).toBeCloseTo(30.48)
  })
  it('rejects garbage', () => {
    for (const bad of [undefined, null, '', 'tall', '-5', '0']) expect(parseHeightTag(bad)).toBeNull()
  })
  it('prefers OSM height, then OSM levels, then city stories, then a default', () => {
    expect(resolveHeight({ osmHeight: '124', stories: '30' })).toBe(124)
    expect(resolveHeight({ osmLevels: '10', stories: '30' })).toBeCloseTo(10 * FLOOR_M)
    expect(resolveHeight({ stories: '110' })).toBeCloseTo(110 * FLOOR_M)
    expect(resolveHeight({ stories: '0' })).toBe(10)
    expect(resolveHeight({})).toBe(10)
  })
  it('clamps to 530 m (Willis antennas are 527 m)', () => {
    expect(resolveHeight({ osmHeight: '527' })).toBe(527)
    expect(resolveHeight({ osmHeight: '9000' })).toBe(530)
  })
})
