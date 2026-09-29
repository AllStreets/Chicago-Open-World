import { describe, it, expect } from 'vitest'
import { makeSeamless, windowMaskFromLuma } from '../textures/seamless.js'

function gradient(w, h) {
  const d = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[y * w + x] = Math.round((x / (w - 1)) * 200)
  return d
}

describe('makeSeamless', () => {
  it('wraps horizontally without a seam', () => {
    const w = 64, h = 16
    const out = makeSeamless(gradient(w, h), w, h, 1, 16)
    for (let y = 0; y < h; y++) expect(Math.abs(out[y * w] - out[y * w + w - 1])).toBeLessThan(12)
  })
  it('leaves the center untouched', () => {
    const w = 64, h = 64, src = gradient(w, h)
    const out = makeSeamless(src, w, h, 1, 8)
    expect(out[32 * w + 32]).toBe(src[32 * w + 32])
  })
})

describe('windowMaskFromLuma', () => {
  it('dark pixels become window (255), bright become wall (0), smooth between', () => {
    const m = windowMaskFromLuma(new Uint8Array([10, 70, 90, 200]), 60, 100)
    expect(m[0]).toBe(255); expect(m[3]).toBe(0)
    expect(m[1]).toBeGreaterThan(m[2])
  })
})

describe('windowMaskFromChroma', () => {
  it('neutral grey (glass) → 255, saturated red/tan (brick) → 0', async () => {
    const { windowMaskFromChroma } = await import('../textures/seamless.js')
    const rgb = new Uint8Array([150, 150, 152, 170, 80, 60, 190, 160, 110])
    const m = windowMaskFromChroma(rgb, 10, 40)
    expect(m[0]).toBe(255); expect(m[1]).toBe(0); expect(m[2]).toBe(0)
  })
})
