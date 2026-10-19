import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import FirstFlight, { SEEN_KEY, START_DELAY_MS } from '../FirstFlight.jsx'
import { useStore } from '../../state/store.js'

const setLoad = (patch) => act(() => useStore.setState({ load: { ...useStore.getState().load, ...patch } }))
const ready = () => {
  setLoad({ total: 3, done: 3, keys: ['a', 'b', 'c'], ready: true })
  act(() => vi.advanceTimersByTime(START_DELAY_MS))
}

describe('FirstFlight', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useStore.setState(useStore.getInitialState())
    localStorage.clear()
  })
  afterEach(() => vi.useRealTimers())

  it('stays hidden until the world has loaded', () => {
    render(<FirstFlight />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('ignores the moment at boot when ready is true but nothing is counted yet', () => {
    render(<FirstFlight />)
    setLoad({ total: 0, ready: true })
    act(() => vi.advanceTimersByTime(START_DELAY_MS))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('waits for the loading screen to fade, and cancels if loading resumes', () => {
    render(<FirstFlight />)
    setLoad({ total: 3, done: 3, keys: ['a', 'b', 'c'], ready: true })
    act(() => vi.advanceTimersByTime(START_DELAY_MS / 2))
    expect(screen.queryByRole('status')).toBeNull()
    setLoad({ total: 5, ready: false })
    act(() => vi.advanceTimersByTime(START_DELAY_MS))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('stays hidden for a returning visitor', () => {
    localStorage.setItem(SEEN_KEY, '1')
    render(<FirstFlight />)
    ready()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('advances only when each control is actually used, then remembers', () => {
    const { container } = render(<><canvas /><FirstFlight /></>)
    ready()
    expect(screen.getByText('Look around')).toBeInTheDocument()

    // a click without movement is not a drag
    const canvas = container.querySelector('canvas')
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100 })
    fireEvent.pointerUp(window)
    expect(screen.getByText('Look around')).toBeInTheDocument()

    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100 })
    fireEvent.pointerMove(window, { clientX: 160, clientY: 120 })
    expect(screen.getByText('Fly')).toBeInTheDocument()

    fireEvent.keyDown(window, { code: 'KeyQ' })
    expect(screen.getByText('Fly')).toBeInTheDocument()
    fireEvent.keyDown(window, { code: 'KeyW' })
    expect(screen.getByText('Go somewhere')).toBeInTheDocument()

    act(() => useStore.getState().setPaletteOpen(true))
    expect(screen.queryByRole('status')).toBeNull()
    expect(localStorage.getItem(SEEN_KEY)).toBe('1')
  })

  it('Skip ends it and remembers', () => {
    render(<FirstFlight />)
    ready()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.queryByRole('status')).toBeNull()
    expect(localStorage.getItem(SEEN_KEY)).toBe('1')
  })
})
