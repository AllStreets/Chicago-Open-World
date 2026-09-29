import { describe, it, expect } from 'vitest'
import { parseTallestWikitext, validateSkyline } from '../lib/skyline.js'
const WT = `==Tallest buildings==
{| class="wikitable"
|-
|1
|[[Willis Tower]]
|[[File:x.jpg]]
|{{Coord|41|52|44|N|87|38|8|W|region:US}}
|{{Sort|1451|1,451 (442)}}
|110
|1974
|Office
|-
|15
|[[400 Lake Shore Drive|400 Lake Shore Drive North Tower]]
|[[File:y.jpg]]
|{{Coord|41|53|23.53|N|87|36|53.6|W|region:US}}
|{{Convert|259.1|m|ft|abbr=values|order=flip}}
|73
|2026
|Residential
|-
|8
|[[One Chicago Square|One Chicago East Tower]]
| [[File:z.jpg]]
|{{Coord|41.8960713|-87.6281|type:landmark}}
|{{Convert|296.6|m|ft|abbr=values|order=flip}}
|76
|2022
|Mixed-use
|}
=== Tallest buildings by pinnacle height ===`
describe('skyline', () => {
  it('parses name, coords, metres, floors, year', () => {
    const [w, l] = parseTallestWikitext(WT)
    expect(w).toMatchObject({ rank: 1, name: 'Willis Tower', heightM: 442, floors: 110, year: 1974 })
    expect(w.lat).toBeCloseTo(41.87889, 4); expect(w.lon).toBeCloseTo(-87.63556, 4)
    expect(l).toMatchObject({ rank: 15, name: '400 Lake Shore Drive North Tower', heightM: 259.1, year: 2026 })
  })
  it('parses decimal-degree coordinates', () => {
    const o = parseTallestWikitext(WT)[2]
    expect(o).toMatchObject({ rank: 8, name: 'One Chicago East Tower', heightM: 296.6 })
    expect(o.lat).toBeCloseTo(41.89607, 4); expect(o.lon).toBeCloseTo(-87.6281, 4)
  })
  it('validate reports missing and wrong heights', () => {
    const sky = [{ name: 'A', lat: 41.88203, lon: -87.62784, heightM: 100 }, { name: 'B', lat: 41.9, lon: -87.6, heightM: 50 }]
    const b = [{ centroid: [0, 0], polygons: [{ outer: [[-10, 10], [10, 10], [10, -10], [-10, -10]], holes: [] }], pieces: [{ top: 70 }] }]
    const r = validateSkyline(b, sky, { s: 41.8, w: -87.7, n: 41.95, e: -87.59 })
    expect(r.wrongHeight).toEqual([{ name: 'A', expected: 100, got: 70 }])
    expect(r.missing).toEqual(['B'])
  })
  it('skips entries outside the bbox', () => {
    const r = validateSkyline([], [{ name: 'Far', lat: 42.5, lon: -87.6, heightM: 100 }], { s: 41.8, w: -87.7, n: 41.95, e: -87.59 })
    expect(r.missing).toEqual([])
  })
  it('ignores antennas and counts crowns (architectural height), and reports how it matched', () => {
    const sky = [{ name: 'W', lat: 41.88203, lon: -87.62784, heightM: 442 }]
    const box = [[-20, 20], [20, 20], [20, -20], [-20, -20]], mast = [[0, 0], [1, 0], [1, -1], [0, -1]]
    const b = [{ centroid: [0, 0], area: 1600, polygons: [{ outer: box, holes: [] }], pieces: [{ outer: box, top: 442 }, { outer: mast, top: 527 }] }]
    const r = validateSkyline(b, sky, { s: 41.8, w: -87.7, n: 41.95, e: -87.59 })
    expect(r.wrongHeight).toEqual([])
    expect(r.matches[0]).toMatchObject({ name: 'W', via: 'contains' })
    b[0].pieces = [{ outer: box, top: 400 }]; b[0].crownTop = 442
    expect(validateSkyline(b, sky, { s: 41.8, w: -87.7, n: 41.95, e: -87.59 }).wrongHeight).toEqual([])
  })
})
