// app/src/hud/__tests__/work.test.jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WorkPanel from '../panels/WorkPanel.jsx'
import { useStore } from '../../state/store.js'

describe('WORK panel', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); useStore.getState().setLens('WORK') })
  it('arms "Set office" and always shows the estimate label', () => {
    render(<WorkPanel />)
    expect(screen.getByText('ESTIMATE · simplified transit model')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /set office/i }))
    expect(useStore.getState().officeArmed).toBe(true)
  })
})

import { bandColour } from '../panels/WorkPanel.jsx'
describe('WORK rows wear their map colour (user, 2026-09-30)', () => {
  it('cyan under 15 min, amber to 30, red beyond — the isochrone shells', () => {
    expect(bandColour(10)).toBe(bandColour(14.9))
    expect(bandColour(15)).not.toBe(bandColour(10))
    expect(bandColour(29)).toBe(bandColour(20))
    expect(bandColour(31)).not.toBe(bandColour(20))
  })
})
