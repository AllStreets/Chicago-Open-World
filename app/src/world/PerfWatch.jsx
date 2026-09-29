// app/src/world/PerfWatch.jsx — auto-downgrade quality on sustained slow frames (first ~40 s only).
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useStore } from '../state/store.js'
import { nextQuality } from '../lib/quality.js'
import { createPerfMeter } from '../lib/perfMeter.js'

const WATCH_S = 40

export default function PerfWatch() {
  const meter = useRef(createPerfMeter())
  const elapsed = useRef(0)
  useFrame((_, dt) => {
    if (!useStore.getState().load.ready || elapsed.current > WATCH_S) return
    if (typeof navigator !== 'undefined' && navigator.webdriver) return // automated runs keep a fixed quality
    elapsed.current += Math.min(dt, 0.25)
    if (meter.current.sample(dt) !== 'slow') return
    const q = useStore.getState().quality
    const next = nextQuality(99, q)
    if (next !== q) { console.info(`quality auto-downgraded to ${next}`); useStore.getState().setQuality(next) }
  })
  return null
}
