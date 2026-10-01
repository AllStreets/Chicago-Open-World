import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { minimapSvg, encodeMinimap, MINIMAP_FILE } from '../lib/minimap.js'
import { imageDeltaE, deltaE2000 } from '../lib/deltaE.js'

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

describe('minimap encoding (X-0c · V3)', () => {
  const svg = () => {
    const ring = [[0, 0], [130, 0], [130, -90], [0, -90]]
    return minimapSvg({ land: [ring], water: [[[10, -10], [60, -12], [40, -70]]], parks: [ring], roads: [[[0, 0], [100, -60]]], buildings: [ring] }, { minX: -200, minZ: -200, maxX: 200, maxZ: 200 }, 256)
  }
  it('is lossless (every pixel identical to the rendered svg: ΔE2000 0 avg, 0 max) and deterministic', async () => {
    expect(MINIMAP_FILE).toMatch(/\.webp$/)
    const a = await encodeMinimap(svg()), b = await encodeMinimap(svg())
    expect(a.equals(b)).toBe(true)
    const ref = await sharp(Buffer.from(svg())).removeAlpha().raw().toBuffer()
    const back = await sharp(a).removeAlpha().raw().toBuffer()
    expect(imageDeltaE(ref, back)).toEqual({ avg: 0, max: 0 })
  })
  it('ΔE2000 matches the reference values', () => {
    // Sharma, Wu & Dalal (2005) test pairs 1 and 7
    expect(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 3)
    expect(deltaE2000([50, 0, 0], [50, -1, 2])).toBeCloseTo(2.3669, 3)
  })
})
