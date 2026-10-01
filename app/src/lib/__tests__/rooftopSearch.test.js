// app/src/lib/__tests__/rooftopSearch.test.js — every Wrigley rooftop club ships as a place and ⌘K finds it by name (item 13).
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { searchPlaces } from '../places.js'
import { buildPlaceRows } from '../poiFilter.js'

// the app directory, whether vitest runs from app/ or from the repo root with --root app
const APP = existsSync(`${process.cwd()}/public/world`) ? process.cwd() : `${process.cwd()}/app`

const clubs = JSON.parse(readFileSync(`${APP}/../pipeline/data/rooftops.json`, 'utf8')).clubs
const index = JSON.parse(readFileSync(`${APP}/public/world/pois-index.json`, 'utf8'))
describe('the rooftop clubs in ⌘K', () => {
  const rows = buildPlaceRows(index)
  it('each club is a Venues place, the first result for its own name', () => {
    const missed = clubs.filter((c) => searchPlaces(c.name, rows)[0]?.name !== c.name).map((c) => c.name)
    expect(missed).toEqual([])
    for (const c of clubs) expect(rows.find((r) => r.name === c.name).sub).toBe('Venues')
  })
  it('"rooftop" brings up the clubs', () => {
    expect(searchPlaces('rooftop', rows).filter((r) => /rooftop/i.test(r.name)).length).toBeGreaterThanOrEqual(6)
  })
})
