// app/src/transit/actions.js — what the transit buttons and ⌘K entries do.
import { useStore } from '../state/store.js'
import { getSim } from './simStore.js'

export function followNearest(spec, ms = Date.now()) {
  const s = useStore.getState(), sim = getSim()
  if (!sim) { s.stopFollow('none'); return false }
  const ops = new Map((s.transit?.lines ?? []).map((l) => [l.id, l.operator]))
  const want = (t) => spec === 'any' || (spec === 'metra' ? ops.get(t.line) === 'metra' : t.line === spec)
  const here = [s.readout.x ?? 0, s.readout.z ?? 0]
  const d = (t) => Math.hypot(t.head.p[0] - here[0], t.head.p[2] - here[1])
  const best = sim.trainsAt(ms).filter((t) => want(t) && t.cars[0]).sort((a, b) => d(a) - d(b))[0]
  if (!best) { s.stopFollow('none'); return false }
  s.setTransitOn(true)
  s.setHiddenLines(s.hiddenLines.filter((x) => x !== best.line))
  s.startFollow(best.id)
  return true
}
