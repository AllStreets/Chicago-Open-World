// app/src/world/__tests__/poiRegistry.test.js — tiles hand their places in and take them back (P4 Task 5).
import { describe, it, expect } from 'vitest'
import { registerTilePois, unregisterTilePois, allTilePois } from '../poiRegistry.js'

describe('poi registry', () => {
  it('collects the places of loaded tiles and forgets unloaded ones', () => {
    registerTilePois('t:0_0', [{ id: 'n1' }]); registerTilePois('t:1_0', [{ id: 'n2' }, { id: 'n3' }])
    expect(allTilePois().map((p) => p.id).sort()).toEqual(['n1', 'n2', 'n3'])
    unregisterTilePois('t:0_0')
    expect(allTilePois().map((p) => p.id).sort()).toEqual(['n2', 'n3'])
    registerTilePois('t:2_0', []) // a tile without places changes nothing
    expect(allTilePois()).toHaveLength(2)
    unregisterTilePois('t:1_0')
  })
})
