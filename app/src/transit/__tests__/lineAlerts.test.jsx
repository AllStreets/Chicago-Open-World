// app/src/transit/__tests__/lineAlerts.test.jsx — alerts reach the glow and the legend (P4 Task 2, C17).
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { applyLineAlerts, ALERT_FIXTURE } from '../lineAlerts.js'
import { setLineIndex, resetLineEmphasis, lineEmphasisState } from '../lineEmphasis.js'
import { useStore } from '../../state/store.js'
import TransitLegend from '../../hud/TransitLegend.jsx'

const lines = [{ id: 'red', name: 'Red Line', operator: 'cta', colour: '#c60c30', index: 0 }, { id: 'blue', name: 'Blue Line', operator: 'cta', colour: '#00a1de', index: 1 }]
describe('line alerts', () => {
  beforeEach(() => { useStore.setState(useStore.getInitialState()); setLineIndex(lines); resetLineEmphasis() })
  it('an alert pulses its line and is kept for the legend; a failed fetch (null) clears it', () => {
    applyLineAlerts(ALERT_FIXTURE)
    expect(lineEmphasisState().pulse[0]).toBe(1)
    expect(useStore.getState().lineAlerts.red.headlines.length).toBeGreaterThan(0)
    applyLineAlerts(null)
    expect(lineEmphasisState().pulse[0]).toBe(0)
    expect(useStore.getState().lineAlerts).toEqual({})
  })
  it('the legend marks an alerted line and names the alert', () => {
    useStore.setState({ transit: { lines, routes: [], stations: [] }, transitOn: true })
    applyLineAlerts(ALERT_FIXTURE)
    render(<TransitLegend />)
    expect(screen.getByRole('button', { name: /Red Line.*alert/i })).toHaveAttribute('title', expect.stringMatching(/delay/i))
  })
})
