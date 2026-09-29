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
