import { describe, it, expect } from 'vitest'
import { TEAMS, VENUE_BY_NAME, teamByKey } from '../../shared/teams.js'

describe('shared/teams.js', () => {
  it('lists the seven Chicago teams with ESPN ids, sourced colours and home venues', () => {
    expect(TEAMS.map((t) => [t.key, t.league, t.espnId, t.home])).toEqual([
      ['cubs', 'mlb', 16, 'wrigleyfield'], ['whitesox', 'mlb', 4, 'ratefield'], ['bears', 'nfl', 3, 'soldierfield'],
      ['bulls', 'nba', 4, 'unitedcenter'], ['blackhawks', 'nhl', 4, 'unitedcenter'], ['fire', 'usa.1', 182, 'soldierfield'], ['sky', 'wnba', 19, 'wintrust'],
    ])
    for (const t of TEAMS) for (const c of t.colors) expect(c).toMatch(/^#[0-9A-F]{6}$/)
    expect(teamByKey('bears').colors).toEqual(['#0B162A', '#C83803'])
    expect(teamByKey('nope')).toBeNull()
  })
  it('maps ESPN venue names, old and new, to venue keys', () => {
    expect(VENUE_BY_NAME['Guaranteed Rate Field']).toBe('ratefield')
    expect(VENUE_BY_NAME['Rate Field']).toBe('ratefield')
    expect(VENUE_BY_NAME['Wintrust Arena']).toBe('wintrust')
  })
})
