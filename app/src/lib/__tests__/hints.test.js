// app/src/lib/__tests__/hints.test.js
import { describe, it, expect } from 'vitest'
import { ALL_HINTS, hintWidth, hintMaxWidth, fitHints } from '../hints.js'

const total = (hs) => 32 + hs.reduce((s, h) => s + hintWidth(h), 0)
describe('hint bar fitting', () => {
  it('every feature key has a hint', () => {
    for (const k of ['T', 'G', 'M', 'B', 'J']) expect(ALL_HINTS.some((h) => h.k === k)).toBe(true)
  })
  it('never exceeds the space between the side columns', () => {
    for (const w of [1091, 1280, 1422, 1440, 1600]) expect(total(fitHints(ALL_HINTS, hintMaxWidth(w)))).toBeLessThanOrEqual(hintMaxWidth(w))
  })
  it('keeps the essentials and the main feature keys at the tightest non-compact layout (1280)', () => {
    const keys = fitHints(ALL_HINTS, hintMaxWidth(1280)).map((h) => h.k)
    for (const k of ['↑↓←→', 'Double-click', '⌘K', '?', 'T', 'G', 'M']) expect(keys).toContain(k)
  })
  it('keeps display order', () => {
    expect(fitHints(ALL_HINTS, 5000)).toEqual(ALL_HINTS)
  })
})
