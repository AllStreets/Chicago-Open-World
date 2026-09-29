import { describe, it, expect } from 'vitest'
import { collectRuntime } from '../lib/landmarkRuntime.js'
import { applyHero } from '../lib/heroes.js'

describe('landmark runtime', () => {
  it('merges runtime blocks, concatenates plazas, lists detached meshes', () => {
    const r = collectRuntime([
      { key: 'buckingham', runtime: { fountain: { emitters: [1] }, plazas: [{ key: 'b' }] } },
      { key: 'cloudgate', runtime: { cloudgate: { centre: [1, 2] }, plazas: [{ key: 'c' }] }, detached: [{ key: 'cloudgate', centre: [1, 2] }] },
    ])
    expect(r.fountain.emitters).toEqual([1]); expect(r.plazas.map((p) => p.key)).toEqual(['b', 'c'])
    expect(r.detached).toEqual([{ key: 'cloudgate', file: 'landmarks/cloudgate.glb', centre: [1, 2] }])
  })
  it('two landmarks claiming the same runtime block is a build error', () => {
    expect(() => collectRuntime([{ key: 'a', runtime: { fountain: {} } }, { key: 'b', runtime: { fountain: {} } }])).toThrow(/fountain.*b/)
  })
  it('applyHero passes runtime and detached through', () => {
    const b = { id: 'm', area: 1, centroid: [0, 0], height: 0, parts: null, polygons: [{ outer: [[1, 0], [0, 1], [-1, 0], [0, -1]], holes: [] }] }
    const r = applyHero(b, { crowns: [], landmark: { type: 'fountain' } })
    expect(r.runtime.fountain.emitters.length).toBeGreaterThan(0)
  })
})
