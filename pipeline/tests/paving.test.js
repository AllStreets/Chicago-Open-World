// pipeline/tests/paving.test.js — plazas and park paths laid on the ground (user, 2026-09-30: Grant Park's brick).
import { describe, it, expect } from 'vitest'
import { pavingKind, pathHalfWidth, isPavingArea } from '../lib/paving.js'
import { overpassQuery, FETCH_KINDS } from '../lib/sources.js'

describe('paving', () => {
  it('brick for paving stones, bricks, setts and granite; concrete for the rest; nothing for street sidewalks', () => {
    expect(pavingKind({ highway: 'footway', surface: 'paving_stones' })).toBe('brick')
    expect(pavingKind({ highway: 'pedestrian', area: 'yes', surface: 'bricks' })).toBe('brick')
    expect(pavingKind({ highway: 'footway', surface: 'sett' })).toBe('brick')
    expect(pavingKind({ highway: 'footway', surface: 'concrete' })).toBe('concrete')
    expect(pavingKind({ highway: 'path', surface: 'asphalt' })).toBe('concrete')
    expect(pavingKind({ highway: 'footway', footway: 'sidewalk', surface: 'concrete' })).toBeNull() // the roads already lay sidewalks
    expect(pavingKind({ highway: 'footway', footway: 'crossing' })).toBeNull()
    expect(pavingKind({ highway: 'path', surface: 'grass' })).toBeNull()
  })
  it('plazas are areas; widths come from the tag or the kind of way', () => {
    expect(isPavingArea({ highway: 'pedestrian', area: 'yes' })).toBe(true)
    expect(isPavingArea({ 'area:highway': 'pedestrian' })).toBe(true)
    expect(isPavingArea({ place: 'square' })).toBe(true)
    expect(isPavingArea({ highway: 'footway' })).toBe(false)
    expect(pathHalfWidth({ highway: 'footway', width: '8' })).toBe(4)
    expect(pathHalfWidth({ highway: 'pedestrian' })).toBe(4)
    expect(pathHalfWidth({ highway: 'footway' })).toBe(1.5)
  })
  it('the paving Overpass kind asks for plazas and paths, and joins the world fetch', () => {
    const q = overpassQuery('paving', { s: 41.8, w: -87.7, n: 41.9, e: -87.6 })
    for (const k of ['"highway"="pedestrian"', 'area:highway', '"place"="square"', 'footway', 'out geom']) expect(q).toContain(k)
    expect(FETCH_KINDS.paving).toEqual([3, 4])
  })
})
