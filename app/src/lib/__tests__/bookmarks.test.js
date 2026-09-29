import { describe, it, expect } from 'vitest'
import { BOOKMARKS, bookmarkFromUrl } from '../bookmarks.js'

describe('bookmarks', () => {
  it('defaults to streeterville', () => {
    expect(bookmarkFromUrl('')).toBe(BOOKMARKS.streeterville)
    expect(bookmarkFromUrl('?view=nope')).toBe(BOOKMARKS.streeterville)
  })
  it('reads ?view=', () => {
    expect(bookmarkFromUrl('?view=loop')).toBe(BOOKMARKS.loop)
    expect(bookmarkFromUrl('?view=hancock')).toBe(BOOKMARKS.hancock)
    expect(bookmarkFromUrl('?view=willis')).toBe(BOOKMARKS.willis)
    expect(bookmarkFromUrl('?view=wabash')).toBe(BOOKMARKS.wabash)
    for (const k of ['wrigleyville', 'lincolnpark', 'westloop', 'pilsen', 'soldierfield', 'navypier']) expect(BOOKMARKS[k]).toBeTruthy()
  })
  it('every bookmark is above minimum altitude', () => {
    for (const b of Object.values(BOOKMARKS)) expect(b.position[1]).toBeGreaterThanOrEqual(30)
  })
  it('transit poses exist; Tower 18 is a named view people can step to', async () => {
    const { VIEW_NAMES } = await import('../places.js')
    const { VIEW_ORDER } = await import('../views.js')
    expect(BOOKMARKS.wellslake).toEqual({ position: [-420, 30, -335], target: [-495, 7, -412] })
    expect(BOOKMARKS.transit150).toEqual({ position: [40, 150, 330], target: [-175, 8, 86] })
    expect(BOOKMARKS.transit1000).toEqual({ position: [900, 1000, 1400], target: [-175, 0, 86] })
    expect(BOOKMARKS.northside).toEqual({ position: [-1700, 400, -4270], target: [-2080, 8, -4773] })
    expect(VIEW_NAMES.wellslake).toBe('Tower 18 — the Loop L junction')
    expect(VIEW_ORDER.at(-1)).toBe('wellslake')
    expect(VIEW_NAMES.transit150).toBeUndefined() // test-only poses stay out of ⌘K
  })
})
