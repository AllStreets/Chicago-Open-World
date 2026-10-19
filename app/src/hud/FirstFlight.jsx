// app/src/hud/FirstFlight.jsx — a first visit teaches three things by doing them, one at a time: look, move, search.
// Replaces opening the full controls sheet on arrival (2026-10-19): the city is the first impression, and the sheet
// stays one key away on "?". Each step completes when the visitor actually does it, not when they read it. It shares
// the 'chi-ow-help-seen' flag with the old first-visit sheet, so returning visitors and the e2e shot scripts skip it.
import { useEffect, useState } from 'react'
import { useStore } from '../state/store.js'
import { Kbd } from './Keycap.jsx'

export const SEEN_KEY = 'chi-ow-help-seen'
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
const DRAG_PX = 24
export const START_DELAY_MS = 1600

export const STEPS = [
  { id: 'look', title: 'Look around', body: <>Drag anywhere on the city to turn and tilt.</> },
  { id: 'move', title: 'Fly', body: <>Press <Kbd k="W" className="inline" /> <Kbd k="A" className="inline" /> <Kbd k="S" className="inline" /> <Kbd k="D" className="inline" /> or the arrow keys to glide over the streets.</> },
  { id: 'search', title: 'Go somewhere', body: <>Press <Kbd k="⌘K" className="inline" /> and type a landmark, like “the Bean”.</> },
]

const readSeen = () => { try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return true } }
const markSeen = () => { try { localStorage.setItem(SEEN_KEY, '1') } catch { /* storage blocked: it shows again next visit */ } }

export default function FirstFlight() {
  // `ready` reads true for a moment at boot, before any world file is counted, so wait for real files and for the
  // loading screen to finish fading (it leaves 900 ms after ready), and cancel if ready drops back
  const ready = useStore((s) => s.load.ready && s.load.total > 0 && !s.load.error)
  const paletteOpen = useStore((s) => s.paletteOpen)
  const [step, setStep] = useState(-1) // -1 not started, STEPS.length done

  useEffect(() => {
    if (!ready || step !== -1 || readSeen()) return
    // touch screens have no keyboard steps to teach; they keep the city and the ? button
    if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) return
    const id = setTimeout(() => setStep(0), START_DELAY_MS)
    return () => clearTimeout(id)
  }, [ready, step])

  const active = step >= 0 && step < STEPS.length
  const advance = (from) => setStep((s) => (s === from ? s + 1 : s))

  // step 0: a real drag on the canvas
  useEffect(() => {
    if (!active || STEPS[step].id !== 'look') return
    let start = null
    const down = (e) => { if (e.target instanceof HTMLCanvasElement) start = [e.clientX, e.clientY] }
    const move = (e) => { if (start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > DRAG_PX) { start = null; advance(0) } }
    const up = () => { start = null }
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [active, step])

  // step 1: any move key
  useEffect(() => {
    if (!active || STEPS[step].id !== 'move') return
    const key = (e) => { if (MOVE_KEYS.has(e.code)) advance(1) }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [active, step])

  // step 2: the search palette opens
  useEffect(() => {
    if (active && STEPS[step].id === 'search' && paletteOpen) advance(2)
  }, [active, step, paletteOpen])

  useEffect(() => { if (step === STEPS.length) markSeen() }, [step])

  if (!active) return null
  const skip = () => { markSeen(); setStep(STEPS.length) }
  const s = STEPS[step]
  return (
    <div className="hud-panel first-flight" role="status" aria-live="polite">
      <div className="ff-head">
        <span className="hud-label">First flight · {step + 1} of {STEPS.length}</span>
        <button type="button" className="ff-skip" onClick={skip}>Skip</button>
      </div>
      <div className="ff-title">{s.title}</div>
      <p className="ff-body">{s.body}</p>
      <div className="ff-foot">
        <div className="ff-dots" aria-hidden="true">{STEPS.map((x, i) => <span key={x.id} className={i < step ? 'done' : i === step ? 'on' : ''} />)}</div>
        <span className="ff-more">Every control: <Kbd k="?" className="inline" /></span>
      </div>
    </div>
  )
}
