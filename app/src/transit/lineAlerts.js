// app/src/transit/lineAlerts.js — CTA alerts from the CHI ATLAS API → line pulses and the legend's alert markers
// (P4 · C17). Polled every 5 minutes while the transit lines or a lens are showing; offline (null) there are none.
import { useEffect } from 'react'
import { useStore } from '../state/store.js'
import { chiGet } from '../services/chiApi.js'
import { alertsToLinePulses } from '../lib/alerts.js'
import { setLinePulse, resetLineEmphasis } from './lineEmphasis.js'

export const ALERTS_EVERY_MS = 5 * 60 * 1000
// ?alerts=fixture (tests only): one significant delay on the Red Line
export const ALERT_FIXTURE = { alerts: [{ id: 'fx1', headline: 'Red Line: significant delays near Chicago', impact: 'Significant Delays', affected: ['Red Line'] }] }

export function applyLineAlerts(payload) {
  const pulses = alertsToLinePulses(payload), lineAlerts = {}
  const { lineAlerts: before } = useStore.getState()
  for (const id of Object.keys(before ?? {})) setLinePulse(id, 0)
  for (const [id, a] of pulses) { setLinePulse(id, a.severity); lineAlerts[id] = a }
  useStore.setState({ lineAlerts })
}

export function useLineAlerts() {
  const on = useStore((s) => s.transitOn || s.lens != null)
  useEffect(() => {
    if (!on) return undefined
    if (new URLSearchParams(window.location.search).get('alerts') === 'fixture') { applyLineAlerts(ALERT_FIXTURE); return undefined }
    let alive = true
    const poll = () => chiGet('/api/cta/alerts').then((p) => { if (alive) applyLineAlerts(p) })
    poll()
    const id = setInterval(poll, ALERTS_EVERY_MS)
    return () => { alive = false; clearInterval(id) }
  }, [on])
}
export { resetLineEmphasis }
