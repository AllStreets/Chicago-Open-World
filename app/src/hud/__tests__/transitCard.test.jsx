import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TransitCard from '../TransitCard.jsx'
import WordmarkBlock from '../WordmarkBlock.jsx'
import { useStore } from '../../state/store.js'
import { getSim } from '../../transit/simStore.js'
import { TRANSIT } from '../../transit/__tests__/fixtures.js'

describe('transit cards', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-09-30T08:15:00-05:00'), toFake: ['Date'] })
    useStore.setState(useStore.getInitialState()); useStore.setState({ transit: TRANSIT })
  })
  afterEach(() => vi.useRealTimers())
  it('a station card lists simulated arrivals and flies there', () => {
    useStore.getState().select({ type: 'station', id: 'st-a' })
    render(<TransitCard />)
    const card = screen.getByRole('dialog', { name: 'A' })
    expect(card).toHaveTextContent('Arrivals'); expect(card).toHaveTextContent('SIMULATED')
    expect(screen.getAllByText(/red line · to Loop/).length).toBeGreaterThanOrEqual(5)
    fireEvent.click(screen.getByRole('button', { name: 'Fly here' }))
    expect(useStore.getState().flight.label).toBe('A')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(useStore.getState().selection).toBeNull()
  })
  it('a train card: line, run, destination, next stop; Follow rides along', () => {
    const t = getSim().trainsAt(Date.now()).find((x) => x.line === 'red' && x.nextStop)
    useStore.getState().select({ type: 'train', id: t.id })
    const { rerender } = render(<TransitCard />)
    expect(screen.getByRole('dialog')).toHaveTextContent(`Run ${t.rn}`)
    expect(screen.getByText('To Loop')).toBeInTheDocument(); expect(screen.getByText(/Next stop (A|B)/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Follow this train/ }))
    expect(useStore.getState().follow.trainId).toBe(t.id)
    rerender(<TransitCard />)
    expect(screen.getByRole('button', { name: 'Stop following' })).toBeInTheDocument()
  })
  it('a train that has gone says so', () => {
    useStore.getState().select({ type: 'train', id: 'svc-r1:1999-01-01:0' })
    render(<TransitCard />)
    expect(screen.getByText('This train has left the map')).toBeInTheDocument()
  })
  it('the top-left chip reads SIMULATED once transit is loaded', () => {
    const { rerender } = render(<WordmarkBlock />)
    expect(screen.getByText('SIMULATED')).toBeInTheDocument()
    useStore.setState({ transit: null }); rerender(<WordmarkBlock />)
    expect(screen.queryByText('SIMULATED')).toBeNull()
  })
})
