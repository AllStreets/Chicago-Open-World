// app/src/hud/VenueCard.jsx — the venue's score, state and next game. Esc or × closes it.
import './Sports.css'
import { useEffect } from 'react'
import { RiCloseLine } from 'react-icons/ri'
import { useSports } from '../sports/sportsStore.js'
import { boardLines } from '../sports/scoreboard.js'
import { stateLabel, gameLabel, dataChip } from '../sports/tonight.js'
import { formatChicago } from '../sports/chicagoTime.js'

export default function VenueCard() {
  const key = useSports((s) => s.cardVenue)
  const venue = useSports((s) => s.venues.find((v) => v.key === s.cardVenue))
  const st = useSports((s) => s.states[s.cardVenue])
  const source = useSports((s) => s.source), generatedAt = useSports((s) => s.generatedAt)
  const override = useSports((s) => s.boardOverrides[s.cardVenue])
  useEffect(() => {
    if (!key) return
    const k = (e) => { if (e.key === 'Escape') useSports.getState().openCard(null) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [key])
  if (!venue) return null
  const lines = boardLines(venue, st, Date.now(), override)
  const chip = dataChip(st, source)
  return (
    <div className="hud-panel venue-card" role="dialog" aria-label={venue.name}>
      <div className="vc-head">
        <span className="hud-title">{venue.name}</span>
        <span className={`chip chip-${st?.state ?? 'idle'}`}>{stateLabel(st)}</span>
        <button type="button" className="dock-btn" aria-label="Close" onClick={() => useSports.getState().openCard(null)}><RiCloseLine /></button>
      </div>
      {lines.rows.length > 0 && (
        <div className="vc-score">{lines.rows.map((r) => <div key={r.abbr} className="vc-row"><span>{r.abbr}</span><span>{r.score ?? '–'}</span></div>)}</div>
      )}
      <p className="vc-status">{lines.status}</p>
      {st?.next && <p className="vc-next">Next: {gameLabel(st.next)} · {formatChicago(Date.parse(st.next.start))}</p>}
      <p className="vc-foot"><span className={`chip chip-${chip.toLowerCase()}`}>{chip}</span> {chip === 'ESPN' ? `ESPN schedule as of ${generatedAt?.slice(0, 10)}` : 'Simulated schedule — typical home dates'}</p>
    </div>
  )
}
