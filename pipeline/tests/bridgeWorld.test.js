import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { makeRibbonCutter, spanRect, bridgeSidecar, buildBridge } from '../lib/bridges.js'

const B = (o = {}) => ({ key: 'b', name: 'B', leaf: 'deck-truss', decks: 1, span: 70, width: 22, centre: [0, 0], axis: [0, -1], houses: { count: 2, style: 'beaux-arts' }, liftable: true, wayIds: [1], railWayIds: [], ...o })

describe('ribbon cutting — one deck per crossing', () => {
  const cut = makeRibbonCutter([B()])
  it('a claimed way loses everything over the span and tails', () => {
    const pieces = cut({ id: 1, points: [[0, 60], [0, -60]] })
    const r = spanRect(B())
    for (const p of pieces) for (const q of p) expect(Math.abs(q[1])).toBeGreaterThanOrEqual(r.hl - 1e-6)
  })
  it('an unclaimed approach running along the bridge is cut too (no ribbon over the tail pit)', () => {
    const pieces = cut({ id: 2, points: [[1, 80], [1, 30]] })
    expect(Math.min(...pieces.flat().map((q) => q[1]))).toBeGreaterThanOrEqual(spanRect(B()).hl - 1e-6)
  })
  it('a perpendicular street along the bank (Wacker) is never cut', () => {
    const w = [[-100, 40], [100, 40]]
    expect(cut({ id: 3, points: w })).toEqual([w])
  })
  it('ways far away are untouched', () => {
    expect(cut({ id: 4, points: [[500, 0], [500, 50]] })).toEqual([[[500, 0], [500, 50]]])
  })
})

describe('bridges sidecar', () => {
  it('numbers leaves globally, maps nav lights to them, and keeps only liftable bridges in the lift order', () => {
    const bs = [B({ key: 'a' }), B({ key: 'b', centre: [300, 0], liftable: false })]
    const s = bridgeSidecar(bs, bs.map((b) => buildBridge(b, { deckY: 0.14 })), ['b', 'a'])
    expect(s.leaves).toHaveLength(4)
    expect(s.bridges[1].leaves).toEqual([2, 3])
    expect(s.lights.filter((l) => l.kind === 'nav').map((l) => l.leaf).sort()).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
    expect(s.liftOrder).toEqual(['a'])
    expect(s.leaves[0].k[1]).toBe(0)
  })
})

// D2-4: the double decks carry two roadways — the street on top, the lower street (DuSable's is Lower Michigan, the Outer
// Drive's is its lower level) at LOWER_Y, the height lower-levels.json brings those streets to the bridge at
describe('D2-4: double-deck bascules — both deck heights', () => {
  const data = JSON.parse(readFileSync(new URL('../data/bridges.json', import.meta.url), 'utf8'))
  const L = JSON.parse(readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8')).levels
  const deckY = 0.14, levels = { river: L.RIVER_Y, lower: L.LOWER_Y }
  const ys = (parts) => parts.flatMap((p) => { const o = []; for (let i = 1; i < p.mesh.positions.length; i += 3) o.push(p.mesh.positions[i]); return o })
  for (const key of ['dusable', 'lakeshore']) {
    it(`${key}: the upper roadway at the street (deckY), the lower one at LOWER_Y`, () => {
      const spec = data.bridges.find((b) => b.key === key)
      expect(spec.decks).toBe(2)
      const leaves = buildBridge(B({ key, leaf: spec.leaf, decks: 2, span: spec.clearSpan, width: spec.width }), { deckY, levels }).leaves
      for (const lf of leaves) {
        expect(Math.max(...ys(lf.meshes.filter((m) => m.part === 'deck')))).toBeCloseTo(deckY)
        expect(Math.max(...ys(lf.meshes.filter((m) => m.part === 'lower-deck')))).toBeCloseTo(L.LOWER_Y)
      }
    })
  }
  const lowerFile = new URL('../../app/public/world/lower-levels.json', import.meta.url)
  it.skipIf(!existsSync(lowerFile))('Lower Michigan reaches the DuSable Bridge at the lower deck’s height', () => {
    const j = JSON.parse(readFileSync(lowerFile, 'utf8'))
    const ends = j.ways.filter((w) => /Lower Michigan/.test(w.n ?? '')).flatMap((w) => [w.p[0], w.p.at(-1)])
    const nearest = ends.reduce((a, q) => (Math.hypot(q[0] - 287, q[1] + 757) < Math.hypot(a[0] - 287, a[1] + 757) ? q : a)) // DuSable's centre (287, −757)
    expect(nearest[2]).toBeCloseTo(L.LOWER_Y, 1)
  })
})
