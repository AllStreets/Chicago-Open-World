// app/src/hud/__tests__/placePopup.test.jsx — the small place card next to a pin (P4 user fixes).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import PlacePopup from '../PlacePopup.jsx'
import { usePlacePopup } from '../placePopup.js'

vi.mock('../../world/PoiPins.jsx', () => ({ pinScreen: () => ({ sx: 400, sy: 300, visible: true }) }))
const zarella = { id: 'n1', n: 'Zarella Pizzeria', c: 0, x: 0, y: 30, z: 0, a: '531 N Wells St', t: { cuisine: 'pizza', opening_hours: '24/7', website: 'https://www.zarellachicago.com' } }

describe('place popup', () => {
  beforeEach(() => act(() => usePlacePopup.getState().close()))
  it('shows the name, category and cuisine, today\'s hours, the address and a Website button', () => {
    act(() => usePlacePopup.getState().open(zarella))
    render(<PlacePopup />)
    expect(screen.getByText('Zarella Pizzeria')).toBeInTheDocument()
    expect(screen.getByText(/Food · pizza/)).toBeInTheDocument()
    expect(screen.getByText('Open 24 hours')).toBeInTheDocument()
    expect(screen.getByText('531 N Wells St')).toBeInTheDocument()
    const site = screen.getByRole('link', { name: /website/i })
    expect(site).toHaveAttribute('href', 'https://www.zarellachicago.com'); expect(site).toHaveAttribute('target', '_blank')
  })
  it('offers a web search when no website is known', () => {
    act(() => usePlacePopup.getState().open({ ...zarella, t: {} }))
    render(<PlacePopup />)
    expect(screen.getByRole('link', { name: /search the web/i })).toHaveAttribute('href', expect.stringContaining('Zarella%20Pizzeria%20Chicago'))
  })
  it('closes on a click anywhere else and on Esc, but not on a click inside it', () => {
    act(() => usePlacePopup.getState().open(zarella))
    render(<PlacePopup />)
    fireEvent.pointerDown(screen.getByText('Zarella Pizzeria'))
    expect(usePlacePopup.getState().poi).not.toBeNull()
    fireEvent.pointerDown(document.body)
    expect(usePlacePopup.getState().poi).toBeNull()
    act(() => usePlacePopup.getState().open(zarella))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(usePlacePopup.getState().poi).toBeNull()
  })
})
