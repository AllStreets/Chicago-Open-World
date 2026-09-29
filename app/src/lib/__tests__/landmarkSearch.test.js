import { describe, it, expect } from 'vitest'
import heroesData from '../../../../pipeline/data/heroes.json'
import { buildPlaces, searchPlaces } from '../places.js'

const V6 = ['buckingham', 'cloudgate', 'navypier', 'grandballroom', 'riverwalk', 'artinstitute', 'crownfountain', 'lurie', 'bpbridge', 'picasso', 'flamingo', 'culturalcenter', 'unionstation', 'mart', 'lincolnparkzoo', 'conservatory']
const heroes = heroesData.heroes.filter((h) => V6.includes(h.key))
const manifest = {
  landmarks: [
    ...heroes.map((h, i) => ({ key: h.key, name: h.name, aliases: h.aliases, x: i * 100, z: 0, top: 20 })),
    { key: 'bridge-dusable', name: 'DuSable Bridge', aliases: ['Michigan Avenue Bridge'], x: 287, z: -757, top: 8 },
  ],
  tallest: [],
}
const places = buildPlaces(manifest, {})

describe('⌘K finds every V6 landmark (E9)', () => {
  it('by its name, first', () => {
    expect(heroes).toHaveLength(16)
    for (const h of heroes) expect(searchPlaces(h.name.toLowerCase(), places)[0].name, h.name).toBe(h.name)
  })
  it('by each alias, in the top three', () => {
    for (const h of heroes) for (const a of h.aliases) expect(searchPlaces(a.toLowerCase(), places).slice(0, 3).map((p) => p.name), a).toContain(h.name)
  })
  it('bridges by their old names too', () => {
    expect(searchPlaces('michigan avenue bridge', places)[0].name).toBe('DuSable Bridge')
  })
})
