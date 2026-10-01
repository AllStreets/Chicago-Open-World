import { describe, it, expect, beforeEach } from 'vitest'
import { loadSchedule, loadVenues, useSports, parseProxySchedule, scheduleFromProxy } from '../sportsStore.js'

const now = Date.parse('2026-09-29T12:00:00Z')
const ok = (body) => async () => ({ ok: true, json: async () => body })
const game = { id: '1', teams: ['cubs'], results: {}, sport: 'baseball', venue: 'wrigleyfield', start: '2026-09-30T00:05:00Z' }

describe('loadSchedule', () => {
  it('uses fresh ESPN data as LIVE', async () => {
    const r = await loadSchedule(ok({ generatedAt: '2026-09-28T00:00:00Z', games: [game] }), now)
    expect(r).toMatchObject({ source: 'LIVE', generatedAt: '2026-09-28T00:00:00Z' })
    expect(r.games).toEqual([game])
  })
  it('falls back to the simulated calendar on 404, bad JSON, empty or stale data', async () => {
    const cases = [
      async () => ({ ok: false, status: 404 }),
      async () => ({ ok: true, json: async () => { throw new SyntaxError('Unexpected token <') } }),
      async () => { throw new TypeError('Failed to fetch') },
      ok({ generatedAt: '2026-09-28T00:00:00Z', games: [] }),
      ok({ generatedAt: '2026-06-01T00:00:00Z', games: [game] }),
      ok(null),
    ]
    for (const f of cases) {
      const r = await loadSchedule(f, now)
      expect(r.source).toBe('SIMULATED')
      expect(r.games.length).toBeGreaterThan(300)
      expect(r.games.every((g) => g.simulated)).toBe(true)
    }
  })
})

describe('loadVenues', () => {
  it('returns the venues, or [] on any failure', async () => {
    expect(await loadVenues(ok({ version: 1, venues: [{ key: 'wrigleyfield' }] }))).toEqual([{ key: 'wrigleyfield' }])
    expect(await loadVenues(async () => ({ ok: false }))).toEqual([])
    expect(await loadVenues(async () => { throw new Error('x') })).toEqual([])
  })
})

// E1-3: the order of trust — the cached /api/schedule proxy, then the build-time file, then the simulated calendar.
describe('schedule trust order (E1-3)', () => {
  const proxyDoc = (o = {}) => ({ version: 1, source: 'espn-proxy', generatedAt: '2026-09-29T11:58:00Z', partial: [], games: [
    { ...game, id: 'p1', state: 'pre', home: { abbr: 'CHC', score: null }, away: { abbr: 'MIL', score: null } },
    { ...game, id: 'p2', start: '2026-09-29T11:00:00Z', state: 'in', status: 'STATUS_IN_PROGRESS', detail: 'Top 6th', home: { abbr: 'CHC', score: 3 }, away: { abbr: 'MIL', score: 1 } },
  ], ...o })
  beforeEach(() => useSports.setState(useSports.getInitialState()))
  it('the file is loaded with origin "file", the fallback with origin "simulated"', async () => {
    expect((await loadSchedule(ok({ generatedAt: '2026-09-28T00:00:00Z', games: [game] }), now)).origin).toBe('file')
    expect((await loadSchedule(async () => ({ ok: false }), now)).origin).toBe('simulated')
  })
  it('proxy beats file beats simulated, whichever arrives first', async () => {
    const s = () => useSports.getState()
    const file = await loadSchedule(ok({ generatedAt: '2026-09-28T00:00:00Z', games: [game] }), now)
    const sim = await loadSchedule(async () => ({ ok: false }), now)
    const proxy = scheduleFromProxy(parseProxySchedule(proxyDoc(), now), [], now)
    expect(s().acceptSchedule(proxy)).toBe(true)
    expect(s().acceptSchedule(file)).toBe(false) // the slower build-time file never overwrites a fresh proxy answer
    expect(s().acceptSchedule(sim)).toBe(false)
    expect(s()).toMatchObject({ origin: 'proxy', source: 'LIVE', generatedAt: '2026-09-29T11:58:00Z' })
    useSports.setState(useSports.getInitialState())
    expect(s().acceptSchedule(sim)).toBe(true); expect(s().acceptSchedule(file)).toBe(true)
    expect(s().origin).toBe('file')
    expect(s().acceptSchedule(proxy)).toBe(true); expect(s().acceptSchedule(proxy)).toBe(true) // a newer proxy answer replaces the last
  })
  it('a proxy answer that is empty, malformed or older than 6 h is refused', () => {
    expect(() => parseProxySchedule(null, now)).toThrow()
    expect(() => parseProxySchedule(proxyDoc({ games: [] }), now)).toThrow()
    expect(() => parseProxySchedule(proxyDoc({ source: 'espn' }), now)).toThrow()
    expect(() => parseProxySchedule(proxyDoc({ generatedAt: '2026-09-29T05:00:00Z' }), now)).toThrow()
    expect(parseProxySchedule(proxyDoc(), now).games).toHaveLength(2)
  })
  it('games ESPN reports in progress or final carry a `live` field (the existing liveState path)', () => {
    const d = scheduleFromProxy(parseProxySchedule(proxyDoc(), now), [], now)
    expect(d.games.find((g) => g.id === 'p1').live).toBeUndefined()
    expect(d.games.find((g) => g.id === 'p2').live).toMatchObject({ state: 'in', homeScore: 3, awayScore: 1, status: 'Top 6th' })
    const finalDoc = proxyDoc({ games: [{ ...proxyDoc().games[1], state: 'post', status: 'STATUS_FINAL' }] })
    const first = scheduleFromProxy(parseProxySchedule(finalDoc, now), d.games, now).games[0]
    expect(first.live).toMatchObject({ state: 'post', at: now }) // seen final now, earlier than its likely end
    const later = scheduleFromProxy(parseProxySchedule(finalDoc, now + 600000), [first], now + 600000).games[0]
    expect(later.live.at).toBe(now) // the first sighting of the final is kept, so the postgame hour doesn't restart
  })
})

describe('useSports', () => {
  it('starts simulated and empty, with no card open', () => {
    expect(useSports.getInitialState()).toMatchObject({ source: 'SIMULATED', games: [], venues: [], cardVenue: null })
  })
})
