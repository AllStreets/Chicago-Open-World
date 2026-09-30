// app/src/lib/__tests__/poiFilter.test.js
import { describe, it, expect } from 'vitest'
import { filterPois, mergeLivePlaces, MAX_PINS } from '../poiFilter.js'

const pois = [
  { id: 'n1', n: 'Bar A', c: 1, x: 0, y: 30, z: 0, b: 3 },
  { id: 'n2', n: 'Cafe B', c: 2, x: 100, y: 6, z: 0, b: -1 },
  { id: 'w3', n: 'Bar C', c: 1, x: 50, y: 20, z: 0, b: 4 },
]
const CATS = ['food', 'drinks', 'coffee']
describe('filterPois', () => {
  it('keeps selected categories, nearest first, truncated', () => {
    expect(filterPois(pois, { cats: ['drinks'], target: [60, 0], max: 1, catIds: CATS }).map((p) => p.id)).toEqual(['w3'])
  })
  it('an empty category selection shows nothing', () => {
    expect(filterPois(pois, { cats: [], target: [0, 0], max: 10, catIds: CATS })).toEqual([])
  })
  it('pin caps shrink on LOW', () => { expect(MAX_PINS.LOW).toBeLessThan(MAX_PINS.HIGH) })
})

describe('mergeLivePlaces', () => {
  const project = (lon, lat) => [(lon + 87.62784) * 82900, -(lat - 41.88203) * 111100]
  const anchor = ({ x, z }) => ({ x, y: 6, z, bldg: -1 })
  it('adds new live places and skips ones already present by id or name+distance', () => {
    const live = { places: [
      { id: '1', name: 'Bar A', lat: 41.88203, lon: -87.62784 },
      { id: '777', name: 'New Spot', lat: 41.8830, lon: -87.6280 },
    ] }
    const out = mergeLivePlaces(pois, live, { project, anchor })
    expect(out.filter((p) => p.n === 'Bar A')).toHaveLength(1)
    expect(out.find((p) => p.n === 'New Spot')).toMatchObject({ live: true })
  })
  it('ignores malformed payloads and items without coordinates', () => {
    expect(mergeLivePlaces(pois, null, { project, anchor })).toHaveLength(3)
    expect(mergeLivePlaces(pois, { places: [{ name: 'X' }, { lat: 1 }] }, { project, anchor })).toHaveLength(3)
  })
})
