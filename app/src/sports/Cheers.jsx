// app/src/sports/Cheers.jsx — drives the cheers engine: listener = camera, one voice per venue near a game.
// Silent (no AudioContext at all) until the shared Sound button turns soundOn on.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useSoundStore, getAudioContext } from '../audio/soundStore.js' // V4 — shared with the train rumble
import { createCheers } from '../audio/cheers.js'
import { CHEER, murmurLevel, swellNow } from '../audio/cheerMath.js'
import { useSports } from './sportsStore.js'

const fwd = new THREE.Vector3()
export default function Cheers() {
  const soundOn = useSoundStore((s) => s.soundOn)
  const cheers = useMemo(() => createCheers(getAudioContext, { shared: true }), []) // one AudioContext for the whole city
  useEffect(() => { if (soundOn) cheers.enable(); else cheers.disable() }, [soundOn, cheers])
  useEffect(() => () => cheers.dispose(), [cheers])
  useFrame(({ camera }) => {
    if (!soundOn) return
    camera.getWorldDirection(fwd)
    cheers.setListener([camera.position.x, camera.position.y, camera.position.z], [fwd.x, fwd.y, fwd.z])
    const { venues, states, swells } = useSports.getState(), t = Date.now() / 1000
    for (const v of venues) {
      const st = states[v.key], near = Math.hypot(camera.position.x - v.center[0], camera.position.z - v.center[1]) < CHEER.maxDistance
      cheers.setVenue(v.key, [v.center[0], 15, v.center[1]], near ? murmurLevel(st?.state) : 0, near ? swellNow(st?.state, v.slot + 1, t, swells[v.key]) : 0)
    }
  })
  return null
}
