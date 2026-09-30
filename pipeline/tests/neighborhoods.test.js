// pipeline/tests/neighborhoods.test.js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const curated = JSON.parse(readFileSync(new URL('../data/neighborhoods.curated.json', import.meta.url), 'utf8'))
describe('curated neighbourhoods', () => {
  it('~20 zones, each with character, vibe and at least one source', () => {
    expect(curated.length).toBeGreaterThanOrEqual(18); expect(curated.length).toBeLessThanOrEqual(24)
    for (const z of curated) {
      expect(z.character.length).toBeGreaterThan(20); expect(z.vibe.length).toBeGreaterThanOrEqual(2)
      expect(z.sources.length).toBeGreaterThanOrEqual(1)
      for (const s of z.sources) { expect(s.url).toMatch(/^https?:\/\//); expect(s.asOf).toMatch(/^\d{4}-\d{2}/) }
    }
  })
  it('every rent figure carries its own source and date', () => {
    for (const z of curated) if (z.rent && (z.rent.studio || z.rent.oneBr || z.rent.twoBr)) { expect(z.rent.source).toBeTruthy(); expect(z.rent.asOf).toBeTruthy() }
  })
})
