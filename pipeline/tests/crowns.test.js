import { describe, it, expect } from 'vitest'
import { spire, antenna, pyramid, sloped, drum } from '../lib/crowns.js'
const ys = (m) => m.positions.filter((_, i) => i % 3 === 1)
const sq = (x, z, s) => [[x, z], [x + s, z], [x + s, z - s], [x, z - s]]
function frontFacing(m) {
  for (let i = 0; i < m.positions.length; i += 9) {
    const p = m.positions.slice(i, i + 9), n = m.normals.slice(i, i + 3)
    const u = [p[3] - p[0], p[4] - p[1], p[5] - p[2]], v = [p[6] - p[0], p[7] - p[1], p[8] - p[2]]
    const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    if (c[0] * n[0] + c[1] * n[1] + c[2] * n[2] <= 0) return false
  }
  return true
}
describe('crowns', () => {
  it('spire spans base→top, narrows, faces outward', () => {
    const m = spire({ at: [0, 0], base: 300, top: 420, r0: 4 })
    expect(Math.min(...ys(m))).toBe(300); expect(Math.max(...ys(m))).toBe(420)
    expect(frontFacing(m)).toBe(true)
  })
  it('antenna is thin and tall', () => {
    const m = antenna({ at: [5, 5], base: 440, top: 527 })
    const xs = m.positions.filter((_, i) => i % 3 === 0)
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(2)
    expect(frontFacing(m)).toBe(true)
  })
  it('pyramid apex sits over the centroid', () => {
    const m = pyramid({ ring: sq(0, 0, 20), base: 100, top: 120 })
    const i = ys(m).indexOf(120)
    expect(m.positions[i * 3]).toBeCloseTo(10); expect(m.positions[i * 3 + 2]).toBeCloseTo(-10)
    expect(frontFacing(m)).toBe(true)
  })
  it('sloped roof rises along dir', () => {
    const m = sloped({ ring: sq(0, 0, 20), base: 0, lowTop: 100, highTop: 120, dir: [1, 0] })
    const top = []; for (let i = 0; i < m.positions.length; i += 3) if (m.normals[i + 1] > 0.5) top.push([m.positions[i], m.positions[i + 1]])
    const west = top.filter((p) => p[0] < 1).map((p) => p[1]), east = top.filter((p) => p[0] > 19).map((p) => p[1])
    expect(Math.max(...west)).toBeCloseTo(100); expect(Math.min(...east)).toBeCloseTo(120)
    expect(frontFacing(m)).toBe(true)
  })
  it('drum has a flat cap at top', () => {
    const m = drum({ at: [0, 0], base: 10, top: 25, r: 6 })
    expect(Math.max(...ys(m))).toBe(25)
    expect(frontFacing(m)).toBe(true)
  })
})
