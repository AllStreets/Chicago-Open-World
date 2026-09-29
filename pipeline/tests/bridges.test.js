import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isMovableBridge, detectBridges, cutPolyline, clipSegment } from '../lib/bridges.js'
import { project, unproject } from '../../shared/project.js'

const data = JSON.parse(readFileSync(new URL('../data/bridges.json', import.meta.url), 'utf8'))
const ll = ([x, z]) => { const [lon, lat] = unproject(x, z); return { lat, lon } }
const entry = (o) => ({ key: 'e', name: 'E', leaf: 'deck-truss', decks: 1, houses: { count: 2, style: 'beaux-arts' }, liftable: true, aliases: [], source: 'x', ...o })
const way = (id, pts, tags = { highway: 'secondary', bridge: 'movable', 'bridge:movable': 'bascule' }) => ({ id, tags, points: pts })

describe('bridges.json', () => {
  const keys = data.bridges.map((b) => b.key)
  it('lists the named main-stem and south-branch bascules with sources', () => {
    expect(new Set(keys).size).toBe(keys.length)
    for (const k of ['franklin-orleans', 'wells', 'lasalle', 'clark', 'dearborn', 'state', 'wabash', 'dusable', 'columbus', 'lakeshore']) expect(keys).toContain(k)
    for (const k of ['lake', 'randolph', 'washington', 'madison', 'monroe', 'adams', 'jackson', 'vanburen']) expect(keys).toContain(k)
    expect(data.bridges.filter((b) => b.name).length).toBeGreaterThanOrEqual(10)
    for (const b of data.bridges) { expect(b.source, b.key).toMatch(/\S{8,}/); expect(typeof b.bearing, b.key).toBe('number') }
  })
  it('every tender-house bridge the backlog lists (E6) has a house', () => {
    for (const k of ['wabash', 'state', 'dearborn', 'clark', 'lasalle', 'wells', 'franklin-orleans', 'lake', 'randolph', 'washington', 'madison', 'monroe', 'adams', 'jackson', 'vanburen'])
      expect(data.bridges.find((b) => b.key === k).houses.count, k).toBeGreaterThanOrEqual(1)
  })
  it('the lift order only names known bridges', () => {
    for (const k of data.liftOrder) expect(keys).toContain(k)
  })
})

describe('isMovableBridge', () => {
  it('bascules yes; vertical lifts, swings and fixed bridges no', () => {
    expect(isMovableBridge({ bridge: 'movable', 'bridge:movable': 'bascule' })).toBe(true)
    expect(isMovableBridge({ bridge: 'movable' })).toBe(true)
    expect(isMovableBridge({ bridge: 'movable', 'bridge:movable': 'lift' })).toBe(false)
    expect(isMovableBridge({ bridge: 'yes' })).toBe(false)
  })
})

describe('detectBridges', () => {
  const C = [287, -757]
  // DuSable: upper deck (layer 2) and lower deck (layer 1), both directions
  const dusableWays = [
    way(1, [[290, -807], [273, -708]], { highway: 'secondary', bridge: 'movable', 'bridge:movable': 'bascule', layer: '2' }),
    way(2, [[283, -707], [301, -805]], { highway: 'secondary', bridge: 'movable', 'bridge:movable': 'bascule', layer: '2' }),
    way(3, [[281, -707], [298, -806]], { highway: 'tertiary', bridge: 'movable', 'bridge:movable': 'bascule', layer: '1' }),
    way(4, [[293, -807], [276, -708]], { highway: 'tertiary', bridge: 'movable', 'bridge:movable': 'bascule', layer: '1' }),
  ]
  it('claims upper and lower decks, both directions, as ONE bridge (no double deck)', () => {
    const [b, ...rest] = detectBridges(dusableWays, [entry({ key: 'dusable', at: ll(C), bearing: 10, clearSpan: 78, width: 28, decks: 2 })])
    expect(rest).toHaveLength(0)
    expect(b.wayIds.sort()).toEqual([1, 2, 3, 4])
    expect(Math.hypot(b.centre[0] - C[0], b.centre[1] - C[1])).toBeLessThan(3)
    expect(b.span).toBe(78)
  })
  it('reversed way order gives the same canonical axis', () => {
    const e = [entry({ key: 'x', at: ll([0, 0]) })]
    const a = detectBridges([way(1, [[0, 35], [0, -35]])], e)[0].axis
    const b = detectBridges([way(1, [[0, -35], [0, 35]])], e)[0].axis
    expect(a[0]).toBeCloseTo(b[0]); expect(a[1]).toBeCloseTo(b[1]); expect(a[1]).toBeLessThan(0)
  })
  it('Lake Street: only rail ways, axis from the bearing, rail ids kept for the elevated cut', () => {
    const rail = [way(9, [[-865, -407], [-775, -407]], { railway: 'subway', bridge: 'movable', 'bridge:movable': 'bascule' })]
    const [b] = detectBridges(rail, [entry({ key: 'lake', at: ll([-820, -411]), bearing: 90, decks: 2, leaf: 'through-truss' })])
    expect(b.railWayIds).toEqual([9])
    expect(Math.abs(b.axis[0])).toBeCloseTo(1, 3)
  })
  it('an entry that matches no way and has no bearing fails loudly, naming the entry', () => {
    expect(() => detectBridges([], [entry({ key: 'ghost', at: ll([5000, 5000]) })])).toThrow(/ghost/)
  })
  it('an unlisted movable way still becomes an unnamed bascule, never a flat ribbon', () => {
    const [b] = detectBridges([way(7, [[1000, 0], [1000, -60]], { highway: 'secondary', name: 'Nowhere St', bridge: 'movable' })], [])
    expect(b.generic).toBe(true)
    expect(b.name).toBe('Nowhere St')
    expect(b.houses.count).toBe(0)
  })
  it('the real entries resolve to their OSM centres', () => {
    const d = data.bridges.find((b) => b.key === 'dusable'), [x, z] = project(d.at.lon, d.at.lat)
    expect(Math.abs(x - 287)).toBeLessThan(1); expect(Math.abs(z + 757)).toBeLessThan(1) // within a metre of the OSM centre
  })
})

describe('cutPolyline', () => {
  const rect = { c: [0, 0], u: [0, -1], hl: 40, hw: 10 }
  it('a road straight through the span loses exactly the inside part', () => {
    const pieces = cutPolyline([[0, 100], [0, -100]], rect)
    expect(pieces).toHaveLength(2)
    expect(pieces[0].at(-1)[1]).toBeCloseTo(40); expect(pieces[1][0][1]).toBeCloseTo(-40)
  })
  it('a road wholly outside is untouched; a road wholly inside vanishes', () => {
    expect(cutPolyline([[50, 0], [50, 10]], rect)).toEqual([[[50, 0], [50, 10]]])
    expect(cutPolyline([[0, 10], [0, -10]], rect)).toEqual([])
  })
  it('clipSegment returns the inside parameter interval', () => {
    const [t0, t1] = clipSegment([0, 100], [0, -100], rect)
    expect(t0).toBeCloseTo(0.3); expect(t1).toBeCloseTo(0.7)
    expect(clipSegment([50, 0], [50, 10], rect)).toBeNull()
  })
})
