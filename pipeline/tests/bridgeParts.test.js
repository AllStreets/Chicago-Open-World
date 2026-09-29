import { describe, it, expect } from 'vitest'
import { leafGeometry, buildLeaves, buildPits, DECK, L_DECK_Y } from '../lib/bridges.js'
import { LANDMARK_FACADES as F } from '../lib/facadeIds.js'

const pts = (parts) => parts.flatMap((p) => { const o = []; for (let i = 0; i < p.mesh.positions.length; i += 3) o.push(p.mesh.positions.slice(i, i + 3)); return o })
const B = (o = {}) => ({ key: 'b', leaf: 'deck-truss', decks: 1, span: 70, width: 22, centre: [0, 0], axis: [0, -1], houses: { count: 2, style: 'beaux-arts' }, ...o })
const deckY = 0.14

describe('bascule leaves', () => {
  it('two split leaves pivot on trunnions at the river banks and meet mid-span', () => {
    const g = leafGeometry(B(), deckY)
    expect(g).toHaveLength(2)
    expect(g[0].p2[1]).toBeCloseTo(-35); expect(g[1].p2[1]).toBeCloseTo(35)
    for (const l of g) {
      expect(l.pivot[1]).toBeCloseTo(deckY - DECK.trunnionDrop)
      expect(l.k[1]).toBe(0)
      expect(l.k[0] * l.d[0] + l.k[2] * l.d[1]).toBeCloseTo(0)                // horizontal axis across the deck
      expect(l.k[0] * -l.d[1] + l.k[2] * l.d[0]).toBeGreaterThan(0)          // k = d × up (tip lifts for +angle)
    }
    const leaves = buildLeaves(B(), deckY)
    for (const lf of leaves) {
      const z = pts(lf.meshes.filter((p) => p.part === 'deck')).map((q) => q[2])
      expect(Math.min(...z.map(Math.abs))).toBeLessThan(0.1)                  // reaches the middle
    }
  })
  it('the deck is at street level, drawn once, as open grid steel', () => {
    for (const lf of buildLeaves(B(), deckY)) {
      const deck = lf.meshes.filter((p) => p.part === 'deck')
      expect(deck).toHaveLength(1)
      expect(deck[0].facade).toBe(F.grid)
      expect(Math.max(...pts(deck).map((q) => q[1]))).toBeCloseTo(deckY)
      expect(lf.meshes.every((p) => p.style === null || typeof p.style === 'string')).toBe(true)
    }
  })
  it('deck trusses hang below the deck; through trusses rise above it; girders are plate girders', () => {
    const below = pts(buildLeaves(B(), deckY)[0].meshes.filter((p) => p.part === 'truss'))
    expect(Math.min(...below.map((q) => q[1]))).toBeLessThan(deckY - 4)
    const above = pts(buildLeaves(B({ leaf: 'through-truss' }), deckY)[0].meshes.filter((p) => p.part === 'truss'))
    expect(Math.max(...above.map((q) => q[1]))).toBeGreaterThan(deckY + 5.5)
    expect(buildLeaves(B({ leaf: 'girder' }), deckY)[0].meshes.some((p) => p.part === 'girder')).toBe(true)
  })
  it('double decks: DuSable carries a lower deck; Wells/Lake carry the L on top at the elevated height', () => {
    expect(buildLeaves(B({ decks: 2 }), deckY)[0].meshes.some((p) => p.part === 'lower-deck')).toBe(true)
    const up = buildLeaves(B({ decks: 2, leaf: 'through-truss' }), deckY)[0].meshes.filter((p) => p.part === 'upper-deck')
    expect(Math.max(...pts(up).map((q) => q[1]))).toBeCloseTo(L_DECK_Y)
  })
  it('each leaf carries red navigation lenses at its tip and a counterweight behind the trunnion', () => {
    for (const lf of buildLeaves(B(), deckY)) {
      const nav = lf.meshes.filter((p) => p.part === 'nav')
      expect(nav[0].facade).toBe(F.signal); expect(nav[0].style).toBe('nav-red')
      expect(lf.meshes.some((p) => p.part === 'counterweight')).toBe(true)
    }
  })
  it('counterweight pits: one per bank, open, below street level', () => {
    const pits = buildPits(B(), deckY)
    expect(pits).toHaveLength(2)
    expect(Math.max(...pts(pits).map((q) => q[1]))).toBeLessThan(deckY)
    expect(Math.min(...pts(pits).map((q) => q[1]))).toBeLessThan(deckY - 8)
  })
})
