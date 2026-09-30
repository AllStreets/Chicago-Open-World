import { describe, it, expect } from 'vitest'
import { spire, antenna, pyramid, sloped, drum, vault, stepdome, pavilion, gothicCrown } from '../lib/crowns.js'
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

const rectR = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
const tops = (m) => { const o = []; for (let i = 0; i < m.positions.length; i += 3) if (m.normals[i + 1] > 0.5) o.push([m.positions[i], m.positions[i + 1], m.positions[i + 2]]); return o }

describe('arena roofs', () => {
  it('vault: ridge along the axis at base + rise, eaves at base, closed gables, outward-facing', () => {
    const m = vault({ ring: rectR(0, 0, 96, -128), base: 25, rise: 5.5, axis: [0, -1] })
    expect(Math.max(...ys(m))).toBeCloseTo(30.5, 1)
    expect(Math.min(...ys(m))).toBeCloseTo(25, 5)
    const t = tops(m)
    const nearRidge = t.filter((p) => Math.abs(p[0] - 48) < 0.01)
    expect(nearRidge.length).toBeGreaterThan(10)
    for (const p of nearRidge) expect(p[1]).toBeCloseTo(30.5, 5)            // constant along the ridge
    for (const p of t.filter((q) => q[0] < 0.01 || q[0] > 95.99)) expect(p[1]).toBeCloseTo(25, 5) // eaves
    for (const [x, , z] of t) { expect(x).toBeGreaterThanOrEqual(-1e-6); expect(x).toBeLessThanOrEqual(96 + 1e-6); expect(z).toBeLessThanOrEqual(1e-6); expect(z).toBeGreaterThanOrEqual(-128 - 1e-6) }
    expect(frontFacing(m)).toBe(true)
  })
  it('stepdome: a ledge at base, a stepped wall, then a dome to base + steps + domeRise', () => {
    const m = stepdome({ ring: rectR(0, 0, 164, -124), base: 30, steps: [{ inset: 7, rise: 2.5 }], domeRise: 6.5 })
    expect(Math.max(...ys(m))).toBeGreaterThan(30 + 2.5 + 6.5 * 0.95)
    expect(Math.max(...ys(m))).toBeLessThanOrEqual(39 + 1e-6)
    expect(tops(m).some((p) => Math.abs(p[1] - 30) < 1e-6 && p[0] < 5)).toBe(true)     // the ledge ring at the wall top
    expect(m.normals.some((n, i) => i % 3 === 1 && Math.abs(n) < 0.05)).toBe(true)       // vertical step walls
    const dome = tops(m).filter((p) => p[1] > 32.5 + 1e-6)
    for (const [x, , z] of dome) { expect(x).toBeGreaterThan(7 - 1e-6); expect(x).toBeLessThan(157 + 1e-6); expect(z).toBeLessThan(-7 + 1e-6); expect(z).toBeGreaterThan(-117 - 1e-6) }
    expect(frontFacing(m)).toBe(true)
  })
})

describe('arena roofs shade smoothly', () => {
  it('curved tops carry the surface normal of the height function, not faceted triangle normals', () => {
    const m = vault({ ring: rectR(0, 0, 96, -128), base: 25, rise: 5.5, axis: [0, -1] })
    for (let i = 0; i < m.positions.length; i += 3) {
      if (m.normals[i + 1] < 0.5) continue // gable walls
      const x = m.positions[i], expectNx = (2 * 5.5 * (x - 48)) / (48 * 48)       // −∂h/∂x for h = base + rise·(1 − (s/half)²)
      const l = Math.hypot(expectNx, 1)
      expect(m.normals[i]).toBeCloseTo(expectNx / l, 3)
      expect(m.normals[i + 2]).toBeCloseTo(0, 3)
    }
  })
})
describe('stepdome dome is smooth', () => {
  it('no creases: the dome height is an elliptic paraboloid over the inner ring (neighbouring normals agree)', () => {
    const m = stepdome({ ring: rectR(0, 0, 164, -124), base: 30, steps: [{ inset: 7, rise: 2.5 }], domeRise: 6.5 })
    const pts = []
    for (let i = 0; i < m.positions.length; i += 3) if (m.positions[i + 1] > 32.6) pts.push([m.positions[i], m.positions[i + 1], m.positions[i + 2]])
    const cx = 82, cz = -62, hx = 75, hz = 55
    for (const [x, y, z] of pts) expect(y).toBeCloseTo(32.5 + 6.5 * Math.max(0, 1 - ((x - cx) / hx) ** 2 - ((z - cz) / hz) ** 2), 3)
  })
})
describe('curved tops are gridded', () => {
  it('no sliver triangles: every curved-top triangle fits in one grid cell', () => {
    const ring = rectR(0, 0, 164, -124)
    for (const m of [vault({ ring, base: 25, rise: 5.5, axis: [0, -1], step: 4 }), stepdome({ ring, base: 30, steps: [{ inset: 7, rise: 2.5 }], domeRise: 6.5, step: 5 })]) {
      for (let i = 0; i < m.positions.length; i += 9) {
        if (m.normals[i + 1] < 0.5 || m.positions[i + 1] <= 32.5 + 1e-6 && m.positions[i + 1] >= 30 - 1e-6 && m.positions[i + 1] <= 30 + 1e-6) continue // flat ledge annulus
        const p = m.positions.slice(i, i + 9)
        const L = Math.max(Math.hypot(p[0] - p[3], p[2] - p[5]), Math.hypot(p[3] - p[6], p[5] - p[8]), Math.hypot(p[0] - p[6], p[2] - p[8]))
        expect(L).toBeLessThan(5 * Math.SQRT2 + 1e-6)
      }
    }
  })
})

describe('Phase 3 crowns', () => {
  it('pavilion: box body then pyramid cap, outward faces', () => {
    const m = pavilion({ at: [0, 0], base: 240, top: 252, w: 9, d: 9, roofH: 13 })
    expect(Math.min(...ys(m))).toBe(240); expect(Math.max(...ys(m))).toBeCloseTo(265)
    expect(frontFacing(m)).toBe(true)
  })
  it('gothicCrown: 8 buttress arcs from pier tops to the lantern wall', () => {
    const g = gothicCrown({ at: [0, 0], base: 118, top: 141, rLantern: 8, rPier: 14, piers: 8, pierH: 12, pinnacleH: 6 })
    expect(g.arcs).toHaveLength(8)
    for (const a of g.arcs) {
      expect(Math.hypot(a.from[0], a.from[2])).toBeCloseTo(14, 0)
      expect(Math.hypot(a.to[0], a.to[2])).toBeCloseTo(8, 0)
      expect(a.to[1]).toBeGreaterThan(a.from[1])
    }
    for (const part of ['lantern', 'piers', 'buttresses', 'pinnacles']) expect(frontFacing(g[part])).toBe(true)
    const all = ['lantern', 'piers', 'buttresses', 'pinnacles'].reduce((n, k) => n + g[k].positions.length / 9, 0)
    expect(all).toBeLessThanOrEqual(20000)
    expect(Math.max(...ys(g.lantern), ...ys(g.pinnacles))).toBeLessThanOrEqual(141 + 0.01)
  })
})
