// app/src/scan/ScanController.jsx — drives Scan's uniforms each frame (P5 · I-5.4): the sweep starts at the camera when
// Scan is toggled (V, the SCAN pill or ⌘K), a re-toggle mid-sweep reverses from where the front had got to, reduced
// motion cross-fades instead, and the sky fades to the HUD's --bg as the front passes.
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { useStore } from '../state/store.js'
import { scanUniforms } from './scanShader.js'
import { scanUniformsAt, SCAN_MAX_R } from './scanMath.js'

export const scanNow = { sky: 0, on: false } // read by SkyRig and the overlays

export default function ScanController() {
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, [])
  const run = useRef({ changedAt: null, on: false, origin: [0, 0], prevRadius: 0, radius: 0 })
  useFrame(({ camera }) => {
    const s = useStore.getState(), r = run.current
    if (s.scan !== r.on) {
      // a toggle: the new front starts at the camera, from the radius the old one had reached
      r.prevRadius = r.radius; r.on = s.scan; r.changedAt = performance.now()
      if (r.prevRadius < 1) r.origin = [camera.position.x, camera.position.z]
    }
    const u = scanUniformsAt({ on: r.on, changedAt: r.changedAt ?? -Infinity, now: performance.now(), origin: r.origin, reducedMotion: reduced, prevRadius: r.prevRadius })
    r.radius = Number.isFinite(u.uScanRadius) ? u.uScanRadius : r.on ? SCAN_MAX_R : 0
    scanUniforms.uScan.value = u.uScan
    scanUniforms.uScanRadius.value = Number.isFinite(u.uScanRadius) ? u.uScanRadius : 1e7
    scanUniforms.uScanOrigin.value.set(r.origin[0], r.origin[1])
    scanNow.on = r.on
    scanNow.sky = reduced ? u.uScan : Math.min(1, r.radius / 2500)
  })
  return null
}
