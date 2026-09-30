// pipeline/tests/aqua.test.js
import { describe, it, expect } from 'vitest'
import { AQUA, aquaOffset, aquaSlabs } from '../lib/aqua.js'

const rect = [[-30, -20], [30, -20], [30, 20], [-30, 20]]
const ys = (m) => m.positions.filter((_, i) => i % 3 === 1)
const lo = (a) => a.reduce((x, y) => Math.min(x, y), Infinity), hi = (a) => a.reduce((x, y) => Math.max(x, y), -Infinity)
const tris = (m) => m.positions.length / 9
function frontFacing(m, center) {
  for (let i = 0; i < m.positions.length; i += 9) {
    const p = m.positions.slice(i, i + 9), n = m.normals.slice(i, i + 3)
    const u = [p[3] - p[0], p[4] - p[1], p[5] - p[2]], v = [p[6] - p[0], p[7] - p[1], p[8] - p[2]]
    const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    if (c[0] * n[0] + c[1] * n[1] + c[2] * n[2] <= 0) return false
  }
  return true
}

describe('Aqua waves', () => {
  it('balcony depth stays within the sourced range', () => {
    const d = []
    for (let f = 0; f < AQUA.floors; f++) for (let t = 0; t < 1; t += 0.01) d.push(aquaOffset(f, t))
    expect(lo(d)).toBeGreaterThanOrEqual(AQUA.minDepth - 1e-9)
    expect(hi(d)).toBeLessThanOrEqual(AQUA.maxDepth + 1e-9)
  })
  it('neighbouring floors differ by at most 0.6 m, so the waves read as smooth', () => {
    let worst = 0
    for (let f = 1; f < AQUA.floors; f++) for (let t = 0; t < 1; t += 0.02) worst = Math.max(worst, Math.abs(aquaOffset(f, t) - aquaOffset(f - 1, t)))
    expect(worst).toBeLessThanOrEqual(0.6)
  })
  it('has flush "pools" covering 8–35 % of the façade', () => {
    let flush = 0, n = 0
    for (let f = 0; f < AQUA.floors; f++) for (let t = 0; t < 1; t += 0.01, n++) if (aquaOffset(f, t) <= AQUA.minDepth + 0.05) flush++
    expect(flush / n).toBeGreaterThan(0.08); expect(flush / n).toBeLessThan(0.35)
  })
  it('is deterministic', () => {
    expect(aquaOffset(40, 0.37)).toBe(aquaOffset(40, 0.37))
  })
  it('one slab per floor, between the podium and the roof, within budget, facing out', () => {
    const floorH = (AQUA.heightM - AQUA.podiumM) / AQUA.floors
    const m = aquaSlabs(rect, { floors: AQUA.floors, floorH, baseY: AQUA.podiumM, thickness: AQUA.thickness })
    expect(lo(ys(m))).toBeGreaterThanOrEqual(AQUA.podiumM - 0.01)
    expect(hi(ys(m))).toBeLessThanOrEqual(AQUA.heightM + 0.01)
    const levels = new Set(ys(m).map((y) => Math.round((y - AQUA.podiumM) / floorH)))
    expect(levels.size).toBeGreaterThanOrEqual(AQUA.floors)
    expect(tris(m)).toBeLessThanOrEqual(60000)
    expect(frontFacing(m)).toBe(true)
  }, 60000)
})
