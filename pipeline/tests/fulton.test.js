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
