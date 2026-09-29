import { describe, it, expect } from 'vitest'
import { simScore, periodLabel, boardLines, drawBoard, ordinal, setScoreboard } from '../scoreboard.js'
import { useSports } from '../sportsStore.js'

const T = (iso) => Date.parse(iso)
const sim = { id: 's1', sport: 'baseball', start: '2026-07-10T00:05:00Z', simulated: true, home: { abbr: 'CHC', score: 6 }, away: { abbr: 'MIL', score: 2 } }
const real = { id: 'r1', sport: 'baseball', start: '2026-06-05T18:20:00Z', home: { abbr: 'CHC', score: 5 }, away: { abbr: 'NYM', score: 3 } }
const realLive = { ...real, id: 'r2', home: { abbr: 'CHC', score: null }, away: { abbr: 'NYM', score: null } }
const W = { key: 'wrigleyfield', name: 'Wrigley Field' }

describe('scoreboard', () => {
  it('the simulated score only ever rises and ends at the final', () => {
    let prev = { home: 0, away: 0 }
    for (let m = 0; m <= 180; m += 5) {
      const s = simScore(sim, T('2026-07-10T00:05:00Z') + m * 60000)
      expect(s.home).toBeGreaterThanOrEqual(prev.home); expect(s.away).toBeGreaterThanOrEqual(prev.away); prev = s
    }
    expect(simScore(sim, T('2026-07-10T03:05:00Z'))).toEqual({ home: 6, away: 2 })
    expect(simScore(realLive, T('2026-06-05T19:00:00Z'))).toBeNull()
  })
  it('periods: innings, quarters, periods, minutes; FINAL after', () => {
    const at = (min, g = sim) => periodLabel(g, T(g.start) + min * 60000, 'live')
    expect(at(1)).toBe('TOP 1ST'); expect(at(95)).toBe('BOT 5TH')
    expect(at(100, { ...sim, sport: 'football' })).toBe('Q3')
    expect(at(10, { ...sim, sport: 'hockey' })).toBe('P1')
    expect(at(60, { ...sim, sport: 'soccer' })).toBe("50'")
    expect(periodLabel(sim, 0, 'postgame')).toBe('FINAL')
    expect(ordinal(2)).toBe('2nd'); expect(ordinal(3)).toBe('3rd'); expect(ordinal(11)).toBe('11th')
  })
  it('the board shows the data: real finals, simulated running score, a dash when unknown', () => {
    expect(boardLines(W, { state: 'postgame', game: real }, T('2026-06-05T22:00:00Z')).rows).toEqual([{ abbr: 'NYM', score: 3 }, { abbr: 'CHC', score: 5 }])
    expect(boardLines(W, { state: 'live', game: realLive }, T('2026-06-05T19:00:00Z')).rows).toEqual([{ abbr: 'NYM', score: null }, { abbr: 'CHC', score: null }])
    const mid = boardLines(W, { state: 'live', game: sim }, T('2026-07-10T01:35:00Z'))
    expect(mid.rows[1].score).toBe(simScore(sim, T('2026-07-10T01:35:00Z')).home)
    const idle = boardLines(W, { state: 'idle', game: null, next: sim }, T('2026-07-09T12:00:00Z'))
    expect(idle).toMatchObject({ title: 'WRIGLEY FIELD', rows: [] })
    expect(idle.status).toBe('NEXT MIL · TONIGHT 7:05 PM') // same Chicago date: said as tonight (V5 review #1)
  })
  it('setScoreboard (Phase 5) overrides the numbers until cleared', () => {
    setScoreboard('wrigleyfield', { home: 9, away: 1, status: 'BOT 8TH' })
    const lines = boardLines(W, { state: 'live', game: realLive }, T('2026-06-05T19:00:00Z'), useSports.getState().boardOverrides.wrigleyfield)
    expect(lines).toMatchObject({ rows: [{ abbr: 'NYM', score: 1 }, { abbr: 'CHC', score: 9 }], status: 'BOT 8TH' })
    setScoreboard('wrigleyfield', null)
    expect(useSports.getState().boardOverrides.wrigleyfield).toBeNull()
  })
  it('draws abbreviations, scores and a dash', () => {
    const calls = []
    const ctx = new Proxy({}, { get: (_, k) => (...a) => calls.push([k, ...a]), set: () => true })
    drawBoard(ctx, { title: 'WRIGLEY FIELD', rows: [{ abbr: 'NYM', score: 3 }, { abbr: 'CHC', score: null }], status: 'FINAL' }, 'manual', 1024, 512)
    const txt = calls.filter((c) => c[0] === 'fillText').map((c) => c[1])
    expect(txt).toEqual(expect.arrayContaining(['NYM', '3', 'CHC', '–', 'FINAL']))
  })
})
