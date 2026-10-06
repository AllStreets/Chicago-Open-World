import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import HelpOverlay from '../HelpOverlay.jsx'
import FlightChip from '../FlightChip.jsx'
import { useStore } from '../../state/store.js'

describe('help + flight chip', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  it('help lists controls in plain words and closes', () => {
    useStore.getState().setHelpOpen(true)
    render(<HelpOverlay />)
    expect(screen.getByText(/Move around/i)).toBeInTheDocument()
    expect(screen.getByText(/Search and fly/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(useStore.getState().helpOpen).toBe(false)
  })
  it('shows "Flying to" while a flight runs', () => {
    useStore.getState().startFlight({ position: [0, 100, 0], target: [0, 0, 0] }, 'Wrigley Field')
    render(<FlightChip />)
    expect(screen.getByText(/Flying to/i)).toHaveTextContent('Wrigley Field')
  })
  it('the help card says where water reflections are switched', () => {
    useStore.getState().setHelpOpen(true)
    render(<HelpOverlay />)
    expect(screen.getByText(/water reflections/i)).toBeInTheDocument()
  })
})

describe('help: games', () => {
  it('explains the Games button and ⌘K "tonight"', () => {
    useStore.setState({ helpOpen: true })
    render(<HelpOverlay />)
    expect(screen.getByRole('dialog', { name: 'Controls' })).toHaveTextContent(/tonight/)
    expect(screen.getByRole('dialog', { name: 'Controls' })).toHaveTextContent(/Games/)
  })
})

import { FEATURE_CONTROLS } from '../featureControls.js'
describe('help: City life from the registry', () => {
  it('help lists every city-life control with its key and button', () => {
    useStore.getState().setHelpOpen(true)
    render(<HelpOverlay />)
    expect(screen.getByText(/City life/i)).toBeInTheDocument()
    for (const c of FEATURE_CONTROLS.filter((x) => BUTTONED.has(x.id))) expect(screen.getByText(new RegExp(`${c.label} button`))).toBeInTheDocument()
    expect(screen.getByText(/Follow a train/i)).toBeInTheDocument()
  })
})

// X-3: the help card for this pass — U, the M toast, K, Y and the Games paragraph, the Riverwalk and Lower Wacker
// ride lines; and no dead entry: nothing names a button that isn't on screen, and every key it names is a real control
import { BUTTONED, controlLine } from '../HelpOverlay.jsx'
import { ALL_HINTS } from '../../lib/hints.js'
describe('help: X-3', () => {
  const card = () => { useStore.setState({ helpOpen: true }); render(<HelpOverlay />); return screen.getByRole('dialog', { name: 'Controls' }) }
  it('U, M (with the speaker toast), K, Y and the ride lines are on the card', () => {
    const d = card()
    const row = (k) => [...d.querySelectorAll('p')].filter((p) => p.querySelector('kbd, .keycap, [class*=key]')?.textContent.trim() === k).map((p) => p.textContent).join(' | ')
    expect(row('U')).toMatch(/lower levels — .*Lower Wacker.*cut-away/)
    expect(row('U')).toMatch(/⌘K.*Lower levels/)
    expect(row('M')).toMatch(/speaker in the middle of the screen/)
    expect(row('K')).toMatch(/change the view — in a ride, or while following a train/)
    expect(row('Y')).toMatch(/Play a game/)
    expect(d).toHaveTextContent(/Drive Lower Wacker/)
    expect(d).toHaveTextContent(/Riverwalk \(river level\)/)
  })
  it('no dead entries: only on-screen controls are called buttons; Sound, Traffic, Play and Lower point to ⌘K', () => {
    for (const id of ['sound', 'traffic', 'showcase', 'lowerLevels']) {
      const c = FEATURE_CONTROLS.find((x) => x.id === id)
      expect(BUTTONED.has(id), id).toBe(false)
      expect(controlLine(c)).not.toMatch(/ button —/)
      expect(controlLine(c)).toMatch(/\{⌘K\} “[^”]+”$/)
    }
    // every hint in the bottom bar is a key the card explains
    const d = card()
    const keys = new Set([...d.querySelectorAll('p')].map((p) => p.firstElementChild?.textContent.replace(/\s+/g, ' ').trim()))
    const missing = ALL_HINTS.filter((h) => !keys.has(h.k) && !['↑↓←→', 'Shift+arrows', '?'].includes(h.k)).map((h) => h.k)
    expect(missing).toEqual([])
  })
})

describe('Phase 4 help', () => {
  it('help card documents every Phase 4 control in plain words', async () => {
    const { useStore } = await import('../../state/store.js')
    const { default: HelpOverlay } = await import('../HelpOverlay.jsx')
    const { render, screen } = await import('@testing-library/react')
    useStore.getState().setHelpOpen(true)
    render(<HelpOverlay />)
    for (const t of [/lens rail/i, /hover a building/i, /places/i, /tour/i, /set office/i]) expect(screen.getAllByText(t).length).toBeGreaterThan(0)
  })
})

describe('Phase 5 help', () => {
  it('help card explains the live chip, Scan and Weather', () => {
    useStore.getState().setHelpOpen(true)
    render(<HelpOverlay />)
    for (const t of [/LIVE CTA/i, /Scan/i, /Weather/i]) expect(screen.getAllByText(t).length).toBeGreaterThan(0)
    expect(screen.getByText('Live city')).toBeInTheDocument()
  })
})

// E5-2: the Games paragraph — live behaviour, Y / Play a game, where the data comes from, CTA still simulated
describe('help: Games paragraph', () => {
  it('explains live games, Y, ESPN and that live trains stay simulated', () => {
    useStore.setState({ helpOpen: true })
    render(<HelpOverlay />)
    const d = screen.getByRole('dialog', { name: 'Controls' })
    expect(d).toHaveTextContent(/comes alive by itself/)
    expect(d).toHaveTextContent(/Play a game — a 90-second preview/)
    expect(d).toHaveTextContent(/ESPN and refresh on the live site/)
    expect(d).toHaveTextContent(/live CTA trains stay simulated/)
  })
})

// Team lights: the I row (from the registry, pointing to ⌘K), the Games "Win night" row and the grouped layout
describe('help: Team lights and the grouped sheet', () => {
  it('lists I, the win-night lights and the previews; sections in Move · Look · Search · City life · Rides · Games order', async () => {
    const { GROUPS } = await import('../HelpOverlay.jsx')
    useStore.setState({ helpOpen: true })
    render(<HelpOverlay />)
    const d = screen.getByRole('dialog', { name: 'Controls' })
    const row = (k) => [...d.querySelectorAll('p')].filter((p) => p.firstElementChild?.textContent.trim() === k).map((p) => p.textContent).join(' | ')
    expect(row('I')).toMatch(/team lights — .*Willis Tower’s antennas.*2 a\.m\..*⌘K.*“Team lights”/)
    expect(row('Win night')).toMatch(/two colours until 2 a\.m\..*I.*turns Team lights off or on.*Preview Bears lights/)
    expect(GROUPS.map(([t]) => t).slice(0, 6)).toEqual(['Move around', 'Look around', 'Search and fly', 'City life', 'Rides and tours', 'Games'])
    expect(d.querySelectorAll('.help-sec').length).toBe(GROUPS.length)
  })
})
