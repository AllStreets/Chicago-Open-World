import { describe, it, expect } from 'vitest'
import { extrudeBuilding } from '../lib/extrude.js'

const sq = [[0, 0], [10, 0], [10, -10], [0, -10]] // map-CCW

function faces(m) {
  const out = []
  for (let i = 0; i < m.positions.length; i += 9) {
    const p = m.positions.slice(i, i + 9)
    const n = m.normals.slice(i, i + 3)
    const ux = p[3] - p[0], uy = p[4] - p[1], uz = p[5] - p[2]
    const vx = p[6] - p[0], vy = p[7] - p[1], vz = p[8] - p[2]
    const c = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]
    out.push({ p, n, c })
  }
  return out
}

describe('extrudeBuilding', () => {
  it('makes 4 walls (8 tris) + roof (2 tris) for a square', () => {
    const m = extrudeBuilding({ outer: sq, top: 20 })
    expect(m.positions.length / 9).toBe(10)
    expect(m.uvs.length / 2).toBe(m.positions.length / 3)
  })
  it('every triangle winds front-facing along its normal', () => {
    for (const f of faces(extrudeBuilding({ outer: [...sq].reverse(), top: 20 }))) {
      const dot = f.c[0] * f.n[0] + f.c[1] * f.n[1] + f.c[2] * f.n[2]
      expect(dot).toBeGreaterThan(0)
    }
  })
  it('south wall faces +Z', () => {
    const f = faces(extrudeBuilding({ outer: sq, top: 20 }))
    const south = f.find((t) => t.p[2] === 0 && t.p[5] === 0 && t.p[8] === 0)
    expect(south.n).toEqual([0, 0, 1])
  })
  it('respects base height (building parts)', () => {
    const m = extrudeBuilding({ outer: sq, base: 100, top: 120 })
    const ys = m.positions.filter((_, i) => i % 3 === 1)
    expect(Math.min(...ys)).toBe(100)
    expect(Math.max(...ys)).toBe(120)
  })
  it('does not cap holes: roof area equals outer minus hole', () => {
    const hole = [[4, -4], [6, -4], [6, -6], [4, -6]]
    const m = extrudeBuilding({ outer: sq, holes: [hole], top: 10 })
    let roofArea = 0
    for (const f of faces(m)) if (f.n[1] === 1) roofArea += Math.abs(f.c[1]) / 2
    expect(roofArea).toBeCloseTo(96)
  })
  it('wall uv v equals height in metres', () => {
    const m = extrudeBuilding({ outer: sq, top: 20 })
    const vs = m.uvs.filter((_, i) => i % 2 === 1)
    expect(Math.max(...vs)).toBe(20)
  })
})

describe('extrudeBuilding taper', () => {
  const taper = { center: [5, -5], shaftTop: 100, topScale: 0.5 }
  it('scales the top ring about the center', () => {
    const m = extrudeBuilding({ outer: sq, top: 100, taper })
    const top = []
    for (let i = 0; i < m.positions.length; i += 3) if (m.positions[i + 1] === 100) top.push([m.positions[i], m.positions[i + 2]])
    const xs = top.map((p) => p[0])
    expect(Math.min(...xs)).toBeCloseTo(2.5); expect(Math.max(...xs)).toBeCloseTo(7.5)
  })
  it('tilted walls stay front-facing and lean inward (normal.y > 0)', () => {
    for (const f of faces(extrudeBuilding({ outer: sq, top: 100, taper }))) {
      expect(f.c[0] * f.n[0] + f.c[1] * f.n[1] + f.c[2] * f.n[2]).toBeGreaterThan(0)
      if (f.n[1] !== 1) expect(f.n[1]).toBeGreaterThan(0)
    }
  })
  it('a piece between base and top uses s(base) and s(top)', () => {
    const m = extrudeBuilding({ outer: sq, base: 50, top: 100, taper })
    const bottom = []
    for (let i = 0; i < m.positions.length; i += 3) if (m.positions[i + 1] === 50) bottom.push(m.positions[i])
    expect(Math.min(...bottom)).toBeCloseTo(5 - 5 * 0.75)
  })
})
