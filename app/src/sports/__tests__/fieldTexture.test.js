import { describe, it, expect } from 'vitest'
import { buildFieldArray, layoutFor, fieldSport, FIELD_TEX } from '../fieldTexture.js'

const fakeCanvas = (fill) => (W, H) => ({ getContext: () => new Proxy({ getImageData: () => ({ data: new Uint8ClampedArray(W * H * 4).fill(fill) }) }, { get: (t, k) => t[k] ?? (() => {}), set: () => true }) })
const F = { u0: -75, u1: 75, v0: -37.5, v1: 37.5, ring: [], origin: [0, 0], axis: [0, -1] }

describe('fieldTexture', () => {
  it('stacks one layer per slot, sized by quality', () => {
    const tex = buildFieldArray([{ slot: 0, frame: F, layout: 'football' }, { slot: 2, frame: F, layout: 'soccer' }], 'LOW', fakeCanvas(9))
    const [W, H] = FIELD_TEX.LOW
    expect([tex.image.width, tex.image.height, tex.image.depth]).toEqual([W, H, 3])
    expect(tex.image.data[0]).toBe(9)
    expect(tex.image.data[2 * W * H * 4]).toBe(9)
    expect(tex.image.data[W * H * 4]).toBe(0) // slot 1 unused
  })
  it('chooses the layout by venue and sport', () => {
    expect(layoutFor('wrigleyfield', 'baseball')).toBe('baseball-wrigley')
    expect(layoutFor('ratefield', 'baseball')).toBe('baseball-sox')
    expect(layoutFor('soldierfield', 'soccer')).toBe('soccer')
    expect(layoutFor('soldierfield', 'football')).toBe('football')
    expect(layoutFor('soldierfield', null)).toBe('football')
  })
  it('paints for the game in progress, or the next one within 36 h', () => {
    const now = Date.parse('2026-06-06T12:00:00Z')
    expect(fieldSport({ game: { sport: 'soccer' } }, now)).toBe('soccer')
    expect(fieldSport({ game: null, next: { sport: 'soccer', start: '2026-06-07T00:30:00Z' } }, now)).toBe('soccer')
    expect(fieldSport({ game: null, next: { sport: 'soccer', start: '2026-06-09T00:30:00Z' } }, now)).toBeNull()
    expect(fieldSport(undefined, now)).toBeNull()
  })
})
