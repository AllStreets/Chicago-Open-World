// app/src/hud/FollowChip.jsx — "Following Red Line · run 817" with Chase / Side / Stop; explains when following ends.
import { useEffect, useState } from 'react'
import { useStore } from '../state/store.js'
import { getTrains } from '../transit/simStore.js'

const ENDED = { left: 'The train left the map', none: 'No trains on that line right now' }

export default function FollowChip() {
  const follow = useStore((s) => s.follow), ended = useStore((s) => s.followEnded), lines = useStore((s) => s.transit?.lines)
  const [, tick] = useState(0)
  useEffect(() => { if (!follow) return; const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id) }, [follow])
  useEffect(() => { if (!ended) return; const id = setTimeout(() => useStore.getState().clearFollowEnded(), 4000); return () => clearTimeout(id) }, [ended])
  if (!follow) return ended ? <div className="hud-chip follow-chip">{ENDED[ended]}</div> : null
  const t = getTrains().find((x) => x.id === follow.trainId)
  const line = lines?.find((l) => l.id === t?.line)
  const { setFollowView, stopFollow } = useStore.getState()
  return (
    <div className="hud-chip live follow-chip" role="status">
      <span className="dot" style={{ background: line?.colour }} />
      <span>Following {line?.name ?? 'a train'}{t ? ` · run ${t.rn}` : ''}</span>
      <button type="button" className={`hud-pill${follow.view === 'chase' ? ' active' : ''}`} onClick={() => setFollowView('chase')}>Chase</button>
      <button type="button" className={`hud-pill${follow.view === 'side' ? ' active' : ''}`} onClick={() => setFollowView('side')}>Side</button>
      <button type="button" className="hud-pill" onClick={() => stopFollow()}>Stop following</button>
      <span className="follow-hint">any key stops</span>
    </div>
  )
}
