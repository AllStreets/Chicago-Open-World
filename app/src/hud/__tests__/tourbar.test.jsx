// app/src/hud/__tests__/tourbar.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TourBar from '../TourBar.jsx'
import { useStore } from '../../state/store.js'

describe('tour bar', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useStore.getState().setTour({ id: 'river', t: 0, playing: true }) })
  it('pauses with the button and with Space, and exits with Esc', () => {
    render(<TourBar />)
    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    expect(useStore.getState().tour.playing).toBe(false)
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    expect(useStore.getState().tour.playing).toBe(true)
    fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' })
    expect(useStore.getState().tour).toBeNull()
  })
})
