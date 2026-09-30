// app/src/transit/Trains.jsx — every simulated car as an instance of one of four models (a box far away), plus
// headlight flares and track spill: ≤ 8 draw calls with the two CTA shadow casters (B.1.6). An invisible
// instanced box per car (0 draw calls) makes trains clickable.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { worldUrl } from '../lib/manifest.js'
import { QUALITY } from '../lib/quality.js'
import { toPoolGeometry } from './pools.js'
import { getSim, publishTrains } from './simStore.js'
import { MODELS, LOD_M, SHADOW_CASTERS, layoutCars } from './layout.js'
import { createTrainMaterial, createLightsMaterial } from './trainMaterial.js'
import { refreshPickBounds } from './pick.js'

const CAP = { cta5000: 800, cta7000: 400, metraCoach: 300, metraLoco: 60, impostor: 1600, lights: 200, hits: 1600 }
const ATTRS = ['position', 'normal', 'color', '_kind']
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(0, 0, 0, 'YZX'), p = new THREE.Vector3(), sc = new THREE.Vector3()

// per-frame work reuses these: line colours are built once per transit.json, not every frame (V4 review #8)
const LAYOUT_KEYS = [...MODELS, 'impostor', 'hits']
const colourCache = new WeakMap()
function coloursFor(transit) {
  if (!transit) return {}
  if (!colourCache.has(transit)) colourCache.set(transit, Object.fromEntries(transit.lines.map((l) => [l.id, new THREE.Color(l.colour).toArray()])))
  return colourCache.get(transit)
}

function instanced(geometry, material, cap, extra = []) {
  const g = geometry.clone()
  for (const [name, size] of extra) g.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(cap * size), size))
  const mesh = new THREE.InstancedMesh(g, material, cap)
  mesh.count = 0
  mesh.frustumCulled = false // instances span the city; the per-frame count is the real limit
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  return mesh
}

export default function Trains({ file, version }) {
  const { scene } = useGLTF(worldUrl(file, version), false, true)
  const quality = useStore((s) => s.quality)
  const hits = useRef([])
  const meshes = useMemo(() => {
    scene.updateMatrixWorld(true)
    const mat = createTrainMaterial(), out = {}
    for (const k of MODELS) {
      const node = scene.getObjectByName(k), mesh = node.isMesh ? node : node.children.find((c) => c.isMesh)
      out[k] = instanced(toPoolGeometry(mesh.geometry, mesh.matrixWorld, ATTRS), mat, CAP[k], [['aLine', 3], ['aLead', 1]])
    }
    out.impostor = instanced(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#9aa0a4', roughness: 0.45, metalness: 0.6 }), CAP.impostor)
    out.lights = instanced(new THREE.PlaneGeometry(1, 1), createLightsMaterial(), CAP.lights, [['aMode', 1]])
    out.lights.renderOrder = 3
    const hitMat = new THREE.MeshBasicMaterial()
    hitMat.visible = false // raycast target only: never drawn
    out.hits = instanced(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), hitMat, CAP.hits)
    out.hits.userData.trainHits = true // station boxes defer to trains (StationHits)
    return out
  }, [scene])
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('stats')) window.__trainMeshes = [...MODELS.map((k) => meshes[k]), meshes.impostor, meshes.lights]
  }, [meshes])

  useFrame(({ camera }) => {
    const s = useStore.getState(), sim = getSim()
    const trains = sim && s.transitOn ? sim.trainsAt(Date.now()) : []
    publishTrains(trains)
    const colours = coloursFor(s.transit)
    const L = layoutCars(trains, camera.position.toArray(), { lod: LOD_M[s.quality] ?? LOD_M.HIGH, hidden: s.hiddenLines, colours })
    const dims = s.transit?.rollingStock ?? {}
    for (const k of LAYOUT_KEYS) {
      const mesh = meshes[k], items = L[k].slice(0, CAP[k]), a = mesh.geometry.attributes
      items.forEach((c, i) => {
        const d = dims[c.model]
        if (k === 'impostor' || k === 'hits') sc.set(d.length, d.height, d.width); else sc.set(1, 1, 1)
        mesh.setMatrixAt(i, m4.compose(p.set(c.pos[0], c.pos[1], c.pos[2]), q.setFromEuler(eu.set(0, c.yaw, c.pitch)), sc))
        if (a.aLine) { a.aLine.setXYZ(i, c.colour[0], c.colour[1], c.colour[2]); a.aLead.setX(i, c.lead) }
      })
      mesh.count = items.length
      mesh.instanceMatrix.needsUpdate = true
      if (a.aLine) { a.aLine.needsUpdate = true; a.aLead.needsUpdate = true }
    }
    hits.current = L.hits
    refreshPickBounds(meshes.hits)
    const lights = L.lights.slice(0, CAP.lights), la = meshes.lights.geometry.attributes
    lights.forEach((l, i) => {
      meshes.lights.setMatrixAt(i, m4.compose(p.set(l.pos[0], l.pos[1], l.pos[2]), q.setFromEuler(eu.set(0, l.yaw, 0)), sc.set(l.size, l.size, l.size)))
      la.aMode.setX(i, l.mode)
    })
    meshes.lights.count = lights.length
    meshes.lights.instanceMatrix.needsUpdate = true
    la.aMode.needsUpdate = true
  })

  const onHit = (ev) => {
    if (ev.delta > 4) return // a drag, not a click
    ev.stopPropagation()
    const it = hits.current[ev.instanceId]
    if (it) useStore.getState().select({ kind: 'train', id: it.trainId })
  }
  const shadows = QUALITY[quality].shadows
  return (
    <>
      {MODELS.map((k) => <primitive key={k} object={meshes[k]} castShadow={shadows && SHADOW_CASTERS.includes(k)} receiveShadow />)}
      <primitive object={meshes.impostor} />
      <primitive object={meshes.lights} />
      <primitive object={meshes.hits} onClick={onHit} />
    </>
  )
}
