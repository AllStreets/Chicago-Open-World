// app/src/hud/featureControls.js — every city-life feature and every way to reach it (backlog G3).
// The dock row, the keyboard, ⌘K, the help card and the hint bar all read this list, so a control can never be added
// in one place and forgotten in another. The adapters (use/isOn/toggle/available) are the only lines naming feature state.
import { RiTrainLine, RiTrophyLine, RiVolumeUpLine, RiVolumeMuteLine, RiShip2Line, RiDropLine, RiMapPin2Line, RiSparkling2Line, RiCarLine } from 'react-icons/ri'
import { useStore } from '../state/store.js'
import { useSoundStore } from '../audio/soundStore.js'
import { fountainShow } from '../landmarks/fountainSchedule.js'
import { fireworksShow } from '../landmarks/fireworksSchedule.js'

const storeFlag = (field, setter) => ({
  use: () => useStore((s) => Boolean(s[field])),
  isOn: () => Boolean(useStore.getState()[field]),
  toggle: () => { const s = useStore.getState(); s[setter](!s[field]) },
})
const always = { available: () => true, useAvailable: () => true }

export const FEATURE_CONTROLS = [
  { id: 'transit', label: 'Transit', key: 'KeyT', keyLabel: 'T', icon: RiTrainLine, hint: 'transit',
    help: 'show or hide the CTA and Metra lines, their glow and the trains', ...storeFlag('transitOn', 'setTransitOn'),
    available: () => Boolean(useStore.getState().transit), useAvailable: () => useStore((s) => Boolean(s.transit)) },
  { id: 'games', label: 'Games', key: 'KeyG', keyLabel: 'G', icon: RiTrophyLine, hint: 'games',
    help: "today's games — scores, and a flight to the ballpark", ...storeFlag('gamesOpen', 'setGamesOpen'), ...always },
  { id: 'sound', label: 'Sound', key: 'KeyM', keyLabel: 'M', icon: RiVolumeUpLine, iconOff: RiVolumeMuteLine, hint: 'sound',
    help: 'music for the fountain and bridge shows, crowd cheers and passing trains — off until you turn it on',
    use: () => useSoundStore((s) => Boolean(s.soundOn)),
    isOn: () => Boolean(useSoundStore.getState().soundOn),
    toggle: () => { const s = useSoundStore.getState(); s.setSoundOn(!s.soundOn) }, ...always },
  { id: 'bridges', label: 'Bridges', key: 'KeyB', keyLabel: 'B', icon: RiShip2Line, hint: 'bridges', commandName: 'Raise the river bridges',
    help: 'raise the river bridges — a boat-run lift with gate bells, flashers and its own music (Sound on)',
    use: () => useStore((s) => s.bridgeLift != null && !s.bridgeLift.stoppedAt),
    isOn: () => { const l = useStore.getState().bridgeLift; return l != null && !l.stoppedAt },
    toggle: () => {
      const s = useStore.getState()
      if (s.bridgeLift && !s.bridgeLift.stoppedAt) { s.lowerBridges(); return }
      s.startBridgeLift()
      if (useSoundStore.getState().soundOn) s.showToast('Raising the river bridges one after another — press B again to bring them down')
    }, ...always },
  { id: 'fountain', label: 'Fountain', key: 'KeyJ', keyLabel: 'J', icon: RiDropLine, hint: 'fountain', commandName: 'Buckingham Fountain water show',
    help: 'play the Buckingham Fountain water show now — the jets dance to music, lit in colour after dusk',
    // the same answer as isOn (the real schedule too), re-read whenever the fountain's state changes
    use: () => useStore((s) => s.fountainLive || fountainShow(new Date(), { previewStart: s.fountainPreview, stoppedAt: s.fountainStoppedAt }).state === 'show'),
    isOn: () => { const s = useStore.getState(); return fountainShow(new Date(), { previewStart: s.fountainPreview, stoppedAt: s.fountainStoppedAt }).state === 'show' },
    // one click stops any show (scheduled or started) and the jets go back to normal; the next click starts one
    toggle: () => { const s = useStore.getState(); if (featureById('fountain').isOn()) s.stopFountain(); else s.startFountainPreview() }, ...always },
  { id: 'fireworks', label: 'Fireworks', key: 'KeyX', keyLabel: 'X', icon: RiSparkling2Line, hint: 'fireworks', commandName: 'Navy Pier fireworks',
    help: 'the Navy Pier fireworks from the barge off the pier — flies you to a good view; press again to stop (real shows: Wed 9 pm, Sat 10 pm in summer)',
    use: () => useStore((s) => s.fireworksLive || s.fireworksPreview != null),
    isOn: () => { const s = useStore.getState(); return fireworksShow(new Date(), { previewStart: s.fireworksPreview, stoppedAt: s.fireworksStoppedAt }).state === 'show' },
    toggle: () => {
      const s = useStore.getState()
      if (featureById('fireworks').isOn()) { s.stopFireworks(); return }
      s.startFireworks()
      s.requestFireworksView?.() // the scene flies the camera to a view of the barge if it can't see it
    }, ...always },
  { id: 'places', label: 'Places', key: 'KeyP', keyLabel: 'P', icon: RiMapPin2Line, hint: 'places',
    help: 'pins for restaurants, bars, venues and more, on the roofs they belong to (always on in the Visit lens)', ...storeFlag('placesOn', 'setPlacesOn'), ...always },
  // not in the dock (its six buttons stay as they are): C, ⌘K and the help card; the hint shows when the bar has room
  { id: 'traffic', label: 'Traffic', key: 'KeyC', keyLabel: 'C', icon: RiCarLine, hint: 'traffic', hintP: 3,
    help: 'cars, buses and trucks on the streets, stopping at the traffic lights — busiest at rush hour, lit after dusk',
    ...storeFlag('trafficOn', 'setTrafficOn'),
    available: () => Boolean(useStore.getState().manifest?.traffic), useAvailable: () => useStore((s) => Boolean(s.manifest?.traffic)) },
]

export const featureById = (id) => FEATURE_CONTROLS.find((c) => c.id === id)

// The dock's six buttons (user, 2026-09-30): Places takes Sound's slot — Sound stays on M, ⌘K and the help card.
const DOCK_ORDER = ['transit', 'games', 'places', 'bridges', 'fountain', 'fireworks']
export const DOCK_FEATURES = DOCK_ORDER.map(featureById).filter(Boolean)
