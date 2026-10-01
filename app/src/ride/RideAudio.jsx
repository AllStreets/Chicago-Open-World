// app/src/ride/RideAudio.jsx — the sound of the ride you're on (F-7, 2026-10-01): a bus's engine and road, the glider's
// wind by speed, a walk's quiet city, and the door chime as the L ride pulls into a stop (its rumble is TrainAudio's).
// Nothing at all — no AudioContext — unless Sound is on and a ride is running.
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSoundStore, getAudioContext } from '../audio/soundStore.js'
import { createRideSound, rideSoundLevels, chimeAt } from '../audio/rideSound.js'
import { audioLevels } from '../audio/levels.js'
import { useStore } from '../state/store.js'
import { rideSoundState } from './rideSession.js'

const ZERO = { engine: 0, road: 0, wind: 0, ambience: 0 }

export default function RideAudio() {
  const soundOn = useSoundStore((s) => s.soundOn)
  const riding = useStore((s) => Boolean(s.ride))
  const voice = useRef(null), acc = useRef(0), prev = useRef(null)
  useEffect(() => {
    if (!soundOn || !riding) return undefined
    const ctx = getAudioContext()
    if (!ctx) return undefined
    voice.current = createRideSound(ctx)
    prev.current = null
    return () => { voice.current?.stop(); voice.current = null; Object.assign(audioLevels, ZERO) }
  }, [soundOn, riding])
  useFrame((_, dt) => {
    acc.current += dt
    if (acc.current < 0.2 || !voice.current) return
    acc.current = 0
    const st = rideSoundState()
    if (!st) return
    const lv = rideSoundLevels(st.kind, { speedMps: st.speedMps, soundOn: true })
    voice.current.set(lv)
    Object.assign(audioLevels, { engine: lv.engine, road: lv.road, wind: lv.wind, ambience: lv.ambience })
    if (st.kind === 'L' && chimeAt(prev.current, st)) { voice.current.chime(); audioLevels.chimes += 1 }
    prev.current = st
  })
  return null
}
