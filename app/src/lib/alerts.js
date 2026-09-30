// app/src/lib/alerts.js — CTA service alerts (CHI /api/cta/alerts) → a pulse per L line (P4 · C17): the worst
// impact on each line sets how strongly its glow breathes; bus routes and informational notes are ignored.
export const SEVERITY = { 'Significant Delays': 1, 'Minor Delays': 0.6, 'Service Change': 0.5, 'Planned Reroute': 0.4, 'Planned Work': 0.3, 'Added Service': 0, 'Elevator Status': 0, 'Special Note': 0.1 }
const LINE_RE = /^(Red|Blue|Brown|Green|Orange|Pink|Purple|Yellow) Line/i

export function alertsToLinePulses(payload) {
  const out = new Map()
  const alerts = Array.isArray(payload?.alerts) ? payload.alerts : []
  for (const a of alerts) {
    const sev = SEVERITY[a?.impact] ?? 0
    if (!(sev > 0) || !Array.isArray(a.affected)) continue
    for (const name of a.affected) {
      const m = LINE_RE.exec(String(name ?? ''))
      if (!m) continue
      const id = m[1].toLowerCase(), cur = out.get(id) ?? { severity: 0, headlines: [] }
      cur.severity = Math.max(cur.severity, sev)
      if (a.headline && !cur.headlines.includes(a.headline)) cur.headlines.push(a.headline)
      out.set(id, cur)
    }
  }
  return out
}
