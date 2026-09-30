import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CommandPalette from '../../hud/CommandPalette.jsx'
import { transitPlaces } from '../palette.js'
import { lineFramePose } from '../actions.js'
import { useStore } from '../../state/store.js'
import { TRANSIT } from './fixtures.js'

const at = (iso) => vi.useFakeTimers({ now: new Date(iso), toFake: ['Date'] })
describe('transit in ⌘K', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useStore.setState({ transit: TRANSIT }) })
  afterEach(() => vi.useRealTimers())
  it('lists Go to <station>, Show <line>, Follow a <line> train', () => {
    at('2026-09-30T08:15:00-05:00')
    const names = transitPlaces(useStore.getState()).map((p) => p.name)
    for (const n of ['Go to A', 'Show red line', 'Follow a red line train', 'Show bnsf line', 'Follow a Metra train']) expect(names).toContain(n)
    expect(transitPlaces({ transit: null })).toEqual([])
  })
  it('no service: honest sub-text, no throw', () => {
    at('2026-09-30T12:00:00-05:00')
    const purple = transitPlaces(useStore.getState()).find((p) => p.name === 'Follow a purple line train')
    expect(purple.sub).toBe('No trains right now')
    expect(() => purple.run()).not.toThrow()
    expect(useStore.getState().follow).toBeNull(); expect(useStore.getState().followEnded).toBe('none')
  })
  it('Show <line> unhides it and frames it; Go to <station> flies there and opens its card', () => {
    at('2026-09-30T08:15:00-05:00')
    useStore.setState({ hiddenLines: ['red'], transitOn: false })
    const places = transitPlaces(useStore.getState())
    places.find((p) => p.name === 'Show red line').run()
    expect(useStore.getState().hiddenLines).toEqual([]); expect(useStore.getState().transitOn).toBe(true)
    expect(useStore.getState().flight.label).toBe('red line')
    expect(lineFramePose(TRANSIT, 'red').target).toEqual([0, 0, 0])
    places.find((p) => p.name === 'Go to A').run()
    expect(useStore.getState().flight.label).toBe('A'); expect(useStore.getState().selection).toEqual({ kind: 'station', id: 'st-a' })
  })
  it('the palette shows a Transit group and follows a train on Enter', () => {
    at('2026-09-30T08:15:00-05:00')
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'follow a red' } })
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Follow a red line train')
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(useStore.getState().follow?.trainId).toMatch(/^svc-r1:/)
  })
})
