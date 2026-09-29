import { describe, it, expect } from 'vitest'
import { osmBuildingPolys, osmToBuilding, defaultHeightFor } from '../lib/osm.js'
import { unproject } from '../../shared/project.js'
const g = (ring) => [...ring, ring[0]].map(([x, z]) => { const [lon, lat] = unproject(x, z); return { lon, lat } })
const sq = (x, z, s) => [[x, z], [x + s, z], [x + s, z - s], [x, z - s]]
describe('osm buildings', () => {
  it('way → one polygon', () => {
    expect(osmBuildingPolys({ type: 'way', geometry: g(sq(0, 0, 20)) })).toHaveLength(1)
  })
  it('relation: two outers, inner goes to the outer containing it', () => {
    const el = { type: 'relation', members: [
      { role: 'outer', geometry: g(sq(0, 0, 50)) }, { role: 'outer', geometry: g(sq(200, 0, 20)) },
      { role: 'inner', geometry: g(sq(10, -10, 10)) } ] }
    const p = osmBuildingPolys(el)
    expect(p).toHaveLength(2)
    expect(p.find((q) => q.outer[0][0] < 100).holes).toHaveLength(1)
    expect(p.find((q) => q.outer[0][0] > 100).holes).toHaveLength(0)
  })
  it('heights: tag > levels > type default', () => {
    expect(osmToBuilding({ type: 'way', id: 1, geometry: g(sq(0, 0, 20)), tags: { building: 'yes', height: '50' } }).height).toBe(50)
    expect(osmToBuilding({ type: 'way', id: 2, geometry: g(sq(0, 0, 20)), tags: { building: 'yes', 'building:levels': '10' } }).height).toBeCloseTo(38)
    expect(osmToBuilding({ type: 'way', id: 3, geometry: g(sq(0, 0, 20)), tags: { building: 'garage' } }).height).toBe(4)
    expect(defaultHeightFor({ building: 'unknownthing' })).toBe(9)
  })
  it('keeps name, year, OSM id and height source', () => {
    const b = osmToBuilding({ type: 'way', id: 7, geometry: g(sq(0, 0, 20)), tags: { building: 'yes', height: '50', name: 'X', start_date: '2020-05' } })
    expect(b).toMatchObject({ id: 'w7', osmId: 7, name: 'X', year: 2020, heightSource: 'osm', source: 'osm' })
  })
  it('drops tiny and non-polygonal elements', () => {
    expect(osmToBuilding({ type: 'way', id: 4, geometry: g(sq(0, 0, 2)), tags: { building: 'yes' } })).toBeNull()
    expect(osmToBuilding({ type: 'way', id: 5, geometry: g([[0, 0], [10, 0]]).slice(0, 2), tags: { building: 'yes' } })).toBeNull()
  })
  it('drops underground structures (garages under plazas) but keeps above-ground buildings on layer ≥ 0', () => {
    expect(osmToBuilding({ type: 'way', id: 3, geometry: g(sq(0, 0, 20)), tags: { building: 'commercial', layer: '-1' } })).toBe(null)
    expect(osmToBuilding({ type: 'way', id: 4, geometry: g(sq(0, 0, 20)), tags: { building: 'yes', location: 'underground' } })).toBe(null)
    expect(osmToBuilding({ type: 'way', id: 5, geometry: g(sq(0, 0, 20)), tags: { building: 'yes', layer: '1' } })).not.toBe(null)
  })
})
