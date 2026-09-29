import { describe, it, expect } from 'vitest'
import { loadCatalog, lineOrder, lineIdFor, operatorOf } from '../lib/transit/lines.js'

// Spec Addendum B.3 — copied verbatim; the catalog must match exactly.
const OFFICIAL = { red: '#c60c30', blue: '#00a1de', brown: '#62361b', green: '#009b3a', orange: '#f9461c', pink: '#e27ea6', purple: '#522398', yellow: '#f9e300' }
const METRA = ['up-n', 'up-nw', 'up-w', 'md-n', 'md-w', 'ncs', 'bnsf', 'hc', 'sws', 'ri', 'me']
const cat = loadCatalog()

describe('transit line catalog', () => {
  it('CTA lines carry the official colours, exactly', () => {
    for (const [id, hex] of Object.entries(OFFICIAL)) expect(cat.lines.find((l) => l.id === id)?.colour).toBe(hex)
  })
  it('every Metra line is the one Metra blue, at a dimmer glow than CTA', () => {
    for (const id of METRA) {
      const l = cat.lines.find((x) => x.id === id)
      expect(l.colour).toBe('#005596'); expect(l.operator).toBe('metra'); expect(l.glow).toBeLessThan(1)
    }
    for (const id of Object.keys(OFFICIAL)) expect(cat.lines.find((l) => l.id === id).glow).toBe(1)
  })
  it('19 unique lines in catalog order, each citing a source', () => {
    expect(cat.lines).toHaveLength(19)
    expect(new Set(cat.lines.map((l) => l.id)).size).toBe(19)
    expect(lineOrder(cat)).toEqual([...Object.keys(OFFICIAL), ...METRA])
    for (const l of cat.lines) expect(cat.sources[l.source]).toMatch(/https?:\/\//)
    for (const j of cat.junctions) expect(cat.sources[j.source]).toMatch(/https?:\/\//)
  })
  it('recognises CTA and Metra relations by ref or name, and nothing else', () => {
    expect(lineIdFor({ network: 'CTA', ref: 'Red' }, cat)).toBe('red')
    expect(lineIdFor({ operator: 'Chicago Transit Authority', name: 'CTA Brown Line: Kimball => Loop' }, cat)).toBe('brown')
    expect(lineIdFor({ network: 'CTA', name: 'Purple Line Express' }, cat)).toBe('purple')
    expect(lineIdFor({ network: 'Metra', ref: 'UP-NW' }, cat)).toBe('up-nw')
    expect(lineIdFor({ network: 'Metra', name: 'Union Pacific Northwest Line' }, cat)).toBe('up-nw')
    expect(lineIdFor({ network: 'Metra', name: 'Union Pacific North Line' }, cat)).toBe('up-n')
    expect(lineIdFor({ network: 'Metra', ref: 'MD W' }, cat)).toBe('md-w')
    expect(lineIdFor({ operator: 'Metra', name: 'Metra Electric District: Millennium => University Park' }, cat)).toBe('me')
    expect(lineIdFor({ network: 'Amtrak', ref: 'Hiawatha' }, cat)).toBeNull()
    expect(lineIdFor({ network: 'NICTD', name: 'South Shore Line' }, cat)).toBeNull()
    expect(operatorOf({ network: 'Metra' })).toBe('metra')
    expect(operatorOf({})).toBeNull()
  })
  it('station looks are valid V2 looks (shared palette rows station-cta / station-metra)', async () => {
    const { validateLook } = await import('../lib/looks.js')
    expect(validateLook(cat.stationLooks.cta, 'station-cta')).toEqual([])
    expect(validateLook(cat.stationLooks.metra, 'station-metra')).toEqual([])
  })
})
