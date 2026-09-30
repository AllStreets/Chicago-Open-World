// app/src/hud/__tests__/lens.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LensRail from '../LensRail.jsx'
import ContextPanel from '../ContextPanel.jsx'
import { useStore } from '../../state/store.js'

describe('lens rail + context panel', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('buttons switch lens and toggle off when pressed again', () => {
    render(<LensRail />)
    fireEvent.click(screen.getByRole('button', { name: /visit/i }))
    expect(useStore.getState().lens).toBe('VISIT')
    expect(screen.getByRole('button', { name: /visit/i })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /visit/i }))
    expect(useStore.getState().lens).toBeNull()
  })
  it('panel shows a selection card and closes on Esc and on the close button', () => {
    useStore.getState().select({ kind: 'building', id: '0_0:12', data: { name: 'Rookery', address: '209 S LaSalle', stories: 12, year: 1888 } })
    render(<ContextPanel />)
    expect(screen.getByText('Rookery')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useStore.getState().selection).toBeNull()
  })
})
