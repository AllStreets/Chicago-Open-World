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
  it('quality lives on the control dock (Q now turns the camera)', () => {
    render(<Hud />)
    fireEvent.click(screen.getByRole('button', { name: /quality/i }))
    expect(useStore.getState().quality).toBe('ULTRA')
  })
})

describe('responsive HUD', () => {
  it('scales as one piece to the window and hides the hint bar when compact', async () => {
    const { act } = await import('@testing-library/react')
    window.innerWidth = 600; window.innerHeight = 900
    const { container } = render(<Hud />)
    await act(async () => { window.dispatchEvent(new Event('resize')) })
    const root = container.querySelector('.hud-root')
    expect(root.style.zoom).toBe('0.55')
    expect(root).toHaveAttribute('data-compact', 'true')
  })
})

import { FEATURE_CONTROLS } from '../featureControls.js'
describe('dock feature row (G3)', () => {
  beforeEach(() => useStore.setState({ ...useStore.getInitialState(), transit: { lines: [], routes: [], stations: [] } }))
  it('has exactly one button per dock feature anywhere in the HUD, pressed state tracks the feature (Sound lives on M)', () => {
    render(<Hud />)
    for (const c of FEATURE_CONTROLS.filter((f) => f.id !== 'sound')) {
      const btns = screen.getAllByRole('button', { name: new RegExp(`^${c.label} \\(${c.keyLabel}\\)$`) })
      expect(btns, c.id).toHaveLength(1)
      const was = c.isOn()
      expect(btns[0]).toHaveAttribute('aria-pressed', String(was))
      fireEvent.click(btns[0])
      expect(c.isOn(), c.id).toBe(!was)
      expect(screen.getByRole('button', { name: new RegExp(`^${c.label} \\(`) })).toHaveAttribute('aria-pressed', String(!was))
    }
  })
})

describe('left stack (V7 Task 6)', () => {
  it('side panels live in one left stack under the wordmark', async () => {
    const { useSports } = await import('../../sports/sportsStore.js')
    useStore.setState({ ...useStore.getInitialState(), transit: { lines: [{ id: 'red', name: 'Red Line', colour: '#c60c30', operator: 'cta' }], routes: [], stations: [] }, transitOn: true, gamesOpen: true })
    useSports.setState({ venues: [{ key: 'wrigleyfield', name: 'Wrigley Field', kind: 'baseball', teams: ['cubs'], center: [0, 0] }], states: {} })
    const { container } = render(<Hud />)
    const stack = container.querySelector('.hud-left-stack')
    expect(stack).not.toBeNull()
    let seen = 0
    for (const sel of ['.transit-legend', '.games', '.venue-card', '.transit-card']) {
      const el = container.querySelector(sel)
      if (el) { seen++; expect(stack.contains(el), sel).toBe(true) }
    }
    expect(seen).toBeGreaterThanOrEqual(2)
  })
})
