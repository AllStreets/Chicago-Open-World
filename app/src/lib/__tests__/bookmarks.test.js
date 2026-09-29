import { describe, it, expect } from 'vitest'
import { BOOKMARKS, bookmarkFromUrl, poseFromParam } from '../bookmarks.js'

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
    expect(BOOKMARKS.wellslake).toEqual({ position: [-380, 32, -412], target: [-495, 7, -412] })
    expect(BOOKMARKS.transit150).toEqual({ position: [215, 150, 660], target: [152, 8, 581] })
    expect(BOOKMARKS.transit1000).toEqual({ position: [900, 1000, 1400], target: [-175, 0, 86] })
    expect(BOOKMARKS.northside).toEqual({ position: [-1700, 400, -4270], target: [-2080, 8, -4773] })
    expect(VIEW_NAMES.wellslake).toBe('Tower 18 — the Loop L junction')
    expect(VIEW_ORDER.at(-1)).toBe('wellslake')
    expect(VIEW_NAMES.transit150).toBeUndefined() // test-only poses stay out of ⌘K
  })
})

describe('test-only ?pose=', () => {
  it('parses six finite numbers into a pose', () => {
    expect(poseFromParam('928,300,2460,928,10,2187')).toEqual({ position: [928, 300, 2460], target: [928, 10, 2187] })
  })
  it('rejects anything else', () => {
    for (const bad of [null, '', '1,2,3', '1,2,3,4,5,x', '1,2,3,4,5,6,7']) expect(poseFromParam(bad)).toBeNull()
  })
  it('wins over ?view= in bookmarkFromUrl', () => {
    expect(bookmarkFromUrl('?view=loop&pose=1,2,3,4,5,6')).toEqual({ position: [1, 2, 3], target: [4, 5, 6] })
    expect(bookmarkFromUrl('?view=loop')).toBe(BOOKMARKS.loop)
  })
})
