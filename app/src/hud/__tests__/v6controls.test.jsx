import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { commands } from '../CommandPalette.jsx'
import HelpOverlay from '../HelpOverlay.jsx'
import HintBar from '../HintBar.jsx'
import { useStore } from '../../state/store.js'

describe('V6 controls are discoverable', () => {
  it('⌘K, help card and hint bar offer the bridge lift', () => {
    expect(commands().some((c) => c.name === 'Raise the river bridges')).toBe(true)
    useStore.getState().setHelpOpen(true)
    render(<><HelpOverlay /><HintBar /></>)
    expect(screen.getByText(/raise the river bridges/i)).toBeInTheDocument()
    expect(screen.getByText('bridges')).toBeInTheDocument()
  })
  it('⌘K, help card and hint bar offer the fountain show', () => {
    expect(commands().some((c) => c.name === 'Buckingham Fountain water show')).toBe(true)
    useStore.getState().setHelpOpen(true)
    render(<><HelpOverlay /><HintBar /></>)
    expect(screen.getByText(/play the Buckingham Fountain water show/i)).toBeInTheDocument()
    expect(screen.getByText('fountain')).toBeInTheDocument()
  })
})
