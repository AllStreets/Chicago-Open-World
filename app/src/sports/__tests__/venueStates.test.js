import { describe, it, expect } from 'vitest'
import { computeStates, overrideStates, parseOverride, lightLevel, isStale } from '../venueStates.js'

const V = [
  { key: 'wrigleyfield', slot: 1, kind: 'baseball', teams: ['cubs'], center: [-2292, -7339], radius: 180 },
  { key: 'unitedcenter', slot: 3, kind: 'arena', teams: ['bulls', 'blackhawks'], center: [-3842, 147], radius: 130 },
  { key: 'soldierfield', slot: 0, kind: 'football', teams: ['bears', 'fire'], center: [928, 2187], radius: 220 },
]
const T = (iso) => Date.parse(iso)

describe('venue states', () => {
  it('computes every venue, with its next game', () => {
    const g = { id: 'a', teams: ['cubs'], results: {}, sport: 'baseball', venue: 'wrigleyfield', start: '2026-07-10T00:05:00Z', status: 'STATUS_SCHEDULED' }
    const s = computeStates(V, T('2026-07-09T12:00:00Z'), [g])
    expect(Object.keys(s)).toEqual(['wrigleyfield', 'unitedcenter', 'soldierfield'])
    expect(s.wrigleyfield).toMatchObject({ state: 'idle', next: g })
    expect(computeStates(V, T('2026-07-10T01:00:00Z'), [g]).wrigleyfield.state).toBe('live')
  })
  it('parses the test-only ?sports= override', () => {
    expect(parseOverride('live')).toEqual({ mode: 'live', team: null })
    expect(parseOverride('live:fire')).toEqual({ mode: 'live', team: 'fire' })
    expect(parseOverride('party')).toBeNull()
    expect(parseOverride(null)).toBeNull()
  })
  it('override puts every venue in one state with a synthetic simulated game', () => {
    const now = T('2026-09-28T17:00:00Z')
    const live = overrideStates(V, { mode: 'live', team: null }, now)
    expect(live.wrigleyfield).toMatchObject({ state: 'live', winDay: false })
    expect(live.wrigleyfield.game).toMatchObject({ teams: ['cubs'], sport: 'baseball', venue: 'wrigleyfield', simulated: true })
    expect(live.unitedcenter.game.sport).toBe('basketball')
    expect(overrideStates(V, { mode: 'live', team: 'fire' }, now).soldierfield.game).toMatchObject({ teams: ['fire'], sport: 'soccer' })
    expect(overrideStates(V, { mode: 'win', team: null }, now).wrigleyfield).toMatchObject({ state: 'postgame', winDay: true, lossDay: false })
    expect(overrideStates(V, { mode: 'loss', team: null }, now).wrigleyfield).toMatchObject({ state: 'postgame', winDay: false, lossDay: true })
    expect(overrideStates(V, { mode: 'idle', team: null }, now).wrigleyfield).toMatchObject({ state: 'idle', game: null })
  })
  it('light levels: dim when idle, full for the game, easing after', () => {
    expect(lightLevel('idle')).toBe(0.5); expect(lightLevel('live')).toBe(1); expect(lightLevel('pregame')).toBe(1); expect(lightLevel('postgame')).toBe(0.7)
    expect(lightLevel(undefined)).toBe(0.5)
  })
  it('a schedule older than 45 days, or undated, is stale', () => {
    const now = T('2026-09-29T12:00:00Z')
    expect(isStale('2026-09-20T00:00:00Z', now)).toBe(false)
    expect(isStale('2026-08-01T00:00:00Z', now)).toBe(true)
    expect(isStale(undefined, now)).toBe(true)
  })
})
