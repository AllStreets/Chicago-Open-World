// app/src/hud/SoundToast.jsx — the sign that sound turned on or off (Workstream C, 2026-10-01): a bare glyph in the
// middle of the screen — green speaker with waves (on), red speaker with a slash (off) — with no plate, border, blur or
// shadow (Decision 6). It holds at full opacity for HOLD_MS, fades over FADE_MS, and is gone. It follows the sound
// switch itself, so M, ⌘K "Sound" and any future button all show it; it never shows on load.
// Each change restarts it from full (the element remounts by key): quick presses never stack or show a stale state.
import './SoundToast.css'
import { useEffect, useRef, useState } from 'react'
import { useSoundStore } from '../audio/soundStore.js'
import SoundGlyph from './SoundGlyph.jsx'

export const HOLD_MS = 1000
export const FADE_MS = 1500
const reducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

export default function SoundToast() {
  const [shown, setShown] = useState(null) // { on, n, phase, pop }
  const [said, setSaid] = useState('') // the live region stays mounted so the change is always announced
  const timers = useRef([])
  useEffect(() => {
    let n = 0
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = [] }
    const unsub = useSoundStore.subscribe((s, prev) => {
      if (s.soundOn === prev.soundOn) return
      clear(); n += 1
      const id = n
      setShown({ on: s.soundOn, n: id, phase: 'hold', pop: !reducedMotion() })
      setSaid(s.soundOn ? 'Sound on' : 'Sound off')
      timers.current.push(setTimeout(() => setShown((x) => (x?.n === id ? { ...x, phase: 'fade' } : x)), HOLD_MS))
      timers.current.push(setTimeout(() => setShown((x) => (x?.n === id ? null : x)), HOLD_MS + FADE_MS))
    })
    return () => { unsub(); clear() }
  }, [])
  return (
    <>
      <span className="sound-toast-live" role="status" aria-live="polite">{said}</span>
      {shown && (
        <div key={shown.n} className={`sound-toast${shown.pop ? ' pop' : ''}`} data-state={shown.on ? 'on' : 'off'} data-phase={shown.phase} aria-hidden="true"
          style={{ '--fade-ms': `${FADE_MS}ms` }}>
          <SoundGlyph on={shown.on} />
        </div>
      )}
    </>
  )
}
