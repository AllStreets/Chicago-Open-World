// app/src/world/Landmarks.jsx — V6 runtime: bridge leaves and lights, fountain show, Cloud Gate mirror, plaza people.
import { Suspense, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { facadeUniforms } from './materials/facadeMaterial.js'
import BridgeLeaves from '../bridges/BridgeLeaves.jsx'
import BridgeLights from '../bridges/BridgeLights.jsx'
import FountainShow from '../landmarks/FountainShow.jsx'
import { showEmitters } from '../landmarks/jets.js'
import CloudGate from '../landmarks/CloudGate.jsx'
import PlazaPeople from '../landmarks/PlazaPeople.jsx'
import { crownFace, crownWaterOn } from '../landmarks/crownFace.js'

const getJson = (file) => (file ? fetch(`/world/${file}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null))

export default function Landmarks({ manifest }) {
  const [bridges, setBridges] = useState(null)
  const [runtime, setRuntime] = useState(null)
  useEffect(() => { getJson(manifest.bridges).then(setBridges); getJson(manifest.landmarkRuntime).then(setRuntime) }, [manifest])
  const crownLevels = useRef([0, 0])
  useFrame(({ clock }) => {
    facadeUniforms.uTime.value = clock.elapsedTime
    const now = Date.now() / 1000, on = crownWaterOn(new Date())
    const a = crownFace(now, { waterOn: on }), b = crownFace(now + 150, { waterOn: on })   // the towers are out of step
    facadeUniforms.uCrown.value.set(a.face, a.pucker, a.smile, 1)
    facadeUniforms.uCrownB.value.set(b.face, b.pucker, b.smile, 1)
    crownLevels.current = [a.spout, b.spout]
  })
  return (
    <>
      {bridges && <BridgeLeaves sidecar={bridges} />}
      {bridges && <BridgeLights sidecar={bridges} />}
      {/* Tasks 9, 12, 14, 15, 16 add: BridgeLights, FountainShow, CloudGate, PlazaPeople, and the Crown face driver (they use `runtime`) */}
      {runtime?.fountain && <FountainShow emitters={showEmitters(runtime)} crownLevels={crownLevels} />}
      {runtime?.plazas?.length > 0 && <PlazaPeople plazas={runtime.plazas} />}
      {runtime?.detached?.filter((d) => d.key === 'cloudgate').map((d) => <Suspense key={d.key} fallback={null}><CloudGate file={d.file} centre={d.centre} /></Suspense>)}
    </>
  )
}
