// app/src/world/BeachNets.jsx — F-8: a net on every sand volleyball court (beachNets.js), North Avenue Beach's dozens
// of courts above all. Three InstancedMeshes of a ~30-triangle model: the posts and tapes near the camera (they cast
// shadows), the same beyond (they don't), and the see-through mesh (never). Drawn only inside the view and within FAR_M,
// re-picked when the camera moves or turns. Out of the reflection pass (default layer only), never picked.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { decodeNets, pickNets, netGeometry, medianLength } from './beachNets.js'

const RESORT_M = 8, RESORT_S = 1.5, TURN_RAD = 0.035

function instanced(geometry, material, cap, castShadow) {
  const m = new THREE.InstancedMesh(geometry, material, Math.max(1, cap))
  m.count = 0
  m.visible = false
  m.frustumCulled = false // the instances span beaches kilometres apart; the pick is the cull
  m.castShadow = castShadow; m.receiveShadow = true
  m.raycast = () => {}
  return m
}

export default function BeachNets({ entry }) {
  const camera = useThree((s) => s.camera)
  const data = useMemo(() => {
    const nets = decodeNets(entry)
    if (!nets.length) return null
    const L = medianLength(nets), g = netGeometry(L)
    const solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide })
    const meshMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide, transparent: true, opacity: 0.2, depthWrite: false })
    return { nets, L, meshes: [instanced(g.solid, solidMat, nets.length, true), instanced(g.solid, solidMat, nets.length, false), instanced(g.mesh, meshMat, nets.length, false)] }
  }, [entry])
  useEffect(() => () => {
    if (!data) return
    const [near, , mesh] = data.meshes
    near.geometry.dispose(); mesh.geometry.dispose(); near.material.dispose(); mesh.material.dispose()
    for (const m of data.meshes) m.dispose()
  }, [data])

  const last = useRef({ p: new THREE.Vector3(Infinity, 0, 0), q: new THREE.Quaternion(), t: -Infinity })
  const tmp = useMemo(() => ({ frustum: new THREE.Frustum(), proj: new THREE.Matrix4(), sph: new THREE.Sphere(new THREE.Vector3(), 8), m4: new THREE.Matrix4(), q: new THREE.Quaternion(), up: new THREE.Vector3(0, 1, 0), P: new THREE.Vector3(), S: new THREE.Vector3() }), [])
  useFrame(({ clock }) => {
    if (!data) return
    const Lr = last.current
    if (camera.position.distanceTo(Lr.p) < RESORT_M && camera.quaternion.angleTo(Lr.q) < TURN_RAD && clock.elapsedTime - Lr.t < RESORT_S) return
    Lr.p.copy(camera.position); Lr.q.copy(camera.quaternion); Lr.t = clock.elapsedTime
    const { frustum, proj, sph, m4, q, up, P, S } = tmp
    camera.updateMatrixWorld(); proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(proj)
    const inView = (x, y, z) => { sph.center.set(x, y + 1.2, z); return frustum.intersectsSphere(sph) }
    const { lod0, lod1 } = pickNets(data.nets, [camera.position.x, camera.position.y, camera.position.z], { inView })
    const all = lod0.concat(lod1)
    ;[lod0, lod1, all].forEach((idx, k) => {
      const mesh = data.meshes[k]
      idx.forEach((ni, n) => {
        const b = data.nets[ni]
        q.setFromAxisAngle(up, b.yaw); P.set(b.x, b.y, b.z); S.set(b.len / data.L, 1, 1)
        mesh.setMatrixAt(n, m4.compose(P, q, S))
      })
      mesh.count = idx.length
      mesh.visible = idx.length > 0 // no empty instanced draw
      mesh.instanceMatrix.needsUpdate = true
    })
  })
  if (!data) return null
  return <>{data.meshes.map((m, i) => <primitive key={i} object={m} />)}</>
}
