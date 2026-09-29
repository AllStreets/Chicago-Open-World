import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CommandPalette from '../CommandPalette.jsx'
import { useStore } from '../../state/store.js'

const manifest = { landmarks: [{ key: 'wrigleyfield', name: 'Wrigley Field', x: -2279, z: -7372, top: 24 }, { key: 'willis', name: 'Willis Tower', x: -670, z: 350, top: 527 }], tallest: [] }

describe('CommandPalette', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useStore.setState({ manifest }) })
  it('⌘K opens, typing filters, Enter flies there and closes', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'wrig' } })
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Wrigley Field')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useStore.getState().flight.to.target[0]).toBe(-2279)
    expect(useStore.getState().paletteOpen).toBe(false)
  })
  it('arrow keys move the selection; Escape closes', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'w' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(useStore.getState().paletteOpen).toBe(false)
  })
  it('time and quality commands are searchable', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: '/' })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'night' } })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(useStore.getState().timePreset).toBe('NIGHT')
  })
  it('⌘K and Ctrl+K close the palette from inside its input (G4)', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'k', metaKey: true })
    expect(useStore.getState().paletteOpen).toBe(false)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const notPrevented = fireEvent.keyDown(screen.getByRole('combobox'), { key: 'K', ctrlKey: true, shiftKey: true })
    expect(notPrevented).toBe(false) // the browser's own Ctrl+K search never sees it
    expect(useStore.getState().paletteOpen).toBe(false)
  })
  it('Ctrl+K on the page opens the palette and stops the browser default', () => {
    render(<CommandPalette />)
    expect(fireEvent.keyDown(window, { key: 'k', ctrlKey: true })).toBe(false)
    expect(useStore.getState().paletteOpen).toBe(true)
  })
  it('plain k types into the search (review focus)', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const input = screen.getByRole('combobox')
    expect(fireEvent.keyDown(input, { key: 'k' })).toBe(true)
    fireEvent.change(input, { target: { value: 'k' } })
    expect(useStore.getState().paletteOpen).toBe(true)
  })
  it('"tonight" finds tonight’s game; Enter flies there and opens the venue card', async () => {
    const { useSports } = await import('../../sports/sportsStore.js')
    const W = { key: 'wrigleyfield', name: 'Wrigley Field', kind: 'baseball', teams: ['cubs'], center: [-2292, -7339], frame: { origin: [-2325, -7319], axis: [0.70711, -0.70711] } }
    useSports.setState({ venues: [W], states: { wrigleyfield: { state: 'live', game: { id: 'x', sport: 'baseball', start: '2026-06-05T18:20:00Z', home: { abbr: 'CHC' }, away: { abbr: 'NYM' } } } } })
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tonight' } })
    expect(screen.getAllByRole('option')[0]).toHaveTextContent("Go to tonight's game")
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(useStore.getState().flight.label).toBe('Wrigley Field')
    expect(useSports.getState().cardVenue).toBe('wrigleyfield')
  })
})
