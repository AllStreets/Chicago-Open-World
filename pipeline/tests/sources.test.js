import { describe, it, expect } from 'vitest'
import { RING0_BBOX, WORLD_BBOX, chunkBBox, footprintsUrl, cityBoundaryUrl, overpassQuery } from '../lib/sources.js'

describe('sources', () => {
  it('builds a paged Socrata within_box URL', () => {
    const u = new URL(footprintsUrl(RING0_BBOX, 2000, 1000))
    expect(u.hostname).toBe('data.cityofchicago.org')
    expect(u.pathname).toBe('/resource/syp8-uezg.json')
    expect(u.searchParams.get('$where')).toBe('within_box(the_geom,41.9,-87.645,41.865,-87.605)')
    expect(u.searchParams.get('$offset')).toBe('2000')
    expect(u.searchParams.get('$order')).toBe('bldg_id')
  })
  it('city boundary is geojson', () => {
    expect(cityBoundaryUrl()).toMatch(/qqq8-j68g\.geojson$/)
  })
  it('overpass queries use (s,w,n,e) and out geom', () => {
    const q = overpassQuery('parts', RING0_BBOX)
    expect(q).toContain('(41.865,-87.645,41.9,-87.605)')
    expect(q).toContain('building:part')
    expect(q).toContain('out geom')
    expect(() => overpassQuery('nope', RING0_BBOX)).toThrow()
  })
  it('ground kinds: trees are nodes, rail matches railways', () => {
    expect(overpassQuery('trees', RING0_BBOX)).toContain('node["natural"="tree"]')
    expect(overpassQuery('trees', RING0_BBOX).endsWith('out;')).toBe(true)
    expect(overpassQuery('rail', RING0_BBOX)).toContain('railway')
    expect(overpassQuery('parks', RING0_BBOX)).toContain('leisure')
    expect(overpassQuery('roads', RING0_BBOX)).toContain('highway')
  })
})

describe('world bbox + chunks', () => {
  it('world covers Addison to 35th, Western to the lake', () => {
    expect(WORLD_BBOX).toEqual({ s: 41.826, w: -87.695, n: 41.952, e: -87.595 })
  })
  it('chunks partition the bbox exactly', () => {
    const c = chunkBBox(WORLD_BBOX, 4, 6)
    expect(c).toHaveLength(24)
    expect(Math.min(...c.map((b) => b.s))).toBeCloseTo(WORLD_BBOX.s)
    expect(Math.max(...c.map((b) => b.n))).toBeCloseTo(WORLD_BBOX.n)
    const area = c.reduce((a, b) => a + (b.n - b.s) * (b.e - b.w), 0)
    expect(area).toBeCloseTo((WORLD_BBOX.n - WORLD_BBOX.s) * (WORLD_BBOX.e - WORLD_BBOX.w), 10)
  })
  it('allbuildings includes multipolygon relations', () => {
    expect(overpassQuery('allbuildings', WORLD_BBOX)).toContain('relation["building"]')
  })
})

describe('water + shore kinds (B5, B7)', () => {
  it('water pulls lagoons and ponds, not only rivers and harbours', () => {
    const q = overpassQuery('water', WORLD_BBOX)
    expect(q).toContain('way["natural"="water"]')
    expect(q).toContain('lagoon')
    expect(q).toContain('relation["water"="harbour"]')
  })
  it('shore pulls breakwaters', () => {
    expect(overpassQuery('shore', WORLD_BBOX)).toContain('"man_made"~"^(breakwater|groyne)$"')
  })
})

describe('coast kind', () => {
  it('pulls the Lake Michigan coastline, so land is the real shore, not the city limits in the lake', () => {
    expect(overpassQuery('coast', WORLD_BBOX)).toContain('rel["natural"="water"]["name"="Lake Michigan"];way(r)(')
  })
})

