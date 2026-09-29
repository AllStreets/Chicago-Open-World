import { describe, it, expect } from 'vitest'
import { packLayers } from '../textureArray.js'

describe('packLayers', () => {
  it('packs N layers of size² RGBA and flips rows (v=0 at the bottom)', () => {
    const size = 2
    // layer 0: top row red, bottom row blue
    const l0 = new Uint8ClampedArray([255,0,0,255, 255,0,0,255, 0,0,255,255, 0,0,255,255])
    const out = packLayers([l0, l0], size)
    expect(out).toHaveLength(2 * size * size * 4)
    expect([...out.slice(0, 4)]).toEqual([0, 0, 255, 255]) // first stored row = bottom (blue)
    expect([...out.slice(16, 20)]).toEqual([0, 0, 255, 255]) // layer 1 starts after layer 0
  })
})

describe('fallbackLayer', () => {
  it('fills a missing layer with the given value (0 for window masks, 128 for albedo)', async () => {
    const { fallbackLayer } = await import('../textureArray.js')
    const mask = fallbackLayer(2, 0)
    expect(mask).toHaveLength(16)
    expect([...mask.slice(0, 4)]).toEqual([0, 0, 0, 255])
    expect([...fallbackLayer(1, 128)]).toEqual([128, 128, 128, 255])
  })
})
