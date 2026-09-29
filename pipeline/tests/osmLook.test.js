// pipeline/tests/osmLook.test.js
import { describe, it, expect } from 'vitest'
import { parseOsmColour, quantizeHex, lookFromOsmTags, osmStyleKey, applyOsmLooks } from '../lib/osmLook.js'
import { createStyleRegistry, MAX_STYLES } from '../lib/styles.js'
import { validateLook } from '../lib/looks.js'

describe('OSM looks (F11)', () => {
  it('parses hex (long and short) and colour words, case and spacing tolerant', () => {
    expect(parseOsmColour('#AABBCC')).toBe('#aabbcc')
    expect(parseOsmColour('#abc')).toBe('#aabbcc')
    expect(parseOsmColour(' Light Grey ')).toBe('#bdbdba')
    expect(parseOsmColour('red')).toBe('#8a3b30')
  })
  it('ignores junk colour and material tags', () => {
    for (const v of ['yes', '#ggg', 'red;white', '', undefined, 42]) expect(parseOsmColour(v)).toBeNull()
    expect(lookFromOsmTags({ 'building:material': 'wood' })).toBeNull()
    expect(lookFromOsmTags({ 'building:colour': 'yes', 'building:material': 'plastic' })).toBeNull()
    expect(lookFromOsmTags({})).toBeNull()
    expect(lookFromOsmTags(undefined)).toBeNull()
  })
  it('material alone picks a finish with its default colour; colour alone is a painted wall', () => {
    expect(lookFromOsmTags({ 'building:material': 'brick' })).toMatchObject({ finish: 'terracotta', base: quantizeHex('#8a4b3a') })
    expect(lookFromOsmTags({ 'building:material': 'glass' })).toMatchObject({ finish: 'glass' })
    expect(lookFromOsmTags({ 'building:colour': 'white' })).toMatchObject({ finish: 'concrete', base: quantizeHex('#f2f0ea') })
  })
  it('every produced look is a valid sourced look', () => {
    const l = lookFromOsmTags({ 'building:colour': '#336699', 'building:material': 'limestone' })
    expect(validateLook(l, 'osm')).toEqual([])
    expect(osmStyleKey(l)).toBe(`osm:limestone:${quantizeHex('#336699')}`)
  })
  it('quantizes colours so near-duplicates share a row', () => {
    expect(quantizeHex('#8a4b3a')).toBe(quantizeHex('#8b4c3b'))
    expect(quantizeHex('#ffffff')).toBe('#ffffff')
  })
  it('applyOsmLooks styles tagged plain buildings only, and never displaces hero rows', () => {
    const r = createStyleRegistry()
    r.add('willis', { material: 'black anodized aluminium', finish: 'metal', base: '#1c1b1a', glass: '#4a3a2c', mullion: '#121212', spandrel: '#1c1b1a', source: 'https://x.example' })
    const bs = [
      { tags: { 'building:colour': 'white' } },
      { tags: { 'building:colour': 'white' } },
      { hero: 'willis', styleIndex: 1, tags: { 'building:colour': 'red' } },
      { facadeOverride: 'sacred', tags: { 'building:material': 'brick' } },
      { tags: {} },
    ]
    expect(applyOsmLooks(bs, r, { enabled: true })).toEqual({ styled: 2, skipped: 0 })
    expect(bs[0].styleIndex).toBe(2); expect(bs[1].styleIndex).toBe(2)
    expect(bs[2].styleIndex).toBe(1); expect(bs[3].styleIndex).toBeUndefined(); expect(bs[4].styleIndex).toBeUndefined()
  })
  it('disabled (reverted) does nothing; a full palette counts skips', () => {
    const r = createStyleRegistry()
    const b = [{ tags: { 'building:colour': 'white' } }]
    expect(applyOsmLooks(b, r, { enabled: false })).toEqual({ styled: 0, skipped: 0 })
    for (let i = 1; i < MAX_STYLES; i++) r.add(`k${i}`, lookFromOsmTags({ 'building:colour': 'white' }))
    expect(applyOsmLooks([{ tags: { 'building:colour': '#123456' } }], r, { enabled: true })).toEqual({ styled: 0, skipped: 1 })
  })
})
