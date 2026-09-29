// app/src/world/PerfWatch.jsx — auto-downgrade quality when frames are slow (first 30 s only).
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useStore } from '../state/store.js'
import { nextQuality } from '../lib/quality.js'

export default function PerfWatch() {
  const acc = useRef({ t: 0, n: 0, total: 0 })
  useFrame((_, dt) => {
    const a = acc.current
    if (a.total > 30 || !useStore.getState().load.ready) { if (!useStore.getState().load.ready) a.t = a.n = 0; return }
    a.t += dt; a.n++; a.total += dt
    if (a.t < 3) return
    const avgMs = (a.t / a.n) * 1000
    const q = useStore.getState().quality
    const next = nextQuality(avgMs, q)
    if (next !== q) { console.info(`quality auto-downgraded to ${next} (${avgMs.toFixed(1)} ms/frame)`); useStore.getState().setQuality(next) }
    a.t = a.n = 0
  })
  return null
}
