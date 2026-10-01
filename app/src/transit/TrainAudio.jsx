// app/src/transit/TrainAudio.jsx — the rumble of the nearest train, attenuated by distance; silent unless Sound is on.
// F-7 (2026-10-01): the L ride's own train counts (with its real speed) — the simulator trains near it step aside, so
// without it a ride fell silent — and from the front window it plays at in-car level, lower and fuller.
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSoundStore, getAudioContext } from '../audio/soundStore.js'
import { rumbleLevel, clatterHz, createRumble } from '../audio/rumble.js'
import { trainSoundLevel } from '../audio/rideSound.js'
import { audioLevels } from '../audio/levels.js'
import { getTrains } from './simStore.js'
import { withRideTrain } from '../ride/rideSession.js'
import { useStore } from '../state/store.js'

export default function TrainAudio() {
  const soundOn = useSoundStore((s) => s.soundOn)
  const rumble = useRef(null), acc = useRef(0)
  useEffect(() => {
    if (!soundOn) { audioLevels.train = 0; return undefined }
    const ctx = getAudioContext()
    if (!ctx) return undefined
    rumble.current = createRumble(ctx)
    return () => { rumble.current?.stop(); rumble.current = null; audioLevels.train = 0 }
  }, [soundOn])
  useFrame(({ camera }, dt) => {
    acc.current += dt
    if (acc.current < 0.2 || !rumble.current) return
    acc.current = 0
    let best = null, bd = Infinity
    for (const t of withRideTrain(getTrains())) for (const c of t.cars) {
      if (!c) continue
      const d = Math.hypot(c.pos[0] - camera.position.x, c.pos[1] - camera.position.y, c.pos[2] - camera.position.z)
      if (d < bd) { bd = d; best = { t, len: c.length } }
    }
    const cab = Boolean(best?.t.ride) && useStore.getState().ride?.view === 'cab'
    const level = !best ? 0 : best.t.ride ? trainSoundLevel(bd, best.t.speed, { soundOn: true, cab }) : rumbleLevel(bd, best.t.speed)
    rumble.current.set(level, best ? clatterHz(best.t.speed, best.len) : 0, cab)
    audioLevels.train = level
  })
  return null
}
