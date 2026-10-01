// app/src/hud/TransitCard.jsx — the train / station card (C16): line, run, destination, next stop, and the next
// arrivals — live (P5) when the CTA feed is LIVE and a live train is heading here, scheduled from the simulator otherwise.
import { useEffect, useState } from 'react'
import { RiCloseLine, RiTrainLine } from 'react-icons/ri'
import { useStore } from '../state/store.js'
import { getSim, getTrains } from '../transit/simStore.js'
import { liveReports } from '../transit/liveStore.js'
import { liveArrivalsFor } from '../transit/arrivals.js'
import { goToStation } from '../transit/actions.js'

const when = (m) => (m < 1 ? 'Due' : `${m} min`)

export default function TransitCard() {
  const sel = useStore((s) => s.selection), transit = useStore((s) => s.transit), follow = useStore((s) => s.follow)
  const ctaLive = useStore((s) => s.feeds.cta === 'LIVE')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!sel) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(id)
  }, [sel])
  const sim = getSim()
  if (!sel || !transit || !sim || (sel.kind !== 'station' && sel.kind !== 'train')) return null // other kinds: the context panel (P4)
  const lineOf = (id) => transit.lines.find((l) => l.id === id)
  const s = useStore.getState()
  const head = (title, kicker, live = false) => (
    <div className="tc-head">
      <div className="tc-top">
        <span className="hud-label">{kicker}</span>
        {live
          ? <span className="hud-chip live" title="Live from CTA Train Tracker">LIVE</span>
          : <span className="hud-chip" title="Positions and arrivals are simulated from typical schedules">SIMULATED</span>}
        <button type="button" className="tl-mini" aria-label="Close" onClick={() => s.clearSelection()}><RiCloseLine /></button>
      </div>
      <span className="hud-title">{title}</span>
    </div>
  )

  if (sel.kind === 'station') {
    const st = transit.stations.find((x) => x.id === sel.id)
    if (!st) return null
    const live = ctaLive && st.operator !== 'metra' ? liveArrivalsFor(st, liveReports(), now).map((a) => ({ ...a, line: a.lineId, trainId: `rn:${a.rn}`, arrTime: a.minutes })) : []
    const arrivals = live.length ? live : sim.arrivalsAt(st.id, now, 30)
    return (
      <aside className="hud-panel transit-card" role="dialog" aria-label={st.name}>
        {head(st.name, 'Station', live.length > 0)}
        <div className="tc-swatches">{st.lines.map((l) => <i key={l} className="tl-swatch" title={lineOf(l)?.name} style={{ background: lineOf(l)?.colour }} />)}</div>
        <h3 className="hud-label">{live.length ? 'Arrivals · live' : ctaLive ? 'Arrivals · scheduled' : 'Arrivals'}</h3>
        {arrivals.length === 0 ? <p className="tc-empty">No trains in the next 30 minutes</p> : (
          <ul className="tc-list">
            {arrivals.map((a) => (
              <li key={`${a.trainId}:${a.arrTime}`}>
                <i className="tl-swatch" style={{ background: lineOf(a.line)?.colour }} />
                <span>{lineOf(a.line)?.name} · to {a.destination}</span>
                <b>{when(a.minutes)}</b>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="hud-pill" onClick={() => goToStation(st)}>Fly here</button>
      </aside>
    )
  }

  // a live train (id rn:…) is only in the frame's published list; a simulated one can be recomputed for any instant
  const t = String(sel.id).startsWith('rn:') ? getTrains().find((x) => x.id === sel.id) ?? null : sim.trainById(sel.id, now)
  if (!t) return <aside className="hud-panel transit-card" role="dialog" aria-label="Train">{head('Train', 'Transit')}<p className="tc-empty">This train has left the map</p></aside>
  const line = lineOf(t.line), following = follow?.trainId === t.id
  const nextWhen = t.nextStop?.eta != null ? ` · ${when(Math.floor((t.nextStop.eta - now) / 60000))}` : ''
  return (
    <aside className="hud-panel transit-card" role="dialog" aria-label={`${line?.name} run ${t.rn}`}>
      {head(`${line?.name} · Run ${t.rn}`, line?.operator === 'metra' ? 'Metra' : 'CTA L', !!t.live)}
      <p>To {t.destination}</p>
      <p>{t.nextStop ? `Next stop ${t.nextStop.name}${nextWhen}` : 'Leaving the map'}</p>
      <p className="tc-speed">{Math.round(t.speed * 2.23694)} mph · {t.cars.length} cars</p>
      {following
        ? <button type="button" className="hud-pill active" onClick={() => s.stopFollow()}>Stop following</button>
        : <button type="button" className="hud-pill" onClick={() => s.startFollow(t.id)}><RiTrainLine /> Follow this train</button>}
    </aside>
  )
}
