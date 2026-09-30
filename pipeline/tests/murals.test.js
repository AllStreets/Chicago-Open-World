// pipeline/tests/murals.test.js — the four Pilsen mural layers are original procedural art (ruling: no reproductions).
import { describe, it, expect } from 'vitest'
import { MURAL_COUNT, muralPixel } from '../textures/murals.js'

describe('mural art', () => {
  it('has four distinct, deterministic, in-range layers', () => {
    const means = []
    for (let k = 0; k < MURAL_COUNT; k++) {
      let s = [0, 0, 0]
      for (let i = 0; i < 400; i++) {
        const u = (i % 20) / 20, v = Math.floor(i / 20) / 20, p = muralPixel(k, u, v)
        for (const c of p) { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(255) }
        s = s.map((x, j) => x + p[j] / 400)
      }
      expect(muralPixel(k, 0.37, 0.61)).toEqual(muralPixel(k, 0.37, 0.61))
      means.push(s)
    }
    expect(MURAL_COUNT).toBe(4)
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) expect(Math.hypot(...means[a].map((x, j) => x - means[b][j]))).toBeGreaterThan(12)
  })
  it('is saturated like the neighbourhood palette, not grey', () => {
    for (let k = 0; k < MURAL_COUNT; k++) {
      let sat = 0
      for (let i = 0; i < 400; i++) { const p = muralPixel(k, (i % 20) / 20 + 0.01, Math.floor(i / 20) / 20 + 0.01); sat += (Math.max(...p) - Math.min(...p)) / 400 }
      expect(sat).toBeGreaterThan(60)
    }
  })
})
