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

import { readFileSync } from 'node:fs'
import { landmarkEntry, validateLandmarkRegistry, V6_LANDMARKS } from '../lib/landmarkRuntime.js'

describe('landmark registry (E9)', () => {
  const heroes = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes
  it('every V6 landmark is registered with an alias, a source and a beacon', () => {
    expect(V6_LANDMARKS).toHaveLength(16)
    expect(validateLandmarkRegistry(heroes)).toBe(true)
  })
  it('a missing source or beacon is named in the error', () => {
    const broken = heroes.map((h) => (h.key === 'picasso' ? { ...h, sources: [], beacon: undefined } : h))
    expect(() => validateLandmarkRegistry(broken)).toThrow(/picasso: no https source[\s\S]*picasso: no VISIT beacon/)
  })
  it('manifest rows carry the beacon anchor', () => {
    const b = { centroid: [100, 200], pieces: [{ top: 30 }], venueTop: 0, extraMeshes: [] }
    expect(landmarkEntry(b, { key: 'k', name: 'K', aliases: ['k2'] })).toEqual({ key: 'k', name: 'K', aliases: ['k2'], x: 100, z: 200, top: 30, beacon: [100, 36, 200], kind: 'tower', kindLine: null })
    const withBeacon = landmarkEntry(b, { key: 'k', name: 'K', beacon: { lat: 41.88203, lon: -87.62784, y: 50 } })
    expect(withBeacon.beacon).toEqual([0, 50, 0])
  })
})

describe('landmark entries aim at the tower (P4 Task 6 evaluation)', () => {
  it('x, z and the default beacon sit over the tallest piece, not the whole site', () => {
    const b = { centroid: [0, 0], venueTop: 0, pieces: [
      { outer: [[-50, -40], [50, -40], [50, 40], [-50, 40]], top: 23 },          // the podium, the whole site
      { outer: [[20, 10], [40, 10], [40, 30], [20, 30]], top: 141 },            // the tower in one corner
    ] }
    const e = landmarkEntry(b, { key: 'tribune', name: 'Tribune Tower' })
    expect([e.x, e.z]).toEqual([30, 20])
    expect(e.beacon[0]).toBe(30); expect(e.beacon[2]).toBe(20)
  })
})

describe('landmark kinds for the tooltip (user fixes)', () => {
  const b = { centroid: [0, 0], venueTop: 30, pieces: [], extraMeshes: [] }
  it('a ballpark says what it is and whose home it is', () => {
    const e = landmarkEntry(b, { key: 'ratefield', name: 'Rate Field', sports: { kind: 'baseball', teams: ['whitesox'] } })
    expect(e.kind).toBe('venue'); expect(e.kindLine).toBe('Ballpark · home of the White Sox')
  })
  it('an arena with two teams names both', () => {
    expect(landmarkEntry(b, { key: 'unitedcenter', name: 'United Center', sports: { kind: 'arena', teams: ['bulls', 'blackhawks'] } }).kindLine).toBe('Arena · home of the Bulls and the Blackhawks')
  })
  it('a museum or fountain is a landmark with its type; a tower has no kind line', () => {
    expect(landmarkEntry(b, { key: 'shedd', name: 'Shedd', landmark: { type: 'museum' } })).toMatchObject({ kind: 'landmark', kindLine: 'Museum' })
    expect(landmarkEntry({ ...b, pieces: [{ top: 400, outer: [[0, 0], [1, 0], [1, 1]] }] }, { key: 'willis', name: 'Willis Tower' })).toMatchObject({ kind: 'tower', kindLine: null })
  })
})
