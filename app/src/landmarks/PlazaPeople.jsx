// app/src/landmarks/PlazaPeople.jsx — plaza crowds as one instanced draw; off at LOW or when far away.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { chicagoClock } from '../lib/chicagoTime.js'
import { plazaPeople } from './plazaPeople.js'

const SHIRTS = ['#2d4f8a', '#c23b30', '#e6e2d8', '#1f1f22', '#3f7a4a', '#d9a33a', '#7a4b8f', '#8fa8c8']
const CAP = 1200
export default function PlazaPeople({ plazas }) {
  const quality = useStore((s) => s.quality)
  const [hour, setHour] = useState(() => chicagoClock().hour)
  useEffect(() => { const id = setInterval(() => setHour(chicagoClock().hour), 60_000); return () => clearInterval(id) }, [])
  const people = useMemo(() => plazaPeople(plazas, hour, { cap: CAP }), [plazas, hour])
  const geo = useMemo(() => new THREE.CapsuleGeometry(0.23, 1.15, 3, 8), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.85 }), [])
  const ref = useRef()
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D(), c = new THREE.Color()
    people.forEach((p, i) => { o.position.set(p.x, 0.83, p.z); o.rotation.set(0, p.yaw, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, c.set(SHIRTS[p.shirt])) })
    m.count = people.length; m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [people, quality])
  useFrame(({ camera }) => {
    if (ref.current) ref.current.visible = plazas.some((p) => Math.hypot(camera.position.x - p.c[0], camera.position.z - p.c[1]) < 1200)
  })
  if (quality === 'LOW' || !people.length) return null
  return <instancedMesh ref={ref} args={[geo, mat, CAP]} frustumCulled={false} />
}
