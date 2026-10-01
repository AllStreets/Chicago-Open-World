// pipeline/tests/osmOverrides.test.js — sourced building:colour / building:material for notable buildings OSM leaves
// untagged (Fulton Market fidelity), merged before the OSM looks are applied; OSM's own tags win.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { applyTagOverrides } from '../lib/osmLook.js'

const overrides = JSON.parse(readFileSync(new URL('../data/osm-tag-overrides.json', import.meta.url), 'utf8'))
describe('OSM tag overrides', () => {
  it('fills a missing colour/material from the override, never replacing a mapped tag', () => {
    const bs = [{ id: 'w1', osmId: 1, tags: { building: 'yes' } }, { id: 'w2', osmId: 2, tags: { 'building:colour': '#111111' } }]
    const n = applyTagOverrides(bs, { w1: { 'building:colour': '#7a4a3a', 'building:material': 'brick', source: 'x' }, w2: { 'building:colour': '#222222', source: 'y' } })
    expect(bs[0].tags['building:colour']).toBe('#7a4a3a'); expect(bs[0].tags['building:material']).toBe('brick')
    expect(bs[1].tags['building:colour']).toBe('#111111')
    expect(n).toBe(1)
  })
  it('every override names its building and cites a source', () => {
    for (const [ref, o] of Object.entries(overrides.buildings)) {
      expect(ref).toMatch(/^[wr]\d+$/)
      expect(o.name?.length, ref).toBeGreaterThan(2)
      expect(o.source, ref).toMatch(/^https?:\/\//)
      expect(o['building:colour'] ?? o['building:material'], ref).toBeTruthy()
    }
  })
})
