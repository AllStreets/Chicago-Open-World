// app/src/lib/__tests__/searchCoverage.test.js — ⌘K finds everything we add (user, 2026-09-30): every landmark in the
// shipped manifest is the first or near-first result for its own name, and for each of its aliases.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { buildPlaces, searchPlaces } from '../places.js'
import { BOOKMARKS } from '../bookmarks.js'

const APP = existsSync(`${process.cwd()}/public/world`) ? process.cwd() : `${process.cwd()}/app` // run from app/ or the repo root
const manifest = JSON.parse(readFileSync(`${APP}/public/world/manifest.json`, 'utf8')) // the shipped world (tests run in app/)
describe('search coverage', () => {
  const all = buildPlaces(manifest, BOOKMARKS)
  it('every manifest landmark is found by its name and each alias (top 5)', () => {
    const missed = []
    for (const l of manifest.landmarks) for (const q of [l.name, ...(l.aliases ?? [])]) {
      if (!searchPlaces(q, all).slice(0, 5).some((r) => r.name === l.name)) missed.push(`${l.key}: "${q}"`)
    }
    expect(missed).toEqual([])
  })
  it('Flexport Chicago is the first result for "flexport" and for "333 north green"', () => {
    expect(searchPlaces('flexport', all)[0].name).toMatch(/Flexport/)
    expect(searchPlaces('333 north green', all)[0].name).toMatch(/Flexport/)
  })
})
