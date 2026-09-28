// app/src/world/Lake.jsx — Lake Michigan: a large reflective water plane under the land.
import { useMemo, useRef } from 'react'
import { extend, useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { Water } from 'three/examples/jsm/objects/Water.js'

extend({ Water })

export default function Lake({ sunDirection }) {
  const ref = useRef()
  const normals = useLoader(THREE.TextureLoader, '/textures/waternormals.jpg')
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping
  const geom = useMemo(() => new THREE.PlaneGeometry(40000, 40000), [])
  const config = useMemo(() => ({
    textureWidth: 1024, textureHeight: 1024, waterNormals: normals,
    sunDirection: new THREE.Vector3(...sunDirection), sunColor: 0xffffff,
    waterColor: 0x0b2733, distortionScale: 2.2, fog: true,
  }), [normals]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const w = ref.current
    if (!w) return
    w.material.uniforms.time.value += dt * 0.35
    w.material.uniforms.sunDirection.value.set(...sunDirection)
  })
  return <water ref={ref} args={[geom, config]} rotation-x={-Math.PI / 2} position={[0, -0.6, 0]} />
}
