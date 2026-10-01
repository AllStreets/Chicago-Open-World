// E4-2: the showcase in the store and the clock — a real live game beats it, a real pregame stops it, it expires at
// 90 s back to the real state, and it never touches the schedule, the live games or the board overrides.
import { describe, it, expect, beforeEach } from 'vitest'
import { useSports } from '../sportsStore.js'
import { tick } from '../SportsClock.jsx'
import { useStore } from '../../state/store.js'

const W = { key: 'wrigleyfield', name: 'Wrigley Field', kind: 'baseball', slot: 1, teams: ['cubs'], center: [0, 0], radius: 100 }
const T0 = Date.parse('2026-10-01T18:00:00Z')
const cubs = (startMs) => ({ id: 'real', teams: ['cubs'], results: {}, sport: 'baseball', league: 'mlb', start: new Date(startMs).toISOString(), venue: 'wrigleyfield', status: 'STATUS_SCHEDULED', state: 'pre', home: { abbr: 'CHC', score: null }, away: { abbr: 'STL', score: null }, chicagoHome: true })

describe('showcase in the clock', () => {
  beforeEach(() => {
    useSports.setState(useSports.getInitialState()); useStore.setState(useStore.getInitialState())
    useSports.setState({ venues: [W], games: [cubs(T0 + 3 * 86400000)] })
  })
  it('lays the showcase over an idle venue, and ends by itself at 90 s', () => {
    const games = useSports.getState().games, overrides = useSports.getState().boardOverrides, liveGames = useSports.getState().liveGames
    useSports.getState().startShowcase('wrigleyfield', 'cubs', T0)
    tick(T0 + 30e3)
    let st = useSports.getState().states.wrigleyfield
    expect(st.state).toBe('live'); expect(st.game.showcase).toBe(true); expect(st.next.id).toBe('real')
    tick(T0 + 80e3)
    expect(useSports.getState().states.wrigleyfield.winDay).toBe(true)
    tick(T0 + 90e3)
    st = useSports.getState().states.wrigleyfield
    expect(useSports.getState().showcase).toBeNull()
    expect(st.state).toBe('idle'); expect(st.game).toBeNull()
    expect(useSports.getState().games).toBe(games); expect(useSports.getState().boardOverrides).toBe(overrides); expect(useSports.getState().liveGames).toBe(liveGames)
  })
  it('a real live game wins: the showcase stops and a toast says so', () => {
    useSports.setState({ games: [cubs(T0 - 3600e3)] }) // a real Cubs game an hour in
    useSports.getState().startShowcase('wrigleyfield', 'cubs', T0)
    tick(T0 + 5e3)
    expect(useSports.getState().showcase).toBeNull()
    expect(useSports.getState().states.wrigleyfield.game.id).toBe('real')
    expect(useStore.getState().toast.text).toMatch(/real game is starting/)
  })
  it('a real pregame (gates open) stops it', () => {
    useSports.getState().startShowcase('wrigleyfield', 'cubs', T0)
    tick(T0 + 5e3)
    expect(useSports.getState().showcase).not.toBeNull()
    useSports.setState({ games: [cubs(T0 + 3600e3)] })
    tick(T0 + 6e3)
    expect(useSports.getState().showcase).toBeNull()
    expect(useSports.getState().states.wrigleyfield.state).toBe('pregame')
  })
  it('each home run makes the crowd stand', () => {
    useSports.getState().startShowcase('wrigleyfield', 'cubs', T0)
    for (let s = 0; s < 76; s++) tick(T0 + s * 1000)
    expect(useSports.getState().swells.wrigleyfield).toBeTruthy()
  })
})
