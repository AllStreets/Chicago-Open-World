import { describe, it, expect } from 'vitest'
import { scheduleUrls, parseEvent, mergeGames, scoreOf, fetchAllSchedules } from '../lib/schedules.js'
import { TEAMS, teamByKey } from '../../shared/teams.js'

const side = (id, abbr, score, winner) => ({ team: { id, abbreviation: abbr, displayName: abbr }, score, winner })
const ev = (id, date, venue, home, away, st = {}) => ({
  id, date,
  competitions: [{
    venue: { fullName: venue }, attendance: st.attendance ?? 0,
    status: { type: { name: st.name ?? 'STATUS_FINAL', state: st.state ?? 'post', completed: st.completed ?? true, shortDetail: st.detail ?? 'Final' } },
    competitors: [{ homeAway: 'home', ...home }, { homeAway: 'away', ...away }],
  }],
})
const cubsWin = ev('1', '2026-06-05T18:20Z', 'Wrigley Field', side('16', 'CHC', { value: 5, displayValue: '5' }, true), side('21', 'NYM', { value: 3, displayValue: '3' }, false), { attendance: 38012 })
const crosstown = ev('2', '2026-06-20T18:10Z', 'Wrigley Field', side('16', 'CHC', { value: 2 }, false), side('4', 'CHW', { value: 7 }, true))
const postponed = ev('3', '2026-06-21T18:10Z', 'Wrigley Field', side('16', 'CHC'), side('21', 'NYM'), { name: 'STATUS_POSTPONED', state: 'post', completed: false, detail: 'Postponed' })
const upcoming = ev('4', '2026-09-30T00:05Z', 'Tropicana Field', side('30', 'TB'), side('16', 'CHC'), { name: 'STATUS_SCHEDULED', state: 'pre', completed: false, detail: '9/29 - 7:05 PM EDT' })

describe('schedules', () => {
  it('builds the exact public ESPN schedule URLs', () => {
    const E = 'https://site.api.espn.com/apis/site/v2/sports'
    expect(TEAMS.flatMap(scheduleUrls)).toEqual([
      `${E}/baseball/mlb/teams/16/schedule?seasontype=2`, `${E}/baseball/mlb/teams/16/schedule?seasontype=3`,
      `${E}/baseball/mlb/teams/4/schedule?seasontype=2`, `${E}/baseball/mlb/teams/4/schedule?seasontype=3`,
      `${E}/football/nfl/teams/3/schedule?seasontype=1`, `${E}/football/nfl/teams/3/schedule?seasontype=2`, `${E}/football/nfl/teams/3/schedule?seasontype=3`,
      `${E}/basketball/nba/teams/4/schedule?seasontype=1`, `${E}/basketball/nba/teams/4/schedule?seasontype=2`, `${E}/basketball/nba/teams/4/schedule?seasontype=3`,
      `${E}/hockey/nhl/teams/4/schedule?seasontype=1`, `${E}/hockey/nhl/teams/4/schedule?seasontype=2`, `${E}/hockey/nhl/teams/4/schedule?seasontype=3`,
      `${E}/soccer/usa.1/teams/182/schedule`,
      `${E}/basketball/wnba/teams/19/schedule?seasontype=1`, `${E}/basketball/wnba/teams/19/schedule?seasontype=2`, `${E}/basketball/wnba/teams/19/schedule?seasontype=3`,
    ])
  })
  it('reads scores in every ESPN shape', () => {
    expect(scoreOf({ value: 2, displayValue: '2', $ref: 'x' })).toBe(2)
    expect(scoreOf({ displayValue: '4' })).toBe(4)
    expect(scoreOf('3')).toBe(3)
    expect(scoreOf(undefined)).toBeNull()
    expect(scoreOf({})).toBeNull()
  })
  it('parses a Cubs home win at Wrigley', () => {
    expect(parseEvent(cubsWin, teamByKey('cubs'))).toMatchObject({
      id: '1', teams: ['cubs'], results: { cubs: 'W' }, sport: 'baseball', league: 'mlb', start: '2026-06-05T18:20:00.000Z',
      venue: 'wrigleyfield', state: 'post', home: { abbr: 'CHC', score: 5, winner: true }, away: { abbr: 'NYM', score: 3 }, chicagoHome: true, attendance: 38012,
    })
  })
  it('an upcoming away game has no venue of ours and no scores', () => {
    expect(parseEvent(upcoming, teamByKey('cubs'))).toMatchObject({ venue: null, state: 'pre', home: { score: null }, away: { score: null }, results: {}, chicagoHome: false })
  })
  it('a postponed game keeps its status and has no result', () => {
    expect(parseEvent(postponed, teamByKey('cubs'))).toMatchObject({ status: 'STATUS_POSTPONED', results: {} })
  })
  it('rejects events without competitors', () => {
    expect(parseEvent({ id: '9', date: '2026-01-01T00:00Z', competitions: [{}] }, teamByKey('cubs'))).toBeNull()
  })
  it('merges a Crosstown game listed by both teams', () => {
    const merged = mergeGames([[parseEvent(crosstown, teamByKey('cubs'))], [parseEvent(crosstown, teamByKey('whitesox'))], [parseEvent(cubsWin, teamByKey('cubs'))]])
    expect(merged).toHaveLength(2)
    expect(merged[1]).toMatchObject({ id: '2', teams: ['cubs', 'whitesox'], results: { cubs: 'L', whitesox: 'W' } })
    expect(merged[0].start < merged[1].start).toBe(true)
  })
  it('fetchAllSchedules keeps going when requests fail', async () => {
    const fake = async (url) => (url.includes('/teams/16/') ? { ok: true, json: async () => ({ events: [cubsWin, upcoming] }) } : { ok: false, status: 500 })
    const { games, failures } = await fetchAllSchedules(fake)
    expect(games.map((g) => g.id)).toEqual(['1', '4'])
    expect(failures).toHaveLength(15)
  })
})
