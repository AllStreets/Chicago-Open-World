import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Hud from '../Hud.jsx'
import { useStore } from '../../state/store.js'

describe('Hud', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))

  it('shows wordmark and the live camera readout', () => {
    useStore.setState({ readout: { streets: 'MICHIGAN & OHIO', altitude: 240, heading: 312 } })
    const { container } = render(<Hud />)
    expect(container.querySelector('.wm-logo')).toHaveTextContent('CHI ATLAS')
    expect(container.querySelector('.wm-sub')).toHaveTextContent('OPEN WORLD')
    expect(screen.getByText(/MICHIGAN & OHIO/)).toBeInTheDocument()
    expect(screen.getByText(/240 M ALT/)).toBeInTheDocument()
  })
  it('time pills set the preset; the active one is marked', () => {
    render(<Hud />)
    fireEvent.click(screen.getByRole('button', { name: 'DUSK' }))
    expect(useStore.getState().timePreset).toBe('DUSK')
    expect(screen.getByRole('button', { name: 'DUSK' })).toHaveClass('active')
  })
  it('number keys pick presets and O toggles orbit', () => {
    render(<Hud />)
    fireEvent.keyDown(window, { code: 'Digit5' })
    expect(useStore.getState().timePreset).toBe('NIGHT')
    fireEvent.keyDown(window, { code: 'KeyO' })
    expect(useStore.getState().cameraMode).toBe('ORBIT')
  })
  it('loading screen shows progress, then an error chip instead of hanging', () => {
    useStore.getState().setLoadTotal(4)
    useStore.getState().markLoaded('t1')
    const { rerender } = render(<Hud />)
    expect(screen.getByText(/25%/)).toBeInTheDocument()
    useStore.getState().setLoadError('manifest HTTP 404')
    rerender(<Hud />)
    expect(screen.getByText(/WORLD DATA UNAVAILABLE/)).toBeInTheDocument()
  })
  it('Q cycles quality', () => {
    render(<Hud />)
    fireEvent.keyDown(window, { code: 'KeyQ' })
    expect(useStore.getState().quality).toBe('ULTRA')
  })
})
