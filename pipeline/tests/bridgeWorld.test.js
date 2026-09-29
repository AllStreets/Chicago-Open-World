import { describe, it, expect } from 'vitest'
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
