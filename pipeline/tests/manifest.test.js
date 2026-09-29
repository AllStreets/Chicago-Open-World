// pipeline/tests/manifest.test.js
import { describe, it, expect } from 'vitest'
import { MANIFEST_VERSION, manifestStamp, sortCacheFiles } from '../lib/manifest.js'

describe('reproducible builds (H4)', () => {
  it('orders cache chunks numerically and ignores other kinds', () => {
    const names = ['osm-water-10.json', 'osm-parks-0.json', 'osm-water-2.json', 'osm-water-0.json', 'footprints-1.json']
    expect(sortCacheFiles(names, 'osm-water-')).toEqual(['osm-water-0.json', 'osm-water-2.json', 'osm-water-10.json'])
    expect(sortCacheFiles(['footprints-10.json', 'footprints-9.json'], 'footprints-')).toEqual(['footprints-9.json', 'footprints-10.json'])
  })
  it('writes no timestamp unless asked (two builds are byte-identical)', () => {
    expect(manifestStamp({})).toEqual({})
    expect(manifestStamp({ CHI_BUILD_STAMP: '1' }, () => new Date('2026-09-29T12:00:00Z'))).toEqual({ generatedAt: '2026-09-29T12:00:00.000Z' })
  })
  it('V3 tile format is manifest v6', () => {
    expect(MANIFEST_VERSION).toBe(6)
  })
})
