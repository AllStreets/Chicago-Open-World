import { describe, it, expect } from 'vitest'
import { minimapSvg } from '../lib/minimap.js'

describe('minimapSvg', () => {
  it('draws each layer as paths inside a square svg', () => {
    const ring = [[0, 0], [100, 0], [100, -100], [0, -100]]
    const svg = minimapSvg({ land: [ring], water: [], parks: [ring], roads: [[[0, 0], [100, 0]]], buildings: [ring, ring] }, { minX: -200, minZ: -200, maxX: 200, maxZ: 200 }, 512)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('width="512"')
    expect((svg.match(/<path/g) || []).length).toBe(5)
    expect(svg).toContain('#243650')
  })
})
