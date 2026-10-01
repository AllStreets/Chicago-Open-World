import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { leafGeometry, buildLeaves, buildPits, DECK, L_DECK_Y, buildBridge, pierBoxes, tailSweep, rotateLeafPoint, leafFramePoints, LIFT_MAX_DEG, WATER_CLEAR_M, PIT } from '../lib/bridges.js'
import { MAX_LIFT_DEG } from '../../app/src/bridges/lift.js'
import { LANDMARK_FACADES as F } from '../lib/facadeIds.js'
import { dressBridgehouses } from '../lib/bridgehouses.js'
import { polyIndex } from '../lib/riverLevel.js'

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
  it('double decks: DuSable carries a lower deck; Wells/Lake carry the L on its own transit structure (V6 review #4)', () => {
    expect(buildLeaves(B({ decks: 2 }), deckY)[0].meshes.some((p) => p.part === 'lower-deck')).toBe(true)
    const through = buildLeaves(B({ decks: 2, leaf: 'through-truss' }), deckY)[0].meshes
    expect(through.some((p) => p.part === 'upper-deck')).toBe(false)
    expect(Math.max(...pts(through.filter((p) => p.part === 'truss')).map((q) => q[1]))).toBeGreaterThan(L_DECK_Y + 3.66)
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

describe('V6 review: the L crosses Wells and Lake on its own track', () => {
  it('a double-deck through-truss has no upper slab at rail height; its top chord clears the train', async () => {
    const { buildBridge } = await import('../lib/bridges.js')
    const { RAIL_TOP_Y } = await import('../lib/transit/grade.js')
    const b = { key: 'wells', leaf: 'through-truss', decks: 2, span: 80, width: 21, centre: [0, 0], axis: [0, -1], houses: { count: 0, style: 'modern' }, liftable: false }
    const built = buildBridge(b, { deckY: 0.14 })
    const ys = built.leaves.flatMap((lf) => lf.meshes.filter((m) => m.part === 'upper-deck').flatMap((m) => m.mesh.positions.filter((_, i) => i % 3 === 1)))
    expect(ys).toHaveLength(0)
    const chord = built.leaves.flatMap((lf) => lf.meshes.filter((m) => m.part === 'truss').flatMap((m) => m.mesh.positions.filter((_, i) => i % 3 === 1)))
    expect(Math.max(...chord)).toBeGreaterThan(RAIL_TOP_Y.cta + 3.66) // above a 3.66 m CTA car
  })
})

describe('D1-4: the river at RIVER_Y — piers, pits sized from the tail sweep, steel clear of the water', () => {
  const L = JSON.parse(readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8')).levels
  const levels = { river: L.RIVER_Y, lower: L.LOWER_Y }
  const kinds = [B(), B({ leaf: 'girder', span: 60, width: 20 }), B({ decks: 2, span: 78, width: 28 }), B({ leaf: 'through-truss', decks: 2, span: 82, width: 21 }), B({ decks: 2, span: 108, width: 32 })]
  it('the app lifts to the angle the pits are sized for', () => {
    expect(LIFT_MAX_DEG).toBe(MAX_LIFT_DEG)
  })
  it('every tail-side vertex, at every angle of the lift, stays inside its pit or above the street', () => {
    for (const b of kinds) {
      const leaves = buildBridge(b, { deckY, levels }).leaves, boxes = pierBoxes(b, deckY, levels)
      boxes.forEach((p, i) => {
        const tail = leafFramePoints(p.g, leaves[i].meshes).filter(([a]) => a < 0.4)
        expect(tail.length).toBeGreaterThan(50)
        let a0 = Infinity, a1 = -Infinity, y0 = Infinity, w = 0
        for (let deg = 0; deg <= LIFT_MAX_DEG; deg += 1) for (const [a, y, o] of tail) {
          const [ra, ry] = rotateLeafPoint([a, y], p.g.pivot[1], deg)
          if (ry > deckY - 0.4) continue
          a0 = Math.min(a0, ra); a1 = Math.max(a1, ra); y0 = Math.min(y0, ry); w = Math.max(w, Math.abs(o))
        }
        expect(a0).toBeGreaterThan(p.a0); expect(a1).toBeLessThan(p.a1)
        expect(w).toBeLessThan(p.inner); expect(y0).toBeGreaterThan(p.floor)
      })
    }
  })
  it('the pit is as deep as the tail really drops (≈ Lt·sin 75° under the trunnion), deeper than the old 9 m box', () => {
    const [s] = tailSweep(B(), deckY, levels)
    expect(s.y0).toBeLessThan(deckY - DECK.trunnionDrop - 0.16 * 70 * Math.sin((75 * Math.PI) / 180) + 0.5)
    expect(s.y0).toBeLessThan(deckY - 9.4)
  })
  it('the pier walls stand in the water: down past RIVER_Y, up to just under the deck', () => {
    for (const b of kinds) {
      const built = buildBridge(b, { deckY, levels }), pit = built.fixed.filter((m) => m.part === 'pit')
      expect(pit).toHaveLength(2)
      expect(Math.min(...pts(pit).map((q) => q[1]))).toBeLessThanOrEqual(L.RIVER_Y - 0.5 + 1e-6)
      for (const p of built.piers) {
        expect(p.bottom).toBeLessThanOrEqual(L.RIVER_Y - 0.5)
        expect(p.top).toBeLessThan(deckY - DECK.slabT)
        expect(p.outer - p.inner).toBeCloseTo(PIT.wall)
      }
    }
  })
  it('no leaf steel hangs into the river: ahead of the pier it stays WATER_CLEAR_M over RIVER_Y at rest (the lower roadway is checked below)', () => {
    for (const b of kinds) {
      const built = buildBridge(b, { deckY, levels })
      built.leaves.forEach((lf, i) => {
        const ahead = leafFramePoints(built.piers[i].g, lf.meshes.filter((m) => m.part !== "lower-deck")).filter(([a]) => a > built.piers[i].a1)
        expect(Math.min(...ahead.map((q) => q[1]))).toBeGreaterThanOrEqual(L.RIVER_Y + WATER_CLEAR_M - 1e-6)
      })
    }
  })
  it('a double deck (DuSable, the Outer Drive) hangs its lower roadway at LOWER_Y, above the water', () => {
    for (const lf of buildBridge(B({ decks: 2, span: 78, width: 28 }), { deckY, levels }).leaves) {
      const ys = pts(lf.meshes.filter((m) => m.part === 'lower-deck')).map((q) => q[1])
      expect(Math.max(...ys)).toBeCloseTo(L.LOWER_Y)
      expect(Math.min(...ys)).toBeGreaterThan(L.RIVER_Y)
    }
  })
  it('without levels (the flat world) the pits are the old 9 m boxes and there are no piers', () => {
    const a = buildBridge(B(), { deckY })
    expect(a.piers).toEqual([])
    expect(Math.min(...pts(a.fixed.filter((m) => m.part === 'pit')).map((q) => q[1]))).toBeCloseTo(deckY - 9.4)
  })
})

// A-9: the tender houses are dressed on their OSM footprints (lib/bridgehouses.js); the piers reach the riverbed (D1-4)
describe('A-9: the four house styles and the pier depth', () => {
  const houseData = JSON.parse(readFileSync(new URL('../data/bridgehouses.json', import.meta.url), 'utf8'))
  const lv = { river: -6.3, riverwalk: -5.3, lower: -5.1 }
  const waterIdx = polyIndex([{ outer: [[-300, -35], [300, -35], [300, 35], [-300, 35]], holes: [] }])
  it('covers the four house styles, each down to the water at the pier', () => {
    for (const style of ['beaux-arts', 'deco', 'moderne', 'modern']) {
      const outer = [[13, -41], [19, -41], [19, -35.5], [13, -35.5]]
      const h = { id: 'w1', name: 'Test Bridgehouse', polygons: [{ outer, holes: [] }], pieces: [{ outer, base: 0, top: 5 }] }
      dressBridgehouses({ buildings: [h], bridges: [B({ houses: { count: 2, style } })], waterIdx, levels: lv, data: houseData })
      expect(h.bridgehouse.style).toBe(style)
      expect(Math.min(...h.extraMeshes.flatMap((m) => m.positions.filter((_, i) => i % 3 === 1)))).toBeCloseTo(lv.river - 0.5, 1)
    }
  })
  it('every pier box reaches below the river', () => {
    for (const p of pierBoxes(B(), deckY, lv)) expect(p.bottom).toBeLessThanOrEqual(lv.river - 0.5)
  })
})
