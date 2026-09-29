// app/src/sports/Scoreboard.jsx — a canvas texture on the board face; redrawn only when its text changes.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { drawBoard } from './scoreboard.js'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'

export default function Scoreboard({ board, lines }) {
  const canvas = useMemo(() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 512; return c }, [])
  const tex = useMemo(() => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t }, [canvas])
  const manual = board.style === 'manual'
  const mat = useMemo(() => (manual
    ? new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.9 })
    : new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })), [manual, tex])
  const key = JSON.stringify(lines)
  useEffect(() => { drawBoard(canvas.getContext('2d'), lines, board.style, 1024, 512); tex.needsUpdate = true }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { tex.dispose(); mat.dispose() }, [tex, mat])
  useFrame(() => { if (manual) mat.emissiveIntensity = 0.35 * facadeUniforms.uNight.value })
  const [w, h] = manual ? [board.w * 0.55, board.h * 0.6] : [board.w * 0.9, board.h * 0.84]
  return (
    <mesh position={[board.center[0] + board.normal[0] * 0.03, board.center[1], board.center[2] + board.normal[1] * 0.03]} rotation={[0, Math.atan2(board.normal[0], board.normal[1]), 0]} material={mat} castShadow={false}>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}
