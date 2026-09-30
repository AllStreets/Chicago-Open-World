// app/src/hud/__tests__/lensPalette.test.jsx — the lenses from ⌘K and the help card (P4 Task 1, human-first B.1.4).
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useStore } from '../../state/store.js'
import { lensCommands } from '../../lib/paletteSources.js'
import HelpOverlay from '../HelpOverlay.jsx'

describe('lenses in ⌘K and help', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('⌘K has Lens: Visit / Live / Work and Close lens, in the Guide section', () => {
    const c = lensCommands()
    expect(c.map((x) => x.name)).toEqual(['Lens: Visit', 'Lens: Live', 'Lens: Work', 'Close lens'])
    expect(new Set(c.map((x) => x.kind))).toEqual(new Set(['guide']))
    c[2].run(); expect(useStore.getState().lens).toBe('WORK')
    c[2].run(); expect(useStore.getState().lens).toBe('WORK') // a command opens; only the rail toggles
    c[3].run(); expect(useStore.getState().lens).toBeNull()
  })
  it('the help card has a Guide group', () => {
    useStore.setState({ helpOpen: true })
    render(<HelpOverlay />)
    expect(screen.getByText('Guide')).toBeInTheDocument()
    expect(screen.getByText(/Visit, Live, Work/)).toBeInTheDocument()
    expect(screen.getByText(/close the card/i)).toBeInTheDocument()
  })
})
