import { describe, it, expect } from 'vitest'
import { loadSchedule, loadVenues, useSports } from '../sportsStore.js'

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

describe('useSports', () => {
  it('starts simulated and empty, with no card open', () => {
    expect(useSports.getInitialState()).toMatchObject({ source: 'SIMULATED', games: [], venues: [], cardVenue: null })
  })
})
