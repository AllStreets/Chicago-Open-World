// app/src/sports/__tests__/liveScores.test.js — CHI's /api/sports over V5's schedule (P5 Task 3: D6, D7, D11, D13).
import { describe, it, expect } from 'vitest'
import { parseChiSports, overlayLive, cubsWonOn, scoreEvents, sportsInterval, VENUE_KEYS } from '../liveScores.js'
import { gameState } from '../gameState.js'

const chi = [
  { name: 'Cubs', league: 'mlb', today: [{ id: '401', date: '2026-09-29T18:05Z', venue: 'Wrigley Field', status: 'Final', state: 'post', homeTeam: 'Chicago Cubs', awayTeam: 'St. Louis Cardinals', homeScore: '5', awayScore: '3' }], upcoming: [] },
  { name: 'White Sox', league: 'mlb', today: [{ id: '402', date: '2026-09-29T23:10Z', venue: 'Rate Field', status: 'Top 3rd', state: 'in', homeTeam: 'Chicago White Sox', awayTeam: 'Detroit Tigers', homeScore: '1', awayScore: '0' }], upcoming: [] },
  { name: 'Bears', league: 'nfl', today: [], upcoming: [], error: 'ESPN 500' },
]
describe('live sports', () => {
  const teams = parseChiSports(chi)
  const games = teams.flatMap((t) => t.games)
  it('parses games, maps venues and numeric scores, tolerates errors', () => {
    expect(games).toHaveLength(2)
    expect(games[0]).toMatchObject({ venueKey: 'wrigleyfield', state: 'post', homeScore: 5, awayScore: 3, team: 'cubs' })
    expect(VENUE_KEYS['Guaranteed Rate Field']).toBe('ratefield')
    expect(parseChiSports(null)).toEqual([])
    expect(parseChiSports({ nope: 1 })).toEqual([])
  })
  it('a Cubs win that Chicago date raises winDay; a loss does not', () => {
    expect(cubsWonOn(games, '2026-09-29')).toBe(true)
    const loss = games.map((g) => (g.id === '401' ? { ...g, homeScore: 2 } : g))
    expect(cubsWonOn(loss, '2026-09-29')).toBe(false)
    expect(cubsWonOn(games, '2026-09-30')).toBe(false)
  })
  it('overlays live state onto the build-time schedule by id, purely', () => {
    const schedule = [{ id: '402', teams: ['whitesox'], results: {}, sport: 'baseball', venue: 'ratefield', start: '2026-09-29T23:10:00Z', home: { abbr: 'CHW', score: null }, away: { abbr: 'DET', score: null } }]
    const s = overlayLive(schedule, games)
    const g = s.find((x) => x.id === '402')
    expect(g.live).toMatchObject({ state: 'in', homeScore: 1, status: 'Top 3rd' }); expect(g.home.score).toBe(1)
    expect(schedule[0].live).toBeUndefined(); expect(schedule[0].home.score).toBeNull()
  })
  it('a live home game the schedule does not know is added (and its result counts)', () => {
    const s = overlayLive([], games)
    const cubs = s.find((x) => x.id === '401')
    expect(cubs).toMatchObject({ venue: 'wrigleyfield', teams: ['cubs'], results: { cubs: 'W' }, sport: 'baseball' })
    expect(cubs.home.abbr).toBe('CHC')
  })
  it('detects scoring events for cheers', () => {
    const next = games.map((g) => (g.id === '402' ? { ...g, homeScore: 3 } : g))
    expect(scoreEvents(games, next)).toEqual([{ venueKey: 'ratefield', side: 'home', delta: 2 }])
    expect(scoreEvents(null, next)).toEqual([])
  })
  it('polls fast around games and slowly otherwise', () => {
    expect(sportsInterval(games, Date.parse('2026-09-29T23:30Z'))).toBe(60_000)
    expect(sportsInterval(games, Date.parse('2026-09-29T09:00Z'))).toBe(600_000)
  })
})

describe('applyLiveSports (the feed → the venues)', () => {
  it('an afternoon final first seen at night does not light the park again; a home run makes the crowd stand', async () => {
    const { applyLiveSports } = await import('../SportsClock.jsx')
    const { useSports } = await import('../sportsStore.js')
    useSports.setState({ games: [], liveGames: [], venues: [{ key: 'wrigleyfield', name: 'Wrigley Field', teams: ['cubs'], slot: 0, center: [0, 0, 0], radius: 100 }, { key: 'ratefield', name: 'Rate Field', teams: ['whitesox'], slot: 1, center: [0, 0, 0], radius: 100 }], swells: {} })
    const night = Date.parse('2026-09-30T03:00Z'), games = parseChiSports(chi).flatMap((t) => t.games)
    applyLiveSports(games, night)
    expect(useSports.getState().states.wrigleyfield.state).toBe('idle')
    expect(useSports.getState().states.wrigleyfield.winDay).toBe(true)
    expect(useSports.getState().states.ratefield.state).toBe('live')
    applyLiveSports(games.map((g) => (g.id === '402' ? { ...g, homeScore: 2 } : g)), night + 60000)
    expect(useSports.getState().swells.ratefield).toBeTruthy()
  })
})

describe('gameState with a live overlay', () => {
  it('the live overlay wins over the clock: "in" is live even before the scheduled first pitch', () => {
    const g = [{ id: 'g', teams: ['whitesox'], results: {}, sport: 'baseball', venue: 'ratefield', start: '2026-09-29T23:10:00Z', home: {}, away: {}, live: { state: 'in', homeScore: 1, awayScore: 0, status: 'Top 3rd', at: Date.parse('2026-09-29T20:00Z') } }]
    expect(gameState('ratefield', Date.parse('2026-09-29T20:00Z'), g).state).toBe('live')
  })
  it('a final ends the game early: postgame for an hour after the final report, then idle', () => {
    const at = Date.parse('2026-09-29T20:30Z')
    const g = [{ id: 'g', teams: ['cubs'], results: { cubs: 'W' }, sport: 'baseball', venue: 'wrigleyfield', start: '2026-09-29T18:05:00Z', home: {}, away: {}, live: { state: 'post', at } }]
    expect(gameState('wrigleyfield', at + 10 * 60000, g)).toMatchObject({ state: 'postgame', winDay: true })
    expect(gameState('wrigleyfield', at + 61 * 60000, g).state).toBe('idle')
  })
})
