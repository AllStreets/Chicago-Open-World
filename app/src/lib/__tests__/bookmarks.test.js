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
})
