// app/src/hud/ContextPanel.jsx — the guide's card host (P4): the card for whatever is selected (a building, a place,
// a landmark, a neighbourhood, the office), or the active lens's panel. It sits at the top of the left card column,
// where the train and station cards live. The close button or Esc clears the selection, then closes the lens.
import { useEffect } from 'react'
import { RiCloseLine } from 'react-icons/ri'
import { useStore } from '../state/store.js'
import { LENSES } from './LensRail.jsx'
import BuildingCard from './cards/BuildingCard.jsx'
import PoiCard from './cards/PoiCard.jsx'
import LandmarkCard from './cards/LandmarkCard.jsx'
import VisitPanel from './panels/VisitPanel.jsx'
import './ContextPanel.css'

const TRANSIT_KINDS = ['station', 'train'] // the transit card shows these
const KIND_LABEL = { building: 'Building', landmark: 'Landmark', poi: 'Place', neighborhood: 'Neighborhood', office: 'Office' }

// Card bodies register here as later tasks add them: kind → component({ selection })
export const CARDS = { building: BuildingCard, landmark: LandmarkCard, poi: PoiCard }
// Lens panels likewise: lens id → component
export const PANELS = { VISIT: VisitPanel }

function GenericCard({ selection }) {
  const d = selection.data ?? {}
  return (
    <>
      <span className="hud-title">{d.name ?? 'Building'}</span>
      {d.address && <p className="cp-sub">{d.address}</p>}
      <p className="cp-facts">{[d.stories && `${d.stories} floors`, d.year && `built ${d.year}`, d.height && `${Math.round(d.height)} m`].filter(Boolean).join(' · ')}</p>
    </>
  )
}

export default function ContextPanel() {
  const selection = useStore((s) => s.selection), lens = useStore((s) => s.lens)
  const card = selection && !TRANSIT_KINDS.includes(selection.kind) ? selection : null
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || ['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return
      const s = useStore.getState()
      if (s.selection && !TRANSIT_KINDS.includes(s.selection.kind)) s.clearSelection()
      else if (s.lens) s.setLens(s.lens)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (!card && !lens) return null
  const s = useStore.getState()
  const L = LENSES.find((x) => x.id === lens)
  const Card = card ? (CARDS[card.kind] ?? GenericCard) : null
  const Panel = !card && lens ? PANELS[lens] : null
  return (
    <aside className="hud-panel context-panel" role="dialog" aria-label={card ? (card.data?.name ?? card.kind) : `${L.label} lens`}>
      <div className="cp-top">
        <span className="hud-label">{card ? (KIND_LABEL[card.kind] ?? card.kind) : `${L.label} lens`}</span>
        <button type="button" className="tl-mini" aria-label="Close" onClick={() => (card ? s.clearSelection() : s.setLens(lens))}><RiCloseLine /></button>
      </div>
      {card ? <Card selection={card} /> : Panel ? <Panel /> : <p className="cp-sub">{L.help}</p>}
    </aside>
  )
}
