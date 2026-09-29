// app/src/hud/featureControls.js — every city-life feature and every way to reach it (backlog G3).
// The dock row, the keyboard, ⌘K, the help card and the hint bar all read this list, so a control can never be added
// in one place and forgotten in another. The adapters (use/isOn/toggle/available) are the only lines naming feature state.
import { RiTrainLine, RiTrophyLine, RiVolumeUpLine, RiVolumeMuteLine, RiShip2Line, RiDropLine } from 'react-icons/ri'
import { useStore } from '../state/store.js'
import { useSoundStore } from '../audio/soundStore.js'
import { FOUNTAIN_SCHEDULE } from '../landmarks/fountainSchedule.js'

const storeFlag = (field, setter) => ({
  use: () => useStore((s) => Boolean(s[field])),
  isOn: () => Boolean(useStore.getState()[field]),
  toggle: () => { const s = useStore.getState(); s[setter](!s[field]) },
})
const always = { available: () => true, useAvailable: () => true }

// the fountain preview runs one show; it is "on" while that show is playing
const previewOn = (start) => start != null && Date.now() - start < FOUNTAIN_SCHEDULE.showMinutes * 60000

export const FEATURE_CONTROLS = [
  { id: 'transit', label: 'Transit', key: 'KeyT', keyLabel: 'T', icon: RiTrainLine, hint: 'transit',
    help: 'show or hide the L and Metra lines, their glow and the trains', ...storeFlag('transitOn', 'setTransitOn'),
    available: () => Boolean(useStore.getState().transit), useAvailable: () => useStore((s) => Boolean(s.transit)) },
  { id: 'games', label: 'Games', key: 'KeyG', keyLabel: 'G', icon: RiTrophyLine, hint: 'games',
    help: "today's games — scores, and a flight to the ballpark", ...storeFlag('gamesOpen', 'setGamesOpen'), ...always },
  { id: 'sound', label: 'Sound', key: 'KeyM', keyLabel: 'M', icon: RiVolumeUpLine, iconOff: RiVolumeMuteLine, hint: 'sound',
    help: 'crowd cheers and passing trains — off until you turn it on',
    use: () => useSoundStore((s) => Boolean(s.soundOn)),
    isOn: () => Boolean(useSoundStore.getState().soundOn),
    toggle: () => { const s = useSoundStore.getState(); s.setSoundOn(!s.soundOn) }, ...always },
  { id: 'bridges', label: 'Bridges', key: 'KeyB', keyLabel: 'B', icon: RiShip2Line, hint: 'bridges', commandName: 'Raise the river bridges',
    help: 'raise the river bridges — a boat-run lift, one bascule after another',
    use: () => useStore((s) => s.bridgeLift != null && !s.bridgeLift.stoppedAt),
    isOn: () => { const l = useStore.getState().bridgeLift; return l != null && !l.stoppedAt },
    toggle: () => { const s = useStore.getState(); if (s.bridgeLift && !s.bridgeLift.stoppedAt) s.lowerBridges(); else s.startBridgeLift() }, ...always },
  { id: 'fountain', label: 'Fountain', key: 'KeyJ', keyLabel: 'J', icon: RiDropLine, hint: 'fountain', commandName: 'Buckingham Fountain water show',
    help: 'play the Buckingham Fountain water show now',
    use: () => useStore((s) => previewOn(s.fountainPreview)),
    isOn: () => previewOn(useStore.getState().fountainPreview),
    toggle: () => { const s = useStore.getState(); if (previewOn(s.fountainPreview)) s.stopFountainPreview(); else s.startFountainPreview() }, ...always },
]

export const featureById = (id) => FEATURE_CONTROLS.find((c) => c.id === id)
