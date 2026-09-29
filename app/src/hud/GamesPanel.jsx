// app/src/hud/GamesPanel.jsx — every venue: its state, the matchup, and a one-click flight there.
import './Sports.css'
import { useEffect } from 'react'
import { RiCloseLine } from 'react-icons/ri'
import { useStore } from '../state/store.js'
import { useSports } from '../sports/sportsStore.js'
import { stateLabel, gameLabel, dataChip } from '../sports/tonight.js'
import { goToVenue } from '../sports/palette.js'

const ORDER = { live: 0, pregame: 1, postgame: 2, idle: 3 }
export default function GamesPanel() {
  const open = useStore((s) => s.gamesOpen)
  const venues = useSports((s) => s.venues), states = useSports((s) => s.states), source = useSports((s) => s.source)
  useEffect(() => {
    if (!open) return
    const k = (e) => { if (e.key === 'Escape') useStore.getState().setGamesOpen(false) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])
  if (!open) return null
  const rows = [...venues].sort((a, b) => (ORDER[states[a.key]?.state] ?? 3) - (ORDER[states[b.key]?.state] ?? 3))
  const close = () => useStore.getState().setGamesOpen(false)
  return (
    <div className="hud-panel games" role="dialog" aria-label="Games">
      <div className="games-head">
        <span className="hud-label">Games</span>
        <button type="button" className="dock-btn" aria-label="Close games" onClick={close}><RiCloseLine /></button>
      </div>
      {rows.length === 0 && <p className="games-sub">Venues are still loading…</p>}
      <ul>
        {rows.map((v) => {
          const st = states[v.key], g = st?.game ?? st?.next, chip = dataChip(st, source)
          return (
            <li key={v.key}>
              <button type="button" className="games-row" onClick={() => { close(); goToVenue(v) }}>
                <span>{v.name}</span>
                <span className={`chip chip-${st?.state ?? 'idle'}`}>{stateLabel(st)}</span>
                {g && <span className="games-sub">{gameLabel(g)} · <span className={`chip chip-${chip.toLowerCase()}`}>{chip}</span></span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
