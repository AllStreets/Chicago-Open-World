import { describe, it, expect } from 'vitest'
import { buildBridge, houseSpots, bridgeLights } from '../lib/bridges.js'
import { LANDMARK_FACADES as F } from '../lib/facadeIds.js'

const pts = (parts) => parts.flatMap((p) => { const o = []; for (let i = 0; i < p.mesh.positions.length; i += 3) o.push(p.mesh.positions.slice(i, i + 3)); return o })
const B = (o = {}) => ({ key: 'b', name: 'B', leaf: 'deck-truss', decks: 1, span: 70, width: 22, centre: [0, 0], axis: [0, -1], houses: { count: 2, style: 'beaux-arts' }, generic: false, ...o })
const DUSABLE = B({ key: 'dusable', decks: 2, span: 78, width: 28, houses: { count: 4, style: 'dusable' }, reliefs: { ne: 'The Discoverers', nw: 'The Pioneers', sw: 'Defense', se: 'Regeneration' } })

describe('bridge houses', () => {
  it('two tender houses stand on opposite corners, on land, beside the roadway', () => {
    const s = houseSpots(B())
    expect(s).toHaveLength(2)
    expect(Math.sign(s[0].at[0])).toBe(-Math.sign(s[1].at[0]))
    expect(Math.sign(s[0].at[1])).toBe(-Math.sign(s[1].at[1]))
    for (const h of s) { expect(Math.abs(h.at[1])).toBeGreaterThan(35); expect(Math.abs(h.at[0])).toBeGreaterThan(11) }
  })
  it('DuSable: four limestone bridge houses, each with its named relief on the right corner', () => {
    const { fixed } = buildBridge(DUSABLE, { deckY: 0.14 })
    const reliefs = fixed.filter((p) => p.part.startsWith('relief:'))
    expect(reliefs.map((p) => p.part).sort()).toEqual(['relief:defense', 'relief:regeneration', 'relief:the-discoverers', 'relief:the-pioneers'])
    const ne = pts(reliefs.filter((p) => p.part === 'relief:the-discoverers'))
    expect(ne.every((q) => q[0] > 0 && q[2] < 0)).toBe(true)      // north-east: +x, −z
    expect(fixed.filter((p) => p.part === 'house' && p.style === 'bedford-limestone')).toHaveLength(4)
    expect(Math.max(...pts(fixed.filter((p) => p.part === 'house')).map((q) => q[1]))).toBeGreaterThan(12)
  })
  it('DuSable: stone balustrades and a double deck', () => {
    const r = buildBridge(DUSABLE, { deckY: 0.14 })
    expect(r.fixed.some((p) => p.part === 'balustrade')).toBe(true)
    expect(r.leaves[0].meshes.some((p) => p.part === 'lower-deck')).toBe(true)
  })
  it('generic OSM bascules get leaves and lights but no houses', () => {
    const r = buildBridge(B({ generic: true, houses: { count: 0, style: 'modern' } }), { deckY: 0.14 })
    expect(r.fixed.some((p) => p.part === 'house')).toBe(false)
    expect(r.leaves).toHaveLength(2)
  })
})

describe('bridge lights', () => {
  it('lanterns, a red nav light on each leaf tip edge, and pier lights', () => {
    const L = bridgeLights(B(), 0.14)
    expect(L.filter((l) => l.kind === 'lantern')).toHaveLength(4)
    expect(L.filter((l) => l.kind === 'nav' && l.leaf === 0)).toHaveLength(2)
    expect(L.filter((l) => l.kind === 'nav' && l.leaf === 1)).toHaveLength(2)
    expect(L.filter((l) => l.kind === 'pier')).toHaveLength(4)
  })
  it('DuSable has lamp standards along every balustrade', () => {
    expect(bridgeLights(DUSABLE, 0.14).filter((l) => l.kind === 'lantern').length).toBeGreaterThanOrEqual(12)
  })
  it('lantern glass is a signal surface', () => {
    const { fixed } = buildBridge(B(), { deckY: 0.14 })
    expect(fixed.filter((p) => p.part === 'lantern').every((p) => p.facade === F.signal && p.style === 'lantern-warm')).toBe(true)
  })
})
