// app/src/transit/TrainAudio.jsx — the rumble of the nearest train, attenuated by distance; silent unless Sound is on.
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSoundStore, getAudioContext } from '../audio/soundStore.js'
import { rumbleLevel, clatterHz, createRumble } from '../audio/rumble.js'
import { getTrains } from './simStore.js'

export default function TrainAudio() {
  const soundOn = useSoundStore((s) => s.soundOn)
  const rumble = useRef(null), acc = useRef(0)
  useEffect(() => {
    if (!soundOn) return
    const ctx = getAudioContext()
    if (!ctx) return
    rumble.current = createRumble(ctx)
    return () => { rumble.current?.stop(); rumble.current = null }
  }, [soundOn])
  useFrame(({ camera }, dt) => {
    acc.current += dt
    if (acc.current < 0.2 || !rumble.current) return
    acc.current = 0
    let best = null, bd = Infinity
    for (const t of getTrains()) for (const c of t.cars) {
      if (!c) continue
      const d = Math.hypot(c.pos[0] - camera.position.x, c.pos[1] - camera.position.y, c.pos[2] - camera.position.z)
      if (d < bd) { bd = d; best = { t, len: c.length } }
    }
    rumble.current.set(best ? rumbleLevel(bd, best.t.speed) : 0, best ? clatterHz(best.t.speed, best.len) : 0)
  })
  return null
}
