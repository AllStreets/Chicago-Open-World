// app/src/scan/__tests__/scanKeys.test.jsx — Scan is reachable by key, pill, ⌘K and help (P5 Task 5; V, since X is Fireworks).
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ControlPills from '../../hud/ControlPills.jsx'
import HelpOverlay from '../../hud/HelpOverlay.jsx'
import LivePanel from '../../hud/panels/LivePanel.jsx'
import { useStore } from '../../state/store.js'
import { useFeatureKeys } from '../../hud/useFeatureKeys.js'
import { featureCommands } from '../../lib/paletteSources.js'

function Keys() { useFeatureKeys(); return null }
describe('Scan controls', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState()))
  it('V toggles Scan; S still moves (never toggles Scan); X stays Fireworks', () => {
    render(<Keys />)
    fireEvent.keyDown(window, { code: 'KeyV', key: 'v' }); expect(useStore.getState().scan).toBe(true)
    fireEvent.keyDown(window, { code: 'KeyS', key: 's' }); expect(useStore.getState().scan).toBe(true)
    fireEvent.keyDown(window, { code: 'KeyX', key: 'x' }); expect(useStore.getState().scan).toBe(true)
    fireEvent.keyDown(window, { code: 'KeyV', key: 'v' }); expect(useStore.getState().scan).toBe(false)
  })
  it('ignored while the palette is open', () => {
    render(<Keys />)
    useStore.getState().setPaletteOpen(true)
    fireEvent.keyDown(window, { code: 'KeyV', key: 'v' }); expect(useStore.getState().scan).toBe(false)
  })
  it('the SCAN pill toggles and reports its state', () => {
    render(<ControlPills />)
    const pill = screen.getByRole('button', { name: /scan/i })
    fireEvent.click(pill); expect(pill).toHaveAttribute('aria-pressed', 'true'); expect(useStore.getState().scan).toBe(true)
  })
  it('⌘K and the help card both name it', () => {
    expect(featureCommands().some((c) => /scan/i.test(c.name))).toBe(true)
    useStore.getState().setHelpOpen(true)
    render(<HelpOverlay />)
    expect(screen.getAllByText(/Scan/).length).toBeGreaterThan(0)
  })
  it('the Live panel picks what the Scan columns show (and turns Scan on)', () => {
    useStore.setState({ hoods: [{ id: 'loop', name: 'The Loop', label: [0, 0], feel: { transit: 10 } }] })
    render(<LivePanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Nightlife' }))
    expect(useStore.getState().scanMetric).toBe('nightlife'); expect(useStore.getState().scan).toBe(true)
  })
})
