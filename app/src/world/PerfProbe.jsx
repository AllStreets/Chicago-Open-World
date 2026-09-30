// app/src/world/PerfProbe.jsx — samples draw calls after the composer's passes; publishes to the HUD and to e2e.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '../state/store.js'
import { createDrawProbe } from '../lib/drawProbe.js'
import { censusScene } from '../lib/drawCensus.js'

export default function PerfProbe() {
  const { gl, scene, camera } = useThree()
  const on = useStore((s) => s.perfOn)
  const probe = useMemo(() => createDrawProbe(gl.info), [gl])
  const since = useRef(0)
  useEffect(() => {
    if (!on) return undefined
    probe.start()
    if (new URLSearchParams(window.location.search).has('stats')) window.__census = () => censusScene(scene, camera)
    return () => { probe.stop(); window.__perf = undefined }
  }, [on, probe, scene, camera])
  // priority 1000: after EffectComposer (priority 1) has rendered every pass of this frame
  useFrame((_, dt) => {
    if (!on) return
    probe.frame(); probe.tick(dt)
    since.current += dt
    if (since.current < 0.5) return
    since.current = 0
    const s = probe.stats()
    window.__perf = s
    useStore.getState().setPerf(s)
  }, 1000)
  return null
}
