// app/src/lib/__tests__/picking.test.js
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { bldgIndexFromHit, buildingInfo, tooltipLines } from '../picking.js'

const mesh = (withAttr = true, lod = 'lod0') => {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0, 3, 0, 0, 2, 1, 0], 3))
  if (withAttr) g.setAttribute('_bldg', new THREE.Float32BufferAttribute([4, 4, 4, 7, 7, 7], 1))
  const m = new THREE.Mesh(g); m.name = 'buildings'; m.userData = { tileId: '0_0', lod }
  return m
}
describe('picking', () => {
  it('reads _bldg from the hit face', () => {
    expect(bldgIndexFromHit({ object: mesh(), face: { a: 3 } })).toBe(7)
  })
  it('returns null for meshes without _bldg, for non-building layers and for blocks', () => {
    expect(bldgIndexFromHit({ object: mesh(false), face: { a: 0 } })).toBeNull()
    const water = mesh(); water.name = 'water'
    expect(bldgIndexFromHit({ object: water, face: { a: 0 } })).toBeNull()
    expect(bldgIndexFromHit({ object: mesh(true, 'block'), face: { a: 0 } })).toBeNull()
    expect(bldgIndexFromHit(null)).toBeNull()
  })
  it('estimates stories from height when missing', () => {
    const info = buildingInfo({ buildings: [{ id: 'w1', name: null, address: null, stories: null, year: null, height: 45.6 }] }, 0)
    expect(info.stories).toBe(12); expect(info.storiesEstimated).toBe(true)
  })
  it('tooltip lines read like plain English', () => {
    expect(tooltipLines({ name: 'The Rookery', address: '209 S LaSalle St', stories: 12, storiesEstimated: false, year: 1888 }))
      .toEqual(['The Rookery', '209 S LaSalle St', '12 stories · 1888'])
    expect(tooltipLines({ name: null, address: null, stories: 12, storiesEstimated: true, year: null }))
      .toEqual(['Unnamed building', '~12 stories (est.) · year unknown'])
  })
  it('buildingInfo returns null for an out-of-range index', () => {
    expect(buildingInfo({ buildings: [] }, 3)).toBeNull()
  })
})
