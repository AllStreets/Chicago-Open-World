// app/src/hud/PlacePopup.jsx — the small card for a place pin (P4 user fixes): anchored beside the pin and following it as
// the camera moves (flipping to stay on screen), with the category colour and icon, the name, category and cuisine,
// today's hours in words (the full OSM string on hover), the address, and the website — or a web search when none is
// known. A click anywhere else, or Esc, closes it.
import { useEffect, useRef } from 'react'
import { RiCloseLine, RiExternalLinkLine, RiSearchLine, RiTimeLine, RiMapPin2Line } from 'react-icons/ri'
import { usePlacePopup } from './placePopup.js'
import { POI_CATEGORIES } from '../data/poiCategories.js'
import { poiIcon } from '../data/poiIcons.js'
import { hoursToday } from '../lib/openingHours.js'
import { hudScale } from '../lib/hudScale.js'
import { pinScreen } from '../world/PoiPins.jsx'
import './PlacePopup.css'

const W = 268, GAP = 18

export default function PlacePopup() {
  const poi = usePlacePopup((s) => s.poi), close = usePlacePopup((s) => s.close)
  const ref = useRef(null)
  // follow the pin every frame, flipping to stay on screen
  useEffect(() => {
    if (!poi) return undefined
    let raf = 0
    const tick = () => {
      const el = ref.current, s = pinScreen(poi)
      if (el && s) {
        const k = hudScale(window.innerWidth, window.innerHeight), vw = window.innerWidth / k, vh = window.innerHeight / k
        const x = s.sx / k, y = s.sy / k, h = el.offsetHeight || 180
        const right = x + GAP + W < vw - 8
        const left = right ? x + GAP : x - GAP - W
        const top = Math.min(vh - h - 8, Math.max(8, y - h * 0.55))
        el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
        el.dataset.side = right ? 'right' : 'left'
        el.style.opacity = s.visible ? '1' : '0.35'
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [poi])
  // dismiss: Esc, or a press anywhere outside the card
  useEffect(() => {
    if (!poi) return undefined
    const key = (e) => { if (e.key === 'Escape') close() }
    const down = (e) => { if (!ref.current?.contains(e.target)) close() }
    window.addEventListener('keydown', key)
    document.addEventListener('pointerdown', down, true)
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('pointerdown', down, true) }
  }, [poi, close])
  if (!poi) return null
  const cat = POI_CATEGORIES[poi.c] ?? POI_CATEGORIES[0], Icon = poiIcon(cat.icon), t = poi.t ?? {}
  const today = hoursToday(t.opening_hours)
  const site = t.website ? String(t.website) : null
  const siteLabel = site ? site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : null
  const search = `https://www.google.com/search?q=${encodeURIComponent(`${poi.n} Chicago`)}`
  const kind = [cat.label, t.cuisine?.split(';')[0].replace(/_/g, ' ')].filter(Boolean).join(' · ')
  return (
    <div ref={ref} className="place-popup" role="dialog" aria-label={poi.n} style={{ '--cat': cat.color, width: W }}>
      <div className="pp-head">
        <span className="pp-icon" aria-hidden="true"><Icon /></span>
        <div className="pp-titles">
          <span className="pp-name">{poi.n}</span>
          <span className="pp-kind">{kind}</span>
        </div>
        <button type="button" className="pp-close" aria-label="Close" onClick={close}><RiCloseLine /></button>
      </div>
      {(today || t.opening_hours) && (
        <p className="pp-line" title={t.opening_hours}><RiTimeLine aria-hidden="true" /> <span className={today?.startsWith('Closed') ? 'pp-closed' : ''}>{today ?? t.opening_hours}</span></p>
      )}
      {poi.a && <p className="pp-line"><RiMapPin2Line aria-hidden="true" /> <span>{poi.a}</span></p>}
      <div className="pp-actions">
        {site
          ? <a className="pp-btn primary" href={site} target="_blank" rel="noreferrer" aria-label={`Website: ${siteLabel}`}><RiExternalLinkLine aria-hidden="true" /> <span>{siteLabel}</span></a>
          : <a className="pp-btn" href={search} target="_blank" rel="noreferrer"><RiSearchLine aria-hidden="true" /> Search the web</a>}
      </div>
    </div>
  )
}
