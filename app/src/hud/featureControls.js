// app/src/hud/featureControls.js — every city-life feature and every way to reach it (backlog G3).
// The dock row, the keyboard, ⌘K, the help card and the hint bar all read this list, so a control can never be added
// in one place and forgotten in another. The adapters (use/isOn/toggle/available) are the only lines naming feature state.
import { RiTrainLine, RiTrophyLine, RiVolumeUpLine, RiVolumeMuteLine, RiShip2Line, RiDropLine, RiMapPin2Line, RiSparkling2Line, RiCarLine, RiRadarLine, RiRouteLine, RiPlayCircleLine, RiStackLine } from 'react-icons/ri'
import { useStore } from '../state/store.js'
import { useSoundStore } from '../audio/soundStore.js'
import { fountainShow } from '../landmarks/fountainSchedule.js'
import { fireworksShow } from '../landmarks/fireworksSchedule.js'
import { useSports } from '../sports/sportsStore.js'
import { toggleShowcase } from '../sports/showcaseActions.js'
import { readLowerLevels } from '../lib/levels.js'

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
    help: 'music for the fountain and bridge shows, crowd cheers, passing trains and the sounds of your ride — off until you turn it on; a green or red speaker in the middle of the screen shows which',
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
      // following a train, on a tour or riding, the camera stays yours (C-fix): say where the show is instead of flying
      if (s.follow || s.tour || s.ride) {
        s.showToast(`Fireworks are on at Navy Pier — press X again to stop${useSoundStore.getState().soundOn ? '' : ' · M turns the sound on'}`)
        return
      }
      s.requestFireworksView?.() // the scene flies the camera to a view of the barge if it can't see it
    }, ...always },
  { id: 'places', label: 'Places', key: 'KeyP', keyLabel: 'P', icon: RiMapPin2Line, hint: 'places',
    help: 'pins for restaurants, bars, venues and more, on the roofs they belong to (always on in the Visit lens)', ...storeFlag('placesOn', 'setPlacesOn'), ...always },
  // not in the dock (its six buttons stay as they are): C, ⌘K and the help card; the hint shows when the bar has room
  { id: 'traffic', label: 'Traffic', key: 'KeyC', keyLabel: 'C', icon: RiCarLine, hint: 'traffic', hintP: 3,
    help: 'cars, buses and trucks on the streets, stopping at the traffic lights — busiest at rush hour, lit after dusk',
    ...storeFlag('trafficOn', 'setTrafficOn'),
    available: () => Boolean(useStore.getState().manifest?.traffic), useAvailable: () => useStore((s) => Boolean(s.manifest?.traffic)) },
  // P5: Scan is the SCAN pill (top right), not a dock button — the dock stays a full grid (user: no dead space)
  { id: 'scan', label: 'Scan', key: 'KeyV', keyLabel: 'V', icon: RiRadarLine, hint: 'scan', commandName: 'Scan mode: on / off',
    help: 'holographic Scan — the city turns to dark glass with cyan edges; the lenses show their data on it (SCAN button, top right)', ...storeFlag('scan', 'setScan'), ...always },
  // P7: Ride the city — the Ride button (its own dock row) or L opens the rides; during a ride, L gets off
  { id: 'ride', label: 'Ride', key: 'KeyL', keyLabel: 'L', icon: RiRouteLine, hint: 'ride', commandName: 'Ride the city: L trains, buses, walks, glide',
    help: 'ride the city — an L train from the front window, a CTA bus, a street-level walk or a hang-glider; the bar at the bottom has every control',
    use: () => useStore((s) => Boolean(s.ride) || s.ridePanelOpen),
    isOn: () => { const s = useStore.getState(); return Boolean(s.ride) || s.ridePanelOpen },
    toggle: () => {
      const s = useStore.getState()
      if (s.ride) { import('../ride/rideActions.js').then((m) => m.stopRide()); return }
      s.setRidePanelOpen(!s.ridePanelOpen)
    }, ...always },
  // E4: "Play a game" — Y, the ▶ button on a ballpark's card, ⌘K and the help card; not in the dock (it stays at six)
  { id: 'showcase', label: 'Play', key: 'KeyY', keyLabel: 'Y', icon: RiPlayCircleLine, hint: 'play a game', hintP: 3, commandName: 'Play a game at the nearest ballpark',
    help: 'play a game — a 90-second Cubs, White Sox or Bears game at the ballpark whose card is open (else the nearest): the crowd, the lights, the players and the score; press again to stop it, and a real live game always wins',
    use: () => useSports((s) => s.showcase != null),
    isOn: () => useSports.getState().showcase != null,
    toggle: () => toggleShowcase(), ...always },
  // D2-3 (Decision 7): the streets under the streets — U, ⌘K and the help card; not in the dock (it stays at six).
  // Turning it on from far away flies you over the Loop's lower levels — never while following, touring or riding (C-fix)
  { id: 'lowerLevels', label: 'Lower', key: 'KeyU', keyLabel: 'U', icon: RiStackLine, hint: 'lower levels', hintP: 3, commandName: 'Lower levels: see Lower Wacker under the street',
    help: 'lower levels — the street over Lower Wacker, Lower Michigan, Lower Columbus and the other double-decker streets opens like a cut-away drawing, showing the roadway, columns and lights underneath; press again to close',
    use: () => useStore((s) => s.lowerLevelsOn),
    isOn: () => Boolean(useStore.getState().lowerLevelsOn),
    toggle: () => {
      const s = useStore.getState(), on = !s.lowerLevelsOn
      s.setLowerLevelsOn(on)
      if (!on) return
      if (s.follow || s.tour || s.ride) { s.showToast('Lower levels on — the cut-away shows over Lower Wacker and the Loop’s river streets · U closes it'); return }
      s.requestLowerLevelsView?.()
    },
    available: () => Boolean(readLowerLevels(useStore.getState().manifest)), useAvailable: () => useStore((s) => Boolean(readLowerLevels(s.manifest))) },
]

export const featureById = (id) => FEATURE_CONTROLS.find((c) => c.id === id)

// The dock's six buttons (user, 2026-09-30): Places takes Sound's slot — Sound stays on M, ⌘K and the help card.
const DOCK_ORDER = ['transit', 'games', 'places', 'bridges', 'fountain', 'fireworks']
export const DOCK_FEATURES = DOCK_ORDER.map(featureById).filter(Boolean)
