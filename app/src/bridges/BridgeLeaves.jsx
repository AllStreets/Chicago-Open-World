// app/src/bridges/BridgeLeaves.jsx — drives every bascule leaf through one float texture (no extra draw calls).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { facadeUniforms } from '../world/materials/facadeMaterial.js'
import { useStore } from '../state/store.js'
import { liftState } from './lift.js'
import { packLeaves, LEAF_TEX_MIN, leafTextureFor } from './leafTexture.js'

// the live lift, shared with the lights and the music: leaf angles, seconds into the run, and the lift order
export const liveLift = { angles: {}, elapsed: null, order: [] }

export default function BridgeLeaves({ sidecar }) {
  const tex = useMemo(() => leafTextureFor(facadeUniforms.uLeafTex, Math.max(LEAF_TEX_MIN, sidecar.leaves.length)), [sidecar])
  useEffect(() => { packLeaves(sidecar.leaves, {}, tex.image.data); tex.needsUpdate = true }, [sidecar, tex])
  useEffect(() => { if (new URLSearchParams(window.location.search).has('stats')) window.__leaves = { tex, uniforms: facadeUniforms, live: liveLift, sidecar } }, [tex, sidecar])
  const acc = useRef(0), last = useRef('{}')
  useFrame((_, dt) => {
    acc.current += dt
    if (acc.current < 0.05) return
    acc.current = 0
    const lift = useStore.getState().bridgeLift
    const s = liftState({ now: Date.now(), manualStart: lift?.startedAt ?? null, manualStop: lift?.stoppedAt ?? null, order: sidecar.liftOrder })
    liveLift.elapsed = lift && !lift.stoppedAt ? (Date.now() - lift.startedAt) / 1000 : s.elapsed ?? null
    liveLift.order = s.order ?? sidecar.liftOrder
    if (s.done) useStore.getState().stopBridgeLift()
    const key = JSON.stringify(s.angles)
    if (key === last.current) return
    last.current = key
    liveLift.angles = s.angles
    packLeaves(sidecar.leaves, s.angles, tex.image.data)
    tex.needsUpdate = true
  })
  return null
}
