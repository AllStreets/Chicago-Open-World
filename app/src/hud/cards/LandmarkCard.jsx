// app/src/hud/cards/LandmarkCard.jsx — a landmark's card (P4 · I-4.2): name, category, CHI ATLAS's description and
// insider tip, the nearest L, Save (a per-viewer list in this browser) and Fly here. A landmark building with no
// curated entry falls back to its building card.
import { useState } from 'react'
import { RiPlaneLine, RiBookmarkLine, RiBookmarkFill } from 'react-icons/ri'
import { useStore } from '../../state/store.js'
import { LANDMARKS, CATEGORY_COLOR } from '../../data/landmarks.js'
import { poseForPlace } from '../../lib/flight.js'
import NearestL from './NearestL.jsx'
import BuildingCard from './BuildingCard.jsx'

const KEY = 'chi-ow-saved'
const readSaved = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] } }
const writeSaved = (ids) => { try { localStorage.setItem(KEY, JSON.stringify(ids)) } catch { /* storage blocked: saving is a convenience */ } }

export default function LandmarkCard({ selection }) {
  const lm = LANDMARKS.find((l) => l.id === selection.id || l.heroKey === selection.id)
  const [saved, setSaved] = useState(() => readSaved())
  if (!lm) return <BuildingCard selection={selection} />
  const d = selection.data ?? {}, x = d.x, z = d.z, isSaved = saved.includes(lm.id)
  const toggle = () => { const next = isSaved ? saved.filter((i) => i !== lm.id) : [...saved, lm.id]; setSaved(next); writeSaved(next) }
  return (
    <>
      <span className="hud-title">{lm.name}</span>
      <p className="cp-facts"><i className="lm-dot" style={{ background: CATEGORY_COLOR[lm.category] }} /> {lm.category}</p>
      <p className="cp-sub">{lm.desc}</p>
      <p className="cp-tip"><span className="hud-label">Tip</span> {lm.tip}</p>
      {Number.isFinite(x) && <NearestL x={x} z={z} />}
      <div className="cp-actions">
        <button type="button" className={`hud-pill${isSaved ? ' active' : ''}`} aria-pressed={isSaved} onClick={toggle}>{isSaved ? <RiBookmarkFill aria-hidden="true" /> : <RiBookmarkLine aria-hidden="true" />} {isSaved ? 'Saved' : 'Save'}</button>
        {Number.isFinite(x) && <button type="button" className="hud-pill" onClick={() => useStore.getState().startFlight(poseForPlace({ x, z, top: 60 }), lm.name)}><RiPlaneLine aria-hidden="true" /> Fly here</button>}
      </div>
    </>
  )
}
