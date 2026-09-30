// app/src/hud/PerfOverlay.jsx — the perf chip (⌘K "Performance stats").
import { useStore } from '../state/store.js'

export default function PerfOverlay() {
  const on = useStore((s) => s.perfOn)
  const p = useStore((s) => s.perf)
  if (!on) return null
  return (
    <div className="hud-chip perf-chip" role="status" aria-label="Performance">
      {p ? `${p.calls} DRAW · ${(p.triangles / 1e6).toFixed(1)}M TRIS · ${p.fps} FPS` : 'MEASURING…'}
    </div>
  )
}
