import { describe, it, expect } from 'vitest'
import { mesh, slab, revolve, gridSurface, place, barrel, catmullRom, bearing } from '../lib/meshkit.js'
import { LANDMARK_FACADES as F } from '../lib/facadeIds.js'

const verts = (m) => { const o = []; for (let i = 0; i < m.positions.length; i += 3) o.push(m.positions.slice(i, i + 3)); return o }
const norms = (m) => { const o = []; for (let i = 0; i < m.normals.length; i += 3) o.push(m.normals.slice(i, i + 3)); return o }

describe('meshkit', () => {
  it('slab: 12 outward triangles spanning L × W × height', () => {
    const m = slab(mesh(), [10, 5], [1, 0], 8, 4, 2, 5)
    expect(m.positions.length / 9).toBe(12)
    const p = verts(m)
    expect(Math.min(...p.map((q) => q[0]))).toBeCloseTo(6); expect(Math.max(...p.map((q) => q[0]))).toBeCloseTo(14)
    expect(Math.min(...p.map((q) => q[2]))).toBeCloseTo(3); expect(Math.max(...p.map((q) => q[2]))).toBeCloseTo(7)
    const n = norms(m)
    for (let i = 0; i < p.length; i++) {   // every normal points away from the box centre
      const d = [p[i][0] - 10, p[i][1] - 3.5, p[i][2] - 5]
      expect(n[i][0] * d[0] + n[i][1] * d[1] + n[i][2] * d[2]).toBeGreaterThan(0)
    }
  })
  it('revolve: a scalloped basin wall faces outward and its lobes pull the rim in', () => {
    const plain = revolve([0, 0], [[10, 0], [10, 2]], { sides: 32 })
    const shell = revolve([0, 0], [[10, 0], [10, 2]], { sides: 32, lobes: 8, depth: 0.1 })
    const r = (m) => verts(m).map((q) => Math.hypot(q[0], q[2]))
    expect(Math.min(...r(plain))).toBeCloseTo(10, 5)
    expect(Math.min(...r(shell))).toBeLessThan(9.5)
    const p = verts(plain), n = norms(plain)
    expect(p.every((q, i) => n[i][0] * q[0] + n[i][2] * q[2] > 0)).toBe(true)
    const water = revolve([0, 0], [[5, 1], [0, 1]], { sides: 16 })
    expect(norms(water).every((q) => q[1] > 0.99)).toBe(true)
  })
  it('gridSurface: sign flips the normals', () => {
    const pt = (i, j) => [i, 0, j]
    const up = gridSurface(pt, 2, 2, 1, false), down = gridSurface(pt, 2, 2, -1, false)
    expect(Math.sign(norms(up)[0][1])).toBe(-Math.sign(norms(down)[0][1]))
  })
  it('place: local +x follows the bearing; a 90° yaw points east', () => {
    const m = { positions: [1, 0, 0], normals: [1, 0, 0], uvs: [0, 0] }
    const p = place(m, { at: [100, 50], y: 2, yawDeg: 90 })
    expect(p.positions[0]).toBeCloseTo(101); expect(p.positions[1]).toBeCloseTo(2); expect(p.positions[2]).toBeCloseTo(50)
    expect(bearing(0)[1]).toBeCloseTo(-1)       // bearing 0 is north (−z)
  })
  it('barrel: a vault rising `rise` over y0 along u', () => {
    const p = verts(barrel([0, 0], [1, 0], 20, 10, 4, 6))
    expect(Math.max(...p.map((q) => q[1]))).toBeCloseTo(10, 1)
    expect(Math.max(...p.map((q) => q[0]))).toBeCloseTo(10, 5)
  })
  it('catmullRom passes through every control point', () => {
    const c = [[0, 0], [10, 5], [20, 0]], s = catmullRom(c, 1)
    for (const q of c) expect(s.some((p) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-9)).toBe(true)
  })
  it('façade ids match the shader', () => {
    expect(F).toMatchObject({ stone: 25, grid: 26, signal: 27, face: 28, bronze: 29, chrome: 21, water: 22, led: 23 })
  })
})
