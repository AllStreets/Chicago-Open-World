import { describe, it, expect } from 'vitest'
import { proceduralTexture, PROCEDURAL_KINDS } from '../textures/procedural.js'

describe('proceduralTexture', () => {
  it('makes an RGB buffer of size² for every kind', () => {
    for (const k of PROCEDURAL_KINDS) expect(proceduralTexture(k, 64)).toHaveLength(64 * 64 * 3)
  })
  it('is deterministic', () => {
    expect(proceduralTexture('grass', 32)).toEqual(proceduralTexture('grass', 32))
  })
  it('tiles: opposite edges are continuous', () => {
    const s = 128, d = proceduralTexture('concrete', s)
    let diff = 0
    for (let y = 0; y < s; y++) for (let c = 0; c < 3; c++) diff += Math.abs(d[(y * s) * 3 + c] - d[(y * s + s - 1) * 3 + c])
    expect(diff / (s * 3)).toBeLessThan(10)
  })
  it('grass is green, asphalt is dark, sand is light', () => {
    const avg = (k) => { const d = proceduralTexture(k, 32); const a = [0, 0, 0]; for (let i = 0; i < d.length; i++) a[i % 3] += d[i]; return a.map((v) => v / (d.length / 3)) }
    const g = avg('grass'); expect(g[1]).toBeGreaterThan(g[0]); expect(g[1]).toBeGreaterThan(g[2])
    expect(avg('asphalt').reduce((a, b) => a + b) / 3).toBeLessThan(90)
    expect(avg('sand').reduce((a, b) => a + b) / 3).toBeGreaterThan(160)
  })
  it('rejects unknown kinds', () => {
    expect(() => proceduralTexture('lava', 8)).toThrow()
  })
})
