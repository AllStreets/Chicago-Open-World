import { describe, it, expect } from 'vitest'
import { buildGridIndex, enrichFromCity } from '../lib/enrich.js'
const bldg = (height, heightSource) => ({ polygons: [{ outer: [[0, 0], [30, 0], [30, -30], [0, -30]], holes: [] }], bbox: { minX: 0, minZ: -30, maxX: 30, maxZ: 0 }, height, heightSource, year: null, address: null, stories: null })
describe('enrich', () => {
  it('grid index returns items in the query cell neighbourhood', () => {
    const idx = buildGridIndex([{ c: [10, 10] }, { c: [900, 900] }], 100, (i) => i.c)
    expect(idx.query([15, 15])).toHaveLength(1)
  })
  it('fills stories/year/address from the City building inside', () => {
    const osm = [bldg(9, 'default')]
    enrichFromCity(osm, [{ centroid: [15, -15], stories: 6, year: 1925, address: '100 N State St', id: 'c1' }])
    expect(osm[0]).toMatchObject({ stories: 6, year: 1925, address: '100 N State St', cityId: 'c1', heightSource: 'city' })
    expect(osm[0].height).toBeCloseTo(22.8)
  })
  it('never overrides an OSM-tagged height', () => {
    const osm = [bldg(50, 'osm')]
    enrichFromCity(osm, [{ centroid: [15, -15], stories: 6, year: 1925, address: 'x', id: 'c1' }])
    expect(osm[0].height).toBe(50)
  })
})
