// app/src/world/SkyRig.jsx — physical sky, sun light with shadows over Ring 0, fog.
import { useMemo } from 'react'
import { Sky } from '@react-three/drei'
import * as THREE from 'three'

const DAY_FOG = new THREE.Color('#b9c6d2'), NIGHT_FOG = new THREE.Color('#05080f')

export default function SkyRig({ sun }) {
  const [x, y, z] = sun.direction
  const sunPos = useMemo(() => [x * 5000, y * 5000, z * 5000], [x, y, z])
  const fog = useMemo(() => DAY_FOG.clone().lerp(NIGHT_FOG, sun.night), [sun.night])
  const sunI = Math.max(0, y) * 3.2 * (1 - sun.night * 0.9)
  return (
    <>
      <Sky sunPosition={sunPos} turbidity={6} rayleigh={1.6} mieCoefficient={0.006} mieDirectionalG={0.86} distance={45000} />
      <fog attach="fog" args={[fog, 900, 9000]} />
      <color attach="background" args={[fog]} />
      <hemisphereLight args={['#cfe3ff', '#6b6660', 1.1 - sun.night * 0.8]} />
      <directionalLight
        position={sunPos}
        intensity={sunI}
        color={y < 0.2 ? '#ffb27a' : '#fff4e6'}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
        shadow-camera-left={-2200}
        shadow-camera-right={2200}
        shadow-camera-top={2200}
        shadow-camera-bottom={-2200}
        shadow-camera-near={100}
        shadow-camera-far={12000}
      />
    </>
  )
}
