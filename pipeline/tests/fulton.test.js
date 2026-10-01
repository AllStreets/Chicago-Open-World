// pipeline/tests/fulton.test.js — Fulton Market's Gensler pair on North Green Street (Flexport, BCG).
import { describe, it, expect } from 'vitest'
import { gr333n, greenTower360 } from '../lib/fulton.js'

const rect = (w, d) => ({ polygons: [{ outer: [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]], holes: [] }], centroid: [0, 0], area: w * d })
const ys = (r, part) => r.meshes.filter((m) => !part || m.part === part).flatMap(({ mesh }) => mesh.positions.filter((_, i) => i % 3 === 1))
const hi = (a) => a.reduce((m, v) => Math.max(m, v), -Infinity)
const tris = (r) => r.meshes.reduce((n, { mesh }) => n + mesh.positions.length / 9, 0)

describe('333 North Green (Flexport Chicago)', () => {
  const r = gr333n(rect(75, 58), { heightM: 87.8, lowerM: 80.6 })
  it('a podium, two glass masses in a black grid up to 87.8 m, and Flexport\'s lit floor', () => {
    for (const part of ['storefront', 'kinetic-wall', 'amenity', 'tower', 'frame', 'flexport']) expect(r.meshes.some((m) => m.part === part), part).toBe(true)
    expect(hi(ys(r, 'tower'))).toBeCloseTo(87.8, 1)
    const fy = ys(r, 'flexport'); expect(Math.min(...fy)).toBeGreaterThan(40); expect(hi(fy)).toBeLessThan(60)
    expect(r.replace).toBe(true)
  })
  it('stays light: under 20 k triangles', () => { expect(tris(r)).toBeLessThan(20000) })
})

describe('360 North Green (BCG Chicago)', () => {
  const r = greenTower360(rect(76, 41), { heightM: 122, lowerM: 110 })
  it('a podium, a V-truss level, two offset bars and a crown reaching 122 m', () => {
    for (const part of ['podium', 'truss-recess', 'v-truss', 'tower', 'core', 'crown', 'balconies']) expect(r.meshes.some((m) => m.part === part), part).toBe(true)
    expect(hi(ys(r))).toBeCloseTo(122, 1)
    expect(hi(ys(r, 'tower'))).toBeLessThan(122)
  })
  it('stays light: under 20 k triangles', () => { expect(tris(r)).toBeLessThan(20000) })
})

describe('360 North Green: the V-truss transfer level (user fix — members poked out past the podium and tower)', () => {
  const r = greenTower360(rect(76, 41), { heightM: 122, lowerM: 110 })
  const P = (part) => r.meshes.filter((m) => m.part === part).flatMap(({ mesh }) => { const o = []; for (let i = 0; i < mesh.positions.length; i += 3) o.push(mesh.positions.slice(i, i + 3)); return o })
  const tower = P('tower'), truss = P('v-truss')
  const span = (pts, k) => [Math.min(...pts.map((p) => p[k])), Math.max(...pts.map((p) => p[k]))]
  it('every member sits inside the transfer level: between the podium roof and the tower underside', () => {
    const [y0, y1] = span(truss, 1)
    expect(y0).toBeGreaterThanOrEqual(22 - 1e-6); expect(y1).toBeLessThanOrEqual(30 + 1e-6)
  })
  it('no member reaches past the podium or the tower bars above it', () => {
    const [x0, x1] = span(truss, 0), [z0, z1] = span(truss, 2), [tx0, tx1] = span(tower, 0), [tz0, tz1] = span(tower, 2)
    expect(x0).toBeGreaterThanOrEqual(Math.max(-38, tx0) - 1e-6); expect(x1).toBeLessThanOrEqual(Math.min(38, tx1) + 1e-6)
    expect(z0).toBeGreaterThanOrEqual(Math.max(-20.5, tz0) - 1e-6); expect(z1).toBeLessThanOrEqual(Math.min(20.5, tz1) + 1e-6)
    // and under a bar, not out where neither bar overhangs: every truss point lies under one of the two bars
    const bars = [tower.filter((p) => p[2] < 0), tower.filter((p) => p[2] > 0)].map((b) => [...span(b, 0), ...span(b, 2)])
    for (const [x, , z] of truss) expect(bars.some(([a0, a1, c0, c1]) => x >= a0 - 1e-6 && x <= a1 + 1e-6 && z >= c0 - 1e-6 && z <= c1 + 1e-6), `${x.toFixed(1)},${z.toFixed(1)}`).toBe(true)
  })
  it('two rows of V-trusses with closed corners: a top chord flush with each bar\'s underside, posts at its four corners', () => {
    expect(truss.some((p) => p[1] > 29)).toBe(true)
    expect(r.meshes.find((m) => m.part === 'v-truss').posts).toBe(8)
  })
})
