// app/src/transit/palette.js — ⌘K entries for transit (C14): Go to <station>, Show <line>, Follow a <line> train.
import { getSim } from './simStore.js'
import { followNearest, showLine, goToStation } from './actions.js'

export function transitPlaces(state) {
  const t = state.transit
  if (!t) return []
  const running = new Set((getSim()?.trainsAt(Date.now()) ?? []).filter((x) => x.cars[0]).map((x) => x.line))
  const names = new Map(t.lines.map((l) => [l.id, l.name]))
  const out = t.stations.map((st) => ({
    id: `st:${st.id}`, name: `Go to ${st.name}`, aliases: [st.name],
    sub: `${st.lines.map((l) => names.get(l)).filter(Boolean).join(' · ') || 'Station'} · Station`, run: () => goToStation(st),
  }))
  for (const l of t.lines) {
    out.push({ id: `ln:${l.id}`, name: `Show ${l.name}`, sub: l.operator === 'cta' ? 'CTA L line' : 'Metra line', run: () => showLine(l.id) })
    out.push({ id: `fo:${l.id}`, name: `Follow a ${l.name} train`, sub: running.has(l.id) ? 'Ride along · any key stops' : 'No trains right now', run: () => { followNearest(l.id) } })
  }
  if (t.lines.some((l) => l.operator === 'metra')) out.push({ id: 'fo:metra', name: 'Follow a Metra train', sub: 'Any Metra line · any key stops', run: () => { followNearest('metra') } })
  return out
}
