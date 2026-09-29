import { describe, it, expect } from 'vitest'
import { KIND, hexToLinear, createMesh, quad, box, sweep, chunksOf, cumulative3, toLayer, triCount } from '../lib/transit/meshkit.js'

const tris = (m) => Array.from({ length: m.positions.length / 9 }, (_, t) => [0, 1, 2].map((k) => m.positions.slice(t * 9 + k * 3, t * 9 + k * 3 + 3)))
const faceNormal = ([a, b, c]) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]] }

describe('meshkit', () => {
  it('sRGB hex → linear colour', () => {
    expect(hexToLinear('#ffffff')).toEqual([1, 1, 1]); expect(hexToLinear('#000000')).toEqual([0, 0, 0])
    expect(hexToLinear('#c60c30')[0]).toBeCloseTo(0.565, 2)
    expect(KIND.accent).toBe(4); expect(KIND.livery).toBe(13)
  })
  it('quads wind counter-clockwise as seen from their normal', () => {
    const m = createMesh()
    quad(m, [0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 1, 0], [1, 1, 1], KIND.steel)
    for (const t of tris(m)) expect(faceNormal(t)[1]).toBeGreaterThan(0)
  })
  it('a box has 6 outward faces', () => {
    const m = createMesh()
    box(m, [5, 5, 5], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 2, 3], [1, 1, 1], KIND.steel)
    expect(m.positions.length / 3).toBe(36)
    for (let i = 0; i < 36; i++) {
      const p = m.positions.slice(i * 3, i * 3 + 3), n = m.normals.slice(i * 3, i * 3 + 3)
      expect((p[0] - 5) * n[0] + (p[1] - 5) * n[1] + (p[2] - 5) * n[2]).toBeGreaterThan(0)
    }
  })
  it('sweep extrudes a profile along the track with outward normals and arc length', () => {
    const m = createMesh(), pts = [[0, 5, 0], [10, 5, 0], [20, 5, 0]] // eastbound: right-hand side is +z (south)
    sweep(m, pts, [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]], [1, 1, 1], KIND.steel)
    expect(m.positions.length / 3).toBe(4 * 2 * 6)
    const normals = new Set(Array.from({ length: m.normals.length / 3 }, (_, i) => m.normals.slice(i * 3, i * 3 + 3).map((v) => Math.round(v)).join(',')))
    expect(normals).toEqual(new Set(['0,-1,0', '0,0,1', '0,1,0', '0,0,-1']))
    expect(Math.max(...m.along)).toBe(20); expect(Math.min(...m.along)).toBe(0)
    expect(Math.max(...m.positions.filter((_, i) => i % 3 === 1))).toBe(6)
  })
  it('chunksOf cuts a polyline into equal pieces; cumulative3 measures in plan', () => {
    const c = chunksOf([[0, 0, 0], [50, 0, 0]], 20)
    expect(c.map((p) => cumulative3(p).at(-1))).toEqual([20, 20, 10])
    expect(cumulative3([[0, 0, 0], [3, 9, 4]])).toEqual([0, 5])
  })
  it('toLayer exposes KIND and ALONG per vertex; triCount counts triangles', () => {
    const m = createMesh()
    box(m, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1], [1, 1, 1], KIND.rail, ['top'])
    const l = toLayer(m)
    expect(l.extra.KIND).toEqual(new Float32Array(6).fill(3)); expect(l.extra.ALONG).toHaveLength(6)
    expect(l.colors).toHaveLength(18); expect(triCount(m)).toBe(2)
  })
})
