// app/src/hud/HudClock.jsx — ported verbatim from CHI
import { useEffect, useState } from 'react'

function chicagoTime() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(new Date())
}

export default function HudClock({ showSeconds = true, className = '' }) {
  const [now, setNow] = useState(chicagoTime)

  useEffect(() => {
    const id = setInterval(() => setNow(chicagoTime()), 1000)
    return () => clearInterval(id)
  }, [])

  const display = showSeconds ? now : now.slice(0, 5)

  return (
    <span className={`hud-clock ${className}`} style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
      {display}
      <span style={{ color: 'var(--text-faint)', fontSize: '0.7em', marginLeft: 6, letterSpacing: '0.1em' }}>CT</span>
    </span>
  )
}
