import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { styleIndex } from '../lib/styles.js'

export const V6_STYLE_KEYS = ['georgia-pink-marble', 'seahorse-bronze', 'chicago-bridge-steel', 'grid-deck-steel', 'sidewalk-concrete', 'pit-concrete',
  'tender-limestone', 'tender-glass', 'bedford-limestone', 'bedford-limestone-relief', 'lamp-post-black', 'lantern-warm', 'nav-red',
  'crown-glass-block', 'black-granite', 'lurie-hedge', 'lurie-dark-plate', 'lurie-light-plate', 'bp-deck-wood', 'gehry-stainless',
  'aic-lion-bronze', 'aic-plinth-granite', 'modern-wing-white', 'corten', 'calder-red', 'tiffany-glass', 'healy-millet-glass',
  'union-limestone', 'mart-limestone', 'navy-pier-brick', 'ballroom-dome', 'riverwalk-granite', 'conservatory-glass']

describe('V6 style rows', () => {
  const rows = JSON.parse(readFileSync(new URL('../data/styles.json', import.meta.url), 'utf8')).styles
  it('every V6 key has a sourced colour and a palette index', () => {
    for (const k of V6_STYLE_KEYS) {
      const r = rows.find((x) => x.key === k)
      expect(r, k).toBeTruthy()
      expect(r.base, k).toMatch(/^#[0-9a-f]{6}$/i)
      expect(r.source, k).toMatch(/\S{8,}/)
      expect(styleIndex(k), k).toBeGreaterThan(0)
    }
  })
})

describe('V6 style rows keep the build palette order', () => {
  it('styleIndex agrees with the registry build-world builds (heroes, then V6 materials, then OSM looks)', async () => {
    const { createStyleRegistry, addMaterialStyles, materialRows } = await import('../lib/styles.js')
    const heroes = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes
    const reg = createStyleRegistry()
    for (const h of heroes) if (h.look) reg.add(h.key, h.look)
    addMaterialStyles(reg, materialRows())
    reg.add('osm-something', { finish: 'concrete', base: '#808080', glass: '#808080', mullion: '#808080', spandrel: '#808080' })
    for (const k of V6_STYLE_KEYS) expect(reg.indexOf(k), k).toBe(styleIndex(k))
    expect(() => styleIndex('no-such-style')).toThrow(/no-such-style/)
  })
})
