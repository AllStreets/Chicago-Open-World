// app/src/ride/rideActions.js — starting, steering and leaving a ride (P7), for the panel, the bar, ⌘K and the keys.
// One camera owner at a time: a ride ends a tour, a flight and a follow; they in turn end a ride (store).
import { useStore } from '../state/store.js'
import { rideDefById, endSession, skip, nextSpeed, resetLook, sessionDef } from './rideSession.js'
import { exitPose } from './rideRun.js'
import { VIEWS, VIEW_NAMES } from './rideCatalog.js'
import { clearanceAt } from '../lib/clearance.js'

export function startRide(id) {
  const def = rideDefById(id)
  if (!def) return false
  endSession()
  useStore.setState({
    ride: { id: def.id, kind: def.kind, name: def.name, view: VIEWS[def.kind]?.[0] ?? 'cab', paused: false, speed: 1 },
    rideHud: null, ridePanelOpen: false, paletteOpen: false, flight: null, follow: null, tour: null, cameraMode: 'FLY', selection: null,
  })
  return true
}

// Leave the ride: by default the camera flies up from where you were to a clear view of the same spot.
export function stopRide({ fly = true } = {}) {
  const st = useStore.getState()
  if (!st.ride) return
  const last = endSession()
  useStore.setState({ ride: null, rideHud: null })
  if (fly && last) st.startFlight(exitPose(last, clearanceAt), null)
}

const patch = (p) => { const r = useStore.getState().ride; if (r) useStore.setState({ ride: { ...r, ...p } }) }
export const togglePause = () => patch({ paused: !useStore.getState().ride?.paused })
export const changeSpeed = (dir = 1) => patch({ speed: nextSpeed(useStore.getState().ride, dir) })
export const skipTo = (dir) => skip(dir)
export function cycleView() {
  const r = useStore.getState().ride
  if (!r) return
  const views = VIEWS[r.kind] ?? ['cab'], next = views[(views.indexOf(r.view) + 1) % views.length]
  resetLook()
  patch({ view: next })
  if (views.length > 1) useStore.getState().showToast(`View: ${VIEW_NAMES[next]}`)
}

// A key during a ride: true when it was a ride control (the caller then ignores it).
export function handleRideKey(e) {
  const r = useStore.getState().ride
  if (!r || r.kind === 'glide') return false
  const tag = e.target?.tagName
  if (e.code === 'Space' && tag !== 'BUTTON' && tag !== 'A') { togglePause(); return true }
  if (e.key === '>') { changeSpeed(1); return true }
  if (e.key === '<') { changeSpeed(-1); return true }
  if (e.key === '.') { skipTo(1); return true }
  if (e.key === ',') { skipTo(-1); return true }
  if (e.code === 'KeyC') { cycleView(); return true }
  return false
}
export const ridingKind = () => sessionDef()?.kind ?? useStore.getState().ride?.kind ?? null
