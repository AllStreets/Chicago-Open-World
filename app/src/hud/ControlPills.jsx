import { useEffect, useState } from 'react'
import { useStore } from '../state/store.js'
import { sunForPreset } from '../lib/sun.js'
import { phaseFor } from '../lib/skyPalette.js'
import { cycleQuality } from '../lib/quality.js'
import { PRESETS } from '../lib/atmosphere.js'
import { WEATHER_MODES, WEATHER_NAMES } from '../weather/weatherState.js'

function livePhase() {
  const s = sunForPreset('LIVE', new Date())
  return phaseFor((s.altitude * 180) / Math.PI, s.direction[0])
}

const TIMES = PRESETS // user fixes: + SUNNY (a clear midsummer day) and SNOW (Christmas Eve, snowing)
const MODES = ['FLY', 'ORBIT']
const QUALITIES = ['LOW', 'HIGH', 'ULTRA']

export default function ControlPills() {
  const time = useStore((s) => s.timePreset)
  const setTime = useStore((s) => s.setTimePreset)
  const mode = useStore((s) => s.cameraMode)
  const setMode = useStore((s) => s.setCameraMode)
  const quality = useStore((s) => s.quality)
  const setQuality = useStore((s) => s.setQuality)
  const [phase, setPhase] = useState(livePhase)
  useEffect(() => { const id = setInterval(() => setPhase(livePhase()), 60_000); return () => clearInterval(id) }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6 }[e.code]
      if (n !== undefined) setTime(TIMES[n])
      if (e.code === 'KeyO') setMode(useStore.getState().cameraMode === 'ORBIT' ? 'FLY' : 'ORBIT')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setTime, setMode, setQuality])

  return (
    <div className="hud-controls">
      <div className="pill-row">
        {MODES.map((m) => (
          <button key={m} type="button" className={`hud-pill ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>{m}</button>
        ))}
      </div>
      <div className="pill-row small">
        {TIMES.slice(0, 5).map((t) => (
          <button key={t} type="button" className={`hud-pill ${time === t ? 'active' : ''}`} onClick={() => setTime(t)}>{t === 'LIVE' ? `LIVE · ${phase}` : t}</button>
        ))}
      </div>
      {/* user fixes: two seasonal views on their own row (a clear summer day, a snowy Christmas); P5: the weather menu */}
      <div className="pill-row small seasons" aria-label="Seasons">
        {TIMES.slice(5).map((t) => (
          <button key={t} type="button" className={`hud-pill ${time === t ? 'active' : ''}`} onClick={() => setTime(t)}>{t === 'LIVE' ? `LIVE · ${phase}` : t}</button>
        ))}
        <WeatherPill />
      </div>
    </div>
  )
}

// P5: Weather — follows Chicago live (clear when the live feed is off), or pick a sky; the choice holds until Live.
function WeatherPill() {
  const mode = useStore((s) => s.weatherMode), weather = useStore((s) => s.weather)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return undefined
    const close = (e) => { if (e.key === 'Escape' || e.type === 'pointerdown') setOpen(false) }
    const t = setTimeout(() => window.addEventListener('pointerdown', close), 0)
    window.addEventListener('keydown', close)
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', close) }
  }, [open])
  const label = mode === 'LIVE' ? `WEATHER · ${weather.kind === 'clear' ? 'LIVE' : weather.kind.toUpperCase()}` : `WEATHER · ${WEATHER_NAMES[mode].toUpperCase()}`
  return (
    <span className="weather-pill" onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className={`hud-pill ${mode !== 'LIVE' ? 'active' : ''}`} aria-haspopup="menu" aria-expanded={open} aria-label={`Weather: ${WEATHER_NAMES[mode]}`}
        title="Weather — follows Chicago live; or choose a sky" onClick={() => setOpen(!open)}>{label}</button>
      {open && (
        <div className="hud-panel weather-menu" role="menu" aria-label="Weather">
          {WEATHER_MODES.map((m) => (
            <button key={m} type="button" role="menuitem" className={`hud-pill ${mode === m ? 'active' : ''}`} onClick={() => { useStore.getState().setWeatherMode(m); setOpen(false) }}>
              {m === 'LIVE' ? 'Live Chicago weather' : WEATHER_NAMES[m]}
            </button>
          ))}
        </div>
      )}
    </span>
  )
}
