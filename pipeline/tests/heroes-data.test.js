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
  // E3-0/E3-1: the United Center's guide board stands on the modelled roof crown, with its sources and the label
  it('only the United Center has a crown, sourced, labelled a guide display, on its modelled roof top', () => {
    expect(S.filter((h) => h.sports.crown).map((h) => h.key)).toEqual(['unitedcenter'])
    const uc = S.find((h) => h.key === 'unitedcenter'), c = uc.sports.crown, dome = uc.crowns.find((x) => x.type === 'stepdome')
    expect(c.roofM).toBeCloseTo(dome.base + dome.steps.reduce((s, x) => s + x.rise, 0) + dome.domeRise, 6)
    expect(c.guideDisplay).toBe(true)
    expect(c.sources.length).toBeGreaterThanOrEqual(2)
    expect(c.note).toMatch(/not a real fixture/)
    expect(c.ribbon.topM).toBeLessThanOrEqual(uc.heightM)
    expect(c.faceM[0]).toBeLessThan(2 * dome.steps[0].inset + 100) // well inside the 165 × 124 m roof
  })
})

describe('stadium night lights', () => {
  const sf = H.find((h) => h.key === 'soldierfield').venue, rf = H.find((h) => h.key === 'ratefield').venue
  it('Soldier Field has rim light rows on both long sides', () => {
    expect(sf.rimLights.some((r) => r.from > 0)).toBe(true)
    expect(sf.rimLights.some((r) => r.to < 0)).toBe(true)
  })
  it('Rate Field has rim rows on the upper-deck roof and towers at least 20 m', () => {
    expect(rf.rimLights.length).toBe(2)
    for (const l of rf.lights) expect(l.h).toBeGreaterThanOrEqual(20)
  })
})
