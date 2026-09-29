import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const H = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes
const S = H.filter((h) => h.sports)

describe('heroes.json sports venues', () => {
  it('five venues with unique slots 0–4 and sourced capacities', () => {
    expect(S.map((h) => [h.key, h.sports.slot]).sort((a, b) => a[1] - b[1])).toEqual([['soldierfield', 0], ['wrigleyfield', 1], ['ratefield', 2], ['unitedcenter', 3], ['wintrust', 4]])
    for (const h of S) { expect(h.sports.capacity).toBeGreaterThan(5000); expect(h.sports.source).toMatch(/\w/); expect(h.sports.teams.length).toBeGreaterThan(0) }
  })
  it('open-air venues are exactly those with a venue builder spec', () => {
    for (const h of S) expect(Boolean(h.venue)).toBe(h.sports.kind !== 'arena')
  })
})
