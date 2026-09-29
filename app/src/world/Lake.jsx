// app/src/world/Lake.jsx — Lake Michigan: a large reflective water plane under the land.
import { useMemo, useRef } from 'react'
import { extend, useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { paletteFor } from '../lib/skyPalette.js'

extend({ Water })

export default function Lake({ sunRef }) {
  const ref = useRef()
  const normals = useLoader(THREE.TextureLoader, '/textures/waternormals.jpg')
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping
  const geom = useMemo(() => new THREE.PlaneGeometry(40000, 40000), [])
  const config = useMemo(() => ({
    textureWidth: 1024, textureHeight: 1024, waterNormals: normals,
    sunDirection: new THREE.Vector3(0, 1, 0), sunColor: 0xffffff,
    waterColor: 0x0b2733, distortionScale: 1.6, alpha: 0.96, fog: true,
  }), [normals])
  useFrame((_, dt) => {
    const w = ref.current, s = sunRef.current
    if (!w || !s) return
    const u = w.material.uniforms
    u.time.value += dt * 0.35
    u.sunDirection.value.set(...s)
    const p = paletteFor((Math.asin(Math.max(-1, Math.min(1, s[1]))) * 180) / Math.PI)
    u.waterColor.value.copy(p.water)
    u.sunColor.value.copy(p.sunColor)
    u.distortionScale.value = p.night > 0.5 ? 0.8 : 1.6 // calm night water → long light streaks
    u.size.value = 2.5
  })
  return <water ref={ref} args={[geom, config]} rotation-x={-Math.PI / 2} position={[0, -0.6, 0]} />
}
