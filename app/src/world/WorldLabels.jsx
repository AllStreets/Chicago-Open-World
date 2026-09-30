// app/src/world/WorldLabels.jsx — one DOM layer for every world label (P4): positioned from 3D each frame (≤ 20 Hz),
// faded with distance and collision-culled by beaconLayout, so a crowded view stays readable. Labels are buttons.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { beaconLayout } from '../lib/labels.js'
import { allLabels } from './labelRegistry.js'

export default function WorldLabels() {
  const { gl, camera } = useThree()
  const layer = useMemo(() => { const d = document.createElement('div'); d.className = 'world-labels'; return d }, [])
  const nodes = useRef(new Map()), acc = useRef(0)
  useEffect(() => { gl.domElement.parentElement?.appendChild(layer); return () => layer.remove() }, [gl, layer])
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    acc.current += dt
    if (acc.current < 0.05) return
    acc.current = 0
    const items = allLabels(), r = gl.domElement.getBoundingClientRect()
    const toScreen = (x, y, z) => {
      v.set(x, y, z)
      const depth = v.distanceTo(camera.position)
      v.project(camera)
      return { sx: ((v.x + 1) / 2) * r.width, sy: ((1 - v.y) / 2) * r.height, depth, visible: v.z > -1 && v.z < 1 }
    }
    const out = beaconLayout(items, { toScreen, width: r.width, height: r.height, maxLabels: 16 })
    const byId = new Map(items.map((it) => [it.id, it])), seen = new Set()
    for (const o of out) {
      if (!o.labelled || o.alpha <= 0) continue
      const it = byId.get(o.id)
      let el = nodes.current.get(o.id)
      if (!el) {
        el = document.createElement('button'); el.type = 'button'; el.className = 'world-label'
        layer.appendChild(el); nodes.current.set(o.id, el)
      }
      if (el.textContent !== it.text) el.textContent = it.text
      el.style.transform = `translate(${o.sx}px, ${o.sy}px) translate(-50%, -100%)`
      el.style.opacity = String(o.alpha)
      el.style.setProperty('--dot', it.color ?? 'var(--accent)')
      el.onclick = () => it.onClick?.()
      seen.add(o.id)
    }
    for (const [id, el] of nodes.current) if (!seen.has(id)) { el.remove(); nodes.current.delete(id) }
  })
  return null
}
