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
    for (const c of FEATURE_CONTROLS) expect(screen.getByText(new RegExp(`${c.label} button`))).toBeInTheDocument()
    expect(screen.getByText(/Follow a train/i)).toBeInTheDocument()
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
