import { describe, it, expect } from 'vitest'
import { loadCatalog } from '../lib/transit/lines.js'
import { buildRollingStock } from '../lib/rollingstock.js'
import { KIND, triCount } from '../lib/transit/meshkit.js'

const cat = loadCatalog(), S = cat.rollingStock
const models = buildRollingStock(cat)
const verts = (m) => Array.from({ length: m.positions.length / 3 }, (_, i) => ({ p: m.positions.slice(i * 3, i * 3 + 3), n: m.normals.slice(i * 3, i * 3 + 3), k: m.kind[i] }))
const range = (m, kind, axis, where = () => true) => { const v = verts(m).filter((x) => x.k === kind && where(x.p)).map((x) => x.p[axis]); return [Math.min(...v), Math.max(...v)] }

describe('CTA rolling stock (C6)', () => {
  it('reference dimensions are sourced', () => {
    for (const k of ['cta5000', 'cta7000']) {
      expect(S[k]).toMatchObject({ length: 14.63, width: 2.84, height: 3.66, truckCentres: 10.06 })
      expect(S[k].source).toMatch(/^https:\/\/en\.wikipedia\.org\//)
    }
  })
  for (const k of ['cta5000', 'cta7000']) {
    it(`${k}: 2–5k triangles, true length/width/height, wheels on the rail`, () => {
      const m = models[k]
      expect(triCount(m)).toBeGreaterThanOrEqual(2000); expect(triCount(m)).toBeLessThanOrEqual(5000)
      const [x0, x1] = range(m, KIND.stainless, 0), [z0, z1] = range(m, KIND.stainless, 2)
      expect(x0).toBeCloseTo(-S[k].length / 2, 2); expect(x1).toBeCloseTo(S[k].length / 2, 2)
      expect(z0).toBeCloseTo(-S[k].width / 2, 2); expect(z1).toBeCloseTo(S[k].width / 2, 2)
      expect(Math.max(...m.positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(S[k].height, 2)
      expect(Math.min(...m.positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(0, 6)
      for (const kind of [KIND.glass, KIND.sign, KIND.headlight, KIND.tail, KIND.door]) expect(m.kind).toContain(kind)
      expect(m.positions.every(Number.isFinite) && m.normals.every(Number.isFinite)).toBe(true)
    })
  }
  it('the 7000-series cab is raked; the 5000-series cab is flat', () => {
    const upper = (p) => p[1] > 3.0
    expect(range(models.cta5000, KIND.stainless, 0, upper)[1]).toBeCloseTo(7.315, 2)
    expect(range(models.cta7000, KIND.stainless, 0, upper)[1]).toBeLessThan(7.1)
  })
})

describe('Metra rolling stock (C7)', () => {
  it('four models, each 2–5k triangles and finite', () => {
    expect(Object.keys(models)).toEqual(['cta5000', 'cta7000', 'metraCoach', 'metraLoco'])
    for (const m of Object.values(models)) {
      expect(triCount(m)).toBeGreaterThanOrEqual(2000); expect(triCount(m)).toBeLessThanOrEqual(5000)
      expect(m.positions.every(Number.isFinite)).toBe(true)
    }
  })
  it('gallery coach: 25.91 m × 3.20 m × 4.83 m, two window rows, Metra livery', () => {
    const m = models.metraCoach, s = S.metraCoach
    const [x0, x1] = range(m, KIND.stainless, 0), [z0, z1] = range(m, KIND.stainless, 2)
    expect(x1 - x0).toBeCloseTo(s.length, 2); expect(z1 - z0).toBeCloseTo(s.width, 2)
    expect(Math.max(...m.positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(s.height, 2)
    const glassY = new Set(verts(m).filter((v) => v.k === KIND.glass && Math.abs(v.p[2]) > 1.5).map((v) => Math.round(v.p[1])))
    expect([...glassY].some((y) => y <= 2)).toBe(true); expect([...glassY].some((y) => y >= 3)).toBe(true) // lower level + gallery
    expect(m.kind).toContain(KIND.livery); expect(m.kind).toContain(KIND.headlight)
  })
  it('MP36: 20.98 m long, 4.70 m tall, cab + nose at +X, livery body', () => {
    const m = models.metraLoco, s = S.metraLoco
    const [, x1] = range(m, KIND.livery, 0)
    expect(x1).toBeLessThanOrEqual(s.length / 2 + 1e-6); expect(x1).toBeGreaterThan(s.length / 2 - 0.5)
    expect(Math.max(...m.positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(s.height, 2)
    expect(Math.min(...m.positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(0, 6)
    for (const kind of [KIND.glass, KIND.headlight, KIND.tail, KIND.sign]) expect(m.kind).toContain(kind)
  })
})
