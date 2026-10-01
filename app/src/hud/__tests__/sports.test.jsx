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
