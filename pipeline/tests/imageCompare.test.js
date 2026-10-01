// X-0f: the parity metrics behave — identical images score SSIM 1 and 0 % diff; a visible change fails both gates.
import { describe, it, expect } from 'vitest'
import { diffRatio, ssim } from '../lib/imageCompare.js'

const W = 64, H = 48
const img = (f) => { const b = new Uint8Array(W * H * 3); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = f(x, y); b.set([v, v * 0.8, 255 - v], (y * W + x) * 3) } return b }
const grad = img((x, y) => (x * 3 + y * 2) % 256)

describe('image comparison (X-0f)', () => {
  it('identical images: SSIM 1, no differing pixels', () => {
    expect(ssim(grad, grad.slice(), W, H)).toBeCloseTo(1, 10)
    expect(diffRatio(grad, grad.slice(), W, H)).toBe(0)
  })
  it('a 1-level shift is invisible to the pixel test and keeps SSIM above 0.995', () => {
    const b = grad.map((v) => Math.min(255, v + 1))
    expect(diffRatio(grad, b, W, H)).toBe(0)
    expect(ssim(grad, b, W, H)).toBeGreaterThan(0.995)
  })
  it('a moved edge fails both gates', () => {
    const b = img((x, y) => (x > 20 ? 200 : 30)), c = img((x, y) => (x > 26 ? 200 : 30))
    expect(diffRatio(b, c, W, H)).toBeGreaterThan(0.03)
    expect(ssim(b, c, W, H)).toBeLessThan(0.995)
  })
})
