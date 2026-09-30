// app/src/hud/LensRail.jsx — the guide's three lenses (P4): VISIT (landmarks, tours), LIVE (neighbourhoods),
// WORK (commutes). A tab strip at the top centre; pressing the active lens again closes it. Also on ⌘K.
import { RiCompass3Line, RiHome4Line, RiBriefcase4Line } from 'react-icons/ri'
import { useStore } from '../state/store.js'
import './LensRail.css'

export const LENSES = [
  { id: 'VISIT', label: 'Visit', icon: RiCompass3Line, help: 'landmarks, places and guided tours' },
  { id: 'LIVE', label: 'Live', icon: RiHome4Line, help: 'neighborhoods: character, rents and how they feel' },
  { id: 'WORK', label: 'Work', icon: RiBriefcase4Line, help: 'set an office and see how far the L gets you' },
]

export default function LensRail() {
  const lens = useStore((s) => s.lens), setLens = useStore((s) => s.setLens)
  return (
    <nav className="lens-rail hud-panel" aria-label="Guide lenses">
      {LENSES.map(({ id, label, icon: Icon, help }) => (
        <button key={id} type="button" className={`lens-btn${lens === id ? ' on' : ''}`} aria-pressed={lens === id} title={`${label} — ${help}`} onClick={() => setLens(id)}>
          <Icon aria-hidden="true" /><span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
