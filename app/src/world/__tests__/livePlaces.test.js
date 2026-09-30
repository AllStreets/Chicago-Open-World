// app/src/world/__tests__/livePlaces.test.js — live places join once, offline adds nothing (P4 Task 5).
import { describe, it, expect, beforeEach } from 'vitest'
import { loadLivePlaces, _resetLivePlaces } from '../livePlaces.js'
import { allTilePois, unregisterTilePois } from '../poiRegistry.js'

describe('live places', () => {
  beforeEach(() => { _resetLivePlaces(); unregisterTilePois('live') })
  it('offline (null) adds nothing and never throws', async () => {
    expect(await loadLivePlaces({ get: async () => null })).toBe(0)
  })
  it('adds an in-world place once per session, ignores out-of-world ones', async () => {
    const get = async (p) => (p.includes('nightlife') ? { places: [] } : { places: [{ id: 5, name: 'New Spot', lat: 41.8830, lon: -87.6280, amenity: 'bar' }, { id: 6, name: 'Far', lat: 42.5, lon: -87.6 }] })
    expect(await loadLivePlaces({ get })).toBe(1)
    expect(allTilePois().find((p) => p.n === 'New Spot')).toMatchObject({ live: true, c: 1 })
    expect(await loadLivePlaces({ get })).toBe(0) // once per session
  })
})
