// app/src/world/Landmarks.jsx — V6 runtime: bridge leaves and lights, fountain show, Cloud Gate mirror, plaza people.
import { useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { facadeUniforms } from './materials/facadeMaterial.js'
import BridgeLeaves from '../bridges/BridgeLeaves.jsx'

const getJson = (file) => (file ? fetch(`/world/${file}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null))

export default function Landmarks({ manifest }) {
  const [bridges, setBridges] = useState(null)
  const [runtime, setRuntime] = useState(null)
  useEffect(() => { getJson(manifest.bridges).then(setBridges); getJson(manifest.landmarkRuntime).then(setRuntime) }, [manifest])
  useFrame(({ clock }) => { facadeUniforms.uTime.value = clock.elapsedTime })
  return (
    <>
      {bridges && <BridgeLeaves sidecar={bridges} />}
      {/* Tasks 9, 12, 14, 15, 16 add: BridgeLights, FountainShow, CloudGate, PlazaPeople, and the Crown face driver (they use `runtime`) */}
      {runtime && null}
    </>
  )
}
