import { describe, it, expect } from 'vitest'
import { roadHalfWidth, isElevatedRail, scatterInPolygon, GROUND_Y } from '../lib/ground.js'
import { pointInRing } from '../lib/geom.js'

describe('ground rules', () => {
  it('road widths by class; tunnels and lower levels skipped', () => {
    expect(roadHalfWidth({ highway: 'primary' })).toBe(8)
    expect(roadHalfWidth({ highway: 'residential' })).toBe(4.5)
    expect(roadHalfWidth({ highway: 'primary', tunnel: 'yes' })).toBe(0)
    expect(roadHalfWidth({ highway: 'primary', layer: '-1' })).toBe(0)
    expect(roadHalfWidth({ highway: 'footway' })).toBe(0)
  })
  it('elevated L detection', () => {
    expect(isElevatedRail({ railway: 'subway', bridge: 'yes' })).toBe(true)
    expect(isElevatedRail({ railway: 'subway', layer: '2' })).toBe(true)
    expect(isElevatedRail({ railway: 'subway', tunnel: 'yes', layer: '-2' })).toBe(false)
    expect(isElevatedRail({ railway: 'rail', bridge: 'yes' })).toBe(false)
  })
  it('scatter is deterministic and inside the polygon', () => {
    const ring = [[0, 0], [100, 0], [100, -60], [0, -60]]
    const a = scatterInPolygon(ring, 12, 5), b = scatterInPolygon(ring, 12, 5)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(20)
    expect(a.every((p) => pointInRing(p, ring))).toBe(true)
  })
  it('water lies below every street layer so bridges show', () => {
    for (const k of ['roads', 'sidewalks', 'rail', 'parks', 'pitches', 'beaches']) expect(GROUND_Y.water).toBeLessThan(GROUND_Y[k])
    expect(GROUND_Y.water).toBeGreaterThan(0)
  })
})

import { flatMesh } from '../lib/ground.js'

describe('flat meshes + lake level', () => {
  it('flatMesh triangulates a polygon with a hole, facing up', () => {
    const m = flatMesh([{ outer: [[0, 0], [10, 0], [10, -10], [0, -10]], holes: [[[3, -3], [7, -3], [7, -7], [3, -7]]] }], 0.04)
    expect(m.positions.length / 9).toBe(8)
    for (let i = 1; i < m.normals.length; i += 3) expect(m.normals[i]).toBe(1)
  })
  it('the lake sits just under the polygon water', () => {
    expect(GROUND_Y.lake).toBe(0.02)
    expect(GROUND_Y.lake).toBeLessThan(GROUND_Y.water)
  })
})
