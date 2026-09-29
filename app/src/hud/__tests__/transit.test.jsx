import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import Hud from '../Hud.jsx'
import { useStore } from '../../state/store.js'

const transit = { lines: [
  { id: 'red', name: 'Red Line', operator: 'cta', colour: '#c60c30', index: 0 },
  { id: 'up-n', name: 'Union Pacific North', operator: 'metra', colour: '#005596', index: 8 },
], routes: [], stations: [] }

describe('transit HUD', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState()); useStore.setState({ transit })
    try { localStorage.setItem('chi-ow-help-seen', '1') } catch {}
  })
  it('the Transit dock button turns lines, glow and legend off and on', () => {
    render(<Hud />)
    expect(screen.getByRole('group', { name: 'Transit lines' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Transit lines: on (T)' }))
    expect(useStore.getState().transitOn).toBe(false)
    expect(screen.queryByRole('group', { name: 'Transit lines' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Transit lines: off (T)' })).toHaveAttribute('aria-pressed', 'false')
  })
  it('each line has its own switch; All / None', () => {
    render(<Hud />)
    const red = screen.getByRole('button', { name: /Red Line/ })
    expect(red).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(red)
    expect(useStore.getState().hiddenLines).toEqual(['red'])
    fireEvent.click(screen.getByRole('button', { name: 'None' })); expect(useStore.getState().hiddenLines).toEqual(['red', 'up-n'])
    fireEvent.click(screen.getByRole('button', { name: 'All' })); expect(useStore.getState().hiddenLines).toEqual([])
    expect(screen.getByText('Metra')).toBeInTheDocument()
  })
  it('T toggles transit, but not while typing', () => {
    render(<Hud />)
    fireEvent.keyDown(window, { code: 'KeyT' }); expect(useStore.getState().transitOn).toBe(false)
    const input = document.createElement('input'); document.body.appendChild(input)
    fireEvent.keyDown(input, { code: 'KeyT' }); expect(useStore.getState().transitOn).toBe(false)
    input.remove()
  })
  it('without transit data the button is disabled and nothing breaks', () => {
    useStore.setState({ transit: null })
    render(<Hud />)
    const b = screen.getByRole('button', { name: 'Transit lines: data unavailable' })
    expect(b).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(b); fireEvent.keyDown(window, { code: 'KeyT' })
    expect(useStore.getState().transitOn).toBe(true)
    expect(screen.queryByRole('group', { name: 'Transit lines' })).toBeNull()
  })
  it('⌘K, the help card and the hint bar know transit', () => {
    render(<Hud />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'transit' } })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(useStore.getState().transitOn).toBe(false)
    act(() => useStore.getState().setHelpOpen(true))
    expect(screen.getByText(/CTA and Metra lines, their glow and the legend/)).toBeInTheDocument()
    expect(document.querySelector('.hud-hints').textContent).toMatch(/T\s*transit/)
  })
})
