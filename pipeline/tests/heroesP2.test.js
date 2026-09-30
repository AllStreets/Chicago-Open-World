// pipeline/tests/heroesP2.test.js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { WORLD_BBOX } from '../lib/sources.js'

const heroes = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes
// Ruling (P3 Task 7): the Soldier Field colonnades are a refinement of the soldierfield venue (fluted Doric columns),
// not a hero of their own; the three Lincoln Park statues are three keys, so each lands in its own tile and search entry.
const P2 = ['maggiedaley', 'natureboardwalk', 'rookery', 'monadnock', 'marquette', 'carbidecarbon', 'palmerhouse', 'oldstpats', 'holyname', 'newberry', 'lincolnstatues', 'grantstatue', 'goethestatue', 'northavebeach', 'oakstbeach', 'northerlyisland', 'harborlighthouse', 'twelfthbeach', 'pingtom', 'chinatowngate', 'pilsenmurals']
const inBox = (lat, lon) => lat >= WORLD_BBOX.s && lat <= WORLD_BBOX.n && lon >= WORLD_BBOX.w && lon <= WORLD_BBOX.e

describe('P2 landmark registry', () => {
  it('has every P2 key exactly once', () => {
    for (const k of P2) expect(heroes.filter((h) => h.key === k)).toHaveLength(1)
  })
  it('every entry cites a source and has a ⌘K alias', () => {
    for (const k of P2) {
      const h = heroes.find((x) => x.key === k)
      expect(h.source).toMatch(/^https?:\/\//)
      expect(h.aliases?.length ?? 0).toBeGreaterThanOrEqual(1)
    }
  })
  it('synthetic entries are inside the world unless flagged offshore', () => {
    for (const k of P2) {
      const h = heroes.find((x) => x.key === k)
      if (!h.match?.synthetic) continue
      if (h.offshore) { expect(h.match.lon).toBeGreaterThan(WORLD_BBOX.e - 0.01); continue }
      expect(inBox(h.match.lat, h.match.lon)).toBe(true)
    }
  })
  it('OSM matches carry the element type (H3)', () => {
    for (const k of P2) {
      const h = heroes.find((x) => x.key === k)
      if (h.match?.osmId) expect(['way', 'relation']).toContain(h.match.osmType)
    }
  })
})

describe('P2 registry — rulings', () => {
  it('the Soldier Field colonnades are fluted Doric columns on the venue, findable by name', () => {
    const sf = heroes.find((x) => x.key === 'soldierfield')
    expect(sf.venue.colonnade.doric).toBe(true)
    expect(sf.aliases).toContain('Soldier Field colonnades')
  })
})
