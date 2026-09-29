import { describe, it, expect } from 'vitest'
import { gameState, gameWindow, nextGame, resultDay, isVoid } from '../gameState.js'

const T = (iso) => Date.parse(iso)
const G = (o) => ({ id: o.id ?? o.start, teams: ['cubs'], results: {}, sport: 'baseball', league: 'mlb', venue: 'wrigleyfield', status: 'STATUS_SCHEDULED', state: 'pre', home: {}, away: {}, ...o })
const at = (venue, iso, games) => gameState(venue, T(iso), games)

describe('gameState', () => {
  const night = G({ start: '2026-07-10T00:05:00Z' }) // Thu 9 Jul, 19:05 CDT
  it('idle → pregame (2 h before) → live → postgame (1 h) → idle', () => {
    expect(at('wrigleyfield', '2026-07-09T21:30:00Z', [night]).state).toBe('idle')
    expect(at('wrigleyfield', '2026-07-09T23:00:00Z', [night]).state).toBe('pregame')
    expect(at('wrigleyfield', '2026-07-10T01:00:00Z', [night])).toMatchObject({ state: 'live', game: night })
    expect(at('wrigleyfield', '2026-07-10T03:30:00Z', [night]).state).toBe('postgame')
    expect(at('wrigleyfield', '2026-07-10T04:30:00Z', [night])).toMatchObject({ state: 'idle', game: null })
    expect(at('ratefield', '2026-07-10T01:00:00Z', [night]).state).toBe('idle')
  })
  it('each sport has its own length', () => {
    const bears = G({ teams: ['bears'], sport: 'football', venue: 'soldierfield', start: '2026-10-04T17:00:00Z' })
    expect(gameWindow(bears).end - gameWindow(bears).start).toBe(195 * 60000)
    expect(at('soldierfield', '2026-10-04T20:10:00Z', [bears]).state).toBe('live')
    expect(at('soldierfield', '2026-10-04T20:20:00Z', [bears]).state).toBe('postgame')
  })
  it('postponed and cancelled games never light a venue', () => {
    for (const status of ['STATUS_POSTPONED', 'STATUS_CANCELED']) {
      const g = { ...night, status, state: 'post', results: { cubs: 'W' } }
      expect(isVoid(g)).toBe(true)
      expect(at('wrigleyfield', '2026-07-10T01:00:00Z', [g])).toMatchObject({ state: 'idle', winDay: false })
      expect(at('wrigleyfield', '2026-07-10T04:00:00Z', [g]).winDay).toBe(false)
      expect(nextGame('wrigleyfield', T('2026-07-09T12:00:00Z'), [g])).toBeNull()
    }
  })
  it('live beats pregame beats postgame at a shared venue', () => {
    const g1 = G({ start: '2026-07-11T18:20:00Z' }), g2 = G({ start: '2026-07-11T23:40:00Z' })
    expect(at('wrigleyfield', '2026-07-11T21:30:00Z', [g1, g2])).toMatchObject({ state: 'postgame', game: g1 })
    expect(at('wrigleyfield', '2026-07-11T22:00:00Z', [g1, g2])).toMatchObject({ state: 'pregame', game: g2 })
    expect(at('wrigleyfield', '2026-07-11T23:50:00Z', [g1, g2])).toMatchObject({ state: 'live', game: g2 })
    const bulls = G({ teams: ['bulls'], sport: 'basketball', venue: 'unitedcenter', start: '2026-11-03T01:00:00Z' })
    const hawks = G({ teams: ['blackhawks'], sport: 'hockey', venue: 'unitedcenter', start: '2026-11-04T01:30:00Z' })
    expect(at('unitedcenter', '2026-11-03T02:00:00Z', [bulls, hawks]).game).toBe(bulls)
    expect(at('unitedcenter', '2026-11-04T02:00:00Z', [bulls, hawks]).game).toBe(hawks)
  })
  it('nextGame is the earliest future game at the venue', () => {
    const a = G({ start: '2026-07-12T18:20:00Z' }), b = G({ start: '2026-07-13T00:05:00Z' })
    expect(nextGame('wrigleyfield', T('2026-07-11T00:00:00Z'), [b, a])).toBe(a)
    expect(nextGame('wrigleyfield', T('2026-07-14T00:00:00Z'), [a, b])).toBeNull()
  })
})

describe('Cubs W / L days', () => {
  const away = G({ venue: null, start: '2026-04-04T23:10:00Z', results: { cubs: 'W' } }) // Sat 4 Apr, 18:10 CDT, away
  it('winDay follows the Chicago date across DST and host time zones', () => {
    expect(at('wrigleyfield', '2026-04-05T01:00:00Z', [away]).winDay).toBe(false) // still playing
    expect(at('wrigleyfield', '2026-04-05T03:00:00Z', [away]).winDay).toBe(true)  // 22:00 CDT
    expect(at('wrigleyfield', '2026-04-05T04:59:00Z', [away]).winDay).toBe(true)  // 23:59 CDT
    expect(at('wrigleyfield', '2026-04-05T05:01:00Z', [away]).winDay).toBe(false) // 00:01 CDT, next date
    const spring = G({ start: '2026-03-08T18:05:00Z', results: { cubs: 'W' } })     // DST starts that morning
    expect(resultDay('cubs', T('2026-03-09T04:59:00Z'), [spring])).toBe('W')
    expect(resultDay('cubs', T('2026-03-09T05:01:00Z'), [spring])).toBeNull()
    const fall = G({ start: '2026-11-01T19:00:00Z', results: { cubs: 'W' } })       // DST ends that morning (CST, −6 h)
    expect(resultDay('cubs', T('2026-11-02T05:59:00Z'), [fall])).toBe('W')
    expect(resultDay('cubs', T('2026-11-02T06:01:00Z'), [fall])).toBeNull()
  })
  it('a loss is an L day, and the latest finished game of a doubleheader decides', () => {
    const g1 = G({ start: '2026-07-11T18:20:00Z', results: { cubs: 'W' } }), g2 = G({ start: '2026-07-11T23:40:00Z', results: { cubs: 'L' } })
    expect(at('wrigleyfield', '2026-07-11T22:00:00Z', [g1, g2])).toMatchObject({ winDay: true, lossDay: false })
    expect(at('wrigleyfield', '2026-07-12T03:00:00Z', [g1, g2])).toMatchObject({ winDay: false, lossDay: true })
  })
  it('a Crosstown win counts for the Cubs', () => {
    const x = G({ teams: ['cubs', 'whitesox'], results: { cubs: 'W', whitesox: 'L' }, start: '2026-06-20T18:10:00Z' })
    expect(at('ratefield', '2026-06-20T22:00:00Z', [x]).winDay).toBe(true)
  })
})
