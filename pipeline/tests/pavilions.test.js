// pipeline/tests/pavilions.test.js — 900 N Michigan's four corner pavilions stand on the tower's roof (user fix: one
// floated in the sky off an irregular footprint's bounding-box corner).
import { describe, it, expect } from 'vitest'
import { pavilions } from '../lib/heroes.js'
import { pointInRing } from '../lib/geom.js'

// an L-ish tower: the bounding box's north-west corner is empty air
const ring = [[0, 0], [60, 0], [60, 60], [20, 60], [20, 45], [0, 45]]
const centres = (m) => {
  const out = []
  for (let i = 0; i < m.positions.length; i += 3) out.push([m.positions[i], m.positions[i + 1], m.positions[i + 2]])
  const k = out.length / 4, groups = [0, 1, 2, 3].map((g) => out.slice(g * k, (g + 1) * k))
  return groups.map((g) => [g.reduce((a, p) => a + p[0], 0) / g.length, g.reduce((a, p) => a + p[2], 0) / g.length])
}
describe('corner pavilions', () => {
  it('every pavilion, with its whole footprint, stands on the roof', () => {
    const m = pavilions({ ring, base: 240, top: 252, w: 9, roofH: 13, inset: 1 })
    for (let i = 0; i < m.positions.length; i += 3) {
      if (m.positions[i + 1] > 252.01) continue // the lantern roofs rise to their apexes
      expect(pointInRing([m.positions[i], m.positions[i + 2]], ring), `vertex ${i / 3}`).toBe(true)
    }
    const c = centres(m)
    expect(c).toHaveLength(4)
  })
  it('on a plain rectangle they sit in its four corners', () => {
    const m = pavilions({ ring: [[0, 0], [50, 0], [50, 40], [0, 40]], base: 0, top: 10, w: 8, roofH: 5, inset: 1 })
    const c = centres(m).map(([x, z]) => [Math.round(x), Math.round(z)]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
    expect(c).toEqual([[5, 5], [5, 35], [45, 5], [45, 35]])
  })
})
