// app/src/transit/StationHits.jsx — an invisible box over each station's platforms (never drawn), so a click opens its card.
import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../state/store.js'

const UP = new THREE.Vector3(0, 1, 0)

// A station box encloses any train at its platform: when the ray also hits a train, the train's card wins.
export const stationClickWins = (intersections) => !intersections.some((i) => i.object?.userData?.trainHits)

export default function StationHits() {
  const stations = useStore((s) => s.transit?.stations)
  const mesh = useMemo(() => {
    const list = stations ?? []
    const mat = new THREE.MeshBasicMaterial()
    mat.visible = false
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mat, Math.max(1, list.length))
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3()
    list.forEach((st, i) => {
      const len = st.y > 0 ? (st.operator === 'metra' ? 240 : 130) : 20 // platforms, or a subway entrance
      m.setMatrixAt(i, m4.compose(p.set(st.x, Math.max(0, st.y - 4), st.z), q.setFromAxisAngle(UP, st.heading - Math.PI / 2), s.set(len, 12, 14)))
    })
    m.count = list.length
    m.computeBoundingSphere()
    return m
  }, [stations])
  if (!stations?.length) return null
  const onClick = (e) => {
    if (e.delta > 4 || !stationClickWins(e.intersections ?? [])) return
    e.stopPropagation()
    const st = stations[e.instanceId]
    if (st) useStore.getState().select({ kind: 'station', id: st.id })
  }
  return <primitive object={mesh} onClick={onClick} />
}
