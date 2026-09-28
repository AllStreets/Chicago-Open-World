import { useEffect, useState } from 'react'
import { useStore } from '../state/store.js'

export default function LoadingScreen() {
  const { total, done, error, ready } = useStore((s) => s.load)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (!ready || error) return
    const id = setTimeout(() => setGone(true), 900)
    return () => clearTimeout(id)
  }, [ready, error])
  if (gone) return null
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className={`hud-loading ${ready && !error ? 'fading' : ''}`}>
      <div className="load-mark">CHI ATLAS</div>
      <div className="load-sub">THE CITY, AT FULL SCALE</div>
      {error ? (
        <button type="button" className="hud-chip load-error" onClick={() => setGone(true)}>WORLD DATA UNAVAILABLE · {error} · CONTINUE</button>
      ) : (
        <>
          <div className="load-bar"><span style={{ width: `${pct}%` }} /></div>
          <div className="load-pct">{pct}% · {done}/{total} WORLD FILES</div>
        </>
      )}
    </div>
  )
}
