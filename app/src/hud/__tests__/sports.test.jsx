import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ControlDock from '../ControlDock.jsx'
import GamesPanel from '../GamesPanel.jsx'
import VenueCard from '../VenueCard.jsx'
import { useStore } from '../../state/store.js'
import { useSports } from '../../sports/sportsStore.js'

const W = { key: 'wrigleyfield', name: 'Wrigley Field', kind: 'baseball', teams: ['cubs'], center: [-2292, -7339], frame: { origin: [-2325, -7319], axis: [0.70711, -0.70711] }, boards: [] }
const game = { id: 'x', sport: 'baseball', start: '2026-06-05T18:20:00Z', teams: ['cubs'], home: { abbr: 'CHC', score: 5 }, away: { abbr: 'NYM', score: 3 } }

describe('sports HUD', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState()); useSports.setState(useSports.getInitialState())
    useSports.setState({ venues: [W], states: { wrigleyfield: { state: 'postgame', game, next: null } }, source: 'LIVE', generatedAt: '2026-06-06T00:00:00Z' })
  })
  it('the Games button opens the panel; a row flies to the venue and opens its card', () => {
    render(<><ControlDock /><GamesPanel /></>)
    fireEvent.click(screen.getByRole('button', { name: /Games/ }))
    expect(useStore.getState().gamesOpen).toBe(true)
    expect(screen.getByRole('dialog', { name: 'Games' })).toHaveTextContent('Wrigley Field')
    expect(screen.getByRole('dialog', { name: 'Games' })).toHaveTextContent('FINAL')
    fireEvent.click(screen.getByRole('button', { name: /Wrigley Field/ }))
    expect(useStore.getState().flight.label).toBe('Wrigley Field')
    expect(useSports.getState().cardVenue).toBe('wrigleyfield')
    expect(useStore.getState().gamesOpen).toBe(false)
  })
  it('the venue card shows the score, the state and the data chip; Escape closes it', () => {
    useSports.setState({ cardVenue: 'wrigleyfield' })
    render(<VenueCard />)
    const card = screen.getByRole('dialog', { name: 'Wrigley Field' })
    expect(card).toHaveTextContent('NYM'); expect(card).toHaveTextContent('3'); expect(card).toHaveTextContent('CHC'); expect(card).toHaveTextContent('5')
    expect(card).toHaveTextContent('FINAL'); expect(card).toHaveTextContent('ESPN')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useSports.getState().cardVenue).toBeNull()
  })
  it('Team lights: the Games panel and the venue card say buildings light up on win nights (key I), and what is lit now', async () => {
    const { useTeamLights } = await import('../../sports/teamLightsStore.js')
    useTeamLights.setState({ on: true, lit: { team: 'cubs', why: 'win', simulated: false } })
    useStore.setState({ gamesOpen: true }); useSports.setState({ cardVenue: 'wrigleyfield' })
    render(<><GamesPanel /><VenueCard /></>)
    expect(screen.getByRole('dialog', { name: 'Games' })).toHaveTextContent(/Buildings light up in team colours on win nights \(key I\)\. Tonight the skyline is lit for the Cubs win/)
    expect(screen.getByRole('dialog', { name: 'Wrigley Field' })).toHaveTextContent(/Buildings light up in team colours on win nights \(key I\)/)
  })
  // E1-4: where the schedule came from and how old it is — on the card foot and the Games panel foot.
  describe('data age', () => {
    beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-01T17:00:00Z')) })
    afterEach(() => vi.useRealTimers())
    const cases = [
      [{ source: 'LIVE', origin: 'proxy', generatedAt: '2026-10-01T16:57:00Z' }, 'ESPN · updated 3 min ago', false],
      [{ source: 'LIVE', origin: 'file', generatedAt: '2026-09-29T17:36:00Z' }, 'ESPN schedule from Sep 29 — couldn’t refresh', true],
      [{ source: 'SIMULATED', origin: 'simulated', generatedAt: null }, 'Simulated schedule — typical home dates', false],
    ]
    for (const [data, text, amber] of cases) {
      it(`card and panel read “${text}”`, () => {
        useSports.setState({ ...data, cardVenue: 'wrigleyfield', states: { wrigleyfield: { state: 'idle', game: null, next: { ...game, start: '2026-10-02T00:05:00Z' } } } })
        useStore.setState({ gamesOpen: true })
        render(<><VenueCard /><GamesPanel /></>)
        for (const name of ['Wrigley Field', 'Games']) {
          const note = screen.getByRole('dialog', { name }).querySelector('.data-note')
          expect(note).toHaveTextContent(text)
          expect(note.classList.contains('data-stale')).toBe(amber)
        }
      })
    }
  })
})

// E3-3 / E4-3 / E5-1: the sports part of every venue card, and "Play a game" in both kinds of card
import VenueActions from '../VenueActions.jsx'
import LandmarkCard from '../cards/LandmarkCard.jsx'
import BuildingCard from '../cards/BuildingCard.jsx'
describe('venue cards: live-game copy and Play a game', () => {
  const V = (key, name, kind, teams, extra = {}) => ({ key, name, kind, teams, center: [0, 0], radius: 100, boards: [], ...extra })
  const venues = [V('wrigleyfield', 'Wrigley Field', 'baseball', ['cubs']), V('ratefield', 'Rate Field', 'baseball', ['whitesox']), V('soldierfield', 'Soldier Field', 'football', ['bears', 'fire']),
    V('unitedcenter', 'United Center', 'arena', ['bulls', 'blackhawks'], { crown: { center: [0, 0], roofY: 39, mast: 5, face: { w: 20, h: 10 }, faceY: 49 } }), V('wintrust', 'Wintrust Arena', 'arena', ['sky'])]
  const idle = { state: 'idle', game: null, next: null }
  beforeEach(() => {
    useStore.setState(useStore.getInitialState()); useSports.setState(useSports.getInitialState())
    useSports.setState({ venues, states: Object.fromEntries(venues.map((v) => [v.key, idle])), source: 'LIVE' })
    useStore.setState({ readout: { x: 0, z: 0 } })
  })
  it('every one of the five venue cards explains what happens when a real game is on', () => {
    for (const v of venues) {
      useSports.setState({ cardVenue: v.key })
      const { unmount } = render(<VenueCard />)
      const card = screen.getByRole('dialog', { name: v.name })
      expect(card).toHaveTextContent(/When a real game is on, this (stadium|arena) comes alive by itself/)
      if (['wrigleyfield', 'ratefield', 'soldierfield'].includes(v.key)) expect(card).toHaveTextContent('Press ▶ Play a game to see a 90-second preview any time.')
      else expect(card).not.toHaveTextContent('Play a game')
      unmount()
    }
  })
  it('the United Center card says what its roof board shows', () => {
    useSports.setState({ cardVenue: 'unitedcenter' })
    render(<VenueCard />)
    expect(screen.getByRole('dialog', { name: 'United Center' })).toHaveTextContent('Bulls and Blackhawks — the board on the roof shows the next game, live scores and finals')
    expect(screen.queryByRole('button', { name: /Play a/ })).toBeNull()
  })
  it('idle: a Play button; clicking it starts the showcase and the button becomes Stop', () => {
    render(<VenueActions venueKey="wrigleyfield" />)
    fireEvent.click(screen.getByRole('button', { name: /Play a Cubs game/ }))
    expect(useSports.getState().showcase).toMatchObject({ venueKey: 'wrigleyfield', team: 'cubs' })
    fireEvent.click(screen.getByRole('button', { name: /Stop the game/ }))
    expect(useSports.getState().showcase).toBeNull()
    expect(screen.getByRole('button', { name: /Play a Cubs game/ })).toBeEnabled()
  })
  it('a real live game: no button, "Live now — this is the real game"', () => {
    useSports.setState({ states: { ...useSports.getState().states, ratefield: { state: 'live', game: { id: 'r', home: {}, away: {} } } } })
    render(<VenueActions venueKey="ratefield" />)
    expect(screen.queryByRole('button', { name: /Play/ })).toBeNull()
    expect(screen.getByText(/Live now — this is the real game/)).toBeInTheDocument()
    expect(screen.queryByText(/Press ▶ Play a game/)).toBeNull() // F-2: no pointer to a button that's hidden
  })
  it('a real pregame: the button is disabled and says when to watch', () => {
    const start = new Date(Date.now() + 3600e3).toISOString()
    useSports.setState({ states: { ...useSports.getState().states, soldierfield: { state: 'pregame', game: { id: 'b', start, home: {}, away: {} } } } })
    render(<VenueActions venueKey="soldierfield" />)
    expect(screen.getByRole('button', { name: /Play a Bears game/ })).toBeDisabled()
    expect(screen.getByText(/game starts .* — watch it live then/)).toBeInTheDocument()
  })
  it('another venue — and the indoor arenas — get no Play button', () => {
    for (const k of ['unitedcenter', 'wintrust', 'not-a-venue']) {
      const { unmount, container } = render(<VenueActions venueKey={k} />)
      expect(container.querySelector('.va-play')).toBeNull()
      unmount()
    }
  })
  it('the clicked-stadium card (landmark or building) shows the same button', () => {
    const { unmount } = render(<LandmarkCard selection={{ kind: 'landmark', id: 'wrigley-field', data: {} }} />)
    expect(screen.getByRole('button', { name: /Play a Cubs game/ })).toBeInTheDocument()
    unmount()
    render(<BuildingCard selection={{ kind: 'landmark', id: 'soldierfield', data: { name: 'Soldier Field', kind: 'stadium' } }} />)
    expect(screen.getByRole('button', { name: /Play a Bears game/ })).toBeInTheDocument()
  })
})
