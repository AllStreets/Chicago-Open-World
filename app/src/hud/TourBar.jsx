// app/src/hud/TourBar.jsx — the guided tour's controls (P4 · I-4.2): the stop's card, Previous / Pause-Play / Next /
// Exit and a scrubber. Keys: Space pauses, , and . step between stops, Esc exits. Any movement key hands the camera
// back (FLY) and leaves a "Resume tour" chip for 10 s.
import { useEffect, useMemo } from 'react'
import { RiPlayLine, RiPauseLine, RiSkipBackLine, RiSkipForwardLine, RiCloseLine, RiRouteLine } from 'react-icons/ri'
import { useStore } from '../state/store.js'
import { tourById, tourPoses, tourClock } from '../lib/tourPoses.js'
import { tourAt, tourDuration, stopStarts } from '../lib/tour.js'

export function seekTour(t) { tourClock.t = Math.max(0, t); const s = useStore.getState(); if (s.tour) s.setTour({ ...s.tour, t: tourClock.t }) }

export default function TourBar() {
  const tour = useStore((s) => s.tour), manifest = useStore((s) => s.manifest), resume = useStore((s) => s.tourResume)
  const def = tour ? tourById(tour.id) : null
  const poses = useMemo(() => (def ? tourPoses(def, manifest) : []), [def, manifest])
  const from = tour?.from ?? null
  const total = def ? tourDuration(def, poses, from) : 0, starts = def ? stopStarts(def, poses, from) : []
  const at = def ? tourAt(def, poses, tour.t, from) : null
  useEffect(() => {
    const onKey = (e) => {
      const s = useStore.getState()
      if (!s.tour || ['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return
      if (e.code === 'Space') { e.preventDefault(); s.setTour({ ...s.tour, playing: !s.tour.playing }) }
      else if (e.code === 'Escape') s.setTour(null)
      else if (e.code === 'Comma' || e.code === 'Period') {
        const d = tourById(s.tour.id), P = tourPoses(d, s.manifest), st = stopStarts(d, P, s.tour.from ?? null), cur = tourAt(d, P, s.tour.t, s.tour.from ?? null).stopIndex
        const next = Math.min(st.length - 1, Math.max(0, cur + (e.code === 'Period' ? 1 : -1)))
        seekTour(st[next])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => { if (!resume) return undefined; const id = setTimeout(() => useStore.setState({ tourResume: null }), 10000); return () => clearTimeout(id) }, [resume])
  if (!tour && resume) return (
    <div className="hud-chip tour-resume"><RiRouteLine aria-hidden="true" /><button type="button" className="tl-mini" onClick={() => { const s = useStore.getState(); tourClock.t = resume.t; s.setTour({ ...resume, playing: true }); useStore.setState({ tourResume: null }) }}>Resume tour</button></div>
  )
  if (!tour || !def) return null
  const s = useStore.getState()
  const step = (d) => seekTour(starts[Math.min(starts.length - 1, Math.max(0, at.stopIndex + d))])
  return (
    <div className="hud-panel tour-bar" role="region" aria-label={`Tour: ${def.name}`}>
      <div className="tb-card">
        <span className="hud-label">{def.name} · {at.stopIndex + 1} / {def.stops.length}</span>
        <span className="tb-title">{at.card.title}</span>
        <p className="tb-text">{at.card.text}</p>
        <p className="tb-keys">Space pauses · , and . step between stops · arrow keys take back the camera · Esc ends the tour</p>
      </div>
      <div className="tb-controls">
        <button type="button" className="tl-mini" aria-label="Previous stop" onClick={() => step(-1)}><RiSkipBackLine /></button>
        <button type="button" className="tl-mini" aria-label={tour.playing ? 'Pause' : 'Play'} onClick={() => s.setTour({ ...tour, playing: !tour.playing })}>{tour.playing ? <RiPauseLine /> : <RiPlayLine />}</button>
        <button type="button" className="tl-mini" aria-label="Next stop" onClick={() => step(1)}><RiSkipForwardLine /></button>
        <input className="tb-scrub" type="range" min={0} max={Math.round(total)} step={1} value={Math.round(tour.t)} aria-label="Tour position" onChange={(e) => seekTour(Number(e.target.value))} />
        <button type="button" className="tl-mini" aria-label="Exit tour" onClick={() => s.setTour(null)}><RiCloseLine /></button>
      </div>
    </div>
  )
}
