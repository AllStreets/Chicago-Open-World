import { useEffect } from 'react'
import { useStore } from '../state/store.js'

const TIMES = ['LIVE', 'DAWN', 'DAY', 'DUSK', 'NIGHT']
const MODES = ['FLY', 'ORBIT']

export default function ControlPills() {
  const time = useStore((s) => s.timePreset)
  const setTime = useStore((s) => s.setTimePreset)
  const mode = useStore((s) => s.cameraMode)
  const setMode = useStore((s) => s.setCameraMode)

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 }[e.code]
      if (n !== undefined) setTime(TIMES[n])
      if (e.code === 'KeyO') setMode(useStore.getState().cameraMode === 'ORBIT' ? 'FLY' : 'ORBIT')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setTime, setMode])

  return (
    <div className="hud-controls">
      <div className="pill-row">
        {MODES.map((m) => (
          <button key={m} type="button" className={`hud-pill ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>{m}</button>
        ))}
      </div>
      <div className="pill-row small">
        {TIMES.map((t) => (
          <button key={t} type="button" className={`hud-pill ${time === t ? 'active' : ''}`} onClick={() => setTime(t)}>{t}</button>
        ))}
      </div>
    </div>
  )
}
