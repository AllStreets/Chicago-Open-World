// pipeline/tests/pois.test.js
import { describe, it, expect } from 'vitest'
import { poiCategory, poiRecord, dedupePois, anchorPoi, POI_CATEGORIES } from '../lib/pois.js'

describe('POI categories', () => {
  it.each([
    [{ name: 'Au Cheval', amenity: 'restaurant' }, 'food'],
    [{ name: 'The Aviary', amenity: 'bar' }, 'drinks'],
    [{ name: 'Metro', amenity: 'nightclub' }, 'nightlife'],
    [{ name: 'Intelligentsia', amenity: 'cafe' }, 'coffee'],
    [{ name: 'Chicago Theatre', amenity: 'theatre' }, 'venues'],
    [{ name: 'Green Mill', amenity: 'music_venue' }, 'venues'],
    [{ name: 'Art Institute', tourism: 'museum' }, 'culture'],
    [{ name: 'Target', shop: 'department_store' }, 'shops'],
    [{ name: 'Palmisano Park', leisure: 'park' }, 'outdoors'],
    [{ name: 'Palmer House', tourism: 'hotel' }, 'hotels'],
    [{ name: 'Walgreens', amenity: 'pharmacy' }, 'services'],
  ])('%o → %s', (tags, cat) => expect(poiCategory(tags)).toBe(cat))
  it('unnamed or unmapped tags are dropped', () => {
    expect(poiCategory({ amenity: 'bar' })).toBeNull()
    expect(poiCategory({ name: 'Bench', amenity: 'bench' })).toBeNull()
  })
  it('every category has a Remix icon name and a label', () => {
    for (const c of POI_CATEGORIES) { expect(c.icon).toMatch(/^Ri/); expect(c.label.length).toBeGreaterThan(2) }
  })
})

describe('POI records', () => {
  it('uses the way centre for ways and keeps compact tags', () => {
    const r = poiRecord({ type: 'way', id: 9, center: { lat: 41.88, lon: -87.63 }, tags: { name: 'X', amenity: 'cafe', cuisine: 'coffee_shop', opening_hours: 'Mo-Fr 07:00-18:00' } })
    expect(r).toMatchObject({ id: 'w9', name: 'X', cat: 'coffee', lat: 41.88 }); expect(r.tags.opening_hours).toBeDefined()
  })
  it('dedupes the same venue mapped as node and way, keeping the way', () => {
    const list = dedupePois([
      { id: 'n1', name: 'Au Cheval', x: 0, z: 0 }, { id: 'w2', name: 'Au  Cheval ', x: 10, z: 5 }, { id: 'n3', name: 'Au Cheval', x: 400, z: 0 },
    ])
    expect(list.map((p) => p.id).sort()).toEqual(['n3', 'w2'])
  })
})

describe('anchorPoi', () => {
  const square = { outer: [[-10, -10], [10, -10], [10, 10], [-10, 10]], holes: [[[-3, -3], [3, -3], [3, 3], [-3, 3]]], top: 40, bldg: 5 }
  const index = { query: () => [square] }
  it('inside a footprint → roof + 4 m, carries the building index', () => {
    expect(anchorPoi({ x: 7, z: 7 }, index)).toEqual({ x: 7, y: 44, z: 7, bldg: 5 })
  })
  it('inside a courtyard hole → ground + 6 m, no building', () => {
    expect(anchorPoi({ x: 0, z: 0 }, index)).toEqual({ x: 0, y: 6, z: 0, bldg: -1 })
  })
  it('entrance node 2 m outside the wall snaps to the building', () => {
    expect(anchorPoi({ x: 12, z: 0 }, index).bldg).toBe(5)
  })
  it('in the open → ground + 6 m', () => {
    expect(anchorPoi({ x: 50, z: 50 }, { query: () => [] })).toEqual({ x: 50, y: 6, z: 50, bldg: -1 })
  })
})

import { overpassQuery, FETCH_KINDS } from '../lib/sources.js'
describe('the pois Overpass kind', () => {
  it('asks for named amenities, tourism, shops and leisure with centres and tags only, and is part of the world fetch', () => {
    const q = overpassQuery('pois', { s: 41.8, w: -87.7, n: 41.9, e: -87.6 })
    for (const k of ['amenity', 'tourism', 'shop', 'leisure', '[name]', 'out center tags']) expect(q).toContain(k)
    expect(q).toContain('music_venue'); expect(q).toContain('museum'); expect(q).toContain('fitness_centre')
    expect(FETCH_KINDS.pois).toEqual([3, 4])
  })
})
