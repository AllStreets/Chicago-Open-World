// app/src/sports/WrigleyMarquee.jsx — the shaped, lettered red marquee at Clark & Addison, placed from the venue's
// marquee frame (pipeline venue.js). The face is a canvas texture redrawn only when the board's message changes;
// at night the lettering and board glow softly, like the real sign's lamps.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { marqueeOutline, marqueeMessage, drawMarquee, MARQUEE_RED } from './marquee.js'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'

const DEPTH = 0.6

export default function WrigleyMarquee({ marquee, st, now }) {
  const { w, h } = marquee
  const W = 1024, H = Math.round((1024 * h) / w)
  const canvas = useMemo(() => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c }, [W, H])
  const tex = useMemo(() => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t }, [canvas])
  const geo = useMemo(() => {
    const shape = new THREE.Shape(marqueeOutline(w, h).map(([x, y]) => new THREE.Vector2(x, y)))
    const g = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false, curveSegments: 1 })
    g.translate(0, -h / 2, -DEPTH)
    // map the front face's UVs onto the lettered canvas; the back and edges sample the plain red margin
    const pos = g.attributes.position, uv = g.attributes.uv
    for (let i = 0; i < pos.count; i++) {
      const front = Math.abs(pos.getZ(i)) < 1e-4
      uv.setXY(i, front ? pos.getX(i) / w + 0.5 : 0.5, front ? pos.getY(i) / h + 0.5 : 0.03)
    }
    return g
  }, [w, h])
  const mats = useMemo(() => [
    new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.55, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: MARQUEE_RED, roughness: 0.6, metalness: 0.2 }),
  ], [tex])
  const msg = marqueeMessage(st, now)
  const key = msg.join('|')
  useEffect(() => { drawMarquee(canvas.getContext('2d'), msg, W, H, w, h); tex.needsUpdate = true }, [key, W, H]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { tex.dispose(); geo.dispose(); mats.forEach((m) => m.dispose()) }, [tex, geo, mats])
  useFrame(() => { mats[0].emissiveIntensity = 0.45 * facadeUniforms.uNight.value })
  // stand the face just proud of the two posts (r 0.35 m) so they read as behind the sign
  const [nx, nz] = marquee.normal, cx = marquee.center[0] + nx * 0.45, cy = marquee.center[1], cz = marquee.center[2] + nz * 0.45
  return (
    <mesh position={[cx, cy, cz]} rotation={[0, Math.atan2(nx, nz), 0]} geometry={geo} material={mats} castShadow userData={{ marquee: true }} />
  )
}
