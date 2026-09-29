import { describe, it, expect } from 'vitest'
import { NEIGHBORHOODS, buildPlaces, searchPlaces } from '../places.js'
const manifest = { landmarks: [{ key: 'willis', name: 'Willis Tower', x: -670, z: 350, top: 527 }, { key: 'wrigleyfield', name: 'Wrigley Field', x: -2279, z: -7372, top: 24 }], tallest: [{ key: 'w1', name: 'River Point', x: -800, z: -300, top: 223 }] }
const bookmarks = { streeterville: { position: [1, 50, 1], target: [0, 0, 0] } }
describe('places', () => {
  const places = buildPlaces(manifest, bookmarks)
  it('includes landmarks, tall buildings, neighbourhoods and views', () => {
    expect(NEIGHBORHOODS.length).toBeGreaterThanOrEqual(20)
    const kinds = new Set(places.map((p) => p.kind))
    expect([...kinds].sort()).toEqual(['landmark', 'neighborhood', 'view'])
    expect(places.every((p) => p.pose && p.pose.position && p.pose.target)).toBe(true)
  })
  it('prefix beats substring; typos by subsequence still match', () => {
    expect(searchPlaces('wrig', places)[0].name).toBe('Wrigley Field')
    expect(searchPlaces('wllis', places)[0].name).toBe('Willis Tower')
  })
  it('empty query returns curated defaults, nonsense returns nothing', () => {
    expect(searchPlaces('', places).length).toBeGreaterThan(5)
    expect(searchPlaces('zzqxv', places)).toEqual([])
  })
})
