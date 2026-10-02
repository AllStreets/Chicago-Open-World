// app/src/world/Boats.jsx — B-8: the boats in Chicago's harbours (boats.js). One InstancedMesh for the full model near
// the camera and one for the 220-triangle model out to LOD1_M, re-sorted when the camera moves; nothing beyond. They
// receive shadows but cast none, and stay out of the reflection pass (default layer only). Two draw calls at most.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { worldUrl } from '../lib/manifest.js'
import { facadeUniforms } from './materials/facadeMaterial.js'
import { decodeBoats, assignLods, mergeRoles, createBoatMaterial, roleUniform } from './boats.js'

const RESORT_M = 12, RESORT_S = 1.5

function instanced(geometry, material, cap) {
  const m = new THREE.InstancedMesh(geometry, material, Math.max(1, cap))
  m.count = 0
  m.frustumCulled = false // the instances span harbours kilometres apart; the distance sort is the cull
  m.castShadow = false; m.receiveShadow = true
  m.raycast = () => {}
  const attr = (name, size) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, cap) * size), size); a.setUsage(THREE.DynamicDrawUsage); geometry.setAttribute(name, a); return a }
  m.userData.attrs = { aKind: attr('aKind', 1), aHull: attr('aHull', 3), aTrim: attr('aTrim', 3), aPhase: attr('aPhase', 1) }
  return m
}

export default function Boats({ entry, version }) {
  const [data, setData] = useState(null)
  const camera = useThree((s) => s.camera)
  const uniforms = useMemo(() => ({ uRoleCol: { value: roleUniform() }, uBoatTime: { value: 0 }, uNight: facadeUniforms.uNight }), [])
  useEffect(() => {
    let alive = true
    Promise.all([
      fetch(worldUrl(entry.file, version)).then((r) => (r.ok ? r.json() : null)),
      new GLTFLoader().loadAsync(worldUrl(entry.model, version)),
    ]).then(([j, g]) => {
      if (!alive || !j) return
      const lod0 = mergeRoles(g.scene.getObjectByName('boat_lod0') ?? g.scene), lod1 = mergeRoles(g.scene.getObjectByName('boat_lod1') ?? g.scene)
      if (!lod0 || !lod1) return
      const boats = decodeBoats(j), mat = createBoatMaterial(uniforms)
      const hull = j.palette.hull.map((h) => new THREE.Color(h)), trim = j.palette.trim.map((h) => new THREE.Color(h))
      setData({ boats, y: j.y, meshes: [instanced(lod0, mat, boats.length), instanced(lod1, mat, boats.length)], hull, trim })
    }).catch((e) => console.warn('boats failed', e))
    return () => { alive = false }
  }, [entry, version, uniforms])
  useEffect(() => () => { for (const m of data?.meshes ?? []) { m.geometry.dispose(); m.dispose() } if (data) data.meshes[0].material.dispose() }, [data])

  const last = useRef({ p: new THREE.Vector3(Infinity, 0, 0), t: -Infinity })
  const m4 = useMemo(() => new THREE.Matrix4(), []), q = useMemo(() => new THREE.Quaternion(), []), up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const P = useMemo(() => new THREE.Vector3(), []), S = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock }, dt) => {
    uniforms.uBoatTime.value += dt
    if (!data) return
    const L = last.current
    if (camera.position.distanceTo(L.p) < RESORT_M && clock.elapsedTime - L.t < RESORT_S) return
    L.p.copy(camera.position); L.t = clock.elapsedTime
    const sets = assignLods(data.boats, [camera.position.x, camera.position.y - data.y, camera.position.z])
    ;[sets.lod0, sets.lod1].forEach((idx, k) => {
      const mesh = data.meshes[k], a = mesh.userData.attrs
      idx.forEach((bi, n) => {
        const b = data.boats[bi]
        q.setFromAxisAngle(up, b.yaw); P.set(b.x, data.y, b.z); S.setScalar(b.scale)
        mesh.setMatrixAt(n, m4.compose(P, q, S))
        a.aKind.array[n] = b.kind
        const h = data.hull[b.hull] ?? data.hull[0], t = data.trim[b.trim] ?? data.trim[0]
        a.aHull.array.set([h.r, h.g, h.b], n * 3); a.aTrim.array.set([t.r, t.g, t.b], n * 3)
        a.aPhase.array[n] = (bi * 2.399) % 6.283
      })
      mesh.count = idx.length
      mesh.visible = idx.length > 0 // no empty instanced draw
      mesh.instanceMatrix.needsUpdate = true
      for (const x of Object.values(a)) x.needsUpdate = true
    })
  })
  if (!data) return null
  return <>{data.meshes.map((m, i) => <primitive key={i} object={m} />)}</>
}
