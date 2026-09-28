import { describe, it, expect } from 'vitest'
import { RING0_BBOX, footprintsUrl, cityBoundaryUrl, overpassQuery } from '../lib/sources.js'

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
})
