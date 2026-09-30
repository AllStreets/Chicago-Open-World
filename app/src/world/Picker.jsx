// app/src/world/Picker.jsx — hover and click on buildings (P4 · I-4.6). At most ten raycasts a second, against the
// LOD0/LOD1 `buildings` meshes only (never blocks, water or roads); each mesh gets its BVH the first time a ray
// crosses it, and each tile's sidecar is fetched once. Hover stays quiet while dragging, flying, touring or searching.
import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'
import { useStore } from '../state/store.js'
import { bldgIndexFromHit, buildingInfo, tooltipLines } from '../lib/picking.js'
import { pickPin } from './PoiPins.jsx'
import { POI_CATEGORIES } from '../data/poiCategories.js'

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast // meshes without a BVH fall back to the plain raycast

const HOVER_MS = 100
const sidecars = new Map() // url → sidecar json | 'loading'
function sidecar(url) {
  if (!url) return null
  const s = sidecars.get(url)
  if (s && s !== 'loading') return s
  if (!s) { sidecars.set(url, 'loading'); fetch(url).then((r) => r.json()).then((j) => sidecars.set(url, j)).catch(() => sidecars.delete(url)) }
  return null
}

export function quiet(s) { return Boolean(s.flight || s.tour?.playing || s.paletteOpen || s.follow) }

export default function Picker() {
  const { gl, camera, scene } = useThree()
  const ray = useRef(new THREE.Raycaster())
  useEffect(() => {
    const el = gl.domElement, ndc = new THREE.Vector2(), sphere = new THREE.Sphere()
    let last = 0, down = null, meshes = [], listedAt = 0
    const candidates = () => {
      const now = performance.now()
      if (now - listedAt > 1000) {
        meshes = []
        scene.traverse((o) => { if (o.isMesh && o.name === 'buildings' && o.userData?.lod && o.userData.lod !== 'block' && o.visible) meshes.push(o) })
        listedAt = now
      }
      return meshes
    }
    const pick = (e) => {
      const r = el.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      const rc = ray.current
      rc.setFromCamera(ndc, camera)
      rc.firstHitOnly = true
      const hitMeshes = candidates().filter((m) => {
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere()
        sphere.copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld)
        return rc.ray.intersectsSphere(sphere)
      })
      for (const m of hitMeshes) if (!m.geometry.boundsTree) m.geometry.computeBoundsTree()
      const hit = rc.intersectObjects(hitMeshes, false)[0]
      const idx = bldgIndexFromHit(hit)
      if (idx == null) return null
      const meta = sidecar(hit.object.userData.metaUrl)
      const info = meta ? buildingInfo(meta, idx, useStore.getState().manifest?.landmarks) : null
      return info ? { hit, info } : null
    }
    const clear = () => { if (useStore.getState().hover) useStore.getState().setHover(null); el.style.cursor = '' }
    const onMove = (e) => {
      if (e.buttons || quiet(useStore.getState())) { clear(); return }
      const now = performance.now()
      if (now - last < HOVER_MS) return
      last = now
      const pin = pickPin(e.clientX, e.clientY) // a place pin wins over the building behind it
      if (pin) { useStore.getState().setHover({ x: e.clientX, y: e.clientY, lines: [pin.n, [POI_CATEGORIES[pin.c]?.label, pin.a].filter(Boolean).join(' · ')], poiId: pin.id }); el.style.cursor = 'pointer'; return }
      const p = pick(e)
      if (!p) { clear(); return }
      useStore.getState().setHover({ x: e.clientX, y: e.clientY, lines: tooltipLines(p.info) })
      el.style.cursor = 'pointer'
    }
    const onDown = (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() } }
    const onUp = (e) => {
      const d = down; down = null
      if (!d || e.button !== 0 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4 || performance.now() - d.t > 400) return // a drag, not a click
      const pin = pickPin(e.clientX, e.clientY)
      if (pin) { useStore.getState().select({ kind: 'poi', id: pin.id, data: pin }); return }
      const p = pick(e)
      if (!p) return
      const { info, hit } = p, tileId = hit.object.userData.tileId, before = useStore.getState().selection
      // a station, train or ballpark clicked in the same gesture (their own click handlers) wins over the building behind
      setTimeout(() => {
        if (useStore.getState().selection !== before) return
        useStore.getState().select({ kind: info.hero ? 'landmark' : 'building', id: info.hero ?? `${tileId}:${info.id}`, data: { ...info, x: hit.point.x, z: hit.point.z } })
      }, 0)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointerleave', clear)
    return () => { el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointerup', onUp); el.removeEventListener('pointerleave', clear) }
  }, [gl, camera, scene])
  return null
}
