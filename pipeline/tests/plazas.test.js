// pipeline/tests/plazas.test.js — hand-shaped plazas OSM doesn't map as areas (Buckingham's granite apron).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { synthPlazas } from '../lib/paving.js'

describe('hand-shaped plazas', () => {
  it('a disc plaza becomes a brick polygon of the right radius around its centre', () => {
    const project = (lon, lat) => [lon * 1000, lat * 1000]
    const [p] = synthPlazas([{ key: 'k', kind: 'brick', shape: 'disc', lat: 1, lon: 2, r: 68 }], project)
    expect(p.kind).toBe('brick')
    const d = p.outer.map(([x, z]) => Math.hypot(x - 2000, z - 1000))
    expect(Math.min(...d)).toBeCloseTo(68, 0); expect(Math.max(...d)).toBeCloseTo(68, 0)
    expect(p.bbox.maxX - p.bbox.minX).toBeCloseTo(136, 0)
  })
  it('a rect plaza is w × d around its centre, turned by its bearing', () => {
    const [p] = synthPlazas([{ key: 'r', kind: 'concrete', shape: 'rect', lat: 0, lon: 0, w: 40, d: 20, bearingDeg: 0 }], (lon, lat) => [lon, lat])
    expect(p.bbox.maxX - p.bbox.minX).toBeCloseTo(40, 3); expect(p.bbox.maxZ - p.bbox.minZ).toBeCloseTo(20, 3)
  })
  it('the repo plaza data is sourced', () => {
    for (const p of JSON.parse(readFileSync(new URL('../data/plazas.json', import.meta.url), 'utf8')).plazas) expect(p.source.length).toBeGreaterThan(0)
  })
})
