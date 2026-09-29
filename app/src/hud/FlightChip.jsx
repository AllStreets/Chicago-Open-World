// app/src/hud/FlightChip.jsx — "FLYING TO …" while a fly-over runs.
import { useStore } from '../state/store.js'

export default function FlightChip() {
  const f = useStore((s) => s.flight)
  if (!f?.label) return null
  return <div className="hud-chip live flight-chip"><span className="dot" />Flying to {f.label}</div>
}
