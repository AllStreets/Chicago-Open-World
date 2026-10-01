// app/src/hud/__tests__/weatherPill.test.jsx — a non-coder picks the weather from a button (P5 Task 4).
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ControlPills from '../ControlPills.jsx'
import { useStore } from '../../state/store.js'
import { commands } from '../CommandPalette.jsx'

describe('Weather pill', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('a non-coder can pick rain and go back to live', () => {
    render(<ControlPills />)
    fireEvent.click(screen.getByRole('button', { name: /weather/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rain' }))
    expect(useStore.getState().weatherMode).toBe('RAIN')
    expect(useStore.getState().weather.kind).toBe('rain')
    expect(screen.queryByRole('menu')).toBeNull() // a choice closes the menu
    fireEvent.click(screen.getByRole('button', { name: /weather/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /live/i }))
    expect(useStore.getState().weatherMode).toBe('LIVE')
  })
  it('the live weather arrives through the store and Live mode follows it', () => {
    useStore.getState().setWeatherLive({ kind: 'snow', intensity: 0.6, source: 'live', label: 'snow' })
    expect(useStore.getState().weather.kind).toBe('snow')
    useStore.getState().setWeatherMode('CLEAR')
    useStore.getState().setWeatherLive({ kind: 'rain', intensity: 0.6, source: 'live', label: 'rain' })
    expect(useStore.getState().weather.kind).toBe('clear') // a chosen sky holds until Live is chosen again
  })
  it('⌘K has a Weather entry for each choice', () => {
    const names = commands().map((c) => c.name)
    for (const n of ['Weather: Live Chicago weather', 'Weather: Rain', 'Weather: Snow', 'Weather: Lake fog', 'Weather: Clear', 'Weather: Overcast']) expect(names).toContain(n)
  })
})
