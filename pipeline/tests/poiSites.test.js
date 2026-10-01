// pipeline/tests/poiSites.test.js — every website we can find for a place (OSM tags, then Wikidata P856).
import { describe, it, expect } from 'vitest'
import { siteFromTags, wikidataId, mergeSites, sitesFromEntities } from '../lib/poiSites.js'

describe('place websites', () => {
  it('reads website, contact:website, url and brand:website, in that order, normalising a missing scheme', () => {
    expect(siteFromTags({ website: 'https://a.com', url: 'https://b.com' })).toBe('https://a.com')
    expect(siteFromTags({ 'contact:website': 'c.com' })).toBe('https://c.com')
    expect(siteFromTags({ url: 'http://d.com' })).toBe('http://d.com')
    expect(siteFromTags({ 'brand:website': 'https://e.com' })).toBe('https://e.com')
    expect(siteFromTags({ name: 'x' })).toBeNull()
  })
  it("takes the brand Wikidata id first, then the place's own", () => {
    expect(wikidataId({ 'brand:wikidata': 'Q37158', wikidata: 'Q1' })).toBe('Q37158')
    expect(wikidataId({ wikidata: 'Q1' })).toBe('Q1')
    expect(wikidataId({ wikidata: 'nope' })).toBeNull()
  })
  it('fills a missing website from the Wikidata cache, never overwriting a mapped one', () => {
    const recs = [{ id: 'n1', tags: { website: 'https://mapped.com' }, qid: 'Q1' }, { id: 'n2', tags: {}, qid: 'Q2' }, { id: 'n3', tags: {}, qid: null }]
    const out = mergeSites(recs, { Q1: 'https://wd1.com', Q2: 'https://wd2.com' })
    expect(out.map((r) => r.tags.website)).toEqual(['https://mapped.com', 'https://wd2.com', undefined])
  })
  it('reads P856 (official website) from a wbgetentities response', () => {
    const res = { entities: { Q2: { claims: { P856: [{ mainsnak: { datavalue: { value: 'https://www.starbucks.com' } } }] } }, Q3: { claims: {} } } }
    expect(sitesFromEntities(res)).toEqual({ Q2: 'https://www.starbucks.com', Q3: null })
  })
})
