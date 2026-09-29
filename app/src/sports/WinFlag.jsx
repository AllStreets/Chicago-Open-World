// app/src/sports/WinFlag.jsx — the W (or L) flag on the scoreboard mast, waving; faces the field.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { drawFlag } from './winFlag.js'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'

const FW = 4.6, FH = 2.9
// Lit by its own picture at night, like the floodlit board below it (a weeknight W flies only after dark).
export const flagMaterial = (tex) => new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0, side: THREE.DoubleSide, roughness: 0.85 })
export default function WinFlag({ pole, normal, kind }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 320
    drawFlag(c.getContext('2d'), kind, 512, 320)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  }, [kind])
  const uTime = useMemo(() => ({ value: 0 }), [])
  const mat = useMemo(() => {
    const m = flagMaterial(tex)
    m.onBeforeCompile = (s) => {
      s.uniforms.uTime = uTime
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat k = position.x / 4.6; transformed.z += sin(position.x * 1.4 - uTime * 3.2) * 0.25 * k; transformed.y -= 0.15 * k * k;')
    }
    return m
  }, [tex, uTime])
  const geo = useMemo(() => new THREE.PlaneGeometry(FW, FH, 16, 6).translate(FW / 2, -FH / 2, 0), [])
  useEffect(() => () => { tex.dispose(); mat.dispose() }, [tex, mat])
  useFrame((st) => { uTime.value = st.clock.elapsedTime; mat.emissiveIntensity = 0.8 * facadeUniforms.uNight.value })
  return <mesh geometry={geo} material={mat} position={[pole[0], pole[1] - 0.3, pole[2]]} rotation={[0, Math.atan2(normal[0], normal[1]), 0]} castShadow={false} />
}
