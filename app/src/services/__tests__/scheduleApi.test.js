// app/src/services/__tests__/scheduleApi.test.js — the cached /api/schedule Vercel Function (E1-2) and the shared
// ESPN parser it uses (E1-1). fetch is mocked: no test ever calls ESPN.
import { describe, it, expect, vi } from 'vitest'
import * as shared from '../../../../shared/schedules.js'
import handler, { buildSchedule, USER_AGENT } from '../../../api/schedule.js'
import { TEAMS } from '../../../../shared/teams.js'

const NOW = Date.parse('2026-10-01T17:00:00Z') // Thu noon CDT
const side = (id, abbr, score, winner) => ({ team: { id, abbreviation: abbr, displayName: abbr }, score, winner })
const ev = (id, date, venue, home, away, st = {}) => ({
  id, date,
  competitions: [{
    venue: { fullName: venue }, attendance: 0,
    status: { type: { name: st.name ?? 'STATUS_SCHEDULED', state: st.state ?? 'pre', completed: st.completed ?? false, shortDetail: st.detail ?? '' } },
    competitors: [{ homeAway: 'home', ...home }, { homeAway: 'away', ...away }],
  }],
})
const bearsNext = ev('b1', '2026-10-04T17:00Z', 'Soldier Field', side('3', 'CHI'), side('20', 'NYJ'))
const cubsOld = ev('c0', '2026-09-20T18:20Z', 'Wrigley Field', side('16', 'CHC', { value: 5 }, true), side('21', 'NYM', { value: 3 }, false), { name: 'STATUS_FINAL', state: 'post', completed: true })
const cubsTonight = ev('c1', '2026-10-01T23:05Z', 'Wrigley Field', side('16', 'CHC'), side('21', 'NYM'))
const cubsLive = ev('c1', '2026-10-01T23:05Z', 'Wrigley Field', side('16', 'CHC', '4'), side('21', 'NYM', '2'), { name: 'STATUS_IN_PROGRESS', state: 'in', detail: 'Top 6th' })

const json = (body) => ({ ok: true, status: 200, json: async () => body })
// A fake ESPN: team schedule URLs answer from `teams` (by espnId+league), scoreboards from `boards` (by league).
function fakeEspn({ teams = {}, boards = {}, fail = () => false } = {}) {
  return vi.fn(async (url) => {
    if (fail(url)) throw new Error('timeout')
    const sb = url.match(/\/([\w.]+)\/scoreboard/)
    if (sb) return json({ events: boards[sb[1]] ?? [] })
    const m = url.match(/\/([\w.]+)\/teams\/(\d+)\/schedule(\?seasontype=(\d))?/)
    const key = `${m[1]}:${m[2]}`
    return json({ events: (teams[key] ?? []).filter(() => !m[4] || m[4] === '2' || m[1] === 'usa.1') })
  })
}

describe('shared/schedules (E1-1)', () => {
  it('the app can import the ESPN parser the pipeline uses', () => {
    for (const k of ['parseEvent', 'scoreOf', 'mergeGames', 'scheduleUrls', 'SEASON_TYPES', 'scoreboardUrl', 'inGameWindow']) expect(shared[k]).toBeDefined()
    expect(shared.parseEvent(bearsNext, TEAMS.find((t) => t.key === 'bears'))).toMatchObject({ venue: 'soldierfield', away: { abbr: 'NYJ' }, state: 'pre' })
  })
  it('a game window runs from 90 min before an in-map start to an hour after its likely end', () => {
    const g = { venue: 'wrigleyfield', start: '2026-10-01T23:05:00Z', state: 'pre' }
    expect(shared.inGameWindow([g], NOW)).toBe(false)
    expect(shared.inGameWindow([g], Date.parse('2026-10-01T21:40:00Z'))).toBe(true)
    expect(shared.inGameWindow([{ ...g, venue: null }], Date.parse('2026-10-01T23:30:00Z'))).toBe(false) // an away game
    expect(shared.inGameWindow([{ ...g, state: 'in', start: '2026-10-01T10:00:00Z' }], NOW)).toBe(true) // a long extra-innings game
  })
})

describe('/api/schedule (E1-2)', () => {
  it('returns the schedules.json shape, keeps games from 2 days back, and caches 10 min outside a game window', async () => {
    const fetchImpl = fakeEspn({ teams: { 'nfl:3': [bearsNext], 'mlb:16': [cubsOld, cubsTonight] } })
    const r = await buildSchedule({ fetchImpl, nowMs: NOW })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ version: 1, source: 'espn-proxy', partial: [], generatedAt: new Date(NOW).toISOString() })
    expect(r.body.games.map((g) => g.id)).toEqual(['c1', 'b1'])
    expect(Object.keys(r.body.games[0])).toEqual(expect.arrayContaining(['id', 'teams', 'results', 'sport', 'league', 'start', 'venue', 'status', 'state', 'home', 'away', 'chicagoHome']))
    expect(r.headers['Cache-Control']).toBe('public, s-maxage=600, stale-while-revalidate=3600')
    for (const [url, opts] of fetchImpl.mock.calls) {
      expect(url.startsWith('https://site.api.espn.com/')).toBe(true)
      expect(opts.headers['User-Agent']).toBe(USER_AGENT)
      expect(opts.signal).toBeDefined()
    }
  })
  it('caches only 60 s inside a game window', async () => {
    const r = await buildSchedule({ fetchImpl: fakeEspn({ teams: { 'mlb:16': [cubsTonight] } }), nowMs: Date.parse('2026-10-01T22:00:00Z') })
    expect(r.headers['Cache-Control']).toBe('public, s-maxage=60, stale-while-revalidate=60')
  })
  it('a live ESPN event on the league scoreboard comes back in progress with its score', async () => {
    const r = await buildSchedule({ fetchImpl: fakeEspn({ teams: { 'mlb:16': [cubsTonight] }, boards: { mlb: [cubsLive] } }), nowMs: Date.parse('2026-10-02T01:00:00Z') })
    const g = r.body.games.find((x) => x.id === 'c1')
    expect(g).toMatchObject({ state: 'in', status: 'STATUS_IN_PROGRESS', detail: 'Top 6th', home: { abbr: 'CHC', score: 4 }, away: { abbr: 'NYM', score: 2 } })
    expect(r.headers['Cache-Control']).toContain('s-maxage=60')
  })
  it('a partial failure still returns the other teams and names the failed ones', async () => {
    const r = await buildSchedule({ fetchImpl: fakeEspn({ teams: { 'nfl:3': [bearsNext] }, fail: (u) => u.includes('/mlb/teams/16/') }), nowMs: NOW })
    expect(r.status).toBe(200)
    expect(r.body.partial).toEqual(['cubs'])
    expect(r.body.games.map((g) => g.id)).toEqual(['b1'])
  })
  it('a total failure is a 503 that is never cached, so the browser falls back', async () => {
    const r = await buildSchedule({ fetchImpl: vi.fn(async () => { throw new Error('down') }), nowMs: NOW })
    expect(r.status).toBe(503)
    expect(r.headers['Cache-Control']).toBe('no-store')
  })
  it('the default export is a Node (req, res) handler', async () => {
    const real = globalThis.fetch
    const soon = ev('b2', new Date(Date.now() + 86400000).toISOString(), 'Soldier Field', side('3', 'CHI'), side('20', 'NYJ'))
    globalThis.fetch = fakeEspn({ teams: { 'nfl:3': [soon] } })
    try {
      const headers = {}
      const res = { statusCode: 0, body: '', setHeader: (k, v) => { headers[k] = v }, end: (b) => { res.body = b } }
      await handler({ method: 'GET', url: '/api/schedule' }, res)
      expect(res.statusCode).toBe(200)
      expect(headers['Content-Type']).toMatch(/application\/json/)
      expect(JSON.parse(res.body).games.some((g) => g.id === 'b2')).toBe(true)
    } finally { globalThis.fetch = real }
  })
})
