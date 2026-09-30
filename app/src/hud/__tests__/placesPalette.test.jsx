// app/src/hud/__tests__/placesPalette.test.jsx — places from ⌘K (P4 Task 5): filters as commands, places by name.
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../../state/store.js'
import { placeCommands } from '../../lib/paletteSources.js'
import { buildPlaceRows } from '../../lib/poiFilter.js'

describe('places in ⌘K', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('offers place filters and finds a named place', () => {
    const rows = buildPlaceRows([['n1', 'Green Mill Cocktail Lounge', 4, -2600, -9000, 't']], ['food', 'drinks', 'coffee', 'nightlife', 'venues'])
    expect(rows[0]).toMatchObject({ kind: 'place', name: 'Green Mill Cocktail Lounge', sub: 'Venues' })
  })
  it('Show places / Hide places / Show only: Bars', () => {
    const c = placeCommands()
    const run = (name) => c.find((x) => x.name === name).run()
    run('Show places'); expect(useStore.getState().placesOn).toBe(true)
    run('Show only: Bars'); expect(useStore.getState().poiCats).toEqual(['drinks']); expect(useStore.getState().placesOn).toBe(true)
    run('Hide places'); expect(useStore.getState().placesOn).toBe(false)
    expect(c.filter((x) => x.name.startsWith('Show only:'))).toHaveLength(10)
  })
})
