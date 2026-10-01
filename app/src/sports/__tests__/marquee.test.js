import { describe, it, expect } from 'vitest'
import { marqueeOutline, marqueeMessage, marqueeLayout, drawMarquee } from '../marquee.js'

const T = (iso) => Date.parse(iso)
const game = { id: 'g', sport: 'baseball', start: '2026-07-10T00:05:00Z', home: { abbr: 'CHC' }, away: { abbr: 'MIL' } }

describe('the Wrigley marquee', () => {
  it('outline: flat base, straight sides, scrolled shoulders and an arched crest at full height on the centreline', () => {
    const pts = marqueeOutline(10, 5.8)
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
    expect(Math.min(...xs)).toBeCloseTo(-5); expect(Math.max(...xs)).toBeCloseTo(5)
    expect(Math.min(...ys)).toBeCloseTo(0); expect(Math.max(...ys)).toBeCloseTo(5.8)
    const top = pts.reduce((a, p) => (p[1] > a[1] ? p : a))
    expect(Math.abs(top[0])).toBeLessThan(0.3)
    // the corners sit well below the crest: it is a shaped sign, not a box
    const corner = pts.filter((p) => Math.abs(Math.abs(p[0]) - 5) < 1e-6).reduce((a, p) => Math.max(a, p[1]), 0)
    expect(corner).toBeLessThan(5.8 * 0.7)
    expect(pts.length).toBeGreaterThan(30)
  })
  it('the board says GO CUBS GO by default, the game while it is on, and the next game when there is one', () => {
    expect(marqueeMessage(null, 0)).toEqual(['GO CUBS GO', 'WELCOME TO WRIGLEY'])
    expect(marqueeMessage({ state: 'live', game }, T(game.start) + 3e6)).toEqual(['GO CUBS GO', 'MIL @ CHC · TODAY'])
    expect(marqueeMessage({ state: 'postgame', game }, T(game.start) + 2e7)[0]).toBe('FINAL')
    const next = marqueeMessage({ state: 'idle', next: game }, T('2026-07-08T15:00:00Z'))
    expect(next[0]).toBe('GO CUBS GO')
    expect(next[1]).toMatch(/^NEXT GAME MIL /)
  })
  it('layout: the three lines of lettering sit above the LED board, top to bottom', () => {
    const L = marqueeLayout(1024, 594)
    expect(L.lines.map((l) => l.text)).toEqual(['WRIGLEY FIELD', 'HOME OF', 'CHICAGO CUBS'])
    for (let i = 1; i < L.lines.length; i++) expect(L.lines[i].y).toBeGreaterThan(L.lines[i - 1].y)
    expect(L.board.y).toBeGreaterThan(L.lines[2].y)
    expect(L.board.y + L.board.h).toBeLessThan(594)
  })
  it('draws the red sign, the pinstripe, the lettering and the board text (no logos)', () => {
    const calls = []
    const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => calls.push([k, ...a])), set: (t, k, v) => { t[k] = v; calls.push(['set', k, v]); return true } })
    drawMarquee(ctx, ['GO CUBS GO', 'WELCOME'], 1024, 594)
    const texts = calls.filter((c) => c[0] === 'fillText').map((c) => c[1])
    expect(texts).toEqual(expect.arrayContaining(['WRIGLEY FIELD', 'HOME OF', 'CHICAGO CUBS', 'GO CUBS GO', 'WELCOME']))
    expect(calls.some((c) => c[0] === 'set' && c[1] === 'fillStyle' && /^#9|^#a|^#b/i.test(c[2]))).toBe(true)
    expect(calls.some((c) => c[0] === 'stroke')).toBe(true)
  })
})
