// X-0a: the tile sidecar's compact v2 form must decode to exactly the v1 records (hover cards identical).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodeTileMeta, decodeTileMeta, TILE_META_VERSION } from '../../shared/tileMeta.js'

const v1 = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'tile-meta-v1.json'), 'utf8'))

describe('tile metadata v2 (X-0a)', () => {
  it('the fixture samples 50 buildings, including bridges, heroes, odd ids and odd addresses', () => {
    expect(v1.buildings).toHaveLength(50)
    expect(v1.buildings.some((b) => b.bridge)).toBe(true)
    expect(v1.buildings.some((b) => b.hero)).toBe(true)
    expect(v1.buildings.some((b) => !/^w\d+$/.test(b.id))).toBe(true)
    expect(v1.buildings.some((b) => b.address && !/^\d+ /.test(b.address))).toBe(true) // ranges like 616-618
  })
  it('round-trips buildings, trees, props and places exactly', () => {
    const enc = encodeTileMeta(v1)
    expect(enc.v).toBe(TILE_META_VERSION)
    const dec = decodeTileMeta(JSON.parse(JSON.stringify(enc)))
    expect(dec.buildings).toEqual(v1.buildings)
    expect(dec.trees).toEqual(v1.trees)
    expect(dec.props).toEqual(v1.props)
    expect(dec.pois).toEqual(v1.pois)
  })
  it('keeps v1 key order, so a record is byte-identical once re-serialised', () => {
    const dec = decodeTileMeta(JSON.parse(JSON.stringify(encodeTileMeta(v1))))
    expect(JSON.stringify(dec.buildings)).toBe(JSON.stringify(v1.buildings))
    expect(JSON.stringify(dec.pois)).toBe(JSON.stringify(v1.pois))
  })
  it('a tile without places stays without places', () => {
    const { pois, ...noPois } = v1
    const dec = decodeTileMeta(JSON.parse(JSON.stringify(encodeTileMeta(noPois))))
    expect(dec.pois).toBeUndefined()
    expect(dec.buildings).toEqual(v1.buildings)
  })
  it('reads v1 unchanged', () => {
    expect(decodeTileMeta(v1)).toBe(v1)
    expect(decodeTileMeta(null)).toBe(null)
  })
  it('is smaller than v1 JSON even for a sample with no shared strings (a real tile shares far more)', () => {
    const a = JSON.stringify(v1).length, b = JSON.stringify(encodeTileMeta(v1)).length
    expect(b).toBeLessThan(a * 0.75)
  })
  it('edge values: a house number "0", a numeric-looking non-OSM id and empty tables survive', () => {
    const rec = (o) => ({ id: 'w1', name: null, address: null, stories: null, year: null, height: 1, hero: null, ...o })
    const t = { buildings: [rec({ address: '0 Main Street' }), rec({ id: 'w007' }), rec({ id: 'w12', address: '12A-14 North Ave', stories: 3, year: 1901, height: 12.3 }), rec({ address: 'Navy Pier' })], trees: [], props: [] }
    expect(decodeTileMeta(JSON.parse(JSON.stringify(encodeTileMeta(t))))).toEqual(t)
  })
  it('refuses a value it cannot represent (stories or year of 0) instead of corrupting it', () => {
    const rec = { id: 'w1', name: null, address: null, stories: 0, year: null, height: 1, hero: null }
    expect(() => encodeTileMeta({ buildings: [rec], trees: [], props: [] })).toThrow(/stories/)
  })
})
