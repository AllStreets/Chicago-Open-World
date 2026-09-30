import { describe, it, expect, beforeEach } from 'vitest'
import TransitLegend from '../TransitLegend.jsx'
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
    fireEvent.click(screen.getByRole('button', { name: 'Transit (T)' }))
    expect(useStore.getState().transitOn).toBe(false)
    expect(screen.queryByRole('group', { name: 'Transit lines' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Transit (T)' })).toHaveAttribute('aria-pressed', 'false')
  })
  it('each line has its own switch; All / None', () => {
    render(<Hud />)
    const red = screen.getByRole('button', { name: /Red Line/ })
    expect(red).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(red)
    expect(useStore.getState().hiddenLines).toEqual(['red'])
    fireEvent.click(screen.getByRole('button', { name: 'None' })); expect(useStore.getState().hiddenLines).toEqual(['red', 'up-n'])
    fireEvent.click(screen.getByRole('button', { name: 'All' })); expect(useStore.getState().hiddenLines).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Expand legend' })) // compact by default since V8
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
    const b = screen.getByRole('button', { name: 'Transit (T)' })
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
    expect(screen.getByText(/CTA and Metra lines, their glow/)).toBeInTheDocument()
    expect(document.querySelector('.hud-hints').textContent).toMatch(/T\s*transit/)
  })
})

describe('compact legend (V8 polish)', () => {
  it('starts collapsed as a swatch strip; the swatches still switch lines; expand shows the full list', () => {
    useStore.setState({ ...useStore.getInitialState(), transit: { lines: [{ id: 'red', name: 'Red Line', operator: 'cta', colour: '#c60c30' }, { id: 'bnsf', name: 'BNSF', operator: 'metra', colour: '#1f5aa6' }], routes: [], stations: [] }, transitOn: true })
    render(<TransitLegend />)
    expect(screen.queryByText('Metra')).toBeNull()                       // collapsed: no group lists
    fireEvent.click(screen.getByRole('button', { name: 'Red Line' }))
    expect(useStore.getState().hiddenLines).toEqual(['red'])
    fireEvent.click(screen.getByRole('button', { name: 'Expand legend' }))
    expect(screen.getByText('Metra')).toBeInTheDocument()
  })
})
