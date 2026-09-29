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
})
