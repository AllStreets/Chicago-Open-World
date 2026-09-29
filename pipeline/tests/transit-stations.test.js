import { describe, it, expect } from 'vitest'
import { project, unproject } from '../../shared/project.js'
import { createMesh, KIND, hexToLinear } from '../lib/transit/meshkit.js'
import { stationFeatures, linkStops, stationSite, platformsFor, stationMesh, normName } from '../lib/transit/stations.js'

const ll = (x, z) => { const [lon, lat] = unproject(x, z); return { lon, lat } }
const look = { finish: 'concrete', base: '#a7a39a', glass: '#1c2630', mullion: '#2b3137', spandrel: '#3a4540' }
const ys = (m) => m.positions.filter((_, i) => i % 3 === 1)

describe('stations', () => {
  it('merges the node, building and stop-area of one station; drops bus stations; keeps a same-named station far away', () => {
    const els = [
      { type: 'node', id: 1, ...ll(0, 0), tags: { railway: 'station', name: 'Clark/Lake', network: 'CTA' } },
      { type: 'way', id: 2, geometry: [ll(-20, -10), ll(20, -10), ll(20, 10)], tags: { railway: 'station', name: 'Clark/Lake' } },
      { type: 'node', id: 3, ...ll(30, 0), tags: { public_transport: 'station', station: 'subway', name: 'Clark/Lake Station' } },
      { type: 'node', id: 4, ...ll(5, 5), tags: { public_transport: 'station', bus: 'yes', name: 'Clark/Lake' } },
      { type: 'node', id: 5, ...ll(2000, 0), tags: { railway: 'station', name: 'Clark/Lake' } },
      { type: 'node', id: 6, ...ll(0, 500), tags: { railway: 'station' } },
    ]
    const s = stationFeatures(els)
    expect(s).toHaveLength(2)
    expect(s[0]).toMatchObject({ id: 'st-n1', name: 'Clark/Lake', operator: 'cta', osm: ['n1', 'w2', 'n3'] })
    expect(s[0].pt[0]).toBeCloseTo(0, 3)
    expect(normName('Clark/Lake Station')).toBe('clark/lake'); expect(normName('Roosevelt (Red)')).toBe('roosevelt')
  })
  it('links route stops to stations by name (250 m) or proximity (60 m); lines in catalog order', () => {
    const stations = [{ id: 'st-n1', key: 'clark/lake', pt: [0, 0] }]
    const routes = [
      { line: 'brown', stops: [{ name: null, pt: [40, 0] }] },
      { line: 'blue', stops: [{ name: 'Clark/Lake', pt: [200, 0] }] },
      { line: 'red', stops: [{ name: 'Far', pt: [500, 0] }] },
    ]
    linkStops(stations, routes, ['red', 'blue', 'brown'])
    expect(stations[0].lines).toEqual(['blue', 'brown'])
    expect(routes.map((r) => r.stops[0].station)).toEqual(['st-n1', 'st-n1', null])
  })
  const piece = { operator: 'cta', lines: ['red'], pts3: [[-200, 7.2, 0], [200, 7.2, 0]], pts2: [[-200, 0], [200, 0]], grades: ['elevated'] }
  it('an elevated station: side platform at deck height + 1.07 m, canopy, signs in the line colour, stairs to the street', () => {
    const st = { id: 'st-n9', pt: [0, 3], lines: ['red'] }
    const site = stationSite(st, [piece])
    expect(site).toMatchObject({ y: 7.2, grade: 'elevated', operator: 'cta', partner: null })
    const plats = platformsFor(st, site, [])
    expect(plats).toHaveLength(1)
    const cz = plats[0].outline.reduce((a, p) => a + p[1], 0) / 4
    expect(cz).toBeCloseTo(1.55 + 1.85, 5)
    const m = createMesh()
    stationMesh(m, st, site, plats, { look, lineColours: { red: hexToLinear('#c60c30') } })
    expect(Math.max(...ys(m))).toBeCloseTo(7.2 + 1.07 + 3.2 + 0.18, 2)
    expect(Math.min(...ys(m))).toBeCloseTo(0, 5)
    const i = m.kind.indexOf(KIND.sign)
    expect(m.colors.slice(i * 3, i * 3 + 3)).toEqual(hexToLinear('#c60c30'))
    expect(m.colors.slice(0, 3)).toEqual(hexToLinear(look.base)) // platform top first, in the look's base colour
  })
  it('a subway station is a street entrance with a line-colour pylon; no station further than 120 m from track', () => {
    const deep = { ...piece, pts3: [[-200, -9, 0], [200, -9, 0]], grades: ['subway'] }
    const st = { id: 'st-n8', pt: [0, 10], lines: ['red'] }
    const site = stationSite(st, [deep])
    const m = createMesh()
    stationMesh(m, st, site, [], { look, lineColours: { red: hexToLinear('#c60c30') } })
    expect(Math.max(...ys(m))).toBeCloseTo(3.4, 5); expect(Math.min(...ys(m))).toBeCloseTo(0, 5)
    expect(m.kind.includes(KIND.sign)).toBe(true)
    expect(stationSite({ pt: [0, 400], lines: [] }, [piece])).toBeNull()
  })
})
